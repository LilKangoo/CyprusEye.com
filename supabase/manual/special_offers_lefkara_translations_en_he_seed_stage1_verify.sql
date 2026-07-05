-- =====================================================
-- Special Offers Lefkara EN/HE translations seed verify - Stage 1 draft
-- =====================================================
-- Prepared only. Do not run until reviewed.
-- This verification script is read-only.
-- =====================================================

WITH target AS (
  SELECT *
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  (count(*) = 1) AS offer_exists,
  bool_and(slug = 'lefkara-giveaway-2026') AS slug_matches,
  bool_and(status = 'draft') AS campaign_still_draft,
  bool_and(visibility = 'private') AS campaign_still_private,
  bool_and(type = 'contest') AS campaign_still_contest,
  bool_and(winner_selection_mode = 'manual_selection') AS campaign_still_manual_selection
FROM target;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
),
translations AS (
  SELECT t.*
  FROM public.special_offer_translations t
  JOIN target o ON o.id = t.offer_id
)
SELECT
  count(*) FILTER (WHERE lang = 'pl')::integer AS pl_translation_count,
  count(*) FILTER (WHERE lang = 'en')::integer AS en_translation_count,
  count(*) FILTER (WHERE lang = 'he')::integer AS he_translation_count,
  count(*)::integer AS total_translation_count
FROM translations;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
),
duplicates AS (
  SELECT
    offer_id,
    lang
  FROM public.special_offer_translations t
  JOIN target o ON o.id = t.offer_id
  GROUP BY offer_id, lang
  HAVING count(*) > 1
)
SELECT
  count(*)::integer AS duplicate_translation_groups,
  count(*) = 0 AS no_duplicate_translations_by_offer_lang
FROM duplicates;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
),
translations AS (
  SELECT t.*
  FROM public.special_offer_translations t
  JOIN target o ON o.id = t.offer_id
  WHERE t.lang IN ('en', 'he')
)
SELECT
  lang,
  CASE
    WHEN lang = 'en' AND title = 'Win 3 days in Lefkara + a car for 3 days' THEN true
    WHEN lang = 'he' AND title = 'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים' THEN true
    ELSE false
  END AS title_matches_expected,
  short_description IS NOT NULL AND length(trim(short_description)) > 0 AS has_short_description,
  full_description IS NOT NULL AND length(trim(full_description)) > 0 AS has_full_description,
  prize_description IS NOT NULL AND length(trim(prize_description)) > 0 AS has_prize_description,
  rules_html IS NOT NULL AND length(trim(rules_html)) > 0 AS has_rules_html,
  jsonb_typeof(faq_json) = 'array' AS faq_json_is_array,
  jsonb_array_length(faq_json) >= 3 AS faq_has_at_least_3_items,
  seo_title IS NOT NULL AND length(trim(seo_title)) > 0 AS has_seo_title,
  seo_description IS NOT NULL AND length(trim(seo_description)) > 0 AS has_seo_description
FROM translations
ORDER BY lang;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  count(*) FILTER (WHERE t.lang = 'pl')::integer AS pl_translation_count,
  bool_and(t.title = 'Wygraj 3 dni w Lefkarze + auto na 3 dni') FILTER (WHERE t.lang = 'pl') AS pl_title_unchanged,
  bool_and(t.short_description = 'Konkurs CyprusEye.com i WakacjeCypr.com z pobytem w 7 Kamares oraz autem na 3 dni dla zwycięzcy i osoby towarzyszącej.') FILTER (WHERE t.lang = 'pl') AS pl_short_description_unchanged,
  bool_and(t.full_description = 'Weź udział w kampanii Lefkara 2026. Zwycięzca otrzyma pobyt 3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni według dostępności. Aktywności społecznościowe będą weryfikowane ręcznie przez admina, bez automatycznych integracji z Facebookiem lub innymi platformami.') FILTER (WHERE t.lang = 'pl') AS pl_full_description_unchanged,
  bool_and(t.prize_description = '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni: Nissan Note, Kia Rio, Toyota Yaris albo podobna kategoria według dostępności. Nagroda jest dla 1 zwycięzcy i osoby towarzyszącej.') FILTER (WHERE t.lang = 'pl') AS pl_prize_description_unchanged,
  bool_and(t.seo_title = 'Wygraj 3 dni w Lefkarze + auto na 3 dni') FILTER (WHERE t.lang = 'pl') AS pl_seo_title_unchanged,
  bool_and(t.seo_description = 'Konkurs Lefkara 2026: pobyt w 7 Kamares i auto na 3 dni dla zwycięzcy oraz osoby towarzyszącej.') FILTER (WHERE t.lang = 'pl') AS pl_seo_description_unchanged
FROM public.special_offer_translations t
JOIN target o ON o.id = t.offer_id;

SELECT
  to_regclass('public.special_offer_entries') IS NULL AS entries_table_not_required,
  to_regclass('public.special_offer_entry_tasks') IS NULL AS entry_tasks_table_not_required,
  to_regclass('public.special_offer_tasks') IS NULL AS tasks_table_not_required,
  to_regclass('public.special_offer_draws') IS NULL AS draws_table_not_required,
  to_regclass('public.special_offer_draw_entries') IS NULL AS draw_entries_table_not_required,
  to_regclass('public.special_offer_winners') IS NULL AS winners_table_not_required;

-- Expected after EN/HE translation seed:
-- - offer_exists = true
-- - slug_matches = true
-- - campaign_still_draft = true
-- - campaign_still_private = true
-- - pl_translation_count = 1
-- - en_translation_count = 1
-- - he_translation_count = 1
-- - total_translation_count = 3
-- - duplicate_translation_groups = 0
-- - no_duplicate_translations_by_offer_lang = true
-- - EN/HE title_matches_expected = true
-- - EN/HE content/SEO/FAQ checks are true
-- - PL unchanged checks are true
-- - entries/tasks/draws/winners tables are not required in this stage
