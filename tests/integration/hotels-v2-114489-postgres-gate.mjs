// Explicit local-only regression harness. Never starts/installs PostgreSQL.
// No environment => PENDING, not a fabricated skipped-test PASS.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {build,migrationPath} from './hotels-v2-114489-build.mjs';
import {catalogQuery} from './hotels-v2-114489-foundation-compiler.mjs';
const bin=process.env.HOTELS_114489_PSQL;
if(!bin){console.log('POSTGRES_RUNTIME_TESTS=PENDING_ENVIRONMENT');process.exit(0);}
assert.equal(process.env.HOTELS_114489_LOCAL_ONLY,'YES');
const port=process.env.HOTELS_114489_PORT||'55510';
assert.equal(port,'55510','Only isolated disposable Hotels 114489 port 55510 is accepted');
const database=process.env.HOTELS_114489_DATABASE||'hotels_114489_test';
assert.equal(database,'hotels_114489_test','Only disposable hotels_114489_test is accepted');
const execute=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',database],
 {input:q,encoding:'utf8',maxBuffer:128*1024*1024});
const sql=q=>{const r=execute(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),database+'|127.0.0.1|'+port);
assert.match(sql('SELECT version()'),/^PostgreSQL 16\./);
const catalog=JSON.parse(sql('BEGIN READ ONLY;'+catalogQuery+';ROLLBACK;'));
const compiled=build({catalog});assert.deepEqual(compiled.unresolved,[]);
const migration=readFileSync(new URL('../../'+migrationPath,import.meta.url),'utf8');
assert.equal(
 migration,
 compiled.migration,
 'repository 114489 artifact must equal exact live accepted-catalog build'
);
console.log('ARTIFACT_EQUALS_LIVE_CATALOG_BUILD=PASS');
const fullBefore=sql('SELECT hotels_stripe_dto_private.business_hash()');
sql(migration);
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),fullBefore,'installation never converts or mutates business state');
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const actor='10000000-0000-4000-8000-000000000001';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
const claims=`SELECT set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true);SET LOCAL ROLE authenticated;`;
const read=()=>JSON.parse(sql(`BEGIN READ ONLY;${claims}SELECT public.hotel_v2_admin_get_published_architecture_conversion_114489('${hotel}');ROLLBACK;`).split('\n').at(-1));
const protectedState=()=>sql("SELECT jsonb_build_object('business',hotels_stripe_dto_private.business_hash(),'receipts',(SELECT count(*) FROM hotels_published_architecture_private.conversion_receipt),'context',(SELECT count(*) FROM hotels_published_architecture_private.context))");
const ready=read();assert.equal(ready.status,'READY');const baseline=protectedState();
for(const [key,value] of [['hotel_id',actor],['actor_id',hotel],['from','rooms_v2'],['to','legacy'],['is_published',false],
 ['public_booking_enabled',true],['snapshot_hash','0'.repeat(64)],['signature','0'.repeat(64)],
 ['issued_at','2000-01-01T00:00:00Z'],['expires_at','2999-01-01T00:00:00Z'],['extra',true]]){
 const plan={...ready.plan,[key]:value};
 const r=execute(`BEGIN;${claims}SELECT public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(${literal(JSON.stringify(plan))}::jsonb,gen_random_uuid(),'CONVERT 7 KAMARES TO ROOMS_V2');ROLLBACK;`);
 assert.notEqual(r.status,0,'reject changed '+key);assert.equal(protectedState(),baseline,'rollback containment '+key);
}
// Real JavaScript normalization in the middle, not a DB-only jsonb handoff.
const plan=JSON.parse(JSON.stringify(ready.plan));
const request='10000000-0000-4000-8000-000000000489';
const apply=`public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(${literal(JSON.stringify(plan))}::jsonb,'${request}','CONVERT 7 KAMARES TO ROOMS_V2')`;
const result=JSON.parse(sql(`BEGIN;${claims}SELECT ${apply};COMMIT;`).split('\n').at(-1));
assert.equal(result.is_published,true);assert.equal(result.public_booking_enabled,false);assert.equal(result.architecture_version,'rooms_v2');
assert.equal(sql('SELECT count(*) FROM hotels_published_architecture_private.conversion_receipt'),'1');
assert.equal(sql('SELECT count(*) FROM hotels_published_architecture_private.context'),'0');
assert.equal(sql('SELECT public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'),'t');
const after=protectedState();
const replay=JSON.parse(sql(`BEGIN;${claims}SELECT ${apply};COMMIT;`).split('\n').at(-1));
assert.equal(replay.replayed,true);assert.equal(protectedState(),after,'idempotent reconciliation writes nothing');
assert.equal(read().status,'ALREADY_CONVERTED');
assert.equal(sql(`SELECT count(*) FROM public.hotel_pricing_schedule_occupancy_tiers t JOIN public.hotel_room_rates r ON r.pricing_schedule_id=t.schedule_id WHERE r.hotel_id='${hotel}' AND r.is_active AND t.is_active`),'54');
console.log('LOCAL_SQL_AND_JS_ROUNDTRIP_REGRESSION=PASS');
console.log('POSTGREST_TRANSPORT_AND_FULL_PROPERTY_REGRESSION=PENDING_ENVIRONMENT');
