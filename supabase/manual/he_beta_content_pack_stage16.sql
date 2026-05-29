-- Stage 16: controlled HE beta content pack.
-- Review status: needs human review for every value in this file.
-- This file is intentionally non-destructive and ends with ROLLBACK.
-- Replace ROLLBACK with COMMIT only after editorial review in Supabase SQL Editor.
--
-- This does not enable public HE, sitemap, hreflang, canonical, SEO, indexing,
-- public switchers, or public /he/ routes.

BEGIN;

CREATE TEMP FUNCTION he_beta_set_he_if_empty(target jsonb, value text)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(COALESCE(target->>'he', '')), '') IS NULL
      THEN jsonb_set(COALESCE(target, '{}'::jsonb), '{he}', to_jsonb(value), true)
    ELSE target
  END
$$;

CREATE TEMP FUNCTION he_beta_set_he_array_if_empty(target jsonb, value text[])
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN jsonb_typeof(COALESCE(target->'he', 'null'::jsonb)) = 'array'
      AND jsonb_array_length(target->'he') > 0
      THEN target
    ELSE jsonb_set(COALESCE(target, '{}'::jsonb), '{he}', to_jsonb(value), true)
  END
$$;

CREATE TEMP FUNCTION he_beta_doc(VARIADIC paragraphs text[])
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'type', 'doc',
    'content', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', paragraph_text))
        )
      )
      FROM unnest(paragraphs) AS paragraph_text
    ), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------
-- 1) Transport locations: 9 selected beta locations.
-- ---------------------------------------------------------------------------

UPDATE public.transport_locations
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  ELSE CASE code
    WHEN 'larnaca' THEN 'לרנקה'
    WHEN 'larnaca_airport' THEN 'נמל התעופה לרנקה'
    WHEN 'paphos' THEN 'פאפוס'
    WHEN 'paphos_airport' THEN 'נמל התעופה פאפוס'
    WHEN 'ayia_napa' THEN 'איה נאפה'
    WHEN 'protaras' THEN 'פרוטארס'
    WHEN 'limassol' THEN 'לימסול'
    WHEN 'nicosia' THEN 'ניקוסיה'
    WHEN 'lefkara' THEN 'לפקרה'
    ELSE name_he
  END
END
WHERE code IN (
  'larnaca',
  'larnaca_airport',
  'paphos',
  'paphos_airport',
  'ayia_napa',
  'protaras',
  'limassol',
  'nicosia',
  'lefkara'
);

-- ---------------------------------------------------------------------------
-- 2) Blog taxonomy and 5 selected HE blog translations.
-- ---------------------------------------------------------------------------

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['אפיליאציה']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'תיירות', 'אפיליאציה']::text[] ELSE tags_he END
WHERE id = '0477e103-ee8a-47b3-9b54-69757dfbc07f';

