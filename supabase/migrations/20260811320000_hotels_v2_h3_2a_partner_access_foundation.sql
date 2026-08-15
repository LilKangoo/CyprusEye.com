begin;

-- Hotels V2 H3.2A is an access-control foundation only.  It adds no Partner
-- content/calendar/booking/payment mutation and grants no capability row.
-- Existing public Hotels, legacy prices, bookings, fulfillments and all four
-- V2 flags must remain byte-for-byte unchanged by this migration.

do $h3_2a_preconditions$
declare
  v_partner_user_resource_columns text[];
begin
  if to_regclass('public.partners') is null
     or to_regclass('public.partner_users') is null
     or to_regclass('public.partner_resources') is null
     or to_regclass('public.partner_user_resources') is null
     or to_regclass('public.hotels') is null
     or to_regclass('public.hotel_bookings') is null
     or to_regclass('public.partner_service_fulfillments') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regclass('public.service_deposit_requests') is null
     or to_regclass('public.service_coupon_redemptions') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_rate_plans') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null
     or to_regclass('public.hotel_room_allocation_rules') is null
     or to_regclass('public.hotel_room_allocation_rule_items') is null
     or to_regclass('public.hotel_payment_policies') is null
     or to_regclass('public.hotel_payment_policy_terms') is null
     or to_regclass('public.hotel_commission_policies') is null
     or to_regclass('public.hotel_calendar_source_configs') is null
     or to_regclass('public.site_settings') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is null
     or to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is null
     or to_regclass('public.hotel_pricing_promotion_reviews') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_prerequisite_contract_missing';
  end if;

  if to_regclass('public.hotel_partner_hotel_permissions') is not null
     or to_regclass('public.hotel_partner_action_receipts') is not null
     or to_regclass('public.hotel_partner_event_outbox') is not null
     or to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_media_assets') is not null
     or to_regclass('public.hotel_booking_change_requests') is not null
     or to_regclass('public.partner_payment_accounts') is not null
     or to_regclass('public.partner_payment_account_events') is not null
     or to_regprocedure('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)') is not null
     or to_regprocedure('public.hotel_v2_partner_list_assigned_properties(uuid)') is not null then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_migration_boundary_mismatch';
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_partner_user_resource_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'partner_user_resources';

  if v_partner_user_resource_columns is distinct from array[
       'id','partner_user_id','resource_type','resource_id','created_at'
     ]::text[] then
    raise exception using
      errcode = '42703',
      message = 'hotels_v2_h3_2a_partner_user_scope_contract_mismatch',
      detail = coalesce(array_to_string(v_partner_user_resource_columns, ','), '<missing>');
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (
       select 1 from public.site_settings setting
       where setting.id = 1
         and not setting.hotel_rooms_v2_enabled
         and not setting.hotel_external_sync_enabled
         and not setting.hotel_instant_booking_enabled
         and not setting.hotel_stripe_connect_enabled
     ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  if exists (
    select 1
    from public.partner_resources assignment
    left join public.partners partner on partner.id = assignment.partner_id
    left join public.hotels hotel
      on assignment.resource_type = 'hotels'
     and hotel.id = assignment.resource_id
    where assignment.resource_type = 'hotels'
      and (partner.id is null or hotel.id is null)
  ) then
    raise exception using
      errcode = '23503',
      message = 'hotels_v2_h3_2a_orphan_hotel_assignment';
  end if;
end
$h3_2a_preconditions$;

create temporary table hotels_v2_h3_2a_protected_before on commit drop as
select
  (select count(*) from public.hotels)::bigint as hotel_count,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.hotels row_value) as hotel_fingerprint,
  (select count(*) from public.hotel_bookings)::bigint as booking_count,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.hotel_bookings row_value) as booking_fingerprint,
  (select count(*) from public.partner_service_fulfillments row_value
   where row_value.resource_type = 'hotels')::bigint as fulfillment_count,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_service_fulfillments row_value
   where row_value.resource_type = 'hotels') as fulfillment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_resources row_value) as assignment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_user_resources row_value) as staff_scope_fingerprint,
  (select jsonb_build_object(
     'hotel_rooms_v2_enabled', setting.hotel_rooms_v2_enabled,
     'hotel_external_sync_enabled', setting.hotel_external_sync_enabled,
     'hotel_instant_booking_enabled', setting.hotel_instant_booking_enabled,
     'hotel_stripe_connect_enabled', setting.hotel_stripe_connect_enabled
   ) from public.site_settings setting where setting.id = 1) as feature_flags;

