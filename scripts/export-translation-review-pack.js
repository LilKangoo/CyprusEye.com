#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'translations', 'manual-review');
const translationDir = path.join(rootDir, 'translations');
const emailTemplateCatalogMigrationPath = path.join(rootDir, 'supabase', 'migrations', '173_email_template_catalog_foundation.sql');
const PAGE_SIZE = 1000;
const LANGUAGES = ['pl', 'en', 'he'];

const args = new Set(process.argv.slice(2));
const liveEnabled = !args.has('--no-live');

const EMAIL_RE = /(^|\.)(email|emails|mail|notification|notifications|deposit|payment|paid|booking|accepted|confirmed|customer|partner|admin|cancel|cancelled|cancellation|reject|rejected|coupon|referral)(\.|$)/i;
const LONG_COPY_RE = /(^|\.)(body|html|content|description|intro|summary|lead|copy|terms|policy|legal|seo|meta|marketing|advertise|checkout|payment)(\.|$)/i;
const TECHNICAL_KEY_RE = /(^|\.)(id|ids|url|uri|href|slug|code|key|token|model|brand|logo|icon|image|src|path|currency|iata)(\.|$)/i;
const TECHNICAL_VALUE_RE = /^(?:[A-Z0-9][A-Z0-9\s/+().:_-]*|https?:\/\/\S+|#[A-Fa-f0-9]{3,8}|CyprusEye|Stripe|PayPal|Google|Apple|ETIAS|SOS|VIP|XP)$/;
const PAYMENT_CRITICAL_RE = /deposit|payment|paid|stripe|checkout|booking|accepted|confirmed|customer_deposit|partner_deposit/i;

const DYNAMIC_TABLES = [
  {
    module: 'blog',
    table: 'blog_posts',
    translationTable: 'blog_post_translations',
    slugFields: ['slug'],
  },
  {
    module: 'trips',
    table: 'trips',
    titleFields: ['title'],
    descriptionFields: ['description'],
    slugFields: ['slug'],
  },
  {
    module: 'hotels',
    table: 'hotels',
    titleFields: ['title', 'name'],
    descriptionFields: ['description'],
    slugFields: ['slug'],
  },
  {
    module: 'cars',
    table: 'car_offers',
    titleFields: ['car_model', 'car_model_new', 'car_type', 'car_type_new'],
    descriptionFields: ['description', 'description_new', 'features'],
    slugFields: ['slug'],
  },
  {
    module: 'poi',
    table: 'pois',
    titleFields: ['name_i18n', 'name'],
    descriptionFields: ['description_i18n', 'description'],
    slugFields: ['slug', 'id'],
  },
  {
    module: 'recommendations',
    table: 'recommendations',
    titleFields: ['title_he', 'title_en', 'title_pl', 'title'],
    descriptionFields: ['description_he', 'description_en', 'description_pl', 'description'],
    slugFields: ['slug', 'id'],
  },
  {
    module: 'transport',
    table: 'transport_locations',
    titleFields: ['name_he', 'name', 'name_local'],
    slugFields: ['code', 'slug', 'id'],
  },
  {
    module: 'shop_products',
    table: 'shop_products',
    titleFields: ['name_he', 'name_en', 'name'],
    descriptionFields: ['description_he', 'description_en', 'description', 'short_description_he', 'short_description_en', 'short_description'],
    slugFields: ['slug', 'id'],
  },
  {
    module: 'shop_categories',
    table: 'shop_categories',
    titleFields: ['name_he', 'name_en', 'name_pl', 'name'],
    descriptionFields: ['description_he', 'description_en', 'description'],
    slugFields: ['slug', 'id'],
  },
  {
    module: 'shop_vendors',
    table: 'shop_vendors',
    titleFields: ['name_he', 'name_en', 'name'],
    descriptionFields: ['description_he', 'description_en', 'description'],
    slugFields: ['slug', 'id'],
  },
  {
    module: 'shop_shipping',
    table: 'shop_shipping_methods',
    titleFields: ['name_he', 'name_en', 'name'],
    descriptionFields: ['description_he', 'description_en', 'description'],
    slugFields: ['code', 'id'],
  },
  {
    module: 'coupons_discounts',
    table: 'shop_discounts',
    titleFields: ['code', 'name'],
    descriptionFields: ['description_he', 'description_en', 'description'],
    slugFields: ['code', 'id'],
  },
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTranslationLeaf(value) {
  if (!isPlainObject(value)) return true;
  return typeof value.text === 'string' || typeof value.html === 'string';
}

function flattenTranslations(value, prefix = '', output = {}, metadata = { sources: {} }, source = 'nested') {
  if (!prefix && !isPlainObject(value)) return output;

  if (prefix && isTranslationLeaf(value)) {
    const existingSource = metadata.sources[prefix];
    if (existingSource === 'direct' && source !== 'direct') {
      return output;
    }
    output[prefix] = value;
    metadata.sources[prefix] = source;
    return output;
  }

  Object.entries(value || {}).forEach(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const nextSource = !prefix && key.includes('.') ? 'direct' : source;
    flattenTranslations(child, nextKey, output, metadata, nextSource);
  });

  return output;
}

function sortKeys(keys) {
  return [...keys].sort((left, right) => left.localeCompare(right, 'en'));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function collectStringValues(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, output));
  } else if (isPlainObject(value)) {
    Object.values(value).forEach((entry) => collectStringValues(entry, output));
  }
  return output;
}

