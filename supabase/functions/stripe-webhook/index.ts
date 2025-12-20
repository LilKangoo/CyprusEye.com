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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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

  const { data: order, error: findError } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .single();

  if (findError || !order) {
    console.error("Order not found for session:", session.id);
    return;
  }

  const { error: updateError } = await supabase
    .from("shop_orders")
    .update({
      status: "confirmed",
      payment_status: "paid",
      stripe_payment_intent_id: session.payment_intent,
      stripe_customer_id: session.customer,
      paid_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    console.error("Error updating order:", updateError);
    return;
  }

  await supabase.from("shop_order_history").insert({
    order_id: order.id,
    from_status: order.status,
    to_status: "confirmed",
    note: "Payment completed via Stripe",
  });

  const { data: settings } = await supabase
    .from("shop_settings")
    .select("xp_enabled, xp_award_on")
    .single();

  if (settings?.xp_enabled && settings?.xp_award_on === "payment") {
    await supabase.rpc("shop_award_xp", { p_order_id: order.id });
  }

  await updateInventory(supabase, order.id);

  const { data: cartData } = await supabase
    .from("shop_carts")
    .select("id")
    .eq("user_id", order.user_id)
    .single();

  if (cartData) {
    await supabase.from("shop_cart_items").delete().eq("cart_id", cartData.id);
  }

  console.log("Order confirmed and XP awarded:", order.id);
}

async function handleCheckoutExpired(supabase: any, session: Stripe.Checkout.Session) {
  console.log("Checkout expired:", session.id);

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

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, payment_status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (order && order.payment_status !== "paid") {
    await supabase
      .from("shop_orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id);
  }
}

async function handlePaymentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log("Payment failed:", paymentIntent.id);

  const { data: order } = await supabase
    .from("shop_orders")
    .select("id, status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
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
      await supabase.rpc("decrement_variant_stock", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      });
    } else if (item.product_id) {
      await supabase
        .from("shop_products")
        .update({
          stock_quantity: supabase.sql`stock_quantity - ${item.quantity}`,
          total_sold: supabase.sql`total_sold + ${item.quantity}`,
        })
        .eq("id", item.product_id);
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
      await supabase
        .from("shop_product_variants")
        .update({
          stock_quantity: supabase.sql`stock_quantity + ${item.quantity}`,
        })
        .eq("id", item.variant_id);
    } else if (item.product_id) {
      await supabase
        .from("shop_products")
        .update({
          stock_quantity: supabase.sql`stock_quantity + ${item.quantity}`,
        })
        .eq("id", item.product_id);
    }
  }
}
