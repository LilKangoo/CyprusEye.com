-- =====================================================
-- Special Offers 3C.8E - Partner listing image fallback preflight
-- =====================================================
-- Read-only. Safe to run before applying the image fallback patch.
-- =====================================================

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_translations') is not null as translations_exists,
    to_regclass('public.partners') is not null as partners_exists,
    to_regclass('public.partner_users') is not null as partner_users_exists,
    to_regprocedure('public.is_partner_user(uuid)') is not null as partner_helper_exists,
    to_regprocedure('public.get_partner_active_special_offers(text)') is not null as partner_listing_rpc_exists
),
columns as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offers'
        and column_name = 'cover_image_url'
        and data_type = 'text'
    ) as cover_image_url_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offers'
        and column_name = 'hero_image_url'
        and data_type = 'text'
    ) as hero_image_url_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offers'
        and column_name = 'meta_image_url'
        and data_type = 'text'
    ) as meta_image_url_exists
),
fn as (
  select
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_partner_active_special_offers'
),
target as (
  select *
  from fn
  where identity_args = 'p_lang text'
  limit 1
),
checks as (
  select
    ro.*,
    c.*,
    coalesce((select result_type like 'TABLE(%slug text%requested_lang text%resolved_lang text%title text%short_description text%cover_image_url text%start_at timestamp with time zone%end_at timestamp with time zone%)' from target), false) as compatible_return_type,
    coalesce((select source like '%coalesce(eo.cover_image_url, eo.hero_image_url, eo.meta_image_url%' from target), false) as meta_image_fallback_already_present
  from required_objects ro
  cross join columns c
)
select
  *,
  (
    special_offers_exists
    and translations_exists
    and partners_exists
    and partner_users_exists
    and partner_helper_exists
    and partner_listing_rpc_exists
    and cover_image_url_exists
    and hero_image_url_exists
    and meta_image_url_exists
    and compatible_return_type
  ) as preflight_safe_to_continue
from checks;
