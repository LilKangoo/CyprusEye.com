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
    return "";
  }
  return (data as any)?.admin_notification_email || "";
}

function resolveRecipients(category: Category, raw: string): string[] {
  const recipients = parseRecipients(raw);
  if (recipients.length) return recipients;
  if (category === "cars") return ["contact@wakacjecypr.com"];
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
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function tryRelayEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const base = getMailRelayBaseUrl();
  const secret = (Deno.env.get("ADMIN_NOTIFY_SECRET") || "").trim();
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
  const ts = new Date().toISOString();
  const label = category.toUpperCase();

  const subject = (() => {
    if (category === "shop" && event === "paid") {
      return `[${label}] Nowe opłacone zamówienie ${recordId}`;
    }
    if (event === "partner_rejected") {
      const what = category === "shop" ? "zamówienie" : "rezerwację";
      return `[${label}] Partner odrzucił ${what} ${recordId}`;
    }
    if (event === "partner_sla") {
      const what = category === "shop" ? "zamówienie" : "rezerwację";
      return `[${label}] Partner nie zaakceptował na czas (SLA) ${what} ${recordId}`;
    }
    return `[${label}] Nowa rezerwacja ${recordId}`;
  })();

  const link = buildAdminPanelLink(category, recordId);

  const items = Array.isArray((record as any)?.items) ? ((record as any).items as any[]) : [];

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
    if (k === "items") continue;
    if (typeof v === "object") continue;
    textLines.push(`${k}: ${String(v)}`);
  }

  if (items.length) {
    textLines.push("", "Pozycje:");
    for (const item of items) {
      const qty = item?.quantity ?? "";
      const name = item?.product_name ?? "";
      const variant = item?.variant_name ? ` (${item.variant_name})` : "";
      const subtotal = item?.subtotal ?? "";
      textLines.push(`- ${qty} x ${name}${variant} = ${subtotal}`.trim());
    }
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
    if (k === "items") continue;
    if (typeof v === "object") continue;
    htmlParts.push(`<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`);
  }
  htmlParts.push("</ul>");

  if (items.length) {
    htmlParts.push("<p><strong>Pozycje:</strong></p>");
    htmlParts.push("<ul>");
    for (const item of items) {
      const qty = item?.quantity ?? "";
      const name = item?.product_name ?? "";
      const variant = item?.variant_name ? ` (${item.variant_name})` : "";
      const subtotal = item?.subtotal ?? "";
      htmlParts.push(`<li>${escapeHtml(`${qty} x ${name}${variant} = ${subtotal}`)}</li>`);
    }
    htmlParts.push("</ul>");
  }

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const relayed = await tryRelayEmail({ to: recipients, subject, text, html });
    if (relayed.ok) {
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
