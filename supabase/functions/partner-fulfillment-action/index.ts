import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";

type Action = "accept" | "reject";

type PartnerFulfillmentActionRequest = {
  fulfillment_id?: string;
  action?: Action;
  reason?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CUSTOMER_HOMEPAGE_URL = "https://cypruseye.com";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function normalizeLang(value: unknown): "pl" | "en" {
  const v = String(value || "").trim().toLowerCase();
  return v === "pl" ? "pl" : "en";
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100) / 100);
}

function diffDays(start: unknown, end: unknown): number {
  if (!start || !end) return 1;
  try {
    const s = new Date(`${String(start).slice(0, 10)}T00:00:00`);
    const e = new Date(`${String(end).slice(0, 10)}T00:00:00`);
    const raw = Math.round((e.getTime() - s.getTime()) / 86400000);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, raw);
  } catch (_e) {
    return 1;
  }
}

async function isDepositEnabled(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("deposit_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (error) return true;
    if (!data) return true;
    return Boolean((data as any).deposit_enabled);
  } catch (_e) {
    return true;
  }
}

async function loadDepositRule(
  supabase: any,
  params: { resource_type: "cars" | "trips" | "hotels"; resource_id?: string | null },
): Promise<{ mode: "per_day" | "per_person" | "flat"; amount: number; currency: string; include_children: boolean } | null> {
  const rt = params.resource_type;
  const rid = String(params.resource_id || "").trim();

  if (rid) {
    const { data: overrideRow, error: oErr } = await supabase
      .from("service_deposit_overrides")
      .select("mode, amount, currency, include_children, enabled")
      .eq("resource_type", rt)
      .eq("resource_id", rid)
      .maybeSingle();

    if (!oErr && overrideRow && (overrideRow as any).enabled) {
      const mode = String((overrideRow as any).mode || "").trim() as any;
      const amount = Number((overrideRow as any).amount || 0);
      const currency = String((overrideRow as any).currency || "EUR").trim() || "EUR";
      const includeChildren = Boolean((overrideRow as any).include_children);
      if (mode === "per_day" || mode === "per_person" || mode === "flat") {
        return { mode, amount, currency, include_children: includeChildren };
      }
    }
  }

  const { data: ruleRow, error: rErr } = await supabase
    .from("service_deposit_rules")
    .select("mode, amount, currency, include_children, enabled")
    .eq("resource_type", rt)
    .maybeSingle();

  if (rErr || !ruleRow || !(ruleRow as any).enabled) return null;
  const mode = String((ruleRow as any).mode || "").trim() as any;
  const amount = Number((ruleRow as any).amount || 0);
  const currency = String((ruleRow as any).currency || "EUR").trim() || "EUR";
  const includeChildren = Boolean((ruleRow as any).include_children);
  if (mode !== "per_day" && mode !== "per_person" && mode !== "flat") return null;
  return { mode, amount, currency, include_children: includeChildren };
}

function buildDepositRedirectUrl(params: { lang: "pl" | "en"; result: "success" | "cancel" }): string {
  const url = new URL(CUSTOMER_HOMEPAGE_URL);
  url.searchParams.set("deposit", params.result);
  url.searchParams.set("lang", params.lang);
  return `${url.origin}${url.pathname}${url.search}`;
}

async function enqueueCustomerDepositEmail(supabase: any, params: {
  category: "cars" | "trips" | "hotels";
  bookingId: string;
  depositRequestId: string;
  fulfillmentId: string;
  partnerId: string;
}) {
  const tableName = getServiceTableName(params.category);
  const payload = {
    category: params.category,
    record_id: params.bookingId,
    event: "customer_deposit_requested",
    table: tableName,
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "customer_deposit_requested",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `deposit_customer_requested:${params.depositRequestId}`,
    });
  } catch (_e) {
  }
}

