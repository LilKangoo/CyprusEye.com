import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";

type Category = "shop" | "cars" | "hotels" | "trips";

type AdminEvent = "created" | "paid" | "partner_rejected" | "partner_sla";

type AdminNotificationRequest = {
  category?: Category;
  record_id?: string;
  event?: AdminEvent;
  // Supabase Database Webhook payload shape
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function parseRecipients(raw: string): string[] {
  const parts = (raw || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(parts.map((p) => p.toLowerCase())));

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return unique.filter((email) => emailRegex.test(email));
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
}

function getField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = (record as any)?.[key];
    const s = valueToString(v);
    if (s) return s;
  }
  return "";
}

const CYPRUS_TIMEZONE = "Asia/Nicosia";

function formatInCyprus(value: unknown, mode: "date" | "datetime"): string {
  const raw = valueToString(value);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: CYPRUS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(mode === "datetime"
        ? {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23" as const,
        }
        : {}),
    }).formatToParts(d);

    const byType: Record<string, string> = {};
    for (const p of parts) {
      if (p.type && p.value) byType[p.type] = p.value;
    }

    const y = byType.year || "";
    const m = byType.month || "";
    const day = byType.day || "";
    if (!y || !m || !day) return raw;

    if (mode === "date") {
      return `${y}-${m}-${day}`;
    }

    const hh = byType.hour || "00";
    const mm = byType.minute || "00";
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch (_e) {
    return raw;
  }
}

function formatDateTime(value: unknown): string {
  return formatInCyprus(value, "datetime");
}

function formatDate(value: unknown): string {
  return formatInCyprus(value, "date");
}

function normalizeMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = valueToString(value);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatMoney(amount: unknown, currency: unknown): string {
  const n = normalizeMoney(amount);
  if (n === null) return "";
  const cur = valueToString(currency) || "EUR";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} ${cur}`;
  }
}

function labelForField(key: string): string {
  const normalized = key
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function toTitle(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s|_)([a-z])/g, (_m, sep, chr) => `${sep}${String(chr).toUpperCase()}`)
    .replace(/_/g, " ")
    .trim();
}

function normalizeCategory(category: string | undefined | null): Category | null {
  const c = (category || "").toLowerCase();
  if (c === "shop" || c === "shop_orders" || c === "shop_order_history") return "shop";
  if (c === "car" || c === "cars" || c === "car_bookings") return "cars";
  if (c === "hotel" || c === "hotels" || c === "hotel_bookings") return "hotels";
  if (c === "trip" || c === "trips" || c === "trip_bookings") return "trips";
  return null;
}

async function getAdminNotificationEmails(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("admin_notification_email")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Failed to load shop_settings.admin_notification_email:", error);
    const envFallback = ((
      Deno.env.get("ADMIN_NOTIFICATION_EMAILS") ||
      Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ||
      ""
    ) as string).trim();
    return envFallback;
  }

  const dbValue = ((data as any)?.admin_notification_email || "") as string;
  const envFallback = ((
    Deno.env.get("ADMIN_NOTIFICATION_EMAILS") ||
    Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ||
    ""
  ) as string).trim();

  return [dbValue, envFallback].filter(Boolean).join(",");
}

async function getAdminNotifySecret(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("admin_notify_secret")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Failed to load shop_settings.admin_notify_secret:", error);
    return "";
  }

  return String((data as any)?.admin_notify_secret || "").trim();
}

function resolveRecipients(category: Category, raw: string): string[] {
  const recipients = parseRecipients(raw);
  if (recipients.length) return recipients;
  if (category === "cars") return ["kontakt@wakacjecypr.com"];
  return [];
}

function buildMailTransport() {
  const hostRaw = (Deno.env.get("SMTP_HOST") || "").trim();
  if (!hostRaw || hostRaw.toUpperCase().includes("WKLEJ_SMTP_HOST")) return null;
  const host = hostRaw;

  const portEnv = (Deno.env.get("SMTP_PORT") || "").trim();
  const portParsed = portEnv ? Number.parseInt(portEnv, 10) : Number.NaN;
  const secureEnv = Deno.env.get("SMTP_SECURE");
  const secure = secureEnv ? secureEnv === "true" : (Number.isFinite(portParsed) ? portParsed === 465 : true);

  const user = Deno.env.get("SMTP_USER") || "";
  const pass = Deno.env.get("SMTP_PASS") || "";

  const transportConfig: any = {
    host,
    secure,
  };

  if (Number.isFinite(portParsed)) {
    transportConfig.port = portParsed;
  } else {
    transportConfig.port = secure ? 465 : 587;
  }

  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return nodemailer.createTransport(transportConfig);
}

function getMailRelayBaseUrl(): string {
  const explicit = (Deno.env.get("MAIL_RELAY_BASE_URL") || "").trim();
  const base = explicit || (Deno.env.get("ADMIN_PANEL_BASE_URL") || "").trim() || "https://cypruseye.com";
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  try {
    return new URL(trimmed).origin;
  } catch (_e) {
    return trimmed;
  }
}

async function tryRelayEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html: string;
  secret?: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const base = getMailRelayBaseUrl();
  const secret = String(params.secret || (Deno.env.get("ADMIN_NOTIFY_SECRET") || "")).trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["x-admin-notify-secret"] = secret;

  try {
    const resp = await fetch(`${base}/api/notifications/admin`, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: params.to, subject: params.subject, text: params.text, html: params.html }),
    });
    if (!resp.ok) {
      let errText = "";
      try {
        errText = await resp.text();
      } catch (_e) {
        errText = "";
      }
      return { ok: false, status: resp.status, error: errText || resp.statusText };
    }
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function buildAdminPanelLink(category: Category, recordId: string): string {
  const base = (Deno.env.get("ADMIN_PANEL_BASE_URL") || "").trim();
  if (!base) return "";

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  const view = category === "shop" ? "shop" : category;
  return `${normalizedBase}/admin/dashboard.html#${encodeURIComponent(view)}:${encodeURIComponent(recordId)}`;
}

