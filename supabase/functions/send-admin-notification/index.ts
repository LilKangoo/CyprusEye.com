import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

type Category = "shop" | "cars" | "hotels" | "trips" | "partners";

type AdminEvent =
  | "created"
  | "paid"
  | "deposit_paid"
  | "partner_rejected"
  | "partner_sla"
  | "partner_accepted"
  | "partner_pending_acceptance"
  | "customer_received"
  | "customer_deposit_requested"
  | "customer_deposit_paid"
  | "partner_deposit_paid"
  | "affiliate_cashout_requested";

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
const CUSTOMER_HOMEPAGE_URL = "https://cypruseye.com";
const BRAND_LOGO_URL = "https://cypruseye.com/assets/cyprus_logo-1000x1054.png";

let webPushServerPromise: Promise<any | null> | null = null;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const raw = String(input || "").trim();
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const str = atob(b64 + padding);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

async function getWebPushApplicationServer(): Promise<any | null> {
  if (webPushServerPromise) return await webPushServerPromise;

  webPushServerPromise = (async () => {
    const publicKey = (Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
    const privateKey = (Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
    if (!publicKey || !privateKey) return null;

    const pub = base64UrlToBytes(publicKey);
    const priv = base64UrlToBytes(privateKey);

    if (pub.length !== 65 || pub[0] !== 4) {
      throw new Error("Invalid VAPID_PUBLIC_KEY format (expected uncompressed P-256 key)");
    }
    if (priv.length !== 32) {
      throw new Error("Invalid VAPID_PRIVATE_KEY format (expected 32 bytes)");
    }

    const x = pub.subarray(1, 33);
    const y = pub.subarray(33, 65);

    const exportedKeys: webpush.ExportedVapidKeys = {
      publicKey: {
        kty: "EC",
        crv: "P-256",
        x: bytesToBase64Url(x),
        y: bytesToBase64Url(y),
        ext: true,
      },
      privateKey: {
        kty: "EC",
        crv: "P-256",
        x: bytesToBase64Url(x),
        y: bytesToBase64Url(y),
        d: bytesToBase64Url(priv),
        ext: true,
      },
    };

    const vapidKeys = await webpush.importVapidKeys(exportedKeys);
    const contactEmail = (Deno.env.get("ADMIN_PUSH_CONTACT_EMAIL") || "admin@cypruseye.com").trim() || "admin@cypruseye.com";
    return await webpush.ApplicationServer.new({
      contactInformation: `mailto:${contactEmail}`,
      vapidKeys,
    });
  })();

  return await webPushServerPromise;
}

function getDefaultAdminPushUrl(): string {
  const base = getMailRelayBaseUrl();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/admin/`;
}

function getDefaultPartnerPushUrl(): string {
  const base = getMailRelayBaseUrl();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/partners/`;
}

async function sendAdminWebPushNotifications(params: {
  supabase: any;
  title: string;
  body: string;
  url: string;
}): Promise<{ ok: boolean; sent: number; failed: number; deleted: number; skipped_reason?: string }> {
  const { supabase, title, body, url } = params;

  let server: any | null = null;
  try {
    server = await getWebPushApplicationServer();
  } catch (e) {
    console.warn("Failed to init Web Push server:", (e as any)?.message || String(e));
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "invalid_vapid_keys" };
  }
  if (!server) {
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "missing_vapid_keys" };
  }

  const { data: rows, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth, subscription");
  if (error) {
    console.warn("Failed to load admin push subscriptions:", error.message);
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "db_error" };
  }

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let failed = 0;
  let deleted = 0;

  for (const row of rows || []) {
    const id = String((row as any)?.id || "").trim();
    const endpoint = String((row as any)?.endpoint || "").trim();
    const jsonSub = (row as any)?.subscription && typeof (row as any).subscription === "object" ? (row as any).subscription : null;
    const p256dh = String((row as any)?.p256dh || "").trim();
    const auth = String((row as any)?.auth || "").trim();

    const sub = jsonSub || {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    };

    try {
      const subscriber = server.subscribe(sub as any);
      await subscriber.pushTextMessage(payload, { ttl: 60 * 60 });
      sent++;
    } catch (e) {
      failed++;
      const isGone = e instanceof webpush.PushMessageError ? e.isGone() : false;
      if (isGone) {
        try {
          const delQuery = supabase.from("admin_push_subscriptions").delete();
          const { error: delErr } = id ? await delQuery.eq("id", id) : await delQuery.eq("endpoint", endpoint);
          if (!delErr) deleted++;
        } catch (_e2) {
        }
      }
    }
  }

  return { ok: true, sent, failed, deleted };
}

async function sendPartnerWebPushNotifications(params: {
  supabase: any;
  partnerId: string;
  title: string;
  body: string;
  url: string;
}): Promise<{ ok: boolean; sent: number; failed: number; deleted: number; skipped_reason?: string }> {
  const { supabase, partnerId, title, body, url } = params;

  const pid = String(partnerId || "").trim();
  if (!pid) {
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "missing_partner_id" };
  }

  let server: any | null = null;
  try {
    server = await getWebPushApplicationServer();
  } catch (e) {
    console.warn("Failed to init Web Push server:", (e as any)?.message || String(e));
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "invalid_vapid_keys" };
  }
  if (!server) {
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "missing_vapid_keys" };
  }

  const { data: rows, error } = await supabase
    .from("partner_push_subscriptions")
    .select("id, endpoint, p256dh, auth, subscription")
    .eq("partner_id", pid)
    .limit(500);
  if (error) {
    console.warn("Failed to load partner push subscriptions:", error.message);
    return { ok: false, sent: 0, failed: 0, deleted: 0, skipped_reason: "db_error" };
  }

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let failed = 0;
  let deleted = 0;

  for (const row of rows || []) {
    const id = String((row as any)?.id || "").trim();
    const endpoint = String((row as any)?.endpoint || "").trim();
    const jsonSub = (row as any)?.subscription && typeof (row as any).subscription === "object" ? (row as any).subscription : null;
    const p256dh = String((row as any)?.p256dh || "").trim();
    const auth = String((row as any)?.auth || "").trim();

    const sub = jsonSub || {
      endpoint,
      keys: {
        p256dh,
        auth,
      },
    };

    try {
      const subscriber = server.subscribe(sub as any);
      await subscriber.pushTextMessage(payload, { ttl: 60 * 60 });
      sent++;
    } catch (e) {
      failed++;
      const isGone = e instanceof webpush.PushMessageError ? e.isGone() : false;
      if (isGone && endpoint) {
        try {
          const delQuery = supabase.from("partner_push_subscriptions").delete();
          const { error: delErr } = id
            ? await delQuery.eq("id", id)
            : await delQuery.eq("partner_id", pid).eq("endpoint", endpoint);
          if (!delErr) deleted++;
        } catch (_e2) {
        }
      }
    }
  }

  return { ok: true, sent, failed, deleted };
}

function parseRecipients(raw: string): string[] {
  const parts = (raw || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(parts.map((p) => p.toLowerCase())));

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return unique.filter((email) => emailRegex.test(email));
}

