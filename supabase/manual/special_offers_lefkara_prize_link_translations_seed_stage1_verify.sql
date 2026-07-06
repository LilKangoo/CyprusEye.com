-- Special Offers 3B.3A Lefkara seed verify draft.
-- Read-only checks after running the Lefkara prize/link translation seed.

select
  'campaign exists' as check_name,
  exists (
    select 1
    from public.special_offers
    where slug = 'lefkara-giveaway-2026'
  ) as pass;

with lefkara as (
  select id, slug, status, visibility
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'campaign state' as check_name,
  slug,
  status,
  visibility,
  status = 'draft' as is_draft,
  visibility = 'private' as is_private
from lefkara;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
prizes as (
  select p.id
  from public.special_offer_prizes p
  join lefkara l on l.id = p.offer_id
),
expected as (
  select count(*) * 3 as expected_rows
  from prizes
),
actual as (
  select count(*) as actual_rows
  from public.special_offer_prize_translations pt
  join prizes p on p.id = pt.prize_id
  where pt.lang in ('pl', 'en', 'he')
)
select
  'prize translations PL/EN/HE' as check_name,
  expected.expected_rows,
  actual.actual_rows,
  actual.actual_rows = expected.expected_rows as pass
from expected, actual;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'prize translation languages' as check_name,
  pt.lang,
  count(*) as row_count
from public.special_offer_prizes p
join lefkara l on l.id = p.offer_id
join public.special_offer_prize_translations pt on pt.prize_id = p.id
where pt.lang in ('pl', 'en', 'he')
group by pt.lang
order by pt.lang;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'prize duplicate check' as check_name,
  pt.prize_id,
  pt.lang,
  count(*) as duplicate_count
from public.special_offer_prizes p
join lefkara l on l.id = p.offer_id
join public.special_offer_prize_translations pt on pt.prize_id = p.id
group by pt.prize_id, pt.lang
having count(*) > 1;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
links as (
  select l.id
  from public.special_offer_links l
  join lefkara o on o.id = l.offer_id
  where l.link_type in ('custom', 'cars', 'transport', 'trips')
),
expected as (
  select count(*) * 3 as expected_rows
  from links
),
actual as (
  select count(*) as actual_rows
  from public.special_offer_link_translations lt
  join links l on l.id = lt.link_id
  where lt.lang in ('pl', 'en', 'he')
)
select
  'link translations PL/EN/HE' as check_name,
  expected.expected_rows,
  actual.actual_rows,
  actual.actual_rows = expected.expected_rows as pass
from expected, actual;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'link translation languages' as check_name,
  l.link_type,
  lt.lang,
  count(*) as row_count
from public.special_offer_links l
join lefkara o on o.id = l.offer_id
join public.special_offer_link_translations lt on lt.link_id = l.id
where l.link_type in ('custom', 'cars', 'transport', 'trips')
  and lt.lang in ('pl', 'en', 'he')
group by l.link_type, lt.lang
order by l.link_type, lt.lang;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'link duplicate check' as check_name,
  lt.link_id,
  lt.lang,
  count(*) as duplicate_count
from public.special_offer_links l
join lefkara o on o.id = l.offer_id
join public.special_offer_link_translations lt on lt.link_id = l.id
group by lt.link_id, lt.lang
having count(*) > 1;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'he rows exist' as check_name,
  (
    select count(*)
    from public.special_offer_prizes p
    join public.special_offer_prize_translations pt on pt.prize_id = p.id
    where p.offer_id = lefkara.id
      and pt.lang = 'he'
  ) as prize_he_rows,
  (
    select count(*)
    from public.special_offer_links l
    join public.special_offer_link_translations lt on lt.link_id = l.id
    where l.offer_id = lefkara.id
      and lt.lang = 'he'
  ) as link_he_rows
from lefkara;

with lefkara as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'localized link URL lang params' as check_name,
  l.link_type,
  lt.lang,
  lt.url,
  lt.url like '%lang=' || lt.lang as has_matching_lang_param
from public.special_offer_links l
join lefkara o on o.id = l.offer_id
join public.special_offer_link_translations lt on lt.link_id = l.id
where l.link_type in ('custom', 'cars', 'transport', 'trips')
order by l.link_type, lt.lang;

select
  'forbidden special offer tables existence only' as check_name,
  to_regclass('public.special_offer_entries') as special_offer_entries,
  to_regclass('public.special_offer_tasks') as special_offer_tasks,
  to_regclass('public.special_offer_entry_tasks') as special_offer_entry_tasks,
  to_regclass('public.special_offer_draws') as special_offer_draws,
  to_regclass('public.special_offer_draw_entries') as special_offer_draw_entries,
  to_regclass('public.special_offer_winners') as special_offer_winners;
