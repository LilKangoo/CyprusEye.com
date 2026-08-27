begin;
set transaction isolation level read committed;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- This must be the first statement which can establish a protected-data
-- snapshot. PostgreSQL READ COMMITTED gives the later apply command a fresh
-- snapshot after every pre-existing writer has released its conflicting lock;
-- these locks then prevent another protected write through COMMIT.
lock table
  hotels_v2_private.hotel_external_calendar_activation_receipts,
  hotels_v2_private.hotel_external_calendar_foundation_receipts,
  public.affiliate_adjustments,
  public.affiliate_cashout_requests,
  public.affiliate_commission_events,
  public.affiliate_payouts,
  public.affiliate_program_settings,
  public.affiliate_referrer_overrides,
  public.hotel_activity_log,
  public.hotel_admin_availability_action_receipts,
  public.hotel_admin_availability_foundation_receipts,
  public.hotel_admin_availability_plan_reviews,
  public.hotel_admin_pricing_action_receipts,
  public.hotel_booking_room_allocations,
  public.hotel_bookings,
  public.hotel_calendar_overrides,
  public.hotel_calendar_source_configs,
  public.hotel_commission_policies,
  public.hotel_daily_inventory,
  public.hotel_daily_rates,
  public.hotel_inventory_commitments,
  public.hotel_inventory_holds,
  public.hotel_partner_action_receipts,
  public.hotel_partner_event_outbox,
  public.hotel_partner_hotel_permissions,
  public.hotel_partner_workspace_foundation_receipts,
  public.hotel_payment_policies,
  public.hotel_payment_policy_terms,
  public.hotel_pricing_promotion_reviews,
  public.hotel_pricing_schedule_occupancy_tiers,
  public.hotel_pricing_schedules,
  public.hotel_property_operational_profiles,
  public.hotel_property_pricing_defaults,
  public.hotel_rate_plans,
  public.hotel_rate_rules,
  public.hotel_room_allocation_rule_items,
  public.hotel_room_allocation_rules,
  public.hotel_room_rate_occupancy_tiers,
  public.hotel_room_rates,
  public.hotel_room_types,
  public.hotel_unit_calendar_blocks,
  public.hotel_units,
  public.hotels,
  public.partner_resources,
  public.partner_service_fulfillment_form_snapshots,
  public.partner_service_fulfillments,
  public.partner_user_resources,
  public.partner_users,
  public.partners,
  public.profile_referral_code_aliases,
  public.referrals,
  public.service_coupon_redemptions,
  public.service_coupons,
  public.service_deposit_overrides,
  public.service_deposit_requests,
  public.service_deposit_rules,
  public.site_settings
in share row exclusive mode;

-- Production-safe, one-Hotel capability evolution after the deployed H3.2B
-- and Stage 2 foundation (before or after explicit Stage 2F activation). The
-- original ADMIN-D receipt is never changed: this migration proves its
-- immutable integrity and frozen code/security lineage, captures the locked
-- live business state, applies one exact audited delta, and appends a new
-- immutable current-baseline receipt.

