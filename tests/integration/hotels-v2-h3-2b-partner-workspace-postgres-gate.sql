\set ON_ERROR_STOP on
begin;

-- Purpose-specific owner probe: the authenticated gate must not acquire raw
-- relation privileges merely to prove that reviewed writes preserve Hotel
-- bytes and create only a pending private proposal.
create or replace function pg_temp.h3_2b_owner_probe(p_hotel_id uuid)
returns jsonb language sql security definer
set search_path=pg_catalog,public
as $probe$
  select jsonb_build_object(
    'hotel_fingerprint',(select md5(to_jsonb(hotel)::text) from public.hotels hotel
      where hotel.id=p_hotel_id),
    'pending_property_draft',exists(select 1 from public.hotel_partner_property_drafts draft
      where draft.hotel_id=p_hotel_id and draft.status='pending_admin_review'))
$probe$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);

do $gate$
declare c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_rgb constant uuid:='c1000000-0000-4000-8000-000000000001';
  v_workspace jsonb; v_before_hotel jsonb; v_preview jsonb; v_result jsonb; v_replay jsonb;
  v_draft jsonb; v_rate jsonb; v_tier jsonb; v_room uuid; v_failed boolean;
begin
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+7);
  if v_workspace->>'contract_version'<>'hotels_v2_h3_2b_partner_workspace_v1'
     or v_workspace->>'hotel_id'<>c_hotel::text
     or v_workspace#>>'{pricing,commission_policy,commission_mode}'<>'per_allocated_room_per_night'
     or (v_workspace#>>'{pricing,commission_policy,amount}')::numeric<>10
     or v_workspace#>>'{pricing,commission_policy,currency}'<>'EUR'
     or (v_workspace#>>'{pricing,commission_policy,read_only}')::boolean is not true
     or v_workspace->'feature_flags'<>jsonb_build_object('hotel_rooms_v2_enabled',false,
       'hotel_external_sync_enabled',false,'hotel_instant_booking_enabled',false,
       'hotel_stripe_connect_enabled',false)
     or (v_workspace->>'legacy_authoritative')::boolean is not true
     or (v_workspace->>'public_change')::boolean is not false then
    raise exception 'h3_2b_workspace_contract_failed'; end if;

  v_before_hotel:=pg_temp.h3_2b_owner_probe(c_hotel)->'hotel_fingerprint';
  v_draft:=jsonb_build_object('contract_version','hotels_v2_h3_2b_content_draft_v1',
    'partner_id',c_partner,'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token',
    'intent',jsonb_build_object('entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','Partner draft Hotel','en','Partner Hotel draft','he','טיוטת מלון שותף')),
      'reason','Partner content review'));
  v_preview:=public.hotel_v2_partner_preview_content_plan(v_draft);
  if not (v_preview->>'changed')::boolean or jsonb_array_length(v_preview#>'{reviewed_plan,operations}')<>1
     or v_preview#>>'{reviewed_plan,operations,0,entity}'<>'property_content' then
    raise exception 'h3_2b_content_preview_failed'; end if;
  v_result:=public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38100000-0000-4000-8000-000000000001','38200000-0000-4000-8000-000000000001');
  if v_result->>'contract_version'<>'hotels_v2_h3_2b_content_apply_result_v1'
     or jsonb_array_length(v_result->'activity')<>1 or v_result->'workspace'<>'null'::jsonb
     or pg_temp.h3_2b_owner_probe(c_hotel)->'hotel_fingerprint' is distinct from v_before_hotel
     or not (pg_temp.h3_2b_owner_probe(c_hotel)->>'pending_property_draft')::boolean then
    raise exception 'h3_2b_property_draft_apply_failed'; end if;
  v_replay:=public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38100000-0000-4000-8000-000000000001','38200000-0000-4000-8000-000000000001');
  if not (v_replay->>'replayed')::boolean or v_replay->>'idempotency_key'<>'38200000-0000-4000-8000-000000000001' then
    raise exception 'h3_2b_content_replay_failed'; end if;
  v_failed:=false;
  begin perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '38100000-0000-4000-8000-000000000001','38200000-0000-4000-8000-000000000009');
  exception when sqlstate 'PT409' then v_failed:=true; end;
  if not v_failed then raise exception 'h3_2b_correlation_key_conflict_allowed'; end if;

  -- The accepted 7 Kamares graph remains immutable even for a capable Partner.
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+7);
  select value into v_rate from jsonb_array_elements(v_workspace#>'{pricing,room_rates}') value limit 1;
  v_failed:=false;
  begin perform public.hotel_v2_partner_preview_pricing_plan(jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_pricing_draft_v1','partner_id',c_partner,'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}','example_stay',null,
    'intent',jsonb_build_object('entity','room_rate_price','action','update','id',v_rate->'id',
      'payload',jsonb_build_object('nightly_rate',(v_rate->>'base_nightly_rate')::numeric+1),
      'reason','Immutable graph probe')));
  exception when sqlstate '23514' then v_failed:=true; end;
  if not v_failed then raise exception 'h3_2b_7k_price_mutation_allowed'; end if;

  -- A non-promoted Hotel supports one reviewed shadow price mutation.
  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_rgb,current_date,current_date+7);
  select value into v_rate from jsonb_array_elements(v_workspace#>'{pricing,room_rates}') value
    where coalesce((value->>'base_nightly_rate_authoritative')::boolean,false) limit 1;
  if v_rate is not null then
    v_draft:=jsonb_build_object('contract_version','hotels_v2_h3_2b_pricing_draft_v1',
      'partner_id',c_partner,'hotel_id',c_rgb,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}','example_stay',null,
      'intent',jsonb_build_object('entity','room_rate_price','action','update','id',v_rate->'id',
        'payload',jsonb_build_object('nightly_rate',(v_rate->>'base_nightly_rate')::numeric+1),
        'reason','Partner price review'));
  else
    select value into v_tier from jsonb_array_elements(v_workspace#>'{pricing,room_rate_tiers}') value limit 1;
    if v_tier is null then raise exception 'h3_2b_fixture_has_no_editable_price'; end if;
    v_draft:=jsonb_build_object('contract_version','hotels_v2_h3_2b_pricing_draft_v1',
      'partner_id',c_partner,'hotel_id',c_rgb,
      'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
      'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}','example_stay',null,
      'intent',jsonb_build_object('entity','room_rate_tier_price','action','update','id',v_tier->'id',
        'payload',jsonb_build_object('nightly_rate',(v_tier->>'nightly_rate')::numeric+1),
        'reason','Partner tier review'));
  end if;
  v_preview:=public.hotel_v2_partner_preview_pricing_plan(v_draft);
  if not (v_preview->>'changed')::boolean or v_preview->'commercial_before' is null
     or v_preview->'commercial_after' is null then raise exception 'h3_2b_pricing_preview_failed'; end if;
  v_result:=public.hotel_v2_partner_apply_pricing_plan(v_preview->'reviewed_plan',
    '38100000-0000-4000-8000-000000000002','38200000-0000-4000-8000-000000000002');
  if jsonb_array_length(v_result->'activity')<>1 then raise exception 'h3_2b_pricing_apply_failed'; end if;

  v_workspace:=public.hotel_v2_partner_get_workspace(c_partner,c_rgb,current_date+10,current_date+10);
  select (value->>'id')::uuid into v_room from jsonb_array_elements(v_workspace->'rooms') value
    where value->>'status'='active' limit 1;
  if v_room is null then raise exception 'h3_2b_fixture_has_no_active_room'; end if;
  v_draft:=jsonb_build_object('contract_version','hotels_v2_h3_2b_availability_draft_v1',
    'partner_id',c_partner,'hotel_id',c_rgb,'from',current_date+10,'to',current_date+10,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'availability_snapshot_token',v_workspace#>>'{availability,snapshot_token}',
    'intent',jsonb_build_object('entity','daily_inventory','action','upsert','id',null,
      'payload',jsonb_build_object('room_type_id',v_room,'stay_date',current_date+10,
        'closed',true,'closed_mode','set'),'reason','Partner inventory review'));
  v_preview:=public.hotel_v2_partner_preview_availability_plan(v_draft);
  v_result:=public.hotel_v2_partner_apply_availability_plan(v_preview->'reviewed_plan',
    '38100000-0000-4000-8000-000000000003','38200000-0000-4000-8000-000000000003');
  if jsonb_array_length(v_result->'activity')<>1 then raise exception 'h3_2b_availability_apply_failed'; end if;

  v_failed:=false;
  begin perform public.hotel_v2_partner_get_workspace(c_partner,c_hotel,current_date,current_date+1);
  exception when sqlstate '42501' then v_failed:=true; end;
  -- The current actor is assigned, so this exact call must remain allowed.
  if v_failed then raise exception 'h3_2b_assigned_owner_denied'; end if;
end
$gate$;
commit;

-- Role/raw surface assertions run as the database owner.
do $security$
begin
  if exists(select 1 from (values('hotel_partner_property_drafts'),
      ('hotel_partner_workspace_plan_reviews'),('hotel_partner_workspace_foundation_receipts')) relation(name),
      unnest(array['anon','authenticated','service_role']) role_name(name),
      unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
      where has_table_privilege(role_name.name,'public.'||relation.name,privilege_name.name)
         or has_table_privilege(0::oid,'public.'||relation.name,privilege_name.name)) then
    raise exception 'h3_2b_raw_acl_failed'; end if;
end
$security$;

\ir ../../supabase/manual/hotels_v2_h3_2b_partner_hotel_workspace_post_partner_verify.sql
select true as hotels_v2_h3_2b_partner_workspace_postgres_gate_pass;
