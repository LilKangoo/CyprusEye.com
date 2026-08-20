begin;
set transaction isolation level repeatable read;

-- Hotels V2 ADMIN-B: additive Admin content, Room Type and operational
-- assignment control plane.  The legacy Hotel row remains the public source
-- while private/inert instructions live in an RPC-only exact-property table.
-- No public feature flag or architecture value is changed by this migration.

do $admin_b_preconditions$
declare
  v_missing text[];
  v_existing text[];
  v_trigger_definition text;
  v_orphan_scope_ids text;
begin
  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotels','public.hotel_room_types','public.hotel_activity_log',
    'public.hotel_rate_plans','public.hotel_room_rates','public.hotel_bookings',
    'public.partner_service_fulfillments','public.partner_service_fulfillment_form_snapshots',
    'public.partner_resources','public.partner_users','public.partner_user_resources',
    'public.hotel_partner_hotel_permissions','public.site_settings'
  ]::text[]) required(name)
  where to_regclass(name) is null;
  if cardinality(v_missing)>0 then
    raise exception using errcode='42P01',
      message='hotels_v2_admin_b_required_relation_missing',
      detail=array_to_string(v_missing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotel_v2_h2a_require_admin()',
    'public.hotel_v2_h2a_keys_allowed(jsonb,text[])',
    'public.hotel_v2_h2b1_children_policy_valid(text,integer,boolean)',
    'public.hotel_v2_set_updated_at_and_version()',
    'public.hotel_v2_admin_get_property_workspace(uuid)',
    'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)',
    'public.hotel_v2_admin_get_partner_hotel_permissions(uuid)',
    'public.hotel_v2_h3_2a_assignment_fingerprint(uuid)',
    'public.hotel_v2_h3_2a_snapshot_token(uuid)',
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',
    'public.trg_partner_resources_backfill_service_fulfillments()'
  ]::text[]) required(name)
  where to_regprocedure(name) is null;
  if cardinality(v_missing)>0 then
    raise exception using errcode='42883',
      message='hotels_v2_admin_b_required_function_missing',
      detail=array_to_string(v_missing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_existing
  from unnest(array[
    'public.hotel_property_operational_profiles',
    'public.hotel_admin_assignment_transaction_context'
  ]::text[]) expected(name)
  where to_regclass(name) is not null;
  if cardinality(v_existing)>0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_relation_already_exists',
      detail=array_to_string(v_existing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_existing
  from unnest(array[
    'public.hotel_v2_admin_b_i18n_is_valid(jsonb,boolean,integer)',
    'public.hotel_v2_admin_b_string_array_is_valid(jsonb,integer)',
    'public.hotel_v2_admin_b_gallery_is_valid(jsonb,integer)',
    'public.hotel_v2_admin_b_beds_are_valid(jsonb)',
    'public.hotel_v2_admin_b_google_maps_url_is_valid(text)',
    'public.hotel_v2_admin_b_storage_url_is_exact(text,text)',
    'public.hotel_v2_admin_b_property_gallery_is_valid(uuid,jsonb,jsonb)',
    'public.hotel_v2_admin_b_room_gallery_is_valid(uuid,uuid,jsonb,jsonb)',
    'public.hotel_v2_admin_b_validate_stay_bounds(uuid)',
    'public.hotel_v2_admin_b_stay_bounds_constraint_trigger()',
    'public.hotel_v2_admin_b_partner_assignment_lock_trigger()',
    'public.hotel_v2_admin_b_partner_scope_integrity_trigger()',
    'public.hotel_v2_admin_b_membership_scope_reassignment_guard()',
    'public.hotel_v2_admin_get_content_control(uuid)',
    'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)'
    ,'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)'
    ,'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)'
    ,'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)'
  ]::text[]) expected(name)
  where to_regprocedure(name) is not null;
  if cardinality(v_existing)>0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_function_already_exists',
      detail=array_to_string(v_existing,',');
  end if;

  if exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='hotel_room_types'
      and column_name='floor_label_i18n') then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_room_floor_column_already_exists';
  end if;

  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='hotel_bookings'
      and column_name='room_type_id') then
    raise exception using errcode='42703',
      message='hotels_v2_admin_b_booking_room_snapshot_column_missing';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1)
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_public_activation_guard';
  end if;

  if not exists(select 1 from pg_catalog.pg_trigger trigger_row
      where trigger_row.tgrelid='public.partner_resources'::regclass
        and trigger_row.tgname='trg_partner_resources_backfill_service_fulfillments_ins'
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled='O'
        and trigger_row.tgfoid=
          'public.trg_partner_resources_backfill_service_fulfillments()'::regprocedure) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_assignment_backfill_trigger_contract_missing';
  end if;

  select string_agg(scope_row.id::text,',' order by scope_row.id)
  into v_orphan_scope_ids
  from public.partner_user_resources scope_row
  join public.partner_users membership on membership.id=scope_row.partner_user_id
  where scope_row.resource_type='hotels'
    and not exists(
      select 1 from public.partner_resources assignment
      where assignment.partner_id=membership.partner_id
        and assignment.resource_type='hotels'
        and assignment.resource_id=scope_row.resource_id
    );
  if v_orphan_scope_ids is not null then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_orphan_hotel_staff_scopes_require_review',
      detail=v_orphan_scope_ids;
  end if;

  select pg_get_functiondef(
    'public.trg_partner_resources_backfill_service_fulfillments()'::regprocedure
  ) into v_trigger_definition;
  if v_trigger_definition like '%hotels_v2_admin_b_future_assignment_only_v1%'
     or strpos(v_trigger_definition,$needle$  IF NEW.resource_type = 'trips' THEN$needle$)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_assignment_backfill_function_drift';
  end if;
end
$admin_b_preconditions$;

lock table public.site_settings in share mode;
lock table public.hotels in share row exclusive mode;
lock table public.hotel_room_types in share row exclusive mode;
lock table public.partner_resources in share row exclusive mode;
lock table public.partner_user_resources in share row exclusive mode;
lock table public.partner_service_fulfillments in share mode;
lock table public.partner_service_fulfillment_form_snapshots in share mode;

create temporary table hotels_v2_admin_b_protected_before(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

do $admin_b_capture_before$
declare v_relation text;
begin
  foreach v_relation in array array[
    'hotel_bookings','partner_service_fulfillments',
    'partner_service_fulfillment_form_snapshots','service_deposit_requests',
    'service_deposit_rules','service_deposit_overrides','service_coupons',
    'service_coupon_redemptions','hotel_units','hotel_rate_plans',
    'hotel_room_rates','hotel_rate_rules','hotel_daily_inventory',
    'hotel_daily_rates','hotel_room_rate_occupancy_tiers',
    'hotel_calendar_overrides','hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_payment_policies',
    'hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','hotel_activity_log','partner_resources',
    'partner_user_resources','referrals','affiliate_commission_events',
    'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
    'affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases','site_settings'
  ] loop
    if to_regclass('public.'||v_relation) is not null then
      execute format(
        'insert into hotels_v2_admin_b_protected_before '
        ||'select %L,count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
        ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
        v_relation,v_relation
      );
    end if;
  end loop;

  insert into hotels_v2_admin_b_protected_before
  select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) from public.hotels row_value;
  insert into hotels_v2_admin_b_protected_before
  select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) from public.hotel_room_types row_value;
  insert into hotels_v2_admin_b_protected_before
  select 'hotels_rls',count(*),md5(coalesce(string_agg(to_jsonb(policy_row)::text,'|'
    order by to_jsonb(policy_row)::text),''))
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname='public' and policy_row.tablename='hotels';
  insert into hotels_v2_admin_b_protected_before
  values('hotel_amenities_authenticated_acl',1,
    has_table_privilege('authenticated','public.hotel_amenities','SELECT')::text);
  if exists(select 1 from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) then
    insert into hotels_v2_admin_b_protected_before
    select 'h3_1p_snapshot',1,md5(public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)::text);
  end if;
end
$admin_b_capture_before$;

