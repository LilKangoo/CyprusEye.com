// All mutation below is deliberate, synthetic, and restricted to an owned
// disposable local fixture. Shipped rollout gates contain SELECTs only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build,migrationPath,migrationSha,signature,sourceHash} from './hotels-v2-114425-rollout-build.mjs';
import {hash} from './hotels-v2-114420-postinstall-contract.mjs';
const db=process.env.HOTELS_RECONCILIATION_DB,psql=process.env.HOTELS_RECONCILIATION_PSQL,phase=process.env.HOTELS_114425_TEST_PHASE;
assert.match(db||'',/^hotels_114416_successor_post425_[a-z0-9_]+$/);assert.ok(psql);assert.ok(['prepare','preaction','install','postinstall','record'].includes(phase));
function sql(input){const r=spawnSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:16e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const migration=readFileSync(migrationPath,'utf8');assert.equal(hash(migration),migrationSha);
const gates={};for(const stage of ['preaction','postinstall']){gates[stage]=build(stage);assert.equal(gates[stage].sql,readFileSync('supabase/manual/hotels_v2_114425_'+stage+'_readonly.sql','utf8'));}
const tables=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private')"));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tables.map(t=>`SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
function run(stage,expect=true){const started=performance.now(),g=gates[stage],rows=sql(g.sql).split('\n').map(l=>l.split('|'));assert.equal(rows.length,g.rows);const summary=rows.at(-1);if(expect)assert.deepEqual(summary.slice(-4),['t','[]',String(g.leaves),String(g.leaves)]);return {rows:rows.length,summary:summary.slice(-4),failed:rows.slice(0,-1).filter(r=>r[5]!=='t').map(r=>r[2]),elapsed_ms:Number((performance.now()-started).toFixed(3))};}
const result={local_only:true,phase,postgres:sql('SHOW server_version'),negatives:[]};
function negative(stage,name,mutation,leaf){const s=gates[stage].specs.find(s=>s.name===leaf);assert.ok(s,leaf);const output=sql('BEGIN;SET LOCAL search_path=pg_catalog,public;SET LOCAL session_replication_role=replica;'+mutation+';SET LOCAL session_replication_role=origin;'+s.query+';ROLLBACK;');assert.notEqual(output,s.expected,name);result.negatives.push({name,leaf,fail_closed:true});}
function alteredSource(fn){return sql(`SELECT pg_get_functiondef('${fn}'::regprocedure)`).replace(/AS \$function\$\n/,'AS $function$\n-- disposable source-drift sentinel\n');}
if(phase==='prepare'){
 assert.equal(sql("SELECT hotels_lineage_private.current_anchor_is_exact() AND to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NULL"),'t');
 const path='supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql',text=readFileSync(path,'utf8');assert.equal(hash(text),'7026d08e220887f4f71553c3d7e53384f89b23bbc686ae3bd51a24e7b2aee879');sql(text);
 assert.equal(sql("SELECT to_regnamespace('supabase_migrations') IS NULL"),'t');
 sql("CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);INSERT INTO supabase_migrations.schema_migrations(version) VALUES('9994'),"+[350,360,370,400,405,406,407,410,415,416,420].map(n=>"('202608114"+n+"00')").join(',')+';');result.preaction=run('preaction');
}
if(phase==='preaction'){
 const before=snapshot();result.preaction=run('preaction');
 negative('preaction','wrong_114420_history',"DELETE FROM supabase_migrations.schema_migrations WHERE version='20260811442000'",'recorded_114420');
 negative('preaction','114425_already_recorded',"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811442500')",'recorded_114425');
 negative('preaction','missing_114416_anchor','DELETE FROM hotels_lineage_private.reconciliation_receipts','reconciliation_anchor_exact');
 const bridge='public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)';negative('preaction','wrong_114420_bridge_source',alteredSource(bridge),bridge);
 negative('preaction','wrong_pricing_topology',"UPDATE public.hotel_pricing_schedules SET sharing_mode='shared' WHERE id='aec20731-7a56-35f0-334e-92b363351f02'",'upper_schedule_exact');
 negative('preaction','wrong_commission',"UPDATE public.hotel_commission_policies SET amount=11 WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'",'commission_EUR10_exact');
 for(const [name,column] of [['wrong_external_flag','hotel_external_sync_enabled'],['wrong_instant_flag','hotel_instant_booking_enabled'],['wrong_stripe_flag','hotel_stripe_connect_enabled'],['public_booking_enabled','hotel_rooms_v2_enabled']])negative('preaction',name,`UPDATE public.site_settings SET ${column}=${column==='hotel_external_sync_enabled'?'false':'true'} WHERE id=1`,column==='hotel_rooms_v2_enabled'?'public_booking_disabled':column);
 // No booking RPC: a synthetic row with all current non-null/default fields is
 // constructed from a baseline row and rolled back. Its bridge field is invalid
 // at the required inert boundary, which the gate must reject.
 const bookingRow=sql('SELECT count(*) FROM public.hotel_bookings');assert.notEqual(bookingRow,'0','Synthetic baseline needs an existing booking for isolated clone negative');
 negative('preaction','unexpected_booking_row',"INSERT INTO public.hotel_bookings SELECT (jsonb_populate_record(NULL::public.hotel_bookings,to_jsonb(b)||jsonb_build_object('id','90000000-0000-4000-8000-000000001425','pricing_room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94','reference_number','DIAGNOSTIC-114425'))).* FROM public.hotel_bookings b LIMIT 1",'no_114420_priced_booking_rows');
 negative('preaction','unexpected_quote_row',"INSERT INTO public.hotel_seven_arches_public_quote_issuances VALUES(repeat('a',64),'9b6d99a0-923a-4fbc-be54-c066e856e6ca',repeat('b',64),repeat('c',64),jsonb_build_object('contract_version','hotels_v2_seven_arches_public_quote_v1','quote_fingerprint',repeat('a',64),'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','authority_token',repeat('b',64)),timestamp with time zone '2026-09-09 00:00:00+00',timestamp with time zone '2026-09-09 00:15:00+00',repeat('d',64))",'hotel_seven_arches_public_quote_issuances_empty');
 negative('preaction','preaction_overload_collision',"CREATE FUNCTION public.hotel_v2_external_calendar_site_settings_fingerprint(integer) RETURNS text LANGUAGE sql AS 'SELECT NULL::text'",'function_name_cardinality_exact');
 negative('preaction','preaction_relation_collision','CREATE TABLE public.hotel_v2_external_calendar_site_settings_fingerprint(id integer)','no_relation_or_type_name_collision');
 assert.equal(snapshot(),before);result.protected_relations_unchanged=tables.length;
}
if(phase==='install'){
 result.preaction=run('preaction');const before=snapshot();
 const definitions=()=>JSON.parse(sql("SELECT jsonb_object_agg(p.oid::regprocedure::text,pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','hotels_v2_private','hotels_lineage_private') AND p.prokind IN('f','p')"));
 const funcs=definitions(),start=performance.now();sql(migration);result.install_ms=Number((performance.now()-start).toFixed(3));
 const after=definitions(),added=Object.keys(after).filter(k=>!Object.hasOwn(funcs,k));assert.deepEqual(added,['hotel_v2_external_calendar_site_settings_fingerprint()']);for(const [k,v] of Object.entries(funcs))assert.equal(after[k],v,k);
 assert.equal(snapshot(),before);result.prior_function_definitions_unchanged=Object.keys(funcs).length;result.functions_added=added;result.protected_relations_unchanged=tables.length;result.postinstall=run('postinstall');
}
if(phase==='postinstall'){
 const before=snapshot();result.postinstall=run('postinstall');
 negative('postinstall','114425_recorded_too_early',"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811442500')",'recorded_114425');
 for(const [name,ddl] of [['wrong_owner',`ALTER FUNCTION ${signature} OWNER TO authenticated`],['wrong_security_definer',`ALTER FUNCTION ${signature} SECURITY INVOKER`],['wrong_search_path',`ALTER FUNCTION ${signature} SET search_path=public`],['wrong_acl',`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`],['wrong_source',alteredSource(signature)]])negative('postinstall',name,ddl,'function_identity_security_source_exact');
 negative('postinstall','postinstall_overload',"CREATE FUNCTION public.hotel_v2_external_calendar_site_settings_fingerprint(integer) RETURNS text LANGUAGE sql AS 'SELECT NULL::text'",'function_name_cardinality_exact');
 negative('postinstall','114450_prematurely_recorded',"INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811445000')",'recorded_114450');
 negative('postinstall','114450_premature_object','CREATE TABLE hotels_v2_private.hotel_external_calendar_provider_evolution_receipts(id integer)','114450_receipt_absent');
 const expected='9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5';result.behavior=[];
 for(const [name,mutation] of [['external_false','UPDATE public.site_settings SET hotel_external_sync_enabled=false WHERE id=1'],['external_true','UPDATE public.site_settings SET hotel_external_sync_enabled=true WHERE id=1'],['unrelated_settings_column',"ALTER TABLE public.site_settings ADD COLUMN diagnostic_unrelated_setting text;UPDATE public.site_settings SET diagnostic_unrelated_setting='synthetic-unrelated-value' WHERE id=1"]]){const value=sql(`BEGIN;SET LOCAL session_replication_role=replica;${mutation};SET LOCAL session_replication_role=origin;SELECT ${signature};ROLLBACK;`);assert.equal(value,expected,name);result.behavior.push({name,pass:true});}
 for(const column of ['hotel_rooms_v2_enabled','hotel_instant_booking_enabled','hotel_stripe_connect_enabled']){const value=sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE public.site_settings SET ${column}=true WHERE id=1;SET LOCAL session_replication_role=origin;SELECT ${signature} IS NULL;ROLLBACK;`);assert.equal(value,'t',column);result.behavior.push({name:column+'_rejected',pass:true});}
 assert.equal(sql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${signature}'::regprocedure`),sourceHash);
 assert.equal(snapshot(),before);result.protected_relations_unchanged=tables.length;
}
if(phase==='record'){
 result.before_recording=run('postinstall');const before=snapshot();sql("INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260811442500')");
 result.after_recording=run('postinstall',false);assert.deepEqual(result.after_recording.failed,['recorded_114425']);
 const preflight=readFileSync('supabase/manual/hotels_v2_external_calendar_provider_types_preflight.sql','utf8');
 const output=sql(preflight);assert.match(output,/hotels_v2_external_calendar_provider_types_preflight/);result.next_114450_precondition='PASS';assert.equal(snapshot(),before);result.protected_relations_unchanged=tables.length;
}
result.production_access=false;console.log(JSON.stringify(result,null,2));
