begin;
set transaction isolation level repeatable read;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- Production-safe, one-Hotel capability evolution after the deployed H3.2B
-- and Stage 2 foundation (before or after explicit Stage 2F activation). The
-- original ADMIN-D receipt is never
-- changed: this migration proves that baseline, applies one exact audited
-- delta, and appends a new immutable current-baseline receipt.

do $seven_arches_owner_prerequisites$
begin
  if to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_permissions_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_partner_hotel_permissions') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_partner_event_outbox') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_prerequisite_missing';
  end if;
  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is not null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_boundary_mismatch';
  end if;
  if not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings)
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         where receipt.id=setting.id
           and receipt.site_settings_without_external_fingerprint=
             public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
           and receipt.compatibility_function_fingerprints=
             public.hotel_v2_external_calendar_activation_function_fingerprints())) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_deployed_foundation_mismatch';
  end if;
end
$seven_arches_owner_prerequisites$;

create function public.hotel_v2_seven_arches_owner_capabilities()
returns jsonb
language sql
immutable
set search_path=pg_catalog
as $function$
select jsonb_build_object(
  'edit_property_content',true,
  'edit_property_photos',true,
  'edit_room_content',true,
  'edit_room_photos',true,
  'create_rooms',true,
  'edit_room_structure',true,
  'manage_prices',true,
  'manage_availability',true,
  'process_bookings',true,
  'request_booking_changes',false,
  'view_payment_status',true,
  'initiate_stripe_onboarding',false
)
$function$;

