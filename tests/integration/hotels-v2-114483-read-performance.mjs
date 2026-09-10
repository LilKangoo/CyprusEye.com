// Three-RPC local regression only. Never accepts a remote connection string.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {roots,hotel,hash,schema,compile,catalogQuery,aclExpression,lit} from './hotels-v2-114483-read-compiler.mjs';
const bin=process.env.HOTELS_114483_PSQL;
assert.ok(bin);const port='55489',db='hotels_114483_profile';
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db],{input:q,encoding:'utf8',maxBuffer:64e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("SELECT host(inet_server_addr())||'|'||inet_server_port()"),'127.0.0.1|55489');
const claims=`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true) IS NOT NULL;`;
const tx=q=>`BEGIN;SET TRANSACTION READ ONLY;${claims}SET LOCAL ROLE authenticated;${q};ROLLBACK;`;
const business=()=>sql('SELECT hotels_stripe_dto_private.business_hash()');
const before=business();let passed=0;const timings=[];
function pass(name){passed++;console.log('PASS '+name);}
const aclA='{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}';
const aclB='{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}';
const aclEqual=(a,b)=>sql(`SELECT ${aclExpression(a)} IS NOT DISTINCT FROM ${aclExpression(b)}`);
const aclValue=a=>lit(a)+'::aclitem[]';
assert.equal(aclEqual(aclValue(aclA),aclValue(aclB)),'t');pass('ACL production ordering equals fixture ordering');
for(const [name,acl] of [
 ['missing grantee','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'],
 ['additional PUBLIC grantee','{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres,=X/postgres}'],
 ['changed privilege','{postgres=X/postgres,service_role=/postgres,anon=X/postgres,authenticated=X/postgres}'],
 ['changed grantor','{postgres=X/postgres,service_role=X/anon,anon=X/postgres,authenticated=X/postgres}'],
 ['changed grantability','{postgres=X/postgres,service_role=X*/postgres,anon=X/postgres,authenticated=X/postgres}'],
 ['duplicate entry','{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres,anon=X/postgres}'],
]){assert.equal(aclEqual(aclValue(aclA),aclValue(acl)),'f');pass('ACL rejects '+name);}
assert.equal(aclEqual('NULL::aclitem[]',aclValue('{}')),'f');pass('ACL preserves NULL versus empty');
const aclBefore=sql(`SELECT ${schema}.metadata('public.is_current_user_admin()'::regprocedure)`);
const aclReordered=sql(`BEGIN;REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon,authenticated;GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon,authenticated;SELECT ${schema}.metadata('public.is_current_user_admin()'::regprocedure);SELECT ${schema}.assert_exact();ROLLBACK;`).trim();
assert.equal(aclReordered,aclBefore);pass('real pg_proc ACL reordered: full metadata and certificate remain exact');
const generated=compile(JSON.parse(sql(catalogQuery)));
assert.equal(generated.migration.trimEnd(),readFileSync('supabase/migrations/20260811448300_hotels_v2_successor_admin_reads_once.sql','utf8').trimEnd());pass('compiler deterministic; all original source/security pins exact');
assert.ok(generated.bindings.every(b=>!b.settings.includes('timeout')));pass('no function timeout override introduced');
for(const root of roots){
 const args=root.includes('get_seven_arches_pricing_activation')?'':`'${hotel}'`;
 const original=`${root}(${args})`,successor=`${root}_114483(${args})`;
 let t=performance.now();const old=JSON.parse(sql(tx('SELECT '+original)).split('\n').at(-1));const before_ms=performance.now()-t;
 const warm=[];for(let i=0;i<3;i++){
  t=performance.now();const current=JSON.parse(sql(tx('SELECT '+successor)).split('\n').at(-1));warm.push(performance.now()-t);
  assert.deepEqual(current,old,'complete semantic output including snapshot tokens');
 }
 assert.ok(Math.max(...warm)<3000,JSON.stringify(warm));
 if(root.includes('shadow')){assert.equal(old.status,'SUCCESSOR_ALREADY_COMPLETE');assert.equal(old.mutation_allowed,false);}
 if(root.includes('pricing_activation')){assert.equal(old.status,'active');assert.equal(old.pricing_authority,'independent_room_schedules');}
 timings.push({rpc:root,before_ms,after_ms:warm,semantic_hash:hash(JSON.stringify(old))});pass(root+' exact DTO and <3000ms');
 for(const role of ['anon','service_role']){const r=run(`BEGIN;SET LOCAL ROLE ${role};SELECT ${successor};ROLLBACK;`);assert.match(r.stderr,/permission denied/);pass(role+' denied '+root);}
 const foreign=run(`BEGIN;SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000099","role":"authenticated"}',true);SET LOCAL ROLE authenticated;SELECT ${successor};ROLLBACK;`);
 assert.notEqual(foreign.status,0);pass('non-admin denied '+root);
}
assert.equal(business(),before);pass('all protected business rows unchanged');
assert.equal(sql(`SELECT NOT has_schema_privilege('authenticated','${schema}','USAGE') AND NOT has_function_privilege('authenticated','${schema}.projection_0(uuid)','EXECUTE')`),'t');pass('browser cannot supply or forge private evaluation context');
const on=`INSERT INTO auth.users(id) VALUES('10000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;${claims}SET LOCAL ROLE authenticated;SELECT public.hotel_v2_admin_set_capability_lifecycle('rooms',true,0,'84000000-0000-4000-8000-000000000483','Synthetic fresh-state rollback test','CONFIRM_HOTELS_CAPABILITY_CHANGE')->'current';`;
const changed=JSON.parse(sql(`BEGIN;${on}SELECT public.hotel_v2_admin_get_shadow_preparation_state_114483('${hotel}');ROLLBACK;`).split('\n').at(-1));
assert.equal(changed.status,'BLOCKED');assert.equal(changed.feature_flags.hotel_rooms_v2_enabled,true);assert.equal(changed.mutation_allowed,false);assert.equal(business(),before);pass('fresh audited Rooms ON immediately visible; rollback restores OFF; no cross-call cache');
const safe=JSON.parse(sql("SELECT hotels_lifecycle_private.safe_state()"));
assert.deepEqual(safe.feature_flags,{hotel_rooms_v2_enabled:false,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false});assert.equal(safe.public_booking_enabled,false);pass('flags exact and public booking off');
assert.equal(sql("SELECT public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()"),'t');pass('payment lineage exact');
const oracle=JSON.parse(sql('SELECT public.hotel_v2_seven_arches_reviewed_pricing_oracle()'));
assert.equal(oracle.core_case_count,100);assert.equal(oracle.core_mismatch_count,0);assert.equal(oracle.guest_one_case_count,20);assert.equal(oracle.guest_one_mismatch_count,0);pass('100/0 parity and guest-one 20/0');
assert.equal(sql("SELECT count(*)=1 FROM public.hotel_commission_policies WHERE hotel_id='"+hotel+"' AND commission_mode='per_allocated_room_per_night' AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed'"),'t');pass('EUR10 commission exact');
for(const [name,change] of [
 ['tier',"UPDATE public.hotel_pricing_schedule_occupancy_tiers SET nightly_rate=nightly_rate+1 WHERE schedule_id='aec20731-7a56-35f0-334e-92b363351f02'"],
 ['inventory',"UPDATE public.hotel_room_types SET base_inventory_count=2 WHERE id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'"],
 ['source',sql("SELECT pg_get_functiondef('public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure)").replace('AS $function$','AS $function$\n-- synthetic drift')],
 ['private ACL',`GRANT EXECUTE ON FUNCTION ${schema}.assert_exact() TO authenticated`],
 ['certificate RLS',`ALTER TABLE ${schema}.certificate DISABLE ROW LEVEL SECURITY`],
 ['certificate trigger',`ALTER TABLE ${schema}.certificate DISABLE TRIGGER immutable`],
]){
 const r=run(`BEGIN;${change};${claims}SET LOCAL ROLE authenticated;SELECT public.hotel_v2_admin_get_shadow_preparation_state_114483('${hotel}');ROLLBACK;`);
 if(r.status===0)assert.equal(JSON.parse(r.stdout.trim().split('\n').at(-1)).status,'BLOCKED',name);else assert.match(r.stderr,/drift|immutable|guard|protected|inventory|exact|policy/i,name);
 assert.equal(business(),before);pass(name+' fails closed with rollback');
}
const replay=run(readFileSync('supabase/migrations/20260811448300_hotels_v2_successor_admin_reads_once.sql','utf8'));
assert.match(replay.stderr,/hotels_114483_boundary_mismatch/);pass('migration replay fails closed');
const gate=sql(readFileSync('supabase/manual/hotels_v2_114483_postinstall_readonly.sql','utf8')).split('\n');assert.equal(gate.length,10);assert.ok(gate.every(r=>r.endsWith('|t')));pass('postinstall read-only gate 10/10');
console.log(JSON.stringify({passed,timings,business_unchanged:business()===before,production_access:false}));
