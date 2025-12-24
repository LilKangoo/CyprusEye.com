// TODO: implementacja – Edge Function stripe_webhook
// Responsibilities:
// - verify Stripe signature (placeholder)
// - on checkout.session.completed:
//   * set status='paid' for booking
//   * insert payment row
//   * send WhatsApp confirmation (placeholder)
//   * set status='approved'

function getFunctionsBaseUrl(): string {
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

export default {
  async fetch(req: Request): Promise<Response> {
    const base = getFunctionsBaseUrl();
    if (!base) {
      return new Response("Missing SUPABASE_URL (cannot infer functions URL)", { status: 500 });
    }

    const targetUrl = `${base.replace(/\/$/, "")}/stripe-webhook`;

    let body: ArrayBuffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.arrayBuffer();
    }

    const headers = new Headers(req.headers);

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    });

    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });
  },
} as const;
