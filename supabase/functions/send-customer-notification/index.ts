import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";

type NotificationType = "payment_received" | "confirmed";

type CustomerNotificationRequest = {
  order_id?: string;
  type?: NotificationType;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function buildMailTransport() {
  const host = Deno.env.get("SMTP_HOST");
  if (!host) return null;

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

function buildCustomerEmail(params: {
  type: NotificationType;
  orderNumber: string;
  customerName?: string | null;
}): { subject: string; text: string; html: string } {
  const { type, orderNumber, customerName } = params;
  const name = (customerName || "").trim();
  const greeting = name ? `Hello ${name},` : "Hello,";

  if (type === "payment_received") {
    const subject = `Payment received – Order ${orderNumber}`;
    const text = `${greeting}\n\nWe have received your payment for order ${orderNumber}.\n\nYour order is now waiting for confirmation. We will email you again once it is confirmed.\n\nThank you.`;
    const html = `
      <p>${escapeHtml(greeting)}</p>
      <p>We have received your payment for order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      <p>Your order is now waiting for confirmation. We will email you again once it is confirmed.</p>
      <p>Thank you.</p>
    `.trim();
    return { subject, text, html };
  }

  const subject = `Order confirmed – Order ${orderNumber}`;
  const text = `${greeting}\n\nYour order ${orderNumber} has been confirmed.\n\nThank you.`;
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> has been confirmed.</p>
    <p>Thank you.</p>
  `.trim();
  return { subject, text, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const secretRequired = (Deno.env.get("CUSTOMER_NOTIFY_SECRET") || "").trim();
  if (secretRequired) {
    const providedSecret = req.headers.get("x-customer-notify-secret") || new URL(req.url).searchParams.get("secret") || "";
    if (!providedSecret || providedSecret !== secretRequired) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: CustomerNotificationRequest;
  try {
    body = (await req.json()) as CustomerNotificationRequest;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const type = body.type;
  if (!orderId || (type !== "payment_received" && type !== "confirmed")) {
    return new Response(JSON.stringify({ error: "Missing order_id or invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: order, error: orderErr } = await supabase
    .from("shop_orders")
    .select("id, order_number, customer_email, customer_name, customer_payment_email_sent_at, customer_confirmed_email_sent_at")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const alreadySent =
    type === "payment_received"
      ? Boolean((order as any).customer_payment_email_sent_at)
      : Boolean((order as any).customer_confirmed_email_sent_at);

  if (alreadySent) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = String((order as any).customer_email || "").trim();
  const orderNumber = String((order as any).order_number || orderId).trim();
  if (!email) {
    return new Response(JSON.stringify({ error: "Missing customer_email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { subject, text, html } = buildCustomerEmail({
    type,
    orderNumber,
    customerName: (order as any).customer_name || null,
  });

  const transport = buildMailTransport();
  if (!transport) {
    console.warn("SMTP_HOST not set – customer email will be logged only.");
    console.log(`\n===== Simulated customer notification =====\nTo: ${email}\nSubject: ${subject}\n\n${text}\n===== End =====\n`);
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
          to: email,
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

    const updatePatch =
      type === "payment_received"
        ? { customer_payment_email_sent_at: new Date().toISOString() }
        : { customer_confirmed_email_sent_at: new Date().toISOString() };

    const { error: markErr } = await supabase.from("shop_orders").update(updatePatch).eq("id", orderId);
    if (markErr) {
      console.error("Failed to mark customer email sent:", markErr);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to send customer email:", error);
    return new Response(JSON.stringify({ error: error?.message || "Email send failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
