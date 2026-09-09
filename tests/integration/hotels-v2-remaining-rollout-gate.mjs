// Synthetic mutation/lock tests ONLY in a task-owned loopback database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {build,loadCatalogs} from './hotels-v2-remaining-rollout-build.mjs';
import {migration,stages,stageTables,literal,compactFunctionQuery} from './hotels-v2-remaining-rollout-contract.mjs';
import {stageMatrix} from './hotels-v2-lineage-stage-matrix.mjs';
const db=process.env.HOTELS_RECONCILIATION_DB,bin=process.env.HOTELS_RECONCILIATION_PSQL,stage=Number(process.env.HOTELS_REMAINING_STAGE);
assert.match(db||'',/^hotels_114416_successor_post425_remaining_[a-z0-9_]+$/);assert.ok(stages.includes(stage));assert.ok(bin);
const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db];
function sql(input){const r=spawnSync(bin,args,{input,encoding:'utf8',maxBuffer:32e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const catalogs=loadCatalogs(),gates=Object.fromEntries(['preaction','postinstall'].map(p=>[p,build(stage,p,catalogs)]));
for(const [phase,g]of Object.entries(gates))assert.equal(g.sql,readFileSync(`supabase/manual/hotels_v2_${stage}_${phase}_readonly.sql`,'utf8'));
const results={stage,local_only:true,negatives:[],production_access:false};
const tables=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private','hotel_stripe_connect_private','hotels_lifecycle_private') AND c.relname<>'successor_receipts'"));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tables.map(t=>`SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
function run(phase,pass=true){const g=gates[phase],started=performance.now(),rows=sql(g.sql).split('\n').map(l=>l.split('|'));assert.equal(rows.length,g.rows);const failed=rows.slice(0,-1).filter(r=>r[5]!=='t').map(r=>r[2]);if(pass)assert.deepEqual(failed,[],stage+':'+phase);return{rows:rows.length,leaves:g.leaves,passed:g.leaves-failed.length,failed,elapsed_ms:+(performance.now()-started).toFixed(3)};}
function negative(name,mutation,leaf){const s=gates.preaction.specs.find(s=>s.name===leaf);assert.ok(s,leaf);const actual=sql('BEGIN;SET LOCAL search_path=pg_catalog,public;SET LOCAL session_replication_role=replica;'+mutation+';SET LOCAL session_replication_role=origin;'+s.query+';ROLLBACK;');assert.notEqual(actual,s.expected,name);results.negatives.push({name,leaf,pass:true});}
function catalogNegative(name,mutation,signature){const expected=gates.preaction.catalog.functions.find(f=>f.signature===signature);assert.ok(expected,signature);const actual=sql(`BEGIN;SET LOCAL search_path=pg_catalog,public;${mutation};SELECT f->>'catalog_sha' FROM jsonb_array_elements((${compactFunctionQuery})) f WHERE f->>'signature'=${literal(signature)};ROLLBACK;`);assert.notEqual(actual,expected.catalog_sha,name);results.negatives.push({name,leaf:signature,pass:true});}
const before=snapshot(),historicalSuccessors=sql("SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY stage),'[]'::jsonb) FROM hotels_lineage_private.successor_receipts r");results.preaction=run('preaction');
const previous=[114425,...stages][stages.indexOf(stage)];
negative('wrong_predecessor_history',`DELETE FROM supabase_migrations.schema_migrations WHERE version='202608${previous}00'`,'recorded_'+previous);
negative('premature_stage_recording',`INSERT INTO supabase_migrations.schema_migrations VALUES('202608${stage}00')`,'recorded_'+stage);
negative('missing_predecessor_receipt','DELETE FROM hotels_lineage_private.reconciliation_receipts','one_114416_receipt');
negative('wrong_predecessor_hash',"UPDATE hotels_lineage_private.reconciliation_receipts SET evidence=jsonb_set(evidence,'{historical_owner_hash}',to_jsonb(repeat('0',64))),evidence_hash=public.hotel_v2_h3_2b_hash(jsonb_set(evidence,'{historical_owner_hash}',to_jsonb(repeat('0',64))))",'reconciliation_anchor_exact');
const signature='hotel_v2_external_calendar_site_settings_fingerprint()',qualified='public.'+signature;
const definition=sql(`SELECT pg_get_functiondef('${qualified}'::regprocedure)`).replace(/AS (\$[a-zA-Z0-9_]*\$)/,'AS $1\n-- synthetic source drift\n');
for(const [name,mutation]of [['source_drift',definition],['security_drift',`ALTER FUNCTION ${qualified} SECURITY INVOKER`],['wrong_acl',`GRANT EXECUTE ON FUNCTION ${qualified} TO authenticated`],['wrong_owner',`ALTER FUNCTION ${qualified} OWNER TO authenticated`],['wrong_search_path',`ALTER FUNCTION ${qualified} SET search_path=public`]])catalogNegative(name,mutation,signature);
negative('wrong_flag','UPDATE public.site_settings SET hotel_rooms_v2_enabled=true WHERE id=1','hotel_rooms_v2_enabled');
negative('pricing_drift',"UPDATE public.hotel_room_rates SET base_nightly_rate=101 WHERE id='7e420964-9cbf-4f1b-abd3-09840af5240f'",'upper_rate_exact');
negative('commission_drift',"UPDATE public.hotel_commission_policies SET amount=11 WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'",'commission_EUR10_exact');
// Source drift in the payment validator is rejected before any safety helper runs.
const payment='hotel_v2_seven_arches_payment_policy_lineage_is_exact()';
catalogNegative('payment_lineage_drift',sql(`SELECT pg_get_functiondef('public.${payment}'::regprocedure)`).replace(/AS (\$[a-zA-Z0-9_]*\$)/,'AS $1\n-- synthetic payment lineage drift\n'),payment);
negative('unexpected_booking',`INSERT INTO public.hotel_bookings SELECT (jsonb_populate_record(NULL::public.hotel_bookings,to_jsonb(b)||jsonb_build_object('id','90000000-0000-4000-8000-000000001499','pricing_room_type_id','b4ef504f-cdeb-4e3c-a54d-932146ef4e94','reference_number','DIAGNOSTIC-REMAINING'))).* FROM public.hotel_bookings b LIMIT 1`,'no_114420_priced_booking_rows');
negative('unexpected_quote',"INSERT INTO public.hotel_seven_arches_public_quote_issuances VALUES(repeat('a',64),'9b6d99a0-923a-4fbc-be54-c066e856e6ca',repeat('b',64),repeat('c',64),jsonb_build_object('contract_version','hotels_v2_seven_arches_public_quote_v1','quote_fingerprint',repeat('a',64),'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','authority_token',repeat('b',64)),timestamptz '2026-09-09 00:00:00+00',timestamptz '2026-09-09 00:15:00+00',repeat('d',64))",'hotel_seven_arches_public_quote_issuances_empty');
negative('unexpected_context',"INSERT INTO public.hotel_seven_arches_public_booking_transaction_context(backend_pid,transaction_id,booking_id,hotel_id,quote_fingerprint,authority_token) VALUES(pg_backend_pid(),txid_current(),gen_random_uuid(),'9b6d99a0-923a-4fbc-be54-c066e856e6ca',repeat('a',64),repeat('b',64))",'hotel_seven_arches_public_booking_transaction_context_empty');
// Actual foreign backend lock, not a mocked pg_locks result. Release our own
// session normally; never terminate any pre-existing process or cluster.
const locker=spawn(bin,args,{stdio:['pipe','pipe','pipe']});let locked='';locker.stdout.on('data',b=>locked+=b);locker.stdin.write("BEGIN;LOCK TABLE public.hotel_bookings IN ROW EXCLUSIVE MODE;SELECT 'OWNED_LOCK_READY';\n");
try{for(let i=0;i<100&&!locked.includes('OWNED_LOCK_READY');i++)await new Promise(r=>setTimeout(r,25));assert.match(locked,/OWNED_LOCK_READY/);const s=gates.preaction.specs.find(s=>s.name==='other_booking_relation_locks');assert.notEqual(sql(s.query),s.expected);results.negatives.push({name:'dangerous_foreign_writer_lock',pass:true});}finally{locker.stdin.end('ROLLBACK;\n\\q\n');await new Promise(r=>locker.on('exit',r));}
const future=stages.find(s=>s>stage);if(future)negative('future_stage_recording',`INSERT INTO supabase_migrations.schema_migrations VALUES('202608${future}00')`,'recorded_'+future);
{const existing=sql(compactFunctionQuery);const changed=sql(`BEGIN;CREATE FUNCTION public.hotel_v2_future_rollout_collision() RETURNS boolean LANGUAGE sql AS 'SELECT true';${compactFunctionQuery};ROLLBACK;`);assert.notEqual(existing,changed);results.negatives.push({name:'future_function_universe_collision',pass:true});}
assert.equal(snapshot(),before);results.preaction_after_negatives=run('preaction');
const started=performance.now();sql(migration(stage).sql);results.install_ms=+(performance.now()-started).toFixed(3);assert.equal(snapshot(),before,'pre-existing business/receipt tables must be unchanged');
assert.equal(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY stage),'[]'::jsonb) FROM hotels_lineage_private.successor_receipts r WHERE stage<>${stage}`),historicalSuccessors);results.historical_successor_rows_preserved=true;
results.postinstall=run('postinstall');results.integrity=stageMatrix(sql,stage);results.preserved_existing_tables=tables.length;
const newTable=stageTables[stage][0],relationLeaf=gates.postinstall.specs.find(s=>s.section==='stage_relation_catalog'&&s.name===newTable);
for(const [name,ddl]of [['new_table_owner',`ALTER TABLE ${newTable} OWNER TO authenticated`],['new_table_acl',`GRANT SELECT ON ${newTable} TO anon`],['new_table_rls',`ALTER TABLE ${newTable} ${stage===114450?'ENABLE':'DISABLE'} ROW LEVEL SECURITY`],['new_table_policy',`CREATE POLICY synthetic_unexpected_policy ON ${newTable} USING(true)`],['new_schema_owner',`ALTER SCHEMA ${newTable.split('.')[0]} OWNER TO authenticated`],['new_schema_acl',`GRANT CREATE ON SCHEMA ${newTable.split('.')[0]} TO authenticated`]]){
 assert.equal(sql(`BEGIN;${ddl};${relationLeaf.query};ROLLBACK;`),'false',name);results.negatives.push({name,pass:true});
}
if(stage>=114460){
 const context="jsonb_build_object('actor','10000000-0000-4000-8000-000000000002','partner_id','20000000-0000-4000-8000-000000000001','hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca')";
 const authorize=stage===114460?"UPDATE public.hotel_partner_hotel_permissions SET initiate_stripe_onboarding=true WHERE partner_id='20000000-0000-4000-8000-000000000001';":`SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);SELECT public.hotel_v2_admin_set_partner_stripe_onboarding_authorization('20000000-0000-4000-8000-000000000001',true,0,gen_random_uuid(),'Synthetic rolled-back authorization test');`;
 const cases=[
  ['unauthorized_partner_onboarding','',`public.hotel_v2_stripe_connect_service('begin',${context}||'{"actor":"90000000-0000-4000-8000-000000000001"}'::jsonb)`,'hotel_stripe_connect_access_denied'],
  ['global_without_partner_permission',"UPDATE public.site_settings SET hotel_stripe_connect_enabled=true WHERE id=1;"+(stage===114460?"UPDATE public.hotel_partner_hotel_permissions SET initiate_stripe_onboarding=false;":''),`public.hotel_v2_stripe_connect_service('begin',${context})`,'hotel_stripe_connect_access_denied'],
  ['partner_permission_without_global_capability',authorize,`public.hotel_v2_stripe_connect_service('begin',${context})`,'hotel_stripe_connect_disabled'],
  ['connected_account_identity_mismatch',authorize+"UPDATE public.site_settings SET hotel_stripe_connect_enabled=true WHERE id=1;INSERT INTO hotel_stripe_connect_private.accounts(partner_id,account_id,live_mode,status) VALUES('20000000-0000-4000-8000-000000000001','acct_SyntheticExisting',false,'CONNECTED');",`public.hotel_v2_stripe_connect_service('refresh',${context}||'{"account_id":"acct_SyntheticOther","expected_revision":1,"status":"CONNECTED"}'::jsonb)`,'hotel_stripe_connect_revision_conflict']
 ];
 for(const [name,setup,call,message]of cases){
  sql(`BEGIN;SET LOCAL session_replication_role=replica;${setup} DO $negative$ BEGIN BEGIN PERFORM ${call};RAISE EXCEPTION 'negative_not_rejected';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>${literal(message)} THEN RAISE;END IF;END;END $negative$;ROLLBACK;`);
  results.negatives.push({name,expected_error:message,pass:true,external_calls:0});
 }
 assert.equal(snapshot(),before);results.postinstall_after_stripe_negatives=run('postinstall');
}
// Postinstall must fail after history recording: physical proof precedes repair.
sql(`INSERT INTO supabase_migrations.schema_migrations VALUES('202608${stage}00')`);results.after_recording=run('postinstall',false);assert.deepEqual(results.after_recording.failed,['recorded_'+stage]);
console.log('REMAINING_STAGE_RESULT='+JSON.stringify(results));
