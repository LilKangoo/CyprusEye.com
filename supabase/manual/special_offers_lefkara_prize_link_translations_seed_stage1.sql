-- Special Offers 3B.3A Lefkara seed draft only.
-- Seeds localized prize/link copy for slug lefkara-giveaway-2026.
-- Idempotent through ON CONFLICT. Do not run automatically.

begin;

do $$
declare
  v_offer_id uuid;
  v_status text;
  v_visibility text;
begin
  select id, status, visibility
    into v_offer_id, v_status, v_visibility
  from public.special_offers
  where slug = 'lefkara-giveaway-2026';

  if v_offer_id is null then
    raise exception 'Special offer not found: lefkara-giveaway-2026';
  end if;

  if v_status <> 'draft' or v_visibility <> 'private' then
    raise exception 'Refusing to seed translations for non-draft/private campaign: status=%, visibility=%', v_status, v_visibility;
  end if;

  insert into public.special_offer_prize_translations (
    prize_id,
    lang,
    name,
    description,
    restrictions,
    fulfillment_notes
  )
  select
    p.id,
    t.lang,
    t.name,
    t.description,
    t.restrictions,
    t.fulfillment_notes
  from public.special_offer_prizes p
  cross join (
    values
      (
        'pl',
        '3 dni / 2 noce w 7 Kamares + auto na 3 dni',
        '3 dni / 2 noce w 7 Kamares w Lefkarze oraz auto na 3 dni: Nissan Note, Kia Rio, Toyota Yaris albo podobna kategoria według dostępności. Nagroda jest dla 1 zwycięzcy i osoby towarzyszącej.',
        'Dla pełnoletniego zwycięzcy i jednej osoby towarzyszącej. Auto według dostępności i zasad wynajmu. Szczegółowy regulamin zostanie dopięty przed publicznym startem kampanii.',
        'Sponsor zakwaterowania: 7 Kamares. Organizator: LilKangooMedia LTD / CyprusEye.com / WakacjeCypr.com. Kategoria auta zależy od dostępności.'
      ),
      (
        'en',
        '3 days / 2 nights at 7 Kamares + a car for 3 days',
        '3 days / 2 nights at 7 Kamares in Lefkara and a car for 3 days: Nissan Note, Kia Rio, Toyota Yaris or a similar category depending on availability. The prize is for 1 winner and one accompanying person.',
        'For an adult winner and one accompanying person. The car is subject to availability and rental rules. Final terms will be completed before the public campaign launch.',
        'Accommodation sponsor: 7 Kamares. Organizer: LilKangooMedia LTD / CyprusEye.com / WakacjeCypr.com. Car category depends on availability.'
      ),
      (
        'he',
        '3 ימים / 2 לילות ב-7 Kamares + רכב ל-3 ימים',
        '3 ימים / 2 לילות ב-7 Kamares בלפקרה ורכב ל-3 ימים: Nissan Note, Kia Rio, Toyota Yaris או קטגוריה דומה, בהתאם לזמינות. הפרס מיועד לזוכה אחד ולאדם מלווה אחד.',
        'מיועד לזוכה בגיר ולאדם מלווה אחד. הרכב כפוף לזמינות ולכללי ההשכרה. התנאים הסופיים יושלמו לפני ההשקה הציבורית של הקמפיין.',
        'נותן החסות לאירוח: 7 Kamares. מארגן: LilKangooMedia LTD / CyprusEye.com / WakacjeCypr.com. קטגוריית הרכב תלויה בזמינות.'
      )
  ) as t(lang, name, description, restrictions, fulfillment_notes)
  where p.offer_id = v_offer_id
  on conflict (prize_id, lang) do update
    set name = excluded.name,
        description = excluded.description,
        restrictions = excluded.restrictions,
        fulfillment_notes = excluded.fulfillment_notes,
        updated_at = now();

  insert into public.special_offer_link_translations (
    link_id,
    lang,
    label,
    description,
    url
  )
  select
    l.id,
    t.lang,
    t.label,
    t.description,
    t.url
  from public.special_offer_links l
  join (
    values
      (
        'custom',
        'pl',
        'Kampania Lefkara 2026',
        'Strona kampanii Lefkara 2026. Link zostanie zastąpiony właściwą publiczną stroną kampanii po wdrożeniu landing page.',
        '/special-offers/lefkara-giveaway-2026?lang=pl'
      ),
      (
        'custom',
        'en',
        'Lefkara Campaign 2026',
        'Lefkara 2026 campaign page. This link will be replaced with the final public campaign page after landing page implementation.',
        '/special-offers/lefkara-giveaway-2026?lang=en'
      ),
      (
        'custom',
        'he',
        'קמפיין לפקרה 2026',
        'עמוד קמפיין לפקרה 2026. הקישור יוחלף בעמוד הציבורי הסופי לאחר הטמעת עמוד הקמפיין.',
        '/special-offers/lefkara-giveaway-2026?lang=he'
      ),
      (
        'cars',
        'pl',
        'Auta na Cyprze',
        'Wynajem auta na Cyprze z ofert CyprusEye.',
        '/car.html?lang=pl'
      ),
      (
        'cars',
        'en',
        'Cars in Cyprus',
        'Car rental in Cyprus from CyprusEye offers.',
        '/car.html?lang=en'
      ),
      (
        'cars',
        'he',
        'רכבים בקפריסין',
        'השכרת רכב בקפריסין דרך ההצעות של CyprusEye.',
        '/car.html?lang=he'
      ),
      (
        'transport',
        'pl',
        'Transport na Cyprze',
        'Transfery i transport na Cyprze.',
        '/transport.html?lang=pl'
      ),
      (
        'transport',
        'en',
        'Transport in Cyprus',
        'Transfers and transport in Cyprus.',
        '/transport.html?lang=en'
      ),
      (
        'transport',
        'he',
        'הסעות בקפריסין',
        'הסעות וטרנספרים בקפריסין.',
        '/transport.html?lang=he'
      ),
      (
        'trips',
        'pl',
        'Wycieczki na Cyprze',
        'Wycieczki i atrakcje na Cyprze.',
        '/trips.html?lang=pl'
      ),
      (
        'trips',
        'en',
        'Trips in Cyprus',
        'Trips and attractions in Cyprus.',
        '/trips.html?lang=en'
      ),
      (
        'trips',
        'he',
        'טיולים בקפריסין',
        'טיולים ואטרקציות בקפריסין.',
        '/trips.html?lang=he'
      )
  ) as t(link_type, lang, label, description, url)
    on t.link_type = l.link_type
  where l.offer_id = v_offer_id
  on conflict (link_id, lang) do update
    set label = excluded.label,
        description = excluded.description,
        url = excluded.url,
        updated_at = now();
end;
$$;

commit;