function getFunctionsBaseUrl(): string {
  const explicit = (Deno.env.get("FUNCTIONS_BASE_URL") || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const legacy = (Deno.env.get("SUPABASE_FUNCTIONS_URL") || "").trim();
  if (legacy) return legacy.replace(/\/$/, "");

  const supabaseUrlRaw = (Deno.env.get("SUPABASE_URL") || "").trim();
  if (!supabaseUrlRaw) return "";

  try {
    const url = new URL(supabaseUrlRaw);
    const host = url.hostname;
    const projectRef = host.split(".")[0] || "";
    if (!projectRef) return "";
    return `https://${projectRef}.functions.supabase.co`;
  } catch (_e) {
    return "";
  }
}

async function sendAdminAlertOnAccept(supabase: any, params: {
  orderId: string;
  fulfillmentId: string;
  partnerId: string;
  allAccepted: boolean;
}) {
  const payload = {
    category: "shop",
    record_id: params.orderId,
    event: "partner_accepted",
    table: "shop_orders",
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
    all_accepted: params.allAccepted,
    note: `Partner accepted fulfillment ${params.fulfillmentId}`,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: "shop",
      p_event: "partner_accepted",
      p_record_id: params.orderId,
      p_table_name: "shop_orders",
      p_payload: payload,
      p_dedupe_key: `shop_partner_accepted:${params.orderId}:${params.fulfillmentId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function enqueueAdminAlertOnServiceAccept(
  supabase: any,
  params: {
    category: "cars" | "trips" | "hotels";
    bookingId: string;
    fulfillmentId: string;
    partnerId: string;
  },
) {
  const tableName = getServiceTableName(params.category);

  const payload = {
    category: params.category,
    record_id: params.bookingId,
    event: "partner_accepted",
    table: tableName,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
    note: `Partner accepted service fulfillment ${params.fulfillmentId}`,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "partner_accepted",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `${params.category}_partner_accepted:${params.bookingId}:${params.fulfillmentId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

function getServiceTableName(category: "cars" | "trips" | "hotels"): string {
  if (category === "cars") return "car_bookings";
  if (category === "trips") return "trip_bookings";
  return "hotel_bookings";
}

async function enqueueAdminAlertOnServiceReject(
  supabase: any,
  params: {
    category: "cars" | "trips" | "hotels";
    bookingId: string;
    fulfillmentId: string;
    reason?: string | null;
  },
) {
  const tableName = getServiceTableName(params.category);

  const payload = {
    category: params.category,
    record_id: params.bookingId,
    event: "partner_rejected",
    table: tableName,
    record: {
      id: params.bookingId,
      note: `Partner rejected service fulfillment ${params.fulfillmentId}${params.reason ? `: ${params.reason}` : ""}`,
    },
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "partner_rejected",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `${params.category}_partner_rejected:${params.bookingId}:${params.fulfillmentId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function createDepositCheckoutForServiceFulfillment(params: {
  supabase: any;
  fulfillment: any;
  partnerId: string;
  bookingId: string;
  category: "cars" | "trips" | "hotels";
}): Promise<{ deposit_request_id: string; checkout_url: string } | null> {
  const { supabase, fulfillment, partnerId, bookingId, category } = params;

  const depositEnabled = await isDepositEnabled(supabase);
  if (!depositEnabled) return null;

  const fulfillmentId = String(fulfillment?.id || "");
  if (!fulfillmentId) return null;

  const existing = await supabase
    .from("service_deposit_requests")
    .select("*")
    .eq("fulfillment_id", fulfillmentId)
    .maybeSingle();

  if (existing?.data && (existing.data as any).checkout_url) {
    const url = String((existing.data as any).checkout_url || "").trim();
    const id = String((existing.data as any).id || "").trim();
    if (id && url) return { deposit_request_id: id, checkout_url: url };
  }

  const { data: contactRow } = await supabase
    .from("partner_service_fulfillment_contacts")
    .select("customer_name, customer_email, customer_phone")
    .eq("fulfillment_id", fulfillmentId)
    .maybeSingle();

  const customerName = String((contactRow as any)?.customer_name || "").trim() || null;
  const customerEmail = String((contactRow as any)?.customer_email || "").trim();
  const customerPhone = String((contactRow as any)?.customer_phone || "").trim() || null;
  if (!customerEmail) {
    throw new Error("Missing customer email for deposit");
  }

  const tableName = getServiceTableName(category);
  let lang: "pl" | "en" = "en";
  try {
    const { data: booking } = await supabase
      .from(tableName)
      .select("lang")
      .eq("id", bookingId)
      .maybeSingle();
    lang = normalizeLang((booking as any)?.lang);
  } catch (_e) {
    lang = "en";
  }

  const rule = await loadDepositRule(supabase, {
    resource_type: category,
    resource_id: fulfillment?.resource_id ? String(fulfillment.resource_id) : null,
  });

  if (!rule) {
    throw new Error("Deposit rule not configured");
  }

  const multiplier = (() => {
    if (rule.mode === "flat") return 1;
    if (rule.mode === "per_day") {
      const start = fulfillment?.start_date;
      const end = fulfillment?.end_date;
      return diffDays(start, end);
    }
    const details = fulfillment?.details && typeof fulfillment.details === "object" ? fulfillment.details : null;
    const adults = details?.num_adults ?? details?.numAdults ?? 0;
    const children = details?.num_children ?? details?.numChildren ?? 0;
    const people = Number(adults || 0) + Number(rule.include_children ? (children || 0) : 0);
    return Math.max(1, Number.isFinite(people) ? people : 1);
  })();

  const depositAmount = clampMoney(Number(rule.amount || 0) * multiplier);
  if (!(depositAmount > 0)) {
    throw new Error("Deposit amount is 0");
  }

  const currency = String(rule.currency || "EUR").trim() || "EUR";
  const fulfillmentReference = fulfillment?.reference ? String(fulfillment.reference) : null;
  const fulfillmentSummary = fulfillment?.summary ? String(fulfillment.summary) : null;

  let depositRequestId = "";
  try {
    const insertRes = await supabase
      .from("service_deposit_requests")
      .insert({
        fulfillment_id: fulfillmentId,
        partner_id: partnerId,
        resource_type: category,
        booking_id: bookingId,
        resource_id: fulfillment?.resource_id || null,
        fulfillment_reference: fulfillmentReference,
        fulfillment_summary: fulfillmentSummary,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        lang,
        amount: depositAmount,
        currency,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    depositRequestId = String((insertRes.data as any)?.id || "");
    if (insertRes.error) throw insertRes.error;
  } catch (e: any) {
    const code = String(e?.code || "");
    if (code !== "23505") {
      throw e;
    }
  }

  if (!depositRequestId) {
    const { data: after } = await supabase
      .from("service_deposit_requests")
      .select("id")
      .eq("fulfillment_id", fulfillmentId)
      .maybeSingle();
    depositRequestId = String((after as any)?.id || "");
  }

  if (!depositRequestId) {
    throw new Error("Failed to create deposit request");
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: String(currency).toLowerCase(),
          product_data: {
            name: fulfillmentSummary
              ? `Deposit: ${fulfillmentSummary}`
              : `Deposit payment`,
          },
          unit_amount: Math.round(depositAmount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: buildDepositRedirectUrl({ lang, result: "success" }),
    cancel_url: buildDepositRedirectUrl({ lang, result: "cancel" }),
    customer_email: customerEmail,
    client_reference_id: depositRequestId,
    metadata: {
      deposit_request_id: depositRequestId,
      fulfillment_id: fulfillmentId,
      partner_id: partnerId,
      resource_type: category,
      booking_id: bookingId,
    },
  });

  const sessionId = String(session.id || "").trim();
  const url = String(session.url || "").trim();
  if (!sessionId || !url) throw new Error("Stripe session missing url");

  await supabase
    .from("service_deposit_requests")
    .update({
      stripe_checkout_session_id: sessionId,
      checkout_url: url,
    })
    .eq("id", depositRequestId);

  await enqueueCustomerDepositEmail(supabase, {
    category,
    bookingId,
    depositRequestId,
    fulfillmentId,
    partnerId,
  });

  return { deposit_request_id: depositRequestId, checkout_url: url };
}

async function sendAdminAlertOnReject(supabase: any, params: {
  orderId: string;
  fulfillmentId: string;
  reason?: string | null;
}) {
  const payload = {
    category: "shop",
    record_id: params.orderId,
    event: "partner_rejected",
    table: "shop_orders",
    record: {
      id: params.orderId,
      note: `Partner rejected fulfillment ${params.fulfillmentId}${params.reason ? `: ${params.reason}` : ""}`,
    },
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: "shop",
      p_event: "partner_rejected",
      p_record_id: params.orderId,
      p_table_name: "shop_orders",
      p_payload: payload,
      p_dedupe_key: `shop_partner_rejected:${params.orderId}:${params.fulfillmentId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function sendCustomerConfirmedEmail(orderId: string) {
  const base = getFunctionsBaseUrl();
  if (!base) return;

  const secret = (Deno.env.get("CUSTOMER_NOTIFY_SECRET") || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["x-customer-notify-secret"] = secret;

  try {
    await fetch(`${base}/send-customer-notification`, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId, type: "confirmed" }),
    });
  } catch (_e) {
    // best-effort
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: PartnerFulfillmentActionRequest;
  try {
    body = (await req.json()) as PartnerFulfillmentActionRequest;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fulfillmentId = typeof body.fulfillment_id === "string" ? body.fulfillment_id : "";
  const action = body.action;
  if (!fulfillmentId || (action !== "accept" && action !== "reject")) {
    return new Response(JSON.stringify({ error: "Missing fulfillment_id or invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Validate JWT (partner identity) via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = authData.user.id;

  let kind: "shop" | "service" = "shop";
  let fulfillment: any = null;
  let partnerId: string | null = null;
  let orderId = "";
  let bookingId = "";
  let serviceCategory: "cars" | "trips" | "hotels" | "" = "";

  {
    const { data, error } = await supabase
      .from("shop_order_fulfillments")
      .select("id, order_id, partner_id, status")
      .eq("id", fulfillmentId)
      .maybeSingle();
    if (!error && data) {
      kind = "shop";
      fulfillment = data;
      partnerId = (data as any).partner_id as string | null;
      orderId = String((data as any).order_id || "");
    }
  }

  if (!fulfillment) {
    const { data, error } = await supabase
      .from("partner_service_fulfillments")
      .select("id, partner_id, status, booking_id, resource_type")
      .eq("id", fulfillmentId)
      .maybeSingle();
    if (!error && data) {
      kind = "service";
      fulfillment = data;
      partnerId = (data as any).partner_id as string | null;
      bookingId = String((data as any).booking_id || "");
      const rt = String((data as any).resource_type || "").toLowerCase();
      if (rt === "cars" || rt === "car") serviceCategory = "cars";
      if (rt === "trips" || rt === "trip") serviceCategory = "trips";
      if (rt === "hotels" || rt === "hotel") serviceCategory = "hotels";
    }
  }

  if (!fulfillment) {
    return new Response(JSON.stringify({ error: "Fulfillment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fulfillmentStatus = String((fulfillment as any).status || "");
  if (!partnerId) {
    return new Response(JSON.stringify({ error: "Fulfillment has no partner assigned" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify membership explicitly
  const { data: membership, error: mErr } = await supabase
    .from("partner_users")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !membership) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("status")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerErr) {
    console.error("Failed to load partner:", partnerErr);
    return new Response(JSON.stringify({ error: "Partner lookup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((partner as any)?.status === "suspended") {
    return new Response(JSON.stringify({ error: "Partner suspended" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (fulfillmentStatus !== "pending_acceptance") {
    if (action === "accept" && (fulfillmentStatus === "accepted" || (kind === "service" && fulfillmentStatus === "awaiting_payment"))) {
      let deposit: any = null;

      if (kind === "service") {
        try {
          const { data: depRow } = await supabase
            .from("service_deposit_requests")
            .select("id, checkout_url, status")
            .eq("fulfillment_id", fulfillmentId)
            .maybeSingle();
          if (depRow) {
            deposit = {
              deposit_request_id: (depRow as any).id,
              checkout_url: (depRow as any).checkout_url,
              status: (depRow as any).status,
            };
          }
        } catch (_e) {}

        if (!deposit && fulfillmentStatus === "awaiting_payment" && bookingId && (serviceCategory === "cars" || serviceCategory === "trips" || serviceCategory === "hotels")) {
          try {
            const depositEnabled = await isDepositEnabled(supabase);
            if (depositEnabled) {
              const { data: fullRow } = await supabase
                .from("partner_service_fulfillments")
                .select("id, partner_id, resource_type, booking_id, resource_id, start_date, end_date, reference, summary, details")
                .eq("id", fulfillmentId)
                .maybeSingle();
              if (fullRow) {
                deposit = await createDepositCheckoutForServiceFulfillment({
                  supabase,
                  fulfillment: fullRow,
                  partnerId,
                  bookingId,
                  category: serviceCategory,
                });
              }
            }
          } catch (_e) {
            // best-effort
          }
        }
      }
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_accepted", data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId, all_accepted: false, deposit } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "reject" && fulfillmentStatus === "rejected") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_rejected", data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Invalid fulfillment status: ${fulfillmentStatus}` }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (action === "accept") {
      const nowIso = new Date().toISOString();

      const depositEnabled = kind === "service" ? await isDepositEnabled(supabase) : false;
      const serviceNextStatus = depositEnabled ? "awaiting_payment" : "accepted";

      const updatePayload = kind === "service"
        ? {
          status: serviceNextStatus,
          accepted_at: nowIso,
          accepted_by: userId,
          rejected_at: null,
          rejected_by: null,
          rejected_reason: null,
          contact_revealed_at: depositEnabled ? null : nowIso,
        }
        : {
          status: "accepted",
          accepted_at: nowIso,
          accepted_by: userId,
          rejected_at: null,
          rejected_by: null,
          rejected_reason: null,
          contact_revealed_at: nowIso,
        };

      const { data: updRows, error: updErr } = await supabase
        .from(kind === "shop" ? "shop_order_fulfillments" : "partner_service_fulfillments")
        .update(updatePayload)
        .eq("id", fulfillmentId)
        .eq("status", "pending_acceptance")
        .select("id, status");

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message || "accept_failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!Array.isArray(updRows) || updRows.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "status_changed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("partner_audit_log").insert({
        partner_id: partnerId,
        actor_user_id: userId,
        action: "fulfillment_accepted",
        entity_type: kind === "shop" ? "shop_order_fulfillment" : "service_fulfillment",
        entity_id: fulfillmentId,
        metadata: kind === "shop" ? { order_id: orderId } : { booking_id: bookingId, resource_type: serviceCategory },
      });

      if (kind === "service") {
        let deposit: any = null;
        if (depositEnabled && bookingId && (serviceCategory === "cars" || serviceCategory === "trips" || serviceCategory === "hotels")) {
          const { data: fullRow } = await supabase
            .from("partner_service_fulfillments")
            .select("id, partner_id, resource_type, booking_id, resource_id, start_date, end_date, reference, summary, details")
            .eq("id", fulfillmentId)
            .maybeSingle();
          if (fullRow) {
            deposit = await createDepositCheckoutForServiceFulfillment({
              supabase,
              fulfillment: fullRow,
              partnerId,
              bookingId,
              category: serviceCategory,
            });
          }
        }

        if (bookingId && (serviceCategory === "cars" || serviceCategory === "trips" || serviceCategory === "hotels")) {
          await enqueueAdminAlertOnServiceAccept(supabase, {
            category: serviceCategory,
            bookingId,
            fulfillmentId,
            partnerId,
          });
        }
        return new Response(JSON.stringify({ ok: true, data: { booking_id: bookingId, fulfillment_id: fulfillmentId, partner_id: partnerId, deposit } }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Compute order-level acceptance
      const { data: allRows, error: listErr } = await supabase
        .from("shop_order_fulfillments")
        .select("partner_id, status")
        .eq("order_id", orderId);

      if (listErr) {
        console.error("Failed to list fulfillments for acceptance check:", listErr);
      }

      const rows = Array.isArray(allRows) ? allRows : [];
      const partnerRows = rows.filter((r: any) => r?.partner_id);
      const anyRejected = partnerRows.some((r: any) => String(r.status) === "rejected");
      const allAccepted = partnerRows.length > 0 && partnerRows.every((r: any) => String(r.status) === "accepted");
      const acceptanceStatus = anyRejected ? "rejected" : allAccepted ? "accepted" : "pending";

      await supabase
        .from("shop_orders")
        .update({ partner_acceptance_status: acceptanceStatus, partner_acceptance_updated_at: nowIso })
        .eq("id", orderId);

      if (allAccepted) {
        await sendCustomerConfirmedEmail(orderId);
      }

      if (orderId) {
        await sendAdminAlertOnAccept(supabase, { orderId, fulfillmentId, partnerId, allAccepted });
      }

      return new Response(JSON.stringify({ ok: true, data: { order_id: orderId, fulfillment_id: fulfillmentId, partner_id: partnerId, all_accepted: allAccepted } }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reason = typeof body.reason === "string" ? body.reason : "";

    const nowIso = new Date().toISOString();
    const { data: rejRows, error: rejErr } = await supabase
      .from(kind === "shop" ? "shop_order_fulfillments" : "partner_service_fulfillments")
      .update({
        status: "rejected",
        rejected_at: nowIso,
        rejected_by: userId,
        rejected_reason: reason || null,
      })
      .eq("id", fulfillmentId)
      .eq("status", "pending_acceptance")
      .select("id, status");

    if (rejErr) {
      return new Response(JSON.stringify({ error: rejErr.message || "reject_failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(rejRows) || rejRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "status_changed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("partner_audit_log").insert({
      partner_id: partnerId,
      actor_user_id: userId,
      action: "fulfillment_rejected",
      entity_type: kind === "shop" ? "shop_order_fulfillment" : "service_fulfillment",
      entity_id: fulfillmentId,
      metadata: kind === "shop" ? { order_id: orderId, reason } : { booking_id: bookingId, resource_type: serviceCategory, reason },
    });

    if (kind === "shop") {
      await supabase
        .from("shop_orders")
        .update({ partner_acceptance_status: "rejected", partner_acceptance_updated_at: nowIso })
        .eq("id", orderId);

      if (orderId) {
        await sendAdminAlertOnReject(supabase, { orderId, fulfillmentId, reason: reason || null });
      }
    } else if (bookingId && (serviceCategory === "cars" || serviceCategory === "trips" || serviceCategory === "hotels")) {
      await enqueueAdminAlertOnServiceReject(supabase, {
        category: serviceCategory,
        bookingId,
        fulfillmentId,
        reason: reason || null,
      });
    }

    return new Response(JSON.stringify({ ok: true, data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Partner fulfillment action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