INSERT INTO public.blog_post_translations (
  blog_post_id,
  lang,
  slug,
  title,
  meta_title,
  meta_description,
  summary,
  lead,
  content_json,
  content_html
) VALUES (
  '0477e103-ee8a-47b3-9b54-69757dfbc07f',
  'he',
  'cypruseye-affiliate-cyprus-tourism-he',
  'איך להרוויח מתיירות בקפריסין - מערכת השותפים של CyprusEye',
  'איך להרוויח מתיירות בקפריסין עם CyprusEye',
  'מדריך בטא בעברית למערכת השותפים של CyprusEye: איך להמליץ על שירותי תיירות בקפריסין, להשתמש בקופונים ולבנות הכנסה לאורך זמן.',
  'מערכת השותפים של CyprusEye מאפשרת להמליץ על שירותי תיירות אמיתיים בקפריסין ולקבל עמלה כאשר ההזמנה מתבצעת דרך הקישור או הקופון שלך.',
  'לא חייבים לפתוח סוכנות נסיעות כדי להרוויח מתיירות בקפריסין. ב-CyprusEye אפשר להמליץ על שירותים קיימים, לעקוב אחרי הזמנות ולבנות הכנסה בצורה מסודרת.',
  he_beta_doc(
    'מערכת השותפים של CyprusEye נבנתה עבור אנשים שמכירים מטיילים לקפריסין ורוצים להפוך המלצה טובה להכנסה מסודרת.',
    'במקום לנהל לקוחות, חוזים ותשלומים בעצמך, אתה מפנה את המטיילים לשירותים קיימים: רכב, הסעות, טיולים, מלונות או המלצות מקומיות.',
    'כאשר משתמש מזמין דרך הקישור, הקופון או ההפניה שלך, המערכת שומרת את הקשר ומאפשרת לעקוב אחרי הפעילות בצורה שקופה.',
    'היתרון המרכזי הוא שההמלצה נשארת טבעית: אתה מציע שירות שימושי, והצוות של CyprusEye מטפל בתהליך ההזמנה והתפעול.',
    'בבטא העברית חשוב לבדוק במיוחד שהקופונים, עמודי השירות והסטטוס של ההזמנה מוצגים בצורה ברורה מימין לשמאל.'
  ),
  $html$<h2>איך מודל השותפים עובד</h2>
<p>מערכת השותפים של CyprusEye נבנתה עבור אנשים שמכירים מטיילים לקפריסין ורוצים להפוך המלצה טובה להכנסה מסודרת. לא צריך לפתוח סוכנות נסיעות, להחזיק צי רכבים או לנהל לקוחות כל יום.</p>
<p>במקום זה, אתה מפנה מטיילים לשירותים שכבר קיימים במערכת: השכרת רכב, הסעות, טיולים, מלונות והמלצות מקומיות. כאשר ההזמנה מתבצעת דרך הקישור או הקופון שלך, המערכת יודעת לשייך את הפעילות אליך.</p>
<h2>למי זה מתאים</h2>
<p>המודל מתאים ליוצרי תוכן, בעלי קבוצות, מדריכים מקומיים, שותפים עסקיים וכל מי שמקבל שאלות חוזרות על חופשה בקפריסין. ההמלצה נשארת טבעית, כי היא מפנה לשירות שהמטייל באמת צריך.</p>
<h2>מה חשוב לבדוק בבטא העברית</h2>
<p>בגרסת הבטא צריך לוודא שהקופונים, סטטוס ההזמנה, סיכום השירות והמסכים האישיים ברורים בעברית, ושאין ערבוב מבלבל בין עברית, אנגלית ופולנית במקומות קריטיים.</p>
<p>הטקסט הזה מיועד לבטא פנימית וצריך לעבור סקירת דובר עברית לפני שימוש ציבורי.</p>$html$
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = CASE WHEN NULLIF(BTRIM(blog_post_translations.slug), '') IS NULL THEN EXCLUDED.slug ELSE blog_post_translations.slug END,
  title = CASE WHEN NULLIF(BTRIM(blog_post_translations.title), '') IS NULL THEN EXCLUDED.title ELSE blog_post_translations.title END,
  meta_title = COALESCE(NULLIF(BTRIM(blog_post_translations.meta_title), ''), EXCLUDED.meta_title),
  meta_description = CASE WHEN NULLIF(BTRIM(blog_post_translations.meta_description), '') IS NULL THEN EXCLUDED.meta_description ELSE blog_post_translations.meta_description END,
  summary = CASE WHEN NULLIF(BTRIM(blog_post_translations.summary), '') IS NULL THEN EXCLUDED.summary ELSE blog_post_translations.summary END,
  lead = COALESCE(NULLIF(BTRIM(blog_post_translations.lead), ''), EXCLUDED.lead),
  content_json = CASE WHEN blog_post_translations.content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array()) THEN EXCLUDED.content_json ELSE blog_post_translations.content_json END,
  content_html = CASE WHEN NULLIF(BTRIM(blog_post_translations.content_html), '') IS NULL THEN EXCLUDED.content_html ELSE blog_post_translations.content_html END,
  updated_at = now();

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['ETIAS']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'ETIAS', 'כניסה']::text[] ELSE tags_he END
WHERE id = '2a59c0a7-52fd-498f-b4fe-d0d76617c882';

