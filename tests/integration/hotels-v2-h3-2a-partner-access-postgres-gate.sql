\set ON_ERROR_STOP on
\ir hotels-v2-h3-2a-partner-access-postgrest-base.sql

create temporary table h32a_protected_before on commit preserve rows as
select
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.hotels row_value) hotel_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.hotel_bookings row_value) booking_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_service_fulfillments row_value where resource_type = 'hotels') fulfillment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.service_deposit_requests row_value where resource_type = 'hotels') deposit_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.service_coupon_redemptions row_value where service_type = 'hotels') coupon_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_resources row_value) assignment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.partner_user_resources row_value) staff_scope_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
   from public.hotel_pricing_promotion_reviews row_value) promotion_fingerprint,
  (select to_jsonb(row_value) from public.site_settings row_value where id = 1) flags;

create temporary table h32a_protected_relations_before(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit preserve rows;

do $capture_relations$
declare v_relation text;
begin
  foreach v_relation in array array[
    'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
    'service_coupons','service_coupon_redemptions',
    'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides',
    'affiliate_cashout_requests','profile_referral_code_aliases'
  ] loop
    if to_regclass('public.' || v_relation) is not null then
      execute format(
        'insert into h32a_protected_relations_before '
        ||'select %L,count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
        ||'from public.%I row_value', v_relation, v_relation
      );
    end if;
  end loop;
end
$capture_relations$;

create temporary table h32a_hotels_policies_before on commit preserve rows as
select md5(coalesce(string_agg(jsonb_build_object(
  'policyname', policyname,'permissive',permissive,'roles',roles,
  'cmd',cmd,'qual',qual,'with_check',with_check
)::text, '|' order by policyname), '')) fingerprint
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'hotels';

create function pg_temp.h32a_admin_plan(
  p_hotel_id uuid,
  p_assignment_id uuid,
  p_partner_id uuid,
  p_expected_version bigint,
  p_edit_property_content boolean default false,
  p_view_payment_status boolean default false,
  p_stripe boolean default false
)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public, pg_temp
as $function$
  select jsonb_build_object(
    'contract_version', 'hotels_v2_h3_2a_partner_permissions_v1',
    'decision', 'apply_partner_hotel_permissions',
    'hotel_id', p_hotel_id,
    'assignment_id', p_assignment_id,
    'partner_id', p_partner_id,
    'reviewed_at', clock_timestamp(),
    'snapshot_token', snapshot.value->>'snapshot_token',
    'expected_assignment_fingerprint', snapshot.value->>'assignment_fingerprint',
    'expected_permission_version', p_expected_version,
    'capabilities', jsonb_build_object(
      'edit_property_content', p_edit_property_content,
      'edit_property_photos', false,
      'edit_room_content', false,
      'edit_room_photos', false,
      'create_rooms', false,
      'edit_room_structure', false,
      'manage_prices', false,
      'manage_availability', false,
      'process_bookings', false,
      'request_booking_changes', false,
      'view_payment_status', p_view_payment_status,
      'initiate_stripe_onboarding', p_stripe
    )
  )
  from (select public.hotel_v2_admin_get_partner_hotel_permissions(p_hotel_id) value) snapshot;
$function$;

do $schema_acl$
declare v_table text;
begin
  if to_regclass('public.hotel_partner_hotel_permissions') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_partner_event_outbox') is null
     or to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_media_assets') is not null
     or to_regclass('public.hotel_booking_change_requests') is not null
     or to_regclass('public.partner_payment_accounts') is not null
     or to_regclass('public.partner_payment_account_events') is not null
     or (select count(*) from public.hotel_partner_hotel_permissions) <> 0
     or (select count(*) from public.hotel_partner_action_receipts) <> 0
     or (select count(*) from public.hotel_partner_event_outbox) <> 0 then
    raise exception 'h32a_schema_boundary_failed';
  end if;

  foreach v_table in array array[
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox'
  ] loop
    if has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
       or exists (select 1 from pg_catalog.pg_policy
         where polrelid = format('public.%I', v_table)::regclass) then
      raise exception 'h32a_raw_acl_failed:%', v_table;
    end if;
  end loop;

  if has_function_privilege('anon',
       'public.hotel_v2_partner_list_assigned_properties(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_partner_list_assigned_properties(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)', 'EXECUTE') then
    raise exception 'h32a_function_acl_failed';
  end if;
end
$schema_acl$;

do $authorization_denials$
declare v_denied boolean;
begin
  v_denied := false;
  begin
    set local role anon;
    perform public.hotel_v2_partner_list_assigned_properties(
      '20000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'h32a_anon_was_allowed'; end if;

  v_denied := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
    perform public.hotel_v2_admin_get_partner_hotel_permissions(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'h32a_non_admin_was_allowed'; end if;
end
$authorization_denials$;

do $admin_apply_replay_conflicts$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_assignment constant uuid := '32000000-0000-4000-8000-000000000001';
  c_partner constant uuid := '20000000-0000-4000-8000-000000000001';
  c_correlation constant uuid := '35000000-0000-4000-8000-000000000001';
  c_idempotency constant uuid := '36000000-0000-4000-8000-000000000001';
  v_plan jsonb;
  v_result jsonb;
  v_failed boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  v_plan := pg_temp.h32a_admin_plan(c_hotel, c_assignment, c_partner, 0, true, true, false);
  v_result := public.hotel_v2_admin_apply_partner_hotel_permissions(
    v_plan, c_correlation, c_idempotency);
  reset role;
  if not (v_result->>'ok')::boolean
     or (v_result->>'replayed')::boolean
     or not (v_result->>'changed')::boolean
     or (v_result#>>'{permission,version}')::bigint <> 1
     or (select count(*) from public.hotel_partner_action_receipts) <> 1
     or (select count(*) from public.hotel_partner_event_outbox) <> 1
     or (select count(*) from public.hotel_activity_log where correlation_id = c_correlation) <> 1
     or exists (select 1 from public.hotel_partner_action_receipts
       where result ? 'snapshot' or result::text ~* '(customer|email|phone|snapshot_token)') then
    raise exception 'h32a_initial_apply_failed:%', v_result;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  v_result := public.hotel_v2_admin_apply_partner_hotel_permissions(
    v_plan, c_correlation, c_idempotency);
  reset role;
  if not (v_result->>'replayed')::boolean
     or (select count(*) from public.hotel_partner_action_receipts) <> 1
     or (select count(*) from public.hotel_partner_event_outbox) <> 1
     or (select count(*) from public.hotel_activity_log where correlation_id = c_correlation) <> 1 then
    raise exception 'h32a_stable_replay_failed';
  end if;

  v_failed := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    perform public.hotel_v2_admin_apply_partner_hotel_permissions(
      jsonb_set(v_plan, '{capabilities,edit_property_content}', 'false'::jsonb),
      gen_random_uuid(), c_idempotency);
  exception when sqlstate 'PT409' then
    if sqlerrm = 'hotels_v2_h3_2a_idempotency_key_reused' then v_failed := true; else raise; end if;
  end;
  reset role;
  if not v_failed then raise exception 'h32a_idempotency_reuse_not_blocked'; end if;

  v_failed := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    perform public.hotel_v2_admin_apply_partner_hotel_permissions(
      jsonb_set(v_plan, '{capabilities,edit_property_content}', 'false'::jsonb),
      c_correlation, gen_random_uuid());
  exception when sqlstate 'PT409' then
    if sqlerrm = 'hotels_v2_h3_2a_correlation_reused' then v_failed := true; else raise; end if;
  end;
  reset role;
  if not v_failed then raise exception 'h32a_correlation_reuse_not_blocked'; end if;

  v_failed := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    perform public.hotel_v2_admin_apply_partner_hotel_permissions(
      pg_temp.h32a_admin_plan(c_hotel, c_assignment, c_partner, 0, false, true, false),
      gen_random_uuid(), gen_random_uuid());
  exception when sqlstate 'PT409' then
    if sqlerrm = 'hotels_v2_h3_2a_stale_partner_permissions' then v_failed := true; else raise; end if;
  end;
  reset role;
  if not v_failed then raise exception 'h32a_stale_version_not_blocked'; end if;
end
$admin_apply_replay_conflicts$;

do $partner_isolation$
declare v_list jsonb; v_denied boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
  v_list := public.hotel_v2_partner_list_assigned_properties(
    '20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v_list->'properties') <> 2
     or (v_list->>'workspace_available')::boolean
     or v_list::text ~* '(architecture_version|feature_flags|owner_partner|commission|payment_policy|booking_record|customer|contact)'
     or exists (
       select 1 from jsonb_array_elements(v_list->'properties') property(value)
       where (select array_agg(key order by key) from jsonb_object_keys(property.value->'name_i18n') key)
         is distinct from array['en','he','pl']::text[]
          or (select array_agg(key order by key) from jsonb_object_keys(property.value->'permission') key)
         is distinct from array['capabilities','exists','has_mutation_capability','version']::text[]
     ) then
    raise exception 'h32a_owner_list_contract_failed:%', v_list;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
  v_list := public.hotel_v2_partner_list_assigned_properties(
    '20000000-0000-4000-8000-000000000001');
  if jsonb_array_length(v_list->'properties') <> 1
     or v_list#>>'{properties,0,hotel_id}' <> '9b6d99a0-923a-4fbc-be54-c066e856e6ca' then
    raise exception 'h32a_staff_exact_scope_failed:%', v_list;
  end if;

  v_denied := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
    perform public.hotel_v2_partner_list_assigned_properties(
      '20000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'h32a_unscoped_staff_was_allowed'; end if;

  v_denied := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
    perform public.hotel_v2_partner_list_assigned_properties(
      '20000000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'h32a_unassigned_owner_was_allowed'; end if;
end
$partner_isolation$;

do $stripe_owner_mask_and_single_mutator$
declare v_plan jsonb; v_list jsonb; v_failed boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  v_plan := pg_temp.h32a_admin_plan(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    '32000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001', 1, false, false, true);
  perform public.hotel_v2_admin_apply_partner_hotel_permissions(
    v_plan, '35000000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-000000000002');

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
  v_list := public.hotel_v2_partner_list_assigned_properties(
    '20000000-0000-4000-8000-000000000001');
  if (v_list#>>'{properties,0,permission,capabilities,initiate_stripe_onboarding}')::boolean
     or (v_list#>>'{properties,0,permission,has_mutation_capability}')::boolean then
    raise exception 'h32a_staff_stripe_mask_failed:%', v_list;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  perform public.hotel_v2_admin_apply_partner_hotel_permissions(
    pg_temp.h32a_admin_plan(
      'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
      '32000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001', 0, true, false, false),
    '35000000-0000-4000-8000-000000000003', '36000000-0000-4000-8000-000000000003');

  v_failed := false;
  begin
    perform public.hotel_v2_admin_apply_partner_hotel_permissions(
      pg_temp.h32a_admin_plan(
        'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
        '32000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000005', 0, true, false, false),
      '35000000-0000-4000-8000-000000000004', '36000000-0000-4000-8000-000000000004');
  exception when sqlstate 'PT409' then
    if sqlerrm = 'hotels_v2_h3_2a_mutating_assignment_conflict' then v_failed := true; else raise; end if;
  end;
  if not v_failed then raise exception 'h32a_second_mutator_was_allowed'; end if;
end
$stripe_owner_mask_and_single_mutator$;

do $protected_state$
declare
  v_before h32a_protected_before%rowtype;
  v_after h32a_protected_before%rowtype;
  v_relation record;
  v_count bigint;
  v_fingerprint text;
begin
  select * into strict v_before from h32a_protected_before;
  select
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotels row_value),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_bookings row_value),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.partner_service_fulfillments row_value where resource_type = 'hotels'),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.service_deposit_requests row_value where resource_type = 'hotels'),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.service_coupon_redemptions row_value where service_type = 'hotels'),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.partner_resources row_value),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.partner_user_resources row_value),
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_pricing_promotion_reviews row_value),
    (select to_jsonb(row_value) from public.site_settings row_value where id = 1)
  into v_after;
  if v_after is distinct from v_before then raise exception 'h32a_protected_state_changed'; end if;

  for v_relation in select * from h32a_protected_relations_before loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
      ||'from public.%I row_value', v_relation.relation_name
    ) into v_count, v_fingerprint;
    if v_count is distinct from v_relation.row_count
       or v_fingerprint is distinct from v_relation.fingerprint then
      raise exception 'h32a_protected_relation_changed:%', v_relation.relation_name;
    end if;
  end loop;

  select md5(coalesce(string_agg(jsonb_build_object(
    'policyname',policyname,'permissive',permissive,'roles',roles,
    'cmd',cmd,'qual',qual,'with_check',with_check
  )::text, '|' order by policyname), ''))
  into v_fingerprint
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels';
  if v_fingerprint is distinct from (select fingerprint from h32a_hotels_policies_before) then
    raise exception 'h32a_legacy_hotels_policy_changed';
  end if;
end
$protected_state$;

select
  (select count(*) from public.hotel_partner_hotel_permissions) = 2
  and (select count(*) from public.hotel_partner_action_receipts) = 3
  and (select count(*) from public.hotel_partner_event_outbox) = 3
  and (select count(*) from public.hotel_partner_hotel_permissions where has_mutation_capability) = 2
  and not exists (select 1 from public.site_settings where id = 1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  ))
  as hotels_v2_h3_2a_partner_access_postgres_gate_pass;
