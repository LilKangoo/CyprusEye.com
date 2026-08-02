-- car-rental-multicity-stage2a-live-preflight-v1
-- Manual catalog preflight. This statement returns exactly one summary row.

with required_objects(object_name) as (
  values
    ('car_offers'::text),
    ('car_bookings'::text),
    ('partners'::text),
    ('partner_resources'::text),
    ('partner_service_fulfillments'::text),
    ('service_deposit_rules'::text),
    ('service_deposit_overrides'::text),
    ('car_location_fees'::text),
    ('car_pricing_rules'::text)
),
relations as (
  select
    ro.object_name,
    c.oid as relation_oid,
    c.relkind,
    c.relowner,
    c.relacl,
    c.relrowsecurity,
    c.relforcerowsecurity,
    pg_get_userbyid(c.relowner) as owner_name
  from required_objects ro
  left join pg_namespace n
    on n.nspname = 'public'
  left join pg_class c
    on c.relnamespace = n.oid
   and c.relname = ro.object_name
   and c.relkind in ('r', 'p')
),
column_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ordinal_position', a.attnum,
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'type_oid', a.atttypid,
          'nullable', not a.attnotnull,
          'default', pg_get_expr(ad.adbin, ad.adrelid),
          'identity', nullif(a.attidentity, ''),
          'generated', nullif(a.attgenerated, ''),
          'collation', case
            when a.attcollation = 0 then null
            else a.attcollation::regcollation::text
          end
        )
        order by a.attnum
      ) filter (where a.attnum is not null),
      '[]'::jsonb
    ) as columns
  from relations r
  left join pg_attribute a
    on a.attrelid = r.relation_oid
   and a.attnum > 0
   and not a.attisdropped
  left join pg_attrdef ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  group by r.object_name
),
constraint_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', con.conname,
          'type_code', con.contype,
          'validated', con.convalidated,
          'deferrable', con.condeferrable,
          'initially_deferred', con.condeferred,
          'source_attnums', to_jsonb(con.conkey),
          'source_columns', coalesce((
            select jsonb_agg(source_attribute.attname order by source_key.position)
            from unnest(con.conkey) with ordinality as source_key(attnum, position)
            join pg_attribute source_attribute
              on source_attribute.attrelid = con.conrelid
             and source_attribute.attnum = source_key.attnum
          ), '[]'::jsonb),
          'target_schema', target_ns.nspname,
          'target_object', target_class.relname,
          'target_attnums', to_jsonb(con.confkey),
          'target_columns', coalesce((
            select jsonb_agg(target_attribute.attname order by target_key.position)
            from unnest(con.confkey) with ordinality as target_key(attnum, position)
            join pg_attribute target_attribute
              on target_attribute.attrelid = con.confrelid
             and target_attribute.attnum = target_key.attnum
          ), '[]'::jsonb),
          'foreign_key_match_code', con.confmatchtype,
          'foreign_key_on_change_code', con.confupdtype,
          'foreign_key_on_remove_code', con.confdeltype,
          'definition', pg_get_constraintdef(con.oid, true)
        )
        order by con.conname
      ) filter (where con.oid is not null),
      '[]'::jsonb
    ) as constraints
  from relations r
  left join pg_constraint con
    on con.conrelid = r.relation_oid
  left join pg_class target_class
    on target_class.oid = con.confrelid
  left join pg_namespace target_ns
    on target_ns.oid = target_class.relnamespace
  group by r.object_name
),
index_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', index_class.relname,
          'unique', idx.indisunique,
          'primary', idx.indisprimary,
          'valid', idx.indisvalid,
          'ready', idx.indisready,
          'key_attnums', idx.indkey::text,
          'expressions', pg_get_expr(idx.indexprs, idx.indrelid),
          'predicate', pg_get_expr(idx.indpred, idx.indrelid),
          'definition', pg_get_indexdef(idx.indexrelid)
        )
        order by index_class.relname
      ) filter (where idx.indexrelid is not null),
      '[]'::jsonb
    ) as indexes
  from relations r
  left join pg_index idx
    on idx.indrelid = r.relation_oid
  left join pg_class index_class
    on index_class.oid = idx.indexrelid
  group by r.object_name
),
policy_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', pol.polname,
          'permissive', pol.polpermissive,
          'command_code', pol.polcmd,
          'command_semantics', case pol.polcmd
            when 'r' then 'read'
            when 'a' then 'append'
            when 'w' then 'change'
            when 'd' then 'remove'
            when '*' then 'all'
            else 'unknown'
          end,
          'roles', coalesce((
            select jsonb_agg(
              case
                when policy_role.role_oid = 0 then 'PUBLIC'
                else pg_get_userbyid(policy_role.role_oid)
              end
              order by policy_role.role_oid
            )
            from unnest(pol.polroles) as policy_role(role_oid)
          ), '[]'::jsonb),
          'using_expression', pg_get_expr(pol.polqual, pol.polrelid),
          'check_expression', pg_get_expr(pol.polwithcheck, pol.polrelid)
        )
        order by pol.polname
      ) filter (where pol.oid is not null),
      '[]'::jsonb
    ) as policies
  from relations r
  left join pg_policy pol
    on pol.polrelid = r.relation_oid
  group by r.object_name
),
privilege_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'grantor', pg_get_userbyid(privilege_row.grantor),
          'grantee', case
            when privilege_row.grantee = 0 then 'PUBLIC'
            else pg_get_userbyid(privilege_row.grantee)
          end,
          'privilege', privilege_row.privilege_type,
          'is_grantable', privilege_row.is_grantable
        )
        order by privilege_row.grantee, privilege_row.privilege_type
      ) filter (where privilege_row.privilege_type is not null),
      '[]'::jsonb
    ) as grants
  from relations r
  left join lateral aclexplode(
    case
      when r.relation_oid is null then '{}'::aclitem[]
      else coalesce(r.relacl, acldefault('r', r.relowner))
    end
  ) as privilege_row on true
  group by r.object_name
),
trigger_contract as (
  select
    r.object_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', trg.tgname,
          'enabled_code', trg.tgenabled,
          'internal', trg.tgisinternal,
          'function_schema', trigger_ns.nspname,
          'function_name', trigger_fn.proname,
          'definition', pg_get_triggerdef(trg.oid, true)
        )
        order by trg.tgisinternal, trg.tgname
      ) filter (where trg.oid is not null),
      '[]'::jsonb
    ) as triggers
  from relations r
  left join pg_trigger trg
    on trg.tgrelid = r.relation_oid
  left join pg_proc trigger_fn
    on trigger_fn.oid = trg.tgfoid
  left join pg_namespace trigger_ns
    on trigger_ns.oid = trigger_fn.pronamespace
  group by r.object_name
),
object_contract as (
  select jsonb_object_agg(
    r.object_name,
    jsonb_build_object(
      'exists', r.relation_oid is not null,
      'relation_kind', r.relkind,
      'owner', r.owner_name,
      'rls_enabled', coalesce(r.relrowsecurity, false),
      'rls_forced', coalesce(r.relforcerowsecurity, false),
      'columns', cc.columns,
      'constraints', kc.constraints,
      'indexes', ic.indexes,
      'policies', pc.policies,
      'grants', gc.grants,
      'triggers', tc.triggers
    )
    order by r.object_name
  ) as objects
  from relations r
  join column_contract cc using (object_name)
  join constraint_contract kc using (object_name)
  join index_contract ic using (object_name)
  join policy_contract pc using (object_name)
  join privilege_contract gc using (object_name)
  join trigger_contract tc using (object_name)
),
required_offer_columns(column_name) as (
  values
    ('id'::text),
    ('car_model'::text),
    ('car_type'::text),
    ('description'::text),
    ('features'::text),
    ('location'::text),
    ('owner_partner_id'::text),
    ('price_per_day'::text),
    ('price_3days'::text),
    ('price_4_6days'::text),
    ('price_7_10days'::text),
    ('price_10plus_days'::text),
    ('currency'::text),
    ('deposit_amount'::text),
    ('insurance_per_day'::text),
    ('young_driver_fee'::text),
    ('young_driver_cost'::text),
    ('stock_count'::text),
    ('north_allowed'::text),
    ('is_available'::text),
    ('is_published'::text),
    ('submission_status'::text),
    ('updated_at'::text)
),
required_booking_columns(column_name) as (
  values
    ('id'::text),
    ('offer_id'::text),
    ('location'::text),
    ('pickup_location'::text),
    ('return_location'::text),
    ('pickup_date'::text),
    ('return_date'::text)
),
missing_offer_columns as (
  select coalesce(array_agg(roc.column_name order by roc.column_name), '{}'::text[]) as names
  from required_offer_columns roc
  where not exists (
    select 1
    from pg_attribute a
    where a.attrelid = to_regclass('public.car_offers')
      and a.attname = roc.column_name
      and a.attnum > 0
      and not a.attisdropped
  )
),
missing_booking_columns as (
  select coalesce(array_agg(rbc.column_name order by rbc.column_name), '{}'::text[]) as names
  from required_booking_columns rbc
  where not exists (
    select 1
    from pg_attribute a
    where a.attrelid = to_regclass('public.car_bookings')
      and a.attname = rbc.column_name
      and a.attnum > 0
      and not a.attisdropped
  )
),
named_types as (
  select
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'car_model'
    ) as car_model_type,
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'car_type'
    ) as car_type_type,
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'description'
    ) as description_type,
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'features'
    ) as features_type,
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'location'
    ) as offer_location_type,
    max(format_type(a.atttypid, a.atttypmod)) filter (
      where a.attrelid = to_regclass('public.partners') and a.attname = 'cars_locations'
    ) as partners_cars_locations_type
  from pg_attribute a
  where a.attnum > 0
    and not a.attisdropped
    and a.attrelid in (
      to_regclass('public.car_offers'),
      to_regclass('public.partners')
    )
),
fk_attnums as (
  select
    max(a.attnum) filter (
      where a.attrelid = to_regclass('public.car_bookings') and a.attname = 'offer_id'
    )::smallint as booking_offer_attnum,
    max(a.attnum) filter (
      where a.attrelid = to_regclass('public.car_offers') and a.attname = 'id'
    )::smallint as offer_id_attnum
  from pg_attribute a
  where a.attnum > 0
    and not a.attisdropped
    and a.attrelid in (
      to_regclass('public.car_bookings'),
      to_regclass('public.car_offers')
    )
),
exact_offer_fk as (
  select
    exists (
      select 1
      from pg_constraint con
      cross join fk_attnums fa
      where con.contype = 'f'
        and con.conrelid = to_regclass('public.car_bookings')
        and con.confrelid = to_regclass('public.car_offers')
        and con.conkey = array[fa.booking_offer_attnum]::smallint[]
        and con.confkey = array[fa.offer_id_attnum]::smallint[]
        and con.confdeltype = 'n'
    ) as present,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'constraint_name', con.conname,
          'source_object', con.conrelid::regclass::text,
          'source_attnums', to_jsonb(con.conkey),
          'target_object', con.confrelid::regclass::text,
          'target_attnums', to_jsonb(con.confkey),
          'on_remove_code', con.confdeltype,
          'on_remove_semantics', case con.confdeltype
            when 'n' then 'set_null'
            when 'a' then 'no_action'
            when 'r' then 'restrict'
            when 'c' then 'cascade'
            when 'd' then 'set_default'
            else 'unknown'
          end
        )
        order by con.conname
      )
      from pg_constraint con
      cross join fk_attnums fa
      where con.contype = 'f'
        and con.conrelid = to_regclass('public.car_bookings')
        and con.conkey = array[fa.booking_offer_attnum]::smallint[]
    ), '[]'::jsonb) as observed_contract
),
summary as (
  select
    (select count(*) from relations where relation_oid is not null)::integer as objects_present,
    (select count(*) from required_objects)::integer as objects_required,
    coalesce((select bool_and(relrowsecurity) from relations where relation_oid is not null), false) as all_present_objects_have_rls,
    (select names from missing_offer_columns) as missing_car_offer_columns,
    (select names from missing_booking_columns) as missing_car_booking_columns
)
select
  'car-rental-multicity-stage2a-live-preflight-v1'::text as preflight_version,
  now() as inspected_at,
  current_database() as database_name,
  current_user as inspected_by,
  s.objects_required,
  s.objects_present,
  s.objects_present = s.objects_required as all_required_objects_present,
  s.all_present_objects_have_rls,
  s.missing_car_offer_columns,
  s.missing_car_booking_columns,
  nt.car_model_type,
  nt.car_type_type,
  nt.description_type,
  nt.features_type,
  nt.offer_location_type,
  nt.partners_cars_locations_type,
  ef.present as exact_car_booking_offer_fk_set_null,
  ef.observed_contract as observed_car_booking_offer_fk_contract,
  oc.objects as catalog_contract,
  (
    s.objects_present = s.objects_required
    and s.all_present_objects_have_rls
    and cardinality(s.missing_car_offer_columns) = 0
    and cardinality(s.missing_car_booking_columns) = 0
    and ef.present
    and nt.partners_cars_locations_type = 'text[]'
    and nt.offer_location_type = 'text'
    and nt.car_model_type in ('text', 'json', 'jsonb')
    and nt.car_type_type in ('text', 'json', 'jsonb')
    and nt.description_type in ('text', 'json', 'jsonb')
    and nt.features_type in ('text', 'json', 'jsonb')
  ) as schema_preflight_pass
from summary s
cross join named_types nt
cross join exact_offer_fk ef
cross join object_contract oc;