function displayValue(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(' | ');
  if (isPlainObject(value)) {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.html === 'string') return value.html;
    return collectStringValues(value).join(' | ');
  }
  return String(value);
}

function extractSingleBraceTokens(input) {
  const tokens = [];
  const matches = String(input || '').matchAll(/\{(?!\{)([A-Za-z0-9_.:-]+)\}(?!\})/g);
  for (const match of matches) tokens.push(`{${match[1]}}`);
  return tokens;
}

function extractTokens(input) {
  return sortKeys([
    ...(String(input || '').match(/\{\{[^{}]+\}\}/g) || []),
    ...extractSingleBraceTokens(input),
    ...(String(input || '').match(/%(?:\d+\$)?[sdif]/g) || []),
  ]);
}

function extractHtmlTags(input) {
  const tags = [];
  const matches = String(input || '').matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>/g);
  for (const match of matches) {
    tags.push(match[0].startsWith('</') ? `/${match[1].toLowerCase()}` : match[1].toLowerCase());
  }
  return tags;
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tokenStatusFor(source, target) {
  const sourceTokens = extractTokens(source);
  const targetTokens = extractTokens(target);
  const sourceTags = extractHtmlTags(source);
  const targetTags = extractHtmlTags(target);

  if (!sameArray(sourceTokens, targetTokens)) {
    return {
      status: 'placeholder_mismatch',
      source_tokens: sourceTokens,
      target_tokens: targetTokens,
    };
  }

  if (!sameArray(sourceTags, targetTags)) {
    return {
      status: 'html_tag_mismatch',
      source_tags: sourceTags,
      target_tags: targetTags,
    };
  }

  return {
    status: 'ok',
    source_tokens: sourceTokens,
    target_tokens: targetTokens,
    source_tags: sourceTags,
    target_tags: targetTags,
  };
}

function rootForKey(key) {
  return String(key || '').split('.')[0] || 'unknown';
}

function hasHebrew(input) {
  return /[\u0590-\u05FF]/.test(String(input || ''));
}

function isLongReviewKey(key, pl, en, he) {
  const text = [pl, en, he].join(' ');
  return LONG_COPY_RE.test(key) || text.length > 240;
}

function classifySameAsEnglish(key, value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'needs_human_review';
  if (TECHNICAL_KEY_RE.test(key) || TECHNICAL_VALUE_RE.test(normalized)) {
    return 'allowed_same_as_en';
  }
  if (isLongReviewKey(key, '', normalized, normalized) || /^(advertise|seo|shop)\b/.test(key) || EMAIL_RE.test(key)) {
    return 'needs_human_review';
  }
  return 'needs_translation';
}

