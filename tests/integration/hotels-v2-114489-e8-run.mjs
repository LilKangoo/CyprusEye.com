// Reuse the runtime-certified E5B2 runner; only isolate names and add E8 checks.
// No migration/template rewrite, no Docker daemon changes, no external network.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {build,migrationPath} from './hotels-v2-114489-build.mjs';
import {root,sha} from './hotels-v2-114489-source-evidence.mjs';
process.chdir(root);
const expected='9e0b6d39bbeebcba0d386aca87ff8418ea8682763f9c5cfad964ef41c246af14';
assert.equal(sha(readFileSync(migrationPath)),expected);assert.equal(sha(build().migration),expected);
const path='/private/tmp/hotels-114489-e5b2-real-postgrest.sh';
let runner=readFileSync(path,'utf8');assert.equal(sha(runner),'07e05c8639948db15201923db2d09859053a14b6bdca1e372725d693dabbb644');
const stamp=String(Date.now()),database='hotels_114489_e8_'+stamp,sidecar='hotels-114489-e8-'+stamp;
const psql='/private/tmp/hotels-114489-docker-psql-plain.sh';
const sql=q=>execFileSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55510','-U','postgres','-d','postgres','-c',q],{encoding:'utf8'}).trim();
assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${database}'`),'0');
assert.equal(sha(readFileSync('/private/tmp/hotels-114489-e5b2-map-proxy.py')),'7a09a599f99e03ccc6d0b7c843108423a595e0f5d4e48fb381f1653cfcb19bd5');
runner=runner.replaceAll('hotels_114489_postgrest_test',database)
 .replaceAll('hotels-114489-postgrest-e5b2',sidecar)
 .replace('HTTP_PORT="53089"','HTTP_PORT="53090"')
 .replaceAll('/private/tmp/hotels-114489-e5b2-jwt.txt','/private/tmp/hotels-114489-e8-'+stamp+'.jwt')
 .replaceAll('hotels-114489-e5b2-d7-http.','hotels-114489-e8-http.')
 .replace('docker pull "$PGRST_IMAGE"','stop "REQUIRED_LOCAL_POSTGREST_IMAGE_MISSING" 40')
 .replace('docker pull "$CURL_IMAGE"','stop "REQUIRED_LOCAL_CURL_IMAGE_MISSING" 40');
const marker='echo "===== 25. FINAL DATABASE CERTIFICATION ====="';
assert.equal(runner.split(marker).length,2);
runner=runner.replace(marker,`HTTP_DB="$HTTP_DB" HTTP_PORT="$HTTP_PORT" FIXTURE_CONTAINER="$FIXTURE_CONTAINER" CURL_IMAGE="$CURL_IMAGE" PSQL="$PSQL" HTTP_DIR="$HTTP_DIR" ADMIN_TOKEN="$ADMIN_TOKEN" PARTNER_TOKEN="$PARTNER_TOKEN" node tests/integration/hotels-v2-114489-e8-public-postgrest.mjs\n${marker}`);
const output=mkdtempSync('/private/tmp/hotels-114489-e8-run.');
console.log('E8_LOG_DIR='+output+'\nE8_FRESH_DATABASE='+database);
let result;
try{
 // docker exec -i must not inherit/consume the shell's source stream.
 result=spawnSync('bash',['-c',runner],{input:'',encoding:'utf8',maxBuffer:16e6,timeout:600000});
 writeFileSync(output+'/runner.log',(result.stdout||'')+(result.stderr||''));
 console.log((result.stdout||'').split('\n').filter(l=>/E8_|=PASS|=YES|=NO|HTTP=|FINAL_HTTP_DB_STATE|HTTP_TEST_DB_LEFT/.test(l)).join('\n'));
 assert.equal(result.status,0,(result.stderr||'').slice(-3000));
 assert.match(result.stdout,/E8_PUBLIC_BOOKING=PASS cases=118 unchanged_business=true/);
 assert.match(result.stdout,/SOURCE_DATABASE_UNCHANGED=YES/);
 assert.equal(sha(build().migration),expected);assert.equal(sha(readFileSync(migrationPath)),expected);
 console.log('E8_REAL_HTTP=PASS\nE4C_REPO_LOCAL_REPRODUCTION=PRESERVED_PASS');
}finally{
 // Only this newly named sidecar/database, never source or previous fixtures.
 const exists=spawnSync('docker',['inspect',sidecar],{stdio:'ignore'}).status===0;
 if(exists)execFileSync('docker',['rm','-f',sidecar],{stdio:'ignore'});
 if(sql(`SELECT count(*) FROM pg_database WHERE datname='${database}'`)==='1'){
  assert.equal(sql(`SELECT count(*) FROM pg_stat_activity WHERE datname='${database}'`),'0');
  sql('DROP DATABASE '+database);console.log('E8_DISPOSABLE_DATABASE_REMOVED=YES');
 }
 console.log('E8_SIDECAR_CLEANUP=PASS');
}
