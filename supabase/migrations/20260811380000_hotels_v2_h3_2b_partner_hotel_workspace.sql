begin;
set transaction isolation level repeatable read;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- Hotels V2 H3.2B Partner Hotel workspace. This is an authenticated shadow
-- control plane only: legacy architecture and all public Hotels V2 flags stay OFF.

do $h3_2b_preconditions$
declare v_h3 jsonb;
begin
  if to_regprocedure('public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_require_partner_membership(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_2a_permissions_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_pricing_control_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_b_i18n_is_valid(jsonb,boolean,integer)') is null
     or to_regprocedure('public.hotel_v2_admin_b_string_array_is_valid(jsonb,integer)') is null
     or to_regprocedure('public.hotel_v2_admin_b_gallery_is_valid(jsonb,integer)') is null
     or to_regprocedure('public.hotel_v2_admin_b_beds_are_valid(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_b_google_maps_url_is_valid(text)') is null
     or to_regprocedure('public.hotel_v2_admin_b_property_gallery_is_valid(uuid,jsonb,jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_b_room_gallery_is_valid(uuid,uuid,jsonb,jsonb)') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_commission_policies') is null
     or to_regclass('storage.objects') is null
     or to_regclass('storage.buckets') is null
     or not exists(select 1 from storage.buckets where id='poi-photos') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_prerequisite_missing';
  end if;
  if exists(select 1 from unnest(array[
      'hotels','hotel_room_types','hotel_units','hotel_amenities','hotel_rate_plans','hotel_room_rates',
      'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
      'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_inventory','hotel_inventory_day_locks',
      'hotel_inventory_commitments','hotel_unit_calendar_blocks','hotel_commission_policies',
      'hotel_activity_log','partners','partner_users','partner_resources','partner_user_resources',
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_admin_availability_foundation_receipts'
    ]) required(relation_name)
    where to_regclass('public.'||required.relation_name) is null) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_protected_relation_missing';
  end if;
  if to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_partner_workspace_plan_reviews') is not null
     or to_regprocedure('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)') is not null then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_migration_boundary_mismatch';
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings
      where id=1 and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_public_activation_guard';
  end if;
  if exists(select 1 from public.partner_resources assignment
      join public.hotels hotel on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
      where hotel.architecture_version<>'legacy') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_legacy_architecture_guard';
  end if;
  if not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprint=encode(extensions.digest(
          convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_admin_d_foundation_receipt_integrity_drift';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);
  if not coalesce((v_h3->>'supported')::boolean,false)
     or v_h3#>>'{promotion,status}'<>'reviewed'
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or exists(select 1 from public.hotel_rate_plans
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_room_rates
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_pricing_schedules
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_h3_1p_foundation_drift';
  end if;
end
$h3_2b_preconditions$;

create unique index hotel_partner_hotel_permissions_h3_2b_tuple_uidx
  on public.hotel_partner_hotel_permissions(assignment_id,partner_id,hotel_id);

create table public.hotel_partner_property_drafts(
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique,
  partner_id uuid not null references public.partners(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  status text not null default 'pending_admin_review'
    check(status in('pending_admin_review','superseded','accepted','rejected')),
  version bigint not null default 1 check(version>0),
  source_property_updated_at timestamptz not null,
  content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
  photos jsonb not null default '{}'::jsonb check(jsonb_typeof(photos)='object'),
  actor_id uuid not null,
  correlation_id uuid not null unique,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_partner_property_drafts_assignment_tuple_key
    unique(assignment_id,partner_id,hotel_id),
  constraint hotel_partner_property_drafts_assignment_fkey
    foreign key(assignment_id,partner_id,hotel_id)
    references public.hotel_partner_hotel_permissions(assignment_id,partner_id,hotel_id)
    on delete restrict
);
alter table public.hotel_partner_property_drafts enable row level security;
revoke all on table public.hotel_partner_property_drafts from public,anon,authenticated,service_role;
comment on table public.hotel_partner_property_drafts is
  'H3.2B private Partner proposal. Canonical public.hotels remains byte-exact until a separate Admin review accepts a proposal.';

create function public.hotel_v2_h3_2b_guard_property_draft() returns trigger
language plpgsql set search_path=pg_catalog,public
as $function$
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_property_draft_delete_forbidden';
  end if;
  if tg_op='INSERT' and (new.status<>'pending_admin_review' or new.version<>1
      or new.source_property_updated_at is distinct from
        (select hotel.updated_at from public.hotels hotel where hotel.id=new.hotel_id)) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_property_draft_insert';
  end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id
      or new.assignment_id is distinct from old.assignment_id
      or new.partner_id is distinct from old.partner_id
      or new.hotel_id is distinct from old.hotel_id
      or new.created_at is distinct from old.created_at
      or new.version<>old.version+1
      or new.updated_at<=old.updated_at) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_property_draft_transition';
  end if;
  if not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=new.assignment_id and permission.partner_id=new.partner_id
        and permission.hotel_id=new.hotel_id) then
    raise exception using errcode='23514',message='hotels_v2_h3_2b_property_draft_assignment_mismatch';
  end if;
  return new;
end
$function$;

-- Install an exact private clone of the accepted ADMIN-C outer quote
-- orchestration. Only its Admin authorization line and function name differ;
-- all allocation, demographic, precedence and product DTO semantics remain
-- byte-derived from the installed production-reviewed ADMIN-C definition.
do $h3_2b_clone_pricing_core$
declare v_definition text; v_without_auth text;
begin
  select pg_get_functiondef('public.hotel_v2_admin_preview_pricing_quote(jsonb)'::regprocedure)
    into v_definition;
  if v_definition is null
     or (length(v_definition)-length(replace(v_definition,
       'perform public.hotel_v2_h2a_require_admin();','')))
        /length('perform public.hotel_v2_h2a_require_admin();')<>1 then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_admin_c_quote_contract_mismatch';
  end if;
  v_without_auth:=replace(v_definition,'hotel_v2_admin_preview_pricing_quote',
    'hotel_v2_h3_2b_pricing_quote_core');
  v_without_auth:=replace(v_without_auth,'perform public.hotel_v2_h2a_require_admin();',
    'perform 1 /* H3.2B outer RPC already proved exact Partner access */;');
  execute v_without_auth;
end
$h3_2b_clone_pricing_core$;

create schema if not exists hotels_v2_private authorization postgres;
alter schema hotels_v2_private owner to postgres;
revoke all on schema hotels_v2_private from public,anon,authenticated,service_role;
grant usage on schema hotels_v2_private to authenticated;

create function hotels_v2_private.h3_2b_can_insert_photo(
  p_bucket_id text,
  p_name text,
  p_metadata jsonb
) returns boolean
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
declare v_match text[]; v_assignment uuid; v_hotel uuid; v_partner uuid; v_room uuid;
begin
  if p_bucket_id is distinct from 'poi-photos' or p_name is null
     or jsonb_typeof(p_metadata)<>'object'
     or lower(p_metadata->>'mimetype')<>'image/webp'
     or p_metadata->>'size'!~'^[0-9]+$'
     or (p_metadata->>'size')::bigint not between 1 and 10485760 then return false; end if;
  v_match:=regexp_match(p_name,
    '^hotels/([^/]+)/gallery/partner-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})[.]webp$');
  if v_match is not null then
    v_assignment:=v_match[2]::uuid;
    select permission.hotel_id,permission.partner_id into v_hotel,v_partner
    from public.hotel_partner_hotel_permissions permission
    join public.hotels hotel on hotel.id=permission.hotel_id and hotel.slug=v_match[1]
    where permission.assignment_id=v_assignment and permission.edit_property_photos;
    if v_hotel is null then return false; end if;
    perform public.hotel_v2_h3_2a_require_partner_hotel_access(v_partner,v_hotel,'edit_property_photos',false);
    return true;
  end if;
  v_match:=regexp_match(p_name,
    '^hotels/([^/]+)/rooms/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/partner-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})[.]webp$');
  if v_match is null then return false; end if;
  v_room:=v_match[2]::uuid; v_assignment:=v_match[3]::uuid;
  select permission.hotel_id,permission.partner_id into v_hotel,v_partner
  from public.hotel_partner_hotel_permissions permission
  join public.hotels hotel on hotel.id=permission.hotel_id and hotel.slug=v_match[1]
  join public.hotel_room_types room on room.id=v_room and room.hotel_id=hotel.id and room.status in('draft','active')
  where permission.assignment_id=v_assignment and permission.edit_room_photos;
  if v_hotel is null then return false; end if;
  perform public.hotel_v2_h3_2a_require_partner_hotel_access(v_partner,v_hotel,'edit_room_photos',false);
  return true;
exception when others then
  return false;
end
$function$;

create function hotels_v2_private.h3_2b_photo_object_exists(p_name text)
returns boolean
language sql
security definer
stable
set search_path=pg_catalog
as $function$
  select exists(select 1 from storage.objects object_row
    where object_row.bucket_id='poi-photos' and object_row.name=p_name
      and jsonb_typeof(object_row.metadata)='object'
      and lower(object_row.metadata->>'mimetype')='image/webp'
      and object_row.metadata->>'size'~'^[0-9]+$'
      and (object_row.metadata->>'size')::bigint between 1 and 10485760)
$function$;

create policy hotel_partner_h3_2b_photo_insert on storage.objects
for insert to authenticated
with check(hotels_v2_private.h3_2b_can_insert_photo(bucket_id,name,metadata));

create function public.hotel_v2_h3_2b_property_content_is_valid(
  p_hotel_id uuid,p_target jsonb,p_current jsonb
) returns boolean
language plpgsql
security definer
stable
set search_path=pg_catalog,public
as $function$
declare v_entry record;
begin
  if p_target is null or jsonb_typeof(p_target)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_target,array['title_i18n','description_i18n','city','address_line','district','postal_code','country','latitude','longitude','google_maps_url','amenities','check_in_from','check_out_until'])
     or not (p_target?&array['title_i18n','description_i18n','city','address_line','district','postal_code','country','latitude','longitude','google_maps_url','amenities','check_in_from','check_out_until'])
     or not public.hotel_v2_admin_b_i18n_is_valid(p_target->'title_i18n',true,240)
     or not public.hotel_v2_admin_b_i18n_is_valid(p_target->'description_i18n',false,12000)
     or not public.hotel_v2_admin_b_string_array_is_valid(p_target->'amenities',200)
     or jsonb_typeof(p_target->'latitude') not in('number','null')
     or jsonb_typeof(p_target->'longitude') not in('number','null') then return false; end if;
  for v_entry in select key,value from jsonb_each(p_target) where key in(
    'city','address_line','district','postal_code','country','google_maps_url','check_in_from','check_out_until') loop
    if jsonb_typeof(v_entry.value) not in('string','null') then return false; end if;
    if jsonb_typeof(v_entry.value)='string' and (v_entry.value#>>'{}') is distinct from btrim(v_entry.value#>>'{}') then return false; end if;
  end loop;
  if length(coalesce(p_target->>'city',''))>200
     or length(coalesce(p_target->>'address_line',''))>500
     or length(coalesce(p_target->>'district',''))>200
     or length(coalesce(p_target->>'postal_code',''))>40
     or length(coalesce(p_target->>'country',''))>100
     or nullif(p_target->>'city','') is null or nullif(p_target->>'country','') is null
     or (p_target->>'latitude' is not null and ((p_target->>'latitude')!~'^-?[0-9]+(?:[.][0-9]+)?$'
       or (p_target->>'latitude')::numeric not between -90 and 90))
     or (p_target->>'longitude' is not null and ((p_target->>'longitude')!~'^-?[0-9]+(?:[.][0-9]+)?$'
       or (p_target->>'longitude')::numeric not between -180 and 180))
     or (p_target->>'google_maps_url' is not null and not public.hotel_v2_admin_b_google_maps_url_is_valid(p_target->>'google_maps_url'))
     or (p_target->>'check_in_from' is not null and p_target->>'check_in_from'!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$')
     or (p_target->>'check_out_until' is not null and p_target->>'check_out_until'!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$')
     or exists(select 1 from jsonb_array_elements_text(p_target->'amenities') requested(code)
       where not exists(select 1 from jsonb_array_elements_text(coalesce(p_current->'amenities','[]'::jsonb)) prior(code) where prior.code=requested.code)
         and not exists(select 1 from public.hotel_amenities amenity where amenity.code=requested.code and amenity.is_active)) then
    return false;
  end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end
$function$;

create function public.hotel_v2_h3_2b_property_photos_are_valid(
  p_hotel_id uuid,p_assignment_id uuid,p_target jsonb,p_current jsonb
) returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select coalesce(p_target is not null and jsonb_typeof(p_target)='object'
    and public.hotel_v2_h2a_keys_allowed(p_target,array['cover_image_url','photos'])
    and p_target?&array['cover_image_url','photos']
    and jsonb_typeof(p_target->'cover_image_url') in('string','null')
    and public.hotel_v2_admin_b_property_gallery_is_valid(p_hotel_id,p_target->'photos',coalesce(p_current->'photos','[]'::jsonb))
    and (p_target->>'cover_image_url' is null or exists(select 1 from jsonb_array_elements_text(p_target->'photos') photo(url) where photo.url=p_target->>'cover_image_url'))
    and not exists(select 1 from jsonb_array_elements_text(p_target->'photos') proposed(url)
      where not exists(select 1 from jsonb_array_elements_text(coalesce(p_current->'photos','[]'::jsonb)) prior(url) where prior.url=proposed.url)
        and not exists(select 1 from public.hotels hotel, lateral jsonb_array_elements_text(coalesce(hotel.photos,'[]'::jsonb)) current(url)
          where hotel.id=p_hotel_id and current.url=proposed.url)
        and not exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id and proposed.url~(
          '^https://daoohnbnnowmmcizgvrq[.]supabase[.]co/storage/v1/object/public/poi-photos/hotels/'
          ||regexp_replace(hotel.slug,'([.\\+*?\\[\\](){}^$|])','\\\\\\1','g')
          ||'/gallery/partner-'||p_assignment_id::text||'-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$')
          and hotels_v2_private.h3_2b_photo_object_exists(substring(proposed.url from
            length('https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/')+1)))),false)
$function$;

create function public.hotel_v2_h3_2b_room_content_is_valid(
  p_hotel_id uuid,p_target jsonb,p_current jsonb
) returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select coalesce(p_target is not null and jsonb_typeof(p_target)='object'
    and public.hotel_v2_h2a_keys_allowed(p_target,array['name_i18n','description_i18n','amenities','floor_label_i18n'])
    and p_target?&array['name_i18n','description_i18n','amenities','floor_label_i18n']
    and public.hotel_v2_admin_b_i18n_is_valid(p_target->'name_i18n',true,240)
    and public.hotel_v2_admin_b_i18n_is_valid(p_target->'description_i18n',false,12000)
    and public.hotel_v2_admin_b_i18n_is_valid(p_target->'floor_label_i18n',false,160)
    and public.hotel_v2_admin_b_string_array_is_valid(p_target->'amenities',200)
    and not exists(select 1 from jsonb_array_elements_text(p_target->'amenities') requested(code)
      where not exists(select 1 from jsonb_array_elements_text(coalesce(p_current->'amenities','[]'::jsonb)) prior(code) where prior.code=requested.code)
        and not exists(select 1 from public.hotel_amenities amenity where amenity.code=requested.code and amenity.is_active)),false)
$function$;

create function public.hotel_v2_h3_2b_room_photos_are_valid(
  p_hotel_id uuid,p_room_id uuid,p_assignment_id uuid,p_target jsonb,p_current jsonb
) returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select coalesce(p_target is not null and jsonb_typeof(p_target)='object'
    and public.hotel_v2_h2a_keys_allowed(p_target,array['gallery']) and p_target?'gallery'
    and public.hotel_v2_admin_b_room_gallery_is_valid(p_hotel_id,p_room_id,p_target->'gallery',coalesce(p_current->'gallery','[]'::jsonb))
    and not exists(select 1 from jsonb_array_elements_text(p_target->'gallery') proposed(url)
      where not exists(select 1 from jsonb_array_elements_text(coalesce(p_current->'gallery','[]'::jsonb)) prior(url) where prior.url=proposed.url)
        and not exists(select 1 from public.hotels hotel, lateral jsonb_array_elements_text(coalesce(hotel.photos,'[]'::jsonb)) property_photo(url)
          where hotel.id=p_hotel_id and property_photo.url=proposed.url)
        and not exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id and proposed.url~(
          '^https://daoohnbnnowmmcizgvrq[.]supabase[.]co/storage/v1/object/public/poi-photos/hotels/'
          ||regexp_replace(hotel.slug,'([.\\+*?\\[\\](){}^$|])','\\\\\\1','g')
          ||'/rooms/'||p_room_id::text||'/partner-'||p_assignment_id::text||'-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$')
          and hotels_v2_private.h3_2b_photo_object_exists(substring(proposed.url from
            length('https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/')+1)))),false)
$function$;

create function public.hotel_v2_h3_2b_room_structure_is_valid(p_target jsonb)
returns boolean
language sql
immutable
set search_path=pg_catalog,public
as $function$
  select coalesce(p_target is not null and jsonb_typeof(p_target)='object'
    and public.hotel_v2_h2a_keys_allowed(p_target,array['capacity_adults','capacity_children','max_occupancy','bed_configuration','bathrooms','size_sqm','inventory_mode','base_inventory_count','sort_order'])
    and p_target?&array['capacity_adults','capacity_children','max_occupancy','bed_configuration','bathrooms','size_sqm','inventory_mode','base_inventory_count','sort_order']
    and jsonb_typeof(p_target->'inventory_mode')='string' and p_target->>'inventory_mode' in('pooled','unitized')
    and public.hotel_v2_admin_b_beds_are_valid(p_target->'bed_configuration')
    and not exists(select 1 from jsonb_each(p_target) entry where entry.key in('capacity_adults','capacity_children','max_occupancy','bathrooms','size_sqm','base_inventory_count','sort_order') and jsonb_typeof(entry.value) not in('number','null'))
    and not exists(select 1 from jsonb_each(p_target) entry where entry.key in('capacity_adults','capacity_children','max_occupancy','base_inventory_count','sort_order') and jsonb_typeof(entry.value)<>'null' and entry.value#>>'{}'!~'^[0-9]+$')
    and (((p_target->>'max_occupancy')::integer between 1 and 50 and p_target->>'capacity_adults' is null and p_target->>'capacity_children' is null)
      or (p_target->>'max_occupancy' is null and (p_target->>'capacity_adults')::integer between 1 and 50 and (p_target->>'capacity_children')::integer between 0 and 50))
    and (p_target->>'base_inventory_count')::integer between 0 and 10000
    and (p_target->>'sort_order')::integer between 0 and 1000000
    and (p_target->>'bathrooms' is null or ((p_target->>'bathrooms')::numeric between 0 and 100))
    and (p_target->>'size_sqm' is null or ((p_target->>'size_sqm')::numeric between 0.01 and 100000)),false)
$function$;

create function public.hotel_v2_h3_2b_room_create_is_valid(
  p_hotel_id uuid,p_room_id uuid,p_assignment_id uuid,p_target jsonb
) returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select coalesce(p_target is not null and jsonb_typeof(p_target)='object'
    and public.hotel_v2_h2a_keys_allowed(p_target,array['code','name_i18n','description_i18n','gallery','capacity_adults','capacity_children','max_occupancy','bed_configuration','bathrooms','size_sqm','amenities','inventory_mode','base_inventory_count','sort_order','floor_label_i18n'])
    and p_target?&array['code','name_i18n','description_i18n','gallery','capacity_adults','capacity_children','max_occupancy','bed_configuration','bathrooms','size_sqm','amenities','inventory_mode','base_inventory_count','sort_order','floor_label_i18n']
    and jsonb_typeof(p_target->'code')='string' and p_target->>'code'=lower(btrim(p_target->>'code'))
    and p_target->>'code'~'^[a-z0-9][a-z0-9_-]{0,79}$'
    and not exists(select 1 from public.hotel_room_types room where room.hotel_id=p_hotel_id and lower(room.code)=lower(p_target->>'code'))
    and public.hotel_v2_h3_2b_room_content_is_valid(p_hotel_id,jsonb_build_object(
      'name_i18n',p_target->'name_i18n','description_i18n',p_target->'description_i18n',
      'amenities',p_target->'amenities','floor_label_i18n',p_target->'floor_label_i18n'),'{}'::jsonb)
    and public.hotel_v2_h3_2b_room_photos_are_valid(p_hotel_id,p_room_id,p_assignment_id,
      jsonb_build_object('gallery',p_target->'gallery'),'{}'::jsonb)
    and public.hotel_v2_h3_2b_room_structure_is_valid(jsonb_build_object(
      'capacity_adults',p_target->'capacity_adults','capacity_children',p_target->'capacity_children',
      'max_occupancy',p_target->'max_occupancy','bed_configuration',p_target->'bed_configuration',
      'bathrooms',p_target->'bathrooms','size_sqm',p_target->'size_sqm','inventory_mode',p_target->'inventory_mode',
      'base_inventory_count',p_target->'base_inventory_count','sort_order',p_target->'sort_order')),false)
$function$;

create function public.hotel_v2_h3_2b_overlay_pricing_preview(
  p_pricing jsonb,p_entity text,p_target_id uuid,p_payload jsonb
) returns jsonb
language plpgsql
immutable
set search_path=pg_catalog
as $function$
declare v_day jsonb; v_days jsonb:='[]'::jsonb; v_product jsonb; v_products jsonb:='[]'::jsonb;
  v_rate numeric:=(p_payload->>'nightly_rate')::numeric; v_subtotal numeric; v_total numeric:=0;
  v_room_rate uuid; v_stay date;
begin
  if p_pricing is null or jsonb_typeof(p_pricing)<>'object'
     or p_entity not in('room_rate_price','schedule_tier_price','room_rate_tier_price','exact_date_price')
     or p_target_id is null or jsonb_typeof(p_payload)<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_overlay'; end if;
  v_room_rate:=case when p_entity='exact_date_price' then (p_payload->>'room_rate_id')::uuid else null end;
  v_stay:=case when p_entity='exact_date_price' then (p_payload->>'stay_date')::date else null end;
  for v_day in select value from jsonb_array_elements(coalesce(p_pricing->'nightly_breakdown','[]'::jsonb)) loop
    if (p_entity='exact_date_price' and (v_day->>'room_rate_id')::uuid=v_room_rate
          and (v_day->>'stay_date')::date=v_stay)
       or (p_entity='room_rate_price' and v_day->>'base_pricing_source'='base_nightly_rate'
          and (v_day->>'base_pricing_source_id')::uuid=p_target_id
          and v_day->>'final_pricing_source'=v_day->>'base_pricing_source')
       or (p_entity='schedule_tier_price' and v_day->>'base_pricing_source'='pricing_schedule_tier'
          and (v_day->>'base_pricing_source_id')::uuid=p_target_id
          and v_day->>'final_pricing_source'=v_day->>'base_pricing_source')
       or (p_entity='room_rate_tier_price' and v_day->>'base_pricing_source'='independent_occupancy_tier'
          and (v_day->>'base_pricing_source_id')::uuid=p_target_id
          and v_day->>'final_pricing_source'=v_day->>'base_pricing_source') then
      v_day:=v_day||jsonb_build_object('nightly_rate',round(v_rate,2));
      if p_entity='exact_date_price' then
        v_day:=v_day||jsonb_build_object('exact_date_price_id',p_target_id,
          'final_pricing_source','exact_date_price');
      end if;
    end if;
    v_days:=v_days||jsonb_build_array(v_day);
  end loop;
  for v_product in select value from jsonb_array_elements(coalesce(p_pricing->'products','[]'::jsonb)) loop
    select round(coalesce(sum((day->>'nightly_rate')::numeric),0),2) into v_subtotal
    from jsonb_array_elements(v_days) day(value)
    where day.value->>'room_type_id'=v_product->>'room_type_id'
      and day.value->>'room_rate_id'=v_product->>'room_rate_id'
      and day.value->>'rate_plan_id'=v_product->>'rate_plan_id'
      and day.value->>'unit_sequence'=v_product->>'unit_sequence';
    v_product:=v_product||jsonb_build_object('subtotal',v_subtotal);
    v_products:=v_products||jsonb_build_array(v_product); v_total:=v_total+v_subtotal;
  end loop;
  return p_pricing||jsonb_build_object('nightly_breakdown',v_days,'products',v_products,
    'customer_total',case when coalesce((p_pricing->>'ok')::boolean,false) then round(v_total,2) else null end);
end
$function$;

create function public.hotel_v2_partner_preview_commercial_stay(p_request jsonb)
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
declare v_partner uuid; v_hotel uuid; v_access jsonb; v_workspace jsonb; v_pricing_request jsonb;
  v_pricing jsonb; v_admin_c_snapshot jsonb; v_policy jsonb; v_commercial jsonb;
  v_quantity integer; v_top_blockers jsonb:='[]'::jsonb; v_check_in date; v_check_out date;
begin
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array['contract_version','partner_id','hotel_id','pricing_snapshot_token','rate_plan_id','allocation_rule_id','selected_room_type_id','check_in','check_out','adults','child_ages'])
     or not (p_request?&array['contract_version','partner_id','hotel_id','pricing_snapshot_token','rate_plan_id','allocation_rule_id','selected_room_type_id','check_in','check_out','adults','child_ages'])
     or p_request->>'contract_version'<>'hotels_v2_h3_2b_commercial_stay_request_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_request)
     or jsonb_typeof(p_request->'adults')<>'number' or p_request->>'adults'!~'^[1-9][0-9]*$'
     or (p_request->>'adults')::integer>50
     or jsonb_typeof(p_request->'child_ages')<>'array'
     or jsonb_array_length(p_request->'child_ages')>50
     or exists(select 1 from jsonb_array_elements(p_request->'child_ages') child_age(value)
       where jsonb_typeof(child_age.value)<>'number' or child_age.value#>>'{}'!~'^(0|[1-9][0-9]*)$'
         or (child_age.value#>>'{}')::integer>17) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_commercial_stay'; end if;
  v_partner:=(p_request->>'partner_id')::uuid; v_hotel:=(p_request->>'hotel_id')::uuid;
  v_check_in:=(p_request->>'check_in')::date; v_check_out:=(p_request->>'check_out')::date;
  if v_check_out<=v_check_in or v_check_out-v_check_in>365 then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_commercial_stay'; end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,'manage_prices');
  v_workspace:=public.hotel_v2_partner_get_workspace(v_partner,v_hotel,v_check_in,
    least(v_check_out-1,v_check_in+61));
  if p_request->>'pricing_snapshot_token' is distinct from v_workspace#>>'{pricing,snapshot_token}' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
  v_admin_c_snapshot:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel);
  v_pricing_request:=jsonb_build_object('contract_version','hotels_v2_admin_c_pricing_preview_v1',
    'hotel_id',v_hotel,'snapshot_token',v_admin_c_snapshot->>'snapshot_token',
    'rate_plan_id',p_request->'rate_plan_id','allocation_rule_id',p_request->'allocation_rule_id',
    'selected_room_type_id',p_request->'selected_room_type_id','check_in',p_request->'check_in',
    'check_out',p_request->'check_out','adults',p_request->'adults','child_ages',p_request->'child_ages');
  v_pricing:=public.hotel_v2_h3_2b_pricing_quote_core(v_pricing_request)
    ||jsonb_build_object('snapshot_token',p_request->>'pricing_snapshot_token');
  v_policy:=v_workspace#>'{pricing,commission_policy}';
  if coalesce((v_pricing->>'ok')::boolean,false) and v_pricing->'customer_total' is not null then
    v_quantity:=jsonb_array_length(v_pricing->'products')*((v_pricing->>'nights')::integer);
    v_commercial:=public.hotel_v2_h3_2b_commercial(v_policy,(v_pricing->>'customer_total')::numeric,
      v_quantity,(v_policy->>'amount')::numeric);
  else v_top_blockers:=jsonb_build_array('pricing_configuration_blocked'); end if;
  return jsonb_build_object('contract_version','hotels_v2_h3_2b_commercial_stay_preview_v1',
    'partner_id',v_partner,'hotel_id',v_hotel,'pricing',v_pricing,'commercial',v_commercial,
    'ok',v_commercial is not null,'blocking_reasons',v_top_blockers,
    'legacy_authoritative',true,'public_change',false);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_commercial_stay';
end
$function$;

create function public.hotel_v2_partner_preview_availability_plan(p_draft jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_partner uuid; v_hotel uuid; v_from date; v_to date; v_access jsonb; v_control jsonb;
  v_intent jsonb; v_payload jsonb; v_room uuid; v_stay date; v_original jsonb;
  v_expected bigint; v_id uuid; v_operation jsonb; v_impact jsonb; v_after jsonb;
  v_changed boolean:=false; v_capacity integer; v_impact_before jsonb; v_impact_after jsonb;
begin
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array['contract_version','partner_id','hotel_id','from','to','access_snapshot_token','availability_snapshot_token','intent'])
     or not (p_draft?&array['contract_version','partner_id','hotel_id','from','to','access_snapshot_token','availability_snapshot_token','intent'])
     or p_draft->>'contract_version'<>'hotels_v2_h3_2b_availability_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_draft) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_draft'; end if;
  begin v_partner:=(p_draft->>'partner_id')::uuid; v_hotel:=(p_draft->>'hotel_id')::uuid;
    v_from:=(p_draft->>'from')::date; v_to:=(p_draft->>'to')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_draft'; end;
  if v_to<v_from or v_to-v_from>61 then raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_range'; end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,'manage_availability');
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel,v_from,v_to,false);
  if p_draft->>'access_snapshot_token' is distinct from public.hotel_v2_h3_2b_hash(v_access)
     or p_draft->>'availability_snapshot_token' is distinct from v_control->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_availability_stale'; end if;
  v_intent:=p_draft->'intent';
  if jsonb_typeof(v_intent)<>'object' or not public.hotel_v2_h2a_keys_allowed(v_intent,array['entity','action','id','payload','reason'])
     or not (v_intent?&array['entity','action','id','payload','reason'])
     or v_intent->>'entity'<>'daily_inventory' or v_intent->>'action'<>'upsert'
     or jsonb_typeof(v_intent->'id')<>'null' or not public.hotel_v2_h3_2b_reason_is_valid(v_intent->'reason')
     or jsonb_typeof(v_intent->'payload')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_intent'; end if;
  v_payload:=v_intent->'payload';
  if not public.hotel_v2_h2a_keys_allowed(v_payload,array['room_type_id','stay_date','sellable_units','sellable_units_mode','closed','closed_mode','expires_at'])
     or not (v_payload?&array['room_type_id','stay_date'])
     or not ((v_payload?&array['sellable_units','sellable_units_mode']) or (v_payload?&array['closed','closed_mode']) or v_payload?'expires_at')
     or ((v_payload?'sellable_units')<>(v_payload?'sellable_units_mode'))
     or ((v_payload?'closed')<>(v_payload?'closed_mode')) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_daily_inventory_payload'; end if;
  v_room:=(v_payload->>'room_type_id')::uuid; v_stay:=(v_payload->>'stay_date')::date;
  if v_stay not between v_from and v_to
     or (v_payload?'sellable_units' and (jsonb_typeof(v_payload->'sellable_units_mode')<>'string'
       or v_payload->>'sellable_units_mode' not in('set','clear')
       or (v_payload->>'sellable_units_mode'='set' and (jsonb_typeof(v_payload->'sellable_units')<>'number'
         or v_payload->>'sellable_units'!~'^(0|[1-9][0-9]*)$'))
       or (v_payload->>'sellable_units_mode'='clear' and jsonb_typeof(v_payload->'sellable_units')<>'null')))
     or (v_payload?'closed' and (jsonb_typeof(v_payload->'closed_mode')<>'string'
       or v_payload->>'closed_mode' not in('set','clear')
       or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
       or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null')))
     or (v_payload?'expires_at' and jsonb_typeof(v_payload->'expires_at') not in('string','null'))
     or (jsonb_typeof(v_payload->'expires_at')='string' and (v_payload->>'expires_at')::timestamptz<=clock_timestamp()) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_daily_inventory_payload'; end if;
  v_original:=public.hotel_v2_h3_2b_daily_inventory_projection(v_room,v_stay);
  v_expected:=coalesce((v_original->>'version')::bigint,0);
  select case when room.inventory_mode='unitized' then (select count(*) from public.hotel_units unit_row where unit_row.room_type_id=room.id and unit_row.status='active') else room.base_inventory_count end
    into v_capacity from public.hotel_room_types room
    where room.id=v_room and room.hotel_id=v_hotel and room.status='active';
  if v_capacity is null or (v_payload->>'sellable_units_mode'='set' and (v_payload->>'sellable_units')::integer>v_capacity) then
    raise exception using errcode='23514',message='hotels_v2_h3_2b_inventory_exceeds_physical_capacity'; end if;
  v_changed:=case when v_original is null then
      coalesce(v_payload->>'sellable_units_mode'='set'
        and (v_payload->>'sellable_units')::integer is distinct from v_capacity,false)
      or coalesce(v_payload->>'closed_mode'='set'
        and (v_payload->>'closed')::boolean is distinct from false,false)
    else
      (v_payload?'sellable_units' and case when v_payload->>'sellable_units_mode'='clear'
        then v_original->>'sellable_units_mode'<>'clear'
        else (v_payload->>'sellable_units')::integer is distinct from (v_original->>'sellable_units')::integer
          or v_original->>'sellable_units_mode'<>'set' end)
      or (v_payload?'closed' and case when v_payload->>'closed_mode'='clear'
        then v_original->>'closed_mode'<>'clear'
        else (v_payload->>'closed')::boolean is distinct from (v_original->>'closed')::boolean
          or v_original->>'closed_mode'<>'set' end)
      or (v_payload?'expires_at' and (v_original->>'sellable_units_mode'='set' or v_original->>'closed_mode'='set')
        and v_payload->'expires_at' is distinct from v_original->'expires_at') end;
  if not v_changed then
    return jsonb_build_object('contract_version','hotels_v2_h3_2b_availability_preview_v1',
      'partner_id',v_partner,'hotel_id',v_hotel,'changed',false,'blocking_reasons','[]'::jsonb,
      'impacts','[]'::jsonb,'reviewed_plan',null); end if;
  v_after:=coalesce(v_original,jsonb_build_object('room_type_id',v_room,'stay_date',v_stay,
    'sellable_units',0,'sellable_units_mode','clear','closed',false,'closed_mode','clear','reason',null,
    'expires_at',null,'version',0));
  if v_payload?'sellable_units' then v_after:=v_after||jsonb_build_object('sellable_units',case when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end,'sellable_units_mode',v_payload->>'sellable_units_mode'); end if;
  if v_payload?'closed' then v_after:=v_after||jsonb_build_object('closed',case when v_payload->>'closed_mode'='set' then (v_payload->>'closed')::boolean else false end,'closed_mode',v_payload->>'closed_mode'); end if;
  if v_payload?'expires_at' then v_after:=v_after||jsonb_build_object('expires_at',v_payload->'expires_at'); end if;
  v_after:=v_after||jsonb_build_object('reason',v_intent->>'reason','version',v_expected+1);
  v_id:=public.hotel_v2_admin_d_deterministic_uuid(v_room::text||':'||v_stay::text);
  v_operation:=jsonb_build_object('entity','daily_inventory','action','upsert','id',v_id,
    'expected_version',v_expected,'expected_original',v_original,
    'payload',v_payload,'reason',v_intent->>'reason');
  if v_original is not null then
    select jsonb_object_agg(key_name,v_original->key_name order by key_name),
      jsonb_object_agg(key_name,v_after->key_name order by key_name)
      into v_impact_before,v_impact_after from jsonb_object_keys(v_payload) key_name;
  else
    v_impact_before:=null;
    select jsonb_object_agg(key_name,v_after->key_name order by key_name)
      into v_impact_after from jsonb_object_keys(v_payload) key_name;
  end if;
  v_impact:=jsonb_build_object('entity','daily_inventory','action','upsert','id',v_id,'changed',true,
    'fields',to_jsonb(array(select jsonb_object_keys(v_payload) order by 1)),'before',v_impact_before,'after',v_impact_after,
    'affected_room_type_ids',jsonb_build_array(v_room),'affected_room_rate_ids','[]'::jsonb,
    'from',v_stay,'to',v_stay);
  return public.hotel_v2_h3_2b_store_review('availability',v_partner,v_hotel,v_access,
    v_control->>'snapshot_token',v_operation,v_impact,null,v_from,v_to);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_draft';
end
$function$;

create function public.hotel_v2_partner_apply_availability_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_context jsonb; v_operation jsonb:=p_reviewed_plan#>'{operations,0}'; v_payload jsonb;
  v_partner uuid; v_hotel uuid; v_room uuid; v_stay date; v_expected bigint; v_before jsonb; v_after jsonb;
  v_control jsonb; v_activity jsonb; v_capacity integer; v_committed integer;
  v_blocked integer; v_inventory_mode text;
  v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_operation->>'entity'<>'daily_inventory' or v_operation->>'action'<>'upsert' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_availability_operation'; end if;
  v_context:=public.hotel_v2_h3_2b_prepare_apply('availability',p_reviewed_plan,p_correlation_id,p_idempotency_key,'manage_availability');
  if (v_context->>'replayed')::boolean then return v_context->'result'; end if;
  v_partner:=(v_context->>'partner_id')::uuid; v_hotel:=(v_context->>'hotel_id')::uuid;
  v_payload:=v_operation->'payload'; v_room:=(v_payload->>'room_type_id')::uuid;
  v_stay:=(v_payload->>'stay_date')::date; v_expected:=(v_operation->>'expected_version')::bigint;
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel,(v_context->>'domain_from')::date,
    (v_context->>'domain_to')::date,false);
  if v_control->>'snapshot_token' is distinct from v_context->>'domain_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_availability_stale'; end if;
  if jsonb_typeof(v_payload->'expires_at')='string' and (v_payload->>'expires_at')::timestamptz<=clock_timestamp() then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_availability_expiry_elapsed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_room::text||':'||v_stay::text,0));
  insert into public.hotel_inventory_day_locks(hotel_id,room_type_id,stay_date)
    values(v_hotel,v_room,v_stay) on conflict(room_type_id,stay_date) do nothing;
  perform 1 from public.hotel_inventory_day_locks where room_type_id=v_room and stay_date=v_stay for update;
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel,(v_context->>'domain_from')::date,
    (v_context->>'domain_to')::date,false);
  if v_control->>'snapshot_token' is distinct from v_context->>'domain_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_availability_stale'; end if;
  perform 1 from public.hotel_daily_inventory inventory
    where inventory.room_type_id=v_room and inventory.stay_date=v_stay for update;
  v_before:=public.hotel_v2_h3_2b_daily_inventory_projection(v_room,v_stay);
  if coalesce((v_before->>'version')::bigint,0)<>v_expected
     or coalesce(v_before,'null'::jsonb) is distinct from v_operation->'expected_original' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_availability_stale'; end if;
  select (cell.value->>'physical_capacity')::integer,(cell.value->>'committed_units')::integer,
    (cell.value->>'blocked_unit_count')::integer,cell.value->>'inventory_mode'
    into v_capacity,v_committed,v_blocked,v_inventory_mode
    from jsonb_array_elements(v_control->'cells') cell(value)
    where (cell.value->>'room_type_id')::uuid=v_room and (cell.value->>'stay_date')::date=v_stay;
  if v_capacity is null
     or (v_payload->>'sellable_units_mode'='set' and (v_payload->>'sellable_units')::integer>v_capacity)
     or (v_payload?'sellable_units' and least(v_capacity-
       case when v_inventory_mode='unitized' then v_blocked else 0 end,
       case when v_payload->>'sellable_units_mode'='clear' then v_capacity
         else (v_payload->>'sellable_units')::integer end)<v_committed) then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_capacity_conflict'; end if;
  if v_expected=0 then
    insert into public.hotel_daily_inventory(room_type_id,stay_date,sellable_units,closed,source,reason,
      expires_at,actor_id,sellable_units_mode,closed_mode,provenance)
    values(v_room,v_stay,case when v_payload->>'sellable_units_mode'='set' then (v_payload->>'sellable_units')::integer else 0 end,
      case when v_payload->>'closed_mode'='set' then (v_payload->>'closed')::boolean else false end,
      'manual',v_operation->>'reason',(v_payload->>'expires_at')::timestamptz,v_actor,
      coalesce(v_payload->>'sellable_units_mode','clear'),coalesce(v_payload->>'closed_mode','clear'),
      jsonb_build_object('h3_2b_partner',true,'correlation_id',p_correlation_id));
  else
    update public.hotel_daily_inventory set
      sellable_units=case when not (v_payload?'sellable_units') then sellable_units when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end,
      sellable_units_mode=coalesce(v_payload->>'sellable_units_mode',sellable_units_mode),
      closed=case when not (v_payload?'closed') then closed when v_payload->>'closed_mode'='clear' then false else (v_payload->>'closed')::boolean end,
      closed_mode=coalesce(v_payload->>'closed_mode',closed_mode),reason=v_operation->>'reason',
      expires_at=case when v_payload?'expires_at' then (v_payload->>'expires_at')::timestamptz else expires_at end,
      actor_id=v_actor,source='manual',provenance=jsonb_build_object('h3_2b_partner',true,'correlation_id',p_correlation_id),
      version=version+1,updated_at=clock_timestamp() where room_type_id=v_room and stay_date=v_stay;
  end if;
  v_after:=public.hotel_v2_h3_2b_daily_inventory_projection(v_room,v_stay);
  v_id:=(v_operation->>'id')::uuid;
  v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'daily_inventory',v_id,
    case when v_expected=0 then 'create' else 'update' end,v_before,v_after,p_correlation_id,v_actor);
  return public.hotel_v2_h3_2b_finish_apply(v_context,'availability',p_correlation_id,p_idempotency_key,v_activity);
