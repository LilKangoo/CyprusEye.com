import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

assert.equal(process.env.HOTELS_114407_DISPOSABLE,'1');
const url=new URL(process.env.HOTELS_114407_TEMPLATE_URL);
assert.equal(url.hostname,'localhost');
assert.match(url.pathname,/^\/hotels_114407_[a-z0-9_]+$/);
assert.match(url.searchParams.get('host') || '',/^\/private\/tmp\/hotels-114407-[a-zA-Z0-9./_-]+$/);
const psql=process.env.HOTELS_114407_PSQL; assert.ok(psql);
const database=`hotels_114407_install_gate_${process.pid}`;
const maintenance=new URL(url);maintenance.pathname='/postgres';
const target=new URL(url);target.pathname=`/${database}`;
function run(uri,sql) { return spawnSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','--dbname',uri.href],
  {input:'\\set VERBOSITY verbose\n'+sql,encoding:'utf8',maxBuffer:8e6}); }
function ok(uri,sql) {const r=run(uri,sql);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const migration=readFileSync('supabase/migrations/20260811440700_hotels_v2_seven_arches_pricing_activation_apply_timeout.sql','utf8');
const body=migration.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
const apply='public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)';
const metadata=`select jsonb_build_object('body',encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex'),
  'owner',proowner,'language',prolang,'definer',prosecdef,'volatility',provolatile,'acl',proacl,'config',proconfig)
  from pg_proc where oid='${apply}'::regprocedure;`;
const tables=['hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
  'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies','site_settings',
  'hotel_seven_arches_pricing_activation_reviews','hotel_seven_arches_pricing_activation_evolution_receipts',
  'hotel_seven_arches_pricing_activation_transaction_context','hotel_activity_log','hotel_admin_pricing_action_receipts'];
function state(){return ok(target,`select jsonb_build_array(${tables.map(t=>`(select coalesce(jsonb_agg(r order by r::text),'[]') from (select to_jsonb(t) r from public.${t} t) x)`).join(',')});`);}
const negatives=[
  ['later_boundary', 'create table public.hotel_seven_arches_independent_pricing_evolution_receipts(dummy int);','boundary_mismatch'],
  ['missing_helper','drop function public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb);','boundary_mismatch'],
  ['existing_override',`alter function ${apply} set statement_timeout='30s';`,'apply_boundary_drift'],
  ['wrong_owner',`alter function ${apply} owner to authenticated;`,'apply_boundary_drift'],
  ['wrong_security',`alter function ${apply} security invoker;`,'apply_boundary_drift'],
  ['wrong_volatility',`alter function ${apply} stable;`,'apply_boundary_drift'],
  ['wrong_search_path',`alter function ${apply} set search_path=public;`,'apply_boundary_drift'],
  ['extra_execute',`grant execute on function ${apply} to anon;`,'apply_boundary_drift'],
  ['missing_execute',`revoke execute on function ${apply} from authenticated;`,'apply_boundary_drift'],
  ['partial_rate',"alter table public.hotel_room_rates disable trigger user; update public.hotel_room_rates set is_active=true where id='7e420964-9cbf-4f1b-abd3-09840af5240f';",'business_boundary_drift'],
  ['partial_plan',"alter table public.hotel_rate_plans disable trigger user; update public.hotel_rate_plans set is_active=true where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17';",'business_boundary_drift'],
  ['partial_schedule',"alter table public.hotel_pricing_schedules disable trigger user; update public.hotel_pricing_schedules set is_active=true where id='b0a3104f-7b31-5265-a59f-c2d166f11a23';",'business_boundary_drift'],
];
ok(maintenance,`create database ${database} template ${url.pathname.slice(1)};`);
try {
  const frozen=readFileSync('supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql','utf8');
  const names=['hotel_v2_admin_preview_seven_arches_pricing_activation','hotel_v2_seven_arches_pricing_activation_review_guard'];
  const saved=ok(target,`select pg_get_functiondef(oid)||';' from pg_proc where proname in (${names.map(n=>`'${n}'`).join(',')});`);
  const oldDefinitions=names.map(name=>{
    const start=frozen.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`,'i'));
    assert.ok(start>=0); const end=frozen.indexOf('$function$;',frozen.indexOf('as $function$',start)+13)+11;
    return frozen.slice(start,end).replace(/^create function/i,'create or replace function');
  }).join('\n');
  ok(target,`begin; ${oldDefinitions}
    set local role authenticated;
    set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
    do $$declare s jsonb; begin
      s:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
      perform public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
        'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca','snapshot_token',s->>'snapshot_token',
        'upper_base_nightly_rate',100,'ground_base_nightly_rate',100,
        'rate_plan_name_i18n',jsonb_build_object('pl','Standard','en','Standard','he','סטנדרטי'),
        'rate_plan_description_i18n',jsonb_build_object('pl','Standard','en','Standard','he','Standard'),
        'schedule_name_i18n',jsonb_build_object('pl','Cennik','en','Pricing','he','תמחור'),
        'reason','Local historical Review migration-preservation regression'));
    end$$; reset role; ${saved} commit;`);
  assert.equal(ok(target,`select count(*)=1 and bool_and(consumed_at is null and plan_fingerprint<>
    public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(reviewed_plan))
    from public.hotel_seven_arches_pricing_activation_reviews;`),'t');
  const before=state(),metaBefore=JSON.parse(ok(target,metadata));
  for(const [label,mutation,error] of negatives){
    const r=run(target,`begin; ${mutation} ${body} rollback;`);
    assert.notEqual(r.status,0,label);
    assert.ok(r.stderr.includes(`hotels_v2_seven_arches_pricing_activation_timeout_${error}`),`${label}: ${r.stderr}`);
    assert.equal(state(),before,`${label}: business rollback`);
    assert.deepEqual(JSON.parse(ok(target,metadata)),metaBefore,`${label}: metadata rollback`);
  }
  ok(target,migration);
  assert.equal(state(),before,'installation mutated business state');
  const metaAfter=JSON.parse(ok(target,metadata));
  assert.equal(metaAfter.body,'786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef');
  assert.deepEqual(metaAfter.config,['search_path=pg_catalog, public, auth','statement_timeout=60s']);
  assert.deepEqual({...metaAfter,config:metaBefore.config},metaBefore);
  assert.equal(ok(target,`select count(*)=0 from public.hotel_seven_arches_pricing_activation_evolution_receipts;`),'t');
  assert.equal(ok(target,`select not public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
    and not public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    and public.hotel_v2_seven_arches_pricing_activation_current_is_safe();`),'t');
  const replay=run(target,migration);assert.notEqual(replay.status,0);
  assert.ok(replay.stderr.includes('timeout_apply_boundary_drift'));
  assert.equal(state(),before);
  assert.deepEqual(JSON.parse(ok(target,metadata)),metaAfter);
  let activatedBoundary='NOT_REQUESTED';
  if(process.env.HOTELS_114407_ACTIVATED_URL){
    const active=new URL(process.env.HOTELS_114407_ACTIVATED_URL);
    assert.equal(active.hostname,url.hostname);
    assert.equal(active.port,url.port);
    assert.equal(active.search,url.search);
    assert.match(active.pathname,/^\/hotels_114407_[a-z0-9_]+$/);
    assert.equal(ok(active,'select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts;'),'1');
    const activeMeta=ok(active,metadata);
    const rejected=run(active,migration);
    assert.notEqual(rejected.status,0);
    assert.ok(rejected.stderr.includes('timeout_business_boundary_drift'),rejected.stderr);
    assert.equal(ok(active,metadata),activeMeta);
    assert.equal(ok(active,'select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts;'),'1');
    activatedBoundary='PASS';
  }
  console.log(JSON.stringify({install:'PASS',negative_count:negatives.length+1,negatives:negatives.map(n=>n[0]).concat('replay'),
    already_activated_boundary:activatedBoundary,
    historical_review_preserved_unconsumed:true,
    rollback_containment:'PASS',business_unchanged:'PASS',preactivation_semantics:'PASS',before:metaBefore,after:metaAfter},null,2));
} finally { ok(maintenance,`drop database ${database};`); }
