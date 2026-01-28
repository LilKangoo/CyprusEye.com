import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";

type SendPlanEmailRequest = {
  plan_id?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CUSTOMER_HOMEPAGE_URL = "https://cypruseye.com";
const BRAND_LOGO_URL = "https://cypruseye.com/assets/cyprus_logo-1000x1054.png";

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function buildMailTransport() {
  const host = Deno.env.get("SMTP_HOST");
  if (!host) return null;

  const portEnv = (Deno.env.get("SMTP_PORT") || "").trim();
  const portParsed = portEnv ? Number.parseInt(portEnv, 10) : Number.NaN;
  const secureEnv = Deno.env.get("SMTP_SECURE");
  const secure = secureEnv ? secureEnv === "true" : (Number.isFinite(portParsed) ? portParsed === 465 : true);

  const user = Deno.env.get("SMTP_USER") || "";
  const pass = Deno.env.get("SMTP_PASS") || "";

  const transportConfig: any = {
    host,
    secure,
  };

  if (Number.isFinite(portParsed)) {
    transportConfig.port = portParsed;
  } else {
    transportConfig.port = secure ? 465 : 587;
  }

  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return nodemailer.createTransport(transportConfig);
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function normalizePlanId(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("plan:")) {
    return raw.slice(5).trim();
  }
  if (raw.startsWith("#plan:")) {
    return raw.slice(6).trim();
  }
  return raw;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatTimeRangeLabel(data: any): string {
  const start = String(data?.start_time || "").trim();
  const end = String(data?.end_time || "").trim();
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return "";
}

function buildPlanEmailHtml(params: {
  recipientEmail: string;
  plan: any;
  days: any[];
  itemsByDayId: Map<string, any[]>;
}): { subject: string; text: string; html: string } {
  const { recipientEmail, plan, days, itemsByDayId } = params;

  const title = String(plan?.title || "Your trip plan").trim() || "Your trip plan";
  const baseCity = String(plan?.base_city || "").trim();
  const dateRange = [plan?.start_date ? String(plan.start_date) : "", plan?.end_date ? String(plan.end_date) : ""].filter(Boolean).join(" → ");

  const subject = `Your Trip Plan – ${title}`;

  const preheader = [
    "Your Cyprus trip plan is ready.",
    baseCity ? `Base: ${baseCity}.` : "",
    dateRange ? `Dates: ${dateRange}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const headerMetaParts = [
    baseCity ? `Base: ${baseCity}` : "",
    dateRange ? `Dates: ${dateRange}` : "",
    recipientEmail ? `Email: ${recipientEmail}` : "",
  ].filter(Boolean);

  const daySections = (days || []).map((d) => {
    const dayId = String(d.id);
    const items = (itemsByDayId.get(dayId) || [])
      .slice()
      .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));

    const dayTitleParts = [
      `Day ${escapeHtml(String(d?.day_index || ""))}`,
      d?.date ? escapeHtml(String(d.date)) : "",
      d?.city ? escapeHtml(String(d.city)) : "",
    ].filter(Boolean);

    const itemsHtml = items.length
      ? items
          .map((it) => {
            const data = it?.data && typeof it.data === "object" ? it.data : {};
            const itemTitle = String(data?.title || data?.name || "").trim();
            const type = String(it?.item_type || "").trim();
            const subtitle = String(data?.subtitle || "").trim();
            const url = String(data?.url || "").trim();
            const notes = String(data?.notes || "").trim();

            const timeLabel = formatTimeRangeLabel(data);
            const meta = [timeLabel, type, subtitle].filter(Boolean).join(" • ");

            return `
              <tr>
                <td style="padding:10px 0; border-top:1px solid #e5e7eb;">
                  <div style="font-size:15px; font-weight:700; color:#0b1220; line-height:1.25;">${escapeHtml(itemTitle || type || "Item")}</div>
                  ${meta ? `<div style="margin-top:4px; font-size:12px; color:#64748b;">${escapeHtml(meta)}</div>` : ""}
                  ${url ? `<div style="margin-top:6px; font-size:12px;"><a href="${escapeHtml(url)}" style="color:#2563eb; text-decoration:underline; word-break:break-word;">${escapeHtml(url)}</a></div>` : ""}
                  ${notes ? `<div style="margin-top:6px; font-size:12px; color:#475569;">${escapeHtml(notes)}</div>` : ""}
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td style="padding:10px 0; color:#64748b; font-size:12px;">No items.</td></tr>`;

    const dayNotes = d?.notes
      ? `<div style="margin-top:8px; font-size:12px; color:#475569;">${escapeHtml(String(d.notes))}</div>`
      : "";

    return `
      <tr>
        <td style="padding:0 0 18px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; background:#ffffff;">
            <tr>
              <td style="padding:14px 16px; background:#f8fafc;">
                <div style="font-size:13px; font-weight:800; color:#0b1220;">${dayTitleParts.join(" · ")}</div>
                ${dayNotes}
              </td>
            </tr>
            <tr>
              <td style="padding:0 16px 6px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${itemsHtml}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  });

  const html = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="x-apple-disable-message-reformatting" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0; padding:0; background:#f1f5f9;">
      <div style="display:none; font-size:1px; color:#f1f5f9; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
        ${escapeHtml(preheader)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" width="720" cellspacing="0" cellpadding="0" style="width:100%; max-width:720px; background:#ffffff; border:1px solid #e5e7eb; border-radius:18px; overflow:hidden;">
              <tr>
                <td style="padding:18px 20px; background:#0b1220;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:18px; font-weight:900; color:#ffffff; line-height:1.2;">${escapeHtml(title)}</div>
                        <div style="margin-top:6px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:12px; color:#cbd5e1; line-height:1.4;">${escapeHtml(headerMetaParts.join(" • "))}</div>
                      </td>
                      <td align="right" style="vertical-align:middle; padding-left:12px;">
                        <a href="${escapeHtml(CUSTOMER_HOMEPAGE_URL)}" style="text-decoration:none;">
                          <img src="${escapeHtml(BRAND_LOGO_URL)}" alt="CyprusEye" width="92" height="34" style="display:block; border:0; outline:none; text-decoration:none; width:92px; height:34px; object-fit:contain; background:#ffffff; border-radius:8px; padding:6px;" />
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 20px 8px 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${daySections.join("")}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px 18px 20px; border-top:1px solid #e5e7eb;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:12px; color:#64748b; line-height:1.5;">
                    Generated by CyprusEye Trip Planner.
                  </div>
                  <div style="margin-top:8px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; font-size:12px; color:#64748b; line-height:1.5;">
                    Open CyprusEye: <a href="${escapeHtml(CUSTOMER_HOMEPAGE_URL)}" style="color:#2563eb; text-decoration:underline;">${escapeHtml(CUSTOMER_HOMEPAGE_URL)}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim();

  const textLines = [
    title,
    headerMetaParts.join(" | "),
    "",
    ...(days || []).flatMap((d) => {
      const dayId = String(d.id);
      const items = (itemsByDayId.get(dayId) || [])
        .slice()
        .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
      const dayHeader = `Day ${d?.day_index || ""} ${d?.date || ""} ${d?.city || ""}`.trim();
      const itemLines = items.map((it) => {
        const data = it?.data && typeof it.data === "object" ? it.data : {};
        const itemTitle = String(data?.title || data?.name || it?.item_type || "Item");
        return `- ${itemTitle}`;
      });
      return [dayHeader, ...(itemLines.length ? itemLines : ["- No items"]), ""]; 
    }),
  ].filter(Boolean);

  return { subject, html, text: textLines.join("\n") };
}

function extractEmailAddress(value: string): string {
  const v = String(value || "").trim();
  if (!v) return "";
  const m = v.match(/<([^>]+)>/);
  if (m && m[1]) return m[1].trim();
  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const token = extractBearerToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendPlanEmailRequest = await req.json();
    const planId = normalizePlanId(body?.plan_id);
    if (!planId) {
      return new Response(JSON.stringify({ error: "plan_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isUuid(planId)) {
      return new Response(JSON.stringify({ error: "plan_id must be a UUID", plan_id: planId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const envSupabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (!envSupabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEnvUrl = envSupabaseUrl.replace(/\/+$/, "");
    const supabase = createClient(normalizedEnvUrl, supabaseServiceKey);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[send-plan-email] request", {
      plan_id: planId,
      user_id: user.id,
      has_email: Boolean(user.email),
    });

    const recipientEmail = String(user.email || "").trim();
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "User email not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan, error: planError } = await supabase
      .from("user_plans")
      .select("id,user_id,title,start_date,end_date,base_city,include_north,currency")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      console.warn("[send-plan-email] plan lookup error", {
        plan_id: planId,
        user_id: user.id,
        plan_error: planError?.message || null,
        plan_code: (planError as any)?.code || null,
        plan_details: (planError as any)?.details || null,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to load plan",
          plan_id: planId,
          plan_error: planError.message || String(planError),
          plan_code: (planError as any)?.code || null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!plan) {
      const { data: samplePlans, error: sampleError } = await supabase
        .from("user_plans")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      console.warn("[send-plan-email] plan not found", {
        plan_id: planId,
        user_id: user.id,
        sample_count: Array.isArray(samplePlans) ? samplePlans.length : null,
        sample_error: sampleError?.message || null,
      });

      return new Response(
        JSON.stringify({
          error: "Plan not found",
          plan_id: planId,
          user_id: user.id,
          user_plans_sample: Array.isArray(samplePlans) ? samplePlans.map((p) => p.id) : null,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (String(plan.user_id) !== String(user.id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: days, error: daysError } = await supabase
      .from("user_plan_days")
      .select("id,day_index,date,city,notes")
      .eq("plan_id", planId)
      .order("day_index", { ascending: true });

    if (daysError) {
      return new Response(JSON.stringify({ error: daysError.message || "Failed to load plan days" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dayIds = (days || []).map((d) => String(d.id));

    let items: any[] = [];
    if (dayIds.length) {
      const { data: itemsData, error: itemsError } = await supabase
        .from("user_plan_items")
        .select("id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at")
        .in("plan_day_id", dayIds)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        return new Response(JSON.stringify({ error: itemsError.message || "Failed to load plan items" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      items = itemsData || [];
    }

    const itemsByDayId = new Map<string, any[]>();
    items.forEach((it) => {
      const k = String(it.plan_day_id);
      if (!itemsByDayId.has(k)) itemsByDayId.set(k, []);
      itemsByDayId.get(k)!.push(it);
    });

    const email = buildPlanEmailHtml({ recipientEmail, plan, days: days || [], itemsByDayId });

    const transport = buildMailTransport();
    if (!transport) {
      return new Response(JSON.stringify({ ok: true, simulated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromRaw = (Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "").trim();
    const fromAddress = extractEmailAddress(fromRaw);
    if (!fromAddress) {
      return new Response(JSON.stringify({ error: "SMTP_FROM not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const from = `CyprusEye & WakacjeCypr <${fromAddress}>`;

    await transport.sendMail({
      from,
      to: recipientEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-plan-email error", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
