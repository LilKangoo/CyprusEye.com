// Local-only, deterministic source-span compiler. Never executes a remote query.
// Only the pure-STABLE topology/receipt/current-state closure is factored.
// Workspace (including VOLATILE descendants), access and commission stay opaque.
import assert from 'node:assert/strict';
import {hash,lit,metadataBody,catalogQuery} from './hotels-v2-114483-read-compiler.mjs';
export {hash,catalogQuery};
export const schema='hotels_partner_read_once_private';
export const legacy='public.hotel_v2_partner_get_seven_arches_reviewed_pricing';
export const successor=legacy+'_114488';
export const migrationPath='supabase/migrations/20260811448800_hotels_v2_partner_reviewed_pricing_read_once.sql';
export const evidenceRoots=[
 'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact',
 'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact',
 'public.hotel_v2_seven_arches_reviewed_pricing_current_state',
];
export const mask=s=>(s.match(/\$(\w*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|\$[0-9]+|[^'$/-]+|./g)||[])
 .map(t=>t.startsWith("'")||/^\$\w*\$/.test(t)||t.startsWith('--')||t.startsWith('/*')?' '.repeat(t.length):t).join('');
const pattern=n=>'(?<![\\w.])'+n.replaceAll('.','\\.')+'\\s*\\(';
const sig=p=>p.name+'('+p.types+')';
const acl='{postgres=X/postgres}';
// The same exact metadata as 114483, extended with signature/result/parallel/kind.
// ACL entries retain privileges, grantability, grantor and multiplicity; only order is ignored.
export const exactMetadata=`SELECT (${metadataBody.replace('p.oid=p_oid','p.oid=q.oid')})||jsonb_build_array(
 pg_get_function_arguments(q.oid),oidvectortypes(q.proargtypes),q.prorettype::regtype::text,q.proparallel,q.prokind)
 FROM pg_proc q WHERE q.oid=p_oid`;
const meta=p=>[...p.meta,p.args,p.types,p.ret,p.parallel??'u',p.kind??'f'];
const newMeta=(p,src)=>[hash(src),null,'postgres',acl,p.config,'s',true,false,false,false,p.lang,p.args,p.types,p.ret,'u','f'];
const bodyMetadataCheck=(signature,expected,omitDefinition=false)=>`${schema}.metadata(to_regprocedure(${lit(signature)}))${omitDefinition?' - 1':''} IS DISTINCT FROM ${lit(JSON.stringify(omitDefinition?expected.filter((_,i)=>i!==1):expected))}::jsonb`;
const create=(p,src)=>`CREATE FUNCTION ${p.name}(${p.args}) RETURNS ${p.ret} LANGUAGE ${p.lang} STABLE SECURITY DEFINER ${p.settings} AS ${lit(src)};\nALTER FUNCTION ${sig(p)} OWNER TO postgres;\nREVOKE ALL ON FUNCTION ${sig(p)} FROM PUBLIC,anon,authenticated,service_role;`;

export function compile(all){
 const get=n=>{const found=all.filter(p=>p.name===n);assert.equal(found.length,1,n);return found[0];};
 const dependencies=p=>all.filter(d=>new RegExp(pattern(d.name)).test(mask(p.src)));
 const ordered=[],seen=new Set();
 function visit(p,stack=[]){
  if(seen.has(p.id))return;
  if(stack.includes(p.id)){assert.equal(p.vol,'i','only immutable recursion is accepted');return;}
  p.deps=dependencies(p);p.deps.forEach(d=>visit(d,[...stack,p.id]));seen.add(p.id);ordered.push(p);
 }
 evidenceRoots.forEach(n=>visit(get(n)));
 assert.ok(ordered.every(p=>['s','i'].includes(p.vol)),'VOLATILE evidence boundary');
 assert.ok(ordered.every(p=>!/(?:clock_timestamp|statement_timestamp|current_setting|set_config|random|nextval|pg_advisory_lock)\s*\(/i.test(mask(p.src))),'time/session evidence boundary');
 const excluded=new Set(['public.hotel_v2_h3_2b_flags_off','public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact']);
 const cached=ordered.filter(p=>p.vol==='s'&&!p.args&&['boolean','jsonb','text'].includes(p.ret)&&!excluded.has(p.name));
 const cachedIds=new Set(cached.map(p=>p.id));
 function needsContext(p,visited=new Set()){
  if(visited.has(p.id))return false;visited.add(p.id);
  return p.deps.some(d=>cachedIds.has(d.id)||needsContext(d,visited));
 }
 // Void assertions are NOT suppressed/cached. Their original bodies/raise paths
 // execute at the original callsites using the same already evaluated evidence.
 const chosen=ordered.filter(p=>p.vol==='s'&&needsContext(p));
 const clone=p=>schema+'.read_'+hash(sig(p)).slice(0,16);
 const value=p=>`(CASE WHEN (p_read_context#>>ARRAY[${lit(p.name)},'is_null'])::boolean THEN NULL::${p.ret} ELSE `+
  (p.ret==='jsonb'?`p_read_context#>ARRAY[${lit(p.name)},'value']`:`(p_read_context#>>ARRAY[${lit(p.name)},'value'])::${p.ret}`)+` END)`;
 const clones=chosen.map(p=>{
  const code=mask(p.src),patches=[];
  assert.ok(!/\$[0-9]+/.test(code),'positional parameter needs explicit mapping');
  for(const d of cached)for(const m of code.matchAll(new RegExp(pattern(d.name)+'\\s*\\)','g')))
   patches.push([m.index,m[0].length,p.src.slice(m.index,m.index+m[0].length),value(d)]);
  for(const d of chosen.filter(x=>!cachedIds.has(x.id)))for(const m of code.matchAll(new RegExp(pattern(d.name)+(d.args?'':'\\s*\\)'),'g')))
   patches.push([m.index,m[0].length,p.src.slice(m.index,m.index+m[0].length),clone(d)+'(p_read_context'+(d.args?',':')')]);
  // Parameterized clones may also be cached? Cached entries are strictly no-arg.
  patches.sort((a,b)=>b[0]-a[0]);let src=p.src,last=Infinity;
  for(const [start,length,old,replacement] of patches){assert.ok(start+length<=last);last=start;assert.equal(src.slice(start,start+length),old);src=src.slice(0,start)+replacement+src.slice(start+length);}
  const c={name:clone(p),args:'p_read_context jsonb'+(p.args?', '+p.args:''),types:'jsonb'+(p.types?', '+p.types:''),ret:p.ret,lang:p.lang,
   settings:(p.def.match(/^ SET [^\n]+/gm)||[]).join('\n'),config:p.meta[4],src,original:sig(p),patches};
  assert.ok(c.config?.some(s=>s.startsWith('search_path=')),'protected original search_path required');
  return c;
 });
 const root=get(legacy);assert.equal(hash(root.src),'55e5ffc18a938051f6c819d873b66adcb8ad48f02dbd5854ebe8dc0b16642a4e');
 // Pin full reachable legacy read graph (including opaque workspace boundaries)
 // without rewriting those functions. This also prevents stale clone reuse.
 const allPinned=new Map();function pin(p){if(allPinned.has(p.id))return;allPinned.set(p.id,p);dependencies(p).forEach(pin);}
 pin(root);pin(get('public.hotel_v2_admin_get_content_control_114487'));
 const predecessors=[...allPinned.values()].sort((a,b)=>sig(a).localeCompare(sig(b))).map(p=>({signature:sig(p),meta:meta(p)}));
 const metadata={name:schema+'.metadata',args:'p_oid oid',types:'oid',ret:'jsonb',lang:'sql',settings:'SET search_path=pg_catalog,public',config:['search_path=pg_catalog, public']};
 const guard={name:schema+'.assert_exact',args:'',types:'',ret:'void',lang:'plpgsql',settings:'SET search_path=pg_catalog,public',config:['search_path=pg_catalog, public']};
 const helperPins=clones.map(p=>({signature:sig(p),meta:newMeta(p,p.src)}));
 let guardBody=`DECLARE b jsonb; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='${schema}' AND n.nspowner='postgres'::regrole
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee<>n.nspowner))
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114488_private_security_drift'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${schema}.metadata(oid)'::regprocedure)
 IS DISTINCT FROM '${hash(exactMetadata)}' THEN RAISE EXCEPTION 'hotels_114488_metadata_drift'; END IF;
 IF ${bodyMetadataCheck(sig(metadata),newMeta(metadata,exactMetadata),true)} THEN RAISE EXCEPTION 'hotels_114488_metadata_security_drift'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(${lit(JSON.stringify(predecessors))}::jsonb) LOOP
  IF ${schema}.metadata(to_regprocedure(b->>'signature')) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114488_predecessor_drift:'||(b->>'signature'); END IF;
 END LOOP;
 FOR b IN SELECT value FROM jsonb_array_elements(${lit(JSON.stringify(helperPins))}::jsonb) LOOP
  IF (${schema}.metadata(to_regprocedure(b->>'signature')) - 1) IS DISTINCT FROM ((b->'meta') - 1)
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114488_read_helper_drift:'||(b->>'signature'); END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='${schema}'::regnamespace)<>${clones.length+2}
 THEN RAISE EXCEPTION 'hotels_114488_helper_universe_drift'; END IF;
 -- Non-circular runtime pin for the public entrypoint's security contract.
 -- Its exact source hash is independently checked by installation and tests.
 IF (${schema}.metadata(to_regprocedure('${successor}(uuid,uuid)')) - 0 - 0)
 IS DISTINCT FROM ${lit(JSON.stringify(['postgres','{authenticated=X/postgres,postgres=X/postgres}',['search_path=pg_catalog, public, auth'],'s',true,false,false,false,'plpgsql',root.args,root.types,'jsonb','u','f']))}::jsonb
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114488_entrypoint_security_drift'; END IF;
 END;`;
 let evaluate=`  -- Invocation-local only. MATERIALIZED forces one evaluation, including SQL NULL.
  -- No context crosses into the opaque access/workspace/VOLATILE boundaries.
  BEGIN\n`;
 for(const p of cached){const call=chosen.includes(p)?clone(p)+'(p_read_context)':p.name+'()';
  evaluate+=`    WITH evaluated AS MATERIALIZED (SELECT ${call} AS value)
    SELECT p_read_context||jsonb_build_object(${lit(p.name)},jsonb_build_object('is_null',value IS NULL,'value',value)) INTO p_read_context FROM evaluated;\n`;
 }
 evaluate+=`  EXCEPTION WHEN OTHERS THEN
    -- Original outer topology guard fails closed; never return partial evidence.
    -- PostgreSQL OTHERS deliberately excludes query_canceled/assert_failure.
    RAISE EXCEPTION USING errcode='55000',message='hotels_v2_seven_arches_reviewed_pricing_control_unavailable';
  END;\n`;
 let publicBody=root.src.replace('declare v_access jsonb;',"declare p_read_context jsonb:='{}'::jsonb; v_access jsonb;");
 const start='begin\n';assert.equal(publicBody.split(start).length,2);
 const wrongHotel=`  IF p_hotel_id IS DISTINCT FROM '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid THEN
    RAISE EXCEPTION USING errcode='55000',message='hotels_v2_seven_arches_reviewed_pricing_control_unavailable'; END IF;\n`;
 // Preserve original order: exact Hotel, protected evidence, Partner access, workspace, DTO.
 const guardCheck=`  IF (SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),pg_get_userbyid(p.proowner),p.proconfig,p.provolatile,p.prosecdef,p.proleakproof,p.proisstrict,p.proretset,l.lanname,
 (SELECT jsonb_agg(jsonb_build_array(a.grantee::regrole::text,a.grantor::regrole::text,a.privilege_type,a.is_grantable) ORDER BY a.grantee::regrole::text COLLATE "C") FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a))
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid='${sig(guard)}'::regprocedure)
 IS DISTINCT FROM '${JSON.stringify([hash(guardBody),'postgres',guard.config,'s',true,false,false,false,'plpgsql',[['postgres','postgres','EXECUTE',false]]])}'::jsonb
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114488_guard_drift'; END IF;
  PERFORM ${schema}.assert_exact();\n`;
 publicBody=publicBody.replace(start,start+wrongHotel+guardCheck+evaluate);
 for(const n of evidenceRoots)publicBody=publicBody.replaceAll(n+'()',value(get(n)));
 const rpc={name:successor,args:root.args,types:root.types,ret:'jsonb',lang:'plpgsql',settings:'SET search_path=pg_catalog,public,auth',config:['search_path=pg_catalog, public, auth'],src:publicBody};
 const rpcMeta=newMeta(rpc,rpc.src);rpcMeta[3]='{authenticated=X/postgres,postgres=X/postgres}';
 const ddl=[create(metadata,exactMetadata),...clones.map(p=>create(p,p.src)),create(guard,guardBody),create(rpc,rpc.src),`GRANT EXECUTE ON FUNCTION ${sig(rpc)} TO authenticated;`];
 // One installation DO block keeps BEFORE evidence in a PL/pgSQL local, not a
 // table/GUC/cache. DDL below creates ONLY new functions and their private schema.
 const migration=`-- HOTELS 114488: invocation-local Partner reviewed-pricing READ successor.
-- No predecessor replacement, persisted evidence, writer change or timeout change.
-- Generated by tests/integration/hotels-v2-114488-read-compiler.mjs.
-- Pure-STABLE evidence closure: ${ordered.length}; once-only entries: ${cached.length}; private clones: ${clones.length}.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
DO $install$
DECLARE business_before text; b jsonb;
BEGIN
 IF to_regnamespace('${schema}') IS NOT NULL OR to_regprocedure('${sig(rpc)}') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448700')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448700')
 THEN RAISE EXCEPTION 'hotels_114488_boundary_mismatch'; END IF;
 -- Direct catalog pins BEFORE any DDL; no fixture-only security substitution.
 FOR b IN SELECT value FROM jsonb_array_elements(${lit(JSON.stringify(predecessors))}::jsonb) LOOP
  IF (${exactMetadata.replace('q.oid=p_oid',"q.oid=to_regprocedure(b->>'signature')")}) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION 'hotels_114488_predecessor_drift:%',b->>'signature'; END IF;
 END LOOP;
 business_before:=hotels_stripe_dto_private.business_hash();
 IF business_before IS NULL OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114488_unsafe_predecessor'; END IF;
 EXECUTE 'CREATE SCHEMA ${schema} AUTHORIZATION postgres';
 EXECUTE 'REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC,anon,authenticated,service_role';
${ddl.map(d=>' EXECUTE '+lit(d)+';').join('\n')}
 PERFORM ${schema}.assert_exact();
 IF ${bodyMetadataCheck(sig(rpc),rpcMeta,true)}
 OR ${bodyMetadataCheck(sig(guard),newMeta(guard,guardBody),true)}
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM business_before
 OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114488_postcondition_failed'; END IF;
END $install$;
COMMIT;
`;
 return {migration,predecessors,clones,cached:cached.map(p=>({name:p.name,ret:p.ret,clone:chosen.includes(p)?clone(p):null})),rpc,guardBody,closure:ordered.map(p=>sig(p))};
}
