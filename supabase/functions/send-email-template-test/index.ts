import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import nodemailer from "npm:nodemailer@6.9.11";

type SupportedLang = "pl" | "en";

type TestEmailRequest = {
  template_key?: string;
  language?: string;
  recipient_email?: string;
};

type TemplateCatalogRow = {
  key?: string;
  group_key?: string;
  label?: string;
  recipient?: string;
  source_key?: string;
  description?: string;
  required_variables?: unknown;
  preview_content?: unknown;
};

type TemplateVersionRow = {
  id?: string;
  template_key?: string;
  version_number?: number;
  status?: string;
  content?: unknown;
  required_variables?: unknown;
  updated_at?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_ADMIN_EMAIL = "lilkangoomedia@gmail.com";
const REQUIRED_ADMIN_USER_ID = "15f3d442-092d-4eb8-9627-db90da0283eb";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function stripHtml(value: unknown): string {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLang(value: unknown): SupportedLang {
  const raw = String(value || "").trim().toLowerCase();
  return raw.startsWith("en") ? "en" : "pl";
}

function normalizeTemplateKey(value: unknown): string {
  return String(value || "").trim().replace(/[^a-z0-9_-]/gi, "");
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function getAdminEmailAllowlist(): Set<string> {
  const values = [
    REQUIRED_ADMIN_EMAIL,
    ...String(Deno.env.get("EMAIL_TEMPLATE_TEST_ADMIN_EMAILS") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ];
  return new Set(values.map((item) => item.toLowerCase()));
}

async function isAuthorizedAdmin(supabase: any, user: any): Promise<boolean> {
  const email = normalizeEmail(user?.email);
  if (String(user?.id || "") === REQUIRED_ADMIN_USER_ID) return true;
  if (email && getAdminEmailAllowlist().has(email)) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, is_admin")
    .eq("id", user?.id)
    .maybeSingle();

  if (error) {
    console.warn("Email template test admin profile lookup failed:", error);
    return false;
  }

  const profileEmail = normalizeEmail(data?.email);
  return Boolean(data?.is_admin) || (profileEmail ? getAdminEmailAllowlist().has(profileEmail) : false);
}

function buildMailTransport() {
  const hostRaw = (Deno.env.get("SMTP_HOST") || "").trim();
  if (!hostRaw || hostRaw.toUpperCase().includes("WKLEJ_SMTP_HOST")) return null;

  const portEnv = (Deno.env.get("SMTP_PORT") || "").trim();
  const portParsed = portEnv ? Number.parseInt(portEnv, 10) : Number.NaN;
  const secureEnv = Deno.env.get("SMTP_SECURE");
  const secure = secureEnv ? secureEnv === "true" : (Number.isFinite(portParsed) ? portParsed === 465 : true);
  const user = Deno.env.get("SMTP_USER") || "";
  const pass = Deno.env.get("SMTP_PASS") || "";

  const transportConfig: any = {
    host: hostRaw,
    secure,
    port: Number.isFinite(portParsed) ? portParsed : (secure ? 465 : 587),
  };

  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return nodemailer.createTransport(transportConfig);
}

function buildFromHeader(rawFrom: string): string {
  const from = String(rawFrom || "").trim();
  if (!from) return "CyprusEye <no-reply@wakacjecypr.com>";
  if (from.includes("<") && from.includes(">")) return from;
  return `CyprusEye <${from}>`;
}

function getTemplateContent(params: {
  catalog: TemplateCatalogRow;
  version: TemplateVersionRow | null;
  lang: SupportedLang;
}): { content: Record<string, any>; sourceStatus: string; versionNumber: number | null } {
  const { catalog, version, lang } = params;
  const catalogContent = asObject(catalog.preview_content);
  const versionContent = asObject(version?.content);
  const pickLocalizedContent = (source: Record<string, any>) => {
    const candidates = [asObject(source[lang]), asObject(source.pl), asObject(source.en)];
    return candidates.find((candidate) => Object.keys(candidate).length) || {};
  };
  const versionLocalizedContent = pickLocalizedContent(versionContent);
  const catalogLocalizedContent = pickLocalizedContent(catalogContent);

  return {
    content: Object.keys(versionLocalizedContent).length ? versionLocalizedContent : catalogLocalizedContent,
    sourceStatus: version?.status ? String(version.status) : "catalog",
    versionNumber: Number.isFinite(Number(version?.version_number)) ? Number(version?.version_number) : null,
  };
}

function renderTemplateTestEmail(params: {
  catalog: TemplateCatalogRow;
  version: TemplateVersionRow | null;
  lang: SupportedLang;
  recipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { catalog, version, lang, recipientEmail } = params;
  const { content, sourceStatus, versionNumber } = getTemplateContent({ catalog, version, lang });
  const templateLabel = String(catalog.label || catalog.key || "Email template");
  const subject = String(content.subject || templateLabel).trim() || templateLabel;
  const heading = String(content.heading || templateLabel).trim() || templateLabel;
  const intro = String(content.intro || catalog.description || "").trim();
  const cta = String(content.cta || "Open").trim() || "Open";
  const customHtml = String(content.html || "").trim();
  const requiredVariables = asStringArray(version?.required_variables).length
    ? asStringArray(version?.required_variables)
    : asStringArray(catalog.required_variables);
  const versionLabel = versionNumber ? `${sourceStatus} #${versionNumber}` : sourceStatus;

  const customHtmlBlock = customHtml
    ? `
      <div style="margin-top:18px; padding-top:18px; border-top:1px solid #e5e7eb;">
        <div style="font-size:12px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.04em; margin-bottom:10px;">Custom HTML preview</div>
        ${customHtml}
      </div>
    `
    : "";

  const html = `
    <!doctype html>
    <html lang="${escapeHtml(lang)}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0; padding:0; background:#eef4ff; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Test email preview from CyprusEye admin.</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4ff; padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #dbeafe;">
                <tr>
                  <td style="background:#0f172a; color:#ffffff; padding:14px 22px; font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;">
                    TEST EMAIL - not sent by a production booking flow
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 22px;">
                    <div style="font-size:12px; font-weight:800; color:#ef4444; letter-spacing:.1em; text-transform:uppercase; margin-bottom:14px;">CyprusEye</div>
                    <h1 style="margin:0 0 12px; font-size:24px; line-height:1.2; color:#111827;">${escapeHtml(heading)}</h1>
                    ${intro ? `<p style="margin:0 0 18px; color:#475569; font-size:15px; line-height:1.6;">${escapeHtml(intro)}</p>` : ""}
                    <a href="#" style="display:inline-block; background:#ef4444; color:#ffffff; text-decoration:none; border-radius:10px; padding:12px 16px; font-weight:800;">${escapeHtml(cta)}</a>
                    ${customHtmlBlock}
                    <div style="margin-top:24px; padding-top:18px; border-top:1px solid #e5e7eb; color:#64748b; font-size:12px; line-height:1.6;">
                      <strong>Template:</strong> ${escapeHtml(templateLabel)} (${escapeHtml(String(catalog.key || ""))})<br>
                      <strong>Language:</strong> ${escapeHtml(lang.toUpperCase())}<br>
                      <strong>Source:</strong> ${escapeHtml(versionLabel)}<br>
                      <strong>Recipient:</strong> ${escapeHtml(recipientEmail)}<br>
                      <strong>Required variables:</strong> ${escapeHtml(requiredVariables.map((item) => `{{${item}}}`).join(", ") || "none")}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    "[TEST EMAIL - not sent by a production booking flow]",
    `Template: ${templateLabel} (${catalog.key || ""})`,
    `Language: ${lang.toUpperCase()}`,
    `Source: ${versionLabel}`,
    "",
    heading,
    intro,
    customHtml ? stripHtml(customHtml) : "",
    "",
    `Required variables: ${requiredVariables.map((item) => `{{${item}}}`).join(", ") || "none"}`,
  ].filter(Boolean).join("\n");

  return {
    subject: `[TEST] ${subject}`,
    html,
    text,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ ok: false, error: "Supabase service configuration is missing" }, 500);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return json({ ok: false, error: "Missing admin session" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ ok: false, error: "Invalid admin session" }, 401);
  }

  if (!(await isAuthorizedAdmin(supabase, userData.user))) {
    return json({ ok: false, error: "Admin access required" }, 403);
  }

  let payload: TestEmailRequest = {};
  try {
    payload = await req.json();
  } catch (_error) {
    return json({ ok: false, error: "Invalid JSON payload" }, 400);
  }

  const templateKey = normalizeTemplateKey(payload.template_key);
  const lang = normalizeLang(payload.language);
  const recipientEmail = normalizeEmail(payload.recipient_email);

  if (!templateKey) return json({ ok: false, error: "template_key is required" }, 400);
  if (!isValidEmail(recipientEmail)) return json({ ok: false, error: "Valid recipient_email is required" }, 400);

  const { data: catalog, error: catalogError } = await supabase
    .from("email_template_catalog")
    .select("key, group_key, label, recipient, source_key, description, required_variables, preview_content")
    .eq("key", templateKey)
    .eq("is_active", true)
    .maybeSingle();

  if (catalogError) {
    console.error("Email template catalog lookup failed:", catalogError);
    return json({ ok: false, error: "Failed to load template catalog" }, 500);
  }
  if (!catalog) return json({ ok: false, error: "Template not found" }, 404);

  const { data: versions, error: versionError } = await supabase
    .from("email_template_versions")
    .select("id, template_key, version_number, status, content, required_variables, updated_at")
    .eq("template_key", templateKey)
    .order("version_number", { ascending: false })
    .limit(1);

  if (versionError) {
    console.error("Email template version lookup failed:", versionError);
    return json({ ok: false, error: "Failed to load template version" }, 500);
  }

  const latestVersion = Array.isArray(versions) && versions.length
    ? versions[0] as TemplateVersionRow
    : null;
  const message = renderTemplateTestEmail({
    catalog: catalog as TemplateCatalogRow,
    version: latestVersion,
    lang,
    recipientEmail,
  });

  const transport = buildMailTransport();
  if (!transport) {
    console.log(`\n===== Simulated email template test =====\nTo: ${recipientEmail}\nSubject: ${message.subject}\n\n${message.text}\n===== End =====\n`);
    return json({
      ok: true,
      simulated: true,
      template_key: templateKey,
      language: lang,
      recipient_email: recipientEmail,
      status: latestVersion?.status || "catalog",
      version_number: latestVersion?.version_number || null,
    });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        {
          from: buildFromHeader(Deno.env.get("SMTP_FROM") || "no-reply@wakacjecypr.com"),
          to: recipientEmail,
          subject: message.subject,
          text: message.text,
          html: message.html,
        },
        (error: any) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  } catch (error) {
    console.error("Email template test send failed:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "SMTP send failed" }, 500);
  }

  return json({
    ok: true,
    simulated: false,
    template_key: templateKey,
    language: lang,
    recipient_email: recipientEmail,
    status: latestVersion?.status || "catalog",
    version_number: latestVersion?.version_number || null,
  });
});
