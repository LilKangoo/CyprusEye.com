import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHECKOUT_FUNCTION_VERSION = "2025-12-22-9";
const isDebugEnabled = (): boolean => Deno.env.get("CHECKOUT_DEBUG") === "true";

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

interface ResolvedItem extends CartItem {
  unit_price_base: number;
  unit_price_gross: number;
  tax_class_id: string | null;
  tax_class: string | null;
  tax_rate: number;
  tax_price_mode: string;
}

type VariantShippingInfo = {
  id: string;
  weight: number | null;
};

interface ShippingMetrics {
  totalItems: number;
  totalWeight: number;
  subtotal: number;
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

const DEFAULT_CLASS_KEY = "__no_class__";

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const roundCurrency = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const allocateProportionalDiscount = (amount: number, weights: number[]): number[] => {
  const safeAmount = roundCurrency(Math.max(0, toNumber(amount)));
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, toNumber(w)), 0);
  if (!safeAmount || !totalWeight) {
    return weights.map(() => 0);
  }

  const allocations = weights.map((w) => {
    const weight = Math.max(0, toNumber(w));
    if (!weight) return 0;
    return roundCurrency((safeAmount * weight) / totalWeight);
  });

  const allocatedSum = roundCurrency(allocations.reduce((sum, v) => sum + v, 0));
  const diff = roundCurrency(safeAmount - allocatedSum);
  if (diff !== 0) {
    for (let i = allocations.length - 1; i >= 0; i -= 1) {
      if (Math.max(0, toNumber(weights[i])) > 0) {
        allocations[i] = roundCurrency(Math.max(0, allocations[i] + diff));
        break;
      }
    }
  }

  return allocations;
};

const computeDiscountEligibility = (
  discount: any,
  resolvedItems: ResolvedItem[],
  productsMap: Record<string, ProductRecord>,
  nowIso: string
): { eligibleSubtotal: number; eligibleMask: boolean[] } => {
  let appliesTo = String(discount?.applies_to || "all");
  const applicableProductIds = Array.isArray(discount?.applicable_product_ids)
    ? discount.applicable_product_ids
    : [];
  const applicableCategoryIds = Array.isArray(discount?.applicable_category_ids)
    ? discount.applicable_category_ids
    : [];
  const applicableVendorIds = Array.isArray(discount?.applicable_vendor_ids)
    ? discount.applicable_vendor_ids
    : [];
  if (appliesTo === "products" && applicableProductIds.length === 0) appliesTo = "all";
  if (appliesTo === "categories" && applicableCategoryIds.length === 0) appliesTo = "all";
  if (appliesTo === "vendors" && applicableVendorIds.length === 0) appliesTo = "all";
  const excludeProductIds = Array.isArray(discount?.exclude_product_ids)
    ? discount.exclude_product_ids
    : [];
  const excludeCategoryIds = Array.isArray(discount?.exclude_category_ids)
    ? discount.exclude_category_ids
    : [];

  const eligibleMask = resolvedItems.map(() => false);
  let eligibleSubtotal = 0;

  resolvedItems.forEach((item, idx) => {
    const p = productsMap[item.product_id];
    if (!p) return;
    if (excludeProductIds.includes(p.id)) return;
    if (p.category_id && excludeCategoryIds.includes(p.category_id)) return;

    if (discount?.exclude_sale_items === true) {
      const saleItem = (() => {
        if (!p.sale_price) return false;
        if (!p.sale_start_date && !p.sale_end_date) return true;
        if (p.sale_start_date && nowIso < p.sale_start_date) return false;
        if (p.sale_end_date && nowIso >= p.sale_end_date) return false;
        return true;
      })();
      if (saleItem) return;
    }

    let eligible = true;
    if (appliesTo === "products") {
      eligible = applicableProductIds.includes(p.id);
    } else if (appliesTo === "categories") {
      eligible = !!p.category_id && applicableCategoryIds.includes(p.category_id);
    } else if (appliesTo === "vendors") {
      eligible = !!p.vendor_id && applicableVendorIds.includes(p.vendor_id);
    }

    if (!eligible) return;
    eligibleMask[idx] = true;
    eligibleSubtotal += (toNumber(item.unit_price_gross) || 0) * (toNumber(item.quantity) || 0);
  });

  return {
    eligibleSubtotal: roundCurrency(eligibleSubtotal),
    eligibleMask,
  };
};

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

const normalizeClassKey = (classId?: string | null): string =>
  classId && typeof classId === "string" && classId.trim()
    ? classId
    : DEFAULT_CLASS_KEY;

const mergeShippingMetrics = (
  serverMetrics: ShippingMetrics,
  requestMetrics?: ShippingMetrics | null
): ShippingMetrics => {
  if (!requestMetrics) {
    return serverMetrics;
  }

  const mergedClassTotals: Record<string, { quantity: number; weight: number }> =
    {};

  // Start with server metrics
  Object.entries(serverMetrics.classTotals || {}).forEach(([classId, data]) => {
    mergedClassTotals[classId] = {
      quantity: toNumber(data.quantity),
      weight: toNumber(data.weight),
    };
  });

  // Merge in client metrics, taking the max to avoid undercharging
  Object.entries(requestMetrics.classTotals || {}).forEach(([classId, data]) => {
    const key = normalizeClassKey(classId);
    if (!mergedClassTotals[key]) {
      mergedClassTotals[key] = { quantity: 0, weight: 0 };
    }
    mergedClassTotals[key].quantity = Math.max(
      mergedClassTotals[key].quantity,
      toNumber((data as any)?.quantity)
    );
    mergedClassTotals[key].weight = Math.max(
      mergedClassTotals[key].weight,
      toNumber((data as any)?.weight)
    );
  });

  return {
    totalItems: Math.max(
      toNumber(serverMetrics.totalItems),
      toNumber(requestMetrics.totalItems)
    ),
    totalWeight: Math.max(
      toNumber(serverMetrics.totalWeight),
      toNumber(requestMetrics.totalWeight)
    ),
    subtotal: Math.max(
      toNumber(serverMetrics.subtotal),
      toNumber(requestMetrics.subtotal)
    ),
    classTotals: mergedClassTotals,
  };
};

