import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const SLA_ACCEPT_HOURS = 4;

function normalizeServiceType(value: unknown): "cars" | "trips" | "hotels" | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "cars" || v === "car") return "cars";
  if (v === "trips" || v === "trip") return "trips";
  if (v === "hotels" || v === "hotel") return "hotels";
  return null;
}

function serviceTableName(rt: "cars" | "trips" | "hotels"): string {
  if (rt === "cars") return "car_bookings";
  if (rt === "trips") return "trip_bookings";
  return "hotel_bookings";
}

function looksLikeUuid(value: string): boolean {
  const v = String(value || "").trim();
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function resolveDepositRequestIdFromSession(supabase: any, session: Stripe.Checkout.Session): Promise<string> {
  const metaId = String((session.metadata as any)?.deposit_request_id || "").trim();
  if (metaId) return metaId;

  const cr = String((session.client_reference_id as any) || "").trim();
  if (looksLikeUuid(cr)) {
    try {
      const { data: byId } = await supabase
        .from("service_deposit_requests")
        .select("id")
        .eq("id", cr)
        .maybeSingle();
      if (byId && (byId as any).id) return String((byId as any).id);
    } catch (_e) {}
  }

  const sid = String(session.id || "").trim();
  if (sid) {
    try {
      const { data: bySession } = await supabase
        .from("service_deposit_requests")
        .select("id")
        .eq("stripe_checkout_session_id", sid)
        .maybeSingle();
      if (bySession && (bySession as any).id) return String((bySession as any).id);
    } catch (_e) {}
  }

  return "";
}

async function enqueuePartnerDepositPaidEmail(supabase: any, params: {
  depositRequestId: string;
  partnerId: string;
  resourceType: "cars" | "trips" | "hotels";
  bookingId: string;
  fulfillmentId: string;
}) {
  const tableName = serviceTableName(params.resourceType);
  const payload = {
    category: params.resourceType,
    record_id: params.bookingId,
    event: "partner_deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.resourceType,
      p_event: "partner_deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `deposit_partner_paid:${params.depositRequestId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function enqueueCustomerDepositPaidEmail(supabase: any, params: {
  depositRequestId: string;
  resourceType: "cars" | "trips" | "hotels";
  bookingId: string;
}) {
  const tableName = serviceTableName(params.resourceType);
  const payload = {
    category: params.resourceType,
    record_id: params.bookingId,
    event: "customer_deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.resourceType,
      p_event: "customer_deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `deposit_customer_paid:${params.depositRequestId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function enqueueAdminDepositPaidEmail(supabase: any, params: {
  depositRequestId: string;
  resourceType: "cars" | "trips" | "hotels";
  bookingId: string;
  fulfillmentId: string;
  partnerId: string;
}) {
  const tableName = serviceTableName(params.resourceType);
  const payload = {
    category: params.resourceType,
    record_id: params.bookingId,
    event: "deposit_paid",
    table: tableName,
    deposit_request_id: params.depositRequestId,
    fulfillment_id: params.fulfillmentId,
    partner_id: params.partnerId,
  };

  try {
    await supabase.rpc("enqueue_admin_notification", {
      p_category: params.resourceType,
      p_event: "deposit_paid",
      p_record_id: params.bookingId,
      p_table_name: tableName,
      p_payload: payload,
      p_dedupe_key: `deposit_admin_paid:${params.depositRequestId}`,
    });
  } catch (_e) {
    // best-effort
  }
}

async function handleDepositPaymentIntentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent, depositRequestId: string) {
  const nowIso = new Date().toISOString();
  const pid = String(paymentIntent.id || "").trim();
  const id = String(depositRequestId || "").trim();
  if (!id) return;

  const { data: dep, error: depErr } = await supabase
    .from("service_deposit_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (depErr || !dep) {
    console.warn("[stripe-webhook] deposit request not found for payment_intent:", { depositRequestId: id, payment_intent_id: pid, depErr });
    return;
  }

  const resourceType = normalizeServiceType((dep as any).resource_type);
  const bookingId = String((dep as any).booking_id || "").trim();
  const partnerId = String((dep as any).partner_id || "").trim();
  const fulfillmentId = String((dep as any).fulfillment_id || "").trim();
  const amount = Number((dep as any).amount || 0) || 0;
  const currency = String((dep as any).currency || "EUR").trim() || "EUR";

  if (!resourceType || !bookingId || !partnerId || !fulfillmentId) {
    console.warn("[stripe-webhook] deposit request missing refs (payment_intent):", { depositRequestId: id, resourceType, bookingId, partnerId, fulfillmentId });
    return;
  }

  await supabase
    .from("service_deposit_requests")
    .update({
      status: "paid",
      paid_at: nowIso,
      stripe_payment_intent_id: pid || null,
    })
    .eq("id", id)
    .neq("status", "paid");

  await supabase
    .from("partner_service_fulfillments")
    .update({
      status: "accepted",
      contact_revealed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", fulfillmentId)
    .is("contact_revealed_at", null);

  const table = serviceTableName(resourceType);
  await supabase
    .from(table)
    .update({
      deposit_paid_at: nowIso,
      deposit_amount: amount,
      deposit_currency: currency,
    })
    .eq("id", bookingId)
    .is("deposit_paid_at", null);

  await enqueuePartnerDepositPaidEmail(supabase, {
    depositRequestId: id,
    partnerId,
    resourceType,
    bookingId,
    fulfillmentId,
  });

  await enqueueAdminDepositPaidEmail(supabase, {
    depositRequestId: id,
    resourceType,
    bookingId,
    fulfillmentId,
    partnerId,
  });

  await enqueueCustomerDepositPaidEmail(supabase, {
    depositRequestId: id,
    resourceType,
    bookingId,
  });
}

async function handleDepositCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session, depositRequestIdOverride?: string) {
  const depositRequestId = String(
    depositRequestIdOverride || (session.metadata as any)?.deposit_request_id || session.client_reference_id || "",
  ).trim();
  if (!depositRequestId) return;

  const nowIso = new Date().toISOString();
  const paymentIntentId = getStripeId(session.payment_intent);

  const { data: dep, error: depErr } = await supabase
    .from("service_deposit_requests")
    .select("*")
    .eq("id", depositRequestId)
    .maybeSingle();

  if (depErr || !dep) {
    console.warn("[stripe-webhook] deposit request not found:", { depositRequestId, depErr });
    return;
  }

  const resourceType = normalizeServiceType((dep as any).resource_type);
  const bookingId = String((dep as any).booking_id || "").trim();
  const partnerId = String((dep as any).partner_id || "").trim();
  const fulfillmentId = String((dep as any).fulfillment_id || "").trim();
  const amount = Number((dep as any).amount || 0) || 0;
  const currency = String((dep as any).currency || "EUR").trim() || "EUR";

  if (!resourceType || !bookingId || !partnerId || !fulfillmentId) {
    console.warn("[stripe-webhook] deposit request missing refs:", { depositRequestId, resourceType, bookingId, partnerId, fulfillmentId });
    return;
  }

  await supabase
    .from("service_deposit_requests")
    .update({
      status: "paid",
      paid_at: nowIso,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
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
    .eq("id", fulfillmentId)
    .is("contact_revealed_at", null);

  const table = serviceTableName(resourceType);
  await supabase
    .from(table)
    .update({
      deposit_paid_at: nowIso,
      deposit_amount: amount,
      deposit_currency: currency,
    })
    .eq("id", bookingId)
    .is("deposit_paid_at", null);

  await enqueuePartnerDepositPaidEmail(supabase, {
    depositRequestId,
    partnerId,
    resourceType,
    bookingId,
    fulfillmentId,
  });

  await enqueueAdminDepositPaidEmail(supabase, {
    depositRequestId,
    resourceType,
    bookingId,
    fulfillmentId,
    partnerId,
  });

  await enqueueCustomerDepositPaidEmail(supabase, {
    depositRequestId,
    resourceType,
    bookingId,
  });
}

async function handleDepositCheckoutExpired(supabase: any, session: Stripe.Checkout.Session, depositRequestIdOverride?: string) {
  const depositRequestId = String(
    depositRequestIdOverride || (session.metadata as any)?.deposit_request_id || session.client_reference_id || "",
  ).trim();
  if (!depositRequestId) return;

  const nowIso = new Date().toISOString();

  try {
    await supabase
      .from("service_deposit_requests")
      .update({ status: "expired", updated_at: nowIso })
      .eq("id", depositRequestId)
      .eq("status", "pending");
  } catch (_e) {
    // best-effort
  }
}

function getStripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as any).id;
    return typeof id === "string" ? id : null;
  }
  return null;
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

async function activatePartnerFulfillments(params: {
  supabase: any;
  order: any;
  nowIso: string;
}) {
  const { supabase, order, nowIso } = params;

  try {
    const orderId = String(order?.id || "");
    if (!orderId) return;

    const { data: fulfillments, error: fErr } = await supabase
      .from("shop_order_fulfillments")
      .select("id, status")
      .eq("order_id", orderId);

    if (fErr) {
      console.warn("[stripe-webhook] fulfillments read skipped:", fErr);
      return;
    }

    const rows = Array.isArray(fulfillments) ? fulfillments : [];
    if (!rows.length) {
      // No fulfillments (likely migration not applied or single-vendor legacy). Don't block order.
      await supabase
        .from("shop_orders")
        .update({ partner_acceptance_status: "none", partner_acceptance_updated_at: nowIso })
        .eq("id", orderId);
      return;
    }

    const deadline = new Date(Date.now() + SLA_ACCEPT_HOURS * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabase
      .from("shop_order_fulfillments")
      .update({
        status: "pending_acceptance",
        sla_deadline_at: deadline,
      })
      .eq("order_id", orderId)
      .eq("status", "awaiting_payment");

    if (updErr) {
      console.warn("[stripe-webhook] fulfillments update skipped:", updErr);
    }

    // Store contact snapshots for PII gating (best-effort, ignore duplicates)
    for (const f of rows) {
      const fulfillmentId = String((f as any)?.id || "");
      if (!fulfillmentId) continue;

      try {
        const { error: contactErr } = await supabase
          .from("shop_order_fulfillment_contacts")
          .insert({
            fulfillment_id: fulfillmentId,
            customer_name: order.customer_name ?? null,
            customer_email: order.customer_email ?? null,
            customer_phone: order.customer_phone ?? null,
            shipping_address: order.shipping_address ?? null,
            billing_address: order.billing_address ?? null,
          });

        const code = (contactErr as any)?.code;
        if (contactErr && code !== "23505") {
          console.warn("[stripe-webhook] fulfillment contact insert failed:", contactErr);
        }
      } catch (e) {
        console.warn("[stripe-webhook] fulfillment contact insert error:", e);
      }
    }

    await supabase
      .from("shop_orders")
      .update({ partner_acceptance_status: "pending", partner_acceptance_updated_at: nowIso })
      .eq("id", orderId);
  } catch (e) {
    console.warn("[stripe-webhook] activatePartnerFulfillments skipped:", e);
  }
}

async function sendCustomerPaymentReceivedEmail(params: { orderId: string }) {
  const { orderId } = params;
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
      body: JSON.stringify({ order_id: orderId, type: "payment_received" }),
    });
  } catch (e) {
    console.warn("[stripe-webhook] customer email call failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`Processing event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(supabase, session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(supabase, paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(supabase, paymentIntent);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function handleCheckoutCompleted(supabase: any, session: Stripe.Checkout.Session) {
  console.log("Checkout completed:", session.id);

  const depositRequestId = await resolveDepositRequestIdFromSession(supabase, session);
  if (depositRequestId) {
    console.log("[stripe-webhook] deposit checkout detected", { session_id: session.id, deposit_request_id: depositRequestId });
    await handleDepositCheckoutCompleted(supabase, session, depositRequestId);
    return;
  }

  let order: any = null;

  const primary = await supabase
    .from("shop_orders")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .single();

  if (primary.data) {
    order = primary.data;
  } else if (primary.error && (primary.error as any)?.code !== "PGRST116") {
    console.error("Error finding order by session id:", primary.error);
    return;
  }

  if (!order) {
    const metaOrderId = (session.metadata as any)?.order_id;
    const fallbackOrderId = (metaOrderId || session.client_reference_id || "") as string;
    if (fallbackOrderId) {
      const fallback = await supabase
        .from("shop_orders")
        .select("*")
        .eq("id", fallbackOrderId)
        .single();

      if (fallback.data) {
        order = fallback.data;
      } else if (fallback.error && (fallback.error as any)?.code !== "PGRST116") {
        console.error("Error finding order by id fallback:", fallback.error);
        return;
      }
    }
  }

  if (!order) {
    console.error("Order not found for session:", {
      session_id: session.id,
      client_reference_id: session.client_reference_id,
      metadata_order_id: (session.metadata as any)?.order_id,
    });
    return;
  }

  const fromStatus = order.status;
  const nowIso = new Date().toISOString();
  const paymentIntentId = getStripeId(session.payment_intent);
  const customerId = getStripeId(session.customer);

  const firstConfirmAttempt = await supabase
    .from("shop_orders")
    .update({
      status: "confirmed",
      payment_status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      paid_at: nowIso,
      confirmed_at: nowIso,
    })
    .eq("id", order.id)
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle();

  if (firstConfirmAttempt.error) {
    console.error("Error confirming order (first attempt):", firstConfirmAttempt.error);
    return;
  }

  const isFirstConfirm = !!firstConfirmAttempt.data;

  if (!isFirstConfirm) {
    const { error: updateError } = await supabase
      .from("shop_orders")
      .update({
        status: "confirmed",
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: customerId,
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("Error updating order:", updateError);
      return;
    }
  }

  if (isFirstConfirm) {
    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      from_status: fromStatus,
      to_status: "confirmed",
      note: "Payment completed via Stripe",
    });
  }

  if (isFirstConfirm) {
    const { data: settings } = await supabase
      .from("shop_settings")
      .select("xp_enabled, xp_award_on")
      .single();

    if (settings?.xp_enabled && settings?.xp_award_on === "payment") {
      await supabase.rpc("shop_award_xp", { p_order_id: order.id });
    }
  }

  if (isFirstConfirm && order.discount_id && order.user_id) {
    const discountAmount = Number(order.discount_amount || 0) || 0;
    try {
      const { error: usageError } = await supabase
        .from("shop_discount_usage")
        .insert({
          discount_id: order.discount_id,
          order_id: order.id,
          user_id: order.user_id,
          discount_amount: discountAmount,
        });

      const usageErrorCode = (usageError as any)?.code;
      if (usageError && usageErrorCode !== "23505") {
        console.error("Failed to insert discount usage:", usageError);
      }

      if (!usageError) {
        try {
          const { data: d, error: readErr } = await supabase
            .from("shop_discounts")
            .select("usage_count")
            .eq("id", order.discount_id)
            .single();

          if (readErr) {
            console.error("Failed to load discount usage_count:", readErr);
          } else {
            const currentCount = Number((d as any)?.usage_count || 0) || 0;
            const { error: updateErr } = await supabase
              .from("shop_discounts")
              .update({ usage_count: currentCount + 1, updated_at: new Date().toISOString() })
              .eq("id", order.discount_id);
            if (updateErr) {
              console.error("Failed to update discount usage_count:", updateErr);
            }
          }
        } catch (e) {
          console.error("Failed to increment discount usage_count:", e);
        }
      }
    } catch (e) {
      console.error("Discount usage tracking error:", e);
    }
  }

  if (isFirstConfirm) {
    try {
      await updateInventory(supabase, order.id);
    } catch (e) {
      console.error("Inventory update failed:", e);
    }
  }

  if (isFirstConfirm) {
    try {
      const { data: cartData } = await supabase
        .from("shop_carts")
        .select("id")
        .eq("user_id", order.user_id)
        .single();

      if (cartData) {
        await supabase.from("shop_cart_items").delete().eq("cart_id", cartData.id);
        await supabase.from("shop_carts").update({ discount_code: null }).eq("id", cartData.id);
      }
    } catch (e) {
      console.error("Cart cleanup failed:", e);
    }
  }

  if (isFirstConfirm) {
    await activatePartnerFulfillments({ supabase, order, nowIso });
    await sendCustomerPaymentReceivedEmail({ orderId: String(order.id) });
  }

  console.log("Order confirmed and XP awarded:", order.id);
}

