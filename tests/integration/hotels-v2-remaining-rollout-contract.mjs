// Offline projections used only by the final remaining-stage rollout gates.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {hash,literal,array,functionQuery,columnsQuery,constraintsQuery,indexesQuery} from './hotels-v2-114420-postinstall-contract.mjs';
export {hash,literal,array};
export const stages=[114450,114460,114470,114480];
export const migrations={
114450:['20260811445000_hotels_v2_external_calendar_provider_types.sql','6151c12a14022e64f6e30421fca6646bc2a540cc111b399b88ac80934174a5d3'],
114460:['20260811446000_hotels_v2_partner_stripe_connect.sql','1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14'],
114470:['20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql','4c411a16b84475d465909daad23ceaa0770202b325344978b21b486a31636d60'],
114480:['20260811448000_hotels_v2_audited_capability_lifecycle.sql','2bce4cc9d2cef073acce9c416a2b6a5cd681cd24e100c5b1501ee276e3a173fa']};
export function migration(stage){const [name,sha]=migrations[stage],path='supabase/migrations/'+name,sql=readFileSync(path,'utf8');assert.equal(hash(sql),sha);return {path,sha,sql,lines:sql.split('\n').length-1};}
export const stageTables={
114450:['hotel_external_calendar_provider_evolution_receipts','hotel_external_calendar_partner_proposals','hotel_external_calendar_provider_review_receipts','hotel_external_calendar_provider_admin_previews'].map(n=>'hotels_v2_private.'+n),
114460:['accounts','oauth_states','events'].map(n=>'hotel_stripe_connect_private.'+n),
114470:['hotel_stripe_connect_private.onboarding_authorizations'],
114480:['bindings','foundation','decisions','context','stripe_readiness'].map(n=>'hotels_lifecycle_private.'+n)};
// Exact Hotels contract namespaces plus explicit security dependencies from
// 042 and 111800. Other public application functions are not Hotels authority.
// New overloads/functions inside this protected universe must fail closed.
export const functionInventoryQuery=functionQuery.replace(/WHERE n\.nspname='public' AND p\.proname=ANY\([\s\S]*$/,
"WHERE p.prokind='f' AND ((n.nspname='public' AND (left(p.proname,9)='hotel_v2_' OR p.proname IN ('is_current_user_admin','hotel_bookings_assign_authenticated_owner'))) OR n.nspname IN ('hotels_v2_private','hotels_lineage_private','hotel_stripe_connect_private','hotels_lifecycle_private'))");
export function relationQuery(name){
 const table=name.split('.')[1],q=fn=>fn(table).replaceAll('public.'+table,name);
 return `SELECT jsonb_build_object('columns',(${q(columnsQuery)}),'constraints',(${q(constraintsQuery)}),'indexes',(${q(indexesQuery)}),
 'security',(SELECT jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
 'nonowner_acl',coalesce((SELECT jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable) ORDER BY a.grantee,a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>c.relowner),'[]'::jsonb),
 'column_acl',coalesce((SELECT jsonb_agg(jsonb_build_array(col.attname,a.grantee::regrole::text,a.privilege_type,a.is_grantable) ORDER BY col.attname,a.grantee,a.privilege_type) FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE col.attrelid=c.oid AND a.grantee<>c.relowner),'[]'::jsonb),
 'effective',EXISTS(SELECT 1 FROM (VALUES(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid)) r(id) CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v(priv) WHERE has_table_privilege(r.id,c.oid,v.priv) OR CASE WHEN v.priv IN('SELECT','INSERT','UPDATE','REFERENCES') THEN has_any_column_privilege(r.id,c.oid,v.priv) ELSE false END),
 'policies',coalesce((SELECT jsonb_agg(to_jsonb(p)-'oid'-'polrelid' ORDER BY polname) FROM pg_policy p WHERE p.polrelid=c.oid),'[]'::jsonb),
 'children',(SELECT count(*) FROM pg_inherits WHERE inhparent=c.oid),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),'[]'::jsonb)) FROM pg_class c WHERE c.oid=to_regclass(${literal(name)})))`;
}
export const compactFunctionQuery=`SELECT jsonb_agg(jsonb_build_object('signature',f->>'signature','source_sha',f->>'source_sha','catalog_sha',encode(sha256(convert_to(f::text,'UTF8')),'hex')) ORDER BY f->>'signature') FROM jsonb_array_elements((${functionInventoryQuery})) f`;
export function schemaSecurityExpression(schema){const authUsage=schema==='hotels_v2_private';return `EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname=${literal(schema)} AND n.nspowner='postgres'::regrole AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE a.grantee<>n.nspowner AND NOT (${authUsage?'true':'false'} AND a.grantee='authenticated'::regrole AND a.privilege_type='USAGE' AND NOT a.is_grantable)) AND NOT EXISTS(SELECT 1 FROM (VALUES(0::oid),('anon'::regrole::oid),('authenticated'::regrole::oid),('service_role'::regrole::oid)) r(id) WHERE has_schema_privilege(r.id,n.oid,'CREATE') OR has_schema_privilege(r.id,n.oid,'USAGE') IS DISTINCT FROM (${authUsage?'true':'false'} AND r.id='authenticated'::regrole)))`;}
export function captureQuery(stage){const tables=stages.filter(s=>s<=stage).flatMap(s=>stageTables[s]);return `BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,public;SELECT jsonb_build_object('stage',${stage},'functions',(${compactFunctionQuery}),'relations',jsonb_build_object(${tables.flatMap(n=>[literal(n),'('+relationQuery(n)+')']).join(',')}));ROLLBACK;`;}
