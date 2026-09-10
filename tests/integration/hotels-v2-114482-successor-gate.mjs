// Local-only H2B1 successor regression. No production URI or copied user data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
const bin=process.env.HOTELS_114482_PSQL;
assert.ok(bin);const port='55489',post='hotels_114482_test',pre='hotels_114482_pre',historical='hotels_114482_historical';
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const signature='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)';
const read=p=>fs.readFileSync(p,'utf8'),lit=s=>"'"+s.replaceAll("'","''")+"'";
function run(s,db=post){assert.match(db,/^(hotels_11448[12]_[a-z_]+|postgres)$/);return spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db],{input:s,encoding:'utf8',maxBuffer:64e6});}
function sql(s,db=post){const r=run(s,db);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql('SELECT host(inet_server_addr())||\'|\'||inet_server_port()'),'127.0.0.1|55489');
const claims="SELECT set_config('request.jwt.claims','{\"sub\":\"10000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',true) IS NOT NULL;";
const get=`public.hotel_v2_admin_get_shadow_preparation_state('${hotel}')`;
const snapshot=()=>sql('SELECT hotels_stripe_dto_private.business_hash()');
const before=snapshot(),definition=sql(`SELECT pg_get_functiondef('${signature}'::regprocedure)`);
const dto=(q=get,setup='',db=post)=>JSON.parse(sql(`BEGIN;${setup}${claims}SET LOCAL ROLE authenticated;SELECT ${q};ROLLBACK;`,db).split('\n').at(-1));
let count=0;function pass(name){console.log('PASS '+name);count++;}
assert.equal(dto().status,'SUCCESSOR_ALREADY_COMPLETE');assert.equal(dto().mutation_allowed,false);pass('A real authenticated Get successor exact');
assert.equal(dto().feature_flags.hotel_external_sync_enabled,true);pass('external true independent');
const noOp=run(`BEGIN;${claims}SET LOCAL ROLE authenticated;SELECT public.hotel_v2_admin_prepare_shadow_rooms_successor('{"hotel_id":"${hotel}"}','84000000-0000-4000-8000-000000000482');ROLLBACK;`);
assert.match(noOp.stderr,/hotels_114482_preparation_already_complete/);assert.equal(snapshot(),before);pass('stale client mutation refused before old preparer; all rows unchanged');
for(const [name,change] of [
 ['room_inventory',`UPDATE public.hotel_room_types SET base_inventory_count=2 WHERE id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'`],
 ['room_identity',`UPDATE public.hotel_room_types SET code='wrong' WHERE id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'`],
 ['rate_link',`UPDATE public.hotel_room_rates SET pricing_schedule_id='9d109336-64f3-3c57-4684-968b59c94c3b' WHERE id='7e420964-9cbf-4f1b-abd3-09840af5240f'`],
 ['tier_value',`UPDATE public.hotel_pricing_schedule_occupancy_tiers SET nightly_rate=nightly_rate+1 WHERE schedule_id='aec20731-7a56-35f0-334e-92b363351f02'`],
]){
 const r=run(`BEGIN;${change};${claims}SET LOCAL ROLE authenticated;SELECT ${get};ROLLBACK;`);
 if(r.status===0)assert.equal(JSON.parse(r.stdout.trim().split('\n').at(-1)).status,'BLOCKED',name);
 else assert.match(r.stderr,/guard|immutable|drift|protected|relationship|link|inventory|shared|exact|pricing/i,name);
 assert.equal(snapshot(),before);pass('D '+name+' fails closed and rolls back');
}
for(const role of ['anon','service_role']){const r=run(`BEGIN;SET LOCAL ROLE ${role};SELECT ${get};ROLLBACK;`);assert.match(r.stderr,/permission denied/);pass(role+' denied');}
const foreign=run(`BEGIN;SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000099","role":"authenticated"}',true);SET LOCAL ROLE authenticated;SELECT ${get};ROLLBACK;`);
assert.notEqual(foreign.status,0);pass('non-admin denied');
assert.throws(()=>dto(get.replace(hotel,'90000000-0000-4000-8000-000000000099')),/exact_hotel_required/);pass('foreign Hotel denied');
for(const [name,change] of [
 ['private_acl','GRANT EXECUTE ON FUNCTION hotels_shadow_successor_private.flags() TO authenticated'],
 ['certificate_rls','ALTER TABLE hotels_shadow_successor_private.certificate DISABLE ROW LEVEL SECURITY'],
 ['certificate_trigger','ALTER TABLE hotels_shadow_successor_private.certificate DISABLE TRIGGER immutable'],
 ['state_source',sql("SELECT pg_get_functiondef('hotels_shadow_successor_private.state(uuid)'::regprocedure)").replace(/AS (\$\w*\$)/,'AS $1\n-- synthetic source drift\n')],
]){const r=run(`BEGIN;${change};${claims}SET LOCAL ROLE authenticated;SELECT ${get};ROLLBACK;`);assert.notEqual(r.status,0,name);assert.match(r.stderr,/hotels_114482_.*drift/);pass('source/security '+name);}
const oldSource=sql(`SELECT prosrc FROM pg_proc WHERE oid='${signature}'::regprocedure`);
const cloneSource=sql("SELECT prosrc FROM pg_proc WHERE oid='hotels_shadow_successor_private.prepare_historical(jsonb,uuid)'::regprocedure");
assert.equal(cloneSource,oldSource.replace(`if exists(select 1 from public.site_settings where id=1 and (hotel_rooms_v2_enabled
    or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then`,
 `if (hotels_shadow_successor_private.flags()->'hotel_rooms_v2_enabled') IS DISTINCT FROM 'false'::jsonb then`));pass('private clone has exactly one guard change; all stale/pricing guards preserved');
