\set ON_ERROR_STOP on

-- Disposable post-114370/pre-114400 production-shaped payment-policy
-- evolution.  Every term state is written through the accepted reviewed Admin
-- H3.1 RPC and recorded in hotel_activity_log; no fixture row is patched into
-- the payment tables directly.

create function pg_temp.seven_arches_payment_policy_activity_plan(
  p_action text,
  p_term_1_id uuid,
  p_term_2_id uuid,
  p_term_1_methods text[],
  p_term_2_methods text[]
)
returns jsonb
language sql
volatile
security definer
set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'hotel_id',hotel.id,
  'expected_property_updated_at',hotel.updated_at,
  'reviewed_at',clock_timestamp(),
  'operations',jsonb_build_array(jsonb_build_object(
    'entity','payment_policy','type',p_action,
    'id','38600000-0000-4000-8000-000000000001',
    'expected_version',case when p_action='create' then 0 else policy.version end,
    'expected_children_fingerprint',case when p_action='create' then null
      else public.hotel_v2_h3_1_payment_terms_fingerprint(policy.id) end,
    'payload',jsonb_build_object(
      'code','seven-kamares-request-confirmation',
      'name_i18n',jsonb_build_object('en','7 Arches request confirmation'),
      'currency','EUR','is_active',true,'review_status','reviewed',
      'terms',jsonb_build_array(
        jsonb_build_object(
          'id',p_term_1_id,'sequence',1,
          'due_event','after_partner_acceptance','amount_mode','percent_total',
          'amount_value',50,'recipient','partner',
          'payment_methods',to_jsonb(p_term_1_methods),
          'instructions_i18n',jsonb_build_object()),
        jsonb_build_object(
          'id',p_term_2_id,'sequence',2,
          'due_event','on_arrival','amount_mode','remaining_balance',
          'amount_value',null,'recipient','partner',
          'payment_methods',to_jsonb(p_term_2_methods),
          'instructions_i18n',jsonb_build_object())
      )
    )
  ))
)
from public.hotels hotel
left join public.hotel_payment_policies policy
  on policy.id='38600000-0000-4000-8000-000000000001'
where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
$function$;

create temporary table seven_arches_payment_policy_fixture_capability
on commit preserve rows as
select setting.hotel_external_sync_enabled original_external_sync_enabled
from public.site_settings setting
where setting.id=1;

do $seven_arches_payment_policy_activity_prerequisites$
begin
  if (select count(*) from seven_arches_payment_policy_fixture_capability)<>1
     or (select count(*) from public.hotel_payment_policies policy
       where policy.id='38600000-0000-4000-8000-000000000001'
         and policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
         and policy.code='seven-kamares-request-confirmation'
         and policy.currency='EUR' and policy.is_active
         and policy.review_status='reviewed' and policy.version=1)<>1
     or (select count(*) from public.hotel_payment_policy_terms term
       where term.payment_policy_id='38600000-0000-4000-8000-000000000001')<>2
     or (select count(*) from public.hotel_activity_log activity
       where activity.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
         and activity.entity_type='payment_policy'
         and activity.entity_id='38600000-0000-4000-8000-000000000001'
         and activity.action='create' and activity.actor_type='admin'
         and activity.actor_id='10000000-0000-4000-8000-000000000001'
         and activity.source='hotels_v2_h3_1_admin_configuration'
         and activity.correlation_id='38610000-0000-4000-8000-000000000001')<>1
     or exists(select 1 from public.site_settings setting where setting.id=1
       and (setting.hotel_rooms_v2_enabled
         or setting.hotel_instant_booking_enabled
         or setting.hotel_stripe_connect_enabled)) then
    raise exception using errcode='55000',
      message='seven_arches_payment_policy_activity_fixture_prerequisite_failed';
  end if;
end
$seven_arches_payment_policy_activity_prerequisites$;

-- Activity 2: the accepted Admin workflow introduces the expanded, inert
-- configuration metadata found in production.
begin;
update public.site_settings setting
set hotel_external_sync_enabled=false
where setting.id=1 and setting.hotel_external_sync_enabled;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $seven_arches_payment_policy_activity_update_one$
begin
  perform public.hotel_v2_admin_apply_h3_1_configuration(
    pg_temp.seven_arches_payment_policy_activity_plan(
      'update',
      '38600000-0000-4000-8000-000000000004',
      '38600000-0000-4000-8000-000000000005',
      array['bank_transfer','card','online'],array['bank_transfer','card','cash']),
    '38610000-0000-4000-8000-000000000002'
  );
end
$seven_arches_payment_policy_activity_update_one$;
reset role;
update public.site_settings setting
set hotel_external_sync_enabled=capability.original_external_sync_enabled
from seven_arches_payment_policy_fixture_capability capability
where setting.id=1;
commit;

