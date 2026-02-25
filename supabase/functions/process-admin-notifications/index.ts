import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type JobRow = {
  id: string;
  created_at: string;
  updated_at: string;
  category: string;
  event: string;
  record_id: string;
  table_name: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  processed_at: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-notify-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();

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

function computeRetrySeconds(attempts: number): number {
  const a = Number.isFinite(attempts) ? attempts : 1;
  const secs = 60 * Math.pow(2, Math.max(0, a - 1));
  return Math.min(Math.max(10, Math.floor(secs)), 60 * 60);
}

function normalizeApiKey(raw: string | undefined | null): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim().replace(/\s+/g, "");
  }
  return trimmed.replace(/\s+/g, "");
}

function tryParseJson(text: string): any | null {
  const t = String(text || "").trim();
  if (!t) return null;
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch (_e) {
    return null;
  }
}

function isLogicalOk(result: { ok: boolean; status: number; bodyText: string }): boolean {
  if (!result.ok) return false;
  const parsed = tryParseJson(result.bodyText);
  if (!parsed || typeof parsed !== "object") return true;
  if (Object.prototype.hasOwnProperty.call(parsed, "ok") && (parsed as any).ok === false) return false;
  if (Object.prototype.hasOwnProperty.call(parsed, "error") && (parsed as any).error) return false;
  return true;
}

async function getAdminNotifySecret(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("admin_notify_secret")
    .eq("id", 1)
    .single();

  if (error) return "";
  return String((data as any)?.admin_notify_secret || "").trim();
}

async function callSendAdminNotification(params: {
  base: string;
  secret: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number; bodyText: string }>
{
  const explicitKey = normalizeApiKey(Deno.env.get("FUNCTIONS_API_KEY") || "");
  const anonKey = explicitKey || normalizeApiKey(Deno.env.get("SUPABASE_ANON_KEY") || "");
  const serviceKey = normalizeApiKey(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

  function buildHeaders(strategy: "anon" | "service" | "mixed"): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (params.secret) headers["x-admin-notify-secret"] = params.secret;

    if (strategy === "anon") {
      if (anonKey) {
        headers["Authorization"] = `Bearer ${anonKey}`;
        headers["apikey"] = anonKey;
      }
    } else if (strategy === "service") {
      if (serviceKey) {
        headers["Authorization"] = `Bearer ${serviceKey}`;
        headers["apikey"] = serviceKey;
      }
    } else {
      if (serviceKey) headers["Authorization"] = `Bearer ${serviceKey}`;
      if (anonKey) headers["apikey"] = anonKey;
      if (!headers["Authorization"] && anonKey) headers["Authorization"] = `Bearer ${anonKey}`;
      if (!headers["apikey"] && serviceKey) headers["apikey"] = serviceKey;
    }

    return headers;
  }

  async function doFetch(headers: Record<string, string>) {
    const url = `${params.base}/send-admin-notification${
      params.secret ? `?secret=${encodeURIComponent(params.secret)}` : ""
    }`;

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params.payload || {}),
    });

    let bodyText = "";
    try {
      bodyText = await resp.text();
    } catch (_e) {
      bodyText = "";
    }

    return { ok: resp.ok, status: resp.status, bodyText };
  }

  function shouldRetryGateway401(result: { ok: boolean; status: number; bodyText: string }): boolean {
    if (result.ok) return false;
    if (result.status !== 401) return false;
    const body = (result.bodyText || "").toLowerCase();
    return body.includes("missing authorization header") || body.includes("invalid") || body.includes('"code":401');
  }

  // First try: anon headers (matches GitHub Actions pattern)
  let result = await doFetch(buildHeaders("anon"));

  // If gateway rejects with 401, try alternate combinations.
  if (shouldRetryGateway401(result)) {
    // Second try: mixed (apikey=anon, authorization=service)
    result = await doFetch(buildHeaders("mixed"));
  }

  if (shouldRetryGateway401(result)) {
    // Third try: service headers
    result = await doFetch(buildHeaders("service"));
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.max(1, Math.min(50, Number(limitParam || "10") || 10));

  if (!supabaseUrl) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_URL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseServiceKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const providedWorkerSecret = (req.headers.get("x-admin-notify-worker-secret") || new URL(req.url).searchParams.get("secret") || "").trim();
  const requiredWorkerSecretEnv = (Deno.env.get("ADMIN_NOTIFY_WORKER_SECRET") || "").trim();
  const dbWorkerSecret = await getAdminNotifySecret(supabase);
  const acceptedWorkerSecrets = Array.from(new Set([requiredWorkerSecretEnv, dbWorkerSecret].filter(Boolean)));
  if (acceptedWorkerSecrets.length > 0) {
    if (providedWorkerSecret) {
      const authorized = acceptedWorkerSecrets.includes(providedWorkerSecret);
      if (!authorized) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  const base = getFunctionsBaseUrl();
  if (!base) {
    return new Response(JSON.stringify({ ok: false, error: "Unable to determine functions base URL" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dbSecret = dbWorkerSecret;
  const secret = (dbSecret || (Deno.env.get("ADMIN_NOTIFY_SECRET") || "")).trim();

  const { data: jobs, error: claimError } = await supabase.rpc("claim_admin_notification_jobs", {
    p_limit: limit,
  });

  if (claimError) {
    return new Response(JSON.stringify({ ok: false, error: claimError.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (Array.isArray(jobs) ? jobs : []) as JobRow[];
  if (!rows.length) {
    return new Response(JSON.stringify({ ok: true, claimed: 0, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const job of rows) {
    processed += 1;

    try {
      const payload = (job?.payload && typeof job.payload === "object") ? (job.payload as Record<string, unknown>) : {};
      const result = await callSendAdminNotification({ base, secret, payload });

      if (isLogicalOk(result)) {
        await supabase.rpc("complete_admin_notification_job", {
          p_id: job.id,
          p_ok: true,
          p_error: null,
          p_retry_seconds: 60,
        });
        sent += 1;
      } else {
        const retrySeconds = computeRetrySeconds(job.attempts || 1);
        await supabase.rpc("complete_admin_notification_job", {
          p_id: job.id,
          p_ok: false,
          p_error: `send-admin-notification failed (${result.status}): ${result.bodyText || ""}`.slice(0, 1000),
          p_retry_seconds: retrySeconds,
        });
        failed += 1;
      }
    } catch (e) {
      const retrySeconds = computeRetrySeconds(job.attempts || 1);
      await supabase.rpc("complete_admin_notification_job", {
        p_id: job.id,
        p_ok: false,
        p_error: (e instanceof Error ? e.message : String(e)).slice(0, 1000),
        p_retry_seconds: retrySeconds,
      });
      failed += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, claimed: rows.length, processed, sent, failed }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
