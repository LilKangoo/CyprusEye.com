// Run ONLY against the real synthetic successor fixture through 114487.
// This gate deliberately rejects arbitrary hosts/databases and uses no secrets.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {compile,catalogQuery,hash,legacy,successor,schema,migrationPath} from './hotels-v2-114488-read-compiler.mjs';
const bin=process.env.HOTELS_114488_PSQL;
assert.ok(bin,'HOTELS_114488_PSQL required');
const port=process.env.HOTELS_114488_PORT||'55510';
assert.equal(port,'55510','Only this disposable fixture port is accepted');
const database='hotels_114487_pricing_probe';
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',database],{input:'\\set VERBOSITY verbose\n'+q,encoding:'utf8',maxBuffer:128e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),database+'|127.0.0.1|'+port);
assert.match(sql('SELECT version()'),/^PostgreSQL 16\./);
let count=0;const pass=label=>{count++;console.log('PASS '+label);};
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca',partner='20000000-0000-4000-8000-000000000001';
const claims=(id=2)=>`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000000${id}","role":"authenticated"}',true) IS NOT NULL;SET LOCAL ROLE authenticated;`;
const call=(name=successor,p=partner,h=hotel)=>`${name}('${p}','${h}')`;
const read=(q,id=2)=>sql(`BEGIN READ ONLY;${claims(id)}${q};ROLLBACK;`).split('\n').at(-1);
const migration=readFileSync(new URL('../../'+migrationPath,import.meta.url),'utf8');
const catalog=JSON.parse(sql(catalogQuery));
const compiled=compile(catalog);
assert.equal(migration,compiled.migration,'reproducible compiler pins exact current legacy graph');pass('deterministic migration equals exact live local predecessor compilation');
const business=()=>sql('BEGIN READ ONLY;SELECT hotels_stripe_dto_private.business_hash();ROLLBACK;');
const before=business();
const inventory=()=>sql(`BEGIN READ ONLY;SELECT jsonb_build_object('flags',hotels_lifecycle_private.safe_state(),
 'public_booking',hotels_lifecycle_private.public_booking_enabled(),
 'authorization',hotel_stripe_connect_private.authorization_state('${partner}'),
 'commission',public.hotel_v2_h3_2b_commission_policy('${hotel}'),
 'payment',public.hotel_v2_seven_arches_payment_policy_lineage_is_exact());ROLLBACK;`);
const initialInventory=inventory();
const oldFunctions=()=>sql(`SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl::text) ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND (n.nspname='public' OR n.nspname LIKE 'hotels%') AND n.nspname<>'${schema}'
 AND p.proname<>'${successor.split('.')[1]}'`);
