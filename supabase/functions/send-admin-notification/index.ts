import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";

type Category = "shop" | "cars" | "hotels" | "trips";

type AdminNotificationRequest = {
  category?: Category;
  record_id?: string;
  event?: "created" | "paid";
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

function normalizeCategory(category: string | undefined | null): Category | null {
  const c = (category || "").toLowerCase();
  if (c === "shop") return "shop";
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
    return "";
  }
  return (data as any)?.admin_notification_email || "";
}

function buildMailTransport() {
  const host = Deno.env.get("SMTP_HOST");
  if (!host) return null;

  const port = Number.parseInt(Deno.env.get("SMTP_PORT") || "", 10);
  const secureEnv = Deno.env.get("SMTP_SECURE");
  const secure = secureEnv ? secureEnv === "true" : port === 465;

  const user = Deno.env.get("SMTP_USER") || "";
  const pass = Deno.env.get("SMTP_PASS") || "";

  const transportConfig: any = {
    host,
    secure,
  };

  if (Number.isFinite(port)) {
    transportConfig.port = port;
  }

  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return nodemailer.createTransport(transportConfig);
}

function buildAdminPanelLink(category: Category, recordId: string): string {
  const base = (Deno.env.get("ADMIN_PANEL_BASE_URL") || "").trim();
  if (!base) return "";

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  const view = category === "shop" ? "shop" : category;
  return `${normalizedBase}/admin/dashboard.html#${encodeURIComponent(view)}:${encodeURIComponent(recordId)}`;
}

function buildGenericEmail({
  category,
  event,
  recordId,
  record,
}: {
  category: Category;
  event: string;
  recordId: string;
  record: Record<string, unknown>;
}): { subject: string; text: string; html: string } {
  const ts = new Date().toISOString();
  const label = category.toUpperCase();

  const subject =
    category === "shop" && event === "paid"
      ? `[${label}] Nowe opłacone zamówienie ${recordId}`
      : `[${label}] Nowa rezerwacja ${recordId}`;

  const link = buildAdminPanelLink(category, recordId);

  const textLines: string[] = [
    `Typ: ${category}`,
    `Zdarzenie: ${event}`,
    `ID: ${recordId}`,
    `Czas: ${ts}`,
  ];

  if (link) {
    textLines.push("", `Panel admina: ${link}`);
  }

  textLines.push("", "Szczegóły:");
  for (const [k, v] of Object.entries(record || {})) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    textLines.push(`${k}: ${String(v)}`);
  }

  const htmlParts: string[] = [
    `<p><strong>Typ:</strong> ${escapeHtml(category)}</p>`,
    `<p><strong>Zdarzenie:</strong> ${escapeHtml(event)}</p>`,
    `<p><strong>ID:</strong> ${escapeHtml(recordId)}</p>`,
    `<p><strong>Czas:</strong> ${escapeHtml(ts)}</p>`,
  ];

  if (link) {
    htmlParts.push(`<p><strong>Panel admina:</strong> <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`);
  }

  htmlParts.push("<hr />");
  htmlParts.push("<p><strong>Szczegóły:</strong></p>");
  htmlParts.push("<ul>");
  for (const [k, v] of Object.entries(record || {})) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    htmlParts.push(`<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`);
  }
  htmlParts.push("</ul>");

  return { subject, text: textLines.join("\n"), html: htmlParts.join("") };
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

  const secretRequired = Deno.env.get("ADMIN_NOTIFY_SECRET") || "";
  if (secretRequired) {
    const providedSecret = req.headers.get("x-admin-notify-secret") || new URL(req.url).searchParams.get("secret") || "";
    if (!providedSecret || providedSecret !== secretRequired) {
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

  const recordId = body.record_id || (body.record && typeof (body.record as any).id === "string" ? ((body.record as any).id as string) : "");
  if (!recordId) {
    return new Response(JSON.stringify({ error: "Missing record_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = body.event || (body.type && body.type.toUpperCase() === "INSERT" ? "created" : "created");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const adminNotificationEmailRaw = await getAdminNotificationEmails(supabase);
  const recipients = parseRecipients(adminNotificationEmailRaw);

  if (!recipients.length) {
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
    console.warn("SMTP_HOST not set – email will be logged only.");
    console.log(`\n===== Simulated admin notification =====\nTo: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
    return new Response(JSON.stringify({ ok: true, simulated: true }), {
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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
    return new Response(JSON.stringify({ error: error?.message || "Email send failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