type ProductShippingInfo = {
  id: string;
  weight: number | null;
  shipping_class_id: string | null;
  is_virtual: boolean | null;
};

type ProductRecord = ProductShippingInfo & {
  name: string;
  status: string;
  product_type: string;
  vendor_id: string | null;
  category_id: string | null;
  price: number;
  sale_price: number | null;
  sale_start_date: string | null;
  sale_end_date: string | null;
  tax_class_id: string | null;
  tax_price_mode?: string | null;
  track_inventory: boolean | null;
  stock_quantity: number | null;
  allow_backorder: boolean | null;
  min_purchase_quantity: number | null;
  max_purchase_quantity: number | null;
};

type VariantRecord = VariantShippingInfo & {
  product_id: string;
  name: string | null;
  price: number | null;
  stock_quantity: number | null;
  is_active: boolean | null;
};

const calculateShippingMetrics = (
  items: CartItem[],
  productsMap: Record<string, ProductShippingInfo>,
  variantsMap: Record<string, VariantShippingInfo>
): ShippingMetrics => {
  const metrics: ShippingMetrics = {
    totalItems: 0,
    totalWeight: 0,
    subtotal: 0,
    classTotals: {},
  };

  for (const item of items) {
    const product = productsMap[item.product_id];
    const variant = item.variant_id ? variantsMap[item.variant_id] : undefined;
    const requiresShipping = product
      ? product.is_virtual === true
        ? false
        : true
      : item.requires_shipping === false
        ? false
        : true;
    if (!requiresShipping) continue;

    const itemWeight = Math.max(
      toNumber(variant?.weight),
      toNumber(product?.weight),
      toNumber(item.weight)
    );
    const classId = product?.shipping_class_id ?? item.shipping_class_id ?? null;
    const qty = item.quantity || 0;

    metrics.totalItems += qty;
    metrics.totalWeight += itemWeight * qty;
    metrics.subtotal += (item.unit_price || 0) * qty;

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
  const subtotalForThreshold =
    typeof metrics.subtotal === "number" ? metrics.subtotal : orderSubtotal;
  if (freeThreshold && subtotalForThreshold >= freeThreshold) {
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

  let stage = "init";
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    stage = "parse_body";
    const body: CheckoutRequest = await req.json();

    stage = "auth";
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const authedUser = authData?.user;

    if (authError || !authedUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.user_id || authedUser.id !== body.user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const debug = isDebugEnabled();
    if (debug) {
      console.log("[create-checkout] version:", CHECKOUT_FUNCTION_VERSION);
      console.log("[create-checkout] shipping_method_id:", body.shipping_method_id);
      console.log("[create-checkout] items:", body.items?.length || 0);
      console.log("[create-checkout] client_quote_totalCost:", (body as any)?.shipping_details?.quote?.totalCost);
    }

    stage = "load_profile";
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, email, name")
      .eq("id", authedUser.id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerEmail = user.email || authedUser.email;
    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing customer email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    stage = "order_number";
    const { data: orderNumberRaw } = await supabase.rpc("shop_generate_order_number");
    const orderNumber =
      typeof orderNumberRaw === "string" && orderNumberRaw.trim()
        ? orderNumberRaw
        : `WC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    let subtotal = 0;
    let shippingCost = 0;
    let discountAmount = 0;
    let discountId: string | null = null;
    let appliedDiscountCode: string | null = null;

    let discountEligibleMask: boolean[] = [];

    let taxEnabled = false;
    let taxIncludedInPriceGlobal = true;
    let taxBasedOn: string = "shipping";
    let taxCountry: string = "";
    const taxRatesByClass: Record<string, { rate: number; name: string | null }> = {};
    const taxClassLabelById: Record<string, string> = {};

    const productIds = Array.from(new Set(body.items.map((item) => item.product_id).filter(Boolean)));
    const variantIds = Array.from(new Set(body.items.map((item) => item.variant_id).filter(Boolean))) as string[];

    stage = "load_products";
    const productsSelectBase =
      "id, name, status, product_type, vendor_id, category_id, price, sale_price, sale_start_date, sale_end_date, tax_class_id, track_inventory, stock_quantity, allow_backorder, min_purchase_quantity, max_purchase_quantity, weight, shipping_class_id, is_virtual";
    const productsSelectWithTaxMode = `${productsSelectBase}, tax_price_mode`;

    let productsData: ProductRecord[] | null = null;
    let productsError: any = null;
    {
      const primary = await supabase
        .from("shop_products")
        .select(productsSelectWithTaxMode)
        .in("id", productIds);
      productsData = primary.data as any;
      productsError = primary.error as any;

      const productsErrorCode = productsError?.code;
      const productsErrorMessage = productsError?.message;
      const shouldRetryWithoutTaxMode =
        !!productsError &&
        (
          productsErrorCode === "42703" ||
          productsErrorCode === "PGRST204" ||
          (typeof productsErrorMessage === "string" &&
            productsErrorMessage.includes("tax_price_mode"))
        );
      if (shouldRetryWithoutTaxMode) {
        const retry = await supabase
          .from("shop_products")
          .select(productsSelectBase)
          .in("id", productIds);
        productsData = retry.data as any;
        productsError = retry.error as any;
      }
    }

    if (productsError) {
      return new Response(
        JSON.stringify({
          error: "Failed to load products",
          function_version: CHECKOUT_FUNCTION_VERSION,
          stage,
          supabase_error: {
            message: productsError.message,
            details: (productsError as any).details,
            hint: (productsError as any).hint,
            code: (productsError as any).code,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productsMap: Record<string, ProductRecord> = (productsData || []).reduce(
      (acc: Record<string, ProductRecord>, p: ProductRecord) => {
        acc[p.id] = p;
        return acc;
      },
      {} as Record<string, ProductRecord>
    );

    stage = "tax_settings";
    {
      const { data: settings, error: settingsError } = await supabase
        .from("shop_settings")
        .select("tax_enabled, tax_included_in_price, tax_based_on")
        .eq("id", 1)
        .single();

      if (settingsError && (settingsError as any)?.code !== "PGRST116") {
        return new Response(
          JSON.stringify({ error: "Failed to load tax settings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      taxEnabled = settings?.tax_enabled === true;
      taxIncludedInPriceGlobal = settings?.tax_included_in_price !== false;
      taxBasedOn = typeof settings?.tax_based_on === "string" && settings.tax_based_on
        ? settings.tax_based_on
        : "shipping";

      const billingAddress = body.billing_address || body.shipping_address;
      const rawCountry = taxBasedOn === "billing"
        ? billingAddress?.country
        : body.shipping_address?.country;
      taxCountry = String(rawCountry || "").toUpperCase();
    }

    if (taxEnabled && taxCountry) {
      stage = "tax_rates";
      const classIds = Array.from(
        new Set(
          (productsData || [])
            .map((p) => p.tax_class_id)
            .filter(Boolean)
        )
      ) as string[];

      if (classIds.length > 0) {
        const { data: taxRates } = await supabase
          .from("shop_tax_rates")
          .select("tax_class_id, rate, name, priority")
          .in("tax_class_id", classIds)
          .eq("country", taxCountry)
          .order("priority", { ascending: true });

        (taxRates || []).forEach((row: any) => {
          const classId = String(row.tax_class_id || "");
          if (!classId || taxRatesByClass[classId]) return;
          const rawRate = Math.max(0, toNumber(row.rate));
          const normalizedRate = rawRate > 1 ? rawRate / 100 : rawRate;
          taxRatesByClass[classId] = {
            rate: normalizedRate,
            name: row.name ? String(row.name) : null,
          };
        });

        const { data: taxClasses } = await supabase
          .from("shop_tax_classes")
          .select("id, slug, name")
          .in("id", classIds);
        (taxClasses || []).forEach((row: any) => {
          const classId = String(row.id || "");
          if (!classId) return;
          const label = row.slug ? String(row.slug) : row.name ? String(row.name) : classId;
          taxClassLabelById[classId] = label;
        });
      }
    }

    let variantsMap: Record<string, VariantRecord> = {};
    if (variantIds.length > 0) {
      stage = "load_variants";
      const { data: variantsData, error: variantsError } = await supabase
        .from("shop_product_variants")
        .select("id, product_id, name, price, weight, stock_quantity, is_active")
        .in("id", variantIds);

      if (variantsError) {
        return new Response(
          JSON.stringify({
            error: "Failed to load variants",
            function_version: CHECKOUT_FUNCTION_VERSION,
            stage,
            supabase_error: {
              message: variantsError.message,
              details: (variantsError as any).details,
              hint: (variantsError as any).hint,
              code: (variantsError as any).code,
            },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      variantsMap = (variantsData || []).reduce(
        (acc: Record<string, VariantRecord>, v: VariantRecord) => {
          acc[v.id] = v;
          return acc;
        },
        {} as Record<string, VariantRecord>
      );
    }

    let hasSubscription = false;
    let hasNonSubscription = false;

    const resolvedItems: ResolvedItem[] = [];
    const productLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    stage = "resolve_items";
    const nowIso = new Date().toISOString();
    for (const item of body.items) {
      const quantity = Math.max(0, Math.trunc(toNumber(item.quantity)));
      if (!item.product_id || quantity <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid cart item" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const product = productsMap[item.product_id];
      if (!product) {
        return new Response(
          JSON.stringify({ error: "Product not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.status !== "active") {
        return new Response(
          JSON.stringify({ error: "Product not available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.product_type === "subscription") {
        hasSubscription = true;
      } else {
        hasNonSubscription = true;
      }

      if (hasSubscription && hasNonSubscription) {
        return new Response(
          JSON.stringify({ error: "Subscription items must be purchased separately" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (product.product_type === "subscription") {
        return new Response(
          JSON.stringify({ error: "Subscription items must be purchased via subscription checkout" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const minQty = Math.max(1, Math.trunc(toNumber(product.min_purchase_quantity || 1)));
      const maxQty = product.max_purchase_quantity ? Math.trunc(toNumber(product.max_purchase_quantity)) : null;
      if (quantity < minQty) {
        return new Response(
          JSON.stringify({ error: "Quantity below minimum" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (maxQty && quantity > maxQty) {
        return new Response(
          JSON.stringify({ error: "Quantity above maximum" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let variant: VariantRecord | null = null;
      if (item.variant_id) {
        const v = variantsMap[item.variant_id];
        if (!v || v.product_id !== product.id || v.is_active === false) {
          return new Response(
            JSON.stringify({ error: "Variant not available" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        variant = v;
      }

      if (product.track_inventory) {
        const availableStock = variant
          ? Math.trunc(toNumber(variant.stock_quantity))
          : Math.trunc(toNumber(product.stock_quantity));
        const allowBackorder = product.allow_backorder === true;
        if (!allowBackorder && quantity > availableStock) {
          return new Response(
            JSON.stringify({ error: "Insufficient stock" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const inSaleWindow = (() => {
        if (!product.sale_price) return false;
        if (!product.sale_start_date && !product.sale_end_date) return true;
        if (product.sale_start_date && nowIso < product.sale_start_date) return false;
        if (product.sale_end_date && nowIso >= product.sale_end_date) return false;
        return true;
      })();

      const baseProductPrice = inSaleWindow && product.sale_price !== null
        ? toNumber(product.sale_price)
        : toNumber(product.price);

      const unitPrice = variant && variant.price !== null
        ? toNumber(variant.price)
        : baseProductPrice;

      const resolvedProductName = product.name;
      const resolvedVariantName = variant?.name || null;

      const resolvedWeight = Math.max(
        toNumber(variant?.weight),
        toNumber(product.weight),
        toNumber(item.weight)
      );

      const resolvedShippingClassId = product.shipping_class_id ?? item.shipping_class_id ?? null;
      const requiresShipping = product.is_virtual === true ? false : true;

      const taxClassId = product.tax_class_id ? String(product.tax_class_id) : null;
      const taxRate = taxEnabled && taxClassId && taxRatesByClass[taxClassId]
        ? Math.max(0, toNumber(taxRatesByClass[taxClassId].rate))
        : 0;
      const productTaxModeRaw =
        typeof (product as any).tax_price_mode === "string" && String((product as any).tax_price_mode).trim()
          ? String((product as any).tax_price_mode).trim()
          : "inherit";
      const productTaxMode = ["inherit", "net", "gross"].includes(productTaxModeRaw)
        ? productTaxModeRaw
        : "inherit";
      const treatAsGross = productTaxMode === "gross"
        ? true
        : productTaxMode === "net"
          ? false
          : taxIncludedInPriceGlobal;

      const unitPriceGross =
        taxEnabled && taxRate > 0 && !treatAsGross
          ? roundCurrency(unitPrice * (1 + taxRate))
          : unitPrice;

      resolvedItems.push({
        product_id: product.id,
        variant_id: variant?.id,
        quantity,
        product_name: resolvedProductName,
        variant_name: resolvedVariantName || undefined,
        unit_price: unitPriceGross,
        image_url: item.image_url,
        weight: resolvedWeight,
        shipping_class_id: resolvedShippingClassId,
        requires_shipping: requiresShipping,
        unit_price_base: unitPrice,
        unit_price_gross: unitPriceGross,
        tax_class_id: taxClassId,
        tax_class: taxClassId ? (taxClassLabelById[taxClassId] || taxClassId) : null,
        tax_rate: taxRate,
        tax_price_mode: productTaxMode,
      });

      subtotal += unitPriceGross * quantity;

      productLineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: resolvedVariantName
              ? `${resolvedProductName} - ${resolvedVariantName}`
              : resolvedProductName,
            images: item.image_url ? [item.image_url] : undefined,
          },
          unit_amount: Math.round(unitPriceGross * 100),
        },
        quantity,
      });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [...productLineItems];

    const productsShippingMap: Record<string, ProductShippingInfo> = Object.values(productsMap).reduce(
      (acc: Record<string, ProductShippingInfo>, p: ProductRecord) => {
        acc[p.id] = {
          id: p.id,
          weight: p.weight,
          shipping_class_id: p.shipping_class_id,
          is_virtual: p.is_virtual,
        };
        return acc;
      },
      {} as Record<string, ProductShippingInfo>
    );

    const variantsShippingMap: Record<string, VariantShippingInfo> = Object.values(variantsMap).reduce(
      (acc: Record<string, VariantShippingInfo>, v: VariantRecord) => {
        acc[v.id] = {
          id: v.id,
          weight: v.weight,
        };
        return acc;
      },
      {} as Record<string, VariantShippingInfo>
    );

    stage = "shipping_metrics";
    const shippingMetrics = calculateShippingMetrics(resolvedItems, productsShippingMap, variantsShippingMap);
    const mergedShippingMetrics = mergeShippingMetrics(
      shippingMetrics,
      body.shipping_details?.metrics
    );

    const clientQuote = body.shipping_details?.quote || null;
    const clientQuoteCost =
      clientQuote && typeof clientQuote === "object"
        ? roundCurrency(
            toNumber(
              (clientQuote as any).totalCost ??
                (clientQuote as any).total_cost ??
                0
            )
          )
        : null;

    let shippingQuote: ShippingQuote | null = null;
    let shippingMethodRecord: any = null;
    let serverShippingCost: number | null = null;
    const shippingRequired = shippingMetrics.totalItems > 0;

    if (shippingRequired && !body.shipping_method_id) {
      return new Response(
        JSON.stringify({ error: "Shipping method required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (shippingRequired && body.shipping_method_id) {
      stage = "shipping_method";
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

      if (shippingMethod.is_active === false || shippingMethod.zone?.is_active === false) {
        return new Response(
          JSON.stringify({ error: "Shipping method unavailable" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shipCountry = String(body.shipping_address?.country || "").toUpperCase();
      const zoneCountries: string[] = Array.isArray(shippingMethod.zone?.countries)
        ? shippingMethod.zone.countries
        : [];
      const zoneAllowsCountry = zoneCountries.includes("*") || zoneCountries.some((c) => String(c).toUpperCase() === shipCountry);
      if (!zoneAllowsCountry) {
        return new Response(
          JSON.stringify({ error: "Shipping method unavailable for this country" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: shippingClasses } = await supabase
        .from("shop_shipping_classes")
        .select("id, extra_cost, extra_cost_per_kg, handling_fee");

      const shippingClassesMap = (shippingClasses || []).reduce((acc, cls) => {
        acc[cls.id] = cls;
        return acc;
      }, {} as Record<string, any>);

      shippingQuote = calculateShippingCost(
        shippingMethod,
        mergedShippingMetrics,
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

      serverShippingCost = shippingQuote.totalCost;
      shippingCost = serverShippingCost > 0 ? serverShippingCost : 0;

      if (debug) {
        console.log("[create-checkout] metrics.server:", shippingMetrics);
        console.log("[create-checkout] metrics.merged:", mergedShippingMetrics);
        console.log("[create-checkout] shipping.server_cost:", serverShippingCost);
        console.log("[create-checkout] shipping.client_cost:", clientQuoteCost);
        console.log("[create-checkout] shipping.final_cost:", shippingCost);
      }

    }

    let stripeDiscounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];

    if (body.discount_code) {
      stage = "discount";
      const discountCodeInput = String(body.discount_code || "").trim();
      const { data: discountRows } = await supabase
        .from("shop_discounts")
        .select("*")
        .ilike("code", discountCodeInput)
        .eq("is_active", true)
        .limit(1);

      const discount = Array.isArray(discountRows) ? discountRows[0] : null;

      if (discount) {
        const now = new Date();
        const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
        const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

        if ((!startsAt || now >= startsAt) && (!expiresAt || now < expiresAt)) {
          if (!discount.usage_limit || discount.usage_count < discount.usage_limit) {
            const minOrderAmount = toNumber(discount.minimum_order_amount);
            const maxOrderAmount = toNumber(discount.maximum_order_amount);
            if (minOrderAmount > 0 && subtotal < minOrderAmount) {
              // not eligible
            } else if (maxOrderAmount > 0 && subtotal > maxOrderAmount) {
              // not eligible
            } else {
              const allowedUsers = Array.isArray(discount.user_ids) ? discount.user_ids : [];
              if (allowedUsers.length > 0 && !allowedUsers.includes(body.user_id)) {
                // not eligible
              } else {
                if (discount.first_purchase_only === true) {
                  stage = "discount_first_purchase";
                  const prevOrders = await supabase
                    .from("shop_orders")
                    .select("id")
                    .eq("user_id", body.user_id)
                    .in("payment_status", ["paid", "partially_refunded", "refunded"])
                    .limit(1);
                  if (prevOrders.data && prevOrders.data.length > 0) {
                    // not eligible
                  } else {
                    // continue
                  }
                  if (prevOrders.data && prevOrders.data.length > 0) {
                    // stop
                  } else {
                    // continue
                    const perUserLimit = Math.max(0, Math.trunc(toNumber(discount.usage_limit_per_user || 0)));
                    if (perUserLimit > 0) {
                      stage = "discount_usage_user";
                      const usage = await supabase
                        .from("shop_discount_usage")
                        .select("id", { count: "exact", head: true })
                        .eq("discount_id", discount.id)
                        .eq("user_id", body.user_id);
                      const usedCount = typeof usage.count === "number" ? usage.count : 0;
                      if (usedCount >= perUserLimit) {
                        // not eligible
                      } else {
                        // continue
                        const eligibility = computeDiscountEligibility(
                          discount,
                          resolvedItems,
                          productsMap,
                          nowIso
                        );
                        const eligibleSubtotal = eligibility.eligibleSubtotal;
                        discountEligibleMask = eligibility.eligibleMask;

                        const type = String(discount.discount_type || "percentage");
                        if (type === "free_shipping") {
                          appliedDiscountCode = discount.code;
                          discountId = discount.id;
                          discountAmount = 0;
                          shippingCost = 0;
                        } else if (eligibleSubtotal > 0) {
                          if (type === "percentage") {
                            discountAmount = (eligibleSubtotal * toNumber(discount.discount_value)) / 100;
                          } else {
                            discountAmount = Math.min(toNumber(discount.discount_value), eligibleSubtotal);
                          }

                          if (discount.maximum_discount_amount) {
                            discountAmount = Math.min(discountAmount, toNumber(discount.maximum_discount_amount));
                          }

                          discountAmount = roundCurrency(Math.max(0, discountAmount));
                          if (discountAmount < 0.01) {
                            discountAmount = 0;
                          }

                          if (discountAmount >= 0.01) {
                            appliedDiscountCode = discount.code;
                            discountId = discount.id;
                            if (discount.stripe_promotion_code_id) {
                              stripeDiscounts = [{ promotion_code: discount.stripe_promotion_code_id }];
                            } else if (discount.stripe_coupon_id) {
                              stripeDiscounts = [{ coupon: discount.stripe_coupon_id }];
                            } else {
                              stage = "discount_create_coupon";
                              const coupon = await stripe.coupons.create({
                                duration: "once",
                                currency: "eur",
                                amount_off: Math.round(discountAmount * 100),
                                max_redemptions: 1,
                                name: `${discount.code}-${orderNumber}`,
                                metadata: {
                                  discount_id: discount.id,
                                  discount_code: discount.code,
                                  user_id: body.user_id,
                                },
                              });
                              stripeDiscounts = [{ coupon: coupon.id }];
                            }
                          }
                        }
                      }
                    } else {
                      const eligibility = computeDiscountEligibility(
                        discount,
                        resolvedItems,
                        productsMap,
                        nowIso
                      );
                      const eligibleSubtotal = eligibility.eligibleSubtotal;
                      discountEligibleMask = eligibility.eligibleMask;

                      const type = String(discount.discount_type || "percentage");
                      if (type === "free_shipping") {
                        appliedDiscountCode = discount.code;
                        discountId = discount.id;
                        discountAmount = 0;
                        shippingCost = 0;
                      } else if (eligibleSubtotal > 0) {
                        if (type === "percentage") {
                          discountAmount = (eligibleSubtotal * toNumber(discount.discount_value)) / 100;
                        } else {
                          discountAmount = Math.min(toNumber(discount.discount_value), eligibleSubtotal);
                        }

                        if (discount.maximum_discount_amount) {
                          discountAmount = Math.min(discountAmount, toNumber(discount.maximum_discount_amount));
                        }

                        discountAmount = roundCurrency(Math.max(0, discountAmount));
                        if (discountAmount < 0.01) {
                          discountAmount = 0;
                        }

                        if (discountAmount >= 0.01) {
                          appliedDiscountCode = discount.code;
                          discountId = discount.id;
                          if (discount.stripe_promotion_code_id) {
                            stripeDiscounts = [{ promotion_code: discount.stripe_promotion_code_id }];
                          } else if (discount.stripe_coupon_id) {
                            stripeDiscounts = [{ coupon: discount.stripe_coupon_id }];
                          } else {
                            stage = "discount_create_coupon";
                            const coupon = await stripe.coupons.create({
                              duration: "once",
                              currency: "eur",
                              amount_off: Math.round(discountAmount * 100),
                              max_redemptions: 1,
                              name: `${discount.code}-${orderNumber}`,
                              metadata: {
                                discount_id: discount.id,
                                discount_code: discount.code,
                                user_id: body.user_id,
                              },
                            });
                            stripeDiscounts = [{ coupon: coupon.id }];
                          }
                        }
                      }
                    }
                  }
                } else {
                  const perUserLimit = Math.max(0, Math.trunc(toNumber(discount.usage_limit_per_user || 0)));
                  if (perUserLimit > 0) {
                    stage = "discount_usage_user";
                    const usage = await supabase
                      .from("shop_discount_usage")
                      .select("id", { count: "exact", head: true })
                      .eq("discount_id", discount.id)
                      .eq("user_id", body.user_id);
                    const usedCount = typeof usage.count === "number" ? usage.count : 0;
                    if (usedCount >= perUserLimit) {
                      // not eligible
                    } else {
                      // continue
                    }
                    if (usedCount >= perUserLimit) {
                      // stop
                    } else {
                      const eligibility = computeDiscountEligibility(
                        discount,
                        resolvedItems,
                        productsMap,
                        nowIso
                      );
                      const eligibleSubtotal = eligibility.eligibleSubtotal;
                      discountEligibleMask = eligibility.eligibleMask;

                      const type = String(discount.discount_type || "percentage");
                      if (type === "free_shipping") {
                        appliedDiscountCode = discount.code;
                        discountId = discount.id;
                        discountAmount = 0;
                        shippingCost = 0;
                      } else if (eligibleSubtotal > 0) {
                        if (type === "percentage") {
                          discountAmount = (eligibleSubtotal * toNumber(discount.discount_value)) / 100;
                        } else {
                          discountAmount = Math.min(toNumber(discount.discount_value), eligibleSubtotal);
                        }

                        if (discount.maximum_discount_amount) {
                          discountAmount = Math.min(discountAmount, toNumber(discount.maximum_discount_amount));
                        }

                        discountAmount = roundCurrency(Math.max(0, discountAmount));
                        if (discountAmount < 0.01) {
                          discountAmount = 0;
                        }

                        if (discountAmount >= 0.01) {
                          appliedDiscountCode = discount.code;
                          discountId = discount.id;
                          if (discount.stripe_promotion_code_id) {
                            stripeDiscounts = [{ promotion_code: discount.stripe_promotion_code_id }];
                          } else if (discount.stripe_coupon_id) {
                            stripeDiscounts = [{ coupon: discount.stripe_coupon_id }];
                          } else {
                            stage = "discount_create_coupon";
                            const coupon = await stripe.coupons.create({
                              duration: "once",
                              currency: "eur",
                              amount_off: Math.round(discountAmount * 100),
                              max_redemptions: 1,
                              name: `${discount.code}-${orderNumber}`,
                              metadata: {
                                discount_id: discount.id,
                                discount_code: discount.code,
                                user_id: body.user_id,
                              },
                            });
                            stripeDiscounts = [{ coupon: coupon.id }];
                          }
                        }
                      }
                    }
                  } else {
                    const eligibility = computeDiscountEligibility(
                      discount,
                      resolvedItems,
                      productsMap,
                      nowIso
                    );
                    const eligibleSubtotal = eligibility.eligibleSubtotal;
                    discountEligibleMask = eligibility.eligibleMask;

                    const type = String(discount.discount_type || "percentage");
                    if (type === "free_shipping") {
                      appliedDiscountCode = discount.code;
                      discountId = discount.id;
                      discountAmount = 0;
                      shippingCost = 0;
                    } else if (eligibleSubtotal > 0) {
                      if (type === "percentage") {
                        discountAmount = (eligibleSubtotal * toNumber(discount.discount_value)) / 100;
                      } else {
                        discountAmount = Math.min(toNumber(discount.discount_value), eligibleSubtotal);
                      }

                      if (discount.maximum_discount_amount) {
                        discountAmount = Math.min(discountAmount, toNumber(discount.maximum_discount_amount));
                      }

                      discountAmount = roundCurrency(Math.max(0, discountAmount));
                      if (discountAmount < 0.01) {
                        discountAmount = 0;
                      }

                      if (discountAmount >= 0.01) {
                        appliedDiscountCode = discount.code;
                        discountId = discount.id;
                        if (discount.stripe_promotion_code_id) {
                          stripeDiscounts = [{ promotion_code: discount.stripe_promotion_code_id }];
                        } else if (discount.stripe_coupon_id) {
                          stripeDiscounts = [{ coupon: discount.stripe_coupon_id }];
                        } else {
                          stage = "discount_create_coupon";
                          const coupon = await stripe.coupons.create({
                            duration: "once",
                            currency: "eur",
                            amount_off: Math.round(discountAmount * 100),
                            max_redemptions: 1,
                            name: `${discount.code}-${orderNumber}`,
                            metadata: {
                              discount_id: discount.id,
                              discount_code: discount.code,
                              user_id: body.user_id,
                            },
                          });
                          stripeDiscounts = [{ coupon: coupon.id }];
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (shippingRequired && shippingMethodRecord && shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `Shipping: ${shippingMethodRecord.name}`,
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    const originalQuote = clientQuote || shippingQuote || null;
    const storedShippingDetails = {
      metrics: mergedShippingMetrics,
      total_cost: shippingCost,
      ...(originalQuote
        ? { quote: { ...originalQuote, totalCost: shippingCost } }
        : {}),
      ...(shippingQuote ? { server_quote: shippingQuote } : {}),
    };

    stage = "tax_calculation";
    const itemLineTotals = resolvedItems.map((item) =>
      roundCurrency(toNumber(item.unit_price_gross) * toNumber(item.quantity))
    );
    const eligibleWeights = itemLineTotals.map((value, idx) =>
      discountEligibleMask && discountEligibleMask[idx] ? value : 0
    );
    const itemDiscounts = allocateProportionalDiscount(discountAmount, eligibleWeights);

    let taxAmount = 0;
    const taxBreakdownMap: Record<
      string,
      { tax_class: string | null; tax_rate: number; taxable_amount: number; tax_amount: number }
    > = {};

    const computedOrderItems = resolvedItems.map((item, idx) => {
      const lineGross = itemLineTotals[idx] || 0;
      const lineDiscount = itemDiscounts[idx] || 0;
      const discountedGross = roundCurrency(Math.max(0, lineGross - lineDiscount));
      const rate = Math.max(0, toNumber(item.tax_rate));
      const itemTax = taxEnabled && rate > 0
        ? roundCurrency(discountedGross - discountedGross / (1 + rate))
        : 0;
      const itemNet = taxEnabled && rate > 0
        ? roundCurrency(discountedGross / (1 + rate))
        : discountedGross;

      taxAmount += itemTax;

      if (taxEnabled && rate > 0 && itemTax > 0) {
        const key = `${item.tax_class || item.tax_class_id || "__no_class__"}:${rate.toFixed(4)}`;
        if (!taxBreakdownMap[key]) {
          taxBreakdownMap[key] = {
            tax_class: item.tax_class,
            tax_rate: rate,
            taxable_amount: 0,
            tax_amount: 0,
          };
        }
        taxBreakdownMap[key].taxable_amount = roundCurrency(
          taxBreakdownMap[key].taxable_amount + itemNet
        );
        taxBreakdownMap[key].tax_amount = roundCurrency(
          taxBreakdownMap[key].tax_amount + itemTax
        );
      }

      return {
        order_id: "__pending__",
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        product_name: item.product_name,
        variant_name: item.variant_name || null,
        product_image: item.image_url,
        original_price: roundCurrency(toNumber(item.unit_price_base)),
        unit_price: roundCurrency(toNumber(item.unit_price_gross)),
        quantity: item.quantity,
        subtotal: lineGross,
        tax_class: item.tax_class,
        tax_rate: rate,
        tax_amount: itemTax,
      };
    });

    taxAmount = roundCurrency(taxAmount);
    const taxBreakdown = taxEnabled
      ? {
          based_on: taxBasedOn,
          country: taxCountry,
          discount_allocated_to_items: roundCurrency(discountAmount),
          lines: Object.values(taxBreakdownMap),
        }
      : null;

    const total = Math.max(0, roundCurrency(subtotal + shippingCost - discountAmount));

    const billingAddress = body.billing_address || body.shipping_address;

    stage = "insert_order";
    const baseOrderInsert = {
      order_number: orderNumber,
      user_id: body.user_id,
      customer_email: customerEmail,
      customer_name: `${body.shipping_address.first_name} ${body.shipping_address.last_name}`,
      customer_phone: body.shipping_address.phone,
      shipping_address: body.shipping_address,
      billing_address: billingAddress,
      items_subtotal: subtotal,
      subtotal: subtotal,
      shipping_cost: shippingCost,
      shipping_tax: 0,
      tax_amount: taxAmount,
      tax_breakdown: taxBreakdown,
      discount_amount: discountAmount,
      discount_code: appliedDiscountCode,
      discount_id: discountId,
      total: total,
      shipping_method_id: shippingRequired ? body.shipping_method_id : null,
      shipping_method_name: shippingRequired ? (shippingMethodRecord?.name || null) : null,
      shipping_details: storedShippingDetails,
      customer_notes: body.customer_notes,
      status: "pending",
      payment_status: "unpaid",
    };

    let { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .insert(baseOrderInsert)
      .select()
      .single();

    const orderErrorCode = (orderError as any)?.code;
    const orderErrorMessage = (orderError as any)?.message;
    const shouldRetryWithoutShippingDetails =
      !!orderError &&
      (
        orderErrorCode === "42703" ||
        orderErrorCode === "PGRST204" ||
        (typeof orderErrorMessage === "string" && orderErrorMessage.includes("shipping_details"))
      );

    if ((orderError || !order) && shouldRetryWithoutShippingDetails) {
      stage = "insert_order_retry";
      const { shipping_details: _drop, ...withoutShippingDetails } = baseOrderInsert as any;
      const retry = await supabase
        .from("shop_orders")
        .insert(withoutShippingDetails)
        .select()
        .single();
      order = retry.data as any;
      orderError = retry.error as any;
    }

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      return new Response(
        JSON.stringify({
          error: "Failed to create order",
          function_version: CHECKOUT_FUNCTION_VERSION,
          stage,
          supabase_error: orderError
            ? {
                message: orderError.message,
                details: (orderError as any).details,
                hint: (orderError as any).hint,
                code: (orderError as any).code,
              }
            : null,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderItems = computedOrderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    stage = "insert_order_items";
    await supabase.from("shop_order_items").insert(orderItems);

    stage = "insert_order_history";
    await supabase.from("shop_order_history").insert({
      order_id: order.id,
      to_status: "pending",
      note: "Order created, awaiting payment",
    });

    const buildRedirectUrl = (raw: string, extra: Record<string, string>) => {
      try {
        const url = new URL(raw);
        Object.entries(extra).forEach(([k, v]) => {
          if (!v) return;
          url.searchParams.set(k, v);
        });
        return url.toString();
      } catch (e) {
        // Fallback: best-effort string concat
        const hasQuery = raw.includes("?");
        const qp = Object.entries(extra)
          .filter(([_, v]) => Boolean(v))
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");
        if (!qp) return raw;
        return `${raw}${hasQuery ? "&" : "?"}${qp}`;
      }
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: buildRedirectUrl(String(body.success_url || ""), {
        order_id: order.id,
        session_id: "{CHECKOUT_SESSION_ID}",
      }),
      cancel_url: buildRedirectUrl(String(body.cancel_url || ""), {
        order_id: order.id,
      }),
      customer_email: customerEmail,
      client_reference_id: order.id,
      metadata: {
        order_id: order.id,
        order_number: orderNumber,
        user_id: body.user_id,
        function_version: CHECKOUT_FUNCTION_VERSION,
        items_subtotal: String(roundCurrency(subtotal)),
        shipping_cost: String(roundCurrency(shippingCost)),
        discount_amount: String(roundCurrency(discountAmount)),
        discount_code: appliedDiscountCode || "",
        tax_amount: String(roundCurrency(taxAmount)),
        order_total: String(roundCurrency(total)),
      },
      ...(stripeDiscounts.length > 0 && { discounts: stripeDiscounts }),
    };

    stage = "stripe_create_session";
    const session = await stripe.checkout.sessions.create(sessionParams);

    stage = "update_order_session_id";
    await supabase
      .from("shop_orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        function_version: CHECKOUT_FUNCTION_VERSION,
        session_id: session.id,
        session_url: session.url,
        order_id: order.id,
        order_number: orderNumber,
        items_subtotal: subtotal,
        shipping_cost: shippingCost,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        order_total: total,
        ...(debug
          ? {
              debug: {
                subtotal,
                discountAmount,
                shippingCost,
                serverShippingCost,
                clientQuoteCost,
                mergedShippingMetrics,
                taxAmount,
                taxBreakdown,
              },
            }
          : {}),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-function-version": CHECKOUT_FUNCTION_VERSION,
        },
      }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", errorStack);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        function_version: CHECKOUT_FUNCTION_VERSION,
        stage: (typeof stage === "string" ? stage : "unknown"),
        debug_stack: errorStack?.split('\n').slice(0, 5).join('\n')
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
