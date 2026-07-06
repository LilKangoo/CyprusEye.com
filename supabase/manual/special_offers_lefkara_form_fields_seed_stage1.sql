-- Special Offers 3C.1 Lefkara form builder seed draft only.
-- Seeds form field configuration for slug lefkara-giveaway-2026.
-- Idempotent through ON CONFLICT. Do not run automatically.

begin;

do $$
declare
  v_offer_id uuid;
  v_status text;
  v_visibility text;
begin
  if to_regclass('public.special_offer_form_fields') is null then
    raise exception 'Missing required table public.special_offer_form_fields';
  end if;

  if to_regclass('public.special_offer_form_field_translations') is null then
    raise exception 'Missing required table public.special_offer_form_field_translations';
  end if;

  if to_regprocedure('public.special_offers_set_updated_at()') is null then
    raise exception 'Missing required trigger function public.special_offers_set_updated_at()';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;

  select id, status, visibility
    into v_offer_id, v_status, v_visibility
  from public.special_offers
  where slug = 'lefkara-giveaway-2026';

  if v_offer_id is null then
    raise exception 'Special offer not found: lefkara-giveaway-2026';
  end if;

  if v_status <> 'draft' or v_visibility <> 'private' then
    raise exception 'Refusing to seed form fields for non-draft/private campaign: status=%, visibility=%', v_status, v_visibility;
  end if;

  update public.special_offers
  set requires_form = true,
      updated_at = now()
  where id = v_offer_id
    and requires_form is distinct from true;

  insert into public.special_offer_form_fields (
    offer_id,
    field_key,
    field_type,
    required,
    active,
    sort_order,
    validation_json,
    admin_note
  )
  select
    v_offer_id,
    f.field_key,
    f.field_type,
    f.required,
    true,
    f.sort_order,
    f.validation_json,
    f.admin_note
  from (
    values
      ('first_name', 'text', true, 10, '{}'::jsonb, null),
      ('last_name', 'text', true, 20, '{}'::jsonb, null),
      ('email', 'email', true, 30, '{}'::jsonb, null),
      ('phone', 'phone', true, 40, '{}'::jsonb, 'UI should use js/phone-input.js country code selector.'),
      ('date_of_birth', 'date_of_birth', true, 50, '{"min_age": 18}'::jsonb, null),
      ('country', 'country', true, 60, '{}'::jsonb, null),
      ('city', 'city', false, 70, '{}'::jsonb, null),
      ('contest_answer', 'contest_answer', true, 80, '{}'::jsonb, null),
      ('facebook_profile_url', 'facebook_profile_url', true, 90, '{}'::jsonb, null),
      ('shared_post_url', 'shared_post_url', true, 100, '{}'::jsonb, null),
      ('terms_accepted', 'consent', true, 110, '{"must_be_true": true}'::jsonb, null)
  ) as f(field_key, field_type, required, sort_order, validation_json, admin_note)
  on conflict (offer_id, field_key) do update
    set field_type = excluded.field_type,
        required = excluded.required,
        active = excluded.active,
        sort_order = excluded.sort_order,
        validation_json = excluded.validation_json,
        admin_note = excluded.admin_note,
        updated_at = now();

  insert into public.special_offer_form_field_translations (
    field_id,
    lang,
    label,
    placeholder,
    help_text,
    options_json
  )
  select
    f.id,
    t.lang,
    t.label,
    t.placeholder,
    t.help_text,
    '[]'::jsonb
  from public.special_offer_form_fields f
  join (
    values
      ('first_name', 'pl', 'Imię', 'Wpisz imię', 'Podaj swoje imię zgodnie z dokumentem.'),
      ('first_name', 'en', 'First name', 'Enter your first name', 'Use your legal first name.'),
      ('first_name', 'he', 'שם פרטי', 'הזינו שם פרטי', 'יש להזין שם פרטי כפי שמופיע במסמך.'),

      ('last_name', 'pl', 'Nazwisko', 'Wpisz nazwisko', 'Podaj swoje nazwisko zgodnie z dokumentem.'),
      ('last_name', 'en', 'Last name', 'Enter your last name', 'Use your legal last name.'),
      ('last_name', 'he', 'שם משפחה', 'הזינו שם משפחה', 'יש להזין שם משפחה כפי שמופיע במסמך.'),

      ('email', 'pl', 'E-mail', 'name@example.com', 'Na ten adres wyślemy kontakt dotyczący kampanii.'),
      ('email', 'en', 'Email', 'name@example.com', 'We will use this address for campaign contact.'),
      ('email', 'he', 'אימייל', 'name@example.com', 'נשתמש בכתובת זו ליצירת קשר לגבי הקמפיין.'),

      ('phone', 'pl', 'Telefon', '123456789', 'Wybierz kierunkowy kraju i podaj numer telefonu.'),
      ('phone', 'en', 'Phone', '123456789', 'Choose a country code and enter your phone number.'),
      ('phone', 'he', 'טלפון', '501234567', 'בחרו קידומת מדינה והזינו מספר טלפון.'),

      ('date_of_birth', 'pl', 'Data urodzenia', 'RRRR-MM-DD', 'Kampania jest dostępna tylko dla osób pełnoletnich.'),
      ('date_of_birth', 'en', 'Date of birth', 'YYYY-MM-DD', 'This campaign is available only to adult participants.'),
      ('date_of_birth', 'he', 'תאריך לידה', 'YYYY-MM-DD', 'הקמפיין מיועד למשתתפים בגירים בלבד.'),

      ('country', 'pl', 'Kraj', 'Wybierz lub wpisz kraj', 'Podaj kraj zamieszkania.'),
      ('country', 'en', 'Country', 'Choose or enter your country', 'Enter your country of residence.'),
      ('country', 'he', 'מדינה', 'בחרו או הזינו מדינה', 'יש להזין את מדינת המגורים.'),

      ('city', 'pl', 'Miasto', 'Wpisz miasto', 'Pole opcjonalne.'),
      ('city', 'en', 'City', 'Enter your city', 'Optional field.'),
      ('city', 'he', 'עיר', 'הזינו עיר', 'שדה אופציונלי.'),

      ('contest_answer', 'pl', 'Odpowiedź konkursowa', 'Dlaczego chcesz odwiedzić Lefkarę?', 'Napisz krótką odpowiedź konkursową.'),
      ('contest_answer', 'en', 'Contest answer', 'Why would you like to visit Lefkara?', 'Write a short contest answer.'),
      ('contest_answer', 'he', 'תשובת תחרות', 'למה תרצו לבקר בלפקרה?', 'כתבו תשובה קצרה לתחרות.'),

      ('facebook_profile_url', 'pl', 'Link do profilu Facebook', 'https://facebook.com/...', 'Wklej publiczny link do swojego profilu Facebook.'),
      ('facebook_profile_url', 'en', 'Facebook profile URL', 'https://facebook.com/...', 'Paste a public link to your Facebook profile.'),
      ('facebook_profile_url', 'he', 'קישור לפרופיל פייסבוק', 'https://facebook.com/...', 'הדביקו קישור ציבורי לפרופיל הפייסבוק שלכם.'),

      ('shared_post_url', 'pl', 'Link do udostępnionego posta', 'https://facebook.com/...', 'Wklej link do posta lub udostępnienia związanego z kampanią.'),
      ('shared_post_url', 'en', 'Shared post URL', 'https://facebook.com/...', 'Paste the link to the campaign-related shared post.'),
      ('shared_post_url', 'he', 'קישור לפוסט ששיתפתם', 'https://facebook.com/...', 'הדביקו קישור לפוסט ששיתפתם עבור הקמפיין.'),

      ('terms_accepted', 'pl', 'Akceptuję regulamin kampanii', null, 'Zaznaczenie zgody jest wymagane, aby wysłać formularz.'),
      ('terms_accepted', 'en', 'I accept the campaign rules', null, 'You must accept the rules before submitting the form.'),
      ('terms_accepted', 'he', 'אני מאשר/ת את כללי הקמפיין', null, 'יש לאשר את הכללים לפני שליחת הטופס.')
  ) as t(field_key, lang, label, placeholder, help_text)
    on t.field_key = f.field_key
  where f.offer_id = v_offer_id
  on conflict (field_id, lang) do update
    set label = excluded.label,
        placeholder = excluded.placeholder,
        help_text = excluded.help_text,
        options_json = excluded.options_json,
        updated_at = now();
end;
$$;

commit;
