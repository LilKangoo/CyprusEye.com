// Reproduce the historical gate failure and correction on ONE unchanged,
// owned, production-shaped local predecessor. Never connect to production.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {hash,literal,captureQuery,functionInventoryQuery} from './hotels-v2-remaining-rollout-contract.mjs';
import {build,loadCatalogs} from './hotels-v2-remaining-rollout-build.mjs';
import {authorities,adminSecurityAuthorities} from './hotels-v2-remaining-rollout-authority.mjs';
const db=process.env.HOTELS_RECONCILIATION_DB,bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_post425_remaining_[a-z0-9_]+$/);assert.ok(bin);
function sql(input){const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:32e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
assert.equal(sql("SELECT version FROM supabase_migrations.schema_migrations WHERE version='20260811442500'"),'20260811442500');
assert.equal(sql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN('20260811445000','20260811446000','20260811447000','20260811448000')"),'0');
const tables=JSON.parse(sql("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN('public','auth','hotels_v2_private','hotels_lineage_private','supabase_migrations')"));
const snapshot=()=>sql('BEGIN READ ONLY;SELECT jsonb_object_agg(name,hash) FROM ('+tables.map(t=>`SELECT ${literal(t)} name,public.hotel_v2_h3_2b_hash(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb)) hash FROM ${t} x`).join(' UNION ALL ')+') x;ROLLBACK;');
const before=snapshot(),old=spawnSync('git',['show','83b00502f69c6343ba8750ad2db635b4eed874ad:supabase/manual/hotels_v2_114450_preaction_readonly.sql'],{encoding:'utf8',maxBuffer:8e6});assert.equal(old.status,0,old.stderr);assert.equal(hash(old.stdout),'ead599bc7ddffb657903ee699dc28b0fdc7840f4bc2c9356260a1ba4e2d3fcd6');
const run=input=>sql(input).split('\n').map(l=>l.split('|')).slice(0,-1).filter(r=>r[5]!=='t').map(r=>({leaf:r[2],actual:r[4]}));
const failedBefore=run(old.stdout);assert.equal(failedBefore.length,20);assert.equal(failedBefore.filter(r=>r.actual==='').length,17);
assert.deepEqual(failedBefore.filter(r=>r.actual==='false').map(r=>r.leaf).sort(),['complete_function_universe_exact','hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)','is_current_user_admin()']);
const g=build(114450,'preaction',loadCatalogs());assert.equal(g.sql,readFileSync('supabase/manual/hotels_v2_114450_preaction_readonly.sql','utf8'));
const failedAfter=run(g.sql);assert.deepEqual(failedAfter,[]);assert.equal(snapshot(),before);
assert.deepEqual(JSON.parse(sql(captureQuery(114425))),loadCatalogs()[114425]);
const metadata=JSON.parse(sql(`BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,public;SELECT jsonb_agg(f) FROM jsonb_array_elements((${functionInventoryQuery})) f WHERE f->>'signature' IN('is_current_user_admin()','hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)','hotel_bookings_assign_authenticated_owner()');ROLLBACK;`));
const admin=metadata.find(m=>m.signature==='is_current_user_admin()');
assert.equal(admin.owner,'postgres');assert.equal(admin.language,'plpgsql');assert.equal(admin.volatility,'s');assert.equal(admin.definer,true);assert.deepEqual(admin.configuration,['search_path=public']);
assert.deepEqual(admin.acl,['anon','authenticated','postgres','service_role'].map(r=>[r,'postgres','EXECUTE',false]));assert.deepEqual(admin.effective,[false,true,true,true]);
console.log(JSON.stringify({classification:'VERIFIER_DEFECT',failed_leaves_before:20,failed_leaves_after:0,prior_suppressed_reads:17,failed_before:failedBefore,rows_after:g.rows,protected_tables_unchanged:tables.length,authorities,adminSecurityAuthorities,metadata,production_access:false}));