async function handleCheckoutExpired(supabase: any, session: Stripe.Checkout.Session) {
  console.log("Checkout expired:", session.id);

  const depositRequestId = await resolveDepositRequestIdFromSession(supabase, session);
  if (depositRequestId) {
    console.log("[stripe-webhook] deposit checkout expired detected", { session_id: session.id, deposit_request_id: depositRequestId });
    await handleDepositCheckoutExpired(supabase, session, depositRequestId);
    return;
  }

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, status")
    .eq("stripe_checkout_session_id", session.id)
    .single();

  if (order && order.status === "pending") {
    await supabase
      .from("shop_orders")
      .update({
        status: "cancelled",
        payment_status: "failed",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      from_status: "pending",
      to_status: "cancelled",
      note: "Checkout session expired",
    });

    await restoreInventory(supabase, order.id);
  }
}

async function handlePaymentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment succeeded:", paymentIntent.id);

  const depId = String((paymentIntent.metadata as any)?.deposit_request_id || "").trim();
  if (depId) {
    await handleDepositPaymentIntentSucceeded(supabase, paymentIntent, depId);
    return;
  }

  let order: any = null;

  const primary = await supabase
    .from("shop_orders")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (primary.data) {
    order = primary.data;
  } else if ((paymentIntent.metadata as any)?.order_id) {
    const orderId = String((paymentIntent.metadata as any).order_id || "");
    if (orderId) {
      const fallback = await supabase
        .from("shop_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (fallback.data) order = fallback.data;
    }
  }

  if (!order) {
    console.error("Order not found for payment_intent:", {
      payment_intent_id: paymentIntent.id,
      metadata_order_id: (paymentIntent.metadata as any)?.order_id,
    });
    return;
  }

  const fromStatus = order.status;
  const nowIso = new Date().toISOString();
  const customerId = getStripeId(paymentIntent.customer);

  const firstConfirmAttempt = await supabase
    .from("shop_orders")
    .update({
      status: "confirmed",
      payment_status: "paid",
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: customerId,
      paid_at: nowIso,
      confirmed_at: nowIso,
    })
    .eq("id", order.id)
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle();

  if (firstConfirmAttempt.error) {
    console.error("Error confirming order from payment_intent.succeeded (first attempt):", firstConfirmAttempt.error);
    return;
  }

  const isFirstConfirm = !!firstConfirmAttempt.data;

  if (!isFirstConfirm) {
    const { error: updateErr } = await supabase
      .from("shop_orders")
      .update({
        status: "confirmed",
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customerId,
      })
      .eq("id", order.id);

    if (updateErr) {
      console.error("Error updating order from payment_intent.succeeded:", updateErr);
      return;
    }
  }

  if (isFirstConfirm) {
    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      from_status: fromStatus,
      to_status: "confirmed",
      note: "Payment completed via Stripe (payment_intent.succeeded)",
    });

    const { data: settings } = await supabase
      .from("shop_settings")
      .select("xp_enabled, xp_award_on")
      .single();

    if (settings?.xp_enabled && settings?.xp_award_on === "payment") {
      await supabase.rpc("shop_award_xp", { p_order_id: order.id });
    }

    if (order.discount_id && order.user_id) {
      const discountAmount = Number(order.discount_amount || 0) || 0;
      try {
        const { error: usageError } = await supabase
          .from("shop_discount_usage")
          .insert({
            discount_id: order.discount_id,
            order_id: order.id,
            user_id: order.user_id,
            discount_amount: discountAmount,
          });

        const usageErrorCode = (usageError as any)?.code;
        if (usageError && usageErrorCode !== "23505") {
          console.error("Failed to insert discount usage:", usageError);
        }

        if (!usageError) {
          try {
            const { data: d, error: readErr } = await supabase
              .from("shop_discounts")
              .select("usage_count")
              .eq("id", order.discount_id)
              .single();

            if (readErr) {
              console.error("Failed to load discount usage_count:", readErr);
            } else {
              const currentCount = Number((d as any)?.usage_count || 0) || 0;
              const { error: updateErr } = await supabase
                .from("shop_discounts")
                .update({ usage_count: currentCount + 1, updated_at: new Date().toISOString() })
                .eq("id", order.discount_id);
              if (updateErr) {
                console.error("Failed to update discount usage_count:", updateErr);
              }
            }
          } catch (e) {
            console.error("Failed to increment discount usage_count:", e);
          }
        }
      } catch (e) {
        console.error("Discount usage tracking error:", e);
      }
    }

    try {
      await updateInventory(supabase, order.id);
    } catch (e) {
      console.error("Inventory update failed:", e);
    }

    try {
      const { data: cartData } = await supabase
        .from("shop_carts")
        .select("id")
        .eq("user_id", order.user_id)
        .single();

      if (cartData) {
        await supabase.from("shop_cart_items").delete().eq("cart_id", cartData.id);
        await supabase.from("shop_carts").update({ discount_code: null }).eq("id", cartData.id);
      }
    } catch (e) {
      console.error("Cart cleanup failed:", e);
    }

    await activatePartnerFulfillments({ supabase, order, nowIso });
    await sendCustomerPaymentReceivedEmail({ orderId: String(order.id) });
  }
}

