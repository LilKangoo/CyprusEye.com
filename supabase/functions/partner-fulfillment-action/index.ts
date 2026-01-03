import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    if (action === "accept" && fulfillmentStatus === "accepted") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "already_accepted", data: { order_id: orderId || null, booking_id: bookingId || null, fulfillment_id: fulfillmentId, partner_id: partnerId, all_accepted: false } }),
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

      const { data: updRows, error: updErr } = await supabase
        .from(kind === "shop" ? "shop_order_fulfillments" : "partner_service_fulfillments")
        .update({
          status: "accepted",
          accepted_at: nowIso,
          accepted_by: userId,
          rejected_at: null,
          rejected_by: null,
          rejected_reason: null,
          contact_revealed_at: nowIso,
        })
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
        return new Response(JSON.stringify({ ok: true, data: { booking_id: bookingId, fulfillment_id: fulfillmentId, partner_id: partnerId } }), {
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
