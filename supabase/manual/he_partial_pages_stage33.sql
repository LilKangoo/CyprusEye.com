-- Stage 33: PARTIAL-page HE content preparation draft.
-- Review status: every Hebrew value in this file needs human review before COMMIT.
--
-- This file prepares record-level HE content for future page-gated expansion.
-- It does not enable global HE, public /he/ routes, sitemap, hreflang,
-- canonical, indexing, SEO HE, Shop HE, or Blog HE public reads.
--
-- Safe apply flow:
-- 1. Run this file in Supabase SQL Editor as-is to preview the verification rows.
-- 2. Review every Hebrew value with a human/native speaker.
-- 3. Replace the final ROLLBACK with COMMIT only after review.
-- 4. Run supabase/manual/he_partial_pages_stage33_verify.sql.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.he_stage33_set_he_if_empty(target jsonb, value text)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(COALESCE(target->>'he', '')), '') IS NULL
      THEN jsonb_set(COALESCE(target, '{}'::jsonb), '{he}', to_jsonb(value), true)
    ELSE target
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.he_stage33_set_he_array_if_empty(target jsonb, value text[])
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(target->'he', 'null'::jsonb)) <> 'array'
      OR jsonb_array_length(COALESCE(target->'he', '[]'::jsonb)) = 0
      THEN jsonb_set(COALESCE(target, '{}'::jsonb), '{he}', to_jsonb(value), true)
    ELSE target
  END
$$;

-- ---------------------------------------------------------------------------
-- 1) Trips: keep the first expansion record-gated to the reviewed top 3.
-- ---------------------------------------------------------------------------

UPDATE public.trips
SET
  title = pg_temp.he_stage33_set_he_if_empty(title, 'הלגונה הכחולה'),
  description = pg_temp.he_stage33_set_he_if_empty(description, 'טיול יום פרטי מאזור פאפוס אל הלגונה הכחולה: עצירות נוף, נסיעת שטח, זמן לשחייה ושנורקלינג, מים וכיבוד קל ברכב. מתאים למטיילים שרוצים יום טבע רגוע עם נהיגה מודרכת.')
WHERE id = '47fd4793-647b-45fd-a2ce-1ecaa4b95922';

UPDATE public.trips
SET
  title = pg_temp.he_stage33_set_he_if_empty(title, 'מסלול סלע אפרודיטה'),
  description = pg_temp.he_stage33_set_he_if_empty(description, 'טיול יום פרטי מפאפוס דרך נקודות טבע וחוף סביב סלע אפרודיטה: תצפיות, נהיגת שטח, עצירות צילום וחוויה קפריסאית מחוץ למסלול הרגיל.')
WHERE id = '2d937b4f-3da7-4fed-bc06-bdc66eb25612';

UPDATE public.trips
SET
  title = pg_temp.he_stage33_set_he_if_empty(title, 'טרודוס ולפקרה'),
  description = pg_temp.he_stage33_set_he_if_empty(description, 'טיול יום אל הרי טרודוס ולפקרה, עם כפרים מסורתיים, נקודות תצפית, מפלים ואווירה הררית שונה מהחופים של קפריסין.')
WHERE id = 'b0a24297-89f9-4f60-a1d6-b59d84bee877';

-- ---------------------------------------------------------------------------
-- 2) Cars: top 5 can be used for HE car page candidate readiness.
-- Model names intentionally remain brand/model strings; features are the
-- required localized quality field. Optional description_i18n is filled only
-- if that column exists in the deployed schema.
-- ---------------------------------------------------------------------------

UPDATE public.car_offers
SET features = pg_temp.he_stage33_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  'אוטומטי',
  '8 מקומות',
  'דלתות הזזה',
  'אבזור פרימיום',
  'מרווח במיוחד'
]::text[])
WHERE id = '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca';

UPDATE public.car_offers
SET features = pg_temp.he_stage33_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '5 מקומות',
  'חסכוני בדלק',
  'Bluetooth',
  'עיצוב קומפקטי'
]::text[])
WHERE id = '5ba581c3-08c6-47cd-ab29-4d2b9213cebc';

UPDATE public.car_offers
SET features = pg_temp.he_stage33_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '5 מקומות',
  'הנעה היברידית',
  'חניה קלה',
  'נוח לנסיעות יומיות'
]::text[])
WHERE id = '64981eb1-e9a3-41a4-bd93-1fd4c78581d7';

UPDATE public.car_offers
SET features = pg_temp.he_stage33_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '7 מקומות',
  'תא נוסעים פרימיום',
  'נסיעה נוחה',
  'מתאים למשפחות'
]::text[])
WHERE id = '8a1158af-6b05-4723-b2eb-93b130d22f24';

