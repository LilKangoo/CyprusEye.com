-- Local future stage: separate explicit Admin authorization per Partner.
-- This is NOT the platform flag activation stage. Installation grants nobody,
-- changes no flag and does not rewrite the immutable 114360 Hotel preset.
begin;
set local lock_timeout='15s';
set local statement_timeout='120s';

do $preconditions$
begin
  if to_regclass('hotel_stripe_connect_private.accounts') is null
     or to_regprocedure('hotel_stripe_connect_private.scope(uuid,uuid,uuid)') is null
     or to_regclass('hotel_stripe_connect_private.onboarding_authorizations') is not null then
    raise exception 'hotel_stripe_authorization_install_boundary_invalid';
  end if;
  if exists(select 1 from (values
      ('hotel_stripe_connect_private.scope(uuid,uuid,uuid)',
        '38c1f9e1448f6632712ea5e4ba22b2ccc9fd481d784b5b1f586e17a07b71e100',
        array['search_path=pg_catalog, public']::text[],'plpgsql','s'::"char"),
      ('public.hotel_v2_h2a_require_admin()',
        '2f1cc975916dbc86a63d348135a2ff83de50d9f31c20e70219257d476296fa3d',
        array['search_path=pg_catalog, public, auth']::text[],'plpgsql','s'::"char"),
      ('public.is_current_user_admin()',
        '581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255',
        array['search_path=public']::text[],'plpgsql','s'::"char"),
      ('public.hotel_v2_stripe_connect_service(text,jsonb)',
        '51edcefdd3a898db8550aff6b290b1d6b3c8f633f3684458ed1fbf17d5558f32',
        array['search_path=pg_catalog, public, hotel_stripe_connect_private']::text[],'plpgsql','v'::"char")
    ) e(signature,source_hash,path,language,volatility) left join pg_proc p on p.oid=to_regprocedure(e.signature)
    left join pg_language l on l.oid=p.prolang
    where p.oid is null or p.proowner<>'postgres'::regrole or not p.prosecdef
      or p.provolatile is distinct from e.volatility or l.lanname is distinct from e.language
      or p.proconfig is distinct from e.path
      or encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from e.source_hash
      -- 042 body; 153/164/165/166 applied policy-helper security contract.
      or (e.signature='public.is_current_user_admin()' and (
        (select jsonb_agg(jsonb_build_array(
          case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
          pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
          order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
            pg_get_userbyid(a.grantor),a.privilege_type)
         from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)
          is distinct from '[["anon","postgres","EXECUTE",false],["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false],["service_role","postgres","EXECUTE",false]]'::jsonb
        or has_function_privilege(0::oid,p.oid,'EXECUTE') is distinct from false
        or has_function_privilege('anon',p.oid,'EXECUTE') is distinct from true
        or has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from true
        or has_function_privilege('service_role',p.oid,'EXECUTE') is distinct from true
      ))) then
    raise exception 'hotel_stripe_authorization_source_security_drift';
  end if;
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_instant_booking_enabled
       and not hotel_stripe_connect_enabled and hotel_external_sync_enabled is not null)
     or public.hotel_v2_external_calendar_provider_evolution_is_safe() is not true then
    raise exception 'hotel_stripe_authorization_requires_safe_disabled_boundary';
  end if;
end
$preconditions$;

create table hotel_stripe_connect_private.onboarding_authorizations (
  partner_id uuid not null references public.partners(id) on delete restrict,
  version bigint not null check(version>0),
  enabled boolean not null,
  previous_enabled boolean not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  reason text not null check(length(reason) between 10 and 1000 and reason=btrim(reason)),
  created_at timestamptz not null default clock_timestamp() check(isfinite(created_at)),
  previous_hash text not null check(previous_hash ~ '^[0-9a-f]{64}$'),
  receipt_hash text not null check(receipt_hash ~ '^[0-9a-f]{64}$'),
  primary key(partner_id,version),
  unique(actor_id,request_id),
  check(enabled<>previous_enabled)
);
alter table hotel_stripe_connect_private.onboarding_authorizations owner to postgres;
alter table hotel_stripe_connect_private.onboarding_authorizations enable row level security;
alter table hotel_stripe_connect_private.onboarding_authorizations force row level security;
revoke all on hotel_stripe_connect_private.onboarding_authorizations from public,anon,authenticated,service_role;

create function hotel_stripe_connect_private.authorization_receipt_hash(p_row jsonb)
returns text language sql immutable strict
set search_path=pg_catalog,public
as $function$
  select encode(extensions.digest(convert_to(
    jsonb_build_object('contract_version','hotels_v2_partner_stripe_onboarding_receipt_v1',
      'partner_id',p_row->>'partner_id','version',(p_row->>'version')::bigint,
      'enabled',(p_row->>'enabled')::boolean,'previous_enabled',(p_row->>'previous_enabled')::boolean,
      'actor_id',p_row->>'actor_id','request_id',p_row->>'request_id',
      'reason',p_row->>'reason','previous_hash',p_row->>'previous_hash',
      'created_at_us',(extract(epoch from (p_row->>'created_at')::timestamptz)*1000000)::bigint
    )::text,'UTF8'),'sha256'),'hex');
