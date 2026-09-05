begin;
set transaction isolation level read committed;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- Acquire the complete protected-projection relation universe before the
-- statement that captures the current Task2/Stage2 baseline.  READ COMMITTED
-- gives that capture a new snapshot after every lock below has been granted;
-- the locks then remain held through installation COMMIT.
do $seven_arches_pricing_activation_install_locks$
declare
  v_relation regclass;
begin
  foreach v_relation in array array[
    'public.hotels'::regclass,
    'public.hotel_units'::regclass,
    'public.hotel_rate_plans'::regclass,
    'public.hotel_pricing_schedules'::regclass,
    'public.hotel_property_pricing_defaults'::regclass,
    'public.hotel_rate_rules'::regclass,
    'public.hotel_room_allocation_rules'::regclass,
    'public.hotel_room_allocation_rule_items'::regclass,
    'public.hotel_unit_calendar_blocks'::regclass,
    'public.hotel_inventory_holds'::regclass,
    'public.hotel_booking_room_allocations'::regclass,
    'public.hotel_inventory_commitments'::regclass,
    'public.hotel_calendar_source_configs'::regclass,
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass,
    'public.hotel_commission_policies'::regclass,
    'public.hotel_daily_rates'::regclass,
    'public.hotel_pricing_promotion_reviews'::regclass,
    'public.hotel_admin_pricing_action_receipts'::regclass,
    'public.hotel_admin_availability_action_receipts'::regclass,
    'public.hotel_admin_availability_plan_reviews'::regclass,
    'public.hotel_admin_availability_foundation_receipts'::regclass,
    'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
    'public.hotel_bookings'::regclass,
    'public.partner_service_fulfillments'::regclass,
    'public.partner_service_fulfillment_form_snapshots'::regclass,
    'public.service_deposit_requests'::regclass,
    'public.service_deposit_rules'::regclass,
    'public.service_deposit_overrides'::regclass,
    'public.service_coupons'::regclass,
    'public.service_coupon_redemptions'::regclass,
    'public.referrals'::regclass,
    'public.affiliate_commission_events'::regclass,
    'public.affiliate_payouts'::regclass,
    'public.affiliate_adjustments'::regclass,
    'public.affiliate_program_settings'::regclass,
    'public.affiliate_referrer_overrides'::regclass,
    'public.affiliate_cashout_requests'::regclass,
    'public.profile_referral_code_aliases'::regclass,
    'public.partners'::regclass,
    'public.partner_users'::regclass,
    'public.partner_resources'::regclass,
    'public.partner_user_resources'::regclass,
    'public.hotel_partner_hotel_permissions'::regclass,
    'public.site_settings'::regclass,
    'public.hotel_room_types'::regclass,
    'public.hotel_room_rates'::regclass,
    'public.hotel_pricing_schedule_occupancy_tiers'::regclass,
    'public.hotel_room_rate_occupancy_tiers'::regclass,
    'public.hotel_calendar_overrides'::regclass,
    'public.hotel_daily_inventory'::regclass,
    'public.hotel_partner_action_receipts'::regclass,
    'public.hotel_partner_event_outbox'::regclass,
    'public.hotel_activity_log'::regclass,
    'public.hotel_property_operational_profiles'::regclass,
    'public.hotel_partner_workspace_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_admin_reviews'::regclass,
    'public.hotel_partner_property_drafts'::regclass,
    'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_plan_reviews'::regclass,
    'hotels_v2_private.hotel_external_calendar_correlations'::regclass,
    'hotels_v2_private.hotel_external_calendar_admin_receipts'::regclass
  ] loop
    execute format('lock table %s in share row exclusive mode',v_relation);
    if not exists(select 1 from pg_locks lock_row
      where lock_row.pid=pg_backend_pid()
        and lock_row.locktype='relation'
        and lock_row.relation=v_relation::oid
        and lock_row.granted
        and lock_row.mode in('ShareRowExclusiveLock','AccessExclusiveLock')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_install_lock_failed',
        detail=v_relation::text;
    end if;
  end loop;
end
$seven_arches_pricing_activation_install_locks$;

create temporary table seven_arches_pricing_activation_locked_baseline
on commit drop as
select
  current_setting('TimeZone') incoming_timezone,
  property.value property_fingerprints,
  public.hotel_v2_h3_2b_hash(property.value) property_fingerprint,
  stage2.value stage2_fingerprints,
  public.hotel_v2_external_calendar_worker_hash(stage2.value) stage2_fingerprint,
  compatible.value stage2_compatible_fingerprints,
  public.hotel_v2_external_calendar_worker_hash(compatible.value)
    stage2_compatible_fingerprint,
  public.hotel_v2_admin_d_current_foundation_snapshot() admin_d_state,
  public.hotel_v2_partner_workspace_function_lineage_is_exact()
    workspace_lineage_exact,
  public.hotel_v2_external_calendar_provider_sources_are_attributable()
    provider_attribution_exact,
  lifecycle.value site_settings_lifecycle,
  public.hotel_v2_external_calendar_worker_hash(lifecycle.value)
    site_settings_lifecycle_fingerprint
from lateral (select
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints() value)
  property
cross join lateral (select
    public.hotel_v2_external_calendar_protected_fingerprints() value)
  stage2
cross join lateral (select
    public.hotel_v2_external_calendar_stage2_compatible_fingerprints() value)
  compatible
cross join lateral (select jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false) value) lifecycle;

-- The accepted H3.1 Admin configuration writer owns payment-method
-- evolution.  Methods remain inert configuration metadata: this predicate
-- accepts their current value only when the complete ordered Admin activity
-- chain accounts for it, the fixed commercial terms remain unchanged, and
-- the exact writer/schema/security/consumer boundary is still installed.
create function public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_code constant text:='seven-kamares-request-confirmation';
  c_supported constant text[]:=array[
    'bank_transfer','cash','card','online']::text[];
  v_policy public.hotel_payment_policies%rowtype;
  v_current_state jsonb;
  v_latest_state jsonb;
  v_activity_count integer;
  v_correlation_count integer;
  v_chain_exact boolean;
  v_constraint_fingerprint text;
  v_trigger_fingerprint text;
  v_security_contract_exact boolean;
