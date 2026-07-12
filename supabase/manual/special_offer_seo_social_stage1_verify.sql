-- Special Offers 3C.8B
-- SEO & Social metadata data model + public-safe SEO RPC verify.
--
-- Read-only. Run after special_offer_seo_social_stage1.sql.

with columns_check as (
  select
    count(*) filter (
      where table_name = 'special_offers'
        and column_name = 'meta_image_url'
        and data_type = 'text'
        and is_nullable = 'YES'
    ) = 1 as meta_image_url_column_ok,
    count(*) filter (
      where table_name = 'special_offer_translations'
        and column_name = 'meta_image_alt'
        and data_type = 'text'
        and is_nullable = 'YES'
    ) = 1 as meta_image_alt_column_ok,
    count(*) filter (
      where table_name = 'special_offer_translations'
        and column_name = 'seo_title'
        and data_type = 'text'
    ) = 1 as existing_seo_title_reused,
    count(*) filter (
      where table_name = 'special_offer_translations'
        and column_name = 'seo_description'
        and data_type = 'text'
    ) = 1 as existing_seo_description_reused
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('special_offers', 'special_offer_translations')
),
constraint_check as (
  select
    coalesce(bool_or(con.conname = 'special_offers_meta_image_url_safe_check'), false) as meta_image_url_safe_check_exists,
    coalesce(bool_or(pg_get_constraintdef(con.oid) like '%meta_image_url%https?://%'), false) as meta_image_url_safe_check_validates_url
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = cls.relnamespace
  where nsp.nspname = 'public'
    and cls.relname = 'special_offers'
),
target as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef,
    r.rolname as owner_name,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.oid = to_regprocedure('public.get_public_special_offer_seo(text,text)')
),
rpc_check as (
  select
    coalesce((select count(*) from target), 0) = 1 as rpc_exists,
    coalesce((select identity_arguments = 'p_slug text, p_lang text' from target), false) as rpc_signature_ok,
    coalesce((select result_type = 'jsonb' from target), false) as rpc_return_type_ok,
    coalesce((select prosecdef from target), false) as rpc_security_definer,
    coalesce((select owner_name = 'postgres' from target), false) as rpc_owner_ok,
    coalesce((select 'search_path=pg_catalog, public' = any(proconfig) from target), false) as rpc_safe_search_path
),
acl_rows as (
  select
    acl.grantee,
    acl.privilege_type
  from target t
  cross join lateral aclexplode(coalesce(
    (select p.proacl from pg_proc p where p.oid = t.oid),
    acldefault('f', (select p.proowner from pg_proc p where p.oid = t.oid))
  )) acl
),
role_oids as (
  select
    max(oid) filter (where rolname = 'anon') as anon_oid,
    max(oid) filter (where rolname = 'authenticated') as authenticated_oid,
    max(oid) filter (where rolname = 'service_role') as service_role_oid
  from pg_roles
),
acl_check as (
  select
    not exists (
      select 1 from acl_rows where grantee = 0 and privilege_type = 'EXECUTE'
    ) as public_execute_absent,
    exists (
      select 1
      from acl_rows ar
      cross join role_oids ro
      where ar.grantee = ro.anon_oid
        and ar.privilege_type = 'EXECUTE'
    ) as anon_execute_present,
    exists (
      select 1
      from acl_rows ar
      cross join role_oids ro
      where ar.grantee = ro.authenticated_oid
        and ar.privilege_type = 'EXECUTE'
    ) as authenticated_execute_present,
    not exists (
      select 1
      from acl_rows ar
      cross join role_oids ro
      where ar.grantee = ro.service_role_oid
        and ar.privilege_type = 'EXECUTE'
    ) as service_role_execute_absent
),
source_check as (
  select
    coalesce((select source like '%v_requested_lang not in (%''pl''%,%''en''%,%''he''%)%' from target), false) as language_validation_present,
    coalesce((select source like '%t.lang = v_requested_lang%' from target), false) as requested_language_first,
    coalesce((select source like '%when t.lang = ''en'' then 1%' from target), false) as en_fallback_present,
    coalesce((select source like '%when t.lang = ''pl'' then 2%' from target), false) as pl_fallback_present,
    coalesce((select source like '%when t.lang = ''he'' then 3%' from target), false) as he_fallback_present,
    coalesce((select source like '%coalesce(v_translation.lang, v_requested_lang)%' from target), false) as resolved_lang_returned,
    coalesce((select source like '%coalesce(v_translation.seo_title, v_translation.title, v_offer.slug)%' from target), false) as title_fallback_present,
    coalesce((select source like '%v_translation.seo_description%' and source like '%v_translation.short_description%' and source like '%v_translation.full_description%' from target), false) as description_fallback_present,
    coalesce((select source like '%regexp_replace%' and source like '%<[^>]*>%' from target), false) as description_html_strip_present,
    coalesce((select source like '%left(%' and source like '%300%' from target), false) as description_length_limit_present,
    coalesce((select source like '%v_offer.meta_image_url%' and source like '%v_offer.cover_image_url%' and source like '%v_offer.hero_image_url%' from target), false) as image_fallback_present,
    coalesce((select source like '%v_translation.meta_image_alt%' and source like '%v_translation.title%' and source like '%v_offer.slug%' from target), false) as alt_fallback_present,
    coalesce((select source like '%o.visibility = ''public''%' from target), false) as public_visibility_guard_present,
    coalesce((select source like '%o.archived_at is null%' from target), false) as archived_guard_present,
    coalesce((select source like '%o.start_at is not null%' and source like '%now() >= o.start_at%' from target), false) as start_at_guard_present,
    coalesce((select source like '%o.status in (%''active''%,%''ended''%,%''locked''%)%' from target), false) as active_ended_locked_guard_present,
    coalesce((select source not like '%now() <= o.end_at%' from target), false) as active_not_limited_by_end_at,
    coalesce((select source not like '%get_public_special_offer_landing%' from target), false) as landing_rpc_not_called_or_changed
),
privacy_check as (
  select
    coalesce((select source not like '%special_offer_entries%' from target), false) as no_entries_read,
    coalesce((select source not like '%special_offer_entry_answers%' from target), false) as no_answers_read,
    coalesce((select source not like '%special_offer_entry_activities%' from target), false) as no_activities_read,
    coalesce((select source not like '%special_offer_audit_log%' from target), false) as no_audit_read,
    coalesce((select source not like '%special_offer_entry_referrals%' and source not like '%referral%' from target), false) as no_referral_read,
    coalesce((select source not like '%special_offer_winner_%' from target), false) as no_winner_read,
    coalesce((select source not like '%auth.users%' and source not like '%email%' and source not like '%phone%' and source not like '%date_of_birth%' and source not like '%dob%' and source not like '%reference%' from target), false) as no_pii_fields,
    coalesce((select source not like '%insert into%' and source not like '%update public.%' and source not like '%delete from%' and source not like '%merge into%' and source not like '%truncate %' from target), false) as no_dml
),
grant_check as (
  select
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in (
          'special_offers',
          'special_offer_translations',
          'special_offer_entries',
          'special_offer_entry_answers',
          'special_offer_entry_activities',
          'special_offer_entry_referrals',
          'special_offer_audit_log',
          'special_offer_winner_workflows',
          'special_offer_winner_shortlist',
          'special_offer_winner_committee_notes',
          'special_offer_winner_contact_events',
          'special_offer_winner_publications'
        )
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as no_public_or_anon_raw_table_grants
)
select
  cc.meta_image_url_column_ok,
  cc.meta_image_alt_column_ok,
  cc.existing_seo_title_reused,
  cc.existing_seo_description_reused,
  con.meta_image_url_safe_check_exists,
  con.meta_image_url_safe_check_validates_url,
  rc.rpc_exists,
  rc.rpc_signature_ok,
  rc.rpc_return_type_ok,
  rc.rpc_security_definer,
  rc.rpc_owner_ok,
  rc.rpc_safe_search_path,
  ac.public_execute_absent,
  ac.anon_execute_present,
  ac.authenticated_execute_present,
  ac.service_role_execute_absent,
  sc.language_validation_present,
  sc.requested_language_first,
  sc.en_fallback_present,
  sc.pl_fallback_present,
  sc.he_fallback_present,
  sc.resolved_lang_returned,
  sc.title_fallback_present,
  sc.description_fallback_present,
  sc.description_html_strip_present,
  sc.description_length_limit_present,
  sc.image_fallback_present,
  sc.alt_fallback_present,
  sc.public_visibility_guard_present,
  sc.archived_guard_present,
  sc.start_at_guard_present,
  sc.active_ended_locked_guard_present,
  sc.active_not_limited_by_end_at,
  sc.landing_rpc_not_called_or_changed,
  pc.no_entries_read,
  pc.no_answers_read,
  pc.no_activities_read,
  pc.no_audit_read,
  pc.no_referral_read,
  pc.no_winner_read,
  pc.no_pii_fields,
  pc.no_dml,
  gc.no_public_or_anon_raw_table_grants,
  (
    cc.meta_image_url_column_ok
    and cc.meta_image_alt_column_ok
    and cc.existing_seo_title_reused
    and cc.existing_seo_description_reused
    and con.meta_image_url_safe_check_exists
    and con.meta_image_url_safe_check_validates_url
    and rc.rpc_exists
    and rc.rpc_signature_ok
    and rc.rpc_return_type_ok
    and rc.rpc_security_definer
    and rc.rpc_owner_ok
    and rc.rpc_safe_search_path
    and ac.public_execute_absent
    and ac.anon_execute_present
    and ac.authenticated_execute_present
    and ac.service_role_execute_absent
    and sc.language_validation_present
    and sc.requested_language_first
    and sc.en_fallback_present
    and sc.pl_fallback_present
    and sc.he_fallback_present
    and sc.resolved_lang_returned
    and sc.title_fallback_present
    and sc.description_fallback_present
    and sc.description_html_strip_present
    and sc.description_length_limit_present
    and sc.image_fallback_present
    and sc.alt_fallback_present
    and sc.public_visibility_guard_present
    and sc.archived_guard_present
    and sc.start_at_guard_present
    and sc.active_ended_locked_guard_present
    and sc.active_not_limited_by_end_at
    and sc.landing_rpc_not_called_or_changed
    and pc.no_entries_read
    and pc.no_answers_read
    and pc.no_activities_read
    and pc.no_audit_read
    and pc.no_referral_read
    and pc.no_winner_read
    and pc.no_pii_fields
    and pc.no_dml
    and gc.no_public_or_anon_raw_table_grants
  ) as overall_pass
from columns_check cc
cross join constraint_check con
cross join rpc_check rc
cross join acl_check ac
cross join source_check sc
cross join privacy_check pc
cross join grant_check gc;
