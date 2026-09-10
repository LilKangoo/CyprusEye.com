import {readFileSync} from 'node:fs';
import {lit,stateCheck,schema,hash} from './hotels-v2-114481-contract.mjs';
export const pins=JSON.parse(readFileSync(new URL('./hotels-v2-114481-pins.json',import.meta.url),'utf8'));
export function build(phase){
 if(!['preactivation','postinstall'].includes(phase))throw Error('phase');
 const post=phase==='postinstall',entries=Object.entries(pins[post?'after':'before']);
 const checks=[
 ['read_only',"current_setting('transaction_read_only')='on'"],
 ['114480_recorded',"EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448000')"],
 ['114481_and_later_unrecorded',"NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448000')"],
 ['successor_schema',`to_regnamespace('${schema}') IS ${post?'NOT ':''}NULL`],
 ['scoped_pre_activation_state',`CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN (${stateCheck}) ELSE false END`],
 ];
 if(post)checks.push(
 ['commission_EUR10_exact',`(SELECT count(*)=1 AND bool_and(commission_mode='per_allocated_room_per_night' AND amount=10 AND btrim(currency::text)='EUR') FROM public.hotel_commission_policies WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND is_active AND review_status='reviewed')`],
 ['adapter_certificate_exact',`CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN (SELECT count(*)=1 AND bool_and(helper_catalog=${schema}.helper_catalog() AND relation_catalog=${schema}.relation_catalog() AND binding_hash=(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(b) ORDER BY signature)::text,'UTF8')),'hex') FROM ${schema}.bindings b)) FROM ${schema}.certificate) ELSE false END`],
 ['pricing_payment_commission_and_receipts_unchanged',`CASE WHEN (SELECT bool_and(pass) FROM function_checks) THEN ${schema}.business_hash()=(SELECT business_hash FROM ${schema}.certificate WHERE id=1) ELSE false END`],
 ['admin_safe_account_fields',`EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)') AND prosrc LIKE '%''account_exists''%' AND prosrc LIKE '%''account_status''%' AND prosrc NOT LIKE '%account_id%' AND prosrc NOT LIKE '%oauth_states%')`],
 ['partner_safe_readiness_fields',`EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('hotels_lifecycle_private.partner_connection(uuid,uuid)') AND prosrc LIKE '%''platform_ready''%' AND prosrc LIKE '%''attestation_status''%' AND prosrc LIKE '%hotel_v2_h3_2a_require_partner_hotel_access%' AND prosrc NOT LIKE '%account_id%')`]);
 const n=entries.length+checks.length;
 return {rows:n+1,sql:`BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
-- 114481 ${phase}: ${n+1} rows, one result set. No timeout override or write lock.
-- Source/security pins prove the same DTO and scoping bodies exercised by local
-- role/foreign-Partner tests; this gate does NOT impersonate any production user.
-- Lifecycle, pricing and permission reads are suppressed if source pins differ.
WITH expected(signature,source_hash,metadata) AS (VALUES
${entries.map(([s,p])=>` (${lit(s)},${lit(p.source_hash)},${lit(JSON.stringify(p.metadata))}::jsonb)`).join(',\n')}
), function_checks AS MATERIALIZED (
 SELECT signature,coalesce(p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source_hash
 AND hotels_lifecycle_private.metadata(p.oid)=e.metadata,false) pass
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
), leaves AS MATERIALIZED (
 SELECT row_number() OVER(ORDER BY signature)::integer ordinal,signature check_name,pass FROM function_checks
 UNION ALL
 SELECT * FROM (VALUES
${checks.map(([s,q],i)=>` (${entries.length+i+1},${lit(s)},(${q}) IS TRUE)`).join(',\n')}
 ) c(ordinal,check_name,pass)
)
SELECT ordinal,check_name,pass FROM leaves
UNION ALL SELECT ${n+1},'HOTELS_114481_${post?'POSTINSTALL':'PREACTION'}_READY',bool_and(pass) FROM leaves ORDER BY ordinal;
ROLLBACK;
`};
}
if(process.argv[2])process.stdout.write(build(process.argv[2]).sql);
