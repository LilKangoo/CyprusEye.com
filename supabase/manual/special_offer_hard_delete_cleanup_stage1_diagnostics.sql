-- Special Offers 3C.5C-6K hard delete diagnostics.
-- Read-only. Prepared for manual execution only. Do not run from Codex.
-- Replace the reference below only when diagnosing a different entry.

with settings as (
  select 'SO-83C787D6C2'::text as expected_reference
),
target_entry as (
  select e.id, e.offer_id
  from public.special_offer_entries e
  join settings s on e.reference = s.expected_reference
),
function_state as (
  select
    to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is not null as entry_delete_rpc_exists,
    to_regprocedure('public.admin_delete_special_offer_official_post(uuid,text,text)') is not null as official_post_delete_rpc_exists
),
entry_rpc as (
  select
    p.oid,
    p.proowner::regrole::text as owner,
    p.prosecdef as security_definer,
    p.proconfig as config,
    pg_get_function_identity_arguments(p.oid) as identity_arguments
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_delete_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_expected_reference text, p_reason text'
),
fk_state as (
  select
    con.conname,
    con.conrelid::regclass::text as child_table,
    con.confrelid::regclass::text as parent_table,
    con.confdeltype as on_delete_code,
    case con.confdeltype
      when 'a' then 'NO ACTION'
      when 'r' then 'RESTRICT'
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      else con.confdeltype::text
    end as on_delete_action
  from pg_constraint con
  where con.contype = 'f'
    and (
      con.confrelid in (
        'public.special_offer_entries'::regclass,
        'public.special_offer_official_posts'::regclass
      )
      or con.conrelid in (
        'public.special_offer_entry_answers'::regclass,
        'public.special_offer_entry_activities'::regclass,
        'public.special_offer_audit_log'::regclass
      )
    )
),
trigger_state as (
  select
    event_object_table,
    trigger_name,
    action_timing,
    event_manipulation
  from information_schema.triggers
  where event_object_schema = 'public'
    and event_object_table in (
      'special_offer_entries',
      'special_offer_entry_answers',
      'special_offer_entry_activities',
      'special_offer_official_posts',
      'special_offer_audit_log'
    )
),
child_counts as (
  select
    (select count(*)::integer from target_entry) as matching_entry_count,
    coalesce((select count(*)::integer from public.special_offer_entry_answers a join target_entry e on e.id = a.entry_id), 0) as answer_rows,
    coalesce((select count(*)::integer from public.special_offer_entry_activities act join target_entry e on e.id = act.entry_id), 0) as activity_rows,
    case
      when to_regclass('public.special_offer_winners') is null then 0
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'special_offer_winners'
          and column_name = 'entry_id'
      ) then -1
      else -2
    end as winner_relation_diagnostic
),
source_state as (
  select
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_delete_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_entry_id uuid, p_expected_reference text, p_reason text'
)
select
  fs.entry_delete_rpc_exists,
  fs.official_post_delete_rpc_exists,
  er.identity_arguments as entry_delete_signature,
  er.owner as entry_delete_owner,
  er.security_definer as entry_delete_security_definer,
  er.config as entry_delete_config,
  (select count(*) from fk_state)::integer as related_fk_count,
  (select jsonb_agg(to_jsonb(fk_state) order by child_table, conname) from fk_state) as related_fk_diagnostics,
  (select count(*) from trigger_state)::integer as related_trigger_count,
  (select jsonb_agg(to_jsonb(trigger_state) order by event_object_table, trigger_name) from trigger_state) as related_trigger_diagnostics,
  cc.matching_entry_count,
  cc.answer_rows,
  cc.activity_rows,
  case cc.winner_relation_diagnostic
    when 0 then 'no_winner_table'
    when -1 then 'winner_table_with_entry_id_exists_count_not_run_in_diagnostics'
    when -2 then 'winner_table_exists_without_entry_id'
    else 'unknown'
  end as winner_relation_state,
  coalesce(ss.source like '%where entry_id = v_entry.id%', false) as ambiguous_unqualified_entry_id_pattern_present,
  coalesce(ss.source like '%ans.entry_id = v_entry.id%', false) as answers_alias_pattern_present,
  coalesce(ss.source like '%act.entry_id = v_entry.id%', false) as activities_alias_pattern_present,
  true as diagnostics_read_only
from function_state fs
left join entry_rpc er on true
left join child_counts cc on true
left join source_state ss on true;
