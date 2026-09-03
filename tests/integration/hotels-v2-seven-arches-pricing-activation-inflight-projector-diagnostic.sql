\set ON_ERROR_STOP on
\pset format unaligned
\pset fieldsep '|'

-- This is a rollback-only diagnostic for the exact clean positive Apply path.
-- It installs through 114400 once, clones the installed Apply byte-for-byte up
-- to the canonical projector call, captures compact predicate evidence at that
-- point, and stops before either delta guard or the evolution-receipt INSERT.
\set pricing_activation_migration_sha `shasum -a 256 supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql | awk '{print $1}'`
select :'pricing_activation_migration_sha'=
  'e05420b499060f002ad98d122caf71f93d57cd6b62baf5323c4361d1deb24359'
  as pricing_activation_migration_sha_exact \gset
\if :pricing_activation_migration_sha_exact
\else
  \quit 3
\endif

\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

-- Establish the exact accepted Task2 state used by the failing clean fixture.
begin;
do $accept_task2_before_inflight_diagnostic$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb; v_draft jsonb; v_preview jsonb; v_control jsonb;
  v_proposal jsonb; v_apply jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+2);
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1','partner_id',c_partner,
    'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token','intent',
    jsonb_build_object('entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — aktywacja','en','7 Arches activation',
        'he','הפעלת 7 קשתות')),
      'reason','Task2 acceptance before pricing in-flight diagnostic'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38900000-0000-4000-8000-000000000001',
    '38900000-0000-4000-8000-000000000002');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(
    jsonb_build_object(
      'contract_version',
        'hotels_v2_seven_arches_property_proposal_review_request_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal->'id',
      'proposal_version',v_proposal->'version','action','accept',
      'reason','Accept Task2 proposal before pricing in-flight diagnostic'));
  v_apply:=public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','38900000-0000-4000-8000-000000000003');
  reset role;
  if v_apply->>'status'<>'accepted'
     or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
       is not true then
    raise exception 'pricing_activation_inflight_diagnostic_task2_setup_failed:%',
      v_apply;
  end if;
end
$accept_task2_before_inflight_diagnostic$;
commit;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
set local statement_timeout='180s';

create temporary table pricing_activation_inflight_diagnostic_result(
  payload jsonb not null
) on commit drop;

create function pg_temp.hotel_v2_114400_compact_value(p_value jsonb)
returns text language sql immutable set search_path=pg_catalog
as $function$
  select case
    when p_value is null then null
    when jsonb_typeof(p_value)='string' and length(p_value#>>'{}')<=96
      then p_value#>>'{}'
    else 'sha256:'||encode(extensions.digest(
      convert_to(p_value::text,'UTF8'),'sha256'),'hex') end
$function$;

create function pg_temp.hotel_v2_114400_atom(
  p_group text,p_atom text,p_pass boolean,p_detail jsonb default null
) returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select jsonb_build_object('GROUP',p_group,'ATOM',p_atom,
    'PASS',coalesce(p_pass,false),'DETAIL',p_detail)
$function$;

create function pg_temp.hotel_v2_114400_key_classification(
  p_map text,p_before jsonb,p_after jsonb,p_allowed text[]
) returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'MAP',p_map,'KEY',key,
    'BEFORE',pg_temp.hotel_v2_114400_compact_value(p_before->key),
    'IN_FLIGHT',pg_temp.hotel_v2_114400_compact_value(p_after->key),
    'CLASSIFICATION',case
      when key=any(p_allowed) and (not coalesce(p_before?key,false)
        or not coalesce(p_after?key,false)) then 'MISSING_KEY'
      when not coalesce(p_before?key,false) then 'EXTRA_KEY'
      when not coalesce(p_after?key,false) then 'MISSING_KEY'
      when key=any(p_allowed)
        and p_before->key is distinct from p_after->key then 'EXPECTED_CHANGED'
      when key=any(p_allowed) then 'EXPECTED_BUT_UNCHANGED'
      else 'UNEXPECTED_CHANGED' end)
    order by case when key=any(p_allowed) then 0 else 1 end,
      array_position(p_allowed,key) nulls last,key),'[]'::jsonb)
  from (
    select key from (
      select unnest(p_allowed) key
      union
      select jsonb_object_keys(coalesce(p_before,'{}'::jsonb)) key
      union
      select jsonb_object_keys(coalesce(p_after,'{}'::jsonb)) key
    ) all_keys
    where key=any(p_allowed)
       or not coalesce(p_before?key,false)
       or not coalesce(p_after?key,false)
       or p_before->key is distinct from p_after->key
  ) classified
$function$;

create function pg_temp.hotel_v2_114400_map_diff_keys(
  p_before jsonb,p_after jsonb,p_allowed text[]
) returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select coalesce(jsonb_agg(key order by key),'[]'::jsonb)
  from (
    select key from (
      select jsonb_object_keys(coalesce(p_before,'{}'::jsonb)) key
      union
      select jsonb_object_keys(coalesce(p_after,'{}'::jsonb)) key
    ) keys
    where not (key=any(p_allowed))
      and p_before->key is distinct from p_after->key
  ) differing
$function$;

