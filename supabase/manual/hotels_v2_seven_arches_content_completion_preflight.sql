-- 7 Arches property/two-Room completion preflight (READ ONLY).
-- SQL Editor compatible. This intentionally does not invent or write content.

do $seven_arches_completion_preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
begin
  if to_regclass('public.hotels') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)') is null
     or to_regprocedure('public.hotel_v2_partner_preview_content_plan(jsonb)') is null
     or to_regprocedure('public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_get_partner_property_proposals(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_content_completion_dependency_missing';
  end if;

  if not exists(select 1 from public.hotels hotel
      where hotel.id=c_hotel and hotel.architecture_version='legacy')
     or (select count(*) from public.hotel_room_types room where room.hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_room_types room
       where room.id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'
         and room.hotel_id=c_hotel and room.code='upper-floor-apartment'
         and room.legacy_source_key='upper_floor_apartment'
         and room.max_occupancy=4 and room.capacity_adults is null
         and room.capacity_children is null and room.inventory_mode='pooled'
         and room.base_inventory_count=1 and room.sort_order=100
         and room.amenities@>array['air_conditioning','balcony','terrace']::text[]
         and cardinality(room.amenities)=3)
     or not exists(select 1 from public.hotel_room_types room
       where room.id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'
         and room.hotel_id=c_hotel and room.code='ground-floor-apartment'
         and room.legacy_source_key='ground_floor_apartment'
         and room.max_occupancy=4 and room.capacity_adults is null
         and room.capacity_children is null and room.inventory_mode='pooled'
         and room.base_inventory_count=1 and room.sort_order=200
         and room.amenities@>array['air_conditioning','terrace']::text[]
         and cardinality(room.amenities)=2) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_content_completion_identity_drift';
  end if;
end
$seven_arches_completion_preflight$;

with constants as(
  select '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    array['b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid] room_ids
), property_state as(
  select jsonb_build_object(
    'id',hotel.id,'slug',hotel.slug,'title_i18n',hotel.title_i18n,
    'description_i18n',hotel.description_i18n,'cover_image_url',hotel.cover_image_url,
    'photos',coalesce(hotel.photos,'[]'::jsonb),'updated_at',hotel.updated_at,
    'partner_workspace_i18n_shape_ready',
      (select array_agg(key order by key)=array['en','he','pl']::text[]
       from jsonb_object_keys(coalesce(hotel.title_i18n,'{}'::jsonb)) key)
      and (select array_agg(key order by key)=array['en','he','pl']::text[]
       from jsonb_object_keys(coalesce(hotel.description_i18n,'{}'::jsonb)) key)
  ) value
  from public.hotels hotel,constants where hotel.id=constants.hotel_id
), room_state as(
  select jsonb_agg(jsonb_build_object(
    'id',room.id,'source_key',room.legacy_source_key,'code',room.code,
    'name_i18n',room.name_i18n,'description_i18n',room.description_i18n,
    'gallery',room.gallery,'amenities',to_jsonb(room.amenities),
    'max_occupancy',room.max_occupancy,'inventory_mode',room.inventory_mode,
    'base_inventory_count',room.base_inventory_count,'sort_order',room.sort_order,
    'bed_configuration',room.bed_configuration,'bathrooms',room.bathrooms,
    'size_sqm',room.size_sqm,'version',room.version,'updated_at',room.updated_at,
    'partner_workspace_i18n_shape_ready',
      (select array_agg(key order by key)=array['en','he','pl']::text[]
       from jsonb_object_keys(coalesce(room.name_i18n,'{}'::jsonb)) key)
      and (select array_agg(key order by key)=array['en','he','pl']::text[]
       from jsonb_object_keys(coalesce(room.description_i18n,'{}'::jsonb)) key),
    'gallery_ready',jsonb_array_length(coalesce(room.gallery,'[]'::jsonb))>0,
    'owner_confirmation_required',
      (case when room.bed_configuration='[]'::jsonb
        then jsonb_build_array('bed_configuration') else '[]'::jsonb end)
      ||(case when room.bathrooms is null
        then jsonb_build_array('bathrooms') else '[]'::jsonb end)
      ||(case when room.size_sqm is null
        then jsonb_build_array('size_sqm') else '[]'::jsonb end)
  ) order by room.sort_order,room.id) value
  from public.hotel_room_types room,constants
  where room.id=any(constants.room_ids)
), evidence as(
  select jsonb_build_object(
    'confirmed_database_fields',jsonb_build_array(
      'room_identity','room_amenities','max_occupancy','inventory_mode',
      'base_inventory_count','sort_order'),
    'completion_targets_requiring_review',jsonb_build_array(
      'room_pl_en_he_names','room_pl_en_he_descriptions','room_galleries'),
    'missing_factual_provenance',jsonb_build_array(
      'bed_configuration_types','bathrooms','size_sqm'),
    'canonical_property_writer','ADMIN-B reviewed property control',
    'partner_property_writer','H3.2B pending_admin_review proposal only',
    'room_writers',jsonb_build_array(
      'ADMIN-B reviewed Room control','H3.2B reviewed room_content',
      'H3.2B reviewed room_photos','H3.2B reviewed room_structure'),
    'automatic_data_write_safe',false,
    'existing_reviewed_flows_sufficient',
      to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)') is not null
  ) value
)
select 'hotels_v2_seven_arches_content_completion_preflight_v1' contract_version,
  property_state.value property,
  room_state.value rooms,
  evidence.value provenance,
  (to_regprocedure('public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)') is not null
    and public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable())
    as hotels_v2_seven_arches_content_completion_preflight_safe
from property_state cross join room_state cross join evidence;
