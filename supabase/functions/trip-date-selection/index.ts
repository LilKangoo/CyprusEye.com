import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type Action = "send_options" | "preview" | "confirm";

type TripDateSelectionRequest = {
  action?: Action;
  fulfillment_id?: string;
  booking_id?: string;
  token?: string;
  selected_date?: string;
  lang?: string;
};

const FUNCTION_VERSION = "2026-02-26-1";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
const CUSTOMER_HOMEPAGE_URL = "https://cypruseye.com";

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

function jsonResponse(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ version: FUNCTION_VERSION, ...payload }), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function normalizeLang(value: unknown): "pl" | "en" {
  const v = String(value || "").trim().toLowerCase();
  return v === "pl" ? "pl" : "en";
}

function readLocalizedText(value: unknown, lang: "pl" | "en"): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        return readLocalizedText(parsed, lang);
      } catch (_e) {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const direct = String(obj[lang] ?? "").trim();
    if (direct) return direct;
    const fallback = String(obj[lang === "pl" ? "en" : "pl"] ?? "").trim();
    if (fallback) return fallback;
    for (const key of ["title", "name", "label", "value"]) {
      const nested = readLocalizedText(obj[key], lang);
      if (nested) return nested;
    }
  }

  return "";
}

function resolveTripTitleFromRow(row: any, lang: "pl" | "en"): string {
  if (!row || typeof row !== "object") return "";
  return readLocalizedText((row as any)?.title_i18n, lang)
    || readLocalizedText((row as any)?.title, lang)
    || readLocalizedText((row as any)?.name_i18n, lang)
    || readLocalizedText((row as any)?.name, lang)
    || String((row as any)?.slug || "").trim();
}

function normalizeTripResourceType(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "trip" || raw === "trips") return "trips";
  return raw;
}

function normalizeIsoDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function uniqueIsoDateList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const iso = normalizeIsoDate(raw);
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    out.push(iso);
  }
  return out;
}

function isIsoInRange(valueIso: string, minIso: string | null, maxIso: string | null): boolean {
  if (!valueIso) return false;
  if (minIso && valueIso < minIso) return false;
  if (maxIso && valueIso > maxIso) return false;
  return true;
}

function normalizeTripOptions(values: unknown, minIso: string | null, maxIso: string | null): { ok: true; dates: string[] } | { ok: false; error: string } {
  const list = uniqueIsoDateList(values).slice(0, 10);
  const out: string[] = [];

  for (const iso of list) {
    if (!isIsoInRange(iso, minIso, maxIso)) {
      return { ok: false, error: `Date ${iso} is outside customer stay dates` };
    }
    out.push(iso);
    if (out.length > 3) {
      return { ok: false, error: "Maximum 3 date options is allowed" };
    }
  }

  if (!out.length) return { ok: false, error: "No valid proposed dates found" };
  return { ok: true, dates: out };
}