function staticRecommendedAction({ key, sourceEn, currentHe, missingEn, missingHe, sameAsEn, category }) {
  if (missingEn) return 'Fill EN manually from PL before HE relies on fallback.';
  if (missingHe) return 'Translate HE manually and preserve variables/tags.';
  if (sameAsEn) {
    const sameAsClass = classifySameAsEnglish(key, currentHe);
    if (sameAsClass === 'allowed_same_as_en') return 'Keep same as EN if brand/code/model; confirm during review.';
    return 'Review and translate HE, or explicitly mark same-as-EN as intentional.';
  }
  if (category === 'seo') return 'Manual SEO copy review only; SEO HE remains off.';
  if (category === 'email_template') return 'Manual payment/email template review required before live use.';
  if (category === 'shop') return 'Manual Shop copy review; Shop HE remains excluded.';
  if (isLongReviewKey(key, '', sourceEn, currentHe)) return 'Manual copy review required; do not auto-publish.';
  return 'Review for tone and UI fit.';
}

function makeStaticRecord({ key, flat, category, notes = '' }) {
  const sourcePl = displayValue(flat.pl[key]);
  const sourceEn = displayValue(flat.en[key]);
  const currentHe = displayValue(flat.he[key]);
  const missingEn = !Object.prototype.hasOwnProperty.call(flat.en, key);
  const missingHe = !Object.prototype.hasOwnProperty.call(flat.he, key);
  const sameAsEn = !missingHe && !missingEn && JSON.stringify(flat.en[key]) === JSON.stringify(flat.he[key]);
  const placeholder = tokenStatusFor(sourceEn || sourcePl, currentHe);
  const requiresHumanReview = (
    missingEn
    || missingHe
    || sameAsEn
    || placeholder.status !== 'ok'
    || isLongReviewKey(key, sourcePl, sourceEn, currentHe)
    || category !== 'static_ui'
  );

  return {
    key,
    record_id: key,
    module: rootForKey(key),
    category,
    source_pl: sourcePl,
    source_en: sourceEn,
    current_he: currentHe,
    missing_en: missingEn,
    missing_he: missingHe,
    same_as_en: sameAsEn,
    same_as_en_classification: sameAsEn ? classifySameAsEnglish(key, currentHe) : null,
    placeholder_status: placeholder.status,
    placeholder_details: placeholder,
    human_review_required: requiresHumanReview,
    recommended_action: staticRecommendedAction({
      key,
      sourceEn,
      currentHe,
      missingEn,
      missingHe,
      sameAsEn,
      category,
    }),
    notes,
    safe_to_auto_apply: false,
  };
}

function pack(records, meta = {}) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workflow: 'manual_translation_review',
    publicActivation: {
      globalHe: false,
      blogHePublic: false,
      shopHe: false,
      seoHe: false,
      sitemapHe: false,
      hreflangHe: false,
      canonicalHe: false,
      indexingHe: false,
      publicHeRoutes: false,
    },
    counts: {
      records: records.length,
      humanReviewRequired: records.filter((record) => record.human_review_required).length,
      missingEn: records.filter((record) => record.missing_en).length,
      missingHe: records.filter((record) => record.missing_he).length,
      sameAsEn: records.filter((record) => record.same_as_en).length,
      placeholderIssues: records.filter((record) => record.placeholder_status !== 'ok').length,
      safeToAutoApply: records.filter((record) => record.safe_to_auto_apply).length,
    },
    ...meta,
    records,
  };
}