UPDATE public.car_offers
SET features = pg_temp.he_stage33_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '5 מקומות',
  'תא נוסעים מרווח',
  'ניווט',
  'מנוע טורבו'
]::text[])
WHERE id = 'b4f784d3-22d2-421a-829f-2394e3a72a76';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_offers'
      AND column_name = 'description_i18n'
  ) THEN
    EXECUTE $sql$
      UPDATE public.car_offers
      SET description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, CASE id
        WHEN '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca' THEN 'מיניוואן מרווח ונוח למשפחות או קבוצות, עם דלתות הזזה ותא נוסעים גדול לנסיעות ברחבי קפריסין.'
        WHEN '5ba581c3-08c6-47cd-ab29-4d2b9213cebc' THEN 'רכב קומפקטי ונוח לנסיעות עירוניות ובין-עירוניות, מתאים לזוגות או משפחות קטנות.'
        WHEN '64981eb1-e9a3-41a4-bd93-1fd4c78581d7' THEN 'היברידית חסכונית וקלה לנהיגה, מתאימה למטיילים שרוצים רכב קטן ונוח.'
        WHEN '8a1158af-6b05-4723-b2eb-93b130d22f24' THEN 'רכב משפחתי מרווח עם שבעה מקומות, מתאים לטיולים ארוכים ולמשפחות עם ציוד.'
        WHEN 'b4f784d3-22d2-421a-829f-2394e3a72a76' THEN 'קרוסאובר נוח ומרווח עם תנוחת נהיגה גבוהה, מתאים לנסיעות בין ערים וחופים.'
        ELSE NULL
      END)
      WHERE id IN (
        '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
        '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
        '64981eb1-e9a3-41a4-bd93-1fd4c78581d7',
        '8a1158af-6b05-4723-b2eb-93b130d22f24',
        'b4f784d3-22d2-421a-829f-2394e3a72a76'
      )
    $sql$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) POI/map: first expansion must be limited to these top 10 records.
-- ---------------------------------------------------------------------------

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'חוף פיניקודס - הלב של לרנקה'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'טיילת וחוף עירוני מרכזי בלרנקה, עם דקלים, מים רגועים, מסעדות וגישה נוחה למרינה ולמבצר הימי.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'מטייל פיניקודס')
WHERE id = 'larnaca-beach';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'מרינת לימסול - הלב האלגנטי של החוף'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'מרינה מודרנית במרכז לימסול, מתאימה לטיול ערב, מסעדות, יאכטות ונוף עירוני נעים ליד הנמל הישן.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'מטייל במרינה')
WHERE id = 'limassol-marina';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'העיר העתיקה ניקוסיה - מסע בזמן'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'המרכז ההיסטורי של ניקוסיה נמצא בתוך החומות הוונציאניות ומשלב סמטאות, שערים עתיקים, בתי קפה ואת קו הגבול הירוק.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'בלב חומות ניקוסיה')
WHERE id = 'nicosia-old-town';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'גשר האהבה'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'קשת סלע טבעית באזור איה נאפה וקייפ גרקו, פופולרית לצילומים ולתצפית על מים טורקיז.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'גשר האהבה')
WHERE id = 'Love-Bridge';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'חוף קונוס ביי'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'מפרץ חולי ושקט בין איה נאפה לפרוטארס, עם מים צלולים, נוף ירוק וגישה נוחה לשחייה רגועה.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'מפרץ של שלווה')
WHERE id = 'konnos-bay-beach';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'מערות הים של קייפ גרקו'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'מערות וקליפים מרשימים בקייפ גרקו, עם נקודות צילום, מים כחולים ואפשרות לצפייה מהחוף או מהים.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'מחפש מערות')
WHERE id = 'cape-greco-sea-caves';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'מערת הקיקלופ'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'מערה קטנה ליד קייפ גרקו ופרוטארס, הקשורה במסורת המקומית לסיפור אודיסאוס והקיקלופ פוליפמוס.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'בריחה ממערת פוליפמוס')
WHERE id = 'Cyclops-Cave';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'כנסיית סנט לזרוס בלרנקה'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'כנסיית אבן מהמאה התשיעית בלב לרנקה, ידועה באיקונוסטזיס המרשים ובקשר למסורת על קברו של לזרוס.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'שומר השרידים')
WHERE id = 'saint-lazarus-church';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'העיר העתיקה פמגוסטה'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'עיר מבוצרת עם חומות ונציאניות, קתדרלה היסטורית, מבצר אותלו ואווירה חזקה של עבר ימי ביניימי.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'כרוניקן פמגוסטה')
WHERE id = 'famagusta-old-town';

UPDATE public.pois
SET
  name_i18n = pg_temp.he_stage33_set_he_if_empty(name_i18n, 'מבצר לרנקה'),
  description_i18n = pg_temp.he_stage33_set_he_if_empty(description_i18n, 'מבצר ימי קטן בקצה טיילת פיניקודס, ששימש לאורך השנים להגנה על הנמל, תחנת ארטילריה, בית סוהר ומוזיאון.'),
  badge_i18n = pg_temp.he_stage33_set_he_if_empty(badge_i18n, 'שומר הנמל')
WHERE id = 'larnaca-castle';

-- Preview counts inside the transaction.
SELECT 'stage33_trips_top3_he' AS check_name, COUNT(*) AS ready_rows
FROM public.trips
WHERE id IN (
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877'
)
  AND NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
  AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
UNION ALL
SELECT 'stage33_cars_top5_he_features' AS check_name, COUNT(*) AS ready_rows
FROM public.car_offers
WHERE id IN (
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  'b4f784d3-22d2-421a-829f-2394e3a72a76'
)
  AND jsonb_typeof(COALESCE(features->'he', 'null'::jsonb)) = 'array'
  AND jsonb_array_length(features->'he') > 0
UNION ALL
SELECT 'stage33_poi_top10_he' AS check_name, COUNT(*) AS ready_rows
FROM public.pois
WHERE id IN (
  'larnaca-beach', 'limassol-marina', 'nicosia-old-town', 'Love-Bridge',
  'konnos-bay-beach', 'cape-greco-sea-caves', 'Cyclops-Cave',
  'saint-lazarus-church', 'famagusta-old-town', 'larnaca-castle'
)
  AND NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
  AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
  AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL;

-- Keep this as ROLLBACK until human review is complete.
ROLLBACK;
