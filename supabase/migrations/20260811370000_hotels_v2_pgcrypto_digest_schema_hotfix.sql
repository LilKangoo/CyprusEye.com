-- Hotels V2 pgcrypto schema-qualification hotfix.
-- Repairs runtime digest() resolution for existing SECURITY DEFINER functions
-- on Supabase, where pgcrypto is installed in schema "extensions".
-- No Hotel data, flags, pricing, booking, payment or Partner rows are changed.

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

create temporary table hotels_v2_pgcrypto_hotfix_before as
with targets(signature) as (
  values
    ('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'),
    ('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'),
    ('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)')
)
select
  targets.signature,
  p.oid,
  p.prosecdef,
  p.provolatile,
  p.proconfig,
  p.proowner,
  p.proacl
from targets
join pg_proc p on p.oid=to_regprocedure(targets.signature);

do $hotfix_preflight$
declare
  v_expected integer := 3;
  v_actual integer;
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception using
      errcode='55000',
      message='hotels_v2_pgcrypto_hotfix_extensions_digest_missing';
  end if;

  select count(*) into v_actual
  from hotels_v2_pgcrypto_hotfix_before;

  if v_actual<>v_expected then
    raise exception using
      errcode='55000',
      message='hotels_v2_pgcrypto_hotfix_target_function_missing';
  end if;

  if exists(
    select 1
    from hotels_v2_pgcrypto_hotfix_before before_state
    where strpos(
      pg_get_functiondef(before_state.oid),
      'extensions.digest(convert_to'
    )>0
  ) then
    raise exception using
      errcode='55000',
      message='hotels_v2_pgcrypto_hotfix_already_applied';
  end if;

  if exists(
    select 1
    from hotels_v2_pgcrypto_hotfix_before before_state
    where strpos(
      pg_get_functiondef(before_state.oid),
      'digest(convert_to'
    )=0
  ) then
    raise exception using
      errcode='55000',
      message='hotels_v2_pgcrypto_hotfix_unexpected_function_definition';
  end if;
end
$hotfix_preflight$;