function classifyStaticPacks(flat, triAudit) {
  const allKeys = sortKeys([...new Set(LANGUAGES.flatMap((language) => Object.keys(flat[language])))]);
  const missingHeKeys = new Set([
    ...(triAudit?.missing?.plMissingHe || []),
    ...(triAudit?.missing?.enMissingHe || []),
  ]);
  const missingEnKeys = new Set(triAudit?.missing?.plMissingEn || []);
  const sameAsEnKeys = new Set(triAudit?.sameAsEnHe || []);

  const records = [];
  const sameAsEnRecords = [];

  allKeys.forEach((key) => {
    const root = rootForKey(key);
    const needsPack = missingEnKeys.has(key) || missingHeKeys.has(key) || sameAsEnKeys.has(key);
    const isSpecial = root === 'advertise' || root === 'seo' || root === 'shop' || EMAIL_RE.test(key);
    const isLong = isLongReviewKey(key, displayValue(flat.pl[key]), displayValue(flat.en[key]), displayValue(flat.he[key]));

    if (!needsPack && !isSpecial && !isLong) return;

    let category = 'static_ui';
    let notes = 'Short/static UI review.';
    if (root === 'advertise') {
      category = 'advertise';
      notes = 'Advertising/partner copy stays manual-review only.';
    } else if (root === 'seo') {
      category = 'seo';
      notes = 'SEO HE remains off; translate only for later SEO stage.';
    } else if (root === 'shop') {
      category = 'shop';
      notes = 'Shop HE remains excluded; checkout/payment/legal copy requires manual review.';
    } else if (EMAIL_RE.test(key)) {
      category = 'email_template';
      notes = 'Notification/payment/email-sensitive key; preserve placeholders and review manually.';
    } else if (isLong) {
      category = 'long_static_copy';
      notes = 'Long static copy requires human copy review before public use.';
    }

    const record = makeStaticRecord({ key, flat, category, notes });
    records.push(record);
    if (record.same_as_en) sameAsEnRecords.push(record);
  });

  return {
    all: records,
    staticUi: records.filter((record) => record.category === 'static_ui' || record.category === 'long_static_copy'),
    advertise: records.filter((record) => record.category === 'advertise'),
    seo: records.filter((record) => record.category === 'seo'),
    shop: records.filter((record) => record.category === 'shop'),
    emailTemplate: records.filter((record) => record.category === 'email_template'),
    sameAsEn: sameAsEnRecords,
  };
}

function localizedValue(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => localizedValue(entry, lang)).filter(Boolean).join(' | ');
  }
  if (isPlainObject(value)) {
    if (typeof value[lang] === 'string') return value[lang];
    if (lang === 'he' && typeof value.en === 'string') return '';
    if (typeof value.text === 'string') return value.text;
    if (typeof value.html === 'string') return value.html;
  }
  return '';
}

function firstField(row, fields, lang = null) {
  for (const field of fields || []) {
    const value = row?.[field];
    const normalized = lang ? localizedValue(value, lang) : displayValue(value);
    if (String(normalized || '').trim()) return String(normalized).trim();
  }
  return '';
}

function dynamicRecord(definition, row) {
  const titlePl = firstField(row, definition.titleFields, 'pl') || firstField(row, definition.titleFields);
  const titleEn = firstField(row, definition.titleFields, 'en') || firstField(row, definition.titleFields);
  const titleHe = firstField(row, definition.titleFields, 'he');
  const descriptionPl = firstField(row, definition.descriptionFields, 'pl') || firstField(row, definition.descriptionFields);
  const descriptionEn = firstField(row, definition.descriptionFields, 'en') || firstField(row, definition.descriptionFields);
  const descriptionHe = firstField(row, definition.descriptionFields, 'he');
  const slug = firstField(row, definition.slugFields);
  const missingHe = Boolean((titleEn || descriptionEn || titlePl || descriptionPl) && !(titleHe || descriptionHe));
  const sameAsEn = Boolean(titleHe && titleEn && titleHe === titleEn) || Boolean(descriptionHe && descriptionEn && descriptionHe === descriptionEn);
  const complete = Boolean(titleHe && (!descriptionEn || descriptionHe));
  const partial = Boolean(!complete && (titleHe || descriptionHe));

  return {
    record_id: row?.id || row?.code || slug || '',
    key: `${definition.module}:${row?.id || row?.code || slug || ''}`,
    module: definition.module,
    slug,
    source_pl: titlePl,
    source_en: titleEn,
    current_he: titleHe,
    source_pl_description: descriptionPl,
    source_en_description: descriptionEn,
    current_he_description: descriptionHe,
    missing_en: !titleEn && Boolean(titlePl),
    missing_he: missingHe,
    same_as_en: sameAsEn,
    placeholder_status: tokenStatusFor(`${titleEn} ${descriptionEn}`, `${titleHe} ${descriptionHe}`).status,
    readiness_status: complete ? 'he_ready' : (partial ? 'partial' : (missingHe ? 'needs_he_translation' : 'fallback_or_not_localized')),
    public_ready_status: row?.review_status || row?.translation_status || row?.status || null,
    human_review_required: true,
    recommended_action: complete
      ? 'Human review existing HE before public-ready status.'
      : 'Translate/review HE manually in admin UI or prepared SQL; do not auto-publish.',
    notes: 'Read-only dynamic content export. No database updates were made.',
    safe_to_auto_apply: false,
  };
}

