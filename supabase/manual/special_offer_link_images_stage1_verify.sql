-- Special Offers 3C.4C verify draft.
-- Read-only checks for public.special_offer_links.image_url.
-- Run after special_offer_link_images_stage1.sql only.

with table_check as (
  select to_regclass('public.special_offer_links') is not null as table_exists
)
select
  'special_offer_links table exists' as check_name,
  table_exists as pass
from table_check;

with column_check as (
  select
    count(*) filter (where c.column_name = 'image_url') as column_count,
    max(c.data_type) filter (where c.column_name = 'image_url') as data_type,
    max(c.is_nullable) filter (where c.column_name = 'image_url') as is_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'special_offer_links'
)
select
  'image_url column exists' as check_name,
  column_count = 1 as pass,
  column_count
from column_check;

with column_check as (
  select
    max(c.data_type) filter (where c.column_name = 'image_url') as data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'special_offer_links'
)
select
  'image_url column type is text' as check_name,
  data_type = 'text' as pass,
  data_type
from column_check;

with column_check as (
  select
    max(c.is_nullable) filter (where c.column_name = 'image_url') as is_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'special_offer_links'
)
select
  'image_url column is nullable' as check_name,
  is_nullable = 'YES' as pass,
  is_nullable
from column_check;

with constraint_check as (
  select
    count(*) filter (where con.conname = 'special_offer_links_image_url_safe_check') as constraint_count,
    bool_or(con.convalidated) filter (where con.conname = 'special_offer_links_image_url_safe_check') as convalidated,
    max(pg_get_constraintdef(con.oid)) filter (where con.conname = 'special_offer_links_image_url_safe_check') as constraint_definition
  from pg_constraint con
  where con.conrelid = coalesce(to_regclass('public.special_offer_links')::oid, 0::oid)
)
select
  'image_url safety check constraint exists' as check_name,
  constraint_count = 1 as pass,
  constraint_count,
  constraint_definition
from constraint_check;

with constraint_check as (
  select
    bool_or(con.convalidated) filter (where con.conname = 'special_offer_links_image_url_safe_check') as convalidated
  from pg_constraint con
  where con.conrelid = coalesce(to_regclass('public.special_offer_links')::oid, 0::oid)
)
select
  'image_url safety check constraint is validated' as check_name,
  coalesce(convalidated, false) as pass,
  coalesce(convalidated, false) as convalidated
from constraint_check;

with rls_check as (
  select
    bool_or(c.relrowsecurity) as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'special_offer_links'
)
select
  'special_offer_links RLS is enabled' as check_name,
  coalesce(rls_enabled, false) as pass,
  coalesce(rls_enabled, false) as rls_enabled
from rls_check;

select
  'no anon/PUBLIC direct write grants on special_offer_links' as check_name,
  not exists (
    select 1
    from information_schema.table_privileges p
    where p.table_schema = 'public'
      and p.table_name = 'special_offer_links'
      and p.grantee in ('PUBLIC', 'anon')
      and p.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) as pass;

with lefkara_check as (
  select
    count(*) as campaign_count,
    bool_or(status = 'draft' and visibility = 'private') as draft_private,
    max(status) as status,
    max(visibility) as visibility
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
)
select
  'Lefkara remains draft/private' as check_name,
  campaign_count = 1 and coalesce(draft_private, false) as pass,
  campaign_count,
  status,
  visibility
from lefkara_check;

with samples(value, expected, reason) as (
  values
    (null::text, true, 'NULL is allowed'),
    ('https://example.com/image.jpg', true, 'full HTTPS URL with host'),
    ('https://cdn.example.com/images/photo.webp?size=large', true, 'HTTPS URL with query string'),
    ('https://example.com:443/image.jpg', true, 'HTTPS URL with port'),
    ('/assets/images/photo.jpg', true, 'local path'),
    ('/images/photo.webp?version=2', true, 'local path with query string'),
    ('', false, 'empty string rejected'),
    (' ', false, 'space rejected'),
    ('https://', false, 'HTTPS scheme without host rejected'),
    ('https:// ', false, 'HTTPS scheme with whitespace rejected'),
    (' https://example.com/image.jpg', false, 'leading whitespace rejected'),
    ('https://example.com/image.jpg ', false, 'trailing whitespace rejected'),
    ('http://example.com/image.jpg', false, 'HTTP rejected'),
    ('//example.com/image.jpg', false, 'protocol-relative URL rejected'),
    ('/', false, 'bare slash rejected'),
    ('/ ', false, 'slash followed by whitespace rejected'),
    ('javascript:alert(1)', false, 'javascript protocol rejected'),
    ('data:image/png;base64,...', false, 'data protocol rejected'),
    ('blob:https://example.com/abc', false, 'blob protocol rejected'),
    ('file:///tmp/image.jpg', false, 'file protocol rejected'),
    (E'https://example.com/image\t.jpg', false, 'tab rejected'),
    (E'https://example.com/image\n.jpg', false, 'newline rejected'),
    (E'/images/photo\001.jpg', false, 'control character rejected')
),
evaluated as (
  select
    value,
    expected,
    reason,
    (
      value is null
      or (
        length(value) between 1 and 2048
        and value !~ '[[:space:][:cntrl:]]'
        and (
          value ~* '^https://[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#][^[:space:][:cntrl:]]*)?$'
          or value ~ '^/[^/[:space:][:cntrl:]?#][^[:space:][:cntrl:]]*$'
        )
      )
    ) as actual
  from samples
)
select
  'image_url validation matrix' as check_name,
  value,
  expected,
  actual,
  expected = actual as pass,
  reason