begin
  if (select count(*) from public.hotel_payment_policies
      where hotel_id=c_hotel)<>1
     or (select count(*) from public.hotel_payment_policies
      where hotel_id=c_hotel and code=c_code and currency='EUR'
        and is_active and review_status='reviewed')<>1 then
    return false;
  end if;
  select * into strict v_policy from public.hotel_payment_policies
  where hotel_id=c_hotel and code=c_code;

  if (select count(*) from public.hotel_payment_policy_terms
      where payment_policy_id=v_policy.id and hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_payment_policy_terms term
       where term.payment_policy_id=v_policy.id and term.hotel_id=c_hotel
         and term.sequence=1 and term.due_event='after_partner_acceptance'
         and term.amount_mode='percent_total' and term.amount_value=50
         and term.recipient='partner' and cardinality(term.payment_methods)>=1
         and public.hotel_v2_h3_1_codes_valid(term.payment_methods)
         and term.payment_methods<@c_supported
         and term.payment_methods=(select array_agg(method order by method)
           from unnest(term.payment_methods) method))
     or not exists(select 1 from public.hotel_payment_policy_terms term
       where term.payment_policy_id=v_policy.id and term.hotel_id=c_hotel
         and term.sequence=2 and term.due_event='on_arrival'
         and term.amount_mode='remaining_balance' and term.amount_value is null
         and term.recipient='partner' and cardinality(term.payment_methods)>=1
         and public.hotel_v2_h3_1_codes_valid(term.payment_methods)
         and term.payment_methods<@c_supported
         and term.payment_methods=(select array_agg(method order by method)
           from unnest(term.payment_methods) method)) then
    return false;
  end if;

  select to_jsonb(v_policy)||jsonb_build_object('terms',coalesce((
      select jsonb_agg(to_jsonb(term) order by term.sequence,term.id)
      from public.hotel_payment_policy_terms term
      where term.payment_policy_id=v_policy.id),'[]'::jsonb))
    into v_current_state;

  with ordered as materialized (
    select activity.*,
      row_number() over(order by activity.created_at,activity.id) ordinal,
      lag(activity.after_state) over(order by activity.created_at,activity.id)
        previous_after_state
    from public.hotel_activity_log activity
    where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
  ), validation as (
    select count(*)::integer activity_count,
      count(distinct activity.correlation_id)::integer correlation_count,
      coalesce(bool_and(coalesce((
        activity.entity_id=v_policy.id
        and activity.source='hotels_v2_h3_1_admin_configuration'
        and activity.actor_type='admin' and activity.actor_id is not null
        and activity.correlation_id is not null
        and case when activity.ordinal=1 then
          activity.action='create' and activity.before_state is null
          and (activity.after_state->>'version')::bigint=1
        else activity.action='update'
          and activity.before_state is not distinct from
            activity.previous_after_state
          and (activity.before_state->>'version')::bigint=activity.ordinal-1
          and (activity.after_state->>'version')::bigint=activity.ordinal
        end
        and jsonb_typeof(activity.after_state)='object'
        and activity.after_state->>'id'=v_policy.id::text
        and activity.after_state->>'hotel_id'=c_hotel::text
        and activity.after_state->>'code'=c_code
        and btrim(activity.after_state->>'currency')='EUR'
        and activity.after_state->>'is_active'='true'
        and activity.after_state->>'review_status'='reviewed'
        and jsonb_typeof(activity.after_state->'terms')='array'
        and jsonb_array_length(activity.after_state->'terms')=2
        and exists(select 1
          from jsonb_array_elements(activity.after_state->'terms') term(value)
          where term.value->>'hotel_id'=c_hotel::text
            and term.value->>'payment_policy_id'=v_policy.id::text
            and (term.value->>'sequence')::integer=1
            and term.value->>'due_event'='after_partner_acceptance'
            and term.value->>'amount_mode'='percent_total'
            and (term.value->>'amount_value')::numeric=50
            and term.value->>'recipient'='partner'
            and (term.value->>'version')::bigint=1
            and jsonb_typeof(term.value->'payment_methods')='array'
            and jsonb_array_length(term.value->'payment_methods')>=1
            and jsonb_array_length(term.value->'payment_methods')=(select
              count(distinct method.value) from jsonb_array_elements_text(
                term.value->'payment_methods') method(value))
            and not exists(select 1 from jsonb_array_elements_text(
                term.value->'payment_methods') method(value)
              where method.value<>all(c_supported))
            and term.value->'payment_methods'=(select jsonb_agg(
                to_jsonb(method.value) order by method.value)
              from jsonb_array_elements_text(
                term.value->'payment_methods') method(value)))
        and exists(select 1
          from jsonb_array_elements(activity.after_state->'terms') term(value)
          where term.value->>'hotel_id'=c_hotel::text
            and term.value->>'payment_policy_id'=v_policy.id::text
            and (term.value->>'sequence')::integer=2
            and term.value->>'due_event'='on_arrival'
            and term.value->>'amount_mode'='remaining_balance'
            and term.value->'amount_value'='null'::jsonb
            and term.value->>'recipient'='partner'
            and (term.value->>'version')::bigint=1
            and jsonb_typeof(term.value->'payment_methods')='array'
            and jsonb_array_length(term.value->'payment_methods')>=1
            and jsonb_array_length(term.value->'payment_methods')=(select
              count(distinct method.value) from jsonb_array_elements_text(
                term.value->'payment_methods') method(value))
            and not exists(select 1 from jsonb_array_elements_text(
                term.value->'payment_methods') method(value)
              where method.value<>all(c_supported))
            and term.value->'payment_methods'=(select jsonb_agg(
                to_jsonb(method.value) order by method.value)
              from jsonb_array_elements_text(
                term.value->'payment_methods') method(value)))
      ),false)),false) chain_exact
    from ordered activity
  ) select activity_count,correlation_count,chain_exact
    into v_activity_count,v_correlation_count,v_chain_exact from validation;

  select activity.after_state into v_latest_state
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='payment_policy'
  order by activity.created_at desc,activity.id desc limit 1;
  if v_activity_count<1 or v_activity_count<>v_policy.version
     or v_correlation_count<>v_activity_count or not coalesce(v_chain_exact,false)
     or v_latest_state is distinct from v_current_state
     or exists(select 1 from public.hotel_activity_log activity
       where activity.entity_type='payment_policy' and activity.entity_id=v_policy.id
         and activity.hotel_id is distinct from c_hotel) then
    return false;
  end if;

  -- Exact accepted writer and validator sources.  The authenticated entry
  -- point is the only mutation surface; its two cores and all lower helpers
  -- remain hidden behind the accepted ACLs.
  if exists(select 1 from (values
      ('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
       '2e5c577dc7999322adef814a1658156ccf9e22958b58939033f0baf4af9d6fc7',
       'plpgsql','v'::"char",true,array['search_path=pg_catalog, public, auth']::text[],true,false),
      ('public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
       'da58fde24cde49476306b3c16340091989f66200f05d9fe1617dc4efaaf82048',
       'plpgsql','v'::"char",true,array['search_path=pg_catalog, public']::text[],false,false),
      ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
       'edcf0db5c9b3bcac0736893b5970c21ddce9876eed01327cc001123265ee111d',
       'plpgsql','v'::"char",true,array['search_path=pg_catalog, public, auth']::text[],false,false),
      ('public.hotel_v2_h3_1_payment_policy_constraint_trigger()',
       '02bb3e7a4deb3a122558fc999757b9b16b5536ff049027b2efc9d51e16d5be1e',
       'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,false),
      ('public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)',
       '8a998637085ce0ef5986c44fa3314ee3a864377d3dd5d277235800b26ba369b2',
       'sql','s'::"char",false,array['search_path=pg_catalog, public']::text[],false,false),
      ('public.hotel_v2_h3_1_validate_payment_policy(uuid)',
       '8cab255d64c241f17c39c37af0a1700cae3cb5749a3ef23abf2a37eff99df3b6',
       'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,false),
      ('public.hotel_v2_admin_get_h3_1_configuration(uuid)',
       'f1e81cf98f4cba46f6bf8901a9de06acf568eda1a8e698c2a0d3c95ad2c69adb',
       'plpgsql','s'::"char",true,array['search_path=pg_catalog, public, auth']::text[],true,false),
      ('public.hotel_v2_h3_1_codes_valid(text[])',
       'b42b2345900af0c711871b1baff071931edd28e7135baa3f4511e789b049d3af',
       'sql','i'::"char",false,array['search_path=pg_catalog']::text[],true,true),
      ('public.hotel_v2_set_updated_at_and_version()',
       '93256e7ee38459abf13272de79bd49c11bfe4dbe936c38f8630bedca7c76a3ca',
       'plpgsql','v'::"char",false,array['search_path=pg_catalog, public']::text[],false,true)
    ) expected(signature,source_hash,language_name,volatility,security_definer,
      path,authenticated_execute,service_execute)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    left join pg_language language_row on language_row.oid=procedure_row.prolang
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or language_row.lanname is distinct from expected.language_name
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.path
      or procedure_row.proleakproof or procedure_row.proretset
      or encode(extensions.digest(convert_to(
          procedure_row.prosrc,'UTF8'),'sha256'),'hex')<>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         is distinct from expected.authenticated_execute
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
         is distinct from expected.service_execute) then
    return false;
  end if;

  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(jsonb_build_object(
      'relation',constraint_row.conrelid::regclass::text,
      'name',constraint_row.conname,'type',constraint_row.contype,
      'validated',constraint_row.convalidated,
      'definition',pg_get_constraintdef(constraint_row.oid,false))
      order by constraint_row.conrelid::regclass::text,constraint_row.conname),
      '[]'::jsonb)) into v_constraint_fingerprint
  from pg_constraint constraint_row where constraint_row.conrelid in(
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass);
  select public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(jsonb_build_object(
      'relation',trigger_row.tgrelid::regclass::text,
      'name',trigger_row.tgname,'type',trigger_row.tgtype,
      'enabled',trigger_row.tgenabled,
      'function',trigger_row.tgfoid::regprocedure::text,
      'definition',pg_get_triggerdef(trigger_row.oid,false))
      order by trigger_row.tgrelid::regclass::text,trigger_row.tgname),
      '[]'::jsonb)) into v_trigger_fingerprint
  from pg_trigger trigger_row where trigger_row.tgrelid in(
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass) and not trigger_row.tgisinternal;
  -- Compare the exact semantic child contract, not the physical relacl /
  -- pg_policy serialization.  Owner ACLs are represented canonically through
  -- effective privileges, while non-owner grants remain an exact direct set.
  with expected_relations(relation_name,service_insert) as (values
    ('public.hotel_activity_log',true),
    ('public.hotel_payment_policies',false),
    ('public.hotel_payment_policy_terms',false)
  ), actual_relations as materialized (
    select expected.relation_name,expected.service_insert,relation_row.*
    from expected_relations expected
    left join pg_class relation_row
      on relation_row.oid=to_regclass(expected.relation_name)
  ), privileges(privilege_name) as (values
    ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),
    ('REFERENCES'),('TRIGGER')
  ), expected_direct_acl as (
    select relation_name,'postgres'::text grantor_name,
      'service_role'::text grantee_name,
      'SELECT'::text privilege_name,false grantable
    from expected_relations
    union all
    select relation_name,'postgres','service_role','INSERT',false
    from expected_relations where service_insert
  ), actual_direct_acl as materialized (
    select relation_row.relation_name,
      pg_get_userbyid(acl.grantor)::text grantor_name,
      case when acl.grantee=0 then 'PUBLIC'
        else pg_get_userbyid(acl.grantee) end::text grantee_name,
      acl.privilege_type::text privilege_name,
      acl.is_grantable grantable
    from actual_relations relation_row
    cross join lateral aclexplode(coalesce(
      relation_row.relacl,'{}'::aclitem[])) acl
    where acl.grantee<>relation_row.relowner
  ), checked_roles(role_name,role_oid) as (values
    ('PUBLIC'::text,0::oid),
    ('postgres','postgres'::regrole::oid),
    ('anon','anon'::regrole::oid),
    ('authenticated','authenticated'::regrole::oid),
    ('service_role','service_role'::regrole::oid)
  ), actual_effective_acl as materialized (
    select relation_row.relation_name,role.role_name,
      privilege.privilege_name,
      has_table_privilege(role.role_oid,relation_row.oid,
        privilege.privilege_name||' WITH GRANT OPTION') grantable
    from actual_relations relation_row
    cross join checked_roles role
    cross join privileges privilege
    where relation_row.oid is not null
      and has_table_privilege(role.role_oid,relation_row.oid,
        privilege.privilege_name)
  ), expected_effective_acl as (
    select relation_name,'postgres'::text role_name,
      privilege_name,true grantable
    from expected_relations cross join privileges
    union all
    select relation_name,grantee_name,privilege_name,grantable
    from expected_direct_acl
  ), expected_policies(relation_name,policy_name) as (values
    ('public.hotel_activity_log','hotel_activity_log_admin_select'),
    ('public.hotel_payment_policies','hotel_payment_policies_admin_select'),
    ('public.hotel_payment_policy_terms',
      'hotel_payment_policy_terms_admin_select')
  ), actual_policies as materialized (
    select policy_namespace.nspname||'.'||policy_relation.relname relation_name,
      policy_row.polname policy_name,policy_row.polcmd command,
      policy_row.polpermissive permissive,
      array(select distinct case when role_id=0 then 'PUBLIC'
          else pg_get_userbyid(role_id) end::text
        from unnest(policy_row.polroles) role_id
        order by 1) roles,
      case regexp_replace(lower(pg_get_expr(
        policy_row.polqual,policy_row.polrelid)),
        '[[:space:]()]','','g')
        when 'is_current_user_admin' then 'is_current_user_admin'
        when 'public.is_current_user_admin' then 'is_current_user_admin'
        else null end using_contract,
      case when policy_row.polwithcheck is null then null else
        regexp_replace(lower(pg_get_expr(
          policy_row.polwithcheck,policy_row.polrelid)),
          '[[:space:]]','','g') end check_contract,
      (select array_agg(distinct dependency.refobjid order by dependency.refobjid)
       from pg_depend dependency
       where dependency.classid='pg_policy'::regclass
         and dependency.objid=policy_row.oid
         and dependency.refclassid='pg_proc'::regclass)
        function_dependencies
    from pg_policy policy_row
    join pg_class policy_relation on policy_relation.oid=policy_row.polrelid
    join pg_namespace policy_namespace
      on policy_namespace.oid=policy_relation.relnamespace
    where policy_row.polrelid in(
      'public.hotel_activity_log'::regclass,
      'public.hotel_payment_policies'::regclass,
      'public.hotel_payment_policy_terms'::regclass)
  ), expected_policy_contract as (
      select relation_name,policy_name,'r'::"char" command,true permissive,
        array['authenticated']::text[] roles,
        'is_current_user_admin'::text using_contract,null::text check_contract,
        array['public.is_current_user_admin()'::regprocedure::oid]::oid[]
          function_dependencies
    from expected_policies
  )
  select
    (select count(*)=3 and coalesce(bool_and(
      relation_row.oid is not null
      and relation_row.relowner='postgres'::regrole
      and relation_row.relkind='r' and relation_row.relpersistence='p'
      and relation_row.relrowsecurity
      and not relation_row.relforcerowsecurity),false)
      from actual_relations relation_row)
    and not exists(
      (select * from actual_direct_acl
       except all select * from expected_direct_acl)
      union all
      (select * from expected_direct_acl
       except all select * from actual_direct_acl))
    and not exists(
      (select * from actual_effective_acl
       except all select * from expected_effective_acl)
      union all
      (select * from expected_effective_acl
       except all select * from actual_effective_acl))
    and not exists(
      (select * from actual_policies
       except all select * from expected_policy_contract)
      union all
      (select * from expected_policy_contract
       except all select * from actual_policies))
    into v_security_contract_exact;
  if v_constraint_fingerprint<>
       '853f7af619c23d2428a55489e45426cfdc9e3625c58cae1c0f40de457158a24d'
     or v_trigger_fingerprint<>
       '12324aa32db604c150aebd2e8d145d3ba4910c7b7e4628cbd882506f1dd85a1e'
     or not coalesce(v_security_contract_exact,false) then
    return false;
  end if;

  -- Exact field-consumer inventory: only the hidden accepted writer core and
  -- hidden fingerprint helper mention payment_methods.  The authenticated
  -- getter above is a pinned configuration projection, not a payment rail.
  if (select count(*) from pg_proc procedure_row
      join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
      where namespace_row.nspname='public'
        and procedure_row.prosrc~'\mpayment_methods\M'
        and procedure_row.oid<>
          'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure)<>2
     or exists(select 1 from pg_proc procedure_row
       join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
       where namespace_row.nspname='public'
         and procedure_row.prosrc~'\mpayment_methods\M'
         and procedure_row.oid<>
           'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure
         and (procedure_row.oid not in(
           'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'::regprocedure,
           'public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)'::regprocedure)
           or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
           or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
           or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
           or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')))
     or exists(select 1 from pg_views view_row
       where view_row.definition~'\mpayment_methods\M')
     or exists(select 1 from pg_matviews view_row
       where view_row.definition~'\mpayment_methods\M') then
    return false;
  end if;

  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure
       and procedure_row.proowner='postgres'::regrole
       and procedure_row.provolatile='s' and procedure_row.prosecdef
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return false;
  end if;
  return true;
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name or invalid_text_representation
  or numeric_value_out_of_range then
  return false;
end
$function$;

alter function public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
  owner to postgres;
revoke all on function
  public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
from public,anon,authenticated,service_role;

-- Long-lived Hotels lineage is deliberately narrower than the broad H3.2B
-- protection map.  The latter remains the transaction-level BEFORE/AFTER
-- guard below; normal fulfillment, deposit, referral, affiliate-event, and
-- unrelated site_settings activity is not permanent 7 Arches pricing state.
create function public.hotel_v2_seven_arches_pricing_scoped_lineage()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_shared_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_upper_room constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground_room constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_property public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_expected_property jsonb;
  v_authorized_property jsonb;
  v_actual_property jsonb;
  v_owner_user_ids uuid[];
  v_owner_membership_fingerprint text;
  v_permission jsonb;
  v_room_identity jsonb;
  v_pricing_identity jsonb;
  v_parity jsonb;
  v_reviewed_oracle jsonb;
  v_reviewed_foundation_count integer:=0;
  v_activation_receipt_count integer:=0;
  v_activation_receipt jsonb;
  v_historical_activation_receipt jsonb;
  v_commission jsonb;
  v_payment jsonb;
  v_lifecycle jsonb:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_lower_security jsonb;
begin
  if (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or (select count(*) from public.site_settings)<>1 then
    return null;
  end if;
  select * into strict v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_property
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;

  -- The 114360/114370 rows remain immutable historical evidence.  Their
  -- stored broad maps are self-hashed, but are never compared to live global
  -- operational contents here.
  if v_owner.id is distinct from 1
     or v_owner.contract_version is distinct from
       'hotels_v2_admin_d_foundation_evolution_v2'
     or v_owner.before_current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.before_current_protected_fingerprints)
     or v_owner.current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.current_protected_fingerprints)
     or v_owner.stage2_before_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_before_current_protected_fingerprints)
     or v_owner.stage2_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_current_protected_fingerprints)
     or v_owner.original_foundation_receipt_id is distinct from 1
     or v_owner.original_protected_fingerprint is distinct from
       (select receipt.protected_fingerprint
        from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1)
     or v_property.id is distinct from 1
     or v_property.owner_evolution_receipt_id is distinct from v_owner.id
     or v_property.owner_evolution_receipt_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
         to_jsonb(extract(epoch from v_owner.created_at)),false))
     or v_property.original_h3_2b_foundation_fingerprint is distinct from
       (select receipt.protected_fingerprint
        from public.hotel_partner_workspace_foundation_receipts receipt where receipt.id=1)
     or v_property.protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_property.protected_fingerprints)
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)) then
    return null;
  end if;

  select array_agg(member.user_id order by member.user_id)
    into v_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_owner.partner_id and member.role='owner';
  v_owner_membership_fingerprint:=encode(extensions.digest(convert_to(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_owner_membership_v1',
      'hotel_id',v_owner.hotel_id,'partner_id',v_owner.partner_id,
      'assignment_id',v_owner.assignment_id,'role','owner',
      'owner_user_ids',to_jsonb(v_owner_user_ids))::text,'UTF8'),'sha256'),'hex');
  v_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_owner.assignment_id);

  select receipt.proposal_fields_baseline-'updated_at'
    into v_expected_property
  from public.hotel_partner_property_proposal_foundation_receipts receipt where receipt.id=1;
  select activity.after_state->'property' into v_authorized_property
  from public.hotel_activity_log activity
  where activity.hotel_id=c_hotel and activity.entity_type='property'
    and activity.source='hotels_v2_admin_b_property_control'
    and activity.created_at>=v_property.created_at
  order by activity.created_at desc,activity.id desc limit 1;
  if v_authorized_property is not null then
    v_expected_property:=jsonb_build_object(
      'title',v_authorized_property->'title',
      'title_i18n',v_authorized_property->'title_i18n',
      'description',v_authorized_property->'description',
      'description_i18n',v_authorized_property->'description_i18n',
      'city',v_authorized_property->'city',
      'address_line',v_authorized_property->'address_line',
      'district',v_authorized_property->'district',
      'postal_code',v_authorized_property->'postal_code',
      'country',v_authorized_property->'country',
      'latitude',v_authorized_property->'latitude',
      'longitude',v_authorized_property->'longitude',
      'google_maps_url',v_authorized_property->'google_maps_url',
      'amenities',v_authorized_property->'amenities',
      'check_in_from',v_authorized_property->'check_in_from',
      'check_out_until',v_authorized_property->'check_out_until',
      'cover_image_url',v_authorized_property->'cover_image_url',
      'photos',v_authorized_property->'photos');
  end if;
  select jsonb_build_object(
    'title',hotel.title,'title_i18n',hotel.title_i18n,
    'description',hotel.description,'description_i18n',hotel.description_i18n,
    'city',hotel.city,'address_line',hotel.address_line,'district',hotel.district,
    'postal_code',hotel.postal_code,'country',hotel.country,
    'latitude',hotel.latitude,'longitude',hotel.longitude,
    'google_maps_url',hotel.google_maps_url,'amenities',hotel.amenities,
    'check_in_from',hotel.check_in_from,'check_out_until',hotel.check_out_until,
    'cover_image_url',hotel.cover_image_url,'photos',hotel.photos)
    into v_actual_property
  from public.hotels hotel where hotel.id=c_hotel;

  select jsonb_agg(jsonb_build_object('id',room.id,'hotel_id',room.hotel_id)
      order by room.id)
    into v_room_identity
  from public.hotel_room_types room where room.hotel_id=c_hotel;
  select jsonb_build_object(
    'rate_plan_ids',(select jsonb_agg(plan.id order by plan.id)
      from public.hotel_rate_plans plan where plan.hotel_id=c_hotel),
    'room_rates',(select jsonb_agg(jsonb_build_object(
        'id',rate.id,'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,
        'pricing_schedule_id',rate.pricing_schedule_id,'currency',btrim(rate.currency::text),
        'review_status',rate.review_status,'is_active',rate.is_active)
      order by rate.id) from public.hotel_room_rates rate where rate.hotel_id=c_hotel),
    'schedules',(select jsonb_agg(jsonb_build_object(
        'id',schedule.id,'application_scope',schedule.application_scope,
        'currency',btrim(schedule.currency::text),'review_status',schedule.review_status,
        'is_active',schedule.is_active)
      order by schedule.id) from public.hotel_pricing_schedules schedule
      where schedule.hotel_id=c_hotel)) into v_pricing_identity;
  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);
  -- H3.1P is the exact 70-case authority through the independent-topology
  -- bootstrap. Once the reviewed-pricing foundation is sealed, legitimate
  -- Room-specific changes intentionally make that historical shared-price
  -- comparison diverge. At that phase use the accepted Room-aware oracle:
  -- 100 core cases plus the separate 20 guest-one floor cases.
  if to_regclass(
       'public.hotel_seven_arches_reviewed_pricing_foundation_receipts')
       is not null then
    execute 'select count(*) from public.'||
      'hotel_seven_arches_reviewed_pricing_foundation_receipts'
      into v_reviewed_foundation_count;
    if v_reviewed_foundation_count>0 then
      if v_reviewed_foundation_count<>1
         or to_regprocedure(
           'public.hotel_v2_seven_arches_reviewed_pricing_oracle()') is null
         or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
           to_regprocedure(
             'public.hotel_v2_seven_arches_reviewed_pricing_oracle()')
           and procedure_row.proowner='postgres'::regrole
           and procedure_row.prosecdef and procedure_row.provolatile='s'
           and procedure_row.proconfig=
             array['search_path=pg_catalog, public']::text[]
           and encode(extensions.digest(convert_to(
             procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
             '50fee36eb4e4c7a11ad0baf0188a9f2042bde3678c5d835b3e8b7ece992ebfef'
           and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
           and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
           and not has_function_privilege(
             'authenticated',procedure_row.oid,'EXECUTE')
           and not has_function_privilege(
             'service_role',procedure_row.oid,'EXECUTE')) then
        return null;
      end if;
      execute
        'select public.hotel_v2_seven_arches_reviewed_pricing_oracle()'
        into v_reviewed_oracle;
      if jsonb_typeof(v_reviewed_oracle) is distinct from 'object'
         or v_reviewed_oracle->>'contract_version' is distinct from
           'hotels_v2_seven_arches_reviewed_pricing_oracle_v1'
         or (v_reviewed_oracle->>'core_case_count')::integer<>100
         or (v_reviewed_oracle->>'core_mismatch_count')::integer<>0
         or (v_reviewed_oracle->>'guest_one_case_count')::integer<>20
         or (v_reviewed_oracle->>'guest_one_mismatch_count')::integer<>0
         or (v_reviewed_oracle->>'fingerprint'~'^[0-9a-f]{32}$')
           is distinct from true then
        return null;
      end if;
      v_parity:=jsonb_build_object(
        'total_case_count',v_reviewed_oracle->'core_case_count',
        'total_mismatch_count',v_reviewed_oracle->'core_mismatch_count',
        'fingerprint',v_reviewed_oracle->'fingerprint');
    end if;
  end if;
  -- The activation receipt is immutable Hotels lineage, unlike the mutable
  -- global operational rows intentionally excluded from this projection.
  -- Before activation, zero rows is the valid bootstrap state.  Once the
  -- receipt exists, its parity evidence must match current authority; after
  -- 114410, its complete timezone-independent representation must also match
  -- the copy sealed into the independent-pricing receipt.
  if to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts')
       is not null then
    execute 'select count(*) from public.'||
      'hotel_seven_arches_pricing_activation_evolution_receipts'
      into v_activation_receipt_count;
    if v_activation_receipt_count not in(0,1) then
      return null;
    end if;
    if v_activation_receipt_count=1 then
      execute $query$
        select to_jsonb(receipt)-array['created_at']::text[]
        from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
        where receipt.id=1 and receipt.created_at is not null
          and isfinite(receipt.created_at)
      $query$ into v_activation_receipt;
      if v_activation_receipt is null then
        return null;
      end if;
      if to_regclass(
           'public.hotel_seven_arches_independent_pricing_evolution_receipts')
           is not null then
        execute $query$
          select receipt.historical_activation_lineage->'activation_receipt'
          from public.hotel_seven_arches_independent_pricing_evolution_receipts receipt
          where receipt.id=1 and (select count(*) from
            public.hotel_seven_arches_independent_pricing_evolution_receipts)=1
        $query$ into v_historical_activation_receipt;
        if v_historical_activation_receipt is null
           or v_activation_receipt is distinct from
             v_historical_activation_receipt then
          return null;
        end if;
      elsif v_activation_receipt->>'parity_fingerprint'
          is distinct from v_parity->>'fingerprint' then
        return null;
      end if;
    end if;
  end if;
  select jsonb_build_object(
    'id',policy.id,'code',policy.code,'commission_mode',policy.commission_mode,
    'amount',policy.amount,'currency',btrim(policy.currency::text),
    'is_active',policy.is_active,'review_status',policy.review_status)
    into v_commission
  from public.hotel_commission_policies policy
  where policy.hotel_id=c_hotel and policy.is_active and policy.review_status='reviewed';
  select jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_payment_policy_lineage_v1',
    'id',policy.id,'hotel_id',policy.hotel_id,'code',policy.code,
    'currency',btrim(policy.currency::text),'is_active',policy.is_active,
    'review_status',policy.review_status,
    'fixed_terms',jsonb_build_array(
      jsonb_build_object('sequence',1,'due_event','after_partner_acceptance',
        'amount_mode','percent_total','amount_value',50,'recipient','partner'),
      jsonb_build_object('sequence',2,'due_event','on_arrival',
        'amount_mode','remaining_balance','amount_value',null,'recipient','partner')),
    'supported_method_codes',jsonb_build_array(
      'bank_transfer','cash','card','online'),
    'evidence_kind','accepted_admin_h3_1_activity_log_only',
    'execution_status',
      'supported_inert_configuration_metadata_not_an_executable_payment_rail')
    into v_payment
  from public.hotel_payment_policies policy
  where policy.hotel_id=c_hotel and policy.code='seven-kamares-request-confirmation';
  select jsonb_object_agg(expected.signature,public.hotel_v2_h3_2b_hash(
      to_jsonb(pg_get_functiondef(to_regprocedure(expected.signature)))))
    into v_lower_security
  from (values
    ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)'),
    ('public.hotel_v2_seven_arches_owner_capabilities()'),
    ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()'),
    ('public.hotel_v2_h3_1p_parity_snapshot(uuid)'),
    ('public.hotel_v2_h3_2b_hash(jsonb)'),
    ('public.hotel_v2_external_calendar_worker_hash(jsonb)'),
    ('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()')
  ) expected(signature);

  if exists(select 1 from (values
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,'s'::"char",
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_seven_arches_owner_capabilities()',false,'i'::"char",
        array['search_path=pg_catalog']::text[],
        'cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',
        false,'s'::"char",array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_1p_parity_snapshot(uuid)',false,'s'::"char",
        array['search_path=pg_catalog, public']::text[],
        'f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,'i'::"char",
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()',true,
        's'::"char",array['search_path=pg_catalog, public']::text[],
        '03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94')
    ) expected(signature,security_definer,volatility,path,source_hash)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return null;
  end if;

  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
       and procedure_row.proowner='postgres'::regrole
       and procedure_row.prosecdef and procedure_row.provolatile='s'
       and procedure_row.proconfig=
         array['search_path=pg_catalog, public']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return null;
  end if;

  if v_owner.hotel_id is distinct from c_hotel
     or v_owner.owner_user_ids is distinct from v_owner_user_ids
     or v_owner.owner_membership_fingerprint is distinct from
       v_owner_membership_fingerprint
     or v_owner.capabilities is distinct from
       public.hotel_v2_seven_arches_owner_capabilities()
     or v_permission is distinct from v_owner.after_permission
     or not exists(select 1 from public.hotels hotel
       join public.partners partner on partner.id=hotel.owner_partner_id
       join public.partner_resources assignment on assignment.id=v_owner.assignment_id
        and assignment.partner_id=partner.id and assignment.resource_type='hotels'
        and assignment.resource_id=hotel.id
       where hotel.id=c_hotel and partner.id=v_owner.partner_id
         and partner.status='active' and partner.can_manage_hotels)
     or (select count(*) from public.partner_resources assignment
       where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)<>1
     or (select count(*) from public.hotel_partner_hotel_permissions permission
       where permission.hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_partner_hotel_permissions permission
       where permission.hotel_id=c_hotel and permission.partner_id=v_owner.partner_id
         and permission.assignment_id=v_owner.assignment_id and permission.version=1
         and permission.has_mutation_capability)
     or v_actual_property is null
     or v_actual_property is distinct from v_expected_property
     or (select count(*) from public.hotel_room_types room where room.hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_room_types room
       where room.id=c_upper_room and room.hotel_id=c_hotel)
     or not exists(select 1 from public.hotel_room_types room
       where room.id=c_ground_room and room.hotel_id=c_hotel)
     or not exists(select 1 from public.hotel_rate_plans plan
       where plan.id=c_plan and plan.hotel_id=c_hotel)
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id=c_upper_rate and rate.hotel_id=c_hotel
         and rate.room_type_id=c_upper_room and rate.rate_plan_id=c_plan
         and btrim(rate.currency::text)='EUR')
     or not exists(select 1 from public.hotel_room_rates rate
       where rate.id=c_ground_rate and rate.hotel_id=c_hotel
         and rate.room_type_id=c_ground_room and rate.rate_plan_id=c_plan
         and btrim(rate.currency::text)='EUR')
     or not exists(select 1 from public.hotel_pricing_schedules schedule
       where schedule.id=c_shared_schedule and schedule.hotel_id=c_hotel
         and btrim(schedule.currency::text)='EUR')
     or (v_parity->>'total_case_count')::integer<>
       (case when v_reviewed_foundation_count=1 then 100 else 70 end)
     or (v_parity->>'total_mismatch_count')::integer<>0
     or public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() is not true
     or v_commission is null
     or (select count(*) from public.hotel_commission_policies policy
       where policy.hotel_id=c_hotel and policy.is_active and policy.review_status='reviewed')<>1
     or v_commission->>'commission_mode'<>'per_allocated_room_per_night'
     or (v_commission->>'amount')::numeric<>10 or v_commission->>'currency'<>'EUR'
     or v_payment is null
     or (select count(*) from public.hotel_payment_policies policy
       where policy.hotel_id=c_hotel)<>1
     or v_payment->>'currency'<>'EUR' or v_payment->>'is_active'<>'true'
     or v_payment->>'review_status'<>'reviewed'
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_rooms_v2_enabled is not distinct from false
       and setting.hotel_external_sync_enabled is not null
       and setting.hotel_instant_booking_enabled is not distinct from false
       and setting.hotel_stripe_connect_enabled is not distinct from false)
     or v_lower_security is null
     or exists(select 1 from (values
       ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,'s'::"char",
         array['search_path=pg_catalog, public']::text[],
         '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
       ('public.hotel_v2_seven_arches_owner_capabilities()',false,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'cd66ff70012c3c3e155eb62ae8f398278ad162878f976cc620caa86a2dab3fd6'),
       ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
       ('public.hotel_v2_h3_1p_parity_snapshot(uuid)',false,'s'::"char",
         array['search_path=pg_catalog, public']::text[],
         'f4811812d61e75a7ba5634cdd555b0c608f6a12bf65b4aae745bd1dd007d0b9e'),
       ('public.hotel_v2_h3_2b_hash(jsonb)',false,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         '03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94')
     ) expected(signature,security_definer,volatility,path,source_hash)
     left join pg_proc procedure_row
       on procedure_row.oid=to_regprocedure(expected.signature)
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole
       or procedure_row.prosecdef is distinct from expected.security_definer
       or procedure_row.provolatile is distinct from expected.volatility
       or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return null;
  end if;

  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_scoped_lineage_v1',
    'hotel_id',c_hotel,'partner_id',v_owner.partner_id,
    'assignment_id',v_owner.assignment_id,'owner_user_ids',to_jsonb(v_owner_user_ids),
    'owner_membership_fingerprint',v_owner_membership_fingerprint,
    'permission_preset_fingerprint',public.hotel_v2_h3_2b_hash(v_permission),
    'property_business_fingerprint',public.hotel_v2_h3_2b_hash(v_actual_property),
    'room_identity_fingerprint',public.hotel_v2_h3_2b_hash(v_room_identity),
    'pricing_identity_fingerprint',public.hotel_v2_h3_2b_hash(v_pricing_identity),
    'allocation_contract_exact',true,
    'parity_case_count',(v_parity->>'total_case_count')::integer,
    'parity_mismatch_count',(v_parity->>'total_mismatch_count')::integer,
    'parity_fingerprint',v_parity->>'fingerprint',
    'commission_policy_fingerprint',public.hotel_v2_h3_2b_hash(v_commission),
    'payment_policy_fingerprint',public.hotel_v2_h3_2b_hash(v_payment),
    'site_settings_lifecycle',v_lifecycle,
    'site_settings_lifecycle_fingerprint',
      public.hotel_v2_external_calendar_worker_hash(v_lifecycle),
    'owner_capability_receipt_fingerprint',public.hotel_v2_h3_2b_hash(
      jsonb_set(to_jsonb(v_owner),'{created_at}',
        to_jsonb(extract(epoch from v_owner.created_at)),false)),
    'property_foundation_receipt_fingerprint',public.hotel_v2_h3_2b_hash(
      jsonb_set(to_jsonb(v_property),'{created_at}',
        to_jsonb(extract(epoch from v_property.created_at)),false)),
    'lower_function_security_fingerprint',public.hotel_v2_h3_2b_hash(v_lower_security));
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name then
  return null;
end
$function$;

alter function public.hotel_v2_seven_arches_pricing_scoped_lineage() owner to postgres;
revoke all on function public.hotel_v2_seven_arches_pricing_scoped_lineage()
  from public,anon,authenticated,service_role;

-- Reviewed, one-Hotel activation of the already accepted H3.1P 7 Arches
-- pricing graph. Public Hotels remain legacy-authoritative; the external
-- calendar flag preserves its observed Stage 2F state while the other public
-- V2 flags remain OFF. No price, translation, or policy value is inferred.

do $seven_arches_pricing_activation_dependencies$
declare
  v_locked seven_arches_pricing_activation_locked_baseline%rowtype;
  v_scoped_lineage jsonb;