create table public.hotel_admin_availability_foundation_evolution_receipts(
  id smallint primary key check(id=1),
  contract_version text not null
    check(contract_version='hotels_v2_admin_d_foundation_evolution_v2'),
  original_foundation_receipt_id smallint not null
    references public.hotel_admin_availability_foundation_receipts(id) on delete restrict,
  original_protected_fingerprint text not null
    check(original_protected_fingerprint~'^[0-9a-f]{64}$'),
  before_current_protected_fingerprints jsonb not null
    check(jsonb_typeof(before_current_protected_fingerprints)='object'),
  before_current_protected_fingerprint text not null
    check(before_current_protected_fingerprint~'^[0-9a-f]{64}$'),
  current_protected_fingerprints jsonb not null
    check(jsonb_typeof(current_protected_fingerprints)='object'),
  current_protected_fingerprint text not null
    check(current_protected_fingerprint~'^[0-9a-f]{64}$'),
  stage2_current_protected_fingerprints jsonb not null
    check(jsonb_typeof(stage2_current_protected_fingerprints)='object'),
  stage2_current_protected_fingerprint text not null
    check(stage2_current_protected_fingerprint~'^[0-9a-f]{64}$'),
  allowed_fingerprint_keys text[] not null check(allowed_fingerprint_keys=array[
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','non_admin_d_activity']::text[]),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  assignment_id uuid not null
    references public.hotel_partner_hotel_permissions(assignment_id) on delete restrict,
  owner_user_id uuid not null,
  permission_version bigint not null check(permission_version=1),
  capabilities jsonb not null
    check(jsonb_typeof(capabilities)='object'),
  before_permission jsonb not null
    check(jsonb_typeof(before_permission)='object'),
  after_permission jsonb not null
    check(jsonb_typeof(after_permission)='object'),
  activity_id uuid not null unique references public.hotel_activity_log(id) on delete restrict,
  action_receipt_id uuid not null unique references public.hotel_partner_action_receipts(id) on delete restrict,
  outbox_id uuid not null unique references public.hotel_partner_event_outbox(id) on delete restrict,
  correlation_id uuid not null unique,
  idempotency_key uuid not null unique,
  request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.hotel_admin_availability_foundation_evolution_receipts
  enable row level security;
revoke all on table public.hotel_admin_availability_foundation_evolution_receipts
  from public,anon,authenticated,service_role;
create trigger hotel_admin_availability_foundation_evolution_immutable
before update or delete on public.hotel_admin_availability_foundation_evolution_receipts
for each row execute function public.hotel_v2_admin_d_immutable_row();

do $seven_arches_owner_apply$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_receipt constant uuid:='37500000-0000-4000-8000-000000000001';
  c_correlation constant uuid:='37500000-0000-4000-8000-000000000002';
  c_idempotency constant uuid:='37500000-0000-4000-8000-000000000003';
  c_activity constant uuid:='37500000-0000-4000-8000-000000000004';
  c_outbox constant uuid:='37500000-0000-4000-8000-000000000005';
  v_lock_sql text;
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_partner_id uuid;
  v_assignment_id uuid;
  v_owner_user_id uuid;
  v_capabilities jsonb:=public.hotel_v2_seven_arches_owner_capabilities();
  v_before_permission jsonb;
  v_after_permission jsonb;
  v_request jsonb;
  v_request_hash text;
  v_result jsonb;
  v_before_current jsonb;
  v_current jsonb;
begin
  -- Lock every relation in the deployed ADMIN-D protected projection. This
  -- prevents unrelated writes from being accidentally blessed by the new
  -- baseline while the exact permission/audit delta is committed.
  select 'lock table '||string_agg(format('public.%I',relation_name),', ' order by relation_name)
    ||' in share row exclusive mode'
  into v_lock_sql
  from unnest(array[
    'hotels','hotel_room_types','hotel_units','hotel_property_pricing_defaults','hotel_rate_plans',
    'hotel_room_rates','hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_rate_occupancy_tiers','hotel_rate_rules','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_calendar_overrides',
    'hotel_pricing_promotion_reviews','hotel_admin_pricing_action_receipts',
    'hotel_calendar_source_configs','hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_bookings','hotel_activity_log',
    'partner_service_fulfillments','partner_service_fulfillment_form_snapshots',
    'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
    'service_coupons','service_coupon_redemptions','referrals','affiliate_commission_events',
    'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
    'affiliate_referrer_overrides','affiliate_cashout_requests','profile_referral_code_aliases',
    'site_settings','partners','partner_users','partner_resources','partner_user_resources',
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox',
    'hotel_property_operational_profiles','hotel_admin_availability_foundation_receipts'
  ]) protected(relation_name);
  if exists(select 1 from unnest(array[
      'hotels','hotel_room_types','hotel_units','hotel_property_pricing_defaults','hotel_rate_plans',
      'hotel_room_rates','hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_rate_occupancy_tiers','hotel_rate_rules','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_calendar_overrides',
      'hotel_pricing_promotion_reviews','hotel_admin_pricing_action_receipts',
      'hotel_calendar_source_configs','hotel_payment_policies','hotel_payment_policy_terms',
      'hotel_commission_policies','hotel_bookings','hotel_activity_log',
      'partner_service_fulfillments','partner_service_fulfillment_form_snapshots',
      'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
      'service_coupons','service_coupon_redemptions','referrals','affiliate_commission_events',
      'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
      'affiliate_referrer_overrides','affiliate_cashout_requests','profile_referral_code_aliases',
      'site_settings','partners','partner_users','partner_resources','partner_user_resources',
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox',
      'hotel_property_operational_profiles','hotel_admin_availability_foundation_receipts'
    ]) protected(relation_name)
    where to_regclass('public.'||protected.relation_name) is null) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_protected_relation_missing';
  end if;
  execute v_lock_sql;

  select * into strict v_original
  from public.hotel_admin_availability_foundation_receipts where id=1;
  v_before_current:=public.hotel_v2_admin_d_protected_fingerprints();
  if v_original.protected_fingerprint<>encode(extensions.digest(
       convert_to(v_original.protected_fingerprints::text,'UTF8'),'sha256'),'hex')
     or (v_before_current-'site_settings') is distinct from
       (v_original.protected_fingerprints-'site_settings')
     or not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
       and not hotel_instant_booking_enabled
       and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         where receipt.id=setting.id
           and receipt.site_settings_without_external_fingerprint=
             public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
           and receipt.compatibility_function_fingerprints=
             public.hotel_v2_external_calendar_activation_function_fingerprints())) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_admin_d_baseline_drift';
  end if;

  select hotel.owner_partner_id into v_partner_id
  from public.hotels hotel where hotel.id=c_hotel;
  if v_partner_id is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_owner_missing';
  end if;
  if (select count(*) from public.partner_resources assignment
      where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_assignment_cardinality';
  end if;
  select assignment.id into strict v_assignment_id
  from public.partner_resources assignment
  where assignment.partner_id=v_partner_id and assignment.resource_type='hotels'
    and assignment.resource_id=c_hotel;
  if not exists(select 1 from public.partners partner where partner.id=v_partner_id
      and partner.status='active' and partner.can_manage_hotels) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_partner_ineligible';
  end if;
  if (select count(*) from public.partner_users member
      where member.partner_id=v_partner_id and member.role='owner')<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_owner_membership_cardinality';
  end if;
  select member.user_id into strict v_owner_user_id
  from public.partner_users member
  where member.partner_id=v_partner_id and member.role='owner';
  if exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel)
     or exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.has_mutation_capability) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_competing_mutator';
  end if;
  if exists(select 1 from public.hotel_activity_log where id=c_activity or correlation_id=c_correlation)
     or exists(select 1 from public.hotel_partner_action_receipts
       where id=c_receipt or idempotency_key=c_idempotency or correlation_id=c_correlation)
     or exists(select 1 from public.hotel_partner_event_outbox
       where id=c_outbox or dedupe_key='h3_2a:permission:'||c_receipt::text) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_audit_identity_conflict';
  end if;

  v_before_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_assignment_id);
  insert into public.hotel_partner_hotel_permissions(
    assignment_id,partner_id,hotel_id,
    edit_property_content,edit_property_photos,edit_room_content,edit_room_photos,
    create_rooms,edit_room_structure,manage_prices,manage_availability,
    process_bookings,request_booking_changes,view_payment_status,initiate_stripe_onboarding,
    created_by,updated_by
  ) values(
    v_assignment_id,v_partner_id,c_hotel,
    true,true,true,true,true,true,true,true,true,false,true,false,null,null
  );
  v_after_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_assignment_id);
  if v_before_permission->>'exists'<>'false'
     or v_after_permission->'capabilities' is distinct from v_capabilities
     or (v_after_permission->>'version')::bigint<>1
     or not (v_after_permission->>'has_mutation_capability')::boolean then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_permission_delta_mismatch';
  end if;

  v_request:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
    'hotel_id',c_hotel,'partner_id',v_partner_id,'assignment_id',v_assignment_id,
    'owner_user_id',v_owner_user_id,'capabilities',v_capabilities
  );
  v_request_hash:=encode(extensions.digest(convert_to(v_request::text,'UTF8'),'sha256'),'hex');
  v_result:=jsonb_build_object(
    'ok',true,'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
    'source','hotels_v2_seven_arches_owner_capability_bootstrap',
    'hotel_id',c_hotel,'partner_id',v_partner_id,'assignment_id',v_assignment_id,
    'changed',true,'permission',v_after_permission,
    'correlation_id',c_correlation,'idempotency_key',c_idempotency
  );

  insert into public.hotel_activity_log(
    id,hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id
  ) values(
    c_activity,c_hotel,'property',c_hotel,'update',
    jsonb_build_object('partner_permissions',v_before_permission,
      'assignment_id',v_assignment_id,'partner_id',v_partner_id),
    jsonb_build_object('partner_permissions',v_after_permission,
      'assignment_id',v_assignment_id,'partner_id',v_partner_id),
    'system',null,'hotels_v2_seven_arches_owner_capability_bootstrap',c_correlation
  );
  insert into public.hotel_partner_action_receipts(
    id,partner_id,hotel_id,actor_user_id,action,idempotency_key,
    request_hash,correlation_id,result
  ) values(
    c_receipt,v_partner_id,c_hotel,v_owner_user_id,
    'bootstrap_7_arches_owner_capabilities',c_idempotency,
    v_request_hash,c_correlation,v_result
  );
  insert into public.hotel_partner_event_outbox(
    id,partner_id,hotel_id,aggregate_type,aggregate_id,event_type,dedupe_key,payload
  ) values(
    c_outbox,v_partner_id,c_hotel,'hotel_partner_permissions',v_assignment_id,
    'hotel.partner_permissions.updated','h3_2a:permission:'||c_receipt::text,
    jsonb_build_object('hotel_id',c_hotel,'assignment_id',v_assignment_id,
      'partner_id',v_partner_id,'permission_version',1,
      'has_mutation_capability',true,'correlation_id',c_correlation)
  );

  v_current:=public.hotel_v2_admin_d_protected_fingerprints();
  if (v_current-array['hotel_partner_hotel_permissions','hotel_partner_action_receipts',
        'hotel_partner_event_outbox','non_admin_d_activity']::text[])
       is distinct from
       (v_before_current-array['hotel_partner_hotel_permissions',
        'hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[])
     or v_current->>'hotel_partner_hotel_permissions'
          is not distinct from v_before_current->>'hotel_partner_hotel_permissions'
     or v_current->>'hotel_partner_action_receipts'
          is not distinct from v_before_current->>'hotel_partner_action_receipts'
     or v_current->>'hotel_partner_event_outbox'
          is not distinct from v_before_current->>'hotel_partner_event_outbox'
     or v_current->>'non_admin_d_activity'
          is not distinct from v_before_current->>'non_admin_d_activity' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_delta_scope_mismatch';
  end if;
  insert into public.hotel_admin_availability_foundation_evolution_receipts(
    id,contract_version,original_foundation_receipt_id,original_protected_fingerprint,
    before_current_protected_fingerprints,before_current_protected_fingerprint,
    current_protected_fingerprints,current_protected_fingerprint,
    stage2_current_protected_fingerprints,stage2_current_protected_fingerprint,
    allowed_fingerprint_keys,
    hotel_id,partner_id,assignment_id,owner_user_id,permission_version,capabilities,
    before_permission,after_permission,activity_id,action_receipt_id,outbox_id,
    correlation_id,idempotency_key,request_hash
  ) values(
    1,'hotels_v2_admin_d_foundation_evolution_v2',1,v_original.protected_fingerprint,
    v_before_current,encode(extensions.digest(convert_to(v_before_current::text,'UTF8'),'sha256'),'hex'),
    v_current,encode(extensions.digest(convert_to(v_current::text,'UTF8'),'sha256'),'hex'),
    public.hotel_v2_external_calendar_protected_fingerprints(),
    public.hotel_v2_external_calendar_worker_hash(
      public.hotel_v2_external_calendar_protected_fingerprints()),
    array['hotel_partner_hotel_permissions','hotel_partner_action_receipts',
      'hotel_partner_event_outbox','non_admin_d_activity']::text[],
    c_hotel,v_partner_id,v_assignment_id,v_owner_user_id,1,v_capabilities,
    v_before_permission,v_after_permission,c_activity,c_receipt,c_outbox,
    c_correlation,c_idempotency,v_request_hash
  );
end
$seven_arches_owner_apply$;

create function public.hotel_v2_admin_d_current_foundation_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_evolution public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_current jsonb;
  v_stage2_foundation jsonb;
  v_stage2_current jsonb;
  v_original_safe boolean:=false;
  v_deployed_foundations_safe boolean:=false;
  v_evolution_safe boolean:=false;
  v_assignment_safe boolean:=false;
  v_permission_safe boolean:=false;
  v_audit_safe boolean:=false;
begin
  select * into v_original from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into v_evolution from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_current:=public.hotel_v2_admin_d_protected_fingerprints();
  select protected_fingerprints into v_stage2_foundation
    from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1;
  v_stage2_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_original_safe:=v_original.id=1
    and v_original.protected_fingerprint=encode(extensions.digest(
      convert_to(v_original.protected_fingerprints::text,'UTF8'),'sha256'),'hex');
  v_deployed_foundations_safe:=(select count(*)=1 and bool_and(id=1
      and not hotel_rooms_v2_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
      from public.site_settings)
    and exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
    and not exists(select 1 from public.site_settings setting where setting.id=1
      and setting.hotel_external_sync_enabled and not exists(
        select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
        where receipt.id=setting.id
          and receipt.site_settings_without_external_fingerprint=
            public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
          and receipt.compatibility_function_fingerprints=
            public.hotel_v2_external_calendar_activation_function_fingerprints()))
    and (v_stage2_current-array['hotel_partner_hotel_permissions','site_settings',
      'non_external_calendar_activity','non_external_calendar_partner_receipts']::text[])
      is not distinct from (v_stage2_foundation-array['hotel_partner_hotel_permissions','site_settings',
      'non_external_calendar_activity','non_external_calendar_partner_receipts']::text[]);
  v_evolution_safe:=(select count(*)=1 from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_evolution.original_foundation_receipt_id=1
    and v_evolution.original_protected_fingerprint=v_original.protected_fingerprint
    and v_evolution.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and (v_evolution.before_current_protected_fingerprints-'site_settings')
      is not distinct from (v_original.protected_fingerprints-'site_settings')
    and v_evolution.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_evolution.current_protected_fingerprints is not distinct from v_current
    and v_evolution.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_evolution.stage2_current_protected_fingerprints)
    and v_evolution.stage2_current_protected_fingerprints is not distinct from v_stage2_current
    and v_evolution.allowed_fingerprint_keys=array['hotel_partner_hotel_permissions',
      'hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[]
    and (v_evolution.current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
      is not distinct from
        (v_evolution.before_current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
    and v_evolution.capabilities is not distinct from
      public.hotel_v2_seven_arches_owner_capabilities()
    and v_evolution.hotel_id=c_hotel and v_evolution.permission_version=1;
  v_assignment_safe:=(select count(*)=1 from public.partner_resources assignment
      where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)
    and exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      join public.partner_resources assignment on assignment.partner_id=partner.id
        and assignment.resource_type='hotels' and assignment.resource_id=hotel.id
      where hotel.id=c_hotel and partner.id=v_evolution.partner_id
        and assignment.id=v_evolution.assignment_id
        and partner.status='active' and partner.can_manage_hotels)
    and (select count(*)=1 from public.partner_users member
      where member.partner_id=v_evolution.partner_id and member.role='owner')
    and exists(select 1 from public.partner_users member
      where member.partner_id=v_evolution.partner_id and member.role='owner'
        and member.user_id=v_evolution.owner_user_id);
  v_permission_safe:=(select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id=v_evolution.assignment_id
        and permission.partner_id=v_evolution.partner_id and permission.version=1
        and permission.created_by is null and permission.updated_by is null
        and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_evolution.after_permission
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)->'capabilities'
          is not distinct from public.hotel_v2_seven_arches_owner_capabilities())
    and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id<>v_evolution.assignment_id
        and permission.has_mutation_capability);
  v_audit_safe:=exists(select 1 from public.hotel_activity_log activity
      where activity.id=v_evolution.activity_id and activity.hotel_id=c_hotel
        and activity.entity_type='property' and activity.entity_id=c_hotel
        and activity.action='update' and activity.actor_type='system' and activity.actor_id is null
        and activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
        and activity.correlation_id=v_evolution.correlation_id
        and activity.before_state=jsonb_build_object(
          'partner_permissions',v_evolution.before_permission,
          'assignment_id',v_evolution.assignment_id,'partner_id',v_evolution.partner_id)
        and activity.after_state=jsonb_build_object(
          'partner_permissions',v_evolution.after_permission,
          'assignment_id',v_evolution.assignment_id,'partner_id',v_evolution.partner_id))
    and exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.id=v_evolution.action_receipt_id and receipt.partner_id=v_evolution.partner_id
        and receipt.hotel_id=c_hotel and receipt.actor_user_id=v_evolution.owner_user_id
        and receipt.action='bootstrap_7_arches_owner_capabilities'
        and receipt.idempotency_key=v_evolution.idempotency_key
        and receipt.request_hash=v_evolution.request_hash
        and receipt.correlation_id=v_evolution.correlation_id
        and receipt.result is not distinct from jsonb_build_object(
          'ok',true,
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'source','hotels_v2_seven_arches_owner_capability_bootstrap',
          'hotel_id',c_hotel,'partner_id',v_evolution.partner_id,
          'assignment_id',v_evolution.assignment_id,'changed',true,
          'permission',v_evolution.after_permission,
          'correlation_id',v_evolution.correlation_id,
          'idempotency_key',v_evolution.idempotency_key)
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'hotel_id',c_hotel,'partner_id',v_evolution.partner_id,
          'assignment_id',v_evolution.assignment_id,
          'owner_user_id',v_evolution.owner_user_id,
          'capabilities',v_evolution.capabilities)::text,'UTF8'),'sha256'),'hex'))
    and exists(select 1 from public.hotel_partner_event_outbox event
      where event.id=v_evolution.outbox_id and event.partner_id=v_evolution.partner_id
        and event.hotel_id=c_hotel and event.aggregate_type='hotel_partner_permissions'
        and event.aggregate_id=v_evolution.assignment_id
        and event.event_type='hotel.partner_permissions.updated'
        and event.dedupe_key='h3_2a:permission:'||v_evolution.action_receipt_id::text
        and event.payload->>'correlation_id'=v_evolution.correlation_id::text
        and event.payload->>'permission_version'='1');
  return jsonb_build_object(
    'contract_version','hotels_v2_admin_d_current_foundation_v1',
    'original_receipt_intact',v_original_safe,
    'deployed_foundations_exact',v_deployed_foundations_safe,
    'stage2_current_protected_fingerprints',v_stage2_current,
    'stage2_current_protected_fingerprint',
      public.hotel_v2_external_calendar_worker_hash(v_stage2_current),
    'evolution_receipt_count',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts),
    'current_matches_latest',v_evolution_safe,
    'seven_arches_assignment_exact',v_assignment_safe,
    'seven_arches_owner_preset_exact',v_permission_safe,
    'audit_chain_exact',v_audit_safe,
    'safe',v_original_safe and v_deployed_foundations_safe and v_evolution_safe and v_assignment_safe
      and v_permission_safe and v_audit_safe
  );