INSERT INTO public.blog_post_translations (
  blog_post_id, lang, slug, title, meta_title, meta_description, summary, lead, content_json, content_html
) VALUES (
  '2a59c0a7-52fd-498f-b4fe-d0d76617c882',
  'he',
  'etias-cyprus-2026-he',
  'ETIAS בקפריסין 2026 - איך להתכונן למערכת הכניסה החדשה',
  'ETIAS בקפריסין 2026 - מדריך למטיילים',
  'מה צפוי להשתנות עם ETIAS לקפריסין, מי יצטרך אישור נסיעה אלקטרוני ואיך להתכונן לפני הזמנת טיסה.',
  'לקראת סוף 2026 מטיילים ממדינות פטורות ויזה צפויים להזדקק לאישור ETIAS לפני כניסה לקפריסין ולאזור שנגן.',
  'ETIAS היא מערכת אישור נסיעה אלקטרונית. היא אינה ויזה רגילה, אבל היא תהיה שלב חשוב בתכנון נסיעה לקפריסין עבור מטיילים ממדינות מסוימות.',
  he_beta_doc(
    'ETIAS היא מערכת אישור נסיעה אלקטרונית שמיועדת למטיילים ממדינות פטורות ויזה.',
    'לפני נסיעה לקפריסין יהיה צורך לבדוק אם המדינה שלך נכללת בדרישה, למלא בקשה אונליין ולקבל אישור לפני העלייה לטיסה.',
    'השלב החשוב ביותר למטיילים הוא לא להשאיר את הבדיקה לרגע האחרון, במיוחד בעונות עמוסות או בנסיעות משפחתיות.',
    'ב-CyprusEye נמשיך להפריד בין מידע תיירותי לבין החלטות רשמיות של הרשויות, ולכן לפני נסיעה יש לבדוק גם מקור ממשלתי עדכני.'
  ),
  $html$<h2>מה זה ETIAS</h2>
<p>ETIAS היא מערכת אישור נסיעה אלקטרונית עבור מטיילים ממדינות פטורות ויזה. היא אינה ויזה רגילה, אבל היא צפויה להפוך לשלב חובה לפני כניסה לקפריסין ולאזור שנגן עבור חלק מהמטיילים.</p>
<h2>מי צריך לשים לב</h2>
<p>מטיילים שמגיעים ממדינות שאינן באיחוד האירופי, אך נהנות כיום מפטור ויזה, צריכים לבדוק מראש אם הם נדרשים לאישור ETIAS. זה רלוונטי במיוחד למשפחות, קבוצות וחופשות קצרות שבהן אין זמן לתקן טעויות בשדה התעופה.</p>
<h2>איך להתכונן</h2>
<p>לפני הזמנת טיסה מומלץ לבדוק את הדרישות הרשמיות, לוודא שהדרכון בתוקף, לשמור עותק של האישור ולוודא שכל נוסע בקבוצה מכוסה.</p>
<p>הטקסט הזה מיועד לבטא פנימית וצריך לעבור סקירה אנושית לפני שימוש ציבורי או SEO.</p>$html$
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = CASE WHEN NULLIF(BTRIM(blog_post_translations.slug), '') IS NULL THEN EXCLUDED.slug ELSE blog_post_translations.slug END,
  title = CASE WHEN NULLIF(BTRIM(blog_post_translations.title), '') IS NULL THEN EXCLUDED.title ELSE blog_post_translations.title END,
  meta_title = COALESCE(NULLIF(BTRIM(blog_post_translations.meta_title), ''), EXCLUDED.meta_title),
  meta_description = CASE WHEN NULLIF(BTRIM(blog_post_translations.meta_description), '') IS NULL THEN EXCLUDED.meta_description ELSE blog_post_translations.meta_description END,
  summary = CASE WHEN NULLIF(BTRIM(blog_post_translations.summary), '') IS NULL THEN EXCLUDED.summary ELSE blog_post_translations.summary END,
  lead = COALESCE(NULLIF(BTRIM(blog_post_translations.lead), ''), EXCLUDED.lead),
  content_json = CASE WHEN blog_post_translations.content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array()) THEN EXCLUDED.content_json ELSE blog_post_translations.content_json END,
  content_html = CASE WHEN NULLIF(BTRIM(blog_post_translations.content_html), '') IS NULL THEN EXCLUDED.content_html ELSE blog_post_translations.content_html END,
  updated_at = now();

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['מדריך', 'לרנקה', 'איה נאפה', 'רכב', 'פאפוס', 'טרודוס', 'ניקוסיה']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'טיולים', 'מדריך']::text[] ELSE tags_he END
WHERE id = '2e88f39b-5b5c-4e04-82b5-c125f19920b3';

INSERT INTO public.blog_post_translations (
  blog_post_id, lang, slug, title, meta_title, meta_description, summary, lead, content_json, content_html
) VALUES (
  '2e88f39b-5b5c-4e04-82b5-c125f19920b3',
  'he',
  'cyprus-in-7-days-itinerary-he',
  'קפריסין ב-7 ימים - מסלול יומי מוכן',
  'קפריסין ב-7 ימים - מסלול יומי מוכן',
  'מסלול בטא בעברית לשבוע בקפריסין: חופים, היסטוריה, הרים, ערים מרכזיות ועצירות נוחות בלי לרוץ יותר מדי.',
  'שבוע אחד בקפריסין מספיק כדי לשלב חופים, היסטוריה, כפרים, הרים ואווירה מקומית, אם מתכננים את הימים נכון.',
  'המסלול הזה עוזר לבנות חופשה מאוזנת: יום נחיתה רגוע, אזור לרנקה, איה נאפה וקייפ גרקו, פאפוס, טרודוס וניקוסיה.',
  he_beta_doc(
    'בשבעה ימים אפשר לראות הרבה יותר מהחוף ליד המלון, אבל חשוב לא להעמיס מדי.',
    'התחילו ביום רגוע באזור הנחיתה, המשיכו לחופים ולנקודות תצפית, והשאירו מקום ליום הרים וכפרים.',
    'רכב שכור מקל מאוד על המסלול, במיוחד אם רוצים לשלב את לרנקה, איה נאפה, פאפוס, טרודוס וניקוסיה.',
    'בבטא העברית צריך לבדוק שהקישורים לשירותים, מפות, CTA והמלצות קשורות לא יוצרים ערבוב שפות מבלבל.'
  ),
  $html$<h2>איך לבנות שבוע בקפריסין</h2>
<p>שבוע אחד בקפריסין יכול לשלב חופים, היסטוריה, הרים, כפרים ואווירה מקומית. הסוד הוא לא לנסות לראות הכול, אלא לחלק את הימים לפי אזורים.</p>
<p>יום ראשון יכול להיות רגוע באזור הנחיתה. לאחר מכן אפשר להקדיש יום ללרנקה, יום לאיה נאפה וקייפ גרקו, יום לפאפוס, יום להרי טרודוס וכפרים כמו לפקרה או אומודוס, ויום לניקוסיה.</p>
<h2>למי המסלול מתאים</h2>
<p>המסלול מתאים למטיילים שרוצים יותר מבטן-גב, אבל עדיין לא רוצים לרוץ ממקום למקום. רכב שכור מקל על המעברים ומאפשר לעצור בנקודות תצפית, חופים וכפרים בדרך.</p>
<h2>מה לבדוק בבטא</h2>
<p>בגרסת הבטא חשוב לבדוק שהכרטיסים, ההמלצות, כפתורי ההזמנה והסיכומים נראים טוב בעברית וב-RTL, במיוחד במסכים צרים.</p>$html$
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = CASE WHEN NULLIF(BTRIM(blog_post_translations.slug), '') IS NULL THEN EXCLUDED.slug ELSE blog_post_translations.slug END,
  title = CASE WHEN NULLIF(BTRIM(blog_post_translations.title), '') IS NULL THEN EXCLUDED.title ELSE blog_post_translations.title END,
  meta_title = COALESCE(NULLIF(BTRIM(blog_post_translations.meta_title), ''), EXCLUDED.meta_title),
  meta_description = CASE WHEN NULLIF(BTRIM(blog_post_translations.meta_description), '') IS NULL THEN EXCLUDED.meta_description ELSE blog_post_translations.meta_description END,
  summary = CASE WHEN NULLIF(BTRIM(blog_post_translations.summary), '') IS NULL THEN EXCLUDED.summary ELSE blog_post_translations.summary END,
  lead = COALESCE(NULLIF(BTRIM(blog_post_translations.lead), ''), EXCLUDED.lead),
  content_json = CASE WHEN blog_post_translations.content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array()) THEN EXCLUDED.content_json ELSE blog_post_translations.content_json END,
  content_html = CASE WHEN NULLIF(BTRIM(blog_post_translations.content_html), '') IS NULL THEN EXCLUDED.content_html ELSE blog_post_translations.content_html END,
  updated_at = now();

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['רכב']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['השכרת רכב', 'קפריסין', 'פיקדון']::text[] ELSE tags_he END
WHERE id = 'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef';

