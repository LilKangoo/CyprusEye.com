-- Special Offers 3C.1 Lefkara form builder seed verify draft.
-- Read-only checks after running the Lefkara form field seed.

with campaign as (
  select id, slug, status, visibility, requires_form
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'campaign exists and remains draft/private' as check_name,
  exists(select 1 from campaign) as campaign_exists,
  exists(select 1 from campaign where status = 'draft' and visibility = 'private') as is_draft_private,
  exists(select 1 from campaign where requires_form = true) as requires_form_enabled;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
expected(field_key) as (
  values
    ('first_name'),
    ('last_name'),
    ('email'),
    ('phone'),
    ('date_of_birth'),
    ('country'),
    ('city'),
    ('contest_answer'),
    ('facebook_profile_url'),
    ('shared_post_url'),
    ('terms_accepted')
),
field_counts as (
  select f.field_key, count(*) as row_count
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
  group by f.field_key
)
select
  'expected field keys' as check_name,
  e.field_key,
  coalesce(fc.row_count, 0) as row_count,
  coalesce(fc.row_count, 0) = 1 as pass
from expected e
left join field_counts fc on fc.field_key = e.field_key
order by e.field_key;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'field count' as check_name,
  count(*) as field_count,
  count(*) = 11 as pass
from public.special_offer_form_fields f
join campaign c on c.id = f.offer_id;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'duplicate fields' as check_name,
  count(*) as duplicate_group_count,
  count(*) = 0 as pass
from (
  select f.offer_id, f.field_key
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
  group by f.offer_id, f.field_key
  having count(*) > 1
) duplicates;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
seeded_fields as (
  select f.id, f.field_key
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
),
langs(lang) as (
  values ('pl'), ('en'), ('he')
)
select
  'field translations PL/EN/HE' as check_name,
  sf.field_key,
  l.lang,
  exists (
    select 1
    from public.special_offer_form_field_translations t
    where t.field_id = sf.id
      and t.lang = l.lang
  ) as pass
from seeded_fields sf
cross join langs l
order by sf.field_key, l.lang;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
seeded_fields as (
  select f.id
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
)
select
  'translation count' as check_name,
  count(*) as translation_count,
  count(*) = 33 as pass
from public.special_offer_form_field_translations t
join seeded_fields f on f.id = t.field_id;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
seeded_fields as (
  select f.id
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
)
select
  'duplicate translations' as check_name,
  count(*) as duplicate_group_count,
  count(*) = 0 as pass
from (
  select t.field_id, t.lang
  from public.special_offer_form_field_translations t
  join seeded_fields f on f.id = t.field_id
  group by t.field_id, t.lang
  having count(*) > 1
) duplicates;

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'date_of_birth min_age' as check_name,
  f.validation_json,
  f.validation_json ->> 'min_age' = '18' as pass
from public.special_offer_form_fields f
join campaign c on c.id = f.offer_id
where f.field_key = 'date_of_birth';

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'terms_accepted must_be_true' as check_name,
  f.validation_json,
  (f.validation_json ->> 'must_be_true')::boolean is true as pass
from public.special_offer_form_fields f
join campaign c on c.id = f.offer_id
where f.field_key = 'terms_accepted';

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'phone field required' as check_name,
  f.field_key,
  f.field_type,
  f.required,
  f.field_type = 'phone' and f.required = true as pass
from public.special_offer_form_fields f
join campaign c on c.id = f.offer_id
where f.field_key = 'phone';

with campaign as (
  select id
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
seeded_fields as (
  select f.id
  from public.special_offer_form_fields f
  join campaign c on c.id = f.offer_id
)
select
  'options_json arrays' as check_name,
  count(*) filter (where jsonb_typeof(t.options_json) = 'array') as array_option_rows,
  count(*) as total_translation_rows,
  count(*) filter (where jsonb_typeof(t.options_json) = 'array') = count(*) as pass
from public.special_offer_form_field_translations t
join seeded_fields f on f.id = t.field_id;

select
  'entries/tasks/draw/winners tables are not required by 3C.1' as check_name,
  to_regclass('public.special_offer_entries') is null as entries_table_not_created,
  to_regclass('public.special_offer_entry_answers') is null as entry_answers_table_not_created,
  to_regclass('public.special_offer_tasks') is null as tasks_table_not_created,
  to_regclass('public.special_offer_entry_tasks') is null as entry_tasks_table_not_created,
  to_regclass('public.special_offer_draws') is null as draws_table_not_created,
  to_regclass('public.special_offer_draw_entries') is null as draw_entries_table_not_created,
  to_regclass('public.special_offer_winners') is null as winners_table_not_created;
