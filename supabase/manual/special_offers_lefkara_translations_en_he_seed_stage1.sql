-- =====================================================
-- Special Offers Lefkara EN/HE translations seed - Stage 1 draft
-- =====================================================
-- Prepared only. Do not run until reviewed.
--
-- Scope:
-- - add/update EN and HE translations for slug lefkara-giveaway-2026
--
-- Out of scope:
-- - PL translation changes
-- - prizes
-- - links
-- - audit log
-- - entries/tasks/draws/winners
-- =====================================================

DO $$
DECLARE
  v_offer_id uuid;
BEGIN
  SELECT id INTO v_offer_id
  FROM public.special_offers
  WHERE slug = 'lefkara-giveaway-2026';

  IF v_offer_id IS NULL THEN
    RAISE EXCEPTION 'Special Offers seed failed: campaign slug lefkara-giveaway-2026 does not exist.';
  END IF;

  INSERT INTO public.special_offer_translations (
    offer_id,
    lang,
    title,
    short_description,
    full_description,
    prize_description,
    rules_html,
    faq_json,
    seo_title,
    seo_description,
    updated_at
  )
  VALUES
    (
      v_offer_id,
      'en',
      'Win 3 days in Lefkara + a car for 3 days',
      'A CyprusEye.com and WakacjeCypr.com contest with a 2-night stay at 7 Kamares and a car for 3 days for the winner and one accompanying person.',
      'Join the Lefkara campaign by CyprusEye.com and WakacjeCypr.com for a chance to win a short Cyprus getaway. The prize includes 3 days / 2 nights at 7 Kamares in Lefkara and a car for 3 days for the winner and one accompanying person. Social activity is verified manually and does not replace the required entry form.',
      '3 days / 2 nights at 7 Kamares in Lefkara and a car for 3 days: Nissan Note, Kia Rio, Toyota Yaris or a similar category depending on availability. The prize is for 1 winner and one accompanying person.',
      '<section><h3>Required conditions</h3><ul><li>Follow the CyprusEye.com / WakacjeCypr.com Facebook profile.</li><li>Follow the 7 Kamares profile.</li><li>Share the official contest post on Facebook.</li><li>Register or log in on CyprusEye.</li><li>Submit the entry form.</li><li>Answer the contest question.</li><li>Accept the rules.</li><li>The participant must be an adult and provide real contact details.</li></ul></section><section><h3>Extra / manual activity</h3><ul><li>Sharing more official campaign posts can increase your chance.</li><li>Valuable comments in the first 24 hours can increase your chance.</li><li>Spam or repeated artificial comments will not count.</li><li>Extra activity does not replace the mandatory form.</li></ul></section><section><h3>Important notes</h3><ul><li>Social media activity is verified manually.</li><li>There are no automatic social media integrations.</li><li>Final details and terms may be completed before the public launch.</li></ul></section>',
      jsonb_build_array(
        jsonb_build_object(
          'question', 'Is social media activity checked automatically?',
          'answer', 'No. Social media activity is reviewed manually by the admin team.'
        ),
        jsonb_build_object(
          'question', 'Does extra activity replace the entry form?',
          'answer', 'No. The entry form is mandatory.'
        ),
        jsonb_build_object(
          'question', 'Which car is included in the prize?',
          'answer', 'The car will be Nissan Note, Kia Rio, Toyota Yaris or a similar category depending on availability.'
        )
      ),
      'Win 3 days in Lefkara + a car for 3 days | CyprusEye',
      'Take part in the CyprusEye and WakacjeCypr contest for a chance to win 3 days in Lefkara with accommodation at 7 Kamares and a car for 3 days.',
      now()
    ),
    (
      v_offer_id,
      'he',
      'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים',
      'תחרות של CyprusEye.com ו-WakacjeCypr.com הכוללת שהייה של 2 לילות ב-7 Kamares ורכב ל-3 ימים עבור הזוכה ואדם מלווה אחד.',
      'הצטרפו לקמפיין לפקרה של CyprusEye.com ו-WakacjeCypr.com וקבלו הזדמנות לזכות בחופשה קצרה בקפריסין. הפרס כולל 3 ימים / 2 לילות ב-7 Kamares בלפקרה ורכב ל-3 ימים עבור הזוכה ואדם מלווה אחד. פעילות ברשתות החברתיות נבדקת ידנית ואינה מחליפה את טופס ההשתתפות החובה.',
      '3 ימים / 2 לילות ב-7 Kamares בלפקרה ורכב ל-3 ימים: Nissan Note, Kia Rio, Toyota Yaris או קטגוריה דומה, בהתאם לזמינות. הפרס מיועד לזוכה אחד ולאדם מלווה אחד.',
      '<section dir="rtl"><h3>תנאי השתתפות חובה</h3><ul><li>לעקוב אחר פרופיל הפייסבוק של CyprusEye.com / WakacjeCypr.com.</li><li>לעקוב אחר הפרופיל של 7 Kamares.</li><li>לשתף את פוסט התחרות הרשמי בפייסבוק.</li><li>להירשם או להתחבר ל-CyprusEye.</li><li>לשלוח את טופס ההשתתפות.</li><li>לענות על שאלת התחרות.</li><li>לאשר את תקנון התחרות.</li><li>המשתתף חייב להיות בגיר ולמסור פרטי קשר אמיתיים.</li></ul></section><section dir="rtl"><h3>פעילות נוספת / בדיקה ידנית</h3><ul><li>שיתוף פוסטים רשמיים נוספים של הקמפיין יכול להגדיל את הסיכוי.</li><li>תגובות איכותיות במהלך 24 השעות הראשונות יכולות להגדיל את הסיכוי.</li><li>ספאם או תגובות מלאכותיות חוזרות לא ייחשבו.</li><li>פעילות נוספת אינה מחליפה את טופס ההשתתפות החובה.</li></ul></section><section dir="rtl"><h3>הערות חשובות</h3><ul><li>פעילות ברשתות החברתיות נבדקת ידנית.</li><li>אין אינטגרציות אוטומטיות עם רשתות חברתיות.</li><li>פרטים ותנאים סופיים יכולים להתעדכן לפני ההשקה הציבורית.</li></ul></section>',
      jsonb_build_array(
        jsonb_build_object(
          'question', 'האם פעילות ברשתות החברתיות נבדקת אוטומטית?',
          'answer', 'לא. הפעילות ברשתות החברתיות נבדקת ידנית על ידי צוות הניהול.'
        ),
        jsonb_build_object(
          'question', 'האם פעילות נוספת מחליפה את טופס ההשתתפות?',
          'answer', 'לא. טופס ההשתתפות הוא חובה.'
        ),
        jsonb_build_object(
          'question', 'איזה רכב כלול בפרס?',
          'answer', 'הרכב יהיה Nissan Note, Kia Rio, Toyota Yaris או קטגוריה דומה, בהתאם לזמינות.'
        )
      ),
      'זכו ב-3 ימים בלפקרה + רכב ל-3 ימים | CyprusEye',
      'השתתפו בתחרות של CyprusEye ו-WakacjeCypr וקבלו הזדמנות לזכות ב-3 ימים בלפקרה, אירוח ב-7 Kamares ורכב ל-3 ימים.',
      now()
    )
  ON CONFLICT (offer_id, lang) DO UPDATE SET
    title = EXCLUDED.title,
    short_description = EXCLUDED.short_description,
    full_description = EXCLUDED.full_description,
    prize_description = EXCLUDED.prize_description,
    rules_html = EXCLUDED.rules_html,
    faq_json = EXCLUDED.faq_json,
    seo_title = EXCLUDED.seo_title,
    seo_description = EXCLUDED.seo_description,
    updated_at = now();
END $$;
