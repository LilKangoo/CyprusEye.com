-- Special Offers 3C.6A Manual Winner Selection preflight.
-- Read-only. Prepared for manual execution only. Do not run from Codex.

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_entries') is not null as entries_exists,
    to_regclass('public.special_offer_entry_activities') is not null as activities_exists,
    to_regclass('public.special_offer_audit_log') is not null as audit_log_exists,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_exists,
    to_regprocedure('public.special_offer_entry_score_summary(uuid,uuid)') is not null as score_rpc_exists,
    to_regprocedure('public.update_special_offer_entry_once(uuid,jsonb,uuid)') is not null as correction_rpc_exists,
    to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is not null as entry_delete_rpc_exists
),
existing_objects as (
  select
    to_regclass('public.special_offer_winner_workflows') is not null as winner_workflows_exists,
    exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'public'
        and c.relname = 'special_offer_winner_workflows'
        and a.attname = 'status'
        and a.attnum > 0
        and not a.attisdropped
    ) as winner_workflows_status_column_exists,
    to_regclass('public.special_offer_winner_shortlist') is not null as winner_shortlist_exists,
    to_regclass('public.special_offer_winner_committee_notes') is not null as winner_notes_exists,
    to_regclass('public.special_offer_winner_contact_events') is not null as winner_contact_events_exists,
    to_regclass('public.special_offer_winner_publications') is not null as winner_publications_exists,
    to_regclass('public.special_offer_draws') is not null as legacy_draws_exists,
    to_regclass('public.special_offer_draw_entries') is not null as legacy_draw_entries_exists
),
offer_counts as (
  select
    case when not ro.special_offers_exists then 0 else (
      select coalesce(total_offers, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*)::integer as total_offers from public.special_offers',
          false,
          true,
          ''
        )
        columns total_offers integer path 'total_offers'
      )
    ) end as total_offers,
    case when not ro.special_offers_exists then 0 else (
      select coalesce(manual_selection_offers, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where winner_selection_mode = ''manual_selection'')::integer as manual_selection_offers from public.special_offers',
          false,
          true,
          ''
        )
        columns manual_selection_offers integer path 'manual_selection_offers'
      )
    ) end as manual_selection_offers,
    case when not ro.special_offers_exists then 0 else (
      select coalesce(active_offers, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where status = ''active'')::integer as active_offers from public.special_offers',
          false,
          true,
          ''
        )
        columns active_offers integer path 'active_offers'
      )
    ) end as active_offers,
    case when not ro.special_offers_exists then 0 else (
      select coalesce(ended_offers, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where status = ''ended'')::integer as ended_offers from public.special_offers',
          false,
          true,
          ''
        )
        columns ended_offers integer path 'ended_offers'
      )
    ) end as ended_offers
  from required_objects ro
),
entry_counts as (
  select
    case when not ro.entries_exists then 0 else (
      select coalesce(total_entries, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*)::integer as total_entries from public.special_offer_entries',
          false,
          true,
          ''
        )
        columns total_entries integer path 'total_entries'
      )
    ) end as total_entries,
    case when not ro.entries_exists then 0 else (
      select coalesce(approved_entries, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where status = ''approved'')::integer as approved_entries from public.special_offer_entries',
          false,
          true,
          ''
        )
        columns approved_entries integer path 'approved_entries'
      )
    ) end as approved_entries,
    case when not ro.entries_exists then 0 else (
      select coalesce(pending_review_entries, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where status in (''submitted'', ''pending_review''))::integer as pending_review_entries from public.special_offer_entries',
          false,
          true,
          ''
        )
        columns pending_review_entries integer path 'pending_review_entries'
      )
    ) end as pending_review_entries,
    case when not ro.entries_exists then 0 else (
      select coalesce(blocked_entries, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*) filter (where status in (''rejected'', ''disqualified'', ''withdrawn''))::integer as blocked_entries from public.special_offer_entries',
          false,
          true,
          ''
        )
        columns blocked_entries integer path 'blocked_entries'
      )
    ) end as blocked_entries
  from required_objects ro
),
activity_counts as (
  select
    case when not ro.activities_exists then 0 else (
      select coalesce(pending_activities, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*)::integer as pending_activities from public.special_offer_entry_activities where status = ''pending''',
          false,
          true,
          ''
        )
        columns pending_activities integer path 'pending_activities'
      )
    ) end as pending_activities,
    case when not ro.activities_exists then 0 else (
      select coalesce(approved_activities, 0)
      from xmltable(
        '/row'
        passing query_to_xml(
          'select count(*)::integer as approved_activities from public.special_offer_entry_activities where status = ''approved''',
          false,
          true,
          ''
        )
        columns approved_activities integer path 'approved_activities'
      )
    ) end as approved_activities
  from required_objects ro
),
existing_active_workflows as (
  select
    case when not eo.winner_workflows_exists then 0
      when not eo.winner_workflows_status_column_exists then null
      else (
        select coalesce(active_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml(
            'select count(*)::integer as active_count from public.special_offer_winner_workflows where status <> ''cancelled''',
            false,
            true,
            ''
          )
          columns active_count integer path 'active_count'
        )
      )
    end as active_or_published_workflow_count
  from existing_objects eo
)
select
  ro.special_offers_exists,
  ro.entries_exists,
  ro.activities_exists,
  ro.audit_log_exists,
  ro.admin_helper_exists,
  ro.score_rpc_exists,
  ro.correction_rpc_exists,
  ro.entry_delete_rpc_exists,
  eo.winner_workflows_exists,
  eo.winner_workflows_status_column_exists,
  eo.winner_shortlist_exists,
  eo.winner_notes_exists,
  eo.winner_contact_events_exists,
  eo.winner_publications_exists,
  eo.legacy_draws_exists,
  eo.legacy_draw_entries_exists,
  oc.total_offers,
  oc.manual_selection_offers,
  oc.active_offers,
  oc.ended_offers,
  ec.total_entries,
  ec.approved_entries,
  ec.pending_review_entries,
  ec.blocked_entries,
  ac.pending_activities,
  ac.approved_activities,
  eaw.active_or_published_workflow_count,
  (
    ro.special_offers_exists
    and ro.entries_exists
    and ro.activities_exists
    and ro.audit_log_exists
    and ro.admin_helper_exists
    and ro.score_rpc_exists
    and ro.correction_rpc_exists
    and ro.entry_delete_rpc_exists
  ) as manual_winner_structure_ready,
  (
    ro.special_offers_exists
    and ro.entries_exists
    and ro.activities_exists
    and ro.audit_log_exists
    and ro.admin_helper_exists
    and ro.score_rpc_exists
    and ro.correction_rpc_exists
    and ro.entry_delete_rpc_exists
    and eaw.active_or_published_workflow_count = 0
  ) as preflight_safe_to_continue
from required_objects ro
cross join existing_objects eo
cross join offer_counts oc
cross join entry_counts ec
cross join activity_counts ac
cross join existing_active_workflows eaw;
