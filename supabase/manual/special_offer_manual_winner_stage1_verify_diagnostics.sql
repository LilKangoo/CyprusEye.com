-- Special Offers 3C.6A Manual Winner Selection verify diagnostics.
-- Completely read-only. Does not execute RPC and does not modify data.

with expected_functions(proname, identity_arguments) as (
  values
    ('special_offer_winner_score_snapshot', 'p_offer_id uuid, p_entry_id uuid'),
    ('special_offer_winner_workflow_readiness', 'p_offer_id uuid'),
    ('admin_start_special_offer_winner_workflow', 'p_offer_id uuid, p_reason text')
),
fn as (
  select
    ef.proname,
    ef.identity_arguments as expected_identity_arguments,
    p.oid,
    pg_get_function_identity_arguments(p.oid) as actual_identity_arguments,
    p.proowner::regrole::text as owner_name,
    p.prosecdef as security_definer,
    coalesce(p.proconfig::text, '') as config_text,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as normalized_source,
    p.oid is not null as function_found
  from expected_functions ef
  left join pg_proc p
    on p.proname = ef.proname
   and pg_get_function_identity_arguments(p.oid) = ef.identity_arguments
   and p.pronamespace = 'public'::regnamespace
),
state_counts as (
  select
    case when to_regclass('public.special_offer_winner_workflows') is null then 0
      else (
        select coalesce(row_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml('select count(*)::integer as row_count from public.special_offer_winner_workflows', false, true, '')
          columns row_count integer path 'row_count'
        )
      )
    end as workflow_count,
    case when to_regclass('public.special_offer_winner_shortlist') is null then 0
      else (
        select coalesce(row_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml('select count(*)::integer as row_count from public.special_offer_winner_shortlist', false, true, '')
          columns row_count integer path 'row_count'
        )
      )
    end as shortlist_count,
    case when to_regclass('public.special_offer_winner_committee_notes') is null then 0
      else (
        select coalesce(row_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml('select count(*)::integer as row_count from public.special_offer_winner_committee_notes', false, true, '')
          columns row_count integer path 'row_count'
        )
      )
    end as notes_count,
    case when to_regclass('public.special_offer_winner_contact_events') is null then 0
      else (
        select coalesce(row_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml('select count(*)::integer as row_count from public.special_offer_winner_contact_events', false, true, '')
          columns row_count integer path 'row_count'
        )
      )
    end as contact_events_count,
    case when to_regclass('public.special_offer_winner_publications') is null then 0
      else (
        select coalesce(row_count, 0)
        from xmltable(
          '/row'
          passing query_to_xml('select count(*)::integer as row_count from public.special_offer_winner_publications', false, true, '')
          columns row_count integer path 'row_count'
        )
      )
    end as publications_count
),
checks as (
  select
    'start_blocks_wrong_winner_mode' as check_name,
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%winner_selection_mode_not_manual%'
      and coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%'
    ) as pass,
    jsonb_build_object(
      'guard_function', 'special_offer_winner_workflow_readiness(p_offer_id uuid)',
      'entry_function', 'admin_start_special_offer_winner_workflow(p_offer_id uuid, p_reason text)',
      'guard_function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false),
      'entry_function_found', coalesce((select function_found from fn where proname = 'admin_start_special_offer_winner_workflow'), false),
      'required_fragment', 'winner_selection_mode_not_manual',
      'fragment_found', coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%winner_selection_mode_not_manual%',
      'admin_start_calls_readiness', coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_workflow_readiness'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_workflow_readiness'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_workflow_readiness'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness')
    ) as details
  union all
  select
    'start_blocks_pending_entries',
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_entry_reviews%'
      and coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%'
    ),
    jsonb_build_object(
      'guard_function', 'special_offer_winner_workflow_readiness(p_offer_id uuid)',
      'entry_function', 'admin_start_special_offer_winner_workflow(p_offer_id uuid, p_reason text)',
      'guard_function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false),
      'entry_function_found', coalesce((select function_found from fn where proname = 'admin_start_special_offer_winner_workflow'), false),
      'required_fragment', 'pending_entry_reviews',
      'fragment_found', coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_entry_reviews%',
      'admin_start_calls_readiness', coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_workflow_readiness'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_workflow_readiness'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_workflow_readiness'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness')
    )
  union all
  select
    'start_blocks_pending_activities',
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_activity_reviews%'
      and coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%'
    ),
    jsonb_build_object(
      'guard_function', 'special_offer_winner_workflow_readiness(p_offer_id uuid)',
      'entry_function', 'admin_start_special_offer_winner_workflow(p_offer_id uuid, p_reason text)',
      'guard_function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_workflow_readiness'), false),
      'entry_function_found', coalesce((select function_found from fn where proname = 'admin_start_special_offer_winner_workflow'), false),
      'required_fragment', 'pending_activity_reviews',
      'fragment_found', coalesce((select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness'), '') like '%pending_activity_reviews%',
      'admin_start_calls_readiness', coalesce((select normalized_source from fn where proname = 'admin_start_special_offer_winner_workflow'), '') like '%special_offer_winner_workflow_readiness%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_workflow_readiness'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_workflow_readiness'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_workflow_readiness'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_workflow_readiness')
    )
  union all
  select
    'score_snapshot_base_present',
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%base_points%'
    ),
    jsonb_build_object(
      'function', 'special_offer_winner_score_snapshot(p_offer_id uuid, p_entry_id uuid)',
      'function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false),
      'required_fragment', 'base_points',
      'fragment_found', coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%base_points%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_score_snapshot'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_score_snapshot'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_score_snapshot'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_score_snapshot')
    )
  union all
  select
    'score_snapshot_total_present',
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%total_points%'
    ),
    jsonb_build_object(
      'function', 'special_offer_winner_score_snapshot(p_offer_id uuid, p_entry_id uuid)',
      'function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false),
      'required_fragment', 'total_points',
      'fragment_found', coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%total_points%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_score_snapshot'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_score_snapshot'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_score_snapshot'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_score_snapshot')
    )
  union all
  select
    'score_snapshot_no_pii',
    (
      coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false)
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') <> ''
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%evidence_url%'
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%email%'
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%phone%'
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%answers_json%'
      and coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') not like '%form_snapshot_json%'
    ),
    jsonb_build_object(
      'function', 'special_offer_winner_score_snapshot(p_offer_id uuid, p_entry_id uuid)',
      'function_found', coalesce((select function_found from fn where proname = 'special_offer_winner_score_snapshot'), false),
      'forbidden_fragments', jsonb_build_array('evidence_url', 'email', 'phone', 'answers_json', 'form_snapshot_json'),
      'forbidden_fragment_found',
        coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%evidence_url%'
        or coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%email%'
        or coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%phone%'
        or coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%answers_json%'
        or coalesce((select normalized_source from fn where proname = 'special_offer_winner_score_snapshot'), '') like '%form_snapshot_json%',
      'owner', (select owner_name from fn where proname = 'special_offer_winner_score_snapshot'),
      'security_definer', (select security_definer from fn where proname = 'special_offer_winner_score_snapshot'),
      'proconfig', (select config_text from fn where proname = 'special_offer_winner_score_snapshot'),
      'normalized_prosrc', (select normalized_source from fn where proname = 'special_offer_winner_score_snapshot')
    )
  union all
  select
    'winner_workflow_data_empty',
    (
      workflow_count = 0
      and shortlist_count = 0
      and notes_count = 0
      and contact_events_count = 0
      and publications_count = 0
    ),
    jsonb_build_object(
      'workflow_count', workflow_count,
      'shortlist_count', shortlist_count,
      'notes_count', notes_count,
      'contact_events_count', contact_events_count,
      'publications_count', publications_count
    )
  from state_counts
)
select
  check_name,
  coalesce(pass, false) as pass,
  details
from checks
order by check_name;
