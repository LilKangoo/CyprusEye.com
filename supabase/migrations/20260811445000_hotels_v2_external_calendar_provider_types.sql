-- Hotels V2 Stage 2 provider-type evolution.  booking_com, airbnb and ical
-- are provider labels over the same reviewed iCalendar/Vault transport.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_preview_common(text,jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)') is null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_foundation_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_provider_evolution_already_present';
  end if;
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_foundation_drift';
  end if;
  if public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('leased','running'))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs
       where status='running') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_activation_drift';
  end if;
  if not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'original_receipt_intact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'audit_chain_exact')::boolean,false)
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_owner_evolution_drift';
  end if;
  if not exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt
      where receipt.id=1 and receipt.provider_source_attribution_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_attribution_drift';
  end if;
end
$preconditions$;

create function public.hotel_v2_external_calendar_ics_source_type_is_supported(p_source_type text)
returns boolean language sql immutable set search_path=pg_catalog
as $$select coalesce(p_source_type in('booking_com','airbnb','ical'),false)$$;

create table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts(
  id smallint primary key check(id=1),
  original_foundation_fingerprint text not null check(original_foundation_fingerprint~'^[0-9a-f]{64}$'),
  original_protected_fingerprints jsonb not null,
  prior_compatible_fingerprints jsonb not null check(jsonb_typeof(prior_compatible_fingerprints)='object'),
  prior_compatible_fingerprint text not null check(prior_compatible_fingerprint~'^[0-9a-f]{64}$'),
  manual_source_fingerprint text not null check(manual_source_fingerprint~'^[0-9a-f]{64}$'),
  provider_source_baseline jsonb not null check(jsonb_typeof(provider_source_baseline)='array'),
  prior_function_fingerprints jsonb not null check(jsonb_typeof(prior_function_fingerprints)='object'),
  evolved_protected_fingerprints jsonb,
  evolved_protected_fingerprint text check(evolved_protected_fingerprint is null
    or evolved_protected_fingerprint~'^[0-9a-f]{64}$'),
  evolved_function_fingerprints jsonb,
  evolution_helper_fingerprints jsonb,
  fingerprint_helper_source_hashes jsonb,
  safe_function_source_hash text check(safe_function_source_hash is null
    or safe_function_source_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,public.hotel_v2_external_calendar_worker_hash(
  to_jsonb(pg_get_functiondef(signature::regprocedure))) order by signature)
from unnest(array[
  'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
  'public.hotel_v2_external_calendar_worker_list_sources(integer)',
  'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
  'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
  'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
  'public.hotel_v2_external_calendar_guard_source()',
  'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
  'public.hotel_v2_external_calendar_source_projection(uuid)',
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
  'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
  'public.hotel_v2_external_calendar_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()',
  'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
  'public.hotel_v2_external_calendar_site_settings_fingerprint()',
  'public.hotel_v2_partner_workspace_function_lineage_is_exact()'
]) signature
$function$;

insert into hotels_v2_private.hotel_external_calendar_provider_evolution_receipts(
  id,original_foundation_fingerprint,original_protected_fingerprints,
  prior_compatible_fingerprints,prior_compatible_fingerprint,
  manual_source_fingerprint,provider_source_baseline,prior_function_fingerprints)
select 1,foundation.protected_fingerprint,foundation.protected_fingerprints,
  normalized.value,public.hotel_v2_external_calendar_worker_hash(normalized.value),
  public.hotel_v2_external_calendar_worker_hash(coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
    from public.hotel_calendar_source_configs source where source.source_type='manual'),'[]'::jsonb)),
  coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
    from public.hotel_calendar_source_configs source
    where public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)),'[]'::jsonb),
  hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
