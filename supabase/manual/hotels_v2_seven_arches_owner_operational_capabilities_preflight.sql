-- Read-only production preflight for the forward 7 Arches owner preset.
-- Supabase SQL Editor compatible. Run before migration 143.6.
begin;
set transaction read only;
set local statement_timeout='90s';

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_partner uuid;
begin
  if to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_permissions_snapshot(uuid)') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_partner_hotel_permissions') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_partner_event_outbox') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: prerequisite missing';
  end if;
  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is not null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is not null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: migration boundary mismatch';
  end if;
  if not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')
        and (receipt.protected_fingerprints-'site_settings')=
          (public.hotel_v2_admin_d_protected_fingerprints()-'site_settings'))
     or not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
       and not hotel_instant_booking_enabled
       and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         where receipt.id=setting.id
           and receipt.site_settings_without_external_fingerprint=
             public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
           and receipt.compatibility_function_fingerprints=
             public.hotel_v2_external_calendar_activation_function_fingerprints())) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: ADMIN-D current baseline drift';
  end if;
  select hotel.owner_partner_id into v_partner from public.hotels hotel where hotel.id=c_hotel;
  if v_partner is null
     or (select count(*) from public.partner_resources assignment
       where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)<>1
     or not exists(select 1 from public.partner_resources assignment
       where assignment.partner_id=v_partner and assignment.resource_type='hotels'
         and assignment.resource_id=c_hotel)
     or not exists(select 1 from public.partners partner where partner.id=v_partner
       and partner.status='active' and partner.can_manage_hotels)
     or (select count(*) from public.partner_users member
       where member.partner_id=v_partner and member.role='owner')<>1
     or exists(select 1 from public.hotel_partner_hotel_permissions permission
       where permission.hotel_id=c_hotel) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_PREFLIGHT_FAIL: exact owner assignment/preset boundary mismatch';
  end if;
end
$preflight$;

with diagnostics as(
  select
    case when exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1 and (receipt.protected_fingerprints-'site_settings')=
        (public.hotel_v2_admin_d_protected_fingerprints()-'site_settings'))
      and exists(select 1 from public.site_settings where id=1
        and not hotel_rooms_v2_enabled and not hotel_instant_booking_enabled
        and not hotel_stripe_connect_enabled)
      then 0 else 1 end admin_d_baseline_mismatch,
    case when exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and partner.status='active' and partner.can_manage_hotels)
      and (select count(*) from public.partner_resources assignment
        where assignment.resource_type='hotels'
          and assignment.resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')=1
      then 0 else 1 end owner_assignment_mismatch,
    case when not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')
      then 0 else 1 end preset_boundary_mismatch
)
select 'hotels_v2_seven_arches_owner_operational_capabilities_preflight_v1' contract_version,
  admin_d_baseline_mismatch,owner_assignment_mismatch,preset_boundary_mismatch,
  admin_d_baseline_mismatch=0 and owner_assignment_mismatch=0 and preset_boundary_mismatch=0
    as hotels_v2_seven_arches_owner_operational_capabilities_preflight_safe
from diagnostics;
commit;
