-- Exact two-state Stage2F site-settings compatibility seam. The external
-- calendar flag may be either OFF or explicitly activated; every other byte
-- and every compatibility function remains bound to the immutable 114350
-- activation receipt.
begin;
set local lock_timeout='15s';
set local statement_timeout='120s';

do $preconditions$
begin
  if to_regclass('public.site_settings') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_compatibility_foundation_missing';
  end if;
  if to_regprocedure(
      'public.hotel_v2_external_calendar_site_settings_fingerprint()') is not null then
    raise exception using errcode='23514',
      message='hotels_v2_external_calendar_site_settings_compatibility_already_present';
  end if;
end
$preconditions$;

create function public.hotel_v2_external_calendar_site_settings_fingerprint()
returns text language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_setting public.site_settings%rowtype;
  v_receipt hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
  v_fingerprint text;
begin
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1)
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1) then
    return null;
  end if;
  select * into strict v_setting from public.site_settings where id=1;
  select * into strict v_receipt
  from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
  if v_setting.hotel_rooms_v2_enabled
     or v_setting.hotel_instant_booking_enabled
     or v_setting.hotel_stripe_connect_enabled
     or v_setting.hotel_external_sync_enabled is null then
    return null;
  end if;
  v_fingerprint:=public.hotel_v2_external_calendar_worker_hash(
    to_jsonb(v_setting)-'hotel_external_sync_enabled');
  if v_receipt.site_settings_without_external_fingerprint<>v_fingerprint
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    return null;
  end if;
  return v_fingerprint;
end
$function$;

alter function public.hotel_v2_external_calendar_site_settings_fingerprint()
  owner to postgres;
revoke all on function
  public.hotel_v2_external_calendar_site_settings_fingerprint()
  from public,anon,authenticated,service_role;

do $postconditions$
declare v_oid oid:=to_regprocedure(
  'public.hotel_v2_external_calendar_site_settings_fingerprint()');
begin
  if v_oid is null
     or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_oid)
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_compatibility_installation_failed';
  end if;
end
$postconditions$;

commit;
