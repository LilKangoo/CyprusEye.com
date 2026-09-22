// LOCAL ONLY, fixed Docker fixture, no network/production credentials.
// Uses real membership/permission functions and the exact 114490 safe-state
// body. The frozen executor is a declared boundary double: full historical
// receipt certification belongs to the separate production rollback gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const container='hotels-114489-114487-fixture';
const db='hotels_114491_disposable';
const source='hotels_114489_test';
const migration=readFileSync('supabase/migrations/20260811449100_hotels_v2_post_conversion_partner_read_successor.sql','utf8');
const m490=readFileSync('supabase/migrations/20260811449000_hotels_v2_post_conversion_admin_successors.sql','utf8');
const successor='public.hotel_v2_partner_list_assigned_properties_114491';
const legacy='public.hotel_v2_partner_list_assigned_properties';
const partner='20000000-0000-4000-8000-000000000001';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const owner='10000000-0000-4000-8000-000000000002';
const staff='10000000-0000-4000-8000-000000000004';
const sha=s=>createHash('sha256').update(s).digest('hex');
const run=(query,database=db)=>spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-h','127.0.0.1','-p','55510','-d',database],{input:'\\set VERBOSITY verbose\n'+query,encoding:'utf8',maxBuffer:32e6});
const sql=(q,database=db)=>{const r=run(q,database);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const claims=id=>`SET LOCAL request.jwt.claims='${JSON.stringify({sub:id,role:'authenticated'})}';SET LOCAL ROLE authenticated;`;
const read=(id=owner,p=partner)=>JSON.parse(sql(`BEGIN READ ONLY;${claims(id)}SELECT ${successor}('${p}');ROLLBACK;`));
let count=0;const pass=label=>{count++;console.log('PASS '+label);};
const fail=(label,q,re)=>{const r=run('BEGIN;'+q+';ROLLBACK;');assert.notEqual(r.status,0,label);assert.match(r.stderr,re,label);pass(label);};
assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${db}'`,'postgres'),'0','Never replace an existing fixture');
sql(`CREATE DATABASE ${db} TEMPLATE ${source}`,'postgres');
try {
  assert.match(sql('SELECT version()'),/^PostgreSQL 16\./);
  const oldBefore=sql(`SELECT pg_get_functiondef('${legacy}(uuid)'::regprocedure)`);
  const historicalSrc=sql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${legacy}(uuid)'::regprocedure`);
  assert.equal(historicalSrc,'01a3987c9596801a9bdbb34df9bc2825d60daad2e83f0f7c0c8f5e7df82af6a3');
  const safe=m490.match(/CREATE OR REPLACE FUNCTION hotels_post_114489_private\.safe_state_114490\(\)[\s\S]*?\$function\$;/)[0];
  sql(`CREATE SCHEMA hotels_post_114489_private AUTHORIZATION postgres;
    REVOKE ALL ON SCHEMA hotels_post_114489_private FROM PUBLIC,anon,authenticated,service_role;
    CREATE SCHEMA r5k_catalog_proof AUTHORIZATION postgres;
    CREATE FUNCTION r5k_catalog_proof.executor_63e67309c0eb62b8fdb1() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT jsonb_build_object('version',6,'state',hotels_lifecycle_private.actual_flags()||'{"public_booking_enabled":false}'::jsonb)
    $$;
    ${safe}
    REVOKE ALL ON FUNCTION hotels_post_114489_private.safe_state_114490() FROM PUBLIC,anon,authenticated,service_role;
    INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20260811449000');
    -- Synthetic catalog evolution reproduces the obsolete live catalog leaf.
    CREATE FUNCTION hotels_lifecycle_private.fixture_successor_marker() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;`);
  fail('old RPC still reproduces catalog drift',claims(owner)+`SELECT ${legacy}('${partner}')`,/hotels_lifecycle_catalog_drift/);
  const before=sql('SELECT hotels_stripe_dto_private.business_hash()');
  sql(migration);pass('exact migration installs on pinned local read-contract boundary');
  assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('installation does not mutate business state');
  fail('replay is rejected',migration.replace(/^([\s\S]*?)BEGIN;/,'').replace(/COMMIT;\s*$/,''),/hotels_114491_boundary_mismatch/);
  const dto=read();
  assert.deepEqual(Object.keys(dto).sort(),['contract_version','partner','foundation_only','workspace_available','properties'].sort());
  assert.equal(dto.contract_version,'hotels_v2_h3_2a_partner_permissions_v1');
  assert.equal(dto.partner.id,partner);assert.equal(dto.partner.role,'owner');
  assert.equal(dto.foundation_only,true);assert.equal(dto.workspace_available,false);
  assert.ok(dto.properties.some(p=>p.hotel_id===hotel));
  const expectedOwner=JSON.parse(sql(`SELECT jsonb_agg(resource_id ORDER BY resource_id) FROM public.partner_resources WHERE partner_id='${partner}' AND resource_type='hotels'`));
  assert.deepEqual(dto.properties.map(p=>p.hotel_id).sort(),expectedOwner.sort());pass('owner discovers all and only exact Hotel assignments without stale lifecycle error');
  for(const p of dto.properties){
    assert.deepEqual(Object.keys(p).sort(),['assignment_id','hotel_id','slug','name_i18n','city','cover_image_url','foundation_status','workspace_available','permission'].sort());
    assert.deepEqual(p.permission,JSON.parse(sql(`SELECT public.hotel_v2_h3_2a_effective_partner_permissions('${p.assignment_id}','owner')`)));
  }pass('identical property envelope and real effective permission projection');
  const staffDto=read(staff);
  const expectedStaff=JSON.parse(sql(`SELECT jsonb_agg(a.resource_id ORDER BY a.resource_id) FROM public.partner_resources a WHERE a.partner_id='${partner}' AND a.resource_type='hotels' AND EXISTS(SELECT 1 FROM public.partner_user_resources s JOIN public.partner_users u ON u.id=s.partner_user_id WHERE u.user_id='${staff}' AND s.resource_type='hotels' AND s.resource_id=a.resource_id)`));
  assert.deepEqual(staffDto.properties.map(p=>p.hotel_id).sort(),expectedStaff.sort());
  for(const p of staffDto.properties){assert.equal(p.permission.capabilities.initiate_stripe_onboarding,false);assert.deepEqual(p.permission,JSON.parse(sql(`SELECT public.hotel_v2_h3_2a_effective_partner_permissions('${p.assignment_id}','staff')`)));}
  pass('staff exact scope and Stripe capability mask unchanged');
  for(const [label,id,p] of [
    ['no actor',null,partner],['unknown actor','ffffffff-ffff-4fff-8fff-ffffffffffff',partner],
    ['wrong Partner',owner,'20000000-0000-4000-8000-000000000003'],
    ['staff without exact scope','10000000-0000-4000-8000-000000000005',partner],
  ])fail(label,claims(id)+`SELECT ${successor}('${p}')`,/42501/);
  for(const role of ['anon','service_role'])fail(role+' EXECUTE denied',`SET LOCAL ROLE ${role};SELECT ${successor}('${partner}')`,/42501/);
  for(const [label,damage,re] of [
    ['inactive Partner',`UPDATE public.partners SET status='inactive' WHERE id='${partner}'`,/42501/],
    ['can_manage_hotels false',`UPDATE public.partners SET can_manage_hotels=false WHERE id='${partner}'`,/42501/],
    ['no assignments',`DELETE FROM public.partner_resources WHERE partner_id='${partner}'`,/42501/],
    ...['hotel_rooms_v2_enabled','hotel_external_sync_enabled','hotel_instant_booking_enabled','hotel_stripe_connect_enabled'].map(f=>['wrong '+f,`UPDATE public.site_settings SET ${f}=NOT ${f}`,/55000/]),
    ['no setting row','DELETE FROM public.site_settings',/hotels_lifecycle_flag_state_drift|55000|22023/],
  ])fail(label,`SET LOCAL session_replication_role=replica;${damage};SET LOCAL session_replication_role=origin;${claims(owner)}SELECT ${successor}('${partner}')`,re);
  const meta=JSON.parse(sql(`SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'definer',prosecdef,'volatility',provolatile,'config',proconfig,'acl',(SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantee),a.privilege_type,a.is_grantable) ORDER BY a.grantee) FROM aclexplode(p.proacl) a)) FROM pg_proc p WHERE oid='${successor}(uuid)'::regprocedure`));
  assert.equal(meta.owner,'postgres');assert.equal(meta.definer,true);assert.equal(meta.volatility,'s');assert.deepEqual(meta.config,['search_path=pg_catalog, public, auth, pg_temp']);assert.deepEqual(meta.acl.map(a=>a[0]).sort(),['authenticated','postgres']);pass('owner SECURITY DEFINER STABLE protected search_path exact two-role ACL');
  assert.equal(sql(`SELECT pg_get_functiondef('${legacy}(uuid)'::regprocedure)`),oldBefore);pass('historical RPC byte-identical');
  assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('all reads and failed probes contained');
  // Optional certificate CONTROL-FLOW test, not historical-chain proof.
  // These three historical assertion boundaries are explicit test doubles in
  // the disposable clone only. The candidate migration body is never changed.
  if(process.env.HOTELS_114491_CERTIFICATE){
    const file=process.env.HOTELS_114491_CERTIFICATE;
    assert.ok(file.startsWith('/private/tmp/')&&file.endsWith('.sql'));
    sql(`DROP FUNCTION ${successor}(uuid);
      CREATE OR REPLACE FUNCTION hotels_published_architecture_private.assert_receipt_exact() RETURNS void LANGUAGE plpgsql AS $$BEGIN RETURN; END$$;
      CREATE FUNCTION r5k_catalog_proof.payment_catalog_is_exact() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;
      CREATE FUNCTION hotels_post_114489_private.calendar_provider_lineage_bridge_114490() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT true$$;`);
    const localCertificate=readFileSync(file,'utf8')
      .replaceAll('0a321bfe-da6b-43f6-8e0b-7c68546a8b18',partner)
      .replaceAll('a082c085-a6ea-46fd-8548-c8d9c6ee2c34','32000000-0000-4000-8000-000000000001');
    const result=JSON.parse(sql(localCertificate));
    assert.equal(result.sentinel,'HOTELS_114491_ROLLBACK_CERT_OK');
    assert.equal(result.post_rollback_state_identical,true);
    assert.equal(sql(`SELECT to_regprocedure('${successor}(uuid)') IS NULL`),'t');
    assert.equal(sql(`SELECT pg_get_functiondef('${legacy}(uuid)'::regprocedure)`),oldBefore);
    pass('rollback package control flow: role probes, subtransaction rollback, outer rollback, catalog/business exact (historical boundaries doubled)');
  }
  console.log('MIGRATION_SHA='+sha(migration));console.log('LOCAL_POSTGRES_CONTRACT_TESTS='+count+'/'+count+' PASS');
  console.log('FULL_HISTORICAL_CHAIN_CERTIFICATION=PENDING_PRODUCTION_ROLLBACK');
} finally {
  sql(`DROP DATABASE ${db}`,'postgres');
  console.log('DISPOSABLE_DATABASE_REMOVED=YES');
}