function blogRecord(post, translationsByPost) {
  const translations = translationsByPost.get(post.id) || {};
  const pl = translations.pl || {};
  const en = translations.en || {};
  const he = translations.he || {};
  const required = ['slug', 'title', 'lead', 'content_html'];
  const missingRequired = required.filter((field) => !String(he?.[field] || '').trim());
  const taxonomyMissing = !Array.isArray(post.categories_he) || post.categories_he.length === 0;

  return {
    record_id: post.id,
    key: `blog:${post.id}`,
    module: 'blog',
    slug: he.slug || en.slug || pl.slug || post.slug || '',
    source_pl: pl.title || post.title_pl || post.title || '',
    source_en: en.title || post.title_en || post.title || '',
    current_he: he.title || '',
    source_pl_description: pl.lead || pl.summary || '',
    source_en_description: en.lead || en.summary || '',
    current_he_description: he.lead || he.summary || '',
    missing_en: !en.title,
    missing_he: missingRequired.length > 0,
    same_as_en: Boolean(he.title && en.title && he.title === en.title),
    placeholder_status: tokenStatusFor(`${en.title || ''} ${en.lead || ''}`, `${he.title || ''} ${he.lead || ''}`).status,
    readiness_status: missingRequired.length === 0 && !taxonomyMissing ? 'he_complete_unreviewed' : 'needs_he_translation',
    public_ready_status: he.review_status || 'not_public_ready',
    human_review_required: true,
    recommended_action: 'Translate/review manually; mark public_ready only after explicit human approval.',
    notes: `Missing required HE fields: ${missingRequired.concat(taxonomyMissing ? ['categories_he'] : []).join(', ') || 'none'}.`,
    safe_to_auto_apply: false,
  };
}

async function fetchAll(supabase, table) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);
    if (error) {
      return { table, rows, error: error.message || String(error) };
    }
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { table, rows, error: null };
}

function byPostId(translations) {
  const result = new Map();
  translations.forEach((row) => {
    if (!row?.blog_post_id || !row?.lang) return;
    const existing = result.get(row.blog_post_id) || {};
    existing[row.lang] = row;
    result.set(row.blog_post_id, existing);
  });
  return result;
}