async function handlePaymentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment failed:", paymentIntent.id);

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, status, payment_status, confirmed_at")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    if ((order as any).confirmed_at || (order as any).payment_status === "paid") {
      console.log("Ignoring payment_failed for already paid/confirmed order:", (order as any).id);
      return;
    }

    await supabase
      .from("shop_orders")
      .update({
        payment_status: "failed",
        status: "failed",
      })
      .eq("id", order.id);

    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      from_status: order.status,
      to_status: "failed",
      note: `Payment failed: ${paymentIntent.last_payment_error?.message || "Unknown error"}`,
    });
  }
}

async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);

  const { data: existingSub } = await supabase
    .from("shop_subscriptions")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    status: subscription.status,
    quantity: subscription.items.data[0]?.quantity || 1,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  if (existingSub) {
    await supabase
      .from("shop_subscriptions")
      .update(subscriptionData)
      .eq("id", existingSub.id);
  } else {
    const userId = subscription.metadata?.user_id;
    const productId = subscription.metadata?.product_id;

    if (userId) {
      await supabase.from("shop_subscriptions").insert({
        ...subscriptionData,
        user_id: userId,
        product_id: productId || null,
      });
    }
  }
}

async function handleSubscriptionDeleted(supabase: any, subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id);

  await supabase
    .from("shop_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleChargeRefunded(supabase: any, charge: Stripe.Charge) {
  console.log("Charge refunded:", charge.id);

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, status, total")
    .eq("stripe_payment_intent_id", charge.payment_intent)
    .single();

  if (!order) return;

  const refundAmount = (charge.amount_refunded || 0) / 100;
  const isFullRefund = refundAmount >= order.total;

  await supabase
    .from("shop_orders")
    .update({
      payment_status: isFullRefund ? "refunded" : "partially_refunded",
      status: isFullRefund ? "refunded" : order.status,
      refunded_at: isFullRefund ? new Date().toISOString() : null,
    })
    .eq("id", order.id);

  await supabase.from("shop_refunds").insert({
    order_id: order.id,
    amount: refundAmount,
    stripe_refund_id: charge.refunds?.data[0]?.id || null,
    refund_type: isFullRefund ? "full" : "partial",
    status: "completed",
    processed_at: new Date().toISOString(),
  });

  await supabase.from("shop_order_history").insert({
    order_id: order.id,
    from_status: order.status,
    to_status: isFullRefund ? "refunded" : order.status,
    note: `Refund of €${refundAmount.toFixed(2)} processed`,
  });
}

