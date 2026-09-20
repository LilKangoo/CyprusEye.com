// Local source compiler for the published-architecture successor foundation.
// This file neither connects to a database nor edits/executes a predecessor.
// Callers supply an audited local pg_proc inventory and install the returned
// private SQL only inside the separately reviewed 114489 transaction.
import assert from 'node:assert/strict';
import {hash, lit, catalogQuery} from './hotels-v2-114483-read-compiler.mjs';
import {mask, exactMetadata} from './hotels-v2-114488-read-compiler.mjs';
export {hash, catalogQuery};

export const schema = 'hotels_published_architecture_private';
export const hotel = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
export const evidenceRoots = [
  'public.hotel_v2_seven_arches_reviewed_pricing_current_state',
  'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact',
  'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact',
  'public.hotel_v2_seven_arches_pricing_activation_current_is_safe',
  'public.hotel_v2_admin_d_current_foundation_snapshot',
  'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints',
  'public.hotel_v2_admin_get_seven_arches_reviewed_pricing',
  'public.hotel_v2_partner_get_seven_arches_reviewed_pricing_114488',
];
const signature = p => `${p.name}(${p.types})`;
const callPattern = name => '(?<![\\w.])' + name.replaceAll('.', '\\.') + '\\s*\\(';
const historicalNames = new Set([
  'hotels_guest_policy_private.historical_hotel',
  'hotels_partner_read_once_private.read_3a98b157088d7466',
]);
const metadata = p => [...p.meta, p.args, p.types, p.ret, p.parallel ?? 'u', p.kind ?? 'f'];

const privateCatalogBody = `SELECT jsonb_build_object(
 'schema',(SELECT jsonb_build_array(nspowner,nspacl) FROM pg_namespace WHERE nspname='${schema}'),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,'owner',r.relowner,
 'rls',r.relrowsecurity,'force',r.relforcerowsecurity,'acl',r.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,atttypmod,attnotnull) ORDER BY attnum)
   FROM pg_attribute WHERE attrelid=r.oid AND attnum>0 AND NOT attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid=r.oid),
 'policies',(SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid' ORDER BY polname) FROM pg_policy p WHERE polrelid=r.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(tgname,tgenabled,pg_get_triggerdef(oid)) ORDER BY tgname)
   FROM pg_trigger WHERE tgrelid=r.oid AND NOT tgisinternal)) ORDER BY r.relname)
 FROM pg_class r WHERE r.relnamespace='${schema}'::regnamespace AND r.relkind IN('r','p','v','m','f'))) `;