begin
  select * into strict v_locked
  from seven_arches_pricing_activation_locked_baseline;
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  if to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_admin_c_uuid_is_canonical(text)') is null
     or to_regprocedure('public.hotel_v2_admin_c_json_uuid_fields_are_canonical(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_c_i18n_is_valid(jsonb,boolean,integer,boolean)') is null
     or to_regprocedure('public.hotel_v2_admin_c_validate_pricing_graph(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_parity_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_scoped_lineage()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regclass('public.hotel_admin_pricing_action_receipts') is null
     or to_regclass('public.hotel_pricing_promotion_reviews') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_dependency_missing';
  end if;
  if to_regclass('public.hotel_seven_arches_pricing_activation_reviews') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_transaction_context') is not null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is not null
     or to_regclass('public.hotel_seven_arches_task2_stage2_compatibility_receipts') is not null
     or to_regprocedure('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_boundary_mismatch';
  end if;
  if (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or v_locked.property_fingerprints->'site_settings' is null
     or v_scoped_lineage is null
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
       and procedure_row.proowner='postgres'::regrole
       and procedure_row.prosecdef and procedure_row.provolatile='s'
       and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_task2_foundation_drift';
  end if;
  if (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1
         and receipt.protected_fingerprint=
           public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
     or (select count(*)<>1 or bool_or(setting.id<>1
          or setting.hotel_rooms_v2_enabled is distinct from false
          or setting.hotel_external_sync_enabled is null
          or setting.hotel_instant_booking_enabled is distinct from false
          or setting.hotel_stripe_connect_enabled is distinct from false)
       from public.site_settings setting)
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or v_locked.stage2_fingerprints->'site_settings' is null
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1 and receipt.created_at is not null
         and isfinite(receipt.created_at)
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and case
           when jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
           then (select count(*) from jsonb_object_keys(
                  receipt.compatibility_function_fingerprints))=20
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
             and not exists(select 1 from jsonb_each_text(
               receipt.compatibility_function_fingerprints) fingerprint(signature,value)
               where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true)
           else false
         end)
     or not exists(select 1 from pg_class relation where relation.oid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
     or (select count(*) from pg_attribute attribute
       where attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and attribute.attnum>0 and not attribute.attisdropped)<>4
     or exists(select 1 from (values
       (1::smallint,'id','smallint',true,null::text),
       (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
       (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
       (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
     ) expected(attnum,attname,type_name,not_null,default_expression)
     left join pg_attribute attribute on attribute.attrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
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
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)<>4
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='p' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='(id=1)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')<>1
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
       and trigger_row.tgfoid=
         to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()')
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name))
     or not exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
       'hotels_v2_private'::regnamespace
       and namespace_row.nspowner='postgres'::regrole)
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE')
     or exists(select 1 from (values
       ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
       ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
       ('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",
         array['search_path=pg_catalog, public']::text[],
         '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
     ) expected(signature,security_definer,volatility,path,source_hash)
     left join pg_proc procedure_row
       on procedure_row.oid=to_regprocedure(expected.signature)
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole
       or procedure_row.prosecdef is distinct from expected.security_definer
       or procedure_row.provolatile is distinct from expected.volatility
       or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or v_locked.stage2_fingerprints->'site_settings' is null
     or v_locked.workspace_lineage_exact is not true
     or v_locked.provider_attribution_exact is not true
     or not coalesce((v_locked.admin_d_state->>'original_receipt_intact')::boolean,false)
     or not coalesce((v_locked.admin_d_state->>'seven_arches_assignment_exact')::boolean,false)
     or not coalesce((v_locked.admin_d_state->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((v_locked.admin_d_state->>'audit_chain_exact')::boolean,false)
     or v_locked.site_settings_lifecycle_fingerprint is null
     or (select count(*)<>1 or bool_or(setting.id<>1
          or setting.hotel_rooms_v2_enabled is distinct from false
          or setting.hotel_external_sync_enabled is null
          or setting.hotel_instant_booking_enabled is distinct from false
          or setting.hotel_stripe_connect_enabled is distinct from false)
       from public.site_settings setting) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_stage2_foundation_drift';
  end if;
end
$seven_arches_pricing_activation_dependencies$;

create table public.hotel_seven_arches_pricing_activation_reviews(
  id uuid primary key,
  contract_version text not null
    check(contract_version='hotels_v2_seven_arches_pricing_activation_plan_v1'),
  hotel_id uuid not null check(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    references public.hotels(id) on delete restrict,
  actor_id uuid not null,
  snapshot_token text not null check(snapshot_token~'^[0-9a-f]{64}$'),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  reviewed_plan jsonb not null check(jsonb_typeof(reviewed_plan)='object'),
  reviewed_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_correlation_id uuid unique,
  consumed_idempotency_key text,
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  check(expires_at>reviewed_at and expires_at<=reviewed_at+interval '30 minutes'),
  check((consumed_at is null and consumed_correlation_id is null
      and consumed_idempotency_key is null and result is null)
    or (consumed_at is not null and consumed_correlation_id is not null
      and consumed_idempotency_key is not null and result is not null
      and jsonb_typeof(result)='object'))
);
alter table public.hotel_seven_arches_pricing_activation_reviews enable row level security;
revoke all on table public.hotel_seven_arches_pricing_activation_reviews
  from public,anon,authenticated,service_role;

create table public.hotel_seven_arches_pricing_activation_transaction_context(
  backend_pid integer primary key,
  transaction_id bigint not null,
  review_id uuid not null references public.hotel_seven_arches_pricing_activation_reviews(id)
    on delete restrict,
  actor_id uuid not null,
  correlation_id uuid not null,
  before_protected_fingerprints jsonb not null
    check(jsonb_typeof(before_protected_fingerprints)='object'),
  before_stage2_protected_fingerprints jsonb not null
    check(jsonb_typeof(before_stage2_protected_fingerprints)='object'),
  applied_entity_ids uuid[] not null default '{}'::uuid[] check(
    cardinality(applied_entity_ids)<=4
    and applied_entity_ids<@array[
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid]),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.hotel_seven_arches_pricing_activation_transaction_context enable row level security;
revoke all on table public.hotel_seven_arches_pricing_activation_transaction_context
  from public,anon,authenticated,service_role;

create function public.hotel_v2_seven_arches_pricing_activation_context_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if new.backend_pid<>pg_backend_pid() or new.transaction_id<>txid_current()
     or auth.uid() is null or new.actor_id<>auth.uid()
     or new.correlation_id is null
     or jsonb_typeof(new.before_protected_fingerprints)<>'object'
     or jsonb_typeof(new.before_stage2_protected_fingerprints)<>'object'
     or not exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews review
       where review.id=new.review_id and review.actor_id=new.actor_id
         and review.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and review.consumed_at is null and review.expires_at>clock_timestamp()) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_invalid_context';
  end if;
  if tg_op='INSERT' then
    if cardinality(new.applied_entity_ids)<>0 then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_invalid_context';
    end if;
  elsif new.backend_pid<>old.backend_pid or new.transaction_id<>old.transaction_id
     or new.review_id<>old.review_id or new.actor_id<>old.actor_id
     or new.correlation_id<>old.correlation_id or new.created_at<>old.created_at
     or new.before_protected_fingerprints is distinct from
       old.before_protected_fingerprints
     or new.before_stage2_protected_fingerprints is distinct from
       old.before_stage2_protected_fingerprints
     or cardinality(new.applied_entity_ids)<>cardinality(old.applied_entity_ids)+1
     or (cardinality(old.applied_entity_ids)>0 and
       new.applied_entity_ids[1:cardinality(old.applied_entity_ids)]
         is distinct from old.applied_entity_ids)
     or new.applied_entity_ids[cardinality(new.applied_entity_ids)]
       =any(old.applied_entity_ids) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_invalid_context';
  end if;
  return new;
end
$function$;

create trigger hotel_seven_arches_pricing_activation_context_guard
before insert or update on public.hotel_seven_arches_pricing_activation_transaction_context
for each row execute function public.hotel_v2_seven_arches_pricing_activation_context_guard();

create table public.hotel_seven_arches_pricing_activation_evolution_receipts(
  id smallint primary key check(id=1),
  contract_version text not null
    check(contract_version='hotels_v2_seven_arches_pricing_activation_evolution_v1'),
  review_id uuid not null unique
    references public.hotel_seven_arches_pricing_activation_reviews(id) on delete restrict,
  admin_receipt_id uuid not null unique
    references public.hotel_admin_pricing_action_receipts(id) on delete restrict,
  hotel_id uuid not null check(hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
  actor_id uuid not null,
  correlation_id uuid not null unique,
  idempotency_key text not null,
  before_protected_fingerprints jsonb not null check(jsonb_typeof(before_protected_fingerprints)='object'),
  before_protected_fingerprint text not null check(before_protected_fingerprint~'^[0-9a-f]{64}$'),
  after_protected_fingerprints jsonb not null check(jsonb_typeof(after_protected_fingerprints)='object'),
  after_protected_fingerprint text not null check(after_protected_fingerprint~'^[0-9a-f]{64}$'),
  allowed_fingerprint_keys text[] not null check(allowed_fingerprint_keys=array[
    'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[]),
  before_stage2_protected_fingerprints jsonb not null
    check(jsonb_typeof(before_stage2_protected_fingerprints)='object'),
  before_stage2_protected_fingerprint text not null
    check(before_stage2_protected_fingerprint~'^[0-9a-f]{64}$'),
  after_stage2_protected_fingerprints jsonb not null
    check(jsonb_typeof(after_stage2_protected_fingerprints)='object'),
  after_stage2_protected_fingerprint text not null
    check(after_stage2_protected_fingerprint~'^[0-9a-f]{64}$'),
  stage2_allowed_fingerprint_keys text[] not null check(stage2_allowed_fingerprint_keys=array[
    'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
    'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[]),
  upper_base_nightly_rate numeric(12,2) not null check(upper_base_nightly_rate>0),
  ground_base_nightly_rate numeric(12,2) not null check(ground_base_nightly_rate>0),
  pricing_authority text not null check(pricing_authority='shared_schedule'),
  activity_ids uuid[] not null check(cardinality(activity_ids)=4),
  parity_fingerprint text not null check(parity_fingerprint~'^[0-9a-f]{32}$'),
  validator_source_before_hash text not null check(validator_source_before_hash~'^[0-9a-f]{64}$'),
  validator_source_after_hash text not null check(validator_source_after_hash~'^[0-9a-f]{64}$'),
  check(validator_source_before_hash=validator_source_after_hash),
  inert_snapshot_source_hash text not null check(inert_snapshot_source_hash~'^[0-9a-f]{64}$'),
  canonical_snapshot_source_hash text not null check(canonical_snapshot_source_hash~'^[0-9a-f]{64}$'),
  activation_snapshot_source_hash text not null check(activation_snapshot_source_hash~'^[0-9a-f]{64}$'),
  state_validator_source_hash text not null check(state_validator_source_hash~'^[0-9a-f]{64}$'),
  receipt_validator_source_hash text not null check(receipt_validator_source_hash~'^[0-9a-f]{64}$'),
  transaction_preservation_source_hash text not null
    check(transaction_preservation_source_hash~'^[0-9a-f]{64}$'),
  apply_source_hash text not null check(apply_source_hash~'^[0-9a-f]{64}$'),
  freeze_trigger_source_hash text not null check(freeze_trigger_source_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
comment on table public.hotel_seven_arches_pricing_activation_evolution_receipts is
  'Reviewed 7 Arches activation: explicit positive base-rate inputs; the exact shared schedule remains authoritative.';
alter table public.hotel_seven_arches_pricing_activation_evolution_receipts enable row level security;
revoke all on table public.hotel_seven_arches_pricing_activation_evolution_receipts
  from public,anon,authenticated,service_role;

create function public.hotel_v2_seven_arches_pricing_activation_immutable()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $function$
begin
  raise exception using errcode='55000',
    message='hotels_v2_seven_arches_pricing_activation_immutable';
end
$function$;

-- A pricing-owned, acyclic projection seam.  The historical Stage 2 helper is
-- source-pinned by Task2 and deliberately remains byte-exact.  This projector
-- rebuilds its successful Task1/Task2 normalization directly from raw data,
-- while replacing only the broad site_settings row fingerprint with the exact
-- Hotels lifecycle contract introduced independently by 114425.
create function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_raw_task2 jsonb;
  v_raw_stage2 jsonb;
  v_task2 jsonb;
  v_stage2 jsonb;
  v_locked_task2 jsonb;
  v_locked_stage2 jsonb;
  v_locked_stage2_compatible jsonb;
  v_locked_lifecycle_fingerprint text;
  v_transaction_task2 jsonb;
  v_scoped_lineage jsonb;
  v_lifecycle jsonb;
  v_lifecycle_fingerprint text;
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_task2_foundation public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_receipt record;
  v_foundation hotels_v2_private.hotel_external_calendar_foundation_receipts%rowtype;
  v_activation hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
  v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
  v_inflight_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_inflight_admin_receipt public.hotel_admin_pricing_action_receipts%rowtype;
  v_inflight_activity_ids uuid[];
  v_rate_plan_before jsonb;
  v_schedule_before jsonb;
  v_upper_rate_before jsonb;
  v_ground_rate_before jsonb;
  v_expected_original jsonb;
  v_provider record;
  v_provider_prior jsonb;
  v_provider_receipt_count integer:=0;
  v_task2_receipt_count integer:=0;
  v_pricing_activation_count integer:=0;
  v_visible_context_count integer:=0;
  v_current_context_count integer:=0;
  v_inflight_exact boolean:=false;
  v_provider_oid oid:=to_regprocedure(
    'public.hotel_v2_external_calendar_provider_sources_are_attributable()');
  v_context_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_context_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_freeze_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_c_h3_1p_freeze_trigger()');
  v_admin_receipt_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()');
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
begin
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_rooms_v2_enabled is not distinct from false
       and setting.hotel_external_sync_enabled is not null
       and setting.hotel_instant_booking_enabled is not distinct from false
       and setting.hotel_stripe_connect_enabled is not distinct from false)
     or (select count(*)
       from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*)
       from public.hotel_admin_availability_foundation_receipts)<>1
     or (select count(*)
       from public.hotel_partner_workspace_foundation_receipts)<>1
     or (select count(*)
       from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or v_scoped_lineage is null
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true then
    return null;
  end if;
  select * into strict v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_original
  from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into strict v_task2_foundation
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select * into strict v_foundation
  from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1;
  select * into strict v_activation
  from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
  if v_original.id is distinct from 1
     or v_original.protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_original.protected_fingerprints)
     or v_owner.id is distinct from 1
     or v_owner.contract_version is distinct from
       'hotels_v2_admin_d_foundation_evolution_v2'
     or v_owner.original_foundation_receipt_id is distinct from v_original.id
     or v_owner.original_protected_fingerprint is distinct from
       v_original.protected_fingerprint
     or v_owner.before_current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.before_current_protected_fingerprints)
     or v_owner.current_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_owner.current_protected_fingerprints)
     or v_owner.stage2_before_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_before_current_protected_fingerprints)
     or v_owner.stage2_current_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_current_protected_fingerprints)
     or v_owner.allowed_fingerprint_keys is distinct from array[
       'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
       'hotel_partner_event_outbox','non_admin_d_activity']::text[]
     or v_owner.stage2_allowed_fingerprint_keys is distinct from array[
       'hotel_partner_hotel_permissions','non_external_calendar_activity',
       'non_external_calendar_partner_receipts']::text[]
     or (v_owner.current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
       is distinct from
       (v_owner.before_current_protected_fingerprints-v_owner.allowed_fingerprint_keys)
     or (v_owner.stage2_current_protected_fingerprints-
       v_owner.stage2_allowed_fingerprint_keys) is distinct from
       (v_owner.stage2_before_current_protected_fingerprints-
       v_owner.stage2_allowed_fingerprint_keys)
     or exists(select 1 from unnest(v_owner.allowed_fingerprint_keys) changed(key)
       where v_owner.current_protected_fingerprints->changed.key is not distinct from
         v_owner.before_current_protected_fingerprints->changed.key)
     or exists(select 1 from unnest(v_owner.stage2_allowed_fingerprint_keys) changed(key)
       where v_owner.stage2_current_protected_fingerprints->changed.key is not distinct from
         v_owner.stage2_before_current_protected_fingerprints->changed.key)
     or v_task2_foundation.id is distinct from 1
     or not exists(select 1
       from public.hotel_partner_workspace_foundation_receipts partner_foundation
       where partner_foundation.id=1
         and partner_foundation.protected_fingerprint=
           public.hotel_v2_h3_2b_hash(partner_foundation.protected_fingerprints)
         and v_task2_foundation.original_h3_2b_foundation_fingerprint
           is not distinct from partner_foundation.protected_fingerprint)
     or v_task2_foundation.owner_evolution_receipt_id is distinct from v_owner.id
     or v_task2_foundation.owner_evolution_receipt_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
         to_jsonb(extract(epoch from v_owner.created_at)),false))
     or v_task2_foundation.protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_task2_foundation.protected_fingerprints)
     or v_task2_foundation.stage2_compatibility_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
     or v_provider_oid is null
     or v_task2_foundation.provider_source_attribution_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))
     or v_foundation.id is distinct from 1
     or v_foundation.protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(v_foundation.protected_fingerprints)
     or v_activation.id is distinct from 1
     or v_activation.created_at is null or not isfinite(v_activation.created_at)
     or (v_activation.site_settings_without_external_fingerprint
       ~'^[0-9a-f]{64}$') is distinct from true
     or jsonb_typeof(v_activation.compatibility_function_fingerprints)
       is distinct from 'object' then
    return null;
  end if;
  if (select count(*) from jsonb_object_keys(
       v_activation.compatibility_function_fingerprints))<>20
     or (v_activation.compatibility_function_fingerprints ?& array[
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
     ]::text[]) is distinct from true
     or exists(select 1 from jsonb_each_text(
       v_activation.compatibility_function_fingerprints) fingerprint(signature,value)
       where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true) then
    return null;
  end if;

  -- Stage2F is historical compatibility evidence, not authority over the
  -- mutable site_settings row.  Pin its exact immutable catalog and function
  -- security without comparing the historical row-wide settings fingerprint
  -- to current metadata.
  if not exists(select 1 from pg_class relation where relation.oid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
     or (select count(*) from pg_attribute attribute
       where attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and attribute.attnum>0 and not attribute.attisdropped)<>4
     or exists(select 1 from (values
       (1::smallint,'id','smallint',true,null::text),
       (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
       (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
       (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
     ) expected(attnum,attname,type_name,not_null,default_expression)
     left join pg_attribute attribute on attribute.attrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
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
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)<>4
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='p' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='(id=1)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')<>1
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
       and trigger_row.tgfoid=
         to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()')
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name))
     or not exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
       'hotels_v2_private'::regnamespace
       and namespace_row.nspowner='postgres'::regrole)
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE')
     or exists(select 1 from (values
       ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
         array['search_path=pg_catalog']::text[],
         'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
       ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
       ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,
         's'::"char",array['search_path=pg_catalog, public']::text[],
         'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
       ('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",
         array['search_path=pg_catalog, public']::text[],
         '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
     ) expected(signature,security_definer,volatility,path,source_hash)
     left join pg_proc procedure_row
       on procedure_row.oid=to_regprocedure(expected.signature)
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole
       or procedure_row.prosecdef is distinct from expected.security_definer
       or procedure_row.provolatile is distinct from expected.volatility
       or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return null;
  end if;

  if to_regclass(
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null then
    return null;
  end if;
  select count(*) into v_task2_receipt_count
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts;
  if v_task2_receipt_count>1
     or not exists(select 1 from pg_class relation where relation.oid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or (select count(*) from pg_attribute attribute where attribute.attrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and attribute.attnum>0 and not attribute.attisdropped)<>10
     or exists(select 1 from (values
       (1::smallint,'id','smallint',true,null::text),
       (2::smallint,'contract_version','text',true,null::text),
       (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
       (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
       (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
       (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
       (7::smallint,'scoped_lineage_source_hash','text',true,null::text),
       (8::smallint,'canonical_snapshot_source_hash','text',true,null::text),
       (9::smallint,'validator_source_hash','text',true,null::text),
       (10::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
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
         is distinct from expected.default_expression)
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)<>10
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='p' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='(id=1)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(contract_version=''hotels_v2_seven_arches_task2_stage2_compatibility_v1''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(canonical_task2_protected_fingerprints)=''object''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[5]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(canonical_stage2_protected_fingerprints)=''object''::text)')<>1
     or exists(select 1 from (values
       (4::smallint,'canonical_task2_protected_fingerprint'),
       (6::smallint,'canonical_stage2_protected_fingerprint'),
       (7::smallint,'scoped_lineage_source_hash'),
       (8::smallint,'canonical_snapshot_source_hash'),
       (9::smallint,'validator_source_hash')
     ) expected(attnum,column_name) where (select count(*)
       from pg_constraint constraint_row where constraint_row.conrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[expected.attnum]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='('||expected.column_name||
             '~''^[0-9a-f]{64}$''::text)')<>1)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and trigger_row.tgname=
         'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
       and trigger_row.tgfoid=
         to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()')
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
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
         privilege.name)) then
    return null;
  end if;
  if v_task2_receipt_count=1 and (not exists(select 1
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt
    where receipt.id=1
      and receipt.contract_version=
        'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
      and receipt.created_at is not null and isfinite(receipt.created_at)
      and receipt.canonical_task2_protected_fingerprint=
        public.hotel_v2_h3_2b_hash(receipt.canonical_task2_protected_fingerprints)
      and receipt.canonical_stage2_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          receipt.canonical_stage2_protected_fingerprints)
      and receipt.scoped_lineage_source_hash=public.hotel_v2_h3_2b_hash(
        to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
      and receipt.canonical_snapshot_source_hash=public.hotel_v2_h3_2b_hash(
        to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure)))
      and receipt.validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
        pg_get_functiondef(
          to_regprocedure(
            'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()')))))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
      or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
          to_regprocedure(
            'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()')
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))) then
    return null;
  end if;

  -- This object is intentionally byte-equivalent to the 114425 lifecycle v2
  -- contract.  OFF and ON are both supported only after the live non-NULL flag
  -- and the immutable Stage2F evidence above have been proved.
  v_lifecycle:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false);
  v_lifecycle_fingerprint:=
    public.hotel_v2_external_calendar_worker_hash(v_lifecycle);
  if v_lifecycle_fingerprint is null then return null; end if;

  v_raw_task2:=public.hotel_v2_h3_2b_protected_fingerprints();
  v_raw_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  if v_raw_task2 is null or v_raw_stage2 is null
     or v_raw_task2->'site_settings' is null
     or v_raw_stage2->'site_settings' is null then
    return null;
  end if;

  -- Exact Task2 success projection from 114370, without its broad
  -- site_settings member.
  v_task2:=v_raw_task2||jsonb_build_object(
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
  v_task2:=jsonb_set(v_task2,'{site_settings}',
    to_jsonb(v_lifecycle_fingerprint),false);

  -- Exact Stage2 success projection from 114370.  Its prerequisite validation
  -- remains in the callers; this lower-layer function performs no upward call.
  v_stage2:=jsonb_set(jsonb_set(jsonb_set(v_raw_stage2,'{hotels}',
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

  if to_regclass(
      'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    execute 'select count(*) from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'
      into v_provider_receipt_count;
    if v_provider_receipt_count>1 then return null; end if;
    if v_provider_receipt_count=1 then
      execute 'select * from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts where id=1'
        into strict v_provider;
      v_provider_prior:=v_provider.prior_compatible_fingerprints;
      if v_provider.id is distinct from 1
         or v_provider.original_foundation_fingerprint is distinct from
           v_foundation.protected_fingerprint
         or v_provider.original_protected_fingerprints is distinct from
           v_foundation.protected_fingerprints
         or v_provider.prior_compatible_fingerprint is distinct from
           public.hotel_v2_external_calendar_worker_hash(v_provider_prior)
         or v_provider_prior->'non_ical_calendar_sources' is null
         or v_task2_foundation.protected_fingerprints->
           'hotel_calendar_source_configs' is null
         or v_task2_foundation.provider_source_attribution_source_hash is distinct from
           public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))
         or v_provider.evolution_helper_fingerprints->>
           'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
           is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(
             pg_get_functiondef(v_provider_oid)))
         or not exists(select 1 from pg_proc procedure_row
           where procedure_row.oid=v_provider_oid
             and procedure_row.proowner='postgres'::regrole
             and procedure_row.prosecdef and procedure_row.provolatile='s'
             and procedure_row.proconfig=
               array['search_path=pg_catalog, public']::text[]
             and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
             and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
             and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
             and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
         or not exists(select 1 from pg_class relation where relation.oid=
           'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
           and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
         or exists(select 1 from pg_policy policy where policy.polrelid=
           'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass)
         or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
           'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
           and not trigger_row.tgisinternal)<>1
         or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
           'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
           and trigger_row.tgname=
             'hotel_external_calendar_provider_evolution_receipt_immutable'
           and trigger_row.tgfoid=
             to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()')
           and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
           and not trigger_row.tgisinternal)
         or exists(select 1 from unnest(array[
           'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
         ]) privilege(name) where has_table_privilege(0::oid,
             'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass,
             privilege.name)
           or has_table_privilege('anon',
             'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass,
             privilege.name)
           or has_table_privilege('authenticated',
             'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass,
             privilege.name)
           or has_table_privilege('service_role',
             'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass,
             privilege.name))
         or public.hotel_v2_external_calendar_provider_sources_are_attributable()
           is not true then
        return null;
      end if;
      v_task2:=jsonb_set(v_task2,'{hotel_calendar_source_configs}',
        v_task2_foundation.protected_fingerprints->
          'hotel_calendar_source_configs',false);
      v_stage2:=jsonb_set(v_stage2,'{non_ical_calendar_sources}',
        v_provider_prior->'non_ical_calendar_sources',false);
    end if;
  end if;

  select count(*) into v_pricing_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_pricing_activation_count>1 then return null; end if;
  if v_pricing_activation_count=0 then
    select count(*),count(*) filter(where transaction_id=txid_current())
      into v_visible_context_count,v_current_context_count
    from public.hotel_seven_arches_pricing_activation_transaction_context;
    if v_visible_context_count=0 and v_current_context_count=0 then
      if v_task2_receipt_count=0 then
        -- Installation bootstrap: the current baseline was captured only
        -- after the complete protected relation universe was locked.  The
        -- temporary relation is deliberately unreachable after COMMIT.
        if to_regclass(
             'pg_temp.seven_arches_pricing_activation_locked_baseline') is null then
          return null;
        end if;
        execute $sql$
          select property_fingerprints,stage2_fingerprints,
            stage2_compatible_fingerprints,
            site_settings_lifecycle_fingerprint
          from pg_temp.seven_arches_pricing_activation_locked_baseline
        $sql$
        into strict v_locked_task2,v_locked_stage2,v_locked_stage2_compatible,
          v_locked_lifecycle_fingerprint;
        if v_locked_lifecycle_fingerprint is distinct from v_lifecycle_fingerprint
           or v_task2 is distinct from jsonb_set(
             v_locked_task2,'{site_settings}',to_jsonb(v_lifecycle_fingerprint),false)
           or v_stage2 is distinct from jsonb_set(
             v_locked_stage2_compatible,'{site_settings}',
             to_jsonb(v_lifecycle_fingerprint),false) then
          return null;
        end if;
      else
        -- After installation the immutable compatibility receipt, rather
        -- than the superseded historical maps, is the canonical pre-activation
        -- baseline.  Every member remains bound; only site_settings has the
        -- independently proved lifecycle representation.
        select * into strict v_task2_receipt
        from public.hotel_seven_arches_task2_stage2_compatibility_receipts
        where id=1;
        if v_task2_receipt.canonical_task2_protected_fingerprint is distinct from
             public.hotel_v2_h3_2b_hash(
               v_task2_receipt.canonical_task2_protected_fingerprints)
           or v_task2_receipt.canonical_stage2_protected_fingerprint is distinct from
             public.hotel_v2_external_calendar_worker_hash(
               v_task2_receipt.canonical_stage2_protected_fingerprints)
           or v_task2_receipt.scoped_lineage_source_hash is distinct from
             public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
               'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
           or v_task2_receipt.canonical_snapshot_source_hash is distinct from
             public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
               'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure))) then
          return null;
        end if;
      end if;
    elsif v_visible_context_count=1 and v_current_context_count=1
          and v_task2_receipt_count=1 then
      -- The only count-zero exception is the persisted, typed Apply context,
      -- recognized solely by the current transaction id and linked evidence.
      select * into v_context
      from public.hotel_seven_arches_pricing_activation_transaction_context
      where transaction_id=txid_current();
      if (select count(*) from public.hotel_seven_arches_pricing_activation_reviews
            where id=v_context.review_id)<>1
         or (select count(*) from public.hotel_admin_pricing_action_receipts
            where correlation_id=v_context.correlation_id)<>1
         or (select count(*)
            from public.hotel_seven_arches_task2_stage2_compatibility_receipts
            where id=1)<>1
         or exists(select 1 from (values
              ('rate_plan'::text,
                '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid),
              ('pricing_schedule',
                'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
              ('room_rate','7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
              ('room_rate','3320590d-632d-423f-80d0-fd021cba7293'::uuid)
            ) expected(entity_type,entity_id)
            where (select count(*) from public.hotel_activity_log activity
              where activity.correlation_id=v_context.correlation_id
                and activity.entity_type=expected.entity_type
                and activity.entity_id=expected.entity_id)<>1) then
        return null;
      end if;
      select * into v_inflight_review
      from public.hotel_seven_arches_pricing_activation_reviews
      where id=v_context.review_id;
      select * into v_inflight_admin_receipt
      from public.hotel_admin_pricing_action_receipts
      where correlation_id=v_context.correlation_id;
      select * into v_task2_receipt
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts
      where id=1;
      select array_agg(activity.id order by activity.entity_type,activity.entity_id)
        into v_inflight_activity_ids
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and activity.actor_type='admin' and activity.actor_id=v_context.actor_id
        and activity.action='update'
        and activity.source='hotels_v2_seven_arches_pricing_activation';
      select activity.before_state into v_rate_plan_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type='rate_plan'
        and activity.entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid;
      select activity.before_state into v_schedule_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type='pricing_schedule'
        and activity.entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid;
      select activity.before_state into v_upper_rate_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type='room_rate'
        and activity.entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid;
      select activity.before_state into v_ground_rate_before
      from public.hotel_activity_log activity
      where activity.correlation_id=v_context.correlation_id
        and activity.entity_type='room_rate'
        and activity.entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid;
      v_expected_original:=jsonb_build_object(
        'rate_plan',jsonb_build_object(
          'id',v_rate_plan_before->'id','version',v_rate_plan_before->'version',
          'name_i18n',v_rate_plan_before->'name_i18n',
          'description_i18n',v_rate_plan_before->'description_i18n',
          'cancellation_policy',v_rate_plan_before->'cancellation_policy',
          'is_active',v_rate_plan_before->'is_active',
          'review_status',v_rate_plan_before->'review_status'),
        'room_rates',jsonb_build_array(
          jsonb_build_object(
            'id',v_upper_rate_before->'id',
            'room_type_id',v_upper_rate_before->'room_type_id',
            'base_nightly_rate',v_upper_rate_before->'base_nightly_rate',
            'currency',v_upper_rate_before->'currency',
            'is_active',v_upper_rate_before->'is_active',
            'review_status',v_upper_rate_before->'review_status',
            'version',v_upper_rate_before->'version'),
          jsonb_build_object(
            'id',v_ground_rate_before->'id',
            'room_type_id',v_ground_rate_before->'room_type_id',
            'base_nightly_rate',v_ground_rate_before->'base_nightly_rate',
            'currency',v_ground_rate_before->'currency',
            'is_active',v_ground_rate_before->'is_active',
            'review_status',v_ground_rate_before->'review_status',
            'version',v_ground_rate_before->'version')),
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
            and schedule.hotel_id=
              '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid));

      v_transaction_task2:=
        public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
      v_inflight_exact:=coalesce((
        v_context_guard_oid is not null and v_review_guard_oid is not null
        and exists(select 1 from pg_class relation where relation.oid=
          'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and relation.relowner='postgres'::regrole and relation.relrowsecurity)
        and exists(select 1 from pg_class relation where relation.oid=
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and relation.relowner='postgres'::regrole and relation.relrowsecurity)
        and (select count(*) from pg_attribute attribute where attribute.attrelid=
          'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and attribute.attnum>0 and not attribute.attisdropped)=9
        and not exists(select 1 from (values
          (1::smallint,'backend_pid','integer',true,null::text),
          (2::smallint,'transaction_id','bigint',true,null::text),
          (3::smallint,'review_id','uuid',true,null::text),
          (4::smallint,'actor_id','uuid',true,null::text),
          (5::smallint,'correlation_id','uuid',true,null::text),
          (6::smallint,'before_protected_fingerprints','jsonb',true,null::text),
          (7::smallint,'before_stage2_protected_fingerprints','jsonb',true,null::text),
          (8::smallint,'applied_entity_ids','uuid[]',true,'''{}''::uuid[]'),
          (9::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
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
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass)=5
        and (select count(*) from pg_constraint constraint_row
          join pg_index index_row on index_row.indexrelid=constraint_row.conindid
          where constraint_row.conrelid=
              'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
            and constraint_row.contype='p' and constraint_row.convalidated
            and constraint_row.conkey=array[1]::smallint[]
            and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (backend_pid)'
            and index_row.indisprimary and index_row.indisunique
            and index_row.indisvalid and index_row.indisready)=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and constraint_row.contype='f' and constraint_row.convalidated
          and not constraint_row.condeferrable and constraint_row.conkey=array[3]::smallint[]
          and constraint_row.confrelid=
            'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and constraint_row.confkey=array[1]::smallint[]
          and constraint_row.confupdtype='a' and constraint_row.confdeltype='r')=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and constraint_row.contype='c' and constraint_row.convalidated
          and not constraint_row.connoinherit
          and constraint_row.conkey=array[8]::smallint[]
          and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
            '[[:space:]]+','','g')=
            '((cardinality(applied_entity_ids)<=4)AND(applied_entity_ids<@ARRAY['||
            '''22e47a63-a630-4fb6-8f43-816f2d3fdc17''::uuid,'||
            '''b0a3104f-7b31-5265-a59f-c2d166f11a23''::uuid,'||
            '''7e420964-9cbf-4f1b-abd3-09840af5240f''::uuid,'||
            '''3320590d-632d-423f-80d0-fd021cba7293''::uuid]))')=1
        and not exists(select 1 from (values
          (6::smallint,'before_protected_fingerprints'),
          (7::smallint,'before_stage2_protected_fingerprints')
        ) expected(attnum,column_name) where (select count(*)
          from pg_constraint constraint_row where constraint_row.conrelid=
            'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
            and constraint_row.contype='c' and constraint_row.convalidated
            and not constraint_row.connoinherit
            and constraint_row.conkey=array[expected.attnum]::smallint[]
            and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
              '[[:space:]]+','','g')='(jsonb_typeof('||expected.column_name||
                ')=''object''::text)')<>1)
        and (select count(*) from pg_attribute attribute where attribute.attrelid=
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and attribute.attnum>0 and not attribute.attisdropped)=14
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
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
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
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
            'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and constraint_row.contype='f' and constraint_row.convalidated
          and not constraint_row.condeferrable and constraint_row.conkey=array[3]::smallint[]
          and constraint_row.confrelid='public.hotels'::regclass
          and constraint_row.confkey=array[1]::smallint[]
          and constraint_row.confupdtype='a' and constraint_row.confdeltype='r')=1
        and (select count(*) from pg_constraint constraint_row where
          constraint_row.conrelid=
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
        and not exists(select 1 from pg_policy policy where policy.polrelid in(
          'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass,
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass))
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass
          and trigger_row.tgname='hotel_seven_arches_pricing_activation_context_guard'
          and trigger_row.tgfoid=v_context_guard_oid and trigger_row.tgtype=23
          and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_seven_arches_pricing_activation_reviews'::regclass
          and trigger_row.tgname='hotel_seven_arches_pricing_activation_review_guard'
          and trigger_row.tgfoid=v_review_guard_oid and trigger_row.tgtype=31
          and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
        and exists(select 1 from pg_class relation where relation.oid=
          'public.hotel_admin_pricing_action_receipts'::regclass
          and relation.relowner='postgres'::regrole and relation.relrowsecurity)
        and exists(select 1 from pg_class relation where relation.oid=
          'public.hotel_activity_log'::regclass
          and relation.relowner='postgres'::regrole and relation.relrowsecurity)
        and not exists(select 1 from pg_policy policy where policy.polrelid=
          'public.hotel_admin_pricing_action_receipts'::regclass)
        and (select count(*) from pg_policy policy where policy.polrelid=
          'public.hotel_activity_log'::regclass)=1
        and exists(select 1 from pg_policy policy where policy.polrelid=
          'public.hotel_activity_log'::regclass
          and policy.polname='hotel_activity_log_admin_select'
          and policy.polcmd='r' and policy.polpermissive
          and policy.polroles=array[('authenticated'::regrole)::oid]
          and policy.polwithcheck is null
          and pg_get_expr(policy.polqual,policy.polrelid) in(
            'is_current_user_admin()','public.is_current_user_admin()'))
        and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_admin_pricing_action_receipts'::regclass
          and not trigger_row.tgisinternal)=1
        and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
          'public.hotel_admin_pricing_action_receipts'::regclass
          and trigger_row.tgname='hotel_admin_pricing_action_receipts_immutable'
          and trigger_row.tgfoid=v_admin_receipt_guard_oid and trigger_row.tgtype=27
          and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
        and not exists(select 1 from (values
          (v_context_guard_oid,
            '6e9893cd347504be63ab5699e02a592f6e81355c5b31da31ccaca2dd6ee9c5f0',
            array['search_path=pg_catalog, public, auth']::text[]),
          (v_review_guard_oid,
            '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758',
            array['search_path=pg_catalog, public, auth']::text[]),
          (v_freeze_guard_oid,
            'd864f254c257be00491d0c2e508c4b6585e16bf3e35992fa174050d2205a6bf6',
            array['search_path=pg_catalog, public']::text[]),
          (v_admin_receipt_guard_oid,
            '352e7e040c99044f0fb01b03656a9f3193694039afd0079567c25fb3967bbbd0',
            array['search_path=pg_catalog, public']::text[])
        ) expected(function_oid,source_hash,path)
        left join pg_proc procedure_row on procedure_row.oid=expected.function_oid
        where procedure_row.oid is null
          or procedure_row.proowner<>'postgres'::regrole
          or not procedure_row.prosecdef or procedure_row.provolatile<>'v'
          or procedure_row.proconfig is distinct from expected.path
          or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
            'hex') is distinct from expected.source_hash
          or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
          or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
          or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
        and exists(select 1 from pg_proc procedure_row where procedure_row.oid=v_apply_oid
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
        and not exists(select 1 from (values
          ('public.hotel_seven_arches_pricing_activation_transaction_context'::regclass),
          ('public.hotel_seven_arches_pricing_activation_reviews'::regclass),
          ('public.hotel_admin_pricing_action_receipts'::regclass)
        ) relation(relation_oid)
        cross join unnest(array[
          'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
        ]) privilege(name)
        where has_table_privilege(0::oid,relation.relation_oid,privilege.name)
          or has_table_privilege('anon',relation.relation_oid,privilege.name)
          or has_table_privilege('authenticated',relation.relation_oid,privilege.name)
          or has_table_privilege('service_role',relation.relation_oid,privilege.name))
        and not has_table_privilege(0::oid,
          'public.hotel_activity_log'::regclass,'SELECT')
        and not has_table_privilege('anon',
          'public.hotel_activity_log'::regclass,'SELECT')
        and not has_table_privilege('authenticated',
          'public.hotel_activity_log'::regclass,'SELECT')
        and has_table_privilege('service_role',
          'public.hotel_activity_log'::regclass,'SELECT')
        and has_table_privilege('service_role',
          'public.hotel_activity_log'::regclass,'INSERT')
        and not exists(select 1 from (values
          (0::oid),(('anon'::regrole)::oid),(('authenticated'::regrole)::oid)
        ) role(role_oid) cross join unnest(array[
          'INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
        ]) privilege(name) where has_table_privilege(
          role.role_oid,'public.hotel_activity_log'::regclass,privilege.name))
        and not exists(select 1 from unnest(array[
          'UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
        ]) privilege(name) where has_table_privilege(
          'service_role','public.hotel_activity_log'::regclass,privilege.name))
        and auth.uid() is not null and auth.uid()=v_context.actor_id
        and public.is_current_user_admin() is true
        and v_context.transaction_id=txid_current()
        and v_context.created_at is not null and isfinite(v_context.created_at)
        and v_context.applied_entity_ids=array[
          '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
          'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
          '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
          '3320590d-632d-423f-80d0-fd021cba7293'::uuid]
        and v_task2_receipt.id=1
        and v_task2_receipt.contract_version=
          'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
        and v_task2_receipt.canonical_task2_protected_fingerprint=
          public.hotel_v2_h3_2b_hash(
            v_task2_receipt.canonical_task2_protected_fingerprints)
        and v_task2_receipt.canonical_stage2_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            v_task2_receipt.canonical_stage2_protected_fingerprints)
        and v_scoped_lineage is not null
        and v_inflight_review.id=v_context.review_id
        and v_inflight_review.contract_version=
          'hotels_v2_seven_arches_pricing_activation_plan_v1'
        and v_inflight_review.hotel_id=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and v_inflight_review.actor_id=v_context.actor_id
        and v_inflight_review.reviewed_at is not null
        and isfinite(v_inflight_review.reviewed_at)
        and v_inflight_review.expires_at is not null
        and isfinite(v_inflight_review.expires_at)
        and v_inflight_review.expires_at=
          v_inflight_review.reviewed_at+interval '30 minutes'
        and v_inflight_review.created_at is not null
        and isfinite(v_inflight_review.created_at)
        and v_inflight_review.consumed_at is not null
        and isfinite(v_inflight_review.consumed_at)
        and statement_timestamp()<v_inflight_review.expires_at
        and v_context.created_at>=v_inflight_review.reviewed_at
        and v_context.created_at<v_inflight_review.expires_at
        and v_inflight_review.consumed_at>=v_inflight_review.reviewed_at
        and v_inflight_review.consumed_at<v_inflight_review.expires_at
        and v_inflight_review.consumed_correlation_id=v_context.correlation_id
        and v_inflight_review.consumed_idempotency_key is not null
        and public.hotel_v2_h2a_keys_allowed(v_inflight_review.reviewed_plan,array[
          'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
          'expires_at','operation','plan_fingerprint']) is true
        and v_inflight_review.reviewed_plan?&array[
          'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
          'expires_at','operation','plan_fingerprint']
        and v_inflight_review.reviewed_plan->>'contract_version'=
          'hotels_v2_seven_arches_pricing_activation_plan_v1'
        and v_inflight_review.reviewed_plan->>'review_id'=
          v_inflight_review.id::text
        and v_inflight_review.reviewed_plan->>'hotel_id'=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and v_inflight_review.reviewed_plan->>'snapshot_token'=
          v_inflight_review.snapshot_token
        and v_inflight_review.reviewed_plan->>'reviewed_at'=to_char(
          v_inflight_review.reviewed_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        and v_inflight_review.reviewed_plan->>'expires_at'=to_char(
          v_inflight_review.expires_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        and v_inflight_review.reviewed_plan->>'plan_fingerprint'=
          v_inflight_review.plan_fingerprint
        and v_inflight_review.plan_fingerprint=encode(extensions.digest(convert_to(
          (v_inflight_review.reviewed_plan-'plan_fingerprint')::text,'UTF8'),
          'sha256'),'hex')
        and public.hotel_v2_h2a_keys_allowed(
          v_inflight_review.reviewed_plan->'operation',array[
            'entity','action','id','expected_original','payload']) is true
        and (v_inflight_review.reviewed_plan->'operation')?&array[
          'entity','action','id','expected_original','payload']
        and v_inflight_review.reviewed_plan#>>'{operation,entity}'='pricing_activation'
        and v_inflight_review.reviewed_plan#>>'{operation,action}'='activate'
        and v_inflight_review.reviewed_plan#>>'{operation,id}'=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and public.hotel_v2_h2a_keys_allowed(
          v_inflight_review.reviewed_plan#>'{operation,payload}',array[
            'upper_base_nightly_rate','ground_base_nightly_rate',
            'rate_plan_name_i18n','rate_plan_description_i18n',
            'schedule_name_i18n','reason']) is true
        and (v_inflight_review.reviewed_plan#>'{operation,payload}')?&array[
          'upper_base_nightly_rate','ground_base_nightly_rate',
          'rate_plan_name_i18n','rate_plan_description_i18n',
          'schedule_name_i18n','reason']
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          '{operation,payload,upper_base_nightly_rate}')='number'
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          '{operation,payload,ground_base_nightly_rate}')='number'
        and jsonb_typeof(v_inflight_review.reviewed_plan#>
          '{operation,expected_original}')='object'
        and v_inflight_review.reviewed_plan#>'{operation,expected_original}'
          is not distinct from v_expected_original
        and jsonb_typeof(v_inflight_review.result)='object'
        and v_inflight_review.result is not distinct from jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_pricing_activation_apply_result_v1',
          'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
          'changed',true,'replayed',false,'review_id',v_inflight_review.id,
          'correlation_id',v_context.correlation_id,
          'idempotency_key',v_inflight_review.consumed_idempotency_key,
          'activity_ids',to_jsonb(v_inflight_activity_ids),
          'public_change',false,'legacy_authoritative',true)
        and v_inflight_admin_receipt.hotel_id=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and v_inflight_admin_receipt.actor_id=v_context.actor_id
        and v_inflight_admin_receipt.correlation_id=v_context.correlation_id
        and v_inflight_admin_receipt.idempotency_key=
          v_inflight_review.consumed_idempotency_key
        and v_inflight_admin_receipt.created_at is not null
        and isfinite(v_inflight_admin_receipt.created_at)
        and v_inflight_admin_receipt.created_at>=v_context.created_at
        and v_inflight_admin_receipt.created_at<v_inflight_review.expires_at
        and v_inflight_admin_receipt.result is not distinct from
          v_inflight_review.result
        and v_inflight_admin_receipt.request_hash=encode(extensions.digest(convert_to(
          jsonb_build_object('reviewed_plan',v_inflight_review.reviewed_plan,
            'correlation_id',v_context.correlation_id)::text,'UTF8'),
          'sha256'),'hex')
        and cardinality(v_inflight_activity_ids)=4
        and (select count(*) from public.hotel_activity_log activity
          where activity.correlation_id=v_context.correlation_id)=4
        and (select count(*) from public.hotel_activity_log activity
          where activity.correlation_id=v_context.correlation_id
            and activity.hotel_id=
              '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
            and activity.actor_type='admin'
            and activity.actor_id=v_context.actor_id and activity.action='update'
            and activity.source='hotels_v2_seven_arches_pricing_activation'
            and activity.created_at is not null and isfinite(activity.created_at)
            and activity.created_at>=v_context.created_at
            and activity.created_at<v_inflight_review.expires_at)=4
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type='rate_plan'
            and activity.entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
            and jsonb_typeof(activity.before_state)='object'
            and jsonb_typeof(activity.after_state)='object'
            and activity.before_state->>'is_active'='false'
            and activity.after_state->>'is_active'='true'
            and activity.after_state->'name_i18n' is not distinct from
              v_inflight_review.reviewed_plan#>'{operation,payload,rate_plan_name_i18n}'
            and activity.after_state->'description_i18n' is not distinct from
              v_inflight_review.reviewed_plan#>'{operation,payload,rate_plan_description_i18n}'
            and (activity.after_state-array[
              'name_i18n','description_i18n','is_active','version','updated_at'])
              is not distinct from (activity.before_state-array[
              'name_i18n','description_i18n','is_active','version','updated_at'])
            and pg_input_is_valid(activity.before_state->>'version','integer')
            and pg_input_is_valid(activity.after_state->>'version','integer')
            and case when
              pg_input_is_valid(activity.before_state->>'version','integer')
              and pg_input_is_valid(activity.after_state->>'version','integer')
              then (activity.after_state->>'version')::integer=
                (activity.before_state->>'version')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>'updated_at','timestamp with time zone')
            and pg_input_is_valid(
              activity.after_state->>'updated_at','timestamp with time zone')
            and case when pg_input_is_valid(
                activity.before_state->>'updated_at','timestamp with time zone')
              and pg_input_is_valid(
                activity.after_state->>'updated_at','timestamp with time zone')
              then (activity.after_state->>'updated_at')::timestamptz>
                (activity.before_state->>'updated_at')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(plan)
              from public.hotel_rate_plans plan where plan.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type='pricing_schedule'
            and activity.entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
            and jsonb_typeof(activity.before_state)='object'
            and jsonb_typeof(activity.after_state)='object'
            and activity.before_state->>'is_active'='false'
            and activity.after_state->>'is_active'='true'
            and activity.after_state->'name_i18n' is not distinct from
              v_inflight_review.reviewed_plan#>'{operation,payload,schedule_name_i18n}'
            and (activity.after_state-array[
              'name_i18n','is_active','version','updated_at']) is not distinct from
              (activity.before_state-array[
              'name_i18n','is_active','version','updated_at'])
            and pg_input_is_valid(activity.before_state->>'version','integer')
            and pg_input_is_valid(activity.after_state->>'version','integer')
            and case when
              pg_input_is_valid(activity.before_state->>'version','integer')
              and pg_input_is_valid(activity.after_state->>'version','integer')
              then (activity.after_state->>'version')::integer=
                (activity.before_state->>'version')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>'updated_at','timestamp with time zone')
            and pg_input_is_valid(
              activity.after_state->>'updated_at','timestamp with time zone')
            and case when pg_input_is_valid(
                activity.before_state->>'updated_at','timestamp with time zone')
              and pg_input_is_valid(
                activity.after_state->>'updated_at','timestamp with time zone')
              then (activity.after_state->>'updated_at')::timestamptz>
                (activity.before_state->>'updated_at')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(schedule)
              from public.hotel_pricing_schedules schedule
              where schedule.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type='room_rate'
            and activity.entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
            and jsonb_typeof(activity.before_state)='object'
            and jsonb_typeof(activity.after_state)='object'
            and activity.before_state->>'is_active'='false'
            and activity.before_state->'base_nightly_rate'='0'::jsonb
            and activity.after_state->>'is_active'='true'
            and activity.after_state->'base_nightly_rate' is not distinct from
              v_inflight_review.reviewed_plan#>
                '{operation,payload,upper_base_nightly_rate}'
            and (activity.after_state-array[
              'base_nightly_rate','is_active','version','updated_at'])
              is not distinct from (activity.before_state-array[
              'base_nightly_rate','is_active','version','updated_at'])
            and pg_input_is_valid(activity.before_state->>'version','integer')
            and pg_input_is_valid(activity.after_state->>'version','integer')
            and case when
              pg_input_is_valid(activity.before_state->>'version','integer')
              and pg_input_is_valid(activity.after_state->>'version','integer')
              then (activity.after_state->>'version')::integer=
                (activity.before_state->>'version')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>'updated_at','timestamp with time zone')
            and pg_input_is_valid(
              activity.after_state->>'updated_at','timestamp with time zone')
            and case when pg_input_is_valid(
                activity.before_state->>'updated_at','timestamp with time zone')
              and pg_input_is_valid(
                activity.after_state->>'updated_at','timestamp with time zone')
              then (activity.after_state->>'updated_at')::timestamptz>
                (activity.before_state->>'updated_at')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(rate)
              from public.hotel_room_rates rate where rate.id=activity.entity_id))
        and exists(select 1 from public.hotel_activity_log activity
          where activity.id=any(v_inflight_activity_ids)
            and activity.entity_type='room_rate'
            and activity.entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
            and jsonb_typeof(activity.before_state)='object'
            and jsonb_typeof(activity.after_state)='object'
            and activity.before_state->>'is_active'='false'
            and activity.before_state->'base_nightly_rate'='0'::jsonb
            and activity.after_state->>'is_active'='true'
            and activity.after_state->'base_nightly_rate' is not distinct from
              v_inflight_review.reviewed_plan#>
                '{operation,payload,ground_base_nightly_rate}'
            and (activity.after_state-array[
              'base_nightly_rate','is_active','version','updated_at'])
              is not distinct from (activity.before_state-array[
              'base_nightly_rate','is_active','version','updated_at'])
            and pg_input_is_valid(activity.before_state->>'version','integer')
            and pg_input_is_valid(activity.after_state->>'version','integer')
            and case when
              pg_input_is_valid(activity.before_state->>'version','integer')
              and pg_input_is_valid(activity.after_state->>'version','integer')
              then (activity.after_state->>'version')::integer=
                (activity.before_state->>'version')::integer+1 else false end
            and pg_input_is_valid(
              activity.before_state->>'updated_at','timestamp with time zone')
            and pg_input_is_valid(
              activity.after_state->>'updated_at','timestamp with time zone')
            and case when pg_input_is_valid(
                activity.before_state->>'updated_at','timestamp with time zone')
              and pg_input_is_valid(
                activity.after_state->>'updated_at','timestamp with time zone')
              then (activity.after_state->>'updated_at')::timestamptz>
                (activity.before_state->>'updated_at')::timestamptz else false end
            and activity.after_state is not distinct from (select to_jsonb(rate)
              from public.hotel_room_rates rate where rate.id=activity.entity_id))
        and (v_transaction_task2-array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[])
          is not distinct from
          (v_context.before_protected_fingerprints-array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[])
        and not exists(select 1 from unnest(array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[]) changed(key)
          where v_transaction_task2->changed.key is null
            or v_context.before_protected_fingerprints->changed.key is null
            or v_transaction_task2->changed.key is not distinct from
              v_context.before_protected_fingerprints->changed.key)
        and (v_raw_stage2-array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts',
          'non_external_calendar_activity']::text[]) is not distinct from
          (v_context.before_stage2_protected_fingerprints-array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts',
          'non_external_calendar_activity']::text[])
        and not exists(select 1 from unnest(array[
          'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
          'hotel_admin_pricing_action_receipts',
          'non_external_calendar_activity']::text[]) changed(key)
          where v_raw_stage2->changed.key is null
            or v_context.before_stage2_protected_fingerprints->changed.key is null
            or v_raw_stage2->changed.key is not distinct from
              v_context.before_stage2_protected_fingerprints->changed.key)),false);
      if v_inflight_exact is not true then return null; end if;
    else
      -- A malformed, stale, duplicate, or foreign transaction context never
      -- falls back to the ordinary count-zero baseline.
      return null;
    end if;
  end if;

  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1',
    'site_settings_lifecycle',v_lifecycle,
    'site_settings_lifecycle_fingerprint',v_lifecycle_fingerprint,
    'task2_protected_fingerprints',v_task2,
    'task2_protected_fingerprint',public.hotel_v2_h3_2b_hash(v_task2),
    'stage2_protected_fingerprints',v_stage2,
    'stage2_protected_fingerprint',
      public.hotel_v2_external_calendar_worker_hash(v_stage2));
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name then
  return null;
end
$function$;

create table public.hotel_seven_arches_task2_stage2_compatibility_receipts(
  id smallint primary key check(id=1),
  contract_version text not null check(contract_version=
    'hotels_v2_seven_arches_task2_stage2_compatibility_v1'),
  canonical_task2_protected_fingerprints jsonb not null
    check(jsonb_typeof(canonical_task2_protected_fingerprints)='object'),
  canonical_task2_protected_fingerprint text not null
    check(canonical_task2_protected_fingerprint~'^[0-9a-f]{64}$'),
  canonical_stage2_protected_fingerprints jsonb not null
    check(jsonb_typeof(canonical_stage2_protected_fingerprints)='object'),
  canonical_stage2_protected_fingerprint text not null
    check(canonical_stage2_protected_fingerprint~'^[0-9a-f]{64}$'),
  scoped_lineage_source_hash text not null
    check(scoped_lineage_source_hash~'^[0-9a-f]{64}$'),
  canonical_snapshot_source_hash text not null
    check(canonical_snapshot_source_hash~'^[0-9a-f]{64}$'),
  validator_source_hash text not null check(validator_source_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
  owner to postgres;
alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts enable row level security;
revoke all on table public.hotel_seven_arches_task2_stage2_compatibility_receipts
  from public,anon,authenticated,service_role;
create trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable
before update or delete on public.hotel_seven_arches_task2_stage2_compatibility_receipts
for each row execute function public.hotel_v2_seven_arches_pricing_activation_immutable();

-- This intentionally validates the immutable transaction receipt rather than
-- comparing that receipt with mutable live global state.  Its Apply source pin
-- also proves the literal relation-lock block precedes the fresh BEFORE
-- snapshot and that the full AFTER projection is captured before return.
create function public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_receipt public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_apply_definition text;
  v_lock_position integer;
  v_before_position integer;
  v_first_mutation_position integer;
  v_after_position integer;
  v_delta_position integer;
begin
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or v_apply_oid is null then
    return false;
  end if;
  select * into strict v_receipt
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  v_apply_definition:=pg_get_functiondef(v_apply_oid);
  v_lock_position:=strpos(v_apply_definition,
    'foreach v_relation in array array[');
  v_before_position:=strpos(v_apply_definition,
    'v_before_protected:=');
  v_first_mutation_position:=strpos(v_apply_definition,
    'update public.hotel_rate_plans set');
  v_after_position:=strpos(v_apply_definition,
    'v_after_protected:=');
  v_delta_position:=strpos(v_apply_definition,
    'hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch');
  return coalesce((
    v_receipt.id=1
    and v_receipt.contract_version=
      'hotels_v2_seven_arches_pricing_activation_evolution_v1'
    and v_receipt.before_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(v_receipt.before_protected_fingerprints)
    and v_receipt.after_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(v_receipt.after_protected_fingerprints)
    and v_receipt.before_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_receipt.before_stage2_protected_fingerprints)
    and v_receipt.after_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_receipt.after_stage2_protected_fingerprints)
    and v_receipt.allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[]
    and v_receipt.stage2_allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts',
      'non_external_calendar_activity']::text[]
    and (v_receipt.after_protected_fingerprints-
      v_receipt.allowed_fingerprint_keys) is not distinct from
      (v_receipt.before_protected_fingerprints-
      v_receipt.allowed_fingerprint_keys)
    and (v_receipt.after_stage2_protected_fingerprints-
      v_receipt.stage2_allowed_fingerprint_keys) is not distinct from
      (v_receipt.before_stage2_protected_fingerprints-
      v_receipt.stage2_allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_receipt.allowed_fingerprint_keys)
      changed(key) where
        v_receipt.after_protected_fingerprints->changed.key is not distinct from
        v_receipt.before_protected_fingerprints->changed.key)
    and not exists(select 1 from unnest(v_receipt.stage2_allowed_fingerprint_keys)
      changed(key) where
        v_receipt.after_stage2_protected_fingerprints->changed.key is not distinct from
        v_receipt.before_stage2_protected_fingerprints->changed.key)
    and v_receipt.transaction_preservation_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)))
    and v_receipt.apply_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(v_apply_definition))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure
      and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
      and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=v_apply_oid
      and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
      and procedure_row.provolatile='v'
      and procedure_row.proconfig=
        array['search_path=pg_catalog, public, auth']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and v_lock_position>0
    and v_before_position>v_lock_position
    and v_first_mutation_position>v_before_position
    and v_after_position>v_first_mutation_position
    and v_delta_position>v_after_position),false);
end
$function$;

create function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_owner_state jsonb;
  v_task2 public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_canonical jsonb;
  v_task2_current jsonb;
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_activation_count integer;
  v_compatible jsonb;
  v_current_scoped_lineage jsonb;
  v_task2_receipt_topology_exact boolean:=false;
begin
  if (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1 then
    return false;
  end if;
  select * into strict v_owner
    from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_task2
    from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select * into strict v_task2_stage2
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  v_current_scoped_lineage:=
    public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_task2_receipt_topology_exact:=coalesce(
    v_task2_stage2.contract_version=
      'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
    and v_task2_stage2.created_at is not null
    and isfinite(v_task2_stage2.created_at)
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute where attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum>0 and not attribute.attisdropped)=10
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
      (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
      (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
      (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
      (7::smallint,'scoped_lineage_source_hash','text',true,null::text),
      (8::smallint,'canonical_snapshot_source_hash','text',true,null::text),
      (9::smallint,'validator_source_hash','text',true,null::text),
      (10::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
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
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=10
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
      (7::smallint,'scoped_lineage_source_hash'),
      (8::smallint,'canonical_snapshot_source_hash'),
      (9::smallint,'validator_source_hash')
    ) expected(attnum,column_name) where (select count(*)
      from pg_constraint constraint_row where constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[expected.attnum]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='('||expected.column_name||
            '~''^[0-9a-f]{64}$''::text)')<>1)
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and trigger_row.tgname=
        'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
      and trigger_row.tgfoid=
        to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()')
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
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
  v_owner_state:=public.hotel_v2_admin_d_current_foundation_snapshot();
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  v_task2_current:=v_canonical->'task2_protected_fingerprints';
  v_compatible:=v_canonical->'stage2_protected_fingerprints';
  select count(*) into v_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_activation_count>1 or (
    v_owner.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_owner.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_owner.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_owner.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_owner.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_owner.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_owner.stage2_current_protected_fingerprints)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
      where foundation.id=1 and foundation.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(foundation.protected_fingerprints))
    and v_task2.protected_fingerprint=public.hotel_v2_h3_2b_hash(v_task2.protected_fingerprints)
    and v_task2.owner_evolution_receipt_id=v_owner.id
    and v_task2.owner_evolution_receipt_fingerprint=
      public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
        to_jsonb(extract(epoch from v_owner.created_at)),false))
    and v_current_scoped_lineage is not null
    and v_current_scoped_lineage->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and exists(select 1 from public.hotel_admin_availability_foundation_receipts original
      where original.id=1
        and original.protected_fingerprint=
          public.hotel_v2_h3_2b_hash(original.protected_fingerprints)
        and v_owner.original_foundation_receipt_id=original.id
        and v_owner.original_protected_fingerprint=original.protected_fingerprint)
    and exists(select 1 from public.partner_resources assignment
      where assignment.id=v_owner.assignment_id
        and assignment.partner_id=v_owner.partner_id
        and assignment.resource_type='hotels'
        and assignment.resource_id=v_owner.hotel_id)
    and exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=v_owner.assignment_id
        and permission.partner_id=v_owner.partner_id
        and permission.hotel_id=v_owner.hotel_id
        and permission.version=1 and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_owner.after_permission)
    and coalesce((v_owner_state->>'original_receipt_intact')::boolean,false)
    and coalesce((v_owner_state->>'seven_arches_assignment_exact')::boolean,false)
    and coalesce((v_owner_state->>'seven_arches_owner_preset_exact')::boolean,false)
    and coalesce((v_owner_state->>'audit_chain_exact')::boolean,false)
    and (select count(*)=1 and bool_and(setting.id=1
      and setting.hotel_rooms_v2_enabled is not distinct from false
      and setting.hotel_external_sync_enabled is not null
      and setting.hotel_instant_booking_enabled is not distinct from false
      and setting.hotel_stripe_connect_enabled is not distinct from false)
      from public.site_settings setting)
    and (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)=1
    and exists(select 1
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.created_at is not null
        and isfinite(receipt.created_at)
        and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
        and case
          when jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
          then (select count(*) from jsonb_object_keys(
                 receipt.compatibility_function_fingerprints))=20
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
            and not exists(select 1 from jsonb_each_text(
              receipt.compatibility_function_fingerprints) fingerprint(signature,value)
              where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true)
          else false
        end)
    and exists(select 1 from pg_class relation where relation.oid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
      and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute
      where attribute.attrelid=
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and attribute.attnum>0 and not attribute.attisdropped)=4
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
      (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
      (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
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
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)=4
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
          'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and constraint_row.contype='p' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='(id=1)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[2]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[3]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')=1
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
      and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
      and trigger_row.tgfoid=
        to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()')
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name) where has_table_privilege(0::oid,
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        privilege.name)
      or has_table_privilege('anon',
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        privilege.name)
      or has_table_privilege('authenticated',
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        privilege.name)
      or has_table_privilege('service_role',
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        privilege.name))
    and exists(select 1 from pg_namespace namespace_row where namespace_row.oid=
      'hotels_v2_private'::regnamespace
      and namespace_row.nspowner='postgres'::regrole)
    and not has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
    and not has_schema_privilege('anon','hotels_v2_private','USAGE')
    and not has_schema_privilege('service_role','hotels_v2_private','USAGE')
    and not has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
    and not has_schema_privilege('anon','hotels_v2_private','CREATE')
    and not has_schema_privilege('authenticated','hotels_v2_private','CREATE')
    and not has_schema_privilege('service_role','hotels_v2_private','CREATE')
    and not exists(select 1 from (values
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        's'::"char",array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,
        's'::"char",array['search_path=pg_catalog, public']::text[],
        'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
    ) expected(signature,security_definer,volatility,path,source_hash)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and public.hotel_v2_partner_workspace_function_lineage_is_exact() is true
    and v_task2.stage2_compatibility_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
      pg_get_functiondef('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
    and v_canonical is not null
    and public.hotel_v2_h2a_keys_allowed(v_canonical,array[
      'contract_version','site_settings_lifecycle',
      'site_settings_lifecycle_fingerprint','task2_protected_fingerprints',
      'task2_protected_fingerprint','stage2_protected_fingerprints',
      'stage2_protected_fingerprint'])
    and v_canonical?&array['contract_version','site_settings_lifecycle',
      'site_settings_lifecycle_fingerprint','task2_protected_fingerprints',
      'task2_protected_fingerprint','stage2_protected_fingerprints',
      'stage2_protected_fingerprint']
    and v_canonical->>'contract_version'=
      'hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1'
    and v_canonical->'site_settings_lifecycle'=jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
      'id',1,'hotel_rooms_v2_enabled',false,
      'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
      'hotel_instant_booking_enabled',false,'hotel_stripe_connect_enabled',false)
    and v_canonical->>'site_settings_lifecycle_fingerprint'=
      public.hotel_v2_external_calendar_worker_hash(
        v_canonical->'site_settings_lifecycle')
    and v_canonical->>'task2_protected_fingerprint'=
      public.hotel_v2_h3_2b_hash(v_task2_current)
    and v_canonical->>'stage2_protected_fingerprint'=
      public.hotel_v2_external_calendar_worker_hash(v_compatible)
    and v_task2_stage2.canonical_task2_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(
        v_task2_stage2.canonical_task2_protected_fingerprints)
    and v_task2_stage2.canonical_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_task2_stage2.canonical_stage2_protected_fingerprints)
    and v_task2_stage2.scoped_lineage_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
      and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
      and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and v_task2_stage2.scoped_lineage_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
      and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
      and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and v_task2_stage2.canonical_snapshot_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure)))
    and exists(select 1 from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure
      and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
      and procedure_row.provolatile='s'
      and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[]
      and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and v_task2_stage2.validator_source_hash=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure)))
    and v_task2_receipt_topology_exact) is not true then
    return false;
  end if;
  if v_activation_count=0 then
    return coalesce((
      (select count(*) from public.hotel_rate_plans
        where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)=1
      and exists(select 1 from public.hotel_rate_plans where
        id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
        and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and code='standard' and review_status='reviewed' and not is_active)
      and (select count(*) from public.hotel_room_rates
        where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)=2
      and (select count(*) from public.hotel_room_rates where
        hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and id in('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
          '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
        and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and review_status='reviewed' and not is_active
        and base_nightly_rate=0 and btrim(currency::text)='EUR')=2
      and (select count(*) from public.hotel_pricing_schedules
        where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)=2
      and exists(select 1 from public.hotel_pricing_schedules where
        id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and review_status='reviewed' and not is_active
        and application_scope='room_occupancy'
        and minimum_billable_occupancy=2 and maximum_party_size=4)
      and exists(select 1 from public.hotel_pricing_schedules where
        id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
        and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and review_status='requires_review' and not is_active
        and application_scope='property_booking_party')
      and (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
        where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
          and is_active)=27
      and v_current_scoped_lineage is not null),false);
  end if;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  return coalesce((v_activation.contract_version=
      'hotels_v2_seven_arches_pricing_activation_evolution_v1'
    and v_activation.before_protected_fingerprint=public.hotel_v2_h3_2b_hash(
      v_activation.before_protected_fingerprints)
    and v_activation.after_protected_fingerprint=public.hotel_v2_h3_2b_hash(
      v_activation.after_protected_fingerprints)
    and v_activation.allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[]
    and (v_activation.after_protected_fingerprints-v_activation.allowed_fingerprint_keys)
      is not distinct from
      (v_activation.before_protected_fingerprints-v_activation.allowed_fingerprint_keys)
    and v_activation.after_protected_fingerprints->>'hotel_rate_plans'
      is distinct from v_activation.before_protected_fingerprints->>'hotel_rate_plans'
    and v_activation.after_protected_fingerprints->>'hotel_room_rates_protected'
      is distinct from v_activation.before_protected_fingerprints->>'hotel_room_rates_protected'
    and v_activation.after_protected_fingerprints->>'hotel_pricing_schedules'
      is distinct from v_activation.before_protected_fingerprints->>'hotel_pricing_schedules'
    and v_activation.after_protected_fingerprints->>'hotel_admin_pricing_action_receipts'
      is distinct from v_activation.before_protected_fingerprints->>'hotel_admin_pricing_action_receipts'
    and v_activation.after_protected_fingerprints->>'non_h3_2b_activity'
      is distinct from v_activation.before_protected_fingerprints->>'non_h3_2b_activity'
    and v_activation.before_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_activation.before_stage2_protected_fingerprints)
    and v_activation.after_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_activation.after_stage2_protected_fingerprints)
    and v_activation.stage2_allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[]
    and (v_activation.after_stage2_protected_fingerprints-
      v_activation.stage2_allowed_fingerprint_keys) is not distinct from
      (v_activation.before_stage2_protected_fingerprints-
      v_activation.stage2_allowed_fingerprint_keys)
    and v_activation.after_stage2_protected_fingerprints->>'hotel_rate_plans'
      is distinct from v_activation.before_stage2_protected_fingerprints->>'hotel_rate_plans'
    and v_activation.after_stage2_protected_fingerprints->>'hotel_room_rates_protected'
      is distinct from v_activation.before_stage2_protected_fingerprints->>'hotel_room_rates_protected'
    and v_activation.after_stage2_protected_fingerprints->>'hotel_pricing_schedules'
      is distinct from v_activation.before_stage2_protected_fingerprints->>'hotel_pricing_schedules'
    and v_activation.after_stage2_protected_fingerprints->>'hotel_admin_pricing_action_receipts'
      is distinct from v_activation.before_stage2_protected_fingerprints->>'hotel_admin_pricing_action_receipts'
    and v_activation.after_stage2_protected_fingerprints->>'non_external_calendar_activity'
      is distinct from v_activation.before_stage2_protected_fingerprints->>'non_external_calendar_activity'
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
      is true),false);
end
$function$;

insert into public.hotel_seven_arches_task2_stage2_compatibility_receipts(
  id,contract_version,
  canonical_task2_protected_fingerprints,canonical_task2_protected_fingerprint,
  canonical_stage2_protected_fingerprints,canonical_stage2_protected_fingerprint,
  scoped_lineage_source_hash,canonical_snapshot_source_hash,validator_source_hash)
select 1,'hotels_v2_seven_arches_task2_stage2_compatibility_v1',
  snapshot.value->'task2_protected_fingerprints',
  snapshot.value->>'task2_protected_fingerprint',
  snapshot.value->'stage2_protected_fingerprints',
  snapshot.value->>'stage2_protected_fingerprint',
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure))),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure))),
  public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure)))
from (select public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() value) snapshot
cross join seven_arches_pricing_activation_locked_baseline locked
where snapshot.value is not null
  and snapshot.value->'task2_protected_fingerprints' is not distinct from
    jsonb_set(locked.property_fingerprints,'{site_settings}',
      to_jsonb(locked.site_settings_lifecycle_fingerprint),false)
  and snapshot.value->'stage2_protected_fingerprints' is not distinct from
    jsonb_set(locked.stage2_compatible_fingerprints,'{site_settings}',
      to_jsonb(locked.site_settings_lifecycle_fingerprint),false)
  and snapshot.value->'site_settings_lifecycle' is not distinct from
    locked.site_settings_lifecycle;

create trigger hotel_seven_arches_pricing_activation_evolution_immutable
before update or delete on public.hotel_seven_arches_pricing_activation_evolution_receipts
for each row execute function public.hotel_v2_seven_arches_pricing_activation_immutable();

create function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
  v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
begin
  select * into v_context
  from public.hotel_seven_arches_pricing_activation_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.review_id=new.review_id
    and context_row.actor_id=new.actor_id
    and context_row.correlation_id=new.correlation_id;
  select * into v_review from public.hotel_seven_arches_pricing_activation_reviews review
  where review.id=new.review_id and review.actor_id=new.actor_id
    and review.hotel_id=new.hotel_id and review.consumed_at is not null
    and review.consumed_correlation_id=new.correlation_id
    and review.consumed_idempotency_key=new.idempotency_key;
  if v_context.review_id is null or v_review.id is null
     or new.id<>1
     or v_context.applied_entity_ids is distinct from array[
       '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
       'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
       '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
       '3320590d-632d-423f-80d0-fd021cba7293'::uuid]
     or new.hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     or new.before_protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(new.before_protected_fingerprints)
     or new.after_protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(new.after_protected_fingerprints)
     or new.before_stage2_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(new.before_stage2_protected_fingerprints)
     or new.after_stage2_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(new.after_stage2_protected_fingerprints)
     or new.upper_base_nightly_rate is distinct from
       (v_review.reviewed_plan#>>'{operation,payload,upper_base_nightly_rate}')::numeric
     or new.ground_base_nightly_rate is distinct from
       (v_review.reviewed_plan#>>'{operation,payload,ground_base_nightly_rate}')::numeric then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_evolution_insert_invalid';
  end if;
  return new;
end
$function$;

create trigger hotel_seven_arches_pricing_activation_evolution_insert_guard
before insert on public.hotel_seven_arches_pricing_activation_evolution_receipts
for each row execute function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard();

create function public.hotel_v2_seven_arches_pricing_activation_review_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
declare v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_review_immutable';
  end if;
  if tg_op='INSERT' then
    perform public.hotel_v2_h2a_require_admin();
    if auth.uid() is null or new.id is null or new.actor_id<>auth.uid()
       or new.reviewed_plan->>'review_id' is distinct from new.id::text
       or new.reviewed_plan->>'hotel_id' is distinct from new.hotel_id::text
       or new.reviewed_plan->>'snapshot_token' is distinct from new.snapshot_token
       or new.reviewed_plan->>'plan_fingerprint' is distinct from new.plan_fingerprint
       or (new.reviewed_plan->>'reviewed_at')::timestamptz is distinct from new.reviewed_at
       or (new.reviewed_plan->>'expires_at')::timestamptz is distinct from new.expires_at
       or encode(extensions.digest(convert_to(
          (new.reviewed_plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex')
          is distinct from new.plan_fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_review_invalid';
    end if;
    return new;
  end if;
  select * into v_context
  from public.hotel_seven_arches_pricing_activation_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid()
    and context_row.transaction_id=txid_current()
    and context_row.review_id=old.id
    and context_row.actor_id=old.actor_id
    and context_row.correlation_id=new.consumed_correlation_id;
  if not found
     or new.id<>old.id or new.hotel_id<>old.hotel_id or new.actor_id<>old.actor_id
     or new.snapshot_token<>old.snapshot_token or new.plan_fingerprint<>old.plan_fingerprint
     or new.reviewed_plan<>old.reviewed_plan or new.reviewed_at<>old.reviewed_at
     or new.expires_at<>old.expires_at or new.created_at<>old.created_at
     or old.consumed_at is not null or new.consumed_at is null
     or new.result is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_review_immutable';
  end if;
  return new;
end
$function$;

create trigger hotel_seven_arches_pricing_activation_review_guard
before insert or update or delete on public.hotel_seven_arches_pricing_activation_reviews
for each row execute function public.hotel_v2_seven_arches_pricing_activation_review_guard();

create function public.hotel_v2_seven_arches_pricing_activation_snapshot()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  v_plan public.hotel_rate_plans%rowtype;
  v_upper public.hotel_room_rates%rowtype;
  v_ground public.hotel_room_rates%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_party public.hotel_pricing_schedules%rowtype;
  v_promotion public.hotel_pricing_promotion_reviews%rowtype;
  v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_parity jsonb; v_payment jsonb; v_commission jsonb; v_flags jsonb;
  v_blockers jsonb:='[]'::jsonb; v_state text; v_token_source jsonb; v_token text;
begin
  select * into v_plan from public.hotel_rate_plans where id=c_plan and hotel_id=c_hotel;
  select * into v_upper from public.hotel_room_rates where id=c_upper_rate and hotel_id=c_hotel;
  select * into v_ground from public.hotel_room_rates where id=c_ground_rate and hotel_id=c_hotel;
  select * into v_schedule from public.hotel_pricing_schedules where id=c_schedule and hotel_id=c_hotel;
  select * into v_party from public.hotel_pricing_schedules where id=c_party and hotel_id=c_hotel;
  select * into v_promotion from public.hotel_pricing_promotion_reviews
    where hotel_id=c_hotel and contract_version='seven_kamares_legacy_to_h3_pricing_v1';
  select * into v_activation from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);
  select jsonb_build_object(
    'id',policy.id,'code',policy.code,'currency',btrim(policy.currency::text),
    'is_active',policy.is_active,'review_status',policy.review_status,'version',policy.version,
    'terms_fingerprint',public.hotel_v2_h3_1_payment_terms_fingerprint(policy.id))
  into v_payment from public.hotel_payment_policies policy
  where policy.hotel_id=c_hotel and policy.code='seven-kamares-request-confirmation';
  select jsonb_build_object(
    'id',policy.id,'code',policy.code,'commission_mode',policy.commission_mode,
    'amount',policy.amount,'currency',btrim(policy.currency::text),'version',policy.version,
    'updated_at',policy.updated_at,'read_only',true)
  into v_commission from public.hotel_commission_policies policy
  where policy.hotel_id=c_hotel and policy.is_active and policy.review_status='reviewed';
  select jsonb_build_object(
    'hotel_rooms_v2_enabled',hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled',hotel_external_sync_enabled,
    'hotel_instant_booking_enabled',hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled',hotel_stripe_connect_enabled)
  into v_flags from public.site_settings where id=1;

  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
      and hotel.architecture_version='legacy' and btrim(hotel.currency::text)='EUR'
      and hotel.minimum_stay_nights=2 and hotel.booking_mode='request_confirmation'
      and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then
    v_blockers:=v_blockers||'"legacy_property_drift"'::jsonb; end if;
  if v_flags is null or exists(select 1 from public.site_settings where id<>1 or
      hotel_rooms_v2_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    v_blockers:=v_blockers||'"feature_flags_incompatible"'::jsonb; end if;
  if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() is not true then
    v_blockers:=v_blockers||'"task2_stage2_compatibility_drift"'::jsonb; end if;
  if v_promotion.id is null or v_promotion.review_status<>'reviewed'
     or v_promotion.source_fingerprint<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_promotion.parity_case_count<>70 or v_promotion.parity_mismatch_count<>0
     or not v_promotion.acknowledged_pricing_occupancy_mapping then
    v_blockers:=v_blockers||'"h3_1p_receipt_drift"'::jsonb; end if;
  if (v_parity->>'total_case_count')::integer<>70
     or (v_parity->>'total_mismatch_count')::integer<>0
     or v_parity->>'fingerprint' is distinct from v_promotion.parity_fingerprint then
    v_blockers:=v_blockers||'"h3_1p_parity_drift"'::jsonb; end if;
  if public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() is not true then
    v_blockers:=v_blockers||'"allocation_5_10_drift"'::jsonb; end if;
  if v_plan.id is null or v_upper.id is null or v_ground.id is null
     or v_schedule.id is null or v_party.id is null
     or (select count(*) from public.hotel_rate_plans where hotel_id=c_hotel)<>1
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel)<>2
     or (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)<>2
     or v_plan.code<>'standard' or v_plan.review_status<>'reviewed'
     or v_plan.cancellation_policy<>'{"type":"non_refundable"}'::jsonb
     or v_plan.price_inclusions is distinct from array['cleaning','taxes']::text[]
     or v_upper.room_type_id<>'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
     or v_ground.room_type_id<>'825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
     or v_upper.rate_plan_id<>c_plan or v_ground.rate_plan_id<>c_plan
     or v_upper.pricing_schedule_id<>c_schedule or v_ground.pricing_schedule_id<>c_schedule
     or v_upper.review_status<>'reviewed' or v_ground.review_status<>'reviewed'
     or btrim(v_upper.currency::text)<>'EUR' or btrim(v_ground.currency::text)<>'EUR'
     or v_schedule.code<>'shared-apartment-occupancy-los'
     or v_schedule.application_scope<>'room_occupancy'
     or v_schedule.review_status<>'reviewed' or v_schedule.minimum_billable_occupancy<>2
     or v_schedule.maximum_party_size<>4 or btrim(v_schedule.currency::text)<>'EUR'
     or v_schedule.source<>'legacy_preview'
     or v_schedule.source_reference->>'pricing_fingerprint'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_party.code<>'legacy-property-party-preview'
     or v_party.application_scope<>'property_booking_party' or v_party.is_active
     or v_party.review_status<>'requires_review'
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id=c_schedule and tier.is_active)<>27
     or exists(
       (select (source.value->>'persons')::smallint,
          (source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from public.hotels hotel
        cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') source(value)
        where hotel.id=c_hotel and (source.value->>'persons')::integer between 2 and 4
        except
        select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_schedule and tier.is_active)
       union all
       (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_schedule and tier.is_active
        except
        select (source.value->>'persons')::smallint,
          (source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from public.hotels hotel
        cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') source(value)
        where hotel.id=c_hotel and (source.value->>'persons')::integer between 2 and 4)
     ) then
    v_blockers:=v_blockers||'"pricing_graph_drift"'::jsonb; end if;
  if v_payment is null
     or (select count(*) from public.hotel_payment_policies where hotel_id=c_hotel)<>1
     or v_payment->>'currency'<>'EUR' or v_payment->>'is_active'<>'true'
     or v_payment->>'review_status'<>'reviewed'
     or public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
       is not true then
    v_blockers:=v_blockers||'"payment_policy_drift"'::jsonb; end if;
  if v_commission is null
     or (select count(*) from public.hotel_commission_policies
       where hotel_id=c_hotel and is_active and review_status='reviewed')<>1
     or v_commission->>'commission_mode'<>'per_allocated_room_per_night'
     or (v_commission->>'amount')::numeric<>10 or v_commission->>'currency'<>'EUR' then
    v_blockers:=v_blockers||'"commission_policy_drift"'::jsonb; end if;

  if v_activation.id is null then
    if v_plan.is_active or v_upper.is_active or v_ground.is_active or v_schedule.is_active
       or v_upper.base_nightly_rate<>0 or v_ground.base_nightly_rate<>0 then
      v_blockers:=v_blockers||'"unreviewed_activation_state"'::jsonb;
    end if;
    v_state:='ready';
  else
    v_state:='active';
    if not v_plan.is_active or not v_upper.is_active or not v_ground.is_active
       or not v_schedule.is_active or v_party.is_active
       or v_upper.base_nightly_rate<>v_activation.upper_base_nightly_rate
       or v_ground.base_nightly_rate<>v_activation.ground_base_nightly_rate
       or public.hotel_v2_admin_c_i18n_is_valid(v_plan.name_i18n,true,240,false) is not true
       or public.hotel_v2_admin_c_i18n_is_valid(v_plan.description_i18n,true,5000,true) is not true
       or public.hotel_v2_admin_c_i18n_is_valid(v_schedule.name_i18n,true,240,false) is not true then
      v_blockers:=v_blockers||'"activated_graph_drift"'::jsonb;
    end if;
  end if;
  if jsonb_array_length(v_blockers)>0 then v_state:='blocked'; end if;
  v_token_source:=jsonb_build_object(
    'hotel_id',c_hotel,'state',v_state,'flags',v_flags,
    'promotion_review',to_jsonb(v_promotion)-array['result','reviewed_by'],
    'parity',v_parity,'allocation_exact',public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact(),
    'plan',to_jsonb(v_plan),'upper_rate',to_jsonb(v_upper),'ground_rate',to_jsonb(v_ground),
    'schedule',to_jsonb(v_schedule),'party_schedule',to_jsonb(v_party),
    'payment',v_payment,'commission',v_commission,'activation_receipt_id',v_activation.id);
  v_token:=encode(extensions.digest(convert_to(v_token_source::text,'UTF8'),'sha256'),'hex');
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_snapshot_v1',
    'hotel_id',c_hotel,'status',v_state,'snapshot_token',v_token,
    'public_change',false,'legacy_authoritative',true,'feature_flags',v_flags,
    'h3_1p',jsonb_build_object('promotion_review_id',v_promotion.id,
      'source_fingerprint',v_promotion.source_fingerprint,'parity',v_parity,
      'allocation_exact',public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()),
    'rate_plan',jsonb_build_object('id',v_plan.id,'version',v_plan.version,
      'name_i18n',v_plan.name_i18n,'description_i18n',v_plan.description_i18n,
      'cancellation_policy',v_plan.cancellation_policy,'is_active',v_plan.is_active,
      'review_status',v_plan.review_status),
    'room_rates',jsonb_build_array(
      jsonb_build_object('id',v_upper.id,'room_type_id',v_upper.room_type_id,
        'base_nightly_rate',v_upper.base_nightly_rate,'currency',btrim(v_upper.currency::text),
        'is_active',v_upper.is_active,'review_status',v_upper.review_status,'version',v_upper.version),
      jsonb_build_object('id',v_ground.id,'room_type_id',v_ground.room_type_id,
        'base_nightly_rate',v_ground.base_nightly_rate,'currency',btrim(v_ground.currency::text),
        'is_active',v_ground.is_active,'review_status',v_ground.review_status,'version',v_ground.version)),
    'shared_schedule',jsonb_build_object('id',v_schedule.id,'version',v_schedule.version,
      'name_i18n',v_schedule.name_i18n,'is_active',v_schedule.is_active,
      'review_status',v_schedule.review_status,'active_tier_count',27),
    'preview_schedule',jsonb_build_object('id',v_party.id,'version',v_party.version,
      'is_active',v_party.is_active,'review_status',v_party.review_status),
    'payment_policy',v_payment,'commission_policy',v_commission,
    'blocking_reasons',v_blockers);
end
$function$;

create function public.hotel_v2_seven_arches_pricing_activation_state_is_exact()
returns boolean language sql security definer stable set search_path=pg_catalog,public
as $function$
  select coalesce(snapshot->>'status'='active'
    and jsonb_array_length(snapshot->'blocking_reasons')=0,false)
  from (select public.hotel_v2_seven_arches_pricing_activation_snapshot() snapshot) state
$function$;

-- Forward declaration for the canonical H3.1P wrapper. It is replaced below
-- by the full nonrecursive receipt/activity/source verifier before COMMIT.
create function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
returns boolean language sql security definer stable set search_path=pg_catalog
as $function$ select false $function$;

-- Keep an exact private copy of the original inert H3.1P snapshot, then keep
-- the public function OID and all existing callers while recognizing only the
-- receipt-bound active evolution. The original promotion row is untouched.
do $seven_arches_pricing_activation_snapshot_clone$
declare v_definition text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure)
  into v_definition;
  if v_definition is null
     or (length(v_definition)-length(replace(v_definition,
       'hotel_v2_h3_1p_pricing_promotion_snapshot','')))
       /length('hotel_v2_h3_1p_pricing_promotion_snapshot')<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_snapshot_source_drift';
  end if;
  execute replace(v_definition,'hotel_v2_h3_1p_pricing_promotion_snapshot',
    'hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core');
end
$seven_arches_pricing_activation_snapshot_clone$;

create or replace function public.hotel_v2_h3_1p_pricing_promotion_snapshot(p_hotel_id uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,public
as $function$
declare
  v_baseline jsonb;
  v_compatibility jsonb;
  v_activation jsonb;
  v_promotion public.hotel_pricing_promotion_reviews%rowtype;
begin
  v_baseline:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(p_hotel_id);
  if p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     and public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
    select * into v_promotion
    from public.hotel_pricing_promotion_reviews review
    where review.hotel_id=p_hotel_id
      and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
      and review.review_status='reviewed';
    if v_promotion.id is null or v_promotion.parity_case_count<>70
       or v_promotion.parity_mismatch_count<>0
       or not v_promotion.acknowledged_pricing_occupancy_mapping then
      return v_baseline;
    end if;
    v_activation:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
    v_compatibility:=jsonb_set(v_baseline,'{source,pricing_fingerprint}',
      to_jsonb(v_promotion.source_fingerprint),false);
    v_compatibility:=jsonb_set(v_compatibility,'{source,tier_fingerprint}',
      to_jsonb(v_promotion.source_tier_fingerprint),false);
    v_compatibility:=jsonb_set(v_compatibility,'{target,target_fingerprint}',
      to_jsonb(v_promotion.target_fingerprint),false);
    v_compatibility:=jsonb_set(v_compatibility,
      '{pricing_occupancy_mapping_fingerprint}',
      to_jsonb(v_promotion.pricing_occupancy_mapping_fingerprint),false);
    v_compatibility:=jsonb_set(v_compatibility,'{parity,fingerprint}',
      to_jsonb(v_promotion.parity_fingerprint),false);
    v_compatibility:=jsonb_set(v_compatibility,'{parity,total_case_count}',
      to_jsonb(v_promotion.parity_case_count),false);
    v_compatibility:=jsonb_set(v_compatibility,'{parity,total_mismatch_count}',
      to_jsonb(v_promotion.parity_mismatch_count),false);
    return v_compatibility||jsonb_build_object(
      'supported',true,'blockers','[]'::jsonb,'public_change',false,
      'safety',(v_baseline->'safety')||jsonb_build_object(
        'room_schedule_inactive',false,'rate_plan_inactive',false,
        'room_rates_inactive',false,'reviewed_activation_exact',true),
      'activation',jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_pricing_activation_evolution_v1',
        'status','active','snapshot_token',v_activation->>'snapshot_token',
        'legacy_authoritative',true,
        'compatibility_review_id',v_promotion.id,
        'current_successor',jsonb_build_object(
          'source_pricing_fingerprint',v_baseline#>>'{source,pricing_fingerprint}',
          'source_tier_fingerprint',v_baseline#>>'{source,tier_fingerprint}',
          'target_fingerprint',v_baseline#>>'{target,target_fingerprint}',
          'pricing_occupancy_mapping_fingerprint',
            v_baseline->>'pricing_occupancy_mapping_fingerprint',
          'parity_fingerprint',v_baseline#>>'{parity,fingerprint}'),
        'upper_base_nightly_rate',(select upper_base_nightly_rate
          from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1),
        'ground_base_nightly_rate',(select ground_base_nightly_rate
          from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1)));
  end if;
  return v_baseline;
end
$function$;

-- Allow only this transaction-scoped reviewed activation through the H3.1P
-- row freeze. Every subsequent mutation remains frozen.
create or replace function public.hotel_v2_admin_c_h3_1p_freeze_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  v_old jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_old_hotel uuid; v_new_hotel uuid; v_operational_only boolean:=false;
  v_activation_context boolean:=false;
  v_context public.hotel_seven_arches_pricing_activation_transaction_context%rowtype;
  v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_payload jsonb; v_expected jsonb; v_expected_rate jsonb; v_entity_id uuid;
begin
  if tg_table_name in('hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
      'hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_room_rate_occupancy_tiers',
      'hotel_property_pricing_defaults') then
    v_old_hotel:=case when tg_op='INSERT' then null else nullif(v_old->>'hotel_id','')::uuid end;
    v_new_hotel:=case when tg_op='DELETE' then null else nullif(v_new->>'hotel_id','')::uuid end;
  elsif tg_table_name='hotel_pricing_schedule_occupancy_tiers' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel from public.hotel_pricing_schedules
      where id=(v_old->>'schedule_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel from public.hotel_pricing_schedules
      where id=(v_new->>'schedule_id')::uuid; end if;
  elsif tg_table_name='hotel_rate_rules' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel from public.hotel_room_rates
      where id=(v_old->>'room_rate_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel from public.hotel_room_rates
      where id=(v_new->>'room_rate_id')::uuid; end if;
  end if;
  if tg_table_name='hotel_calendar_overrides' and (v_old_hotel=c_hotel or v_new_hotel=c_hotel) then
    if tg_op='INSERT' then
      v_operational_only:=new.nightly_rate_mode is null and new.nightly_rate is null
        and new.minimum_stay_mode is null and new.minimum_stay is null
        and new.maximum_stay_mode is null and new.maximum_stay is null;
    elsif tg_op='DELETE' then
      v_operational_only:=old.nightly_rate_mode is null and old.nightly_rate is null
        and old.minimum_stay_mode is null and old.minimum_stay is null
        and old.maximum_stay_mode is null and old.maximum_stay is null;
    else
      v_operational_only:=new.id=old.id and new.hotel_id=old.hotel_id
        and new.room_rate_id=old.room_rate_id and new.stay_date=old.stay_date
        and (new.nightly_rate_mode,new.nightly_rate,new.minimum_stay_mode,new.minimum_stay,
          new.maximum_stay_mode,new.maximum_stay,new.pricing_source,new.pricing_reason,
          new.pricing_expires_at,new.pricing_actor_type,new.pricing_actor_id,
          new.pricing_updated_at,new.pricing_correlation_id)
        is not distinct from
        (old.nightly_rate_mode,old.nightly_rate,old.minimum_stay_mode,old.minimum_stay,
          old.maximum_stay_mode,old.maximum_stay,old.pricing_source,old.pricing_reason,
          old.pricing_expires_at,old.pricing_actor_type,old.pricing_actor_id,
          old.pricing_updated_at,old.pricing_correlation_id);
    end if;
  end if;
  select * into v_context
  from public.hotel_seven_arches_pricing_activation_transaction_context context_row
  where context_row.backend_pid=pg_backend_pid() and context_row.transaction_id=txid_current();
  if found then
    select * into v_review from public.hotel_seven_arches_pricing_activation_reviews review
      where review.id=v_context.review_id and review.actor_id=v_context.actor_id
        and review.consumed_at is null and review.expires_at>clock_timestamp();
    if found and v_review.reviewed_plan#>>'{operation,entity}'='pricing_activation'
       and v_review.reviewed_plan#>>'{operation,action}'='activate'
       and v_review.reviewed_plan#>>'{operation,id}'=c_hotel::text
       and v_context.correlation_id is not null and tg_op='UPDATE' then
      v_payload:=v_review.reviewed_plan#>'{operation,payload}';
      v_expected:=v_review.reviewed_plan#>'{operation,expected_original}';
      if tg_table_name='hotel_rate_plans' then
        if old.id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
           and new.id=old.id and new.hotel_id=old.hotel_id
           and not old.is_active
           and (v_expected#>>'{rate_plan,is_active}')::boolean=false
           and old.version=(v_expected#>>'{rate_plan,version}')::bigint
           and old.name_i18n is not distinct from v_expected#>'{rate_plan,name_i18n}'
           and old.description_i18n is not distinct from v_expected#>'{rate_plan,description_i18n}'
           and (to_jsonb(new)-array['name_i18n','description_i18n','is_active'])
             is not distinct from
             (to_jsonb(old)-array['name_i18n','description_i18n','is_active'])
           and new.name_i18n is not distinct from v_payload->'rate_plan_name_i18n'
           and new.description_i18n is not distinct from v_payload->'rate_plan_description_i18n'
           and new.is_active then
          v_activation_context:=true; v_entity_id:=old.id;
        end if;
      elsif tg_table_name='hotel_pricing_schedules' then
        if old.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
           and new.id=old.id and new.hotel_id=old.hotel_id
           and not old.is_active
           and (v_expected#>>'{shared_schedule,is_active}')::boolean=false
           and old.version=(v_expected#>>'{shared_schedule,version}')::bigint
           and old.name_i18n is not distinct from v_expected#>'{shared_schedule,name_i18n}'
           and (to_jsonb(new)-array['name_i18n','is_active'])
             is not distinct from (to_jsonb(old)-array['name_i18n','is_active'])
           and new.name_i18n is not distinct from v_payload->'schedule_name_i18n'
           and new.is_active then
          v_activation_context:=true; v_entity_id:=old.id;
        end if;
      elsif tg_table_name='hotel_room_rates' then
        select rate.value into v_expected_rate
        from jsonb_array_elements(v_expected->'room_rates') rate(value)
        where rate.value->>'id'=old.id::text;
        if old.id in('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
             '3320590d-632d-423f-80d0-fd021cba7293'::uuid)
           and new.id=old.id and new.hotel_id=old.hotel_id
           and not old.is_active and old.base_nightly_rate=0
           and (to_jsonb(new)-array['base_nightly_rate','is_active'])
             is not distinct from (to_jsonb(old)-array['base_nightly_rate','is_active'])
           and new.base_nightly_rate is not distinct from (case old.id
             when '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
               then (v_payload->>'upper_base_nightly_rate')::numeric
             else (v_payload->>'ground_base_nightly_rate')::numeric end)
           and new.is_active
           and v_expected_rate is not null
           and old.version=(v_expected_rate->>'version')::bigint
           and (v_expected_rate->>'is_active')::boolean=false
           and (v_expected_rate->>'base_nightly_rate')::numeric=0 then
          v_activation_context:=true; v_entity_id:=old.id;
        end if;
      end if;
    end if;
  end if;
  if v_activation_context then
    update public.hotel_seven_arches_pricing_activation_transaction_context context_row
    set applied_entity_ids=array_append(context_row.applied_entity_ids,v_entity_id)
    where context_row.backend_pid=pg_backend_pid()
      and context_row.transaction_id=txid_current()
      and context_row.review_id=v_review.id
      and context_row.actor_id=v_review.actor_id
      and context_row.correlation_id=v_context.correlation_id
      and not v_entity_id=any(context_row.applied_entity_ids);
    if not found then v_activation_context:=false; end if;
  end if;
  if (v_old_hotel=c_hotel or v_new_hotel=c_hotel) and not v_operational_only
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0)
     and not v_activation_context then
    raise exception using errcode='55000',message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

-- Preserve the original validator OID. Replace only its exact inert-H3.1P
-- paragraph; every general pricing invariant remains byte-identical.
do $seven_arches_pricing_activation_validator_patch$
declare v_source text; v_old text; v_new text; v_count integer;
begin
  select pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure)
    into v_source;
  v_old:=$needle$
  -- The accepted H3.1P graph stays shadow-inactive. These checks also protect
  -- it from trusted direct writes, independently of browser RPC allowlists.
  if p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (
    exists(select 1 from public.hotel_rate_plans where id=
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and is_active)
    or exists(select 1 from public.hotel_room_rates where id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid) and is_active)
    or exists(select 1 from public.hotel_pricing_schedules where id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid) and is_active)
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_h3_1p_graph_must_remain_inactive';
  end if;$needle$;
  v_new:=$replacement$
  -- The promoted H3.1P graph may be active only when the additive activation
  -- receipt proves the exact reviewed state. The preview-only property-party
  -- schedule remains inactive.
  if p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (
    exists(select 1 from public.hotel_rate_plans where id=
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and is_active)
    or exists(select 1 from public.hotel_room_rates where id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid) and is_active)
    or exists(select 1 from public.hotel_pricing_schedules where id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid) and is_active)
  ) and public.hotel_v2_seven_arches_pricing_activation_state_is_exact() is not true then
    raise exception using errcode='23514',
      message='hotels_v2_seven_arches_pricing_activation_state_invalid';
  end if;$replacement$;
  v_count:=(length(v_source)-length(replace(v_source,v_old,'')))/greatest(length(v_old),1);
  if v_count<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_validator_source_drift',
      detail=jsonb_build_object('expected_count',1,'actual_count',v_count)::text;
  end if;
  execute replace(v_source,v_old,v_new);
end
$seven_arches_pricing_activation_validator_patch$;

create function public.hotel_v2_admin_get_seven_arches_pricing_activation()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_seven_arches_pricing_activation_snapshot();
end
$function$;

create function public.hotel_v2_admin_preview_seven_arches_pricing_activation(p_draft jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_actor uuid:=auth.uid(); v_snapshot jsonb; v_payload jsonb; v_review_id uuid:=gen_random_uuid();
  v_reviewed_at timestamptz:=clock_timestamp(); v_expires timestamptz;
  v_plan jsonb; v_fingerprint text; v_before jsonb; v_after jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_draft is null or jsonb_typeof(p_draft)<>'object'
     or public.hotel_v2_h2a_keys_allowed(p_draft,array[
       'contract_version','hotel_id','snapshot_token','upper_base_nightly_rate',
       'ground_base_nightly_rate','rate_plan_name_i18n','rate_plan_description_i18n',
       'schedule_name_i18n','reason']) is not true
     or not (p_draft?&array['contract_version','hotel_id','snapshot_token',
       'upper_base_nightly_rate','ground_base_nightly_rate','rate_plan_name_i18n',
       'rate_plan_description_i18n','schedule_name_i18n','reason'])
     or p_draft->>'contract_version'<>'hotels_v2_seven_arches_pricing_activation_draft_v1'
     or p_draft->>'hotel_id'<>c_hotel::text
     or public.hotel_v2_admin_c_uuid_is_canonical(p_draft->>'hotel_id') is not true
     or jsonb_typeof(p_draft->'snapshot_token')<>'string'
     or p_draft->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_draft->'upper_base_nightly_rate')<>'number'
     or jsonb_typeof(p_draft->'ground_base_nightly_rate')<>'number'
     or (p_draft->>'upper_base_nightly_rate')::numeric<=0
     or (p_draft->>'ground_base_nightly_rate')::numeric<=0
     or (p_draft->>'upper_base_nightly_rate')::numeric>1000000
     or (p_draft->>'ground_base_nightly_rate')::numeric>1000000
     or round((p_draft->>'upper_base_nightly_rate')::numeric,2)
       <> (p_draft->>'upper_base_nightly_rate')::numeric
     or round((p_draft->>'ground_base_nightly_rate')::numeric,2)
       <> (p_draft->>'ground_base_nightly_rate')::numeric
     or public.hotel_v2_admin_c_i18n_is_valid(p_draft->'rate_plan_name_i18n',true,240,false) is not true
     or public.hotel_v2_admin_c_i18n_is_valid(p_draft->'rate_plan_description_i18n',true,5000,true) is not true
     or public.hotel_v2_admin_c_i18n_is_valid(p_draft->'schedule_name_i18n',true,240,false) is not true
     or jsonb_typeof(p_draft->'reason')<>'string'
     or p_draft->>'reason'<>btrim(p_draft->>'reason')
     or length(p_draft->>'reason') not between 3 and 500
     or p_draft->>'reason'~'[[:cntrl:]]' then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_pricing_activation_invalid_draft';
  end if;
  v_snapshot:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
  if v_snapshot->>'snapshot_token'<>p_draft->>'snapshot_token' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_stale_snapshot';
  end if;
  if v_snapshot->>'status'='active' then
    return jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_pricing_activation_preview_v1',
      'hotel_id',c_hotel,'changed',false,'blocking_reasons','[]'::jsonb,
      'impact',null,'reviewed_plan',null);
  end if;
  if v_snapshot->>'status'<>'ready' then
    return jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_pricing_activation_preview_v1',
      'hotel_id',c_hotel,'changed',false,
      'blocking_reasons',v_snapshot->'blocking_reasons','impact',null,'reviewed_plan',null);
  end if;
  v_payload:=jsonb_build_object(
    'upper_base_nightly_rate',(p_draft->>'upper_base_nightly_rate')::numeric,
    'ground_base_nightly_rate',(p_draft->>'ground_base_nightly_rate')::numeric,
    'rate_plan_name_i18n',p_draft->'rate_plan_name_i18n',
    'rate_plan_description_i18n',p_draft->'rate_plan_description_i18n',
    'schedule_name_i18n',p_draft->'schedule_name_i18n','reason',p_draft->>'reason');
  v_before:=jsonb_build_object(
    'rate_plan',v_snapshot->'rate_plan','room_rates',v_snapshot->'room_rates',
    'shared_schedule',v_snapshot->'shared_schedule','preview_schedule',v_snapshot->'preview_schedule');
  v_after:=jsonb_build_object(
    'rate_plan',jsonb_build_object('id','22e47a63-a630-4fb6-8f43-816f2d3fdc17',
      'name_i18n',v_payload->'rate_plan_name_i18n',
      'description_i18n',v_payload->'rate_plan_description_i18n','is_active',true),
    'room_rates',jsonb_build_array(
      jsonb_build_object('id','7e420964-9cbf-4f1b-abd3-09840af5240f',
        'base_nightly_rate',v_payload->'upper_base_nightly_rate','is_active',true),
      jsonb_build_object('id','3320590d-632d-423f-80d0-fd021cba7293',
        'base_nightly_rate',v_payload->'ground_base_nightly_rate','is_active',true)),
    'shared_schedule',jsonb_build_object('id','b0a3104f-7b31-5265-a59f-c2d166f11a23',
      'name_i18n',v_payload->'schedule_name_i18n','is_active',true),
    'preview_schedule',v_snapshot->'preview_schedule');
  v_expires:=v_reviewed_at+interval '30 minutes';
  v_plan:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_plan_v1',
    'review_id',v_review_id,'hotel_id',c_hotel,'snapshot_token',v_snapshot->>'snapshot_token',
    'reviewed_at',to_char(v_reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expires_at',to_char(v_expires at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'operation',jsonb_build_object('entity','pricing_activation','action','activate','id',c_hotel,
      'expected_original',v_before,'payload',v_payload));
  v_fingerprint:=encode(extensions.digest(convert_to(v_plan::text,'UTF8'),'sha256'),'hex');
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into public.hotel_seven_arches_pricing_activation_reviews(
    id,contract_version,hotel_id,actor_id,snapshot_token,plan_fingerprint,
    reviewed_plan,reviewed_at,expires_at)
  values(v_review_id,'hotels_v2_seven_arches_pricing_activation_plan_v1',c_hotel,
    v_actor,v_snapshot->>'snapshot_token',v_fingerprint,v_plan,v_reviewed_at,v_expires);
  return jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_preview_v1',
    'hotel_id',c_hotel,'changed',true,'blocking_reasons','[]'::jsonb,
    'impact',jsonb_build_object('entity','pricing_activation','action','activate','id',c_hotel,
      'changed',true,'fields',jsonb_build_array('base_nightly_rates','is_active',
        'rate_plan_description_i18n','rate_plan_name_i18n','schedule_name_i18n'),
      'before',v_before,'after',v_after,
      'affected_room_type_ids',jsonb_build_array(
        '825c01b7-9f82-492a-9c81-9b1d5cd7acd3','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),
      'affected_room_rate_ids',jsonb_build_array(
        '3320590d-632d-423f-80d0-fd021cba7293','7e420964-9cbf-4f1b-abd3-09840af5240f'),
      'from',null,'to',null),
    'reviewed_plan',v_plan);
end
$function$;

create function public.hotel_v2_admin_apply_seven_arches_pricing_activation(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_actor uuid:=auth.uid(); v_review_id uuid; v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_existing public.hotel_admin_pricing_action_receipts%rowtype;
  v_snapshot jsonb; v_payload jsonb; v_request_hash text; v_now timestamptz:=clock_timestamp();
  v_before_protected jsonb; v_after_protected jsonb; v_result jsonb;
  v_before_stage2 jsonb; v_after_stage2 jsonb;
  v_plan_before jsonb; v_plan_after jsonb; v_schedule_before jsonb; v_schedule_after jsonb;
  v_upper_before jsonb; v_upper_after jsonb; v_ground_before jsonb; v_ground_after jsonb;
  v_activity_ids uuid[]; v_admin_receipt_id uuid; v_validator_before text; v_validator_after text;
  v_relation regclass;
begin
  if current_setting('transaction_isolation') is distinct from
       'read committed' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_isolation_failed';
  end if;
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or p_correlation_id is null
     or public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text) is not true
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 120
     or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]*$'
     or public.hotel_v2_h2a_keys_allowed(p_reviewed_plan,array[
       'contract_version','review_id','hotel_id','snapshot_token','reviewed_at',
       'expires_at','operation','plan_fingerprint']) is not true
     or not (p_reviewed_plan?&array['contract_version','review_id','hotel_id','snapshot_token',
       'reviewed_at','expires_at','operation','plan_fingerprint'])
     or p_reviewed_plan->>'contract_version'<>'hotels_v2_seven_arches_pricing_activation_plan_v1'
     or p_reviewed_plan->>'hotel_id'<>c_hotel::text
     or public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan) is not true
     or public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_reviewed_plan) is not true
     or p_reviewed_plan->>'plan_fingerprint'!~'^[0-9a-f]{64}$'
     or encode(extensions.digest(convert_to(
       (p_reviewed_plan-'plan_fingerprint')::text,'UTF8'),'sha256'),'hex')
       <>p_reviewed_plan->>'plan_fingerprint' then
    raise exception using errcode='22023',
      message='hotels_v2_seven_arches_pricing_activation_invalid_plan';
  end if;

  -- The one-time Apply captures whole-database protected maps.  Hold the same
  -- complete relation universe through AFTER validation and transaction
  -- commit so no concurrent writer can be absorbed into its receipt.
  foreach v_relation in array array[
    'public.hotels'::regclass,
    'public.hotel_units'::regclass,
    'public.hotel_rate_plans'::regclass,
    'public.hotel_pricing_schedules'::regclass,
    'public.hotel_property_pricing_defaults'::regclass,
    'public.hotel_rate_rules'::regclass,
    'public.hotel_room_allocation_rules'::regclass,
    'public.hotel_room_allocation_rule_items'::regclass,
    'public.hotel_unit_calendar_blocks'::regclass,
    'public.hotel_inventory_holds'::regclass,
    'public.hotel_booking_room_allocations'::regclass,
    'public.hotel_inventory_commitments'::regclass,
    'public.hotel_calendar_source_configs'::regclass,
    'public.hotel_payment_policies'::regclass,
    'public.hotel_payment_policy_terms'::regclass,
    'public.hotel_commission_policies'::regclass,
    'public.hotel_daily_rates'::regclass,
    'public.hotel_pricing_promotion_reviews'::regclass,
    'public.hotel_admin_pricing_action_receipts'::regclass,
    'public.hotel_admin_availability_action_receipts'::regclass,
    'public.hotel_admin_availability_plan_reviews'::regclass,
    'public.hotel_admin_availability_foundation_receipts'::regclass,
    'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
    'public.hotel_bookings'::regclass,
    'public.partner_service_fulfillments'::regclass,
    'public.partner_service_fulfillment_form_snapshots'::regclass,
    'public.service_deposit_requests'::regclass,
    'public.service_deposit_rules'::regclass,
    'public.service_deposit_overrides'::regclass,
    'public.service_coupons'::regclass,
    'public.service_coupon_redemptions'::regclass,
    'public.referrals'::regclass,
    'public.affiliate_commission_events'::regclass,
    'public.affiliate_payouts'::regclass,
    'public.affiliate_adjustments'::regclass,
    'public.affiliate_program_settings'::regclass,
    'public.affiliate_referrer_overrides'::regclass,
    'public.affiliate_cashout_requests'::regclass,
    'public.profile_referral_code_aliases'::regclass,
    'public.partners'::regclass,
    'public.partner_users'::regclass,
    'public.partner_resources'::regclass,
    'public.partner_user_resources'::regclass,
    'public.hotel_partner_hotel_permissions'::regclass,
    'public.site_settings'::regclass,
    'public.hotel_room_types'::regclass,
    'public.hotel_room_rates'::regclass,
    'public.hotel_pricing_schedule_occupancy_tiers'::regclass,
    'public.hotel_room_rate_occupancy_tiers'::regclass,
    'public.hotel_calendar_overrides'::regclass,
    'public.hotel_daily_inventory'::regclass,
    'public.hotel_partner_action_receipts'::regclass,
    'public.hotel_partner_event_outbox'::regclass,
    'public.hotel_activity_log'::regclass,
    'public.hotel_property_operational_profiles'::regclass,
    'public.hotel_partner_workspace_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_foundation_receipts'::regclass,
    'public.hotel_partner_property_proposal_admin_reviews'::regclass,
    'public.hotel_partner_property_drafts'::regclass,
    'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
    'public.hotel_seven_arches_pricing_activation_reviews'::regclass,
    'public.hotel_seven_arches_pricing_activation_transaction_context'::regclass,
    'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
    'hotels_v2_private.hotel_external_calendar_plan_reviews'::regclass,
    'hotels_v2_private.hotel_external_calendar_correlations'::regclass,
    'hotels_v2_private.hotel_external_calendar_admin_receipts'::regclass
  ] loop
    execute format('lock table %s in share row exclusive mode',v_relation);
    if not exists(select 1 from pg_locks lock_row
      where lock_row.pid=pg_backend_pid()
        and lock_row.locktype='relation'
        and lock_row.relation=v_relation::oid
        and lock_row.granted
        and lock_row.mode in('ShareRowExclusiveLock','AccessExclusiveLock')) then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_apply_lock_failed',
        detail=v_relation::text;
    end if;
  end loop;

  begin v_review_id:=(p_reviewed_plan->>'review_id')::uuid;
  exception when others then raise exception using errcode='22023',
    message='hotels_v2_seven_arches_pricing_activation_invalid_plan'; end;
  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'reviewed_plan',p_reviewed_plan,'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-activation-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-7a-activation-correlation:'||p_correlation_id::text,0));
  select * into v_existing from public.hotel_admin_pricing_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_existing.hotel_id<>c_hotel or v_existing.correlation_id<>p_correlation_id
       or v_existing.request_hash<>v_request_hash then
      raise exception using errcode='PT409',
        message='hotels_v2_seven_arches_pricing_activation_idempotency_conflict';
    end if;
    return jsonb_set(v_existing.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_pricing_action_receipts where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_correlation_conflict';
  end if;
  select * into v_review from public.hotel_seven_arches_pricing_activation_reviews
    where id=v_review_id for update;
  if not found or v_review.actor_id<>v_actor or v_review.hotel_id<>c_hotel
     or v_review.reviewed_plan<>p_reviewed_plan
     or v_review.plan_fingerprint<>p_reviewed_plan->>'plan_fingerprint' then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_review_mismatch';
  end if;
  if v_review.consumed_at is not null then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_review_consumed';
  end if;
  if v_review.expires_at<=v_now then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_review_expired';
  end if;
  perform 1 from public.site_settings where id=1 for share;
  perform 1 from public.hotels where id=c_hotel for update;
  perform 1 from public.hotel_rate_plans where hotel_id=c_hotel order by id for update;
  perform 1 from public.hotel_room_rates where hotel_id=c_hotel order by id for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=c_hotel order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id in('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid) order by tier.id for share;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_room_allocation_rule_items where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_payment_policies where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_payment_policy_terms where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_commission_policies where hotel_id=c_hotel order by id for share;
  v_snapshot:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
  if v_snapshot->>'status'<>'ready'
     or v_snapshot->>'snapshot_token'<>v_review.snapshot_token then
    raise exception using errcode='PT409',
      message='hotels_v2_seven_arches_pricing_activation_stale_snapshot';
  end if;
  v_payload:=p_reviewed_plan#>'{operation,payload}';
  v_before_protected:=
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  v_before_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  -- This is the fresh full baseline captured after every protected relation
  -- lock was granted.  It is intentionally not compared with the historical
  -- 114370 or installation-time maps; the full AFTER comparison below keeps
  -- every unrelated key byte-exact for this transaction.
  if v_before_protected is null or v_before_stage2 is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_foundation_drift';
  end if;
  if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_stage2_foundation_drift';
  end if;
  insert into public.hotel_seven_arches_pricing_activation_transaction_context(
    backend_pid,transaction_id,review_id,actor_id,correlation_id,
    before_protected_fingerprints,before_stage2_protected_fingerprints)
  values(pg_backend_pid(),txid_current(),v_review.id,v_actor,p_correlation_id,
    v_before_protected,v_before_stage2);

  select to_jsonb(plan) into v_plan_before from public.hotel_rate_plans plan
    where plan.id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  update public.hotel_rate_plans set
    name_i18n=v_payload->'rate_plan_name_i18n',
    description_i18n=v_payload->'rate_plan_description_i18n',is_active=true
  where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  select to_jsonb(plan) into v_plan_after from public.hotel_rate_plans plan
    where plan.id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  select to_jsonb(schedule) into v_schedule_before from public.hotel_pricing_schedules schedule
    where schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  update public.hotel_pricing_schedules set
    name_i18n=v_payload->'schedule_name_i18n',is_active=true
  where id='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  select to_jsonb(schedule) into v_schedule_after from public.hotel_pricing_schedules schedule
    where schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  select to_jsonb(rate) into v_upper_before from public.hotel_room_rates rate
    where rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f';
  update public.hotel_room_rates set
    base_nightly_rate=(v_payload->>'upper_base_nightly_rate')::numeric,is_active=true
  where id='7e420964-9cbf-4f1b-abd3-09840af5240f';
  select to_jsonb(rate) into v_upper_after from public.hotel_room_rates rate
    where rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f';
  select to_jsonb(rate) into v_ground_before from public.hotel_room_rates rate
    where rate.id='3320590d-632d-423f-80d0-fd021cba7293';
  update public.hotel_room_rates set
    base_nightly_rate=(v_payload->>'ground_base_nightly_rate')::numeric,is_active=true
  where id='3320590d-632d-423f-80d0-fd021cba7293';
  select to_jsonb(rate) into v_ground_after from public.hotel_room_rates rate
    where rate.id='3320590d-632d-423f-80d0-fd021cba7293';

  with inserted as (
    insert into public.hotel_activity_log(
      hotel_id,entity_type,entity_id,action,before_state,after_state,
      actor_type,actor_id,source,correlation_id)
    values
      (c_hotel,'rate_plan','22e47a63-a630-4fb6-8f43-816f2d3fdc17','update',
        v_plan_before,v_plan_after,'admin',v_actor,
        'hotels_v2_seven_arches_pricing_activation',p_correlation_id),
      (c_hotel,'pricing_schedule','b0a3104f-7b31-5265-a59f-c2d166f11a23','update',
        v_schedule_before,v_schedule_after,'admin',v_actor,
        'hotels_v2_seven_arches_pricing_activation',p_correlation_id),
      (c_hotel,'room_rate','7e420964-9cbf-4f1b-abd3-09840af5240f','update',
        v_upper_before,v_upper_after,'admin',v_actor,
        'hotels_v2_seven_arches_pricing_activation',p_correlation_id),
      (c_hotel,'room_rate','3320590d-632d-423f-80d0-fd021cba7293','update',
        v_ground_before,v_ground_after,'admin',v_actor,
        'hotels_v2_seven_arches_pricing_activation',p_correlation_id)
    returning id,entity_type,entity_id)
  select array_agg(id order by entity_type,entity_id) into v_activity_ids from inserted;

  v_result:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_pricing_activation_apply_result_v1',
    'hotel_id',c_hotel,'changed',true,'replayed',false,'review_id',v_review.id,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'activity_ids',to_jsonb(v_activity_ids),
    'public_change',false,'legacy_authoritative',true);
  insert into public.hotel_admin_pricing_action_receipts(
    hotel_id,actor_id,idempotency_key,correlation_id,request_hash,result)
  values(c_hotel,v_actor,p_idempotency_key,p_correlation_id,v_request_hash,v_result)
  returning id into v_admin_receipt_id;
  update public.hotel_seven_arches_pricing_activation_reviews set
    consumed_at=v_now,consumed_correlation_id=p_correlation_id,
    consumed_idempotency_key=p_idempotency_key,result=v_result
  where id=v_review.id;

  v_validator_before:=encode(extensions.digest(convert_to(
    pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure),
    'UTF8'),'sha256'),'hex');
  -- The migration already patched the validator before Review. Both columns
  -- intentionally pin the installed definition at the activation boundary.
  v_validator_after:=v_validator_before;
  v_after_protected:=
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  v_after_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  if (v_after_protected-array['hotel_rate_plans','hotel_room_rates_protected',
        'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
        'non_h3_2b_activity']::text[])
       is distinct from
       (v_before_protected-array['hotel_rate_plans','hotel_room_rates_protected',
        'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
        'non_h3_2b_activity']::text[])
     or v_after_protected->>'hotel_rate_plans'
          is not distinct from v_before_protected->>'hotel_rate_plans'
     or v_after_protected->>'hotel_room_rates_protected'
          is not distinct from v_before_protected->>'hotel_room_rates_protected'
     or v_after_protected->>'hotel_pricing_schedules'
          is not distinct from v_before_protected->>'hotel_pricing_schedules'
     or v_after_protected->>'hotel_admin_pricing_action_receipts'
          is not distinct from v_before_protected->>'hotel_admin_pricing_action_receipts'
     or v_after_protected->>'non_h3_2b_activity'
          is not distinct from v_before_protected->>'non_h3_2b_activity' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch';
  end if;
  if (v_after_stage2-array['hotel_rate_plans','hotel_room_rates_protected',
        'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
        'non_external_calendar_activity']::text[])
       is distinct from
       (v_before_stage2-array['hotel_rate_plans','hotel_room_rates_protected',
        'hotel_pricing_schedules','hotel_admin_pricing_action_receipts',
        'non_external_calendar_activity']::text[])
     or v_after_stage2->>'hotel_rate_plans'
          is not distinct from v_before_stage2->>'hotel_rate_plans'
     or v_after_stage2->>'hotel_room_rates_protected'
          is not distinct from v_before_stage2->>'hotel_room_rates_protected'
     or v_after_stage2->>'hotel_pricing_schedules'
          is not distinct from v_before_stage2->>'hotel_pricing_schedules'
     or v_after_stage2->>'hotel_admin_pricing_action_receipts'
          is not distinct from v_before_stage2->>'hotel_admin_pricing_action_receipts'
     or v_after_stage2->>'non_external_calendar_activity'
          is not distinct from v_before_stage2->>'non_external_calendar_activity' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_stage2_delta_scope_mismatch';
  end if;
  insert into public.hotel_seven_arches_pricing_activation_evolution_receipts(
    id,contract_version,review_id,admin_receipt_id,hotel_id,actor_id,correlation_id,
    idempotency_key,before_protected_fingerprints,before_protected_fingerprint,
    after_protected_fingerprints,after_protected_fingerprint,allowed_fingerprint_keys,
    before_stage2_protected_fingerprints,before_stage2_protected_fingerprint,
    after_stage2_protected_fingerprints,after_stage2_protected_fingerprint,
    stage2_allowed_fingerprint_keys,
    upper_base_nightly_rate,ground_base_nightly_rate,pricing_authority,
    activity_ids,parity_fingerprint,
    validator_source_before_hash,validator_source_after_hash,
    inert_snapshot_source_hash,canonical_snapshot_source_hash,
    activation_snapshot_source_hash,state_validator_source_hash,
    receipt_validator_source_hash,transaction_preservation_source_hash,
    apply_source_hash,freeze_trigger_source_hash)
  values(1,'hotels_v2_seven_arches_pricing_activation_evolution_v1',v_review.id,
    v_admin_receipt_id,c_hotel,v_actor,p_correlation_id,p_idempotency_key,
    v_before_protected,public.hotel_v2_h3_2b_hash(v_before_protected),
    v_after_protected,public.hotel_v2_h3_2b_hash(v_after_protected),array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[],
    v_before_stage2,public.hotel_v2_external_calendar_worker_hash(v_before_stage2),
    v_after_stage2,public.hotel_v2_external_calendar_worker_hash(v_after_stage2),array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[],
    (v_payload->>'upper_base_nightly_rate')::numeric,
    (v_payload->>'ground_base_nightly_rate')::numeric,'shared_schedule',v_activity_ids,
    public.hotel_v2_h3_1p_parity_snapshot(c_hotel)->>'fingerprint',
    v_validator_before,v_validator_after,
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
      'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure))),
    public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
      'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'::regprocedure))),
    encode(extensions.digest(convert_to(pg_get_functiondef(
      'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure),
      'UTF8'),'sha256'),'hex'));
  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard immediate;
  if public.hotel_v2_seven_arches_pricing_activation_state_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_postcondition_failed';
  end if;
  delete from public.hotel_seven_arches_pricing_activation_transaction_context
    where backend_pid=pg_backend_pid() and transaction_id=txid_current() and review_id=v_review.id
      and applied_entity_ids=array[
        '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid,
        'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
        '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
        '3320590d-632d-423f-80d0-fd021cba7293'::uuid];
  if not found then raise exception using errcode='55000',
    message='hotels_v2_seven_arches_pricing_activation_context_cleanup_failed'; end if;
  if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_full_postcondition_failed';
  end if;
  return v_result;
end
$function$;

create or replace function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_receipt public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_scoped_lineage jsonb;
  v_activity_count integer; v_payload jsonb;
  v_task2_receipt_topology_exact boolean:=false;
begin
  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*)
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1 then
    return false; end if;
  select * into v_receipt from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  select * into v_review from public.hotel_seven_arches_pricing_activation_reviews where id=v_receipt.review_id;
  select * into strict v_task2_stage2
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  v_payload:=v_review.reviewed_plan#>'{operation,payload}';
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_task2_receipt_topology_exact:=coalesce(
    v_task2_stage2.contract_version=
      'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
    and v_task2_stage2.created_at is not null
    and isfinite(v_task2_stage2.created_at)
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute where attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum>0 and not attribute.attisdropped)=10
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
      (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
      (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
      (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
      (7::smallint,'scoped_lineage_source_hash','text',true,null::text),
      (8::smallint,'canonical_snapshot_source_hash','text',true,null::text),
      (9::smallint,'validator_source_hash','text',true,null::text),
      (10::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
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
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=10
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
      (7::smallint,'scoped_lineage_source_hash'),
      (8::smallint,'canonical_snapshot_source_hash'),
      (9::smallint,'validator_source_hash')
    ) expected(attnum,column_name) where (select count(*)
      from pg_constraint constraint_row where constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[expected.attnum]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='('||expected.column_name||
            '~''^[0-9a-f]{64}$''::text)')<>1)
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and trigger_row.tgname=
        'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
      and trigger_row.tgfoid=
        to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()')
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
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
  select count(*) into v_activity_count from public.hotel_activity_log activity
    where activity.id=any(v_receipt.activity_ids)
      and activity.hotel_id=v_receipt.hotel_id and activity.actor_id=v_receipt.actor_id
      and activity.actor_type='admin' and activity.action='update'
      and activity.source='hotels_v2_seven_arches_pricing_activation'
      and activity.correlation_id=v_receipt.correlation_id
      and (activity.entity_type,activity.entity_id) in(
        ('rate_plan','22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid),
        ('pricing_schedule','b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
        ('room_rate','7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
        ('room_rate','3320590d-632d-423f-80d0-fd021cba7293'::uuid));
  return coalesce((v_scoped_lineage is not null
    and v_scoped_lineage->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and public.hotel_v2_h2a_keys_allowed(v_scoped_lineage,array[
      'contract_version','hotel_id','partner_id','assignment_id','owner_user_ids',
      'owner_membership_fingerprint','permission_preset_fingerprint',
      'property_business_fingerprint','room_identity_fingerprint',
      'pricing_identity_fingerprint','allocation_contract_exact','parity_case_count',
      'parity_mismatch_count','parity_fingerprint','commission_policy_fingerprint',
      'payment_policy_fingerprint','site_settings_lifecycle',
      'site_settings_lifecycle_fingerprint','owner_capability_receipt_fingerprint',
      'property_foundation_receipt_fingerprint',
      'lower_function_security_fingerprint']) is true
    and v_scoped_lineage?&array[
      'contract_version','hotel_id','partner_id','assignment_id','owner_user_ids',
      'owner_membership_fingerprint','permission_preset_fingerprint',
      'property_business_fingerprint','room_identity_fingerprint',
      'pricing_identity_fingerprint','allocation_contract_exact','parity_case_count',
      'parity_mismatch_count','parity_fingerprint','commission_policy_fingerprint',
      'payment_policy_fingerprint','site_settings_lifecycle',
      'site_settings_lifecycle_fingerprint','owner_capability_receipt_fingerprint',
      'property_foundation_receipt_fingerprint',
      'lower_function_security_fingerprint']
    and (v_scoped_lineage->>'parity_case_count')::integer=70
    and (v_scoped_lineage->>'parity_mismatch_count')::integer=0
    and v_task2_receipt_topology_exact
    and v_receipt.contract_version='hotels_v2_seven_arches_pricing_activation_evolution_v1'
    and v_receipt.before_protected_fingerprint=public.hotel_v2_h3_2b_hash(v_receipt.before_protected_fingerprints)
    and v_receipt.after_protected_fingerprint=public.hotel_v2_h3_2b_hash(v_receipt.after_protected_fingerprints)
    and (v_receipt.after_protected_fingerprints-v_receipt.allowed_fingerprint_keys)
      is not distinct from
      (v_receipt.before_protected_fingerprints-v_receipt.allowed_fingerprint_keys)
    and v_receipt.before_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_receipt.before_stage2_protected_fingerprints)
    and v_receipt.after_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_receipt.after_stage2_protected_fingerprints)
    and (v_receipt.after_stage2_protected_fingerprints-v_receipt.stage2_allowed_fingerprint_keys)
      is not distinct from
      (v_receipt.before_stage2_protected_fingerprints-v_receipt.stage2_allowed_fingerprint_keys)
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
      is true
    and public.hotel_v2_partner_workspace_function_lineage_is_exact()
    and exists(select 1
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts task2
      where task2.id=1 and task2.canonical_snapshot_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure))))
    and v_review.id=v_receipt.review_id and v_review.consumed_at is not null
    and v_review.consumed_correlation_id=v_receipt.correlation_id
    and v_review.consumed_idempotency_key=v_receipt.idempotency_key
    and v_review.actor_id=v_receipt.actor_id and v_review.result is not null
    and v_review.result->>'contract_version'=
      'hotels_v2_seven_arches_pricing_activation_apply_result_v1'
    and v_review.result->>'review_id'=v_review.id::text
    and v_review.result->>'correlation_id'=v_receipt.correlation_id::text
    and v_review.result->>'idempotency_key'=v_receipt.idempotency_key
    and v_review.result->'activity_ids'=to_jsonb(v_receipt.activity_ids)
    and v_review.result->>'public_change'='false'
    and v_review.result->>'legacy_authoritative'='true'
    and v_receipt.upper_base_nightly_rate is not distinct from
      (v_payload->>'upper_base_nightly_rate')::numeric
    and v_receipt.ground_base_nightly_rate is not distinct from
      (v_payload->>'ground_base_nightly_rate')::numeric
    and v_receipt.pricing_authority='shared_schedule'
    and exists(select 1 from public.hotel_admin_pricing_action_receipts receipt
      where receipt.id=v_receipt.admin_receipt_id and receipt.hotel_id=v_receipt.hotel_id
        and receipt.actor_id=v_receipt.actor_id and receipt.idempotency_key=v_receipt.idempotency_key
        and receipt.correlation_id=v_receipt.correlation_id and receipt.result=v_review.result
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'reviewed_plan',v_review.reviewed_plan,
          'correlation_id',v_receipt.correlation_id)::text,'UTF8'),'sha256'),'hex'))
    and v_activity_count=4
    and cardinality(v_receipt.activity_ids)=4
    and (select count(*) from public.hotel_activity_log activity
      where activity.source='hotels_v2_seven_arches_pricing_activation')=4
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='rate_plan'
        and activity.entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
        and activity.before_state->>'is_active'='false'
        and activity.after_state->>'is_active'='true'
        and activity.after_state->'name_i18n' is not distinct from v_payload->'rate_plan_name_i18n'
        and activity.after_state->'description_i18n' is not distinct from v_payload->'rate_plan_description_i18n'
        and (activity.after_state-array['name_i18n','description_i18n','is_active','version','updated_at'])
          is not distinct from
          (activity.before_state-array['name_i18n','description_i18n','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=(activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='pricing_schedule'
        and activity.entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and activity.before_state->>'is_active'='false'
        and activity.after_state->>'is_active'='true'
        and activity.after_state->'name_i18n' is not distinct from v_payload->'schedule_name_i18n'
        and (activity.after_state-array['name_i18n','is_active','version','updated_at'])
          is not distinct from
          (activity.before_state-array['name_i18n','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=(activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='room_rate'
        and activity.entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
        and activity.before_state->>'is_active'='false'
        and (activity.before_state->>'base_nightly_rate')::numeric=0
        and activity.after_state->>'is_active'='true'
        and (activity.after_state->>'base_nightly_rate')::numeric=
          (v_payload->>'upper_base_nightly_rate')::numeric
        and (activity.after_state-array['base_nightly_rate','is_active','version','updated_at'])
          is not distinct from
          (activity.before_state-array['base_nightly_rate','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=(activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='room_rate'
        and activity.entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
        and activity.before_state->>'is_active'='false'
        and (activity.before_state->>'base_nightly_rate')::numeric=0
        and activity.after_state->>'is_active'='true'
        and (activity.after_state->>'base_nightly_rate')::numeric=
          (v_payload->>'ground_base_nightly_rate')::numeric
        and (activity.after_state-array['base_nightly_rate','is_active','version','updated_at'])
          is not distinct from
          (activity.before_state-array['base_nightly_rate','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=(activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and v_receipt.parity_fingerprint=
      public.hotel_v2_h3_1p_parity_snapshot(v_receipt.hotel_id)->>'fingerprint'
    and v_receipt.validator_source_before_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.validator_source_after_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.inert_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.canonical_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.activation_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.state_validator_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.receipt_validator_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.freeze_trigger_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and not exists(select 1
      from public.hotel_seven_arches_pricing_activation_transaction_context)
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
    and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);
end
$function$;

create function public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
begin
  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0 then
    return coalesce(
      public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact(),false);
  end if;
  return coalesce(
    public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact(),false);
end
$function$;

alter table public.hotel_seven_arches_pricing_activation_reviews owner to postgres;
alter table public.hotel_seven_arches_pricing_activation_transaction_context owner to postgres;
alter table public.hotel_seven_arches_pricing_activation_evolution_receipts owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_immutable() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_review_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_context_guard() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_snapshot() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_state_is_exact() owner to postgres;
alter function public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid) owner to postgres;
alter function public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid) owner to postgres;
alter function public.hotel_v2_admin_c_h3_1p_freeze_trigger() owner to postgres;
alter function public.hotel_v2_admin_c_validate_pricing_graph(uuid) owner to postgres;
alter function public.hotel_v2_admin_get_seven_arches_pricing_activation() owner to postgres;
alter function public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb) owner to postgres;
alter function public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text) owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_activation_current_is_safe() owner to postgres;
alter function public.hotel_v2_seven_arches_pricing_scoped_lineage() owner to postgres;
alter function public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
  owner to postgres;
alter function public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
  owner to postgres;
alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() owner to postgres;
alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() owner to postgres;
alter function public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
  owner to postgres;

revoke all on function public.hotel_v2_seven_arches_pricing_activation_immutable()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_review_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_context_guard()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_snapshot()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_state_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_h3_1p_freeze_trigger()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_validate_pricing_graph(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_scoped_lineage()
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
  from public,anon,authenticated,service_role;
revoke all on function
  public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_seven_arches_pricing_activation()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_seven_arches_pricing_activation() to authenticated;
grant execute on function public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb) to authenticated;
grant execute on function public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text) to authenticated;

do $seven_arches_pricing_activation_security_postconditions$
declare v_signature text; v_oid oid; v_relation text; v_role text; v_privilege text;
  v_security_definer boolean; v_config text[];
begin
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_seven_arches_pricing_activation()',
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'
  ] loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or not (select prosecdef from pg_proc where oid=v_oid)
       or (select proconfig from pg_proc where oid=v_oid)
          is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE')
       or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_rpc_security_failed',detail=v_signature;
    end if;
  end loop;
  for v_signature,v_security_definer,v_config in
    select expected.signature,expected.security_definer,expected.config
    from (values
      ('public.hotel_v2_seven_arches_pricing_activation_context_guard()',true,
        array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_immutable()',true,
        array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_review_guard()',true,
        array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_snapshot()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_state_is_exact()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)',false,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_c_h3_1p_freeze_trigger()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_c_validate_pricing_graph(uuid)',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
        true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',true,
        array['search_path=pg_catalog, public']::text[])
    ) expected(signature,security_definer,config)
  loop
    v_oid:=to_regprocedure(v_signature);
    if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or (select prosecdef from pg_proc where oid=v_oid) is distinct from v_security_definer
       or (select proconfig from pg_proc where oid=v_oid) is distinct from v_config
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_seven_arches_pricing_activation_internal_security_failed',
        detail=v_signature;
    end if;
  end loop;
  foreach v_relation in array array[
    'hotel_seven_arches_pricing_activation_reviews',
    'hotel_seven_arches_pricing_activation_transaction_context',
    'hotel_seven_arches_pricing_activation_evolution_receipts',
    'hotel_seven_arches_task2_stage2_compatibility_receipts'
  ] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(0::oid,('public.'||v_relation)::regclass,v_privilege)
           or has_table_privilege(v_role,('public.'||v_relation)::regclass,v_privilege) then
          raise exception using errcode='55000',
            message='hotels_v2_seven_arches_pricing_activation_raw_acl_failed',
            detail=v_relation||':'||v_role||':'||v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
  if exists(select 1 from public.hotel_seven_arches_pricing_activation_transaction_context)
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_installation_failed';
  end if;
end
$seven_arches_pricing_activation_security_postconditions$;

do $seven_arches_pricing_activation_locked_baseline_postcondition$
declare
  v_locked seven_arches_pricing_activation_locked_baseline%rowtype;
  v_receipt public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_property jsonb;
  v_stage2 jsonb;
  v_stage2_compatible jsonb;
begin
  select * into strict v_locked
  from seven_arches_pricing_activation_locked_baseline;
  select * into strict v_receipt
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts
  where id=1;
  v_property:=
    public.hotel_v2_seven_arches_property_proposal_protected_fingerprints();
  v_stage2:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_stage2_compatible:=
    public.hotel_v2_external_calendar_stage2_compatible_fingerprints();
  if current_setting('TimeZone') is distinct from v_locked.incoming_timezone
     or v_property is distinct from v_locked.property_fingerprints
     or public.hotel_v2_h3_2b_hash(v_property)
       is distinct from v_locked.property_fingerprint
     or v_stage2 is distinct from v_locked.stage2_fingerprints
     or public.hotel_v2_external_calendar_worker_hash(v_stage2)
       is distinct from v_locked.stage2_fingerprint
     or v_stage2_compatible is distinct from
       v_locked.stage2_compatible_fingerprints
     or public.hotel_v2_external_calendar_worker_hash(v_stage2_compatible)
       is distinct from v_locked.stage2_compatible_fingerprint
     or v_receipt.canonical_task2_protected_fingerprints is distinct from
       jsonb_set(v_locked.property_fingerprints,'{site_settings}',
         to_jsonb(v_locked.site_settings_lifecycle_fingerprint),false)
     or v_receipt.canonical_stage2_protected_fingerprints is distinct from
       jsonb_set(v_locked.stage2_compatible_fingerprints,'{site_settings}',
         to_jsonb(v_locked.site_settings_lifecycle_fingerprint),false)
     or v_receipt.canonical_snapshot_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure)))
     or v_receipt.validator_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure))) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_locked_baseline_drift';
  end if;
end
$seven_arches_pricing_activation_locked_baseline_postcondition$;

notify pgrst,'reload schema';
commit;