function eventLabel(event: AdminEvent): string {
  if (event === "paid") return "Paid";
  if (event === "partner_rejected") return "Partner Rejected";
  if (event === "partner_sla") return "Partner SLA";
  return "New";
}

function buildSubject(params: {
  category: Category;
  event: AdminEvent;
  recordId: string;
  record: Record<string, unknown>;
}): string {
  const label = params.category.toUpperCase();
  const customerName = getField(params.record, [
    "customer_name",
    "full_name",
    "name",
    "first_name",
    "last_name",
  ]);

  const categoryMeta = (() => {
    if (params.category === "cars") {
      const from = formatDate(getField(params.record, ["start_date", "pickup_date", "from_date", "date_from"]));
      const to = formatDate(getField(params.record, ["end_date", "return_date", "to_date", "date_to"]));
      const datePart = [from, to].filter(Boolean).join(" → ");
      return { what: "booking", name: "", date: datePart };
    }
    if (params.category === "trips") {
      const tripName = getField(params.record, ["trip_name", "trip_title", "title", "service_name"]);
      const date = formatDate(getField(params.record, ["trip_date", "date", "start_date"]));
      return { what: "booking", name: tripName, date };
    }
    if (params.category === "hotels") {
      const hotelName = getField(params.record, ["hotel_name", "hotel", "name_hotel", "property_name"]);
      const checkIn = formatDate(getField(params.record, ["check_in", "checkin", "start_date", "date_from"]));
      const checkOut = formatDate(getField(params.record, ["check_out", "checkout", "end_date", "date_to"]));
      const datePart = [checkIn, checkOut].filter(Boolean).join(" → ");
      return { what: "booking", name: hotelName, date: datePart };
    }
    return { what: params.category === "shop" ? "order" : "booking", name: "", date: "" };
  })();

  if (params.category === "shop" && params.event === "paid") {
    const amount =
      formatMoney(
        getField(params.record, ["total", "amount_total", "grand_total", "total_amount", "price_total"]),
        getField(params.record, ["currency", "currency_code"]),
      ) || "";
    const parts = [`[${label}] Paid order #${params.recordId}`];
    if (amount) parts.push(amount);
    if (customerName) parts.push(customerName);
    return parts.join(" — ");
  }

  if (params.event === "partner_rejected") {
    const parts = [`[${label}] Partner rejected #${params.recordId}`];
    if (categoryMeta.name) parts.push(categoryMeta.name);
    if (categoryMeta.date) parts.push(categoryMeta.date);
    return parts.join(" — ");
  }
  if (params.event === "partner_sla") {
    const parts = [`[${label}] SLA: no partner response #${params.recordId}`];
    if (categoryMeta.name) parts.push(categoryMeta.name);
    if (categoryMeta.date) parts.push(categoryMeta.date);
    return parts.join(" — ");
  }

  const parts = [`[${label}] New ${categoryMeta.what} #${params.recordId}`];
  if (categoryMeta.name) parts.push(categoryMeta.name);
  if (categoryMeta.date) parts.push(categoryMeta.date);
  if (customerName) parts.push(customerName);
  return parts.join(" — ");
}