create function pg_temp.hotel_v2_114400_capture_inflight(
  p_before jsonb,p_after jsonb,p_review_id uuid,p_correlation_id uuid,
  p_idempotency_key text,p_result jsonb
) returns jsonb language plpgsql volatile
set search_path=pg_catalog,public,auth,pg_temp
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_task2_keys constant text[]:=array[
    'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[];
  c_stage2_keys constant text[]:=array[
    'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[];
  v_before_task2 jsonb:=p_before->'task2_protected_fingerprints';
  v_returned_task2 jsonb:=p_after->'task2_protected_fingerprints';
  v_after_task2 jsonb;
  v_before_stage2 jsonb:=p_before->'stage2_protected_fingerprints';
  v_returned_stage2 jsonb:=p_after->'stage2_protected_fingerprints';
  v_after_stage2 jsonb;
  v_raw_task2 jsonb; v_raw_stage2 jsonb;
  v_candidate_task2 jsonb; v_candidate_stage2 jsonb;
  v_lifecycle jsonb; v_lifecycle_fingerprint text;
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
  v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_admin public.hotel_admin_pricing_action_receipts%rowtype;
  v_task2_receipt
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_activity_ids uuid[];
  v_plan_before jsonb; v_schedule_before jsonb;
  v_upper_before jsonb; v_ground_before jsonb; v_expected_original jsonb;
  v_visible_context_count integer; v_current_context_count integer;
  v_review_count integer; v_admin_count integer; v_task2_receipt_count integer;
  v_activity_count integer;
  v_context_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_context_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_freeze_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()');
  v_admin_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()');
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_projector_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()');
  v_task2_validator_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()');
  v_early_counts_exact boolean; v_property_attribution_exact boolean;
  v_workspace_lineage_exact boolean; v_stage2f_evidence_exact boolean;
  v_raw_projection_exact boolean; v_provider_branch_exact boolean;
  v_provider_relation regclass:=to_regclass(
    'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts');
  v_provider_receipt_count integer;
  v_task2_relation_exact boolean; v_task2_columns_exact boolean;
  v_task2_constraints_exact boolean; v_task2_trigger_exact boolean;
  v_task2_acl_exact boolean; v_task2_source_binding_exact boolean;
  v_projector_security_exact boolean; v_task2_validator_security_exact boolean;
  v_task2_catalog_exact boolean;
  v_entry_exact boolean; v_catalog_exact boolean; v_context_exact boolean;
  v_receipt_exact boolean; v_review_identity_exact boolean;
  v_review_plan_exact boolean; v_admin_exact boolean;
  v_activity_envelope_exact boolean; v_plan_activity_exact boolean;
  v_schedule_activity_exact boolean; v_upper_activity_exact boolean;
  v_ground_activity_exact boolean; v_task2_projector_exact boolean;
  v_stage2_projector_exact boolean; v_apply_task2_exact boolean;
  v_apply_stage2_exact boolean;
begin
  select count(*),count(*) filter(where transaction_id=txid_current())
    into v_visible_context_count,v_current_context_count
  from public.hotel_seven_arches_pricing_activation_transaction_context;
  select count(*) into v_review_count
  from public.hotel_seven_arches_pricing_activation_reviews where id=p_review_id;
  select count(*) into v_admin_count
  from public.hotel_admin_pricing_action_receipts
  where correlation_id=p_correlation_id;
  select count(*) into v_task2_receipt_count
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  select count(*) into v_activity_count from public.hotel_activity_log
  where correlation_id=p_correlation_id;

  select * into v_context
  from public.hotel_seven_arches_pricing_activation_transaction_context
  where transaction_id=txid_current();
  select * into v_review
  from public.hotel_seven_arches_pricing_activation_reviews where id=p_review_id;
  select * into v_admin from public.hotel_admin_pricing_action_receipts
  where correlation_id=p_correlation_id;
  select * into v_task2_receipt
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  select array_agg(activity.id order by activity.entity_type,activity.entity_id)
    into v_activity_ids
  from public.hotel_activity_log activity
  where activity.correlation_id=p_correlation_id
    and activity.hotel_id=c_hotel and activity.actor_type='admin'
    and activity.actor_id=v_context.actor_id and activity.action='update'
    and activity.source='hotels_v2_seven_arches_pricing_activation';
  select before_state into v_plan_before from public.hotel_activity_log
  where correlation_id=p_correlation_id and entity_type='rate_plan'
    and entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid;
  select before_state into v_schedule_before from public.hotel_activity_log
  where correlation_id=p_correlation_id and entity_type='pricing_schedule'
    and entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid;
  select before_state into v_upper_before from public.hotel_activity_log
  where correlation_id=p_correlation_id and entity_type='room_rate'
    and entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid;
  select before_state into v_ground_before from public.hotel_activity_log
  where correlation_id=p_correlation_id and entity_type='room_rate'
    and entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid;
  v_expected_original:=jsonb_build_object(
    'rate_plan',jsonb_build_object(
      'id',v_plan_before->'id','version',v_plan_before->'version',
      'name_i18n',v_plan_before->'name_i18n',
      'description_i18n',v_plan_before->'description_i18n',
      'cancellation_policy',v_plan_before->'cancellation_policy',
      'is_active',v_plan_before->'is_active',
      'review_status',v_plan_before->'review_status'),
    'room_rates',jsonb_build_array(
      jsonb_build_object('id',v_upper_before->'id',
        'room_type_id',v_upper_before->'room_type_id',
        'base_nightly_rate',v_upper_before->'base_nightly_rate',
        'currency',v_upper_before->'currency','is_active',v_upper_before->'is_active',
        'review_status',v_upper_before->'review_status','version',v_upper_before->'version'),
      jsonb_build_object('id',v_ground_before->'id',
        'room_type_id',v_ground_before->'room_type_id',
        'base_nightly_rate',v_ground_before->'base_nightly_rate',
        'currency',v_ground_before->'currency','is_active',v_ground_before->'is_active',
        'review_status',v_ground_before->'review_status','version',v_ground_before->'version')),
    'shared_schedule',jsonb_build_object(
      'id',v_schedule_before->'id','version',v_schedule_before->'version',
      'name_i18n',v_schedule_before->'name_i18n',
      'is_active',v_schedule_before->'is_active',
      'review_status',v_schedule_before->'review_status','active_tier_count',27),
    'preview_schedule',(select jsonb_build_object(
      'id',schedule.id,'version',schedule.version,'is_active',schedule.is_active,
      'review_status',schedule.review_status)
      from public.hotel_pricing_schedules schedule
      where schedule.id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
        and schedule.hotel_id=c_hotel));

  v_early_counts_exact:=coalesce(
    (select count(*) from public.site_settings)=1
    and exists(select 1 from public.site_settings where id=1
      and hotel_rooms_v2_enabled is not distinct from false
      and hotel_external_sync_enabled is not null
      and hotel_instant_booking_enabled is not distinct from false
      and hotel_stripe_connect_enabled is not distinct from false)
    and (select count(*)
      from public.hotel_admin_availability_foundation_evolution_receipts)=1
    and (select count(*)
      from public.hotel_admin_availability_foundation_receipts)=1
    and (select count(*)
      from public.hotel_partner_workspace_foundation_receipts)=1
    and (select count(*)
      from public.hotel_partner_property_proposal_foundation_receipts)=1
    and (select count(*)
      from hotels_v2_private.hotel_external_calendar_foundation_receipts)=1
    and (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)=1,false);
  v_property_attribution_exact:=
    public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
      is true;
  v_workspace_lineage_exact:=
    public.hotel_v2_partner_workspace_function_lineage_is_exact() is true;
  v_stage2f_evidence_exact:=coalesce(
    exists(select 1
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.created_at is not null
        and isfinite(receipt.created_at)
        and (receipt.site_settings_without_external_fingerprint
          ~'^[0-9a-f]{64}$') is true
        and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
        and (select count(*) from jsonb_object_keys(
          receipt.compatibility_function_fingerprints))=20
        and not exists(select 1 from jsonb_each_text(
          receipt.compatibility_function_fingerprints) fingerprint(signature,value)
          where (fingerprint.value~'^[0-9a-f]{64}$') is not true)),false);
  v_raw_projection_exact:=coalesce(
    public.hotel_v2_h3_2b_protected_fingerprints() is not null
    and public.hotel_v2_external_calendar_protected_fingerprints() is not null
    and public.hotel_v2_h3_2b_protected_fingerprints()->'site_settings' is not null
    and public.hotel_v2_external_calendar_protected_fingerprints()->'site_settings'
      is not null,false);

  -- Reconstruct the projector's two internal maps independently. If the
  -- production projector returned NULL, these maps keep the final five-key
  -- predicate diagnostic rather than making it false merely because p_after
  -- has no object to inspect.
  select * into v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_lifecycle:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_lifecycle_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_lifecycle);
  v_raw_task2:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_raw_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_candidate_task2:=v_raw_task2||jsonb_build_object(
    'hotels',md5(pg_catalog.query_to_xml($query$
      select case when hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
        (to_jsonb(hotel)-array['title','title_i18n','description','description_i18n','city',
          'address_line','district','postal_code','country','latitude','longitude',
          'google_maps_url','amenities','check_in_from','check_out_until',
          'cover_image_url','photos','updated_at'])::text
        else to_jsonb(hotel)::text end
      from public.hotels hotel order by hotel.id$query$,true,true,'')::text),
    'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept'
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text));
  v_candidate_task2:=jsonb_set(v_candidate_task2,'{site_settings}',
    to_jsonb(v_lifecycle_fingerprint),false);
  v_candidate_stage2:=jsonb_set(jsonb_set(jsonb_set(v_raw_stage2,'{hotels}',
      v_owner.stage2_current_protected_fingerprints->'hotels',false),
    '{site_settings}',to_jsonb(v_lifecycle_fingerprint),false),
    '{non_external_calendar_activity}',to_jsonb(md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_external_calendar_control'
        and activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from 'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control' and exists(
          select 1 from public.hotel_partner_property_proposal_admin_reviews review
          where review.action='accept'
            and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text)),false)
    ||jsonb_build_object('non_external_calendar_partner_receipts',md5(
      pg_catalog.query_to_xml($query$
        select to_jsonb(receipt)::text from public.hotel_partner_action_receipts receipt
        where receipt.action not in('h3_2b_content','h3_2b_pricing','h3_2b_availability',
          'h3_2d_external_calendar') order by receipt.id$query$,true,true,'')::text));
  v_after_task2:=case when p_after is null
    then v_candidate_task2 else v_returned_task2 end;
  v_after_stage2:=case when p_after is null
    then v_candidate_stage2 else v_returned_stage2 end;
  if v_provider_relation is null then
    v_provider_branch_exact:=true;
  else
    execute format('select count(*) from %s',v_provider_relation)
      into v_provider_receipt_count;
    -- The clean pre-provider fixture exercises the projector's exact absent/zero
    -- branch. A present receipt belongs to the later provider-state gate.
    v_provider_branch_exact:=v_provider_receipt_count=0;
  end if;

  v_task2_relation_exact:=coalesce(exists(select 1 from pg_class relation
    where relation.oid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass),false);
  v_task2_columns_exact:=coalesce((select count(*) from pg_attribute attribute
      where attribute.attrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and attribute.attnum>0 and not attribute.attisdropped)=9
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
      (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
      (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
      (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
      (7::smallint,'canonical_snapshot_source_hash','text',true,null::text),
      (8::smallint,'validator_source_hash','text',true,null::text),
      (9::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''
      or attribute.attgenerated is distinct from ''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression),false);
  v_task2_constraints_exact:=coalesce(
    (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=9
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='p' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='(id=1)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[2]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(contract_version=''hotels_v2_seven_arches_task2_stage2_compatibility_v1''::text)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[3]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(jsonb_typeof(canonical_task2_protected_fingerprints)=''object''::text)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[5]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(jsonb_typeof(canonical_stage2_protected_fingerprints)=''object''::text)')=1
    and not exists(select 1 from (values
      (4::smallint,'canonical_task2_protected_fingerprint'),
      (6::smallint,'canonical_stage2_protected_fingerprint'),
      (7::smallint,'canonical_snapshot_source_hash'),
      (8::smallint,'validator_source_hash')
    ) expected(attnum,column_name) where (select count(*)
      from pg_constraint constraint_row where constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[expected.attnum]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='('||expected.column_name||
            '~''^[0-9a-f]{64}$''::text)')<>1),false);
  v_task2_trigger_exact:=coalesce(
    (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and trigger_row.tgname=
        'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
      and trigger_row.tgfoid=
        to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()')
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal),false);
  v_task2_acl_exact:=coalesce(not exists(select 1 from unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name) where has_table_privilege(0::oid,
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('anon',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('authenticated',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('service_role',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)),false);
  v_task2_source_binding_exact:=coalesce(v_task2_receipt.id=1
    and v_task2_receipt.contract_version=
      'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
    and v_task2_receipt.created_at is not null and isfinite(v_task2_receipt.created_at)
    and v_task2_receipt.canonical_task2_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(
        v_task2_receipt.canonical_task2_protected_fingerprints)
    and v_task2_receipt.canonical_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_task2_receipt.canonical_stage2_protected_fingerprints)
    and v_task2_receipt.canonical_snapshot_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_projector_oid)))
    and v_task2_receipt.validator_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_task2_validator_oid))),false);
  v_projector_security_exact:=coalesce(exists(select 1 from pg_proc procedure_row
    where procedure_row.oid=v_projector_oid
      and procedure_row.proowner='postgres'::regrole
      and procedure_row.prosecdef and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')),false);
  v_task2_validator_security_exact:=coalesce(exists(select 1
    from pg_proc procedure_row where procedure_row.oid=v_task2_validator_oid
      and procedure_row.proowner='postgres'::regrole
      and procedure_row.prosecdef and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')),false);
  v_task2_catalog_exact:=coalesce(v_task2_relation_exact
    and v_task2_columns_exact and v_task2_constraints_exact
    and v_task2_trigger_exact and v_task2_acl_exact
    and v_task2_source_binding_exact and v_projector_security_exact
    and v_task2_validator_security_exact,false);

  v_entry_exact:=coalesce(
    (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0
    and v_visible_context_count=1 and v_current_context_count=1
    and v_review_count=1 and v_admin_count=1 and v_task2_receipt_count=1
    and v_activity_count=4
    and not exists(select 1 from (values
      ('rate_plan'::text,'22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid),
      ('pricing_schedule','b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
      ('room_rate','7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
      ('room_rate','3320590d-632d-423f-80d0-fd021cba7293'::uuid)
    ) expected(entity_type,entity_id) where (select count(*)
      from public.hotel_activity_log activity
      where activity.correlation_id=p_correlation_id
        and activity.entity_type=expected.entity_type
        and activity.entity_id=expected.entity_id)<>1),false);

  -- Compact catalog/security group mirrors the protected surfaces consumed by
  -- the in-flight branch; actual counts and hashes are returned in details.
  v_catalog_exact:=coalesce(
    exists(select 1 from pg_class where oid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
      and relowner='postgres'::regrole and relrowsecurity)
    and exists(select 1 from pg_class where oid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass
      and relowner='postgres'::regrole and relrowsecurity)
    and (select count(*) from pg_attribute where attrelid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
      and attnum>0 and not attisdropped)=7
    and not exists(select 1 from (values
      (1::smallint,'backend_pid','integer',true,null::text),
      (2::smallint,'transaction_id','bigint',true,null::text),
      (3::smallint,'review_id','uuid',true,null::text),
      (4::smallint,'actor_id','uuid',true,null::text),
      (5::smallint,'correlation_id','uuid',true,null::text),
      (6::smallint,'applied_entity_ids','uuid[]',true,'''{}''::uuid[]'),
      (7::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''
      or attribute.attgenerated is distinct from ''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint where conrelid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass)=3
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
        and constraint_row.contype='p' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (backend_pid)'
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
        and constraint_row.contype='f' and constraint_row.convalidated
        and not constraint_row.condeferrable
        and constraint_row.conkey=array[3]::smallint[]
        and constraint_row.confrelid=
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and constraint_row.confkey=array[1]::smallint[]
        and constraint_row.confupdtype='a' and constraint_row.confdeltype='r')=1
    and (select count(*) from pg_constraint constraint_row
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[6]::smallint[]
        and regexp_replace(pg_get_expr(
          constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')=
          '((cardinality(applied_entity_ids)<=4)AND(applied_entity_ids<@ARRAY['||
          '''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid,'||
          '''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid,'||
          '''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid,'||
          '''3320590d-632d-423f-80d0-fd021cba7293''::uuid]))')=1
    and (select count(*) from pg_attribute where attrelid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass
      and attnum>0 and not attisdropped)=14
    and not exists(select 1 from (values
      (1::smallint,'id','uuid',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'hotel_id','uuid',true,null::text),
      (4::smallint,'actor_id','uuid',true,null::text),
      (5::smallint,'snapshot_token','text',true,null::text),
      (6::smallint,'plan_fingerprint','text',true,null::text),
      (7::smallint,'reviewed_plan','jsonb',true,null::text),
      (8::smallint,'reviewed_at','timestamp with time zone',true,null::text),
      (9::smallint,'expires_at','timestamp with time zone',true,null::text),
      (10::smallint,'consumed_at','timestamp with time zone',false,null::text),
      (11::smallint,'consumed_correlation_id','uuid',false,null::text),
      (12::smallint,'consumed_idempotency_key','text',false,null::text),
      (13::smallint,'result','jsonb',false,null::text),
      (14::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''
      or attribute.attgenerated is distinct from ''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint where conrelid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass)=10
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and constraint_row.contype='p' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and constraint_row.contype='f' and constraint_row.convalidated
        and not constraint_row.condeferrable
        and constraint_row.conkey=array[3]::smallint[]
        and constraint_row.confrelid='public.hotels'::regclass
        and constraint_row.confkey=array[1]::smallint[]
        and constraint_row.confupdtype='a' and constraint_row.confdeltype='r')=1
    and (select count(*) from pg_constraint constraint_row
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and constraint_row.contype='u' and constraint_row.convalidated
        and constraint_row.conkey=array[11]::smallint[])=1
    and not exists(select 1 from (values
      (array[2]::smallint[]),(array[3]::smallint[]),(array[5]::smallint[]),
      (array[6]::smallint[]),(array[7]::smallint[]),(array[9,8]::smallint[]),
      (array[10,11,12,13]::smallint[])
    ) expected(conkey) where (select count(*) from pg_constraint constraint_row
      where constraint_row.conrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=expected.conkey)<>1)
    and not exists(select 1 from pg_policy where polrelid in(
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass,
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass))
    and (select count(*) from pg_trigger where tgrelid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
      and not tgisinternal)=1
    and exists(select 1 from pg_trigger where tgrelid=
      'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
      and tgname='hotel_seven_arches_pricing_activation_context_guard'
      and tgfoid=v_context_guard_oid and tgtype=23 and tgenabled='O'
      and not tgisinternal)
    and (select count(*) from pg_trigger where tgrelid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass
      and not tgisinternal)=1
    and exists(select 1 from pg_trigger where tgrelid=
      'public.hotel_seven_arches_pricing_activation_reviews'::regclass
      and tgname='hotel_seven_arches_pricing_activation_review_guard'
      and tgfoid=v_review_guard_oid and tgtype=31 and tgenabled='O'
      and not tgisinternal)
    and exists(select 1 from pg_class where oid=
      'public.hotel_admin_pricing_action_receipts'::regclass
      and relowner='postgres'::regrole and relrowsecurity)
    and exists(select 1 from pg_class where oid='public.hotel_activity_log'::regclass
      and relowner='postgres'::regrole and relrowsecurity)
    and not exists(select 1 from pg_policy where polrelid=
      'public.hotel_admin_pricing_action_receipts'::regclass)
    and (select count(*) from pg_policy where polrelid=
      'public.hotel_activity_log'::regclass)=1
    and exists(select 1 from pg_policy policy where policy.polrelid=
      'public.hotel_activity_log'::regclass
      and policy.polname='hotel_activity_log_admin_select'
      and policy.polcmd='r' and policy.polpermissive
      and policy.polroles=array[('authenticated'::regrole)::oid]
      and policy.polwithcheck is null
      and pg_get_expr(policy.polqual,policy.polrelid) in(
        'is_current_user_admin()','public.is_current_user_admin()'))
    and (select count(*) from pg_trigger where tgrelid=
      'public.hotel_admin_pricing_action_receipts'::regclass
      and not tgisinternal)=1
    and exists(select 1 from pg_trigger where tgrelid=
      'public.hotel_admin_pricing_action_receipts'::regclass
      and tgname='hotel_admin_pricing_action_receipts_immutable'
      and tgfoid=v_admin_guard_oid and tgtype=27 and tgenabled='O'
      and not tgisinternal)
    and not exists(select 1 from (values
      (v_context_guard_oid,'6e9893cd347504be63ab5699e02a592f6e81355c5b31da31ccaca2dd6ee9c5f0',
        array['search_path=pg_catalog, public, auth']::text[]),
      (v_review_guard_oid,'23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758',
        array['search_path=pg_catalog, public, auth']::text[]),
      (v_freeze_guard_oid,'d864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6',
        array['search_path=pg_catalog, public']::text[]),
      (v_admin_guard_oid,'352e7e040c99044f0fb01b03656a9f3193694039afd0079567c25fb3967bbbd0',
        array['search_path=pg_catalog, public']::text[])
    ) expected(function_oid,source_hash,path)
    left join pg_proc procedure_row on procedure_row.oid=expected.function_oid
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef or procedure_row.provolatile<>'v'
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
        'hex') is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_proc where oid=v_apply_oid
      and proowner='postgres'::regrole and prosecdef and provolatile='v'
      and proconfig=array['search_path=pg_catalog, public, auth']::text[]
      and encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')=
        'c8a5b56ea5097524f0843c699dd83a484a166379324b891162b39e9ef6c51f6e'
      and not has_function_privilege(0::oid,oid,'EXECUTE')
      and not has_function_privilege('anon',oid,'EXECUTE')
      and has_function_privilege('authenticated',oid,'EXECUTE')
      and not has_function_privilege('service_role',oid,'EXECUTE'))
    and not exists(select 1 from (values
      ('public.hotel_seven_arches_pricing_activation_transaction_context'::regclass),
      ('public.hotel_seven_arches_pricing_activation_reviews'::regclass),
      ('public.hotel_admin_pricing_action_receipts'::regclass)
    ) relation(relation_oid) cross join unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name)
    where has_table_privilege(0::oid,relation.relation_oid,privilege.name)
      or has_table_privilege('anon',relation.relation_oid,privilege.name)
      or has_table_privilege('authenticated',relation.relation_oid,privilege.name)
      or has_table_privilege('service_role',relation.relation_oid,privilege.name))
    and not has_table_privilege(0::oid,'public.hotel_activity_log'::regclass,'SELECT')
    and not has_table_privilege('anon','public.hotel_activity_log'::regclass,'SELECT')
    and not has_table_privilege(
      'authenticated','public.hotel_activity_log'::regclass,'SELECT')
    and has_table_privilege('service_role','public.hotel_activity_log'::regclass,'SELECT')
    and has_table_privilege('service_role','public.hotel_activity_log'::regclass,'INSERT')
    and not exists(select 1 from (values
      (0::oid),(('anon'::regrole)::oid),(('authenticated'::regrole)::oid)
    ) role(role_oid) cross join unnest(array[
      'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name) where has_table_privilege(
      role.role_oid,'public.hotel_activity_log'::regclass,privilege.name))
    and not exists(select 1 from unnest(array[
      'UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name) where has_table_privilege(
      'service_role','public.hotel_activity_log'::regclass,privilege.name)),false);

  v_context_exact:=coalesce(auth.uid() is not null
    and auth.uid()=v_context.actor_id and public.is_current_user_admin() is true
    and v_context.transaction_id=txid_current()
    and v_context.review_id=p_review_id
    and v_context.correlation_id=p_correlation_id
    and v_context.created_at is not null and isfinite(v_context.created_at)
    and v_context.applied_entity_ids=array[
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid],false);

  v_receipt_exact:=coalesce(v_task2_receipt.id=1
    and v_task2_receipt.contract_version=
      'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
    and v_task2_receipt.canonical_task2_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(
        v_task2_receipt.canonical_task2_protected_fingerprints)
    and v_task2_receipt.canonical_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_task2_receipt.canonical_stage2_protected_fingerprints)
    and v_task2_receipt.canonical_task2_protected_fingerprints
      is not distinct from v_before_task2
    and v_task2_receipt.canonical_stage2_protected_fingerprints
      is not distinct from v_before_stage2,false);

  v_review_identity_exact:=coalesce(v_review.id=p_review_id
    and v_review.id=v_context.review_id
    and v_review.contract_version=
      'hotels_v2_seven_arches_pricing_activation_plan_v1'
    and v_review.hotel_id=c_hotel and v_review.actor_id=v_context.actor_id
    and v_review.reviewed_at is not null and isfinite(v_review.reviewed_at)
    and v_review.expires_at is not null and isfinite(v_review.expires_at)
    and v_review.expires_at=v_review.reviewed_at+interval '30 minutes'
    and v_review.created_at is not null and isfinite(v_review.created_at)
    and v_review.consumed_at is not null and isfinite(v_review.consumed_at)
    and statement_timestamp()<v_review.expires_at
    and v_context.created_at>=v_review.reviewed_at
    and v_context.created_at<v_review.expires_at
    and v_review.consumed_at>=v_review.reviewed_at
    and v_review.consumed_at<v_review.expires_at
    and v_review.consumed_correlation_id=p_correlation_id
    and v_review.consumed_idempotency_key=p_idempotency_key,false);

  v_review_plan_exact:=coalesce(
    public.hotel_v2_h2a_keys_allowed(v_review.reviewed_plan,array[
      'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
      'expires_at','operation','plan_fingerprint']) is true
    and v_review.reviewed_plan?&array[
      'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
      'expires_at','operation','plan_fingerprint']
    and v_review.reviewed_plan->>'contract_version'=
      'hotels_v2_seven_arches_pricing_activation_plan_v1'
    and v_review.reviewed_plan->>'review_id'=v_review.id::text
    and v_review.reviewed_plan->>'hotel_id'=c_hotel::text
    and v_review.reviewed_plan->>'snapshot_token'=v_review.snapshot_token
    and v_review.reviewed_plan->>'reviewed_at'=to_char(
      v_review.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    and v_review.reviewed_plan->>'expires_at'=to_char(
      v_review.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    and v_review.reviewed_plan->>'plan_fingerprint'=v_review.plan_fingerprint
    and v_review.plan_fingerprint=encode(extensions.digest(convert_to(
      (v_review.reviewed_plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex')
    and public.hotel_v2_h2a_keys_allowed(
      v_review.reviewed_plan->'operation',array[
        'entity','action','id','expected_original','payload']) is true
    and (v_review.reviewed_plan->'operation')?&array[
      'entity','action','id','expected_original','payload']
    and v_review.reviewed_plan#>>'{operation,entity}'='pricing_activation'
    and v_review.reviewed_plan#>>'{operation,action}'='activate'
    and v_review.reviewed_plan#>>'{operation,id}'=c_hotel::text
    and public.hotel_v2_h2a_keys_allowed(
      v_review.reviewed_plan#>'{operation,payload}',array[
        'upper_base_nightly_rate','ground_base_nightly_rate',
        'rate_plan_name_i18n','rate_plan_description_i18n',
        'schedule_name_i18n','reason']) is true
    and (v_review.reviewed_plan#>'{operation,payload}')?&array[
      'upper_base_nightly_rate','ground_base_nightly_rate',
      'rate_plan_name_i18n','rate_plan_description_i18n',
      'schedule_name_i18n','reason']
    and jsonb_typeof(v_review.reviewed_plan#>
      '{operation,payload,upper_base_nightly_rate}')='number'
    and jsonb_typeof(v_review.reviewed_plan#>
      '{operation,payload,ground_base_nightly_rate}')='number'
    and jsonb_typeof(v_review.reviewed_plan#>'{operation,expected_original}')='object'
    and v_review.reviewed_plan#>'{operation,expected_original}'
      is not distinct from v_expected_original,false);

  v_admin_exact:=coalesce(jsonb_typeof(v_review.result)='object'
    and v_review.result is not distinct from p_result
    and v_review.result is not distinct from jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_pricing_activation_apply_result_v1',
      'hotel_id',c_hotel,'changed',true,'replayed',false,'review_id',v_review.id,
      'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
      'activity_ids',to_jsonb(v_activity_ids),'public_change',false,
      'legacy_authoritative',true)
    and v_admin.hotel_id=c_hotel and v_admin.actor_id=v_context.actor_id
    and v_admin.correlation_id=p_correlation_id
    and v_admin.idempotency_key=p_idempotency_key
    and v_admin.created_at is not null and isfinite(v_admin.created_at)
    and v_admin.created_at>=v_context.created_at
    and v_admin.created_at<v_review.expires_at
    and v_admin.result is not distinct from v_review.result
    and v_admin.request_hash=encode(extensions.digest(convert_to(
      jsonb_build_object('reviewed_plan',v_review.reviewed_plan,
        'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex'),false);

  v_activity_envelope_exact:=coalesce(cardinality(v_activity_ids)=4
    and v_activity_count=4
    and (select count(*) from public.hotel_activity_log activity
      where activity.correlation_id=p_correlation_id and activity.hotel_id=c_hotel
        and activity.actor_type='admin' and activity.actor_id=v_context.actor_id
        and activity.action='update'
        and activity.source='hotels_v2_seven_arches_pricing_activation'
        and activity.created_at is not null and isfinite(activity.created_at)
        and activity.created_at>=v_context.created_at
        and activity.created_at<v_review.expires_at)=4,false);

  select coalesce(bool_and(exact),false) into v_plan_activity_exact from (
    select jsonb_typeof(before_state)='object' and jsonb_typeof(after_state)='object'
      and before_state->>'is_active'='false' and after_state->>'is_active'='true'
      and after_state->'name_i18n' is not distinct from
        v_review.reviewed_plan#>'{operation,payload,rate_plan_name_i18n}'
      and after_state->'description_i18n' is not distinct from
        v_review.reviewed_plan#>'{operation,payload,rate_plan_description_i18n}'
      and (after_state-array['name_i18n','description_i18n','is_active','version','updated_at'])
        is not distinct from
        (before_state-array['name_i18n','description_i18n','is_active','version','updated_at'])
      and pg_input_is_valid(before_state->>'version','integer')
      and pg_input_is_valid(after_state->>'version','integer')
      and case when pg_input_is_valid(before_state->>'version','integer')
        and pg_input_is_valid(after_state->>'version','integer')
        then (after_state->>'version')::integer=
          (before_state->>'version')::integer+1 else false end
      and pg_input_is_valid(before_state->>'updated_at','timestamp with time zone')
      and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
      and case when pg_input_is_valid(
          before_state->>'updated_at','timestamp with time zone')
        and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
        then (after_state->>'updated_at')::timestamptz>
          (before_state->>'updated_at')::timestamptz else false end
      and after_state is not distinct from (select to_jsonb(plan)
        from public.hotel_rate_plans plan where plan.id=activity.entity_id) exact
    from public.hotel_activity_log activity where correlation_id=p_correlation_id
      and entity_type='rate_plan'
      and entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
  ) checked;
  select coalesce(bool_and(exact),false) into v_schedule_activity_exact from (
    select jsonb_typeof(before_state)='object' and jsonb_typeof(after_state)='object'
      and before_state->>'is_active'='false' and after_state->>'is_active'='true'
      and after_state->'name_i18n' is not distinct from
        v_review.reviewed_plan#>'{operation,payload,schedule_name_i18n}'
      and (after_state-array['name_i18n','is_active','version','updated_at'])
        is not distinct from
        (before_state-array['name_i18n','is_active','version','updated_at'])
      and pg_input_is_valid(before_state->>'version','integer')
      and pg_input_is_valid(after_state->>'version','integer')
      and case when pg_input_is_valid(before_state->>'version','integer')
        and pg_input_is_valid(after_state->>'version','integer')
        then (after_state->>'version')::integer=
          (before_state->>'version')::integer+1 else false end
      and pg_input_is_valid(before_state->>'updated_at','timestamp with time zone')
      and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
      and case when pg_input_is_valid(
          before_state->>'updated_at','timestamp with time zone')
        and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
        then (after_state->>'updated_at')::timestamptz>
          (before_state->>'updated_at')::timestamptz else false end
      and after_state is not distinct from (select to_jsonb(schedule)
        from public.hotel_pricing_schedules schedule where schedule.id=activity.entity_id) exact
    from public.hotel_activity_log activity where correlation_id=p_correlation_id
      and entity_type='pricing_schedule'
      and entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
  ) checked;
  select coalesce(bool_and(exact),false) into v_upper_activity_exact from (
    select jsonb_typeof(before_state)='object' and jsonb_typeof(after_state)='object'
      and before_state->>'is_active'='false'
      and before_state->'base_nightly_rate'='0'::jsonb
      and after_state->>'is_active'='true'
      and after_state->'base_nightly_rate' is not distinct from
        v_review.reviewed_plan#>'{operation,payload,upper_base_nightly_rate}'
      and (after_state-array['base_nightly_rate','is_active','version','updated_at'])
        is not distinct from
        (before_state-array['base_nightly_rate','is_active','version','updated_at'])
      and pg_input_is_valid(before_state->>'version','integer')
      and pg_input_is_valid(after_state->>'version','integer')
      and case when pg_input_is_valid(before_state->>'version','integer')
        and pg_input_is_valid(after_state->>'version','integer')
        then (after_state->>'version')::integer=
          (before_state->>'version')::integer+1 else false end
      and pg_input_is_valid(before_state->>'updated_at','timestamp with time zone')
      and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
      and case when pg_input_is_valid(
          before_state->>'updated_at','timestamp with time zone')
        and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
        then (after_state->>'updated_at')::timestamptz>
          (before_state->>'updated_at')::timestamptz else false end
      and after_state is not distinct from (select to_jsonb(rate)
        from public.hotel_room_rates rate where rate.id=activity.entity_id) exact
    from public.hotel_activity_log activity where correlation_id=p_correlation_id
      and entity_type='room_rate'
      and entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
  ) checked;
  select coalesce(bool_and(exact),false) into v_ground_activity_exact from (
    select jsonb_typeof(before_state)='object' and jsonb_typeof(after_state)='object'
      and before_state->>'is_active'='false'
      and before_state->'base_nightly_rate'='0'::jsonb
      and after_state->>'is_active'='true'
      and after_state->'base_nightly_rate' is not distinct from
        v_review.reviewed_plan#>'{operation,payload,ground_base_nightly_rate}'
      and (after_state-array['base_nightly_rate','is_active','version','updated_at'])
        is not distinct from
        (before_state-array['base_nightly_rate','is_active','version','updated_at'])
      and pg_input_is_valid(before_state->>'version','integer')
      and pg_input_is_valid(after_state->>'version','integer')
      and case when pg_input_is_valid(before_state->>'version','integer')
        and pg_input_is_valid(after_state->>'version','integer')
        then (after_state->>'version')::integer=
          (before_state->>'version')::integer+1 else false end
      and pg_input_is_valid(before_state->>'updated_at','timestamp with time zone')
      and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
      and case when pg_input_is_valid(
          before_state->>'updated_at','timestamp with time zone')
        and pg_input_is_valid(after_state->>'updated_at','timestamp with time zone')
        then (after_state->>'updated_at')::timestamptz>
          (before_state->>'updated_at')::timestamptz else false end
      and after_state is not distinct from (select to_jsonb(rate)
        from public.hotel_room_rates rate where rate.id=activity.entity_id) exact
    from public.hotel_activity_log activity where correlation_id=p_correlation_id
      and entity_type='room_rate'
      and entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
  ) checked;

  v_task2_projector_exact:=coalesce(
    (v_after_task2-c_task2_keys) is not distinct from
      (v_task2_receipt.canonical_task2_protected_fingerprints-c_task2_keys)
    and not exists(select 1 from unnest(c_task2_keys) changed(key)
      where v_after_task2->changed.key is null
        or v_task2_receipt.canonical_task2_protected_fingerprints->changed.key is null
        or v_after_task2->changed.key is not distinct from
          v_task2_receipt.canonical_task2_protected_fingerprints->changed.key),false);
  v_stage2_projector_exact:=coalesce(
    (v_after_stage2-c_stage2_keys) is not distinct from
      (v_task2_receipt.canonical_stage2_protected_fingerprints-c_stage2_keys)
    and not exists(select 1 from unnest(c_stage2_keys) changed(key)
      where v_after_stage2->changed.key is null
        or v_task2_receipt.canonical_stage2_protected_fingerprints->changed.key is null
        or v_after_stage2->changed.key is not distinct from
          v_task2_receipt.canonical_stage2_protected_fingerprints->changed.key),false);
  v_apply_task2_exact:=coalesce(
    (v_after_task2-c_task2_keys) is not distinct from
      (v_before_task2-c_task2_keys)
    and not exists(select 1 from unnest(c_task2_keys) changed(key)
      where v_after_task2->changed.key is not distinct from
        v_before_task2->changed.key),false);
  v_apply_stage2_exact:=coalesce(
    (v_after_stage2-c_stage2_keys) is not distinct from
      (v_before_stage2-c_stage2_keys)
    and not exists(select 1 from unnest(c_stage2_keys) changed(key)
      where v_after_stage2->changed.key is not distinct from
        v_before_stage2->changed.key),false);

  return jsonb_build_object(
    'contract_version','hotels_v2_114400_inflight_projector_diagnostic_v1',
    'projector_null',p_after is null,
    'groups',jsonb_build_object(
      'early_counts_flags',v_early_counts_exact,
      'early_property_attribution',v_property_attribution_exact,
      'early_workspace_lineage',v_workspace_lineage_exact,
      'early_stage2f_evidence',v_stage2f_evidence_exact,
      'early_raw_projection',v_raw_projection_exact,
      'early_provider_branch',v_provider_branch_exact,
      'task2_receipt_catalog_security',v_task2_catalog_exact,
      'entry_cardinality',v_entry_exact,'catalog_security',v_catalog_exact,
      'auth_context',v_context_exact,'task2_receipt_binding',v_receipt_exact,
      'review_identity_time',v_review_identity_exact,
      'review_plan_expected_original',v_review_plan_exact,
      'result_admin_receipt',v_admin_exact,
      'activity_envelope',v_activity_envelope_exact,
      'activity_rate_plan',v_plan_activity_exact,
      'activity_schedule',v_schedule_activity_exact,
      'activity_upper_rate',v_upper_activity_exact,
      'activity_ground_rate',v_ground_activity_exact,
      'projector_task2_five_keys',v_task2_projector_exact,
      'projector_stage2_five_keys',v_stage2_projector_exact,
      'apply_task2_delta',v_apply_task2_exact,
      'apply_stage2_delta',v_apply_stage2_exact),
    'map_rows',pg_temp.hotel_v2_114400_key_classification(
        'TASK2',v_before_task2,v_after_task2,c_task2_keys)
      ||pg_temp.hotel_v2_114400_key_classification(
        'STAGE2',v_before_stage2,v_after_stage2,c_stage2_keys),
    'atoms',jsonb_build_array(
      pg_temp.hotel_v2_114400_atom('EARLY','COUNTS_AND_FLAGS',
        v_early_counts_exact,null),
      pg_temp.hotel_v2_114400_atom('EARLY','PROPERTY_ATTRIBUTION',
        v_property_attribution_exact,null),
      pg_temp.hotel_v2_114400_atom('EARLY','WORKSPACE_LINEAGE',
        v_workspace_lineage_exact,null),
      pg_temp.hotel_v2_114400_atom('EARLY','STAGE2F_EVIDENCE',
        v_stage2f_evidence_exact,null),
      pg_temp.hotel_v2_114400_atom('EARLY','RAW_PROJECTIONS',
        v_raw_projection_exact,null),
      pg_temp.hotel_v2_114400_atom('EARLY','PROVIDER_BRANCH',
        v_provider_branch_exact,jsonb_build_object(
          'relation',v_provider_relation::text,'count',v_provider_receipt_count)),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','RELATION_RLS_POLICY',
        v_task2_relation_exact,null),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','COLUMN_ENVELOPE',
        v_task2_columns_exact,jsonb_build_object('actual_count',
          (select count(*) from pg_attribute where attrelid=
            'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
            and attnum>0 and not attisdropped))),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','CONSTRAINT_ENVELOPE',
        v_task2_constraints_exact,jsonb_build_object('actual_count',
          (select count(*) from pg_constraint where conrelid=
            'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass))),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','IMMUTABLE_TRIGGER',
        v_task2_trigger_exact,jsonb_build_object('actual_count',
          (select count(*) from pg_trigger where tgrelid=
            'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
            and not tgisinternal))),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','RAW_ACL_REVOKED',
        v_task2_acl_exact,null),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','ROW_SOURCE_BINDINGS',
        v_task2_source_binding_exact,jsonb_build_object(
          'stored_projector',v_task2_receipt.canonical_snapshot_source_hash,
          'live_projector',public.hotel_v2_h3_2b_hash(
            to_jsonb(pg_get_functiondef(v_projector_oid))),
          'stored_validator',v_task2_receipt.validator_source_hash,
          'live_validator',public.hotel_v2_h3_2b_hash(
            to_jsonb(pg_get_functiondef(v_task2_validator_oid))))),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','PROJECTOR_SECURITY',
        v_projector_security_exact,null),
      pg_temp.hotel_v2_114400_atom('TASK2_RECEIPT','VALIDATOR_SECURITY',
        v_task2_validator_security_exact,null),
      pg_temp.hotel_v2_114400_atom('ENTRY','ACTIVATION_RECEIPT_COUNT_ZERO',
        (select count(*) from
          public.hotel_seven_arches_pricing_activation_evolution_receipts)=0,null),
      pg_temp.hotel_v2_114400_atom('ENTRY','CONTEXT_CARDINALITY',
        v_visible_context_count=1 and v_current_context_count=1,
        jsonb_build_object('visible',v_visible_context_count,
          'current_tx',v_current_context_count)),
      pg_temp.hotel_v2_114400_atom('ENTRY','REVIEW_CARDINALITY',
        v_review_count=1,to_jsonb(v_review_count)),
      pg_temp.hotel_v2_114400_atom('ENTRY','ADMIN_RECEIPT_CARDINALITY',
        v_admin_count=1,to_jsonb(v_admin_count)),
      pg_temp.hotel_v2_114400_atom('ENTRY','TASK2_RECEIPT_CARDINALITY',
        v_task2_receipt_count=1,to_jsonb(v_task2_receipt_count)),
      pg_temp.hotel_v2_114400_atom('ENTRY','ACTIVITY_CARDINALITY',
        v_activity_count=4,to_jsonb(v_activity_count)),
      pg_temp.hotel_v2_114400_atom('CATALOG','INFLIGHT_SECURITY_COMPOSITE',
        v_catalog_exact,jsonb_build_object(
          'context_columns',(select count(*) from pg_attribute where attrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
            and attnum>0 and not attisdropped),
          'context_constraints',(select count(*) from pg_constraint where conrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass),
          'review_columns',(select count(*) from pg_attribute where attrelid=
            'public.hotel_seven_arches_pricing_activation_reviews'::regclass
            and attnum>0 and not attisdropped),
          'review_constraints',(select count(*) from pg_constraint where conrelid=
            'public.hotel_seven_arches_pricing_activation_reviews'::regclass))),
      pg_temp.hotel_v2_114400_atom('CONTEXT','AUTH_AND_ADMIN',
        auth.uid() is not null and auth.uid()=v_context.actor_id
          and public.is_current_user_admin() is true,
        jsonb_build_object('auth_uid',auth.uid(),'actor_id',v_context.actor_id)),
      pg_temp.hotel_v2_114400_atom('CONTEXT','TRANSACTION_AND_LINKS',
        v_context.transaction_id=txid_current()
          and v_context.review_id=p_review_id
          and v_context.correlation_id=p_correlation_id,
        jsonb_build_object('transaction_id',v_context.transaction_id,
          'current_transaction_id',txid_current(),'review_id',v_context.review_id,
          'correlation_id',v_context.correlation_id)),
      pg_temp.hotel_v2_114400_atom('CONTEXT','TIMESTAMP_FINITE',
        v_context.created_at is not null and isfinite(v_context.created_at),
        to_jsonb(v_context.created_at)),
      pg_temp.hotel_v2_114400_atom('CONTEXT','APPLIED_ENTITY_IDS',
        v_context.applied_entity_ids=array[
          '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
          'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
          '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
          '3320590d-632d-423f-80d0-fd021cba7293'::uuid],
        to_jsonb(v_context.applied_entity_ids)),
      pg_temp.hotel_v2_114400_atom('TASK2_BINDING','CONTRACT_AND_SELF_HASHES',
        v_task2_receipt.id=1 and v_task2_receipt.contract_version=
          'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
          and v_task2_receipt.canonical_task2_protected_fingerprint=
            public.hotel_v2_h3_2b_hash(
              v_task2_receipt.canonical_task2_protected_fingerprints)
          and v_task2_receipt.canonical_stage2_protected_fingerprint=
            public.hotel_v2_external_calendar_worker_hash(
              v_task2_receipt.canonical_stage2_protected_fingerprints),null),
      pg_temp.hotel_v2_114400_atom('TASK2_BINDING','BEFORE_MAPS',
        v_task2_receipt.canonical_task2_protected_fingerprints
            is not distinct from v_before_task2
          and v_task2_receipt.canonical_stage2_protected_fingerprints
            is not distinct from v_before_stage2,null),
      pg_temp.hotel_v2_114400_atom('REVIEW','IDENTITY',
        v_review.id=p_review_id and v_review.id=v_context.review_id
          and v_review.contract_version=
            'hotels_v2_seven_arches_pricing_activation_plan_v1'
          and v_review.hotel_id=c_hotel and v_review.actor_id=v_context.actor_id,null),
      pg_temp.hotel_v2_114400_atom('REVIEW','WINDOW',
        v_review.reviewed_at is not null and isfinite(v_review.reviewed_at)
          and v_review.expires_at is not null and isfinite(v_review.expires_at)
          and v_review.expires_at=v_review.reviewed_at+interval '30 minutes'
          and statement_timestamp()<v_review.expires_at,
        jsonb_build_object('reviewed_at',v_review.reviewed_at,
          'expires_at',v_review.expires_at,'statement_timestamp',statement_timestamp())),
      pg_temp.hotel_v2_114400_atom('REVIEW','CONTEXT_AND_CONSUMPTION_TIME',
        v_review.created_at is not null and isfinite(v_review.created_at)
          and v_review.consumed_at is not null and isfinite(v_review.consumed_at)
          and v_context.created_at>=v_review.reviewed_at
          and v_context.created_at<v_review.expires_at
          and v_review.consumed_at>=v_review.reviewed_at
          and v_review.consumed_at<v_review.expires_at,
        jsonb_build_object('review_created_at',v_review.created_at,
          'context_created_at',v_context.created_at,
          'consumed_at',v_review.consumed_at)),
      pg_temp.hotel_v2_114400_atom('REVIEW','CONSUMPTION_LINKS',
        v_review.consumed_correlation_id=p_correlation_id
          and v_review.consumed_idempotency_key=p_idempotency_key,
        jsonb_build_object('correlation_id',v_review.consumed_correlation_id,
          'idempotency_key',v_review.consumed_idempotency_key)),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','TOP_LEVEL_ENVELOPE',
        public.hotel_v2_h2a_keys_allowed(v_review.reviewed_plan,array[
          'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
          'expires_at','operation','plan_fingerprint']) is true
          and v_review.reviewed_plan?&array[
          'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
          'expires_at','operation','plan_fingerprint'],null),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','TOP_LEVEL_VALUES',
        v_review.reviewed_plan->>'contract_version'=
          'hotels_v2_seven_arches_pricing_activation_plan_v1'
          and v_review.reviewed_plan->>'review_id'=v_review.id::text
          and v_review.reviewed_plan->>'hotel_id'=c_hotel::text
          and v_review.reviewed_plan->>'snapshot_token'=v_review.snapshot_token
          and v_review.reviewed_plan->>'reviewed_at'=to_char(
            v_review.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
          and v_review.reviewed_plan->>'expires_at'=to_char(
            v_review.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),null),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','FINGERPRINT',
        v_review.reviewed_plan->>'plan_fingerprint'=v_review.plan_fingerprint
          and v_review.plan_fingerprint=encode(extensions.digest(convert_to(
            (v_review.reviewed_plan-'plan_fingerprint')::text,'UTF8'),
            'sha256'),'hex'),to_jsonb(v_review.plan_fingerprint)),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','OPERATION_ENVELOPE_AND_IDENTITY',
        public.hotel_v2_h2a_keys_allowed(v_review.reviewed_plan->'operation',array[
          'entity','action','id','expected_original','payload']) is true
          and (v_review.reviewed_plan->'operation')?&array[
          'entity','action','id','expected_original','payload']
          and v_review.reviewed_plan#>>'{operation,entity}'='pricing_activation'
          and v_review.reviewed_plan#>>'{operation,action}'='activate'
          and v_review.reviewed_plan#>>'{operation,id}'=c_hotel::text,null),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','PAYLOAD_ENVELOPE_AND_TYPES',
        public.hotel_v2_h2a_keys_allowed(
          v_review.reviewed_plan#>'{operation,payload}',array[
            'upper_base_nightly_rate','ground_base_nightly_rate',
            'rate_plan_name_i18n','rate_plan_description_i18n',
            'schedule_name_i18n','reason']) is true
          and (v_review.reviewed_plan#>'{operation,payload}')?&array[
            'upper_base_nightly_rate','ground_base_nightly_rate',
            'rate_plan_name_i18n','rate_plan_description_i18n',
            'schedule_name_i18n','reason']
          and jsonb_typeof(v_review.reviewed_plan#>
            '{operation,payload,upper_base_nightly_rate}')='number'
          and jsonb_typeof(v_review.reviewed_plan#>
            '{operation,payload,ground_base_nightly_rate}')='number',null),
      pg_temp.hotel_v2_114400_atom('REVIEW_PLAN','EXPECTED_ORIGINAL',
        jsonb_typeof(v_review.reviewed_plan#>'{operation,expected_original}')='object'
          and v_review.reviewed_plan#>'{operation,expected_original}'
            is not distinct from v_expected_original,null),
      pg_temp.hotel_v2_114400_atom('ADMIN_RECEIPT','RESULT',
        jsonb_typeof(v_review.result)='object'
          and v_review.result is not distinct from p_result
          and v_admin.result is not distinct from v_review.result,null),
      pg_temp.hotel_v2_114400_atom('ADMIN_RECEIPT','IDENTITY_AND_TIME',
        v_admin.hotel_id=c_hotel and v_admin.actor_id=v_context.actor_id
          and v_admin.correlation_id=p_correlation_id
          and v_admin.idempotency_key=p_idempotency_key
          and v_admin.created_at is not null and isfinite(v_admin.created_at)
          and v_admin.created_at>=v_context.created_at
          and v_admin.created_at<v_review.expires_at,
        jsonb_build_object('created_at',v_admin.created_at)),
      pg_temp.hotel_v2_114400_atom('ADMIN_RECEIPT','REQUEST_HASH',
        v_admin.request_hash=encode(extensions.digest(convert_to(
          jsonb_build_object('reviewed_plan',v_review.reviewed_plan,
            'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex'),
        to_jsonb(v_admin.request_hash)),
      pg_temp.hotel_v2_114400_atom('ACTIVITY','ENVELOPE',
        v_activity_envelope_exact,jsonb_build_object('ids',to_jsonb(v_activity_ids),
          'count',v_activity_count)),
      pg_temp.hotel_v2_114400_atom('ACTIVITY','RATE_PLAN_EVIDENCE',
        v_plan_activity_exact,jsonb_build_object(
          'before_version',v_plan_before->>'version')),
      pg_temp.hotel_v2_114400_atom('ACTIVITY','SCHEDULE_EVIDENCE',
        v_schedule_activity_exact,jsonb_build_object(
          'before_version',v_schedule_before->>'version')),
      pg_temp.hotel_v2_114400_atom('ACTIVITY','UPPER_RATE_EVIDENCE',
        v_upper_activity_exact,jsonb_build_object(
          'before_version',v_upper_before->>'version',
          'before_rate',v_upper_before->'base_nightly_rate')),
      pg_temp.hotel_v2_114400_atom('ACTIVITY','GROUND_RATE_EVIDENCE',
        v_ground_activity_exact,jsonb_build_object(
          'before_version',v_ground_before->>'version',
          'before_rate',v_ground_before->'base_nightly_rate')),
      pg_temp.hotel_v2_114400_atom('MAP','PROJECTOR_TASK2_FIVE_KEYS',
        v_task2_projector_exact,null),
      pg_temp.hotel_v2_114400_atom('MAP','PROJECTOR_STAGE2_FIVE_KEYS',
        v_stage2_projector_exact,null),
      pg_temp.hotel_v2_114400_atom('MAP','APPLY_TASK2_DELTA',
        v_apply_task2_exact,null),
      pg_temp.hotel_v2_114400_atom('MAP','APPLY_STAGE2_DELTA',
        v_apply_stage2_exact,null)),
    'counts',jsonb_build_object(
      'activation_receipts',(select count(*) from
        public.hotel_seven_arches_pricing_activation_evolution_receipts),
      'visible_context',v_visible_context_count,'current_tx_context',v_current_context_count,
      'review',v_review_count,'admin_receipt',v_admin_count,
      'task2_receipt',v_task2_receipt_count,'activities',v_activity_count),
    'task2',jsonb_build_object(
      'before_hash',p_before->>'task2_protected_fingerprint',
      'projector_returned_hash',p_after->>'task2_protected_fingerprint',
      'reconstructed_hash',case when v_candidate_task2 is null then null else
        public.hotel_v2_h3_2b_hash(v_candidate_task2) end,
      'returned_matches_reconstructed',case when p_after is null then null else
        v_returned_task2 is not distinct from v_candidate_task2 end,
      'classified_after_hash',case when v_after_task2 is null then null else
        public.hotel_v2_h3_2b_hash(v_after_task2) end,
      'outside_allowed_differences',
        pg_temp.hotel_v2_114400_map_diff_keys(v_before_task2,v_after_task2,c_task2_keys),
      'keys',pg_temp.hotel_v2_114400_key_classification(
        'TASK2',v_before_task2,v_after_task2,c_task2_keys)),
    'stage2',jsonb_build_object(
      'before_hash',p_before->>'stage2_protected_fingerprint',
      'projector_returned_hash',p_after->>'stage2_protected_fingerprint',
      'reconstructed_hash',case when v_candidate_stage2 is null then null else
        public.hotel_v2_external_calendar_worker_hash(v_candidate_stage2) end,
      'returned_matches_reconstructed',case when p_after is null then null else
        v_returned_stage2 is not distinct from v_candidate_stage2 end,
      'classified_after_hash',case when v_after_stage2 is null then null else
        public.hotel_v2_external_calendar_worker_hash(v_after_stage2) end,
      'outside_allowed_differences',
        pg_temp.hotel_v2_114400_map_diff_keys(v_before_stage2,v_after_stage2,c_stage2_keys),
      'keys',pg_temp.hotel_v2_114400_key_classification(
        'STAGE2',v_before_stage2,v_after_stage2,c_stage2_keys)),
    'catalog_detail',jsonb_build_object(
      'context_columns',(select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
        and attnum>0 and not attisdropped),
      'context_constraints',(select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass),
      'review_columns',(select count(*) from pg_attribute where attrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass
        and attnum>0 and not attisdropped),
      'review_constraints',(select count(*) from pg_constraint where conrelid=
        'public.hotel_seven_arches_pricing_activation_reviews'::regclass)),
    'context_detail',jsonb_build_object(
      'actor_matches',auth.uid()=v_context.actor_id,
      'admin',public.is_current_user_admin(),
      'transaction_matches',v_context.transaction_id=txid_current(),
      'applied_entity_ids',to_jsonb(v_context.applied_entity_ids),
      'review_id',v_context.review_id,'correlation_id',v_context.correlation_id));
end
$function$;

do $install_diagnostic_apply_clone$
declare
  v_definition text;
  v_name constant text:=
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation';
  v_needle constant text:=$needle$  v_after_canonical:=
    public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();$needle$;
  v_suffix constant text:=$suffix$
  raise exception using errcode='P0001',
    message='HOTELS_V2_114400_INFLIGHT_DIAGNOSTIC_CAPTURED',
    detail=pg_temp.hotel_v2_114400_capture_inflight(
      v_before_canonical,v_after_canonical,v_review.id,p_correlation_id,
      p_idempotency_key,v_result)::text;
end
$function$
$suffix$;
begin
  select pg_get_functiondef(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'
      ::regprocedure) into strict v_definition;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'
         ::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=
         array['search_path=pg_catalog, public, auth']::text[]
       and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
         'hex')='c8a5b56ea5097524f0843c699dd83a484a166379324b891162b39e9ef6c51f6e'
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or (length(v_definition)-length(replace(v_definition,v_name,'')))
       /length(v_name)<>1
     or (length(v_definition)-length(replace(v_definition,v_needle,'')))
       /length(v_needle)<>1 then
    raise exception 'pricing_activation_inflight_diagnostic_clone_source_mismatch';
  end if;
  v_definition:=replace(split_part(v_definition,v_needle,1),v_name,
    'pg_temp.hotel_v2_114400_apply_inflight_diagnostic')||v_needle||v_suffix;
  execute v_definition;
end
$install_diagnostic_apply_clone$;

do $run_inflight_diagnostic$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_correlation constant uuid:='38900000-0000-4000-8000-000000000012';
  c_key constant text:='seven-arches-inflight-diagnostic-0001';
  v_snapshot jsonb; v_draft jsonb; v_preview jsonb;
  v_message text; v_detail text; v_state text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
    'hotel_id',c_hotel,'snapshot_token',v_snapshot->>'snapshot_token',
    'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00,
    'rate_plan_name_i18n',jsonb_build_object(
      'pl','Standardowa','en','Standard','he','סטנדרטי'),
    'rate_plan_description_i18n',jsonb_build_object(
      'pl','Bezzwrotna taryfa dla obu apartamentów.',
      'en','Non-refundable rate for both apartments.',
      'he','תעריף ללא החזר לשתי הדירות.'),
    'schedule_name_i18n',jsonb_build_object(
      'pl','Obłożenie i długość pobytu','en','Occupancy and length of stay',
      'he','תפוסה ואורך שהייה'),
    'reason','Reviewed in-flight projector diagnostic');
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(v_draft);
  begin
    perform pg_temp.hotel_v2_114400_apply_inflight_diagnostic(
      v_preview->'reviewed_plan',c_correlation,c_key);
    raise exception 'pricing_activation_inflight_diagnostic_missing_sentinel';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text,v_detail=pg_exception_detail,
      v_state=returned_sqlstate;
    if v_state<>'P0001'
       or v_message<>'HOTELS_V2_114400_INFLIGHT_DIAGNOSTIC_CAPTURED'
       or v_detail is null then
      raise;
    end if;
  end;
  reset role;

  if exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts
       where correlation_id=c_correlation)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id=c_correlation)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where id=(v_preview#>>'{reviewed_plan,review_id}')::uuid
         and consumed_at is not null)
     or exists(select 1 from public.hotel_rate_plans
       where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and is_active)
     or exists(select 1 from public.hotel_pricing_schedules
       where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid and is_active)
     or exists(select 1 from public.hotel_room_rates where id in(
       '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
       '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
       and (is_active or base_nightly_rate<>0))
     or public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null then
    raise exception 'pricing_activation_inflight_diagnostic_rollback_failed';
  end if;
  insert into pricing_activation_inflight_diagnostic_result(payload)
  values(v_detail::jsonb);
end
$run_inflight_diagnostic$;

select payload from pricing_activation_inflight_diagnostic_result;
select map_row->>'MAP' as "MAP",map_row->>'KEY' as "KEY",
  map_row->>'BEFORE' as "BEFORE",map_row->>'IN_FLIGHT' as "IN_FLIGHT",
  map_row->>'CLASSIFICATION' as "CLASSIFICATION"
from pricing_activation_inflight_diagnostic_result result
cross join lateral jsonb_array_elements(result.payload->'map_rows')
  with ordinality classified(map_row,ordinal)
order by ordinal;
select atom->>'GROUP' as "GROUP",atom->>'ATOM' as "FAILING_ATOM",
  atom->'DETAIL' as "DETAIL"
from pricing_activation_inflight_diagnostic_result result
cross join lateral jsonb_array_elements(result.payload->'atoms')
  with ordinality expanded(atom,ordinal)
where (atom->>'PASS')::boolean is not true
order by ordinal;
select 'HOTELS_V2_114400_INFLIGHT_PROJECTOR_DIAGNOSTIC_COMPLETE' as sentinel,
  (payload->>'projector_null')::boolean as projector_null,
  jsonb_array_length(payload->'map_rows') as map_classification_count,
  (select count(*) from jsonb_array_elements(payload->'atoms') atom
    where (atom->>'PASS')::boolean is not true) as failing_atom_count,
  payload#>'{groups}' as named_groups
from pricing_activation_inflight_diagnostic_result;
rollback;