create temporary table hotels_v2_h3_2a_protected_relations_before(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

do $h3_2a_capture_protected_relations$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'service_deposit_requests',
    'service_deposit_rules',
    'service_deposit_overrides',
    'service_coupons',
    'service_coupon_redemptions',
    'hotel_room_types',
    'hotel_units',
    'hotel_rate_plans',
    'hotel_room_rates',
    'hotel_rate_rules',
    'hotel_daily_inventory',
    'hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers',
    'hotel_calendar_overrides',
    'hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items',
    'hotel_payment_policies',
    'hotel_payment_policy_terms',
    'hotel_commission_policies',
    'hotel_calendar_source_configs',
    'hotel_pricing_promotion_reviews',
    'referrals',
    'affiliate_commission_events',
    'affiliate_payouts',
    'affiliate_adjustments',
    'affiliate_program_settings',
    'affiliate_referrer_overrides',
    'affiliate_cashout_requests',
    'profile_referral_code_aliases'
  ] loop
    if to_regclass('public.' || v_relation) is not null then
      execute format(
        'insert into hotels_v2_h3_2a_protected_relations_before '
        ||'select %L,count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
        ||'from public.%I row_value',
        v_relation,
        v_relation
      );
    end if;
  end loop;
end
$h3_2a_capture_protected_relations$;

create temporary table hotels_v2_h3_2a_hotels_policies_before on commit drop as
select md5(coalesce(string_agg(jsonb_build_object(
  'policyname', policy.policyname,
  'permissive', policy.permissive,
  'roles', policy.roles,
  'cmd', policy.cmd,
  'qual', policy.qual,
  'with_check', policy.with_check
)::text, '|' order by policy.policyname), '')) as fingerprint
from pg_catalog.pg_policies policy
where policy.schemaname = 'public'
  and policy.tablename = 'hotels';

create function public.hotel_v2_h3_2a_jsonb_is_pii_free(p_value jsonb)
returns boolean
language plpgsql
security definer
immutable
set search_path = pg_catalog, public
as $function$
declare
  v_key text;
  v_child jsonb;
begin
  if p_value is null then
    return true;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      if lower(v_key) ~ '(customer|guest|contact|email|phone|password|secret|token|authorization|iban|bank_account|card_number|raw_request|request_body|reviewed_plan)' then
        return false;
      end if;
      if not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_child) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end
$function$;

revoke all on function public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)
  from public, anon, authenticated, service_role;

create unique index partner_resources_h3_2a_exact_assignment_uidx
  on public.partner_resources(id, partner_id, resource_type, resource_id);