function buildKeyValueRows(record: Record<string, unknown>, items: Array<{ label: string; value: string }>) {
  const rows = items
    .map((it) => ({ label: String(it.label || "").trim(), value: String(it.value || "").trim() }))
    .filter((it) => it.label && it.value);
  return rows;
}

function renderHtmlEmail(params: {
  category: Category;
  event: AdminEvent;
  recordId: string;
  record: Record<string, unknown>;
  link: string;
  createdAtIso: string;
}): { html: string; text: string } {
  const { category, event, recordId, record, link } = params;

  const email = getField(record, ["email", "customer_email", "contact_email"]);
  const phone = getField(record, ["phone", "customer_phone", "contact_phone", "phone_number"]);
  const notes = getField(record, ["notes", "note", "message", "customer_notes", "special_requests", "additional_info"]);

  const currency = getField(record, ["currency", "currency_code"]);
  const total = formatMoney(getField(record, ["total", "amount_total", "grand_total", "total_amount", "price_total"]), currency);

  const createdAt = formatDateTime(params.createdAtIso);

  const summaryItemsByCategory: Record<Category, Array<{ label: string; value: string }>> = {
    cars: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Pick-up", value: getField(record, ["pickup_location", "pick_up_location", "pickup_place"]) },
      { label: "Drop-off", value: getField(record, ["dropoff_location", "drop_off_location", "dropoff_place"]) },
      { label: "From", value: formatDate(getField(record, ["start_date", "pickup_date", "from_date", "date_from"])) },
      { label: "To", value: formatDate(getField(record, ["end_date", "return_date", "to_date", "date_to"])) },
    ],
    trips: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Trip", value: getField(record, ["trip_name", "trip_title", "title", "service_name"]) },
      { label: "Date", value: formatDate(getField(record, ["trip_date", "date", "start_date"])) },
      { label: "People", value: getField(record, ["people", "guests", "adults", "participants", "persons"]) },
      { label: "Pick-up", value: getField(record, ["pickup_location", "pick_up_location", "hotel", "pickup_place"]) },
    ],
    hotels: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Hotel", value: getField(record, ["hotel_name", "hotel", "name_hotel", "property_name"]) },
      { label: "Check-in", value: formatDate(getField(record, ["check_in", "checkin", "start_date", "date_from"])) },
      { label: "Check-out", value: formatDate(getField(record, ["check_out", "checkout", "end_date", "date_to"])) },
      { label: "Guests", value: getField(record, ["guests", "people", "adults", "persons"]) },
    ],
    shop: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Order number", value: getField(record, ["order_number"]) },
      { label: "Total", value: total },
      { label: "Currency", value: currency },
    ],
  };

  const summaryRows = buildKeyValueRows(record, summaryItemsByCategory[category] || []);

  const items = Array.isArray((record as any)?.items) ? ((record as any).items as any[]) : [];
  const itemsRows = items
    .map((item) => {
      const qty = valueToString(item?.quantity);
      const name = valueToString(item?.product_name) || valueToString(item?.name);
      const variant = valueToString(item?.variant_name);
      const subtotal = valueToString(item?.subtotal);
      const line = [qty ? `${qty}×` : "", name, variant ? `(${variant})` : ""].filter(Boolean).join(" ").trim();
      return { line, subtotal };
    })
    .filter((r) => r.line);

  const extraDetails: Array<{ label: string; value: string }> = [];
  const eventInfo = eventLabel(event);
  extraDetails.push({ label: "Category", value: toTitle(category) });
  extraDetails.push({ label: "Event", value: eventInfo });
  extraDetails.push({ label: "Record ID", value: recordId });
  extraDetails.push({ label: "Created", value: createdAt });

  if (link) extraDetails.push({ label: "Admin panel", value: link });
  if (notes) extraDetails.push({ label: "Notes", value: notes });

  const detailRows = buildKeyValueRows(record, extraDetails);

  const htmlSummaryTable = summaryRows.length
    ? `
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${summaryRows
          .map(
            (r) =>
              `<tr>
                <td style="padding:8px 10px; border:1px solid #e5e7eb; width: 34%; background:#f9fafb;"><strong>${escapeHtml(r.label)}</strong></td>
                <td style="padding:8px 10px; border:1px solid #e5e7eb;">${escapeHtml(r.value)}</td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const htmlDetailsTable = detailRows.length
    ? `
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${detailRows
          .map(
            (r) =>
              `<tr>
                <td style="padding:8px 10px; border:1px solid #e5e7eb; width: 34%; background:#f9fafb;"><strong>${escapeHtml(r.label)}</strong></td>
                <td style="padding:8px 10px; border:1px solid #e5e7eb;">${r.label === "Admin panel" ? `<a href="${escapeHtml(r.value)}">${escapeHtml(r.value)}</a>` : escapeHtml(r.value)}</td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const htmlItems = category === "shop" && itemsRows.length
    ? `
      <h3 style="margin:18px 0 8px; font-size:16px;">Items</h3>
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${itemsRows
          .map(
            (r) =>
              `<tr>
                <td style="padding:8px 10px; border:1px solid #e5e7eb;">${escapeHtml(r.line)}</td>
                <td style="padding:8px 10px; border:1px solid #e5e7eb; width: 28%; text-align:right;">${escapeHtml(r.subtotal)}</td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const cta = link
    ? `<a href="${escapeHtml(link)}" style="display:inline-block; padding:10px 14px; background:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;">Open in admin</a>`
    : "";

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
    <div style="margin:0 0 14px;">
      <div style="font-size:13px; color:#6b7280; margin-bottom:6px;">${escapeHtml(eventLabel(event))} • ${escapeHtml(toTitle(category))}</div>
      <div style="font-size:20px; font-weight:800; margin:0;">${escapeHtml(toTitle(category))} — ${escapeHtml(eventLabel(event))}</div>
      <div style="font-size:13px; color:#6b7280; margin-top:6px;">Record #${escapeHtml(recordId)} • ${escapeHtml(createdAt)}</div>
      ${cta ? `<div style="margin-top:12px;">${cta}</div>` : ""}
    </div>

    ${htmlSummaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Summary</h3>${htmlSummaryTable}` : ""}
    ${htmlItems}
    ${htmlDetailsTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Details</h3>${htmlDetailsTable}` : ""}
  </div>`;

  const textLines: string[] = [];
  textLines.push(`${toTitle(category)} — ${eventLabel(event)}`);
  textLines.push(`Record #${recordId}`);
  if (createdAt) textLines.push(`Created: ${createdAt}`);
  if (link) textLines.push(`Admin: ${link}`);
  textLines.push("");

  if (summaryRows.length) {
    textLines.push("Summary:");
    for (const r of summaryRows) textLines.push(`- ${r.label}: ${r.value}`);
    textLines.push("");
  }

  if (category === "shop" && itemsRows.length) {
    textLines.push("Items:");
    for (const r of itemsRows) textLines.push(`- ${r.line}${r.subtotal ? ` — ${r.subtotal}` : ""}`);
    textLines.push("");
  }

  if (detailRows.length) {
    textLines.push("Details:");
    for (const r of detailRows) textLines.push(`- ${r.label}: ${r.value}`);
    textLines.push("");
  }

  return { html, text: textLines.join("\n") };
}

