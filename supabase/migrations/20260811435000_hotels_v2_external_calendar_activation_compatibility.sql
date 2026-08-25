-- Stage 2E compatibility preparation.  This migration changes no flag.
-- It source-pins every accepted runtime guard that must remain usable when
-- only hotel_external_sync_enabled is activated by the separate 2F manual.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

create table hotels_v2_private.hotel_external_calendar_activation_receipts(
  id smallint primary key check(id=1),
  site_settings_without_external_fingerprint text not null
    check(site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'),
  compatibility_function_fingerprints jsonb not null
    check(jsonb_typeof(compatibility_function_fingerprints)='object'),
  created_at timestamptz not null default clock_timestamp()
);

do $compatibility$
declare v record; v_definition text; v_count integer; v_owner oid;
  v_secdef boolean; v_config text[]; v_acl aclitem[];
begin
  for v in select * from (values
    ('public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
      'or setting.hotel_external_sync_enabled','or false',1),
    ('public.hotel_v2_partner_list_assigned_properties(uuid)',
      'or setting.hotel_external_sync_enabled','or false',1),
    ('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
      'or setting.hotel_external_sync_enabled','or false',1),
    ('public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_get_content_control(uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
      'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1),
    ('public.hotel_v2_h3_2b_flags_off()',
      'and not hotel_external_sync_enabled','and true',1),
    ('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
      '''hotel_external_sync_enabled'',false',
      '''hotel_external_sync_enabled'',(select hotel_external_sync_enabled from public.site_settings where id=1)',1)
  ) expected(signature,needle,replacement,expected_count) loop
    if to_regprocedure(v.signature) is null then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_function_missing';
    end if;
    select proowner,prosecdef,proconfig,proacl into v_owner,v_secdef,v_config,v_acl
      from pg_proc where oid=to_regprocedure(v.signature);
    v_definition:=pg_get_functiondef(to_regprocedure(v.signature));
    v_count:=(length(v_definition)-length(replace(v_definition,v.needle,'')))/length(v.needle);
    if v_count<>v.expected_count then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_source_drift',
        detail=v.signature;
    end if;
    execute replace(v_definition,v.needle,v.replacement);
    if not exists(select 1 from pg_proc procedure where procedure.oid=to_regprocedure(v.signature)
        and procedure.proowner=v_owner and procedure.prosecdef=v_secdef
        and procedure.proconfig is not distinct from v_config and procedure.proacl is not distinct from v_acl) then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_metadata_drift',
        detail=v.signature;
    end if;
  end loop;

  -- These nested retained cores are part of the activated call graph but do
  -- not themselves contain the external flag guard.  Pin that fact so a
  -- future upstream rewrite cannot silently introduce a second bypass/block.
  for v in select * from (values
    ('public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)'),
    ('public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)')
  ) expected(signature) loop
    if to_regprocedure(v.signature) is null
       or pg_get_functiondef(to_regprocedure(v.signature)) like '%hotel_external_sync_enabled%' then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_nested_compatibility_source_drift',
        detail=v.signature;
    end if;
  end loop;
end
$compatibility$;

create function public.hotel_v2_external_calendar_activation_function_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,public.hotel_v2_external_calendar_worker_hash(
  to_jsonb(pg_get_functiondef(to_regprocedure(signature)))) order by signature)
from (values
  ('public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'),
  ('public.hotel_v2_partner_list_assigned_properties(uuid)'),
  ('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)'),
  ('public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)'),
  ('public.hotel_v2_admin_get_content_control(uuid)'),
  ('public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)'),
  ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)'),
  ('public.hotel_v2_h3_2b_flags_off()'),
  ('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'),
  ('public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)'),
  ('public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)')
) expected(signature)
$function$;
alter function public.hotel_v2_external_calendar_activation_function_fingerprints() owner to postgres;
revoke all on function public.hotel_v2_external_calendar_activation_function_fingerprints()
from public,anon,authenticated,service_role;

insert into hotels_v2_private.hotel_external_calendar_activation_receipts(
  id,site_settings_without_external_fingerprint,compatibility_function_fingerprints)
select 1,public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled'),
  public.hotel_v2_external_calendar_activation_function_fingerprints()
from public.site_settings setting where id=1;
create trigger hotel_external_calendar_activation_receipt_immutable before update or delete
on hotels_v2_private.hotel_external_calendar_activation_receipts for each row
execute function public.hotel_v2_h3_2a_reject_immutable_change();
alter table hotels_v2_private.hotel_external_calendar_activation_receipts owner to postgres;
revoke all on hotels_v2_private.hotel_external_calendar_activation_receipts
from public,anon,authenticated,service_role;

do $postconditions$
begin
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled
      or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_changed_flags';
  end if;
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      join public.site_settings setting on setting.id=receipt.id
      where receipt.id=1 and receipt.site_settings_without_external_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
        and receipt.compatibility_function_fingerprints=
          public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_receipt_mismatch';
  end if;
  if not exists(select 1 from pg_proc procedure
      where procedure.oid='public.hotel_v2_external_calendar_activation_function_fingerprints()'::regprocedure
        and procedure.proowner='postgres'::regrole and procedure.prosecdef
        and procedure.proconfig=array['search_path=pg_catalog, public']::text[])
     or has_function_privilege(0::oid,
       'public.hotel_v2_external_calendar_activation_function_fingerprints()'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_compatibility_security_mismatch';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
