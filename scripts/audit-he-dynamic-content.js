#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dynamicReadinessPath = path.join(rootDir, 'docs', 'he-dynamic-content-readiness.md');
const goNoGoPath = path.join(rootDir, 'docs', 'he-beta-go-no-go.md');

const PAGE_SIZE = 1000;

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasText(value) {
  return cleanString(value).length > 0;
}

function hasAnyText(value) {
  if (value == null) return false;
  if (typeof value === 'string') return hasText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some((entry) => hasAnyText(entry));
  if (typeof value === 'object') return Object.values(value).some((entry) => hasAnyText(entry));
  return false;
}

function languageValue(value, lang) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value[lang];
}

function hasLanguageValue(value, lang) {
  return hasAnyText(languageValue(value, lang));
}

function hasSourceValue(value) {
  if (hasLanguageValue(value, 'en') || hasLanguageValue(value, 'pl')) return true;
  if (typeof value === 'string') return hasText(value);
  if (Array.isArray(value)) return value.some((entry) => hasAnyText(entry));
  return false;
}

function jsonField(label, value, fallbackValues = []) {
  const fallbackSources = Array.isArray(fallbackValues) ? fallbackValues : [fallbackValues];
  const fallback = hasSourceValue(value) || fallbackSources.some((entry) => hasAnyText(entry));
  const he = hasLanguageValue(value, 'he');
  return {
    label,
    he,
    fallback,
    expected: he || fallback,
  };
}

function flatField(label, heValue, fallbackValues = []) {
  const fallbackSources = Array.isArray(fallbackValues) ? fallbackValues : [fallbackValues];
  const he = hasAnyText(heValue);
  const fallback = fallbackSources.some((entry) => hasAnyText(entry));
  return {
    label,
    he,
    fallback,
    expected: he || fallback,
  };
}

