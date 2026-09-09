import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const db=process.env.HOTELS_RECONCILIATION_DB,bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(bin);
function sql(input){const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:4e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
assert.equal(sql("SELECT to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NULL AND hotels_lineage_private.current_anchor_is_exact()"),'t');
// Local fixture history only. No CLI repair and no production connection.
sql(`CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
 INSERT INTO supabase_migrations.schema_migrations SELECT '202608'||v||'00'
 FROM unnest(ARRAY['114350','114360','114370','114400','114405','114406','114407','114410','114415','114416']) v;`);
const source=readFileSync(new URL('../../supabase/manual/hotels_v2_114420_after_lineage_reconciliation_preaction_readonly.sql',import.meta.url),'utf8');
assert.match(source,/^BEGIN;\nSET TRANSACTION READ ONLY;/);assert.match(source,/ROLLBACK;\s*$/);
const rows=sql(source).split('\n').map(r=>r.split('|'));
const failures=rows.filter(r=>r[5]!=='t');
console.log(JSON.stringify({row_count:rows.length,failures,summary:rows.at(-1)},null,2));
assert.equal(rows.length,127);assert.deepEqual(failures,[]);
assert.equal(rows.at(-1)[7],'t');assert.equal(rows.at(-1)[8],'[]');
console.log('FINAL_PREACTION_READY=true; blockers=[]; transaction_read_only=on');