create table public.hotel_partner_hotel_permissions (
  assignment_id uuid primary key,
  partner_id uuid not null references public.partners(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  resource_type text generated always as ('hotels'::text) stored,
  edit_property_content boolean not null default false,
  edit_property_photos boolean not null default false,
  edit_room_content boolean not null default false,
  edit_room_photos boolean not null default false,
  create_rooms boolean not null default false,
  edit_room_structure boolean not null default false,
  manage_prices boolean not null default false,
  manage_availability boolean not null default false,
  process_bookings boolean not null default false,
  request_booking_changes boolean not null default false,
  view_payment_status boolean not null default false,
  initiate_stripe_onboarding boolean not null default false,
  has_mutation_capability boolean generated always as (
    edit_property_content
    or edit_property_photos
    or edit_room_content
    or edit_room_photos
    or create_rooms
    or edit_room_structure
    or manage_prices
    or manage_availability
    or process_bookings
    or request_booking_changes
    or initiate_stripe_onboarding
  ) stored,
  version bigint not null default 1 check (version > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_partner_hotel_permissions_partner_hotel_key
    unique(partner_id, hotel_id),
  constraint hotel_partner_hotel_permissions_exact_assignment_fkey
    foreign key(assignment_id, partner_id, resource_type, hotel_id)
    references public.partner_resources(id, partner_id, resource_type, resource_id)
    on update restrict on delete cascade
);

create unique index hotel_partner_hotel_permissions_one_mutator_uidx
  on public.hotel_partner_hotel_permissions(hotel_id)
  where has_mutation_capability;

create index hotel_partner_hotel_permissions_partner_hotel_idx
  on public.hotel_partner_hotel_permissions(partner_id, hotel_id, assignment_id);

comment on table public.hotel_partner_hotel_permissions is
  'H3.2A exact-assignment Hotel Partner capabilities. No row or a false capability means denied; assignment row existence remains the operational assignment authority.';
comment on column public.hotel_partner_hotel_permissions.has_mutation_capability is
  'True for every capability except view_payment_status. A partial unique index permits at most one mutating operational assignment per Hotel.';

create table public.hotel_partner_action_receipts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  actor_user_id uuid not null,
  action text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  correlation_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_partner_action_receipts_partner_action_key
    unique(partner_id, action, idempotency_key),
  constraint hotel_partner_action_receipts_partner_correlation_key
    unique(partner_id, action, correlation_id),
  constraint hotel_partner_action_receipts_action_check check (
    action = lower(btrim(action))
    and length(action) between 1 and 120
    and action ~ '^[a-z0-9][a-z0-9_.-]*$'
  ),
  constraint hotel_partner_action_receipts_request_hash_check check (
    request_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint hotel_partner_action_receipts_result_check check (
    jsonb_typeof(result) = 'object'
    and octet_length(result::text) <= 131072
    and public.hotel_v2_h3_2a_jsonb_is_pii_free(result)
  )
);

create index hotel_partner_action_receipts_hotel_created_idx
  on public.hotel_partner_action_receipts(hotel_id, created_at desc, id);
create index hotel_partner_action_receipts_correlation_idx
  on public.hotel_partner_action_receipts(correlation_id, created_at, id);

comment on table public.hotel_partner_action_receipts is
  'Append-only PII-free idempotency receipts. Only request hashes and stable result envelopes are stored; reviewed request payloads are forbidden.';

create table public.hotel_partner_event_outbox (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default clock_timestamp(),
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_partner_event_outbox_aggregate_type_check check (
    aggregate_type = lower(btrim(aggregate_type))
    and length(aggregate_type) between 1 and 120
    and aggregate_type ~ '^[a-z0-9][a-z0-9_.-]*$'
  ),
  constraint hotel_partner_event_outbox_event_type_check check (
    event_type = lower(btrim(event_type))
    and length(event_type) between 1 and 160
    and event_type ~ '^[a-z0-9][a-z0-9_.-]*$'
  ),
  constraint hotel_partner_event_outbox_dedupe_key_check check (
    length(btrim(dedupe_key)) between 1 and 300
  ),
  constraint hotel_partner_event_outbox_payload_check check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 131072
    and public.hotel_v2_h3_2a_jsonb_is_pii_free(payload)
  ),
  constraint hotel_partner_event_outbox_status_check check (
    status in ('pending','processing','delivered','dead_letter')
  ),
  constraint hotel_partner_event_outbox_attempts_check check (attempts >= 0),
  constraint hotel_partner_event_outbox_lock_check check (
    (status = 'processing' and locked_at is not null and nullif(btrim(locked_by), '') is not null)
    or (status <> 'processing')
  ),
  constraint hotel_partner_event_outbox_processed_check check (
    (status = 'delivered' and processed_at is not null)
    or (status <> 'delivered')
  ),
  constraint hotel_partner_event_outbox_locked_by_check check (
    locked_by is null or locked_by ~ '^[a-zA-Z0-9_.:-]{1,160}$'
  ),
  constraint hotel_partner_event_outbox_last_error_check check (
    last_error is null or last_error ~ '^[a-z0-9][a-z0-9_.:-]{0,159}$'
  )
);

create index hotel_partner_event_outbox_claim_idx
  on public.hotel_partner_event_outbox(status, available_at, created_at, id)
  where status in ('pending','processing');
create index hotel_partner_event_outbox_hotel_created_idx
  on public.hotel_partner_event_outbox(hotel_id, created_at desc, id);

comment on table public.hotel_partner_event_outbox is
  'PII-free transactional Hotel Partner domain outbox. H3.2A emits permission changes only; service workers own delivery state.';

create trigger hotel_partner_hotel_permissions_set_updated_at_and_version
before update on public.hotel_partner_hotel_permissions
for each row execute function public.hotel_v2_set_updated_at_and_version();

create function public.hotel_v2_h3_2a_reject_immutable_change()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'hotels_v2_h3_2a_append_only_violation',
    detail = tg_table_schema || '.' || tg_table_name;
end
$function$;

create trigger hotel_partner_action_receipts_immutable
before update or delete on public.hotel_partner_action_receipts
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

create function public.hotel_v2_h3_2a_guard_outbox_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.id is distinct from old.id
     or new.partner_id is distinct from old.partner_id
     or new.hotel_id is distinct from old.hotel_id
     or new.aggregate_type is distinct from old.aggregate_type
     or new.aggregate_id is distinct from old.aggregate_id
     or new.event_type is distinct from old.event_type
     or new.dedupe_key is distinct from old.dedupe_key
     or new.payload is distinct from old.payload
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_outbox_event_immutable';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$function$;

create trigger hotel_partner_event_outbox_guard_update
before update on public.hotel_partner_event_outbox
for each row execute function public.hotel_v2_h3_2a_guard_outbox_update();
create trigger hotel_partner_event_outbox_reject_delete
before delete on public.hotel_partner_event_outbox
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

revoke all on function public.hotel_v2_h3_2a_reject_immutable_change()
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_h3_2a_guard_outbox_update()
  from public, anon, authenticated, service_role;

create function public.hotel_v2_h3_2a_capability_catalog()
returns text[]
language sql
immutable
set search_path = pg_catalog
as $function$
  select array[
    'edit_property_content',
    'edit_property_photos',
    'edit_room_content',
    'edit_room_photos',
    'create_rooms',
    'edit_room_structure',
    'manage_prices',
    'manage_availability',
    'process_bookings',
    'request_booking_changes',
    'view_payment_status',
    'initiate_stripe_onboarding'
  ]::text[];
$function$;

create function public.hotel_v2_h3_2a_capabilities_are_exact(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $function$
begin
  if jsonb_typeof(p_value) is distinct from 'object'
     or not (p_value ?& public.hotel_v2_h3_2a_capability_catalog()) then
    return false;
  end if;
  return not exists (
    select 1
    from jsonb_each(p_value) entry(key, value)
    where not (entry.key = any(public.hotel_v2_h3_2a_capability_catalog()))
       or jsonb_typeof(entry.value) is distinct from 'boolean'
  );
end;
$function$;

create function public.hotel_v2_h3_2a_permissions_snapshot(p_assignment_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select case when permission.assignment_id is null then
    jsonb_build_object(
      'exists', false,
      'version', 0,
      'updated_at', null,
      'has_mutation_capability', false,
      'capabilities', jsonb_build_object(
        'edit_property_content', false,
        'edit_property_photos', false,
        'edit_room_content', false,
        'edit_room_photos', false,
        'create_rooms', false,
        'edit_room_structure', false,
        'manage_prices', false,
        'manage_availability', false,
        'process_bookings', false,
        'request_booking_changes', false,
        'view_payment_status', false,
        'initiate_stripe_onboarding', false
      )
    )
  else
    jsonb_build_object(
      'exists', true,
      'version', permission.version,
      'updated_at', permission.updated_at,
      'has_mutation_capability', permission.has_mutation_capability,
      'capabilities', jsonb_build_object(
        'edit_property_content', permission.edit_property_content,
        'edit_property_photos', permission.edit_property_photos,
        'edit_room_content', permission.edit_room_content,
        'edit_room_photos', permission.edit_room_photos,
        'create_rooms', permission.create_rooms,
        'edit_room_structure', permission.edit_room_structure,
        'manage_prices', permission.manage_prices,
        'manage_availability', permission.manage_availability,
        'process_bookings', permission.process_bookings,
        'request_booking_changes', permission.request_booking_changes,
        'view_payment_status', permission.view_payment_status,
        'initiate_stripe_onboarding', permission.initiate_stripe_onboarding
      )
    )
  end
  from (select 1) singleton
  left join public.hotel_partner_hotel_permissions permission
    on permission.assignment_id = p_assignment_id;
$function$;

create function public.hotel_v2_h3_2a_effective_partner_permissions(
  p_assignment_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $function$
declare
  v_snapshot jsonb;
  v_capabilities jsonb;
  v_has_mutation boolean;
begin
  if p_role not in ('owner','staff') then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  v_snapshot := public.hotel_v2_h3_2a_permissions_snapshot(p_assignment_id);
  v_capabilities := v_snapshot->'capabilities';
  if p_role = 'staff' then
    -- Stripe onboarding always requires an owner at execution time. Mask it in
    -- the effective discovery envelope as well, so staff UI cannot mistake an
    -- assignment-level grant for an executable staff capability.
    v_capabilities := jsonb_set(
      v_capabilities,
      '{initiate_stripe_onboarding}',
      'false'::jsonb,
      false
    );
  end if;

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

  return jsonb_build_object(
    'exists', (v_snapshot->>'exists')::boolean,
    'version', (v_snapshot->>'version')::bigint,
    'has_mutation_capability', v_has_mutation,
    'capabilities', v_capabilities
  );
end
$function$;

create function public.hotel_v2_h3_2a_assignment_fingerprint(p_hotel_id uuid)
returns text
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'assignment_id', assignment.id,
    'partner_id', assignment.partner_id,
    'hotel_id', assignment.resource_id,
    'resource_type', assignment.resource_type,
    'created_at', assignment.created_at,
    'partner_status', partner.status,
    'can_manage_hotels', partner.can_manage_hotels
  )::text, '|' order by assignment.id), ''))
  from public.partner_resources assignment
  join public.partners partner on partner.id = assignment.partner_id
  where assignment.resource_type = 'hotels'
    and assignment.resource_id = p_hotel_id;
