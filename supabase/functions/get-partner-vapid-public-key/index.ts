import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FALLBACK_ADMIN_USER_ID = "15f3d442-092d-4eb8-9627-db90da0283eb";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function isUserAdmin(params: { userId: string }): Promise<boolean> {
  if (!params.userId) return false;
  if (params.userId === FALLBACK_ADMIN_USER_ID) return true;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", params.userId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to read profiles.is_admin", { message: error.message });
    return false;
  }

  return Boolean((data as any)?.is_admin);
}

async function hasPartnerMembership(params: { userId: string }): Promise<boolean> {
  if (!params.userId) return false;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from("partner_users")
    .select("id")
    .eq("user_id", params.userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Failed to read partner_users", { message: error.message });
    return false;
  }

  return Boolean(data);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = data.user.id;
  const ok = (await hasPartnerMembership({ userId })) || (await isUserAdmin({ userId }));
  if (!ok) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const publicKey = (Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "Missing VAPID_PUBLIC_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ publicKey }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
