// Local-only compiler. The emitted migration verifies every predecessor before
// applying checked source-span substitutions; quoted manifest data is never code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const schema='hotels_read_once_private';
export const roots=[
 'public.hotel_v2_admin_get_shadow_preparation_state',
 'public.hotel_v2_admin_get_seven_arches_pricing_activation',
 'public.hotel_v2_admin_get_legacy_pricing_promotion_preview',
];
export const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const lit=s=>"'"+s.replaceAll("'","''")+"'";
const tokens=s=>s.match(/\$(\w*)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|\$[0-9]+|[^'$/-]+|./g)||[];
const literal=t=>t.startsWith("'")||/^\$\w*\$/.test(t)||t.startsWith('--')||t.startsWith('/*');
const executable=s=>tokens(s).map(t=>literal(t)?' '.repeat(t.length):t).join('');
const pattern=n=>'(?<![\\w.])'+n.replaceAll('.','\\.')+'\\s*\\(';
export const metadataBody=`SELECT jsonb_build_array(encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 pg_get_userbyid(p.proowner),p.proacl::text,p.proconfig,p.provolatile,p.prosecdef,
 p.proleakproof,p.proisstrict,p.proretset,l.lanname)
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=p_oid`;
export const catalogQuery=`SELECT jsonb_agg(jsonb_build_object('id',p.oid,'name',n.nspname||'.'||p.proname,
 'args',pg_get_function_arguments(p.oid),'types',oidvectortypes(p.proargtypes),'ret',p.prorettype::regtype::text,
 'src',p.prosrc,'def',pg_get_functiondef(p.oid),'vol',p.provolatile,'lang',l.lanname,
 'meta',(${metadataBody.replace('p.oid=p_oid','p.oid=outer_p.oid')})))
 FROM pg_proc outer_p JOIN pg_proc p ON p.oid=outer_p.oid JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' OR n.nspname LIKE 'hotels%'`;
export function compile(all){
 const ordered=[],seen=new Set();
 function visit(p,stack=[]){
  if(seen.has(p.id))return;
  if(stack.includes(p.id)){assert.equal(p.vol,'i','non-pure recursive dependency');return;}
  p.deps=all.filter(d=>new RegExp(pattern(d.name)).test(executable(p.src)));
  for(const d of p.deps)visit(d,[...stack,p.id]);seen.add(p.id);ordered.push(p);
 }
 const entry=roots.map(n=>{const matches=all.filter(p=>p.name===n);assert.equal(matches.length,1);return matches[0];});
 entry.forEach(p=>visit(p));
 assert.ok(ordered.every(p=>['s','i'].includes(p.vol)),'read graph contains a volatile function');
 const cached=ordered.filter(p=>p.vol==='s'&&!p.args&&['boolean','jsonb','text'].includes(p.ret)&&p.name!=='public.is_current_user_admin'&&!roots.includes(p.name));
 const cachedIds=new Set(cached.map(p=>p.id));
 function needsContext(p,seen=new Set()){
  if(seen.has(p.id))return false;seen.add(p.id);
  return p.deps.some(d=>cachedIds.has(d.id)||needsContext(d,seen));
 }
 const chosen=ordered.filter(p=>p.vol==='s'&&p.ret!=='void'&&needsContext(p)&&!roots.includes(p.name));
 const clone=p=>schema+'.read_'+hash(p.name+'('+p.types+')').slice(0,16);
 const value=p=>`(CASE WHEN (p_read_context#>>ARRAY[${lit(p.name)},'is_null'])::boolean THEN NULL::${p.ret} ELSE `+
  (p.ret==='jsonb'?`p_read_context#>ARRAY[${lit(p.name)},'value']`:`(p_read_context#>>ARRAY[${lit(p.name)},'value'])::${p.ret}`)+` END)`;
 const bindings=ordered.map(p=>{
  const code=executable(p.src),patches=[];
  if(chosen.includes(p)){
   assert.ok(!/\$[0-9]+/.test(code),'positional parameters need an explicit reviewed mapping');
   for(const d of cached)for(const m of code.matchAll(new RegExp(pattern(d.name)+'\\s*\\)','g')))
    patches.push([m.index+1,m[0].length,p.src.slice(m.index,m.index+m[0].length),value(d)]);
   for(const d of chosen.filter(x=>x.args))for(const m of code.matchAll(new RegExp(pattern(d.name),'g')))
    patches.push([m.index+1,m[0].length,p.src.slice(m.index,m.index+m[0].length),clone(d)+'(p_read_context,']);
  }
  patches.sort((a,b)=>b[0]-a[0]);let body=p.src,last=Infinity;
  for(const [start,length,old,replacement] of patches){assert.ok(start+length<=last);last=start;assert.equal(body.slice(start-1,start-1+length),old);body=body.slice(0,start-1)+replacement+body.slice(start-1+length);}
  return {signature:p.name+'('+p.types+')',meta:p.meta,clone:chosen.includes(p)?clone(p):null,args:p.args,types:p.types,ret:p.ret,lang:p.lang,
   settings:(p.def.match(/^ SET [^\n]+/gm)||[]).join('\n'),patches,after_hash:hash(body)};
 });
 const wrappers=entry.map(root=>{
  const needed=new Set();function need(p){if(needed.has(p.id))return;needed.add(p.id);p.deps.forEach(need);}need(root);
  let body=`DECLARE p_read_context jsonb:='{}'::jsonb; BEGIN
 PERFORM ${schema}.assert_exact();\n`;
  if(root.args)body+=`IF p_hotel_id IS DISTINCT FROM '${hotel}'::uuid THEN RETURN ${root.name}(p_hotel_id); END IF;\n`;
  for(const p of cached.filter(p=>needed.has(p.id))){
   const call=chosen.includes(p)?clone(p)+'(p_read_context)':p.name+'()';
   body+=`WITH evaluated AS MATERIALIZED (SELECT ${call} AS value)
 SELECT p_read_context||jsonb_build_object(${lit(p.name)},jsonb_build_object('is_null',value IS NULL,'value',value)) INTO p_read_context FROM evaluated;\n`;
  }
  const targetName={
   [roots[0]]:'hotels_shadow_successor_private.state',
   [roots[1]]:'public.hotel_v2_seven_arches_pricing_activation_snapshot',
   [roots[2]]:'public.hotel_v2_h3_1p_pricing_promotion_snapshot',
  }[root.name];
  const target=ordered.find(p=>p.name===targetName);assert.ok(target&&chosen.includes(target));
  body+=`RETURN ${clone(target)}(p_read_context${root.args?',p_hotel_id':''}); END;`;
  const name=root.name+'_114483',sig=name+'('+root.types+')';
  const projection=schema+'.projection_'+entry.indexOf(root);
  const publicBody=`BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114483_admin_required'; END IF;
 RETURN ${projection}(${root.args?'p_hotel_id':''}); END;`;
  return {name,sig,source:publicBody,projection,ddl:`CREATE FUNCTION ${projection}(${root.args}) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS ${lit(body)};
REVOKE ALL ON FUNCTION ${projection}(${root.types}) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION ${name}(${root.args}) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS ${lit(publicBody)};
ALTER FUNCTION ${sig} OWNER TO postgres;
REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION ${sig} TO authenticated;`};
 });
 const manifest=JSON.stringify(bindings);
 const migration=`-- 114483: invocation-local dependency factoring for THREE Admin read RPCs.
-- No cache/GUC/temp state, no mutation RPC, no changed predecessor, no timeout override.
-- Every original expression survives; repeated STABLE reads use one MVCC statement snapshot.
-- Old RPCs remain intact. Three explicitly versioned successor GETs return the same DTO.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
DO $boundary$ BEGIN
 IF to_regnamespace('${schema}') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448200')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448200')
 THEN RAISE EXCEPTION 'hotels_114483_boundary_mismatch'; END IF;
END $boundary$;
CREATE SCHEMA ${schema} AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION ${schema}.metadata(p_oid oid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS ${lit(metadataBody)};
REVOKE ALL ON FUNCTION ${schema}.metadata(oid) FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE ${schema}.certificate(id integer PRIMARY KEY CHECK(id=1),predecessors jsonb NOT NULL,functions jsonb NOT NULL,business_before text NOT NULL);
ALTER TABLE ${schema}.certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ${schema}.certificate FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION ${schema}.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION 'hotels_114483_certificate_immutable'; END $f$;
REVOKE ALL ON FUNCTION ${schema}.immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ${schema}.certificate FOR EACH STATEMENT EXECUTE FUNCTION ${schema}.immutable();
INSERT INTO ${schema}.certificate VALUES(1,
${lit(manifest)}::jsonb,'{}',hotels_stripe_dto_private.business_hash());
DO $compile$
DECLARE b jsonb; src text; patch jsonb; statement text;
BEGIN
 FOR b IN SELECT value FROM ${schema}.certificate c,LATERAL jsonb_array_elements(c.predecessors) LOOP
  IF ${schema}.metadata(to_regprocedure(b->>'signature')) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION 'hotels_114483_predecessor_drift:%',b->>'signature'; END IF;
  IF b->>'clone' IS NULL THEN CONTINUE; END IF;
  SELECT prosrc INTO STRICT src FROM pg_proc WHERE oid=to_regprocedure(b->>'signature');
  FOR patch IN SELECT value FROM jsonb_array_elements(b->'patches') LOOP
   IF substring(src FROM (patch->>0)::integer FOR (patch->>1)::integer) IS DISTINCT FROM patch->>2
   THEN RAISE EXCEPTION 'hotels_114483_patch_drift'; END IF;
   src:=overlay(src PLACING patch->>3 FROM (patch->>0)::integer FOR (patch->>1)::integer);
  END LOOP;
  IF encode(sha256(convert_to(src,'UTF8')),'hex') IS DISTINCT FROM b->>'after_hash'
  THEN RAISE EXCEPTION 'hotels_114483_compiler_drift'; END IF;
  statement:=format('CREATE FUNCTION %s(p_read_context jsonb%s) RETURNS %s LANGUAGE %s STABLE SECURITY DEFINER %s AS %L',
   b->>'clone',CASE WHEN b->>'args'='' THEN '' ELSE ', '||(b->>'args') END,b->>'ret',b->>'lang',b->>'settings',src);
  EXECUTE statement;
  EXECUTE format('REVOKE ALL ON FUNCTION %s(jsonb%s) FROM PUBLIC,anon,authenticated,service_role',b->>'clone',CASE WHEN b->>'types'='' THEN '' ELSE ', '||(b->>'types') END);
 END LOOP;
END $compile$;
CREATE FUNCTION ${schema}.assert_exact() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c ${schema}.certificate%rowtype; b jsonb; actual jsonb;
BEGIN
 SELECT * INTO STRICT c FROM ${schema}.certificate WHERE id=1;
 IF (SELECT count(*) FROM ${schema}.certificate)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='${schema}.certificate'::regclass AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='${schema}.certificate'::regclass)
 OR EXISTS(SELECT 1 FROM pg_class r,LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE r.oid='${schema}.certificate'::regclass AND a.grantee<>r.relowner)
 OR EXISTS(SELECT 1 FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='${schema}' AND (n.nspowner<>'postgres'::regrole OR a.grantee<>n.nspowner))
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='${schema}.certificate'::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='${schema}.certificate'::regclass AND tgname='immutable' AND tgenabled='O' AND tgtype=58 AND tgfoid='${schema}.immutable()'::regprocedure)
 THEN RAISE EXCEPTION 'hotels_114483_certificate_security_drift'; END IF;
 -- Verify metadata evaluator source before trusting it.
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${schema}.metadata(oid)'::regprocedure)
 IS DISTINCT FROM '${hash(metadataBody)}' THEN RAISE EXCEPTION 'hotels_114483_metadata_drift'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF ${schema}.metadata(to_regprocedure(b->>'signature')) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION 'hotels_114483_predecessor_drift:%',b->>'signature'; END IF;
 END LOOP;
 SELECT jsonb_object_agg(p.oid::regprocedure::text,${schema}.metadata(p.oid) ORDER BY p.oid::regprocedure::text) INTO actual
 FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace OR p.oid IN(${wrappers.map(w=>lit(w.sig)+'::regprocedure').join(',')});
 IF actual IS DISTINCT FROM c.functions THEN RAISE EXCEPTION 'hotels_114483_source_security_drift'; END IF;
END $f$;
REVOKE ALL ON FUNCTION ${schema}.assert_exact() FROM PUBLIC,anon,authenticated,service_role;
${wrappers.map(w=>w.ddl).join('\n')}
-- Populate the new certificate once; old certificates/receipts are never changed.
ALTER TABLE ${schema}.certificate DISABLE TRIGGER immutable;
UPDATE ${schema}.certificate SET functions=(SELECT jsonb_object_agg(p.oid::regprocedure::text,${schema}.metadata(p.oid) ORDER BY p.oid::regprocedure::text)
FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace OR p.oid IN(${wrappers.map(w=>lit(w.sig)+'::regprocedure').join(',')}));
ALTER TABLE ${schema}.certificate ENABLE TRIGGER immutable;
DO $post$ BEGIN
 PERFORM ${schema}.assert_exact();
 IF hotels_stripe_dto_private.business_hash() IS DISTINCT FROM (SELECT business_before FROM ${schema}.certificate WHERE id=1)
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR hotels_shadow_successor_private.state('${hotel}')->>'status' IS DISTINCT FROM 'SUCCESSOR_ALREADY_COMPLETE'
 OR hotels_lifecycle_private.safe_state()->'feature_flags' IS DISTINCT FROM '{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false}'::jsonb
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION 'hotels_114483_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
 return {migration,bindings,wrappers,clones:chosen.length,cached:cached.length};
}