INSERT INTO public.blog_post_translations (
  blog_post_id, lang, slug, title, meta_title, meta_description, summary, lead, content_json, content_html
) VALUES (
  'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef',
  'he',
  'car-rental-cyprus-no-deposit-he',
  'השכרת רכב בקפריסין בלי פיקדון עם CyprusEye',
  'השכרת רכב בקפריסין בלי פיקדון',
  'איך עובדת השכרת רכב בקפריסין בלי פיקדון: תשלום, איסוף, ביטוח, נסיעה לצפון קפריסין ומה חשוב לבדוק לפני הזמנה.',
  'בקפריסין רכב שכור הוא הדרך הפשוטה ביותר להגיע לחופים, כפרים ונקודות תצפית. המודל של CyprusEye נועד להפחית לחץ סביב פיקדון וכרטיס אשראי.',
  'עם CyprusEye אפשר לבדוק הצעת רכב בצורה שקופה, בלי פיקדון גדול, עם מידע ברור על איסוף, החזרה, ביטוח ותוספות.',
  he_beta_doc(
    'רכב שכור בקפריסין נותן חופש להגיע למקומות שלא תמיד נוחים בתחבורה ציבורית.',
    'הבעיה אצל הרבה מטיילים היא פיקדון גבוה, דרישה לכרטיס אשראי או תנאים שלא ברורים בזמן ההזמנה.',
    'במודל של CyprusEye המטרה היא להציג מחיר ותנאים בצורה ברורה, כולל איסוף, החזרה, ביטוח ותוספות אפשריות.',
    'בבטא העברית צריך לבדוק במיוחד את מחשבון המחיר, הודעות השגיאה, סיכום ההזמנה וכפתורי ה-CTA.'
  ),
  $html$<h2>למה לשכור רכב בקפריסין</h2>
<p>קפריסין גדולה יותר ממה שנדמה במבט ראשון. חופים, כפרים, נקודות תצפית ואתרים היסטוריים פזורים בכל האי, ולכן רכב שכור נותן הרבה יותר גמישות.</p>
<h2>מה שונה במודל בלי פיקדון</h2>
<p>אצל מטיילים רבים החשש המרכזי הוא פיקדון גבוה או צורך בכרטיס אשראי. המטרה של CyprusEye היא להציג תהליך פשוט ושקוף יותר: מחיר ברור, תנאי איסוף והחזרה, ותוספות כמו ביטוח או מסירת רכב כאשר הן רלוונטיות.</p>
<h2>מה חשוב לבדוק לפני הזמנה</h2>
<p>בדקו את תאריכי האיסוף וההחזרה, מספר הימים, עיר האיסוף, כמות נוסעים ומטען, והאם אתם מתכננים לעבור לצפון קפריסין. במעבר לצפון ייתכן שתצטרכו לרכוש ביטוח צד ג׳ מקומי במחסום.</p>
<p>בבטא העברית יש לבדוק שהמחשבון, סיכום המחיר והודעות הוולידציה עובדים בלי ערבוב שפות ובלי שבירת RTL.</p>$html$
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = CASE WHEN NULLIF(BTRIM(blog_post_translations.slug), '') IS NULL THEN EXCLUDED.slug ELSE blog_post_translations.slug END,
  title = CASE WHEN NULLIF(BTRIM(blog_post_translations.title), '') IS NULL THEN EXCLUDED.title ELSE blog_post_translations.title END,
  meta_title = COALESCE(NULLIF(BTRIM(blog_post_translations.meta_title), ''), EXCLUDED.meta_title),
  meta_description = CASE WHEN NULLIF(BTRIM(blog_post_translations.meta_description), '') IS NULL THEN EXCLUDED.meta_description ELSE blog_post_translations.meta_description END,
  summary = CASE WHEN NULLIF(BTRIM(blog_post_translations.summary), '') IS NULL THEN EXCLUDED.summary ELSE blog_post_translations.summary END,
  lead = COALESCE(NULLIF(BTRIM(blog_post_translations.lead), ''), EXCLUDED.lead),
  content_json = CASE WHEN blog_post_translations.content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array()) THEN EXCLUDED.content_json ELSE blog_post_translations.content_json END,
  content_html = CASE WHEN NULLIF(BTRIM(blog_post_translations.content_html), '') IS NULL THEN EXCLUDED.content_html ELSE blog_post_translations.content_html END,
  updated_at = now();

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['מדריך', 'לרנקה', 'פאפוס']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'לרנקה', 'פאפוס']::text[] ELSE tags_he END
WHERE id = '1c1f8eb6-c709-4302-8611-6322b5ed5fad';

