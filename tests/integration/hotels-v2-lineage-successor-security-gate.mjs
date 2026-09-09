import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const db=process.env.HOTELS_RECONCILIATION_DB,bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(bin);
function run(input){return spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:8e6});}
function sql(input){const r=run(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const anchor='SELECT hotels_lineage_private.current_anchor_is_exact()';
assert.equal(sql(anchor),'t');assert.equal(sql('SELECT count(*) FROM hotels_lineage_private.successor_receipts'),'2');
const tables=JSON.parse(sql(`SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
 AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private','hotels_lifecycle_private','hotel_stripe_connect_private')`));
const snapshot=()=>sql('SELECT jsonb_object_agg(name,hash) FROM ('+tables.map(t=>
 `SELECT '${t}' name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') q');
const before=snapshot();
const signatureLiteral=s=>"'"+s.replaceAll("'","''")+"'";
const sourceFault=s=>`DO $fault$ DECLARE p pg_proc%rowtype; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(${signatureLiteral(s)});
 EXECUTE replace(pg_get_functiondef(p.oid),p.prosrc,p.prosrc||E'\n-- unknown successor source'); END $fault$`;
const manifested=JSON.parse(sql('SELECT jsonb_agg(k ORDER BY k) FROM (SELECT DISTINCT k FROM hotels_lineage_private.successor_receipts c,LATERAL jsonb_object_keys(c.bindings) x(k)) s'));
const cases=manifested.map(s=>['unknown_source:'+s,sourceFault(s)]);
cases.push(
 ['missing_reconciliation','DELETE FROM hotels_lineage_private.reconciliation_receipts'],
 ['missing_114450_certificate','DELETE FROM hotels_lineage_private.successor_receipts WHERE stage=114450'],
 ['missing_114480_certificate','DELETE FROM hotels_lineage_private.successor_receipts WHERE stage=114480'],
 ['missing_provider_receipt','DELETE FROM hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'],
 ['missing_lifecycle_foundation','DELETE FROM hotels_lifecycle_private.foundation'],
 ['missing_lifecycle_binding',"DELETE FROM hotels_lifecycle_private.bindings WHERE signature=(SELECT min(signature) FROM hotels_lifecycle_private.bindings)"],
 ['tampered_lifecycle_before_source',"UPDATE hotels_lifecycle_private.bindings SET before_source=before_source||E'\n-- changed' WHERE signature=(SELECT min(signature) FROM hotels_lifecycle_private.bindings)"],
 ['unknown_lifecycle_catalog','ALTER TABLE hotels_lifecycle_private.context ADD COLUMN unexpected integer'],
 ['unknown_reconciliation_catalog',"CREATE FUNCTION hotels_lineage_private.unexpected() RETURNS boolean LANGUAGE sql AS 'SELECT true'"],
 ['successor_acl','GRANT SELECT ON hotels_lineage_private.successor_receipts TO authenticated'],
 ['successor_trigger','ALTER TABLE hotels_lineage_private.successor_receipts DISABLE TRIGGER successor_immutable'],
 ['successor_rls','ALTER TABLE hotels_lineage_private.successor_receipts DISABLE ROW LEVEL SECURITY'],
 ['bridge_public_execute','GRANT EXECUTE ON FUNCTION public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact() TO PUBLIC'],
 ['bridge_unknown_source',sourceFault('public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()')],
 ['low_projector_unknown_source',sourceFault('hotels_lifecycle_private.catalog_snapshot()')],
 ['low_hash_security','ALTER FUNCTION hotels_lifecycle_private.hash(jsonb) SECURITY DEFINER'],
 ['wrong_predecessor_link',`UPDATE hotels_lineage_private.successor_receipts SET previous_hash=repeat('0',64),
 receipt_hash=public.hotel_v2_h3_2b_hash(jsonb_build_object('stage',stage,'previous_hash',repeat('0',64),'bindings',bindings)) WHERE stage=114480`],
 ['tampered_after_pin',`WITH changed AS (SELECT stage,previous_hash,jsonb_set(bindings,
 ARRAY[(SELECT min(k) FROM jsonb_object_keys(bindings) x(k)),'after_source'],to_jsonb(repeat('0',64))) b
 FROM hotels_lineage_private.successor_receipts WHERE stage=114480)
 UPDATE hotels_lineage_private.successor_receipts c SET bindings=changed.b,
 receipt_hash=public.hotel_v2_h3_2b_hash(jsonb_build_object('stage',changed.stage,'previous_hash',changed.previous_hash,'bindings',changed.b))
 FROM changed WHERE c.stage=changed.stage`]
);
for(const [name,mutation] of cases){
 const result=sql(`BEGIN;SET LOCAL session_replication_role=replica;${mutation};SET LOCAL session_replication_role=origin;${anchor};ROLLBACK;`);
 assert.equal(result,'f',`${name}: validator did not reject`);console.log(`${name}=PASS`);
}
for(const stage of [114450,114480,114481]){
 const result=run(`BEGIN;SELECT hotels_lineage_private.seal_successor(${stage});ROLLBACK;`);
 assert.notEqual(result.status,0);assert.match(result.stderr,/successor_after_boundary_mismatch/);
}
assert.equal(snapshot(),before);assert.equal(sql(anchor),'t');
console.log(`SUCCESSOR_SECURITY_NEGATIVES=${cases.length}/${cases.length}; REPLAY_AND_UNKNOWN_STAGE=3/3; ROWS_PRESERVED=${tables.length}/${tables.length}`);
// Runtime call counters are transaction-local diagnostic settings only.
const counters=JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL track_functions='all';
 DO $trace$ DECLARE t timestamptz; ok boolean; before_calls bigint; BEGIN
 t:=clock_timestamp();ok:=hotels_lineage_private.current_anchor_is_exact();
 IF ok IS NOT TRUE THEN RAISE EXCEPTION 'anchor failed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_stat_xact_user_functions WHERE funcid IN(
 'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure,
 'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'::regprocedure) AND calls<>0)
 THEN RAISE EXCEPTION 'anchor reentered composite'; END IF;
 before_calls:=coalesce((SELECT calls FROM pg_stat_xact_user_functions WHERE funcid='public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure),0);
 PERFORM public.hotel_v2_seven_arches_pricing_scoped_lineage();
 IF (SELECT calls FROM pg_stat_xact_user_functions WHERE funcid='public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)<>before_calls+1
 THEN RAISE EXCEPTION 'scoped recursion'; END IF;
 END $trace$;
 SELECT jsonb_build_object('transaction_read_only',current_setting('transaction_read_only'),
 'scoped_calls',coalesce((SELECT calls FROM pg_stat_xact_user_functions WHERE funcid='public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure),0),
 'provider_bridge_calls',coalesce((SELECT calls FROM pg_stat_xact_user_functions WHERE funcid='public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'::regprocedure),0));ROLLBACK;`));
assert.equal(counters.scoped_calls,1);assert.equal(counters.provider_bridge_calls,0);
console.log(JSON.stringify({runtime_non_recursion:'PASS',...counters}));
