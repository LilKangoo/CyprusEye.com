begin;
set transaction read only;
with relations as (
 select c.*,r.rolname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 join pg_roles r on r.oid=c.relowner where n.nspname='hotel_stripe_connect_private' and c.relkind='r'
), functions as (
 select p.* from pg_proc p where p.oid in (
   to_regprocedure('public.hotel_v2_stripe_connect_service(text,jsonb)'),
   to_regprocedure('hotel_stripe_connect_private.scope(uuid,uuid,uuid)'))
)
select 'hotels_partner_stripe_connect_postinstall_v1' contract_version,
 current_setting('transaction_read_only')='on' transaction_read_only,
 (select count(*)=3 and bool_and(rolname='postgres' and relrowsecurity and relforcerowsecurity)
   from relations) private_relations_exact,
 not exists(select 1 from relations r, lateral aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a
   where a.grantee<>r.relowner) no_nonowner_table_grants,
 not exists(select 1 from pg_policy where polrelid in(select oid from relations)) no_browser_policies,
 (select count(*)=2 and bool_and(proowner='postgres'::regrole and prosecdef
   and not has_function_privilege(0::oid,oid,'EXECUTE')
   and not has_function_privilege('anon',oid,'EXECUTE')
   and not has_function_privilege('authenticated',oid,'EXECUTE')) from functions) private_functions_exact,
 has_function_privilege('service_role','public.hotel_v2_stripe_connect_service(text,jsonb)','EXECUTE') service_boundary_available,
 not has_schema_privilege('service_role','hotel_stripe_connect_private','USAGE') no_raw_service_access,
 (select count(*) from hotel_stripe_connect_private.accounts) account_count,
 (select count(*) from hotel_stripe_connect_private.oauth_states) oauth_state_count,
 (select count(*) from hotel_stripe_connect_private.events) event_count,
 (select count(*)=1 and bool_and(id=1 and hotel_stripe_connect_enabled is false) from public.site_settings) stripe_disabled;
rollback;
