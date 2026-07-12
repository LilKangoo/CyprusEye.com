-- Special Offers 3C.7C - entry partner attribution preflight.
-- Read-only diagnostics. Do not run from Codex.

with required_objects as (
  select
    to_regclass('public.profiles') is not null as profiles_exists,
    to_regclass('public.partners') is not null as partners_exists,
    to_regclass('public.partner_users') is not null as partner_users_exists,
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_entries') is not null as entries_exists,
    to_regclass('public.special_offer_entry_answers') is not null as answers_exists,
    to_regclass('public.special_offer_audit_log') is not null as audit_log_exists,
    to_regprocedure('public.resolve_referral_code(text)') is not null as resolve_referral_code_exists,
    to_regprocedure('public.normalize_referral_code(text)') is not null as normalize_referral_code_exists,
    to_regprocedure('public.generate_profile_referral_code(uuid,text)') is not null as generate_profile_referral_code_exists,
    to_regprocedure('public.affiliate_get_user_partner_id(uuid)') is not null as affiliate_partner_helper_exists,
    to_regprocedure('public.apply_referral_code_to_profile_if_missing(uuid,text)') is not null as apply_referral_helper_exists,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_exists,
    to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as submit_rpc_exists,
    to_regprocedure('public.update_special_offer_entry_once(uuid,jsonb,uuid)') is not null as correction_rpc_exists,
    to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is not null as entry_delete_rpc_exists
),
profile_columns as (
  select
    count(*) filter (where table_name = 'profiles' and column_name = 'id') > 0 as profiles_id_exists,
    count(*) filter (where table_name = 'profiles' and column_name = 'referral_code') > 0 as profiles_referral_code_exists,
    count(*) filter (where table_name = 'profiles' and column_name = 'referral_code_normalized') > 0 as profiles_referral_code_normalized_exists,
    count(*) filter (where table_name = 'profiles' and column_name = 'referred_by') > 0 as profiles_referred_by_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
),
partner_columns as (
  select
    count(*) filter (where table_name = 'partners' and column_name = 'id') > 0 as partners_id_exists,
    count(*) filter (where table_name = 'partners' and column_name = 'status') > 0 as partners_status_exists,
    count(*) filter (where table_name = 'partner_users' and column_name = 'partner_id') > 0 as partner_users_partner_id_exists,
    count(*) filter (where table_name = 'partner_users' and column_name = 'user_id') > 0 as partner_users_user_id_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('partners', 'partner_users')
),
entry_columns as (
  select
    count(*) filter (where column_name = 'id') > 0 as entries_id_exists,
    count(*) filter (where column_name = 'offer_id') > 0 as entries_offer_id_exists,
    count(*) filter (where column_name = 'user_id') > 0 as entries_user_id_exists,
    count(*) filter (where column_name = 'client_submission_id') > 0 as entries_client_submission_id_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'special_offer_entries'
),
existing_attribution as (
  select
    to_regclass('public.special_offer_entry_referrals') is not null as attribution_table_exists,
    case
      when to_regclass('public.special_offer_entry_referrals') is null then 0
      else (
        (xpath('/row/c/text()', query_to_xml(
          'select count(*)::text as c from public.special_offer_entry_referrals',
          false,
          true,
          ''
        )))[1]::text
      )::integer
    end as existing_attribution_rows,
    case
      when to_regclass('public.special_offer_entry_referrals') is null then 0
      else (
        (xpath('/row/c/text()', query_to_xml(
          'select count(*)::text as c from (select entry_id from public.special_offer_entry_referrals group by entry_id having count(*) > 1) d',
          false,
          true,
          ''
        )))[1]::text
      )::integer
    end as duplicate_entry_attributions
),
entry_counts as (
  select
    count(*)::integer as total_entries,
    count(*) filter (where user_id is null)::integer as entries_without_user_id,
    count(*) filter (where user_id is not null)::integer as entries_with_user_id
  from public.special_offer_entries
),
constraints as (
  select
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.special_offer_entries'::regclass
        and conname = 'special_offer_entries_id_offer_key'
    ) as entries_id_offer_unique_exists,
    exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      join pg_index i on i.indexrelid = idx.oid
      join pg_class tbl on tbl.oid = i.indrelid
      where ns.nspname = 'public'
        and tbl.relname = 'special_offer_entries'
        and idx.relname = 'idx_special_offer_entries_offer_user_unique'
        and i.indisunique
    ) as single_entry_offer_user_unique_exists
),
submit_fn as (
  select
    pg_get_function_identity_arguments(p.oid) as identity_args,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_special_offer_entry'
)
select
  ro.profiles_exists,
  ro.partners_exists,
  ro.partner_users_exists,
  ro.special_offers_exists,
  ro.entries_exists,
  ro.answers_exists,
  ro.audit_log_exists,
  ro.resolve_referral_code_exists,
  ro.normalize_referral_code_exists,
  ro.generate_profile_referral_code_exists,
  ro.affiliate_partner_helper_exists,
  ro.apply_referral_helper_exists,
  ro.admin_helper_exists,
  ro.submit_rpc_exists,
  ro.correction_rpc_exists,
  ro.entry_delete_rpc_exists,
  pc.profiles_id_exists,
  pc.profiles_referral_code_exists,
  pc.profiles_referral_code_normalized_exists,
  pc.profiles_referred_by_exists,
  pac.partners_id_exists,
  pac.partners_status_exists,
  pac.partner_users_partner_id_exists,
  pac.partner_users_user_id_exists,
  ec.entries_id_exists,
  ec.entries_offer_id_exists,
  ec.entries_user_id_exists,
  ec.entries_client_submission_id_exists,
  con.entries_id_offer_unique_exists,
  con.single_entry_offer_user_unique_exists,
  ea.attribution_table_exists,
  ea.existing_attribution_rows,
  ea.duplicate_entry_attributions,
  cnt.total_entries,
  cnt.entries_without_user_id,
  cnt.entries_with_user_id,
  exists (
    select 1 from submit_fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
  ) as current_four_arg_submit_exists,
  exists (
    select 1 from submit_fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid, p_referral_code text, p_referral_source text'
  ) as six_arg_submit_already_exists,
  (
    ro.profiles_exists
    and ro.partners_exists
    and ro.partner_users_exists
    and ro.special_offers_exists
    and ro.entries_exists
    and ro.answers_exists
    and ro.audit_log_exists
    and ro.resolve_referral_code_exists
    and ro.normalize_referral_code_exists
    and ro.generate_profile_referral_code_exists
    and ro.affiliate_partner_helper_exists
    and ro.admin_helper_exists
    and ro.submit_rpc_exists
    and ro.correction_rpc_exists
    and ro.entry_delete_rpc_exists
    and pc.profiles_id_exists
    and pc.profiles_referral_code_exists
    and pc.profiles_referral_code_normalized_exists
    and pc.profiles_referred_by_exists
    and pac.partners_id_exists
    and pac.partners_status_exists
    and pac.partner_users_partner_id_exists
    and pac.partner_users_user_id_exists
    and ec.entries_id_exists
    and ec.entries_offer_id_exists
    and ec.entries_user_id_exists
    and ec.entries_client_submission_id_exists
    and con.entries_id_offer_unique_exists
    and con.single_entry_offer_user_unique_exists
    and ea.duplicate_entry_attributions = 0
    and exists (
      select 1 from submit_fn where identity_args = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
    )
  ) as preflight_safe_to_continue
from required_objects ro
cross join profile_columns pc
cross join partner_columns pac
cross join entry_columns ec
cross join existing_attribution ea
cross join entry_counts cnt
cross join constraints con;