do $seven_arches_owner_prerequisites$
begin
  if to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_d_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_permissions_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
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
     or to_regprocedure('public.hotel_v2_h3_2b_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_prerequisite_missing';
  end if;
  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is not null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_boundary_mismatch';
  end if;
  -- Historical receipts prove their own immutable capture. Current mutable
  -- business rows are deliberately not compared to those historical snapshots.
  if (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
         and (select count(*)
           from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
         and receipt.compatibility_function_fingerprints ?& array[
           'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
           'public.hotel_v2_partner_list_assigned_properties(uuid)',
           'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
           'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_get_content_control(uuid)',
           'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
           'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
           'public.hotel_v2_h3_2b_flags_off()',
           'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
           'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
         ]::text[]
         and not exists(select 1
           from jsonb_each_text(receipt.compatibility_function_fingerprints) entry
           where entry.value!~'^[0-9a-f]{64}$')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_historical_receipt_mismatch';
  end if;
  if not (select count(*)=1 and bool_and(id=1
      and not hotel_rooms_v2_enabled
      and hotel_external_sync_enabled is not null
      and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_unsupported_flag_state';
  end if;
  -- The activation-era site_settings hash is historical evidence, not a hash of
  -- the forever-current row. The immutable receipt must instead keep proving
  -- the exact compatibility function lineage required by the active lifecycle.
  if not exists(
      select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_stage2f_function_lineage_mismatch';
  end if;
  -- Pin every helper which defines or hashes the baseline. Capturing whatever
  -- source happens to be live would make a self-consistent but drifted helper
  -- indistinguishable from the reviewed foundation.
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
      ('public.hotel_v2_admin_d_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',true,
        array['search_path=pg_catalog, public']::text[],
        'be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[],
        '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
        array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
      ('public.hotel_v2_h3_2b_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
    ) expected(signature,security_definer,configuration,source_hash)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.configuration
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        <>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_frozen_function_mismatch';
  end if;
  if not exists(select 1 from pg_class relation where relation.oid=
        'public.hotel_admin_availability_foundation_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or not exists(select 1 from pg_class relation where relation.oid=
        'public.hotel_partner_workspace_foundation_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or not exists(select 1 from pg_class relation where relation.oid=
        'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass
        and relation.relowner='postgres'::regrole)
     or not exists(select 1 from pg_class relation where relation.oid=
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and relation.relowner='postgres'::regrole)
     or exists(select 1 from (values
        ('hotel_admin_availability_foundation_immutable',
          'public.hotel_admin_availability_foundation_receipts'::regclass,
          'public.hotel_v2_admin_d_immutable_row()'::regprocedure),
        ('hotel_partner_workspace_foundation_receipts_immutable',
          'public.hotel_partner_workspace_foundation_receipts'::regclass,
          'public.hotel_v2_h3_2b_immutable_row()'::regprocedure),
        ('hotel_external_calendar_foundation_receipt_immutable',
          'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
          'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure),
        ('hotel_external_calendar_activation_receipt_immutable',
          'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
          'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure)
       ) expected(trigger_name,relation_oid,function_oid)
       where not exists(select 1 from pg_trigger trigger_row
         where trigger_row.tgname=expected.trigger_name
           and trigger_row.tgrelid=expected.relation_oid
           and trigger_row.tgfoid=expected.function_oid
           and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
           and trigger_row.tgtype=27))
     or exists(select 1 from pg_policy policy where policy.polrelid in(
       'public.hotel_admin_availability_foundation_receipts'::regclass,
       'public.hotel_partner_workspace_foundation_receipts'::regclass))
     or exists(select 1 from (values
        ('public.hotel_admin_availability_foundation_receipts'::regclass),
        ('public.hotel_partner_workspace_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass),
        ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass),
        ('public.hotel_partner_hotel_permissions'::regclass)
       ) protected(relation_oid)
       cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,protected.relation_oid,privilege.name)
          or has_table_privilege('anon',protected.relation_oid,privilege.name)
          or has_table_privilege('authenticated',protected.relation_oid,privilege.name)
          or has_table_privilege('service_role',protected.relation_oid,privilege.name)) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_frozen_security_mismatch';
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
  stage2_before_current_protected_fingerprints jsonb not null
    check(jsonb_typeof(stage2_before_current_protected_fingerprints)='object'),
  stage2_before_current_protected_fingerprint text not null
    check(stage2_before_current_protected_fingerprint~'^[0-9a-f]{64}$'),
  stage2_current_protected_fingerprints jsonb not null
    check(jsonb_typeof(stage2_current_protected_fingerprints)='object'),
  stage2_current_protected_fingerprint text not null
    check(stage2_current_protected_fingerprint~'^[0-9a-f]{64}$'),
  allowed_fingerprint_keys text[] not null check(allowed_fingerprint_keys=array[
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','non_admin_d_activity']::text[]),
  stage2_allowed_fingerprint_keys text[] not null check(stage2_allowed_fingerprint_keys=array[
    'hotel_partner_hotel_permissions','non_external_calendar_activity',
    'non_external_calendar_partner_receipts']::text[]),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  assignment_id uuid not null
    references public.hotel_partner_hotel_permissions(assignment_id) on delete restrict,
  owner_user_ids uuid[] not null check(
    cardinality(owner_user_ids)>0 and array_position(owner_user_ids,null) is null),
  owner_membership_fingerprint text not null
    check(owner_membership_fingerprint~'^[0-9a-f]{64}$'),
  permission_version bigint not null check(permission_version=1),
  capabilities jsonb not null
    check(jsonb_typeof(capabilities)='object'),
  before_permission jsonb not null
    check(jsonb_typeof(before_permission)='object'),
  after_permission jsonb not null
    check(jsonb_typeof(after_permission)='object'),
  before_foreign_permissions_fingerprint text not null
    check(before_foreign_permissions_fingerprint~'^[0-9a-f]{32}$'),
  current_foreign_permissions_fingerprint text not null
    check(current_foreign_permissions_fingerprint=before_foreign_permissions_fingerprint),
  activity_id uuid not null unique references public.hotel_activity_log(id) on delete restrict,
  action_receipt_id uuid not null unique references public.hotel_partner_action_receipts(id) on delete restrict,
  outbox_id uuid not null unique references public.hotel_partner_event_outbox(id) on delete restrict,
  correlation_id uuid not null unique,
  idempotency_key uuid not null unique,
  request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_admin_availability_evolution_owner_membership_exact check(
    owner_membership_fingerprint=encode(extensions.digest(convert_to(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_owner_membership_v1',
        'hotel_id',hotel_id,'partner_id',partner_id,'assignment_id',assignment_id,
        'role','owner','owner_user_ids',to_jsonb(owner_user_ids)
      )::text,'UTF8'),'sha256'),'hex')
  )
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
  -- Audit-only system attribution for the legacy non-null actor column. It is
  -- never resolved as a membership and never participates in authorization.
  c_system_actor constant uuid:='00000000-0000-0000-0000-000000000000';
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_partner_id uuid;
  v_assignment_id uuid;
  v_owner_user_ids uuid[];
  v_owner_membership_fingerprint text;
  v_capabilities jsonb:=public.hotel_v2_seven_arches_owner_capabilities();
  v_before_permission jsonb;
  v_after_permission jsonb;
  v_request jsonb;
  v_request_hash text;
  v_result jsonb;
  v_h3 jsonb;
  v_before_current jsonb;
  v_current jsonb;
  v_stage2_before_current jsonb;
  v_stage2_current jsonb;
  v_before_foreign_permissions_fingerprint text;
  v_current_foreign_permissions_fingerprint text;
begin
  select * into strict v_original
  from public.hotel_admin_availability_foundation_receipts where id=1;
  v_before_current:=public.hotel_v2_admin_d_protected_fingerprints();
  v_stage2_before_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  select md5(coalesce(string_agg(to_jsonb(permission)::text,'|'
      order by permission.assignment_id),''))
    into v_before_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
  if v_original.protected_fingerprint<>encode(extensions.digest(
       convert_to(v_original.protected_fingerprints::text,'UTF8'),'sha256'),'hex')
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
       and hotel_external_sync_enabled is not null
       and not hotel_instant_booking_enabled
       and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         where receipt.id=setting.id
           and receipt.compatibility_function_fingerprints=
             public.hotel_v2_external_calendar_activation_function_fingerprints())) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_live_foundation_mismatch';
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
  select array_agg(member.user_id order by member.user_id)
    into v_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_partner_id and member.role='owner';
  if coalesce(cardinality(v_owner_user_ids),0)<1
     or cardinality(v_owner_user_ids)<>(select count(distinct owner_id)
       from unnest(v_owner_user_ids) owner_id) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_owner_membership_cardinality';
  end if;
  v_owner_membership_fingerprint:=encode(extensions.digest(convert_to(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_owner_membership_v1',
      'hotel_id',c_hotel,'partner_id',v_partner_id,'assignment_id',v_assignment_id,
      'role','owner','owner_user_ids',to_jsonb(v_owner_user_ids)
    )::text,'UTF8'),'sha256'),'hex');
  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy'
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
     or exists(select 1 from public.hotel_rate_plans
       where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_room_rates
       where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_pricing_schedules
       where hotel_id=c_hotel and is_active)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_target_migration_boundary_mismatch';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if v_h3#>>'{promotion,status}'<>'reviewed'
     or v_h3#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_h3#>>'{source,rule_count}')::integer<>63
     or v_h3->>'pricing_occupancy_mapping_fingerprint'<>'6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_h3#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_h3#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_h3#>>'{source,property_party_preview,tier_count}')::integer<>63
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed'
         and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint=v_h3#>>'{source,pricing_fingerprint}'
         and review.target_fingerprint=v_h3#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=
           v_h3->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_h3#>>'{parity,fingerprint}'
         and review.parity_case_count=(v_h3#>>'{parity,total_case_count}')::integer
         and review.parity_mismatch_count=(v_h3#>>'{parity,total_mismatch_count}')::integer
         and review.result->>'target_fingerprint'=review.target_fingerprint) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_target_pricing_foundation_mismatch';
  end if;
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
    'actor_type','system',
    'hotel_id',c_hotel,'partner_id',v_partner_id,'assignment_id',v_assignment_id,
    'owner_user_ids',to_jsonb(v_owner_user_ids),
    'owner_membership_fingerprint',v_owner_membership_fingerprint,
    'capabilities',v_capabilities
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
    c_receipt,v_partner_id,c_hotel,c_system_actor,
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
  v_stage2_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  select md5(coalesce(string_agg(to_jsonb(permission)::text,'|'
      order by permission.assignment_id),''))
    into v_current_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
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
  if v_current_foreign_permissions_fingerprint is distinct from
       v_before_foreign_permissions_fingerprint then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_foreign_permission_delta';
  end if;
  if (v_stage2_current-array['hotel_partner_hotel_permissions',
        'non_external_calendar_activity','non_external_calendar_partner_receipts']::text[])
       is distinct from
       (v_stage2_before_current-array['hotel_partner_hotel_permissions',
        'non_external_calendar_activity','non_external_calendar_partner_receipts']::text[])
     or v_stage2_current->>'hotel_partner_hotel_permissions'
          is not distinct from v_stage2_before_current->>'hotel_partner_hotel_permissions'
     or v_stage2_current->>'non_external_calendar_activity'
          is not distinct from v_stage2_before_current->>'non_external_calendar_activity'
     or v_stage2_current->>'non_external_calendar_partner_receipts'
          is not distinct from v_stage2_before_current->>'non_external_calendar_partner_receipts' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_owner_capabilities_stage2_delta_scope_mismatch';
  end if;
  insert into public.hotel_admin_availability_foundation_evolution_receipts(
    id,contract_version,original_foundation_receipt_id,original_protected_fingerprint,
    before_current_protected_fingerprints,before_current_protected_fingerprint,
    current_protected_fingerprints,current_protected_fingerprint,
    stage2_before_current_protected_fingerprints,
    stage2_before_current_protected_fingerprint,
    stage2_current_protected_fingerprints,stage2_current_protected_fingerprint,
    allowed_fingerprint_keys,stage2_allowed_fingerprint_keys,
    hotel_id,partner_id,assignment_id,owner_user_ids,owner_membership_fingerprint,
    permission_version,capabilities,
    before_permission,after_permission,
    before_foreign_permissions_fingerprint,current_foreign_permissions_fingerprint,
    activity_id,action_receipt_id,outbox_id,
    correlation_id,idempotency_key,request_hash
  ) values(
    1,'hotels_v2_admin_d_foundation_evolution_v2',1,v_original.protected_fingerprint,
    v_before_current,encode(extensions.digest(convert_to(v_before_current::text,'UTF8'),'sha256'),'hex'),
    v_current,encode(extensions.digest(convert_to(v_current::text,'UTF8'),'sha256'),'hex'),
    v_stage2_before_current,public.hotel_v2_external_calendar_worker_hash(v_stage2_before_current),
    v_stage2_current,public.hotel_v2_external_calendar_worker_hash(v_stage2_current),
    array['hotel_partner_hotel_permissions','hotel_partner_action_receipts',
      'hotel_partner_event_outbox','non_admin_d_activity']::text[],
    array['hotel_partner_hotel_permissions','non_external_calendar_activity',
      'non_external_calendar_partner_receipts']::text[],
    c_hotel,v_partner_id,v_assignment_id,v_owner_user_ids,
    v_owner_membership_fingerprint,1,v_capabilities,
    v_before_permission,v_after_permission,v_before_foreign_permissions_fingerprint,
    v_current_foreign_permissions_fingerprint,c_activity,c_receipt,c_outbox,
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
  c_receipt constant uuid:='37500000-0000-4000-8000-000000000001';
  c_correlation constant uuid:='37500000-0000-4000-8000-000000000002';
  c_idempotency constant uuid:='37500000-0000-4000-8000-000000000003';
  c_activity constant uuid:='37500000-0000-4000-8000-000000000004';
  c_outbox constant uuid:='37500000-0000-4000-8000-000000000005';
  -- Must match the audit-only system attribution emitted by the bootstrap.
  c_system_actor constant uuid:='00000000-0000-0000-0000-000000000000';
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_evolution public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_current jsonb;
  v_stage2_current jsonb;
  v_h3 jsonb;
  v_current_owner_user_ids uuid[];
  v_current_foreign_permissions_fingerprint text;
  v_original_safe boolean:=false;
  v_historical_receipts_safe boolean:=false;
  v_frozen_contracts_safe boolean:=false;
  v_supported_flags_safe boolean:=false;
  v_stage2f_safe boolean:=false;
  v_deployed_foundations_safe boolean:=false;
  v_current_evolution_safe boolean:=false;
  v_stage2_evolution_safe boolean:=false;
  v_evolution_safe boolean:=false;
  v_target_foundation_safe boolean:=false;
  v_assignment_safe boolean:=false;
  v_owner_membership_safe boolean:=false;
  v_permission_safe boolean:=false;
  v_foreign_permissions_safe boolean:=false;
  v_audit_safe boolean:=false;
begin
  select * into v_original from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into v_evolution from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_current:=public.hotel_v2_admin_d_protected_fingerprints();
  v_stage2_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  select array_agg(member.user_id order by member.user_id)
    into v_current_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_evolution.partner_id and member.role='owner';
  select md5(coalesce(string_agg(to_jsonb(permission)::text,'|'
      order by permission.assignment_id),''))
    into v_current_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
  v_original_safe:=(select count(*)=1 from public.hotel_admin_availability_foundation_receipts)
    and v_original.id=1
    and v_original.protected_fingerprint=encode(extensions.digest(
      convert_to(v_original.protected_fingerprints::text,'UTF8'),'sha256'),'hex');
  v_historical_receipts_safe:=v_original_safe
    and (select count(*)=1 from public.hotel_partner_workspace_foundation_receipts)
    and exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_foundation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_activation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1
        and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
        and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
        and (select count(*)
          from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
        and receipt.compatibility_function_fingerprints ?& array[
          'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
          'public.hotel_v2_partner_list_assigned_properties(uuid)',
          'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
          'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
          'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
          'public.hotel_v2_admin_get_content_control(uuid)',
          'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
          'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
          'public.hotel_v2_h3_2b_flags_off()',
          'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
          'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
          'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
        ]::text[]
        and not exists(select 1
          from jsonb_each_text(receipt.compatibility_function_fingerprints) entry
          where entry.value!~'^[0-9a-f]{64}$'));
  v_supported_flags_safe:=(select count(*)=1 and bool_and(id=1
      and not hotel_rooms_v2_enabled and hotel_external_sync_enabled is not null
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
      from public.site_settings);
  v_stage2f_safe:=not exists(select 1 from public.site_settings setting
      where setting.id=1 and setting.hotel_external_sync_enabled)
    or exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        public.hotel_v2_external_calendar_activation_function_fingerprints());
  v_frozen_contracts_safe:=not exists(select 1 from (values
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
      ('public.hotel_v2_admin_d_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',true,
        array['search_path=pg_catalog, public']::text[],
        'be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[],
        '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
        array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
      ('public.hotel_v2_h3_2b_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
    ) expected(signature,security_definer,configuration,source_hash)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.configuration
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        <>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_admin_availability_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_partner_workspace_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole)
    and exists(select 1 from pg_class relation where relation.oid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
      and relation.relowner='postgres'::regrole)
    and not exists(select 1 from (values
      ('hotel_admin_availability_foundation_immutable',
        'public.hotel_admin_availability_foundation_receipts'::regclass,
        'public.hotel_v2_admin_d_immutable_row()'::regprocedure),
      ('hotel_partner_workspace_foundation_receipts_immutable',
        'public.hotel_partner_workspace_foundation_receipts'::regclass,
        'public.hotel_v2_h3_2b_immutable_row()'::regprocedure),
      ('hotel_external_calendar_foundation_receipt_immutable',
        'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
        'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure),
      ('hotel_external_calendar_activation_receipt_immutable',
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure)
     ) expected(trigger_name,relation_oid,function_oid)
     where not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgname=expected.trigger_name
         and trigger_row.tgrelid=expected.relation_oid
         and trigger_row.tgfoid=expected.function_oid
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27))
    and not exists(select 1 from pg_policy policy where policy.polrelid in(
      'public.hotel_admin_availability_foundation_receipts'::regclass,
      'public.hotel_partner_workspace_foundation_receipts'::regclass))
    and not exists(select 1 from (values
      ('public.hotel_admin_availability_foundation_receipts'::regclass),
      ('public.hotel_partner_workspace_foundation_receipts'::regclass),
      ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass),
      ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass),
      ('public.hotel_partner_hotel_permissions'::regclass)
     ) protected(relation_oid)
     cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
     where has_table_privilege(0::oid,protected.relation_oid,privilege.name)
        or has_table_privilege('anon',protected.relation_oid,privilege.name)
        or has_table_privilege('authenticated',protected.relation_oid,privilege.name)
        or has_table_privilege('service_role',protected.relation_oid,privilege.name))
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        public.hotel_v2_external_calendar_activation_function_fingerprints());
  v_deployed_foundations_safe:=v_historical_receipts_safe and v_frozen_contracts_safe
    and v_supported_flags_safe and v_stage2f_safe;
  v_current_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_evolution.original_foundation_receipt_id=1
    and v_evolution.original_protected_fingerprint=v_original.protected_fingerprint
    and v_evolution.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_evolution.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_evolution.current_protected_fingerprints is not distinct from v_current
    and v_evolution.allowed_fingerprint_keys=array['hotel_partner_hotel_permissions',
      'hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[]
    and (v_evolution.current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
      is not distinct from
        (v_evolution.before_current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.allowed_fingerprint_keys) changed(key)
      where v_evolution.current_protected_fingerprints->changed.key is not distinct from
        v_evolution.before_current_protected_fingerprints->changed.key)
    and v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint
    and v_evolution.before_permission is not distinct from jsonb_build_object(
      'exists',false,'version',0,'updated_at',null,
      'has_mutation_capability',false,'capabilities',jsonb_build_object(
        'edit_property_content',false,'edit_property_photos',false,
        'edit_room_content',false,'edit_room_photos',false,'create_rooms',false,
        'edit_room_structure',false,'manage_prices',false,'manage_availability',false,
        'process_bookings',false,'request_booking_changes',false,
        'view_payment_status',false,'initiate_stripe_onboarding',false))
    and v_evolution.capabilities is not distinct from
      public.hotel_v2_seven_arches_owner_capabilities()
    and v_evolution.hotel_id=c_hotel and v_evolution.permission_version=1
    and v_evolution.action_receipt_id=c_receipt
    and v_evolution.correlation_id=c_correlation
    and v_evolution.idempotency_key=c_idempotency
    and v_evolution.activity_id=c_activity and v_evolution.outbox_id=c_outbox;
  v_stage2_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_evolution.stage2_before_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_before_current_protected_fingerprints)
    and v_evolution.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_current_protected_fingerprints)
    and v_evolution.stage2_current_protected_fingerprints is not distinct from v_stage2_current
    and v_evolution.stage2_allowed_fingerprint_keys=array[
      'hotel_partner_hotel_permissions','non_external_calendar_activity',
      'non_external_calendar_partner_receipts']::text[]
    and (v_evolution.stage2_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys) is not distinct from
      (v_evolution.stage2_before_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.stage2_allowed_fingerprint_keys) changed(key)
      where v_evolution.stage2_current_protected_fingerprints->changed.key is not distinct from
        v_evolution.stage2_before_current_protected_fingerprints->changed.key);
  v_evolution_safe:=v_current_evolution_safe and v_stage2_evolution_safe;
  v_target_foundation_safe:=exists(select 1 from public.hotels hotel where hotel.id=c_hotel
      and hotel.architecture_version='legacy'
      and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
    and not exists(select 1 from public.hotel_rate_plans
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_room_rates
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_pricing_schedules
      where hotel_id=c_hotel and is_active)
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
    and v_h3#>>'{promotion,status}'='reviewed'
    and v_h3#>>'{source,pricing_fingerprint}'='7208ab4ecc0e47abd64d87ca1ac53a03'
    and (v_h3#>>'{source,rule_count}')::integer=63
    and v_h3->>'pricing_occupancy_mapping_fingerprint'='6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
    and v_h3#>>'{parity,fingerprint}'='b3c915266ab060efaba522cf5587fb75'
    and (v_h3#>>'{parity,total_case_count}')::integer=70
    and (v_h3#>>'{parity,total_mismatch_count}')::integer=0
    and (v_h3#>>'{target,room_schedule,tier_count}')::integer=27
    and (v_h3#>>'{source,property_party_preview,tier_count}')::integer=63
    and exists(select 1 from public.hotel_pricing_promotion_reviews review
      where review.hotel_id=c_hotel
        and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
        and review.review_status='reviewed'
        and review.acknowledged_pricing_occupancy_mapping
        and review.source_fingerprint=v_h3#>>'{source,pricing_fingerprint}'
        and review.target_fingerprint=v_h3#>>'{target,target_fingerprint}'
        and review.pricing_occupancy_mapping_fingerprint=
          v_h3->>'pricing_occupancy_mapping_fingerprint'
        and review.parity_fingerprint=v_h3#>>'{parity,fingerprint}'
        and review.parity_case_count=(v_h3#>>'{parity,total_case_count}')::integer
        and review.parity_mismatch_count=(v_h3#>>'{parity,total_mismatch_count}')::integer
        and review.result->>'target_fingerprint'=review.target_fingerprint);
  v_owner_membership_safe:=coalesce(cardinality(v_current_owner_user_ids),0)>=1
    and v_evolution.owner_user_ids is not distinct from v_current_owner_user_ids
    and array_position(v_evolution.owner_user_ids,null) is null
    and cardinality(v_evolution.owner_user_ids)=(select count(distinct owner_id)
      from unnest(v_evolution.owner_user_ids) owner_id)
    and v_evolution.owner_membership_fingerprint=encode(extensions.digest(convert_to(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_owner_membership_v1',
        'hotel_id',v_evolution.hotel_id,'partner_id',v_evolution.partner_id,
        'assignment_id',v_evolution.assignment_id,'role','owner',
        'owner_user_ids',to_jsonb(v_evolution.owner_user_ids)
      )::text,'UTF8'),'sha256'),'hex');
  v_assignment_safe:=(select count(*)=1 from public.partner_resources assignment
      where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)
    and exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      join public.partner_resources assignment on assignment.partner_id=partner.id
        and assignment.resource_type='hotels' and assignment.resource_id=hotel.id
      where hotel.id=c_hotel and partner.id=v_evolution.partner_id
        and assignment.id=v_evolution.assignment_id
        and partner.status='active' and partner.can_manage_hotels)
    and v_owner_membership_safe;
  v_permission_safe:=(select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id=v_evolution.assignment_id
        and permission.partner_id=v_evolution.partner_id and permission.version=1
        and permission.created_by is null and permission.updated_by is null
        and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_evolution.after_permission
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)->'capabilities'
          is not distinct from public.hotel_v2_seven_arches_owner_capabilities())
    and (select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel)
    and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id<>v_evolution.assignment_id
        and permission.has_mutation_capability);
  v_foreign_permissions_safe:=v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint;
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
        and receipt.hotel_id=c_hotel and receipt.actor_user_id=c_system_actor
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
          'actor_type','system',
          'hotel_id',c_hotel,'partner_id',v_evolution.partner_id,
          'assignment_id',v_evolution.assignment_id,
          'owner_user_ids',to_jsonb(v_evolution.owner_user_ids),
          'owner_membership_fingerprint',v_evolution.owner_membership_fingerprint,
          'capabilities',v_evolution.capabilities)::text,'UTF8'),'sha256'),'hex'))
    and exists(select 1 from public.hotel_partner_event_outbox event
      where event.id=v_evolution.outbox_id and event.partner_id=v_evolution.partner_id
        and event.hotel_id=c_hotel and event.aggregate_type='hotel_partner_permissions'
        and event.aggregate_id=v_evolution.assignment_id
        and event.event_type='hotel.partner_permissions.updated'
        and event.dedupe_key='h3_2a:permission:'||v_evolution.action_receipt_id::text
        and event.payload is not distinct from jsonb_build_object(
          'hotel_id',c_hotel,'assignment_id',v_evolution.assignment_id,
          'partner_id',v_evolution.partner_id,'permission_version',1,
          'has_mutation_capability',true,'correlation_id',v_evolution.correlation_id));
  return jsonb_build_object(
    'contract_version','hotels_v2_admin_d_current_foundation_v1',
    'original_receipt_intact',v_original_safe,
    'historical_receipts_intact',v_historical_receipts_safe,
    'frozen_contracts_exact',v_frozen_contracts_safe,
    'supported_hotel_flags',v_supported_flags_safe,
    'stage2f_function_compatibility_exact',v_stage2f_safe,
    'deployed_foundations_exact',v_deployed_foundations_safe,
    'stage2_current_protected_fingerprints',v_stage2_current,
    'stage2_current_protected_fingerprint',
      public.hotel_v2_external_calendar_worker_hash(v_stage2_current),
    'evolution_receipt_count',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts),
    'current_matches_latest',v_current_evolution_safe,
    'stage2_current_matches_latest',v_stage2_evolution_safe,
    'seven_arches_target_foundation_exact',v_target_foundation_safe,
    'seven_arches_owner_count',coalesce(cardinality(v_current_owner_user_ids),0),
    'seven_arches_owner_membership_exact',v_owner_membership_safe,
    'seven_arches_assignment_exact',v_assignment_safe,
    'seven_arches_owner_preset_exact',v_permission_safe,
    'foreign_hotel_permissions_unchanged',v_foreign_permissions_safe,
    'audit_chain_exact',v_audit_safe,
    'safe',v_deployed_foundations_safe and v_evolution_safe and v_target_foundation_safe
      and v_assignment_safe and v_permission_safe and v_foreign_permissions_safe and v_audit_safe
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
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgname='hotel_admin_availability_foundation_evolution_immutable'
         and trigger_row.tgrelid=
           'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
         and trigger_row.tgfoid='public.hotel_v2_admin_d_immutable_row()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27)
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
