-- =====================================================
-- Special Offers 3C.7A - Partner active listing preflight
-- =====================================================
-- Read-only diagnostics. Do not run stage SQL unless
-- preflight_safe_to_continue is true.
-- =====================================================

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_translations') is not null as translations_exists,
    to_regclass('public.partners') is not null as partners_exists,
    to_regclass('public.partner_users') is not null as partner_users_exists,
    to_regprocedure('public.is_partner_user(uuid)') is not null as partner_helper_exists
),
offer_columns as (
  select
    count(*) filter (where column_name = 'slug') > 0 as slug_exists,
    count(*) filter (where column_name = 'status') > 0 as status_exists,
    count(*) filter (where column_name = 'visibility') > 0 as visibility_exists,
    count(*) filter (where column_name = 'start_at') > 0 as start_at_exists,
    count(*) filter (where column_name = 'end_at') > 0 as end_at_exists,
    count(*) filter (where column_name = 'archived_at') > 0 as archived_at_exists,
    count(*) filter (where column_name = 'cover_image_url') > 0 as cover_image_url_exists,
    count(*) filter (where column_name = 'hero_image_url') > 0 as hero_image_url_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offers'
),
translation_columns as (
  select
    count(*) filter (where column_name = 'offer_id') > 0 as translation_offer_id_exists,
    count(*) filter (where column_name = 'lang') > 0 as translation_lang_exists,
    count(*) filter (where column_name = 'title') > 0 as translation_title_exists,
    count(*) filter (where column_name = 'short_description') > 0 as translation_short_description_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offer_translations'
),
partner_columns as (
  select
    count(*) filter (where table_name = 'partners' and column_name = 'id') > 0 as partner_id_exists,
    count(*) filter (where table_name = 'partners' and column_name = 'status') > 0 as partner_status_exists,
    count(*) filter (where table_name = 'partner_users' and column_name = 'partner_id') > 0 as partner_users_partner_id_exists,
    count(*) filter (where table_name = 'partner_users' and column_name = 'user_id') > 0 as partner_users_user_id_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('partners', 'partner_users')
),
partner_status_constraint as (
  select
    exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'partners'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%active%'
        and pg_get_constraintdef(c.oid) like '%suspended%'
    ) as partner_status_active_model_exists
),
offer_status_constraint as (
  select
    exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'special_offers'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%active%'
        and pg_get_constraintdef(c.oid) like '%ended%'
        and pg_get_constraintdef(c.oid) like '%locked%'
        and pg_get_constraintdef(c.oid) like '%archived%'
    ) as offer_status_model_exists
),
offer_visibility_constraint as (
  select
    exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'special_offers'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%public%'
        and pg_get_constraintdef(c.oid) like '%private%'
        and pg_get_constraintdef(c.oid) like '%unlisted%'
    ) as offer_visibility_model_exists
),
translation_lang_constraint as (
  select
    exists (
      select 1
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public'
        and rel.relname = 'special_offer_translations'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%pl%'
        and pg_get_constraintdef(c.oid) like '%en%'
        and pg_get_constraintdef(c.oid) like '%he%'
    ) as translation_lang_model_exists
),
function_state as (
  select
    to_regprocedure('public.get_partner_active_special_offers(text)') is not null as listing_rpc_exists,
    case
      when to_regprocedure('public.get_partner_active_special_offers(text)') is null then false
      else true
    end as listing_rpc_replace_target
)
select
  ro.special_offers_exists,
  ro.translations_exists,
  ro.partners_exists,
  ro.partner_users_exists,
  ro.partner_helper_exists,
  oc.slug_exists,
  oc.status_exists,
  oc.visibility_exists,
  oc.start_at_exists,
  oc.end_at_exists,
  oc.archived_at_exists,
  oc.cover_image_url_exists,
  oc.hero_image_url_exists,
  tc.translation_offer_id_exists,
  tc.translation_lang_exists,
  tc.translation_title_exists,
  tc.translation_short_description_exists,
  pc.partner_id_exists,
  pc.partner_status_exists,
  pc.partner_users_partner_id_exists,
  pc.partner_users_user_id_exists,
  psc.partner_status_active_model_exists,
  osc.offer_status_model_exists,
  ovc.offer_visibility_model_exists,
  tlc.translation_lang_model_exists,
  fs.listing_rpc_exists,
  fs.listing_rpc_replace_target,
  (
    ro.special_offers_exists
    and ro.translations_exists
    and ro.partners_exists
    and ro.partner_users_exists
    and ro.partner_helper_exists
    and oc.slug_exists
    and oc.status_exists
    and oc.visibility_exists
    and oc.start_at_exists
    and oc.end_at_exists
    and oc.archived_at_exists
    and (oc.cover_image_url_exists or oc.hero_image_url_exists)
    and tc.translation_offer_id_exists
    and tc.translation_lang_exists
    and tc.translation_title_exists
    and pc.partner_id_exists
    and pc.partner_status_exists
    and pc.partner_users_partner_id_exists
    and pc.partner_users_user_id_exists
    and psc.partner_status_active_model_exists
    and osc.offer_status_model_exists
    and ovc.offer_visibility_model_exists
    and tlc.translation_lang_model_exists
  ) as preflight_safe_to_continue
from required_objects ro
cross join offer_columns oc
cross join translation_columns tc
cross join partner_columns pc
cross join partner_status_constraint psc
cross join offer_status_constraint osc
cross join offer_visibility_constraint ovc
cross join translation_lang_constraint tlc
cross join function_state fs;