cross join lateral (select public.hotel_v2_external_calendar_stage2_compatible_fingerprints() value) compatible
-- The provider receipt is an upstream baseline, so an already-applied exact
-- Task3 transition is folded back to its immutable before projection.  The
-- precondition above has already required the full Task3 current-safe proof;
-- zero receipts remains the inert baseline and exactly one receipt contributes
-- only its exact five reviewed Stage2 keys.
cross join lateral (select case
  when (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0
    then compatible.value
  else compatible.value||coalesce((select jsonb_object_agg(changed.changed_key,
      activation.before_stage2_protected_fingerprints->(changed.changed_key))
    from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
    cross join lateral unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
    where activation.id=1),'{}'::jsonb)
  end value) task3_normalized
cross join lateral (select jsonb_set(task3_normalized.value,'{site_settings}',to_jsonb(
  public.hotel_v2_external_calendar_site_settings_fingerprint()),false) value) normalized
where foundation.id=1;

create function hotels_v2_private.hotel_external_calendar_evolve_function(
  p_signature text,p_needle text,p_replacement text,p_expected_count integer
) returns void language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_definition text; v_count integer;
begin
  if p_signature is null or to_regprocedure(p_signature) is null or p_needle is null
     or p_needle='' or p_replacement is null or p_expected_count<=0 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_invalid_source_patch';
  end if;
  v_definition:=pg_get_functiondef(to_regprocedure(p_signature));
  v_count:=(length(v_definition)-length(replace(v_definition,p_needle,'')))/length(p_needle);
  if v_count<>p_expected_count then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_source_drift',
      detail=p_signature||':'||v_count::text||':'||p_expected_count::text;
  end if;
  execute replace(v_definition,p_needle,p_replacement);
end
$function$;

-- Evolve the raw helper's provider classification in place. Its OID and raw
-- live-state behavior remain intact; no foundation-pinned wrapper replaces it.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_protected_fingerprints()',
  'where source.source_type<>''ical'' order by source.id',
  'where not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type) order by source.id',1);

-- Worker and scheduler selection/binding.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
  'v_source.source_type <> ''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_list_sources(integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);

-- ADMIN-D capacity overlay remains subtractive and now aggregates every
-- supported iCalendar-labelled provider.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',2);

-- Table guards, lifecycle guards and redacted control projection.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_source()',
  'new.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(new.source_type)',3);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_source()',
  'if tg_op=''UPDATE'' and new.room_type_id is distinct from old.room_type_id and (old.is_enabled',
  'if tg_op=''UPDATE'' and (new.room_type_id is distinct from old.room_type_id or new.source_type is distinct from old.source_type) and (old.is_enabled',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',4);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_source_projection(uuid)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',5);

-- Reviewed source create/update contract: source_type is explicit and exact.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'array[''room_type_id'',''code'',''sync_interval_minutes'',''units_per_event'',''priority'']',
  'array[''room_type_id'',''code'',''source_type'',''sync_interval_minutes'',''units_per_event'',''priority'']',2);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)\n       or jsonb_typeof(v_payload->''code'')<>''string''',
  E'or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)\n       or jsonb_typeof(v_payload->''source_type'')<>''string''\n       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_payload->>''source_type'')\n       or jsonb_typeof(v_payload->''code'')<>''string''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '''code'',v_payload->''code'',''source_type'',''ical''',
  '''code'',v_payload->''code'',''source_type'',v_payload->''source_type''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',4);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'if v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid and (v_source.is_enabled',
  'if (v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid or v_source.source_type<>v_payload->>''source_type'') and (v_source.is_enabled',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '''code'',v_payload->''code'',''priority'',v_payload->''priority''',
  '''code'',v_payload->''code'',''source_type'',v_payload->''source_type'',''priority'',v_payload->''priority''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'v_changed:=v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid\n        or v_source.code<>v_payload->>''code''',
  E'v_changed:=v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid\n        or v_source.source_type<>v_payload->>''source_type'' or v_source.code<>v_payload->>''code''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '["code","priority","room_type_id","sync_interval_minutes","units_per_event"]',
  '["code","priority","room_type_id","source_type","sync_interval_minutes","units_per_event"]',1);