INSERT INTO public.blog_post_translations (
  blog_post_id, lang, slug, title, meta_title, meta_description, summary, lead, content_json, content_html
) VALUES (
  '1c1f8eb6-c709-4302-8611-6322b5ed5fad',
  'he',
  'larnaca-or-paphos-where-to-stay-he',
  'לרנקה או פאפוס - איפה עדיף לנחות ולישון בקפריסין',
  'לרנקה או פאפוס - איפה עדיף לנחות בקפריסין',
  'השוואה קצרה בעברית בין לרנקה לפאפוס: שדה תעופה, חופים, אווירה, טיולים ונוחות למטיילים בפעם הראשונה בקפריסין.',
  'לרנקה ופאפוס הן שתי נקודות כניסה פופולריות לקפריסין, אבל הן נותנות חוויה שונה מאוד של האי.',
  'אם זו הפעם הראשונה שלכם בקפריסין, הבחירה בין לרנקה לפאפוס תשפיע על הקצב, האטרקציות, הנסיעות והתחושה הכללית של החופשה.',
  he_beta_doc(
    'לרנקה ופאפוס שתיהן בחירות טובות, אבל הן מתאימות לסגנונות שונים של חופשה.',
    'לרנקה נוחה למי שרוצה נחיתה קלה, טיילת עירונית, גישה לאיה נאפה וקייפ גרקו ונסיעות קצרות יחסית למרכז האי.',
    'פאפוס מתאימה למי שמחפש היסטוריה, שקיעות, אזור אקאמאס, חופים מערביים ואווירה רגועה יותר.',
    'בבטא העברית חשוב לבדוק שהקישורים לרכב, מלונות וטיולים מוצגים בהתאם לאזור ולא מבלבלים בין הערים.'
  ),
  $html$<h2>למי מתאימה לרנקה</h2>
<p>לרנקה מתאימה למטיילים שרוצים נחיתה נוחה, טיילת עירונית, חופים קרובים וגישה טובה לאיה נאפה, פרוטארס וקייפ גרקו. היא גם נוחה כנקודת התחלה לטיול רחב יותר באי.</p>
<h2>למי מתאימה פאפוס</h2>
<p>פאפוס מתאימה למטיילים שמחפשים אווירה רגועה יותר, אתרים ארכיאולוגיים, שקיעות יפות, חופים מערביים ונסיעות לכיוון אקאמאס וסלע אפרודיטה.</p>
<h2>איך לבחור</h2>
<p>אם אתם רוצים חופשה עירונית קלה עם הרבה אפשרויות סביב לרנקה ואיה נאפה, לרנקה תהיה נוחה יותר. אם אתם רוצים בסיס מערבי עם טבע, היסטוריה ואווירה איטית יותר, פאפוס יכולה להתאים יותר.</p>
<p>בבטא העברית צריך לבדוק שהכרטיסים וה-CTA לשירותי רכב, מלון וטיול מתאימים לעיר הנבחרת.</p>$html$
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = CASE WHEN NULLIF(BTRIM(blog_post_translations.slug), '') IS NULL THEN EXCLUDED.slug ELSE blog_post_translations.slug END,
  title = CASE WHEN NULLIF(BTRIM(blog_post_translations.title), '') IS NULL THEN EXCLUDED.title ELSE blog_post_translations.title END,
  meta_title = COALESCE(NULLIF(BTRIM(blog_post_translations.meta_title), ''), EXCLUDED.meta_title),
  meta_description = CASE WHEN NULLIF(BTRIM(blog_post_translations.meta_description), '') IS NULL THEN EXCLUDED.meta_description ELSE blog_post_translations.meta_description END,
  summary = CASE WHEN NULLIF(BTRIM(blog_post_translations.summary), '') IS NULL THEN EXCLUDED.summary ELSE blog_post_translations.summary END,
  lead = COALESCE(NULLIF(BTRIM(blog_post_translations.lead), ''), EXCLUDED.lead),
  content_json = CASE WHEN blog_post_translations.content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array()) THEN EXCLUDED.content_json ELSE blog_post_translations.content_json END,
  content_html = CASE WHEN NULLIF(BTRIM(blog_post_translations.content_html), '') IS NULL THEN EXCLUDED.content_html ELSE blog_post_translations.content_html END,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) POI: 10 selected beta records plus category labels.