create or replace function public.hotel_v2_admin_apply_partner_hotel_permissions(
  p_plan jsonb,
  p_correlation_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  c_contract constant text := 'hotels_v2_h3_2a_partner_permissions_v1';
  c_decision constant text := 'apply_partner_hotel_permissions';
  c_action constant text := 'apply_partner_hotel_permissions';
  v_hotel_id uuid;
  v_assignment_id uuid;
  v_partner_id uuid;
  v_reviewed_at timestamptz;
  v_expected_version bigint;
  v_capabilities jsonb;
  v_has_mutation boolean;
  v_any_capability boolean;
  v_request_hash text;
  v_receipt_count integer;
  v_receipt public.hotel_partner_action_receipts%rowtype;
  v_hotel public.hotels%rowtype;
  v_partner public.partners%rowtype;
  v_permission public.hotel_partner_hotel_permissions%rowtype;
  v_permission_exists boolean;
  v_before_permission jsonb;
  v_after_permission jsonb;
  v_snapshot jsonb;
  v_receipt_result jsonb;
  v_result jsonb;
  v_changed boolean := false;
  v_receipt_id uuid := gen_random_uuid();
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_plan is null
     or jsonb_typeof(p_plan) <> 'object'
     or p_correlation_id is null
     or p_idempotency_key is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan, array[
       'contract_version','decision','hotel_id','assignment_id','partner_id',
       'reviewed_at','snapshot_token','expected_assignment_fingerprint',
       'expected_permission_version','capabilities'
     ])
     or not (p_plan ?& array[
       'contract_version','decision','hotel_id','assignment_id','partner_id',
       'reviewed_at','snapshot_token','expected_assignment_fingerprint',
       'expected_permission_version','capabilities'
     ])
     or p_plan->>'contract_version' is distinct from c_contract
     or p_plan->>'decision' is distinct from c_decision
     or jsonb_typeof(p_plan->'hotel_id') <> 'string'
     or jsonb_typeof(p_plan->'assignment_id') <> 'string'
     or jsonb_typeof(p_plan->'partner_id') <> 'string'
     or jsonb_typeof(p_plan->'reviewed_at') <> 'string'
     or jsonb_typeof(p_plan->'snapshot_token') <> 'string'
     or p_plan->>'snapshot_token' !~ '^[0-9a-f]{32}$'
     or jsonb_typeof(p_plan->'expected_assignment_fingerprint') <> 'string'
     or p_plan->>'expected_assignment_fingerprint' !~ '^[0-9a-f]{32}$'
     or jsonb_typeof(p_plan->'expected_permission_version') <> 'number'
     or p_plan->>'expected_permission_version' !~ '^[0-9]+$'
     or not public.hotel_v2_h3_2a_capabilities_are_exact(p_plan->'capabilities') then
    raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_permission_plan';
  end if;

  begin
    v_hotel_id := (p_plan->>'hotel_id')::uuid;
    v_assignment_id := (p_plan->>'assignment_id')::uuid;
    v_partner_id := (p_plan->>'partner_id')::uuid;
    v_reviewed_at := (p_plan->>'reviewed_at')::timestamptz;
    v_expected_version := (p_plan->>'expected_permission_version')::bigint;
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_permission_plan';
  end;

  if v_hotel_id is null
     or v_assignment_id is null
     or v_partner_id is null
     or v_reviewed_at is null
     or v_expected_version < 0 then
    raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_permission_plan';
  end if;

  v_capabilities := p_plan->'capabilities';
  v_has_mutation :=
    (v_capabilities->>'edit_property_content')::boolean
    or (v_capabilities->>'edit_property_photos')::boolean
    or (v_capabilities->>'edit_room_content')::boolean
    or (v_capabilities->>'edit_room_photos')::boolean
    or (v_capabilities->>'create_rooms')::boolean
    or (v_capabilities->>'edit_room_structure')::boolean
    or (v_capabilities->>'manage_prices')::boolean
    or (v_capabilities->>'manage_availability')::boolean
    or (v_capabilities->>'process_bookings')::boolean
    or (v_capabilities->>'request_booking_changes')::boolean
    or (v_capabilities->>'initiate_stripe_onboarding')::boolean;
  v_any_capability := v_has_mutation or (v_capabilities->>'view_payment_status')::boolean;
  v_request_hash := encode(extensions.digest(convert_to(p_plan::text, 'UTF8'), 'sha256'), 'hex');

  -- Serialize the small Admin permission receipt ledger so a concurrent retry
  -- cannot race either the idempotency or correlation uniqueness contract.
  lock table public.hotel_partner_action_receipts in share row exclusive mode;

  select count(distinct receipt.id) into v_receipt_count
  from public.hotel_partner_action_receipts receipt
  where receipt.partner_id = v_partner_id
    and receipt.action = c_action
    and (receipt.idempotency_key = p_idempotency_key
      or receipt.correlation_id = p_correlation_id);

  if v_receipt_count > 1 then
    raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_correlation_reused';
  end if;

  select receipt.* into v_receipt
  from public.hotel_partner_action_receipts receipt
  where receipt.partner_id = v_partner_id
    and receipt.action = c_action
    and (receipt.idempotency_key = p_idempotency_key
      or receipt.correlation_id = p_correlation_id)
  order by (receipt.idempotency_key = p_idempotency_key) desc
  limit 1;

  if found then
    if v_receipt.request_hash is distinct from v_request_hash then
      if v_receipt.idempotency_key = p_idempotency_key then
        raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_idempotency_key_reused';
      end if;
      raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_correlation_reused';
    end if;
    return v_receipt.result || jsonb_build_object(
      'replayed', true,
      'snapshot', public.hotel_v2_admin_get_partner_hotel_permissions(v_receipt.hotel_id)
    );
  end if;

  if v_reviewed_at < clock_timestamp() - interval '30 minutes'
     or v_reviewed_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_permission_plan';
  end if;

  select * into v_hotel from public.hotels where id = v_hotel_id for update;
  if not found then
    raise exception using errcode = 'PT404', message = 'hotels_v2_h3_2a_property_not_found';
  end if;

  if exists (
    select 1 from public.site_settings setting
    where setting.id <> 1
       or setting.hotel_rooms_v2_enabled
       or setting.hotel_external_sync_enabled
       or setting.hotel_instant_booking_enabled
       or setting.hotel_stripe_connect_enabled
  ) or (select count(*) from public.site_settings) <> 1 then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  perform 1
  from public.partner_resources assignment
  where assignment.resource_type = 'hotels'
    and assignment.resource_id = v_hotel_id
  for share;

  if p_plan->>'expected_assignment_fingerprint' is distinct from
       public.hotel_v2_h3_2a_assignment_fingerprint(v_hotel_id)
     or p_plan->>'snapshot_token' is distinct from
       public.hotel_v2_h3_2a_snapshot_token(v_hotel_id) then
    raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_stale_partner_permissions';
  end if;

  select partner.* into v_partner
  from public.partner_resources assignment
  join public.partners partner on partner.id = assignment.partner_id
  where assignment.id = v_assignment_id
    and assignment.partner_id = v_partner_id
    and assignment.resource_type = 'hotels'
    and assignment.resource_id = v_hotel_id;
  if not found then
    raise exception using errcode = 'PT404', message = 'hotels_v2_h3_2a_assignment_not_found';
  end if;

  if v_any_capability
     and (v_partner.status is distinct from 'active' or not v_partner.can_manage_hotels) then
    raise exception using errcode = '23514', message = 'hotels_v2_h3_2a_partner_not_eligible';
  end if;

  select * into v_permission
  from public.hotel_partner_hotel_permissions permission
  where permission.assignment_id = v_assignment_id
  for update;
  v_permission_exists := found;

  if (v_permission_exists and v_expected_version <> v_permission.version)
     or (not v_permission_exists and v_expected_version <> 0) then
    raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_stale_partner_permissions';
  end if;

  if v_has_mutation and exists (
    select 1
    from public.hotel_partner_hotel_permissions permission
    where permission.hotel_id = v_hotel_id
      and permission.assignment_id <> v_assignment_id
      and permission.has_mutation_capability
  ) then
    raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_mutating_assignment_conflict';
  end if;

  v_before_permission := public.hotel_v2_h3_2a_permissions_snapshot(v_assignment_id);

  if v_permission_exists then
    if v_before_permission->'capabilities' is distinct from v_capabilities then
      update public.hotel_partner_hotel_permissions permission set
        edit_property_content = (v_capabilities->>'edit_property_content')::boolean,
        edit_property_photos = (v_capabilities->>'edit_property_photos')::boolean,
        edit_room_content = (v_capabilities->>'edit_room_content')::boolean,
        edit_room_photos = (v_capabilities->>'edit_room_photos')::boolean,
        create_rooms = (v_capabilities->>'create_rooms')::boolean,
        edit_room_structure = (v_capabilities->>'edit_room_structure')::boolean,
        manage_prices = (v_capabilities->>'manage_prices')::boolean,
        manage_availability = (v_capabilities->>'manage_availability')::boolean,
        process_bookings = (v_capabilities->>'process_bookings')::boolean,
        request_booking_changes = (v_capabilities->>'request_booking_changes')::boolean,
        view_payment_status = (v_capabilities->>'view_payment_status')::boolean,
        initiate_stripe_onboarding = (v_capabilities->>'initiate_stripe_onboarding')::boolean,
        updated_by = auth.uid()
      where permission.assignment_id = v_assignment_id;
      v_changed := true;
    end if;
  elsif v_any_capability then
    begin
      insert into public.hotel_partner_hotel_permissions(
        assignment_id, partner_id, hotel_id,
        edit_property_content, edit_property_photos,
        edit_room_content, edit_room_photos, create_rooms, edit_room_structure,
        manage_prices, manage_availability, process_bookings,
        request_booking_changes, view_payment_status, initiate_stripe_onboarding,
        created_by, updated_by
      ) values (
        v_assignment_id, v_partner_id, v_hotel_id,
        (v_capabilities->>'edit_property_content')::boolean,
        (v_capabilities->>'edit_property_photos')::boolean,
        (v_capabilities->>'edit_room_content')::boolean,
        (v_capabilities->>'edit_room_photos')::boolean,
        (v_capabilities->>'create_rooms')::boolean,
        (v_capabilities->>'edit_room_structure')::boolean,
        (v_capabilities->>'manage_prices')::boolean,
        (v_capabilities->>'manage_availability')::boolean,
        (v_capabilities->>'process_bookings')::boolean,
        (v_capabilities->>'request_booking_changes')::boolean,
        (v_capabilities->>'view_payment_status')::boolean,
        (v_capabilities->>'initiate_stripe_onboarding')::boolean,
        auth.uid(), auth.uid()
      );
    exception when unique_violation then
      raise exception using errcode = 'PT409', message = 'hotels_v2_h3_2a_mutating_assignment_conflict';
    end;
    v_changed := true;
  end if;

  v_after_permission := public.hotel_v2_h3_2a_permissions_snapshot(v_assignment_id);

  if v_changed then
    insert into public.hotel_activity_log(
      hotel_id, entity_type, entity_id, action,
      before_state, after_state, actor_type, actor_id, source, correlation_id
    ) values (
      v_hotel_id, 'property', v_hotel_id, 'update',
      jsonb_build_object('partner_permissions', v_before_permission, 'assignment_id', v_assignment_id, 'partner_id', v_partner_id),
      jsonb_build_object('partner_permissions', v_after_permission, 'assignment_id', v_assignment_id, 'partner_id', v_partner_id),
      'admin', auth.uid(), 'hotels_v2_h3_2a_partner_permissions', p_correlation_id
    );
  end if;

  v_snapshot := public.hotel_v2_admin_get_partner_hotel_permissions(v_hotel_id);
  -- The immutable receipt stores only a compact, PII-free stable result. The
  -- fresh Admin snapshot (which deliberately contains a snapshot_token) is
  -- composed only for the RPC response and is never persisted in the ledger.
  v_receipt_result := jsonb_build_object(
    'ok', true,
    'contract_version', c_contract,
    'decision', c_decision,
    'hotel_id', v_hotel_id,
    'assignment_id', v_assignment_id,
    'partner_id', v_partner_id,
    'changed', v_changed,
    'permission', v_after_permission,
    'correlation_id', p_correlation_id,
    'idempotency_key', p_idempotency_key
  );
  v_result := v_receipt_result || jsonb_build_object(
    'replayed', false,
    'snapshot', v_snapshot
  );

  if v_changed then
    insert into public.hotel_partner_event_outbox(
      partner_id, hotel_id, aggregate_type, aggregate_id,
      event_type, dedupe_key, payload
    ) values (
      v_partner_id, v_hotel_id, 'hotel_partner_permissions', v_assignment_id,
      'hotel.partner_permissions.updated',
      'h3_2a:permission:' || v_receipt_id::text,
      jsonb_build_object(
        'hotel_id', v_hotel_id,
        'assignment_id', v_assignment_id,
        'partner_id', v_partner_id,
        'permission_version', (v_after_permission->>'version')::bigint,
        'has_mutation_capability', (v_after_permission->>'has_mutation_capability')::boolean,
        'correlation_id', p_correlation_id
      )
    );
  end if;

  insert into public.hotel_partner_action_receipts(
    id, partner_id, hotel_id, actor_user_id, action,
    idempotency_key, request_hash, correlation_id, result
  ) values (
    v_receipt_id, v_partner_id, v_hotel_id, auth.uid(), c_action,
    p_idempotency_key, v_request_hash, p_correlation_id, v_receipt_result
  );

  return v_result;