-- Activity 3: the same reviewed workflow deliberately recreates the exact
-- expanded state.  New term identities and version=1 prove the accepted
-- delete-and-recreate behavior rather than an unattributed raw-table update.
begin;
update public.site_settings setting
set hotel_external_sync_enabled=false
where setting.id=1 and setting.hotel_external_sync_enabled;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $seven_arches_payment_policy_activity_update_two$
begin
  perform public.hotel_v2_admin_apply_h3_1_configuration(
    pg_temp.seven_arches_payment_policy_activity_plan(
      'update',
      '38600000-0000-4000-8000-000000000006',
      '38600000-0000-4000-8000-000000000007',
      array['bank_transfer','card','online'],array['bank_transfer','card','cash']),
    '38610000-0000-4000-8000-000000000003'
  );
end
$seven_arches_payment_policy_activity_update_two$;
reset role;
update public.site_settings setting
set hotel_external_sync_enabled=capability.original_external_sync_enabled
from seven_arches_payment_policy_fixture_capability capability
where setting.id=1;
commit;

do $seven_arches_payment_policy_activity_chain_exact$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_policy constant uuid:='38600000-0000-4000-8000-000000000001';
  v_activity_1 public.hotel_activity_log%rowtype;
  v_activity_2 public.hotel_activity_log%rowtype;
  v_activity_3 public.hotel_activity_log%rowtype;
  v_current jsonb;
begin
  select activity.* into strict v_activity_1
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
    and activity.entity_id=c_policy
  order by activity.created_at,activity.id limit 1 offset 0;
  select activity.* into strict v_activity_2
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
    and activity.entity_id=c_policy
  order by activity.created_at,activity.id limit 1 offset 1;
  select activity.* into strict v_activity_3
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
    and activity.entity_id=c_policy
  order by activity.created_at,activity.id limit 1 offset 2;

  select to_jsonb(policy)||jsonb_build_object(
    'terms',(select jsonb_agg(to_jsonb(term) order by term.sequence,term.id)
      from public.hotel_payment_policy_terms term where term.payment_policy_id=c_policy))
  into strict v_current
  from public.hotel_payment_policies policy where policy.id=c_policy;

  if (select count(*) from public.hotel_activity_log activity
       where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
         and activity.entity_id=c_policy)<>3
     or (select count(distinct activity.correlation_id)
       from public.hotel_activity_log activity
       where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
         and activity.entity_id=c_policy)<>3
     or v_activity_1.action<>'create'
     or v_activity_2.action<>'update' or v_activity_3.action<>'update'
     or exists(select 1 from public.hotel_activity_log activity
       where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
         and activity.entity_id=c_policy
         and (activity.source<>'hotels_v2_h3_1_admin_configuration'
           or activity.actor_type<>'admin'
           or activity.actor_id<>'10000000-0000-4000-8000-000000000001'))
     or v_activity_1.before_state is not null
     or v_activity_1.after_state is distinct from v_activity_2.before_state
     or v_activity_2.after_state is distinct from v_activity_3.before_state
     or v_activity_3.after_state is distinct from v_current
     or (v_activity_1.after_state->>'version')::bigint<>1
     or (v_activity_2.after_state->>'version')::bigint<>2
     or (v_activity_3.after_state->>'version')::bigint<>3
     or v_activity_1.after_state#>'{terms,0,payment_methods}'
       is distinct from '["bank_transfer"]'::jsonb
     or v_activity_1.after_state#>'{terms,1,payment_methods}'
       is distinct from '["card","cash"]'::jsonb
     or v_activity_2.after_state#>'{terms,0,payment_methods}'
       is distinct from '["bank_transfer","card","online"]'::jsonb
     or v_activity_2.after_state#>'{terms,1,payment_methods}'
       is distinct from '["bank_transfer","card","cash"]'::jsonb
     or v_activity_3.after_state#>'{terms,0,payment_methods}'
       is distinct from '["bank_transfer","card","online"]'::jsonb
     or v_activity_3.after_state#>'{terms,1,payment_methods}'
       is distinct from '["bank_transfer","card","cash"]'::jsonb
     or (select count(*) from public.hotel_payment_policy_terms term
       where term.payment_policy_id=c_policy and term.version=1
         and term.id in(
           '38600000-0000-4000-8000-000000000006',
           '38600000-0000-4000-8000-000000000007'))<>2
     or exists(select 1
       from public.hotel_activity_log activity
       join public.hotel_payment_policies policy on policy.id=activity.entity_id
       where activity.correlation_id='38610000-0000-4000-8000-000000000003'
         and (activity.xmin::text<>policy.xmin::text
           or exists(select 1 from public.hotel_payment_policy_terms term
             where term.payment_policy_id=policy.id
               and term.xmin::text<>activity.xmin::text)))
     or (select setting.hotel_external_sync_enabled
       from public.site_settings setting where setting.id=1) is distinct from
       (select capability.original_external_sync_enabled
         from seven_arches_payment_policy_fixture_capability capability) then
    raise exception using errcode='55000',
      message='seven_arches_payment_policy_activity_chain_fixture_failed';
  end if;
end
$seven_arches_payment_policy_activity_chain_exact$;

drop function pg_temp.seven_arches_payment_policy_activity_plan(
  text,uuid,uuid,text[],text[]);