from evaluated
order by reason;

select
  'all existing image_url values are NULL after base SQL' as check_name,
  count(*) filter (where to_jsonb(l)->>'image_url' is not null) = 0 as pass,
  count(*) filter (where to_jsonb(l)->>'image_url' is not null) as non_null_image_url_count,
  count(*) as link_count
from public.special_offer_links l;

with expected_links(id) as (
  values
    ('f25765dd-4db8-4a58-8ebf-e55a0a8daa3e'::uuid),
    ('6dfae307-c1cc-4bed-a2eb-41b5c1d1b115'::uuid),
    ('a57d6f8e-17aa-403d-af43-9aa8a0125ad3'::uuid)
),
managed_links as (
  select l.*
  from expected_links e
  left join public.special_offer_links l on l.id = e.id
)
select
  'three managed Lefkara links still exist and image_url is NULL' as check_name,
  count(id) = 3
    and count(*) filter (where to_jsonb(managed_links)->>'image_url' is not null) = 0 as pass,
  count(id) as existing_managed_link_count,
  count(*) filter (where to_jsonb(managed_links)->>'image_url' is not null) as managed_non_null_image_url_count
from managed_links;

with expected_links(id) as (
  values
    ('f25765dd-4db8-4a58-8ebf-e55a0a8daa3e'::uuid),
    ('6dfae307-c1cc-4bed-a2eb-41b5c1d1b115'::uuid),
    ('a57d6f8e-17aa-403d-af43-9aa8a0125ad3'::uuid)
),
translation_check as (
  select
    count(t.id) as translation_count,
    count(distinct (t.link_id, t.lang)) as unique_link_language_count,
    count(*) filter (where t.lang = 'pl') as pl_rows,
    count(*) filter (where t.lang = 'en') as en_rows,
    count(*) filter (where t.lang = 'he') as he_rows
  from expected_links e
  left join public.special_offer_link_translations t on t.link_id = e.id
)
select
  'managed Lefkara links have 9 PL/EN/HE translations' as check_name,
  translation_count = 9
    and unique_link_language_count = 9
    and pl_rows = 3
    and en_rows = 3
    and he_rows = 3 as pass,
  translation_count,
  unique_link_language_count,
  pl_rows,
  en_rows,
  he_rows
from translation_check;

with expected_links(id) as (
  values
    ('f25765dd-4db8-4a58-8ebf-e55a0a8daa3e'::uuid),
    ('6dfae307-c1cc-4bed-a2eb-41b5c1d1b115'::uuid),
    ('a57d6f8e-17aa-403d-af43-9aa8a0125ad3'::uuid)
)
select
  'managed Lefkara link content snapshot for manual comparison' as check_name,
  l.id,
  l.link_type,
  l.url,
  l.label,
  l.description,
  l.sort_order,
  to_jsonb(l)->>'image_url' as image_url
from expected_links e
left join public.special_offer_links l on l.id = e.id
order by l.sort_order, l.id;

with expected_links(id) as (
  values
    ('f25765dd-4db8-4a58-8ebf-e55a0a8daa3e'::uuid),
    ('6dfae307-c1cc-4bed-a2eb-41b5c1d1b115'::uuid),
    ('a57d6f8e-17aa-403d-af43-9aa8a0125ad3'::uuid)
)
select
  'managed Lefkara link translation content snapshot for manual comparison' as check_name,
  t.link_id,
  t.lang,
  t.url,
  t.label,
  t.description
from expected_links e
left join public.special_offer_link_translations t on t.link_id = e.id
order by t.link_id, t.lang;
