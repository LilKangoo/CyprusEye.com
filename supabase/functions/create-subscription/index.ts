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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubscriptionRequest {
  user_id: string;
  product_id: string;
  variant_id?: string;
  stripe_price_id: string;
  success_url: string;
  cancel_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: SubscriptionRequest = await req.json();

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

    const { data: product } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", body.product_id)
      .single();

    if (!product || product.product_type !== "subscription") {
      return new Response(
        JSON.stringify({ error: "Invalid subscription product" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let stripeCustomer: Stripe.Customer;

    const { data: existingSub } = await supabase
      .from("shop_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", body.user_id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    if (existingSub?.stripe_customer_id) {
      stripeCustomer = await stripe.customers.retrieve(existingSub.stripe_customer_id) as Stripe.Customer;
    } else {
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          user_id: body.user_id,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: stripeCustomer.id,
      line_items: [
        {
          price: body.stripe_price_id,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: product.subscription_trial_days || undefined,
        metadata: {
          user_id: body.user_id,
          product_id: body.product_id,
          variant_id: body.variant_id || "",
        },
      },
      success_url: `${body.success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url,
      metadata: {
        user_id: body.user_id,
        product_id: body.product_id,
        type: "subscription",
      },
    });

    return new Response(
      JSON.stringify({
        session_id: session.id,
        session_url: session.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Subscription checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
