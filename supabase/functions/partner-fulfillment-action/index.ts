import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type Action = "accept" | "reject" | "mark_paid";

const PARTNER_FULFILLMENT_ACTION_VERSION = "2026-01-15-2";

type PartnerFulfillmentActionRequest = {
  fulfillment_id?: string;
  action?: Action;
  reason?: string;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  force_emails?: boolean;
  email_dedupe_suffix?: string;
};

function buildCorsHeaders(req: Request): Record<string, string> {
  const requested = String(req.headers.get("access-control-request-headers") || "").trim();
  const allowHeaders = requested || "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();

const CUSTOMER_HOMEPAGE_URL = "https://cypruseye.com";

function encodeStripeForm(obj: Record<string, unknown>): string {
  const out: string[] = [];
  const push = (k: string, v: unknown) => {
    if (v === undefined) return;
    if (v === null) return;
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  };
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${prefix}[${i}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(`${prefix}[${k}]`, v);
      }
      return;
    }
    push(prefix, value);
  };
  for (const [k, v] of Object.entries(obj)) walk(k, v);
  return out.join("&");
}

async function stripeCreateCheckoutSession(params: {
  currency: string;
  amount: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string;
  customerId?: string | null;
  clientReferenceId: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string; customerId: string | null }> {
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const resolvedCustomerId = String(params.customerId || "").trim();
  const form = encodeStripeForm({
    mode: "payment",
    "payment_method_types[0]": "card",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(resolvedCustomerId
      ? { customer: resolvedCustomerId }
      : {
          customer_email: params.customerEmail,
          customer_creation: "always",
        }),
    client_reference_id: params.clientReferenceId,
    line_items: [
      {
        price_data: {
          currency: String(params.currency || "EUR").toLowerCase(),
          product_data: { name: params.productName },
          unit_amount: Math.round(Number(params.amount || 0) * 100),
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: params.metadata,
      setup_future_usage: "off_session",
    },
    metadata: params.metadata,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stripe error ${res.status}: ${text.slice(0, 500)}`);
  }

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (_e) {
    json = null;
  }
  const id = String(json?.id || "").trim();
  const url = String(json?.url || "").trim();
  const customerId = String(json?.customer || resolvedCustomerId || "").trim();
  if (!id || !url) throw new Error("Stripe session missing id/url");
  return { id, url, customerId: customerId || null };
}

async function stripeFindCustomerIdByEmail(email: string): Promise<string | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !stripeSecretKey) return null;
  const endpoint = `https://api.stripe.com/v1/customers?email=${encodeURIComponent(normalized)}&limit=1`;
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "Authorization": `Bearer ${stripeSecretKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const id = String(json?.data?.[0]?.id || "").trim();
    return id || null;
  } catch (_e) {
    return null;
  }
}

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
    const raw = Math.ceil((e.getTime() - s.getTime()) / 86400000);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, raw);
  } catch (_e) {
    return 1;
  }
}

function extractDateParts(value: unknown): { year: number; month: number; day: number } | null {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function extractTimeParts(value: unknown): { hour: number; minute: number; second: number } {
  const fallback = { hour: 0, minute: 0, second: 0 };
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return fallback;
  return { hour, minute, second };
}

function diffStartedDays(startDate: unknown, endDate: unknown, startTime: unknown, endTime: unknown): number {
  const sDate = extractDateParts(startDate);
  const eDate = extractDateParts(endDate);
  if (!sDate || !eDate) return diffDays(startDate, endDate);

  const sTime = extractTimeParts(startTime);
  const eTime = extractTimeParts(endTime);

  const startMs = Date.UTC(sDate.year, sDate.month - 1, sDate.day, sTime.hour, sTime.minute, sTime.second);
  const endMs = Date.UTC(eDate.year, eDate.month - 1, eDate.day, eTime.hour, eTime.minute, eTime.second);
  const diffMs = endMs - startMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 1;
  return Math.max(1, Math.ceil(diffMs / 86400000));
}

async function isUserAdmin(supabase: any, userId: string): Promise<boolean> {
  const uid = String(userId || "").trim();
  if (!uid) return false;
  if (uid === "15f3d442-092d-4eb8-9627-db90da0283eb") return true;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", uid)
      .maybeSingle();
    if (error) return false;
    return Boolean((data as any)?.is_admin);
  } catch (_e) {
    return false;
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
): Promise<{
  mode: "per_day" | "per_hour" | "per_person" | "flat" | "percent_total";
  amount: number;
  currency: string;
  include_children: boolean;
} | null> {
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
      if (mode === "per_day" || mode === "per_hour" || mode === "per_person" || mode === "flat" || mode === "percent_total") {
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
  if (mode !== "per_day" && mode !== "per_hour" && mode !== "per_person" && mode !== "flat" && mode !== "percent_total") return null;
  return { mode, amount, currency, include_children: includeChildren };
}

function buildDepositRedirectUrl(params: {
  lang: "pl" | "en";
  result: "success" | "cancel";
  depositRequestId: string;
  category: "cars" | "trips" | "hotels";
  bookingId: string;
  amount: number;
  currency: string;
  reference?: string | null;
  summary?: string | null;
}): string {
  const url = new URL(CUSTOMER_HOMEPAGE_URL);
  url.pathname = "/deposit.html";
  url.searchParams.set("deposit", params.result);
  url.searchParams.set("lang", params.lang);
  url.searchParams.set("deposit_request_id", params.depositRequestId);
  url.searchParams.set("category", params.category);
  url.searchParams.set("booking_id", params.bookingId);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("currency", String(params.currency || "EUR"));
  if (params.reference) url.searchParams.set("reference", String(params.reference));
  if (params.summary) url.searchParams.set("summary", String(params.summary));
  const base = `${url.origin}${url.pathname}${url.search}`;
  return `${base}${base.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
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

function normalizeServiceCategory(value: unknown): "cars" | "trips" | "hotels" | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "cars" || v === "car") return "cars";
  if (v === "trips" || v === "trip") return "trips";
  if (v === "hotels" || v === "hotel") return "hotels";
  return null;
}

async function enqueueDepositPaidEmails(supabase: any, params: {
  depositRequestId: string;
  category: "cars" | "trips" | "hotels";
  bookingId: string;
  partnerId: string;
  fulfillmentId: string;
  dedupeSuffix?: string;
}) {
  const tableName = getServiceTableName(params.category);

  const suffixRaw = String(params.dedupeSuffix || "").trim();
  const suffix = suffixRaw ? `:${suffixRaw.slice(0, 80)}` : "";

  const partnerPayload = {
    category: params.category,
    record_id: params.bookingId,
    event: "partner_deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  const adminPayload = {
    category: params.category,
    record_id: params.bookingId,
    event: "deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  const customerPayload = {
    category: params.category,
    record_id: params.bookingId,
    event: "customer_deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "partner_deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: partnerPayload,
      p_dedupe_key: `deposit_partner_paid:${params.depositRequestId}${suffix}`,
    });
  } catch (_e) {
    // best-effort
  }

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: adminPayload,
      p_dedupe_key: `deposit_admin_paid:${params.depositRequestId}${suffix}`,
    });
  } catch (_e) {
    // best-effort
  }

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.category,
      p_event: "customer_deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: customerPayload,
      p_dedupe_key: `deposit_customer_paid:${params.depositRequestId}${suffix}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function enqueueAdminAlertOnServiceReject(
  supabase: any,
  params: {
    category: "cars" | "trips" | "hotels";
    bookingId: string;
    fulfillmentId: string;
    partnerId: string;
    reason?: string | null;
  },
) {
  const tableName = getServiceTableName(params.category);

  const payload = {
    category: params.category,
    record_id: params.bookingId,
    event: "partner_rejected",
    table: tableName,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
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
  let bookingRow: any = null;
  try {
    const bookingSelect = category === "cars"
      ? "lang, pickup_date, pickup_time, return_date, return_time"
      : "lang, arrival_date, departure_date";
    const { data: booking } = await supabase
      .from(tableName)
      .select(bookingSelect)
      .eq("id", bookingId)
      .maybeSingle();
    bookingRow = booking || null;
    lang = normalizeLang((booking as any)?.lang);
  } catch (_e) {
    lang = "en";
    bookingRow = null;
  }

  const rule = await loadDepositRule(supabase, {
    resource_type: category,
    resource_id: fulfillment?.resource_id ? String(fulfillment.resource_id) : null,
  });

  if (!rule) {
    throw new Error("Deposit rule not configured");
  }

  const fulfillmentDetails = fulfillment?.details && typeof fulfillment.details === "object" ? fulfillment.details : null;
  let depositAmount = 0;
  if (rule.mode === "percent_total") {
    const total = Number((fulfillment as any)?.total_price || 0);
    const pct = Number(rule.amount || 0);
    if (!(total > 0)) throw new Error("Fulfillment total price missing for percent_total deposit");
    if (!(pct > 0)) throw new Error("Deposit percent is 0");
    depositAmount = clampMoney((total * pct) / 100);
  } else {
    let multiplier = 1;
    if (rule.mode === "flat") {
      multiplier = 1;
    } else if (rule.mode === "per_day") {
      if (category === "cars") {
        const startDate = (bookingRow as any)?.pickup_date
          ?? fulfillmentDetails?.pickup_date
          ?? fulfillmentDetails?.pickupDate
          ?? fulfillment?.start_date;
        const endDate = (bookingRow as any)?.return_date
          ?? fulfillmentDetails?.return_date
          ?? fulfillmentDetails?.returnDate
          ?? fulfillment?.end_date;
        const startTime = (bookingRow as any)?.pickup_time
          ?? fulfillmentDetails?.pickup_time
          ?? fulfillmentDetails?.pickupTime
          ?? "10:00";
        const endTime = (bookingRow as any)?.return_time
          ?? fulfillmentDetails?.return_time
          ?? fulfillmentDetails?.returnTime
          ?? startTime
          ?? "10:00";

        multiplier = diffStartedDays(startDate, endDate, startTime, endTime);
        multiplier = Math.max(3, multiplier);
      } else {
        const start = (bookingRow as any)?.arrival_date ?? fulfillment?.start_date;
        const end = (bookingRow as any)?.departure_date ?? fulfillment?.end_date;
        multiplier = diffDays(start, end);
      }
    } else if (rule.mode === "per_hour") {
      if (category !== "trips") throw new Error("per_hour deposit only supported for trips");
      let hours = 0;
      try {
        const { data: bookingRow } = await supabase
          .from("trip_bookings")
          .select("num_hours")
          .eq("id", bookingId)
          .maybeSingle();
        hours = Number((bookingRow as any)?.num_hours || 0);
      } catch (_e) {
        hours = 0;
      }
      if (!(hours > 0)) {
        const raw = fulfillmentDetails?.num_hours ?? fulfillmentDetails?.numHours ?? fulfillmentDetails?.hours ?? 0;
        hours = Number(raw || 0);
      }
      multiplier = Math.max(1, Number.isFinite(hours) ? Math.round(hours) : 1);
    } else {
      const adults = fulfillmentDetails?.num_adults ?? fulfillmentDetails?.numAdults ?? 0;
      const children = fulfillmentDetails?.num_children ?? fulfillmentDetails?.numChildren ?? 0;
      const people = Number(adults || 0) + Number(rule.include_children ? (children || 0) : 0);
      multiplier = Math.max(1, Number.isFinite(people) ? people : 1);
    }

    depositAmount = clampMoney(Number(rule.amount || 0) * multiplier);
  }
  if (!(depositAmount > 0)) {
    throw new Error("Deposit amount is 0");
  }

  const currency = (rule.mode === "percent_total"
    ? String((fulfillment as any)?.currency || rule.currency || "EUR").trim() || "EUR"
    : String(rule.currency || "EUR").trim() || "EUR");
  const fulfillmentReference = fulfillment?.reference ? String(fulfillment.reference) : null;
  const fulfillmentSummary = fulfillment?.summary ? String(fulfillment.summary) : null;
  const existingRow = existing?.data && typeof existing.data === "object" ? (existing.data as any) : null;
  const existingId = String(existingRow?.id || "").trim();
  const existingStatus = String(existingRow?.status || "").trim().toLowerCase();
  const existingUrl = String(existingRow?.checkout_url || "").trim();
  const existingAmount = Number(existingRow?.amount || 0);
  const existingCurrency = String(existingRow?.currency || "").trim().toUpperCase();
  const targetCurrency = String(currency || "EUR").trim().toUpperCase();
  const amountMatches = Math.abs(existingAmount - depositAmount) <= 0.009;
  const currencyMatches = !existingCurrency || existingCurrency === targetCurrency;

  if (existingId && existingStatus === "paid") {
    return { deposit_request_id: existingId, checkout_url: existingUrl || "" };
  }
  if (existingId && existingStatus === "pending" && existingUrl && amountMatches && currencyMatches) {
    return { deposit_request_id: existingId, checkout_url: existingUrl };
  }

  let depositRequestId = existingId;
  if (depositRequestId) {
    await supabase
      .from("service_deposit_requests")
      .update({
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
        paid_at: null,
        stripe_payment_intent_id: null,
        stripe_checkout_session_id: null,
        checkout_url: null,
      })
      .eq("id", depositRequestId);
  } else {
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
  }

  if (!depositRequestId) {
    throw new Error("Failed to create deposit request");
  }

  const successUrl = buildDepositRedirectUrl({
    lang,
    result: "success",
    depositRequestId,
    category,
    bookingId,
    amount: depositAmount,
    currency,
    reference: fulfillmentReference,
    summary: fulfillmentSummary,
  });
  const cancelUrl = buildDepositRedirectUrl({
    lang,
    result: "cancel",
    depositRequestId,
    category,
    bookingId,
    amount: depositAmount,
    currency,
    reference: fulfillmentReference,
    summary: fulfillmentSummary,
  });

  const metadata: Record<string, string> = {
    deposit_request_id: depositRequestId,
    fulfillment_id: fulfillmentId,
    partner_id: partnerId,
    resource_type: category,
    booking_id: bookingId,
    deposit_amount: depositAmount.toFixed(2),
    deposit_currency: targetCurrency || "EUR",
  };

  const knownCustomerId = await stripeFindCustomerIdByEmail(customerEmail);
  const session = await stripeCreateCheckoutSession({
    currency,
    amount: depositAmount,
    productName: fulfillmentSummary ? `Deposit: ${fulfillmentSummary}` : "Deposit payment",
    successUrl,
    cancelUrl,
    customerEmail,
    customerId: knownCustomerId,
    clientReferenceId: depositRequestId,
    metadata,
  });

  const sessionId = String(session.id || "").trim();
  const url = String(session.url || "").trim();
  if (!sessionId || !url) throw new Error("Stripe session missing url");

  const sessionCustomerId = String(session.customerId || knownCustomerId || "").trim();
  const updatePayload: Record<string, unknown> = {
    stripe_checkout_session_id: sessionId,
    checkout_url: url,
  };
  if (sessionCustomerId) {
    updatePayload.stripe_customer_id = sessionCustomerId;
  }

  const updateRes = await supabase
    .from("service_deposit_requests")
    .update(updatePayload)
    .eq("id", depositRequestId);
  if (updateRes.error && sessionCustomerId && String(updateRes.error?.message || "").toLowerCase().includes("stripe_customer_id")) {
    await supabase
      .from("service_deposit_requests")
      .update({
        stripe_checkout_session_id: sessionId,
        checkout_url: url,
      })
      .eq("id", depositRequestId);
  }

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
  partnerId: string;
  reason?: string | null;
}) {
  const payload = {
    category: "shop",
    record_id: params.orderId,
    event: "partner_rejected",
    table: "shop_orders",
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
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
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(
      JSON.stringify({ ok: true, service: "partner-fulfillment-action", version: PARTNER_FULFILLMENT_ACTION_VERSION }),
      { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: buildCorsHeaders(req) });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let body: PartnerFulfillmentActionRequest;
  try {
    body = (await req.json()) as PartnerFulfillmentActionRequest;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const fulfillmentId = typeof body.fulfillment_id === "string" ? body.fulfillment_id : "";
  const action = body.action;
  if (!fulfillmentId || (action !== "accept" && action !== "reject" && action !== "mark_paid")) {
    return new Response(
      JSON.stringify({
        ok: false,
        version: PARTNER_FULFILLMENT_ACTION_VERSION,
        error: "Missing fulfillment_id or invalid action",
        received: {
          fulfillment_id: fulfillmentId || null,
          action: action ?? null,
        },
      }),
      {
        status: 400,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Validate JWT (partner identity) via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const userId = authData.user.id;

  const callerIsAdmin = await isUserAdmin(supabase, userId);

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
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const fulfillmentStatus = String((fulfillment as any).status || "");
  if (!partnerId) {
    return new Response(JSON.stringify({ error: "Fulfillment has no partner assigned" }), {
      status: 400,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // Verify membership explicitly
  if (!callerIsAdmin) {
    const { data: membership, error: mErr } = await supabase
      .from("partner_users")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("user_id", userId)
      .maybeSingle();

    if (mErr || !membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
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
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  if (!callerIsAdmin && (partner as any)?.status === "suspended") {
    return new Response(JSON.stringify({ error: "Partner suspended" }), {
      status: 403,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  if (fulfillmentStatus !== "pending_acceptance") {
    if (action === "accept" && fulfillmentStatus === "closed") {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "already_claimed",
          data: { booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId },
        }),
        { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (action === "mark_paid") {
      if (!callerIsAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (kind !== "service") {
        return new Response(JSON.stringify({ error: "mark_paid only supported for service fulfillments" }), {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const nowIso = new Date().toISOString();

      const { data: depRow, error: depErr } = await supabase
        .from("service_deposit_requests")
        .select("id, status, booking_id, partner_id, resource_type, amount, currency")
        .eq("fulfillment_id", fulfillmentId)
        .maybeSingle();

      if (depErr || !depRow) {
        return new Response(JSON.stringify({ error: "Deposit request not found for fulfillment" }), {
          status: 404,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const depositRequestId = String((depRow as any).id || "").trim();
      const depositBookingId = String((depRow as any).booking_id || bookingId || "").trim();
      const depositPartnerId = String((depRow as any).partner_id || partnerId || "").trim();
      const depCategory = normalizeServiceCategory((depRow as any).resource_type || serviceCategory);
      if (!depositRequestId || !depositBookingId || !depositPartnerId || !depCategory) {
        return new Response(JSON.stringify({ error: "Deposit request missing required refs" }), {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const paymentIntentId = typeof body.stripe_payment_intent_id === "string" ? body.stripe_payment_intent_id.trim() : "";
      const sessionId = typeof body.stripe_checkout_session_id === "string" ? body.stripe_checkout_session_id.trim() : "";

      const forceEmails = Boolean((body as any).force_emails) || Boolean(String((body as any).email_dedupe_suffix || "").trim());
      const dedupeSuffix = forceEmails
        ? (String((body as any).email_dedupe_suffix || "").trim() || `force_${new Date().toISOString()}`)
        : undefined;

      await supabase
        .from("service_deposit_requests")
        .update({
          status: "paid",
          paid_at: nowIso,
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_checkout_session_id: sessionId || null,
        })
        .eq("id", depositRequestId)
        .neq("status", "paid");

      await supabase
        .from("partner_service_fulfillments")
        .update({
          status: "accepted",
          contact_revealed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", fulfillmentId);

      const table = getServiceTableName(depCategory);
      await supabase
        .from(table)
        .update({
          deposit_paid_at: nowIso,
          deposit_amount: Number((depRow as any).amount || 0) || 0,
          deposit_currency: String((depRow as any).currency || "EUR").trim() || "EUR",
        })
        .eq("id", depositBookingId)
        .is("deposit_paid_at", null);

      await enqueueDepositPaidEmails(supabase, {
        depositRequestId,
        category: depCategory,
        bookingId: depositBookingId,
        partnerId: depositPartnerId,
        fulfillmentId,
        dedupeSuffix,
      });

      return new Response(
        JSON.stringify({ ok: true, data: { booking_id: depositBookingId, fulfillment_id: fulfillmentId, deposit_request_id: depositRequestId } }),
        { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

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
        { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    if (action === "reject" && fulfillmentStatus === "rejected") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_rejected", data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId } }),
        { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Invalid fulfillment status: ${fulfillmentStatus}` }), {
      status: 409,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
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
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      if (!Array.isArray(updRows) || updRows.length === 0) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "status_changed" }), {
          status: 200,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const updatedStatus = String((updRows as any)?.[0]?.status || "").trim();
      if (kind === "service" && updatedStatus === "closed") {
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: true,
            reason: "already_claimed",
            data: { booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId },
          }),
          { status: 200, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
        );
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
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
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
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(rejRows) || rejRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "status_changed" }), {
        status: 200,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
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
        await sendAdminAlertOnReject(supabase, { orderId, fulfillmentId, partnerId, reason: reason || null });
      }
    } else if (bookingId && (serviceCategory === "cars" || serviceCategory === "trips" || serviceCategory === "hotels")) {
      await enqueueAdminAlertOnServiceReject(supabase, {
        category: serviceCategory,
        bookingId,
        fulfillmentId,
        partnerId,
        reason: reason || null,
      });
    }

    return new Response(JSON.stringify({ ok: true, data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId } }), {
      status: 200,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Partner fulfillment action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
