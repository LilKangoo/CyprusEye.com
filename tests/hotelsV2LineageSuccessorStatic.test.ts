import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=(p:string)=>fs.readFileSync(p,'utf8');
const migration=read('supabase/migrations/20260811441600_hotels_v2_seven_arches_authorized_lineage_reconciliation.sql');
const provider=read('supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql');
const lifecycle=read('supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql');
const manifest=(stage:number)=>JSON.parse(migration.split(`$manifest${stage===114450?'450':'480'}$`)[1]);
const body=(name:string)=>{
 const fragment=migration.slice(migration.indexOf(`CREATE FUNCTION hotels_lineage_private.${name}(`));
 return fragment.split('AS $function$')[1].split('$function$;')[0];
};
describe('Exact non-recursive 114416 successor contract',()=>{
 test.each([[114450,24],[114480,31]])('finite manifest %s has exactly %s entries',(stage,count)=>{
  const entries=Object.values(manifest(stage)) as Record<string,unknown>[];
  expect(entries).toHaveLength(count);
  for(const entry of entries){
   expect(Object.keys(entry).sort()).toEqual(['after_definition','after_metadata','after_source','before_definition','before_metadata','before_source']);
   for(const key of ['before_source','before_definition','after_source','after_definition'])expect(entry[key]).toMatch(/^[0-9a-f]{64}$/);
   for(const key of ['before_metadata','after_metadata']){
    expect(entry[key]).toEqual(expect.objectContaining({owner:'postgres',kind:'f',parallel:'u',leakproof:false,returns_set:false}));
   }
  }
 });
 test('has exact stage ordering, immutable links and no arbitrary AFTER capture',()=>{
  expect(body('seal_successor')).toContain('p_stage NOT IN(114450,114480)');
  expect(body('seal_successor')).toContain('bindings:=hotels_lineage_private.successor_manifest(p_stage)');
  expect(body('successors_are_exact')).toContain('r.previous_hash IS DISTINCT FROM previous');
  expect(body('successors_are_exact')).toContain('r.bindings IS DISTINCT FROM pins');
  expect(body('successors_are_exact')).toContain('pins IS DISTINCT FROM hotels_lineage_private.successor_manifest(r.stage)');
  expect(migration).toContain('CREATE TRIGGER successor_no_truncate');
 });
 test('read path never executes provider bridge or another high-level composite',()=>{
  for(const name of ['predecessor','successors_are_exact','current_anchor_is_exact','successor_metadata']){
   const source=body(name).replace(/'(?:''|[^'])*'/g,'');
   expect(source).not.toMatch(/public\.hotel_v2_(?:seven_arches_pricing_scoped_lineage|external_calendar_provider_lineage_bridge_is_exact|external_calendar_provider_evolution_is_safe)\s*\(/);
  }
  expect(body('predecessor')).toContain("RETURN jsonb_build_object('source',s,'definition',d,'metadata',m)");
  expect(body('predecessor')).not.toMatch(/\bEXECUTE\b/i);
 });
 test('all manifested current functions are validated, not only catalog members',()=>{
  expect(body('successors_are_exact')).toContain('jsonb_object_keys(certificate.bindings)');
  expect(body('successors_are_exact')).toContain('hotels_lineage_private.predecessor(to_regprocedure(k)) IS NULL');
 });
 test('pins low lifecycle projector before invocation and retains linked checks',()=>{
  const source=body('successors_are_exact');
  expect(source).toContain("('hotels_lifecycle_private.hash(jsonb)'");
  expect(source).toContain('p.prosecdef<>e.definer OR p.proisstrict<>e.strict');
  expect(source).toContain('$linked_lifecycle$ INTO linked USING pins;\n   IF linked IS NOT TRUE THEN RETURN false; END IF;');
  expect(source.indexOf('e(signature,sha,volatility,definer,strict)')).toBeLessThan(source.indexOf("EXECUTE 'SELECT catalog IS NOT DISTINCT"));
 });
 test('successors seal atomically before final checks and bridge ACL is already private',()=>{
  expect(provider.indexOf('revoke all on function public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()')).toBeLessThan(provider.indexOf('select hotels_lineage_private.seal_successor(114450)'));
  expect(lifecycle).toContain('PERFORM hotels_lineage_private.seal_successor(114480);');
  expect(lifecycle.trimEnd()).toMatch(/COMMIT;$/);
 });
 test('qualification normalization stays exact and checks the actual digest dependency',()=>{
  const source=body('catalog_is_exact');
  expect(source).toContain("'extensions.digest(bytea,text)'::regprocedure");
  expect(source).toContain("c-'expression'-'definition' IS DISTINCT FROM h-'expression'-'definition'");
  expect(source).toContain("RETURN jsonb_set(current_jsonb,ARRAY[ci::text,'constraints',cj::text],h,false)=historical_jsonb");
 });
 test('preaction retains EUR100, external-on and zero-review requirements',()=>{
  const gate=read('supabase/manual/hotels_v2_114420_after_lineage_reconciliation_preaction_readonly.sql');
  expect(gate.match(/base_nightly_rate=100/g)).toHaveLength(2);
  expect(gate).toContain("'hotel_external_sync_enabled','true'");
  expect(gate).toContain("'evolution_receipts_count','0'");
  expect(gate).toContain("'recorded_114416','1'");
  expect(gate.trimEnd()).toMatch(/ROLLBACK;$/);
 });
 test('physical qualification test and runtime counters are real PostgreSQL evidence',()=>{
  const physical=read('tests/integration/hotels-v2-lineage-qualification-physical-postgres-gate.sql');
  expect(physical).toContain('pg_get_constraintdef');expect(physical).toContain('pg_get_expr');
  const security=read('tests/integration/hotels-v2-lineage-successor-security-gate.mjs');
  expect(security).toContain('pg_stat_xact_user_functions');
  expect(security).toContain('assert.equal(counters.scoped_calls,1)');
  expect(security).toContain('assert.equal(counters.provider_bridge_calls,0)');
 });
 test.each([
  ['20260811440000_hotels_v2_seven_arches_pricing_activation.sql','4d4d308294fab41c99b8f2feb7fe2241b4dc5a348560b6d838bc12e4a6391ced'],
  ['20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql','1dd205e4e031bafd6000dc3f45ecbbe2e8977bb132e73bdd20c876b3afb787b6'],
  ['20260811440600_hotels_v2_seven_arches_pricing_activation_transport_stable_fingerprint.sql','b55c078b4c460a8d5f485ae8e2cc048d87db2b3d7e93441279d7c0df97161e40'],
 ])('applied migration remains frozen: %s',(file,sha)=>{
  expect(createHash('sha256').update(read('supabase/migrations/'+file)).digest('hex')).toBe(sha);
 });
});
