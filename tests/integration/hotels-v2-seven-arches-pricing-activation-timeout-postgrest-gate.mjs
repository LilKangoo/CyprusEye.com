import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { JWT_SECRET, TOKENS } from './hotels-v2-h3-2a-partner-access-auth.mjs';

// Real local PostgREST, no SQL-only timeout emulation. Two preinstalled,
// disposable databases: exact 114406 and exact 114407, both pre-activation.
// The synthetic control sleeps without touching business state. A fast real
// Apply is reported honestly, not inflated into a production-sized timeout.
assert.equal(process.env.HOTELS_114407_DISPOSABLE, '1');
const psql = process.env.HOTELS_114407_PSQL;
const postgrest = process.env.HOTELS_114407_POSTGREST;
assert.ok(psql && postgrest);
const databases = [process.env.HOTELS_114407_BASELINE_URL, process.env.HOTELS_114407_AFTER_URL];
for (const url of databases) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'postgresql:');
  assert.equal(parsed.hostname, 'localhost');
  assert.match(parsed.pathname, /^\/hotels_114407_[a-z0-9_]+$/);
  assert.match(parsed.searchParams.get('host') || '', /^\/private\/tmp\/hotels-114407-[a-zA-Z0-9./_-]+$/);
}
function sql(url, command) {
  const r = spawnSync(psql, ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '--dbname', url],
    { input: command, encoding: 'utf8', maxBuffer: 8e6 });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
