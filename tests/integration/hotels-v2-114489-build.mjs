// Offline generation only; this program never connects to PostgreSQL.
// Historical sources are not edited. Missing runtime source evidence is an
// explicit installation stop, not a guessed hash or silently omitted guard.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extractEvidence,root,sha} from './hotels-v2-114489-source-evidence.mjs';
import {compile,schema,hotel,evidenceRoots,certificateSQL,replaceCalls} from './hotels-v2-114489-foundation-compiler.mjs';
import {lit} from './hotels-v2-114483-read-compiler.mjs';
import {propertyAwareHistoricalHotelBody} from './hotels-v2-114489-projection.mjs';
export const migrationPath='supabase/migrations/20260811448900_hotels_v2_published_rooms_v2_conversion.sql';
const read=p=>readFileSync(root+p,'utf8');
const targetGuard=`IF p_plan->>'hotel_id' IS DISTINCT FROM '${hotel}' THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;`;
function historicalFunction(file,name){
 const sql=read(file),start=sql.toLowerCase().indexOf('create function '+name+'(');
 assert.ok(start>=0,name);const tail=sql.slice(start),m=/\bas\s+(\$\w*\$)/i.exec(tail);assert.ok(m,name);
 const end=tail.indexOf(m[1],m.index+m[0].length);assert.ok(end>0);
 return {header:tail.slice(0,m.index),body:tail.slice(m.index+m[0].length,end)};
}
export function build({catalog,evidenceOptions}={}){
 const evidence=extractEvidence(evidenceOptions);
 const oldProperty=historicalFunction('supabase/migrations/20260811340000_hotels_v2_admin_b_content_room_assignment_control.sql','public.hotel_v2_admin_apply_property_control_plan');
 const oldProposal=historicalFunction('supabase/migrations/20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql','public.hotel_v2_admin_apply_partner_property_proposal_plan');
 const acceptedFunction=signature=>{
  if(!catalog)return null;
  const open=signature.indexOf('(');
  const name=signature.slice(0,open);
  const types=signature.slice(open+1,-1).replace(/\s+/g,'');
  const found=catalog.filter(p=>
   p.name===name &&
   String(p.types??'').replace(/\s+/g,'')===types
  );
  assert.equal(
   found.length,
   1,
   'hotels_114489_accepted_writer_not_unique:'+signature
  );
  assert.equal(
   typeof found[0].src,
   'string',
   'hotels_114489_accepted_writer_source_missing:'+signature
  );
  assert.ok(
   Array.isArray(found[0].meta),
   'hotels_114489_accepted_writer_metadata_missing:'+signature
  );
  assert.equal(
   sha(found[0].src),
   found[0].meta[0],
   'hotels_114489_accepted_writer_source_hash_drift:'+signature
  );
  return found[0];
 };

 const compatibilityNeedle=
  'hotel_rooms_v2_enabled or hotel_external_sync_enabled';

 const compatibilityReplacement=
  'hotel_rooms_v2_enabled or false';

 assert.equal(
  oldProperty.body.split(compatibilityNeedle).length,
  2
 );

 const expectedCompatibleProperty=
  oldProperty.body.replace(
   compatibilityNeedle,
   compatibilityReplacement
  );

 const acceptedProperty=
  acceptedFunction(
   'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)'
  );

 const acceptedProposal=
  acceptedFunction(
   'public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)'
  );

  assert.equal(
   sha(expectedCompatibleProperty),
   'e7b3f50952b25e596c662519fca4e02f9dff128ffd707533faf1664e3867752c',
   'hotels_114489_expected_114350_property_hash_drift'
  );

  assert.equal(
   acceptedProperty?.src??expectedCompatibleProperty,
   expectedCompatibleProperty,
   'hotels_114489_property_predecessor_not_exact_114350_compatibility_evolution'
  );

  assert.equal(
   sha(acceptedProperty?.src??expectedCompatibleProperty),
   'e7b3f50952b25e596c662519fca4e02f9dff128ffd707533faf1664e3867752c',
   'hotels_114489_property_predecessor_hash_drift'
  );

  assert.equal(
   acceptedProposal?.src??oldProposal.body,
   oldProposal.body,
   'hotels_114489_proposal_predecessor_drift'
  );

  assert.equal(
   sha(acceptedProposal?.src??oldProposal.body),
   'd1d166b0662601f466c517014f641c4555c563f9fb71e0c0dd2b2de43fbb869b',
   'hotels_114489_proposal_predecessor_hash_drift'
  );
 // Repository route derives the exact, hash-bound 114350 evolution from
 // checked-in source; an explicit catalog must prove the same predecessor.
 const propertyPredecessor=acceptedProperty?.src??expectedCompatibleProperty;
 const proposalPredecessor=acceptedProposal?.src??oldProposal.body;

 let property=propertyPredecessor;
 const oldFlags=`if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then`;
 const predecessorFlags=oldFlags.replace(compatibilityNeedle,compatibilityReplacement);
 assert.equal(property.split(predecessorFlags).length,2);
 property=property.replace(predecessorFlags,`if hotels_published_architecture_private.require_lifecycle() IS NULL then`);
 property=property.replace('public.hotel_v2_admin_get_content_control(', 'public.hotel_v2_admin_get_content_control_114487(');
 property=property.replaceAll('public.hotel_v2_admin_get_content_control(', 'public.hotel_v2_admin_get_content_control_114487(');
 // The predecessor's original stale/no-op/media/private-profile/expiry checks
 // remain byte-for-byte intact. Identity and commercial fields are prohibited.
 property=property.replace(/\bbegin\b/i,`begin
 ${targetGuard}
 PERFORM hotels_published_architecture_private.assert_exact();
 IF (p_plan->'payload') ?| ARRAY['owner_partner_id','architecture_version','is_published','currency','booking_mode','minimum_stay_nights','maximum_stay_nights'] THEN
  RAISE EXCEPTION USING errcode='22023',message='hotels_114489_non_content_change'; END IF;`);
 let proposal=proposalPredecessor.replace('public.hotel_v2_admin_apply_property_control_plan(', 'public.hotel_v2_admin_apply_property_control_plan_114489(');
 proposal=proposal.replace(/\bbegin\b/i,`begin
 IF p_reviewed_plan->>'hotel_id' IS DISTINCT FROM '${hotel}' THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;
 PERFORM hotels_published_architecture_private.assert_exact();`);
 const writers=[
  oldProperty.header.replace('public.hotel_v2_admin_apply_property_control_plan(',schema+'.property_writer(')+`AS ${lit(property)};`,
  oldProposal.header.replace('public.hotel_v2_admin_apply_partner_property_proposal_plan(','public.hotel_v2_admin_apply_partner_property_proposal_plan_114489(')+`AS ${lit(proposal)};`,
 ].join('\n');
 let foundation,unresolved=[];
 foundation=compile(catalog||evidence.catalog,{
   roots:[...evidenceRoots,'public.hotel_v2_partner_get_workspace'],
   forceCloneRoots:['public.hotel_v2_partner_get_workspace']
  });
 foundation.certificate=certificateSQL(foundation.predecessors||[...evidence.records.values()].filter(b=>b.meta.length===16),[
  'public.hotel_v2_admin_get_published_architecture_conversion_114489(uuid)',
  'public.hotel_v2_admin_convert_legacy_hotel_to_v2_114489(jsonb,uuid,text)',
  'public.hotel_v2_admin_apply_property_control_plan_114489(jsonb,uuid)',
  'public.hotel_v2_admin_apply_partner_property_proposal_plan_114489(jsonb,uuid)',
  'public.hotel_v2_partner_get_workspace_114489(uuid,uuid,date,date)',
  'public.hotel_v2_public_get_seven_arches_display_114489()',
 ]);
 const historicalDDL=`CREATE FUNCTION ${schema}.historical_hotel(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS ${lit(propertyAwareHistoricalHotelBody)};`;
 if(!unresolved.length) foundation.sql=foundation.sql.replace(foundation.historicalDDL,'');
 const access=historicalFunction('supabase/migrations/20260811380000_hotels_v2_h3_2b_partner_hotel_workspace.sql','public.hotel_v2_h3_2b_access_snapshot');
 const accessBody=access.body.replace("hotel.architecture_version='legacy'","hotel.architecture_version IN('legacy','rooms_v2')")
  .replace(/\bbegin\b/i,`begin
 IF p_partner_id IS DISTINCT FROM '0a321bfe-da6b-43f6-8e0b-7c68546a8b18'::uuid OR p_hotel_id IS DISTINCT FROM '${hotel}'::uuid THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required'; END IF;
 PERFORM ${schema}.assert_receipt_exact();
 PERFORM ${schema}.require_lifecycle();`);
 const accessDDL=access.header.replace('public.hotel_v2_h3_2b_access_snapshot(',schema+'.access_snapshot(')+`AS ${lit(accessBody)};`;
 if(!unresolved.length){
  for(const c of foundation.clones){
   const transformed=replaceCalls(c.source,[['public.hotel_v2_h3_2b_access_snapshot',schema+'.access_snapshot']]).source;
   if(transformed===c.source)continue;
   const needle=lit(c.source);
   assert.equal(
    foundation.sql.split(needle).length,
    2,
    'hotels_114489_clone_source_literal_not_unique'
   );
   foundation.sql=foundation.sql.replace(needle,()=>lit(transformed));
  }
 }
 let workspaceFoundation=null;
 if(!unresolved.length){
  const workspaceRoot=foundation.roots.find(
   r=>r.name==='public.hotel_v2_partner_get_workspace'
  );
  assert.ok(
   workspaceRoot,
   'hotels_114489_workspace_compiler_root_missing'
  );
  assert.ok(
   workspaceRoot.successor.startsWith(schema+'.foundation_'),
   'hotels_114489_workspace_root_not_cloned'
  );
  assert.ok(
   foundation.clones.some(c=>c.name===workspaceRoot.successor),
   'hotels_114489_workspace_clone_definition_missing'
  );
  workspaceFoundation=workspaceRoot.successor;
 } else {
  workspaceFoundation=schema+'.foundation_unresolved_workspace';
 }

 let volatileSuccessorDDL='';
 if(!unresolved.length){
  const acceptedCatalog=catalog||evidence.catalog;
  const compact=value=>String(value??'').replace(/\s+/g,'');
  const acceptedFunction=(name,types)=>{
   const rows=acceptedCatalog.filter(row=>
    row.name===name && compact(row.types)===compact(types)
   );
   assert.equal(rows.length,1,`hotels_114489_accepted_function_not_exact:${name}`);
   return rows[0];
  };

  const snapshotBase=acceptedFunction(
   'public.hotel_v2_admin_d_snapshot_external_base',
   'uuid,date,date,boolean'
  );
  const snapshot=acceptedFunction(
   'public.hotel_v2_admin_d_snapshot',
   'uuid,date,date,boolean'
  );
  const workspaceAccepted=acceptedFunction(
   'public.hotel_v2_partner_get_workspace',
   'uuid,uuid,date,date'
  );

  assert.equal(
   sha(snapshotBase.src),
   '0d8e57d5bb06811f3ad39f6d4a638783d4517bf6c0b660a64a551790059e625c',
   'hotels_114489_snapshot_external_base_source_drift'
  );
  assert.equal(
   sha(snapshot.src),
   '7f665d523ae4cd0ecd9183645e50b2898426e1e62fd1bd74b652b87a227c1e7b',
   'hotels_114489_snapshot_source_drift'
  );
  assert.equal(
   sha(workspaceAccepted.src),
   'ae51c6ed5516fe7c37b684ac843572af0d2b23b08ca28759b58c926c97df9798',
   'hotels_114489_workspace_source_drift'
  );

  for(const row of [snapshotBase,snapshot]){
   assert.equal(row.vol,'v','hotels_114489_snapshot_successor_must_be_volatile');
   assert.equal(row.lang,'plpgsql','hotels_114489_snapshot_successor_language_drift');
   assert.equal(row.meta?.[6],true,'hotels_114489_snapshot_successor_security_drift');
   assert.deepEqual(
    row.meta?.[4],
    ['search_path=pg_catalog, public, auth'],
    'hotels_114489_snapshot_successor_search_path_drift'
   );
  }

  const privateBase=
   schema+'.workspace_snapshot_external_base_114489';
  const privateSnapshot=
   schema+'.workspace_snapshot_114489';

  const legacyNeedle="architecture_version='legacy'";

  assert.equal(
   snapshotBase.src.split(legacyNeedle).length-1,
   1,
   'hotels_114489_snapshot_external_base_legacy_guard_not_exact'
  );

  let baseSource=snapshotBase.src.replace(
   legacyNeedle,
   "architecture_version IN('legacy','rooms_v2')"
  );

  baseSource=baseSource.replace(
   /\bbegin\b/i,
   `begin
 IF p_hotel_id IS DISTINCT FROM '${hotel}'::uuid THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required';
 END IF;
 PERFORM ${schema}.assert_exact();
 PERFORM ${schema}.require_lifecycle();`
  );

  assert.equal(
   sha(baseSource),
   '4835eb7d8d63b6285b4a234c68f047eee698c5e23f3158b2f329cb1098e9d9e3',
   'hotels_114489_snapshot_external_base_successor_hash_drift'
  );

  const snapshotReplacement=replaceCalls(
   snapshot.src,
   [[
    'public.hotel_v2_admin_d_snapshot_external_base',
    privateBase
   ]]
  );

  assert.equal(
   snapshotReplacement.patches.length,
   1,
   'hotels_114489_snapshot_external_base_call_not_exact'
  );

  let snapshotSource=snapshotReplacement.source.replace(
   /\bbegin\b/i,
   `begin
 IF p_hotel_id IS DISTINCT FROM '${hotel}'::uuid THEN
  RAISE EXCEPTION USING errcode='42501',message='hotels_114489_target_required';
 END IF;
 PERFORM ${schema}.assert_exact();
 PERFORM ${schema}.require_lifecycle();`
  );

  assert.equal(
   sha(snapshotSource),
   'e4979e39f5deb2d0eb55dd4e83bd942cc7184b6bde18f7f9b196e05154b31926',
   'hotels_114489_snapshot_successor_hash_drift'
  );

  const workspaceClone=foundation.clones.find(
   clone=>clone.name===workspaceFoundation
  );

  assert.ok(
   workspaceClone,
   'hotels_114489_workspace_foundation_clone_missing'
  );

  const workspaceAfterAccess=replaceCalls(
   workspaceClone.source,
   [[
    'public.hotel_v2_h3_2b_access_snapshot',
    schema+'.access_snapshot'
   ]]
  ).source;

  const workspaceSnapshotReplacement=replaceCalls(
   workspaceAfterAccess,
   [[
    'public.hotel_v2_admin_d_snapshot',
    privateSnapshot
   ]]
  );

  assert.equal(
   workspaceSnapshotReplacement.patches.length,
   1,
   'hotels_114489_workspace_snapshot_call_not_exact'
  );

  assert.equal(
   sha(workspaceSnapshotReplacement.source),
   '97cafd6ec02d18221b815b60b3d2e1c5e4982b1ec72956c97bc4f1451974fcb0',
   'hotels_114489_workspace_successor_hash_drift'
  );

  const workspaceNeedle=lit(workspaceAfterAccess);

  assert.equal(
   foundation.sql.split(workspaceNeedle).length,
   2,
   'hotels_114489_workspace_transformed_source_not_unique'
  );

  foundation.sql=foundation.sql.replace(
   workspaceNeedle,
   ()=>lit(workspaceSnapshotReplacement.source)
  );

  const privateVolatileDDL=(row,name,source)=>{
   assert.ok(row.args,'hotels_114489_snapshot_args_missing');
   assert.ok(row.types,'hotels_114489_snapshot_types_missing');
   assert.equal(row.ret,'jsonb','hotels_114489_snapshot_return_type_drift');

   return `CREATE FUNCTION ${name}(${row.args})
RETURNS ${row.ret}
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS ${lit(source)};
ALTER FUNCTION ${name}(${row.types}) OWNER TO postgres;
REVOKE ALL ON FUNCTION ${name}(${row.types})
 FROM PUBLIC,anon,authenticated,service_role;`;
  };

  volatileSuccessorDDL=[
   privateVolatileDDL(
    snapshotBase,
    privateBase,
    baseSource
   ),
   privateVolatileDDL(
    snapshot,
    privateSnapshot,
    snapshotSource
   )
  ].join('\n');
 }
 const workspaceDDL=`CREATE FUNCTION ${schema}.workspace_read(p_partner_id uuid,p_hotel_id uuid,p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $workspace$
 BEGIN RETURN ${workspaceFoundation}(p_partner_id,p_hotel_id,p_from,p_to); END $workspace$;`;
 const migration=`-- HOTELS 114489: published exact-target rooms_v2 successor. LOCAL SOURCE WIP.
-- POSTGRES_RUNTIME_TESTS=PENDING_ENVIRONMENT. NOT APPROVED FOR INSTALLATION.
-- Unresolved compiler evidence: ${unresolved.join(',')||'none'}.
-- Generated offline by tests/integration/hotels-v2-114489-build.mjs.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
DO $boundary$ BEGIN
 ${unresolved.length?"RAISE EXCEPTION USING errcode='55000',message='hotels_114489_pending_accepted_foundation_catalog';":''}
 IF to_regnamespace('${schema}') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448800')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448800')
 THEN RAISE EXCEPTION 'hotels_114489_boundary_mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.hotels'::regclass
 AND conname='hotels_h2a_rooms_v2_unpublished_check' AND contype='c' AND convalidated
 AND lower(regexp_replace(pg_get_expr(conbin,conrelid),'[[:space:]()]|::text','','g'))=
 'architecture_version=''legacy''orcoalesceis_published,false=false') THEN RAISE EXCEPTION 'hotels_114489_constraint_predecessor_missing'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)')) IS DISTINCT FROM '${sha(propertyPredecessor)}'
 OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)')) IS DISTINCT FROM '${sha(proposalPredecessor)}'
 THEN RAISE EXCEPTION 'hotels_114489_historical_writer_drift'; END IF;
END $boundary$;
${read('tests/integration/hotels-v2-114489-conversion-template.sql')}
${accessDDL}
${read('tests/integration/hotels-v2-114489-runtime-template.sql')}
${historicalDDL}
${foundation.sql}
${foundation.certificate.ddl}
${volatileSuccessorDDL}
${writers}
${workspaceDDL}
${read('tests/integration/hotels-v2-114489-entrypoints-template.sql')}
-- Preserve unrelated Hotels' unpublished-only rooms_v2 rule.
ALTER TABLE public.hotels DROP CONSTRAINT hotels_h2a_rooms_v2_unpublished_check;
ALTER TABLE public.hotels ADD CONSTRAINT hotels_h2a_rooms_v2_unpublished_check CHECK(
 architecture_version='legacy' OR coalesce(is_published,false)=false OR
 (id='${hotel}' AND architecture_version='rooms_v2' AND is_published=true));
DO $security$ DECLARE r record; BEGIN
 FOR r IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='${schema}'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.sig);
 END LOOP;
 FOR r IN SELECT oid::regclass rel FROM pg_class WHERE relnamespace='${schema}'::regnamespace AND relkind='r' LOOP
  EXECUTE format('ALTER TABLE %s OWNER TO postgres',r.rel);
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r.rel);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',r.rel);
  EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,anon,authenticated,service_role',r.rel);
 END LOOP;
 FOR r IN SELECT oid::regprocedure sig,proname FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN('hotel_v2_admin_get_published_architecture_conversion_114489','hotel_v2_admin_convert_legacy_hotel_to_v2_114489',
 'hotel_v2_admin_apply_property_control_plan_114489','hotel_v2_admin_apply_partner_property_proposal_plan_114489',
 'hotel_v2_partner_get_workspace_114489','hotel_v2_public_get_seven_arches_display_114489') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',r.sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.sig);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.sig);
  IF r.proname='hotel_v2_public_get_seven_arches_display_114489' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',r.sig); END IF;
 END LOOP;
END $security$;
${foundation.certificate.seal}
COMMIT;
`;
 return {
  migration,
  unresolved,
  missingBodies:evidence.missing,
  oldPropertyHash:sha(oldProperty.body),
  oldProposalHash:sha(oldProposal.body),
  predecessorPropertyHash:sha(propertyPredecessor),
  predecessorProposalHash:sha(proposalPredecessor)
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const catalogPath=process.env.HOTELS_114489_ACCEPTED_CATALOG;
 {
  const catalog=catalogPath?JSON.parse(readFileSync(catalogPath,'utf8')):undefined;
  const result=build({catalog});
  assert.deepEqual(result.unresolved,[]);
  assert.deepEqual(result.missingBodies,[]);
  assert.equal(sha(result.migration),'9e0b6d39bbeebcba0d386aca87ff8418ea8682763f9c5cfad964ef41c246af14',
   'E4C must reproduce the already certified migration; refusing to overwrite');
  writeFileSync(root+migrationPath,result.migration);
  console.log(JSON.stringify({
   migration:migrationPath,
   sha256:sha(result.migration),
   unresolved:result.unresolved,
   missingBodies:result.missingBodies
  },null,2));
 }
}