// This is a NEW foundation. No old receipt/certificate is rewritten and no
// old guard is made to accept the new source. The exact predecessor evidence
// and complete new private helper/catalog universe are checked independently.
export function certificateSQL(predecessors, entrypoints = []) {
  const manifest=lit(JSON.stringify(predecessors));
  const publicNames=lit(JSON.stringify(entrypoints));
  const entrypointCatalog=`(SELECT jsonb_object_agg(value,${schema}.metadata(to_regprocedure(value))) FROM jsonb_array_elements_text(${publicNames}::jsonb))`;
  const ddl=`CREATE TABLE ${schema}.foundation_certificate (
 id integer PRIMARY KEY CHECK(id=1), predecessors jsonb NOT NULL,
 helpers jsonb NOT NULL, relation_catalog jsonb NOT NULL, entrypoints jsonb
);
ALTER TABLE ${schema}.foundation_certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.foundation_certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ${schema}.foundation_certificate FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ${schema}.foundation_certificate
 FOR EACH STATEMENT EXECUTE FUNCTION ${schema}.immutable();
CREATE FUNCTION ${schema}.metadata(p_oid oid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS ${lit(exactMetadata)};
CREATE FUNCTION ${schema}.relation_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS ${lit(privateCatalogBody)};
CREATE FUNCTION ${schema}.assert_exact() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS ${lit(`DECLARE c ${schema}.foundation_certificate%rowtype; b jsonb;
BEGIN
 SELECT * INTO STRICT c FROM ${schema}.foundation_certificate WHERE id=1;
 IF (SELECT count(*) FROM ${schema}.foundation_certificate)<>1
 OR c.predecessors IS DISTINCT FROM ${manifest}::jsonb
 OR c.helpers IS DISTINCT FROM (SELECT jsonb_object_agg(p.oid::regprocedure::text,${schema}.metadata(p.oid))
   FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace)
 OR c.relation_catalog IS DISTINCT FROM ${schema}.relation_catalog()
 OR c.entrypoints IS DISTINCT FROM ${entrypointCatalog}
 OR NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='${schema}' AND n.nspowner='postgres'::regrole
   AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee<>n.nspowner))
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace AND
   (p.proowner<>'postgres'::regrole OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee<>p.proowner)))
 OR EXISTS(SELECT 1 FROM pg_class r WHERE r.relnamespace='${schema}'::regnamespace AND r.relkind='r' AND
   (r.relowner<>'postgres'::regrole OR NOT r.relrowsecurity OR NOT r.relforcerowsecurity
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=r.oid)
    OR EXISTS(SELECT 1 FROM aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a WHERE a.grantee<>r.relowner)))
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_foundation_certificate_drift'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(c.predecessors) LOOP
  IF ${schema}.metadata(to_regprocedure(b->>'signature')) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_foundation_predecessor_drift:'||(b->>'signature'); END IF;
 END LOOP;
END;`)};
ALTER FUNCTION ${schema}.metadata(oid) OWNER TO postgres;
ALTER FUNCTION ${schema}.relation_catalog() OWNER TO postgres;
ALTER FUNCTION ${schema}.assert_exact() OWNER TO postgres;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${schema} FROM PUBLIC,anon,authenticated,service_role;`;
  // Installers append any other audited new functions/triggers BEFORE this
  // one-time seal. This is SQL, not a callable runtime resealing function.
  const seal=`INSERT INTO ${schema}.foundation_certificate(id,predecessors,helpers,relation_catalog,entrypoints)
 SELECT 1,${manifest}::jsonb,
 (SELECT jsonb_object_agg(p.oid::regprocedure::text,${schema}.metadata(p.oid))
  FROM pg_proc p WHERE p.pronamespace='${schema}'::regnamespace),${schema}.relation_catalog(),${entrypointCatalog};
SELECT ${schema}.assert_exact();`;
  return {ddl,seal};
}