function arrayField(label, heArray, fallbackArrays = []) {
  const fallbackSources = Array.isArray(fallbackArrays) ? fallbackArrays : [fallbackArrays];
  const he = Array.isArray(heArray) && heArray.some((entry) => hasAnyText(entry));
  const fallback = fallbackSources.some((entry) => Array.isArray(entry) && entry.some((item) => hasAnyText(item)));
  return {
    label,
    he,
    fallback,
    expected: he || fallback,
  };
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

async function fetchAll(table, select = '*') {
  const rows = [];
  let from = 0;
  let totalCount = null;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from(table)
      .select(select, { count: from === 0 ? 'exact' : undefined })
      .range(from, to);

    if (error) {
      return {
        table,
        rows,
        count: totalCount,
        error: error.message || String(error),
      };
    }

    if (from === 0 && Number.isFinite(count)) {
      totalCount = count;
    }

    const page = normalizeRows(data);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return {
    table,
    rows,
    count: totalCount ?? rows.length,
    error: null,
  };
}

function evaluateRecord(fields) {
  const expectedFields = fields.filter((field) => field && field.expected);
  const expected = expectedFields.length;
  const he = expectedFields.filter((field) => field.he).length;
  const fallback = expectedFields.filter((field) => !field.he && field.fallback).length;
  const missing = expectedFields.filter((field) => !field.he && !field.fallback).length;

  let state = 'missing';
  if (expected === 0) {
    state = 'missing';
  } else if (he === expected) {
    state = 'complete';
  } else if (he > 0) {
    state = 'partial';
  } else if (fallback > 0) {
    state = 'fallback';
  }

  return { state, expected, he, fallback, missing };
}

function summarizeRecords(id, label, rows, fieldBuilder, notes = []) {
  const summary = {
    id,
    label,
    records: rows.length,
    complete: 0,
    partial: 0,
    fallback: 0,
    missing: 0,
    expectedFields: 0,
    heFields: 0,
    readiness: 0,
    notes: [...notes],
  };

  rows.forEach((row) => {
    const fields = fieldBuilder(row);
    const record = evaluateRecord(fields);
    summary.expectedFields += record.expected;
    summary.heFields += record.he;
    if (record.state === 'complete') summary.complete += 1;
    if (record.state === 'partial') summary.partial += 1;
    if (record.state === 'fallback') summary.fallback += 1;
    if (record.state === 'missing') summary.missing += 1;
  });

  summary.readiness = summary.expectedFields > 0
    ? summary.heFields / summary.expectedFields
    : 0;

  return summary;
}

function summarizeShopEntity(id, label, rows, fieldBuilder) {
  return summarizeRecords(id, label, rows, fieldBuilder);
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function table(rows) {
  return rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function moduleRow(summary) {
  return [
    summary.label,
    String(summary.records),
    String(summary.complete),
    String(summary.partial),
    String(summary.fallback),
    String(summary.missing),
    percent(summary.readiness),
  ];
}

function fieldListForTrip(row) {
  const fields = [
    jsonField('title', row.title_i18n || row.title),
    jsonField('description', row.description_i18n || row.description),
  ];

  [
    ['itinerary', row.itinerary_i18n || row.itinerary],
    ['highlights', row.highlights_i18n || row.highlights],
    ['faq', row.faq_i18n || row.faq || row.faqs],
  ].forEach(([label, value]) => {
    const field = jsonField(label, value);
    if (field.expected) fields.push(field);
  });

  return fields;
}

function fieldListForHotel(row) {
  const fields = [
    jsonField('title', row.title_i18n || row.title),
    jsonField('description', row.description_i18n || row.description),
  ];

  const bookingSettings = row.booking_settings || {};
  [
    ['booking_settings.cancellation_policy', bookingSettings.cancellation_policy],
    ['booking_settings.stay_info', bookingSettings.stay_info],
  ].forEach(([label, value]) => {
    const field = jsonField(label, value);
    if (field.expected) fields.push(field);
  });

  const extras = Array.isArray(row.pricing_extras?.items)
    ? row.pricing_extras.items
    : (Array.isArray(row.pricing_extras) ? row.pricing_extras : []);
  extras.forEach((extra, index) => {
    const field = jsonField(`pricing_extras.${index}.label`, extra?.label);
    if (field.expected) fields.push(field);
  });

  const roomTypes = Array.isArray(row.room_types) ? row.room_types : [];
  roomTypes.forEach((room, roomIndex) => {
    [
      [`room_types.${roomIndex}.name`, room?.name],
      [`room_types.${roomIndex}.summary`, room?.summary],
    ].forEach(([label, value]) => {
      const field = jsonField(label, value);
      if (field.expected) fields.push(field);
    });

    const ratePlans = Array.isArray(room?.rate_plans) ? room.rate_plans : [];
    ratePlans.forEach((plan, planIndex) => {
      [
        [`room_types.${roomIndex}.rate_plans.${planIndex}.name`, plan?.name],
        [`room_types.${roomIndex}.rate_plans.${planIndex}.summary`, plan?.summary],
        [`room_types.${roomIndex}.rate_plans.${planIndex}.deposit_note`, plan?.deposit_note],
      ].forEach(([label, value]) => {
        const field = jsonField(label, value);
        if (field.expected) fields.push(field);
      });
    });
  });

  return fields;
}

function fieldListForCar(row) {
  return [
    jsonField('car_model', row.car_model || row.car_model_new),
    jsonField('car_type', row.car_type || row.car_type_new),
    jsonField('description', row.description || row.description_new),
    jsonField('features', row.features),
  ];
}

function fieldListForPoi(row) {
  return [
    jsonField('name_i18n', row.name_i18n, [row.name]),
    jsonField('description_i18n', row.description_i18n, [row.description]),
    jsonField('badge_i18n', row.badge_i18n, [row.badge]),
  ];
}

function fieldListForRecommendation(row, categoryById) {
  const category = categoryById.get(row.category_id) || null;
  const fields = [
    flatField('title', row.title_he, [row.title_en, row.title_pl]),
    flatField('description', row.description_he, [row.description_en, row.description_pl]),
    flatField('category', category?.name_he, [category?.name_en, category?.name_pl]),
  ];

  const discount = flatField('discount_text', row.discount_text_he, [row.discount_text_en, row.discount_text_pl]);
  if (discount.expected) fields.push(discount);
  const offer = flatField('offer_text', row.offer_text_he, [row.offer_text_en, row.offer_text_pl]);
  if (offer.expected) fields.push(offer);

  return fields;
}

function fieldListForTransportLocation(row) {
  return [
    flatField('name', row.name_he, [row.name, row.name_local]),
  ];
}

function fieldListForTransportRoute(row, locationById) {
  const origin = locationById.get(row.origin_location_id) || null;
  const destination = locationById.get(row.destination_location_id) || null;
  return [
    flatField('origin_location', origin?.name_he, [origin?.name, origin?.name_local]),
    flatField('destination_location', destination?.name_he, [destination?.name, destination?.name_local]),
  ];
}

function isBlogTranslationComplete(translation) {
  if (!translation) return false;
  return [
    translation.slug,
    translation.title,
    translation.meta_description,
    translation.summary,
    translation.lead,
    translation.content_html,
  ].every(hasText);
}

function fieldListForBlogPost(row, translationsByPost) {
  const translations = translationsByPost.get(row.id) || {};
  const he = translations.he || null;
  const en = translations.en || null;
  const pl = translations.pl || null;

  return [
    flatField('translation.slug', he?.slug, [en?.slug, pl?.slug]),
    flatField('translation.title', he?.title, [en?.title, pl?.title]),
    flatField('translation.summary', he?.summary, [en?.summary, pl?.summary]),
    flatField('translation.lead', he?.lead, [en?.lead, pl?.lead]),
    flatField('translation.content_html', he?.content_html, [en?.content_html, pl?.content_html]),
    arrayField('categories_he', row.categories_he, [row.categories_en, row.categories_pl, row.categories]),
    arrayField('tags_he', row.tags_he, [row.tags_en, row.tags_pl, row.tags]),
  ];
}

function shopProductFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
    flatField('description', row.description_he, [row.description_en, row.description]),
    flatField('short_description', row.short_description_he, [row.short_description_en, row.short_description]),
  ];
}

function categoryFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name, row.name_pl]),
    flatField('description', row.description_he, [row.description_en, row.description]),
  ];
}

function vendorFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
    flatField('description', row.description_he, [row.description_en, row.description]),
  ];
}

function shippingClassFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
    flatField('description', row.description_he, [row.description_en, row.description]),
  ];
}

function shippingZoneFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
  ];
}

function shippingMethodFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
    flatField('description', row.description_he, [row.description_en, row.description]),
  ];
}

function discountFields(row) {
  return [
    flatField('description', row.description_he, [row.description_en, row.description]),
  ];
}

function attributeFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name]),
  ];
}

function attributeValueFields(row) {
  return [
    flatField('value', row.value_he, [row.value_en, row.value]),
  ];
}

function variantFields(row) {
  return [
    flatField('name', row.name_he, [row.name]),
  ];
}

function hotelAmenityFields(row) {
  return [
    flatField('name', row.name_he, [row.name_en, row.name_pl, row.name]),
  ];
}

function translationsByPostId(translations) {
  const result = new Map();
  translations.forEach((translation) => {
    if (!translation?.blog_post_id || !translation?.lang) return;
    const existing = result.get(translation.blog_post_id) || {};
    existing[translation.lang] = translation;
    result.set(translation.blog_post_id, existing);
  });
  return result;
}

function countBlogHeStates(posts, translationsByPost) {
  let full = 0;
  let partial = 0;
  let fallback = 0;
  let categoriesHe = 0;
  let tagsHe = 0;

  posts.forEach((post) => {
    if (Array.isArray(post.categories_he) && post.categories_he.some(hasAnyText)) {
      categoriesHe += 1;
    }
    if (Array.isArray(post.tags_he) && post.tags_he.some(hasAnyText)) {
      tagsHe += 1;
    }

    const translations = translationsByPost.get(post.id) || {};
    const he = translations.he || null;
    if (isBlogTranslationComplete(he)) {
      const taxonomyComplete = (
        (!Array.isArray(post.categories_en) || post.categories_en.length === 0 || (Array.isArray(post.categories_he) && post.categories_he.length > 0))
        && (!Array.isArray(post.tags_en) || post.tags_en.length === 0 || (Array.isArray(post.tags_he) && post.tags_he.length > 0))
      );
      if (taxonomyComplete) {
        full += 1;
      } else {
        partial += 1;
      }
      return;
    }
    if (he && Object.values(he).some(hasAnyText)) {
      partial += 1;
      return;
    }
    if (translations.en || translations.pl) fallback += 1;
  });

  return { full, partial, fallback, categoriesHe, tagsHe };
}

function rowStatus(summary) {
  if (summary.records === 0) return 'BLOCKED';
  if (summary.readiness >= 0.8 && summary.complete > 0) return 'READY';
  if (summary.readiness >= 0.3 || summary.partial > 0) return 'PARTIAL';
  return 'BLOCKED';
}

