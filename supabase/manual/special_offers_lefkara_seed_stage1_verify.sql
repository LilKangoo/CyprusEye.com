-- =====================================================
-- Special Offers Lefkara campaign seed verify - Stage 1 draft
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
  count(*)::integer AS matching_offer_count,
  bool_and(type = 'contest') AS type_is_contest,
  bool_and(winner_selection_mode = 'manual_selection') AS winner_selection_mode_is_manual,
  bool_and(status = 'draft') AS status_is_draft,
  bool_and(visibility = 'private') AS visibility_is_private,
  bool_and(timezone = 'Asia/Nicosia') AS timezone_is_asia_nicosia,
  bool_and(start_at = timestamptz '2026-07-15 00:00:00+03') AS start_at_matches,
  bool_and(end_at = timestamptz '2026-09-15 23:59:00+03') AS end_at_matches,
  bool_and(winner_announce_at = timestamptz '2026-09-20 12:00:00+03') AS winner_announce_at_matches,
  bool_and(requires_login) AS requires_login_enabled,
  bool_and(requires_form) AS requires_form_enabled,
  bool_and(requires_manual_approval) AS manual_approval_enabled,
  bool_and(allow_bonus_points) AS bonus_points_enabled,
  bool_and(settings_json ->> 'partner' = '7 Kamares') AS partner_matches,
  bool_and(settings_json ->> 'requested_timezone_label' = 'Asia/Nicosia') AS settings_timezone_label_matches,
  bool_and(settings_json -> 'mandatory_conditions' IS NOT NULL) AS mandatory_conditions_present,
  bool_and(settings_json -> 'extra_manual_activity' IS NOT NULL) AS extra_manual_activity_present,
  bool_and(settings_json #>> '{social_verification,mode}' = 'manual') AS social_verification_manual,
  bool_and(settings_json #>> '{social_verification,automatic_integrations}' = 'false') AS social_integrations_disabled
FROM target;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  t.lang,
  t.title,
  CASE WHEN t.title = 'Wygraj 3 dni w Lefkarze + auto na 3 dni' THEN 'ok' ELSE 'mismatch' END AS title_status,
  CASE WHEN t.short_description IS NOT NULL AND length(trim(t.short_description)) > 0 THEN 'ok' ELSE 'missing' END AS short_description_status,
  CASE WHEN t.rules_html IS NOT NULL AND length(trim(t.rules_html)) > 0 THEN 'ok' ELSE 'missing' END AS rules_status,
  jsonb_array_length(t.faq_json) AS faq_count
FROM public.special_offer_translations t
JOIN target o ON o.id = t.offer_id
ORDER BY t.lang;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  count(*)::integer AS translation_count,
  count(*) FILTER (WHERE t.lang = 'pl')::integer AS pl_translation_count,
  count(*) FILTER (WHERE t.lang IN ('en', 'he'))::integer AS en_he_placeholder_count
FROM public.special_offer_translations t
JOIN target o ON o.id = t.offer_id;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  count(*)::integer AS prize_count,
  bool_and(name = '3 dni / 2 noce w 7 Kamares + auto na 3 dni') AS prize_name_matches,
  bool_and(sponsor_name = '7 Kamares') AS sponsor_matches,
  bool_and(quantity = 1) AS quantity_matches
FROM public.special_offer_prizes p
JOIN target o ON o.id = p.offer_id;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
),
expected_links(link_type, url) AS (
  VALUES
    ('cars', '/car.html?lang=pl'),
    ('transport', '/transport.html?lang=pl'),
    ('trips', '/trips.html?lang=pl'),
    ('custom', '/special-offers/lefkara-giveaway-2026?lang=pl')
)
SELECT
  e.link_type,
  e.url,
  CASE WHEN l.id IS NOT NULL THEN 'exists' ELSE 'missing' END AS link_status,
  l.label,
  l.resource_id,
  l.is_primary,
  CASE WHEN l.resource_id IS NULL THEN 'url_only' ELSE 'has_resource_id' END AS resource_id_status
FROM expected_links e
LEFT JOIN target o ON true
LEFT JOIN public.special_offer_links l
  ON l.offer_id = o.id
 AND l.link_type = e.link_type
 AND l.url = e.url
ORDER BY e.link_type;

WITH target AS (
  SELECT id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026'
)
SELECT
  count(*)::integer AS unexpected_hotel_links
FROM public.special_offer_links l
JOIN target o ON o.id = l.offer_id
WHERE l.link_type = 'hotels';

SELECT
  to_regclass('public.special_offer_entries') IS NULL AS entries_table_not_created,
  to_regclass('public.special_offer_entry_tasks') IS NULL AS entry_tasks_table_not_created,
  to_regclass('public.special_offer_tasks') IS NULL AS tasks_table_not_created,
  to_regclass('public.special_offer_draws') IS NULL AS draws_table_not_created,
  to_regclass('public.special_offer_draw_entries') IS NULL AS draw_entries_table_not_created,
  to_regclass('public.special_offer_winners') IS NULL AS winners_table_not_created;

-- Expected after seed:
-- - matching_offer_count = 1
-- - type_is_contest = true
-- - winner_selection_mode_is_manual = true
-- - status_is_draft = true
-- - visibility_is_private = true
-- - translation_count = 1
-- - pl_translation_count = 1
-- - en_he_placeholder_count = 0
-- - prize_count = 1
-- - cars/transport/trips/custom links exist and are URL-only
-- - unexpected_hotel_links = 0
-- - entries/tasks/draws/winners tables are not created in Stage 1