// The parent contract must implement assert_receipt_exact() independently of
// this helper: immutable receipt/catalog/source security, actor/assignment,
// exact authorized transition and unchanged protected business evidence.
// It MUST NOT call this projection, preventing circular self-authorization.
export const historicalHotelBody = `DECLARE
 c hotels_guest_policy_private.receipt%rowtype;
 r ${schema}.conversion_receipt%rowtype;
 a record; expected jsonb; converted boolean:=false;
BEGIN
 IF p_hotel->>'id' IS DISTINCT FROM '${hotel}' THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114489_projection_foreign_hotel';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM ${schema}.conversion_receipt) THEN
  RETURN hotels_guest_policy_private.historical_hotel(p_hotel);
 END IF;
 PERFORM ${schema}.assert_receipt_exact();
 PERFORM hotels_guest_policy_private.assert_exact();
 SELECT * INTO STRICT r FROM ${schema}.conversion_receipt;
 SELECT * INTO STRICT c FROM hotels_guest_policy_private.receipt WHERE id=1;
 IF r.hotel_id IS DISTINCT FROM '${hotel}'::uuid
 OR r.id IS NULL OR r.actor_id IS NULL OR r.partner_id IS NULL OR r.assignment_id IS NULL
 OR r.converted_at IS NULL OR NOT isfinite(r.converted_at)
 OR r.before_hotel->>'id' IS DISTINCT FROM '${hotel}'
 OR r.after_hotel->>'id' IS DISTINCT FROM '${hotel}'
 OR r.before_hotel->>'architecture_version' IS DISTINCT FROM 'legacy'
 OR r.after_hotel->>'architecture_version' IS DISTINCT FROM 'rooms_v2'
 OR (r.before_hotel-ARRAY['architecture_version','updated_at']) IS DISTINCT FROM
    (r.after_hotel-ARRAY['architecture_version','updated_at'])
 OR r.before_hotel->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR r.after_hotel->'is_published' IS DISTINCT FROM 'true'::jsonb
 OR encode(sha256(convert_to((r.before_hotel-ARRAY['pricing_tiers','updated_at','children_policy','minimum_child_age'])::text,'UTF8')),'hex')
    IS DISTINCT FROM c.normalized_hotel_hash
 THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_projection_receipt_drift'; END IF;
 expected:=c.hotel_anchor;
 FOR a IN SELECT * FROM public.hotel_activity_log
  WHERE hotel_id='${hotel}' AND source='hotels_v2_admin_b_guest_policy'
   AND entity_type='property' AND NOT(id=ANY(c.activity_ids)) ORDER BY created_at,id LOOP
  -- Timestamp equality cannot silently choose which side of the transition
  -- an activity belongs to. The writer must establish an unambiguous cutoff.
  IF a.created_at=r.converted_at THEN
   RAISE EXCEPTION USING errcode='55000',message='hotels_114489_guest_policy_cutoff_ambiguous';
  END IF;
  IF NOT converted AND a.created_at>r.converted_at THEN
   IF (expected-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM
      (r.before_hotel-ARRAY['updated_at','pricing_tiers']) THEN
    RAISE EXCEPTION USING errcode='55000',message='hotels_114489_conversion_predecessor_drift';
   END IF;
   expected:=r.after_hotel; converted:=true;
  END IF;
  IF a.actor_type IS DISTINCT FROM 'admin' OR a.actor_id IS NULL OR a.correlation_id IS NULL
  OR a.created_at IS NULL OR NOT isfinite(a.created_at)
  OR (a.before_state-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM
     (expected-ARRAY['updated_at','pricing_tiers'])
  OR (a.before_state-ARRAY['updated_at','children_policy','minimum_child_age']) IS DISTINCT FROM
     (a.after_state-ARRAY['updated_at','children_policy','minimum_child_age'])
  OR public.hotel_v2_h2b1_children_policy_valid(a.after_state->>'children_policy',
      (a.after_state->>'minimum_child_age')::integer,false) IS NOT TRUE
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_guest_policy_audit_drift'; END IF;
  expected:=a.after_state;
 END LOOP;
 IF NOT converted THEN
  IF (expected-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM
     (r.before_hotel-ARRAY['updated_at','pricing_tiers']) THEN
   RAISE EXCEPTION USING errcode='55000',message='hotels_114489_conversion_predecessor_drift';
  END IF;
  expected:=r.after_hotel;
 END IF;
 IF (p_hotel-ARRAY['updated_at','pricing_tiers']) IS DISTINCT FROM
    (expected-ARRAY['updated_at','pricing_tiers']) THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114489_projection_unreviewed_hotel';
 END IF;
 -- Historical fingerprint representation ONLY. Public/workspace DTO builders
 -- must continue reading the physical Hotel row and return rooms_v2 truthfully.
 RETURN p_hotel||jsonb_build_object('architecture_version','legacy',
  'children_policy',c.hotel_anchor->'children_policy',
  'minimum_child_age',c.hotel_anchor->'minimum_child_age');
END;`;

export function replaceCalls(source, replacements) {
  const code=mask(source), patches=[];
  for(const [name,target] of replacements) {
    for(const match of code.matchAll(new RegExp(callPattern(name),'g'))) {
      const length=match[0].indexOf('(');
      patches.push({start:match.index,length,before:source.slice(match.index,match.index+length),after:target});
    }
  }
  patches.sort((a,b)=>b.start-a.start);
  let result=source, previous=Infinity;
  for(const p of patches) {
    assert.ok(p.start+p.length<=previous,'overlapping source spans'); previous=p.start;
    assert.equal(result.slice(p.start,p.start+p.length),p.before);
    result=result.slice(0,p.start)+p.after+result.slice(p.start+p.length);
  }
  return {source:result,patches};
}