$function$;

create function public.hotel_v2_h3_2a_permissions_fingerprint(p_hotel_id uuid)
returns text
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'assignment_id', permission.assignment_id,
    'partner_id', permission.partner_id,
    'hotel_id', permission.hotel_id,
    'edit_property_content', permission.edit_property_content,
    'edit_property_photos', permission.edit_property_photos,
    'edit_room_content', permission.edit_room_content,
    'edit_room_photos', permission.edit_room_photos,
    'create_rooms', permission.create_rooms,
    'edit_room_structure', permission.edit_room_structure,
    'manage_prices', permission.manage_prices,
    'manage_availability', permission.manage_availability,
    'process_bookings', permission.process_bookings,
    'request_booking_changes', permission.request_booking_changes,
    'view_payment_status', permission.view_payment_status,
    'initiate_stripe_onboarding', permission.initiate_stripe_onboarding,
    'version', permission.version,
    'updated_at', permission.updated_at
  )::text, '|' order by permission.assignment_id), ''))
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id = p_hotel_id;
$function$;

create function public.hotel_v2_h3_2a_snapshot_token(p_hotel_id uuid)
returns text
language sql
security definer
stable
set search_path = pg_catalog, public
as $function$
  select md5(concat_ws('|',
    hotel.id::text,
    hotel.updated_at::text,
    public.hotel_v2_h3_2a_assignment_fingerprint(hotel.id),
    public.hotel_v2_h3_2a_permissions_fingerprint(hotel.id),
    setting.hotel_rooms_v2_enabled::text,
    setting.hotel_external_sync_enabled::text,
    setting.hotel_instant_booking_enabled::text,
    setting.hotel_stripe_connect_enabled::text
  ))
  from public.hotels hotel
  cross join public.site_settings setting
  where hotel.id = p_hotel_id
    and setting.id = 1;
