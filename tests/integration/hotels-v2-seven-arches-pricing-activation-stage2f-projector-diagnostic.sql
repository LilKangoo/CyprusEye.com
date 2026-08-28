\if :{?projector_catalog_replay_only}
\else
\set projector_catalog_replay_only 0
\endif
\if :projector_catalog_replay_only
\set ON_ERROR_STOP on
\pset format unaligned
\pset fieldsep '|'
\set pricing_activation_migration_sha `shasum -a 256 supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql | awk '{print $1}'`
select :'pricing_activation_migration_sha'=
  'e05420b499060f002ad98d122caf71f93d57cd6b62baf5323c4361d1deb24359'
  as pricing_activation_migration_sha_exact \gset
\if :pricing_activation_migration_sha_exact
\else
  \quit 3
\endif
\! sed -n '1,2231p' supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql > /tmp/hotels-v2-114400-projector-prefix.sql
\set pricing_activation_prefix_sha `shasum -a 256 /tmp/hotels-v2-114400-projector-prefix.sql | awk '{print $1}'`
select :'pricing_activation_prefix_sha'=
  '0d78ca6d06cfe6ecf8aa26cfb0bdee8df4aca19470d5ef21d0cd4b3d5e0ecc34'
  as pricing_activation_prefix_sha_exact \gset
\if :pricing_activation_prefix_sha_exact
\else
  \! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
  \quit 3
\endif
\ir /tmp/hotels-v2-114400-projector-prefix.sql

create temporary table projector_catalog_replay_results(
  ordinal integer generated always as identity,
  predicate text not null,
  value boolean,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  sqlstate text,
  error text
) on commit drop;

create function pg_temp.capture_catalog_predicate(
  p_predicate text,p_boolean_sql text,p_details_sql text default null
) returns void language plpgsql set search_path=pg_catalog,public,pg_temp
as $capture$
declare v_value boolean; v_details jsonb:='{}'::jsonb;
begin
  execute 'select ('||p_boolean_sql||')::boolean' into strict v_value;
  if p_details_sql is not null then
    execute 'select coalesce(('||p_details_sql||'),''{}''::jsonb)'
      into strict v_details;
  end if;
  insert into projector_catalog_replay_results(
    predicate,value,status,details)
  values(p_predicate,v_value,
    case when v_value is true then 'PASS' else 'FAIL' end,v_details);
exception when others then
  insert into projector_catalog_replay_results(
    predicate,value,status,details,sqlstate,error)
  values(p_predicate,null,'EXCEPTION',
    jsonb_build_object('boolean_sql',p_boolean_sql,'details_sql',p_details_sql),
    sqlstate,sqlerrm);
end
$capture$;

