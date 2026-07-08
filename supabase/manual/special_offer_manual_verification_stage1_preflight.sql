-- Special Offers 3C.5C-2 preflight.
-- Read-only diagnostics before creating official posts, activity claims and dynamic scores.
-- Prepared for manual execution only. No DDL, DML, grants or RPC calls.

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_entries') is not null as entries_exists,
    to_regclass('public.special_offer_entry_answers') is not null as entry_answers_exists,
    to_regclass('public.special_offer_audit_log') is not null as audit_log_exists,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_exists,
    to_regprocedure('public.special_offers_set_updated_at()') is not null as updated_at_helper_exists,
    to_regprocedure('public.submit_special_offer_entry(text, text, jsonb, uuid)') is not null as submit_rpc_exists,
    to_regprocedure('public.review_special_offer_entry(uuid, text, text, text)') is not null as entry_review_rpc_exists
),
entry_columns as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
        and udt_name = 'uuid'
    ) as entry_user_id_uuid,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'offer_id'
        and udt_name = 'uuid'
    ) as entry_offer_id_uuid,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'status'
    ) as entry_status_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'client_submission_id'
        and udt_name = 'uuid'
    ) as entry_client_submission_uuid
),
campaign_flags as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offers'
        and column_name = 'allow_bonus_points'
    ) as allow_bonus_points_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offers'
        and column_name = 'winner_selection_mode'
    ) as winner_selection_mode_exists
),
current_counts as (
  select
    coalesce((select count(*) from public.special_offer_entries), 0)::integer as entry_count,
    coalesce((select count(*) from public.special_offer_entry_answers), 0)::integer as answer_count,
    coalesce((select count(*) from public.special_offer_audit_log), 0)::integer as audit_count
),
existing_stage_objects as (
  select
    to_regclass('public.special_offer_official_posts') is not null as official_posts_already_exists,
    to_regclass('public.special_offer_entry_activities') is not null as activities_already_exists,
    to_regprocedure('public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamp with time zone, timestamp with time zone, boolean)') is not null as admin_upsert_post_rpc_exists,
    to_regprocedure('public.admin_deactivate_special_offer_official_post(uuid)') is not null as admin_deactivate_post_rpc_exists,
    to_regprocedure('public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamp with time zone)') is not null as submit_activity_claim_rpc_exists,
    to_regprocedure('public.review_special_offer_activity(uuid, text, timestamp with time zone, text, text)') is not null as review_activity_rpc_exists,
    to_regprocedure('public.special_offer_entry_score_summary(uuid, uuid)') is not null as score_function_exists
),
forbidden_objects as (
  select
    not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'special_offer_tasks',
          'special_offer_draws',
          'special_offer_draw_entries',
          'special_offer_winners'
        )
    ) as no_tasks_draws_winners
)
select
  r.special_offers_exists,
  r.entries_exists,
  r.entry_answers_exists,
  r.audit_log_exists,
  r.admin_helper_exists,
  r.updated_at_helper_exists,
  r.submit_rpc_exists,
  r.entry_review_rpc_exists,
  e.entry_user_id_uuid,
  e.entry_offer_id_uuid,
  e.entry_status_exists,
  e.entry_client_submission_uuid,
  f.allow_bonus_points_exists,
  f.winner_selection_mode_exists,
  c.entry_count,
  c.answer_count,
  c.audit_count,
  s.official_posts_already_exists,
  s.activities_already_exists,
  s.admin_upsert_post_rpc_exists,
  s.admin_deactivate_post_rpc_exists,
  s.submit_activity_claim_rpc_exists,
  s.review_activity_rpc_exists,
  s.score_function_exists,
  x.no_tasks_draws_winners,
  (
    r.special_offers_exists
    and r.entries_exists
    and r.entry_answers_exists
    and r.audit_log_exists
    and r.admin_helper_exists
    and r.updated_at_helper_exists
    and r.submit_rpc_exists
    and r.entry_review_rpc_exists
    and e.entry_user_id_uuid
    and e.entry_offer_id_uuid
    and e.entry_status_exists
    and e.entry_client_submission_uuid
    and f.allow_bonus_points_exists
    and f.winner_selection_mode_exists
    and x.no_tasks_draws_winners
  ) as preflight_safe_to_continue
from required_objects r
cross join entry_columns e
cross join campaign_flags f
cross join current_counts c
cross join existing_stage_objects s
cross join forbidden_objects x;