$function$;

create function public.hotel_v2_h3_2a_require_partner_membership(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_membership public.partner_users%rowtype;
begin
  if p_partner_id is null or auth.uid() is null then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  select partner_user.* into v_membership
  from public.partner_users partner_user
  join public.partners partner on partner.id = partner_user.partner_id
  where partner_user.partner_id = p_partner_id
    and partner_user.user_id = auth.uid()
    and partner_user.role in ('owner','staff')
    and partner.status = 'active'
    and partner.can_manage_hotels;

  if not found then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  return jsonb_build_object('partner_user_id', v_membership.id, 'role', v_membership.role);
end
$function$;

create function public.hotel_v2_h3_2a_require_partner_hotel_access(
  p_partner_id uuid,
  p_hotel_id uuid,
  p_capability text default null,
  p_owner_only boolean default false
)
returns uuid
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_membership jsonb;
  v_partner_user_id uuid;
  v_role text;
  v_assignment_id uuid;
  v_allowed boolean;
begin
  if p_hotel_id is null then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  v_membership := public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  v_partner_user_id := (v_membership->>'partner_user_id')::uuid;
  v_role := v_membership->>'role';

  select assignment.id into v_assignment_id
  from public.partner_resources assignment
  where assignment.partner_id = p_partner_id
    and assignment.resource_type = 'hotels'
    and assignment.resource_id = p_hotel_id
    and (
      v_role = 'owner'
      or exists (
        select 1
        from public.partner_user_resources user_scope
        where user_scope.partner_user_id = v_partner_user_id
          and user_scope.resource_type = 'hotels'
          and user_scope.resource_id = p_hotel_id
      )
    );

  if v_assignment_id is null then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  if p_owner_only and v_role <> 'owner' then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  if p_capability is not null then
    if not (p_capability = any(public.hotel_v2_h3_2a_capability_catalog())) then
      raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_capability';
    end if;

    select case p_capability
      when 'edit_property_content' then permission.edit_property_content
      when 'edit_property_photos' then permission.edit_property_photos
      when 'edit_room_content' then permission.edit_room_content
      when 'edit_room_photos' then permission.edit_room_photos
      when 'create_rooms' then permission.create_rooms
      when 'edit_room_structure' then permission.edit_room_structure
      when 'manage_prices' then permission.manage_prices
      when 'manage_availability' then permission.manage_availability
      when 'process_bookings' then permission.process_bookings
      when 'request_booking_changes' then permission.request_booking_changes
      when 'view_payment_status' then permission.view_payment_status
      when 'initiate_stripe_onboarding' then permission.initiate_stripe_onboarding
      else false
    end into v_allowed
    from public.hotel_partner_hotel_permissions permission
    where permission.assignment_id = v_assignment_id
      and permission.partner_id = p_partner_id
      and permission.hotel_id = p_hotel_id;

    if not coalesce(v_allowed, false)
       or (p_capability = 'initiate_stripe_onboarding' and v_role <> 'owner') then
      raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
    end if;
  end if;

  if (select count(*) from public.site_settings) <> 1
     or exists (
    select 1 from public.site_settings setting
    where setting.id <> 1 or (
      setting.hotel_rooms_v2_enabled
      or setting.hotel_external_sync_enabled
      or setting.hotel_instant_booking_enabled
      or setting.hotel_stripe_connect_enabled
    )
  ) then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  return v_assignment_id;
end
$function$;

do $h3_2a_private_helper_acl$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_h3_2a_capability_catalog()',
    'public.hotel_v2_h3_2a_capabilities_are_exact(jsonb)',
    'public.hotel_v2_h3_2a_permissions_snapshot(uuid)',
    'public.hotel_v2_h3_2a_effective_partner_permissions(uuid,text)',
    'public.hotel_v2_h3_2a_assignment_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_permissions_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_snapshot_token(uuid)',
    'public.hotel_v2_h3_2a_require_partner_membership(uuid)',
    'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_signature::regprocedure);
  end loop;
end
$h3_2a_private_helper_acl$;

create function public.hotel_v2_admin_get_partner_hotel_permissions(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_hotel public.hotels%rowtype;
  v_flags jsonb;
  v_assignment_fingerprint text;
  v_permissions_fingerprint text;
  v_snapshot_token text;
  v_assignments jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode = '22023', message = 'hotels_v2_h3_2a_invalid_permission_query';
  end if;

  select * into v_hotel from public.hotels where id = p_hotel_id;
  if not found then
    raise exception using errcode = 'PT404', message = 'hotels_v2_h3_2a_property_not_found';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1) then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  select jsonb_build_object(
    'hotel_rooms_v2_enabled', setting.hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled', setting.hotel_external_sync_enabled,
    'hotel_instant_booking_enabled', setting.hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled', setting.hotel_stripe_connect_enabled
  ) into v_flags
  from public.site_settings setting where setting.id = 1;

  v_assignment_fingerprint := public.hotel_v2_h3_2a_assignment_fingerprint(p_hotel_id);
  v_permissions_fingerprint := public.hotel_v2_h3_2a_permissions_fingerprint(p_hotel_id);
  v_snapshot_token := public.hotel_v2_h3_2a_snapshot_token(p_hotel_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', assignment.id,
    'partner_id', assignment.partner_id,
    'hotel_id', assignment.resource_id,
    'assignment_active', true,
    'partner', jsonb_build_object(
      'id', partner.id,
      'name', partner.name,
      'status', partner.status,
      'can_manage_hotels', partner.can_manage_hotels
    ),
    'permission', public.hotel_v2_h3_2a_permissions_snapshot(assignment.id)
  ) order by partner.name, assignment.id), '[]'::jsonb)
  into v_assignments
  from public.partner_resources assignment
  join public.partners partner on partner.id = assignment.partner_id
  where assignment.resource_type = 'hotels'
    and assignment.resource_id = p_hotel_id;

  if (select count(*) from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id = p_hotel_id and permission.has_mutation_capability) > 1 then
    raise exception using errcode = '23514', message = 'hotels_v2_h3_2a_mutating_assignment_contract_corrupt';
  end if;

  return jsonb_build_object(
    'contract_version', 'hotels_v2_h3_2a_partner_permissions_v1',
    'property', jsonb_build_object(
      'id', v_hotel.id,
      'updated_at', v_hotel.updated_at,
      'architecture_version', v_hotel.architecture_version,
      'is_published', v_hotel.is_published,
      'status', v_hotel.status
    ),
    'feature_flags', v_flags,
    'capability_catalog', to_jsonb(public.hotel_v2_h3_2a_capability_catalog()),
    'assignment_fingerprint', v_assignment_fingerprint,
    'permissions_fingerprint', v_permissions_fingerprint,
    'snapshot_token', v_snapshot_token,
    'assignments', v_assignments
  );