-- ---------------------------------------------------------------------------

UPDATE public.poi_categories
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  WHEN name_en IN ('Beach', 'Beaches') THEN 'חופים'
  WHEN name_en = 'Nature' THEN 'טבע'
  WHEN name_en = 'Viewpoint' THEN 'נקודת תצפית'
  WHEN name_en = 'Landmark' THEN 'אתר מרכזי'
  WHEN name_en = 'Religious Sites' THEN 'אתרים דתיים'
  ELSE name_he
END
WHERE name_en IN ('Beach', 'Beaches', 'Nature', 'Viewpoint', 'Landmark', 'Religious Sites');

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'חוף פיניקודס - הלב של לרנקה'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'טיילת וחוף עירוני מרכזי בלרנקה, עם דקלים, מים רגועים, מסעדות וגישה נוחה למרינה ולמבצר הימי.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'מטייל פיניקודס')
WHERE id = 'larnaca-beach';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'מרינת לימסול - הלב האלגנטי של החוף'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'מרינה מודרנית במרכז לימסול, מתאימה לטיול ערב, מסעדות, יאכטות ונוף עירוני נעים ליד הנמל הישן.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'מטייל במרינה')
WHERE id = 'limassol-marina';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'העיר העתיקה ניקוסיה - מסע בזמן'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'המרכז ההיסטורי של ניקוסיה נמצא בתוך החומות הוונציאניות ומשלב סמטאות, שערים עתיקים, בתי קפה ואת קו הגבול הירוק.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'בלב חומות ניקוסיה')
WHERE id = 'nicosia-old-town';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'גשר האהבה'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'קשת סלע טבעית באזור איה נאפה וקייפ גרקו, פופולרית לצילומים ולתצפית על מים טורקיז.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'גשר האהבה')
WHERE id = 'Love-Bridge';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'חוף קונוס ביי'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'מפרץ חולי ושקט בין איה נאפה לפרוטארס, עם מים צלולים, נוף ירוק וגישה נוחה לשחייה רגועה.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'מפרץ של שלווה')
WHERE id = 'konnos-bay-beach';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'מערות הים של קייפ גרקו'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'מערות וקליפים מרשימים בקייפ גרקו, עם נקודות צילום, מים כחולים ואפשרות לצפייה מהחוף או מהים.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'מחפש מערות')
WHERE id = 'cape-greco-sea-caves';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'מערת הקיקלופ'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'מערה קטנה ליד קייפ גרקו ופרוטארס, הקשורה במסורת המקומית לסיפור אודיסאוס והקיקלופ פוליפמוס.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'בריחה ממערת פוליפמוס')
WHERE id = 'Cyclops-Cave';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'כנסיית סנט לזרוס בלרנקה'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'כנסיית אבן מהמאה התשיעית בלב לרנקה, ידועה באיקונוסטזיס המרשים ובקשר למסורת על קברו של לזרוס.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'שומר השרידים')
WHERE id = 'saint-lazarus-church';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'העיר העתיקה פמגוסטה'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'עיר מבוצרת עם חומות ונציאניות, קתדרלה היסטורית, מבצר אותלו ואווירה חזקה של עבר ימי ביניימי.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'כרוניקן פמגוסטה')
WHERE id = 'famagusta-old-town';

UPDATE public.pois
SET
  name_i18n = he_beta_set_he_if_empty(name_i18n, 'מבצר לרנקה'),
  description_i18n = he_beta_set_he_if_empty(description_i18n, 'מבצר ימי קטן בקצה טיילת פיניקודס, ששימש לאורך השנים להגנה על הנמל, תחנת ארטילריה, בית סוהר ומוזיאון.'),
  badge_i18n = he_beta_set_he_if_empty(badge_i18n, 'שומר הנמל')
WHERE id = 'larnaca-castle';

-- ---------------------------------------------------------------------------
-- 4) Recommendations: 5 selected beta records plus category labels.
-- ---------------------------------------------------------------------------

UPDATE public.recommendation_categories
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  WHEN id = '501a906c-836b-4d8d-9b9a-c4b6072dac9e' THEN 'חנויות'
  WHEN id = 'a3862f39-d93f-459c-8a4e-b460996b4999' THEN 'בתי קפה'
  WHEN id = 'ba790aca-4c4b-45d0-834d-de84dbf3df9f' THEN 'מסעדות'
  ELSE name_he
