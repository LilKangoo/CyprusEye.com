-- Stage 4/5 Hebrew internal rollout schema checks.
--
-- Use this file in Supabase SQL Editor:
-- 1. Before rollout: run sections 0 and 3 to see current migration/column state.
-- 2. Apply supabase/manual/manual_he_rollout_177_178.sql.
-- 3. After rollout: run sections 1-7.
-- 4. The sanity write/read section uses BEGIN + ROLLBACK and should not persist
--    data. Review returned rows to confirm fields accept HE values.
--
-- Rollback note:
-- The rollout is additive. If a post-rollout app check fails, do not drop columns.
-- Disable the UI path/revert app code first. Dropping HE columns would destroy
-- internal translation work and is intentionally not part of this checklist.

-- 0) Pre-rollout migration history snapshot.
select
  version,
  name
from supabase_migrations.schema_migrations
where version between '095' and '178'
   or version in ('9991', '9992', '9993', '9994')
order by version;

-- 1) Post-rollout migration history: confirm both HE migrations are registered
-- only after manual SQL is applied and migration repair is intentionally run.
select
  version,
  name
from supabase_migrations.schema_migrations
where version in ('177', '178')
order by version;

-- 2) profiles.preferred_language constraint allows he.
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_preferred_language_chk';

-- 3) Required HE columns and types.
with expected(table_name, column_name) as (
  values
    ('profiles', 'preferred_language'),
    ('blog_posts', 'categories_he'),
    ('blog_posts', 'tags_he'),
    ('pois', 'name_i18n'),
    ('pois', 'description_i18n'),
    ('pois', 'badge_i18n'),
    ('poi_categories', 'name_he'),
    ('shop_vendors', 'name_he'),
    ('shop_vendors', 'description_he'),
    ('shop_categories', 'name_he'),
    ('shop_categories', 'description_he'),
    ('shop_categories', 'meta_title_he'),
    ('shop_categories', 'meta_description_he'),
    ('shop_attributes', 'name_he'),
    ('shop_attribute_values', 'value_he'),
    ('shop_tax_classes', 'name_he'),
    ('shop_tax_classes', 'description_he'),
    ('shop_shipping_classes', 'name_he'),
    ('shop_shipping_classes', 'description_he'),
    ('shop_shipping_zones', 'name_he'),
    ('shop_shipping_methods', 'name_he'),
    ('shop_shipping_methods', 'description_he'),
    ('shop_customer_groups', 'name_he'),
    ('shop_customer_groups', 'description_he'),
    ('shop_products', 'name_he'),
    ('shop_products', 'description_he'),
    ('shop_products', 'short_description_he'),
    ('shop_products', 'meta_title_he'),
    ('shop_products', 'meta_description_he'),
    ('shop_product_variants', 'name_he'),
    ('shop_discounts', 'description_he'),
    ('shop_email_templates', 'subject_he'),
    ('shop_email_templates', 'body_html_he'),
    ('email_template_versions', 'content'),
    ('transport_locations', 'name_he')
)
select
  e.table_name,
  e.column_name,
  coalesce(c.data_type, 'MISSING') as data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  case when c.column_name is null then 'missing' else 'ok' end as status
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- 4) Blog HE taxonomy indexes.
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'blog_posts'
  and indexname in ('idx_blog_posts_categories_he_gin', 'idx_blog_posts_tags_he_gin')
order by indexname;

-- 5) Existing row sanity: this should not error and should return counts.
select
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.blog_posts) as blog_posts_count,
  (select count(*) from public.pois) as pois_count,
  (select count(*) from public.shop_products) as shop_products_count,
  (select count(*) from public.transport_locations) as transport_locations_count;

-- 6) Optional: inspect whether any HE content already exists.
select
  (select count(*) from public.blog_posts where coalesce(array_length(categories_he, 1), 0) > 0 or coalesce(array_length(tags_he, 1), 0) > 0) as blog_he_taxonomy_rows,
  (select count(*) from public.pois where name_i18n ? 'he' or description_i18n ? 'he' or badge_i18n ? 'he') as poi_he_rows,
  (select count(*) from public.shop_products where nullif(trim(coalesce(name_he, '')), '') is not null) as shop_product_he_rows,
  (select count(*) from public.transport_locations where nullif(trim(coalesce(name_he, '')), '') is not null) as transport_location_he_rows;