end
$function$;

alter table public.hotel_admin_availability_foundation_evolution_receipts owner to postgres;
alter function public.hotel_v2_seven_arches_owner_capabilities() owner to postgres;
alter function public.hotel_v2_admin_d_current_foundation_snapshot() owner to postgres;
revoke all on function public.hotel_v2_seven_arches_owner_capabilities()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_current_foundation_snapshot()
  from public,anon,authenticated,service_role;

do $seven_arches_owner_postconditions$
declare v_snapshot jsonb;
begin
  v_snapshot:=public.hotel_v2_admin_d_current_foundation_snapshot();
  if not coalesce((v_snapshot->>'safe')::boolean,false) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_evolution_mismatch',
      detail=v_snapshot::text;
  end if;
  if not exists(select 1 from pg_class relation
      where relation.oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy
       where policy.polrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass)
     or exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('anon',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('authenticated',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('service_role',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)) then
    raise exception using errcode='42501',
      message='hotels_v2_seven_arches_owner_capabilities_receipt_acl_mismatch';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_seven_arches_owner_capabilities()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',true,array['search_path=pg_catalog, public']::text[])
    ) expected(signature,secdef,path)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.secdef
      or procedure_row.proconfig is distinct from expected.path
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='42501',
      message='hotels_v2_seven_arches_owner_capabilities_helper_acl_mismatch';
  end if;
end
$seven_arches_owner_postconditions$;

notify pgrst,'reload schema';
commit;