$function$;

create function hotel_stripe_connect_private.authorization_state(p_partner uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_row record;v_version bigint:=0;v_enabled boolean:=false;v_hash text:=repeat('0',64);
begin
  if p_partner is null then raise exception 'hotel_stripe_authorization_partner_required';end if;
  for v_row in select * from hotel_stripe_connect_private.onboarding_authorizations
    where partner_id=p_partner order by version loop
    if v_row.version<>v_version+1 or v_row.previous_enabled is distinct from v_enabled
       or v_row.enabled is not distinct from v_enabled
       or v_row.previous_hash is distinct from v_hash
       or v_row.receipt_hash is distinct from
          hotel_stripe_connect_private.authorization_receipt_hash(to_jsonb(v_row)) then
      raise exception 'hotel_stripe_authorization_chain_invalid';
    end if;
    v_version:=v_row.version;v_enabled:=v_row.enabled;v_hash:=v_row.receipt_hash;
  end loop;
  return jsonb_build_object('version',v_version,'enabled',v_enabled,'receipt_hash',v_hash);
end
$function$;

create function hotel_stripe_connect_private.guard_authorization_receipt()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_state jsonb;
begin
  if tg_op<>'INSERT' then raise exception 'hotel_stripe_authorization_receipt_immutable';end if;
  if auth.uid() is null or new.actor_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='hotel_stripe_authorization_admin_required';
  end if;
  perform public.hotel_v2_h2a_require_admin();
  perform pg_advisory_xact_lock(hashtextextended('hotels-stripe-authorization:'||new.partner_id::text,0));
  v_state:=hotel_stripe_connect_private.authorization_state(new.partner_id);
  if new.version<>(v_state->>'version')::bigint+1
     or new.previous_enabled is distinct from (v_state->>'enabled')::boolean
     or new.enabled is not distinct from new.previous_enabled
     or new.previous_hash is distinct from v_state->>'receipt_hash'
     or new.receipt_hash is distinct from
       hotel_stripe_connect_private.authorization_receipt_hash(to_jsonb(new)) then
    raise exception 'hotel_stripe_authorization_receipt_invalid';
  end if;
  return new;
end
$function$;
create trigger stripe_onboarding_authorization_guard
before insert or update or delete on hotel_stripe_connect_private.onboarding_authorizations
for each row execute function hotel_stripe_connect_private.guard_authorization_receipt();
create trigger stripe_onboarding_authorization_no_truncate
before truncate on hotel_stripe_connect_private.onboarding_authorizations
for each statement execute function hotel_stripe_connect_private.guard_authorization_receipt();

create function public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(
  p_partner_id uuid,p_enabled boolean,p_expected_version bigint,p_request_id uuid,p_reason text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_actor uuid:=auth.uid();v_state jsonb;v_existing record;v_row jsonb;v_version bigint;
  v_created_at timestamptz:=clock_timestamp();
begin
  if v_actor is null then
    raise exception using errcode='42501',message='hotel_stripe_authorization_admin_required';
  end if;
  perform public.hotel_v2_h2a_require_admin();
  if p_partner_id is null or p_enabled is null or p_expected_version is null
     or p_expected_version<0 or p_request_id is null or p_reason is null
     or length(p_reason) not between 10 and 1000 or p_reason<>btrim(p_reason) then
    raise exception using errcode='22023',message='hotel_stripe_authorization_invalid_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('hotels-stripe-authorization-request:'||
    v_actor::text||':'||p_request_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-stripe-authorization:'||p_partner_id::text,0));
  -- Share the 114460 connection writer's Partner lock. Its post-lock scope
  -- recheck below prevents a revocation racing an OAuth state/binding write.
  perform 1 from public.partners where id=p_partner_id for update;
  -- Revocation remains possible for an inactive/unassigned Partner.
  if not exists(select 1 from public.partners where id=p_partner_id)
     or (p_enabled and not exists(select 1 from public.partners p
       join public.partner_resources a on a.partner_id=p.id and a.resource_type='hotels'
       join public.hotels h on h.id=a.resource_id
       where p.id=p_partner_id and p.status='active' and p.can_manage_hotels
         and exists(select 1 from public.partner_users m where m.partner_id=p.id and m.role='owner'))) then
    raise exception using errcode='42501',message='hotel_stripe_authorization_partner_not_eligible';
  end if;
  v_state:=hotel_stripe_connect_private.authorization_state(p_partner_id);
  select * into v_existing from hotel_stripe_connect_private.onboarding_authorizations
    where actor_id=v_actor and request_id=p_request_id;
  if found then
    if v_existing.partner_id is distinct from p_partner_id or v_existing.enabled is distinct from p_enabled
       or v_existing.version<>p_expected_version+1 or v_existing.reason is distinct from p_reason then
      raise exception using errcode='PT409',message='hotel_stripe_authorization_idempotency_conflict';
    end if;
    return jsonb_build_object('contract_version','hotels_v2_partner_stripe_authorization_result_v1',
      'partner_id',p_partner_id,'version',v_existing.version,'enabled',v_existing.enabled,'replayed',true,
      'current_version',(v_state->>'version')::bigint,'current_enabled',(v_state->>'enabled')::boolean);
  end if;
  if (v_state->>'version')::bigint<>p_expected_version
     or (v_state->>'enabled')::boolean is not distinct from p_enabled then
    raise exception using errcode='PT409',message='hotel_stripe_authorization_stale_or_unchanged';
  end if;
  v_version:=p_expected_version+1;
  v_row:=jsonb_build_object('partner_id',p_partner_id,'version',v_version,'enabled',p_enabled,
    'previous_enabled',(v_state->>'enabled')::boolean,'actor_id',v_actor,
    'request_id',p_request_id,'reason',p_reason,'previous_hash',v_state->>'receipt_hash','created_at',v_created_at);
  insert into hotel_stripe_connect_private.onboarding_authorizations(
    partner_id,version,enabled,previous_enabled,actor_id,request_id,reason,previous_hash,receipt_hash,created_at)
    values(p_partner_id,v_version,p_enabled,(v_state->>'enabled')::boolean,v_actor,p_request_id,p_reason,
      v_state->>'receipt_hash',hotel_stripe_connect_private.authorization_receipt_hash(v_row),v_created_at);
  return jsonb_build_object('contract_version','hotels_v2_partner_stripe_authorization_result_v1',
    'partner_id',p_partner_id,'version',v_version,'enabled',p_enabled,'replayed',false,
    'current_version',v_version,'current_enabled',p_enabled);
end
$function$;

create function public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(p_partner_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_state jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='hotel_stripe_authorization_admin_required';end if;
  perform public.hotel_v2_h2a_require_admin();
  if p_partner_id is null or not exists(select 1 from public.partners where id=p_partner_id) then
    raise exception using errcode='22023',message='hotel_stripe_authorization_partner_required';end if;
  v_state:=hotel_stripe_connect_private.authorization_state(p_partner_id);
  return jsonb_build_object('contract_version','hotels_v2_partner_stripe_authorization_control_v1',
    'partner_id',p_partner_id,'version',(v_state->>'version')::bigint,'enabled',(v_state->>'enabled')::boolean,
    'platform_enabled',(select hotel_stripe_connect_enabled from public.site_settings where id=1));
end
$function$;

-- Only the unapplied 114460 module evolves. Owner membership, active Partner,
-- exact Hotel assignment and permission-row identity remain required. The new
-- separately reviewed Partner grant supersedes neither prices nor Hotel ACLs.
do $evolve_scope$
declare v_definition text;v_needle text:='and permission.initiate_stripe_onboarding is true';
begin
  v_definition:=pg_get_functiondef('hotel_stripe_connect_private.scope(uuid,uuid,uuid)'::regprocedure);
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
    raise exception 'hotel_stripe_authorization_scope_patch_mismatch';end if;
  execute replace(v_definition,v_needle,
    'and (hotel_stripe_connect_private.authorization_state(p_partner)->>''enabled'')::boolean is true');
end
$evolve_scope$;

do $evolve_writer$
declare v_definition text;
  v_needle text:='perform 1 from public.partners where id=v_partner for update;';
begin
  v_definition:=pg_get_functiondef('public.hotel_v2_stripe_connect_service(text,jsonb)'::regprocedure);
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
    raise exception 'hotel_stripe_authorization_writer_patch_mismatch';end if;
  execute replace(v_definition,v_needle,v_needle||E'\n  if hotel_stripe_connect_private.scope(v_actor,v_partner,v_hotel) is not true then\n    raise exception using errcode=''42501'',message=''hotel_stripe_connect_disabled'';\n  end if;');
end
$evolve_writer$;

alter function hotel_stripe_connect_private.authorization_receipt_hash(jsonb) owner to postgres;
alter function hotel_stripe_connect_private.authorization_state(uuid) owner to postgres;
alter function hotel_stripe_connect_private.guard_authorization_receipt() owner to postgres;
alter function public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text) owner to postgres;
alter function public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid) owner to postgres;
revoke all on function hotel_stripe_connect_private.authorization_receipt_hash(jsonb),
  hotel_stripe_connect_private.authorization_state(uuid),
  hotel_stripe_connect_private.guard_authorization_receipt(),
  public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text),
  public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)
  from public,anon,authenticated,service_role;
grant execute on function
  public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text),
  public.hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid) to authenticated;

do $postconditions$
begin
  if exists(select 1 from hotel_stripe_connect_private.onboarding_authorizations)
     or public.hotel_v2_external_calendar_provider_evolution_is_safe() is not true
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or has_table_privilege('authenticated','hotel_stripe_connect_private.onboarding_authorizations','SELECT')
     or has_table_privilege('service_role','hotel_stripe_connect_private.onboarding_authorizations','INSERT') then
    raise exception 'hotel_stripe_authorization_install_postcondition_failed';end if;
end
$postconditions$;
notify pgrst,'reload schema';
commit;