create function public.hotel_v2_admin_b_i18n_is_valid(
  p_value jsonb,
  p_require_english boolean default false,
  p_max_length integer default 4000
)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_value is not null
    and jsonb_typeof(p_value)='object'
    and p_max_length between 1 and 20000
    and not exists(
      select 1 from jsonb_each(p_value) entry
      where entry.key not in('pl','en','he')
         or jsonb_typeof(entry.value)<>'string'
         or length(btrim(entry.value#>>'{}')) not between 1 and p_max_length
    )
    and (not p_require_english or coalesce(length(btrim(p_value->>'en')),0)>0)
$function$;

create function public.hotel_v2_admin_b_string_array_is_valid(
  p_value jsonb,
  p_max_items integer default 200
)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_value is not null
    and jsonb_typeof(p_value)='array'
    and jsonb_array_length(p_value)<=p_max_items
    and not exists(
      select 1 from jsonb_array_elements(p_value) item(value)
      where jsonb_typeof(item.value)<>'string'
         or length(btrim(item.value#>>'{}')) not between 1 and 160
    )
    and (select count(*) from jsonb_array_elements_text(p_value))=
        (select count(distinct value) from jsonb_array_elements_text(p_value))
$function$;

create function public.hotel_v2_admin_b_gallery_is_valid(
  p_value jsonb,
  p_max_items integer default 50
)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_value is not null
    and jsonb_typeof(p_value)='array'
    and jsonb_array_length(p_value)<=p_max_items
    and not exists(
      select 1 from jsonb_array_elements(p_value) item(value)
      where jsonb_typeof(item.value)<>'string'
         or length(btrim(item.value#>>'{}')) not between 1 and 2048
         or item.value#>>'{}' ~ '[[:cntrl:]]'
    )
    and (select count(*) from jsonb_array_elements_text(p_value))=
        (select count(distinct value) from jsonb_array_elements_text(p_value))
$function$;

create function public.hotel_v2_admin_b_beds_are_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog,public
as $function$
declare v_item jsonb; v_quantity integer;
begin
  if p_value is null or jsonb_typeof(p_value)<>'array'
     or jsonb_array_length(p_value)>30 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item)<>'object'
       or not (v_item ?& array['type','quantity'])
       or exists(select 1 from jsonb_object_keys(v_item) key_name
         where key_name not in('type','quantity','label'))
       or jsonb_typeof(v_item->'type')<>'string'
       or jsonb_typeof(v_item->'quantity')<>'number'
       or v_item->>'type' not in('double','single','sofa','bunk','king','queen','other')
       or (v_item?'label' and not public.hotel_v2_admin_b_i18n_is_valid(v_item->'label',false,160)) then
      return false;
    end if;
    if v_item->>'quantity'!~'^[0-9]+$' then return false; end if;
    begin v_quantity:=(v_item->>'quantity')::integer;
    exception when others then return false; end;
    if v_quantity not between 1 and 20 then return false; end if;
  end loop;
  return true;
end
$function$;

create function public.hotel_v2_admin_b_google_maps_url_is_valid(p_url text)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_url is not null
    and length(p_url)<=2048
    and p_url !~ '[[:cntrl:][:space:]]'
    and (
      p_url ~* '^https://maps\.app\.goo\.gl/[^/?#[:space:]][^[:space:]]*$'
      or p_url ~* '^https://goo\.gl/maps(?:[/#?][^[:space:]]*)?$'
      or p_url ~* '^https://(?:www\.)?maps\.google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})(?:/[^[:space:]]*)?$'
      or p_url ~* '^https://(?:www\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})/maps(?:[/#?][^[:space:]]*)?$'
    )
$function$;

revoke all on function public.hotel_v2_admin_b_google_maps_url_is_valid(text)
  from public,anon,authenticated,service_role;

-- Close legacy mutation paths that could bypass ADMIN-B strict Room/property
-- contracts. Keep the generic workspace core available only through a narrow
-- wrapper for unit/rate_plan/room_rate work until ADMIN-C replaces those paths.
alter function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_workspace_plan_admin_b_core;
revoke all on function public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_workspace_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is not null and jsonb_typeof(p_plan)='object'
     and jsonb_typeof(p_plan->'operations')='array'
     and exists(
       select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
       where operation.value->>'entity' in('property','room_type')
     ) then
    raise exception using errcode='42501',
      message='hotels_v2_admin_b_use_control_plane_rpc',
      detail='property=hotel_v2_admin_apply_property_control_plan;room_type=hotel_v2_admin_apply_room_control_plan';
  end if;
  return public.hotel_v2_admin_apply_workspace_plan_admin_b_core(p_plan,p_correlation_id);
end
$function$;

-- Preserve the established create signature, but close its weak H2A nested
-- validation before a new draft can establish unsafe values as grandfathered
-- ADMIN-B content.
alter function public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)
  rename to hotel_v2_admin_create_property_draft_admin_b_core;
revoke all on function public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_create_property_draft(
  p_id uuid,
  p_payload jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_slug text;
  v_photos jsonb;
  v_cover text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_id is null or p_correlation_id is null or p_payload is null
     or jsonb_typeof(p_payload)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_payload,array[
       'slug','title_i18n','description_i18n','city','address_line','district',
       'postal_code','country','latitude','longitude','google_maps_url',
       'google_place_id','amenities','check_in_from','check_out_until','timezone',
       'currency','owner_partner_id','cover_image_url','photos','sort_order'
     ])
     or not (p_payload ?& array[
       'slug','title_i18n','city','country','timezone','currency'
     ])
     or jsonb_typeof(p_payload->'slug')<>'string' then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_draft_payload';
  end if;
  v_slug:=lower(btrim(p_payload->>'slug'));
  v_photos:=coalesce(p_payload->'photos','[]'::jsonb);
  v_cover:=nullif(btrim(p_payload->>'cover_image_url'),'');
  if v_slug!~'^[a-z0-9][a-z0-9-]{0,119}$'
     or nullif(btrim(p_payload->>'city'),'') is null
     or nullif(btrim(p_payload->>'country'),'') is null
     or nullif(btrim(p_payload->>'timezone'),'') is null
     or nullif(btrim(p_payload->>'currency'),'') is null
     or not public.hotel_v2_admin_b_i18n_is_valid(p_payload->'title_i18n',true,240)
     or (p_payload?'description_i18n' and not public.hotel_v2_admin_b_i18n_is_valid(
       p_payload->'description_i18n',false,12000))
     or not public.hotel_v2_admin_b_gallery_is_valid(v_photos,50)
     or exists(select 1 from jsonb_array_elements_text(v_photos) photo(url)
       where not public.hotel_v2_admin_b_storage_url_is_exact(
         photo.url,
         'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/'
           ||v_slug||'/gallery/'
       ))
     or (v_cover is not null and not exists(
       select 1 from jsonb_array_elements_text(v_photos) photo(url) where photo.url=v_cover
     )) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_draft_contract';
  end if;
  if exists(
    select 1 from jsonb_each(p_payload) entry
    where (entry.key in('city','address_line','district','postal_code','country',
             'google_maps_url','google_place_id','check_in_from','check_out_until',
             'timezone','currency','owner_partner_id','cover_image_url')
           and jsonb_typeof(entry.value) not in('string','null'))
       or (entry.key in('latitude','longitude','sort_order')
           and jsonb_typeof(entry.value) not in('number','string','null'))
  ) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_draft_scalar_type';
  end if;
  if (p_payload?'city' and length(coalesce(p_payload->>'city',''))>200)
     or (p_payload?'address_line' and length(coalesce(p_payload->>'address_line',''))>500)
     or (p_payload?'district' and length(coalesce(p_payload->>'district',''))>200)
     or (p_payload?'postal_code' and length(coalesce(p_payload->>'postal_code',''))>40)
     or (p_payload?'country' and length(coalesce(p_payload->>'country',''))>100)
     or (p_payload?'google_maps_url' and length(coalesce(p_payload->>'google_maps_url',''))>2048)
     or (p_payload?'google_place_id' and length(coalesce(p_payload->>'google_place_id',''))>300)
     or (p_payload?'timezone' and length(coalesce(p_payload->>'timezone',''))>100) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_property_draft_scalar_too_long';
  end if;
  if p_payload?'amenities' and (
       not public.hotel_v2_admin_b_string_array_is_valid(p_payload->'amenities',200)
       or exists(select 1 from jsonb_array_elements_text(p_payload->'amenities') requested(code)
         where not exists(select 1 from public.hotel_amenities amenity
           where amenity.code=requested.code and amenity.is_active))
     ) then
    raise exception using errcode='23503',
      message='hotels_v2_admin_b_unknown_property_draft_amenity';
  end if;
  if p_payload?'latitude' and p_payload->>'latitude' is not null and (
       p_payload->>'latitude'!~'^-?[0-9]+(?:\.[0-9]+)?$'
       or (p_payload->>'latitude')::numeric not between -90 and 90)
     or p_payload?'longitude' and p_payload->>'longitude' is not null and (
       p_payload->>'longitude'!~'^-?[0-9]+(?:\.[0-9]+)?$'
       or (p_payload->>'longitude')::numeric not between -180 and 180) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_coordinates';
  end if;
  if p_payload?'google_maps_url' and p_payload->>'google_maps_url' is not null
     and not public.hotel_v2_admin_b_google_maps_url_is_valid(
       p_payload->>'google_maps_url') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_maps_url';
  end if;
  if p_payload?'check_in_from' and p_payload->>'check_in_from' is not null
     and p_payload->>'check_in_from'!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'
     or p_payload?'check_out_until' and p_payload->>'check_out_until' is not null
     and p_payload->>'check_out_until'!~'^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_time';
  end if;
  if p_payload?'timezone' and p_payload->>'timezone' is not null
     and not exists(select 1 from pg_catalog.pg_timezone_names zone
       where zone.name=p_payload->>'timezone') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_timezone';
  end if;
  if p_payload?'currency' and p_payload->>'currency' is not null
     and upper(btrim(p_payload->>'currency'))!~'^[A-Z]{3}$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_currency';
  end if;
  if p_payload?'sort_order' and p_payload->>'sort_order' is not null
     and (p_payload->>'sort_order'!~'^[0-9]+$'
       or (p_payload->>'sort_order')::integer not between 0 and 1000000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_sort_order';
  end if;
  if p_payload?'owner_partner_id' and p_payload->>'owner_partner_id' is not null then
    begin
      perform 1 from public.partners partner
      where partner.id=(p_payload->>'owner_partner_id')::uuid
        and partner.status='active' and partner.can_manage_hotels;
      if not found then
        raise exception using errcode='23514',message='hotels_v2_admin_b_property_draft_owner_not_eligible';
      end if;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_owner';
    end;
  end if;
  -- Hold the singleton activation row stable through the delegated H2A insert.
  -- This prevents a concurrent activation from crossing the flags-OFF check.
  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_public_activation_guard';
  end if;
  return public.hotel_v2_admin_create_property_draft_admin_b_core(
    p_id,p_payload,p_correlation_id
  );
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_draft_value';
end
$function$;

revoke all on function public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
comment on function public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid) is
  'ADMIN-B retired browser mutation path. Use hotel_v2_admin_apply_room_control_plan; the preserved function is private for historical migration compatibility only.';

-- The accepted guest-policy RPC remains the sole property child-policy writer.
-- Room capacity cannot be smuggled through it after ADMIN-B; Room structural
-- changes use the exact ADMIN-B Room control contract.
alter function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_guest_policy_plan_admin_b_core;
revoke all on function public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_guest_policy_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid;
  v_expected_updated_at timestamptz;
  v_reviewed_at timestamptz;
  v_hotel public.hotels%rowtype;
  v_property_policy jsonb;
  v_room_policy jsonb;
  v_room public.hotel_room_types%rowtype;
  v_property_children_policy text;
  v_property_child_age smallint;
  v_room_children_policy text;
  v_room_child_age smallint;
  v_before jsonb;
  v_after jsonb;
  v_property_changed boolean:=false;
  v_room_changed_count integer:=0;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','expected_property_updated_at','reviewed_at',
       'property_policy','room_policies'
     ])
     or not (p_plan ?& array['hotel_id','expected_property_updated_at','reviewed_at'])
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'expected_property_updated_at')<>'string'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or (not (p_plan?'property_policy') and not (p_plan?'room_policies')) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_guest_policy_plan';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_expected_updated_at:=(p_plan->>'expected_property_updated_at')::timestamptz;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_guest_policy_identifiers';
  end;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_guest_policy_review_expired';
  end if;
  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_public_activation_guard';
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_property_not_found'; end if;
  if v_hotel.updated_at is distinct from v_expected_updated_at then
    raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_guest_policy_property';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_admin_b_correlation_id_already_used';
  end if;

  if p_plan?'property_policy' then
    v_property_policy:=p_plan->'property_policy';
    if jsonb_typeof(v_property_policy)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_property_policy,array[
         'children_policy','minimum_child_age'
       ])
       or not (v_property_policy ?& array['children_policy','minimum_child_age'])
       or jsonb_typeof(v_property_policy->'children_policy')<>'string'
       or jsonb_typeof(v_property_policy->'minimum_child_age') not in('number','null')
       or (jsonb_typeof(v_property_policy->'minimum_child_age')<>'null'
         and v_property_policy->>'minimum_child_age'!~'^[0-9]+$') then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_guest_policy';
    end if;
    begin
      v_property_children_policy:=v_property_policy->>'children_policy';
      v_property_child_age:=case when v_property_policy->>'minimum_child_age' is null
        then null else (v_property_policy->>'minimum_child_age')::smallint end;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_guest_policy';
    end;
    if not public.hotel_v2_h2b1_children_policy_valid(
         v_property_children_policy,v_property_child_age,false) then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_guest_policy';
    end if;
  end if;

  if p_plan?'room_policies' then
    if jsonb_typeof(p_plan->'room_policies')<>'array'
       or jsonb_array_length(p_plan->'room_policies')>100
       or exists(select 1 from jsonb_array_elements(p_plan->'room_policies') item
         group by item->>'room_type_id' having count(*)>1) then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_guest_policy_array';
    end if;
    for v_room_policy in
      select value from jsonb_array_elements(p_plan->'room_policies')
      order by value->>'room_type_id'
    loop
      if jsonb_typeof(v_room_policy)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(v_room_policy,array[
           'room_type_id','expected_version','children_policy_override',
           'minimum_child_age_override'
         ])
         or not (v_room_policy ?& array[
           'room_type_id','expected_version','children_policy_override',
           'minimum_child_age_override'
         ])
         or jsonb_typeof(v_room_policy->'room_type_id')<>'string'
         or jsonb_typeof(v_room_policy->'expected_version')<>'number'
         or jsonb_typeof(v_room_policy->'children_policy_override') not in('string','null')
         or jsonb_typeof(v_room_policy->'minimum_child_age_override') not in('number','null')
         or v_room_policy->>'expected_version'!~'^[1-9][0-9]*$'
         or (jsonb_typeof(v_room_policy->'minimum_child_age_override')<>'null'
           and v_room_policy->>'minimum_child_age_override'!~'^[0-9]+$') then
        raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_guest_policy';
      end if;
      begin
        v_room_children_policy:=nullif(v_room_policy->>'children_policy_override','');
        v_room_child_age:=case when v_room_policy->>'minimum_child_age_override' is null
          then null else (v_room_policy->>'minimum_child_age_override')::smallint end;
        select * into v_room from public.hotel_room_types
        where id=(v_room_policy->>'room_type_id')::uuid and hotel_id=v_hotel_id
        for update;
      exception when others then
        raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_guest_policy';
      end;
      if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_room_not_found'; end if;
      if v_room.version<>(v_room_policy->>'expected_version')::bigint then
        raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_room_guest_policy';
      end if;
      if not public.hotel_v2_h2b1_children_policy_valid(
           v_room_children_policy,v_room_child_age,true) then
        raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_guest_policy';
      end if;
    end loop;
  end if;

  if p_plan?'property_policy' and (
       v_hotel.children_policy is distinct from v_property_children_policy
       or v_hotel.minimum_child_age is distinct from v_property_child_age
     ) then
    v_before:=to_jsonb(v_hotel);
    update public.hotels hotel set
      children_policy=v_property_children_policy,
      minimum_child_age=v_property_child_age
    where hotel.id=v_hotel_id and hotel.updated_at=v_expected_updated_at
    returning to_jsonb(hotel.*) into v_after;
    if v_after is null then raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_guest_policy_property'; end if;
    insert into public.hotel_activity_log(
      hotel_id,entity_type,entity_id,action,before_state,after_state,
      actor_type,actor_id,source,correlation_id
    ) values(
      v_hotel_id,'property',v_hotel_id,'update',v_before,v_after,
      'admin',auth.uid(),'hotels_v2_admin_b_guest_policy',p_correlation_id
    );
    v_property_changed:=true;
  end if;
  if p_plan?'room_policies' then
    for v_room_policy in
      select value from jsonb_array_elements(p_plan->'room_policies')
      order by value->>'room_type_id'
    loop
      select * into strict v_room from public.hotel_room_types
      where id=(v_room_policy->>'room_type_id')::uuid and hotel_id=v_hotel_id;
      v_room_children_policy:=nullif(v_room_policy->>'children_policy_override','');
      v_room_child_age:=case when v_room_policy->>'minimum_child_age_override' is null
        then null else (v_room_policy->>'minimum_child_age_override')::smallint end;
      if v_room.children_policy_override is distinct from v_room_children_policy
         or v_room.minimum_child_age_override is distinct from v_room_child_age then
        v_before:=to_jsonb(v_room);
        update public.hotel_room_types room set
          children_policy_override=v_room_children_policy,
          minimum_child_age_override=v_room_child_age
        where room.id=v_room.id
          and room.hotel_id=v_hotel_id
          and room.version=(v_room_policy->>'expected_version')::bigint
        returning to_jsonb(room.*) into v_after;
        if v_after is null then raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_room_guest_policy'; end if;
        insert into public.hotel_activity_log(
          hotel_id,entity_type,entity_id,action,before_state,after_state,
          actor_type,actor_id,source,correlation_id
        ) values(
          v_hotel_id,'room_type',v_room.id,'update',v_before,v_after,
          'admin',auth.uid(),'hotels_v2_admin_b_guest_policy',p_correlation_id
        );
        v_room_changed_count:=v_room_changed_count+1;
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'correlation_id',p_correlation_id,
    'property_changed',v_property_changed,
    'updated_room_policy_count',v_room_changed_count,
    'workspace',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'activity',(select coalesce(jsonb_agg(to_jsonb(activity)
      order by activity.created_at,activity.id),'[]'::jsonb)
      from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id)
  );
end
$function$;

alter table public.hotel_room_types
  add column floor_label_i18n jsonb not null default '{}'::jsonb,
  add constraint hotel_room_types_admin_b_floor_label_check
    check(public.hotel_v2_admin_b_i18n_is_valid(floor_label_i18n,false,160));

comment on column public.hotel_room_types.floor_label_i18n is
  'Optional localized Room Type floor label. Balcony and terrace remain exact amenity codes; sofa beds remain bed_configuration entries.';

