// Requires the disposable synthetic 114484 fixture, audited Rooms ON, port 55489.
// No arbitrary database URL or production credentials are accepted.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const bin=process.env.HOTELS_114485_PSQL;
assert.ok(bin);
const run=q=>spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55489','-U','postgres','-d','hotels_114485_test'],{input:q,encoding:'utf8',maxBuffer:8e6});
const sql=q=>{const r=run(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const claims=user=>`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-00000000000${user}","role":"authenticated"}',true); SET LOCAL ROLE authenticated;`;
const read=name=>`SELECT public.${name}('${hotel}')`;
let count=0;const pass=s=>{count++;console.log('PASS '+s);};
assert.equal(sql('SELECT host(inet_server_addr())||\':\'||inet_server_port()'),'127.0.0.1:55489');
// Remove only this test's successor from the synthetic fixture to test install.
sql('DROP FUNCTION IF EXISTS public.hotel_v2_admin_get_content_control_114485(uuid)');
const before=sql('SELECT hotels_stripe_dto_private.business_hash()');
const old=sql("SELECT hotels_guest_policy_private.raw_metadata('public.hotel_v2_admin_get_content_control(uuid)'::regprocedure)");
const baseline=run('BEGIN; SET TRANSACTION READ ONLY;'+claims(1)+read('hotel_v2_admin_get_content_control')+';ROLLBACK;');
assert.notEqual(baseline.status,0);assert.match(baseline.stderr,/hotels_v2_admin_b_public_activation_guard/);pass('baseline exact 55000 read guard');
const gate=which=>{
 const rows=sql(readFileSync(`supabase/manual/hotels_v2_114485_${which}_readonly.sql`,'utf8')).split('\n');
 assert.equal(rows.length,which==='preactivation'?8:9);assert.ok(rows.every(r=>r.endsWith('|t')),rows.join('\n'));pass(which+' all rows true');
};
gate('preactivation');
const migration=readFileSync('supabase/migrations/20260811448500_hotels_v2_admin_content_read_successor.sql','utf8');
sql(migration);assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('install changes no business data');
assert.equal(sql("SELECT hotels_guest_policy_private.raw_metadata('public.hotel_v2_admin_get_content_control(uuid)'::regprocedure)"),old);pass('frozen content RPC unchanged');
gate('postinstall');
const output=sql('BEGIN; SET TRANSACTION READ ONLY;'+claims(1)+read('hotel_v2_admin_get_content_control_114485')+';ROLLBACK;').split('\n').at(-1);
const dto=JSON.parse(output);assert.equal(dto.hotel_id,hotel);assert.deepEqual(dto.feature_flags,{hotel_rooms_v2_enabled:true,hotel_external_sync_enabled:true,hotel_instant_booking_enabled:false,hotel_stripe_connect_enabled:false});pass('authenticated content read Rooms/external ON, public OFF');
assert.notEqual(run(migration).status,0);pass('migration replay fails closed');
for(const [label,q,pattern] of [
 ['nonadmin',claims(2)+read('hotel_v2_admin_get_content_control_114485'),/permission|admin|42501/],
 ['anonymous','SET LOCAL ROLE anon;'+read('hotel_v2_admin_get_content_control_114485'),/permission denied/],
 ['service role','SET LOCAL ROLE service_role;'+read('hotel_v2_admin_get_content_control_114485'),/permission denied/],
 ['missing hotel',claims(1)+"SELECT public.hotel_v2_admin_get_content_control_114485('85000000-0000-4000-8000-000000000999')",/property_not_found/],
 ['null hotel',claims(1)+'SELECT public.hotel_v2_admin_get_content_control_114485(NULL)',/invalid_content_control_query/],
 ['unaudited rooms drift','UPDATE public.site_settings SET hotel_rooms_v2_enabled=false WHERE id=1;'+claims(1)+read('hotel_v2_admin_get_content_control_114485'),/drift|guard|mismatch/],
 ['instant flag','UPDATE public.site_settings SET hotel_instant_booking_enabled=true WHERE id=1;'+claims(1)+read('hotel_v2_admin_get_content_control_114485'),/guard|drift/],
 ['stripe flag','UPDATE public.site_settings SET hotel_stripe_connect_enabled=true WHERE id=1;'+claims(1)+read('hotel_v2_admin_get_content_control_114485'),/guard|drift/],
]){const r=run('BEGIN;'+q+';ROLLBACK;');assert.notEqual(r.status,0,label);assert.match(r.stderr,pattern);pass(label+' rejected');}
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('all read/negative tests leave business state unchanged');
// Exact existing Partner submit -> Admin reject. Entire flow is disposable and
// rolled back; canonical Hotel is compared before submit and after rejection.
sql(`BEGIN;
INSERT INTO auth.users(id) VALUES ('10000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
DO $test$ DECLARE w jsonb; p jsonb; r jsonb; c jsonb; a jsonb; original jsonb; result jsonb;
BEGIN
 SELECT to_jsonb(h) INTO original FROM public.hotels h WHERE id='${hotel}';
 ${claims(2).replace('SELECT set_config','PERFORM set_config')}
 w:=public.hotel_v2_partner_list_assigned_properties('20000000-0000-4000-8000-000000000001');
 IF w->'foundation_only'<>'true'::jsonb OR w->'workspace_available'<>'false'::jsonb THEN RAISE EXCEPTION 'discovery_contract_changed'; END IF;
 w:=public.hotel_v2_partner_get_workspace('20000000-0000-4000-8000-000000000001','${hotel}',current_date,current_date+2);
 p:=public.hotel_v2_partner_preview_content_plan(jsonb_build_object('contract_version','hotels_v2_h3_2b_content_draft_v1',
 'partner_id','20000000-0000-4000-8000-000000000001','hotel_id','${hotel}',
 'access_snapshot_token',w#>>'{assignment,access_snapshot_token}','content_snapshot_token',w->>'content_snapshot_token',
 'intent',jsonb_build_object('entity','property_content','action','update','id','${hotel}',
 'payload',jsonb_build_object('title_i18n',jsonb_build_object('en','7 Arches TEST')),'reason','Synthetic 114485 name-only proposal')));
 r:=public.hotel_v2_partner_apply_content_plan(p->'reviewed_plan','85000000-0000-4000-8000-000000000010','85000000-0000-4000-8000-000000000011');
 RESET ROLE;
 IF original IS DISTINCT FROM (SELECT to_jsonb(h) FROM public.hotels h WHERE id='${hotel}') THEN RAISE EXCEPTION 'submit_changed_hotel'; END IF;
 ${claims(1).replace('SELECT set_config','PERFORM set_config')}
 c:=public.hotel_v2_admin_get_partner_property_proposals('${hotel}');a:=c#>'{proposals,0}';
 p:=public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb_build_object('contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
 'hotel_id','${hotel}','proposal_id',a->'id','proposal_version',a->'version','action','reject','reason','Synthetic 114485 reject'));
 result:=public.hotel_v2_admin_apply_partner_property_proposal_plan(p->'reviewed_plan','85000000-0000-4000-8000-000000000012');
 RESET ROLE;
 IF result->>'status'<>'rejected' OR original IS DISTINCT FROM (SELECT to_jsonb(h) FROM public.hotels h WHERE id='${hotel}') THEN RAISE EXCEPTION 'reject_changed_hotel'; END IF;
END $test$;
ROLLBACK;`);pass('foundation discovery + real Partner submit/Admin reject; canonical Hotel unchanged');
assert.equal(sql('SELECT hotels_stripe_dto_private.business_hash()'),before);pass('proposal test full rollback');
console.log('TARGETED_SQL='+count+'/'+count+' PASS');