async function buildDynamicPacks() {
  if (!liveEnabled) {
    return {
      records: [],
      readWarnings: ['Live Supabase export skipped with --no-live.'],
      emailDbRecords: [],
    };
  }

  const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableResults = await Promise.all([
    ...DYNAMIC_TABLES.map((definition) => fetchAll(supabase, definition.table)),
    fetchAll(supabase, 'blog_post_translations'),
    fetchAll(supabase, 'email_template_catalog'),
    fetchAll(supabase, 'email_template_versions'),
    fetchAll(supabase, 'shop_email_templates'),
  ]);

  const byTable = new Map(tableResults.map((result) => [result.table, result]));
  const readWarnings = tableResults
    .filter((result) => result.error)
    .map((result) => `${result.table}: ${result.error}`);

  const translationsByPost = byPostId(byTable.get('blog_post_translations')?.rows || []);
  const dynamicRecords = [];

  DYNAMIC_TABLES.forEach((definition) => {
    const rows = byTable.get(definition.table)?.rows || [];
    if (definition.module === 'blog') {
      rows.forEach((row) => dynamicRecords.push(blogRecord(row, translationsByPost)));
      return;
    }
    rows.forEach((row) => dynamicRecords.push(dynamicRecord(definition, row)));
  });

  const emailDbRecords = [];
  (byTable.get('email_template_catalog')?.rows || []).forEach((row) => {
    const content = row.preview_content || {};
    const heContent = content.he || {};
    const enContent = content.en || {};
    const plContent = content.pl || {};
    emailDbRecords.push({
      key: `email_template_catalog:${row.key}`,
      record_id: row.key,
      module: 'email_template_catalog',
      category: 'email_template',
      source_pl: displayValue(plContent),
      source_en: displayValue(enContent),
      current_he: displayValue(heContent),
      missing_en: !displayValue(enContent),
      missing_he: !displayValue(heContent),
      same_as_en: Boolean(displayValue(heContent) && displayValue(heContent) === displayValue(enContent)),
      placeholder_status: tokenStatusFor(displayValue(enContent), displayValue(heContent)).status,
      payment_critical: PAYMENT_CRITICAL_RE.test(`${row.key} ${row.group_key} ${row.description}`),
      human_review_required: true,
      recommended_action: 'Review email/payment template manually; live sending must remain unchanged until separately approved.',
      notes: `Required variables: ${(row.required_variables || []).join(', ')}`,
      safe_to_auto_apply: false,
    });
  });

  (byTable.get('shop_email_templates')?.rows || []).forEach((row) => {
    emailDbRecords.push({
      key: `shop_email_templates:${row.id || row.key || row.code}`,
      record_id: row.id || row.key || row.code,
      module: 'shop_email_templates',
      category: 'email_template',
      source_pl: row.subject_pl || row.body_html_pl || '',
      source_en: row.subject_en || row.body_html_en || '',
      current_he: row.subject_he || row.body_html_he || '',
      missing_en: !(row.subject_en || row.body_html_en),
      missing_he: !(row.subject_he || row.body_html_he),
      same_as_en: Boolean(row.subject_he && row.subject_en && row.subject_he === row.subject_en),
      placeholder_status: tokenStatusFor(`${row.subject_en || ''} ${row.body_html_en || ''}`, `${row.subject_he || ''} ${row.body_html_he || ''}`).status,
      payment_critical: true,
      human_review_required: true,
      recommended_action: 'Review Shop email template manually. Shop HE remains excluded.',
      notes: 'Shop email template read-only review.',
      safe_to_auto_apply: false,
    });
  });

  return { records: dynamicRecords, readWarnings, emailDbRecords };
}

async function localEmailTemplateCatalogRecords() {
  let source = '';
  try {
    source = await fs.readFile(emailTemplateCatalogMigrationPath, 'utf8');
  } catch {
    return [];
  }

  const records = [];
  const insertMatch = source.match(/INSERT INTO public\.email_template_catalog[\s\S]*?;\n\nINSERT INTO public\.email_template_versions/);
  const insertSource = insertMatch ? insertMatch[0] : source;
  const matches = insertSource.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*ARRAY\[([\s\S]*?)\]::text\[\]\s*,\s*'(\{[\s\S]*?\})'::jsonb\s*\)/g);

  for (const match of matches) {
    const [, key, group, label, recipient, sourceKey, description, variableSource, previewSource] = match;
    const variables = [...variableSource.matchAll(/'([^']+)'/g)].map((variableMatch) => variableMatch[1]);
    let preview = {};
    try {
      preview = JSON.parse(previewSource);
    } catch {
      preview = {};
    }
    const pl = preview.pl || {};
    const en = preview.en || {};
    const he = preview.he || {};
    records.push({
      key: `email_template_catalog:${key}`,
      record_id: key,
      module: 'email_template_catalog',
      category: 'email_template',
      source_pl: displayValue(pl),
      source_en: displayValue(en),
      current_he: displayValue(he),
      missing_en: !displayValue(en),
      missing_he: !displayValue(he),
      same_as_en: Boolean(displayValue(he) && displayValue(he) === displayValue(en)),
      placeholder_status: tokenStatusFor(displayValue(en), displayValue(he)).status,
      payment_critical: PAYMENT_CRITICAL_RE.test(`${key} ${group} ${description}`),
      human_review_required: true,
      recommended_action: 'Review email/payment template manually; this local catalog fallback does not affect live sending.',
      notes: `Local catalog fallback from migration 173. Label: ${label}. Recipient: ${recipient}. Source: ${sourceKey}. Required variables: ${variables.join(', ')}`,
      safe_to_auto_apply: false,
    });
  }

  return records;
}

