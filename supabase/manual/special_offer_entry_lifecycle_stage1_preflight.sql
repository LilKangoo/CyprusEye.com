-- Special Offers 3C.5C-6J preflight - read only.
-- Checks entry lifecycle prerequisites without exposing PII.

with tables_state as (
  select
    to_regclass('public.special_offer_entries') is not null as entries_table_exists,
    to_regclass('public.special_offer_entry_answers') is not null as answers_table_exists,
    to_regclass('public.special_offer_entry_activities') is not null as activities_table_exists,
    to_regclass('public.special_offer_audit_log') is not null as audit_log_table_exists
),
entry_counts as (
  select
    count(*)::bigint as total_entries,
    count(*) filter (where user_id is null)::bigint as entries_without_user_id,
    count(*) filter (where user_id is not null)::bigint as entries_with_user_id
  from public.special_offer_entries
),
duplicates as (
  select
    count(*)::bigint as duplicate_offer_user_pairs
  from (
    select offer_id, user_id
    from public.special_offer_entries
    where user_id is not null
    group by offer_id, user_id
    having count(*) > 1
  ) d
),
columns_state as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'special_offer_entries' and column_name = 'correction_count'
    ) as correction_count_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'special_offer_entries' and column_name = 'corrected_at'
    ) as corrected_at_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'special_offer_entries' and column_name = 'correction_client_submission_id'
    ) as correction_client_submission_id_exists
),
fk_state as (
  select
    exists (
      select 1
      from pg_constraint con
      where con.conrelid = 'public.special_offer_entry_answers'::regclass
        and con.confrelid = 'public.special_offer_entries'::regclass
        and con.confdeltype = 'c'
    ) as answers_cascade_to_entry,
    exists (
      select 1
      from pg_constraint con
      where con.conrelid = 'public.special_offer_entry_activities'::regclass
        and con.confrelid = 'public.special_offer_entries'::regclass
        and con.confdeltype = 'c'
    ) as activities_cascade_to_entry
),
rpc_state as (
  select
    to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as submit_rpc_exists,
    to_regprocedure('public.review_special_offer_entry(uuid,text,text,text)') is not null as review_rpc_exists,
    to_regprocedure('public.update_special_offer_entry_once(uuid,jsonb,uuid)') is not null as correction_rpc_exists,
    to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is not null as delete_rpc_exists
)
select
  ts.entries_table_exists,
  ts.answers_table_exists,
  ts.activities_table_exists,
  ts.audit_log_table_exists,
  ec.total_entries,
  ec.entries_without_user_id,
  ec.entries_with_user_id,
  d.duplicate_offer_user_pairs,
  cs.correction_count_exists,
  cs.corrected_at_exists,
  cs.correction_client_submission_id_exists,
  fk.answers_cascade_to_entry,
  fk.activities_cascade_to_entry,
  rs.submit_rpc_exists,
  rs.review_rpc_exists,
  rs.correction_rpc_exists,
  rs.delete_rpc_exists,
  (
    ts.entries_table_exists
    and ts.answers_table_exists
    and ts.audit_log_table_exists
    and d.duplicate_offer_user_pairs = 0
    and fk.answers_cascade_to_entry
    and fk.activities_cascade_to_entry
    and rs.submit_rpc_exists
  ) as lifecycle_preflight_safe_to_continue
from tables_state ts
cross join entry_counts ec
cross join duplicates d
cross join columns_state cs
cross join fk_state fk
cross join rpc_state rs;