end
$function$;

create function public.hotel_v2_partner_apply_content_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_operation jsonb; v_entity text; v_action text; v_capability text; v_context jsonb;
  v_partner uuid; v_hotel uuid; v_assignment uuid; v_id uuid; v_expected bigint;
  v_payload jsonb; v_target jsonb; v_before jsonb; v_after jsonb; v_workspace jsonb; v_activity jsonb;
  v_hotel_row public.hotels%rowtype;
begin
  if p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or jsonb_typeof(p_reviewed_plan->'operations')<>'array'
     or jsonb_array_length(p_reviewed_plan->'operations')<>1 then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_reviewed_plan'; end if;
  v_operation:=p_reviewed_plan#>'{operations,0}'; v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action';
  v_capability:=case v_entity when 'property_content' then 'edit_property_content'
    when 'property_photos' then 'edit_property_photos' when 'room_content' then 'edit_room_content'
    when 'room_photos' then 'edit_room_photos' when 'room' then 'create_rooms'
    when 'room_structure' then 'edit_room_structure' end;
  if v_capability is null then raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_operation'; end if;
  v_context:=public.hotel_v2_h3_2b_prepare_apply('content',p_reviewed_plan,p_correlation_id,p_idempotency_key,v_capability);
  if (v_context->>'replayed')::boolean then return v_context->'result'; end if;
  v_partner:=(v_context->>'partner_id')::uuid; v_hotel:=(v_context->>'hotel_id')::uuid;
  v_assignment:=(v_context#>>'{access,assignment_id}')::uuid; v_id:=(v_operation->>'id')::uuid;
  v_expected:=(v_operation->>'expected_version')::bigint; v_payload:=v_operation->'payload';
  select * into strict v_hotel_row from public.hotels where id=v_hotel for update;
  v_workspace:=public.hotel_v2_partner_get_workspace(v_partner,v_hotel,current_date,current_date+30);
  if v_workspace->>'content_snapshot_token' is distinct from v_context->>'domain_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_stale'; end if;
  if v_entity in('property_content','property_photos') then
    v_before:=public.hotel_v2_h3_2b_property_draft_projection(v_assignment);
    if (v_before->>'version')::bigint<>v_expected or v_before is distinct from v_operation->'expected_original' then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_property_draft_stale'; end if;
    if v_expected>0 and (v_before->>'source_property_updated_at')::timestamptz is distinct from v_hotel_row.updated_at then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_property_draft_source_stale'; end if;
    if v_entity='property_content' then
      v_target:=(case when v_before->'content'<>'{}'::jsonb then v_before->'content' else
        jsonb_build_object('title_i18n',v_workspace#>'{property,title_i18n}',
          'description_i18n',v_workspace#>'{property,description_i18n}','city',v_workspace#>'{property,city}',
          'address_line',v_workspace#>'{property,address_line}','district',v_workspace#>'{property,district}',
          'postal_code',v_workspace#>'{property,postal_code}','country',v_workspace#>'{property,country}',
          'latitude',v_workspace#>'{property,latitude}','longitude',v_workspace#>'{property,longitude}',
          'google_maps_url',v_workspace#>'{property,google_maps_url}','amenities',v_workspace#>'{property,amenities}',
          'check_in_from',v_workspace#>'{property,check_in_from}','check_out_until',v_workspace#>'{property,check_out_until}') end)||v_payload;
    else
      v_target:=(case when v_before->'photos'<>'{}'::jsonb then v_before->'photos' else
        jsonb_build_object('cover_image_url',v_workspace#>'{property,cover_image_url}',
          'photos',v_workspace#>'{property,photos}') end)||v_payload;
    end if;
    if (v_entity='property_content' and not public.hotel_v2_h3_2b_property_content_is_valid(
          v_hotel,v_target,case when v_before->'content'<>'{}'::jsonb then v_before->'content'
            else jsonb_build_object('amenities',v_workspace#>'{property,amenities}') end))
       or (v_entity='property_photos' and not public.hotel_v2_h3_2b_property_photos_are_valid(
          v_hotel,v_assignment,v_target,case when v_before->'photos'<>'{}'::jsonb then v_before->'photos'
            else jsonb_build_object('cover_image_url',v_workspace#>'{property,cover_image_url}',
              'photos',v_workspace#>'{property,photos}') end)) then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_target_invalid';
    end if;
    if v_expected=0 then
      insert into public.hotel_partner_property_drafts(id,assignment_id,partner_id,hotel_id,
        source_property_updated_at,content,photos,actor_id,correlation_id)
      values(v_id,v_assignment,v_partner,v_hotel,v_hotel_row.updated_at,
        case when v_entity='property_content' then v_target else '{}'::jsonb end,
        case when v_entity='property_photos' then v_target else '{}'::jsonb end,
        auth.uid(),p_correlation_id);
    else
      update public.hotel_partner_property_drafts set
        content=case when v_entity='property_content' then v_target else content end,
        photos=case when v_entity='property_photos' then v_target else photos end,
        status='pending_admin_review',source_property_updated_at=v_hotel_row.updated_at,
        actor_id=auth.uid(),correlation_id=p_correlation_id,version=version+1,
        updated_at=clock_timestamp() where assignment_id=v_assignment;
    end if;
    v_after:=public.hotel_v2_h3_2b_property_draft_projection(v_assignment);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'property',v_hotel,'update',
      v_before,v_after,p_correlation_id,auth.uid());
  else
    if v_expected=0 then v_before:=null;
    else
      perform 1 from public.hotel_room_types room where room.id=v_id and room.hotel_id=v_hotel for update;
      v_before:=public.hotel_v2_h3_2b_room_projection(v_id);
      if v_before is null or (v_before->>'version')::bigint<>v_expected
         or v_before->>'status' not in('draft','active')
         or v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_room_stale'; end if;
    end if;
    if v_entity='room' and v_action='create' then
      v_target:=v_payload;
      if not public.hotel_v2_h3_2b_room_create_is_valid(v_hotel,v_id,v_assignment,v_target) then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_target_invalid'; end if;
      insert into public.hotel_room_types(id,hotel_id,code,name_i18n,description_i18n,gallery,
        capacity_adults,capacity_children,max_occupancy,bed_configuration,bathrooms,size_sqm,
        amenities,inventory_mode,base_inventory_count,status,sort_order,floor_label_i18n)
      values(v_id,v_hotel,v_payload->>'code',v_payload->'name_i18n',v_payload->'description_i18n',
        v_payload->'gallery',(v_payload->>'capacity_adults')::smallint,
        (v_payload->>'capacity_children')::smallint,(v_payload->>'max_occupancy')::smallint,
        v_payload->'bed_configuration',(v_payload->>'bathrooms')::numeric,
        (v_payload->>'size_sqm')::numeric,array(select jsonb_array_elements_text(v_payload->'amenities')),
        v_payload->>'inventory_mode',(v_payload->>'base_inventory_count')::integer,'draft',
        (v_payload->>'sort_order')::integer,v_payload->'floor_label_i18n');
    elsif v_entity='room_content' then
      v_target:=jsonb_build_object('name_i18n',v_before->'name_i18n','description_i18n',v_before->'description_i18n',
        'amenities',v_before->'amenities','floor_label_i18n',v_before->'floor_label_i18n')||v_payload;
      if not public.hotel_v2_h3_2b_room_content_is_valid(v_hotel,v_target,v_before) then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_target_invalid'; end if;
      update public.hotel_room_types set name_i18n=v_target->'name_i18n',
        description_i18n=v_target->'description_i18n',
        amenities=array(select jsonb_array_elements_text(v_target->'amenities')),
        floor_label_i18n=v_target->'floor_label_i18n'
      where id=v_id;
    elsif v_entity='room_photos' then
      v_target:=jsonb_build_object('gallery',v_before->'gallery')||v_payload;
      if not public.hotel_v2_h3_2b_room_photos_are_valid(v_hotel,v_id,v_assignment,v_target,v_before) then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_target_invalid'; end if;
      update public.hotel_room_types set gallery=v_target->'gallery' where id=v_id;
    elsif v_entity='room_structure' then
      v_target:=jsonb_build_object('capacity_adults',v_before->'capacity_adults',
        'capacity_children',v_before->'capacity_children','max_occupancy',v_before->'max_occupancy',
        'bed_configuration',v_before->'bed_configuration','bathrooms',v_before->'bathrooms',
        'size_sqm',v_before->'size_sqm','inventory_mode',v_before->'inventory_mode',
        'base_inventory_count',v_before->'base_inventory_count','sort_order',v_before->'sort_order')||v_payload;
      if not public.hotel_v2_h3_2b_room_structure_is_valid(v_target) then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_content_target_invalid'; end if;
      update public.hotel_room_types set capacity_adults=(v_target->>'capacity_adults')::smallint,
        capacity_children=(v_target->>'capacity_children')::smallint,
        max_occupancy=(v_target->>'max_occupancy')::smallint,bed_configuration=v_target->'bed_configuration',
        bathrooms=(v_target->>'bathrooms')::numeric,size_sqm=(v_target->>'size_sqm')::numeric,
        inventory_mode=v_target->>'inventory_mode',base_inventory_count=(v_target->>'base_inventory_count')::integer,
        sort_order=(v_target->>'sort_order')::integer where id=v_id and hotel_id=v_hotel and version=v_expected;
    else raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_operation'; end if;
    v_after:=public.hotel_v2_h3_2b_room_projection(v_id);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'room_type',v_id,
      case when v_expected=0 then 'create' else 'update' end,v_before,v_after,p_correlation_id,auth.uid());
  end if;
  return public.hotel_v2_h3_2b_finish_apply(v_context,'content',p_correlation_id,p_idempotency_key,v_activity);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_operation';
end
$function$;

create function public.hotel_v2_h3_2b_property_draft_projection(p_assignment_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select coalesce((select jsonb_build_object('exists',true,'id',draft.id,'status',draft.status,
    'version',draft.version,'source_property_updated_at',draft.source_property_updated_at,
    'content',draft.content,'photos',draft.photos,'updated_at',draft.updated_at)
    from public.hotel_partner_property_drafts draft where draft.assignment_id=p_assignment_id),
    jsonb_build_object('exists',false,'id',null,'status',null,'version',0,
      'source_property_updated_at',null,'content','{}'::jsonb,'photos','{}'::jsonb,'updated_at',null))
$function$;

create function public.hotel_v2_h3_2b_room_projection(p_room_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('id',room.id,'hotel_id',room.hotel_id,'code',room.code,
    'name_i18n',room.name_i18n,'description_i18n',room.description_i18n,
    'amenities',to_jsonb(room.amenities),'bed_configuration',room.bed_configuration,
    'floor_label_i18n',room.floor_label_i18n,'gallery',room.gallery,
    'capacity_adults',room.capacity_adults,'capacity_children',room.capacity_children,
    'max_occupancy',room.max_occupancy,'bathrooms',room.bathrooms,'size_sqm',room.size_sqm,
    'inventory_mode',room.inventory_mode,'base_inventory_count',room.base_inventory_count,
    'status',room.status,'sort_order',room.sort_order,'version',room.version,'updated_at',room.updated_at)
  from public.hotel_room_types room where room.id=p_room_id
$function$;

create function public.hotel_v2_h3_2b_room_rate_projection(p_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('id',rate.id,'hotel_id',rate.hotel_id,
    'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,
    'pricing_schedule_id',rate.pricing_schedule_id,'base_nightly_rate',rate.base_nightly_rate,
    'currency',rate.currency,'is_active',rate.is_active,'review_status',rate.review_status,
    'pricing_source',case when rate.pricing_schedule_id is not null then 'pricing_schedule'
      when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active) then 'independent_tiers'
      else 'base_nightly_rate' end,
    'base_nightly_rate_authoritative',rate.pricing_schedule_id is null and not exists(
      select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id and tier.is_active),
    'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at)
  from public.hotel_room_rates rate where rate.id=p_id
$function$;

create function public.hotel_v2_h3_2b_schedule_tier_projection(p_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('id',tier.id,'schedule_id',tier.schedule_id,
    'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
    'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,'version',tier.version,
    'updated_at',tier.updated_at)
  from public.hotel_pricing_schedule_occupancy_tiers tier where tier.id=p_id
$function$;

create function public.hotel_v2_h3_2b_room_rate_tier_projection(p_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('id',tier.id,'hotel_id',tier.hotel_id,
    'room_rate_id',tier.room_rate_id,'guest_count',tier.guest_count,
    'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
    'is_active',tier.is_active,'version',tier.version,'updated_at',tier.updated_at)
  from public.hotel_room_rate_occupancy_tiers tier where tier.id=p_id
$function$;

create function public.hotel_v2_h3_2b_exact_price_projection(p_id uuid)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('id',override_row.id,'hotel_id',override_row.hotel_id,
    'room_rate_id',override_row.room_rate_id,'stay_date',override_row.stay_date,
    'nightly_rate_mode',override_row.nightly_rate_mode,'nightly_rate',override_row.nightly_rate,
    'minimum_stay_mode',override_row.minimum_stay_mode,'minimum_stay',override_row.minimum_stay,
    'maximum_stay_mode',override_row.maximum_stay_mode,'maximum_stay',override_row.maximum_stay,
    'pricing_reason',override_row.pricing_reason,'pricing_expires_at',override_row.pricing_expires_at,
    'pricing_version',override_row.version,'pricing_updated_at',override_row.pricing_updated_at)
  from public.hotel_calendar_overrides override_row where override_row.id=p_id
$function$;

create function public.hotel_v2_h3_2b_daily_inventory_projection(p_room_type_id uuid,p_stay_date date)
returns jsonb language sql security definer stable set search_path=pg_catalog,public
as $function$
  select jsonb_build_object('room_type_id',inventory.room_type_id,'stay_date',inventory.stay_date,
    'sellable_units',inventory.sellable_units,'sellable_units_mode',inventory.sellable_units_mode,
    'closed',inventory.closed,'closed_mode',inventory.closed_mode,'reason',inventory.reason,
    'expires_at',inventory.expires_at,'version',inventory.version,'updated_at',inventory.updated_at)
  from public.hotel_daily_inventory inventory
  where inventory.room_type_id=p_room_type_id and inventory.stay_date=p_stay_date
$function$;
create trigger hotel_partner_property_drafts_guard
before insert or update or delete on public.hotel_partner_property_drafts
for each row execute function public.hotel_v2_h3_2b_guard_property_draft();

create table public.hotel_partner_workspace_plan_reviews(
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  assignment_id uuid not null,
  domain text not null check(domain in('content','pricing','availability')),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  reviewed_plan jsonb not null check(jsonb_typeof(reviewed_plan)='object'),
  access_snapshot_token text not null,
  domain_snapshot_token text not null,
  permission_version bigint not null check(permission_version>=1),
  domain_from date,
  domain_to date,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_correlation_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_partner_workspace_plan_reviews_actor_hash_key unique(actor_id,plan_fingerprint),
  constraint hotel_partner_workspace_plan_reviews_assignment_fkey
    foreign key(assignment_id,partner_id,hotel_id)
    references public.hotel_partner_hotel_permissions(assignment_id,partner_id,hotel_id)
    on delete restrict
);
alter table public.hotel_partner_workspace_plan_reviews enable row level security;
revoke all on table public.hotel_partner_workspace_plan_reviews from public,anon,authenticated,service_role;
create index hotel_partner_workspace_plan_reviews_expiry_idx
  on public.hotel_partner_workspace_plan_reviews(expires_at) where consumed_at is null;

create unique index hotel_partner_action_receipts_h3_2b_global_correlation_uidx
  on public.hotel_partner_action_receipts(correlation_id)
  where action in('h3_2b_content','h3_2b_pricing','h3_2b_availability');

create function public.hotel_v2_h3_2b_hash(p_value jsonb) returns text
language sql immutable set search_path=pg_catalog
as $$select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')$$;

create function public.hotel_v2_h3_2b_protected_fingerprints()
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare v_result jsonb:='{}'::jsonb; v_relation text;
begin
  foreach v_relation in array array[
    'hotels','hotel_units','hotel_rate_plans','hotel_pricing_schedules','hotel_rate_rules',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items','hotel_unit_calendar_blocks',
    'hotel_inventory_holds','hotel_booking_room_allocations','hotel_inventory_commitments',
    'hotel_calendar_source_configs','hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_pricing_promotion_reviews','hotel_admin_pricing_action_receipts',
    'hotel_admin_availability_action_receipts','hotel_admin_availability_plan_reviews',
    'hotel_admin_availability_foundation_receipts','hotel_bookings','partner_service_fulfillments',
    'partner_service_fulfillment_form_snapshots','service_deposit_requests','service_deposit_rules',
    'service_deposit_overrides','service_coupons','service_coupon_redemptions','referrals',
    'affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases','partners','partner_users','partner_resources',
    'partner_user_resources','hotel_partner_hotel_permissions','site_settings'
  ] loop
    v_result:=v_result||jsonb_build_object(v_relation,md5(pg_catalog.query_to_xml(format(
      'select to_jsonb(row_value)::text from public.%I row_value order by to_jsonb(row_value)::text',
      v_relation),true,true,'')::text));
  end loop;
  return v_result||jsonb_build_object(
    'hotel_room_types_protected',md5(pg_catalog.query_to_xml($query$
      select jsonb_build_array(room.id,room.hotel_id,room.code,room.children_policy_override,
        room.minimum_child_age_override,room.status,room.created_at)::text
      from public.hotel_room_types room
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_h3_2b_partner_workspace'
          and activity.entity_type='room_type' and activity.entity_id=room.id and activity.action='create')
      order by room.id$query$,true,true,'')::text),
    'hotel_room_rates_protected',md5(pg_catalog.query_to_xml($query$
      select (to_jsonb(rate)-array['base_nightly_rate','version','updated_at'])::text
      from public.hotel_room_rates rate order by rate.id$query$,true,true,'')::text),
    'hotel_schedule_tiers_protected',md5(pg_catalog.query_to_xml($query$
      select (to_jsonb(tier)-array['nightly_rate','version','updated_at'])::text
      from public.hotel_pricing_schedule_occupancy_tiers tier order by tier.id$query$,true,true,'')::text),
    'hotel_room_rate_tiers_protected',md5(pg_catalog.query_to_xml($query$
      select (to_jsonb(tier)-array['nightly_rate','version','updated_at'])::text
      from public.hotel_room_rate_occupancy_tiers tier order by tier.id$query$,true,true,'')::text),
    'hotel_exact_date_protected',md5(pg_catalog.query_to_xml($query$
      select (to_jsonb(override_row)-array['nightly_rate','nightly_rate_mode','pricing_source',
        'pricing_reason','pricing_expires_at','pricing_actor_type','pricing_actor_id',
        'pricing_updated_at','pricing_correlation_id','version','updated_at'])::text
      from public.hotel_calendar_overrides override_row
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_h3_2b_partner_workspace'
          and activity.entity_type='calendar_override' and activity.entity_id=override_row.id
          and activity.action='create') order by override_row.id$query$,true,true,'')::text),
    'hotel_daily_inventory_identity',md5(pg_catalog.query_to_xml($query$
      select jsonb_build_array(inventory.room_type_id,inventory.stay_date)::text
      from public.hotel_daily_inventory inventory
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_h3_2b_partner_workspace'
          and activity.entity_type='daily_inventory'
          and activity.entity_id=public.hotel_v2_admin_d_deterministic_uuid(
            inventory.room_type_id::text||':'||inventory.stay_date::text)
          and activity.action='create') order by inventory.room_type_id,inventory.stay_date$query$,true,true,'')::text),
    'non_h3_2b_partner_receipts',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(receipt)::text from public.hotel_partner_action_receipts receipt
      where receipt.action not in('h3_2b_content','h3_2b_pricing','h3_2b_availability')
      order by receipt.id$query$,true,true,'')::text),
    'non_h3_2b_activity',md5(pg_catalog.query_to_xml($query$
      select to_jsonb(activity)::text from public.hotel_activity_log activity
      where activity.source is distinct from 'hotels_v2_h3_2b_partner_workspace'
      order by activity.id$query$,true,true,'')::text)
  );
end
$function$;

create table public.hotel_partner_workspace_foundation_receipts(
  id smallint primary key check(id=1),
  protected_fingerprints jsonb not null check(jsonb_typeof(protected_fingerprints)='object'),
  protected_fingerprint text not null check(protected_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.hotel_partner_workspace_foundation_receipts enable row level security;
revoke all on table public.hotel_partner_workspace_foundation_receipts from public,anon,authenticated,service_role;

create function public.hotel_v2_h3_2b_immutable_row() returns trigger
language plpgsql set search_path=pg_catalog
as $function$
begin
  raise exception using errcode='55000',message='hotels_v2_h3_2b_foundation_receipt_immutable';
end
$function$;
create trigger hotel_partner_workspace_foundation_receipts_immutable
before update or delete on public.hotel_partner_workspace_foundation_receipts
for each row execute function public.hotel_v2_h3_2b_immutable_row();

insert into public.hotel_partner_workspace_foundation_receipts(
  id,protected_fingerprints,protected_fingerprint)
select 1,fingerprints.value,public.hotel_v2_h3_2b_hash(fingerprints.value)
from (select public.hotel_v2_h3_2b_protected_fingerprints() value) fingerprints;

create function public.hotel_v2_h3_2b_flags_off() returns boolean
language sql stable security definer set search_path=pg_catalog,public
as $$select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
  and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
  and not hotel_stripe_connect_enabled) from public.site_settings$$;

create function public.hotel_v2_h3_2b_access_snapshot(
  p_partner_id uuid,p_hotel_id uuid,p_capability text
) returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
declare v_assignment uuid; v_membership jsonb; v_permission jsonb;
begin
  if not public.hotel_v2_h3_2b_flags_off() then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_public_activation_guard';
  end if;
  if not exists(select 1 from public.hotels hotel
      where hotel.id=p_hotel_id and hotel.architecture_version='legacy') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_legacy_architecture_guard';
  end if;
  v_assignment:=public.hotel_v2_h3_2a_require_partner_hotel_access(
    p_partner_id,p_hotel_id,p_capability,false);
  v_membership:=public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  v_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_assignment);
  return jsonb_build_object('assignment_id',v_assignment,'role',v_membership->>'role',
    'permission_version',(v_permission->>'version')::bigint,
    'has_mutation_capability',(v_permission->>'has_mutation_capability')::boolean,
    'capabilities',v_permission->'capabilities');
end
$function$;

create function public.hotel_v2_h3_2b_commission_policy(p_hotel_id uuid)
returns jsonb language plpgsql security definer stable set search_path=pg_catalog,public
as $function$
declare v_count integer; v_policy public.hotel_commission_policies%rowtype; v_projection jsonb;
begin
  select count(*)::integer into v_count from public.hotel_commission_policies
    where hotel_id=p_hotel_id and is_active and review_status='reviewed';
  if v_count<>1 then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_commission_policy_required';
  end if;
  select * into strict v_policy from public.hotel_commission_policies
    where hotel_id=p_hotel_id and is_active and review_status='reviewed';
  if v_policy.commission_mode not in('per_allocated_room_per_night','percent_booking_total') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_unsupported_commission_mode';
  end if;
  if v_policy.currency is distinct from (select hotel.currency from public.hotels hotel where hotel.id=p_hotel_id) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_commission_currency_mismatch';
  end if;
  v_projection:=jsonb_build_object('id',v_policy.id,'code',v_policy.code,
    'commission_mode',v_policy.commission_mode,'amount',v_policy.amount,
    'currency',v_policy.currency,'version',v_policy.version,'updated_at',v_policy.updated_at);
  return v_projection||jsonb_build_object('fingerprint',public.hotel_v2_h3_2b_hash(v_projection),'read_only',true);
end
$function$;

create function public.hotel_v2_partner_get_workspace(
  p_partner_id uuid,p_hotel_id uuid,p_from date,p_to date
) returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
declare v_access jsonb; v_pricing jsonb; v_availability jsonb; v_commission jsonb;
  v_hotel public.hotels%rowtype; v_content jsonb; v_content_token text; v_pricing_token text;
  v_property_draft jsonb; v_exact_prices jsonb;
begin
  v_access:=public.hotel_v2_h3_2b_access_snapshot(p_partner_id,p_hotel_id,null);
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>61 then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_workspace_range';
  end if;
  select * into strict v_hotel from public.hotels where id=p_hotel_id;
  if coalesce((v_access#>>'{capabilities,manage_prices}')::boolean,false) then
    v_commission:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);
    v_pricing:=public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id);
  end if;
  select jsonb_build_object('exists',true,'id',draft.id,'status',draft.status,'version',draft.version,
      'source_property_updated_at',draft.source_property_updated_at,'content',draft.content,
      'photos',draft.photos,'updated_at',draft.updated_at)
    into v_property_draft from public.hotel_partner_property_drafts draft
    where draft.assignment_id=(v_access->>'assignment_id')::uuid;
  v_property_draft:=coalesce(v_property_draft,jsonb_build_object('exists',false,'id',null,
    'status',null,'version',0,'source_property_updated_at',null,'content','{}'::jsonb,
    'photos','{}'::jsonb,'updated_at',null));
  v_content:=jsonb_build_object(
    'property',jsonb_build_object('id',v_hotel.id,'slug',v_hotel.slug,
      'architecture_version',v_hotel.architecture_version,'status',v_hotel.status,
      'is_published',v_hotel.is_published,'title_i18n',v_hotel.title_i18n,
      'description_i18n',v_hotel.description_i18n,'city',v_hotel.city,'address_line',v_hotel.address_line,
      'district',v_hotel.district,'postal_code',v_hotel.postal_code,'country',v_hotel.country,
      'latitude',v_hotel.latitude,'longitude',v_hotel.longitude,'google_maps_url',v_hotel.google_maps_url,
      'amenities',v_hotel.amenities,'check_in_from',v_hotel.check_in_from,
      'check_out_until',v_hotel.check_out_until,'cover_image_url',v_hotel.cover_image_url,
      'photos',coalesce(v_hotel.photos,'[]'::jsonb),'updated_at',v_hotel.updated_at),
    'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',room.id,'hotel_id',room.hotel_id,'code',room.code,
      'name_i18n',room.name_i18n,'description_i18n',room.description_i18n,'amenities',room.amenities,
      'bed_configuration',room.bed_configuration,'floor_label_i18n',room.floor_label_i18n,
      'gallery',room.gallery,'capacity_adults',room.capacity_adults,'capacity_children',room.capacity_children,
      'max_occupancy',room.max_occupancy,'bathrooms',room.bathrooms,'size_sqm',room.size_sqm,
      'inventory_mode',room.inventory_mode,'base_inventory_count',room.base_inventory_count,
      'status',room.status,'sort_order',room.sort_order,'version',room.version,'updated_at',room.updated_at)
      order by room.sort_order,room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'),
    'property_draft',v_property_draft,
    'units',coalesce((select jsonb_agg(jsonb_build_object('id',unit_row.id,'room_type_id',unit_row.room_type_id,
      'code',unit_row.code,'name_i18n',unit_row.name_i18n,'status',unit_row.status,
      'version',unit_row.version,'updated_at',unit_row.updated_at) order by unit_row.room_type_id,unit_row.id)
      from public.hotel_units unit_row join public.hotel_room_types room on room.id=unit_row.room_type_id
      where room.hotel_id=p_hotel_id),'[]'));
  v_content_token:=public.hotel_v2_h3_2b_hash(v_content);
  if v_pricing is not null then
    select coalesce(jsonb_agg(public.hotel_v2_h3_2b_exact_price_projection(override_row.id)
      order by override_row.stay_date,override_row.id),'[]'::jsonb)
      into v_exact_prices from public.hotel_calendar_overrides override_row
      where override_row.hotel_id=p_hotel_id;
    v_pricing_token:=public.hotel_v2_h3_2b_hash(jsonb_build_object(
      'admin_c_snapshot_token',v_pricing->>'snapshot_token','commission_policy',v_commission,
      'exact_date_prices',v_exact_prices));
  end if;
  if coalesce((v_access#>>'{capabilities,manage_availability}')::boolean,false) then
    v_availability:=public.hotel_v2_admin_d_snapshot(p_hotel_id,p_from,p_to,false);
  end if;
  return jsonb_build_object('contract_version','hotels_v2_h3_2b_partner_workspace_v1',
    'partner',jsonb_build_object('id',p_partner_id,'role',v_access->>'role'),
    'hotel_id',v_hotel.id,
    'assignment',jsonb_build_object('id',v_access->'assignment_id',
      'permission_version',v_access->'permission_version','capabilities',v_access->'capabilities',
      'access_snapshot_token',public.hotel_v2_h3_2b_hash(v_access)),
    'content_snapshot_token',v_content_token,
    'property',v_content->'property','property_draft',v_content->'property_draft',
    'rooms',v_content->'rooms','units',v_content->'units',
    'pricing',case when v_pricing is null then null else jsonb_build_object(
      'snapshot_token',v_pricing_token,'currency',v_pricing#>>'{property,currency}',
      'rate_plans',coalesce((select jsonb_agg(jsonb_build_object('id',plan.id,'hotel_id',plan.hotel_id,
        'code',plan.code,'name_i18n',plan.name_i18n,'is_active',plan.is_active,
        'review_status',plan.review_status,'sort_order',plan.sort_order,'version',plan.version,
        'updated_at',plan.updated_at) order by plan.sort_order,plan.id)
        from public.hotel_rate_plans plan where plan.hotel_id=p_hotel_id),'[]'::jsonb),
      'room_rates',coalesce((select jsonb_agg(jsonb_build_object('id',rate.id,'hotel_id',rate.hotel_id,
        'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,
        'pricing_schedule_id',rate.pricing_schedule_id,'base_nightly_rate',rate.base_nightly_rate,
        'currency',rate.currency,'is_active',rate.is_active,'review_status',rate.review_status,
        'pricing_source',case when rate.pricing_schedule_id is not null then 'pricing_schedule'
          when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
            where tier.room_rate_id=rate.id and tier.is_active) then 'independent_tiers'
          else 'base_nightly_rate' end,
        'base_nightly_rate_authoritative',rate.pricing_schedule_id is null and not exists(
          select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active),
        'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at)
        order by rate.sort_order,rate.id) from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id),'[]'::jsonb),
      'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',schedule.id,'hotel_id',schedule.hotel_id,
        'code',schedule.code,'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
        'currency',schedule.currency,'maximum_party_size',schedule.maximum_party_size,
        'minimum_billable_occupancy',schedule.minimum_billable_occupancy,'is_active',schedule.is_active,
        'review_status',schedule.review_status,'sharing_mode',schedule.sharing_mode,
        'version',schedule.version,'updated_at',schedule.updated_at) order by schedule.code,schedule.id)
        from public.hotel_pricing_schedules schedule where schedule.hotel_id=p_hotel_id),'[]'::jsonb),
      'schedule_tiers',coalesce((select jsonb_agg(jsonb_build_object('id',tier.id,
        'schedule_id',tier.schedule_id,'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
        'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,'version',tier.version,
        'updated_at',tier.updated_at) order by tier.schedule_id,tier.guest_count,tier.threshold_nights,tier.id)
        from public.hotel_pricing_schedule_occupancy_tiers tier join public.hotel_pricing_schedules schedule
          on schedule.id=tier.schedule_id where schedule.hotel_id=p_hotel_id),'[]'::jsonb),
      'room_rate_tiers',coalesce((select jsonb_agg(jsonb_build_object('id',tier.id,
        'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,'guest_count',tier.guest_count,
        'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
        'is_active',tier.is_active,'version',tier.version,'updated_at',tier.updated_at)
        order by tier.room_rate_id,tier.guest_count,tier.threshold_nights,tier.id)
        from public.hotel_room_rate_occupancy_tiers tier where tier.hotel_id=p_hotel_id),'[]'::jsonb),
      'exact_date_prices',v_exact_prices,
      'allocation_rules',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,
        'hotel_id',allocation.hotel_id,'code',allocation.code,'allocation_mode',allocation.allocation_mode,
        'min_guest_count',allocation.min_guest_count,'max_guest_count',allocation.max_guest_count,
        'is_active',allocation.is_active,'review_status',allocation.review_status,'sort_order',allocation.sort_order,
        'version',allocation.version,'items',coalesce((select jsonb_agg(
          jsonb_build_object('id',item.id,'allocation_rule_id',item.allocation_rule_id,
            'room_type_id',item.room_type_id,'units_required',item.units_required,
            'allocated_guest_count',item.allocated_guest_count,'pricing_guest_count',item.pricing_guest_count,
            'allocated_guest_counts',to_jsonb(item.allocated_guest_counts),
            'pricing_guest_counts',to_jsonb(item.pricing_guest_counts),'sort_order',item.sort_order) order by item.sort_order,item.id)
          from public.hotel_room_allocation_rule_items item where item.allocation_rule_id=allocation.id),'[]'::jsonb))
        order by allocation.sort_order,allocation.id) from public.hotel_room_allocation_rules allocation
        where allocation.hotel_id=p_hotel_id),'[]'::jsonb),
      'commission_policy',v_commission,
      'mutation_blocked_reasons','[]'::jsonb) end,
    'availability',v_availability,
    'sections',jsonb_build_object(
      'overview',jsonb_build_object('visible',true,'available',true,'status','available'),
      'property_content',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,edit_property_content}')::boolean,false),'available',coalesce((v_access#>>'{capabilities,edit_property_content}')::boolean,false),'status',case when coalesce((v_access#>>'{capabilities,edit_property_content}')::boolean,false) then 'available' else 'unavailable' end),
      'property_photos',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,edit_property_photos}')::boolean,false),'available',coalesce((v_access#>>'{capabilities,edit_property_photos}')::boolean,false),'status',case when coalesce((v_access#>>'{capabilities,edit_property_photos}')::boolean,false) then 'available' else 'unavailable' end),
      'rooms',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,edit_room_content}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_photos}')::boolean,false) or coalesce((v_access#>>'{capabilities,create_rooms}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_structure}')::boolean,false),'available',coalesce((v_access#>>'{capabilities,edit_room_content}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_photos}')::boolean,false) or coalesce((v_access#>>'{capabilities,create_rooms}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_structure}')::boolean,false),'status',case when coalesce((v_access#>>'{capabilities,edit_room_content}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_photos}')::boolean,false) or coalesce((v_access#>>'{capabilities,create_rooms}')::boolean,false) or coalesce((v_access#>>'{capabilities,edit_room_structure}')::boolean,false) then 'available' else 'unavailable' end),
      'rates_pricing',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,manage_prices}')::boolean,false),'available',coalesce((v_access#>>'{capabilities,manage_prices}')::boolean,false),'status',case when coalesce((v_access#>>'{capabilities,manage_prices}')::boolean,false) then 'available' else 'unavailable' end),
      'calendar_availability',jsonb_build_object('visible',v_availability is not null,'available',v_availability is not null,'status',case when v_availability is null then 'unavailable' else 'available' end),
      'bookings',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,process_bookings}')::boolean,false),
        'available',coalesce((v_access#>>'{capabilities,process_bookings}')::boolean,false),'status','existing_flow'),
      'payments',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,view_payment_status}')::boolean,false),
        'available',coalesce((v_access#>>'{capabilities,view_payment_status}')::boolean,false),'status','existing_flow'),
      'booking_changes',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,request_booking_changes}')::boolean,false),
        'available',false,'status','future_stage'),
      'stripe_onboarding',jsonb_build_object('visible',coalesce((v_access#>>'{capabilities,initiate_stripe_onboarding}')::boolean,false),
        'available',false,'status','future_stage')),
    'feature_flags',jsonb_build_object('hotel_rooms_v2_enabled',false,'hotel_external_sync_enabled',false,
      'hotel_instant_booking_enabled',false,'hotel_stripe_connect_enabled',false),
    'recent_activity',coalesce((select jsonb_agg(jsonb_build_object('id',activity.id,'hotel_id',activity.hotel_id,
      'entity_type',activity.entity_type,'entity_id',activity.entity_id,'action',activity.action,
      'actor_type',activity.actor_type,'source',activity.source,'correlation_id',activity.correlation_id,
      'created_at',activity.created_at) order by activity.created_at desc,activity.id desc)
      from(select * from public.hotel_activity_log where hotel_id=p_hotel_id
        and source='hotels_v2_h3_2b_partner_workspace' order by created_at desc,id desc limit 100) activity),'[]'),
    'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);
end
$function$;

create function public.hotel_v2_h3_2b_reason_is_valid(p_value jsonb) returns boolean
language sql immutable set search_path=pg_catalog
as $$select coalesce(jsonb_typeof(p_value)='string' and p_value#>>'{}'=btrim(p_value#>>'{}')
  and length(p_value#>>'{}') between 3 and 500 and (p_value#>>'{}')!~'[[:cntrl:]]',false)$$;

create function public.hotel_v2_h3_2b_guard_review() returns trigger
language plpgsql set search_path=pg_catalog,public
as $function$
begin
  if tg_op='DELETE' then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_review_delete_forbidden';
  end if;
  if tg_op='INSERT' then
    if not exists(select 1 from public.hotel_partner_hotel_permissions permission
        where permission.assignment_id=new.assignment_id and permission.partner_id=new.partner_id
          and permission.hotel_id=new.hotel_id)
       or new.actor_id is null or new.expires_at<=new.created_at
       or new.expires_at>new.created_at+interval '30 minutes 5 seconds'
       or new.consumed_at is not null or new.consumed_correlation_id is not null
       or (new.domain='availability' and (new.domain_from is null or new.domain_to is null or new.domain_to<new.domain_from))
       or (new.domain<>'availability' and (new.domain_from is not null or new.domain_to is not null))
       or not public.hotel_v2_h2a_keys_allowed(new.reviewed_plan,array[
         'contract_version','review_id','partner_id','hotel_id','assignment_id','permission_version',
         'access_snapshot_token','domain_snapshot_token','reviewed_at','expires_at','operations','plan_fingerprint'])
       or not (new.reviewed_plan?&array[
         'contract_version','review_id','partner_id','hotel_id','assignment_id','permission_version',
         'access_snapshot_token','domain_snapshot_token','reviewed_at','expires_at','operations','plan_fingerprint'])
       or new.reviewed_plan->>'contract_version' is distinct from
         'hotels_v2_h3_2b_'||new.domain||'_plan_v1'
       or jsonb_typeof(new.reviewed_plan->'operations')<>'array'
       or jsonb_array_length(new.reviewed_plan->'operations')<>1
       or new.reviewed_plan->>'review_id' is distinct from new.id::text
       or new.reviewed_plan->>'partner_id' is distinct from new.partner_id::text
       or new.reviewed_plan->>'hotel_id' is distinct from new.hotel_id::text
       or new.reviewed_plan->>'assignment_id' is distinct from new.assignment_id::text
       or new.reviewed_plan->>'permission_version' is distinct from new.permission_version::text
       or new.reviewed_plan->>'access_snapshot_token' is distinct from new.access_snapshot_token
       or new.reviewed_plan->>'domain_snapshot_token' is distinct from new.domain_snapshot_token
       or (new.reviewed_plan->>'expires_at')::timestamptz is distinct from new.expires_at
       or new.reviewed_plan->>'plan_fingerprint' is distinct from new.plan_fingerprint
       or public.hotel_v2_h3_2b_hash(new.reviewed_plan-'plan_fingerprint') is distinct from new.plan_fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_review_insert';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id or new.actor_id is distinct from old.actor_id
     or new.partner_id is distinct from old.partner_id or new.hotel_id is distinct from old.hotel_id
     or new.assignment_id is distinct from old.assignment_id or new.domain is distinct from old.domain
     or new.plan_fingerprint is distinct from old.plan_fingerprint
     or new.reviewed_plan is distinct from old.reviewed_plan
     or new.access_snapshot_token is distinct from old.access_snapshot_token
     or new.domain_snapshot_token is distinct from old.domain_snapshot_token
     or new.permission_version is distinct from old.permission_version
     or new.domain_from is distinct from old.domain_from or new.domain_to is distinct from old.domain_to
     or new.expires_at is distinct from old.expires_at or new.created_at is distinct from old.created_at
     or old.consumed_at is not null or new.consumed_at is null
     or new.consumed_correlation_id is null then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_invalid_review_transition';
  end if;
  return new;
end
$function$;
create trigger hotel_partner_workspace_plan_reviews_guard
before insert or update or delete on public.hotel_partner_workspace_plan_reviews
for each row execute function public.hotel_v2_h3_2b_guard_review();

create function public.hotel_v2_h3_2b_record_activity(
  p_hotel_id uuid,p_entity text,p_entity_id uuid,p_action text,
  p_before jsonb,p_after jsonb,p_correlation_id uuid,p_actor uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_id uuid; v_created timestamptz;
begin
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,
    after_state,actor_type,actor_id,source,correlation_id)
  values(p_hotel_id,p_entity,p_entity_id,p_action,p_before,p_after,'partner',p_actor,
    'hotels_v2_h3_2b_partner_workspace',p_correlation_id)
  returning id,created_at into v_id,v_created;
  return jsonb_build_object('id',v_id,'hotel_id',p_hotel_id,'entity_type',p_entity,
    'entity_id',p_entity_id,'action',p_action,'actor_type','partner',
    'source','hotels_v2_h3_2b_partner_workspace','correlation_id',p_correlation_id,
    'created_at',v_created);
end
$function$;

create function public.hotel_v2_h3_2b_store_review(
  p_domain text,p_partner_id uuid,p_hotel_id uuid,p_access jsonb,
  p_domain_token text,p_operation jsonb,p_impact jsonb,p_current_workspace jsonb,
  p_domain_from date default null,p_domain_to date default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_plan jsonb; v_fingerprint text; v_reviewed timestamptz:=clock_timestamp();
  v_expires timestamptz:=clock_timestamp()+interval '30 minutes'; v_review_id uuid:=gen_random_uuid();
begin
  if p_domain not in('content','pricing','availability') or auth.uid() is null
     or p_operation is null or jsonb_typeof(p_operation)<>'object'
     or p_impact is null or jsonb_typeof(p_impact)<>'object'
     or not exists(select 1 from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=(p_access->>'assignment_id')::uuid
         and permission.partner_id=p_partner_id and permission.hotel_id=p_hotel_id) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_review';
  end if;
  v_plan:=jsonb_build_object('contract_version','hotels_v2_h3_2b_'||p_domain||'_plan_v1',
    'review_id',v_review_id,
    'partner_id',p_partner_id,'hotel_id',p_hotel_id,
    'assignment_id',(p_access->>'assignment_id')::uuid,
    'permission_version',(p_access->>'permission_version')::bigint,
    'access_snapshot_token',public.hotel_v2_h3_2b_hash(p_access),
    'domain_snapshot_token',p_domain_token,'reviewed_at',v_reviewed,'expires_at',v_expires,
    'operations',jsonb_build_array(p_operation));
  v_fingerprint:=public.hotel_v2_h3_2b_hash(v_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into public.hotel_partner_workspace_plan_reviews(id,actor_id,partner_id,hotel_id,
    assignment_id,domain,plan_fingerprint,reviewed_plan,access_snapshot_token,
    domain_snapshot_token,permission_version,domain_from,domain_to,expires_at)
  values(v_review_id,auth.uid(),p_partner_id,p_hotel_id,(p_access->>'assignment_id')::uuid,p_domain,
    v_fingerprint,v_plan,public.hotel_v2_h3_2b_hash(p_access),p_domain_token,
    (p_access->>'permission_version')::bigint,p_domain_from,p_domain_to,v_expires);
  return jsonb_build_object('contract_version','hotels_v2_h3_2b_'||p_domain||'_preview_v1',
    'partner_id',p_partner_id,'hotel_id',p_hotel_id,'changed',true,
    'impacts',jsonb_build_array(p_impact),'blocking_reasons','[]'::jsonb,
    'reviewed_plan',v_plan);
end
$function$;

create function public.hotel_v2_h3_2b_prepare_apply(
  p_domain text,p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid,
  p_capability text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid(); v_hash text; v_review public.hotel_partner_workspace_plan_reviews%rowtype;
  v_receipt public.hotel_partner_action_receipts%rowtype; v_access jsonb; v_action text;
  v_partner uuid; v_hotel uuid; v_review_id uuid; v_matches integer;
begin
  if v_actor is null or p_domain not in('content','pricing','availability')
     or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_h2a_keys_allowed(p_reviewed_plan,array['contract_version','review_id','partner_id','hotel_id','assignment_id','permission_version','access_snapshot_token','domain_snapshot_token','reviewed_at','expires_at','operations','plan_fingerprint'])
     or not (p_reviewed_plan?&array['contract_version','review_id','partner_id','hotel_id','assignment_id','permission_version','access_snapshot_token','domain_snapshot_token','reviewed_at','expires_at','operations','plan_fingerprint'])
     or p_reviewed_plan->>'contract_version'<>'hotels_v2_h3_2b_'||p_domain||'_plan_v1'
     or jsonb_typeof(p_reviewed_plan->'operations')<>'array'
     or jsonb_array_length(p_reviewed_plan->'operations')<>1
     or p_reviewed_plan->>'plan_fingerprint'!~'^[0-9a-f]{64}$'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_reviewed_plan) then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_reviewed_plan';
  end if;
  begin
    v_review_id:=(p_reviewed_plan->>'review_id')::uuid;
    v_partner:=(p_reviewed_plan->>'partner_id')::uuid;
    v_hotel:=(p_reviewed_plan->>'hotel_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_reviewed_plan';
  end;
  v_hash:=public.hotel_v2_h3_2b_hash(p_reviewed_plan-'plan_fingerprint');
  v_action:='h3_2b_'||p_domain;
  if v_hash is distinct from p_reviewed_plan->>'plan_fingerprint' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_plan_fingerprint_mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-h3-2b-key:'||v_actor::text||':'||p_domain||':'||p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-h3-2b-correlation:'||p_correlation_id::text,0));
  select count(distinct receipt.id) into v_matches from public.hotel_partner_action_receipts receipt
    where receipt.correlation_id=p_correlation_id
       or (receipt.partner_id=v_partner and receipt.action=v_action and receipt.idempotency_key=p_idempotency_key);
  if v_matches>1 then raise exception using errcode='PT409',message='hotels_v2_h3_2b_correlation_reused'; end if;
  select * into v_receipt from public.hotel_partner_action_receipts receipt
    where receipt.correlation_id=p_correlation_id
       or (receipt.partner_id=v_partner and receipt.action=v_action and receipt.idempotency_key=p_idempotency_key)
    order by (receipt.partner_id=v_partner and receipt.action=v_action and receipt.idempotency_key=p_idempotency_key) desc limit 1;
  if found then
    if v_receipt.actor_user_id is distinct from v_actor or v_receipt.action is distinct from v_action
       or v_receipt.request_hash is distinct from v_hash
       or v_receipt.correlation_id is distinct from p_correlation_id
       or v_receipt.idempotency_key is distinct from p_idempotency_key then
      if v_receipt.partner_id=v_partner and v_receipt.action=v_action and v_receipt.idempotency_key=p_idempotency_key then
        raise exception using errcode='PT409',message='hotels_v2_h3_2b_idempotency_key_reused'; end if;
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_correlation_reused';
    end if;
    return jsonb_build_object('replayed',true,'result',v_receipt.result||jsonb_build_object('replayed',true));
  end if;
  select * into v_review from public.hotel_partner_workspace_plan_reviews where id=v_review_id for update;
  if not found or v_review.actor_id is distinct from v_actor or v_review.partner_id is distinct from v_partner
     or v_review.hotel_id is distinct from v_hotel or v_review.domain is distinct from p_domain
     or v_review.plan_fingerprint is distinct from v_hash or v_review.reviewed_plan is distinct from p_reviewed_plan
     or v_review.consumed_at is not null then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_review_not_applicable';
  end if;
  if v_review.expires_at<=clock_timestamp() then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_review_expired'; end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,p_capability);
  if public.hotel_v2_h3_2b_hash(v_access) is distinct from v_review.access_snapshot_token
     or (v_access->>'assignment_id')::uuid is distinct from v_review.assignment_id
     or (v_access->>'permission_version')::bigint is distinct from v_review.permission_version then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_access_stale'; end if;
  return jsonb_build_object('replayed',false,'review_id',v_review.id,'actor_id',v_actor,
    'partner_id',v_partner,'hotel_id',v_hotel,'domain_snapshot_token',v_review.domain_snapshot_token,
    'request_hash',v_hash,'domain_from',v_review.domain_from,'domain_to',v_review.domain_to,'access',v_access);
end
$function$;

create function public.hotel_v2_h3_2b_finish_apply(
  p_context jsonb,p_domain text,p_correlation_id uuid,p_idempotency_key uuid,p_activity jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_result jsonb;
begin
  if (p_context->>'replayed')::boolean then return p_context->'result'; end if;
  v_result:=jsonb_build_object('contract_version','hotels_v2_h3_2b_'||p_domain||'_apply_result_v1',
    'partner_id',(p_context->>'partner_id')::uuid,'hotel_id',(p_context->>'hotel_id')::uuid,
    'changed',true,'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'replayed',false,
    'activity',jsonb_build_array(p_activity),'workspace',null);
  insert into public.hotel_partner_action_receipts(partner_id,hotel_id,actor_user_id,action,
    idempotency_key,correlation_id,request_hash,result)
  values((p_context->>'partner_id')::uuid,(p_context->>'hotel_id')::uuid,
    (p_context->>'actor_id')::uuid,'h3_2b_'||p_domain,p_idempotency_key,p_correlation_id,
    p_context->>'request_hash',v_result);
  update public.hotel_partner_workspace_plan_reviews set consumed_at=clock_timestamp(),
    consumed_correlation_id=p_correlation_id where id=(p_context->>'review_id')::uuid;
  return v_result;
end
$function$;

create function public.hotel_v2_partner_preview_content_plan(p_draft jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_partner uuid; v_hotel uuid; v_access jsonb; v_workspace jsonb; v_intent jsonb;
  v_entity text; v_action text; v_id uuid; v_payload jsonb; v_reason text; v_capability text;
  v_original jsonb; v_operation jsonb; v_impact jsonb; v_target jsonb; v_version bigint;
  v_intent_payload jsonb; v_before_target jsonb; v_impact_before jsonb; v_impact_after jsonb;
begin
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array['contract_version','partner_id','hotel_id','access_snapshot_token','content_snapshot_token','intent'])
     or not (p_draft?&array['contract_version','partner_id','hotel_id','access_snapshot_token','content_snapshot_token','intent'])
     or p_draft->>'contract_version'<>'hotels_v2_h3_2b_content_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or jsonb_typeof(p_draft->'intent')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_draft';
  end if;
  begin v_partner:=(p_draft->>'partner_id')::uuid; v_hotel:=(p_draft->>'hotel_id')::uuid;
  exception when invalid_text_representation then raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_draft'; end;
  v_intent:=p_draft->'intent';
  if not public.hotel_v2_h2a_keys_allowed(v_intent,array['entity','action','id','payload','reason'])
     or not (v_intent?&array['entity','action','id','payload','reason'])
     or jsonb_typeof(v_intent->'entity')<>'string' or jsonb_typeof(v_intent->'action')<>'string'
     or jsonb_typeof(v_intent->'payload')<>'object'
     or not public.hotel_v2_h3_2b_reason_is_valid(v_intent->'reason') then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_intent';
  end if;
  v_entity:=v_intent->>'entity'; v_action:=v_intent->>'action'; v_payload:=v_intent->'payload';
  v_intent_payload:=v_payload; v_reason:=v_intent->>'reason';
  v_capability:=case v_entity when 'property_content' then 'edit_property_content'
    when 'property_photos' then 'edit_property_photos' when 'room_content' then 'edit_room_content'
    when 'room_photos' then 'edit_room_photos' when 'room' then 'create_rooms'
    when 'room_structure' then 'edit_room_structure' end;
  if v_capability is null or v_action not in('create','update')
     or (v_entity='room')<>(v_action='create') then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_intent';
  end if;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,v_capability);
  v_workspace:=public.hotel_v2_partner_get_workspace(v_partner,v_hotel,current_date,current_date+30);
  if p_draft->>'access_snapshot_token' is distinct from v_workspace#>>'{assignment,access_snapshot_token}'
     or p_draft->>'content_snapshot_token' is distinct from v_workspace->>'content_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_stale_content_draft';
  end if;
  if v_entity in('property_content','property_photos') then
    if jsonb_typeof(v_intent->'id')<>'string' or (v_intent->>'id')::uuid<>v_hotel then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_intent_id'; end if;
    select value into v_original from jsonb_array_elements(jsonb_build_array(v_workspace->'property_draft')) value;
    if (v_original->>'exists')::boolean and (v_original->>'source_property_updated_at')::timestamptz
       is distinct from (v_workspace#>>'{property,updated_at}')::timestamptz then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_property_draft_source_stale'; end if;
    v_version:=(v_original->>'version')::bigint;
    v_id:=case when (v_original->>'exists')::boolean then (v_original->>'id')::uuid else gen_random_uuid() end;
    if v_action<>'update' then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_draft_action'; end if;
    if v_entity='property_content' then
      if not public.hotel_v2_h2a_keys_allowed(v_payload,array['title_i18n','description_i18n','city','address_line','district','postal_code','country','latitude','longitude','google_maps_url','amenities','check_in_from','check_out_until'])
         or v_payload='{}'::jsonb then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_content'; end if;
      v_before_target:=case when v_original->'content'<>'{}'::jsonb then v_original->'content' else
        jsonb_build_object('title_i18n',v_workspace#>'{property,title_i18n}',
          'description_i18n',v_workspace#>'{property,description_i18n}','city',v_workspace#>'{property,city}',
          'address_line',v_workspace#>'{property,address_line}','district',v_workspace#>'{property,district}',
          'postal_code',v_workspace#>'{property,postal_code}','country',v_workspace#>'{property,country}',
          'latitude',v_workspace#>'{property,latitude}','longitude',v_workspace#>'{property,longitude}',
          'google_maps_url',v_workspace#>'{property,google_maps_url}','amenities',v_workspace#>'{property,amenities}',
          'check_in_from',v_workspace#>'{property,check_in_from}','check_out_until',v_workspace#>'{property,check_out_until}') end;
      v_payload:=v_before_target||v_payload;
      if not public.hotel_v2_h3_2b_property_content_is_valid(v_hotel,v_payload,
        case when v_original->'content'<>'{}'::jsonb then v_original->'content'
          else jsonb_build_object('amenities',v_workspace#>'{property,amenities}') end) then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_content'; end if;
    else
      if not public.hotel_v2_h2a_keys_allowed(v_payload,array['cover_image_url','photos'])
         or v_payload='{}'::jsonb then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_photos'; end if;
      v_before_target:=case when v_original->'photos'<>'{}'::jsonb then v_original->'photos' else
        jsonb_build_object('cover_image_url',v_workspace#>'{property,cover_image_url}',
          'photos',v_workspace#>'{property,photos}') end;
      v_payload:=v_before_target||v_payload;
      if not public.hotel_v2_h3_2b_property_photos_are_valid(v_hotel,
        (v_access->>'assignment_id')::uuid,v_payload,
        case when v_original->'photos'<>'{}'::jsonb then v_original->'photos'
          else jsonb_build_object('cover_image_url',v_workspace#>'{property,cover_image_url}',
            'photos',v_workspace#>'{property,photos}') end) then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_property_photos'; end if;
    end if;
  else
    if v_action='create' then
      if jsonb_typeof(v_intent->'id')<>'null' then raise exception using errcode='22023',message='hotels_v2_h3_2b_room_create_id_must_be_null'; end if;
      v_id:=gen_random_uuid(); v_version:=0; v_original:=null;
    else
      if jsonb_typeof(v_intent->'id')<>'string' then raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_id'; end if;
      v_id:=(v_intent->>'id')::uuid;
      select value into v_original from jsonb_array_elements(v_workspace->'rooms') value where (value->>'id')::uuid=v_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_h3_2b_room_not_found'; end if;
      if v_original->>'status' not in('draft','active') then
        raise exception using errcode='23514',message='hotels_v2_h3_2b_room_not_editable'; end if;
      v_version:=(v_original->>'version')::bigint;
    end if;
    if v_entity='room_content' then
      if not public.hotel_v2_h2a_keys_allowed(v_payload,array['name_i18n','description_i18n','amenities','floor_label_i18n']) or v_payload='{}'::jsonb then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_content'; end if;
      v_before_target:=jsonb_build_object('name_i18n',v_original->'name_i18n','description_i18n',v_original->'description_i18n',
        'amenities',v_original->'amenities',
        'floor_label_i18n',v_original->'floor_label_i18n');
      v_payload:=v_before_target||v_payload;
      if not public.hotel_v2_h3_2b_room_content_is_valid(v_hotel,v_payload,v_original) then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_content'; end if;
    elsif v_entity='room_photos' then
      if not public.hotel_v2_h2a_keys_allowed(v_payload,array['gallery']) or v_payload='{}'::jsonb then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_photos'; end if;
      v_before_target:=jsonb_build_object('gallery',v_original->'gallery');
      v_payload:=v_before_target||v_payload;
      if not public.hotel_v2_h3_2b_room_photos_are_valid(v_hotel,v_id,
        (v_access->>'assignment_id')::uuid,v_payload,v_original) then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_photos';
      end if;
    elsif v_entity='room_structure' then
      if not public.hotel_v2_h2a_keys_allowed(v_payload,array['capacity_adults','capacity_children','max_occupancy','bed_configuration','bathrooms','size_sqm','inventory_mode','base_inventory_count','sort_order']) or v_payload='{}'::jsonb then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_structure'; end if;
      if ((case when v_payload?'capacity_adults' then 1 else 0 end)
          +(case when v_payload?'capacity_children' then 1 else 0 end)
          +(case when v_payload?'max_occupancy' then 1 else 0 end)) not in(0,3) then
        raise exception using errcode='22023',message='hotels_v2_h3_2b_room_capacity_group_required'; end if;
      v_before_target:=jsonb_build_object('capacity_adults',v_original->'capacity_adults',
        'capacity_children',v_original->'capacity_children','max_occupancy',v_original->'max_occupancy',
        'bed_configuration',v_original->'bed_configuration',
        'bathrooms',v_original->'bathrooms','size_sqm',v_original->'size_sqm',
        'inventory_mode',v_original->'inventory_mode','base_inventory_count',v_original->'base_inventory_count',
        'sort_order',v_original->'sort_order');
      v_payload:=v_before_target||v_payload;
      if not public.hotel_v2_h3_2b_room_structure_is_valid(v_payload) then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_structure';
      end if;
    elsif v_entity='room' and (not public.hotel_v2_h2a_keys_allowed(v_payload,array['code','name_i18n','description_i18n','amenities','bed_configuration','floor_label_i18n','gallery','capacity_adults','capacity_children','max_occupancy','bathrooms','size_sqm','inventory_mode','base_inventory_count','sort_order'])
       or not (v_payload?&array['code','name_i18n','description_i18n','amenities','bed_configuration','floor_label_i18n','gallery','capacity_adults','capacity_children','max_occupancy','bathrooms','size_sqm','inventory_mode','base_inventory_count','sort_order'])
       or not public.hotel_v2_h3_2b_room_create_is_valid(v_hotel,v_id,
         (v_access->>'assignment_id')::uuid,v_payload)) then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_room_create';
    end if;
    if v_entity='room' then v_before_target:=null; end if;
    if v_entity='room' and (v_payload->>'inventory_mode'<>'pooled'
       or (v_payload->>'base_inventory_count')::integer<>0) then
      perform public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,'edit_room_structure');
    end if;
  end if;
  v_target:=v_payload;
  if v_original is not null and ((v_entity='property_content' and v_before_target=v_payload)
      or (v_entity='property_photos' and v_before_target=v_payload)
      or (v_entity='room_content' and jsonb_build_object('name_i18n',v_original->'name_i18n',
        'description_i18n',v_original->'description_i18n','amenities',v_original->'amenities',
        'floor_label_i18n',v_original->'floor_label_i18n')=v_payload)
      or (v_entity='room_photos' and jsonb_build_object('gallery',v_original->'gallery')=v_payload)
      or (v_entity='room_structure' and jsonb_build_object('capacity_adults',v_original->'capacity_adults',
        'capacity_children',v_original->'capacity_children','max_occupancy',v_original->'max_occupancy',
        'bed_configuration',v_original->'bed_configuration','bathrooms',v_original->'bathrooms',
        'size_sqm',v_original->'size_sqm','inventory_mode',v_original->'inventory_mode',
        'base_inventory_count',v_original->'base_inventory_count','sort_order',v_original->'sort_order')=v_payload)) then
    return jsonb_build_object('contract_version','hotels_v2_h3_2b_content_preview_v1','partner_id',v_partner,
      'hotel_id',v_hotel,'changed',false,'impacts','[]'::jsonb,
      'blocking_reasons','[]'::jsonb,'reviewed_plan',null);
  end if;
  v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
    'expected_version',v_version,'expected_original',v_original,'payload',v_intent_payload,'reason',v_reason);
  select jsonb_object_agg(key_name,v_before_target->key_name order by key_name),
    jsonb_object_agg(key_name,v_target->key_name order by key_name)
    into v_impact_before,v_impact_after
  from jsonb_object_keys(v_intent_payload) key_name;
  if v_entity='room' then v_impact_before:=null; end if;
  v_impact:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,'changed',true,
    'fields',to_jsonb(array(select jsonb_object_keys(v_intent_payload) order by 1)),'before',v_impact_before,
    'after',v_impact_after,'affected_room_type_ids',case when v_entity='room' or v_entity like 'room_%' then jsonb_build_array(v_id) else '[]'::jsonb end,
    'affected_room_rate_ids','[]'::jsonb,'from',null,'to',null);
  return public.hotel_v2_h3_2b_store_review('content',v_partner,v_hotel,v_access,
    v_workspace->>'content_snapshot_token',v_operation,v_impact,v_workspace);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_content_draft';
end
$function$;

create function public.hotel_v2_h3_2b_commercial(
  p_policy jsonb,p_customer numeric,p_quantity integer,p_unit_amount numeric
) returns jsonb language plpgsql security definer immutable
set search_path=pg_catalog
as $function$
declare v_commission numeric(12,2); v_net numeric(12,2); v_code text;
  v_quantity integer; v_policy_amount numeric;
begin
  if p_policy is null or jsonb_typeof(p_policy)<>'object' or p_customer is null or p_customer<0
     or p_quantity<1 or p_unit_amount is null or p_unit_amount<0
     or p_policy->>'amount'!~'^[0-9]+(?:[.][0-9]{1,2})?$'
     or p_unit_amount is distinct from (p_policy->>'amount')::numeric then
    raise exception using errcode='23514',message='hotels_v2_h3_2b_invalid_commercial_basis'; end if;
  v_policy_amount:=(p_policy->>'amount')::numeric;
  if p_policy->>'commission_mode'='percent_booking_total' then
    v_quantity:=1; v_commission:=round(p_customer*(v_policy_amount/100),2); v_code:='booking_total';
  elsif p_policy->>'commission_mode'='per_allocated_room_per_night' then
    v_quantity:=p_quantity; v_commission:=round(v_policy_amount*v_quantity,2); v_code:='allocated_room_nights';
  else raise exception using errcode='55000',message='hotels_v2_h3_2b_unsupported_commission_mode'; end if;
  v_net:=round(p_customer-v_commission,2);
  if v_commission>p_customer or v_net<0 then
    raise exception using errcode='23514',message='hotels_v2_h3_2b_commission_exceeds_customer_price'; end if;
  return jsonb_build_object('policy',p_policy-'updated_at','calculation_basis',jsonb_build_object(
    'code',v_code,'quantity',v_quantity,'unit_amount',v_policy_amount,'booking_total',round(p_customer,2)),
    'customer_price',round(p_customer,2),'cypruseye_commission',v_commission,
    'partner_net',v_net,'currency',p_policy->>'currency');
end
$function$;

create function public.hotel_v2_partner_preview_pricing_plan(p_draft jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_partner uuid; v_hotel uuid; v_access jsonb; v_workspace jsonb; v_intent jsonb;
  v_entity text; v_action text; v_id uuid; v_payload jsonb; v_reason text;
  v_original jsonb; v_after jsonb; v_operation jsonb; v_impact jsonb; v_policy jsonb;
  v_before_rate numeric; v_after_rate numeric; v_room_rate uuid; v_stay date; v_expected bigint;
  v_commercial_before jsonb; v_commercial_after jsonb; v_immutable jsonb;
  v_affected_rates jsonb:='[]'::jsonb; v_affected_rooms jsonb:='[]'::jsonb;
  v_example_before jsonb; v_example_after jsonb; v_example_pricing jsonb; v_quantity integer;
begin
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array['contract_version','partner_id','hotel_id','access_snapshot_token','pricing_snapshot_token','intent','example_stay'])
     or not (p_draft?&array['contract_version','partner_id','hotel_id','access_snapshot_token','pricing_snapshot_token','intent','example_stay'])
     or p_draft->>'contract_version'<>'hotels_v2_h3_2b_pricing_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_draft)
     or jsonb_typeof(p_draft->'intent')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_draft'; end if;
  begin v_partner:=(p_draft->>'partner_id')::uuid; v_hotel:=(p_draft->>'hotel_id')::uuid;
  exception when invalid_text_representation then raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_draft'; end;
  v_access:=public.hotel_v2_h3_2b_access_snapshot(v_partner,v_hotel,'manage_prices');
  v_workspace:=public.hotel_v2_partner_get_workspace(v_partner,v_hotel,current_date,current_date+30);
  if p_draft->>'access_snapshot_token' is distinct from v_workspace#>>'{assignment,access_snapshot_token}'
     or p_draft->>'pricing_snapshot_token' is distinct from v_workspace#>>'{pricing,snapshot_token}' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_stale_pricing_draft'; end if;
  v_policy:=v_workspace#>'{pricing,commission_policy}'; v_intent:=p_draft->'intent';
  if v_policy->>'currency' is distinct from v_workspace#>>'{pricing,currency}' then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_commission_currency_mismatch'; end if;
  if not public.hotel_v2_h2a_keys_allowed(v_intent,array['entity','action','id','payload','reason'])
     or not (v_intent?&array['entity','action','id','payload','reason'])
     or jsonb_typeof(v_intent->'payload')<>'object'
     or not public.hotel_v2_h3_2b_reason_is_valid(v_intent->'reason') then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_intent'; end if;
  v_entity:=v_intent->>'entity'; v_action:=v_intent->>'action'; v_payload:=v_intent->'payload'; v_reason:=v_intent->>'reason';
  if v_entity not in('room_rate_price','schedule_tier_price','room_rate_tier_price','exact_date_price')
     or (v_entity<>'exact_date_price' and v_action<>'update')
     or (v_entity='exact_date_price' and v_action<>'upsert')
     or not public.hotel_v2_h2a_keys_allowed(v_payload,case when v_entity='exact_date_price'
       then array['room_rate_id','stay_date','nightly_rate_mode','nightly_rate'] else array['nightly_rate'] end)
     or not (v_payload?'nightly_rate') or jsonb_typeof(v_payload->'nightly_rate')<>'number'
     or v_payload->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
     or (v_payload->>'nightly_rate')::numeric>9999999999.99 then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_intent'; end if;
  if (v_entity='exact_date_price' and jsonb_typeof(v_intent->'id') not in('string','null'))
     or (v_entity<>'exact_date_price' and jsonb_typeof(v_intent->'id')<>'string') then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_intent_id'; end if;
  v_after_rate:=(v_payload->>'nightly_rate')::numeric;
  if v_entity='room_rate_price' then
    v_id:=(v_intent->>'id')::uuid;
    v_original:=public.hotel_v2_h3_2b_room_rate_projection(v_id);
    if v_original->>'hotel_id' is distinct from v_hotel::text then v_original:=null; end if;
    if v_original is null then raise exception using errcode='PT404',message='hotels_v2_h3_2b_price_target_not_found'; end if;
    if v_original->>'pricing_schedule_id' is not null or exists(select 1 from public.hotel_room_rate_occupancy_tiers tier where tier.room_rate_id=v_id and tier.is_active) then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_base_price_not_authoritative'; end if;
    v_room_rate:=v_id; v_before_rate:=(v_original->>'base_nightly_rate')::numeric;
    v_affected_rates:=jsonb_build_array(v_room_rate);
    select jsonb_build_array(rate.room_type_id) into v_affected_rooms from public.hotel_room_rates rate where rate.id=v_room_rate;
  elsif v_entity='schedule_tier_price' then
    v_id:=(v_intent->>'id')::uuid;
    v_original:=public.hotel_v2_h3_2b_schedule_tier_projection(v_id);
    if not exists(select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=(v_original->>'schedule_id')::uuid and schedule.hotel_id=v_hotel) then v_original:=null; end if;
    if v_original is null then raise exception using errcode='PT404',message='hotels_v2_h3_2b_price_target_not_found'; end if;
    select coalesce(jsonb_agg(rate.id order by rate.id),'[]'::jsonb),
      coalesce(jsonb_agg(distinct rate.room_type_id order by rate.room_type_id),'[]'::jsonb),min(rate.id)
      into v_affected_rates,v_affected_rooms,v_room_rate
    from public.hotel_room_rates rate where rate.hotel_id=v_hotel
      and rate.pricing_schedule_id=(v_original->>'schedule_id')::uuid;
    if jsonb_array_length(v_affected_rates)=0 then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_schedule_tier_has_no_products'; end if;
    v_before_rate:=(v_original->>'nightly_rate')::numeric;
  elsif v_entity='room_rate_tier_price' then
    v_id:=(v_intent->>'id')::uuid;
    v_original:=public.hotel_v2_h3_2b_room_rate_tier_projection(v_id);
    if v_original->>'hotel_id' is distinct from v_hotel::text then v_original:=null; end if;
    v_room_rate:=(v_original->>'room_rate_id')::uuid; v_before_rate:=(v_original->>'nightly_rate')::numeric;
    v_affected_rates:=jsonb_build_array(v_room_rate);
    select jsonb_build_array(rate.room_type_id) into v_affected_rooms from public.hotel_room_rates rate where rate.id=v_room_rate;
  else
    if jsonb_typeof(v_intent->'id') not in('string','null')
       or not (v_payload?&array['room_rate_id','stay_date','nightly_rate_mode','nightly_rate'])
       or v_payload->>'nightly_rate_mode'<>'set' then
      raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_exact_price'; end if;
    v_room_rate:=(v_payload->>'room_rate_id')::uuid; v_stay:=(v_payload->>'stay_date')::date;
    select public.hotel_v2_h3_2b_exact_price_projection(override_row.id) into v_original
    from public.hotel_calendar_overrides override_row
    where override_row.hotel_id=v_hotel and override_row.room_rate_id=v_room_rate and override_row.stay_date=v_stay;
    if jsonb_typeof(v_intent->'id')='string' and (v_original is null
       or (v_intent->>'id')::uuid<>(v_original->>'id')::uuid) then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_exact_price_identity_stale'; end if;
    if v_original is null then v_id:=gen_random_uuid(); v_expected:=0; v_before_rate:=null;
    else v_id:=(v_original->>'id')::uuid; v_expected:=(v_original->>'pricing_version')::bigint;
      if v_original->>'nightly_rate_mode'='set' then
        v_before_rate:=(v_original->>'nightly_rate')::numeric;
      else v_before_rate:=null; end if;
    end if;
    if not exists(select 1 from public.hotel_room_rates rate where rate.id=v_room_rate and rate.hotel_id=v_hotel) then
      raise exception using errcode='PT404',message='hotels_v2_h3_2b_price_target_not_found'; end if;
    v_affected_rates:=jsonb_build_array(v_room_rate);
    select jsonb_build_array(rate.room_type_id) into v_affected_rooms from public.hotel_room_rates rate where rate.id=v_room_rate;
  end if;
  if v_original is null and v_entity<>'exact_date_price' then raise exception using errcode='PT404',message='hotels_v2_h3_2b_price_target_not_found'; end if;
  v_immutable:=public.hotel_v2_admin_c_immutable_contract(v_hotel,case when v_entity='room_rate_price' then 'room_rate'
    when v_entity='schedule_tier_price' then 'pricing_schedule' when v_entity='room_rate_tier_price' then 'room_rate'
    else 'exact_date_price' end,case when v_entity='schedule_tier_price' then (v_original->>'schedule_id')::uuid else coalesce(v_room_rate,v_id) end);
  if v_immutable is not null then raise exception using errcode='23514',message='hotels_v2_h3_2b_h3_1p_contract_immutable'; end if;
  if v_entity='exact_date_price' and v_before_rate is null then
    if jsonb_typeof(p_draft->'example_stay')<>'object'
       or (p_draft#>>'{example_stay,check_in}')::date>v_stay
       or (p_draft#>>'{example_stay,check_out}')::date<=v_stay then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_exact_price_example_required'; end if;
    v_example_before:=public.hotel_v2_partner_preview_commercial_stay(p_draft->'example_stay');
    if not coalesce((v_example_before->>'ok')::boolean,false) then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_exact_price_example_required'; end if;
    select min((day.value->>'nightly_rate')::numeric) into v_before_rate
    from jsonb_array_elements(v_example_before#>'{pricing,nightly_breakdown}') day(value)
    where (day.value->>'room_rate_id')::uuid=v_room_rate
      and (day.value->>'stay_date')::date=v_stay;
    if v_before_rate is null then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_exact_price_example_required'; end if;
  end if;
  v_expected:=coalesce(v_expected,(v_original->>'version')::bigint);
  if v_before_rate=v_after_rate then
    return jsonb_build_object('contract_version','hotels_v2_h3_2b_pricing_preview_v1','partner_id',v_partner,
      'hotel_id',v_hotel,'changed',false,'blocking_reasons','[]'::jsonb,'impacts','[]'::jsonb,
      'reviewed_plan',null,'commercial_before',null,'commercial_after',null,
      'example_before',null,'example_after',null); end if;
  v_after:=coalesce(v_original,'{}'::jsonb)||jsonb_build_object(
    case when v_entity='room_rate_price' then 'base_nightly_rate' else 'nightly_rate' end,v_after_rate);
  v_commercial_before:=public.hotel_v2_h3_2b_commercial(v_policy,v_before_rate,1,(v_policy->>'amount')::numeric);
  v_commercial_after:=public.hotel_v2_h3_2b_commercial(v_policy,v_after_rate,1,(v_policy->>'amount')::numeric);
  v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,
    'id',v_id,'expected_version',v_expected,'expected_original',v_original,
    'payload',v_payload,'reason',v_reason);
  v_impact:=jsonb_build_object('entity',v_entity,'action',v_operation->>'action','id',v_id,'changed',true,
    'fields',jsonb_build_array('nightly_rate'),'before',jsonb_build_object('nightly_rate',v_before_rate),
    'after',jsonb_build_object('nightly_rate',v_after_rate),
    'affected_room_type_ids',coalesce(v_affected_rooms,'[]'::jsonb),
    'affected_room_rate_ids',coalesce(v_affected_rates,'[]'::jsonb),'from',v_stay,'to',v_stay);
  if jsonb_typeof(p_draft->'example_stay')='object' then
    v_example_before:=coalesce(v_example_before,
      public.hotel_v2_partner_preview_commercial_stay(p_draft->'example_stay'));
    v_example_pricing:=public.hotel_v2_h3_2b_overlay_pricing_preview(v_example_before->'pricing',
      v_entity,v_id,v_payload);
    if coalesce((v_example_pricing->>'ok')::boolean,false) and v_example_pricing->'customer_total' is not null then
      v_quantity:=jsonb_array_length(v_example_pricing->'products')*(v_example_pricing->>'nights')::integer;
      v_example_after:=v_example_before||jsonb_build_object('pricing',v_example_pricing,
        'commercial',public.hotel_v2_h3_2b_commercial(v_policy,
          (v_example_pricing->>'customer_total')::numeric,v_quantity,(v_policy->>'amount')::numeric),
        'ok',true,'blocking_reasons','[]'::jsonb);
    else
      v_example_after:=v_example_before||jsonb_build_object('pricing',v_example_pricing,
        'commercial',null,'ok',false,'blocking_reasons',jsonb_build_array('pricing_configuration_blocked'));
    end if;
  elsif jsonb_typeof(p_draft->'example_stay')<>'null' then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_example';
  end if;
  return public.hotel_v2_h3_2b_store_review('pricing',v_partner,v_hotel,v_access,
    v_workspace#>>'{pricing,snapshot_token}',v_operation,v_impact,null)
    ||jsonb_build_object('commercial_before',v_commercial_before,'commercial_after',v_commercial_after,
      'example_before',v_example_before,'example_after',v_example_after);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_draft';
end
$function$;

create function public.hotel_v2_partner_apply_pricing_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_context jsonb; v_operation jsonb:=p_reviewed_plan#>'{operations,0}';
  v_entity text; v_id uuid; v_expected bigint; v_payload jsonb; v_original jsonb;
  v_before jsonb; v_after jsonb; v_partner uuid; v_hotel uuid; v_workspace jsonb;
  v_activity jsonb; v_room_rate uuid; v_stay date; v_actor uuid:=auth.uid(); v_immutable jsonb;
begin
  v_entity:=v_operation->>'entity';
  if v_entity not in('room_rate_price','schedule_tier_price','room_rate_tier_price','exact_date_price') then
    raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_operation'; end if;
  v_context:=public.hotel_v2_h3_2b_prepare_apply('pricing',p_reviewed_plan,p_correlation_id,p_idempotency_key,'manage_prices');
  if (v_context->>'replayed')::boolean then return v_context->'result'; end if;
  v_partner:=(v_context->>'partner_id')::uuid; v_hotel:=(v_context->>'hotel_id')::uuid;
  v_id:=(v_operation->>'id')::uuid; v_expected:=(v_operation->>'expected_version')::bigint;
  v_payload:=v_operation->'payload'; v_original:=v_operation->'expected_original';
  -- Match ADMIN-C's Hotel pricing-graph lock order so the composite pricing
  -- token and every shared-tier impact are stable through the mutation.
  perform 1 from public.hotels where id=v_hotel for update;
  perform 1 from public.hotel_rate_plans where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_room_rates where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.id=tier.schedule_id and schedule.hotel_id=v_hotel) order by tier.id for update;
  perform 1 from public.hotel_room_rate_occupancy_tiers where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_rate_rules rule where exists(select 1 from public.hotel_room_rates rate
    where rate.id=rule.room_rate_id and rate.hotel_id=v_hotel) order by rule.id for update;
  perform 1 from public.hotel_calendar_overrides where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=v_hotel order by id for update;
  perform 1 from public.hotel_room_allocation_rule_items where hotel_id=v_hotel order by id for update;
  perform policy.id from public.hotel_commission_policies policy
    where policy.hotel_id=v_hotel and policy.is_active and policy.review_status='reviewed'
    order by policy.id for update;
  if v_entity='room_rate_price' then
    perform 1 from public.hotel_room_rates rate where rate.id=v_id and rate.hotel_id=v_hotel for update;
  elsif v_entity='schedule_tier_price' then
    perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where tier.id=v_id and schedule.hotel_id=v_hotel for update of tier;
    perform rate.id from public.hotel_room_rates rate
      where rate.hotel_id=v_hotel and rate.pricing_schedule_id=(
        select tier.schedule_id from public.hotel_pricing_schedule_occupancy_tiers tier where tier.id=v_id)
      order by rate.id for update;
  elsif v_entity='room_rate_tier_price' then
    perform 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.id=v_id and tier.hotel_id=v_hotel for update;
  else
    v_room_rate:=(v_payload->>'room_rate_id')::uuid; v_stay:=(v_payload->>'stay_date')::date;
    perform pg_advisory_xact_lock(hashtextextended('hotels-v2-h3-2b-exact:'||v_room_rate::text||':'||v_stay::text,0));
    perform 1 from public.hotel_calendar_overrides override_row
      where override_row.id=v_id and override_row.hotel_id=v_hotel for update;
    perform 1 from public.hotel_room_rates rate where rate.id=v_room_rate and rate.hotel_id=v_hotel for update;
  end if;
  v_workspace:=public.hotel_v2_partner_get_workspace(v_partner,v_hotel,current_date,current_date+30);
  if v_workspace#>>'{pricing,snapshot_token}' is distinct from v_context->>'domain_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
  if v_entity='room_rate_price' then
    v_before:=public.hotel_v2_h3_2b_room_rate_projection(v_id);
    if v_before is distinct from v_original or (v_before->>'version')::bigint<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
    if not coalesce((v_before->>'base_nightly_rate_authoritative')::boolean,false) then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_base_price_not_authoritative'; end if;
    v_immutable:=public.hotel_v2_admin_c_immutable_contract(v_hotel,'room_rate',v_id);
    if v_immutable is not null then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_h3_1p_contract_immutable'; end if;
    update public.hotel_room_rates set base_nightly_rate=(v_payload->>'nightly_rate')::numeric where id=v_id;
    v_after:=public.hotel_v2_h3_2b_room_rate_projection(v_id);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'room_rate',v_id,'update',v_before,v_after,p_correlation_id,v_actor);
  elsif v_entity='schedule_tier_price' then
    v_before:=public.hotel_v2_h3_2b_schedule_tier_projection(v_id);
    if v_before is distinct from v_original or (v_before->>'version')::bigint<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
    v_immutable:=public.hotel_v2_admin_c_immutable_contract(
      v_hotel,'pricing_schedule',(v_before->>'schedule_id')::uuid);
    if v_immutable is not null then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_h3_1p_contract_immutable'; end if;
    update public.hotel_pricing_schedule_occupancy_tiers set nightly_rate=(v_payload->>'nightly_rate')::numeric where id=v_id;
    v_after:=public.hotel_v2_h3_2b_schedule_tier_projection(v_id);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'occupancy_tier',v_id,'update',v_before,v_after,p_correlation_id,v_actor);
  elsif v_entity='room_rate_tier_price' then
    v_before:=public.hotel_v2_h3_2b_room_rate_tier_projection(v_id);
    if v_before is distinct from v_original or (v_before->>'version')::bigint<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
    v_immutable:=public.hotel_v2_admin_c_immutable_contract(
      v_hotel,'room_rate',(v_before->>'room_rate_id')::uuid);
    if v_immutable is not null then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_h3_1p_contract_immutable'; end if;
    update public.hotel_room_rate_occupancy_tiers set nightly_rate=(v_payload->>'nightly_rate')::numeric where id=v_id;
    v_after:=public.hotel_v2_h3_2b_room_rate_tier_projection(v_id);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'occupancy_tier',v_id,'update',v_before,v_after,p_correlation_id,v_actor);
  else
    v_room_rate:=(v_payload->>'room_rate_id')::uuid; v_stay:=(v_payload->>'stay_date')::date;
    v_before:=public.hotel_v2_h3_2b_exact_price_projection(v_id);
    if coalesce((v_before->>'pricing_version')::bigint,0)<>v_expected
       or coalesce(v_before,'null'::jsonb) is distinct from v_original then
      raise exception using errcode='PT409',message='hotels_v2_h3_2b_pricing_stale'; end if;
    v_immutable:=public.hotel_v2_admin_c_immutable_contract(
      v_hotel,'exact_date_price',v_room_rate);
    if v_immutable is not null then
      raise exception using errcode='23514',message='hotels_v2_h3_2b_h3_1p_contract_immutable'; end if;
    if v_expected=0 then
      insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,nightly_rate,
        nightly_rate_mode,reason,actor_id,actor_type,source,is_active,provenance,
        pricing_source,pricing_reason,pricing_expires_at,pricing_actor_type,pricing_actor_id,
        pricing_updated_at,pricing_correlation_id)
      values(v_id,v_hotel,v_room_rate,v_stay,(v_payload->>'nightly_rate')::numeric,'set',
        'H3.2B Partner pricing-only row',v_actor,'partner','manual',true,'{}'::jsonb,
        'partner',v_operation->>'reason',null,'partner',v_actor,
        clock_timestamp(),p_correlation_id);
    else
      update public.hotel_calendar_overrides set nightly_rate=(v_payload->>'nightly_rate')::numeric,
        nightly_rate_mode='set',pricing_source='partner',pricing_reason=v_operation->>'reason',
        pricing_expires_at=null,pricing_actor_type='partner',
        pricing_actor_id=v_actor,pricing_updated_at=clock_timestamp(),pricing_correlation_id=p_correlation_id
      where id=v_id;
    end if;
    v_after:=public.hotel_v2_h3_2b_exact_price_projection(v_id);
    v_activity:=public.hotel_v2_h3_2b_record_activity(v_hotel,'calendar_override',v_id,
      case when v_expected=0 then 'create' else 'update' end,v_before,v_after,p_correlation_id,v_actor);
  end if;
  return public.hotel_v2_h3_2b_finish_apply(v_context,'pricing',p_correlation_id,p_idempotency_key,v_activity);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_h3_2b_invalid_pricing_operation';
end
$function$;

-- H3.2B owns every newly introduced object. Browser roles execute only the
-- eight reviewed public RPCs and the assignment-scoped Storage policy helper.
alter table public.hotel_partner_property_drafts owner to postgres;
alter table public.hotel_partner_workspace_plan_reviews owner to postgres;
alter table public.hotel_partner_workspace_foundation_receipts owner to postgres;

do $h3_2b_function_ownership_acl$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.hotel_v2_h3_2b_guard_property_draft()',
    'public.hotel_v2_h3_2b_pricing_quote_core(jsonb)',
    'public.hotel_v2_h3_2b_property_content_is_valid(uuid,jsonb,jsonb)',
    'public.hotel_v2_h3_2b_property_photos_are_valid(uuid,uuid,jsonb,jsonb)',
    'public.hotel_v2_h3_2b_room_content_is_valid(uuid,jsonb,jsonb)',
    'public.hotel_v2_h3_2b_room_photos_are_valid(uuid,uuid,uuid,jsonb,jsonb)',
    'public.hotel_v2_h3_2b_room_structure_is_valid(jsonb)',
    'public.hotel_v2_h3_2b_room_create_is_valid(uuid,uuid,uuid,jsonb)',
    'public.hotel_v2_h3_2b_overlay_pricing_preview(jsonb,text,uuid,jsonb)',
    'public.hotel_v2_h3_2b_property_draft_projection(uuid)',
    'public.hotel_v2_h3_2b_room_projection(uuid)',
    'public.hotel_v2_h3_2b_room_rate_projection(uuid)',
    'public.hotel_v2_h3_2b_schedule_tier_projection(uuid)',
    'public.hotel_v2_h3_2b_room_rate_tier_projection(uuid)',
    'public.hotel_v2_h3_2b_exact_price_projection(uuid)',
    'public.hotel_v2_h3_2b_daily_inventory_projection(uuid,date)',
    'public.hotel_v2_h3_2b_hash(jsonb)',
    'public.hotel_v2_h3_2b_protected_fingerprints()',
    'public.hotel_v2_h3_2b_immutable_row()',
    'public.hotel_v2_h3_2b_flags_off()',
    'public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)',
    'public.hotel_v2_h3_2b_commission_policy(uuid)',
    'public.hotel_v2_h3_2b_reason_is_valid(jsonb)',
    'public.hotel_v2_h3_2b_guard_review()',
    'public.hotel_v2_h3_2b_record_activity(uuid,text,uuid,text,jsonb,jsonb,uuid,uuid)',
    'public.hotel_v2_h3_2b_store_review(text,uuid,uuid,jsonb,text,jsonb,jsonb,jsonb,date,date)',
    'public.hotel_v2_h3_2b_prepare_apply(text,jsonb,uuid,uuid,text)',
    'public.hotel_v2_h3_2b_finish_apply(jsonb,text,uuid,uuid,jsonb)',
    'public.hotel_v2_h3_2b_commercial(jsonb,numeric,integer,numeric)',
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
    'public.hotel_v2_partner_preview_content_plan(jsonb)',
    'public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_preview_pricing_plan(jsonb)',
    'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_preview_commercial_stay(jsonb)',
    'public.hotel_v2_partner_preview_availability_plan(jsonb)',
    'public.hotel_v2_partner_apply_availability_plan(jsonb,uuid,uuid)',
    'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)',
    'hotels_v2_private.h3_2b_photo_object_exists(text)'
  ] loop
    execute format('alter function %s owner to postgres',v_signature::regprocedure);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',v_signature::regprocedure);
  end loop;
end
$h3_2b_function_ownership_acl$;

grant execute on function hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb) to authenticated;
grant execute on function public.hotel_v2_partner_get_workspace(uuid,uuid,date,date) to authenticated;
grant execute on function public.hotel_v2_partner_preview_content_plan(jsonb) to authenticated;
grant execute on function public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid) to authenticated;
grant execute on function public.hotel_v2_partner_preview_pricing_plan(jsonb) to authenticated;
grant execute on function public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid) to authenticated;
grant execute on function public.hotel_v2_partner_preview_commercial_stay(jsonb) to authenticated;
grant execute on function public.hotel_v2_partner_preview_availability_plan(jsonb) to authenticated;
grant execute on function public.hotel_v2_partner_apply_availability_plan(jsonb,uuid,uuid) to authenticated;

do $h3_2b_postconditions$
declare v_signature text; v_public text[]:=array[
  'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
  'public.hotel_v2_partner_preview_content_plan(jsonb)',
  'public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)',
  'public.hotel_v2_partner_preview_pricing_plan(jsonb)',
  'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)',
  'public.hotel_v2_partner_preview_commercial_stay(jsonb)',
  'public.hotel_v2_partner_preview_availability_plan(jsonb)',
  'public.hotel_v2_partner_apply_availability_plan(jsonb,uuid,uuid)'];
  v_admin_definition text; v_partner_definition text; v_expected text;
begin
  foreach v_signature in array v_public loop
    if not exists(select 1 from pg_catalog.pg_proc procedure_row
      where procedure_row.oid=v_signature::regprocedure
        and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
        and procedure_row.proconfig=array['search_path=pg_catalog, public, auth']::text[])
       or not pg_catalog.has_function_privilege('authenticated',v_signature,'EXECUTE')
       or pg_catalog.has_function_privilege('anon',v_signature,'EXECUTE')
       or pg_catalog.has_function_privilege('service_role',v_signature,'EXECUTE')
       or pg_catalog.has_function_privilege(0::oid,v_signature,'EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_h3_2b_public_rpc_security_mismatch';
    end if;
  end loop;
  if exists(
    select 1
    from (values
      ('public.hotel_v2_h3_2b_guard_property_draft()',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_pricing_quote_core(jsonb)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_h3_2b_property_content_is_valid(uuid,jsonb,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_property_photos_are_valid(uuid,uuid,jsonb,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_content_is_valid(uuid,jsonb,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_photos_are_valid(uuid,uuid,uuid,jsonb,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_structure_is_valid(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_create_is_valid(uuid,uuid,uuid,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_overlay_pricing_preview(jsonb,text,uuid,jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h3_2b_property_draft_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_rate_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_schedule_tier_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_room_rate_tier_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_exact_price_projection(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_daily_inventory_projection(uuid,date)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_immutable_row()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h3_2b_flags_off()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_h3_2b_commission_policy(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_reason_is_valid(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_h3_2b_guard_review()',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_record_activity(uuid,text,uuid,text,jsonb,jsonb,uuid,uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_store_review(text,uuid,uuid,jsonb,text,jsonb,jsonb,jsonb,date,date)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_h3_2b_prepare_apply(text,jsonb,uuid,uuid,text)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_h3_2b_finish_apply(jsonb,text,uuid,uuid,jsonb)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_commercial(jsonb,numeric,integer,numeric)',true,array['search_path=pg_catalog']::text[]),
      ('hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('hotels_v2_private.h3_2b_photo_object_exists(text)',true,array['search_path=pg_catalog']::text[])
    ) expected(signature,security_definer,settings)
    join pg_catalog.pg_proc procedure_row on procedure_row.oid=expected.signature::regprocedure
    where procedure_row.proowner<>'postgres'::regrole
       or procedure_row.prosecdef is distinct from expected.security_definer
       or procedure_row.proconfig is distinct from expected.settings
  ) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_internal_function_metadata_mismatch';
  end if;
  if exists(select 1 from pg_catalog.pg_proc procedure_row
      join pg_catalog.pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
      where ((namespace_row.nspname='public' and procedure_row.proname like 'hotel_v2_h3_2b_%')
          or (namespace_row.nspname='hotels_v2_private' and procedure_row.proname like 'h3_2b_%'))
        and procedure_row.oid<>'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)'::regprocedure
        and (pg_catalog.has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
          or pg_catalog.has_function_privilege('anon',procedure_row.oid,'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          or pg_catalog.has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_internal_function_exposed';
  end if;
  if not pg_catalog.has_function_privilege('authenticated',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege(0::oid,
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('anon',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_storage_helper_acl_mismatch';
  end if;
  if not pg_catalog.has_schema_privilege('authenticated','hotels_v2_private','USAGE')
     or pg_catalog.has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or pg_catalog.has_schema_privilege('anon','hotels_v2_private','USAGE')
     or pg_catalog.has_schema_privilege('anon','hotels_v2_private','CREATE')
     or pg_catalog.has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or pg_catalog.has_schema_privilege('service_role','hotels_v2_private','CREATE')
     or pg_catalog.has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or pg_catalog.has_schema_privilege(0::oid,'hotels_v2_private','CREATE') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_private_schema_acl_mismatch';
  end if;
  if exists(select 1 from (values('hotel_partner_property_drafts'),
      ('hotel_partner_workspace_plan_reviews'),
      ('hotel_partner_workspace_foundation_receipts')) relation(relation_name),
      unnest(array['anon','authenticated','service_role']) role_name,
      unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name
      where pg_catalog.has_table_privilege(role_name,'public.'||relation_name,privilege_name)
         or pg_catalog.has_table_privilege(0::oid,'public.'||relation_name,privilege_name)) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_raw_table_exposed';
  end if;
  if not exists(select 1 from pg_catalog.pg_policies policy
      where policy.schemaname='storage' and policy.tablename='objects'
        and policy.policyname='hotel_partner_h3_2b_photo_insert'
        and policy.cmd='INSERT' and policy.roles='{authenticated}'::name[]
        and policy.with_check='hotels_v2_private.h3_2b_can_insert_photo(bucket_id, name, metadata)') then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_storage_policy_mismatch';
  end if;
  if not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprints=public.hotel_v2_h3_2b_protected_fingerprints()
        and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_foundation_receipt_mismatch';
  end if;
  select pg_catalog.pg_get_functiondef('public.hotel_v2_admin_preview_pricing_quote(jsonb)'::regprocedure),
    pg_catalog.pg_get_functiondef('public.hotel_v2_h3_2b_pricing_quote_core(jsonb)'::regprocedure)
    into v_admin_definition,v_partner_definition;
  v_expected:=replace(v_admin_definition,'hotel_v2_admin_preview_pricing_quote',
    'hotel_v2_h3_2b_pricing_quote_core');
  v_expected:=replace(v_expected,'perform public.hotel_v2_h2a_require_admin();',
    'perform 1 /* H3.2B outer RPC already proved exact Partner access */;');
  if v_partner_definition is distinct from v_expected then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_admin_c_quote_clone_drift';
  end if;
  if not public.hotel_v2_h3_2b_flags_off()
     or exists(select 1 from public.hotels hotel where hotel.architecture_version<>'legacy'
       and exists(select 1 from public.hotel_partner_hotel_permissions permission where permission.hotel_id=hotel.id)) then
    raise exception using errcode='55000',message='hotels_v2_h3_2b_activation_guard_mismatch';
  end if;
end
$h3_2b_postconditions$;

notify pgrst,'reload schema';
commit;
