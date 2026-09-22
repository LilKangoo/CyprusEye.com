// LOCAL ONLY. Exact runtime bodies and real membership/permissions/pricing/
// availability. Two explicit certificate-boundary doubles model the already
// certified 114489 receipt and frozen lifecycle executor, not their internals.
// Full exact migration installation is separately certified by production ROLLBACK.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {functions,migration} from './hotels-v2-114492-contract.mjs';
const container='hotels-114489-114487-fixture', db='hotels_114492_disposable',source='hotels_114489_test';
const partner='0a321bfe-da6b-43f6-8e0b-7c68546a8b18',hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const owner='10000000-0000-4000-8000-000000000002',staff='10000000-0000-4000-8000-000000000004';
const assignment='32000000-0000-4000-8000-000000000001';
const rpc='public.hotel_v2_partner_get_workspace_114492';
const run=(s,d=db)=>spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-h','127.0.0.1','-p','55510','-d',d],{input:s,encoding:'utf8',maxBuffer:32e6});
const sql=(s,d=db)=>{const r=run(s,d);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const claims=id=>`SET LOCAL request.jwt.claims='${JSON.stringify({sub:id,role:'authenticated'})}';SET LOCAL ROLE authenticated;`;
const select=(p=partner,h=hotel,from="'2026-09-22'",to="'2026-09-23'")=>`SELECT ${rpc}('${p}','${h}',${from},${to});`;
const read=(id=owner,prefix='')=>JSON.parse(sql('BEGIN;'+prefix+claims(id)+select()+'ROLLBACK;'));
let n=0;const pass=name=>{n++;console.log('PASS '+name);};
const fail=(name,q,re)=>{const r=run('BEGIN;'+q+'ROLLBACK;');assert.notEqual(r.status,0,name);assert.match(r.stderr,re,name);pass(name);};
assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${db}'`,'postgres'),'0');
const sourceBefore=sql('SELECT hotels_stripe_dto_private.business_hash()',source);
sql(`CREATE DATABASE ${db} TEMPLATE ${source}`,'postgres');
try {
 assert.match(sql('SELECT version()'),/^PostgreSQL 16\./);
 const old=sql("SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure");
 // Synthetic identity mapping only in this disposable clone; never the source.
 sql(`SET session_replication_role=replica;
 UPDATE public.partners SET id='${partner}' WHERE id='20000000-0000-4000-8000-000000000001';
 UPDATE public.partner_users SET partner_id='${partner}' WHERE partner_id='20000000-0000-4000-8000-000000000001';
 UPDATE public.partner_resources SET partner_id='${partner}' WHERE partner_id='20000000-0000-4000-8000-000000000001';
 UPDATE public.hotel_partner_hotel_permissions SET partner_id='${partner}' WHERE partner_id='20000000-0000-4000-8000-000000000001';
 UPDATE public.hotels SET owner_partner_id='${partner}' WHERE id='${hotel}';
 SET session_replication_role=origin;
 CREATE SCHEMA hotels_post_114489_private AUTHORIZATION postgres;
 CREATE SCHEMA r5k_catalog_proof AUTHORIZATION postgres;
 CREATE SCHEMA IF NOT EXISTS hotels_published_architecture_private AUTHORIZATION postgres;
 CREATE OR REPLACE FUNCTION hotels_published_architecture_private.assert_receipt_exact() RETURNS void LANGUAGE plpgsql STABLE AS $$BEGIN RETURN; END$$;
 CREATE FUNCTION r5k_catalog_proof.executor_63e67309c0eb62b8fdb1() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('version',6,'state',hotels_lifecycle_private.actual_flags()||'{"public_booking_enabled":false}'::jsonb) $$;
 CREATE FUNCTION hotels_lifecycle_private.fixture_114492_marker() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
 INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811448900'),('20260811449000'),('20260811449100');`);
 const m490=readFileSync('supabase/migrations/20260811449000_hotels_v2_post_conversion_admin_successors.sql','utf8');
 for(const name of ['hotels_post_114489_private.safe_state_114490','hotels_post_114489_private.predecessor_flag_exact_114490',
 'public.hotel_v2_admin_c_pricing_control_snapshot_114490','public.hotel_v2_admin_d_snapshot_external_base_114490','public.hotel_v2_admin_d_snapshot_114490']){
  const at=m490.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');assert.ok(at>=0);const end=m490.indexOf('$function$;',m490.indexOf('AS $function$',at));assert.ok(end>at);
  sql(m490.slice(at,end+'$function$;'.length));
 }
 // Explicitly deny raw access to internal read snapshots, as on production.
 sql(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hotels_post_114489_private FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid),public.hotel_v2_admin_d_snapshot_114490(uuid,date,date,boolean),public.hotel_v2_admin_d_snapshot_external_base_114490(uuid,date,date,boolean) FROM PUBLIC,anon,authenticated,service_role;`);
 fail('real historical workspace reproduces catalog_drift',claims(owner)+`SELECT public.hotel_v2_partner_get_workspace('${partner}','${hotel}','2026-09-22','2026-09-23');`,/hotels_lifecycle_catalog_drift/);
 fail('exact migration fails closed on non-certified fixture pins',migration.replace(/^([\s\S]*?)BEGIN;/,'').replace(/COMMIT;\s*$/,''),/hotels_114492_predecessor_drift/);
 const historicalCatalogSql=`SELECT encode(sha256(convert_to(jsonb_agg(jsonb_build_array(p.oid,p.prosrc,p.proconfig,p.proacl,p.proowner,p.prosecdef,p.provolatile) ORDER BY p.oid)::text,'UTF8')),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','hotels_partner_workspace_114492_private') AND p.proname<>'hotel_v2_partner_get_workspace_114492'`;
 const historicalCatalogBefore=sql(historicalCatalogSql);
 const runtime=migration.slice(migration.indexOf('CREATE SCHEMA hotels_partner_workspace_114492_private'),migration.indexOf('DO $post$'));
 sql(runtime);pass('exact candidate runtime DDL compiles on PostgreSQL 16');
 const before=sql('SELECT hotels_stripe_dto_private.business_hash()');
 const dto=read();
 // Optional generated synthetic browser fixture; never a production response.
 if(process.env.HOTELS_114492_DTO_OUTPUT) {
  const browserDto=JSON.parse(sql('BEGIN;'+claims(owner)+select(partner,hotel,"'2026-09-22'","'2026-10-22'")+'ROLLBACK;'));
  writeFileSync(process.env.HOTELS_114492_DTO_OUTPUT,JSON.stringify(browserDto,null,2)+'\n');
 }
 assert.equal(dto.contract_version,'hotels_v2_h3_2b_partner_workspace_114492_v1');assert.equal(dto.hotel_id,hotel);
 assert.equal(dto.partner.id,partner);assert.equal(dto.partner.role,'owner');assert.equal(dto.property.architecture_version,'rooms_v2');
 assert.equal(dto.property.is_published,true);assert.equal(dto.public_change,false);assert.equal(dto.legacy_authoritative,false);
 assert.ok(dto.pricing);assert.ok(dto.availability);assert.ok(dto.rooms.length);assert.ok(Array.isArray(dto.units));
 assert.equal(dto.capability_lifecycle.public_booking_enabled,false);pass('full owner workspace: published rooms_v2 pricing and availability');
 // Exercise the actual shipped successor validator, without schema/tag doubles.
 const context=vm.createContext({URL,TextEncoder,TextDecoder,structuredClone,console});
 vm.runInContext(readFileSync('admin/hotels-v2-workspace-core.js','utf8'),context);
 vm.runInContext(readFileSync('js/hotels-v2-partner-workspace-core.js','utf8'),context);
 context.HotelsV2PartnerWorkspaceCore.validateWorkspace114492(dto,{partnerId:partner,hotelId:hotel,from:'2026-09-22',to:'2026-09-23'});
 pass('complete real DTO passes shipped strict 114492 browser validator');
 const permission=JSON.parse(sql(`SELECT public.hotel_v2_h3_2a_permissions_snapshot('${assignment}')`));
 assert.equal(dto.assignment.permission_version,permission.version);assert.deepEqual(dto.assignment.capabilities,permission.capabilities);
 assert.equal(dto.assignment.access_snapshot_token,sql(`SELECT public.hotel_v2_h3_2b_hash(jsonb_build_object('assignment_id','${assignment}'::uuid,'role','owner','permission_version',${permission.version},'has_mutation_capability',${permission.has_mutation_capability},'capabilities','${JSON.stringify(permission.capabilities)}'::jsonb))`));
 pass('exact permission version, twelve capabilities and unchanged access-token contract');
 const staffDto=read(staff);assert.equal(staffDto.partner.role,'staff');assert.equal(staffDto.stripe_connection.onboarding_authorized,false);pass('exact scoped staff and owner-only Stripe boundary');
 for(const [name,id,p,h] of [['unauthorized','10000000-0000-4000-8000-000000000099',partner,hotel],['cross-partner',owner,'20000000-0000-4000-8000-000000000002',hotel],['cross-hotel',owner,partner,'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1']])fail(name+' denied',claims(id)+select(p,h),/42501|denied|target_required/);
 fail('staff without exact Hotel scope denied',`SET LOCAL session_replication_role=replica;DELETE FROM public.partner_user_resources WHERE resource_id='${hotel}';SET LOCAL session_replication_role=origin;`+claims(staff)+select(),/partner_access_denied/);
 for(const [from,to] of [["NULL","'2026-09-23'"],["'2026-09-23'","'2026-09-22'"],["'2026-09-22'","'2027-09-22'"]])fail('invalid date range',claims(owner)+select(partner,hotel,from,to),/invalid_workspace_range/);
 for(const column of ['manage_prices','manage_availability']){
  const d=read(owner,`SET LOCAL session_replication_role=replica;UPDATE public.hotel_partner_hotel_permissions SET ${column}=false WHERE assignment_id='${assignment}';SET LOCAL session_replication_role=origin;`);
  assert.equal(d[column==='manage_prices'?'pricing':'availability'],null);pass(column+' visibility fails closed');
 }
 for(const [column,value] of [['hotel_rooms_v2_enabled','false'],['hotel_external_sync_enabled','false'],['hotel_stripe_connect_enabled','false'],['hotel_instant_booking_enabled','true']])fail('unsafe lifecycle '+column,`SET LOCAL session_replication_role=replica;UPDATE public.site_settings SET ${column}=${value};SET LOCAL session_replication_role=origin;`+claims(owner)+select(),/lifecycle_drift/);
 for(const [column,value] of [['architecture_version',"'legacy'"],['is_published','false']])fail('wrong property '+column,`SET LOCAL session_replication_role=replica;UPDATE public.hotels SET ${column}=${value} WHERE id='${hotel}';SET LOCAL session_replication_role=origin;`+claims(owner)+select(),/converted_architecture_required/);
 fail('missing commission denied',`SET LOCAL session_replication_role=replica;UPDATE public.hotel_commission_policies SET is_active=false WHERE hotel_id='${hotel}';SET LOCAL session_replication_role=origin;`+claims(owner)+select(),/commission_policy_required/);
 fail('private helper not executable by browser',claims(owner)+`SELECT hotels_partner_workspace_114492_private.access_snapshot('${partner}','${hotel}',null);`,/permission denied/);
 fail('Admin internal read not granted to Partner',claims(owner)+`SELECT public.hotel_v2_admin_c_pricing_control_snapshot_114490('${hotel}');`,/permission denied/);
 const ro=JSON.parse(sql('BEGIN READ ONLY;'+claims(owner)+select()+'ROLLBACK;'));assert.ok(ro.pricing&&ro.availability);pass('full RPC runs inside READ ONLY');
 assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('all reads/negative probes leave business fingerprint unchanged');
 assert.equal(sql("SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure"),old);pass('historical entrypoint unchanged');
 assert.equal(sql(historicalCatalogSql),historicalCatalogBefore);pass('all pre-existing function sources/security unchanged');
 assert.equal(functions.length,4);console.log(`114492_LOCAL_POSTGRES=PASS checks=${n} CERTIFICATE_BOUNDARY_DOUBLES=2 FULL_HISTORICAL_INSTALL=PRODUCTION_ROLLBACK_GATE`);
} finally {
 assert.equal(sql(`SELECT count(*) FROM pg_stat_activity WHERE datname='${db}'`,'postgres'),'0');
 sql(`DROP DATABASE ${db}`,'postgres');
 assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()',source),sourceBefore);
 console.log('DISPOSABLE_REMOVED=YES SOURCE_FIXTURE_UNCHANGED=YES');
}