end
$function$;

create function public.hotel_v2_partner_list_assigned_properties(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_membership jsonb;
  v_partner_user_id uuid;
  v_role text;
  v_properties jsonb;
  v_property_count integer;
begin
  v_membership := public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  v_partner_user_id := (v_membership->>'partner_user_id')::uuid;
  v_role := v_membership->>'role';

  if (select count(*) from public.site_settings) <> 1
     or exists (
    select 1 from public.site_settings setting
    where setting.id <> 1 or (
      setting.hotel_rooms_v2_enabled
      or setting.hotel_external_sync_enabled
      or setting.hotel_instant_booking_enabled
      or setting.hotel_stripe_connect_enabled
    )
  ) then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', assignment.id,
    'hotel_id', hotel.id,
    'slug', hotel.slug,
    'name_i18n', jsonb_build_object(
      'pl', coalesce(hotel.title_i18n->>'pl', hotel.title->>'pl', hotel.title_i18n->>'en', hotel.title->>'en', hotel.slug),
      'en', coalesce(hotel.title_i18n->>'en', hotel.title->>'en', hotel.title_i18n->>'pl', hotel.title->>'pl', hotel.slug),
      'he', coalesce(hotel.title_i18n->>'he', hotel.title->>'he', hotel.title_i18n->>'en', hotel.title->>'en', hotel.slug)
    ),
    'city', hotel.city,
    'cover_image_url', hotel.cover_image_url,
    'foundation_status', 'foundation_only',
    'workspace_available', false,
    'permission', public.hotel_v2_h3_2a_effective_partner_permissions(assignment.id, v_role)
  ) order by hotel.sort_order, hotel.id), '[]'::jsonb)
  into v_properties
  from public.partner_resources assignment
  join public.hotels hotel on hotel.id = assignment.resource_id
  where assignment.partner_id = p_partner_id
    and assignment.resource_type = 'hotels'
    and (
      v_role = 'owner'
      or exists (
        select 1
        from public.partner_user_resources user_scope
        where user_scope.partner_user_id = v_partner_user_id
          and user_scope.resource_type = 'hotels'
          and user_scope.resource_id = hotel.id
      )
    );

  v_property_count := jsonb_array_length(v_properties);
  if v_property_count = 0 then
    -- Discovery never turns a missing exact assignment/scope into a successful
    -- empty workspace. Owners need an assignment; staff additionally need at
    -- least one exact Hotel scope.
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  return jsonb_build_object(
    'contract_version', 'hotels_v2_h3_2a_partner_permissions_v1',
    'partner', jsonb_build_object('id', p_partner_id, 'role', v_role),
    'foundation_only', true,
    'workspace_available', false,
    'properties', v_properties
  );
end
$function$;