select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'v_payload->>''code'',''ical'',jsonb_build_object',
  'v_payload->>''code'',v_payload->>''source_type'',jsonb_build_object',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'update public.hotel_calendar_source_configs set room_type_id=(v_payload->>''room_type_id'')::uuid,code=v_payload->>''code'',',
  E'update public.hotel_calendar_source_configs set room_type_id=(v_payload->>''room_type_id'')::uuid,code=v_payload->>''code'',\n      source_type=v_payload->>''source_type'',',1);

create function public.hotel_v2_external_calendar_provider_protected_fingerprints()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public
as $function$
declare v_result jsonb; v_activation record; v_provider record; v_key text;
  v_activation_count integer; v_provider_found boolean:=false;
  v_site_settings_fingerprint text;
begin
  v_result:=public.hotel_v2_external_calendar_stage2_compatible_fingerprints();
  v_site_settings_fingerprint:=
    public.hotel_v2_external_calendar_site_settings_fingerprint();
  if v_site_settings_fingerprint is null or v_result->'site_settings' is null then
    return null;
  end if;
  v_result:=jsonb_set(v_result,'{site_settings}',
    to_jsonb(v_site_settings_fingerprint),false);
  -- Once the immutable provider evolution receipt exists, supported provider
  -- source rows are attributed independently below by their exact reviewed
  -- control activity. Normalize only their legacy aggregate fingerprint back
  -- to the pricing-safe pre-provider baseline; every other compatible key and
  -- the separately projected manual source fingerprint remain live.
  select receipt.prior_compatible_fingerprints into v_provider
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  where receipt.id=1;
  v_provider_found:=found;
  if v_provider_found then
    if v_result->'non_ical_calendar_sources' is null
       or v_provider.prior_compatible_fingerprints->'non_ical_calendar_sources' is null then
      return null;
    end if;
  end if;
  -- Task3 may be applied after this provider migration. Validate its immutable
  -- Stage2 before/after lineage directly against the Task1 owner baseline and
  -- the current compatible projection outside the separately attributed
  -- provider-source aggregate, then normalize only its five reviewed keys.
  -- This deliberately does not call the full Task3
  -- current-safe function, whose broader H3.2B ledger changes after H3.2D.
  select count(*) into v_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_activation_count>1 then return null; end if;
  if v_activation_count=1 then
    select * into strict v_activation
    from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
    if v_result is null
       or (select count(*)
         from public.hotel_admin_availability_foundation_evolution_receipts)<>1
       or v_activation.contract_version<>
         'hotels_v2_seven_arches_pricing_activation_evolution_v1'
       or v_activation.before_stage2_protected_fingerprints is distinct from
         (select owner_receipt.stage2_current_protected_fingerprints
          from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
          where owner_receipt.id=1)
       or v_activation.before_stage2_protected_fingerprint is distinct from
         (select owner_receipt.stage2_current_protected_fingerprint
          from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
          where owner_receipt.id=1)
       or v_activation.before_stage2_protected_fingerprint<>
         public.hotel_v2_external_calendar_worker_hash(
           v_activation.before_stage2_protected_fingerprints)
       or v_activation.after_stage2_protected_fingerprint<>
         public.hotel_v2_external_calendar_worker_hash(
           v_activation.after_stage2_protected_fingerprints)
       or (v_result-array['non_ical_calendar_sources','site_settings']::text[])
         is distinct from (v_activation.after_stage2_protected_fingerprints-
           array['non_ical_calendar_sources','site_settings']::text[])
       or v_activation.after_stage2_protected_fingerprints->'non_ical_calendar_sources'
         is distinct from
         v_activation.before_stage2_protected_fingerprints->'non_ical_calendar_sources'
       or v_activation.after_stage2_protected_fingerprints->'site_settings'
         is distinct from v_activation.before_stage2_protected_fingerprints->'site_settings'
       or v_activation.stage2_allowed_fingerprint_keys is distinct from array[
         'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
         'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[]
       or (v_activation.after_stage2_protected_fingerprints-
         v_activation.stage2_allowed_fingerprint_keys) is distinct from
         (v_activation.before_stage2_protected_fingerprints-
         v_activation.stage2_allowed_fingerprint_keys)
       or exists(select 1
         from unnest(v_activation.stage2_allowed_fingerprint_keys) as changed(changed_key)
         where v_activation.before_stage2_protected_fingerprints->(changed.changed_key) is null
           or v_activation.after_stage2_protected_fingerprints->(changed.changed_key) is null
           or v_activation.after_stage2_protected_fingerprints->>(changed.changed_key)
             is not distinct from
             v_activation.before_stage2_protected_fingerprints->>(changed.changed_key)) then
      return null;
    end if;
    foreach v_key in array v_activation.stage2_allowed_fingerprint_keys loop
      v_result:=jsonb_set(v_result,array[v_key],
        v_activation.before_stage2_protected_fingerprints->v_key,true);
    end loop;
  end if;
  if v_provider_found then
    v_result:=jsonb_set(v_result,'{non_ical_calendar_sources}',
      v_provider.prior_compatible_fingerprints->'non_ical_calendar_sources',false);
  end if;
  return v_result||jsonb_build_object('manual_calendar_sources',
    public.hotel_v2_external_calendar_worker_hash(
    coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
      from public.hotel_calendar_source_configs source where source.source_type='manual'),'[]'::jsonb)));
