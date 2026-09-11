// Only an already prepared, disposable local 114485 fixture is accepted.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {path,rpc,artifacts,predecessor} from './hotels-v2-114486-contract.mjs';
const bin=process.env.HOTELS_114486_PSQL;assert.ok(bin);
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55489','-U','postgres','-d','hotels_114486_test'],{input:q,encoding:'utf8',maxBuffer:8e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),'hotels_114486_test|127.0.0.1|55489');
let passed=0;const pass=s=>{passed++;console.log('PASS '+s);};
const before=sql('SELECT hotels_stripe_dto_private.business_hash()');
const claim=id=>`PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000000${id}","role":"authenticated"}',true);`;
const gate=which=>{const rows=sql(readFileSync(`supabase/manual/hotels_v2_114486_${which}_readonly.sql`,'utf8')).split('\n');assert.equal(rows.length,10);assert.ok(rows.every(r=>r.split('|')[2]==='t'),rows.join('\n'));assert.equal(rows.at(-1).split('|')[3],before);pass(which+' 10/10 with identical business fingerprint');};
for(const [file,text] of Object.entries(artifacts()))assert.equal(readFileSync(file,'utf8'),text);
pass('generated migration/gates exact');gate('preactivation');
const migration=readFileSync(path,'utf8');sql(migration);
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('installation zero business/attestation/account/grant/flag mutation');
assert.equal(sql(`SELECT ${predecessor}`),'t');pass('predecessor source/security unchanged');gate('postinstall');
assert.notEqual(run(migration).status,0);pass('migration replay rejected');
for(const [state,ready,contract,age] of [
 ['MISSING',null,null,null],['NOT_READY',false,'hotels_standard_connect_server_v1','0 seconds'],
 ['NOT_READY',true,'wrong_contract','0 seconds'],['NOT_READY',false,'wrong_contract','16 minutes'],
 ['STALE',true,'hotels_standard_connect_server_v1','15 minutes'],
 ['STALE',true,'hotels_standard_connect_server_v1','15 minutes 0.001 seconds'],
 ['READY',true,'hotels_standard_connect_server_v1','14 minutes 59.999 seconds'],
 ['READY',true,'hotels_standard_connect_server_v1','0 seconds'],
]){
 const insert=ready===null?'':`INSERT INTO hotels_lifecycle_private.stripe_readiness VALUES('86000000-0000-4000-8000-000000000010',${ready},'${contract}',statement_timestamp()-interval '${age}');`;
 sql(`BEGIN;DO $test$ DECLARE d jsonb; BEGIN
 DELETE FROM hotels_lifecycle_private.stripe_readiness;${insert}${claim(1)}SET LOCAL ROLE authenticated;
 d:=${rpc};IF d->>'state'<>'${state}' OR (d->>'ready')::boolean IS DISTINCT FROM ${state==='READY'} THEN RAISE EXCEPTION 'wrong_state:%',d;END IF;
 IF '${state}'='MISSING' THEN
  IF d->'request_id'<>'null'::jsonb OR d->'checked_at'<>'null'::jsonb OR d->'expires_at'<>'null'::jsonb THEN RAISE EXCEPTION 'missing_metadata';END IF;
 ELSE
  IF (d->>'expires_at')::timestamptz-(d->>'checked_at')::timestamptz<>interval '15 minutes' THEN RAISE EXCEPTION 'wrong_ttl';END IF;
 END IF;
 END $test$;ROLLBACK;`);pass(state+' '+age);
}
// Single statement, no sleeps: same checked_at tie uses request_id DESC.
sql(`BEGIN;DO $test$ DECLARE d jsonb; BEGIN
 INSERT INTO hotels_lifecycle_private.stripe_readiness VALUES
 ('86000000-0000-4000-8000-000000000011',true,'hotels_standard_connect_server_v1',statement_timestamp()),
 ('86000000-0000-4000-8000-000000000012',false,'hotels_standard_connect_server_v1',statement_timestamp());
 ${claim(1)}SET LOCAL ROLE authenticated;d:=${rpc};IF d->>'state'<>'NOT_READY' THEN RAISE EXCEPTION 'latest_not_selected';END IF;
 END $test$;ROLLBACK;`);pass('latest row deterministic, invalid latest does not fall back');
for(const role of ['anon','service_role']){assert.notEqual(run(`BEGIN;SET LOCAL ROLE ${role};SELECT ${rpc};ROLLBACK;`).status,0);pass(role+' denied');}
for(const id of [2,9]){assert.notEqual(run(`BEGIN;DO $t$ BEGIN ${claim(id)}SET LOCAL ROLE authenticated;PERFORM ${rpc};END $t$;ROLLBACK;`).status,0);pass('nonadmin '+id+' denied');}
assert.notEqual(run(`BEGIN;SET LOCAL ROLE authenticated;SELECT ${rpc};ROLLBACK;`).status,0);pass('missing user denied');
sql(`BEGIN;DO $t$ DECLARE d jsonb;BEGIN
 SET LOCAL ROLE service_role;
 PERFORM public.hotel_v2_attest_stripe_platform_readiness('86000000-0000-4000-8000-000000000015',true,'hotels_standard_connect_server_v1');
 RESET ROLE;${claim(1)}SET LOCAL ROLE authenticated;d:=${rpc};
 IF d->>'state'<>'READY' THEN RAISE EXCEPTION 'writer_dto_mismatch';END IF;
 END $t$;ROLLBACK;`);pass('existing service writer -> real Admin READY DTO');
sql(`BEGIN;SET TRANSACTION READ ONLY;DO $t$ BEGIN ${claim(1)}SET LOCAL ROLE authenticated;PERFORM ${rpc};END $t$;ROLLBACK;`);pass('RPC executes under READ ONLY');
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('all synthetic mutations rolled back, complete protected business hash unchanged');
console.log('TARGETED_SQL='+passed+'/'+passed+' PASS');