async function main() {
  const translations = Object.fromEntries(await Promise.all(LANGUAGES.map(async (language) => [
    language,
    await readJson(path.join(translationDir, `${language}.json`)),
  ])));

  const flat = Object.fromEntries(LANGUAGES.map((language) => [
    language,
    flattenTranslations(translations[language]),
  ]));

  let triAudit = null;
  try {
    triAudit = await readJson(path.join(translationDir, 'audit-pl-en-he.json'));
  } catch {
    triAudit = null;
  }

  const staticPacks = classifyStaticPacks(flat, triAudit);
  const dynamic = await buildDynamicPacks();
  const localEmailRecords = await localEmailTemplateCatalogRecords();
  const dynamicEmailKeys = new Set(dynamic.emailDbRecords.map((record) => record.key));
  const emailRecords = [
    ...staticPacks.emailTemplate,
    ...dynamic.emailDbRecords,
    ...localEmailRecords.filter((record) => !dynamicEmailKeys.has(record.key)),
  ];

  await writeJson(path.join(outputDir, 'static-ui-review.json'), pack(staticPacks.staticUi, {
    description: 'Static PL/EN/HE UI keys requiring manual review. Does not include auto-publishing.',
  }));
  await writeJson(path.join(outputDir, 'advertise-review.json'), pack(staticPacks.advertise, {
    description: 'Advertising and partner copy for manual review only.',
  }));
  await writeJson(path.join(outputDir, 'seo-review.json'), pack(staticPacks.seo, {
    description: 'SEO review pack. SEO HE remains off after this export.',
  }));
  await writeJson(path.join(outputDir, 'shop-review.json'), pack(staticPacks.shop, {
    description: 'Shop static copy review pack. Shop HE remains excluded.',
  }));
  await writeJson(path.join(outputDir, 'email-template-review.json'), pack(emailRecords, {
    description: 'Email/payment/notification template review pack. Sending logic is not changed.',
    readWarnings: dynamic.readWarnings.filter((warning) => warning.includes('email_template') || warning.includes('shop_email')),
  }));
  await writeJson(path.join(outputDir, 'same-as-en-review.json'), pack(staticPacks.sameAsEn, {
    description: 'HE values currently identical to EN, classified for manual decision.',
    sameAsEnBreakdown: staticPacks.sameAsEn.reduce((accumulator, record) => {
      const key = record.same_as_en_classification || 'unknown';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
  }));
  await writeJson(path.join(outputDir, 'dynamic-content-review.json'), pack(dynamic.records, {
    description: 'Read-only dynamic content review pack from Supabase where available.',
    readWarnings: dynamic.readWarnings,
  }));
  await writeJson(path.join(outputDir, 'blog-review.json'), pack(dynamic.records.filter((record) => record.module === 'blog'), {
    description: 'Blog manual translation review pack. public_ready is never set by this export.',
    publicReadyAutomation: false,
  }));

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    liveExportAttempted: liveEnabled,
    outputDir: path.relative(rootDir, outputDir),
    packs: {
      staticUi: staticPacks.staticUi.length,
      advertise: staticPacks.advertise.length,
      seo: staticPacks.seo.length,
      shop: staticPacks.shop.length,
      emailTemplates: emailRecords.length,
      sameAsEn: staticPacks.sameAsEn.length,
      dynamicContent: dynamic.records.length,
      blog: dynamic.records.filter((record) => record.module === 'blog').length,
    },
    sameAsEnBreakdown: staticPacks.sameAsEn.reduce((accumulator, record) => {
      const key = record.same_as_en_classification || 'unknown';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    dynamicReadWarnings: dynamic.readWarnings,
    safety: {
      noPublicReadySet: true,
      noDatabaseUpdates: true,
      noPublicHeActivation: true,
      noBookingPaymentChanges: true,
    },
  };
  await writeJson(path.join(outputDir, 'review-pack-summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