create function public.hotel_v2_admin_apply_room_control_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_contract constant text:='hotels_v2_admin_b_room_control_v1';
  v_hotel_id uuid;
  v_expected_property_updated_at timestamptz;
  v_reviewed_at timestamptz;
  v_operation jsonb;
  v_action text;
  v_room_id uuid;
  v_source_id uuid;
  v_expected_version bigint;
  v_original jsonb;
  v_payload jsonb;
  v_hotel public.hotels%rowtype;
  v_room public.hotel_room_types%rowtype;
  v_source public.hotel_room_types%rowtype;
  v_target public.hotel_room_types%rowtype;
  v_target_exists boolean;
  v_key text;
  v_current_value jsonb;
  v_target_value jsonb;
  v_conflicts text[]:='{}'::text[];
  v_changed_fields text[]:='{}'::text[];
  v_capacity_group_count integer;
  v_child_group_count integer;
  v_amenity text;
  v_dependency jsonb;
  v_before jsonb;
  v_after jsonb;
  v_semantic_before jsonb;
  v_semantic_target jsonb;
  v_changed boolean:=false;
  v_activity jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','expected_property_updated_at','reviewed_at','operation'
     ])
     or not (p_plan ?& array[
       'contract_version','hotel_id','expected_property_updated_at','reviewed_at','operation'
     ])
     or jsonb_typeof(p_plan->'contract_version')<>'string'
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'expected_property_updated_at')<>'string'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or p_plan->>'contract_version'<>c_contract
     or jsonb_typeof(p_plan->'operation')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_plan';
  end if;
  v_operation:=p_plan->'operation';
  if not public.hotel_v2_h2a_keys_allowed(v_operation,array[
       'type','id','expected_version','expected_original','payload'
     ])
     or not (v_operation ?& array[
       'type','id','expected_version','expected_original','payload'
     ])
     or jsonb_typeof(v_operation->'type')<>'string'
     or jsonb_typeof(v_operation->'id')<>'string'
     or jsonb_typeof(v_operation->'expected_version')<>'number'
     or jsonb_typeof(v_operation->'expected_original')<>'object'
     or jsonb_typeof(v_operation->'payload')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_operation';
  end if;
  if v_operation->>'expected_version'!~'^[0-9]+$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_expected_version';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_expected_property_updated_at:=(p_plan->>'expected_property_updated_at')::timestamptz;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
    v_action:=v_operation->>'type';
    v_room_id:=(v_operation->>'id')::uuid;
    v_expected_version:=(v_operation->>'expected_version')::bigint;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_identifiers';
  end;
  if v_action not in('create','update','duplicate','disable') or v_expected_version<0
     or v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_review_expired';
  end if;
  v_original:=v_operation->'expected_original';
  v_payload:=v_operation->'payload';
  if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
       'source_id','code','name_i18n','description_i18n','gallery',
       'capacity_adults','capacity_children','max_occupancy',
       'children_policy_override','minimum_child_age_override','bed_configuration',
       'bathrooms','size_sqm','amenities','inventory_mode','base_inventory_count',
       'status','sort_order','floor_label_i18n'
     ]) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_payload';
  end if;
  if v_action='update' and (
       not exists(select 1 from jsonb_object_keys(v_payload))
       or exists((select key from jsonb_object_keys(v_payload) key)
         except (select key from jsonb_object_keys(v_original) key))
       or exists((select key from jsonb_object_keys(v_original) key)
         except (select key from jsonb_object_keys(v_payload) key))
     ) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_original_key_mismatch';
  elsif v_action in('create','duplicate') and v_original<>'{}'::jsonb then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_original_must_be_empty';
  elsif v_action='disable' and (
       v_payload<>'{}'::jsonb
       or not (v_original ? 'status')
       or (select count(*) from jsonb_object_keys(v_original))<>1
     ) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_disable_review';
  end if;
  if (v_action='duplicate') is distinct from (v_payload?'source_id') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_source_contract_mismatch';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_public_activation_guard';
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for share;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_property_not_found'; end if;
  select * into v_room from public.hotel_room_types
  where id=v_room_id and hotel_id=v_hotel_id for update;
  v_target_exists:=found;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_admin_b_correlation_id_already_used';
  end if;

  if v_action='create' then
    if v_target_exists or v_expected_version<>0
       or v_original<>'{}'::jsonb
       or not (v_payload ?& array[
         'code','name_i18n','bed_configuration','amenities','inventory_mode',
         'base_inventory_count','capacity_adults','capacity_children','max_occupancy'
       ]) then
      raise exception using errcode='23514',message='hotels_v2_admin_b_invalid_room_create';
    end if;
  elsif v_action='duplicate' then
    if v_target_exists or v_expected_version<1 or not (v_payload ? 'code') then
      raise exception using errcode='23514',message='hotels_v2_admin_b_invalid_room_duplicate';
    end if;
    begin v_source_id:=(v_payload->>'source_id')::uuid;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_source_id';
    end;
    if v_source_id=v_room_id then
      raise exception using errcode='23514',message='hotels_v2_admin_b_duplicate_target_matches_source';
    end if;
    select * into v_source from public.hotel_room_types
    where id=v_source_id and hotel_id=v_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_room_source_not_found'; end if;
    if v_source.version<>v_expected_version then
      raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_room_source',
        detail=jsonb_build_object(
          'reason','stale_version','changed_fields','[]'::jsonb,
          'expected_version',v_expected_version,'current_version',v_source.version
        )::text,
        hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
    end if;
  else
    if not v_target_exists then raise exception using errcode='PT404',message='hotels_v2_admin_b_room_not_found'; end if;
    if v_room.version<>v_expected_version then
      if v_action='disable' then
        if to_jsonb(v_room.status) is distinct from v_original->'status'
           and v_room.status<>'disabled' then
          v_conflicts:=array['status'];
        end if;
      else
        for v_key in select key from jsonb_object_keys(v_payload) key loop
          v_current_value:=to_jsonb(v_room)->v_key;
          v_target_value:=v_payload->v_key;
          if v_key='amenities' then
            v_current_value:=coalesce((select jsonb_agg(code order by code)
              from unnest(v_room.amenities) code),'[]'::jsonb);
            v_target_value:=coalesce((select jsonb_agg(code order by code)
              from jsonb_array_elements_text(v_payload->'amenities') code),'[]'::jsonb);
          end if;
          if v_current_value is distinct from v_original->v_key
             and v_current_value is distinct from v_target_value then
            v_conflicts:=array_append(v_conflicts,v_key);
          end if;
        end loop;
      end if;
      raise exception using errcode='PT409',
        message=case when cardinality(v_conflicts)>0
          then 'hotels_v2_admin_b_room_field_conflict'
          else 'hotels_v2_admin_b_stale_room_review' end,
        detail=jsonb_build_object(
          'reason',case when cardinality(v_conflicts)>0
            then 'reviewed_field_changed' else 'stale_version_non_overlapping' end,
          'changed_fields',to_jsonb(v_conflicts),
          'expected_version',v_expected_version,'current_version',v_room.version
        )::text,
        hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
    end if;
  end if;

  -- If a reviewed property changed, only a Room edit that introduces a
  -- property-scoped media reference depends on that stale property snapshot.
  -- Existing exact Room media and a freshly uploaded exact target path remain
  -- independent from unrelated property content edits.
  if v_hotel.updated_at is distinct from v_expected_property_updated_at
     and v_payload?'gallery'
     and exists(
       select 1 from jsonb_array_elements_text(v_payload->'gallery') proposed(url)
       where not exists(
         select 1 from jsonb_array_elements_text(
           case when v_action='update' then coalesce(v_room.gallery,'[]'::jsonb)
                else '[]'::jsonb end
         ) current_photo(url) where current_photo.url=proposed.url
       )
       and not public.hotel_v2_admin_b_storage_url_is_exact(
         proposed.url,
         'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/'
           ||v_hotel.slug||'/rooms/'||v_room_id::text||'/'
       )
     ) then
    raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_property_media_review',
      detail=jsonb_build_object(
        'reason','property_media_snapshot_changed',
        'expected_property_updated_at',v_expected_property_updated_at,
        'current_property_updated_at',v_hotel.updated_at,
        'changed_fields',jsonb_build_array('gallery')
      )::text,
      hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
  end if;

  -- Scalar and structured payload validation is strict and null-aware.
  if exists(
    select 1 from jsonb_each(v_payload) entry
    where (entry.key in('source_id','code','inventory_mode','status','children_policy_override')
           and jsonb_typeof(entry.value) not in('string','null'))
       or (entry.key in('capacity_adults','capacity_children','max_occupancy',
             'minimum_child_age_override','bathrooms','size_sqm','base_inventory_count','sort_order')
           and jsonb_typeof(entry.value) not in('number','string','null'))
  ) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_scalar_type';
  end if;
  if exists(
    select 1 from jsonb_each(v_payload) entry
    where entry.key in(
      'capacity_adults','capacity_children','max_occupancy',
      'minimum_child_age_override','base_inventory_count','sort_order'
    )
      and jsonb_typeof(entry.value)<>'null'
      and entry.value#>>'{}'!~'^[0-9]+$'
  ) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_integer_value';
  end if;
  if v_payload?'code' and (
       v_payload->>'code' is null
       or lower(btrim(v_payload->>'code'))!~'^[a-z0-9][a-z0-9_-]{0,79}$'
     ) then raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_code'; end if;
  if v_payload?'name_i18n' and not public.hotel_v2_admin_b_i18n_is_valid(
       v_payload->'name_i18n',true,240) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_name';
  end if;
  if v_payload?'description_i18n' and not public.hotel_v2_admin_b_i18n_is_valid(
       v_payload->'description_i18n',false,12000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_description';
  end if;
  if v_payload?'floor_label_i18n' and not public.hotel_v2_admin_b_i18n_is_valid(
       v_payload->'floor_label_i18n',false,160) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_floor';
  end if;
  if v_payload?'bed_configuration' and not public.hotel_v2_admin_b_beds_are_valid(
       v_payload->'bed_configuration') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_beds';
  end if;
  if v_payload?'amenities' and (
       not public.hotel_v2_admin_b_string_array_is_valid(v_payload->'amenities',200)
       or exists(select 1 from jsonb_array_elements_text(v_payload->'amenities') requested(code)
         where not (
           v_action in('update','disable') and requested.code=any(v_room.amenities)
         )
           and not (
             v_action='duplicate' and requested.code=any(v_source.amenities)
           )
           and not exists(select 1 from public.hotel_amenities amenity
             where amenity.code=requested.code and amenity.is_active))
     ) then
    raise exception using errcode='23503',message='hotels_v2_admin_b_unknown_room_amenity';
  end if;
  if v_payload?'gallery' and not public.hotel_v2_admin_b_room_gallery_is_valid(
       v_hotel_id,v_room_id,v_payload->'gallery',
       case when v_action='update' then coalesce(v_room.gallery,'[]'::jsonb)
            else '[]'::jsonb end) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_gallery';
  end if;

  v_capacity_group_count:=
    (case when v_payload?'capacity_adults' then 1 else 0 end)+
    (case when v_payload?'capacity_children' then 1 else 0 end)+
    (case when v_payload?'max_occupancy' then 1 else 0 end);
  if v_capacity_group_count not in(0,3) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_capacity_group_required';
  end if;
  v_child_group_count:=
    (case when v_payload?'children_policy_override' then 1 else 0 end)+
    (case when v_payload?'minimum_child_age_override' then 1 else 0 end);
  if v_child_group_count not in(0,2) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_room_child_override_group_required';
  end if;

  if v_action='duplicate' then
    v_target:=v_source;
    v_target.id:=v_room_id;
    v_target.hotel_id:=v_hotel_id;
    v_target.gallery:='[]'::jsonb;
    v_target.status:='draft';
    v_target.inventory_mode:='pooled';
    v_target.base_inventory_count:=0;
    v_target.legacy_source_key:=null;
  elsif v_action='update' or v_action='disable' then
    v_target:=v_room;
  else
    v_target.id:=v_room_id;
    v_target.hotel_id:=v_hotel_id;
    v_target.description_i18n:='{}'::jsonb;
    v_target.gallery:='[]'::jsonb;
    v_target.bed_configuration:='[]'::jsonb;
    v_target.amenities:='{}'::text[];
    v_target.status:='draft';
    v_target.sort_order:=1000;
    v_target.floor_label_i18n:='{}'::jsonb;
    v_target.legacy_source_key:=null;
  end if;

  if v_action='disable' then
    v_target.status:='disabled';
  else
    if v_payload?'code' then v_target.code:=lower(btrim(v_payload->>'code')); end if;
    if v_payload?'name_i18n' then v_target.name_i18n:=v_payload->'name_i18n'; end if;
    if v_payload?'description_i18n' then v_target.description_i18n:=v_payload->'description_i18n'; end if;
    if v_payload?'gallery' then v_target.gallery:=v_payload->'gallery'; end if;
    if v_payload?'bed_configuration' then v_target.bed_configuration:=v_payload->'bed_configuration'; end if;
    if v_payload?'amenities' then
      v_target.amenities:=array(select jsonb_array_elements_text(v_payload->'amenities'));
    end if;
    if v_payload?'floor_label_i18n' then v_target.floor_label_i18n:=v_payload->'floor_label_i18n'; end if;
    if v_payload?'capacity_adults' then
      v_target.capacity_adults:=case when v_payload->>'capacity_adults' is null then null
        else (v_payload->>'capacity_adults')::smallint end;
      v_target.capacity_children:=case when v_payload->>'capacity_children' is null then null
        else (v_payload->>'capacity_children')::smallint end;
      v_target.max_occupancy:=case when v_payload->>'max_occupancy' is null then null
        else (v_payload->>'max_occupancy')::smallint end;
    end if;
    if v_payload?'children_policy_override' then
      v_target.children_policy_override:=nullif(v_payload->>'children_policy_override','');
      v_target.minimum_child_age_override:=case
        when v_payload->>'minimum_child_age_override' is null then null
        else (v_payload->>'minimum_child_age_override')::smallint end;
    end if;
    if v_payload?'bathrooms' then v_target.bathrooms:=case when v_payload->>'bathrooms' is null
      then null else (v_payload->>'bathrooms')::numeric end; end if;
    if v_payload?'size_sqm' then v_target.size_sqm:=case when v_payload->>'size_sqm' is null
      then null else (v_payload->>'size_sqm')::numeric end; end if;
    if v_payload?'inventory_mode' then v_target.inventory_mode:=v_payload->>'inventory_mode'; end if;
    if v_payload?'base_inventory_count' then v_target.base_inventory_count:=(v_payload->>'base_inventory_count')::integer; end if;
    if v_payload?'status' then v_target.status:=v_payload->>'status'; end if;
    if v_payload?'sort_order' then v_target.sort_order:=(v_payload->>'sort_order')::integer; end if;
  end if;

  if v_target.code is null or v_target.name_i18n is null
     or not coalesce(((v_target.max_occupancy between 1 and 50
              and v_target.capacity_adults is null and v_target.capacity_children is null)
          or (v_target.max_occupancy is null
              and v_target.capacity_adults between 1 and 50
              and v_target.capacity_children between 0 and 50)),false) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_capacity';
  end if;
  if not public.hotel_v2_h2b1_children_policy_valid(
       v_target.children_policy_override,v_target.minimum_child_age_override,true) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_children_policy';
  end if;
  if v_target.inventory_mode is null
     or v_target.inventory_mode not in('pooled','unitized')
     or v_target.base_inventory_count is null
     or v_target.base_inventory_count not between 0 and 10000
     or v_target.sort_order is null
     or v_target.sort_order not between 0 and 1000000
     or v_target.status is null
     or v_target.status not in('draft','active','disabled')
     or (v_action in('create','duplicate') and v_target.status<>'draft')
     or (v_action='update' and v_target.status='disabled')
     or v_target.bathrooms is not null and v_target.bathrooms not between 0 and 100
     or v_target.size_sqm is not null and v_target.size_sqm not between 0.01 and 100000 then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_operational_values';
  end if;
  if v_action='duplicate' and (
       v_target.inventory_mode<>'pooled' or v_target.base_inventory_count<>0
     ) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_duplicate_inventory_must_be_inert';
  end if;
  if exists(select 1 from public.hotel_room_types other
    where other.hotel_id=v_hotel_id and lower(other.code)=lower(v_target.code)
      and other.id<>v_room_id) then
    raise exception using errcode='23505',message='hotels_v2_admin_b_room_code_already_exists';
  end if;
  if v_action='update' and v_target.inventory_mode<>v_room.inventory_mode and (
       exists(select 1 from public.hotel_daily_inventory inventory
         where inventory.room_type_id=v_room_id)
       or exists(select 1 from public.hotel_units unit_row
         where unit_row.room_type_id=v_room_id)
     ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_b_inventory_mode_change_requires_empty_state';
  end if;

  if v_target_exists and v_target.status<>'active'
     and v_target.status is distinct from v_room.status then
    perform 1 from public.hotel_room_rates rate
      where rate.room_type_id=v_room_id order by rate.id for update;
    perform 1 from public.hotel_room_allocation_rule_items item
      where item.room_type_id=v_room_id order by item.id for update;
    perform 1 from public.hotel_room_allocation_rules rule
      where exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=rule.id and item.room_type_id=v_room_id)
      order by rule.id for update;
    perform 1 from public.hotel_units unit_row
      where unit_row.room_type_id=v_room_id order by unit_row.id for update;
    perform 1 from public.hotel_daily_inventory inventory
      where inventory.room_type_id=v_room_id order by inventory.stay_date for update;
    perform 1 from public.hotel_calendar_overrides override_row
      where exists(select 1 from public.hotel_room_rates rate
        where rate.id=override_row.room_rate_id and rate.room_type_id=v_room_id)
      order by override_row.id for update;
    perform 1 from public.hotel_bookings booking
      where booking.hotel_id=v_hotel_id and booking.room_type_id=v_room_id::text
      order by booking.id for update;
    v_dependency:=jsonb_build_object(
      'active_room_rates',(select count(*) from public.hotel_room_rates rate
        where rate.room_type_id=v_room_id and rate.hotel_id=v_hotel_id and rate.is_active),
      'active_or_reviewed_allocations',(select count(distinct rule.id)
        from public.hotel_room_allocation_rule_items item
        join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
        where item.room_type_id=v_room_id and item.hotel_id=v_hotel_id
          and (rule.is_active or rule.review_status='reviewed')),
      'live_units',(select count(*) from public.hotel_units unit_row
        where unit_row.room_type_id=v_room_id and unit_row.status<>'disabled'),
      'future_inventory',(select count(*) from public.hotel_daily_inventory inventory
        where inventory.room_type_id=v_room_id and inventory.stay_date>=current_date),
      'active_calendar_overrides',(select count(*) from public.hotel_calendar_overrides override_row
        join public.hotel_room_rates rate on rate.id=override_row.room_rate_id
        where rate.room_type_id=v_room_id and override_row.is_active
          and override_row.stay_date>=current_date),
      -- Only exact normalized UUID snapshots participate. Legacy labels and
      -- historical bookings without an exact UUID are deliberately untouched.
      'future_booking_snapshots',(select count(*) from public.hotel_bookings booking
        where booking.hotel_id=v_hotel_id and booking.room_type_id=v_room_id::text
          and booking.status in('pending','confirmed') and booking.departure_date>=current_date)
    );
    if exists(select 1 from jsonb_each_text(v_dependency) count_row
      where count_row.value::bigint>0) then
      raise exception using errcode='PT409',
        message='hotels_v2_admin_b_room_disable_has_live_dependencies',
        detail=jsonb_build_object('room_type_id',v_room_id,'dependencies',v_dependency)::text,
        hint='Review and resolve the exact live dependencies before disabling this Room Type.';
    end if;
  end if;

  if v_target_exists then
    v_semantic_before:=jsonb_set(
      to_jsonb(v_room)-array['version','updated_at','created_at'],
      '{amenities}',coalesce((select jsonb_agg(code order by code)
        from unnest(v_room.amenities) code),'[]'::jsonb),true
    );
    v_semantic_target:=jsonb_set(
      to_jsonb(v_target)-array['version','updated_at','created_at'],
      '{amenities}',coalesce((select jsonb_agg(code order by code)
        from unnest(v_target.amenities) code),'[]'::jsonb),true
    );
  end if;
  if v_action='update' and v_semantic_target is not distinct from v_semantic_before then
    v_changed:=false;
    v_after:=to_jsonb(v_room);
  elsif v_action='disable' and v_room.status='disabled' then
    v_changed:=false;
    v_after:=to_jsonb(v_room);
  elsif v_action in('create','duplicate') then
    v_before:=case when v_action='duplicate' then to_jsonb(v_source) else null end;
    insert into public.hotel_room_types(
      id,hotel_id,code,name_i18n,description_i18n,gallery,
      capacity_adults,capacity_children,max_occupancy,
      children_policy_override,minimum_child_age_override,bed_configuration,
      bathrooms,size_sqm,amenities,inventory_mode,base_inventory_count,status,
      sort_order,legacy_source_key,floor_label_i18n
    ) values(
      v_room_id,v_hotel_id,v_target.code,v_target.name_i18n,v_target.description_i18n,
      v_target.gallery,v_target.capacity_adults,v_target.capacity_children,
      v_target.max_occupancy,v_target.children_policy_override,
      v_target.minimum_child_age_override,v_target.bed_configuration,
      v_target.bathrooms,v_target.size_sqm,v_target.amenities,
      v_target.inventory_mode,v_target.base_inventory_count,'draft',
      v_target.sort_order,null,v_target.floor_label_i18n
    ) returning to_jsonb(hotel_room_types.*) into v_after;
    v_changed:=true;
  else
    v_before:=to_jsonb(v_room);
    update public.hotel_room_types room set
      code=v_target.code,name_i18n=v_target.name_i18n,
      description_i18n=v_target.description_i18n,gallery=v_target.gallery,
      capacity_adults=v_target.capacity_adults,capacity_children=v_target.capacity_children,
      max_occupancy=v_target.max_occupancy,
      children_policy_override=v_target.children_policy_override,
      minimum_child_age_override=v_target.minimum_child_age_override,
      bed_configuration=v_target.bed_configuration,bathrooms=v_target.bathrooms,
      size_sqm=v_target.size_sqm,amenities=v_target.amenities,
      inventory_mode=v_target.inventory_mode,
      base_inventory_count=v_target.base_inventory_count,status=v_target.status,
      sort_order=v_target.sort_order,floor_label_i18n=v_target.floor_label_i18n
    where room.id=v_room_id and room.hotel_id=v_hotel_id and room.version=v_expected_version
    returning to_jsonb(room.*) into v_after;
    if v_after is null then
      raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_room_during_apply';
    end if;
    v_changed:=true;
  end if;

  if v_changed then
    if v_action='update' then
      select coalesce(array_agg(key order by key),'{}'::text[]) into v_changed_fields
      from jsonb_object_keys(v_payload) key;
    elsif v_action='disable' then v_changed_fields:=array['status'];
    else
      select coalesce(array_agg(key order by key),'{}'::text[]) into v_changed_fields
      from jsonb_object_keys(v_payload-'source_id') key;
    end if;
    insert into public.hotel_activity_log(
      hotel_id,entity_type,entity_id,action,before_state,after_state,
      actor_type,actor_id,source,correlation_id
    ) values(
      v_hotel_id,'room_type',v_room_id,v_action,v_before,v_after,
      'admin',auth.uid(),'hotels_v2_admin_b_room_control',p_correlation_id
    );
  end if;
  select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
  into v_activity from public.hotel_activity_log activity
  where activity.correlation_id=p_correlation_id;
  return jsonb_build_object(
    'ok',true,'contract_version',c_contract,'hotel_id',v_hotel_id,
    'room_type_id',v_room_id,'changed',v_changed,
    'changed_fields',to_jsonb(v_changed_fields),'merged_fields','[]'::jsonb,
    'correlation_id',p_correlation_id,
    'workspace',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'activity',v_activity
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_room_numeric_value';
end
$function$;

create function public.hotel_v2_admin_b_storage_url_is_exact(
  p_url text,
  p_prefix text
)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_url is not null
    and p_prefix is not null
    and left(p_url,length(p_prefix))=p_prefix
    and substring(p_url from length(p_prefix)+1)
      ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,200}\.(webp|jpg|jpeg|png|avif)$'
    and strpos(substring(p_url from length(p_prefix)+1),'..')=0
$function$;

create function public.hotel_v2_admin_b_room_gallery_is_valid(
  p_hotel_id uuid,
  p_room_id uuid,
  p_proposed jsonb,
  p_current jsonb default '[]'::jsonb
)
returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select public.hotel_v2_admin_b_gallery_is_valid(p_proposed,50)
    and exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id)
    and not exists(
      select 1
      from jsonb_array_elements_text(p_proposed) proposed(url)
      cross join public.hotels hotel
      where hotel.id=p_hotel_id
        and not (
          exists(select 1 from jsonb_array_elements_text(coalesce(p_current,'[]'::jsonb)) current(url)
            where current.url=proposed.url)
          -- Exact current property media is an authoritative relationship,
          -- including grandfathered legacy relative URLs used by 7 Kamares.
          -- Arbitrary newly supplied relative/HTTP values still fail because
          -- they match neither this exact set nor the exact Storage path.
          or exists(
            select 1
            from jsonb_array_elements_text(coalesce(hotel.photos,'[]'::jsonb)) property_photo(url)
            where property_photo.url=proposed.url
          )
          or public.hotel_v2_admin_b_storage_url_is_exact(
            proposed.url,
            'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/'
              ||hotel.slug||'/rooms/'||p_room_id::text||'/'
          )
        )
    )
