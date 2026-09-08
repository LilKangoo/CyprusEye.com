begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

-- Future, separately authorized Standard OAuth connection only. Installation
-- neither enables Stripe nor changes payment routing, prices or commissions.
do $prerequisites$
begin
  if to_regclass('public.hotel_partner_hotel_permissions') is null
    or to_regprocedure('public.hotel_v2_external_calendar_provider_evolution_is_safe()') is null then
    raise exception 'hotel_stripe_connect_requires_provider_stage';
  end if;
  if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid='public.hotel_v2_external_calendar_provider_evolution_is_safe()'::regprocedure
      and p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='s' and l.lanname='sql'
      and p.proconfig=array['search_path=pg_catalog, public']::text[]
      and encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')=
        '07c8246f8729217b497cb0e15834406fa80b1c3caf44b28f1128771a569777b3'
      and not has_function_privilege(0::oid,p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')) then
    raise exception 'hotel_stripe_connect_provider_contract_drift';
  end if;
  if (select count(*) from public.site_settings) <> 1
    or not exists(select 1 from public.site_settings where id=1 and hotel_stripe_connect_enabled is false) then
    raise exception 'hotel_stripe_connect_install_requires_disabled_flag';
  end if;
  if public.hotel_v2_external_calendar_provider_evolution_is_safe() is not true then
    raise exception 'hotel_stripe_connect_provider_boundary_unsafe';
  end if;
end
$prerequisites$;

create schema hotel_stripe_connect_private authorization postgres;
revoke all on schema hotel_stripe_connect_private from public, anon, authenticated, service_role;

create table hotel_stripe_connect_private.accounts (
  partner_id uuid primary key references public.partners(id) on delete restrict,
  account_id text not null unique check(account_id ~ '^acct_[A-Za-z0-9]{1,120}$'),
  live_mode boolean not null,
  status text not null check(status in ('ONBOARDING_INCOMPLETE','CONNECTED','RESTRICTED','ACTION_REQUIRED','DISABLED')),
  revoked boolean not null default false,
  revision bigint not null default 1 check(revision > 0),
  checked_at timestamptz not null default clock_timestamp(),
  constraint revoked_is_disabled check(not revoked or status='DISABLED')
);
create table hotel_stripe_connect_private.oauth_states (
  state text primary key check(state ~ '^[0-9a-f]{64}$'),
  actor uuid not null references auth.users(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  request_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
  claimed_at timestamptz,
  finished_at timestamptz,
  unique(actor,request_id),
  check(expires_at > created_at),
  check(finished_at is null or claimed_at is not null)
);
create table hotel_stripe_connect_private.events (
  event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]{1,120}$'),
  partner_id uuid not null references public.partners(id) on delete restrict,
  received_at timestamptz not null default clock_timestamp()
);
alter table hotel_stripe_connect_private.accounts enable row level security;
alter table hotel_stripe_connect_private.accounts force row level security;
alter table hotel_stripe_connect_private.oauth_states enable row level security;
alter table hotel_stripe_connect_private.oauth_states force row level security;
alter table hotel_stripe_connect_private.events enable row level security;
alter table hotel_stripe_connect_private.events force row level security;
revoke all on all tables in schema hotel_stripe_connect_private from public, anon, authenticated, service_role;

create function hotel_stripe_connect_private.scope(p_actor uuid,p_partner uuid,p_hotel uuid)
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare v_enabled boolean;
begin
  -- Owner-only existing onboarding capability. A Hotel assignment is required
  -- for every use, but the account identity belongs to the Partner, not Hotel.
  if p_actor is null or not exists(
    select 1 from public.partner_users member
    join public.partners partner on partner.id=member.partner_id
    join public.partner_resources assignment on assignment.partner_id=partner.id
      and assignment.resource_type='hotels' and assignment.resource_id=p_hotel
    join public.hotel_partner_hotel_permissions permission on permission.assignment_id=assignment.id
      and permission.partner_id=partner.id and permission.hotel_id=p_hotel
    where member.user_id=p_actor and member.partner_id=p_partner and member.role='owner'
      and partner.status='active' and partner.can_manage_hotels is true
      and permission.initiate_stripe_onboarding is true
  ) then
    raise exception using errcode='42501',message='hotel_stripe_connect_access_denied';
  end if;
  if (select count(*) from public.site_settings) <> 1 then
    raise exception 'hotel_stripe_connect_flag_invalid';
  end if;
  select hotel_stripe_connect_enabled into v_enabled from public.site_settings where id=1;
  if v_enabled is null then raise exception 'hotel_stripe_connect_flag_invalid'; end if;
  return v_enabled;
end
$function$;
revoke all on function hotel_stripe_connect_private.scope(uuid,uuid,uuid) from public,anon,authenticated,service_role;
alter function hotel_stripe_connect_private.scope(uuid,uuid,uuid) owner to postgres;

-- This RPC is an Edge-only persistence boundary, not a browser RPC. The Edge
-- verifies auth.getUser() and supplies that actor; no caller-supplied actor or
-- account ID is forwarded from the browser. No OAuth access/refresh token is
-- stored, logged or returned. Webhooks are signature-verified before entry.
create function public.hotel_v2_stripe_connect_service(p_action text,p_request jsonb)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,hotel_stripe_connect_private
as $function$
declare
  v_actor uuid := (p_request->>'actor')::uuid;
  v_partner uuid := (p_request->>'partner_id')::uuid;
  v_hotel uuid := (p_request->>'hotel_id')::uuid;
  v_enabled boolean;
  v_state hotel_stripe_connect_private.oauth_states%rowtype;
  v_account hotel_stripe_connect_private.accounts%rowtype;
  v_status text := p_request->>'status';
  v_rows integer;
begin
  if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>4096 then
    raise exception 'hotel_stripe_connect_request_invalid';
  end if;
  if p_action in ('event_context','event') then
    if jsonb_typeof(p_request->'live_mode') is distinct from 'boolean' then
      raise exception 'hotel_stripe_connect_mode_invalid';
    end if;
    select * into v_account from hotel_stripe_connect_private.accounts
      where account_id=p_request->>'account_id' and live_mode=(p_request->>'live_mode')::boolean for update;
    if not found then return null; end if;
    if p_action='event_context' then return jsonb_build_object('revision',v_account.revision); end if;
    if jsonb_typeof(p_request->'revoked') is distinct from 'boolean' or v_status is null
      or v_status not in ('CONNECTED','ONBOARDING_INCOMPLETE','RESTRICTED','ACTION_REQUIRED','DISABLED') then
      raise exception 'hotel_stripe_connect_event_invalid';
    end if;
    insert into hotel_stripe_connect_private.events(event_id,partner_id)
      values(p_request->>'event_id',v_account.partner_id) on conflict do nothing;
    get diagnostics v_rows=row_count;
    if v_rows=0 then return jsonb_build_object('duplicate',true); end if;
    if (p_request->>'revoked')::boolean then
      update hotel_stripe_connect_private.accounts set revoked=true,status='DISABLED',
        revision=revision+1,checked_at=clock_timestamp() where partner_id=v_account.partner_id;
    elsif not v_account.revoked then
      if v_account.revision is distinct from (p_request->>'expected_revision')::bigint then
        -- Roll back deduplication too; Stripe can redeliver and re-read current
        -- account state. Never acknowledge an event lost to a refresh race.
        raise exception using errcode='40001',message='hotel_stripe_connect_revision_conflict';
      end if;
      update hotel_stripe_connect_private.accounts set status=v_status,
        revision=revision+1,checked_at=clock_timestamp() where partner_id=v_account.partner_id;
    end if;
    return jsonb_build_object('reconciled',true);
  end if;
  if p_action in ('claim','finish') then
    select * into v_state from hotel_stripe_connect_private.oauth_states
      where state=p_request->>'state' and actor=v_actor for update;
    if not found or v_state.expires_at<=clock_timestamp() or v_state.finished_at is not null then
      raise exception 'hotel_stripe_connect_state_invalid';
    end if;
    v_partner:=v_state.partner_id; v_hotel:=v_state.hotel_id;
  end if;
  v_enabled:=hotel_stripe_connect_private.scope(v_actor,v_partner,v_hotel);
  if p_action='scope' then return jsonb_build_object('authorized',true,'enabled',v_enabled); end if;
  if not v_enabled then raise exception using errcode='42501',message='hotel_stripe_connect_disabled'; end if;
  if p_action='status' then
    select * into v_account from hotel_stripe_connect_private.accounts where partner_id=v_partner;
    if not found then return jsonb_build_object('status','NOT_CONNECTED'); end if;
    return jsonb_build_object('status',v_account.status,'account_id',v_account.account_id,
      'live_mode',v_account.live_mode,'revision',v_account.revision,'revoked',v_account.revoked,
      'checked_at',v_account.checked_at);
  end if;
  -- Serialize connection transitions per Partner across all its Hotels.
  perform 1 from public.partners where id=v_partner for update;
  select * into v_account from hotel_stripe_connect_private.accounts where partner_id=v_partner for update;
  if p_action='begin' then
    select * into v_state from hotel_stripe_connect_private.oauth_states
      where actor=v_actor and request_id=(p_request->>'request_id')::uuid;
    if found then
      if v_state.partner_id<>v_partner or v_state.hotel_id<>v_hotel or v_state.claimed_at is not null
        or v_state.expires_at<=clock_timestamp() then raise exception 'hotel_stripe_connect_idempotency_conflict'; end if;
    else
      if (select count(*) from hotel_stripe_connect_private.oauth_states
        where actor=v_actor and finished_at is null and expires_at>clock_timestamp())>=5 then
        raise exception 'hotel_stripe_connect_pending_limit';
      end if;
      insert into hotel_stripe_connect_private.oauth_states(state,actor,partner_id,hotel_id,request_id)
        values(p_request->>'state',v_actor,v_partner,v_hotel,(p_request->>'request_id')::uuid)
        returning * into v_state;
    end if;
    return jsonb_build_object('state',v_state.state);
  elsif p_action='claim' then
    if v_state.claimed_at is not null then raise exception 'hotel_stripe_connect_state_claimed'; end if;
    update hotel_stripe_connect_private.oauth_states set claimed_at=clock_timestamp() where state=v_state.state;
    return jsonb_build_object('partner_id',v_partner,'hotel_id',v_hotel);
  elsif p_action='finish' then
    if v_state.claimed_at is null or jsonb_typeof(p_request->'live_mode') is distinct from 'boolean' then
      raise exception 'hotel_stripe_connect_exchange_invalid';
    end if;
    if v_status is null or v_status not in ('CONNECTED','ONBOARDING_INCOMPLETE','RESTRICTED','ACTION_REQUIRED') then
      raise exception 'hotel_stripe_connect_status_invalid';
    end if;
    if v_account.partner_id is not null and (v_account.account_id is distinct from p_request->>'account_id'
      or v_account.live_mode is distinct from (p_request->>'live_mode')::boolean) then
      raise exception 'hotel_stripe_connect_account_replacement_forbidden';
    end if;
    insert into hotel_stripe_connect_private.accounts(partner_id,account_id,live_mode,status)
      values(v_partner,p_request->>'account_id',(p_request->>'live_mode')::boolean,v_status)
      on conflict(partner_id) do update set status=excluded.status,revoked=false,
        revision=accounts.revision+1,checked_at=clock_timestamp() returning * into v_account;
    update hotel_stripe_connect_private.oauth_states set finished_at=clock_timestamp() where state=v_state.state;
  elsif p_action='refresh' then
    if v_account.account_id is distinct from p_request->>'account_id' or v_account.revoked
      or v_account.revision is distinct from (p_request->>'expected_revision')::bigint then
      raise exception 'hotel_stripe_connect_revision_conflict';
    end if;
    update hotel_stripe_connect_private.accounts set status=v_status,revision=revision+1,
      checked_at=clock_timestamp() where partner_id=v_partner returning * into v_account;
  elsif p_action<>'status' then
    raise exception 'hotel_stripe_connect_action_invalid';
  end if;
  if v_account.partner_id is null then return jsonb_build_object('status','NOT_CONNECTED'); end if;
  return jsonb_build_object('status',v_account.status,'account_id',v_account.account_id,
    'live_mode',v_account.live_mode,'revision',v_account.revision,'revoked',v_account.revoked,
    'checked_at',v_account.checked_at);
end
$function$;
alter function public.hotel_v2_stripe_connect_service(text,jsonb) owner to postgres;
revoke all on function public.hotel_v2_stripe_connect_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.hotel_v2_stripe_connect_service(text,jsonb) to service_role;

do $postconditions$
begin
  if exists(select 1 from hotel_stripe_connect_private.accounts)
    or exists(select 1 from hotel_stripe_connect_private.oauth_states)
    or exists(select 1 from hotel_stripe_connect_private.events)
    or not exists(select 1 from public.site_settings where id=1 and hotel_stripe_connect_enabled is false)
    or has_function_privilege('authenticated','public.hotel_v2_stripe_connect_service(text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.hotel_v2_stripe_connect_service(text,jsonb)','EXECUTE')
    or has_function_privilege(0::oid,'public.hotel_v2_stripe_connect_service(text,jsonb)','EXECUTE') then
    raise exception 'hotel_stripe_connect_install_postcondition_failed';
  end if;
end
$postconditions$;
commit;
