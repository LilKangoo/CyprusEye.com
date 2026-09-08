// Loopback-only ordinary RPC probe: proves no global role timeout exemption.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {TOKENS} from './hotels-v2-h3-2a-partner-access-auth.mjs';
const database=process.env.HOTELS_LIFECYCLE_TEST_DATABASE;
const binary=process.env.HOTELS_CONNECT_TEST_PSQL;
assert.match(database||'',/^hotels_functional_global_[a-z0-9_]+$/);
assert.ok(binary?.startsWith('/private/tmp/')&&binary.endsWith('/bin/psql'));
const sql=q=>{const r=spawnSync(binary,['-X','-qAt','-h','127.0.0.1','-p','55479','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-c',q],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
assert.equal(sql("select host(inet_server_addr())||':'||inet_server_port()"),'127.0.0.1:55479');
assert.equal(sql("select to_regprocedure('public.local_lifecycle_timeout_probe()') is null"),'t');
const roleBefore=sql("select coalesce(rolconfig::text,'NULL') from pg_roles where rolname='authenticated'");
sql(`CREATE FUNCTION public.local_lifecycle_timeout_probe() RETURNS boolean LANGUAGE plpgsql AS $f$ BEGIN PERFORM pg_sleep(9); RETURN true; END $f$;
 REVOKE ALL ON FUNCTION public.local_lifecycle_timeout_probe() FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.local_lifecycle_timeout_probe() TO authenticated;
 NOTIFY pgrst,'reload schema';`);
try {
 // Await cache refresh without making any repeat mutation request.
 await new Promise(resolve=>setTimeout(resolve,1200));
 const start=performance.now();
 const response=await fetch('http://127.0.0.1:53079/rpc/local_lifecycle_timeout_probe',{
  method:'POST',headers:{Authorization:`Bearer ${TOKENS.admin}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
 const result=await response.json(),elapsed=Math.round(performance.now()-start);
 assert.equal(result.code,'57014');assert.ok(elapsed>=7500&&elapsed<11000);
 assert.equal(sql("select coalesce(rolconfig::text,'NULL') from pg_roles where rolname='authenticated'"),roleBefore);
 console.log(JSON.stringify({sentinel:'HOTELS_ORDINARY_RPC_TIMEOUT_PASS',elapsed_ms:elapsed,code:result.code,global_role_unchanged:true}));
} finally {
 sql("DROP FUNCTION public.local_lifecycle_timeout_probe(); NOTIFY pgrst,'reload schema';");
}