$function$;

create function public.hotel_v2_admin_b_property_gallery_is_valid(
  p_hotel_id uuid,
  p_proposed jsonb,
  p_current jsonb default '[]'::jsonb
)
returns boolean
language sql
security definer
stable
set search_path=pg_catalog,public
as $function$
  select public.hotel_v2_admin_b_gallery_is_valid(p_proposed,50)
    and exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id)
    and not exists(
      select 1
      from jsonb_array_elements_text(p_proposed) proposed(url)
      cross join public.hotels hotel
      where hotel.id=p_hotel_id
        and not (
          exists(select 1 from jsonb_array_elements_text(coalesce(p_current,'[]'::jsonb)) current(url)
            where current.url=proposed.url)
          or public.hotel_v2_admin_b_storage_url_is_exact(
            proposed.url,
            'https://daoohnbnnowmmcizgvrq.supabase.co/storage/v1/object/public/poi-photos/hotels/'
              ||hotel.slug||'/gallery/'
          )
        )
    )
$function$;

revoke all on function public.hotel_v2_admin_b_i18n_is_valid(jsonb,boolean,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_string_array_is_valid(jsonb,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_gallery_is_valid(jsonb,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_beds_are_valid(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_storage_url_is_exact(text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_property_gallery_is_valid(uuid,jsonb,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_room_gallery_is_valid(uuid,uuid,jsonb,jsonb)
  from public,anon,authenticated,service_role;

create table public.hotel_property_operational_profiles(
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  maximum_stay_nights integer,
  guest_instructions_i18n jsonb not null default '{}'::jsonb,
  check_in_instructions_i18n jsonb not null default '{}'::jsonb,
  check_out_instructions_i18n jsonb not null default '{}'::jsonb,
  internal_operational_notes text,
  version bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_property_operational_profiles_maximum_stay_check
    check(maximum_stay_nights is null or maximum_stay_nights between 1 and 365),
  constraint hotel_property_operational_profiles_guest_instructions_check
    check(public.hotel_v2_admin_b_i18n_is_valid(guest_instructions_i18n,false,8000)),
  constraint hotel_property_operational_profiles_check_in_instructions_check
    check(public.hotel_v2_admin_b_i18n_is_valid(check_in_instructions_i18n,false,8000)),
  constraint hotel_property_oper_profiles_checkout_i18n_check
    check(public.hotel_v2_admin_b_i18n_is_valid(check_out_instructions_i18n,false,8000)),
  constraint hotel_property_operational_profiles_notes_check
    check(internal_operational_notes is null or length(internal_operational_notes)<=5000),
  constraint hotel_property_operational_profiles_version_check check(version>0)
);

comment on table public.hotel_property_operational_profiles is
  'RPC-only Hotels V2 shadow operational content. It is deliberately separate from legacy-public hotels so internal notes and inert instructions cannot leak through legacy SELECT policies.';

alter table public.hotel_property_operational_profiles enable row level security;
revoke all on table public.hotel_property_operational_profiles
  from public,anon,authenticated,service_role;

create trigger hotel_property_operational_profiles_set_updated_at_and_version
before update on public.hotel_property_operational_profiles
for each row execute function public.hotel_v2_set_updated_at_and_version();

create function public.hotel_v2_admin_b_validate_stay_bounds(p_hotel_id uuid)
returns void
language plpgsql
security definer
stable
set search_path=pg_catalog,public
as $function$
declare v_minimum integer; v_maximum integer;
begin
  select hotel.minimum_stay_nights,profile.maximum_stay_nights
  into v_minimum,v_maximum
  from public.hotels hotel
  left join public.hotel_property_operational_profiles profile
    on profile.hotel_id=hotel.id
  where hotel.id=p_hotel_id;
  if v_minimum is not null and v_maximum is not null and v_maximum<v_minimum then
    raise exception using errcode='23514',
      message='hotels_v2_admin_b_maximum_stay_below_minimum';
  end if;
end
$function$;

create function public.hotel_v2_admin_b_stay_bounds_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_hotel_id uuid;
begin
  -- NEW is a polymorphic record. Referencing NEW.id and NEW.hotel_id inside a
  -- CASE can make PostgreSQL resolve the non-existent field for the other
  -- relation. JSON extraction keeps the exact two trigger contracts separate.
  if tg_relid='public.hotels'::regclass then
    v_hotel_id:=nullif(to_jsonb(new)->>'id','')::uuid;
  elsif tg_relid='public.hotel_property_operational_profiles'::regclass then
    v_hotel_id:=nullif(to_jsonb(new)->>'hotel_id','')::uuid;
  else
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_stay_bounds_trigger_relation_mismatch';
  end if;
  perform public.hotel_v2_admin_b_validate_stay_bounds(v_hotel_id);
  return null;
end
$function$;

revoke all on function public.hotel_v2_admin_b_validate_stay_bounds(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_b_stay_bounds_constraint_trigger()
  from public,anon,authenticated,service_role;

create constraint trigger hotels_admin_b_stay_bounds_guard
after insert or update of minimum_stay_nights on public.hotels
deferrable initially deferred for each row
execute function public.hotel_v2_admin_b_stay_bounds_constraint_trigger();

create constraint trigger hotel_property_operational_profiles_stay_bounds_guard
after insert or update of maximum_stay_nights
on public.hotel_property_operational_profiles
deferrable initially deferred for each row
execute function public.hotel_v2_admin_b_stay_bounds_constraint_trigger();

-- Closed transaction context. Only the postgres-owned Admin assignment RPC
-- can create a matching row; API roles have no table privileges or policy.
-- The established fulfillment trigger checks backend + transaction + exact
-- assignment tuple + actor and therefore cannot be bypassed by a broad GUC.
create table public.hotel_admin_assignment_transaction_context(
  backend_pid integer not null,
  transaction_id bigint not null,
  assignment_id uuid not null,
  hotel_id uuid not null,
  partner_id uuid not null,
  actor_user_id uuid not null,
  correlation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(backend_pid,transaction_id,assignment_id),
  unique(correlation_id)
);
alter table public.hotel_admin_assignment_transaction_context enable row level security;
revoke all on table public.hotel_admin_assignment_transaction_context
  from public,anon,authenticated,service_role;

-- Every Hotel assignment writer, including retained legacy Admin paths, takes
-- the same exact Hotel mutex. This serializes reviewed fingerprints with raw
-- INSERT/UPDATE/DELETE without changing the legacy fulfillment trigger.
create function public.hotel_v2_admin_b_partner_assignment_lock_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_hotel_id uuid;
begin
  for v_hotel_id in
    select distinct candidate.hotel_id
    from (values
      (case when tg_op<>'INSERT' and old.resource_type='hotels' then old.resource_id else null end),
      (case when tg_op<>'DELETE' and new.resource_type='hotels' then new.resource_id else null end)
    ) candidate(hotel_id)
    where candidate.hotel_id is not null
    order by candidate.hotel_id
  loop
    perform 1 from public.hotels hotel where hotel.id=v_hotel_id for update;
    if not found then
      raise exception using errcode='23503',
      message='hotels_v2_admin_b_assignment_property_not_found';
    end if;
  end loop;

  -- Retained legacy/Admin assignment writers may still address this table,
  -- but they may not orphan staff scopes. The reviewed ADMIN-B removal path
  -- deletes and audits the exact scopes before it deletes the assignment.
  if tg_op<>'INSERT'
     and old.resource_type='hotels'
     and (
       tg_op='DELETE'
       or new.partner_id is distinct from old.partner_id
       or new.resource_type is distinct from old.resource_type
       or new.resource_id is distinct from old.resource_id
     )
     and exists(
       select 1
       from public.partner_user_resources scope_row
       join public.partner_users membership
         on membership.id=scope_row.partner_user_id
       where membership.partner_id=old.partner_id
         and scope_row.resource_type='hotels'
         and scope_row.resource_id=old.resource_id
     ) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_b_assignment_has_staff_scopes',
      hint='Use the reviewed operational-assignment RPC so exact staff scopes are revoked and audited first.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;
revoke all on function public.hotel_v2_admin_b_partner_assignment_lock_trigger()
  from public,anon,authenticated,service_role;
create trigger partner_resources_admin_b_hotel_assignment_lock
before insert or update of partner_id,resource_type,resource_id or delete
on public.partner_resources
for each row execute function public.hotel_v2_admin_b_partner_assignment_lock_trigger();

-- A staff scope may exist only while its Partner has the exact Hotel
-- assignment. Taking a Hotel row lock serializes it with reviewed unassign,
-- preventing a dormant scope from racing in and reactivating on reassignment.
create function public.hotel_v2_admin_b_partner_scope_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_partner_id uuid;
begin
  if new.resource_type<>'hotels' then return new; end if;
  perform 1 from public.hotels where id=new.resource_id for key share;
  if not found then
    raise exception using errcode='23503',
      message='hotels_v2_admin_b_staff_scope_property_not_found';
  end if;
  select membership.partner_id into v_partner_id
  from public.partner_users membership
  where membership.id=new.partner_user_id
  for update;
  if v_partner_id is null or not exists(
    select 1 from public.partner_resources assignment
    where assignment.partner_id=v_partner_id
      and assignment.resource_type='hotels'
      and assignment.resource_id=new.resource_id
  ) then
    raise exception using errcode='23503',
      message='hotels_v2_admin_b_staff_scope_requires_assignment';
  end if;
  return new;
end
$function$;
revoke all on function public.hotel_v2_admin_b_partner_scope_integrity_trigger()
  from public,anon,authenticated,service_role;
create trigger partner_user_resources_admin_b_hotel_scope_guard
before insert or update of partner_user_id,resource_type,resource_id
on public.partner_user_resources
for each row execute function public.hotel_v2_admin_b_partner_scope_integrity_trigger();

-- Moving a membership between Partners while it owns Hotel scopes would make
-- those exact grants silently change meaning. Require explicit scope removal
-- first; membership deletion already cascades scopes through the FK.
create function public.hotel_v2_admin_b_membership_scope_reassignment_guard()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
begin
  if new.partner_id is distinct from old.partner_id and exists(
    select 1 from public.partner_user_resources scope_row
    where scope_row.partner_user_id=old.id and scope_row.resource_type='hotels'
  ) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_b_membership_reassignment_has_hotel_scopes',
      hint='Remove the exact Hotel staff scopes before changing Partner membership.';
  end if;
  return new;
end
$function$;
revoke all on function public.hotel_v2_admin_b_membership_scope_reassignment_guard()
  from public,anon,authenticated,service_role;
create trigger partner_users_admin_b_hotel_scope_reassignment_guard
before update of partner_id on public.partner_users
for each row execute function public.hotel_v2_admin_b_membership_scope_reassignment_guard();

-- The established assignment trigger creates fulfillments for every historical
-- booking on a new Hotel assignment. ADMIN-B assignment changes are explicitly
-- future-routing only, so add a transaction-local, Admin-authenticated bypass.
-- Direct legacy assignment writes retain their exact previous behavior.
do $admin_b_patch_assignment_backfill$
declare v_definition text; v_old text; v_new text;
begin
  select pg_get_functiondef(
    'public.trg_partner_resources_backfill_service_fulfillments()'::regprocedure
  ) into v_definition;
  v_old:=$old$  IF NEW.resource_type = 'trips' THEN$old$;
  v_new:=$new$  -- hotels_v2_admin_b_future_assignment_only_v1
  IF NEW.resource_type = 'hotels'
     AND public.is_current_user_admin()
     AND EXISTS(
       SELECT 1
       FROM public.hotel_admin_assignment_transaction_context context_row
       WHERE context_row.backend_pid=pg_backend_pid()
         AND context_row.transaction_id=txid_current()
         AND context_row.assignment_id=NEW.id
         AND context_row.hotel_id=NEW.resource_id
         AND context_row.partner_id=NEW.partner_id
         AND context_row.actor_user_id=auth.uid()
     ) THEN
    RETURN NEW;
  END IF;

  IF NEW.resource_type = 'trips' THEN$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_assignment_backfill_patch_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  if v_definition not like '%hotels_v2_admin_b_future_assignment_only_v1%' then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_assignment_backfill_patch_failed';
  end if;
  execute v_definition;
end
$admin_b_patch_assignment_backfill$;

create function public.hotel_v2_admin_get_content_control(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
declare
  c_contract constant text:='hotels_v2_admin_b_content_control_v1';
  v_hotel public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_assignment_snapshot jsonb;
  v_assignments jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_content_control_query';
  end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_admin_b_property_not_found';
  end if;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_public_activation_guard';
  end if;

  select * into v_profile
  from public.hotel_property_operational_profiles
  where hotel_id=p_hotel_id;
  v_profile_exists:=found;

  v_assignment_snapshot:=public.hotel_v2_admin_get_partner_hotel_permissions(p_hotel_id);
  select coalesce(jsonb_agg(
    assignment.value||jsonb_build_object(
      'staff_scope_count',(
        select count(*)::integer
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),
      'staff_scope_ids',coalesce((
        select jsonb_agg(scope_row.id order by scope_row.id)
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),'[]'::jsonb),
      'permission_exists',coalesce((assignment.value#>>'{permission,exists}')::boolean,false),
      'permission_will_cascade_on_remove',
        coalesce((assignment.value#>>'{permission,exists}')::boolean,false)
    ) order by assignment.ordinal
  ),'[]'::jsonb) into v_assignments
  from jsonb_array_elements(coalesce(v_assignment_snapshot->'assignments','[]'::jsonb))
    with ordinality assignment(value,ordinal);

  v_assignment_snapshot:=jsonb_set(
    v_assignment_snapshot,'{assignments}',v_assignments,false
  );

  return jsonb_build_object(
    'contract_version',c_contract,
    'hotel_id',v_hotel.id,
    'property_updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'feature_flags',v_assignment_snapshot->'feature_flags',
    'commercial_owner',(
      select case when partner.id is null then null else jsonb_build_object(
        'partner_id',partner.id,'name',partner.name,'status',partner.status,
        'can_manage_hotels',partner.can_manage_hotels
      ) end
      from (select 1) singleton
      left join public.partners partner on partner.id=v_hotel.owner_partner_id
    ),
    'operational_profile',case when v_profile_exists then jsonb_build_object(
      'exists',true,'version',v_profile.version,'updated_at',v_profile.updated_at,
      'maximum_stay_nights',v_profile.maximum_stay_nights,
      'guest_instructions_i18n',v_profile.guest_instructions_i18n,
      'check_in_instructions_i18n',v_profile.check_in_instructions_i18n,
      'check_out_instructions_i18n',v_profile.check_out_instructions_i18n,
      'internal_operational_notes',v_profile.internal_operational_notes
    ) else jsonb_build_object(
      'exists',false,'version',0,'updated_at',null,
      'maximum_stay_nights',null,
      'guest_instructions_i18n','{}'::jsonb,
      'check_in_instructions_i18n','{}'::jsonb,
      'check_out_instructions_i18n','{}'::jsonb,
      'internal_operational_notes',null
    ) end,
    'assignment_snapshot',v_assignment_snapshot
  );
end
$function$;

create function public.hotel_v2_admin_apply_operational_assignment_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_contract constant text:='hotels_v2_admin_b_operational_assignment_v1';
  v_hotel_id uuid;
  v_assignment_id uuid;
  v_partner_id uuid;
  v_reviewed_at timestamptz;
  v_snapshot_token text;
  v_assignment_fingerprint text;
  v_operation jsonb;
  v_action text;
  v_expected_scope_count integer;
  v_expected_scope_ids jsonb;
  v_expected_permission boolean;
  v_current_scope_ids jsonb;
  v_current_scope_count integer;
  v_permission_exists boolean;
  v_partner public.partners%rowtype;
  v_assignment public.partner_resources%rowtype;
  v_removed_scope_count integer:=0;
  v_before jsonb;
  v_after jsonb;
  v_activity jsonb;
  v_fulfillments_before text;
  v_fulfillments_after text;
  v_forms_before text;
  v_forms_after text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','reviewed_at','snapshot_token',
       'expected_assignment_fingerprint','operation'
     ])
     or not (p_plan ?& array[
       'contract_version','hotel_id','reviewed_at','snapshot_token',
       'expected_assignment_fingerprint','operation'
     ])
     or jsonb_typeof(p_plan->'contract_version')<>'string'
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or jsonb_typeof(p_plan->'snapshot_token')<>'string'
     or jsonb_typeof(p_plan->'expected_assignment_fingerprint')<>'string'
     or jsonb_typeof(p_plan->'operation')<>'object'
     or p_plan->>'contract_version'<>c_contract
     or p_plan->>'snapshot_token'!~'^[0-9a-f]{32}$'
     or p_plan->>'expected_assignment_fingerprint'!~'^[0-9a-f]{32}$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_assignment_plan';
  end if;
  v_operation:=p_plan->'operation';
  if not public.hotel_v2_h2a_keys_allowed(v_operation,array[
       'type','assignment_id','partner_id','expected_staff_scope_count',
       'expected_staff_scope_ids','expected_permission_exists'
     ])
     or not (v_operation ?& array[
       'type','assignment_id','partner_id','expected_staff_scope_count',
       'expected_staff_scope_ids','expected_permission_exists'
     ])
     or jsonb_typeof(v_operation->'type')<>'string'
     or jsonb_typeof(v_operation->'assignment_id')<>'string'
     or jsonb_typeof(v_operation->'partner_id')<>'string'
     or jsonb_typeof(v_operation->'expected_staff_scope_count')<>'number'
     or jsonb_typeof(v_operation->'expected_staff_scope_ids')<>'array'
     or jsonb_typeof(v_operation->'expected_permission_exists')<>'boolean'
     or not public.hotel_v2_admin_b_string_array_is_valid(
       v_operation->'expected_staff_scope_ids',10000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_assignment_operation';
  end if;
  if v_operation->>'expected_staff_scope_count'!~'^[0-9]+$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_assignment_scope_count';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
    v_snapshot_token:=p_plan->>'snapshot_token';
    v_assignment_fingerprint:=p_plan->>'expected_assignment_fingerprint';
    v_action:=v_operation->>'type';
    v_assignment_id:=(v_operation->>'assignment_id')::uuid;
    v_partner_id:=(v_operation->>'partner_id')::uuid;
    v_expected_scope_count:=(v_operation->>'expected_staff_scope_count')::integer;
    v_expected_scope_ids:=v_operation->'expected_staff_scope_ids';
    v_expected_permission:=(v_operation->>'expected_permission_exists')::boolean;
    perform (scope_id#>>'{}')::uuid
    from jsonb_array_elements(v_expected_scope_ids) scope_id;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_assignment_identifiers';
  end;
  if v_action not in('assign','remove') or v_expected_scope_count<0
     or jsonb_array_length(v_expected_scope_ids)<>v_expected_scope_count
     or v_expected_scope_ids is distinct from coalesce((
       select jsonb_agg(scope_id order by scope_id)
       from jsonb_array_elements_text(v_expected_scope_ids) scope_id
     ),'[]'::jsonb)
     or v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_assignment_review_invalid';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_public_activation_guard';
  end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_property_not_found'; end if;
  perform 1 from public.partner_resources assignment_row
    where assignment_row.resource_type='hotels' and assignment_row.resource_id=v_hotel_id
    order by assignment_row.id for update;
  perform 1 from public.hotel_partner_hotel_permissions permission
    where permission.hotel_id=v_hotel_id order by permission.assignment_id for update;
  if v_assignment_fingerprint is distinct from
       public.hotel_v2_h3_2a_assignment_fingerprint(v_hotel_id)
     or v_snapshot_token is distinct from public.hotel_v2_h3_2a_snapshot_token(v_hotel_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_assignment_review',
      detail=jsonb_build_object(
        'expected_assignment_fingerprint',v_assignment_fingerprint,
        'current_assignment_fingerprint',public.hotel_v2_h3_2a_assignment_fingerprint(v_hotel_id),
        'expected_snapshot_token',v_snapshot_token,
        'current_snapshot_token',public.hotel_v2_h3_2a_snapshot_token(v_hotel_id)
      )::text,
      hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_admin_b_correlation_id_already_used';
  end if;
  select * into v_partner from public.partners where id=v_partner_id for share;
  if not found then
    raise exception using errcode='PT404',message='hotels_v2_admin_b_assignment_partner_not_found';
  end if;
  if v_action='assign' and (v_partner.status<>'active' or not v_partner.can_manage_hotels) then
    raise exception using errcode='23514',message='hotels_v2_admin_b_assignment_partner_not_eligible';
  end if;

  lock table public.partner_service_fulfillments in share mode;
  lock table public.partner_service_fulfillment_form_snapshots in share mode;
  select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) into v_fulfillments_before
  from public.partner_service_fulfillments row_value;
  select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) into v_forms_before
  from public.partner_service_fulfillment_form_snapshots row_value;
  v_before:=jsonb_build_object(
    'assignment_snapshot',public.hotel_v2_admin_get_content_control(v_hotel_id)->'assignment_snapshot',
    'reviewed_staff_scope_ids',v_expected_scope_ids,
    'reviewed_permission_exists',v_expected_permission
  );

  if v_action='assign' then
    if v_expected_scope_count<>0 or v_expected_scope_ids<>'[]'::jsonb
       or v_expected_permission
       or exists(select 1 from public.partner_resources where id=v_assignment_id)
       or exists(select 1 from public.partner_resources assignment_row
         where assignment_row.partner_id=v_partner_id
           and assignment_row.resource_type='hotels'
           and assignment_row.resource_id=v_hotel_id) then
      raise exception using errcode='PT409',message='hotels_v2_admin_b_assignment_identity_conflict';
    end if;
    insert into public.hotel_admin_assignment_transaction_context(
      backend_pid,transaction_id,assignment_id,hotel_id,partner_id,
      actor_user_id,correlation_id
    ) values(
      pg_backend_pid(),txid_current(),v_assignment_id,v_hotel_id,v_partner_id,
      auth.uid(),p_correlation_id
    );
    insert into public.partner_resources(id,partner_id,resource_type,resource_id)
    values(v_assignment_id,v_partner_id,'hotels',v_hotel_id)
    returning * into v_assignment;
    delete from public.hotel_admin_assignment_transaction_context context_row
    where context_row.backend_pid=pg_backend_pid()
      and context_row.transaction_id=txid_current()
      and context_row.assignment_id=v_assignment_id
      and context_row.correlation_id=p_correlation_id;
    if found is not true then
      raise exception using errcode='55000',message='hotels_v2_admin_b_assignment_context_cleanup_failed';
    end if;
    if exists(select 1 from public.hotel_partner_hotel_permissions
         where assignment_id=v_assignment_id)
       or exists(select 1 from public.partner_user_resources scope_row
         join public.partner_users membership on membership.id=scope_row.partner_user_id
         where membership.partner_id=v_partner_id
           and scope_row.resource_type='hotels' and scope_row.resource_id=v_hotel_id) then
      raise exception using errcode='55000',message='hotels_v2_admin_b_assignment_granted_unreviewed_access';
    end if;
  else
    select * into v_assignment from public.partner_resources assignment_row
    where assignment_row.id=v_assignment_id
      and assignment_row.partner_id=v_partner_id
      and assignment_row.resource_type='hotels'
      and assignment_row.resource_id=v_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_b_assignment_not_found'; end if;
    perform 1 from public.partner_users membership
      where membership.partner_id=v_partner_id order by membership.id for update;
    perform 1 from public.partner_user_resources scope_row
      join public.partner_users membership on membership.id=scope_row.partner_user_id
      where membership.partner_id=v_partner_id
        and scope_row.resource_type='hotels' and scope_row.resource_id=v_hotel_id
      order by scope_row.id for update of scope_row;
    select count(*)::integer,coalesce(jsonb_agg(scope_row.id order by scope_row.id),'[]'::jsonb)
    into v_current_scope_count,v_current_scope_ids
    from public.partner_user_resources scope_row
    join public.partner_users membership on membership.id=scope_row.partner_user_id
    where membership.partner_id=v_partner_id
      and scope_row.resource_type='hotels' and scope_row.resource_id=v_hotel_id;
    select exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=v_assignment_id) into v_permission_exists;
    if v_current_scope_count<>v_expected_scope_count
       or v_current_scope_ids is distinct from v_expected_scope_ids
       or v_permission_exists is distinct from v_expected_permission then
      raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_assignment_dependents',
        detail=jsonb_build_object(
          'expected_staff_scope_count',v_expected_scope_count,
          'current_staff_scope_count',v_current_scope_count,
          'expected_staff_scope_ids',v_expected_scope_ids,
          'current_staff_scope_ids',v_current_scope_ids,
          'expected_permission_exists',v_expected_permission,
          'current_permission_exists',v_permission_exists
        )::text,
        hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
    end if;
    delete from public.partner_user_resources scope_row
    using public.partner_users membership
    where membership.id=scope_row.partner_user_id
      and membership.partner_id=v_partner_id
      and scope_row.resource_type='hotels' and scope_row.resource_id=v_hotel_id;
    get diagnostics v_removed_scope_count=row_count;
    delete from public.partner_resources assignment_row
    where assignment_row.id=v_assignment_id
      and assignment_row.partner_id=v_partner_id
      and assignment_row.resource_type='hotels'
      and assignment_row.resource_id=v_hotel_id;
    if not found then raise exception using errcode='PT409',message='hotels_v2_admin_b_assignment_changed_during_remove'; end if;
  end if;

  select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) into v_fulfillments_after
  from public.partner_service_fulfillments row_value;
  select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) into v_forms_after
  from public.partner_service_fulfillment_form_snapshots row_value;
  if v_fulfillments_after is distinct from v_fulfillments_before
     or v_forms_after is distinct from v_forms_before then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_historical_fulfillment_changed';
  end if;
  if exists(select 1 from public.hotel_admin_assignment_transaction_context
    where backend_pid=pg_backend_pid() and transaction_id=txid_current()) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_assignment_context_not_empty';
  end if;
  v_after:=jsonb_build_object(
    'assignment_snapshot',public.hotel_v2_admin_get_content_control(v_hotel_id)->'assignment_snapshot',
    'removed_staff_scope_count',v_removed_scope_count,
    'removed_staff_scope_ids',case when v_action='remove' then v_expected_scope_ids else '[]'::jsonb end,
    'permission_removed',case when v_action='remove' then v_permission_exists else false end
  );
  insert into public.hotel_activity_log(
    hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id
  ) values(
    v_hotel_id,'property',v_hotel_id,'update',v_before,v_after,
    'admin',auth.uid(),'hotels_v2_admin_b_operational_assignment',p_correlation_id
  );
  select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
  into v_activity from public.hotel_activity_log activity
  where activity.correlation_id=p_correlation_id;
  return jsonb_build_object(
    'ok',true,'contract_version',c_contract,'hotel_id',v_hotel_id,
    'assignment_id',v_assignment_id,'partner_id',v_partner_id,
    'operation',v_action,'changed',true,
    'removed_staff_scope_count',v_removed_scope_count,
    'removed_permission',case when v_action='remove' then v_permission_exists else false end,
    'correlation_id',p_correlation_id,
    'content_control',public.hotel_v2_admin_get_content_control(v_hotel_id),
    'activity',v_activity
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_assignment_numeric_value';
end
$function$;

create function public.hotel_v2_admin_apply_property_control_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_contract constant text:='hotels_v2_admin_b_property_control_v1';
  c_private_keys constant text[]:=array[
    'maximum_stay_nights','guest_instructions_i18n',
    'check_in_instructions_i18n','check_out_instructions_i18n',
    'internal_operational_notes'
  ];
  v_hotel_id uuid;
  v_reviewed_at timestamptz;
  v_expected_property_updated_at timestamptz;
  v_expected_profile_version bigint;
  v_payload jsonb;
  v_original jsonb;
  v_hotel public.hotels%rowtype;
  v_target public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_profile_before jsonb;
  v_profile_target jsonb;
  v_before jsonb;
  v_after jsonb;
  v_key text;
  v_current_value jsonb;
  v_target_value jsonb;
  v_conflicts text[]:='{}'::text[];
  v_has_public boolean:=false;
  v_has_private boolean:=false;
  v_property_changed boolean:=false;
  v_profile_changed boolean:=false;
  v_minimum integer;
  v_maximum integer;
  v_cover text;
  v_activity jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','expected_property_updated_at',
       'expected_operational_profile_version','reviewed_at','expected_original','payload'
     ])
     or not (p_plan ?& array[
       'contract_version','hotel_id','expected_property_updated_at',
       'expected_operational_profile_version','reviewed_at','expected_original','payload'
     ])
     or jsonb_typeof(p_plan->'contract_version')<>'string'
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'expected_property_updated_at')<>'string'
     or jsonb_typeof(p_plan->'expected_operational_profile_version')<>'number'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or p_plan->>'contract_version'<>c_contract
     or jsonb_typeof(p_plan->'expected_original')<>'object'
     or jsonb_typeof(p_plan->'payload')<>'object'
     or not exists(select 1 from jsonb_object_keys(p_plan->'payload'))
     or not public.hotel_v2_h2a_keys_allowed(p_plan->'payload',array[
       'title_i18n','description_i18n','city','address_line','district','postal_code',
       'country','latitude','longitude','google_maps_url','amenities',
       'check_in_from','check_out_until','timezone','currency','booking_mode',
       'owner_partner_id','cover_image_url','photos','minimum_stay_nights',
       'maximum_stay_nights','guest_instructions_i18n','check_in_instructions_i18n',
       'check_out_instructions_i18n','internal_operational_notes'
     ])
     or exists(
       (select key from jsonb_object_keys(p_plan->'payload') key)
       except
       (select key from jsonb_object_keys(p_plan->'expected_original') key)
     )
     or exists(
       (select key from jsonb_object_keys(p_plan->'expected_original') key)
       except
       (select key from jsonb_object_keys(p_plan->'payload') key)
     ) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_plan';
  end if;
  if p_plan->>'expected_operational_profile_version'!~'^[0-9]+$' then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_operational_profile_version';
  end if;

  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_expected_property_updated_at:=(p_plan->>'expected_property_updated_at')::timestamptz;
    v_expected_profile_version:=(p_plan->>'expected_operational_profile_version')::bigint;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_plan_identifiers';
  end;
  if v_expected_profile_version<0
     or v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_property_review_expired';
  end if;
  v_payload:=p_plan->'payload';
  v_original:=p_plan->'expected_original';

  if exists(
    select 1 from jsonb_each(v_payload) entry
    where (entry.key in('city','address_line','district','postal_code','country',
             'google_maps_url','check_in_from','check_out_until','timezone','currency',
             'booking_mode','owner_partner_id','cover_image_url','internal_operational_notes')
           and jsonb_typeof(entry.value) not in('string','null'))
       or (entry.key in('latitude','longitude','minimum_stay_nights','maximum_stay_nights')
           and jsonb_typeof(entry.value) not in('number','string','null'))
  ) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_scalar_type';
  end if;
  if (v_payload?'city' and length(coalesce(v_payload->>'city',''))>200)
     or (v_payload?'address_line' and length(coalesce(v_payload->>'address_line',''))>500)
     or (v_payload?'district' and length(coalesce(v_payload->>'district',''))>200)
     or (v_payload?'postal_code' and length(coalesce(v_payload->>'postal_code',''))>40)
     or (v_payload?'country' and length(coalesce(v_payload->>'country',''))>100)
     or (v_payload?'google_maps_url' and length(coalesce(v_payload->>'google_maps_url',''))>2048)
     or (v_payload?'cover_image_url' and length(coalesce(v_payload->>'cover_image_url',''))>2048)
     or (v_payload?'timezone' and length(coalesce(v_payload->>'timezone',''))>100) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_property_scalar_too_long';
  end if;
  if (v_payload?'city' and nullif(btrim(v_payload->>'city'),'') is null)
     or (v_payload?'country' and nullif(btrim(v_payload->>'country'),'') is null)
     or (v_payload?'timezone' and nullif(btrim(v_payload->>'timezone'),'') is null)
     or (v_payload?'currency' and nullif(btrim(v_payload->>'currency'),'') is null)
     or (v_payload?'booking_mode' and nullif(btrim(v_payload->>'booking_mode'),'') is null) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_required_property_field_empty';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_public_activation_guard';
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_admin_b_property_not_found';
  end if;
  select * into v_profile from public.hotel_property_operational_profiles
    where hotel_id=v_hotel_id for update;
  v_profile_exists:=found;

  for v_key in select key from jsonb_object_keys(v_payload) key loop
    if v_key=any(c_private_keys) then v_has_private:=true;
    else v_has_public:=true;
    end if;
  end loop;
  if v_has_private and (
    (v_profile_exists and v_profile.version<>v_expected_profile_version)
    or (not v_profile_exists and v_expected_profile_version<>0)
  ) then
    -- Field-level comparison below may still prove a stale version harmless.
    null;
  end if;

  -- Validate exact proposed field shapes before building a target record.
  if v_payload?'title_i18n'
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->'title_i18n',true,240) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_name';
  end if;
  if v_payload?'description_i18n'
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->'description_i18n',false,12000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_description';
  end if;
  if v_payload?'guest_instructions_i18n'
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->'guest_instructions_i18n',false,8000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_guest_instructions';
  end if;
  if v_payload?'check_in_instructions_i18n'
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->'check_in_instructions_i18n',false,8000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_check_in_instructions';
  end if;
  if v_payload?'check_out_instructions_i18n'
     and not public.hotel_v2_admin_b_i18n_is_valid(v_payload->'check_out_instructions_i18n',false,8000) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_check_out_instructions';
  end if;
  if v_payload?'internal_operational_notes' and v_payload->>'internal_operational_notes' is not null
     and length(v_payload->>'internal_operational_notes')>5000 then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_operational_notes';
  end if;
  if v_payload?'amenities' and (
       not public.hotel_v2_admin_b_string_array_is_valid(v_payload->'amenities',200)
       or exists(select 1 from jsonb_array_elements_text(v_payload->'amenities') requested(code)
          where not exists(select 1 from jsonb_array_elements_text(coalesce(v_hotel.amenities,'[]'::jsonb)) current_amenity(code)
                  where current_amenity.code=requested.code)
            and not exists(select 1 from public.hotel_amenities amenity
              where amenity.code=requested.code and amenity.is_active))
     ) then
    raise exception using errcode='23503',message='hotels_v2_admin_b_unknown_property_amenity';
  end if;
  if v_payload?'photos' and not public.hotel_v2_admin_b_property_gallery_is_valid(
       v_hotel_id,v_payload->'photos',coalesce(v_hotel.photos,'[]'::jsonb)) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_property_gallery';
  end if;
  if v_payload?'latitude' and v_payload->>'latitude' is not null and (
       v_payload->>'latitude' !~ '^-?[0-9]+(?:\.[0-9]+)?$'
       or (v_payload->>'latitude')::numeric not between -90 and 90) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_latitude';
  end if;
  if v_payload?'longitude' and v_payload->>'longitude' is not null and (
       v_payload->>'longitude' !~ '^-?[0-9]+(?:\.[0-9]+)?$'
       or (v_payload->>'longitude')::numeric not between -180 and 180) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_longitude';
  end if;
  if v_payload?'google_maps_url' and v_payload->>'google_maps_url' is not null
     and v_payload->>'google_maps_url' is distinct from v_hotel.google_maps_url
     and not public.hotel_v2_admin_b_google_maps_url_is_valid(
       v_payload->>'google_maps_url') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_google_maps_url';
  end if;
  if v_payload?'check_in_from' and v_payload->>'check_in_from' is not null
     and v_payload->>'check_in_from' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_check_in';
  end if;
  if v_payload?'check_out_until' and v_payload->>'check_out_until' is not null
     and v_payload->>'check_out_until' !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_check_out';
  end if;
  if v_payload?'timezone' and not exists(select 1 from pg_catalog.pg_timezone_names zone
       where zone.name=v_payload->>'timezone') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_timezone';
  end if;
  if v_payload?'currency' and upper(btrim(v_payload->>'currency')) !~ '^[A-Z]{3}$' then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_currency';
  end if;
  if v_payload?'booking_mode' and v_payload->>'booking_mode'
       not in('request_confirmation','instant_booking','external_redirect') then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_booking_mode';
  end if;
  if v_payload?'owner_partner_id' and v_payload->>'owner_partner_id' is not null
     then
    begin
      perform 1 from public.partners partner
      where partner.id=(v_payload->>'owner_partner_id')::uuid
        and partner.status='active' and partner.can_manage_hotels;
      if not found then
        raise exception using errcode='23514',message='hotels_v2_admin_b_owner_not_eligible';
      end if;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_owner_partner_id';
    end;
  end if;
  if (v_payload?'minimum_stay_nights' and v_payload->>'minimum_stay_nights' is not null
      and (v_payload->>'minimum_stay_nights' !~ '^[0-9]+$'
        or (v_payload->>'minimum_stay_nights')::integer not between 1 and 365))
     or (v_payload?'maximum_stay_nights' and v_payload->>'maximum_stay_nights' is not null
      and (v_payload->>'maximum_stay_nights' !~ '^[0-9]+$'
        or (v_payload->>'maximum_stay_nights')::integer not between 1 and 365)) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_invalid_stay_bounds';
  end if;
  v_target:=v_hotel;
  if v_payload?'title_i18n' then v_target.title_i18n:=v_payload->'title_i18n'; v_target.title:=v_payload->'title_i18n'; end if;
  if v_payload?'description_i18n' then v_target.description_i18n:=v_payload->'description_i18n'; v_target.description:=v_payload->'description_i18n'; end if;
  if v_payload?'city' then v_target.city:=nullif(btrim(v_payload->>'city'),''); end if;
  if v_payload?'address_line' then v_target.address_line:=nullif(btrim(v_payload->>'address_line'),''); end if;
  if v_payload?'district' then v_target.district:=nullif(btrim(v_payload->>'district'),''); end if;
  if v_payload?'postal_code' then v_target.postal_code:=nullif(btrim(v_payload->>'postal_code'),''); end if;
  if v_payload?'country' then v_target.country:=nullif(btrim(v_payload->>'country'),''); end if;
  if v_payload?'latitude' then v_target.latitude:=(v_payload->>'latitude')::double precision; end if;
  if v_payload?'longitude' then v_target.longitude:=(v_payload->>'longitude')::double precision; end if;
  if v_payload?'google_maps_url' then v_target.google_maps_url:=nullif(btrim(v_payload->>'google_maps_url'),''); end if;
  if v_payload?'amenities' then v_target.amenities:=v_payload->'amenities'; end if;
  if v_payload?'check_in_from' then v_target.check_in_from:=(v_payload->>'check_in_from')::time; end if;
  if v_payload?'check_out_until' then v_target.check_out_until:=(v_payload->>'check_out_until')::time; end if;
  if v_payload?'timezone' then v_target.timezone:=btrim(v_payload->>'timezone'); end if;
  if v_payload?'currency' then v_target.currency:=upper(btrim(v_payload->>'currency'))::character(3); end if;
  if v_payload?'booking_mode' then v_target.booking_mode:=v_payload->>'booking_mode'; end if;
  if v_payload?'owner_partner_id' then v_target.owner_partner_id:=(v_payload->>'owner_partner_id')::uuid; end if;
  if v_payload?'cover_image_url' then v_target.cover_image_url:=nullif(btrim(v_payload->>'cover_image_url'),''); end if;
  if v_payload?'photos' then v_target.photos:=v_payload->'photos'; end if;
  if v_payload?'minimum_stay_nights' then v_target.minimum_stay_nights:=(v_payload->>'minimum_stay_nights')::integer; end if;

  v_profile_before:=case when v_profile_exists then jsonb_build_object(
    'maximum_stay_nights',v_profile.maximum_stay_nights,
    'guest_instructions_i18n',v_profile.guest_instructions_i18n,
    'check_in_instructions_i18n',v_profile.check_in_instructions_i18n,
    'check_out_instructions_i18n',v_profile.check_out_instructions_i18n,
    'internal_operational_notes',v_profile.internal_operational_notes
  ) else jsonb_build_object(
    'maximum_stay_nights',null,'guest_instructions_i18n','{}'::jsonb,
    'check_in_instructions_i18n','{}'::jsonb,'check_out_instructions_i18n','{}'::jsonb,
    'internal_operational_notes',null
  ) end;
  v_profile_target:=v_profile_before;
  foreach v_key in array c_private_keys loop
    if v_payload?v_key then
      v_profile_target:=jsonb_set(v_profile_target,array[v_key],coalesce(v_payload->v_key,'null'::jsonb),true);
    end if;
  end loop;

  v_minimum:=v_target.minimum_stay_nights;
  v_maximum:=case when v_profile_target->>'maximum_stay_nights' is null then null
    else (v_profile_target->>'maximum_stay_nights')::integer end;
  if v_minimum is not null and v_maximum is not null and v_maximum<v_minimum then
    raise exception using errcode='23514',message='hotels_v2_admin_b_maximum_stay_below_minimum';
  end if;

  v_cover:=v_target.cover_image_url;
  if (v_payload?'cover_image_url' or v_payload?'photos')
     and v_cover is not null
     and not exists(select 1 from jsonb_array_elements_text(coalesce(v_target.photos,'[]'::jsonb)) photo(url)
       where photo.url=v_cover)
     and not (
       v_cover is not distinct from v_hotel.cover_image_url
       and not exists(
         select 1
         from jsonb_array_elements_text(coalesce(v_hotel.photos,'[]'::jsonb)) current_photo(url)
         where current_photo.url=v_hotel.cover_image_url
       )
     ) then
    raise exception using errcode='22023',message='hotels_v2_admin_b_cover_not_in_property_gallery';
  end if;

  -- A stale plan is never silently rebased. Field comparisons are diagnostic
  -- only: the Admin must build one fresh explicit Review and Save. Time values
  -- are canonicalized to HH:MM, matching the reviewed UI contract.
  if (v_has_public and v_hotel.updated_at is distinct from v_expected_property_updated_at)
     or (v_has_private and (
       (v_profile_exists and v_profile.version<>v_expected_profile_version)
       or (not v_profile_exists and v_expected_profile_version<>0))) then
    for v_key in select key from jsonb_object_keys(v_payload) key loop
      if v_key=any(c_private_keys) then
        v_current_value:=v_profile_before->v_key;
        v_target_value:=v_profile_target->v_key;
      else
        v_current_value:=to_jsonb(v_hotel)->v_key;
        v_target_value:=to_jsonb(v_target)->v_key;
        if v_key='title_i18n' and v_hotel.architecture_version='legacy' then
          v_current_value:=v_hotel.title;
        elsif v_key='description_i18n' and v_hotel.architecture_version='legacy' then
          v_current_value:=v_hotel.description;
        end if;
        if v_key in('check_in_from','check_out_until') then
          v_current_value:=coalesce(to_jsonb(to_char(
            case when v_key='check_in_from' then v_hotel.check_in_from else v_hotel.check_out_until end,
            'HH24:MI')),'null'::jsonb);
          v_target_value:=coalesce(to_jsonb(to_char(
            case when v_key='check_in_from' then v_target.check_in_from else v_target.check_out_until end,
            'HH24:MI')),'null'::jsonb);
        elsif v_key='amenities' then
          v_current_value:=coalesce((select jsonb_agg(code order by code)
            from jsonb_array_elements_text(coalesce(v_hotel.amenities,'[]'::jsonb)) code),'[]'::jsonb);
          v_target_value:=coalesce((select jsonb_agg(code order by code)
            from jsonb_array_elements_text(coalesce(v_target.amenities,'[]'::jsonb)) code),'[]'::jsonb);
        end if;
      end if;
      if v_current_value is distinct from v_original->v_key
         and v_current_value is distinct from v_target_value then
        v_conflicts:=array_append(v_conflicts,v_key);
      end if;
    end loop;
    raise exception using errcode='PT409',
      message=case when cardinality(v_conflicts)>0
        then 'hotels_v2_admin_b_property_field_conflict'
        else 'hotels_v2_admin_b_stale_property_review' end,
      detail=jsonb_build_object(
        'reason',case when cardinality(v_conflicts)>0
          then 'reviewed_field_changed' else 'stale_version_non_overlapping' end,
        'changed_fields',to_jsonb(v_conflicts),
        'expected_property_updated_at',v_expected_property_updated_at,
        'current_property_updated_at',v_hotel.updated_at,
        'expected_operational_profile_version',v_expected_profile_version,
        'current_operational_profile_version',case when v_profile_exists then v_profile.version else 0 end
      )::text,
      hint='Refresh, rebuild Review, then save explicitly. Nothing was retried.';
  end if;

  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_admin_b_correlation_id_already_used';
  end if;
  v_before:=jsonb_build_object('property',to_jsonb(v_hotel),'operational_profile',v_profile_before);

  if to_jsonb(v_target) is distinct from to_jsonb(v_hotel) then
    update public.hotels hotel set
      title=v_target.title,title_i18n=v_target.title_i18n,
      description=v_target.description,description_i18n=v_target.description_i18n,
      city=v_target.city,address_line=v_target.address_line,district=v_target.district,
      postal_code=v_target.postal_code,country=v_target.country,
      latitude=v_target.latitude,longitude=v_target.longitude,
      google_maps_url=v_target.google_maps_url,
      amenities=v_target.amenities,check_in_from=v_target.check_in_from,
      check_out_until=v_target.check_out_until,timezone=v_target.timezone,
      currency=v_target.currency,booking_mode=v_target.booking_mode,
      owner_partner_id=v_target.owner_partner_id,cover_image_url=v_target.cover_image_url,
      photos=v_target.photos,
      minimum_stay_nights=v_target.minimum_stay_nights
    where hotel.id=v_hotel_id and hotel.updated_at=v_hotel.updated_at
    returning to_jsonb(hotel.*) into v_after;
    if v_after is null then
      raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_property_during_apply';
    end if;
    v_property_changed:=true;
  end if;

  if v_profile_target is distinct from v_profile_before then
    if v_profile_exists then
      update public.hotel_property_operational_profiles profile set
        maximum_stay_nights=case when v_profile_target->>'maximum_stay_nights' is null then null else (v_profile_target->>'maximum_stay_nights')::integer end,
        guest_instructions_i18n=v_profile_target->'guest_instructions_i18n',
        check_in_instructions_i18n=v_profile_target->'check_in_instructions_i18n',
        check_out_instructions_i18n=v_profile_target->'check_out_instructions_i18n',
        internal_operational_notes=v_profile_target->>'internal_operational_notes',
        updated_by=auth.uid()
      where profile.hotel_id=v_hotel_id and profile.version=v_profile.version;
      if not found then raise exception using errcode='PT409',message='hotels_v2_admin_b_stale_operational_profile'; end if;
    else
      insert into public.hotel_property_operational_profiles(
        hotel_id,maximum_stay_nights,guest_instructions_i18n,
        check_in_instructions_i18n,check_out_instructions_i18n,
        internal_operational_notes,created_by,updated_by
      ) values(
        v_hotel_id,
        case when v_profile_target->>'maximum_stay_nights' is null then null else (v_profile_target->>'maximum_stay_nights')::integer end,
        v_profile_target->'guest_instructions_i18n',
        v_profile_target->'check_in_instructions_i18n',
        v_profile_target->'check_out_instructions_i18n',
        v_profile_target->>'internal_operational_notes',auth.uid(),auth.uid()
      );
    end if;
    v_profile_changed:=true;
  end if;

  if v_property_changed or v_profile_changed then
    select jsonb_build_object(
      'property',to_jsonb(hotel),
      'operational_profile',(public.hotel_v2_admin_get_content_control(v_hotel_id)->'operational_profile')
    ) into v_after from public.hotels hotel where hotel.id=v_hotel_id;
    insert into public.hotel_activity_log(
      hotel_id,entity_type,entity_id,action,before_state,after_state,
      actor_type,actor_id,source,correlation_id
    ) values(
      v_hotel_id,'property',v_hotel_id,'update',v_before,v_after,
      'admin',auth.uid(),'hotels_v2_admin_b_property_control',p_correlation_id
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
  into v_activity from public.hotel_activity_log activity
  where activity.correlation_id=p_correlation_id;
  return jsonb_build_object(
    'ok',true,'contract_version',c_contract,'hotel_id',v_hotel_id,
    'changed',v_property_changed or v_profile_changed,
    'property_changed',v_property_changed,
    'operational_profile_changed',v_profile_changed,
    'correlation_id',p_correlation_id,
    'workspace',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'content_control',public.hotel_v2_admin_get_content_control(v_hotel_id),
    'activity',v_activity
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_property_numeric_value';
end
$function$;

-- RPC-only raw-table boundary. Legacy public.hotels grants/policies and the
-- established shared hotel_amenities catalog remain unchanged. Trusted backend
-- service_role privileges are also unchanged.
do $admin_b_raw_authenticated_revoke$
declare v_table_name text;
begin
  foreach v_table_name in array array[
    'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_activity_log','hotel_property_operational_profiles'
  ] loop
    if to_regclass('public.'||v_table_name) is not null then
      execute format(
        'revoke all privileges on table public.%I from public,anon,authenticated',
        v_table_name
      );
    end if;
  end loop;
end
$admin_b_raw_authenticated_revoke$;

revoke all on function public.hotel_v2_admin_get_content_control(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)
  from public,anon,authenticated,service_role;

grant execute on function public.hotel_v2_admin_get_content_control(uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid) to authenticated;
-- This immutable validator is referenced by a Room CHECK constraint. Keep it
-- executable only by the trusted backend so direct service_role maintenance
-- remains compatible; browser roles cannot call it.
grant execute on function public.hotel_v2_admin_b_i18n_is_valid(jsonb,boolean,integer)
  to service_role;

alter table public.hotel_property_operational_profiles owner to postgres;
alter table public.hotel_admin_assignment_transaction_context owner to postgres;
alter function public.hotel_v2_admin_b_i18n_is_valid(jsonb,boolean,integer) owner to postgres;
alter function public.hotel_v2_admin_b_string_array_is_valid(jsonb,integer) owner to postgres;
alter function public.hotel_v2_admin_b_gallery_is_valid(jsonb,integer) owner to postgres;
alter function public.hotel_v2_admin_b_beds_are_valid(jsonb) owner to postgres;
alter function public.hotel_v2_admin_b_google_maps_url_is_valid(text) owner to postgres;
alter function public.hotel_v2_admin_b_storage_url_is_exact(text,text) owner to postgres;
alter function public.hotel_v2_admin_b_property_gallery_is_valid(uuid,jsonb,jsonb) owner to postgres;
alter function public.hotel_v2_admin_b_room_gallery_is_valid(uuid,uuid,jsonb,jsonb) owner to postgres;
alter function public.hotel_v2_admin_b_validate_stay_bounds(uuid) owner to postgres;
alter function public.hotel_v2_admin_b_stay_bounds_constraint_trigger() owner to postgres;
alter function public.hotel_v2_admin_b_partner_assignment_lock_trigger() owner to postgres;
alter function public.hotel_v2_admin_b_partner_scope_integrity_trigger() owner to postgres;
alter function public.hotel_v2_admin_b_membership_scope_reassignment_guard() owner to postgres;
alter function public.hotel_v2_admin_get_content_control(uuid) owner to postgres;
alter function public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid) owner to postgres;
alter function public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid) owner to postgres;

comment on function public.hotel_v2_admin_get_content_control(uuid) is
  'Admin-only ADMIN-B private content and exact assignment snapshot. No private field is added to legacy-public hotels.';
comment on function public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid) is
  'Admin-only reviewed property/private-profile mutation; exact stale tokens fail and semantic no-ops do not write.';
comment on function public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid) is
  'Admin-only reviewed Room CRUD/lifecycle/gallery mutation; strict media provenance, exact versions and no automatic retries.';
comment on function public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid) is
  'Admin-only future-routing Hotel assignment mutation; suppresses historical fulfillment backfill only through a closed exact transaction context.';
comment on function public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid) is
  'Admin-only strict inert property draft creation wrapper. New gallery URLs require exact Hotel storage provenance.';

do $admin_b_postconditions$
declare
  v_before hotels_v2_admin_b_protected_before%rowtype;
  v_count bigint;
  v_fingerprint text;
  v_signature text;
  v_function_definition text;
  v_snapshot jsonb;
  v_table_name text;
begin
  if exists(select 1 from public.hotel_property_operational_profiles)
     or exists(select 1 from public.hotel_admin_assignment_transaction_context) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_migration_seeded_unexpected_rows';
  end if;
  if exists(select 1 from public.hotel_room_types
    where floor_label_i18n<>'{}'::jsonb) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_existing_room_floor_not_empty';
  end if;

  for v_before in select * from hotels_v2_admin_b_protected_before
    where relation_name not in(
      'hotels','hotel_room_types','hotels_rls','h3_1p_snapshot',
      'hotel_amenities_authenticated_acl'
    )
  loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
      ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
      v_before.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_before.row_count or v_fingerprint is distinct from v_before.fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_admin_b_protected_relation_changed',
        detail=v_before.relation_name;
    end if;
  end loop;

  select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by to_jsonb(row_value)::text),'')) into v_count,v_fingerprint
  from public.hotels row_value;
  select * into v_before from hotels_v2_admin_b_protected_before where relation_name='hotels';
  if v_count<>v_before.row_count or v_fingerprint is distinct from v_before.fingerprint then
    raise exception using errcode='55000',message='hotels_v2_admin_b_legacy_hotels_changed';
  end if;

  select count(*),md5(coalesce(string_agg((to_jsonb(row_value)-'floor_label_i18n')::text,'|'
    order by (to_jsonb(row_value)-'floor_label_i18n')::text),'')) into v_count,v_fingerprint
  from public.hotel_room_types row_value;
  select * into v_before from hotels_v2_admin_b_protected_before where relation_name='hotel_room_types';
  if v_count<>v_before.row_count or v_fingerprint is distinct from v_before.fingerprint then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_existing_room_rows_changed_beyond_floor';
  end if;

  select count(*),md5(coalesce(string_agg(to_jsonb(policy_row)::text,'|'
    order by to_jsonb(policy_row)::text),'')) into v_count,v_fingerprint
  from pg_catalog.pg_policies policy_row
  where policy_row.schemaname='public' and policy_row.tablename='hotels';
  select * into v_before from hotels_v2_admin_b_protected_before where relation_name='hotels_rls';
  if v_count<>v_before.row_count or v_fingerprint is distinct from v_before.fingerprint then
    raise exception using errcode='55000',message='hotels_v2_admin_b_legacy_hotels_rls_changed';
  end if;

  if exists(select 1 from hotels_v2_admin_b_protected_before where relation_name='h3_1p_snapshot') then
    v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);
    select * into v_before from hotels_v2_admin_b_protected_before where relation_name='h3_1p_snapshot';
    if md5(v_snapshot::text) is distinct from v_before.fingerprint
       or not coalesce((v_snapshot->>'supported')::boolean,false)
       or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
       or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
       or v_snapshot#>>'{property,architecture_version}'<>'legacy'
       or (v_snapshot#>>'{target,rate_plan,is_active}')::boolean
       or exists(select 1 from jsonb_array_elements(v_snapshot#>'{target,room_rates}') rate
         where (rate->>'is_active')::boolean) then
      raise exception using errcode='55000',
        message='hotels_v2_admin_b_h3_1p_contract_changed';
    end if;
  end if;

  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_public_activation_guard';
  end if;
  if exists(select 1 from public.partner_user_resources scope_row
    join public.partner_users membership on membership.id=scope_row.partner_user_id
    where scope_row.resource_type='hotels' and not exists(
      select 1 from public.partner_resources assignment
      where assignment.partner_id=membership.partner_id
        and assignment.resource_type='hotels'
        and assignment.resource_id=scope_row.resource_id)) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_orphan_hotel_staff_scope';
  end if;

  foreach v_table_name in array array[
    'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_activity_log','hotel_property_operational_profiles'
  ] loop
    if to_regclass('public.'||v_table_name) is not null
       and (
         has_table_privilege(0::oid,('public.'||v_table_name)::regclass,'SELECT')
         or has_table_privilege(0::oid,('public.'||v_table_name)::regclass,'INSERT')
         or has_table_privilege(0::oid,('public.'||v_table_name)::regclass,'UPDATE')
         or has_table_privilege(0::oid,('public.'||v_table_name)::regclass,'DELETE')
         or has_table_privilege('anon','public.'||v_table_name,'SELECT')
         or has_table_privilege('anon','public.'||v_table_name,'INSERT')
         or has_table_privilege('anon','public.'||v_table_name,'UPDATE')
         or has_table_privilege('anon','public.'||v_table_name,'DELETE')
         or has_table_privilege('authenticated','public.'||v_table_name,'SELECT')
         or has_table_privilege('authenticated','public.'||v_table_name,'INSERT')
         or has_table_privilege('authenticated','public.'||v_table_name,'UPDATE')
         or has_table_privilege('authenticated','public.'||v_table_name,'DELETE')
         or has_table_privilege('authenticated','public.'||v_table_name,'TRUNCATE')
         or has_table_privilege('authenticated','public.'||v_table_name,'REFERENCES')
         or has_table_privilege('authenticated','public.'||v_table_name,'TRIGGER')
       ) then
      raise exception using errcode='55000',
        message='hotels_v2_admin_b_browser_raw_table_privilege_remaining',detail=v_table_name;
    end if;
  end loop;
  select * into v_before from hotels_v2_admin_b_protected_before
    where relation_name='hotel_amenities_authenticated_acl';
  if has_table_privilege('authenticated','public.hotel_amenities','SELECT')::text
       is distinct from v_before.fingerprint then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_shared_amenities_catalog_regressed';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class
      where oid='public.hotel_property_operational_profiles'::regclass)
     or has_table_privilege(0::oid,'public.hotel_property_operational_profiles'::regclass,'SELECT')
     or has_table_privilege('anon','public.hotel_property_operational_profiles','SELECT')
     or has_table_privilege('authenticated','public.hotel_property_operational_profiles','SELECT')
     or has_table_privilege('service_role','public.hotel_property_operational_profiles','SELECT')
     or has_table_privilege('authenticated','public.hotel_admin_assignment_transaction_context','SELECT') then
    raise exception using errcode='55000',message='hotels_v2_admin_b_private_table_acl_failed';
  end if;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_content_control(uuid)',
    'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
    'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'
  ] loop
    if not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege(0::oid,v_signature::regprocedure::oid,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not (select procedure.prosecdef from pg_catalog.pg_proc procedure
         where procedure.oid=v_signature::regprocedure)
       or (select array_to_string(procedure.proconfig,',') from pg_catalog.pg_proc procedure
         where procedure.oid=v_signature::regprocedure) not like '%search_path=pg_catalog%public%' then
      raise exception using errcode='55000',
        message='hotels_v2_admin_b_rpc_security_failed',detail=v_signature;
    end if;
  end loop;
  if has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_admin_b_legacy_writer_still_executable';
  end if;

  select pg_get_functiondef(
    'public.trg_partner_resources_backfill_service_fulfillments()'::regprocedure
  ) into v_function_definition;
  if v_function_definition not like '%hotels_v2_admin_b_future_assignment_only_v1%'
     or v_function_definition not like '%context_row.assignment_id=NEW.id%'
     or v_function_definition not like '%context_row.hotel_id=NEW.resource_id%'
     or v_function_definition not like '%context_row.partner_id=NEW.partner_id%' then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_assignment_backfill_guard_missing';
  end if;
  if not exists(select 1 from pg_catalog.pg_trigger trigger_row
      where trigger_row.tgrelid='public.partner_resources'::regclass
        and trigger_row.tgname='partner_resources_admin_b_hotel_assignment_lock'
        and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_catalog.pg_trigger trigger_row
      where trigger_row.tgrelid='public.partner_user_resources'::regclass
        and trigger_row.tgname='partner_user_resources_admin_b_hotel_scope_guard'
        and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_catalog.pg_trigger trigger_row
      where trigger_row.tgrelid='public.partner_users'::regclass
        and trigger_row.tgname='partner_users_admin_b_hotel_scope_reassignment_guard'
        and trigger_row.tgenabled='O' and not trigger_row.tgisinternal) then
    raise exception using errcode='55000',message='hotels_v2_admin_b_assignment_trigger_missing';
  end if;
end
$admin_b_postconditions$;

notify pgrst, 'reload schema';
commit;