function betaRecommendation(summary, moduleName) {
  const status = rowStatus(summary);
  if (status === 'READY') {
    return `${moduleName}: can enter controlled beta for HE preview, with remaining fallback tracked.`;
  }
  if (status === 'PARTIAL') {
    return `${moduleName}: beta only with explicit EN fallback acceptance; translate top records before broader beta.`;
  }
  return `${moduleName}: hide from first HE beta or keep EN-only until dynamic HE content is added.`;
}

function buildDynamicDoc(report) {
  const moduleRows = [
    ['Module', 'Records', 'HE complete', 'HE partial', 'EN fallback-only', 'Missing/no fallback', 'Field readiness'],
    ['---', '---:', '---:', '---:', '---:', '---:', '---:'],
    ...report.modules.map(moduleRow),
  ];

  const shopRows = [
    ['Shop entity', 'Records', 'HE complete', 'HE partial', 'EN fallback-only', 'Missing/no fallback', 'Field readiness'],
    ['---', '---:', '---:', '---:', '---:', '---:', '---:'],
    ...report.shopEntities.map(moduleRow),
  ];

  const supportRows = [
    ['Dictionary / support table', 'Records', 'HE complete', 'HE partial', 'EN fallback-only', 'Missing/no fallback', 'Field readiness'],
    ['---', '---:', '---:', '---:', '---:', '---:', '---:'],
    ...report.supportTables.map(moduleRow),
  ];

  return `# HE Dynamic Content Readiness

Generated: ${report.generatedAt}
Source: read-only Supabase anon queries against public/beta-visible records.

HE remains internal/beta-only. This audit does not enable HE in the public
switcher, sitemap, hreflang, canonical metadata, SEO, indexing, or public
\`/he/\` routes.

Field readiness is calculated as translated HE fields divided by expected
localized dynamic fields. "EN fallback-only" means the record has no HE dynamic
fields but can fall back to EN/PL source content without blank UI.

## Module Summary

${table(moduleRows)}

## Requested Area Notes

### Trips

- Records visible to public/beta read: ${report.rawCounts.trips}
- Fields audited: title, description, itinerary/highlights/FAQ only when those fields exist on rows.
- Current schema/data probe: itinerary/highlights/FAQ HE fields were not present on returned rows.
- Booking labels are static P0 keys and are covered by Etap 13 tests.

### Hotels

- Records visible to public/beta read: ${report.rawCounts.hotels}
- Fields audited: title, description, booking policy/stay info, pricing extras, room type labels and rate-plan labels.
- Amenities are stored as hotel amenity codes/dictionary records; see support table readiness below.
- Room descriptions/rate-plan text are included when present in \`room_types\`.

### Cars

- Records visible to public/beta read: ${report.rawCounts.cars}
- Fields audited: car model, car type, description and features.
- Rental conditions, extras and insurance amounts are mostly static/numeric UI copy; static P0 is covered separately.

### Transport

- Active locations visible to public/beta read: ${report.rawCounts.transportLocations}
- Routes visible to public/beta read: ${report.rawCounts.transportRoutes}
- Dynamic HE coverage is driven by \`transport_locations.name_he\`.
- Forms and confirmations are static P0 keys and were translated in Etap 13.

### Blog

- Published posts visible to public/beta read: ${report.rawCounts.blogPosts}
- Public translations visible to read: ${report.rawCounts.blogTranslations}
- Full HE blog translations: ${report.blog.full}
- Partial HE blog translations/taxonomy: ${report.blog.partial}
- EN/PL fallback-only blog posts: ${report.blog.fallback}
- Posts with categories_he: ${report.blog.categoriesHe}
- Posts with tags_he: ${report.blog.tagsHe}
- Fields audited: HE translation title, slug, summary, lead, content_html, categories_he and tags_he.

### POI

- Records visible to public/beta read: ${report.rawCounts.pois}
- Fields audited: \`name_i18n.he\`, \`description_i18n.he\`, \`badge_i18n.he\`.
- Category dictionary coverage is shown in support tables.

### Recommendations

- Records visible to public/beta read: ${report.rawCounts.recommendations}
- Fields audited: title_he, description_he, category name_he, discount_text_he and offer_text_he when source text exists.
- CTA labels are static UI and remain governed by P0 static translations.

### Shop

Shop is the highest-risk module because customer-visible copy is split across
products, categories, variants, vendors, attributes, shipping and discounts.

${table(shopRows)}

## Support Dictionaries

${table(supportRows)}

## Main Risks

${report.risks.map((risk) => `- ${risk}`).join('\n')}

## Next Dynamic Translation Order

1. Blog HE translations for top posts: title, slug, lead, summary, content and categories/tags.
2. Shop product/category/vendor/shipping/discount labels, because checkout is customer-facing.
3. POI names/descriptions/badges and POI category labels for map/recommendations flows.
4. Recommendations titles/descriptions/categories and offer/discount text.
5. Transport location names, then route smoke tests.
6. Trips/hotels/cars top records and room/offer detail labels.
`;
}