function firstIso(...values: unknown[]): string | null {
  for (const value of values) {
    const iso = normalizeIsoDate(value);
    if (iso) return iso;
  }
  return null;
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateSelectionToken(): string {
  const random = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(random);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const arr = new Uint8Array(hash);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  params: { resource_type: "trips"; resource_id?: string | null },
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

function encodeStripeForm(obj: Record<string, unknown>): string {
  const out: string[] = [];
  const push = (k: string, v: unknown) => {
    if (v === undefined || v === null) return;
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
  if (!stripeSecretKey) throw new Error("Missing STRIPE_SECRET_KEY");

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
  if (!res.ok) throw new Error(`Stripe error ${res.status}: ${text.slice(0, 500)}`);

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

function buildDepositRedirectUrl(params: {
  lang: "pl" | "en";
  result: "success" | "cancel";
  depositRequestId: string;
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
  url.searchParams.set("category", "trips");
  url.searchParams.set("booking_id", params.bookingId);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("currency", String(params.currency || "EUR"));
  if (params.reference) url.searchParams.set("reference", String(params.reference));
  if (params.summary) url.searchParams.set("summary", String(params.summary));
  const base = `${url.origin}${url.pathname}${url.search}`;
  return `${base}${base.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

async function enqueueCustomerDepositEmail(supabase: any, params: {
  bookingId: string;
  depositRequestId: string;
  fulfillmentId: string;
  partnerId: string;
  dedupeSuffix?: string;
}) {
  const dedupeSuffix = String(params.dedupeSuffix || "").trim();
  const dedupeKey = dedupeSuffix
    ? `deposit_customer_requested:${params.depositRequestId}:${dedupeSuffix}`
    : `deposit_customer_requested:${params.depositRequestId}`;

  const payload = {
    category: "trips",
    record_id: params.bookingId,
    event: "customer_deposit_requested",
    table: "trip_bookings",
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: "trips",
      p_event: "customer_deposit_requested",
      p_record_id: params.bookingId,
      p_table_name: "trip_bookings",
      p_payload: payload,
      p_dedupe_key: dedupeKey,
    });
  } catch (_e) {
    // best effort
  }
}

function textSummaryFromTrip(booking: any): string {
  const slug = String(booking?.trip_slug || "").trim();
  if (slug) return slug;
  return "Trip booking";
}

async function createTripDepositCheckout(params: {
  supabase: any;
  fulfillment: any;
  booking: any;
  selectedDateIso: string;
}): Promise<{ deposit_request_id: string; checkout_url: string } | null> {
  const { supabase, fulfillment, booking } = params;

  const depositEnabled = await isDepositEnabled(supabase);
  if (!depositEnabled) return null;

  const fulfillmentId = String(fulfillment?.id || "").trim();
  const bookingId = String(fulfillment?.booking_id || booking?.id || "").trim();
  const partnerId = String(fulfillment?.partner_id || "").trim();
  if (!fulfillmentId || !bookingId || !partnerId) throw new Error("Missing fulfillment references for deposit");

  const { data: contactRow } = await supabase
    .from("partner_service_fulfillment_contacts")
    .select("customer_name, customer_email, customer_phone")
    .eq("fulfillment_id", fulfillmentId)
    .maybeSingle();

  const customerName = String((contactRow as any)?.customer_name || booking?.customer_name || "").trim() || null;
  const customerEmail = String((contactRow as any)?.customer_email || booking?.customer_email || "").trim();
  const customerPhone = String((contactRow as any)?.customer_phone || booking?.customer_phone || "").trim() || null;
  if (!customerEmail) throw new Error("Missing customer email for trip deposit");

  const rule = await loadDepositRule(supabase, {
    resource_type: "trips",
    resource_id: fulfillment?.resource_id ? String(fulfillment.resource_id) : null,
  });
  if (!rule) throw new Error("Trip deposit rule not configured");

  const details = fulfillment?.details && typeof fulfillment.details === "object"
    ? fulfillment.details
    : {};

  let depositAmount = 0;
  if (rule.mode === "percent_total") {
    const total = Number(fulfillment?.total_price || booking?.total_price || 0);
    const pct = Number(rule.amount || 0);
    if (!(total > 0)) throw new Error("Trip total missing for percent_total deposit");
    if (!(pct > 0)) throw new Error("Trip deposit percent is 0");
    depositAmount = clampMoney((total * pct) / 100);
  } else {
    let multiplier = 1;
    if (rule.mode === "flat") {
      multiplier = 1;
    } else if (rule.mode === "per_day") {
      const start = booking?.arrival_date || details?.arrival_date || booking?.trip_date || params.selectedDateIso;
      const end = booking?.departure_date || details?.departure_date || start;
      multiplier = diffDays(start, end);
    } else if (rule.mode === "per_hour") {
      const hoursRaw = booking?.num_hours ?? details?.num_hours ?? details?.numHours ?? 0;
      const hours = Number(hoursRaw || 0);
      multiplier = Math.max(1, Number.isFinite(hours) ? Math.round(hours) : 1);
    } else {
      const adults = Number(booking?.num_adults ?? details?.num_adults ?? details?.numAdults ?? 0);
      const children = Number(booking?.num_children ?? details?.num_children ?? details?.numChildren ?? 0);
      const people = adults + (rule.include_children ? children : 0);
      multiplier = Math.max(1, Number.isFinite(people) ? people : 1);
    }

    depositAmount = clampMoney(Number(rule.amount || 0) * multiplier);
  }

  if (!(depositAmount > 0)) throw new Error("Trip deposit amount is 0");

  const currency = (rule.mode === "percent_total"
    ? String(fulfillment?.currency || booking?.currency || rule.currency || "EUR").trim() || "EUR"
    : String(rule.currency || "EUR").trim() || "EUR");

  const { data: existing } = await supabase
    .from("service_deposit_requests")
    .select("id, status, amount, currency, checkout_url")
    .eq("fulfillment_id", fulfillmentId)
    .maybeSingle();

  const existingRow = existing && typeof existing === "object" ? (existing as any) : null;
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
        resource_type: "trips",
        booking_id: bookingId,
        resource_id: fulfillment?.resource_id || null,
        fulfillment_reference: fulfillment?.reference ? String(fulfillment.reference) : `TRIP-${bookingId.slice(0, 8).toUpperCase()}`,
        fulfillment_summary: fulfillment?.summary ? String(fulfillment.summary) : textSummaryFromTrip(booking),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        lang: normalizeLang(booking?.lang),
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
    const { data: inserted, error: insertErr } = await supabase
      .from("service_deposit_requests")
      .insert({
        fulfillment_id: fulfillmentId,
        partner_id: partnerId,
        resource_type: "trips",
        booking_id: bookingId,
        resource_id: fulfillment?.resource_id || null,
        fulfillment_reference: fulfillment?.reference ? String(fulfillment.reference) : `TRIP-${bookingId.slice(0, 8).toUpperCase()}`,
        fulfillment_summary: fulfillment?.summary ? String(fulfillment.summary) : textSummaryFromTrip(booking),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        lang: normalizeLang(booking?.lang),
        amount: depositAmount,
        currency,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (insertErr) throw insertErr;
    depositRequestId = String((inserted as any)?.id || "").trim();
    if (!depositRequestId) {
      const { data: after } = await supabase
        .from("service_deposit_requests")
        .select("id")
        .eq("fulfillment_id", fulfillmentId)
        .maybeSingle();
      depositRequestId = String((after as any)?.id || "").trim();
    }
  }

  if (!depositRequestId) throw new Error("Failed to create trip deposit request");

  const lang = normalizeLang(booking?.lang);
  const successUrl = buildDepositRedirectUrl({
    lang,
    result: "success",
    depositRequestId,
    bookingId,
    amount: depositAmount,
    currency,
    reference: fulfillment?.reference ? String(fulfillment.reference) : null,
    summary: fulfillment?.summary ? String(fulfillment.summary) : textSummaryFromTrip(booking),
  });
  const cancelUrl = buildDepositRedirectUrl({
    lang,
    result: "cancel",
    depositRequestId,
    bookingId,
    amount: depositAmount,
    currency,
    reference: fulfillment?.reference ? String(fulfillment.reference) : null,
    summary: fulfillment?.summary ? String(fulfillment.summary) : textSummaryFromTrip(booking),
  });

  const metadata: Record<string, string> = {
    deposit_request_id: depositRequestId,
    fulfillment_id: fulfillmentId,
    partner_id: partnerId,
    resource_type: "trips",
    booking_id: bookingId,
    deposit_amount: depositAmount.toFixed(2),
    deposit_currency: targetCurrency || "EUR",
  };

  const knownCustomerId = await stripeFindCustomerIdByEmail(customerEmail);
  const session = await stripeCreateCheckoutSession({
    currency,
    amount: depositAmount,
    productName: fulfillment?.summary ? `Deposit: ${String(fulfillment.summary)}` : "Deposit payment",
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
  if (sessionCustomerId) updatePayload.stripe_customer_id = sessionCustomerId;

  const updateRes = await supabase
    .from("service_deposit_requests")
    .update(updatePayload)
    .eq("id", depositRequestId);

  if (updateRes.error && sessionCustomerId && String(updateRes.error?.message || "").toLowerCase().includes("stripe_customer_id")) {
    await supabase
      .from("service_deposit_requests")
      .update({ stripe_checkout_session_id: sessionId, checkout_url: url })
      .eq("id", depositRequestId);
  }

  await enqueueCustomerDepositEmail(supabase, {
    bookingId,
    depositRequestId,
    fulfillmentId,
    partnerId,
    dedupeSuffix: "trip_date_selected",
  });

  return { deposit_request_id: depositRequestId, checkout_url: url };
}

async function loadTripDateRequestByTokenHash(supabase: any, tokenHash: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("trip_date_selection_requests")
    .select("*")
    .eq("selection_token_hash", tokenHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(req, 500, { error: "Missing Supabase config" });
  }

  let body: TripDateSelectionRequest;
  try {
    body = (await req.json()) as TripDateSelectionRequest;
  } catch (_e) {
    return jsonResponse(req, 400, { error: "Invalid JSON" });
  }

  const action = String(body?.action || "").trim().toLowerCase() as Action;
  if (action !== "send_options" && action !== "preview" && action !== "confirm") {
    return jsonResponse(req, 400, { error: "Invalid action" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (action === "send_options") {
    const token = extractBearerToken(req);
    if (!token) return jsonResponse(req, 401, { error: "Unauthorized" });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return jsonResponse(req, 401, { error: "Unauthorized" });

    const userId = String(authData.user.id || "").trim();
    const isAdmin = await isUserAdmin(supabase, userId);

    const fulfillmentId = String(body.fulfillment_id || "").trim();
    const bookingIdRaw = String(body.booking_id || "").trim();

    if (!fulfillmentId && !bookingIdRaw) {
      return jsonResponse(req, 400, { error: "fulfillment_id or booking_id is required" });
    }

    let fulfillment: any = null;
    if (fulfillmentId) {
      const { data, error } = await supabase
        .from("partner_service_fulfillments")
        .select("id, booking_id, partner_id, resource_type, status, details, resource_id, summary, total_price, currency")
        .eq("id", fulfillmentId)
        .maybeSingle();
      if (error || !data) return jsonResponse(req, 404, { error: "Fulfillment not found" });
      fulfillment = data;
    } else {
      const { data, error } = await supabase
        .from("partner_service_fulfillments")
        .select("id, booking_id, partner_id, resource_type, status, details, resource_id, summary, total_price, currency, created_at")
        .in("resource_type", ["trips", "trip"])
        .eq("booking_id", bookingIdRaw)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return jsonResponse(req, 404, { error: "Trip fulfillment not found" });
      fulfillment = data;
    }

    if (normalizeTripResourceType(fulfillment?.resource_type) !== "trips") {
      return jsonResponse(req, 400, { error: "Fulfillment is not a trip fulfillment" });
    }

    if (!isAdmin) {
      const partnerId = String(fulfillment?.partner_id || "").trim();
      if (!partnerId) return jsonResponse(req, 403, { error: "Forbidden" });
      const { data: membership, error: mErr } = await supabase
        .from("partner_users")
        .select("id")
        .eq("partner_id", partnerId)
        .eq("user_id", userId)
        .maybeSingle();
      if (mErr || !membership) return jsonResponse(req, 403, { error: "Forbidden" });
    }

    const bookingId = String(fulfillment?.booking_id || bookingIdRaw || "").trim();
    if (!bookingId) return jsonResponse(req, 400, { error: "Missing booking_id on fulfillment" });

    const { data: booking, error: bookingErr } = await supabase
      .from("trip_bookings")
      .select("id, trip_id, trip_slug, customer_name, customer_email, customer_phone, trip_date, preferred_trip_date, selected_trip_date, arrival_date, departure_date, num_adults, num_children, num_hours, num_days, total_price, lang")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingErr || !booking) return jsonResponse(req, 404, { error: "Trip booking not found" });

    const details = fulfillment?.details && typeof fulfillment.details === "object" ? fulfillment.details : {};

    const stayFrom = firstIso((booking as any)?.arrival_date, details?.arrival_date, (fulfillment as any)?.start_date);
    const stayTo = firstIso((booking as any)?.departure_date, details?.departure_date, (fulfillment as any)?.end_date, stayFrom);
    const preferredDate = firstIso(
      details?.preferred_date,
      (booking as any)?.preferred_trip_date,
      (booking as any)?.trip_date,
    );

    let minIso = stayFrom;
    let maxIso = stayTo;
    if (minIso && maxIso && minIso > maxIso) {
      const tmp = minIso;
      minIso = maxIso;
      maxIso = tmp;
    }

    const proposedRaw = Array.isArray((details as any)?.partner_proposed_dates)
      ? (details as any).partner_proposed_dates
      : (Array.isArray((details as any)?.proposed_dates) ? (details as any).proposed_dates : []);

    const normalized = normalizeTripOptions(proposedRaw, minIso, maxIso);
    if (!normalized.ok) {
      return jsonResponse(req, 400, { error: normalized.error });
    }

    const tokenValue = generateSelectionToken();
    const tokenHash = await sha256Hex(tokenValue);
    const tokenHours = Math.max(2, Number.parseInt(String(Deno.env.get("TRIP_DATE_SELECTION_TOKEN_HOURS") || "72"), 10) || 72);
    const expiresAt = new Date(Date.now() + tokenHours * 3600000).toISOString();
    const nowIso = new Date().toISOString();

    const upsertPayload = {
      booking_id: bookingId,
      fulfillment_id: String(fulfillment.id),
      partner_id: String(fulfillment.partner_id || ""),
      proposed_dates: normalized.dates,
      preferred_date: preferredDate,
      stay_from: minIso,
      stay_to: maxIso,
      selected_date: null,
      status: "sent_to_customer",
      selection_token_hash: tokenHash,
      selection_token_expires_at: expiresAt,
      customer_email_sent_at: null,
      selected_at: null,
      updated_at: nowIso,
    };

    const { data: requestRow, error: requestErr } = await supabase
      .from("trip_date_selection_requests")
      .upsert(upsertPayload, { onConflict: "fulfillment_id" })
      .select("id, status, selection_token_expires_at")
      .maybeSingle();

    if (requestErr || !requestRow) {
      return jsonResponse(req, 400, { error: requestErr?.message || "Failed to upsert date selection request" });
    }

    const mergedDetails = {
      ...(details || {}),
      preferred_date: preferredDate,
      arrival_date: minIso,
      departure_date: maxIso,
      proposed_dates: normalized.dates,
      partner_proposed_dates: normalized.dates,
      trip_date_selection_status: "options_sent_to_customer",
      trip_date_selection_updated_at: nowIso,
      trip_date_options_sent_at: nowIso,
      trip_date_options_expires_at: expiresAt,
    };

    await supabase
      .from("partner_service_fulfillments")
      .update({ details: mergedDetails })
      .eq("id", String(fulfillment.id));

    const bookingPatch: Record<string, unknown> = {};
    if ((booking as any)?.preferred_trip_date == null && preferredDate) {
      bookingPatch.preferred_trip_date = preferredDate;
    }
    if (Object.keys(bookingPatch).length) {
      await supabase.from("trip_bookings").update(bookingPatch).eq("id", bookingId);
    }

    const lang = normalizeLang((booking as any)?.lang);
    const selectionUrl = `${CUSTOMER_HOMEPAGE_URL}/trip-date-selection.html?token=${encodeURIComponent(tokenValue)}&lang=${lang}`;

    try {
      await supabase.rpc("enqueue_admin_notification", {
        p_category: "trips",
        p_event: "trip_date_options_ready",
        p_record_id: bookingId,
        p_table_name: "trip_bookings",
        p_payload: {
          category: "trips",
          event: "trip_date_options_ready",
          record_id: bookingId,
          table: "trip_bookings",
          fulfillment_id: String(fulfillment.id),
          partner_id: String(fulfillment.partner_id || ""),
          trip_date_selection_request_id: String((requestRow as any).id || ""),
          selection_url: selectionUrl,
          selection_token_expires_at: expiresAt,
          proposed_dates: normalized.dates,
          preferred_date: preferredDate,
          stay_from: minIso,
          stay_to: maxIso,
        },
        p_dedupe_key: `trip_date_options_ready:${String((requestRow as any).id || "")}::${tokenHash.slice(0, 16)}`,
      });
    } catch (_e) {
      // best effort
    }

    return jsonResponse(req, 200, {
      ok: true,
      data: {
        booking_id: bookingId,
        fulfillment_id: String(fulfillment.id),
        trip_date_selection_request_id: String((requestRow as any).id || ""),
        status: "sent_to_customer",
        options_count: normalized.dates.length,
        expires_at: expiresAt,
      },
    });
  }

  if (action === "preview") {
    const tokenValue = String(body.token || "").trim();
    if (!tokenValue) return jsonResponse(req, 400, { error: "Missing token" });

    const tokenHash = await sha256Hex(tokenValue);
    const requestRow = await loadTripDateRequestByTokenHash(supabase, tokenHash);
    if (!requestRow) return jsonResponse(req, 404, { error: "Invalid or expired selection link" });

    const status = String(requestRow.status || "").trim().toLowerCase();
    const expiresAt = requestRow.selection_token_expires_at ? new Date(String(requestRow.selection_token_expires_at)) : null;
    const nowMs = Date.now();

    if (status !== "selected" && expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < nowMs) {
      await supabase
        .from("trip_date_selection_requests")
        .update({ status: "expired" })
        .eq("id", String(requestRow.id));
      return jsonResponse(req, 410, { error: "This selection link has expired" });
    }

    const bookingId = String(requestRow.booking_id || "").trim();
    const fulfillmentId = String(requestRow.fulfillment_id || "").trim();

    const { data: booking } = await supabase
      .from("trip_bookings")
      .select("id, trip_id, trip_slug, trip_date, preferred_trip_date, selected_trip_date, arrival_date, departure_date, customer_name, customer_email, total_price, lang")
      .eq("id", bookingId)
      .maybeSingle();

    const requestedLang = normalizeLang((body as any)?.lang || (booking as any)?.lang);
    const bookingTripId = String((booking as any)?.trip_id || "").trim();
    const bookingTripSlug = String((booking as any)?.trip_slug || "").trim();
    let tripTitle = "";

    let fulfillmentPreview: any = null;
    if (fulfillmentId) {
      try {
        const { data: f } = await supabase
          .from("partner_service_fulfillments")
          .select("status, contact_revealed_at, summary, details, resource_id")
          .eq("id", fulfillmentId)
          .maybeSingle();
        if (f) fulfillmentPreview = f;
      } catch (_e) {
        fulfillmentPreview = null;
      }
    }

    const lookupTripId = bookingTripId || String((fulfillmentPreview as any)?.resource_id || "").trim();
    if (lookupTripId) {
      try {
        const { data: tripRow } = await supabase
          .from("trips")
          .select("id, slug, name, name_i18n, title, title_i18n")
          .eq("id", lookupTripId)
          .maybeSingle();
        tripTitle = resolveTripTitleFromRow(tripRow, requestedLang);
      } catch (_e) {
        // keep fallback
      }
    }

    if (!tripTitle && bookingTripSlug) {
      try {
        const { data: tripRow } = await supabase
          .from("trips")
          .select("id, slug, name, name_i18n, title, title_i18n")
          .eq("slug", bookingTripSlug)
          .maybeSingle();
        tripTitle = resolveTripTitleFromRow(tripRow, requestedLang);
      } catch (_e) {
        // keep fallback
      }
    }

    if (!tripTitle && fulfillmentPreview) {
      const fSummary = readLocalizedText((fulfillmentPreview as any)?.summary, requestedLang);
      const fDetailsTitle = readLocalizedText((fulfillmentPreview as any)?.details, requestedLang);
      tripTitle = fSummary || fDetailsTitle || "";
    }

    if (!tripTitle) tripTitle = bookingTripSlug || "Trip booking";

    let depositState: any = null;
    let selectionLocked = false;
    if (fulfillmentId) {
      try {
        const { data: dep } = await supabase
          .from("service_deposit_requests")
          .select("id, status, amount, currency")
          .eq("fulfillment_id", fulfillmentId)
          .maybeSingle();
        if (dep) {
          depositState = {
            id: String((dep as any).id || ""),
            status: String((dep as any).status || "").trim().toLowerCase(),
            amount: Number((dep as any).amount || 0),
            currency: String((dep as any).currency || "EUR").trim().toUpperCase() || "EUR",
          };
          if (depositState.status === "paid") selectionLocked = true;
        }
      } catch (_e) {
        // best effort
      }

      try {
        const f = fulfillmentPreview;
        const fStatus = String((f as any)?.status || "").trim().toLowerCase();
        const contactRevealed = Boolean((f as any)?.contact_revealed_at);
        if (contactRevealed || (!depositState?.id && fStatus === "accepted")) {
          selectionLocked = true;
        }
      } catch (_e) {
        // best effort
      }
    }

    const proposedDates = uniqueIsoDateList(requestRow.proposed_dates).slice(0, 3);
    const requestStatus = String(requestRow.status || "").trim().toLowerCase();

    return jsonResponse(req, 200, {
      ok: true,
      data: {
        request_id: String(requestRow.id || ""),
        booking_id: bookingId,
        fulfillment_id: fulfillmentId,
        trip_title: tripTitle || "Trip booking",
        lang: requestedLang,
        preferred_date: firstIso(requestRow.preferred_date, (booking as any)?.preferred_trip_date, (booking as any)?.trip_date),
        stay_from: firstIso(requestRow.stay_from, (booking as any)?.arrival_date),
        stay_to: firstIso(requestRow.stay_to, (booking as any)?.departure_date),
        proposed_dates: proposedDates,
        selected_date: firstIso(requestRow.selected_date, (booking as any)?.selected_trip_date),
        status: requestStatus,
        expires_at: requestRow.selection_token_expires_at || null,
        can_confirm: !selectionLocked && (requestStatus === "sent_to_customer" || requestStatus === "selected"),
        selection_locked: selectionLocked,
        deposit: depositState,
      },
    });
  }

  // confirm
  const tokenValue = String(body.token || "").trim();
  const selectedDateInput = String(body.selected_date || "").trim();
  if (!tokenValue) return jsonResponse(req, 400, { error: "Missing token" });
  if (!selectedDateInput) return jsonResponse(req, 400, { error: "Missing selected_date" });

  const selectedDateIso = normalizeIsoDate(selectedDateInput);
  if (!selectedDateIso) return jsonResponse(req, 400, { error: "Invalid selected_date" });

  const tokenHash = await sha256Hex(tokenValue);
  const requestRow = await loadTripDateRequestByTokenHash(supabase, tokenHash);
  if (!requestRow) return jsonResponse(req, 404, { error: "Invalid or expired selection link" });

  const requestStatus = String(requestRow.status || "").trim().toLowerCase();
  const expiresAt = requestRow.selection_token_expires_at ? new Date(String(requestRow.selection_token_expires_at)) : null;
  const nowIso = new Date().toISOString();

  if (requestStatus !== "selected" && expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    await supabase
      .from("trip_date_selection_requests")
      .update({ status: "expired" })
      .eq("id", String(requestRow.id));
    return jsonResponse(req, 410, { error: "This selection link has expired" });
  }

  const proposedDates = uniqueIsoDateList(requestRow.proposed_dates).slice(0, 3);
  if (!proposedDates.length || !proposedDates.includes(selectedDateIso)) {
    return jsonResponse(req, 400, { error: "Selected date is not in provided options" });
  }

  const bookingId = String(requestRow.booking_id || "").trim();
  const fulfillmentId = String(requestRow.fulfillment_id || "").trim();

  const { data: fulfillment, error: fulfillmentErr } = await supabase
    .from("partner_service_fulfillments")
    .select("id, booking_id, partner_id, resource_type, status, details, resource_id, reference, summary, total_price, currency, contact_revealed_at")
    .eq("id", fulfillmentId)
    .maybeSingle();

  if (fulfillmentErr || !fulfillment) return jsonResponse(req, 404, { error: "Fulfillment not found" });
  if (normalizeTripResourceType((fulfillment as any).resource_type) !== "trips") {
    return jsonResponse(req, 400, { error: "Fulfillment is not a trip fulfillment" });
  }

  const { data: booking, error: bookingErr } = await supabase
    .from("trip_bookings")
    .select("id, trip_id, trip_slug, customer_name, customer_email, customer_phone, trip_date, preferred_trip_date, selected_trip_date, arrival_date, departure_date, num_adults, num_children, num_hours, num_days, total_price, lang")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) return jsonResponse(req, 404, { error: "Trip booking not found" });

  let depStatus = "";
  let hasDepositRequest = false;
  try {
    const { data: dep } = await supabase
      .from("service_deposit_requests")
      .select("id, status")
      .eq("fulfillment_id", fulfillmentId)
      .maybeSingle();
    hasDepositRequest = Boolean((dep as any)?.id);
    depStatus = String((dep as any)?.status || "").trim().toLowerCase();
  } catch (_e) {
    // best effort
  }

  const fulfillmentStatus = String((fulfillment as any)?.status || "").trim().toLowerCase();
  const contactRevealed = Boolean((fulfillment as any)?.contact_revealed_at);
  const selectionLocked = depStatus === "paid" || contactRevealed || (!hasDepositRequest && fulfillmentStatus === "accepted");
  if (selectionLocked) {
    return jsonResponse(req, 200, {
      ok: true,
      data: {
        booking_id: bookingId,
        fulfillment_id: fulfillmentId,
        selected_date: firstIso(requestRow.selected_date, (booking as any)?.selected_trip_date, (booking as any)?.trip_date, selectedDateIso),
        already_selected: true,
        locked_after_payment: true,
      },
    });
  }

  const { data: updatedReq, error: reqUpdateErr } = await supabase
    .from("trip_date_selection_requests")
    .update({
      status: "selected",
      selected_date: selectedDateIso,
      selected_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", String(requestRow.id))
    .in("status", ["sent_to_customer", "pending_admin", "selected"])
    .select("id, status, selected_date")
    .maybeSingle();

  if (reqUpdateErr) {
    return jsonResponse(req, 400, { error: reqUpdateErr.message || "Failed to update selection request" });
  }

  if (!updatedReq) {
    const latest = await loadTripDateRequestByTokenHash(supabase, tokenHash);
    const latestStatus = String(latest?.status || "").trim().toLowerCase();
    if (latestStatus === "selected") {
      return jsonResponse(req, 200, {
        ok: true,
        data: {
          booking_id: bookingId,
          fulfillment_id: fulfillmentId,
          selected_date: firstIso(latest?.selected_date, selectedDateIso),
          already_selected: true,
        },
      });
    }
    return jsonResponse(req, 409, { error: "Date selection state changed. Refresh and try again." });
  }

  const bookingPatch: Record<string, unknown> = {
    selected_trip_date: selectedDateIso,
    trip_date: selectedDateIso,
  };
  if (!(booking as any).preferred_trip_date) {
    const fallbackPreferred = firstIso((booking as any).trip_date, requestRow.preferred_date, selectedDateIso);
    if (fallbackPreferred) bookingPatch.preferred_trip_date = fallbackPreferred;
  }

  await supabase
    .from("trip_bookings")
    .update(bookingPatch)
    .eq("id", bookingId);

  const details = (fulfillment as any)?.details && typeof (fulfillment as any).details === "object"
    ? (fulfillment as any).details
    : {};

  const mergedDetails = {
    ...(details || {}),
    preferred_date: firstIso(requestRow.preferred_date, (booking as any).preferred_trip_date, (booking as any).trip_date),
    trip_date: selectedDateIso,
    selected_trip_date: selectedDateIso,
    proposed_dates: proposedDates,
    partner_proposed_dates: proposedDates,
    trip_date_selection_status: "selected",
    trip_date_selection_updated_at: nowIso,
  };

  await supabase
    .from("partner_service_fulfillments")
    .update({
      details: mergedDetails,
      updated_at: nowIso,
    })
    .eq("id", fulfillmentId);

  let deposit: { deposit_request_id: string; checkout_url: string } | null = null;
  const depositEnabled = await isDepositEnabled(supabase);
  let depositError = "";

  if (depositEnabled) {
    try {
      deposit = await createTripDepositCheckout({
        supabase,
        fulfillment,
        booking,
        selectedDateIso,
      });
    } catch (e: any) {
      depositError = String(e?.message || "Failed to create deposit payment link").trim();
    }
  } else {
    const fulfillmentStatus = String((fulfillment as any)?.status || "").trim().toLowerCase();
    if (fulfillmentStatus === "awaiting_payment") {
      await supabase
        .from("partner_service_fulfillments")
        .update({
          status: "accepted",
          contact_revealed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", fulfillmentId);
    }
  }

  return jsonResponse(req, 200, {
    ok: true,
    data: {
      booking_id: bookingId,
      fulfillment_id: fulfillmentId,
      selected_date: selectedDateIso,
      status: "selected",
      deposit_request_id: deposit?.deposit_request_id || null,
      payment_link_ready: Boolean(deposit?.checkout_url),
      checkout_url: deposit?.checkout_url || null,
      payment_link_error: depositError || null,
    },
  });
});