create function public.hotel_v2_admin_apply_partner_hotel_permissions(
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
  v_request_hash := encode(digest(convert_to(p_plan::text, 'UTF8'), 'sha256'), 'hex');

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

comment on function public.hotel_v2_admin_get_partner_hotel_permissions(uuid) is
  'Admin-only exact Hotel assignment/capability Review snapshot. It creates no assignment and exposes no customer booking PII.';
comment on function public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid) is
  'Admin-only reviewed, optimistic and idempotent exact-assignment capability save. State, activity, receipt and PII-free outbox event commit atomically.';
comment on function public.hotel_v2_partner_list_assigned_properties(uuid) is
  'Partner-safe H3.2A assigned-property discovery. Owner access remains exact-assignment; staff additionally needs exact partner_user_resources Hotel scope. Workspace remains unavailable.';

-- Raw relations are never an API surface. All three H3.2A relations remain
-- policy-empty and are reachable only through the fixed-path definer RPCs.
alter table public.hotel_partner_hotel_permissions enable row level security;
alter table public.hotel_partner_action_receipts enable row level security;
alter table public.hotel_partner_event_outbox enable row level security;

revoke all on table public.hotel_partner_hotel_permissions
  from public, anon, authenticated, service_role;
revoke all on table public.hotel_partner_action_receipts
  from public, anon, authenticated, service_role;
revoke all on table public.hotel_partner_event_outbox
  from public, anon, authenticated, service_role;

revoke all on function public.hotel_v2_admin_get_partner_hotel_permissions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_partner_list_assigned_properties(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.hotel_v2_admin_get_partner_hotel_permissions(uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)
  to authenticated;
grant execute on function public.hotel_v2_partner_list_assigned_properties(uuid)
  to authenticated;

alter table public.hotel_partner_hotel_permissions owner to postgres;
alter table public.hotel_partner_action_receipts owner to postgres;
alter table public.hotel_partner_event_outbox owner to postgres;

do $h3_2a_function_owners$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',
    'public.hotel_v2_h3_2a_reject_immutable_change()',
    'public.hotel_v2_h3_2a_guard_outbox_update()',
    'public.hotel_v2_h3_2a_capability_catalog()',
    'public.hotel_v2_h3_2a_capabilities_are_exact(jsonb)',
    'public.hotel_v2_h3_2a_permissions_snapshot(uuid)',
    'public.hotel_v2_h3_2a_effective_partner_permissions(uuid,text)',
    'public.hotel_v2_h3_2a_assignment_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_permissions_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_snapshot_token(uuid)',
    'public.hotel_v2_h3_2a_require_partner_membership(uuid)',
    'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
    'public.hotel_v2_admin_get_partner_hotel_permissions(uuid)',
    'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_list_assigned_properties(uuid)'
  ] loop
    execute format('alter function %s owner to postgres', v_signature::regprocedure);
  end loop;
end
$h3_2a_function_owners$;

do $h3_2a_postconditions$
declare
  v_table text;
  v_signature text;
  v_columns text[];
  v_before hotels_v2_h3_2a_protected_before%rowtype;
  v_after hotels_v2_h3_2a_protected_before%rowtype;
  v_relation record;
  v_relation_count bigint;
  v_relation_fingerprint text;
  v_policy_fingerprint text;
