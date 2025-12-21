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
  weight?: number;
  shipping_class_id?: string | null;
  requires_shipping?: boolean;
}

interface ShippingMetrics {
  totalItems: number;
  totalWeight: number;
  classTotals: Record<string, { quantity: number; weight: number }>;
}

interface ShippingQuote {
  totalCost: number;
  totalWeight: number;
  freeShipping: boolean;
  error?: string;
  reason?: string;
  limit?: number;
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
  shipping_details?: {
    metrics?: ShippingMetrics;
    quote?: ShippingQuote;
  };
}

const DEFAULT_CLASS_KEY = "__NO_CLASS__";

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const parseJsonField = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (_e) {
      return fallback;
    }
  }
  return fallback;
};

type ProductShippingInfo = {
  id: string;
  weight: number | null;
  shipping_class_id: string | null;
  is_virtual: boolean | null;
};

const calculateShippingMetrics = (
  items: CartItem[],
  productsMap: Record<string, ProductShippingInfo>
): ShippingMetrics => {
  const metrics: ShippingMetrics = {
    totalItems: 0,
    totalWeight: 0,
    classTotals: {},
  };

  for (const item of items) {
    const product = productsMap[item.product_id];
    const requiresShipping = product
      ? product.is_virtual === true
        ? false
        : true
      : item.requires_shipping === false
        ? false
        : true;
    if (!requiresShipping) continue;

    const itemWeight = toNumber(
      product?.weight ?? item.weight ?? 0
    );
    const classId = product?.shipping_class_id ?? item.shipping_class_id ?? null;
    const qty = item.quantity || 0;

    metrics.totalItems += qty;
    metrics.totalWeight += itemWeight * qty;

    const mapKey = classId || DEFAULT_CLASS_KEY;
    if (!metrics.classTotals[mapKey]) {
      metrics.classTotals[mapKey] = { quantity: 0, weight: 0 };
    }
    metrics.classTotals[mapKey].quantity += qty;
    metrics.classTotals[mapKey].weight += itemWeight * qty;
  }

  return metrics;
};

const calculateShippingCost = (
  shippingMethod: any,
  metrics: ShippingMetrics,
  orderSubtotal: number,
  shippingClassesMap: Record<string, any>
): ShippingQuote => {
  if (!metrics.totalItems) {
    return {
      totalCost: 0,
      totalWeight: 0,
      freeShipping: true,
    };
  }

  const minWeight = toNumber(shippingMethod.min_weight);
  const maxWeight = toNumber(shippingMethod.max_weight);
  if (maxWeight && metrics.totalWeight > maxWeight) {
    return {
      totalCost: 0,
      totalWeight: metrics.totalWeight,
      freeShipping: false,
      error: "over_max_weight",
      limit: maxWeight,
    };
  }

  const methodType = shippingMethod.method_type || "flat_rate";
  const perKgRate = toNumber(shippingMethod.cost_per_kg);
  const perItemRate = toNumber(shippingMethod.cost_per_item);
  const baseCost = toNumber(shippingMethod.cost);
  const effectiveWeight = Math.max(metrics.totalWeight, minWeight);
  let totalCost = 0;

  if (baseCost) {
    totalCost += baseCost;
  }

  if (methodType === "per_weight" || perKgRate > 0) {
    totalCost += roundCurrency(effectiveWeight * perKgRate);
  }

  if (methodType === "per_item" || perItemRate > 0) {
    totalCost += roundCurrency(metrics.totalItems * perItemRate);
  }

  const classCostsConfig = parseJsonField<Record<string, any>>(
    shippingMethod.class_costs,
    {}
  );
  Object.entries(metrics.classTotals).forEach(([classId, data]) => {
    if (classId === DEFAULT_CLASS_KEY) return;
    const cls = shippingClassesMap[classId];
    let classCost = 0;
    if (cls) {
      classCost += toNumber(cls.extra_cost);
      classCost += data.weight * toNumber(cls.extra_cost_per_kg);
      classCost += toNumber(cls.handling_fee);
    }
    if (classCostsConfig[classId]) {
      classCost += toNumber(classCostsConfig[classId].extra_cost);
      classCost += data.weight * toNumber(classCostsConfig[classId].extra_cost_per_kg);
      classCost += toNumber(classCostsConfig[classId].handling_fee);
    }
    if (classCost) {
      totalCost += roundCurrency(classCost);
    }
  });

  if (shippingMethod.includes_insurance && toNumber(shippingMethod.insurance_cost) > 0) {
    totalCost += roundCurrency(toNumber(shippingMethod.insurance_cost));
  }

  const freeThreshold = toNumber(shippingMethod.free_shipping_threshold);
  if (freeThreshold && orderSubtotal >= freeThreshold) {
    return {
      totalCost: 0,
      totalWeight: metrics.totalWeight,
      freeShipping: true,
    };
  }

  return {
    totalCost: roundCurrency(totalCost),
    totalWeight: metrics.totalWeight,
    freeShipping: false,
  };
};

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

    const productIds = Array.from(
      new Set(body.items.map((item) => item.product_id).filter(Boolean))
    );

    let productsMap: Record<string, ProductShippingInfo> = {};
    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("shop_products")
        .select("id, weight, shipping_class_id, is_virtual")
        .in("id", productIds);

      if (productsData) {
        productsMap = productsData.reduce((acc, product) => {
          acc[product.id] = product;
          return acc;
        }, {} as Record<string, ProductShippingInfo>);
      }
    }

    const shippingMetrics = calculateShippingMetrics(body.items, productsMap);

    let shippingQuote: ShippingQuote | null = null;
    let shippingMethodRecord: any = null;
    if (body.shipping_method_id) {
      const { data: shippingMethod } = await supabase
        .from("shop_shipping_methods")
        .select("*, zone:shop_shipping_zones(*)")
        .eq("id", body.shipping_method_id)
        .single();

      if (!shippingMethod) {
        return new Response(
          JSON.stringify({ error: "Shipping method not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      shippingMethodRecord = shippingMethod;

      const { data: shippingClasses } = await supabase
        .from("shop_shipping_classes")
        .select("id, extra_cost, extra_cost_per_kg, handling_fee");

      const shippingClassesMap = (shippingClasses || []).reduce((acc, cls) => {
        acc[cls.id] = cls;
        return acc;
      }, {} as Record<string, any>);

      shippingQuote = calculateShippingCost(
        shippingMethod,
        shippingMetrics,
        subtotal,
        shippingClassesMap
      );

      if (shippingQuote.error) {
        const message =
          shippingQuote.error === "over_max_weight"
            ? `Package exceeds maximum allowed weight (${shippingQuote.limit} kg) for this shipping method`
            : "Shipping method unavailable for this order";
        return new Response(
          JSON.stringify({ error: message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      shippingCost = shippingQuote.totalCost;

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
        shipping_method_name: shippingMethodRecord?.name || null,
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