do $catalog_replay$
begin
  perform pg_temp.capture_catalog_predicate('B00_relation_resolves',
    $sql$to_regclass('public.hotel_seven_arches_task2_stage2_compatibility_receipts') is not null$sql$,
    $sql$jsonb_build_object('oid',to_regclass('public.hotel_seven_arches_task2_stage2_compatibility_receipts')::text)$sql$);
  perform pg_temp.capture_catalog_predicate('B01_receipt_count_lte_one',
    $sql$(select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts))$sql$);
  perform pg_temp.capture_catalog_predicate('B02_relation_owner_postgres',
    $sql$(select relowner='postgres'::regrole from pg_class where oid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)$sql$,
    $sql$(select jsonb_build_object('owner',relowner::regrole::text) from pg_class where oid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)$sql$);
  perform pg_temp.capture_catalog_predicate('B03_relation_rls_enabled',
    $sql$(select relrowsecurity from pg_class where oid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)$sql$);
  perform pg_temp.capture_catalog_predicate('B04_column_count_nine',
    $sql$(select count(*) from pg_attribute where attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attnum>0 and not attisdropped)=9$sql$,
    $sql$jsonb_build_object('count',(select count(*) from pg_attribute where attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attnum>0 and not attisdropped))$sql$);
  perform pg_temp.capture_catalog_predicate('B05_column_envelope_exact',
    $sql$not exists(select 1 from (values (1::smallint,'id','smallint',true,null::text),(2::smallint,'contract_version','text',true,null::text),(3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),(4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),(5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),(6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),(7::smallint,'canonical_snapshot_source_hash','text',true,null::text),(8::smallint,'validator_source_hash','text',true,null::text),(9::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')) expected(attnum,attname,type_name,not_null,default_expression) left join pg_attribute attribute on attribute.attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attribute.attnum=expected.attnum and not attribute.attisdropped left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid and default_row.adnum=attribute.attnum where attribute.attrelid is null or attribute.attname is distinct from expected.attname or format_type(attribute.atttypid,attribute.atttypmod) is distinct from expected.type_name or attribute.attnotnull is distinct from expected.not_null or attribute.attidentity is distinct from '' or attribute.attgenerated is distinct from '' or pg_get_expr(default_row.adbin,default_row.adrelid) is distinct from expected.default_expression)$sql$,
    $sql$(select jsonb_agg(jsonb_build_object('attnum',attribute.attnum,'name',attribute.attname,'type',format_type(attribute.atttypid,attribute.atttypmod),'not_null',attribute.attnotnull,'identity',attribute.attidentity,'generated',attribute.attgenerated,'default',pg_get_expr(default_row.adbin,default_row.adrelid)) order by attribute.attnum) from pg_attribute attribute left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid and default_row.adnum=attribute.attnum where attribute.attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attribute.attnum>0 and not attribute.attisdropped)$sql$);
  perform pg_temp.capture_catalog_predicate('B06_constraint_count_nine',
    $sql$(select count(*) from pg_constraint where conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=9$sql$,
    $sql$jsonb_build_object('count',(select count(*) from pg_constraint where conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass))$sql$);
  perform pg_temp.capture_catalog_predicate('B07_primary_key_exact',
    $sql$(select count(*) from pg_constraint constraint_row join pg_index index_row on index_row.indexrelid=constraint_row.conindid where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='p' and constraint_row.convalidated and constraint_row.conkey=array[1]::smallint[] and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)' and index_row.indisprimary and index_row.indisunique and index_row.indisvalid and index_row.indisready)=1$sql$);
  perform pg_temp.capture_catalog_predicate('B08_id_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[1]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(id=1)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B09_contract_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[2]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(contract_version=''hotels_v2_seven_arches_task2_stage2_compatibility_v1''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B10_task2_object_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[3]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(canonical_task2_protected_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B11_stage2_object_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[5]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(canonical_stage2_protected_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B12_task2_hash_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[4]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(canonical_task2_protected_fingerprint~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B13_stage2_hash_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[6]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(canonical_stage2_protected_fingerprint~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B14_snapshot_hash_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[7]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(canonical_snapshot_source_hash~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B15_validator_hash_check_exact',
    $sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[8]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(validator_source_hash~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_catalog_predicate('B16_no_policies',
    $sql$not exists(select 1 from pg_policy where polrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)$sql$);
  perform pg_temp.capture_catalog_predicate('B17_trigger_count_one',
    $sql$(select count(*) from pg_trigger where tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and not tgisinternal)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from pg_trigger where tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and not tgisinternal))$sql$);
  perform pg_temp.capture_catalog_predicate('B18_trigger_exact',
    $sql$exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and trigger_row.tgname='hotel_seven_arches_task2_stage2_compatibility_receipt_immutable' and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()') and trigger_row.tgtype=27 and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)$sql$,
    $sql$(select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'function',tgfoid::regprocedure::text,'type',tgtype,'enabled',tgenabled)),'[]'::jsonb) from pg_trigger where tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and not tgisinternal)$sql$);
  perform pg_temp.capture_catalog_predicate('B19_no_raw_acl',
    $sql$not exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name) where has_table_privilege(0::oid,'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('anon','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('authenticated','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('service_role','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name))$sql$,
    $sql$(select coalesce(jsonb_agg(jsonb_build_object('role',role_name,'privilege',privilege_name)),'[]'::jsonb) from (select role_name,privilege_name from unnest(array['PUBLIC','anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name where case role_name when 'PUBLIC' then has_table_privilege(0::oid,'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege_name) else has_table_privilege(role_name,'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege_name) end) granted)$sql$);
end
$catalog_replay$;

select predicate,value,status,details,sqlstate,error
from projector_catalog_replay_results order by ordinal;
select jsonb_build_object(
  'pass_count',count(*) filter(where status='PASS'),
  'fail_count',count(*) filter(where status='FAIL'),
  'exception_count',count(*) filter(where status='EXCEPTION'))
from projector_catalog_replay_results;
select 'HOTELS_V2_7A_PROJECTOR_CATALOG_REPLAY_COMPLETE' as sentinel;
rollback;
\! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
\quit 0
\endif

\if :{?projector_fine_a_replay_only}
\else
\set projector_fine_a_replay_only 0
\endif
\if :projector_fine_a_replay_only
\set ON_ERROR_STOP on
\pset format unaligned
\pset fieldsep '|'
\set pricing_activation_migration_sha `shasum -a 256 supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql | awk '{print $1}'`
select :'pricing_activation_migration_sha'=
  'e05420b499060f002ad98d122caf71f93d57cd6b62baf5323c4361d1deb24359'
  as pricing_activation_migration_sha_exact \gset
\if :pricing_activation_migration_sha_exact
\else
  \quit 3
\endif
\! sed -n '1,2231p' supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql > /tmp/hotels-v2-114400-projector-prefix.sql
\set pricing_activation_prefix_sha `shasum -a 256 /tmp/hotels-v2-114400-projector-prefix.sql | awk '{print $1}'`
select :'pricing_activation_prefix_sha'=
  '0d78ca6d06cfe6ecf8aa26cfb0bdee8df4aca19470d5ef21d0cd4b3d5e0ecc34'
  as pricing_activation_prefix_sha_exact \gset
\if :pricing_activation_prefix_sha_exact
\else
  \! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
  \quit 3
\endif
\ir /tmp/hotels-v2-114400-projector-prefix.sql

create temporary table projector_fine_a_replay_results(
  ordinal integer generated always as identity,
  predicate text not null,
  value boolean,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  sqlstate text,
  error text
) on commit drop;

create function pg_temp.capture_fine_a_predicate(
  p_predicate text,p_boolean_sql text,p_details_sql text default null
) returns void language plpgsql set search_path=pg_catalog,public,pg_temp
as $capture$
declare v_value boolean; v_details jsonb:='{}'::jsonb;
begin
  execute 'select ('||p_boolean_sql||')::boolean' into strict v_value;
  if p_details_sql is not null then
    execute 'select coalesce(('||p_details_sql||'),''{}''::jsonb)'
      into strict v_details;
  end if;
  insert into projector_fine_a_replay_results(
    predicate,value,status,details)
  values(p_predicate,v_value,
    case when v_value is true then 'PASS' else 'FAIL' end,v_details);
exception when others then
  insert into projector_fine_a_replay_results(
    predicate,value,status,details,sqlstate,error)
  values(p_predicate,null,'EXCEPTION',
    jsonb_build_object('boolean_sql',p_boolean_sql,'details_sql',p_details_sql),
    sqlstate,sqlerrm);
end
$capture$;

do $fine_a_core$
begin
  perform pg_temp.capture_fine_a_predicate('A00_site_count_one',$sql$(select count(*) from public.site_settings)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A01_site_id_one',$sql$(select count(*) from public.site_settings where id=1)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A02_rooms_false',$sql$(select hotel_rooms_v2_enabled is not distinct from false from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A03_external_nonnull',$sql$(select hotel_external_sync_enabled is not null from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A04_instant_false',$sql$(select hotel_instant_booking_enabled is not distinct from false from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A05_stripe_false',$sql$(select hotel_stripe_connect_enabled is not distinct from false from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A06_owner_count_one',$sql$(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A07_original_count_one',$sql$(select count(*) from public.hotel_admin_availability_foundation_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A07b_partner_workspace_count_one',$sql$(select count(*) from public.hotel_partner_workspace_foundation_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A08_task2_count_one',$sql$(select count(*) from public.hotel_partner_property_proposal_foundation_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A09_external_foundation_count_one',$sql$(select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A10_stage2f_count_one',$sql$(select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A11_property_attribution',$sql$public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() is true$sql$);
  perform pg_temp.capture_fine_a_predicate('A12_workspace_lineage',$sql$public.hotel_v2_partner_workspace_function_lineage_is_exact() is true$sql$);

  perform pg_temp.capture_fine_a_predicate('A20_original_id',$sql$(select id=1 from public.hotel_admin_availability_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A21_original_self_hash',$sql$(select protected_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(protected_fingerprints) from public.hotel_admin_availability_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A21b_partner_workspace_id_one',$sql$(select id=1 from public.hotel_partner_workspace_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A21c_partner_workspace_self_hash',$sql$(select protected_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(protected_fingerprints) from public.hotel_partner_workspace_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A22_owner_id',$sql$(select id=1 from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A23_owner_contract',$sql$(select contract_version is not distinct from 'hotels_v2_admin_d_foundation_evolution_v2' from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A24_owner_original_id_link',$sql$(select owner_receipt.original_foundation_receipt_id is not distinct from original.id from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt cross join public.hotel_admin_availability_foundation_receipts original where owner_receipt.id=1 and original.id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A25_owner_original_hash_link',$sql$(select owner_receipt.original_protected_fingerprint is not distinct from original.protected_fingerprint from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt cross join public.hotel_admin_availability_foundation_receipts original where owner_receipt.id=1 and original.id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A26_owner_before_self_hash',$sql$(select before_current_protected_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(before_current_protected_fingerprints) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A27_owner_current_self_hash',$sql$(select current_protected_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(current_protected_fingerprints) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A28_owner_stage2_before_self_hash',$sql$(select stage2_before_current_protected_fingerprint is not distinct from public.hotel_v2_external_calendar_worker_hash(stage2_before_current_protected_fingerprints) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A29_owner_stage2_current_self_hash',$sql$(select stage2_current_protected_fingerprint is not distinct from public.hotel_v2_external_calendar_worker_hash(stage2_current_protected_fingerprints) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A30_owner_allowed_keys',$sql$(select allowed_fingerprint_keys is not distinct from array['hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[] from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A31_owner_stage2_allowed_keys',$sql$(select stage2_allowed_fingerprint_keys is not distinct from array['hotel_partner_hotel_permissions','non_external_calendar_activity','non_external_calendar_partner_receipts']::text[] from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A32_owner_task1_delta_scope',$sql$(select (current_protected_fingerprints-allowed_fingerprint_keys) is not distinct from (before_current_protected_fingerprints-allowed_fingerprint_keys) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A33_owner_stage2_delta_scope',$sql$(select (stage2_current_protected_fingerprints-stage2_allowed_fingerprint_keys) is not distinct from (stage2_before_current_protected_fingerprints-stage2_allowed_fingerprint_keys) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A34_owner_each_task1_key_changed',$sql$(select not exists(select 1 from unnest(allowed_fingerprint_keys) changed(key) where current_protected_fingerprints->changed.key is not distinct from before_current_protected_fingerprints->changed.key) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$,
    $sql$(select jsonb_agg(changed.key) from public.hotel_admin_availability_foundation_evolution_receipts receipt cross join lateral unnest(receipt.allowed_fingerprint_keys) changed(key) where receipt.id=1 and receipt.current_protected_fingerprints->changed.key is not distinct from receipt.before_current_protected_fingerprints->changed.key)$sql$);
  perform pg_temp.capture_fine_a_predicate('A35_owner_each_stage2_key_changed',$sql$(select not exists(select 1 from unnest(stage2_allowed_fingerprint_keys) changed(key) where stage2_current_protected_fingerprints->changed.key is not distinct from stage2_before_current_protected_fingerprints->changed.key) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)$sql$,
    $sql$(select jsonb_agg(changed.key) from public.hotel_admin_availability_foundation_evolution_receipts receipt cross join lateral unnest(receipt.stage2_allowed_fingerprint_keys) changed(key) where receipt.id=1 and receipt.stage2_current_protected_fingerprints->changed.key is not distinct from receipt.stage2_before_current_protected_fingerprints->changed.key)$sql$);
  perform pg_temp.capture_fine_a_predicate('A36_task2_id',$sql$(select id=1 from public.hotel_partner_property_proposal_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A37_task2_original_hash_link',$sql$(select task2.original_h3_2b_foundation_fingerprint is not distinct from partner_foundation.protected_fingerprint from public.hotel_partner_property_proposal_foundation_receipts task2 cross join public.hotel_partner_workspace_foundation_receipts partner_foundation where task2.id=1 and partner_foundation.id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A38_task2_owner_id_link',$sql$(select task2.owner_evolution_receipt_id is not distinct from owner_receipt.id from public.hotel_partner_property_proposal_foundation_receipts task2 cross join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt where task2.id=1 and owner_receipt.id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A39_task2_owner_hash_link',$sql$(select task2.owner_evolution_receipt_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(owner_receipt),'{created_at}',to_jsonb(extract(epoch from owner_receipt.created_at)),false)) from public.hotel_partner_property_proposal_foundation_receipts task2 cross join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt where task2.id=1 and owner_receipt.id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A40_task2_self_hash',$sql$(select protected_fingerprint is not distinct from public.hotel_v2_h3_2b_hash(protected_fingerprints) from public.hotel_partner_property_proposal_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A41_task2_stage2_source_pin',$sql$(select stage2_compatibility_source_hash is not distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure))) from public.hotel_partner_property_proposal_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A42_provider_oid_nonnull',$sql$to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is not null$sql$);
  perform pg_temp.capture_fine_a_predicate('A43_task2_provider_source_pin',$sql$(select provider_source_attribution_source_hash is not distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef('public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))) from public.hotel_partner_property_proposal_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A44_external_foundation_id',$sql$(select id=1 from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A45_external_foundation_self_hash',$sql$(select protected_fingerprint is not distinct from public.hotel_v2_external_calendar_worker_hash(protected_fingerprints) from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A46_stage2f_id',$sql$(select id=1 from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A47_stage2f_created_nonnull',$sql$(select created_at is not null from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A48_stage2f_created_finite',$sql$(select isfinite(created_at) from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A49_stage2f_site_hash_hex',$sql$(select (site_settings_without_external_fingerprint~'^[0-9a-f]{64}$') is true from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A50_stage2f_map_object',$sql$(select jsonb_typeof(compatibility_function_fingerprints) is not distinct from 'object' from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A51_stage2f_map_count_twenty',$sql$(select count(*) from jsonb_object_keys((select compatibility_function_fingerprints from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)))=20$sql$);
  perform pg_temp.capture_fine_a_predicate('A52_stage2f_map_exact_keyset',$sql$(select compatibility_function_fingerprints ?& array['public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)','public.hotel_v2_partner_list_assigned_properties(uuid)','public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)','public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)','public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)','public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)','public.hotel_v2_admin_get_content_control(uuid)','public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)','public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)','public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)','public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)','public.hotel_v2_h3_2b_flags_off()','public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)','public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)','public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)','public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)','public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)']::text[] from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_fine_a_predicate('A53_stage2f_map_each_value_hex',$sql$not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt cross join lateral jsonb_each_text(receipt.compatibility_function_fingerprints) fingerprint where receipt.id=1 and (fingerprint.value~'^[0-9a-f]{64}$') is not true)$sql$);
end
$fine_a_core$;

do $fine_a_catalog$
declare
  v_column record;
  v_role text;
  v_privilege text;
  v_function record;
  v_role_sql text;
begin
  perform pg_temp.capture_fine_a_predicate('A60_stage2f_relation_owner',$sql$(select relowner='postgres'::regrole from pg_class where oid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)$sql$);
  perform pg_temp.capture_fine_a_predicate('A61_stage2f_rls_disabled',$sql$(select not relrowsecurity from pg_class where oid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)$sql$);
  perform pg_temp.capture_fine_a_predicate('A62_stage2f_column_count_four',$sql$(select count(*) from pg_attribute where attrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and attnum>0 and not attisdropped)=4$sql$);
  for v_column in select * from (values
    (1::smallint,'id','smallint',true,null::text),
    (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
    (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
    (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
  ) expected(attnum,attname,type_name,not_null,default_expression) loop
    perform pg_temp.capture_fine_a_predicate(format('A63_column_%s_exists',v_column.attnum),format('exists(select 1 from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A64_column_%s_name',v_column.attnum),format('(select attname=%L from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.attname,v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A65_column_%s_type',v_column.attnum),format('(select format_type(atttypid,atttypmod)=%L from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.type_name,v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A66_column_%s_not_null',v_column.attnum),format('(select attnotnull=%L::boolean from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.not_null,v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A67_column_%s_identity_empty',v_column.attnum),format('(select attidentity='''' from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A68_column_%s_generated_empty',v_column.attnum),format('(select attgenerated='''' from pg_attribute where attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attnum=%s and not attisdropped)',v_column.attnum));
    perform pg_temp.capture_fine_a_predicate(format('A69_column_%s_default',v_column.attnum),format('(select pg_get_expr(default_row.adbin,default_row.adrelid) is not distinct from %L from pg_attribute attribute left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid and default_row.adnum=attribute.attnum where attribute.attrelid=''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass and attribute.attnum=%s and not attribute.attisdropped)',v_column.default_expression,v_column.attnum));
  end loop;
  perform pg_temp.capture_fine_a_predicate('A70_stage2f_constraint_count_four',$sql$(select count(*) from pg_constraint where conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)=4$sql$);
  perform pg_temp.capture_fine_a_predicate('A71_stage2f_primary_key_exact',$sql$(select count(*) from pg_constraint constraint_row join pg_index index_row on index_row.indexrelid=constraint_row.conindid where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='p' and constraint_row.convalidated and constraint_row.conkey=array[1]::smallint[] and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)' and index_row.indisprimary and index_row.indisunique and index_row.indisvalid and index_row.indisready)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A72_stage2f_id_check_exact',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[1]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(id=1)')=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A73_stage2f_site_check_exact',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[2]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A74_stage2f_object_check_exact',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[3]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A75_stage2f_no_policy',$sql$not exists(select 1 from pg_policy where polrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)$sql$);
  perform pg_temp.capture_fine_a_predicate('A76_stage2f_trigger_count_one',$sql$(select count(*) from pg_trigger where tgrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and not tgisinternal)=1$sql$);
  perform pg_temp.capture_fine_a_predicate('A77_stage2f_trigger_exact',$sql$exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable' and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') and trigger_row.tgtype=27 and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)$sql$);
  foreach v_role in array array['PUBLIC','anon','authenticated','service_role'] loop
    foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      v_role_sql:=case when v_role='PUBLIC' then '0::oid' else quote_literal(v_role) end;
      perform pg_temp.capture_fine_a_predicate(
        'A78_stage2f_acl_'||lower(v_role)||'_'||lower(v_privilege),
        format('has_table_privilege(%s,''hotels_v2_private.hotel_external_calendar_activation_receipts''::regclass,%L) is not true',v_role_sql,v_privilege));
    end loop;
  end loop;
  perform pg_temp.capture_fine_a_predicate('A79_private_schema_owner',$sql$(select nspowner='postgres'::regrole from pg_namespace where oid='hotels_v2_private'::regnamespace)$sql$);
  perform pg_temp.capture_fine_a_predicate('A80_schema_public_usage',$sql$has_schema_privilege(0::oid,'hotels_v2_private','USAGE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A81_schema_anon_usage',$sql$has_schema_privilege('anon','hotels_v2_private','USAGE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A82_schema_service_usage',$sql$has_schema_privilege('service_role','hotels_v2_private','USAGE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A83_schema_public_create',$sql$has_schema_privilege(0::oid,'hotels_v2_private','CREATE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A84_schema_anon_create',$sql$has_schema_privilege('anon','hotels_v2_private','CREATE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A85_schema_authenticated_create',$sql$has_schema_privilege('authenticated','hotels_v2_private','CREATE') is not true$sql$);
  perform pg_temp.capture_fine_a_predicate('A86_schema_service_create',$sql$has_schema_privilege('service_role','hotels_v2_private','CREATE') is not true$sql$);
  for v_function in select * from (values
    ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",array['search_path=pg_catalog']::text[],'d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
    ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,'s'::"char",array['search_path=pg_catalog, public']::text[],'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
    ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,'s'::"char",array['search_path=pg_catalog, public']::text[],'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
    ('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",array['search_path=pg_catalog, public']::text[],'5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
  ) expected(signature,security_definer,volatility,path,source_hash) loop
    perform pg_temp.capture_fine_a_predicate('A87_function_exists:'||v_function.signature,format('to_regprocedure(%L) is not null',v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A88_function_owner:'||v_function.signature,format('(select proowner=''postgres''::regrole from pg_proc where oid=to_regprocedure(%L))',v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A89_function_secdef:'||v_function.signature,format('(select prosecdef=%L::boolean from pg_proc where oid=to_regprocedure(%L))',v_function.security_definer,v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A90_function_volatility:'||v_function.signature,format('(select provolatile=%L::"char" from pg_proc where oid=to_regprocedure(%L))',v_function.volatility,v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A91_function_path:'||v_function.signature,format('(select proconfig=%L::text[] from pg_proc where oid=to_regprocedure(%L))',v_function.path::text,v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A92_function_source:'||v_function.signature,format('(select encode(extensions.digest(convert_to(prosrc,''UTF8''),''sha256''),''hex'')=%L from pg_proc where oid=to_regprocedure(%L))',v_function.source_hash,v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A93_function_public_exec:'||v_function.signature,format('has_function_privilege(0::oid,to_regprocedure(%L),''EXECUTE'') is not true',v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A94_function_anon_exec:'||v_function.signature,format('has_function_privilege(''anon'',to_regprocedure(%L),''EXECUTE'') is not true',v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A95_function_authenticated_exec:'||v_function.signature,format('has_function_privilege(''authenticated'',to_regprocedure(%L),''EXECUTE'') is not true',v_function.signature));
    perform pg_temp.capture_fine_a_predicate('A96_function_service_exec:'||v_function.signature,format('has_function_privilege(''service_role'',to_regprocedure(%L),''EXECUTE'') is not true',v_function.signature));
  end loop;
end
$fine_a_catalog$;

select predicate,value,status,details,sqlstate,error
from projector_fine_a_replay_results order by ordinal;
select jsonb_build_object(
  'pass_count',count(*) filter(where status='PASS'),
  'fail_count',count(*) filter(where status='FAIL'),
  'exception_count',count(*) filter(where status='EXCEPTION'))
from projector_fine_a_replay_results;
select 'HOTELS_V2_7A_PROJECTOR_FINE_A_REPLAY_COMPLETE' as sentinel;
rollback;
\! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
\quit 0
\endif

\set ON_ERROR_STOP on
\if :{?stage2f_install_external_enabled}
\else
\set stage2f_install_external_enabled 0
\endif
\set provider_install_external_enabled :stage2f_install_external_enabled
\if :stage2f_install_external_enabled
\set stage2f_expected_external true
\else
\set stage2f_expected_external false
\endif
\set seven_arches_owner_live_drift_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
select set_config('test.stage2f_expected_external',
  :'stage2f_expected_external',false);

begin;
do $accept_task2_before_projector_diagnostic$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb;
  v_preview jsonb;
  v_control jsonb;
  v_proposal jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+2);
  v_preview:=public.hotel_v2_partner_preview_content_plan(jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1',
    'partner_id',c_partner,'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token',
    'intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — Stage2F','en','7 Arches Stage2F',
        'he','7 קשתות Stage2F')),
      'reason','Task2 acceptance before projector diagnostic')));
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '39100000-0000-4000-8000-000000000001',
    '39100000-0000-4000-8000-000000000002');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal->'id',
      'proposal_version',v_proposal->'version','action','accept',
      'reason','Accept Task2 before projector diagnostic'));
  perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','39100000-0000-4000-8000-000000000003');
  reset role;

  update public.site_settings
    set force_refresh_version=force_refresh_version+1,
        updated_at=clock_timestamp()
    where id=1;
end
$accept_task2_before_projector_diagnostic$;
commit;

-- Mechanically execute the frozen migration only through the statement just
-- before the canonical receipt INSERT. The partial transaction is rolled back
-- after diagnostics, so no migration is installed by this harness.
\set pricing_activation_migration_sha `shasum -a 256 supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql | awk '{print $1}'`
select :'pricing_activation_migration_sha'=
  'e05420b499060f002ad98d122caf71f93d57cd6b62baf5323c4361d1deb24359'
  as pricing_activation_migration_sha_exact \gset
\if :pricing_activation_migration_sha_exact
\else
  \echo '114400 SHA mismatch; diagnostic prefix boundary is not safe'
  \quit 3
\endif
\! sed -n '1,2231p' supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql > /tmp/hotels-v2-114400-projector-prefix.sql
\set pricing_activation_prefix_sha `shasum -a 256 /tmp/hotels-v2-114400-projector-prefix.sql | awk '{print $1}'`
select :'pricing_activation_prefix_sha'=
  '0d78ca6d06cfe6ecf8aa26cfb0bdee8df4aca19470d5ef21d0cd4b3d5e0ecc34'
  as pricing_activation_prefix_sha_exact \gset
\if :pricing_activation_prefix_sha_exact
\else
  \echo '114400 diagnostic prefix extraction mismatch'
  \! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
  \quit 3
\endif
\ir /tmp/hotels-v2-114400-projector-prefix.sql

create temporary table projector_diagnostic_results(
  ordinal integer generated always as identity,
  section text not null,
  predicate text not null,
  classification text not null,
  value boolean,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  sqlstate text,
  error text
) on commit drop;

create function pg_temp.capture_projector_predicate(
  p_section text,p_predicate text,p_classification text,
  p_boolean_sql text,p_details_sql text default null
) returns void language plpgsql set search_path=pg_catalog,public,pg_temp
as $capture$
declare v_value boolean; v_details jsonb:='{}'::jsonb;
begin
  execute 'select ('||p_boolean_sql||')::boolean' into v_value;
  if p_details_sql is not null then
    execute 'select coalesce(('||p_details_sql||'),''{}''::jsonb)'
      into v_details;
  end if;
  insert into projector_diagnostic_results(
    section,predicate,classification,value,status,details)
  values(p_section,p_predicate,p_classification,v_value,
    case when v_value is true then 'PASS' else 'FAIL' end,v_details);
exception when others then
  insert into projector_diagnostic_results(
    section,predicate,classification,value,status,details,sqlstate,error)
  values(p_section,p_predicate,p_classification,null,'EXCEPTION',
    jsonb_build_object('boolean_sql',p_boolean_sql,'details_sql',p_details_sql),
    sqlstate,sqlerrm);
end
$capture$;

create function pg_temp.capture_projector_statement(
  p_section text,p_predicate text,p_classification text,p_sql text
) returns void language plpgsql set search_path=pg_catalog,public,pg_temp
as $capture$
declare v_details jsonb;
begin
  execute p_sql into strict v_details;
  insert into projector_diagnostic_results(
    section,predicate,classification,value,status,details)
  values(p_section,p_predicate,p_classification,true,'PASS',
    coalesce(v_details,'null'::jsonb));
exception when others then
  insert into projector_diagnostic_results(
    section,predicate,classification,value,status,details,sqlstate,error)
  values(p_section,p_predicate,p_classification,null,'EXCEPTION',
    jsonb_build_object('statement_sql',p_sql),sqlstate,sqlerrm);
end
$capture$;

do $projector_predicates$
begin
  perform pg_temp.capture_projector_predicate('A1','site_settings_count',
    'lifecycle',
    $sql$(select count(*) from public.site_settings)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.site_settings))$sql$);
  perform pg_temp.capture_projector_predicate('A1','site_settings_id',
    'lifecycle',
    $sql$(select count(*) from public.site_settings where id=1)=1$sql$,
    $sql$coalesce((select to_jsonb(setting) from public.site_settings setting where id=1),'null'::jsonb)$sql$);
  perform pg_temp.capture_projector_predicate('A1','rooms_flag_false',
    'lifecycle',$sql$(select hotel_rooms_v2_enabled is not distinct from false from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_projector_predicate('A1','external_flag_nonnull',
    'lifecycle',$sql$(select hotel_external_sync_enabled is not null from public.site_settings where id=1)$sql$,
    $sql$jsonb_build_object('actual',(select hotel_external_sync_enabled from public.site_settings where id=1),'expected_fixture',current_setting('test.stage2f_expected_external')::boolean)$sql$);
  perform pg_temp.capture_projector_predicate('A1','instant_flag_false',
    'lifecycle',$sql$(select hotel_instant_booking_enabled is not distinct from false from public.site_settings where id=1)$sql$);
  perform pg_temp.capture_projector_predicate('A1','stripe_flag_false',
    'lifecycle',$sql$(select hotel_stripe_connect_enabled is not distinct from false from public.site_settings where id=1)$sql$);

  perform pg_temp.capture_projector_predicate('A2','original_receipt_count_id',
    'foundation_cardinality',$sql$(select count(*) from public.hotel_admin_availability_foundation_receipts)=1 and (select count(*) from public.hotel_admin_availability_foundation_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_admin_availability_foundation_receipts),'id1',(select count(*) from public.hotel_admin_availability_foundation_receipts where id=1))$sql$);
  perform pg_temp.capture_projector_predicate('A2','partner_workspace_receipt_count_id',
    'foundation_cardinality',$sql$(select count(*) from public.hotel_partner_workspace_foundation_receipts)=1 and (select count(*) from public.hotel_partner_workspace_foundation_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_partner_workspace_foundation_receipts),'id1',(select count(*) from public.hotel_partner_workspace_foundation_receipts where id=1))$sql$);
  perform pg_temp.capture_projector_predicate('A2','owner_receipt_count_id',
    'foundation_cardinality',$sql$(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)=1 and (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts),'id1',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts where id=1))$sql$);
  perform pg_temp.capture_projector_predicate('A2','task2_receipt_count_id',
    'foundation_cardinality',$sql$(select count(*) from public.hotel_partner_property_proposal_foundation_receipts)=1 and (select count(*) from public.hotel_partner_property_proposal_foundation_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_partner_property_proposal_foundation_receipts),'id1',(select count(*) from public.hotel_partner_property_proposal_foundation_receipts where id=1))$sql$);
  perform pg_temp.capture_projector_predicate('A2','external_foundation_count_id',
    'foundation_cardinality',$sql$(select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)=1 and (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts),'id1',(select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1))$sql$);
  perform pg_temp.capture_projector_predicate('A2','stage2f_receipt_count_id',
    'foundation_cardinality',$sql$(select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)=1 and (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts),'id1',(select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1))$sql$);

  perform pg_temp.capture_projector_predicate('A3','property_canonical_attribution',
    'lower_layer_validator',$sql$public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() is true$sql$);
  perform pg_temp.capture_projector_predicate('A3','workspace_function_lineage',
    'lower_layer_validator',$sql$public.hotel_v2_partner_workspace_function_lineage_is_exact() is true$sql$);

  perform pg_temp.capture_projector_predicate('A4','original_receipt_self_hash',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1 and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))$sql$);
  perform pg_temp.capture_projector_predicate('A4','owner_identity_links',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt join public.hotel_admin_availability_foundation_receipts original on original.id=owner_receipt.original_foundation_receipt_id where owner_receipt.id=1 and owner_receipt.contract_version='hotels_v2_admin_d_foundation_evolution_v2' and owner_receipt.original_protected_fingerprint=original.protected_fingerprint)$sql$);
  perform pg_temp.capture_projector_predicate('A4','owner_four_self_hashes',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_evolution_receipts receipt where receipt.id=1 and receipt.before_current_protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.before_current_protected_fingerprints) and receipt.current_protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.current_protected_fingerprints) and receipt.stage2_before_current_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(receipt.stage2_before_current_protected_fingerprints) and receipt.stage2_current_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(receipt.stage2_current_protected_fingerprints))$sql$);
  perform pg_temp.capture_projector_predicate('A4','owner_allowed_key_arrays',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_evolution_receipts receipt where receipt.id=1 and receipt.allowed_fingerprint_keys=array['hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[] and receipt.stage2_allowed_fingerprint_keys=array['hotel_partner_hotel_permissions','non_external_calendar_activity','non_external_calendar_partner_receipts']::text[])$sql$);
  perform pg_temp.capture_projector_predicate('A4','owner_delta_scope',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_evolution_receipts receipt where receipt.id=1 and (receipt.current_protected_fingerprints-receipt.allowed_fingerprint_keys) is not distinct from (receipt.before_current_protected_fingerprints-receipt.allowed_fingerprint_keys) and (receipt.stage2_current_protected_fingerprints-receipt.stage2_allowed_fingerprint_keys) is not distinct from (receipt.stage2_before_current_protected_fingerprints-receipt.stage2_allowed_fingerprint_keys))$sql$);
  perform pg_temp.capture_projector_predicate('A4','owner_all_declared_keys_changed',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_admin_availability_foundation_evolution_receipts receipt where receipt.id=1 and not exists(select 1 from unnest(receipt.allowed_fingerprint_keys) changed(key) where receipt.current_protected_fingerprints->changed.key is not distinct from receipt.before_current_protected_fingerprints->changed.key) and not exists(select 1 from unnest(receipt.stage2_allowed_fingerprint_keys) changed(key) where receipt.stage2_current_protected_fingerprints->changed.key is not distinct from receipt.stage2_before_current_protected_fingerprints->changed.key))$sql$);
  perform pg_temp.capture_projector_predicate('A4','task2_foundation_lineage',
    'owner_task2_lineage',$sql$exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts task2 cross join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt cross join public.hotel_partner_workspace_foundation_receipts partner_foundation where task2.id=1 and owner_receipt.id=1 and partner_foundation.id=1 and partner_foundation.protected_fingerprint=public.hotel_v2_h3_2b_hash(partner_foundation.protected_fingerprints) and task2.original_h3_2b_foundation_fingerprint=partner_foundation.protected_fingerprint and task2.owner_evolution_receipt_id=owner_receipt.id and task2.owner_evolution_receipt_fingerprint=public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(owner_receipt),'{created_at}',to_jsonb(extract(epoch from owner_receipt.created_at)),false)) and task2.protected_fingerprint=public.hotel_v2_h3_2b_hash(task2.protected_fingerprints))$sql$);
  perform pg_temp.capture_projector_predicate('A4','task2_stage2_helper_source_pin',
    'source_lineage',$sql$exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts task2 where task2.id=1 and task2.stage2_compatibility_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure))))$sql$);
  perform pg_temp.capture_projector_predicate('A4','task2_provider_helper_source_pin',
    'source_lineage',$sql$exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts task2 where task2.id=1 and task2.provider_source_attribution_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef('public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))$sql$);
  perform pg_temp.capture_projector_predicate('A4','external_foundation_self_hash',
    'owner_task2_lineage',$sql$exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt where receipt.id=1 and receipt.protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))$sql$);

  perform pg_temp.capture_projector_predicate('A5','stage2f_row_envelope',
    'stage2f_receipt',$sql$exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt where receipt.id=1 and receipt.created_at is not null and isfinite(receipt.created_at) and (receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$') is true and jsonb_typeof(receipt.compatibility_function_fingerprints)='object')$sql$);
  perform pg_temp.capture_projector_predicate('A5','stage2f_map_key_count',
    'stage2f_receipt',$sql$(select count(*) from jsonb_object_keys((select compatibility_function_fingerprints from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)))=20$sql$,
    $sql$jsonb_build_object('count',(select count(*) from jsonb_object_keys((select compatibility_function_fingerprints from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1))))$sql$);
  perform pg_temp.capture_projector_predicate('A5','stage2f_map_exact_keyset',
    'stage2f_receipt',$sql$(select compatibility_function_fingerprints ?& array['public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)','public.hotel_v2_partner_list_assigned_properties(uuid)','public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)','public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)','public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)','public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)','public.hotel_v2_admin_get_content_control(uuid)','public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)','public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)','public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)','public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)','public.hotel_v2_h3_2b_flags_off()','public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)','public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)','public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)','public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)','public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)','public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)']::text[] from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1)$sql$);
  perform pg_temp.capture_projector_predicate('A5','stage2f_map_all_values_hex',
    'stage2f_receipt',$sql$not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt cross join lateral jsonb_each_text(receipt.compatibility_function_fingerprints) fingerprint where receipt.id=1 and (fingerprint.value~'^[0-9a-f]{64}$') is not true)$sql$);
end
$projector_predicates$;

do $projector_catalog_predicates$
begin
  perform pg_temp.capture_projector_predicate('A6','stage2f_relation_owner_rls',
    'stage2f_catalog',$sql$exists(select 1 from pg_class relation where relation.oid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and relation.relowner='postgres'::regrole and not relation.relrowsecurity)$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_exact_four_columns',
    'stage2f_catalog',$sql$(select count(*) from pg_attribute attribute where attribute.attrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and attribute.attnum>0 and not attribute.attisdropped)=4 and not exists(select 1 from (values (1::smallint,'id','smallint',true,null::text),(2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),(3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),(4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')) expected(attnum,attname,type_name,not_null,default_expression) left join pg_attribute attribute on attribute.attrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and attribute.attnum=expected.attnum and not attribute.attisdropped left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid and default_row.adnum=attribute.attnum where attribute.attrelid is null or attribute.attname is distinct from expected.attname or format_type(attribute.atttypid,attribute.atttypmod) is distinct from expected.type_name or attribute.attnotnull is distinct from expected.not_null or attribute.attidentity is distinct from '' or attribute.attgenerated is distinct from '' or pg_get_expr(default_row.adbin,default_row.adrelid) is distinct from expected.default_expression)$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_exact_four_constraints',
    'stage2f_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)=4$sql$,
    $sql$jsonb_build_object('count',(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass))$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_primary_key',
    'stage2f_catalog',$sql$(select count(*) from pg_constraint constraint_row join pg_index index_row on index_row.indexrelid=constraint_row.conindid where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='p' and constraint_row.convalidated and constraint_row.conkey=array[1]::smallint[] and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)' and index_row.indisprimary and index_row.indisunique and index_row.indisvalid and index_row.indisready)=1$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_id_check',
    'stage2f_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[1]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(id=1)')=1$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_site_hash_check',
    'stage2f_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[2]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')=1$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_object_check',
    'stage2f_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[3]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_no_policies',
    'stage2f_security',$sql$not exists(select 1 from pg_policy policy where policy.polrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_immutable_trigger',
    'stage2f_security',$sql$(select count(*) from pg_trigger trigger_row where trigger_row.tgrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and not trigger_row.tgisinternal)=1 and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid='hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable' and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') and trigger_row.tgtype=27 and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_no_raw_acl',
    'stage2f_security',$sql$not exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name) where has_table_privilege(0::oid,'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,privilege.name) or has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,privilege.name) or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,privilege.name) or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,privilege.name))$sql$);
  perform pg_temp.capture_projector_predicate('A6','private_schema_owner_acl',
    'stage2f_security',$sql$exists(select 1 from pg_namespace namespace_row where namespace_row.oid='hotels_v2_private'::regnamespace and namespace_row.nspowner='postgres'::regrole) and not has_schema_privilege(0::oid,'hotels_v2_private','USAGE') and not has_schema_privilege('anon','hotels_v2_private','USAGE') and not has_schema_privilege('service_role','hotels_v2_private','USAGE') and not has_schema_privilege(0::oid,'hotels_v2_private','CREATE') and not has_schema_privilege('anon','hotels_v2_private','CREATE') and not has_schema_privilege('authenticated','hotels_v2_private','CREATE') and not has_schema_privilege('service_role','hotels_v2_private','CREATE')$sql$);
  perform pg_temp.capture_projector_predicate('A6','stage2f_function_matrix',
    'stage2f_function_security',$sql$not exists(select 1 from (values ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,'i'::"char",array['search_path=pg_catalog']::text[],'d60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,'s'::"char",array['search_path=pg_catalog, public']::text[],'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,'s'::"char",array['search_path=pg_catalog, public']::text[],'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),('public.hotel_v2_h3_2a_reject_immutable_change()',false,'v'::"char",array['search_path=pg_catalog, public']::text[],'5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')) expected(signature,security_definer,volatility,path,source_hash) left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature) where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole or procedure_row.prosecdef is distinct from expected.security_definer or procedure_row.provolatile is distinct from expected.volatility or procedure_row.proconfig is distinct from expected.path or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex') is distinct from expected.source_hash or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE') or has_function_privilege('anon',procedure_row.oid,'EXECUTE') or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE') or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))$sql$);

  perform pg_temp.capture_projector_predicate('B1','canonical_receipt_count_zero',
    'canonical_receipt_bootstrap',$sql$(select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts)=0$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_seven_arches_task2_stage2_compatibility_receipts))$sql$);
  perform pg_temp.capture_projector_predicate('B2','canonical_receipt_relation_owner_rls',
    'canonical_receipt_catalog',$sql$exists(select 1 from pg_class relation where relation.oid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and relation.relowner='postgres'::regrole and relation.relrowsecurity)$sql$);
  perform pg_temp.capture_projector_predicate('B3','canonical_receipt_exact_nine_columns',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_attribute attribute where attribute.attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attribute.attnum>0 and not attribute.attisdropped)=9 and not exists(select 1 from (values (1::smallint,'id','smallint',true,null::text),(2::smallint,'contract_version','text',true,null::text),(3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),(4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),(5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),(6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),(7::smallint,'canonical_snapshot_source_hash','text',true,null::text),(8::smallint,'validator_source_hash','text',true,null::text),(9::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')) expected(attnum,attname,type_name,not_null,default_expression) left join pg_attribute attribute on attribute.attrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and attribute.attnum=expected.attnum and not attribute.attisdropped left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid and default_row.adnum=attribute.attnum where attribute.attrelid is null or attribute.attname is distinct from expected.attname or format_type(attribute.atttypid,attribute.atttypmod) is distinct from expected.type_name or attribute.attnotnull is distinct from expected.not_null or attribute.attidentity is distinct from '' or attribute.attgenerated is distinct from '' or pg_get_expr(default_row.adbin,default_row.adrelid) is distinct from expected.default_expression)$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_constraint_count',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=9$sql$,
    $sql$jsonb_build_object('count',(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass))$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_primary_key',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row join pg_index index_row on index_row.indexrelid=constraint_row.conindid where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='p' and constraint_row.convalidated and constraint_row.conkey=array[1]::smallint[] and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)' and index_row.indisprimary and index_row.indisunique and index_row.indisvalid and index_row.indisready)=1$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_id_check',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[1]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(id=1)')=1$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_contract_check',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[2]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(contract_version=''hotels_v2_seven_arches_task2_stage2_compatibility_v1''::text)')=1$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_task2_object_check',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[3]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(canonical_task2_protected_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_stage2_object_check',
    'canonical_receipt_catalog',$sql$(select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[5]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='(jsonb_typeof(canonical_stage2_protected_fingerprints)=''object''::text)')=1$sql$);
  perform pg_temp.capture_projector_predicate('B4','canonical_receipt_four_hash_checks',
    'canonical_receipt_catalog',$sql$not exists(select 1 from (values (4::smallint,'canonical_task2_protected_fingerprint'),(6::smallint,'canonical_stage2_protected_fingerprint'),(7::smallint,'canonical_snapshot_source_hash'),(8::smallint,'validator_source_hash')) expected(attnum,column_name) where (select count(*) from pg_constraint constraint_row where constraint_row.conrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and constraint_row.contype='c' and constraint_row.convalidated and not constraint_row.connoinherit and constraint_row.conkey=array[expected.attnum]::smallint[] and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),'[[:space:]]+','','g')='('||expected.column_name||'~''^[0-9a-f]{64}$''::text)')<>1)$sql$);
  perform pg_temp.capture_projector_predicate('B5','canonical_receipt_immutable_trigger',
    'canonical_receipt_security',$sql$(select count(*) from pg_trigger trigger_row where trigger_row.tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and not trigger_row.tgisinternal)=1 and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass and trigger_row.tgname='hotel_seven_arches_task2_stage2_compatibility_receipt_immutable' and trigger_row.tgfoid=to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()') and trigger_row.tgtype=27 and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)$sql$);
  perform pg_temp.capture_projector_predicate('B6','canonical_receipt_no_policies',
    'canonical_receipt_security',$sql$not exists(select 1 from pg_policy policy where policy.polrelid='public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)$sql$);
  perform pg_temp.capture_projector_predicate('B7','canonical_receipt_no_raw_acl',
    'canonical_receipt_security',$sql$not exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name) where has_table_privilege(0::oid,'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('anon','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('authenticated','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name) or has_table_privilege('service_role','public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,privilege.name))$sql$);
end
$projector_catalog_predicates$;

insert into projector_diagnostic_results(section,predicate,classification,status,details)
select 'B3','canonical_receipt_attribute_catalog','catalog_details','INFO',
  jsonb_agg(jsonb_build_object(
    'attnum',attribute.attnum,'name',attribute.attname,
    'type',format_type(attribute.atttypid,attribute.atttypmod),
    'not_null',attribute.attnotnull,'identity',attribute.attidentity,
    'generated',attribute.attgenerated,
    'default',pg_get_expr(default_row.adbin,default_row.adrelid)) order by attribute.attnum)
from pg_attribute attribute
left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
  and default_row.adnum=attribute.attnum
where attribute.attrelid=
  'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
  and attribute.attnum>0 and not attribute.attisdropped;

insert into projector_diagnostic_results(section,predicate,classification,status,details)
select 'B4','canonical_receipt_constraint_catalog','catalog_details','INFO',
  jsonb_agg(jsonb_build_object(
    'name',constraint_row.conname,'type',constraint_row.contype,
    'keys',constraint_row.conkey,'validated',constraint_row.convalidated,
    'no_inherit',constraint_row.connoinherit,
    'expression',case when constraint_row.contype='c' then
      pg_get_expr(constraint_row.conbin,constraint_row.conrelid) end,
    'definition',pg_get_constraintdef(constraint_row.oid)) order by constraint_row.conname)
from pg_constraint constraint_row where constraint_row.conrelid=
  'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass;

insert into projector_diagnostic_results(section,predicate,classification,status,details)
select 'B5','canonical_receipt_trigger_catalog','catalog_details','INFO',
  coalesce(jsonb_agg(jsonb_build_object(
    'name',trigger_row.tgname,'function',trigger_row.tgfoid::regprocedure::text,
    'type',trigger_row.tgtype,'enabled',trigger_row.tgenabled)
    order by trigger_row.tgname),'[]'::jsonb)
from pg_trigger trigger_row where trigger_row.tgrelid=
  'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
  and not trigger_row.tgisinternal;

-- Reconstruct the projector's three values without any of its fail-closed
-- guards. These helpers deliberately propagate errors to the diagnostic
-- capture wrapper instead of copying the production exception handler.
create function pg_temp.projector_lifecycle()
returns jsonb language sql stable set search_path=pg_catalog
as $function$
  select jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false)
$function$;

create function pg_temp.projector_lifecycle_fingerprint()
returns text language sql stable set search_path=pg_catalog,public,pg_temp
as $function$
  select public.hotel_v2_external_calendar_worker_hash(
    pg_temp.projector_lifecycle())
$function$;

create function pg_temp.projector_task2_reconstruction()
returns jsonb language sql stable set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_set(
    public.hotel_v2_h3_2b_protected_fingerprints()||jsonb_build_object(
      'hotels',md5(pg_catalog.query_to_xml($query$
        select case when hotel.id=
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
          (to_jsonb(hotel)-array[
            'title','title_i18n','description','description_i18n','city',
            'address_line','district','postal_code','country','latitude',
            'longitude','google_maps_url','amenities','check_in_from',
            'check_out_until','cover_image_url','photos','updated_at'])::text
          else to_jsonb(hotel)::text end
        from public.hotels hotel order by hotel.id$query$,true,true,'')::text),
      'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
        select to_jsonb(activity)::text
        from public.hotel_activity_log activity
        where activity.source is distinct from
            'hotels_v2_h3_2b_partner_workspace'
          and activity.source is distinct from
            'hotels_v2_h3_2b_property_proposal_admin_review'
          and not (activity.source='hotels_v2_admin_b_property_control'
            and exists(select 1
              from public.hotel_partner_property_proposal_admin_reviews review
              where review.action='accept'
                and review.consumed_correlation_id=activity.correlation_id))
        order by activity.id$query$,true,true,'')::text)),
    '{site_settings}',to_jsonb(pg_temp.projector_lifecycle_fingerprint()),false)
$function$;

create function pg_temp.projector_stage2_reconstruction()
returns jsonb language plpgsql stable set search_path=pg_catalog,public,pg_temp
as $function$
declare
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_task2_foundation
    public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_provider record;
  v_provider_prior jsonb;
  v_provider_count integer:=0;
  v_result jsonb;
begin
  select * into strict v_owner
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_task2_foundation
  from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  v_result:=jsonb_set(jsonb_set(jsonb_set(
    public.hotel_v2_external_calendar_protected_fingerprints(),'{hotels}',
      v_owner.stage2_current_protected_fingerprints->'hotels',false),
    '{site_settings}',to_jsonb(pg_temp.projector_lifecycle_fingerprint()),false),
    '{non_external_calendar_activity}',to_jsonb(md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text
      from public.hotel_activity_log activity
      where activity.source is distinct from
          'hotels_v2_external_calendar_control'
        and activity.source is distinct from
          'hotels_v2_h3_2b_partner_workspace'
        and activity.source is distinct from
          'hotels_v2_h3_2b_property_proposal_admin_review'
        and not (activity.source='hotels_v2_admin_b_property_control'
          and exists(select 1
            from public.hotel_partner_property_proposal_admin_reviews review
            where review.action='accept'
              and review.consumed_correlation_id=activity.correlation_id))
      order by activity.id$query$,true,true,'')::text)),false)
    ||jsonb_build_object('non_external_calendar_partner_receipts',md5(
      pg_catalog.query_to_xml($query$
        select to_jsonb(receipt)::text
        from public.hotel_partner_action_receipts receipt
        where receipt.action not in(
          'h3_2b_content','h3_2b_pricing','h3_2b_availability',
          'h3_2d_external_calendar')
        order by receipt.id$query$,true,true,'')::text));
  if to_regclass(
      'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')
      is not null then
    execute 'select count(*) from hotels_v2_private.'||
      'hotel_external_calendar_provider_evolution_receipts'
      into v_provider_count;
    if v_provider_count=1 then
      execute 'select * from hotels_v2_private.'||
        'hotel_external_calendar_provider_evolution_receipts where id=1'
        into strict v_provider;
      v_provider_prior:=v_provider.prior_compatible_fingerprints;
      v_result:=jsonb_set(v_result,'{non_ical_calendar_sources}',
        v_provider_prior->'non_ical_calendar_sources',false);
      -- Task2's provider-only normalization is reported separately because it
      -- belongs to the other returned map, not this Stage2 value.
    end if;
  end if;
  return v_result;
end
$function$;

create function pg_temp.projector_expected_task2()
returns jsonb language sql stable set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_set(receipt.protected_fingerprints,'{site_settings}',
    to_jsonb(pg_temp.projector_lifecycle_fingerprint()),false)
  from public.hotel_partner_property_proposal_foundation_receipts receipt
  where receipt.id=1
$function$;

create function pg_temp.projector_expected_stage2()
returns jsonb language sql stable set search_path=pg_catalog,public,pg_temp
as $function$
  select jsonb_set(receipt.stage2_current_protected_fingerprints,
    '{site_settings}',to_jsonb(pg_temp.projector_lifecycle_fingerprint()),false)
  from public.hotel_admin_availability_foundation_evolution_receipts receipt
  where receipt.id=1
$function$;

create function pg_temp.projector_provider_receipt_count()
returns integer language plpgsql stable set search_path=pg_catalog,public
as $function$
declare v_count integer;
begin
  if to_regclass(
      'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')
      is null then
    return -1;
  end if;
  execute 'select count(*) from hotels_v2_private.'||
    'hotel_external_calendar_provider_evolution_receipts' into v_count;
  return v_count;
end
$function$;

create function pg_temp.projector_map_diff(p_actual jsonb,p_expected jsonb)
returns jsonb language sql stable set search_path=pg_catalog,public
as $function$
  with keys as (
    select key from jsonb_object_keys(coalesce(p_actual,'{}'::jsonb)) key
    union
    select key from jsonb_object_keys(coalesce(p_expected,'{}'::jsonb)) key
  ), differing as (
    select key from keys
    where p_actual->key is distinct from p_expected->key
  )
  select jsonb_build_object(
    'actual_hash',public.hotel_v2_external_calendar_worker_hash(p_actual),
    'expected_hash',public.hotel_v2_external_calendar_worker_hash(p_expected),
    'actual_key_count',(select count(*)
      from jsonb_object_keys(coalesce(p_actual,'{}'::jsonb))),
    'expected_key_count',(select count(*)
      from jsonb_object_keys(coalesce(p_expected,'{}'::jsonb))),
    'differing_keys',coalesce((select jsonb_agg(jsonb_build_object(
      'key',key,
      'actual_type',jsonb_typeof(p_actual->key),
      'expected_type',jsonb_typeof(p_expected->key),
      'actual_member_hash',public.hotel_v2_external_calendar_worker_hash(
        coalesce(p_actual->key,'null'::jsonb)),
      'expected_member_hash',public.hotel_v2_external_calendar_worker_hash(
        coalesce(p_expected->key,'null'::jsonb))) order by key)
      from differing),'[]'::jsonb))
$function$;

do $projector_direct_exception_probes$
begin
  perform pg_temp.capture_projector_statement('X1','strict_original_receipt_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from public.hotel_admin_availability_foundation_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X1','strict_partner_workspace_receipt_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from public.hotel_partner_workspace_foundation_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X1','strict_owner_receipt_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from public.hotel_admin_availability_foundation_evolution_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X1','strict_task2_foundation_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from public.hotel_partner_property_proposal_foundation_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X1','strict_external_foundation_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from hotels_v2_private.hotel_external_calendar_foundation_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X1','strict_stage2f_activation_id1',
    'unswallowed_strict_select',$sql$select jsonb_build_object('id',id) from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1$sql$);
  perform pg_temp.capture_projector_statement('X2','raw_task2_call',
    'unswallowed_raw_call',$sql$select jsonb_build_object('type',jsonb_typeof(public.hotel_v2_h3_2b_protected_fingerprints()),'site_key',public.hotel_v2_h3_2b_protected_fingerprints()->'site_settings' is not null) $sql$);
  perform pg_temp.capture_projector_statement('X2','raw_stage2_call',
    'unswallowed_raw_call',$sql$select jsonb_build_object('type',jsonb_typeof(public.hotel_v2_external_calendar_protected_fingerprints()),'site_key',public.hotel_v2_external_calendar_protected_fingerprints()->'site_settings' is not null)$sql$);
  perform pg_temp.capture_projector_statement('X3','task2_hotels_query_to_xml',
    'unswallowed_reconstruction',$sql$select jsonb_build_object('hash',md5(pg_catalog.query_to_xml('select case when hotel.id=''9b6d99a0-923a-4fbc-be54-c066e856e6ca''::uuid then (to_jsonb(hotel)-array[''title'',''title_i18n'',''description'',''description_i18n'',''city'',''address_line'',''district'',''postal_code'',''country'',''latitude'',''longitude'',''google_maps_url'',''amenities'',''check_in_from'',''check_out_until'',''cover_image_url'',''photos'',''updated_at''])::text else to_jsonb(hotel)::text end from public.hotels hotel order by hotel.id',true,true,'')::text))$sql$);
  perform pg_temp.capture_projector_statement('X3','task2_activity_query_to_xml',
    'unswallowed_reconstruction',$sql$select jsonb_build_object('hash',(pg_temp.projector_task2_reconstruction()->>'non_h3_2b_activity'))$sql$);
  perform pg_temp.capture_projector_statement('X3','stage2_activity_query_to_xml',
    'unswallowed_reconstruction',$sql$select jsonb_build_object('hash',(pg_temp.projector_stage2_reconstruction()->>'non_external_calendar_activity'))$sql$);
  perform pg_temp.capture_projector_statement('X3','stage2_partner_receipts_query_to_xml',
    'unswallowed_reconstruction',$sql$select jsonb_build_object('hash',(pg_temp.projector_stage2_reconstruction()->>'non_external_calendar_partner_receipts'))$sql$);
end
$projector_direct_exception_probes$;

do $projector_value_predicates$
begin
  perform pg_temp.capture_projector_predicate('A7','lifecycle_exact_v2',
    'canonical_lifecycle',$sql$pg_temp.projector_lifecycle()=jsonb_build_object('contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2','id',1,'hotel_rooms_v2_enabled',false,'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),'hotel_instant_booking_enabled',false,'hotel_stripe_connect_enabled',false)$sql$,
    $sql$jsonb_build_object('lifecycle',pg_temp.projector_lifecycle())$sql$);
  perform pg_temp.capture_projector_predicate('A7','lifecycle_hash_nonnull',
    'canonical_lifecycle',$sql$pg_temp.projector_lifecycle_fingerprint() is not null$sql$,
    $sql$jsonb_build_object('fingerprint',pg_temp.projector_lifecycle_fingerprint())$sql$);
  perform pg_temp.capture_projector_predicate('A7','fixture_external_matches',
    'fixture_control',$sql$(select hotel_external_sync_enabled from public.site_settings where id=1)=current_setting('test.stage2f_expected_external')::boolean$sql$,
    $sql$jsonb_build_object('actual',(select hotel_external_sync_enabled from public.site_settings where id=1),'expected',current_setting('test.stage2f_expected_external')::boolean)$sql$);

  perform pg_temp.capture_projector_predicate('A8','raw_task2_nonnull_site_key',
    'raw_projection',$sql$public.hotel_v2_h3_2b_protected_fingerprints() is not null and public.hotel_v2_h3_2b_protected_fingerprints()->'site_settings' is not null$sql$);
  perform pg_temp.capture_projector_predicate('A8','raw_stage2_nonnull_site_key',
    'raw_projection',$sql$public.hotel_v2_external_calendar_protected_fingerprints() is not null and public.hotel_v2_external_calendar_protected_fingerprints()->'site_settings' is not null$sql$);

  perform pg_temp.capture_projector_predicate('A9','canonical_task2_matches_foundation',
    'canonical_map_comparison',$sql$pg_temp.projector_task2_reconstruction() is not distinct from pg_temp.projector_expected_task2()$sql$,
    $sql$pg_temp.projector_map_diff(pg_temp.projector_task2_reconstruction(),pg_temp.projector_expected_task2())$sql$);
  perform pg_temp.capture_projector_predicate('A9','canonical_stage2_matches_owner',
    'canonical_map_comparison',$sql$pg_temp.projector_stage2_reconstruction() is not distinct from pg_temp.projector_expected_stage2()$sql$,
    $sql$pg_temp.projector_map_diff(pg_temp.projector_stage2_reconstruction(),pg_temp.projector_expected_stage2())$sql$);

  perform pg_temp.capture_projector_predicate('A10','provider_relation_branch_supported',
    'provider_branch',$sql$pg_temp.projector_provider_receipt_count() between -1 and 1$sql$,
    $sql$jsonb_build_object('relation',to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts')::text,'count',pg_temp.projector_provider_receipt_count(),'branch',case pg_temp.projector_provider_receipt_count() when -1 then 'relation_absent' when 0 then 'count_zero' when 1 then 'count_one' else 'count_gt_one' end)$sql$);
  perform pg_temp.capture_projector_predicate('A10','provider_helper_oid_source_pin',
    'provider_branch',$sql$to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is not null and exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt where receipt.id=1 and receipt.provider_source_attribution_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef('public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))$sql$);

  perform pg_temp.capture_projector_predicate('A11','pricing_receipt_count_supported',
    'pricing_branch',$sql$(select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<=1$sql$,
    $sql$jsonb_build_object('count',(select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts))$sql$);
  perform pg_temp.capture_projector_predicate('A11','pricing_receipt_count_zero',
    'pricing_branch',$sql$(select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0$sql$);

  perform pg_temp.capture_projector_predicate('Z1','projector_returns_nonnull',
    'production_outcome',$sql$public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is not null$sql$,
    $sql$jsonb_build_object('type',jsonb_typeof(public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()),'contract_version',public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()->>'contract_version','task2_hash',public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()->>'task2_protected_fingerprint','stage2_hash',public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()->>'stage2_protected_fingerprint')$sql$);
end
$projector_value_predicates$;

-- Emit each mismatching map member independently without printing the full
-- protected maps.
with maps as (
  select 'task2'::text map_name,
    pg_temp.projector_task2_reconstruction() actual,
    pg_temp.projector_expected_task2() expected
  union all
  select 'stage2',pg_temp.projector_stage2_reconstruction(),
    pg_temp.projector_expected_stage2()
), keys as (
  select maps.map_name,maps.actual,maps.expected,key
  from maps cross join lateral (
    select key from jsonb_object_keys(coalesce(maps.actual,'{}'::jsonb)) key
    union
    select key from jsonb_object_keys(coalesce(maps.expected,'{}'::jsonb)) key
  ) all_keys
)
insert into projector_diagnostic_results(
  section,predicate,classification,value,status,details)
select 'A9',map_name||'_key:'||key,'map_key_diff',false,'FAIL',
  jsonb_build_object(
    'actual_type',jsonb_typeof(actual->key),
    'expected_type',jsonb_typeof(expected->key),
    'actual_member_hash',public.hotel_v2_external_calendar_worker_hash(
      coalesce(actual->key,'null'::jsonb)),
    'expected_member_hash',public.hotel_v2_external_calendar_worker_hash(
      coalesce(expected->key,'null'::jsonb)))
from keys where actual->key is distinct from expected->key;

insert into projector_diagnostic_results(
  section,predicate,classification,status,details)
select 'A10','provider_count_one_predicates','provider_branch','SKIP',
  jsonb_build_object('reason','count-one branch is not evaluated at this lifecycle state')
where to_regclass(
  'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is null
   or pg_temp.projector_provider_receipt_count()=0;

insert into projector_diagnostic_results(
  section,predicate,classification,status,details)
values('C','canonical_receipt_count_one_branch','not_evaluated','SKIP',
  jsonb_build_object('reason','bootstrap diagnostic requires receipt count zero'));

select section,predicate,classification,value,status,details,sqlstate,error
from projector_diagnostic_results
where status in('FAIL','EXCEPTION') order by ordinal;

select section,predicate,classification,value,status,details,sqlstate,error
from projector_diagnostic_results order by ordinal;

select jsonb_build_object(
  'fixture_external',current_setting('test.stage2f_expected_external')::boolean,
  'pass_count',count(*) filter(where status='PASS'),
  'fail_count',count(*) filter(where status='FAIL'),
  'exception_count',count(*) filter(where status='EXCEPTION'),
  'info_count',count(*) filter(where status='INFO'),
  'skip_count',count(*) filter(where status='SKIP'))
  as projector_diagnostic_summary
from projector_diagnostic_results;

select 'HOTELS_V2_7A_STAGE2F_PROJECTOR_DIAGNOSTIC_COMPLETE' as sentinel,
  current_setting('test.stage2f_expected_external')::boolean as fixture_external;

rollback;
\! rm -f /tmp/hotels-v2-114400-projector-prefix.sql