async function updateInventory(supabase: any, orderId: string) {
  const { data: items } = await supabase
    .from("shop_order_items")
    .select("product_id, variant_id, quantity")
    .eq("order_id", orderId);

  if (!items) return;

  for (const item of items) {
    if (item.variant_id) {
      const { data: variantRow, error: variantErr } = await supabase
        .from("shop_product_variants")
        .select("stock_quantity")
        .eq("id", item.variant_id)
        .single();

      if (variantErr) {
        console.error("Failed to load variant for stock decrement:", variantErr);
        continue;
      }

      const currentStock = Number((variantRow as any)?.stock_quantity || 0) || 0;
      const nextStock = Math.max(0, currentStock - Number(item.quantity || 0));

      const { error: variantUpdateErr } = await supabase
        .from("shop_product_variants")
        .update({ stock_quantity: nextStock })
        .eq("id", item.variant_id);

      if (variantUpdateErr) {
        console.error("Failed to decrement variant stock:", variantUpdateErr);
      }
    } else if (item.product_id) {
      const { data: productRow, error: productErr } = await supabase
        .from("shop_products")
        .select("stock_quantity, total_sold")
        .eq("id", item.product_id)
        .single();

      if (productErr) {
        console.error("Failed to load product for stock decrement:", productErr);
        continue;
      }

      const currentStock = Number((productRow as any)?.stock_quantity || 0) || 0;
      const currentSold = Number((productRow as any)?.total_sold || 0) || 0;
      const qty = Number(item.quantity || 0) || 0;
      const nextStock = Math.max(0, currentStock - qty);
      const nextSold = currentSold + qty;

      const { error: productUpdateErr } = await supabase
        .from("shop_products")
        .update({ stock_quantity: nextStock, total_sold: nextSold })
        .eq("id", item.product_id);

      if (productUpdateErr) {
        console.error("Failed to decrement product stock:", productUpdateErr);
      }
    }
  }
}