end
$function$;

create function hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,public.hotel_v2_external_calendar_worker_hash(
  to_jsonb(pg_get_functiondef(signature::regprocedure))) order by signature)
from unnest(array[
  'public.hotel_v2_external_calendar_ics_source_type_is_supported(text)',
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
  'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',
  'public.hotel_v2_external_calendar_provider_protected_fingerprints()'
]) signature
$function$;

update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt set
  evolved_function_fingerprints=hotels_v2_private.hotel_external_calendar_provider_function_fingerprints(),
  evolved_protected_fingerprints=public.hotel_v2_external_calendar_provider_protected_fingerprints(),
  evolved_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
    public.hotel_v2_external_calendar_provider_protected_fingerprints()),
  evolution_helper_fingerprints=
    hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints(),
  fingerprint_helper_source_hashes=jsonb_build_object(
    'provider_function_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
      pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()'::regprocedure))),
    'provider_helper_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
      pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'::regprocedure))))
where receipt.id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column evolved_function_fingerprints set not null,
  alter column evolved_protected_fingerprints set not null,
  alter column evolved_protected_fingerprint set not null,
  alter column evolution_helper_fingerprints set not null,
  alter column fingerprint_helper_source_hashes set not null;

create function public.hotel_v2_external_calendar_provider_evolution_is_safe()
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $function$
select coalesce((select
    receipt.original_foundation_fingerprint=foundation.protected_fingerprint
    and receipt.original_protected_fingerprints=foundation.protected_fingerprints
    and foundation.protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(foundation.protected_fingerprints)
    and receipt.prior_compatible_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(receipt.prior_compatible_fingerprints)
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'=
      receipt.evolved_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'=
      hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'=
      receipt.evolved_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'=
      hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'
    and receipt.evolved_protected_fingerprints=
      public.hotel_v2_external_calendar_provider_protected_fingerprints()
    and receipt.evolved_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
      receipt.evolved_protected_fingerprints)
    and (receipt.evolved_protected_fingerprints-array[
      'non_ical_calendar_sources','manual_calendar_sources']::text[])
      is not distinct from (receipt.prior_compatible_fingerprints-array[
      'non_ical_calendar_sources','manual_calendar_sources']::text[])
    and not exists(select 1
      from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
      where exists(select 1
        from unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
        where receipt.prior_compatible_fingerprints->(changed.changed_key)
          is distinct from activation.before_stage2_protected_fingerprints->(changed.changed_key)))
    and receipt.manual_source_fingerprint=public.hotel_v2_external_calendar_worker_hash(
      coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
        from public.hotel_calendar_source_configs source where source.source_type='manual'),'[]'::jsonb))
    and receipt.evolved_function_fingerprints=hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
    and receipt.evolution_helper_fingerprints=
      hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
    and (select stage2_compatibility_source_hash
      from public.hotel_partner_property_proposal_foundation_receipts where id=1)=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
    and receipt.fingerprint_helper_source_hashes=jsonb_build_object(
      'provider_function_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
        pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()'::regprocedure))),
      'provider_helper_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
        pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'::regprocedure))))
    and receipt.safe_function_source_hash=public.hotel_v2_external_calendar_worker_hash(
      to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_provider_evolution_is_safe()'::regprocedure)))
    and public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
    and (select provider_source_attribution_source_hash
      from public.hotel_partner_property_proposal_foundation_receipts where id=1)=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
    and public.hotel_v2_external_calendar_provider_sources_are_attributable()
    and public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
    and public.hotel_v2_partner_workspace_function_lineage_is_exact()
    and not exists(select 1 from public.hotel_calendar_source_configs source
      where source.source_type<>'manual'
        and not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type))
    and not exists(select 1 from public.hotel_calendar_source_configs source
      where public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        and not exists(select 1 from jsonb_array_elements(receipt.provider_source_baseline) baseline(value)
          where baseline.value=to_jsonb(source))
        and not exists(select 1 from public.hotel_activity_log activity
          where activity.source='hotels_v2_external_calendar_control'
            and activity.entity_type='calendar_source' and activity.entity_id=source.id
            and activity.after_state->>'id'=source.id::text
            and activity.after_state->>'hotel_id'=source.hotel_id::text
            and activity.after_state->>'room_type_id'=source.room_type_id::text
            and activity.after_state->>'code'=source.code
            and activity.after_state->>'source_type'=source.source_type
            and (activity.after_state->>'is_enabled')::boolean=source.is_enabled
            and activity.after_state->>'review_status'=source.review_status
            and (activity.after_state->>'priority')::smallint=source.priority
            and (activity.after_state->>'version')::bigint=source.version
            and activity.after_state->>'updated_at'=to_jsonb(source.updated_at)#>>'{}'))
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  join hotels_v2_private.hotel_external_calendar_foundation_receipts foundation on foundation.id=receipt.id
  where receipt.id=1),false)
$function$;

update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts set
  safe_function_source_hash=public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_external_calendar_provider_evolution_is_safe()'::regprocedure))) where id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column safe_function_source_hash set not null;
create trigger hotel_external_calendar_provider_evolution_receipt_immutable
before update or delete on hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

drop function hotels_v2_private.hotel_external_calendar_evolve_function(text,text,text,integer);

alter function public.hotel_v2_external_calendar_ics_source_type_is_supported(text) owner to postgres;
alter function public.hotel_v2_external_calendar_stage2_compatible_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_evolution_is_safe() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_function_fingerprints() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints() owner to postgres;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts owner to postgres;
revoke all on function public.hotel_v2_external_calendar_ics_source_type_is_supported(text),
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
  public.hotel_v2_external_calendar_protected_fingerprints(),
  public.hotel_v2_external_calendar_provider_protected_fingerprints(),
  public.hotel_v2_external_calendar_provider_evolution_is_safe(),
  public.hotel_v2_external_calendar_provider_sources_are_attributable(),
  public.hotel_v2_partner_workspace_function_lineage_is_exact(),
  hotels_v2_private.hotel_external_calendar_provider_function_fingerprints(),
  hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
  from public,anon,authenticated,service_role;

do $postconditions$
begin
  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_evolution_unsafe';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_ics_source_type_is_supported(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_site_settings_fingerprint()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_provider_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_provider_evolution_is_safe()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()',true,array['search_path=pg_catalog, public']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or procedure.prosecdef is distinct from expected.security_definer
      or procedure.proconfig is distinct from expected.configuration
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_security_mismatch';
  end if;
  if has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_postcondition_mismatch';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