function renderCustomerDepositPaidEmail(params: {
  deposit: Record<string, unknown>;
}): { subject: string; html: string; text: string } {
  const deposit = params.deposit;
  const lang = normalizeDepositLang((deposit as any)?.lang);
  const amount = Number((deposit as any)?.amount || 0) || 0;
  const currency = String((deposit as any)?.currency || "EUR").trim() || "EUR";
  const reference = String((deposit as any)?.fulfillment_reference || "").trim();
  const summary = String((deposit as any)?.fulfillment_summary || "").trim();
  const paidAtIso = String((deposit as any)?.paid_at || new Date().toISOString());
  const paidAt = formatDateTime(paidAtIso);

  const subject = (() => {
    const cat = normalizeServiceCategory((deposit as any)?.resource_type);
    const label = cat ? cat.toUpperCase() : "SERVICE";
    const parts = [`[${label}] Deposit paid`];
    if (summary) parts.push(summary);
    if (reference) parts.push(reference);
    return parts.join(" — ");
  })();

  const intro = lang === "pl"
    ? "Dziękujemy. Płatność depozytu została potwierdzona. Partner skontaktuje się z Tobą na podany numer telefonu."
    : "Thank you. Your deposit payment has been confirmed. The partner will contact you using the phone number you provided.";

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com • Deposit</td>
        </tr>
      </table>`;

  const summaryRows = buildKeyValueRows(deposit, [
    { label: "Reference", value: reference },
    { label: "Service", value: summary },
    { label: "Deposit", value: formatMoney(amount, currency) },
    { label: "Paid at", value: paidAt },
  ]);

  const summaryTable = summaryRows.length
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

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
      <div style="margin:0 0 14px;">
        ${brandHeader}
        <div style="font-size:20px; font-weight:800; margin:0;">${escapeHtml(lang === "pl" ? "Depozyt opłacony" : "Deposit paid")}</div>
        <div style="font-size:13px; color:#6b7280; margin-top:6px;">${escapeHtml(paidAt)}</div>
      </div>
      <div style="font-size:14px; margin: 14px 0 0;">${escapeHtml(intro)}</div>
      ${summaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">${escapeHtml(lang === "pl" ? "Podsumowanie" : "Summary")}</h3>${summaryTable}` : ""}
      <div style="font-size:12px; color:#6b7280; margin-top:14px;">${escapeHtml(lang === "pl" ? "W razie pytań odpowiadaj na tę wiadomość." : "If you have any questions, reply to this email.")}</div>
    </div>`;

  const textLines: string[] = [];
  textLines.push(lang === "pl" ? "Depozyt opłacony" : "Deposit paid");
  if (paidAt) textLines.push(`Paid at: ${paidAt}`);
  textLines.push("");
  textLines.push(intro);
  textLines.push("");
  if (summary) textLines.push(`Service: ${summary}`);
  if (reference) textLines.push(`Reference: ${reference}`);
  textLines.push(`Deposit: ${formatMoney(amount, currency)}`);
  return { subject, html, text: textLines.join("\n") };
}

function renderCustomerDepositRequestedEmail(params: {
  deposit: Record<string, unknown>;
}): { subject: string; html: string; text: string } {
  const deposit = params.deposit;
  const lang = normalizeDepositLang((deposit as any)?.lang);
  const amount = Number((deposit as any)?.amount || 0) || 0;
  const currency = String((deposit as any)?.currency || "EUR").trim() || "EUR";
  const checkoutUrl = String((deposit as any)?.checkout_url || "").trim();
  const reference = String((deposit as any)?.fulfillment_reference || "").trim();
  const summary = String((deposit as any)?.fulfillment_summary || "").trim();
  const createdAtIso = String((deposit as any)?.created_at || new Date().toISOString());
  const createdAt = formatDateTime(createdAtIso);

  const subject = (() => {
    const cat = normalizeServiceCategory((deposit as any)?.resource_type);
    const label = cat ? cat.toUpperCase() : "SERVICE";
    const parts = [`[${label}] Deposit payment link`];
    if (summary) parts.push(summary);
    if (reference) parts.push(reference);
    return parts.join(" — ");
  })();

  const intro = lang === "pl"
    ? "Twoja rezerwacja została zaakceptowana. Aby ją potwierdzić, prosimy o opłacenie depozytu."
    : "Your booking has been accepted. To confirm it, please pay the deposit.";
  const ctaText = lang === "pl" ? "Opłać depozyt" : "Pay deposit";
  const note = lang === "pl"
    ? "Po zaksięgowaniu płatności partner otrzyma Twoje dane kontaktowe i skontaktuje się z Tobą na podany numer telefonu."
    : "After payment is confirmed, the partner will receive your contact details and will reach out to the phone number you provided.";

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com • Deposit</td>
        </tr>
      </table>`;

  const summaryRows = buildKeyValueRows(deposit, [
    { label: "Reference", value: reference },
    { label: "Service", value: summary },
    { label: "Deposit", value: formatMoney(amount, currency) },
  ]);

  const summaryTable = summaryRows.length
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

  const cta = checkoutUrl
    ? `<a href="${escapeHtml(checkoutUrl)}" style="display:inline-block; padding:10px 14px; background:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:700;">${escapeHtml(ctaText)}</a>`
    : "";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
      <div style="margin:0 0 14px;">
        ${brandHeader}
        <div style="font-size:20px; font-weight:800; margin:0;">${escapeHtml(lang === "pl" ? "Link do płatności depozytu" : "Deposit payment link")}</div>
        <div style="font-size:13px; color:#6b7280; margin-top:6px;">${escapeHtml(createdAt)}</div>
      </div>
      <div style="font-size:14px; margin: 14px 0 0;">${escapeHtml(intro)}</div>
      ${summaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">${escapeHtml(lang === "pl" ? "Podsumowanie" : "Summary")}</h3>${summaryTable}` : ""}
      <div style="margin-top:18px;">${cta}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:14px;">${escapeHtml(note)}</div>
    </div>`;

  const textLines: string[] = [];
  textLines.push(lang === "pl" ? "Link do płatności depozytu" : "Deposit payment link");
  if (createdAt) textLines.push(`Created: ${createdAt}`);
  textLines.push("");
  textLines.push(intro);
  textLines.push("");
  if (summary) textLines.push(`Service: ${summary}`);
  if (reference) textLines.push(`Reference: ${reference}`);
  textLines.push(`Deposit: ${formatMoney(amount, currency)}`);
  textLines.push("");
  if (checkoutUrl) textLines.push(`${ctaText}: ${checkoutUrl}`);
  textLines.push("");
  textLines.push(note);
  return { subject, html, text: textLines.join("\n") };
}

function renderPartnerDepositPaidEmail(params: {
  deposit: Record<string, unknown>;
  contact: Record<string, unknown> | null;
}): { subject: string; html: string; text: string } {
  const deposit = params.deposit;
  const contact = params.contact || {};
  const amount = Number((deposit as any)?.amount || 0) || 0;
  const currency = String((deposit as any)?.currency || "EUR").trim() || "EUR";
  const reference = String((deposit as any)?.fulfillment_reference || "").trim();
  const summary = String((deposit as any)?.fulfillment_summary || "").trim();
  const paidAtIso = String((deposit as any)?.paid_at || new Date().toISOString());
  const paidAt = formatDateTime(paidAtIso);

  const subject = (() => {
    const cat = normalizeServiceCategory((deposit as any)?.resource_type);
    const label = cat ? cat.toUpperCase() : "SERVICE";
    const parts = [`[${label}] Deposit paid`];
    if (summary) parts.push(summary);
    if (reference) parts.push(reference);
    return parts.join(" — ");
  })();

  const customerName = String((contact as any)?.customer_name || "").trim();
  const customerEmail = String((contact as any)?.customer_email || "").trim();
  const customerPhone = String((contact as any)?.customer_phone || "").trim();

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com • Deposit</td>
        </tr>
      </table>`;

  const summaryRows = buildKeyValueRows(deposit, [
    { label: "Reference", value: reference },
    { label: "Service", value: summary },
    { label: "Deposit", value: formatMoney(amount, currency) },
    { label: "Paid at", value: paidAt },
  ]);

  const summaryTable = summaryRows.length
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

  const contactRows = buildKeyValueRows(contact, [
    { label: "Customer", value: customerName },
    { label: "Email", value: customerEmail },
    { label: "Phone", value: customerPhone },
  ]);

  const contactTable = contactRows.length
    ? `
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${contactRows
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

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
      <div style="margin:0 0 14px;">
        ${brandHeader}
        <div style="font-size:20px; font-weight:800; margin:0;">Deposit paid</div>
        <div style="font-size:13px; color:#6b7280; margin-top:6px;">${escapeHtml(paidAt)}</div>
      </div>
      <div style="font-size:14px; margin: 14px 0 0;">Customer deposit has been paid. You can contact the customer now.</div>
      ${summaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Summary</h3>${summaryTable}` : ""}
      ${contactTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Customer contact</h3>${contactTable}` : ""}
    </div>`;

  const textLines: string[] = [];
  textLines.push("Deposit paid");
  if (paidAt) textLines.push(`Paid at: ${paidAt}`);
  textLines.push("");
  if (summary) textLines.push(`Service: ${summary}`);
  if (reference) textLines.push(`Reference: ${reference}`);
  textLines.push(`Deposit: ${formatMoney(amount, currency)}`);
  textLines.push("");
  textLines.push("Customer contact:");
  if (customerName) textLines.push(`- Name: ${customerName}`);
  if (customerEmail) textLines.push(`- Email: ${customerEmail}`);
  if (customerPhone) textLines.push(`- Phone: ${customerPhone}`);
  return { subject, html, text: textLines.join("\n") };
}

async function markDepositCustomerEmailSentAt(supabase: any, depositRequestId: string) {
  const id = String(depositRequestId || "").trim();
  if (!id) return;
  try {
    const { error } = await supabase
      .from("service_deposit_requests")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", id)
      .is("email_sent_at", null);
    if (error) console.error("Failed to mark service_deposit_requests.email_sent_at:", error);
  } catch (e) {
    console.error("Failed to mark service_deposit_requests.email_sent_at:", e);
  }
}