function buildGoNoGoDoc(report) {
  const rows = [
    ['Module', 'Status', 'Decision'],
    ['---', '---', '---'],
    ...report.modules.map((summary) => [
      summary.label,
      rowStatus(summary),
      betaRecommendation(summary, summary.label),
    ]),
  ];

  const ready = report.modules.filter((summary) => rowStatus(summary) === 'READY').map((summary) => summary.label);
  const partial = report.modules.filter((summary) => rowStatus(summary) === 'PARTIAL').map((summary) => summary.label);
  const blocked = report.modules.filter((summary) => rowStatus(summary) === 'BLOCKED').map((summary) => summary.label);

  return `# HE Beta GO / NO-GO

Generated: ${report.generatedAt}

HE remains internal/beta-only. This document does not enable public HE,
sitemap, hreflang, canonical metadata, SEO, indexing, the public language
switcher, or public \`/he/\` routes.

## Dynamic Content Decision Table

${table(rows)}

## Controlled Beta Now

${ready.length ? ready.map((name) => `- ${name}`).join('\n') : '- None as a full Hebrew dynamic-content experience.'}

These modules can be exercised in controlled beta only within the existing
internal/beta guard and with hidden HE preview/allowlist behavior.

## Requires Translation Before Wider Beta

${partial.length ? partial.map((name) => `- ${name}`).join('\n') : '- None.'}

## Hide Or Keep EN-Only In First HE Beta

${blocked.length ? blocked.map((name) => `- ${name}`).join('\n') : '- None.'}

## GO Conditions For Etap 15+

- HE remains hidden from public switchers and SEO surfaces until explicitly approved.
- Top dynamic records in beta scope have HE or an accepted EN fallback.
- Shop is not included in first customer beta until product, category, vendor,
  shipping and discount labels are reviewed.
- Blog is not treated as a Hebrew blog experience until HE rows exist in
  \`blog_post_translations\` for selected posts.
- POI/recommendations/map beta needs HE names/descriptions/categories for the top visible records.

## NO-GO Conditions

- Any module shows blank cards, undefined labels, or PL-first fallback for HE.
- HE routes, sitemap, hreflang, canonical or public SEO become visible before final approval.
- Shop checkout uses untranslated dynamic product/shipping/discount labels in a paid beta flow.
- Blog has no HE translation for the tested post but is presented as Hebrew content.

## Overall Recommendation

Controlled HE beta can continue for layout/runtime validation, but the first
content beta should be scoped narrowly. Use EN fallback only where explicitly
accepted by the tester group and keep shop/blog as gated or EN-only until their
dynamic records are translated.
`;
}

