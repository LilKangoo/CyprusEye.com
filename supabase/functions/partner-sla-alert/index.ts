import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sla-alert-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function notifyAdminSla(orderId: string) {
  const base = getFunctionsBaseUrl();
  if (!base) return;

  const secret = (Deno.env.get("ADMIN_NOTIFY_SECRET") || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["x-admin-notify-secret"] = secret;

  try {
    await fetch(`${base}/send-admin-notification`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category: "shop", record_id: orderId, event: "partner_sla" }),
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

  const secretRequired = (Deno.env.get("SLA_ALERT_SECRET") || "").trim();
  if (secretRequired) {
    const providedSecret = req.headers.get("x-sla-alert-secret") || new URL(req.url).searchParams.get("secret") || "";
    if (!providedSecret || providedSecret !== secretRequired) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowIso = new Date().toISOString();

  try {
    const { data: late, error } = await supabase
      .from("shop_order_fulfillments")
      .select("id, order_id")
      .eq("status", "pending_acceptance")
      .is("sla_alerted_at", null)
      .lt("sla_deadline_at", nowIso)
      .limit(50);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = Array.isArray(late) ? late : [];
    if (!rows.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderIds = Array.from(new Set(rows.map((r: any) => String(r.order_id || "")).filter(Boolean)));

    const fulfillmentIds = rows.map((r: any) => String(r.id || "")).filter(Boolean);
    if (fulfillmentIds.length) {
      await supabase
        .from("shop_order_fulfillments")
        .update({ sla_alerted_at: nowIso })
        .in("id", fulfillmentIds);
    }

    for (const orderId of orderIds) {
      await notifyAdminSla(orderId);
    }

    return new Response(JSON.stringify({ ok: true, processed: rows.length, orders: orderIds.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