async function markDepositPartnerEmailSentAt(supabase: any, depositRequestId: string) {
  const id = String(depositRequestId || "").trim();
  if (!id) return;
  try {
    const { error } = await supabase
      .from("service_deposit_requests")
      .update({ partner_email_sent_at: new Date().toISOString() })
      .eq("id", id)
      .is("partner_email_sent_at", null);
    if (error) console.error("Failed to mark service_deposit_requests.partner_email_sent_at:", error);
  } catch (e) {
    console.error("Failed to mark service_deposit_requests.partner_email_sent_at:", e);
  }
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
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      if (Array.isArray(value)) {
        return value.map((v) => valueToString(v)).filter(Boolean).join(", ").trim();
      }

      const obj = value as Record<string, unknown>;
      const pick = (keys: string[]): string => {
        for (const key of keys) {
          const v = obj?.[key];
          if (v === null || v === undefined) continue;
          if (key === "title") {
            if (typeof v === "string") {
              const s = v.trim();
              if (s) return s;
            }
            if (typeof v === "object") {
              const en = valueToString((v as any)?.en);
              if (en) return en;
              const pl = valueToString((v as any)?.pl);
              if (pl) return pl;
            }
          }
          const s = valueToString(v);
          if (s) return s;
        }
        return "";
      };

      const best = pick([
        "trip_name",
        "trip_title",
        "hotel_name",
        "car_model",
        "service_name",
        "name",
        "full_name",
        "title",
        "hotel_slug",
        "trip_slug",
        "slug",
        "reference",
        "order_number",
        "id",
      ]);
      if (best) return best;

      const raw = JSON.stringify(value);
      if (raw && raw !== "{}" && raw !== "[]") {
        return raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
      }
    } catch (_e) {
      return "";
    }
    return "";
  }
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

function buildFromHeader(rawFrom: string): string {
  const raw = String(rawFrom || "").trim();
  const match = raw.match(/^.*<([^>]+)>\s*$/);
  const email = String(match ? match[1] : raw).trim();
  const finalEmail = email || "no-reply@wakacjecypr.com";
  return `CyprusEye.com <${finalEmail}>`;
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

function formatTime(value: unknown): string {
  const raw = valueToString(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hh = String(match[1] || "").padStart(2, "0");
  const mm = String(match[2] || "").padStart(2, "0");
  return `${hh}:${mm}`;
}

const NOISE_FIELDS = new Set([
  "updated_at",
  "updatedAt",
  "quoted_price",
  "quotedPrice",
  "notification_sent",
  "notificationSent",
  "customer_received_email_sent_at",
  "items",
]);

function isNoiseField(key: string): boolean {
  if (!key) return true;
  if (NOISE_FIELDS.has(key)) return true;
  const lower = key.toLowerCase();
  if (lower === "updated_at" || lower === "quoted_price") return true;
  return false;
}

function formatRecordValueForEmail(params: {
  key: string;
  value: unknown;
  record: Record<string, unknown>;
}): string {
  const { key, value, record } = params;
  if (value === null || value === undefined) return "";

  const currency = getField(record, ["currency", "currency_code"]);
  const lower = key.toLowerCase();

  if (
    lower === "total" ||
    lower === "total_price" ||
    lower === "amount_total" ||
    lower === "grand_total" ||
    lower === "total_amount" ||
    lower === "price_total" ||
    lower === "subtotal" ||
    lower === "unit_price"
  ) {
    return formatMoney(value, currency) || valueToString(value);
  }

  if (
    lower === "pickup_date" ||
    lower === "return_date" ||
    lower === "start_date" ||
    lower === "end_date" ||
    lower === "from_date" ||
    lower === "to_date" ||
    lower === "date_from" ||
    lower === "date_to" ||
    lower === "trip_date" ||
    lower === "check_in" ||
    lower === "check_out" ||
    lower === "checkin" ||
    lower === "checkout"
  ) {
    return formatDate(value) || valueToString(value);
  }

  if (lower === "pickup_time" || lower === "return_time" || lower === "checkin_time" || lower === "checkout_time") {
    return formatTime(value) || valueToString(value);
  }

  if (lower.endsWith("_at") || lower === "createdat" || lower === "created_at") {
    return formatDateTime(value) || valueToString(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_e) {
      return valueToString(value);
    }
  }

  return valueToString(value);
}

function buildFormDataRows(category: Category, record: Record<string, unknown>): Array<{ label: string; value: string }> {
  const priorityKeysByCategory: Record<Category, string[]> = {
    cars: [
      "car_model",
      "car",
      "vehicle",
      "offer_id",
      "location",
      "pickup_location",
      "pick_up_location",
      "pickup_place",
      "return_location",
      "dropoff_location",
      "drop_off_location",
      "dropoff_place",
      "pickup_date",
      "start_date",
      "from_date",
      "date_from",
      "pickup_time",
      "return_date",
      "end_date",
      "to_date",
      "date_to",
      "return_time",
      "total_price",
      "total",
      "currency",
      "child_seats",
      "young_driver",
      "full_insurance",
      "num_passengers",
      "country",
      "source",
      "status",
    ],
    trips: [
      "trip_name",
      "trip_title",
      "title",
      "service_name",
      "trip_date",
      "date",
      "people",
      "guests",
      "adults",
      "participants",
      "persons",
      "pickup_location",
      "pick_up_location",
      "hotel",
      "pickup_place",
      "total_price",
      "total",
      "currency",
      "country",
      "source",
      "status",
    ],
    hotels: [
      "hotel_name",
      "hotel",
      "name_hotel",
      "property_name",
      "check_in",
      "checkin",
      "check_out",
      "checkout",
      "guests",
      "people",
      "adults",
      "persons",
      "rooms",
      "room_type",
      "meal_plan",
      "total_price",
      "total",
      "currency",
      "country",
      "source",
      "status",
    ],
    shop: [
      "order_number",
      "customer_name",
      "customer_email",
      "customer_phone",
      "payment_status",
      "total",
      "amount_total",
      "grand_total",
      "total_amount",
      "currency",
      "currency_code",
      "shipping_name",
      "shipping_email",
      "shipping_phone",
      "shipping_address",
      "shipping_city",
      "shipping_postal_code",
      "shipping_country",
      "billing_name",
      "billing_email",
      "billing_phone",
      "billing_address",
      "billing_city",
      "billing_postal_code",
      "billing_country",
      "source",
    ],
    partners: [
      "partner_name",
      "partner_id",
      "requested_amount",
      "currency",
      "threshold",
      "threshold_at_request",
      "payout_threshold",
      "requested_by",
      "status",
      "created_at",
    ],
  };

  const preferredLabels: Record<string, string> = {
    car_model: "Car",
    offer_id: "Offer ID",
    pickup_location: "Pick-up",
    pick_up_location: "Pick-up",
    pickup_place: "Pick-up",
    dropoff_location: "Drop-off",
    drop_off_location: "Drop-off",
    dropoff_place: "Drop-off",
    return_location: "Drop-off",
    start_date: "From",
    end_date: "To",
    pickup_date: "From",
    return_date: "To",
    total_price: "Total",
  };

  const used = new Set<string>();
  const usedLabels = new Set<string>();
  const rows: Array<{ label: string; value: string }> = [];

  const priorityKeys = priorityKeysByCategory[category] || [];
  for (const key of priorityKeys) {
    if (isNoiseField(key)) continue;
    if (!(key in record)) continue;
    const formatted = formatRecordValueForEmail({ key, value: (record as any)[key], record });
    const value = String(formatted || "").trim();
    if (!value) continue;
    const label = preferredLabels[key] || labelForField(key);
    if (label && usedLabels.has(label)) continue;
    used.add(key);
    if (label) usedLabels.add(label);
    rows.push({ label, value });
  }

  const otherKeys = Object.keys(record)
    .filter((k) => !used.has(k))
    .filter((k) => !isNoiseField(k))
    .filter((k) => {
      const v = (record as any)[k];
      const s = formatRecordValueForEmail({ key: k, value: v, record });
      return Boolean(String(s || "").trim());
    })
    .sort((a, b) => a.localeCompare(b));

  for (const key of otherKeys) {
    const value = String(formatRecordValueForEmail({ key, value: (record as any)[key], record }) || "").trim();
    if (!value) continue;
    const label = preferredLabels[key] || labelForField(key);
    if (label && usedLabels.has(label)) continue;
    if (label) usedLabels.add(label);
    rows.push({ label, value });
  }

  return rows;
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
  if (c === "partners" || c === "partner" || c === "affiliate_cashout_requests") return "partners";
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

  if (category === "partners") {
    return `${normalizedBase}/admin/dashboard.html#partners`;
  }

  const view = category === "shop" ? "shop" : category;
  return `${normalizedBase}/admin/dashboard.html#${encodeURIComponent(view)}:${encodeURIComponent(recordId)}`;
}

function buildPartnerPanelLink(fulfillmentId?: string): string {
  const base = getMailRelayBaseUrl();
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const baseUrl = `${normalizedBase}/partners/`;
  const fid = String(fulfillmentId || "").trim();
  if (!fid) return baseUrl;
  return `${baseUrl}#fulfillments:${encodeURIComponent(fid)}`;
}

function eventLabel(event: AdminEvent): string {
  if (event === "paid") return "Paid";
  if (event === "deposit_paid") return "Deposit paid";
  if (event === "partner_rejected") return "Partner Rejected";
  if (event === "partner_sla") return "Partner SLA";
  if (event === "partner_accepted") return "Partner Accepted";
  if (event === "partner_pending_acceptance") return "Pending acceptance";
  if (event === "customer_received") return "Customer confirmation";
  if (event === "customer_deposit_requested") return "Deposit payment requested";
  if (event === "customer_deposit_paid") return "Deposit paid";
  if (event === "partner_deposit_paid") return "Deposit paid";
  if (event === "affiliate_cashout_requested") return "Affiliate cashout requested";
  return "New";
}

function normalizeDepositLang(value: unknown): "pl" | "en" {
  const v = String(value || "").trim().toLowerCase();
  return v === "pl" ? "pl" : "en";
}

function normalizeServiceCategory(value: unknown): Category | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "cars" || v === "car") return "cars";
  if (v === "trips" || v === "trip") return "trips";
  if (v === "hotels" || v === "hotel") return "hotels";
  return null;
}

