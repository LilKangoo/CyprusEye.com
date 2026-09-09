import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const db = process.env.HOTELS_RECONCILIATION_DB;
assert.match(db || '', /^hotels_114416_[a-z0-9_]+$/);
const bin = process.env.HOTELS_RECONCILIATION_PSQL;
assert.ok(bin);
const args=['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db,'-At'];
function sql(text){const r=spawnSync(bin,args,{input:text,encoding:'utf8',maxBuffer:16e6});
 if(r.stderr)process.stderr.write(r.stderr);assert.equal(r.status,0,'local SQL failed');return r.stdout.trim();}
assert.equal(sql("select current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const load=path=>readFileSync(new URL(path,root),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
if(['baseline','baseline0','baseline0external'].includes(process.argv[2])){
 const historical=load('supabase/migrations/20260811370000_hotels_v2_pgcrypto_digest_schema_hotfix.sql');
 const writer=historical.match(/create or replace function public\.hotel_v2_admin_apply_partner_hotel_permissions\([\s\S]*?\$function\$;/)[0];
 function expand(path){
   assert.ok(path.startsWith(fileURLToPath(root)));
   let source=readFileSync(path,'utf8');
   if(process.argv[2].startsWith('baseline0') && path.endsWith('hotels-v2-seven-arches-reviewed-pricing-evolution-postgres-gate.sql')){
     source=source.slice(0,source.indexOf('-- Focused PostgreSQL contract gate'));
   }
   if(process.argv[2]==='baseline0external' && path.endsWith('hotels-v2-seven-arches-independent-pricing-topology-postgres-gate.sql')){
     // Approved production base values are inputs to the real local Preview,
     // before any receipt exists; never rewrite prices or sealed receipts.
     const needle="'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00";
     assert.equal(source.split(needle).length-1,2);
     source=source.replaceAll(needle,"'upper_base_nightly_rate',100.00,'ground_base_nightly_rate',100.00");
   }
   if(path.endsWith('hotels-v2-seven-arches-pricing-activation-postgres-base.sql')){
     source=source.replace('\\ir ../../supabase/migrations/20260811380000',()=>writer+'\n\\ir ../../supabase/migrations/20260811380000');
   }
   return source.replace(/^\\ir ([^\n]+)$/gm,(_,child)=>expand(resolve(dirname(path),child.trim())));
 }
 // Existing synthetic Stage2F fixture only: fake cron relation, no pg_cron
 // installation or scheduler invocation. Never call the worker or live APIs.
 console.log(sql((process.argv[2]==='baseline0external'?'\\set provider_install_external_enabled true\n':'')+
   expand(fileURLToPath(new URL('tests/integration/hotels-v2-seven-arches-reviewed-pricing-evolution-postgres-gate.sql',root)))));
}
if(process.argv[2]==='fixture'){
  // Restore only the production-applied writer seam missing from this older
  // synthetic chain. Never run the unrelated historical migration wholesale.
  const historical=load('supabase/migrations/20260811370000_hotels_v2_pgcrypto_digest_schema_hotfix.sql');
  const match=historical.match(/create or replace function public\.hotel_v2_admin_apply_partner_hotel_permissions\([\s\S]*?\$function\$;/);
  assert.ok(match);
  const writer=match[0].replace('or setting.hotel_external_sync_enabled','or false');
  assert.equal(sha(writer.split('$function$')[1]),'aed6f0c7ae4d3590aa8b997d5d661790e42851e5ab1cf07d91e282117c532bc8');
  sql(writer);
  console.log(sql(`BEGIN;
    SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true) IS NOT NULL;
    DO $fixture$ DECLARE s jsonb; p jsonb; a public.hotel_admin_availability_foundation_evolution_receipts%rowtype; BEGIN
      SELECT * INTO STRICT a FROM public.hotel_admin_availability_foundation_evolution_receipts WHERE id=1;
      s:=public.hotel_v2_admin_get_partner_hotel_permissions(a.hotel_id);
      p:=jsonb_build_object('contract_version','hotels_v2_h3_2a_partner_permissions_v1',
        'decision','apply_partner_hotel_permissions','hotel_id',a.hotel_id,
        'assignment_id',a.assignment_id,'partner_id',a.partner_id,
        'reviewed_at',clock_timestamp(),'snapshot_token',s->'snapshot_token',
        'expected_assignment_fingerprint',s->'assignment_fingerprint',
        'expected_permission_version',1,'capabilities',
        a.after_permission->'capabilities'||'{"initiate_stripe_onboarding":true,"request_booking_changes":true}'::jsonb);
      PERFORM public.hotel_v2_admin_apply_partner_hotel_permissions(p,gen_random_uuid(),gen_random_uuid());
    END $fixture$;
    COMMIT;
    SELECT public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NULL,
      public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
      public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
      public.hotel_v2_seven_arches_pricing_activation_current_is_safe();`));
}
if(process.argv[2]==='probe'){
 const tables=JSON.parse(sql(`SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
  AND n.nspname IN ('public','hotels_v2_private','auth')`));
 const snapshot=()=>sql('SELECT jsonb_object_agg(name,fingerprint) FROM ('+tables.map(t=>
   `SELECT '${t}' name, public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) fingerprint FROM ${t} x`).join(' UNION ALL ')+') x');
 const before=snapshot();
 const migration=load('supabase/migrations/20260811441600_hotels_v2_seven_arches_authorized_lineage_reconciliation.sql');
 console.log(sql(migration+
   "\nSELECT hotels_lineage_private.permission_evidence() IS NOT NULL AS audit_exact;"));
 assert.equal(snapshot(),before,'installation changed an existing row');
 const replay=spawnSync(bin,args,{input:migration,encoding:'utf8',maxBuffer:16e6});
 assert.notEqual(replay.status,0);assert.match(replay.stderr,/hotels_114416_boundary_mismatch/);
 assert.equal(snapshot(),before,'replay changed an existing row');
 console.log(`EXISTING_RELATIONS_PRESERVED=${tables.length}/${tables.length}; REPLAY_FAIL_CLOSED=PASS`);
}
if(process.argv[2]==='negatives'){
 const ready="SELECT hotels_lineage_private.current_anchor_is_exact(),public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),public.hotel_v2_seven_arches_pricing_activation_current_is_safe()";
 assert.equal(sql(ready),'t|t|t|t');
 const predicates="SELECT hotels_lineage_private.current_anchor_is_exact() AND hotels_lineage_private.catalog_is_exact(public.hotel_v2_seven_arches_independent_pricing_activation_lineage()->'lower_catalog',(SELECT historical_activation_lineage->'lower_catalog' FROM public.hotel_seven_arches_independent_pricing_evolution_receipts WHERE id=1))";
 const permission='public.hotel_partner_hotel_permissions';
 const scope="hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'";
 const table='public.hotel_admin_availability_foundation_evolution_receipts';
 const constraint='hotel_admin_availability_evolution_owner_membership_exact';
 const cases=[
  ['version2_without_audit',`DELETE FROM public.hotel_activity_log WHERE source='hotels_v2_h3_2a_partner_permissions' AND ${scope}`],
  ['foreign_partner',`UPDATE ${permission} SET partner_id='20000000-0000-4000-8000-999999999999' WHERE ${scope}`],
  ['foreign_assignment',`UPDATE ${permission} SET assignment_id='32000000-0000-4000-8000-999999999999' WHERE ${scope}`],
  ['foreign_hotel',`UPDATE ${permission} SET hotel_id='c1000000-0000-4000-8000-999999999999' WHERE ${scope}`],
  ['wrong_capability_delta',`UPDATE ${permission} SET initiate_stripe_onboarding=false WHERE ${scope}`],
  ['missing_action_receipt',`DELETE FROM public.hotel_partner_action_receipts WHERE action='apply_partner_hotel_permissions' AND ${scope}`],
  ['missing_outbox',`DELETE FROM public.hotel_partner_event_outbox WHERE event_type='hotel.partner_permissions.updated' AND ${scope}`],
  ['missing_admin_attribution',`UPDATE public.hotel_activity_log SET actor_type='partner' WHERE source='hotels_v2_h3_2a_partner_permissions' AND ${scope}`],
  ['third_capability_change',`UPDATE ${permission} SET manage_prices=false WHERE ${scope}`],
  ['version1_to3',`UPDATE ${permission} SET version=3 WHERE ${scope}`],
  ['semantic_constraint_change',`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}; ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK(true)`],
  ['missing_constraint',`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`],
  ['unvalidated_constraint',`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}; ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK(true) NOT VALID`],
  ['different_digest_dependency',`DO $negative$ DECLARE definition text; BEGIN
    SELECT pg_get_constraintdef(oid) INTO STRICT definition FROM pg_constraint
      WHERE conrelid='${table}'::regclass AND conname='${constraint}';
    IF position('extensions.digest' IN definition)=0 THEN RAISE EXCEPTION 'fixture qualifier missing'; END IF;
    EXECUTE 'ALTER TABLE ${table} DROP CONSTRAINT ${constraint}';
    EXECUTE 'ALTER TABLE ${table} ADD CONSTRAINT ${constraint} '||replace(definition,'extensions.digest','public.digest');
    END $negative$`],
  ['writer_identity',"ALTER FUNCTION public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid) RENAME TO local_wrong_writer"],
  ['receipt_guard_disabled','ALTER TABLE hotels_lineage_private.reconciliation_receipts DISABLE TRIGGER reconciliation_immutable'],
  ['receipt_acl_drift','GRANT SELECT ON hotels_lineage_private.reconciliation_receipts TO authenticated'],
 ];
 for(const [name,mutation] of cases){
  const output=sql(`BEGIN; SET LOCAL session_replication_role=replica; ${mutation}; SET LOCAL session_replication_role=origin; ${predicates}; ROLLBACK;`);
  assert.ok(/\nf\nROLLBACK$/.test(output),`${name} failed closed: ${output}`);
  console.log(`${name}=PASS`);
 }
 const historical="(SELECT historical_activation_lineage->'lower_catalog' FROM public.hotel_seven_arches_independent_pricing_evolution_receipts WHERE id=1)";
 const catalogProof=sql(`WITH h AS (SELECT ${historical} j), qualified AS(
  SELECT j,replace(j::text,'extensions.digest','pg_catalog.digest')::jsonb q FROM h)
  SELECT hotels_lineage_private.catalog_is_exact(j,j),
  hotels_lineage_private.catalog_is_exact(q,j),
  NOT hotels_lineage_private.catalog_is_exact(replace(j::text,'sha256','sha512')::jsonb,j)
  FROM qualified;`);
 assert.equal(catalogProof,'t|t|t');
 assert.equal(sql(ready),'t|t|t|t');
 console.log(`SECURITY_NEGATIVES=${cases.length}/${cases.length}; CATALOG_POSITIVES=2/2; CATALOG_SEMANTIC_NEGATIVE=1/1; ROLLBACK=PASS`);
}