export function compile(all,{roots=evidenceRoots,forceCloneRoots=[]}={}) {
  const byName=new Map();
  for(const p of all) {
    const group=byName.get(p.name)||[];group.push(p);byName.set(p.name,group);
  }
  const get=name=>{const found=byName.get(name)||[];assert.equal(found.length,1,`ambiguous/missing ${name}`);return found[0];};
  const dependencies=p=>all.filter(d=>new RegExp(callPattern(d.name)).test(mask(p.src)));
  const reachable=new Map();
  function visit(p) {
    if(reachable.has(signature(p)))return;
    reachable.set(signature(p),p);dependencies(p).forEach(visit);
  }
  roots.forEach(n=>visit(get(n)));
  for(const n of historicalNames)assert.ok(get(n).src.includes('hotels_114484_non_guest_property_drift'));
  // Fixed point, not a recursion shortcut: retain only ancestors of the exact
  // proven failing historical-Hotel leaf. Opaque unaffected helpers stay intact.
  const selected=new Set([...reachable.values()].filter(p=>historicalNames.has(p.name)).map(signature));
  let changed=true;
  while(changed) {
    changed=false;
    for(const p of reachable.values())if(!selected.has(signature(p))&&dependencies(p).some(d=>selected.has(signature(d)))) {
      selected.add(signature(p));changed=true;
    }
  }
  // Explicit source-pinned clones required by successor entrypoints.
  // Do not broaden the rest of the reachable dependency graph.
  for(const name of forceCloneRoots) {
    const p=get(name);
    const key=signature(p);
    assert.ok(reachable.has(key),`forced clone root not reachable: ${name}`);
    selected.add(key);
  }
  const chosen=[], ordered=new Set(), visiting=new Set();
  function order(p) {
    const key=signature(p);
    if(ordered.has(key)||!selected.has(key))return;
    assert.ok(!visiting.has(key),`recursive successor dependency requires explicit proof: ${key}`);
    visiting.add(key);
    // The proven leaf is replaced by the independently guarded projection;
    // its old assert/helper dependencies are pinned but not cloned here.
    if(!historicalNames.has(p.name))dependencies(p).forEach(order);
    visiting.delete(key);ordered.add(key);chosen.push(p);
  }
  [...reachable.values()].sort((a,b)=>signature(a).localeCompare(signature(b))).forEach(order);
  assert.ok(chosen.length>0,'missing historical projection seam');
  assert.ok(chosen.every(p=>['s','i'].includes(p.vol)),'mutable ancestor requires separately reviewed writer compiler');
  const clone=p=>`${schema}.foundation_${hash(signature(p)).slice(0,16)}`;
  const replacements=chosen.map(p=>[p.name,clone(p)]);
  const clones=chosen.map(p=>{
    assert.ok(['sql','plpgsql'].includes(p.lang),`unsupported language ${signature(p)}`);
    assert.equal(p.meta[7],false,`leakproof clone needs explicit declaration ${signature(p)}`);
    assert.equal(p.meta[9],false,`set-returning clone needs explicit declaration ${signature(p)}`);
    assert.ok(p.meta[4]?.some(x=>x.startsWith('search_path=')),`unprotected search_path ${signature(p)}`);
    let transformed;
    if(historicalNames.has(p.name)) {
      assert.ok(/\bp_hotel jsonb\b/.test(p.args),`unknown projection argument ${signature(p)}`);
      transformed={source:`BEGIN RETURN ${schema}.historical_hotel(p_hotel); END;`,patches:[{kind:'exact_historical_projection',before_hash:hash(p.src)}]};
    } else transformed=replaceCalls(p.src,replacements);
    const settings=(p.def.match(/^ SET [^\n]+/gm)||[]).join('\n');
    const ddl=`CREATE FUNCTION ${clone(p)}(${p.args}) RETURNS ${p.ret} LANGUAGE ${p.lang} ${p.vol==='i'?'IMMUTABLE':'STABLE'} ${p.meta[6]?'SECURITY DEFINER':'SECURITY INVOKER'} ${p.meta[8]?'STRICT':''} ${settings} AS ${lit(transformed.source)};
ALTER FUNCTION ${clone(p)}(${p.types}) OWNER TO postgres;
REVOKE ALL ON FUNCTION ${clone(p)}(${p.types}) FROM PUBLIC,anon,authenticated,service_role;`;
    return {original:signature(p),name:clone(p),signature:`${clone(p)}(${p.types})`,source:transformed.source,source_hash:hash(transformed.source),patches:transformed.patches,ddl};
  });
  // Full reachable old graph is pinned, including leaves that remain opaque.
  // Names embedded in manifests, regprocedure literals and catalog evidence
  // are deliberately NOT rewritten by replaceCalls.
  const predecessors=[...reachable.values()].sort((a,b)=>signature(a).localeCompare(signature(b))).map(p=>({signature:signature(p),meta:metadata(p)}));
  const beforeGuard=`DO $foundation_before$ DECLARE b jsonb; BEGIN
 FOR b IN SELECT value FROM jsonb_array_elements(${lit(JSON.stringify(predecessors))}::jsonb) LOOP
  IF (${exactMetadata.replace('q.oid=p_oid',"q.oid=to_regprocedure(b->>'signature')")}) IS DISTINCT FROM b->'meta'
  THEN RAISE EXCEPTION USING errcode='55000',message='hotels_114489_foundation_predecessor_drift:'||(b->>'signature'); END IF;
 END LOOP;
END $foundation_before$;`;
  const historicalDDL=`CREATE FUNCTION ${schema}.historical_hotel(p_hotel jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS ${lit(historicalHotelBody)};
ALTER FUNCTION ${schema}.historical_hotel(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION ${schema}.historical_hotel(jsonb) FROM PUBLIC,anon,authenticated,service_role;`;
  const certificate=certificateSQL(predecessors);
  return {predecessors,clones,beforeGuard,historicalHotelBody,historicalDDL,certificate,
    sql:[beforeGuard,historicalDDL,...clones.map(c=>c.ddl)].join('\n'),
    roots:roots.map(name=>{const p=get(name);return {name,signature:signature(p),successor:selected.has(signature(p))?clone(p):name};}),
    requiredParentContract:`${schema}.assert_receipt_exact()`,
    requiredParentPostcondition:'Pin exact new helper source/security and all predecessor metadata in immutable 114489 certificate; invoke that certificate guard at every new exposed entrypoint.'};
}

export function focusedCompilerTests() {
  const source=`BEGIN PERFORM public.example(); x:='public.example()'; -- public.example()\n RETURN public.example (); END;`;
  const patched=replaceCalls(source,[['public.example','private.clone']]);
  assert.equal(patched.patches.length,2);
  assert.ok(patched.source.includes("x:='public.example()'"));
  assert.ok(patched.source.includes('-- public.example()'));
  assert.equal(replaceCalls("SELECT 'public.example()'::regprocedure",[['public.example','private.clone']]).patches.length,0);
  assert.ok(historicalHotelBody.includes('assert_receipt_exact()'));
  assert.ok(historicalHotelBody.includes('hotels_114489_guest_policy_cutoff_ambiguous'));
  assert.ok(historicalHotelBody.includes("r.before_hotel-ARRAY['architecture_version','updated_at']"));
  assert.ok(!/UPDATE\s+public\.|INSERT\s+INTO|DELETE\s+FROM/i.test(historicalHotelBody));
  return {source_span_tests:4,historical_contract_static_tests:4,pass:true};
}