const originalFunctions=oldFunctions();
const fail=(label,q,pattern)=>{const r=run('BEGIN;'+q+';ROLLBACK;');assert.notEqual(r.status,0,label);assert.match(r.stderr,pattern,label);assert.equal(business(),before,label+' containment');pass(label);};
const exists=sql(`SELECT to_regprocedure('${successor}(uuid,uuid)') IS NOT NULL`)==='t';
const installBody=migration.slice(migration.indexOf('DO $install$'),migration.lastIndexOf('COMMIT;'));
const removeNew=`DROP FUNCTION IF EXISTS ${successor}(uuid,uuid);DROP SCHEMA IF EXISTS ${schema} CASCADE;`;
// Local-only transactional fault injection. A failed psql connection rolls back
// all temporary DDL/data damage. Never send this gate to SQL Editor/production.
if(!exists){sql(migration);pass('114488 installs after exact114487');}
else{sql('BEGIN;'+removeNew+installBody+'ROLLBACK;');pass('114488 fresh installation replayed transactionally on exact114487');}
assert.equal(business(),before);assert.equal(inventory(),initialInventory);assert.equal(oldFunctions(),originalFunctions);pass('install preserves all old function bodies/ACL and complete business inventory');
fail('migration replay fails closed',installBody,/hotels_114488_boundary_mismatch/);
fail('missing114487 ledger rejected',removeNew+"DELETE FROM supabase_migrations.schema_migrations WHERE version='20260811448700';"+installBody,/hotels_114488_boundary_mismatch/);
fail('later ledger rejected',removeNew+"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811448900');"+installBody,/hotels_114488_boundary_mismatch/);
fail('preinstall old RPC ACL drift rejected',removeNew+`GRANT EXECUTE ON FUNCTION ${legacy}(uuid,uuid) TO anon;`+installBody,/hotels_114488_predecessor_drift/);
const root=catalog.find(p=>p.name===legacy);assert.equal(hash(root.src),'55e5ffc18a938051f6c819d873b66adcb8ad48f02dbd5854ebe8dc0b16642a4e');pass('legacy production prosrc exact');
const publicMeta=JSON.parse(sql(`SELECT ${schema}.metadata('${successor}(uuid,uuid)'::regprocedure)`));
assert.deepEqual(publicMeta.slice(2),['postgres','{authenticated=X/postgres,postgres=X/postgres}',['search_path=pg_catalog, public, auth'],'s',true,false,false,false,'plpgsql','p_partner_id uuid, p_hotel_id uuid','uuid, uuid','jsonb','u','f']);
assert.equal(publicMeta[0],hash(compiled.rpc.src));pass('successor exact owner/ACL/security/search_path/STABLE/source');
for(const role of ['anon','service_role'])fail(role+' denied',`SET LOCAL ROLE ${role};SELECT ${call()}`,/42501/);
fail('missing authenticated actor denied',`SET LOCAL ROLE authenticated;SELECT ${call()}`,/42501/);
fail('Admin without Partner membership denied',claims(1)+`SELECT ${call()}`,/42501/);
fail('foreign Partner denied',claims()+`SELECT ${call(successor,'20000000-0000-4000-8000-000000000999')}`,/42501/);
fail('wrong Hotel denied',claims()+`SELECT ${call(successor,partner,'90000000-0000-4000-8000-000000000999')}`,/55000/);
fail('NULL Hotel denied',claims()+`SELECT ${successor}('${partner}',NULL)`,/55000/);
fail('private cache-context injection denied',claims()+`SELECT ${compiled.clones[0].name}('{}'::jsonb)`,/42501/);
assert.equal(read(`SELECT ${call(legacy)}=${call()}`),'t');pass('complete canonical JSON equality, including original workspace tokens; no normalization');
const dto=JSON.parse(read(`SELECT ${call()}`));
assert.equal(dto.current_items.length,54);
const roomCounts=Object.fromEntries(['upper','ground'].map(key=>[key,dto.current_items.filter(i=>i.room_key===key).length]));
assert.deepEqual(roomCounts,{upper:27,ground:27});
assert.deepEqual(dto.commission_policy,{commission_mode:'per_allocated_room_per_night',amount:10,currency:'EUR'});pass('54 reviewed positions Upper27 Ground27 EUR10 commission');
for(const [label,change]of [
 ['legacy ACL',`GRANT EXECUTE ON FUNCTION ${legacy}(uuid,uuid) TO anon`],
 ['legacy search_path',`ALTER FUNCTION ${legacy}(uuid,uuid) SET search_path=public`],
 ['legacy volatility',`ALTER FUNCTION ${legacy}(uuid,uuid) VOLATILE`],
 ['legacy security',`ALTER FUNCTION ${legacy}(uuid,uuid) SECURITY INVOKER`],
 ['read clone ACL',`GRANT EXECUTE ON FUNCTION ${compiled.clones[0].name}(${compiled.clones[0].types}) TO authenticated`],
 ['metadata ACL',`GRANT EXECUTE ON FUNCTION ${schema}.metadata(oid) TO anon`],
 ['guard security',`ALTER FUNCTION ${schema}.assert_exact() SECURITY INVOKER`],
 ['private schema ACL',`GRANT USAGE ON SCHEMA ${schema} TO authenticated`],
 ['successor ACL',`GRANT EXECUTE ON FUNCTION ${successor}(uuid,uuid) TO service_role`],
 ['successor search_path',`ALTER FUNCTION ${successor}(uuid,uuid) SET search_path=pg_catalog,public`],
])fail(label+' drift fails closed',change+';'+claims()+`SELECT ${call()}`,/hotels_114488_.*drift/);
for(const [label,change]of [
 ['unaudited flags',`UPDATE public.site_settings SET hotel_rooms_v2_enabled=false WHERE id=1`],
 ['pricing tier',`UPDATE public.hotel_pricing_schedule_occupancy_tiers SET nightly_rate=nightly_rate+1 WHERE id=(SELECT target_tier_id FROM public.hotel_seven_arches_independent_pricing_authority LIMIT 1)`],
 ['commission',`UPDATE public.hotel_commission_policies SET amount=11 WHERE hotel_id='${hotel}' AND is_active`],
]){
 const damage=`SET LOCAL session_replication_role=replica;${change};SET LOCAL session_replication_role=origin;${claims()}`;
 fail(label+' old read denies',damage+`SELECT ${call(legacy)}`,/55000|23514|P0001/);
 fail(label+' successor denies',damage+`SELECT ${call()}`,/55000|23514|P0001/);
}
// Track real PG function invocations (not additive/nested wall-time estimates).
const profile=name=>{
 sql('SELECT pg_stat_reset();');
 sql(`BEGIN READ ONLY;SET LOCAL track_functions='all';${claims()}SELECT ${call(name)} IS NOT NULL;ROLLBACK;`);
 return JSON.parse(sql("SELECT coalesce(jsonb_agg(jsonb_build_object('name',schemaname||'.'||funcname,'calls',calls)),'[]') FROM pg_stat_user_functions WHERE calls>0"));
};
const oldCounts=profile(legacy),newCounts=profile(successor),lookup=(rows,name)=>rows.find(r=>r.name===name)?.calls||0;
const counts=compiled.cached.map(p=>({helper:p.name,legacy:lookup(oldCounts,p.name),successor_original:lookup(newCounts,p.name),successor_factored:p.clone?lookup(newCounts,p.clone):null}));
for(const p of compiled.cached.filter(p=>p.clone))assert.equal(lookup(newCounts,p.clone),1,p.name+' clone exactly once');
assert.ok(lookup(newCounts,'hotels_lifecycle_private.catalog_snapshot')<lookup(oldCounts,'hotels_lifecycle_private.catalog_snapshot'));
pass('factored heavy helpers exactly once; opaque original workspace remains independently evaluated');
const times={legacy:[],successor:[]};
for(let i=0;i<5;i++)for(const key of i%2?['successor','legacy']:['legacy','successor']){
 const start=performance.now();read(`SELECT ${call(key==='legacy'?legacy:successor)} IS NOT NULL`);times[key].push(performance.now()-start);
}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const oldMedian=median(times.legacy),newMedian=median(times.successor);
assert.ok(newMedian<oldMedian*0.60,JSON.stringify({oldMedian,newMedian}));pass('interleaved five-run median successor <60% legacy');
const roleBefore=sql("SELECT coalesce(rolconfig::text,'NULL') FROM pg_roles WHERE rolname='authenticated'");
// Regression only: transactional per-function override on the disposable DB;
// it is rolled back and never emitted in the migration or applied globally.
assert.equal(sql(`BEGIN READ ONLY;SET LOCAL statement_timeout='8s';${claims()}SELECT ${call()} IS NOT NULL;ROLLBACK;`).split('\n').at(-1),'t');
// A pg_temp probe carries the function-local timeout without defeating the
// successor's exact proconfig drift pin. It exists only in this test transaction.
const timeoutProbe=JSON.parse(sql(`BEGIN;CREATE FUNCTION pg_temp.hotels_114488_timeout_probe(p uuid,h uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='8s'
 AS $probe$ BEGIN RETURN jsonb_build_object('timeout',current_setting('statement_timeout'),'dto',${successor}(p,h));END $probe$;
 SET LOCAL statement_timeout='8s';${claims()}SELECT pg_temp.hotels_114488_timeout_probe('${partner}','${hotel}');ROLLBACK;`).split('\n').at(-1));
assert.equal(timeoutProbe.timeout,'8s');assert.equal(timeoutProbe.dto.current_items.length,54);
assert.equal(sql("SELECT coalesce(rolconfig::text,'NULL') FROM pg_roles WHERE rolname='authenticated'"),roleBefore);pass('8s session and function-local regression; no global or persisted timeout change');
assert.equal(business(),before);assert.equal(inventory(),initialInventory);assert.equal(oldFunctions(),originalFunctions);pass('all reads and fault injections contained; business/payment/flags/Stripe/writers unchanged');
console.log('HELPER_COUNTS='+JSON.stringify(counts));
console.log('LATENCY='+JSON.stringify({runs:times,legacy_median_ms:oldMedian,successor_median_ms:newMedian,improvement_percent:100*(1-newMedian/oldMedian)}));
console.log('SUCCESSOR_PROSRC_SHA='+hash(compiled.rpc.src));
console.log('POSTGRES_TESTS='+count+'/'+count+' PASS');