const roleBefore = sql(databases[0], "select coalesce(rolconfig::text,'NULL') from pg_roles where rolname='authenticated';");
assert.equal(roleBefore,'NULL', 'Fixture role settings must be pristine before the local timeout experiment');
// Authorized synthetic cluster only; establish an 8s production-equivalent
// baseline once. Migration installation must not change this role contract.
sql(databases[0], "alter role authenticated set statement_timeout='8s';");
const roleBaseline = sql(databases[0], "select rolconfig::text from pg_roles where rolname='authenticated';");
const results = [];
function prepareHistoricalReview(db) {
  // Execute the real frozen Preview/guard locally, then restore the current
  // definitions atomically. Never forge or rewrite an immutable Review row.
  const names=['hotel_v2_admin_preview_seven_arches_pricing_activation','hotel_v2_seven_arches_pricing_activation_review_guard'];
  const saved=sql(db,`select pg_get_functiondef(oid)||';' from pg_proc where proname in (${names.map(n=>`'${n}'`).join(',')});`);
  const frozen=readFileSync('supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql','utf8');
  const definitions=names.map(name=>{
    const start=frozen.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`,'i'));
    assert.ok(start>=0);const end=frozen.indexOf('$function$;',frozen.indexOf('as $function$',start)+13)+11;
    return frozen.slice(start,end).replace(/^create function/i,'create or replace function');
  }).join('\n');
  sql(db,`begin; ${definitions}
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
        'reason','Local historical Review lifecycle regression'));
    end$$;
    reset role; ${saved} commit;`);
}
try {
  for (let i = 0; i < databases.length; i++) {
    const db = databases[i];
    prepareHistoricalReview(db);
    sql(db, `create schema timeout_probe;
      grant usage on schema timeout_probe to authenticated;
      create function timeout_probe.control() returns text language plpgsql as
      $$begin perform pg_sleep(9); return current_setting('statement_timeout'); end$$;
      create function timeout_probe.exempt() returns text language plpgsql set statement_timeout='60s' as
      $$begin perform pg_sleep(9); return current_setting('statement_timeout'); end$$;
      revoke all on all functions in schema timeout_probe from public;
      grant execute on all functions in schema timeout_probe to authenticated;`);
    const uri = new URL(db); uri.username = 'authenticator';
    const port = 30577 + i;
    const server = spawn(postgrest, [], { env: { ...process.env,
      PGRST_DB_URI: uri.href, PGRST_DB_SCHEMAS: 'public,timeout_probe',
      PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(port),
      PGRST_DB_HOISTED_TX_SETTINGS: 'statement_timeout,plan_filter.statement_cost_limit,default_transaction_isolation',
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; server.stderr.on('data', b => { log += b; });
    server.stdout.resume();
    try {
      const root = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let n=0; n<100; n++) {
        if (server.exitCode !== null) throw new Error(`PostgREST exited: ${log}`);
        try { const r = await fetch(root, {signal: AbortSignal.timeout(1000)}); if(r.ok) {ready=true;break;} } catch {}
        await new Promise(r=>setTimeout(r,100));
      }
      assert.ok(ready, 'PostgREST startup timeout');
      const timings = {};
      for (const name of ['control','exempt','control']) {
        const start=performance.now();
        const response=await fetch(`${root}/rpc/${name}`, { method:'POST',
          headers:{Authorization:`Bearer ${TOKENS.admin}`,'Content-Type':'application/json','Content-Profile':'timeout_probe'},
          body:'{}',signal:AbortSignal.timeout(65000) });
        const body=await response.json();
        timings[name]={status:response.status,elapsed_ms:performance.now()-start,result:name==='exempt'?body:body.code};
        if(name==='control') { assert.equal(body.code,'57014'); assert.ok(timings[name].elapsed_ms>=7500); }
        else { assert.equal(response.status,200); assert.equal(body,'1min'); }
      }
      const gate = spawn(process.execPath, ['tests/integration/hotels-v2-seven-arches-pricing-activation-browser-roundtrip-postgrest-gate.mjs'],
        {env:{...process.env,HOTELS_V2_114406_DISPOSABLE:'1',HOTELS_V2_114406_POSTGREST_URL:root,
          HOTELS_V2_114406_ADMIN_TOKEN:TOKENS.admin,HOTELS_V2_114406_DATABASE_URL:db,HOTELS_V2_114406_PSQL:psql},
          stdio:['ignore','pipe','pipe']});
      let output='',error=''; gate.stdout.on('data',b=>output+=b); gate.stderr.on('data',b=>error+=b);
      const [code]=await once(gate,'close');
      assert.equal(code,0,`${i===0?'BASELINE':'114407'} real browser gate failed: ${error}\n${output}`);
      const evidence=JSON.parse(output.slice(0,output.lastIndexOf('\n}',output.indexOf('browser_roundtrip_apply'))+2));
      results.push({boundary:i===0?'114406':'114407',port,synthetic_timeout:timings,real_apply:evidence});
      assert.equal(sql(db,"select rolconfig::text from pg_roles where rolname='authenticated';"),roleBaseline);
    } finally {
      const closed=once(server,'close'); server.kill('SIGTERM'); await closed;
      sql(db,'drop schema timeout_probe cascade;');
    }
    if (i===1 && process.env.HOTELS_114407_FORWARD_CHAIN==='1') {
      const forward=[];
      for (const version of ['114410','114415','114420','114425','114450']) {
        if(version==='114420') {
          // The reduced base fixture omits general booking/coupon infrastructure.
          // Reuse its column expansion, but install the REAL committed coupon
          // function, not the existing gate's unrelated coupon-test stand-in.
          const fixture=readFileSync('tests/integration/hotels-v2-seven-arches-application-pricing-bridge-postgres-gate.sql','utf8');
          sql(db,fixture.slice(fixture.indexOf('alter table public.hotel_bookings'),
            fixture.indexOf('-- The focused accepted-chain fixture')));
          const source=readFileSync('supabase/migrations/124_service_coupon_quote_and_booking_enforcement.sql','utf8');
          const start=source.indexOf('CREATE OR REPLACE FUNCTION public.service_coupon_quote(');
          sql(db,source.slice(start,source.indexOf('$$;',start)+3));
        }
        const files=readdirSync('supabase/migrations').filter(f=>f.startsWith(`202608${version}00_`));
        assert.equal(files.length,1);
        sql(db,readFileSync(`supabase/migrations/${files[0]}`,'utf8'));
        assert.equal(sql(db,'select public.hotel_v2_seven_arches_pricing_activation_current_is_safe();'),'t');
        forward.push({version,current_safe:true,embedded_installation_checks:'PASS'});
      }
      sql(db,readFileSync('supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql','utf8'));
      results[i].forward_chain=forward;
      results[i].final_provider_verifier='PASS';
    }
  }
  console.log(JSON.stringify({postgrest:spawnSync(postgrest,['--version'],{encoding:'utf8'}).stdout.trim(),
    db_hoisted_tx_settings:'statement_timeout,plan_filter.statement_cost_limit,default_transaction_isolation',
    function_only_timeout_effective:true,global_auth_timeout_unchanged:true,
    real_apply_baseline_timeout_reproduced:false,results},null,2));
} finally {
  // The pre-existing fixture has no role settings; don't generalize restoration.
  sql(databases[0],'alter role authenticated reset statement_timeout;');
}