function buildSubject(params: {
  category: Category;
  event: AdminEvent;
  recordId: string;
  record: Record<string, unknown>;
}): string {
  const label = params.category.toUpperCase();

  if (params.event === "affiliate_cashout_requested") {
    const partnerName = getField(params.record, ["partner_name", "partner", "partnerName", "name"]);
    const amount = formatMoney(
      getField(params.record, ["requested_amount", "amount", "requestedAmount"]),
      getField(params.record, ["currency"]),
    );
    const parts = [`[${label}] Affiliate cashout requested`];
    if (partnerName) parts.push(String(partnerName));
    if (amount) parts.push(String(amount));
    return parts.join(" — ");
  }

  if (params.event === "partner_pending_acceptance") {
    const reference = getField(params.record, ["reference", "order_number", "orderNumber"]);
    const service = getField(params.record, ["summary", "car_model", "trip_name", "hotel_name"]);
    const parts = [`[${label}] Action required`];
    if (reference) parts.push(reference);
    if (service) parts.push(service);
    return parts.join(" — ");
  }

  if (params.event === "partner_accepted") {
    const parts = [`[${label}] Partner accepted #${params.recordId}`];
    const service = getField(params.record, ["car_model", "trip_name", "trip_title", "hotel_name", "hotel", "order_number"]);
    if (service) parts.push(service);
    return parts.join(" — ");
  }

  if (params.event === "customer_received") {
    const parts = [`[${label}] Customer confirmation #${params.recordId}`];
    const service = getField(params.record, [
      "car_model",
      "trip_name",
      "trip_title",
      "title",
      "trip_slug",
      "hotel_name",
      "hotel",
      "hotel_slug",
      "order_number",
    ]);
    if (service) parts.push(service);
    return parts.join(" — ");
  }

  const customerName = getField(params.record, [
    "customer_name",
    "full_name",
    "name",
    "first_name",
    "last_name",
  ]);

  const categoryMeta = (() => {
    if (params.category === "cars") {
      const carName = getField(params.record, ["car_model", "car", "vehicle", "model"]);
      const from = formatDate(getField(params.record, ["start_date", "pickup_date", "from_date", "date_from"]));
      const to = formatDate(getField(params.record, ["end_date", "return_date", "to_date", "date_to"]));
      const datePart = [from, to].filter(Boolean).join(" → ");
      return { what: "booking", name: carName, date: datePart };
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
    const items = Array.isArray((params.record as any)?.items) ? ((params.record as any).items as any[]) : [];
    const firstItemName = items.length
      ? (valueToString(items[0]?.product_name) || valueToString(items[0]?.name) || "")
      : "";
    const parts = [`[${label}] Paid order #${params.recordId}`];
    if (amount) parts.push(amount);
    if (firstItemName) parts.push(firstItemName);
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

function resolveCustomerRecipients(category: Category, record: Record<string, unknown>): string[] {
  if (category === "cars") return parseRecipients(getField(record, ["email"]));
  if (category === "shop") return parseRecipients(getField(record, ["customer_email"]));
  if (category === "trips") return parseRecipients(getField(record, ["customer_email"]));
  if (category === "hotels") return parseRecipients(getField(record, ["customer_email"]));
  return [];
}

function buildCustomerReceivedSubject(params: {
  category: Category;
  recordId: string;
  record: Record<string, unknown>;
}): string {
  const label = params.category.toUpperCase();
  const name = (() => {
    if (params.category === "cars") return getField(params.record, ["car_model", "vehicle", "car"]);
    if (params.category === "trips") return getField(params.record, ["trip_name", "trip_title", "title", "trip_slug"]);
    if (params.category === "hotels") return getField(params.record, ["hotel_name", "hotel_slug", "hotel"]);
    if (params.category === "shop") return getField(params.record, ["order_number"]);
    return "";
  })();
  const parts = [`[${label}] We received your request`];
  if (name) parts.push(name);
  parts.push(`#${params.recordId}`);
  return parts.join(" — ");
}

function renderCustomerReceivedEmail(params: {
  category: Category;
  recordId: string;
  record: Record<string, unknown>;
}): { subject: string; html: string; text: string } {
  const { category, recordId, record } = params;

  const createdAtIso = getField(record, ["created_at", "createdAt"]) || new Date().toISOString();
  const createdAt = formatDateTime(createdAtIso);
  const customerName = getField(record, ["customer_name", "full_name", "name", "customerName"]);

  const greeting = customerName ? `Hi ${customerName},` : "Hello,";
  const receivedWhat = category === "shop" ? "order" : "booking request";

  const currency = getField(record, ["currency", "currency_code"]) || "EUR";

  const summaryRows = (() => {
    if (category === "cars") {
      return buildKeyValueRows(record, [
        { label: "Reference", value: recordId },
        { label: "Car", value: getField(record, ["car_model", "vehicle", "car"]) },
        {
          label: "Pick-up",
          value: [
            formatDate(getField(record, ["pickup_date"])),
            formatTime(getField(record, ["pickup_time"])),
            getField(record, ["pickup_location"]),
            getField(record, ["pickup_address"]),
          ]
            .filter(Boolean)
            .join(" • "),
        },
        {
          label: "Return",
          value: [
            formatDate(getField(record, ["return_date"])),
            formatTime(getField(record, ["return_time"])),
            getField(record, ["return_location"]),
            getField(record, ["return_address"]),
          ]
            .filter(Boolean)
            .join(" • "),
        },
        { label: "Passengers", value: getField(record, ["num_passengers"]) },
        { label: "Child seats", value: getField(record, ["child_seats"]) },
        { label: "Flight number", value: getField(record, ["flight_number"]) },
      ]);
    }

    if (category === "trips") {
      return buildKeyValueRows(record, [
        { label: "Reference", value: recordId },
        { label: "Trip", value: getField(record, ["trip_name", "trip_title", "title", "trip_slug"]) },
        { label: "Preferred date", value: formatDate(getField(record, ["trip_date"])) },
        {
          label: "Stay on Cyprus",
          value: [
            formatDate(getField(record, ["arrival_date"])),
            formatDate(getField(record, ["departure_date"])),
          ]
            .filter(Boolean)
            .join(" → "),
        },
        {
          label: "Participants",
          value: [
            getField(record, ["num_adults"]) ? `${getField(record, ["num_adults"]) } adult(s)` : "",
            getField(record, ["num_children"]) ? `${getField(record, ["num_children"]) } child(ren)` : "",
          ]
            .filter(Boolean)
            .join(", "),
        },
      ]);
    }

    if (category === "hotels") {
      return buildKeyValueRows(record, [
        { label: "Reference", value: recordId },
        { label: "Hotel", value: getField(record, ["hotel_name", "hotel_slug", "hotel"]) },
        { label: "Check-in", value: formatDate(getField(record, ["arrival_date"])) },
        { label: "Check-out", value: formatDate(getField(record, ["departure_date"])) },
        {
          label: "Guests",
          value: [
            getField(record, ["num_adults"]) ? `${getField(record, ["num_adults"]) } adult(s)` : "",
            getField(record, ["num_children"]) ? `${getField(record, ["num_children"]) } child(ren)` : "",
          ]
            .filter(Boolean)
            .join(", "),
        },
      ]);
    }

    const total =
      formatMoney(getField(record, ["total", "amount_total", "grand_total", "total_amount", "price_total"]), currency) || "";
    return buildKeyValueRows(record, [
      { label: "Order number", value: getField(record, ["order_number"]) || recordId },
      { label: "Total", value: total },
      { label: "Currency", value: currency },
    ]);
  })();

  const summaryTable = summaryRows.length
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

  const items = Array.isArray((record as any)?.items) ? ((record as any).items as any[]) : [];
  const itemsLines = items
    .map((item) => {
      const qty = valueToString(item?.quantity);
      const name = valueToString(item?.product_name) || valueToString(item?.name);
      const variant = valueToString(item?.variant_name);
      const line = [qty ? `${qty}×` : "", name, variant ? `(${variant})` : ""].filter(Boolean).join(" ").trim();
      return line;
    })
    .filter(Boolean);

  const itemsBlock = category === "shop" && itemsLines.length
    ? `
      <h3 style="margin:18px 0 8px; font-size:16px;">Items</h3>
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${itemsLines
          .map(
            (line) =>
              `<tr>
                <td style="padding:8px 10px; border:1px solid #e5e7eb;">${escapeHtml(line)}</td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const cta = `<a href="${escapeHtml(CUSTOMER_HOMEPAGE_URL)}" style="display:inline-block; padding:10px 14px; background:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;">Return to CyprusEye.com</a>`;

  const subject = buildCustomerReceivedSubject({ category, recordId, record });

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com • Confirmation</td>
        </tr>
      </table>`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
      <div style="margin:0 0 14px;">
        ${brandHeader}
        <div style="font-size:20px; font-weight:800; margin:0;">We received your ${escapeHtml(receivedWhat)}</div>
        <div style="font-size:13px; color:#6b7280; margin-top:6px;">${escapeHtml(createdAt)}</div>
      </div>

      <div style="font-size:14px; margin: 14px 0 0;">
        <div style="margin:0 0 10px;">${escapeHtml(greeting)}</div>
        <div style="margin:0 0 10px;">Thank you for your message. Your request has been received and is now in our system.</div>
        <div style="margin:0 0 10px;">We will get back to you shortly with confirmation and next steps.</div>
      </div>

      ${summaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Summary</h3>${summaryTable}` : ""}
      ${itemsBlock}

      <div style="margin-top:18px;">${cta}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:14px;">If you didn’t make this request, please ignore this email.</div>
    </div>`;

  const textLines: string[] = [];
  textLines.push(`We received your ${receivedWhat}`);
  if (createdAt) textLines.push(`Created: ${createdAt}`);
  textLines.push("");
  textLines.push(greeting);
  textLines.push("Thank you for your message. Your request has been received and is now in our system.");
  textLines.push("We will get back to you shortly with confirmation and next steps.");
  textLines.push("");
  if (summaryRows.length) {
    textLines.push("Summary:");
    for (const r of summaryRows) textLines.push(`- ${r.label}: ${r.value}`);
    textLines.push("");
  }
  if (category === "shop" && itemsLines.length) {
    textLines.push("Items:");
    for (const line of itemsLines) textLines.push(`- ${line}`);
    textLines.push("");
  }
  textLines.push(`Return to CyprusEye.com: ${CUSTOMER_HOMEPAGE_URL}`);

  return { subject, html, text: textLines.join("\n") };
}

async function markCustomerReceivedSentAt(supabase: any, category: Category, recordId: string) {
  const table = category === "cars"
    ? "car_bookings"
    : category === "trips"
    ? "trip_bookings"
    : category === "hotels"
    ? "hotel_bookings"
    : "shop_orders";

  try {
    const { error } = await supabase
      .from(table)
      .update({ customer_received_email_sent_at: new Date().toISOString() })
      .eq("id", recordId)
      .is("customer_received_email_sent_at", null);
    if (error) console.error("Failed to mark customer_received_email_sent_at:", error);
  } catch (e) {
    console.error("Failed to mark customer_received_email_sent_at:", e);
  }
}

async function getPartnerNotificationEmails(supabase: any, partnerId: string): Promise<string[]> {
  const pid = String(partnerId || "").trim();
  if (!pid) return [];

  try {
    const { data, error } = await supabase
      .from("partners")
      .select("notification_email, email")
      .eq("id", pid)
      .maybeSingle();
    if (!error) {
      const fromPartner = parseRecipients(String((data as any)?.notification_email || ""));
      if (fromPartner.length) return fromPartner;

      const fromEmail = parseRecipients(String((data as any)?.email || ""));
      if (fromEmail.length) return fromEmail;
    }
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("partner_users")
      .select("user_id")
      .eq("partner_id", pid)
      .limit(50);
    if (error) throw error;
    const userIds = (Array.isArray(data) ? data : []).map((r: any) => r?.user_id).filter(Boolean);
    if (!userIds.length) return [];

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("email")
      .in("id", userIds)
      .limit(50);
    if (pErr) throw pErr;

    const emails = (Array.isArray(profs) ? profs : []).map((r: any) => String(r?.email || "").trim()).filter(Boolean);
    return parseRecipients(emails.join(","));
  } catch (_e) {
    return [];
  }
}

function renderPartnerPendingEmail(params: {
  category: Category;
  fulfillmentId: string;
  record: Record<string, unknown>;
}): { html: string; text: string } {
  const { category, fulfillmentId, record } = params;

  const createdAtIso =
    getField(record, ["created_at", "createdAt", "inserted_at", "submitted_at", "timestamp"]) ||
    new Date().toISOString();
  const createdAt = formatDateTime(createdAtIso);
  const partnerLink = buildPartnerPanelLink(fulfillmentId);

  const reference = getField(record, ["reference", "order_number", "orderNumber"]);
  const summary = getField(record, ["summary"]) || getField(record, ["resource_type"]);
  const currency = getField(record, ["currency", "currency_code"]) || "EUR";

  const dateBlock = (() => {
    if (category === "trips") {
      const details = (record as any)?.details && typeof (record as any)?.details === "object" ? ((record as any).details as any) : null;
      const preferred = details?.preferred_date || details?.preferredDate || details?.trip_date || details?.tripDate || null;
      const arrival = details?.arrival_date || details?.arrivalDate || null;
      const departure = details?.departure_date || details?.departureDate || null;
      const adults = details?.num_adults ?? details?.numAdults ?? null;
      const children = details?.num_children ?? details?.numChildren ?? null;

      const parts: Array<{ label: string; value: string }> = [];
      if (preferred) parts.push({ label: "Preferred date", value: formatDate(preferred) || valueToString(preferred) });
      if (arrival || departure) {
        parts.push({
          label: "Stay on Cyprus",
          value: [formatDate(arrival) || valueToString(arrival), formatDate(departure) || valueToString(departure)].filter(Boolean).join(" → "),
        });
      }
      if (adults != null || children != null) {
        parts.push({
          label: "Participants",
          value: `${Number(adults || 0)} adult(s), ${Number(children || 0)} child(ren)`,
        });
      }
      return parts;
    }

    const from = formatDate(getField(record, ["start_date", "pickup_date", "from_date", "date_from"]));
    const to = formatDate(getField(record, ["end_date", "return_date", "to_date", "date_to"]));
    const datePart = [from, to].filter(Boolean).join(" → ");
    return datePart ? [{ label: "Dates", value: datePart }] : [];
  })();

  const price = (() => {
    if (category === "shop") {
      const allocated = getField(record, ["total_allocated"]);
      const subtotal = getField(record, ["subtotal"]);
      const value = allocated || subtotal;
      return value ? formatMoney(value, currency) || valueToString(value) : "";
    }
    const total = getField(record, ["total_price", "total", "amount_total", "grand_total", "total_amount", "price_total"]);
    return total ? formatMoney(total, currency) || valueToString(total) : "";
  })();

  const items = Array.isArray((record as any)?.items) ? ((record as any).items as any[]) : [];
  const itemsLines = items
    .map((it) => {
      const qty = valueToString(it?.quantity);
      const name = valueToString(it?.product_name) || valueToString(it?.name);
      const variant = valueToString(it?.variant_name);
      const line = [qty ? `${qty}×` : "", name, variant ? `(${variant})` : ""].filter(Boolean).join(" ").trim();
      return line;
    })
    .filter(Boolean);

  const rows: Array<{ label: string; value: string }> = [];
  rows.push({ label: "Category", value: toTitle(category) });
  if (reference) rows.push({ label: "Reference", value: reference });
  if (summary) rows.push({ label: "Details", value: summary });
  if (createdAt) rows.push({ label: "Created", value: createdAt });
  for (const r of dateBlock) rows.push(r);
  if (price) rows.push({ label: "Price", value: price });
  rows.push({ label: "Partner panel", value: partnerLink });
  rows.push({ label: "Fulfillment ID", value: fulfillmentId });

  const htmlTable = `
    <table style="width:100%; border-collapse:collapse; margin: 0;">
      ${rows
        .map(
          (r) =>
            `<tr>
              <td style="padding:8px 10px; border:1px solid #e5e7eb; width: 34%; background:#f9fafb;"><strong>${escapeHtml(r.label)}</strong></td>
              <td style="padding:8px 10px; border:1px solid #e5e7eb;">${r.label === "Partner panel" ? `<a href="${escapeHtml(r.value)}">${escapeHtml(r.value)}</a>` : escapeHtml(r.value)}</td>
            </tr>`,
        )
        .join("")}
    </table>`;

  const itemsHtml = itemsLines.length
    ? `
      <h3 style="margin:18px 0 8px; font-size:16px;">Items</h3>
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${itemsLines
          .map(
            (line) =>
              `<tr>
                <td style="padding:8px 10px; border:1px solid #e5e7eb;">${escapeHtml(line)}</td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const cta = `<a href="${escapeHtml(partnerLink)}" style="display:inline-block; padding:10px 14px; background:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600;">Open Partner Panel</a>`;

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <a href="${escapeHtml(CUSTOMER_HOMEPAGE_URL)}" style="text-decoration:none;">
              <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
            </a>
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com</td>
        </tr>
      </table>`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
      <div style="margin:0 0 14px;">
        ${brandHeader}
        <div style="font-size:13px; color:#6b7280; margin-bottom:6px;">${escapeHtml(toTitle(category))} • ${escapeHtml(eventLabel("partner_pending_acceptance"))}</div>
        <div style="font-size:20px; font-weight:800; margin:0;">New ${escapeHtml(toTitle(category))} requires your confirmation</div>
        <div style="font-size:13px; color:#6b7280; margin-top:6px;">${escapeHtml(createdAt)}</div>
        <div style="margin-top:12px;">${cta}</div>
      </div>

      <h3 style="margin:18px 0 8px; font-size:16px;">Summary</h3>
      ${htmlTable}
      ${itemsHtml}
    </div>`;

  const textLines: string[] = [];
  textLines.push(`New ${toTitle(category)} requires your confirmation`);
  if (reference) textLines.push(`Reference: ${reference}`);
  if (summary) textLines.push(`Details: ${summary}`);
  if (createdAt) textLines.push(`Created: ${createdAt}`);
  for (const r of dateBlock) textLines.push(`${r.label}: ${r.value}`);
  if (price) textLines.push(`Price: ${price}`);
  if (itemsLines.length) {
    textLines.push("");
    textLines.push("Items:");
    for (const line of itemsLines) textLines.push(`- ${line}`);
  }
  textLines.push("");
  textLines.push(`Partner panel: ${partnerLink}`);
  textLines.push(`Fulfillment ID: ${fulfillmentId}`);
  return { html, text: textLines.join("\n") };
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
      { label: "Car", value: getField(record, ["car_model", "car", "vehicle", "model"]) },
      { label: "Offer ID", value: getField(record, ["offer_id"]) },
      { label: "Pick-up", value: getField(record, ["pickup_location", "pick_up_location", "pickup_place"]) },
      { label: "Drop-off", value: getField(record, ["return_location", "dropoff_location", "drop_off_location", "dropoff_place"]) },
      { label: "From", value: formatDate(getField(record, ["start_date", "pickup_date", "from_date", "date_from"])) },
      { label: "To", value: formatDate(getField(record, ["end_date", "return_date", "to_date", "date_to"])) },
      { label: "Total", value: formatMoney(getField(record, ["total_price", "total", "amount_total", "grand_total", "total_amount", "price_total"]), currency) },
    ],
    trips: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Trip", value: getField(record, ["trip_name", "trip_title", "title", "service_name"]) },
      { label: "Date", value: formatDate(getField(record, ["trip_date", "date", "start_date"])) },
      { label: "People", value: getField(record, ["people", "guests", "adults", "participants", "persons"]) },
      { label: "Pick-up", value: getField(record, ["pickup_location", "pick_up_location", "hotel", "pickup_place"]) },
      { label: "Total", value: formatMoney(getField(record, ["total_price", "total", "amount_total", "grand_total", "total_amount", "price_total"]), currency) },
    ],
    hotels: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Hotel", value: getField(record, ["hotel_name", "hotel", "name_hotel", "property_name"]) },
      { label: "Check-in", value: formatDate(getField(record, ["check_in", "checkin", "start_date", "date_from"])) },
      { label: "Check-out", value: formatDate(getField(record, ["check_out", "checkout", "end_date", "date_to"])) },
      { label: "Guests", value: getField(record, ["guests", "people", "adults", "persons"]) },
      { label: "Total", value: formatMoney(getField(record, ["total_price", "total", "amount_total", "grand_total", "total_amount", "price_total"]), currency) },
    ],
    shop: [
      { label: "Customer", value: getField(record, ["customer_name", "full_name", "name"]) },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Order number", value: getField(record, ["order_number"]) },
      { label: "Total", value: total },
      { label: "Currency", value: currency },
    ],
    partners: [
      { label: "Partner", value: getField(record, ["partner_name", "partner", "partnerName", "name"]) },
      { label: "Partner ID", value: getField(record, ["partner_id", "partnerId"]) },
      { label: "Requested", value: formatMoney(getField(record, ["requested_amount", "amount", "requestedAmount"]), getField(record, ["currency"])) },
      { label: "Threshold", value: formatMoney(getField(record, ["threshold", "threshold_at_request", "payout_threshold"]), getField(record, ["currency"])) },
      { label: "Requested by", value: getField(record, ["requested_by", "requestedBy"]) },
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

  const formDataRows = buildFormDataRows(category, record).filter((r) => {
    const labelLower = String(r.label || "").toLowerCase();
    if (!labelLower) return false;
    if (labelLower === "category" || labelLower === "event" || labelLower === "record id" || labelLower === "created") return false;
    if (labelLower === "id" || labelLower === "created at") return false;
    if (labelLower === "admin panel" || labelLower === "notes") return false;
    return true;
  });

  const htmlFormDataTable = formDataRows.length
    ? `
      <table style="width:100%; border-collapse:collapse; margin: 0;">
        ${formDataRows
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

  const brandHeader = `
      <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 14px;">
        <tr>
          <td style="padding:0; vertical-align:middle;">
            <a href="${escapeHtml(CUSTOMER_HOMEPAGE_URL)}" style="text-decoration:none;">
              <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye.com" width="120" style="display:block; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
            </a>
          </td>
          <td style="padding:0; text-align:right; vertical-align:middle; font-size:13px; color:#6b7280;">CyprusEye.com</td>
        </tr>
      </table>`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; color:#111827; line-height:1.45;">
    <div style="margin:0 0 14px;">
      ${brandHeader}
      <div style="font-size:13px; color:#6b7280; margin-bottom:6px;">${escapeHtml(eventLabel(event))} • ${escapeHtml(toTitle(category))}</div>
      <div style="font-size:20px; font-weight:800; margin:0;">${escapeHtml(toTitle(category))} — ${escapeHtml(eventLabel(event))}</div>
      <div style="font-size:13px; color:#6b7280; margin-top:6px;">Record #${escapeHtml(recordId)} • ${escapeHtml(createdAt)}</div>
      ${cta ? `<div style="margin-top:12px;">${cta}</div>` : ""}
    </div>

    ${htmlSummaryTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Summary</h3>${htmlSummaryTable}` : ""}
    ${htmlItems}
    ${htmlFormDataTable ? `<h3 style="margin:18px 0 8px; font-size:16px;">Form data</h3>${htmlFormDataTable}` : ""}
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

  if (formDataRows.length) {
    textLines.push("Form data:");
    for (const r of formDataRows) textLines.push(`- ${r.label}: ${r.value}`);
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

  if (category === "partners") {
    const { data, error } = await supabase
      .from("affiliate_cashout_requests")
      .select("*")
      .eq("id", recordId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("Failed to load affiliate cashout request:", error);
      return null;
    }
    return data as any;
  }

  return null;
}

async function hydrateTripNameForEmail(supabase: any, record: Record<string, unknown>): Promise<void> {
  const tripId = getField(record, ["trip_id", "tripId"]);
  if (!tripId) return;

  try {
    const { data, error } = await supabase
      .from("trips")
      .select("id, slug, title")
      .eq("id", tripId)
      .maybeSingle();
    if (error || !data) return;

    const titleRaw = (data as any)?.title;
    const titleEn = (() => {
      if (titleRaw && typeof titleRaw === "object") {
        const en = String((titleRaw as any)?.en || "").trim();
        if (en) return en;
        const pl = String((titleRaw as any)?.pl || "").trim();
        if (pl) return pl;
      }
      return String(titleRaw || "").trim();
    })();

    const fallback = String((data as any)?.slug || "").trim();
    const finalName = titleEn || fallback;
    if (!finalName) return;

    (record as any).trip_name = finalName;
    (record as any).trip_title = finalName;
  } catch (_e) {
    return;
  }
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

  let record: Record<string, unknown> | null = null;
  if (body.record && typeof body.record === "object" && body.record !== null) {
    record = body.record as Record<string, unknown>;
  }

  if (event === "partner_pending_acceptance") {
    if (!record) {
      if (tableLower === "partner_service_fulfillments") {
        const { data, error } = await supabase
          .from("partner_service_fulfillments")
          .select("*")
          .eq("id", recordId)
          .maybeSingle();
        if (!error && data) record = data as any;
      } else if (tableLower === "shop_order_fulfillments") {
        const { data, error } = await supabase
          .from("shop_order_fulfillments")
          .select("*")
          .eq("id", recordId)
          .maybeSingle();
        if (!error && data) record = data as any;
      }
    }

    if (!record) {
      return new Response(JSON.stringify({ error: "Record not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (categoryFromBody === "shop") {
      try {
        const { data: items, error: itemsErr } = await supabase
          .from("shop_order_fulfillment_items")
          .select("fulfillment_id, product_name, variant_name, quantity")
          .eq("fulfillment_id", recordId)
          .limit(200);
        if (!itemsErr && Array.isArray(items)) {
          (record as any).items = items;
        }
      } catch (_e) {}
    }

    const partnerId = String(getField(record, ["partner_id", "partnerId"]) || "").trim();

    const { subject } = buildGenericEmail({
      category: categoryFromBody,
      event,
      recordId,
      record,
    });
    const rendered = renderPartnerPendingEmail({ category: categoryFromBody, fulfillmentId: recordId, record });
    const html = rendered.html;
    const text = rendered.text;

    const pushBody = (() => {
      const lines = String(text || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.slice(0, 3).join(" • ");
    })();

    const pushUrl = buildPartnerPanelLink(recordId) || getDefaultPartnerPushUrl();
    const pushResult = await sendPartnerWebPushNotifications({
      supabase,
      partnerId,
      title: subject,
      body: pushBody,
      url: pushUrl,
    });

    const recipients = await getPartnerNotificationEmails(supabase, partnerId);
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_partner_notification_email", push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const transport = buildMailTransport();
    if (!transport) {
      const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        return new Response(JSON.stringify({ ok: true, relayed: true, push: pushResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      console.warn("SMTP_HOST not set – email will be logged only.");
      console.log(`\n===== Simulated partner notification =====\nTo: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
      return new Response(JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

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

      return new Response(JSON.stringify({ ok: true, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Failed to send partner notification email:", error);
      const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true, push: pushResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(JSON.stringify({ ok: false, simulated: true, smtp_error: (error as any)?.message || "Email send failed", relay_error: relayed.error || null, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  }

  if (event === "customer_deposit_requested") {
    const depositRequestId = String((body as any)?.deposit_request_id || (body as any)?.depositRequestId || "").trim();
    if (!depositRequestId) {
      return new Response(JSON.stringify({ error: "Missing deposit_request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dep, error: depErr } = await supabase
      .from("service_deposit_requests")
      .select("*")
      .eq("id", depositRequestId)
      .maybeSingle();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ error: "Deposit request not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const alreadySent = Boolean((dep as any)?.email_sent_at);
    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const depStatus = String((dep as any)?.status || "").trim().toLowerCase();
    if (depStatus && depStatus !== "pending") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status_${depStatus}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const checkoutUrl = String((dep as any)?.checkout_url || "").trim();
    if (!checkoutUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "missing_checkout_url" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerRecipients = parseRecipients(String((dep as any)?.customer_email || ""));
    if (!customerRecipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_customer_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const rendered = renderCustomerDepositRequestedEmail({ deposit: dep as any });
    const subject = rendered.subject;
    const html = rendered.html;
    const text = rendered.text;

    const transport = buildMailTransport();
    if (!transport) {
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markDepositCustomerEmailSentAt(supabase, depositRequestId);
        return new Response(JSON.stringify({ ok: true, relayed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      console.warn("SMTP_HOST not set – email will be logged only.");
      console.log(
        `\n===== Simulated customer deposit request =====\nTo: ${customerRecipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`,
      );
      return new Response(JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

    try {
      await new Promise<void>((resolve, reject) => {
        transport.sendMail(
          {
            from,
            to: customerRecipients.join(","),
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

      await markDepositCustomerEmailSentAt(supabase, depositRequestId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Failed to send customer deposit request email:", error);
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markDepositCustomerEmailSentAt(supabase, depositRequestId);
        return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ ok: false, simulated: true, smtp_error: (error as any)?.message || "Email send failed", relay_error: relayed.error || null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  }

  if (event === "partner_deposit_paid") {
    const depositRequestId = String((body as any)?.deposit_request_id || (body as any)?.depositRequestId || "").trim();
    if (!depositRequestId) {
      return new Response(JSON.stringify({ error: "Missing deposit_request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dep, error: depErr } = await supabase
      .from("service_deposit_requests")
      .select("*")
      .eq("id", depositRequestId)
      .maybeSingle();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ error: "Deposit request not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const alreadySent = Boolean((dep as any)?.partner_email_sent_at);
    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const depStatus = String((dep as any)?.status || "").trim().toLowerCase();
    if (depStatus !== "paid") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status_${depStatus || "unknown"}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const partnerId = String((dep as any)?.partner_id || "").trim();
    const fulfillmentId = String((dep as any)?.fulfillment_id || "").trim();

    const rendered = renderPartnerDepositPaidEmail({ deposit: dep as any, contact: null });
    const pushBody = (() => {
      const lines = String(rendered.text || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.slice(0, 3).join(" • ");
    })();

    const pushUrl = buildPartnerPanelLink(fulfillmentId) || getDefaultPartnerPushUrl();
    const pushResult = await sendPartnerWebPushNotifications({
      supabase,
      partnerId,
      title: rendered.subject,
      body: pushBody,
      url: pushUrl,
    });

    const recipients = await getPartnerNotificationEmails(supabase, partnerId);
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_partner_notification_email", push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let contact: Record<string, unknown> | null = null;
    if (fulfillmentId) {
      try {
        const { data: c, error: cErr } = await supabase
          .from("partner_service_fulfillment_contacts")
          .select("customer_name, customer_email, customer_phone")
          .eq("fulfillment_id", fulfillmentId)
          .maybeSingle();
        if (!cErr && c) contact = c as any;
      } catch (_e) {}
    }

    const subject = rendered.subject;
    const html = renderPartnerDepositPaidEmail({ deposit: dep as any, contact }).html;
    const text = renderPartnerDepositPaidEmail({ deposit: dep as any, contact }).text;

    const transport = buildMailTransport();
    if (!transport) {
      const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markDepositPartnerEmailSentAt(supabase, depositRequestId);
        return new Response(JSON.stringify({ ok: true, relayed: true, push: pushResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      console.warn("SMTP_HOST not set – email will be logged only.");
      console.log(`\n===== Simulated partner deposit paid =====\nTo: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
      return new Response(JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

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

      await markDepositPartnerEmailSentAt(supabase, depositRequestId);
      return new Response(JSON.stringify({ ok: true, push: pushResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Failed to send partner deposit paid email:", error);
      const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markDepositPartnerEmailSentAt(supabase, depositRequestId);
        return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true, push: pushResult }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ ok: false, simulated: true, smtp_error: (error as any)?.message || "Email send failed", relay_error: relayed.error || null, push: pushResult }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  }

  if (event === "customer_deposit_paid") {
    const depositRequestId = String((body as any)?.deposit_request_id || (body as any)?.depositRequestId || "").trim();
    if (!depositRequestId) {
      return new Response(JSON.stringify({ error: "Missing deposit_request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dep, error: depErr } = await supabase
      .from("service_deposit_requests")
      .select("*")
      .eq("id", depositRequestId)
      .maybeSingle();

    if (depErr || !dep) {
      return new Response(JSON.stringify({ error: "Deposit request not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const depStatus = String((dep as any)?.status || "").trim().toLowerCase();
    if (depStatus !== "paid") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `status_${depStatus || "unknown"}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerRecipients = parseRecipients(String((dep as any)?.customer_email || ""));
    if (!customerRecipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_customer_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const rendered = renderCustomerDepositPaidEmail({ deposit: dep as any });
    const subject = rendered.subject;
    const html = rendered.html;
    const text = rendered.text;

    const transport = buildMailTransport();
    if (!transport) {
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        return new Response(JSON.stringify({ ok: true, relayed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      console.warn("SMTP_HOST not set – email will be logged only.");
      console.log(
        `\n===== Simulated customer deposit paid =====\nTo: ${customerRecipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`,
      );
      return new Response(JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

    try {
      await new Promise<void>((resolve, reject) => {
        transport.sendMail(
          {
            from,
            to: customerRecipients.join(","),
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
      console.error("Failed to send customer deposit paid email:", error);
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ ok: false, simulated: true, smtp_error: (error as any)?.message || "Email send failed", relay_error: relayed.error || null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  }

  if (event === "customer_received") {
    record = await loadCategoryRecord(supabase, categoryFromBody, recordId);

    if (!record) {
      return new Response(JSON.stringify({ error: "Record not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (categoryFromBody === "trips") {
      await hydrateTripNameForEmail(supabase, record);
    }

    const alreadySent = Boolean((record as any)?.customer_received_email_sent_at);
    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerRecipients = resolveCustomerRecipients(categoryFromBody, record);
    if (!customerRecipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_customer_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const rendered = renderCustomerReceivedEmail({ category: categoryFromBody, recordId, record });
    const subject = rendered.subject;
    const html = rendered.html;
    const text = rendered.text;

    const transport = buildMailTransport();
    if (!transport) {
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markCustomerReceivedSentAt(supabase, categoryFromBody, recordId);
        return new Response(JSON.stringify({ ok: true, relayed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      console.warn("SMTP_HOST not set – email will be logged only.");
      console.log(
        `\n===== Simulated customer confirmation =====\nTo: ${customerRecipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`,
      );
      return new Response(JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

    try {
      await new Promise<void>((resolve, reject) => {
        transport.sendMail(
          {
            from,
            to: customerRecipients.join(","),
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

      await markCustomerReceivedSentAt(supabase, categoryFromBody, recordId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Failed to send customer confirmation email:", error);
      const relayed = await tryRelayEmail({ to: customerRecipients, subject, text, html, secret: secretRequired });
      if (relayed.ok) {
        await markCustomerReceivedSentAt(supabase, categoryFromBody, recordId);
        return new Response(JSON.stringify({ ok: true, relayed: true, smtp_failed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ ok: false, simulated: true, smtp_error: (error as any)?.message || "Email send failed", relay_error: relayed.error || null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  }

  const adminNotificationEmailRaw = await getAdminNotificationEmails(supabase);
  const recipients = resolveRecipients(categoryFromBody, adminNotificationEmailRaw);

  if (!recipients.length) {
    console.warn(
      "Admin notification email skipped: no recipients configured",
      JSON.stringify({ category: categoryFromBody, record_id: recordId, admin_notification_email: adminNotificationEmailRaw || null }),
    );
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

  const extraFulfillmentId = typeof (body as any)?.fulfillment_id === "string" ? (body as any).fulfillment_id : "";
  const extraPartnerId = typeof (body as any)?.partner_id === "string" ? (body as any).partner_id : "";
  const extraAllAccepted = (body as any)?.all_accepted;
  const extraNote = typeof (body as any)?.note === "string" ? (body as any).note : "";
  if (extraFulfillmentId) (record as any).fulfillment_id = extraFulfillmentId;
  if (extraPartnerId) (record as any).partner_id = extraPartnerId;
  if (extraAllAccepted !== undefined) (record as any).all_accepted = extraAllAccepted;
  if (extraNote) (record as any).note = extraNote;

  const { subject, text, html } = buildGenericEmail({
    category: categoryFromBody,
    event,
    recordId,
    record,
  });

  const pushBody = (() => {
    const lines = String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.slice(0, 3).join(" • ");
  })();

  let partnerPushSummary: any = null;
  if (event === "partner_accepted" || event === "partner_rejected") {
    const partnerId = String(getField(record, ["partner_id", "partnerId"]) || "").trim();
    const fulfillmentId = String(getField(record, ["fulfillment_id", "fulfillmentId"]) || "").trim();
    const partnerPushUrl = buildPartnerPanelLink(fulfillmentId) || getDefaultPartnerPushUrl();
    partnerPushSummary = await sendPartnerWebPushNotifications({
      supabase,
      partnerId,
      title: subject,
      body: pushBody,
      url: partnerPushUrl,
    });
  }

  if (event === "partner_sla") {
    try {
      const { data: fulfillments, error: fErr } = await supabase
        .from("shop_order_fulfillments")
        .select("id, partner_id")
        .eq("order_id", recordId)
        .eq("status", "pending_acceptance")
        .not("partner_id", "is", null)
        .limit(200);

      if (fErr) throw fErr;

      const rows = Array.isArray(fulfillments) ? fulfillments : [];
      const results: any[] = [];
      for (const row of rows) {
        const pid = String((row as any)?.partner_id || "").trim();
        const fid = String((row as any)?.id || "").trim();
        if (!pid) continue;
        const partnerPushUrl = buildPartnerPanelLink(fid) || getDefaultPartnerPushUrl();
        const r = await sendPartnerWebPushNotifications({
          supabase,
          partnerId: pid,
          title: subject,
          body: pushBody,
          url: partnerPushUrl,
        });
        results.push({ partner_id: pid, fulfillment_id: fid || null, ...r });
      }
      partnerPushSummary = { ok: true, kind: "partner_sla", results };
    } catch (e) {
      partnerPushSummary = { ok: false, kind: "partner_sla", error: (e as any)?.message || String(e) };
    }
  }

  const pushUrl = buildAdminPanelLink(categoryFromBody, recordId) || getDefaultAdminPushUrl();
  const pushResult = await sendAdminWebPushNotifications({
    supabase,
    title: subject,
    body: pushBody,
    url: pushUrl,
  });
  const pushDelivered = Boolean(pushResult.ok && pushResult.sent > 0);

  const shouldMarkShopNotificationSent = pushDelivered;

  if (!recipients.length) {
    if (shouldMarkShopNotificationSent) {
      if (tableLower === "shop_order_history" && historyRecordId) {
        try {
          const { error: markErr } = await supabase
            .from("shop_order_history")
            .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
            .eq("id", historyRecordId);
          if (markErr) {
            console.error("Failed to mark shop_order_history.notification_sent (push):", markErr);
          }
        } catch (e) {
          console.error("Failed to mark shop_order_history.notification_sent (push):", e);
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
            console.error("Failed to load latest confirmed shop_order_history row (push):", latestErr);
          } else if (latestRow && !(latestRow as any).notification_sent) {
            const { error: markErr } = await supabase
              .from("shop_order_history")
              .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
              .eq("id", (latestRow as any).id);
            if (markErr) {
              console.error("Failed to mark latest shop_order_history.notification_sent (push):", markErr);
            }
          }
        } catch (e) {
          console.error("Failed to mark latest shop_order_history.notification_sent (push):", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "no_admin_notification_email", push: pushResult, partner_push: partnerPushSummary }),
      {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
      },
    );
  }

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
      return new Response(JSON.stringify({ ok: true, relayed: true, push: pushResult, partner_push: partnerPushSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    console.warn("SMTP_HOST not set – email will be logged only.");
    console.log(`\n===== Simulated admin notification =====\nTo: ${recipients.join(", ")}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
    return new Response(
      JSON.stringify({ ok: false, simulated: true, relay_error: relayed.error || null, push: pushResult, partner_push: partnerPushSummary }),
      {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
      },
    );
  }

  const from = buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com");

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

    return new Response(JSON.stringify({ ok: true, push: pushResult, partner_push: partnerPushSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
    const relayed = await tryRelayEmail({ to: recipients, subject, text, html, secret: secretRequired });
    if (relayed.ok) {
      return new Response(
        JSON.stringify({ ok: true, relayed: true, smtp_failed: true, push: pushResult, partner_push: partnerPushSummary }),
        {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
        },
      );
    }
    return new Response(
      JSON.stringify({
        ok: false,
        simulated: true,
        smtp_error: (error as any)?.message || "Email send failed",
        relay_error: relayed.error || null,
        push: pushResult,
        partner_push: partnerPushSummary,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