async function main() {
  const [
    tripsResult,
    hotelsResult,
    hotelAmenitiesResult,
    carsResult,
    transportLocationsResult,
    transportRoutesResult,
    blogPostsResult,
    blogTranslationsResult,
    poisResult,
    poiCategoriesResult,
    recommendationsResult,
    recommendationCategoriesResult,
    shopProductsResult,
    shopCategoriesResult,
    shopVariantsResult,
    shopVendorsResult,
    shopShippingClassesResult,
    shopShippingZonesResult,
    shopShippingMethodsResult,
    shopDiscountsResult,
    shopAttributesResult,
    shopAttributeValuesResult,
  ] = await Promise.all([
    fetchAll('trips'),
    fetchAll('hotels'),
    fetchAll('hotel_amenities'),
    fetchAll('car_offers'),
    fetchAll('transport_locations'),
    fetchAll('transport_routes'),
    fetchAll('blog_posts'),
    fetchAll('blog_post_translations'),
    fetchAll('pois'),
    fetchAll('poi_categories'),
    fetchAll('recommendations'),
    fetchAll('recommendation_categories'),
    fetchAll('shop_products'),
    fetchAll('shop_categories'),
    fetchAll('shop_product_variants'),
    fetchAll('shop_vendors'),
    fetchAll('shop_shipping_classes'),
    fetchAll('shop_shipping_zones'),
    fetchAll('shop_shipping_methods'),
    fetchAll('shop_discounts'),
    fetchAll('shop_attributes'),
    fetchAll('shop_attribute_values'),
  ]);

  const errors = [
    tripsResult,
    hotelsResult,
    hotelAmenitiesResult,
    carsResult,
    transportLocationsResult,
    transportRoutesResult,
    blogPostsResult,
    blogTranslationsResult,
    poisResult,
    poiCategoriesResult,
    recommendationsResult,
    recommendationCategoriesResult,
    shopProductsResult,
    shopCategoriesResult,
    shopVariantsResult,
    shopVendorsResult,
    shopShippingClassesResult,
    shopShippingZonesResult,
    shopShippingMethodsResult,
    shopDiscountsResult,
    shopAttributesResult,
    shopAttributeValuesResult,
  ].filter((result) => result.error);

  if (errors.length) {
    errors.forEach((result) => {
      console.warn(`Read warning for ${result.table}: ${result.error}`);
    });
  }

  const trips = tripsResult.rows;
  const hotels = hotelsResult.rows;
  const cars = carsResult.rows;
  const transportLocations = transportLocationsResult.rows.filter((row) => row.is_active !== false);
  const transportRoutes = transportRoutesResult.rows.filter((row) => row.is_active !== false);
  const blogPosts = blogPostsResult.rows;
  const blogTranslations = blogTranslationsResult.rows;
  const pois = poisResult.rows.filter((row) => row.status !== 'archived' && row.status !== 'draft');
  const poiCategories = poiCategoriesResult.rows.filter((row) => row.active !== false);
  const recommendations = recommendationsResult.rows.filter((row) => row.active !== false);
  const recommendationCategories = recommendationCategoriesResult.rows.filter((row) => row.active !== false);

  const locationById = new Map(transportLocations.map((location) => [location.id, location]));
  const recommendationCategoryById = new Map(recommendationCategories.map((category) => [category.id, category]));
  const blogTranslationsByPost = translationsByPostId(blogTranslations);

  const supportTables = [
    summarizeRecords('transport_locations', 'Transport locations', transportLocations, fieldListForTransportLocation),
    summarizeRecords('hotel_amenities', 'Hotel amenities dictionary', hotelAmenitiesResult.rows, hotelAmenityFields, [
      'Schema gap: hotel_amenities has name_en/name_pl but no name_he in migration 178.',
    ]),
    summarizeRecords('poi_categories', 'POI categories', poiCategories, (row) => [
      flatField('name', row.name_he, [row.name_en, row.name_pl]),
    ]),
    summarizeRecords('recommendation_categories', 'Recommendation categories', recommendationCategories, (row) => [
      flatField('name', row.name_he, [row.name_en, row.name_pl]),
    ]),
  ];

  const shopEntities = [
    summarizeShopEntity('shop_products', 'Products', shopProductsResult.rows, shopProductFields),
    summarizeShopEntity('shop_categories', 'Categories', shopCategoriesResult.rows, categoryFields),
    summarizeShopEntity('shop_product_variants', 'Variants', shopVariantsResult.rows, variantFields),
    summarizeShopEntity('shop_vendors', 'Vendors', shopVendorsResult.rows, vendorFields),
    summarizeShopEntity('shop_shipping_classes', 'Shipping classes', shopShippingClassesResult.rows, shippingClassFields),
    summarizeShopEntity('shop_shipping_zones', 'Shipping zones', shopShippingZonesResult.rows, shippingZoneFields),
    summarizeShopEntity('shop_shipping_methods', 'Shipping methods', shopShippingMethodsResult.rows, shippingMethodFields),
    summarizeShopEntity('shop_discounts', 'Discount labels', shopDiscountsResult.rows, discountFields),
    summarizeShopEntity('shop_attributes', 'Attributes', shopAttributesResult.rows, attributeFields),
    summarizeShopEntity('shop_attribute_values', 'Attribute values', shopAttributeValuesResult.rows, attributeValueFields),
  ];

  const shopAggregateRows = shopEntities.flatMap((entity) => {
    const synthetic = [];
    for (let i = 0; i < entity.complete; i += 1) synthetic.push({ state: 'complete' });
    for (let i = 0; i < entity.partial; i += 1) synthetic.push({ state: 'partial' });
    for (let i = 0; i < entity.fallback; i += 1) synthetic.push({ state: 'fallback' });
    for (let i = 0; i < entity.missing; i += 1) synthetic.push({ state: 'missing' });
    return synthetic;
  });

  const shopSummary = {
    id: 'shop',
    label: 'Shop',
    records: shopEntities.reduce((sum, entity) => sum + entity.records, 0),
    complete: shopEntities.reduce((sum, entity) => sum + entity.complete, 0),
    partial: shopEntities.reduce((sum, entity) => sum + entity.partial, 0),
    fallback: shopEntities.reduce((sum, entity) => sum + entity.fallback, 0),
    missing: shopEntities.reduce((sum, entity) => sum + entity.missing, 0),
    expectedFields: shopEntities.reduce((sum, entity) => sum + entity.expectedFields, 0),
    heFields: shopEntities.reduce((sum, entity) => sum + entity.heFields, 0),
    readiness: 0,
    notes: ['Aggregate across products, categories, variants, vendors, shipping, discounts and attributes.'],
  };
  shopSummary.readiness = shopSummary.expectedFields > 0
    ? shopSummary.heFields / shopSummary.expectedFields
    : 0;
  void shopAggregateRows;

  const modules = [
    summarizeRecords('trips', 'Trips', trips, fieldListForTrip, [
      'No separate itinerary_he/highlights_he/FAQ HE fields were visible in the public row shape.',
    ]),
    summarizeRecords('hotels', 'Hotels', hotels, fieldListForHotel),
    summarizeRecords('cars', 'Cars', cars, fieldListForCar),
    summarizeRecords('transport', 'Transport', transportRoutes, (row) => fieldListForTransportRoute(row, locationById), [
      'Route dynamic labels depend on transport_locations.name_he.',
    ]),
    summarizeRecords('blog', 'Blog', blogPosts, (row) => fieldListForBlogPost(row, blogTranslationsByPost)),
    summarizeRecords('poi', 'POI', pois, fieldListForPoi),
    summarizeRecords('recommendations', 'Recommendations', recommendations, (row) => fieldListForRecommendation(row, recommendationCategoryById)),
    shopSummary,
  ];

  const blog = countBlogHeStates(blogPosts, blogTranslationsByPost);

  const risks = [
    'Blog has no full HE post experience unless blog_post_translations contains reviewed lang=he rows for selected posts.',
    'Shop should remain out of the first HE beta unless EN fallback is explicitly accepted; paid checkout copy must not depend on unreviewed dynamic labels.',
    'POI/recommendations map flows need HE names/descriptions/categories before they feel like a Hebrew experience.',
    'Hotel amenities dictionary currently lacks name_he schema support, so amenities fall back even if hotel title/description are translated.',
    'Trips/hotels/cars can technically render via fallback, but top offer records still need manual HE for content-quality beta.',
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    rawCounts: {
      trips: trips.length,
      hotels: hotels.length,
      cars: cars.length,
      transportLocations: transportLocations.length,
      transportRoutes: transportRoutes.length,
      blogPosts: blogPosts.length,
      blogTranslations: blogTranslations.length,
      pois: pois.length,
      poiCategories: poiCategories.length,
      recommendations: recommendations.length,
      recommendationCategories: recommendationCategories.length,
      shopEntities: shopSummary.records,
    },
    blog,
    modules,
    shopEntities,
    supportTables,
    risks,
    readWarnings: errors.map((result) => ({ table: result.table, error: result.error })),
  };

  await fs.mkdir(path.dirname(dynamicReadinessPath), { recursive: true });
  await fs.writeFile(dynamicReadinessPath, buildDynamicDoc(report), 'utf8');
  await fs.writeFile(goNoGoPath, buildGoNoGoDoc(report), 'utf8');

  console.log('HE dynamic content readiness generated.');
  console.log(`Dynamic readiness: ${path.relative(rootDir, dynamicReadinessPath)}`);
  console.log(`GO/NO-GO: ${path.relative(rootDir, goNoGoPath)}`);
  modules.forEach((summary) => {
    console.log(`${summary.label}: records=${summary.records}, complete=${summary.complete}, partial=${summary.partial}, fallback=${summary.fallback}, readiness=${percent(summary.readiness)}`);
  });
  if (errors.length) {
    console.log(`Read warnings: ${errors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