async function restoreInventory(supabase: any, orderId: string) {
  const { data: items } = await supabase
    .from("shop_order_items")
    .select("product_id, variant_id, quantity")
    .eq("order_id", orderId);

  if (!items) return;

  for (const item of items) {
    if (item.variant_id) {
      const { data: variantRow, error: variantErr } = await supabase
        .from("shop_product_variants")
        .select("stock_quantity")
        .eq("id", item.variant_id)
        .single();

      if (variantErr) {
        console.error("Failed to load variant for stock restore:", variantErr);
        continue;
      }

      const currentStock = Number((variantRow as any)?.stock_quantity || 0) || 0;
      const qty = Number(item.quantity || 0) || 0;
      const nextStock = currentStock + qty;

      const { error: variantUpdateErr } = await supabase
        .from("shop_product_variants")
        .update({ stock_quantity: nextStock })
        .eq("id", item.variant_id);

      if (variantUpdateErr) {
        console.error("Failed to restore variant stock:", variantUpdateErr);
      }
    } else if (item.product_id) {
      const { data: productRow, error: productErr } = await supabase
        .from("shop_products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();

      if (productErr) {
        console.error("Failed to load product for stock restore:", productErr);
        continue;
      }

      const currentStock = Number((productRow as any)?.stock_quantity || 0) || 0;
      const qty = Number(item.quantity || 0) || 0;
      const nextStock = currentStock + qty;

      const { error: productUpdateErr } = await supabase
        .from("shop_products")
        .update({ stock_quantity: nextStock })
        .eq("id", item.product_id);

      if (productUpdateErr) {
        console.error("Failed to restore product stock:", productUpdateErr);
      }
    }
  }
}
