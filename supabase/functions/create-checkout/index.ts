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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  product_name: string;
  variant_name?: string;
  unit_price: number;
  image_url?: string;
}

interface CheckoutRequest {
  user_id: string;
  items: CartItem[];
  shipping_address: {
    first_name: string;
    last_name: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    phone?: string;
  };
  billing_address?: {
    first_name: string;
    last_name: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
  };
  shipping_method_id?: string;
  discount_code?: string;
  customer_notes?: string;
  success_url: string;
  cancel_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: CheckoutRequest = await req.json();

    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("id", body.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: orderNumber } = await supabase.rpc("shop_generate_order_number");

    let subtotal = 0;
    let shippingCost = 0;
    let discountAmount = 0;
    let discountId: string | null = null;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of body.items) {
      const itemTotal = item.unit_price * item.quantity;
      subtotal += itemTotal;

      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: item.variant_name 
              ? `${item.product_name} - ${item.variant_name}` 
              : item.product_name,
            images: item.image_url ? [item.image_url] : undefined,
          },
          unit_amount: Math.round(item.unit_price * 100),
        },
        quantity: item.quantity,
      });
    }

    if (body.shipping_method_id) {
      const { data: shippingMethod } = await supabase
        .from("shop_shipping_methods")
        .select("*, zone:shop_shipping_zones(*)")
        .eq("id", body.shipping_method_id)
        .single();

      if (shippingMethod) {
        shippingCost = Number(shippingMethod.cost) || 0;

        if (shippingMethod.free_shipping_threshold && subtotal >= shippingMethod.free_shipping_threshold) {
          shippingCost = 0;
        }

        if (shippingCost > 0) {
          lineItems.push({
            price_data: {
              currency: "eur",
              product_data: {
                name: `Shipping: ${shippingMethod.name}`,
              },
              unit_amount: Math.round(shippingCost * 100),
            },
            quantity: 1,
          });
        }
      }
    }

    let stripeDiscounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (body.discount_code) {
      const { data: discount } = await supabase
        .from("shop_discounts")
        .select("*")
        .eq("code", body.discount_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (discount) {
        const now = new Date();
        const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
        const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

        if ((!startsAt || now >= startsAt) && (!expiresAt || now < expiresAt)) {
          if (!discount.usage_limit || discount.usage_count < discount.usage_limit) {
            if (discount.discount_type === "percentage") {
              discountAmount = (subtotal * discount.discount_value) / 100;
            } else {
              discountAmount = Math.min(discount.discount_value, subtotal);
            }

            if (discount.maximum_discount_amount) {
              discountAmount = Math.min(discountAmount, discount.maximum_discount_amount);
            }

            discountId = discount.id;

            if (discount.stripe_promotion_code_id) {
              stripeDiscounts = [{ promotion_code: discount.stripe_promotion_code_id }];
            } else if (discount.stripe_coupon_id) {
              stripeDiscounts = [{ coupon: discount.stripe_coupon_id }];
            }
          }
        }
      }
    }

    const total = subtotal + shippingCost - discountAmount;

    const billingAddress = body.billing_address || body.shipping_address;

    const { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .insert({
        order_number: orderNumber,
        user_id: body.user_id,
        customer_email: user.email,
        customer_name: `${body.shipping_address.first_name} ${body.shipping_address.last_name}`,
        customer_phone: body.shipping_address.phone,
        shipping_address: body.shipping_address,
        billing_address: billingAddress,
        items_subtotal: subtotal,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        discount_code: body.discount_code,
        discount_id: discountId,
        total: total,
        shipping_method_id: body.shipping_method_id,
        customer_notes: body.customer_notes,
        status: "pending",
        payment_status: "unpaid",
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderItems = body.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_name: item.product_name,
      variant_name: item.variant_name || null,
      product_image: item.image_url,
      original_price: item.unit_price,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.unit_price * item.quantity,
    }));

    await supabase.from("shop_order_items").insert(orderItems);

    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      to_status: "pending",
      note: "Order created, awaiting payment",
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${body.success_url}?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${body.cancel_url}?order_id=${order.id}`,
      customer_email: user.email,
      client_reference_id: order.id,
      metadata: {
        order_id: order.id,
        order_number: orderNumber,
        user_id: body.user_id,
      },
      ...(stripeDiscounts.length > 0 && { discounts: stripeDiscounts }),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    await supabase
      .from("shop_orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        session_url: session.url,
        order_id: order.id,
        order_number: orderNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