END
WHERE id IN (
  '501a906c-836b-4d8d-9b9a-c4b6072dac9e',
  'a3862f39-d93f-459c-8a4e-b460996b4999',
  'ba790aca-4c4b-45d0-834d-de84dbf3df9f'
);

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Avramis Jewellery Shop'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'חנות תכשיטים מסורתית בלפקרה, המתמחה בעבודות כסף בעבודת יד ובהשראה מקומית של מלאכת פיליגרן קפריסאית.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '10% הנחה בקנייה'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'הציגו את הקופון למוכר כדי לממש את ההטבה.')
WHERE id = 'c085ebc6-1de8-4963-954a-8c67b56db892';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Kaffenest'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'בית קפה מקומי בלפקרה. הציגו את הקוד וקבלו כדור גלידה אחד במתנה בקניית קפה.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), 'כדור גלידה אחד במתנה'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'כדור גלידה אחד במתנה בקניית קפה.')
WHERE id = '6013a7c6-f8a1-4259-8286-fb43a88f3a53';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Restaurant Da Vinci''s Garden'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'מסעדה באווירה מקומית בלפקרה, עם מנות קפריסאיות מסורתיות וחצר נעימה לארוחה רגועה.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '10% הנחה על אוכל'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'קבלו 10% הנחה על הזמנת אוכל ב-Da Vinci''s Garden.')
WHERE id = 'feaf6154-bc82-4208-a0c6-21d6ada9e5af';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Lefkara Da Vinci Cafe & Traditional Italian Pizza'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'קפה ופיצה איטלקית מסורתית בלפקרה, מתאים לעצירה נוחה במהלך טיול בכפר.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '10% הנחה על אוכל'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'הציגו את קוד ההנחה בעת ההזמנה כדי לממש את ההטבה.')
WHERE id = '7451b6d5-9f5e-466e-8256-acb401650c3b';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'G-Raf Silversmith'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'צורף מקומי בלרנקה עם ניסיון רב, המשלב מסורת ודיוק בעבודת יד בעיצוב תכשיטי כסף ייחודיים.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '15% הנחה בקנייה'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'הציגו את הקוד למוכר וקבלו 15% הנחה בקנייה.')
WHERE id = 'd7bf97d4-7175-4fee-bbea-eb491d72e101';

-- ---------------------------------------------------------------------------
-- 5) Trips: 3 selected beta records.
-- ---------------------------------------------------------------------------

UPDATE public.trips
SET
  title = he_beta_set_he_if_empty(title, 'הלגונה הכחולה'),
  description = he_beta_set_he_if_empty(description, 'טיול יום פרטי מאזור פאפוס אל הלגונה הכחולה: עצירות נוף, נסיעת שטח, זמן לשחייה ושנורקלינג, מים וכיבוד קל ברכב. מתאים למטיילים שרוצים יום טבע רגוע עם נהיגה מודרכת.')
WHERE id = '47fd4793-647b-45fd-a2ce-1ecaa4b95922';

UPDATE public.trips
SET
  title = he_beta_set_he_if_empty(title, 'מסלול סלע אפרודיטה'),
  description = he_beta_set_he_if_empty(description, 'טיול יום פרטי מפאפוס דרך נקודות טבע וחוף סביב סלע אפרודיטה: תצפיות, נהיגת שטח, עצירות צילום וחוויה קפריסאית מחוץ למסלול הרגיל.')
WHERE id = '2d937b4f-3da7-4fed-bc06-bdc66eb25612';

UPDATE public.trips
SET
  title = he_beta_set_he_if_empty(title, 'טרודוס ולפקרה'),
  description = he_beta_set_he_if_empty(description, 'טיול יום אל הרי טרודוס ולפקרה, עם כפרים מסורתיים, נקודות תצפית, מפלים ואווירה הררית שונה מהחופים של קפריסין.')
WHERE id = 'b0a24297-89f9-4f60-a1d6-b59d84bee877';

-- ---------------------------------------------------------------------------
-- 6) Hotels: 2 selected beta records.
-- ---------------------------------------------------------------------------

UPDATE public.hotels
SET
  title = he_beta_set_he_if_empty(title, 'RGB Cabins - מרכז לרנקה'),
  description = he_beta_set_he_if_empty(description, 'יחידות סטודיו במרכז לרנקה, קרובות לחוף פיניקודס, למסעדות ולטיילת. מתאים לזוגות, יחידים או קבוצות שרוצות לשהות יחד במיקום עירוני נוח.')
WHERE id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1';

UPDATE public.hotels
SET
  title = he_beta_set_he_if_empty(title, '7 Arches'),
  description = he_beta_set_he_if_empty(description, 'אירוח בלפקרה באווירה קפריסאית שקטה, עם מיקום נוח לטיולים בכפרים ובהרים. מתאים למי שמחפש בסיס אותנטי ונעים מחוץ לערים הגדולות.')
WHERE id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';

-- ---------------------------------------------------------------------------
-- 7) Cars: 5 selected beta records.
-- description_i18n is updated only if that column exists in the current schema.
-- ---------------------------------------------------------------------------

UPDATE public.car_offers
SET features = he_beta_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  'אוטומטי',
  '8 מקומות',
  'דלתות הזזה',
  'אבזור פרימיום',
  'מרווח במיוחד'
]::text[])
WHERE id = '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca';

