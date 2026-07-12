-- Special Offers 3C.8B
-- SEO & Social metadata data model + public-safe SEO RPC preflight.
--
-- Read-only. Safe to run before the base SQL. Does not create, alter, grant,
-- revoke, or execute any mutating RPC.

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_translations') is not null as translations_exists,
    to_regprocedure('public.get_public_special_offer_landing(text)') is not null as landing_rpc_exists
),
offer_columns as (
  select
    count(*) filter (where column_name = 'slug' and data_type = 'text') > 0 as slug_exists,
    count(*) filter (where column_name = 'status' and data_type = 'text') > 0 as status_exists,
    count(*) filter (where column_name = 'visibility' and data_type = 'text') > 0 as visibility_exists,
    count(*) filter (where column_name = 'start_at' and data_type = 'timestamp with time zone') > 0 as start_at_exists,
    count(*) filter (where column_name = 'end_at' and data_type = 'timestamp with time zone') > 0 as end_at_exists,
    count(*) filter (where column_name = 'archived_at' and data_type = 'timestamp with time zone') > 0 as archived_at_exists,
    count(*) filter (where column_name = 'hero_image_url' and data_type = 'text') > 0 as hero_image_url_exists,
    count(*) filter (where column_name = 'cover_image_url' and data_type = 'text') > 0 as cover_image_url_exists,
    count(*) filter (where column_name = 'meta_image_url') > 0 as meta_image_url_exists,
    max(data_type) filter (where column_name = 'meta_image_url') as meta_image_url_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offers'
),
translation_columns as (
  select
    count(*) filter (where column_name = 'offer_id' and data_type = 'uuid') > 0 as offer_id_exists,
    count(*) filter (where column_name = 'lang' and data_type = 'text') > 0 as lang_exists,
    count(*) filter (where column_name = 'title' and data_type = 'text') > 0 as title_exists,
    count(*) filter (where column_name = 'short_description' and data_type = 'text') > 0 as short_description_exists,
    count(*) filter (where column_name = 'full_description' and data_type = 'text') > 0 as full_description_exists,
    count(*) filter (where column_name = 'seo_title' and data_type = 'text') > 0 as seo_title_exists,
    count(*) filter (where column_name = 'seo_description' and data_type = 'text') > 0 as seo_description_exists,
    count(*) filter (where column_name = 'meta_image_alt') > 0 as meta_image_alt_exists,
    max(data_type) filter (where column_name = 'meta_image_alt') as meta_image_alt_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offer_translations'
),
seo_rpc as (
  select
    count(*) filter (
      where p.oid = to_regprocedure('public.get_public_special_offer_seo(text,text)')
    ) as exact_rpc_count,
    count(*) filter (
      where p.proname = 'get_public_special_offer_seo'
    ) as seo_rpc_overload_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select
  ro.special_offers_exists,
  ro.translations_exists,
  ro.landing_rpc_exists,
  oc.slug_exists,
  oc.status_exists,
  oc.visibility_exists,
  oc.start_at_exists,
  oc.end_at_exists,
  oc.archived_at_exists,
  oc.hero_image_url_exists,
  oc.cover_image_url_exists,
  oc.meta_image_url_exists,
  oc.meta_image_url_type,
  tc.offer_id_exists,
  tc.lang_exists,
  tc.title_exists,
  tc.short_description_exists,
  tc.full_description_exists,
  tc.seo_title_exists,
  tc.seo_description_exists,
  tc.meta_image_alt_exists,
  tc.meta_image_alt_type,
  sr.exact_rpc_count = 0 as seo_rpc_absent,
  sr.seo_rpc_overload_count as seo_rpc_overload_count,
  (
    ro.special_offers_exists
    and ro.translations_exists
    and ro.landing_rpc_exists
    and oc.slug_exists
    and oc.status_exists
    and oc.visibility_exists
    and oc.start_at_exists
    and oc.end_at_exists
    and oc.archived_at_exists
    and oc.hero_image_url_exists
    and oc.cover_image_url_exists
    and tc.offer_id_exists
    and tc.lang_exists
    and tc.title_exists
    and tc.short_description_exists
    and tc.full_description_exists
    and tc.seo_title_exists
    and tc.seo_description_exists
    and (
      oc.meta_image_url_exists is false
      or oc.meta_image_url_type = 'text'
    )
    and (
      tc.meta_image_alt_exists is false
      or tc.meta_image_alt_type = 'text'
    )
    and sr.exact_rpc_count <= 1
  ) as preflight_safe_to_continue
from required_objects ro
cross join offer_columns oc
cross join translation_columns tc
cross join seo_rpc sr;