begin
  select * into strict v_before from hotels_v2_h3_2a_protected_before;

  select
    (select count(*) from public.hotels)::bigint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
     from public.hotels row_value),
    (select count(*) from public.hotel_bookings)::bigint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
     from public.hotel_bookings row_value),
    (select count(*) from public.partner_service_fulfillments row_value
     where row_value.resource_type = 'hotels')::bigint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
     from public.partner_service_fulfillments row_value
     where row_value.resource_type = 'hotels'),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
     from public.partner_resources row_value),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
     from public.partner_user_resources row_value),
    (select jsonb_build_object(
       'hotel_rooms_v2_enabled', setting.hotel_rooms_v2_enabled,
       'hotel_external_sync_enabled', setting.hotel_external_sync_enabled,
       'hotel_instant_booking_enabled', setting.hotel_instant_booking_enabled,
       'hotel_stripe_connect_enabled', setting.hotel_stripe_connect_enabled
     ) from public.site_settings setting where setting.id = 1)
  into v_after;

  if v_after is distinct from v_before then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_protected_state_changed';
  end if;

  for v_relation in select * from hotels_v2_h3_2a_protected_relations_before loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
      ||'from public.%I row_value',
      v_relation.relation_name
    ) into v_relation_count, v_relation_fingerprint;
    if v_relation_count is distinct from v_relation.row_count
       or v_relation_fingerprint is distinct from v_relation.fingerprint then
      raise exception using
        errcode = '55000',
        message = 'hotels_v2_h3_2a_protected_relation_changed',
        detail = v_relation.relation_name;
    end if;
  end loop;

  select md5(coalesce(string_agg(jsonb_build_object(
    'policyname', policy.policyname,
    'permissive', policy.permissive,
    'roles', policy.roles,
    'cmd', policy.cmd,
    'qual', policy.qual,
    'with_check', policy.with_check
  )::text, '|' order by policy.policyname), ''))
  into v_policy_fingerprint
  from pg_catalog.pg_policies policy
  where policy.schemaname = 'public'
    and policy.tablename = 'hotels';
  if v_policy_fingerprint is distinct from (
       select fingerprint from hotels_v2_h3_2a_hotels_policies_before
     ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_legacy_hotels_policy_changed';
  end if;

  if (select count(*) from public.hotel_partner_hotel_permissions) <> 0
     or (select count(*) from public.hotel_partner_action_receipts) <> 0
     or (select count(*) from public.hotel_partner_event_outbox) <> 0 then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_foundation_not_empty';
  end if;

  if to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_media_assets') is not null
     or to_regclass('public.hotel_booking_change_requests') is not null
     or to_regclass('public.partner_payment_accounts') is not null
     or to_regclass('public.partner_payment_account_events') is not null then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h3_2a_deferred_boundary_violated';
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'hotel_partner_hotel_permissions';
  if v_columns is distinct from array[
    'assignment_id','partner_id','hotel_id','resource_type',
    'edit_property_content','edit_property_photos','edit_room_content','edit_room_photos',
    'create_rooms','edit_room_structure','manage_prices','manage_availability',
    'process_bookings','request_booking_changes','view_payment_status','initiate_stripe_onboarding',
    'has_mutation_capability','version','created_by','updated_by','created_at','updated_at'
  ]::text[] then
    raise exception using errcode = '42703', message = 'hotels_v2_h3_2a_permission_columns_mismatch';
  end if;

  if not exists (
       select 1 from pg_catalog.pg_indexes
       where schemaname = 'public'
         and tablename = 'hotel_partner_hotel_permissions'
         and indexname = 'hotel_partner_hotel_permissions_one_mutator_uidx'
         and indexdef like '%UNIQUE INDEX%WHERE has_mutation_capability'
     )
     or not exists (
       select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.hotel_partner_action_receipts'::regclass
         and conname = 'hotel_partner_action_receipts_partner_correlation_key'
         and contype = 'u'
     ) then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_uniqueness_contract_missing';
  end if;

  foreach v_table in array array[
    'hotel_partner_hotel_permissions',
    'hotel_partner_action_receipts',
    'hotel_partner_event_outbox'
  ] loop
    if not exists (
         select 1 from pg_catalog.pg_class relation
         join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
         where namespace.nspname = 'public'
           and relation.relname = v_table
           and relation.relrowsecurity
           and pg_get_userbyid(relation.relowner) = 'postgres'
       )
       or exists (
         select 1 from pg_catalog.pg_policy policy
         where policy.polrelid = format('public.%I', v_table)::regclass
       )
       or has_table_privilege(0::oid, format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'DELETE')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'INSERT')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'UPDATE')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'DELETE') then
      raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_raw_table_acl_mismatch', detail = v_table;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_partner_hotel_permissions(uuid)',
    'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_list_assigned_properties(uuid)'
  ] loop
    if not exists (
         select 1 from pg_catalog.pg_proc procedure
         where procedure.oid = v_signature::regprocedure
           and procedure.prokind = 'f'
           and procedure.prosecdef
           and pg_get_userbyid(procedure.proowner) = 'postgres'
           and procedure.proconfig @> array['search_path=pg_catalog, public, auth']
       )
       or has_function_privilege(0::oid, v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('anon', v_signature::regprocedure, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('service_role', v_signature::regprocedure, 'EXECUTE') then
      raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_public_rpc_acl_mismatch', detail = v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',
    'public.hotel_v2_h3_2a_reject_immutable_change()',
    'public.hotel_v2_h3_2a_guard_outbox_update()',
    'public.hotel_v2_h3_2a_capability_catalog()',
    'public.hotel_v2_h3_2a_capabilities_are_exact(jsonb)',
    'public.hotel_v2_h3_2a_permissions_snapshot(uuid)',
    'public.hotel_v2_h3_2a_effective_partner_permissions(uuid,text)',
    'public.hotel_v2_h3_2a_assignment_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_permissions_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_snapshot_token(uuid)',
    'public.hotel_v2_h3_2a_require_partner_membership(uuid)',
    'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'
  ] loop
    if has_function_privilege(0::oid, v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('anon', v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('authenticated', v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('service_role', v_signature::regprocedure, 'EXECUTE')
       or not exists (
         select 1 from pg_catalog.pg_proc procedure
         where procedure.oid = v_signature::regprocedure
           and pg_get_userbyid(procedure.proowner) = 'postgres'
       ) then
      raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_private_function_acl_mismatch', detail = v_signature;
    end if;
  end loop;

  if not exists (
       select 1 from pg_catalog.pg_proc procedure
       where procedure.oid = 'public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)'::regprocedure
         and procedure.prosecdef
         and procedure.provolatile = 'i'
         and procedure.proconfig @> array['search_path=pg_catalog, public']
     ) then
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_pii_guard_contract_mismatch';
  end if;
end
$h3_2a_postconditions$;

notify pgrst, 'reload schema';
commit;