end
$function$;

create or replace function public.hotel_v2_admin_apply_pricing_control_plan(
  p_plan jsonb,
  p_correlation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_plan constant text:='hotels_v2_admin_c_pricing_plan_v1';
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_actor uuid; v_hotel_id uuid; v_reviewed_at timestamptz;
  v_request_hash text; v_receipt public.hotel_admin_pricing_action_receipts%rowtype;
  v_control jsonb; v_operation jsonb; v_payload jsonb; v_original jsonb;
  v_entity text; v_action text; v_id uuid; v_expected_version bigint;
  v_lifecycle text; v_target_active boolean; v_target_review text;
  v_before jsonb; v_after jsonb; v_activity jsonb:='[]'::jsonb;
  v_changed boolean:=false; v_entity_changed boolean; v_child jsonb;
  v_plan_row public.hotel_rate_plans%rowtype;
  v_rate_row public.hotel_room_rates%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_rule_row public.hotel_rate_rules%rowtype;
  v_override public.hotel_calendar_overrides%rowtype;
  v_allocation public.hotel_room_allocation_rules%rowtype;
  v_child_current jsonb; v_child_target jsonb; v_result jsonb;
  v_inclusions text[]; v_weekdays smallint[]; v_allocated smallint[]; v_pricing smallint[];
  v_clone_operation jsonb; v_relink_operation jsonb; v_clone_source uuid; v_clone_target uuid;
  v_old_schedule uuid; v_new_schedule uuid; v_link_ids jsonb; v_count integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  v_actor:=auth.uid();
  if v_actor is null or not public.hotel_v2_admin_c_uuid_is_canonical(v_actor::text)
     or p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or p_idempotency_key is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or not (p_plan ?& array['contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or p_plan->>'contract_version'<>c_plan
     or octet_length(convert_to(p_plan::text,'UTF8'))>5242880
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_plan)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_plan)
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'snapshot_token')<>'string'
     or p_plan->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(
       p_plan->>'reviewed_at')
     or jsonb_typeof(p_plan->'operations')<>'array'
     or jsonb_array_length(p_plan->'operations') not between 1 and 100
     or length(p_idempotency_key) not between 8 and 120
     or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_plan';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_plan_identifiers';
  end;
  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'plan',p_plan,'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex');
  -- Serialize both same actor/key replays and global correlation identity
  -- before the first receipt lookup. A concurrent identical request therefore
  -- deterministically replays instead of surfacing a raw unique violation.
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-correlation:'||p_correlation_id::text,0));
  select * into v_receipt from public.hotel_admin_pricing_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_receipt.request_hash<>v_request_hash or v_receipt.correlation_id<>p_correlation_id
       or v_receipt.hotel_id<>v_hotel_id then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_idempotency_conflict';
    end if;
    return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_pricing_action_receipts
    where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_correlation_conflict';
  end if;
  -- Freshness is a new-request gate, not a replay gate. An exact retry must
  -- remain deterministic for the lifetime of its immutable receipt.
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_pricing_review_expired';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_public_activation_guard';
  end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found'; end if;
  if v_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  perform 1 from public.hotel_room_types where hotel_id=v_hotel_id order by id for share;
  perform 1 from public.hotel_property_pricing_defaults
    where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_plans where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_rates where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.id=tier.schedule_id and schedule.hotel_id=v_hotel_id) order by tier.id for update;
  perform 1 from public.hotel_room_rate_occupancy_tiers where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_rules rule where exists(select 1 from public.hotel_room_rates rate
    where rate.id=rule.room_rate_id and rate.hotel_id=v_hotel_id) order by rule.id for update;
  perform 1 from public.hotel_calendar_overrides where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rule_items where hotel_id=v_hotel_id order by id for update;

  if exists(select 1 from jsonb_array_elements(p_plan->'operations') operation
      group by operation.value->>'entity',operation.value->>'id' having count(*)>1) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_duplicate_operation_target';
  end if;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel_id);
  if v_control->>'snapshot_token' is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_pricing_snapshot',
      detail=jsonb_build_object('current_snapshot_token',v_control->>'snapshot_token',
        'changed_entities',jsonb_build_array('pricing_graph'))::text;
  end if;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard deferred;

  -- Bind the only allowed direct schedule A->B transition: one exact clone
  -- followed by one same-product relink in this two-operation transaction.
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if v_operation->>'entity'='pricing_schedule' and v_operation->>'action'='clone' then
      if v_clone_operation is not null then
        raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_clone_operations';
      end if;
      v_clone_operation:=v_operation;
    elsif v_operation->>'entity'='room_rate' and v_operation->>'action'='update' then
      begin
        v_old_schedule:=nullif(v_operation#>>'{expected_original,pricing_schedule_id}','')::uuid;
        v_new_schedule:=nullif(v_operation#>>'{payload,pricing_schedule_id}','')::uuid;
      exception when others then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_link';
      end;
      if v_old_schedule is not null and v_new_schedule is not null
         and v_old_schedule<>v_new_schedule then
        if v_relink_operation is not null then
          raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_relink_operations';
        end if;
        v_relink_operation:=v_operation;
      end if;
    end if;
  end loop;
  if v_relink_operation is not null then
    if v_clone_operation is null or jsonb_array_length(p_plan->'operations')<>2
       or p_plan#>>'{operations,0,entity}'<>'pricing_schedule'
       or p_plan#>>'{operations,0,action}'<>'clone'
       or p_plan#>>'{operations,1,entity}'<>'room_rate'
       or p_plan#>>'{operations,1,action}'<>'update'
       or (v_clone_operation->>'id')::uuid<>(v_relink_operation#>>'{payload,pricing_schedule_id}')::uuid
       or (v_clone_operation#>>'{payload,source_schedule_id}')::uuid<>
          (v_relink_operation#>>'{expected_original,pricing_schedule_id}')::uuid
       or v_clone_operation#>>'{payload,sharing_mode}'<>'independent'
       or v_clone_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation#>>'{payload,lifecycle_status}' not in('draft','inactive') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_clone_relink_pair';
    end if;
  elsif v_clone_operation is not null and jsonb_array_length(p_plan->'operations')>1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_clone_must_be_single_or_exact_pair';
  end if;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if jsonb_typeof(v_operation)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_operation,array[
         'entity','action','id','expected_version','expected_children_fingerprint',
         'expected_link_fingerprint','expected_linked_room_rate_ids',
         'shared_impact_acknowledged','activation_acknowledged','expected_original','payload'])
       or not (v_operation ?& array['entity','action','id','expected_version',
         'expected_children_fingerprint','expected_link_fingerprint',
         'expected_linked_room_rate_ids','shared_impact_acknowledged',
         'activation_acknowledged','expected_original','payload'])
       or jsonb_typeof(v_operation->'entity')<>'string'
       or jsonb_typeof(v_operation->'action')<>'string'
       or jsonb_typeof(v_operation->'id')<>'string'
       or jsonb_typeof(v_operation->'expected_version')<>'number'
       or v_operation->>'expected_version'!~'^[0-9]+$'
       or jsonb_typeof(v_operation->'expected_children_fingerprint') not in('string','null')
       or jsonb_typeof(v_operation->'expected_link_fingerprint') not in('string','null')
       or (jsonb_typeof(v_operation->'expected_children_fingerprint')='string'
         and v_operation->>'expected_children_fingerprint'!~'^[0-9a-f]{32}$')
       or (jsonb_typeof(v_operation->'expected_link_fingerprint')='string'
         and v_operation->>'expected_link_fingerprint'!~'^[0-9a-f]{32}$')
       or jsonb_typeof(v_operation->'expected_linked_room_rate_ids')<>'array'
       or jsonb_array_length(v_operation->'expected_linked_room_rate_ids')>1000
       or exists(select 1 from jsonb_array_elements(v_operation->'expected_linked_room_rate_ids') link
         where jsonb_typeof(link)<>'string')
       or (select count(*) from jsonb_array_elements_text(
         v_operation->'expected_linked_room_rate_ids'))<>
         (select count(distinct link) from jsonb_array_elements_text(
           v_operation->'expected_linked_room_rate_ids') link)
       or jsonb_typeof(v_operation->'shared_impact_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'activation_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'expected_original')<>'object'
       or jsonb_typeof(v_operation->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_envelope';
    end if;
    begin
      v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action';
      v_id:=(v_operation->>'id')::uuid;
      v_expected_version:=(v_operation->>'expected_version')::bigint;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_identifiers';
    end;
    if v_entity not in('property_pricing_default','rate_plan','room_rate','pricing_schedule','room_rate_tier_set',
         'rate_rule','exact_date_price','allocation_rule')
       or v_action not in('create','update','clone','disable')
       or (v_action='clone' and v_entity<>'pricing_schedule')
       or (v_entity='room_rate_tier_set' and v_action<>'update')
       or (v_action in('create','clone') and v_expected_version<>0)
       or (v_action not in('create','clone') and v_expected_version<1)
       or (v_action='disable' and v_operation->'payload'<>'{}'::jsonb)
       or (v_action in('create','clone')
         and v_operation->'expected_original'<>'{}'::jsonb) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_contract';
    end if;
    v_payload:=v_operation->'payload'; v_original:=v_operation->'expected_original';
    v_entity_changed:=false;

    v_after:=public.hotel_v2_admin_c_apply_operation(
      v_hotel_id,v_operation,p_correlation_id,v_actor);
    v_entity_changed:=coalesce((v_after->>'changed')::boolean,false);
    if jsonb_typeof(v_after->'activity')='object' then
      v_activity:=v_activity||jsonb_build_array(v_after->'activity');
    end if;
    v_changed:=v_changed or v_entity_changed;
  end loop;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard immediate;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel_id);
  v_result:=jsonb_build_object('contract_version',c_plan,'hotel_id',v_hotel_id,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'replayed',false,'changed',v_changed,'activity',v_activity,
    'pricing_control',v_control);
  insert into public.hotel_admin_pricing_action_receipts(
    hotel_id,actor_id,idempotency_key,correlation_id,request_hash,result)
  values(v_hotel_id,v_actor,p_idempotency_key,p_correlation_id,v_request_hash,v_result);
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_value';
end
$function$;

create or replace function public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public
as $function$
declare
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_hotel public.hotels%rowtype;
  v_flags jsonb;
  v_property jsonb;
  v_default jsonb;
  v_plans jsonb;
  v_rooms jsonb;
  v_rates jsonb;
  v_schedules jsonb;
  v_rules jsonb;
  v_exact jsonb;
  v_allocations jsonb;
  v_legacy jsonb;
  v_token_source jsonb;
  v_token text;
  v_recent jsonb;
  v_result jsonb;
begin
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found';
  end if;
  perform public.hotel_v2_admin_c_enforce_graph_limits(p_hotel_id);
  select jsonb_build_object(
    'hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled',setting.hotel_external_sync_enabled,
    'hotel_instant_booking_enabled',setting.hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled
  ) into v_flags from public.site_settings setting where setting.id=1;
  if v_flags is null then
    raise exception using errcode='55000',message='hotels_v2_admin_c_site_settings_missing';
  end if;

  v_property:=jsonb_build_object(
    'id',v_hotel.id,'updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
    'booking_mode',v_hotel.booking_mode,
    'maximum_stay_nights',(select profile.maximum_stay_nights
      from public.hotel_property_operational_profiles profile where profile.hotel_id=v_hotel.id),
    'children_policy',v_hotel.children_policy,
    'minimum_child_age',v_hotel.minimum_child_age
  );

  select jsonb_build_object(
    'id',default_price.id,'hotel_id',default_price.hotel_id,
    'nightly_rate',default_price.nightly_rate,'currency',default_price.currency,
    'is_active',default_price.is_active,'review_status',default_price.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      default_price.is_active,default_price.review_status),
    'version',default_price.version,'updated_at',default_price.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      default_price.hotel_id,'property_pricing_default',default_price.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when default_price.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when default_price.nightly_rate<=0 then 'positive_nightly_rate_required' end,
      case when v_hotel.minimum_stay_nights is null then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(default_price.hotel_id,
        'property_pricing_default',default_price.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) into v_default
  from public.hotel_property_pricing_defaults default_price
  where default_price.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',plan.id,'hotel_id',plan.hotel_id,'code',plan.code,
    'name_i18n',plan.name_i18n,'description_i18n',plan.description_i18n,
    'meal_plan_code',plan.meal_plan_code,'cancellation_policy',plan.cancellation_policy,
    'booking_mode_override',plan.booking_mode_override,
    'price_inclusions',to_jsonb(plan.price_inclusions),'is_active',plan.is_active,
    'review_status',plan.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(plan.is_active,plan.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',plan.sort_order,'version',plan.version,'updated_at',plan.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      plan.hotel_id,'rate_plan',plan.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.description_i18n,true,5000,true)
        then 'localized_description_incomplete' end,
      case when not public.hotel_v2_admin_c_cancellation_policy_is_valid(
        plan.cancellation_policy) then 'cancellation_policy_invalid' end,
      case when plan.cancellation_policy->>'type'='requires_review'
        then 'cancellation_policy_requires_review' end,
      case when not exists(select 1 from public.hotel_room_rates linked
        where linked.rate_plan_id=plan.id and linked.review_status='reviewed')
        then 'reviewed_room_rate_required' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by plan.sort_order,plan.code,plan.id),'[]'::jsonb)
  into v_plans from public.hotel_rate_plans plan where plan.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room_type.id,'hotel_id',room_type.hotel_id,'code',room_type.code,
    'name_i18n',room_type.name_i18n,'status',room_type.status,
    'max_occupancy',room_type.max_occupancy,'capacity_adults',room_type.capacity_adults,
    'capacity_children',room_type.capacity_children,
    'children_policy_override',room_type.children_policy_override,
    'minimum_child_age_override',room_type.minimum_child_age_override,
    'inventory_mode',room_type.inventory_mode,
    'base_inventory_count',room_type.base_inventory_count,
    'active_unit_count',(select count(*) from public.hotel_units unit_row
      where unit_row.room_type_id=room_type.id and unit_row.status='active'),
    'version',room_type.version,
    'updated_at',room_type.updated_at
  ) order by room_type.sort_order,room_type.code,room_type.id),'[]'::jsonb)
  into v_rooms from public.hotel_room_types room_type where room_type.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rate.id,'hotel_id',rate.hotel_id,'room_type_id',rate.room_type_id,
    'rate_plan_id',rate.rate_plan_id,'pricing_schedule_id',rate.pricing_schedule_id,
    'base_nightly_rate',rate.base_nightly_rate,'currency',rate.currency,
    'external_redirect_url',rate.external_redirect_url,'is_active',rate.is_active,
    'review_status',rate.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(rate.is_active,rate.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      rate.hotel_id,'room_rate',rate.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at,
    'pricing_source',case when rate.pricing_schedule_id is not null then 'pricing_schedule'
      when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active) then 'independent_tiers'
      when rate.base_nightly_rate>0 then 'base_nightly_rate'
      when exists(select 1 from public.hotel_property_pricing_defaults default_price
        where default_price.hotel_id=rate.hotel_id and default_price.is_active
          and default_price.review_status='reviewed' and default_price.nightly_rate>0
          and default_price.currency=rate.currency) then 'property_default'
      else 'missing' end,
    'base_nightly_rate_authoritative',rate.base_nightly_rate>0
      and rate.pricing_schedule_id is null and not exists(
      select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id and tier.is_active),
    'independent_tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'source',tier.source,
      'immutable_contract',case when tier.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id),'[]'::jsonb),
    'independent_tiers_fingerprint',public.hotel_v2_admin_c_room_tiers_fingerprint(rate.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      rate.hotel_id,'room_rate',rate.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when (select status from public.hotel_room_types where id=rate.room_type_id)<>'active'
        then 'room_type_not_active' end,
      case when coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id)) is null
        or coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id))<=0
        then 'room_capacity_missing' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_rate_plans plan
        where plan.id=rate.rate_plan_id and plan.is_active and plan.review_status='reviewed')
        then 'rate_plan_not_active' end,
      case when rate.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when coalesce((select plan.booking_mode_override
          from public.hotel_rate_plans plan where plan.id=rate.rate_plan_id),
          v_hotel.booking_mode)='external_redirect' and (
          not public.hotel_v2_admin_c_https_url_is_valid(rate.external_redirect_url))
        then 'external_redirect_url_required' end,
      case when rate.pricing_schedule_id is not null and not exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and schedule.is_active
          and schedule.review_status='reviewed'
          and schedule.application_scope='room_occupancy'
          and schedule.currency=rate.currency) then 'pricing_schedule_not_ready' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active)
        then 'conflicting_independent_tiers' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and (
          v_hotel.minimum_stay_nights is null or exists(
            select 1 from generate_series(schedule.minimum_billable_occupancy::integer,
              least(schedule.maximum_party_size,coalesce((select room_type.max_occupancy
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
                (select room_type.capacity_adults+room_type.capacity_children
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id)))::integer) guest_count
            where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
              where tier.schedule_id=schedule.id and tier.is_active
                and tier.guest_count=guest_count
                and tier.threshold_nights<=v_hotel.minimum_stay_nights))))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id
          and schedule.minimum_billable_occupancy>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id)))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null
        and exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and (v_hotel.minimum_stay_nights is null or exists(
          select 1 from generate_series((select min(tier.guest_count)::integer
              from public.hotel_room_rate_occupancy_tiers tier
              where tier.room_rate_id=rate.id and tier.is_active),
            coalesce((select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),(select room_type.capacity_adults+
              room_type.capacity_children from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))) guest_count
          where not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
            where tier.room_rate_id=rate.id and tier.is_active
              and tier.guest_count=guest_count
              and tier.threshold_nights<=v_hotel.minimum_stay_nights)))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is null
        and (select min(tier.guest_count) from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null and rate.base_nightly_rate<=0
        and not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and not exists(select 1 from public.hotel_property_pricing_defaults default_price
          where default_price.hotel_id=rate.hotel_id and default_price.is_active
            and default_price.review_status='reviewed' and default_price.nightly_rate>0
            and default_price.currency=rate.currency)
        then 'pricing_source_required' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        rate.hotel_id,'room_rate',rate.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by rate.sort_order,rate.id),'[]'::jsonb)
  into v_rates from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',schedule.id,'hotel_id',schedule.hotel_id,'code',schedule.code,
    'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
    'currency',schedule.currency,'maximum_party_size',schedule.maximum_party_size,
    'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
    'is_active',schedule.is_active,'review_status',schedule.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      schedule.is_active,schedule.review_status),
    'source',schedule.source,'source_reference',
      public.hotel_v2_admin_c_schedule_source_summary(
        schedule.source,schedule.source_reference),
    'sharing_mode',schedule.sharing_mode,'version',schedule.version,
    'updated_at',schedule.updated_at,
    'linked_room_rate_ids',coalesce((select jsonb_agg(rate.id order by rate.id)
      from public.hotel_room_rates rate where rate.pricing_schedule_id=schedule.id),'[]'::jsonb),
    'link_fingerprint',public.hotel_v2_admin_c_schedule_link_fingerprint(schedule.id),
    'tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'schedule_id',tier.schedule_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=schedule.id),'[]'::jsonb),
    'tiers_fingerprint',public.hotel_v2_admin_c_schedule_tiers_fingerprint(schedule.id),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      schedule.hotel_id,'pricing_schedule',schedule.id),case
        when schedule.source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(schedule.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when schedule.application_scope<>'room_occupancy'
        then 'property_party_reference_only' end,
      case when schedule.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=schedule.id and tier.is_active) then 'active_tier_required' end,
      case when schedule.sharing_mode='independent' and
        (select count(*) from public.hotel_room_rates rate
         where rate.pricing_schedule_id=schedule.id)>1
        then 'independent_schedule_multiple_links' end,
      case when exists(select 1 from generate_series(
        schedule.minimum_billable_occupancy::integer,schedule.maximum_party_size::integer) guest_count
        where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
          where tier.schedule_id=schedule.id and tier.is_active
            and tier.guest_count=guest_count
            and tier.threshold_nights<=v_hotel.minimum_stay_nights))
        then 'occupancy_los_coverage_incomplete' end,
      case when schedule.source<>'manual' then 'nonmanual_source_read_only' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        schedule.hotel_id,'pricing_schedule',schedule.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by schedule.code,schedule.id),'[]'::jsonb)
  into v_schedules from public.hotel_pricing_schedules schedule
  where schedule.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rule.id,'hotel_id',rate.hotel_id,'room_rate_id',rule.room_rate_id,
    'valid_from',rule.valid_from,'valid_to',rule.valid_to,
    'weekdays',to_jsonb(rule.weekdays),'nightly_rate',rule.nightly_rate,
    'minimum_stay',rule.minimum_stay,'maximum_stay',rule.maximum_stay,
    'closed_to_arrival',rule.closed_to_arrival,
    'closed_to_departure',rule.closed_to_departure,'priority',rule.priority,
    'is_active',rule.is_active,'source',rule.source,'version',rule.version,
    'updated_at',rule.updated_at,'immutable_contract',coalesce(
      public.hotel_v2_admin_c_immutable_contract(rate.hotel_id,'room_rate',rate.id),
      case when rule.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end)
  ) order by rule.valid_from,rule.valid_to,rule.priority desc,rule.id),'[]'::jsonb)
  into v_rules from public.hotel_rate_rules rule
  join public.hotel_room_rates rate on rate.id=rule.room_rate_id
  where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',override_row.id,'hotel_id',override_row.hotel_id,
    'room_rate_id',override_row.room_rate_id,'stay_date',override_row.stay_date,
    'nightly_rate_mode',override_row.nightly_rate_mode,
    'nightly_rate',override_row.nightly_rate,
    'minimum_stay_mode',override_row.minimum_stay_mode,
    'minimum_stay',override_row.minimum_stay,
    'maximum_stay_mode',override_row.maximum_stay_mode,
    'maximum_stay',override_row.maximum_stay,
    'pricing_active',((override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null) and case
        when override_row.pricing_source is null then override_row.is_active
          and (override_row.expires_at is null
            or override_row.expires_at>statement_timestamp())
        else override_row.pricing_expires_at is null
          or override_row.pricing_expires_at>statement_timestamp() end),
    'pricing_source',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.source else override_row.pricing_source end,
    'pricing_reason',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then case when override_row.reason=btrim(override_row.reason)
          and length(override_row.reason) between 1 and 500
          and override_row.reason!~'[[:cntrl:]]' then override_row.reason
        else 'Legacy pricing override (read-only; original reason retained server-side)' end
      else override_row.pricing_reason end,
    'pricing_expires_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.expires_at else override_row.pricing_expires_at end,
    'pricing_actor_type',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_type else override_row.pricing_actor_type end,
    'pricing_actor_id',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_id else override_row.pricing_actor_id end,
    'pricing_updated_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.updated_at else override_row.pricing_updated_at end,
    'pricing_correlation_id',override_row.pricing_correlation_id,
    'shared_with_calendar',(override_row.closed_mode is not null
      or override_row.closed_to_arrival_mode is not null
      or override_row.closed_to_departure_mode is not null),
    'pricing_configured',(override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      override_row.hotel_id,'exact_date_price',override_row.id),case
        when override_row.pricing_source is null and (
          override_row.nightly_rate_mode is not null
          or override_row.minimum_stay_mode is not null
          or override_row.maximum_stay_mode is not null) then jsonb_build_object(
            'locked',true,'contract_version','pre_admin_c_calendar_pricing_v1',
            'reason','legacy_exact_pricing_read_only')
        when override_row.pricing_source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'version',override_row.version,'updated_at',override_row.updated_at
  ) order by override_row.stay_date,override_row.room_rate_id,override_row.id),'[]'::jsonb)
  into v_exact from public.hotel_calendar_overrides override_row
  where override_row.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',allocation.id,'hotel_id',allocation.hotel_id,'code',allocation.code,
    'allocation_mode',allocation.allocation_mode,
    'min_guest_count',allocation.min_guest_count,
    'max_guest_count',allocation.max_guest_count,
    'is_active',allocation.is_active,'review_status',allocation.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      allocation.is_active,allocation.review_status),
    'sort_order',allocation.sort_order,'version',allocation.version,
    'updated_at',allocation.updated_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',item.id,'hotel_id',item.hotel_id,
      'allocation_rule_id',item.allocation_rule_id,'room_type_id',item.room_type_id,
      'units_required',item.units_required,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'allocated_guest_counts',to_jsonb(item.allocated_guest_counts),
      'pricing_guest_counts',to_jsonb(item.pricing_guest_counts),
      'sort_order',item.sort_order,'version',item.version
    ) order by item.sort_order,item.id) from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=allocation.id),'[]'::jsonb),
    'items_fingerprint',public.hotel_v2_admin_c_allocation_items_fingerprint(allocation.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      allocation.hotel_id,'allocation_rule',allocation.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when allocation.review_status<>'reviewed'
        then 'allocation_not_reviewed' end,
      case when not exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id) then 'allocation_item_required' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and (
            item.units_required<>1 or item.allocated_guest_count is not null
            or item.pricing_guest_count is not null
            or item.allocated_guest_counts is not null
            or item.pricing_guest_counts is not null))
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count is null or item.pricing_guest_count is null
            or (item.units_required>1 and (item.allocated_guest_counts is null
              or item.pricing_guest_counts is null))))))
        then 'allocation_contract_incomplete' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        left join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          room_type.id is null or room_type.hotel_id<>allocation.hotel_id
          or room_type.status<>'active'
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children) is null
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)<=0))
        then 'allocation_room_not_ready' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (room_type.inventory_mode='pooled'
            and item.units_required>room_type.base_inventory_count)
          or (room_type.inventory_mode='unitized' and item.units_required>(
            select count(*) from public.hotel_units unit_row
            where unit_row.room_type_id=room_type.id and unit_row.status='active'))))
        then 'allocation_inventory_insufficient' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and coalesce(
            room_type.max_occupancy,room_type.capacity_adults+
              room_type.capacity_children)<allocation.max_guest_count)
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or item.pricing_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or exists(select 1 from unnest(item.allocated_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))
            or exists(select 1 from unnest(item.pricing_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))))))
        then 'allocation_capacity_exceeded' end,
      case when allocation.allocation_mode='required_bundle' and (
        allocation.min_guest_count<>allocation.max_guest_count
        or coalesce((select sum(item.allocated_guest_count)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<>allocation.min_guest_count
        or coalesce((select sum(item.units_required)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<1)
        then 'bundle_guest_total_mismatch' end,
      case when exists(select 1 from public.hotel_room_allocation_rules other
        where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
          and other.is_active and other.review_status='reviewed'
          and allocation.min_guest_count<=other.max_guest_count
          and other.min_guest_count<=allocation.max_guest_count)
        then 'active_allocation_range_overlap' end,
      case when exists(
        select 1 from generate_series(1,greatest(allocation.max_guest_count::integer,
          coalesce((select max(other.max_guest_count)::integer
            from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'),0))) guest_count
        where (case when guest_count between allocation.min_guest_count
              and allocation.max_guest_count then 1 else 0 end)
          +(select count(*) from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'
              and guest_count between other.min_guest_count and other.max_guest_count)<>1)
        then 'active_allocation_coverage_gap' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        allocation.hotel_id,'allocation_rule',allocation.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by allocation.sort_order,allocation.code,allocation.id),'[]'::jsonb)
  into v_allocations from public.hotel_room_allocation_rules allocation
  where allocation.hotel_id=p_hotel_id;

  v_legacy:=jsonb_build_object(
    'architecture_version',v_hotel.architecture_version,
    'legacy_pricing_authoritative',v_hotel.architecture_version='legacy',
    'legacy_pricing_rule_count',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then jsonb_array_length(v_hotel.pricing_tiers->'rules') else null end,
    'legacy_pricing_fingerprint',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then md5(v_hotel.pricing_tiers::text) else null end,
    'public_change',false
  );
  v_token_source:=jsonb_build_object(
    'property',jsonb_build_object(
      'id',v_hotel.id,'architecture_version',v_hotel.architecture_version,
      'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
      'booking_mode',v_hotel.booking_mode,
      'maximum_stay_nights',v_property->'maximum_stay_nights',
      'children_policy',v_hotel.children_policy,
      'minimum_child_age',v_hotel.minimum_child_age
    ),
    'feature_flags',v_flags,'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'rate_plans',v_plans,
    'room_types',coalesce((select jsonb_agg(
      room.value-'name_i18n'-'code'-'version'-'updated_at' order by room.value->>'id')
      from jsonb_array_elements(v_rooms) room(value)),'[]'::jsonb),
    'room_rates',v_rates,'pricing_schedules',v_schedules,
    'rate_rules',coalesce((select jsonb_agg(
      rule.value-'closed_to_arrival'-'closed_to_departure'-'version'-'updated_at'
      order by rule.value->>'id')
      from jsonb_array_elements(v_rules) rule(value)),'[]'::jsonb),
    'exact_date_prices',coalesce((select jsonb_agg(
      exact.value-'pricing_source'-'pricing_reason'-'pricing_actor_type'
        -'pricing_actor_id'-'pricing_updated_at'-'pricing_correlation_id'
        -'shared_with_calendar'-'version'-'updated_at'
      order by exact.value->>'id') from jsonb_array_elements(v_exact) exact(value)
      where (exact.value->>'pricing_configured')::boolean),'[]'::jsonb),
    'allocation_rules',v_allocations
  );
  v_token:=encode(extensions.digest(convert_to(v_token_source::text,'UTF8'),'sha256'),'hex');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',activity.id,'entity_type',activity.entity_type,
    'entity_id',activity.entity_id,'action',activity.action,
    'correlation_id',activity.correlation_id,'actor_type',activity.actor_type,
    'actor_id',activity.actor_id,
    'source',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.source else 'historical_pricing_activity' end,
    'created_at',activity.created_at,
    'before_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.before_state else null end,
    'after_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.after_state else null end
  ) order by activity.created_at desc,activity.id desc),
    '[]'::jsonb) into v_recent
  from (select id,entity_type,entity_id,action,correlation_id,actor_type,actor_id,
      source,created_at,before_state,after_state
    from public.hotel_activity_log where hotel_id=p_hotel_id
    and entity_type in('property_pricing_default','rate_plan','room_rate','pricing_schedule','occupancy_tier',
      'rate_rule','calendar_override','allocation_rule')
    and action in('create','update','disable','duplicate','delete')
    and actor_type in('admin','partner','sync','system')
    and (actor_id is not null or actor_type in('sync','system'))
    order by created_at desc,id desc limit 100) activity;

  v_result:=jsonb_build_object(
    'contract_version',c_control,'hotel_id',p_hotel_id,
    'property',v_property,'feature_flags',v_flags,'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'snapshot_token',v_token,'rate_plans',v_plans,'room_types',v_rooms,
    'room_rates',v_rates,'pricing_schedules',v_schedules,'rate_rules',v_rules,
    'exact_date_prices',v_exact,'allocation_rules',v_allocations,
    'recent_activity',v_recent
  );
  if octet_length(convert_to(v_result::text,'UTF8'))>20971520 then
    raise exception using errcode='54000',
      message='hotels_v2_admin_c_technical_limit_exceeded',
      detail=jsonb_build_object('snapshot_bytes',
        octet_length(convert_to(v_result::text,'UTF8')),
        'limit',20971520)::text;
  end if;
  return v_result;
end
$function$;


do $hotfix_postcondition$
declare
  v_definition text;
  v_row record;
begin
  for v_row in
    select *
    from hotels_v2_pgcrypto_hotfix_before
    order by signature
  loop
    if to_regprocedure(v_row.signature) is null then
      raise exception using
        errcode='55000',
        message='hotels_v2_pgcrypto_hotfix_function_disappeared';
    end if;

    select pg_get_functiondef(to_regprocedure(v_row.signature))
      into v_definition;

    if strpos(v_definition,'extensions.digest(convert_to')=0
       or strpos(
         replace(
           v_definition,
           'extensions.digest(convert_to',
           ''
         ),
         'digest(convert_to'
       )>0 then
      raise exception using
        errcode='55000',
        message='hotels_v2_pgcrypto_hotfix_digest_postcondition_failed';
    end if;

    if exists(
      select 1
      from pg_proc p
      where p.oid=to_regprocedure(v_row.signature)
        and (
          p.oid<>v_row.oid
          or p.prosecdef is distinct from v_row.prosecdef
          or p.provolatile is distinct from v_row.provolatile
          or p.proconfig is distinct from v_row.proconfig
          or p.proowner is distinct from v_row.proowner
          or p.proacl is distinct from v_row.proacl
        )
    ) then
      raise exception using
        errcode='55000',
        message='hotels_v2_pgcrypto_hotfix_function_metadata_drift';
    end if;
  end loop;
end
$hotfix_postcondition$;

notify pgrst, 'reload schema';
commit;