function buildGenericEmail({
  category,
  event,
  recordId,
  record,
}: {
  category: Category;
  event: AdminEvent;
  recordId: string;
  record: Record<string, unknown>;
}): { subject: string; text: string; html: string } {
  const subject = buildSubject({ category, event, recordId, record });
  const link = buildAdminPanelLink(category, recordId);
  const createdAtIso =
    getField(record, ["created_at", "createdAt", "inserted_at", "submitted_at", "timestamp"]) ||
    new Date().toISOString();
  const rendered = renderHtmlEmail({
    category,
    event,
    recordId,
    record,
    link,
    createdAtIso,
  });
  return { subject, text: rendered.text, html: rendered.html };
}

async function loadCategoryRecord(
  supabase: any,
  category: Category,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  if (category === "shop") {
    const { data, error } = await supabase
      .from("shop_orders")
      .select(`*, items:shop_order_items(id, product_name, variant_name, quantity, unit_price, subtotal)`)
      .eq("id", recordId)
      .single();
    if (error) {
      console.error("Failed to load shop order:", error);
      return null;
    }
    return data as any;
  }

  if (category === "cars") {
    const { data, error } = await supabase.from("car_bookings").select("*").eq("id", recordId).single();
    if (error) {
      console.error("Failed to load car booking:", error);
      return null;
    }
    return data as any;
  }

  if (category === "hotels") {
    const { data, error } = await supabase.from("hotel_bookings").select("*").eq("id", recordId).single();
    if (error) {
      console.error("Failed to load hotel booking:", error);
      return null;
    }
    return data as any;
  }

  if (category === "trips") {
    const { data, error } = await supabase.from("trip_bookings").select("*").eq("id", recordId).single();
    if (error) {
      console.error("Failed to load trip booking:", error);
      return null;
    }
    return data as any;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const providedSecret = (
    req.headers.get("x-admin-notify-secret") || new URL(req.url).searchParams.get("secret") || ""
  ).trim();
  const hasQuerySecret = Boolean(new URL(req.url).searchParams.get("secret"));

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const dbSecret = await getAdminNotifySecret(supabase);
  const envSecret = (Deno.env.get("ADMIN_NOTIFY_SECRET") || "").trim();
  const secretRequired = (dbSecret || envSecret).trim();
  if (secretRequired) {
    if (!providedSecret || providedSecret !== secretRequired) {
      console.warn("Unauthorized admin notification request", {
        hasHeader: Boolean(req.headers.get("x-admin-notify-secret")),
        hasQuery: hasQuerySecret,
        providedLength: providedSecret.length,
        requiredLength: secretRequired.length,
        requiredSource: dbSecret ? "db" : envSecret ? "env" : "none",
        dbLength: dbSecret.length,
        envLength: envSecret.length,
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: AdminNotificationRequest;
  try {
    body = (await req.json()) as AdminNotificationRequest;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const categoryFromBody = normalizeCategory(body.category || body.table || "");
  if (!categoryFromBody) {
    return new Response(JSON.stringify({ error: "Unsupported category/table" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tableLower = String(body.table || "").toLowerCase();
  const historyRecordId =
    tableLower === "shop_order_history" && body.record && typeof (body.record as any).id === "string"
      ? ((body.record as any).id as string)
      : "";

  const recordIdFromBody = body.record_id || (body.record && typeof (body.record as any).id === "string" ? ((body.record as any).id as string) : "");
  const recordIdFromHistoryOrderId =
    tableLower === "shop_order_history" && body.record && typeof (body.record as any).order_id === "string"
      ? ((body.record as any).order_id as string)
      : "";

  const recordId = recordIdFromHistoryOrderId || recordIdFromBody;
  if (!recordId) {
    return new Response(JSON.stringify({ error: "Missing record_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event = body.event || (body.type && body.type.toUpperCase() === "INSERT" ? "created" : "created");

  if (tableLower === "shop_order_history") {
    const toStatus = String((body.record as any)?.to_status || "").toLowerCase();
    const alreadySent = Boolean((body.record as any)?.notification_sent);

    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (toStatus !== "confirmed") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "not_confirmed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    event = "paid";
  }

  if (categoryFromBody === "shop" && event === "paid") {
    try {
      const { data: sentRow, error: sentErr } = await supabase
        .from("shop_order_history")
        .select("id")
        .eq("order_id", recordId)
        .eq("to_status", "confirmed")
        .eq("notification_sent", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sentErr) {
        console.error("Failed to check shop_order_history.notification_sent:", sentErr);
      } else if (sentRow) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } catch (e) {
      console.error("Failed to check shop notification idempotency:", e);
    }
  }

  const adminNotificationEmailRaw = await getAdminNotificationEmails(supabase);
  const recipients = resolveRecipients(categoryFromBody, adminNotificationEmailRaw);

  if (!recipients.length) {
    console.warn(
      "Admin notification skipped: no recipients configured",
      JSON.stringify({ category: categoryFromBody, record_id: recordId, admin_notification_email: adminNotificationEmailRaw || null }),
    );
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_admin_notification_email" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  let record: Record<string, unknown> | null = null;
  if (body.record && typeof body.record === "object" && body.record !== null) {
    record = body.record as Record<string, unknown>;
  }

  if (!record) {
    record = await loadCategoryRecord(supabase, categoryFromBody, recordId);
  }

  if (!record) {
    return new Response(JSON.stringify({ error: "Record not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });
  }

  const { subject, text, html } = buildGenericEmail({
    category: categoryFromBody,
    event,
    recordId,
    record,
  });

  const transport = buildMailTransport();
  if (!transport) {
    const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
    if (relayed.ok) {
      if (tableLower === "shop_order_history" && historyRecordId) {
        try {
          const { error: markErr } = await supabase
            .from("shop_order_history")
            .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
            .eq("id", historyRecordId);
          if (markErr) {
            console.error("Failed to mark shop_order_history.notification_sent (relay):", markErr);
          }
        } catch (e) {
          console.error("Failed to mark shop_order_history.notification_sent (relay):", e);
        }
      }
      return new Response(JSON.stringify({ ok: true, relayed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    console.warn("SMTP_HOST not set – email will be logged only.");
    console.log(`\n===== Simulated admin notification =====\nTo: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
    return new Response(JSON.stringify({ ok: true, simulated: true, relay_error: relayed.error || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const from = Deno.env.get("SMTP_FROM") || "WakacjeCypr <no-reply@wakacjecypr.com>";

  try {
    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        {
          from,
          to: recipients.join(","),
          subject,
          text,
          html,
        },
        (error: any) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });

    if (tableLower === "shop_order_history" && historyRecordId) {
      try {
        const { error: markErr } = await supabase
          .from("shop_order_history")
          .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
          .eq("id", historyRecordId);
        if (markErr) {
          console.error("Failed to mark shop_order_history.notification_sent:", markErr);
        }
      } catch (e) {
        console.error("Failed to mark shop_order_history.notification_sent:", e);
      }
    } else if (categoryFromBody === "shop" && event === "paid") {
      try {
        const { data: latestRow, error: latestErr } = await supabase
          .from("shop_order_history")
          .select("id, notification_sent")
          .eq("order_id", recordId)
          .eq("to_status", "confirmed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestErr) {
          console.error("Failed to load latest confirmed shop_order_history row:", latestErr);
        } else if (latestRow && !(latestRow as any).notification_sent) {
          const { error: markErr } = await supabase
            .from("shop_order_history")
            .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
            .eq("id", (latestRow as any).id);
          if (markErr) {
            console.error("Failed to mark latest shop_order_history.notification_sent:", markErr);
          }
        }
      } catch (e) {
        console.error("Failed to mark latest shop_order_history.notification_sent:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
    const relayed = await tryRelayEmail({ to: recipients, subject, text, html });
    if (relayed.ok) {
      return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    return new Response(JSON.stringify({ ok: true, simulated: true, smtp_error: error?.message || "Email send failed", relay_error: relayed.error || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