const on=`INSERT INTO auth.users(id) VALUES('10000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;${claims}SET LOCAL ROLE authenticated;SELECT public.hotel_v2_admin_set_capability_lifecycle('rooms',true,0,'84000000-0000-4000-8000-000000000483','Synthetic H2B1 rollback-only test','CONFIRM_HOTELS_CAPABILITY_CHANGE')->'current';RESET ROLE;`;
const blocked=dto(get,on);assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.feature_flags.hotel_rooms_v2_enabled,true);assert.deepEqual(blocked.reasons,['hotels_v2_h2b1_capability_flag_enabled']);assert.equal(snapshot(),before);pass('C real audited Rooms ON blocks; rollback restores OFF');
for(const file of ['postinstall']){const rows=sql(read(`supabase/manual/hotels_v2_114482_${file}_readonly.sql`)).split('\n');assert.equal(rows.length,9);assert.ok(rows.every(r=>r.endsWith('|t')));pass('postinstall 9/9');}
const migration=read('supabase/migrations/20260811448200_hotels_v2_shadow_preparation_successor.sql');
assert.match(run(migration).stderr,/hotels_114482_boundary_mismatch/);pass('migration replay rejected');
// Separate pristine 114481 clone proves actual guarded installation.
sql(`CREATE DATABASE ${pre} TEMPLATE hotels_114481_test`, 'postgres');
sql("INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811448100')",pre);
let rows=sql(read('supabase/manual/hotels_v2_114482_preactivation_readonly.sql'),pre).split('\n');assert.equal(rows.length,10);assert.ok(rows.every(r=>r.endsWith('|t')));pass('preaction 10/10');
const beforeInstall=sql('SELECT hotels_stripe_dto_private.business_hash()',pre);
sql(migration,pre);assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()',pre),beforeInstall);pass('real 114481 install zero business delta');
// Historical branch compatibility is tested on a REAL pristine H2B1 schema,
// never by deleting/downgrading successor rows or rewriting receipts. This is
// a function unit fixture, NOT authorization to install 114482 at an old stage.
sql(`CREATE DATABASE ${historical} TEMPLATE template0`,'postgres');
function expand(p){return read(p).replace(/^\\ir ([^\n]+)$/gm,(_,f)=>expand(resolve(dirname(p),f.trim())));}
const seedPath=resolve('tests/integration/hotels-v2-h2b1-postgres-gate.sql');
const seed=read(seedPath).split('-- CHECK predicates')[0].replace(/^\\ir ([^\n]+)$/gm,(_,f)=>expand(resolve(dirname(seedPath),f.trim())));
sql(seed,historical);
for(const version of ['112800','112900','113000','113100']){
 const f=fs.readdirSync('supabase/migrations').find(f=>f.startsWith('202608'+version+'00_'));
 sql(read('supabase/migrations/'+f),historical);
}
// The final writer's source is copied verbatim from the accepted 114481
// fixture. Do not replay the 113300 INSTALL guard here: that installer requires
// a completed promotion, whereas this unit case intentionally has no rooms.
// Its runtime's pristine branch and dependencies are what this case exercises.
sql(definition,historical);
assert.equal(sql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${signature}'::regprocedure`,historical),'31383ecd2bd2525f5725b0c629e187f8db54515cc007649173cdbf1d24b9b74a');pass('historical writer exact source provenance');
const functions=migration.slice(migration.indexOf('CREATE SCHEMA hotels_shadow_successor_private'),migration.indexOf('INSERT INTO hotels_shadow_successor_private.certificate'));
sql(functions+"INSERT INTO hotels_shadow_successor_private.certificate VALUES(1,hotels_shadow_successor_private.catalog(),'synthetic historical fixture');UPDATE public.hotels SET children_policy='minimum_age',minimum_child_age=10 WHERE id='"+hotel+"';UPDATE public.site_settings SET hotel_external_sync_enabled=true WHERE id=1;",historical);
assert.equal(dto(get,'',historical).status,'PRE_H2B1_READY');pass('B pristine historical external ON eligible');
const ws=dto(`public.hotel_v2_admin_get_property_workspace('${hotel}')`,'',historical);
const context=vm.createContext({console,crypto:globalThis.crypto});vm.runInContext(read('admin/hotels-v2-workspace-core.js'),context);
const core=context.HotelsV2WorkspaceCore,prep=core.sevenArchesShadowPreparation(ws);
const plan=core.buildSevenArchesShadowPlan(ws,prep.rooms.map((r,i)=>({id:r.id,name_i18n:r.name_i18n,gallery:[prep.property_gallery[i]]})));
const prepared=dto(`public.hotel_v2_admin_prepare_shadow_rooms_successor(${lit(JSON.stringify(plan))},'84000000-0000-4000-8000-000000000484')`,'',historical);
assert.equal(prepared.workspace.room_types.length,2);assert.equal(prepared.workspace.feature_flags.hotel_external_sync_enabled,true);pass('B real reviewed historical preparation succeeds with External ON and rollback');
assert.equal(sql(`SELECT count(*) FROM public.hotel_room_types WHERE hotel_id='${hotel}'`,historical),'0');pass('historical test rollback no partial data');
assert.equal(sql(`SELECT pg_get_functiondef('${signature}'::regprocedure)`),definition);assert.equal(snapshot(),before);pass('old preparer and successor business data untouched');
assert.equal(sql('SELECT public.hotel_v2_seven_arches_payment_policy_lineage_is_exact(),hotels_lifecycle_private.public_booking_enabled()'),'t|f');pass('payment exact and public disabled');
console.log(JSON.stringify({passed:count,production_access:false,old_preparer_calls_on_successor:0}));