UPDATE public.car_offers
SET features = he_beta_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '5 מקומות',
  'תא נוסעים פרימיום',
  'ניווט',
  'מושבי עור'
]::text[])
WHERE id = 'b4f784d3-22d2-421a-829f-2394e3a72a76';

UPDATE public.car_offers
SET features = he_beta_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  'אוטומטי',
  '7 מקומות',
  'הנעה כפולה',
  'מרווח גחון גבוה',
  'נסיעה נוחה'
]::text[])
WHERE id = '8a1158af-6b05-4723-b2eb-93b130d22f24';

UPDATE public.car_offers
SET features = he_beta_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  'אוטומטי',
  '7 מקומות',
  'Bluetooth',
  'דלתות הזזה',
  'עיצוב מודרני',
  'טעינת USB'
]::text[])
WHERE id = '5ba581c3-08c6-47cd-ab29-4d2b9213cebc';

UPDATE public.car_offers
SET features = he_beta_set_he_array_if_empty(features, ARRAY[
  'מיזוג אוויר',
  '5 מקומות',
  'Bluetooth',
  'טכנולוגיה היברידית',
  'מושבים גמישים'
]::text[])
WHERE id = '64981eb1-e9a3-41a4-bd93-1fd4c78581d7';

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
      SET description_i18n = he_beta_set_he_if_empty(description_i18n, 'רכב 8 מקומות מרווח למשפחות או קבוצות, מתאים לנסיעות באזור פאפוס עם דלתות הזזה ונוחות גבוהה.')
      WHERE id = '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca';

      UPDATE public.car_offers
      SET description_i18n = he_beta_set_he_if_empty(description_i18n, 'SUV נוח עם תא נוסעים איכותי, מתאים לנסיעות ארוכות ולמשפחות שרוצות רכב גבוה ונעים.')
      WHERE id = 'b4f784d3-22d2-421a-829f-2394e3a72a76';

      UPDATE public.car_offers
      SET description_i18n = he_beta_set_he_if_empty(description_i18n, 'רכב 7 מקומות עם הנעה כפולה ומרווח טוב, מתאים לטיולים מחוץ לעיר ולמשפחות גדולות.')
      WHERE id = '8a1158af-6b05-4723-b2eb-93b130d22f24';

      UPDATE public.car_offers
      SET description_i18n = he_beta_set_he_if_empty(description_i18n, 'רכב 7 מקומות מודרני ונוח בלרנקה, עם דלתות הזזה וטעינת USB לנסיעות משפחתיות.')
      WHERE id = '5ba581c3-08c6-47cd-ab29-4d2b9213cebc';

      UPDATE public.car_offers
      SET description_i18n = he_beta_set_he_if_empty(description_i18n, 'רכב היברידי קומפקטי וחסכוני, מתאים לזוגות או משפחות קטנות שמטיילות מלרנקה.')
      WHERE id = '64981eb1-e9a3-41a4-bd93-1fd4c78581d7';
    $sql$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verification reads inside the transaction.
-- ---------------------------------------------------------------------------

SELECT 'blog_he_translations' AS check_name, COUNT(*) AS ready_rows
FROM public.blog_post_translations
WHERE lang = 'he'
  AND blog_post_id IN (
    '0477e103-ee8a-47b3-9b54-69757dfbc07f',
    '2a59c0a7-52fd-498f-b4fe-d0d76617c882',
    '2e88f39b-5b5c-4e04-82b5-c125f19920b3',
    'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef',
    '1c1f8eb6-c709-4302-8611-6322b5ed5fad'
  );

SELECT 'transport_he_locations' AS check_name, COUNT(*) AS ready_rows
FROM public.transport_locations
WHERE code IN ('larnaca', 'larnaca_airport', 'paphos', 'paphos_airport', 'ayia_napa', 'protaras', 'limassol', 'nicosia', 'lefkara')
  AND NULLIF(BTRIM(name_he), '') IS NOT NULL;

SELECT 'poi_he_beta_scope' AS check_name, COUNT(*) AS ready_rows
FROM public.pois
WHERE id IN ('larnaca-beach', 'limassol-marina', 'nicosia-old-town', 'Love-Bridge', 'konnos-bay-beach', 'cape-greco-sea-caves', 'Cyclops-Cave', 'saint-lazarus-church', 'famagusta-old-town', 'larnaca-castle')
  AND NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
  AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
  AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL;

SELECT 'recommendations_he_beta_scope' AS check_name, COUNT(*) AS ready_rows
FROM public.recommendations
WHERE id IN ('c085ebc6-1de8-4963-954a-8c67b56db892', '6013a7c6-f8a1-4259-8286-fb43a88f3a53', 'feaf6154-bc82-4208-a0c6-21d6ada9e5af', '7451b6d5-9f5e-466e-8256-acb401650c3b', 'd7bf97d4-7175-4fee-bbea-eb491d72e101')
  AND NULLIF(BTRIM(title_he), '') IS NOT NULL
  AND NULLIF(BTRIM(description_he), '') IS NOT NULL;

-- Keep this rollback until all values have passed human review.
ROLLBACK;