-- 7) Transactional sanity write/read checks.
-- This section intentionally rolls back. Run after rollout.
begin;

with target as (
  select id from public.profiles order by created_at nulls last limit 1
)
update public.profiles p
set preferred_language = 'he'
from target
where p.id = target.id
returning 'profiles.preferred_language' as check_name, p.id::text as row_id, p.preferred_language as he_value;

with target as (
  select id from public.blog_posts order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.blog_posts b
set
  categories_he = array['בדיקה'],
  tags_he = array['qa-he']
from target
where b.id = target.id
returning 'blog_posts.categories_he/tags_he' as check_name, b.id::text as row_id, b.categories_he::text as he_value;

with target as (
  select id from public.pois order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.pois p
set
  name_i18n = jsonb_set(coalesce(p.name_i18n, '{}'::jsonb), '{he}', to_jsonb('בדיקת שם'::text), true),
  description_i18n = jsonb_set(coalesce(p.description_i18n, '{}'::jsonb), '{he}', to_jsonb('בדיקת תיאור'::text), true),
  badge_i18n = jsonb_set(coalesce(p.badge_i18n, '{}'::jsonb), '{he}', to_jsonb('בדיקה'::text), true)
from target
where p.id = target.id
returning 'pois.*_i18n.he' as check_name, p.id::text as row_id, p.name_i18n->>'he' as he_value;

with target as (
  select id from public.recommendations order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.recommendations r
set
  title_he = 'בדיקת המלצה',
  description_he = 'בדיקת תיאור המלצה'
from target
where r.id = target.id
returning 'recommendations.title_he/description_he' as check_name, r.id::text as row_id, r.title_he as he_value;

with target as (
  select id from public.shop_products order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_products p
set
  name_he = 'בדיקת מוצר',
  description_he = 'בדיקת תיאור מוצר',
  short_description_he = 'בדיקה קצרה'
from target
where p.id = target.id
returning 'shop_products.*_he' as check_name, p.id::text as row_id, p.name_he as he_value;

with target as (
  select id from public.shop_categories order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_categories c
set
  name_he = 'בדיקת קטגוריה',
  description_he = 'בדיקת תיאור קטגוריה'
from target
where c.id = target.id
returning 'shop_categories.*_he' as check_name, c.id::text as row_id, c.name_he as he_value;

with target as (
  select id from public.shop_vendors order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_vendors v
set
  name_he = 'בדיקת ספק',
  description_he = 'בדיקת תיאור ספק'
from target
where v.id = target.id
returning 'shop_vendors.*_he' as check_name, v.id::text as row_id, v.name_he as he_value;

with target as (
  select id from public.shop_discounts order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_discounts d
set description_he = 'בדיקת קופון'
from target
where d.id = target.id
returning 'shop_discounts.description_he' as check_name, d.id::text as row_id, d.description_he as he_value;

with target as (
  select id from public.shop_shipping_methods order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_shipping_methods m
set
  name_he = 'בדיקת משלוח',
  description_he = 'בדיקת תיאור משלוח'
from target
where m.id = target.id
returning 'shop_shipping_methods.*_he' as check_name, m.id::text as row_id, m.name_he as he_value;

with target as (
  select id from public.shop_email_templates order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.shop_email_templates e
set
  subject_he = 'בדיקת נושא',
  body_html_he = '<p dir="rtl">בדיקת אימייל</p>'
from target
where e.id = target.id
returning 'shop_email_templates.*_he' as check_name, e.id::text as row_id, e.subject_he as he_value;

with target as (
  select id from public.email_template_versions order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.email_template_versions e
set content = jsonb_set(
  coalesce(e.content, '{}'::jsonb),
  '{he}',
  jsonb_build_object(
    'subject', 'בדיקת נושא',
    'heading', 'בדיקת כותרת',
    'intro', 'בדיקת טקסט',
    'cta', 'בדיקה'
  ),
  true
)
from target
where e.id = target.id
returning 'email_template_versions.content.he' as check_name, e.id::text as row_id, e.content->'he' as he_value;

with target as (
  select id from public.transport_locations order by updated_at desc nulls last, created_at desc nulls last limit 1
)
update public.transport_locations t
set name_he = 'בדיקת מיקום'
from target
where t.id = target.id
returning 'transport_locations.name_he' as check_name, t.id::text as row_id, t.name_he as he_value;

rollback;
