-- =====================================================
-- Special Offers Lefkara campaign seed - Stage 1 draft
-- =====================================================
-- Prepared only. Do not run until reviewed.
--
-- This seed is intentionally admin/private:
-- - status = draft
-- - visibility = private
-- - no entries/tasks/draws/winners
-- - no social media integrations
-- - no service resource_id guesses
-- =====================================================

DO $$
DECLARE
  v_offer_id uuid;
BEGIN
  INSERT INTO public.special_offers (
    slug,
    type,
    winner_selection_mode,
    status,
    visibility,
    start_at,
    end_at,
    winner_announce_at,
    timezone,
    requires_login,
    requires_form,
    requires_manual_approval,
    allow_multiple_entries,
    max_entries_per_user,
    allow_bonus_points,
    exclude_admins,
    exclude_partners,
    public_winner_display,
    response_deadline_days,
    settings_json,
    updated_at
  )
  VALUES (
    'lefkara-giveaway-2026',
    'contest',
    'manual_selection',
    'draft',
    'private',
    timestamptz '2026-07-15 00:00:00+03',
    timestamptz '2026-09-15 23:59:00+03',
    timestamptz '2026-09-20 12:00:00+03',
    'Asia/Nicosia',
    true,
    true,
    true,
    false,
    1,
    true,
    true,
    false,
    false,
    7,
    jsonb_build_object(
      'partner', '7 Kamares',
      'organizers', jsonb_build_array('LilKangooMedia LTD', 'CyprusEye.com', 'WakacjeCypr.com'),
      'requested_timezone_label', 'Asia/Nicosia',
      'selection_model_note', 'Current Lefkara campaign is a judged contest/manual selection. Future bonus activity can be modeled as manual points/tickets, but no automatic social integrations are used.',
      'mandatory_conditions', jsonb_build_array(
        'Observe CyprusEye.com / WakacjeCypr.com Facebook profile',
        'Observe 7 Kamares profile',
        'Share the official contest post on Facebook',
        'Register or log in on CyprusEye',
        'Submit entry form',
        'Answer contest question',
        'Accept rules',
        'Participant must be adult and provide real contact details'
      ),
      'extra_manual_activity', jsonb_build_array(
        'Sharing more official campaign posts can increase chance',
        'Valuable comments in first 24h can increase chance',
        'Spam or repeated artificial comments should not count',
        'Extra activity does not replace mandatory form'
      ),
      'social_verification', jsonb_build_object(
        'mode', 'manual',
        'automatic_integrations', false,
        'notes', 'Admin verifies Facebook follows, shares, comments, evidence links, and bonus activity manually in later stages.'
      )
    ),
    now()
  )
  ON CONFLICT (slug) DO UPDATE SET
    type = EXCLUDED.type,
    winner_selection_mode = EXCLUDED.winner_selection_mode,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    winner_announce_at = EXCLUDED.winner_announce_at,
    timezone = EXCLUDED.timezone,
    requires_login = EXCLUDED.requires_login,
    requires_form = EXCLUDED.requires_form,
    requires_manual_approval = EXCLUDED.requires_manual_approval,
    allow_multiple_entries = EXCLUDED.allow_multiple_entries,
    max_entries_per_user = EXCLUDED.max_entries_per_user,
    allow_bonus_points = EXCLUDED.allow_bonus_points,
    exclude_admins = EXCLUDED.exclude_admins,
    exclude_partners = EXCLUDED.exclude_partners,
    public_winner_display = EXCLUDED.public_winner_display,
    response_deadline_days = EXCLUDED.response_deadline_days,
    settings_json = EXCLUDED.settings_json,
    updated_at = now()
  RETURNING id INTO v_offer_id;

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
  VALUES (
    v_offer_id,
    'pl',
    'Wygraj 3 dni w Lefkarze + auto na 3 dni',
    'Konkurs CyprusEye.com i WakacjeCypr.com z pobytem w 7 Kamares oraz autem na 3 dni dla zwycięzcy i osoby towarzyszącej.',
    'Weź udział w kampanii Lefkara 2026. Zwycięzca otrzyma pobyt 3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni według dostępności. Aktywności społecznościowe będą weryfikowane ręcznie przez admina, bez automatycznych integracji z Facebookiem lub innymi platformami.',
    '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni: Nissan Note, Kia Rio, Toyota Yaris albo podobna kategoria według dostępności. Nagroda jest dla 1 zwycięzcy i osoby towarzyszącej.',
    '<p>Warunki wymagane: obserwuj profil CyprusEye.com / WakacjeCypr.com na Facebooku, obserwuj profil 7 Kamares, udostępnij oficjalny post konkursowy na Facebooku, zarejestruj się lub zaloguj na CyprusEye, wyślij formularz zgłoszeniowy, odpowiedz na pytanie konkursowe i zaakceptuj regulamin. Uczestnik musi być pełnoletni i podać prawdziwe dane kontaktowe.</p><p>Dodatkowa ręcznie weryfikowana aktywność, taka jak udostępnianie kolejnych oficjalnych postów kampanii lub wartościowe komentarze w pierwszych 24 godzinach, może zwiększyć szansę. Spam i sztucznie powtarzane komentarze nie powinny być liczone. Dodatkowa aktywność nie zastępuje obowiązkowego formularza.</p>',
    jsonb_build_array(
      jsonb_build_object(
        'question', 'Czy aktywność w social media jest weryfikowana automatycznie?',
        'answer', 'Nie. Wszystkie aktywności social media będą weryfikowane ręcznie przez admina w późniejszym etapie systemu.'
      ),
      jsonb_build_object(
        'question', 'Czy dodatkowe udostępnienia zastępują formularz?',
        'answer', 'Nie. Formularz zgłoszeniowy i odpowiedź konkursowa są obowiązkowe.'
      )
    ),
    'Wygraj 3 dni w Lefkarze + auto na 3 dni',
    'Konkurs Lefkara 2026: pobyt w 7 Kamares i auto na 3 dni dla zwycięzcy oraz osoby towarzyszącej.',
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

  UPDATE public.special_offer_prizes
  SET
    description = '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni: Nissan Note, Kia Rio, Toyota Yaris albo podobna kategoria według dostępności. Nagroda jest dla 1 zwycięzcy i osoby towarzyszącej.',
    sponsor_name = '7 Kamares',
    quantity = 1,
    value_estimate = NULL,
    currency = 'EUR',
    restrictions = 'Dla pełnoletniego zwycięzcy i osoby towarzyszącej. Auto według dostępności i zasad wynajmu. Szczegółowy regulamin zostanie dopięty w późniejszym etapie.',
    fulfillment_notes = 'Accommodation sponsor: 7 Kamares. Organizer: LilKangooMedia LTD / CyprusEye.com / WakacjeCypr.com. Car category subject to availability.',
    sort_order = 0,
    updated_at = now()
  WHERE offer_id = v_offer_id
    AND name = '3 dni / 2 noce w 7 Kamares + auto na 3 dni';

  IF NOT FOUND THEN
    INSERT INTO public.special_offer_prizes (
      offer_id,
      name,
      description,
      sponsor_name,
      quantity,
      value_estimate,
      currency,
      restrictions,
      fulfillment_notes,
      sort_order
    )
    VALUES (
      v_offer_id,
      '3 dni / 2 noce w 7 Kamares + auto na 3 dni',
      '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni: Nissan Note, Kia Rio, Toyota Yaris albo podobna kategoria według dostępności. Nagroda jest dla 1 zwycięzcy i osoby towarzyszącej.',
      '7 Kamares',
      1,
      NULL,
      'EUR',
      'Dla pełnoletniego zwycięzcy i osoby towarzyszącej. Auto według dostępności i zasad wynajmu. Szczegółowy regulamin zostanie dopięty w późniejszym etapie.',
      'Accommodation sponsor: 7 Kamares. Organizer: LilKangooMedia LTD / CyprusEye.com / WakacjeCypr.com. Car category subject to availability.',
      0
    );
  END IF;

  UPDATE public.special_offer_links
  SET
    label = 'Auta na Cyprze',
    description = 'Generic car rental CTA for the campaign. No resource_id is guessed.',
    is_primary = false,
    sort_order = 10,
    updated_at = now()
  WHERE offer_id = v_offer_id
    AND link_type = 'cars'
    AND resource_id IS NULL
    AND url = '/car.html?lang=pl';

  IF NOT FOUND THEN
    INSERT INTO public.special_offer_links (offer_id, link_type, resource_id, url, label, description, is_primary, sort_order)
    VALUES (v_offer_id, 'cars', NULL, '/car.html?lang=pl', 'Auta na Cyprze', 'Generic car rental CTA for the campaign. No resource_id is guessed.', false, 10);
  END IF;

  UPDATE public.special_offer_links
  SET
    label = 'Transport na Cyprze',
    description = 'Generic transport CTA for the campaign. No route resource_id is guessed.',
    is_primary = false,
    sort_order = 20,
    updated_at = now()
  WHERE offer_id = v_offer_id
    AND link_type = 'transport'
    AND resource_id IS NULL
    AND url = '/transport.html?lang=pl';

  IF NOT FOUND THEN
    INSERT INTO public.special_offer_links (offer_id, link_type, resource_id, url, label, description, is_primary, sort_order)
    VALUES (v_offer_id, 'transport', NULL, '/transport.html?lang=pl', 'Transport na Cyprze', 'Generic transport CTA for the campaign. No route resource_id is guessed.', false, 20);
  END IF;

  UPDATE public.special_offer_links
  SET
    label = 'Wycieczki na Cyprze',
    description = 'Generic trips CTA for the campaign. No trip resource_id is guessed.',
    is_primary = false,
    sort_order = 30,
    updated_at = now()
  WHERE offer_id = v_offer_id
    AND link_type = 'trips'
    AND resource_id IS NULL
    AND url = '/trips.html?lang=pl';

  IF NOT FOUND THEN
    INSERT INTO public.special_offer_links (offer_id, link_type, resource_id, url, label, description, is_primary, sort_order)
    VALUES (v_offer_id, 'trips', NULL, '/trips.html?lang=pl', 'Wycieczki na Cyprze', 'Generic trips CTA for the campaign. No trip resource_id is guessed.', false, 30);
  END IF;

  UPDATE public.special_offer_links
  SET
    label = 'Kampania Lefkara 2026',
    description = 'Future Special Offers landing placeholder. Replace when public landing route exists.',
    is_primary = true,
    sort_order = 0,
    updated_at = now()
  WHERE offer_id = v_offer_id
    AND link_type = 'custom'
    AND resource_id IS NULL
    AND url = '/special-offers/lefkara-giveaway-2026?lang=pl';

  IF NOT FOUND THEN
    INSERT INTO public.special_offer_links (offer_id, link_type, resource_id, url, label, description, is_primary, sort_order)
    VALUES (v_offer_id, 'custom', NULL, '/special-offers/lefkara-giveaway-2026?lang=pl', 'Kampania Lefkara 2026', 'Future Special Offers landing placeholder. Replace when public landing route exists.', true, 0);
  END IF;
END $$;
