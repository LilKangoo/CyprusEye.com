-- Special Offers 3C.7C - persistent partner attribution for entries.
-- Prepared for manual execution only. Do not run from Codex.
--
-- Scope:
-- - public.special_offer_entry_referrals
-- - backend-only referral resolution for newly created Special Offer entries
-- - six-argument submit wrapper preserving the existing four-argument submit RPC
--
-- Out of scope:
-- - commissions, payouts, partner participant lists, winner workflow, score changes

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing required table public.profiles';
  end if;
  if to_regclass('public.partners') is null then
    raise exception 'Missing required table public.partners';
  end if;
  if to_regclass('public.partner_users') is null then
    raise exception 'Missing required table public.partner_users';
  end if;
  if to_regclass('public.special_offer_entries') is null then
    raise exception 'Missing required table public.special_offer_entries';
  end if;
  if to_regclass('public.special_offer_audit_log') is null then
    raise exception 'Missing required table public.special_offer_audit_log';
  end if;
  if to_regprocedure('public.resolve_referral_code(text)') is null then
    raise exception 'Missing required helper public.resolve_referral_code(text)';
  end if;
  if to_regprocedure('public.normalize_referral_code(text)') is null then
    raise exception 'Missing required helper public.normalize_referral_code(text)';
  end if;
  if to_regprocedure('public.generate_profile_referral_code(uuid,text)') is null then
    raise exception 'Missing required helper public.generate_profile_referral_code(uuid,text)';
  end if;
  if to_regprocedure('public.affiliate_get_user_partner_id(uuid)') is null then
    raise exception 'Missing required helper public.affiliate_get_user_partner_id(uuid)';
  end if;
  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
  if to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is null then
    raise exception 'Missing required submit RPC public.submit_special_offer_entry(text,text,jsonb,uuid)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.special_offer_entries'::regclass
      and conname = 'special_offer_entries_id_offer_key'
  ) then
    alter table public.special_offer_entries
      add constraint special_offer_entries_id_offer_key unique (id, offer_id);
  end if;
end;
$$;

create table if not exists public.special_offer_entry_referrals (
  entry_id uuid primary key,
  offer_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  referrer_user_id uuid references public.profiles(id) on delete set null,
  referral_code_snapshot text not null,
  referral_source text not null,
  referral_captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint special_offer_entry_referrals_entry_offer_fkey
    foreign key (entry_id, offer_id)
    references public.special_offer_entries(id, offer_id)
    on delete cascade,
  constraint special_offer_entry_referrals_code_check check (
    length(btrim(referral_code_snapshot)) between 1 and 64
    and referral_code_snapshot !~ '[[:space:][:cntrl:]]'
  ),
  constraint special_offer_entry_referrals_source_check check (
    referral_source in ('profile_first_touch', 'url', 'stored', 'manual', 'unknown')
  )
);

create index if not exists idx_special_offer_entry_referrals_offer
  on public.special_offer_entry_referrals(offer_id, created_at desc);

create index if not exists idx_special_offer_entry_referrals_partner
  on public.special_offer_entry_referrals(partner_id, created_at desc);

create index if not exists idx_special_offer_entry_referrals_referrer
  on public.special_offer_entry_referrals(referrer_user_id)
  where referrer_user_id is not null;

alter table public.special_offer_entry_referrals enable row level security;

revoke all on table public.special_offer_entry_referrals from public, anon, authenticated;
grant select on table public.special_offer_entry_referrals to authenticated;
grant all on table public.special_offer_entry_referrals to service_role;

drop policy if exists special_offer_entry_referrals_admin_select
  on public.special_offer_entry_referrals;
create policy special_offer_entry_referrals_admin_select
  on public.special_offer_entry_referrals
  for select
  to authenticated
  using (public.is_current_user_admin());

create or replace function public.special_offer_resolve_entry_referral(
  p_user_id uuid,
  p_referral_code text,
  p_referral_source text
)
returns table (
  partner_id uuid,
  referrer_user_id uuid,
  referral_code_snapshot text,
  referral_source text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile record;
  v_match record;
  v_partner_id uuid;
  v_code text := public.normalize_referral_code(p_referral_code);
  v_source text := lower(btrim(coalesce(p_referral_source, '')));
begin
  if p_user_id is null then
    return;
  end if;

  if v_source not in ('url', 'stored', 'manual') then
    v_source := 'unknown';
  end if;

  select p.id, p.referred_by
    into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return;
  end if;

  if v_profile.referred_by is not null then
    v_partner_id := public.affiliate_get_user_partner_id(v_profile.referred_by);
    if v_partner_id is null or not exists (
      select 1
      from public.partners p
      where p.id = v_partner_id
        and p.status = 'active'
    ) then
      return;
    end if;

    select
      v_partner_id,
      referrer.id,
      coalesce(nullif(btrim(referrer.referral_code), ''), public.generate_profile_referral_code(referrer.id, null)),
      'profile_first_touch'::text
    into partner_id, referrer_user_id, referral_code_snapshot, referral_source
    from public.profiles referrer
    where referrer.id = v_profile.referred_by
    limit 1;

    if partner_id is not null and referral_code_snapshot is not null then
      return next;
    end if;
    return;
  end if;

  if v_code is null then
    return;
  end if;

  select *
    into v_match
  from public.resolve_referral_code(v_code)
  limit 1;

  if v_match.referrer_user_id is null
     or v_match.referrer_user_id = p_user_id
     or v_match.partner_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.partners p
    where p.id = v_match.partner_id
      and p.status = 'active'
  ) then
    return;
  end if;

  update public.profiles p
     set referred_by = v_match.referrer_user_id
   where p.id = p_user_id
     and p.referred_by is null;

  partner_id := v_match.partner_id;
  referrer_user_id := v_match.referrer_user_id;
  referral_code_snapshot := v_match.referral_code;
  referral_source := v_source;
  return next;
end;
$$;

create or replace function public.submit_special_offer_entry(
  p_offer_slug text,
  p_lang text,
  p_answers jsonb,
  p_client_submission_id uuid,
  p_referral_code text,
  p_referral_source text
)
returns table(entry_id uuid, status text, reference text, idempotent boolean, referral_attributed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_result record;
  v_entry public.special_offer_entries%rowtype;
  v_referral record;
  v_inserted boolean := false;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  select *
    into v_result
  from public.submit_special_offer_entry(
    p_offer_slug,
    p_lang,
    p_answers,
    p_client_submission_id
  )
  limit 1;

  if v_result.entry_id is null then
    raise exception 'submission_not_accepted' using errcode = 'P0001';
  end if;

  if coalesce(v_result.idempotent, false) is false then
    select *
      into v_entry
    from public.special_offer_entries e
    where e.id = v_result.entry_id
      and e.user_id = v_uid
    for update;

    if found then
      select *
        into v_referral
      from public.special_offer_resolve_entry_referral(
        v_uid,
        p_referral_code,
        p_referral_source
      )
      limit 1;

      if v_referral.partner_id is not null then
        insert into public.special_offer_entry_referrals (
          entry_id,
          offer_id,
          partner_id,
          referrer_user_id,
          referral_code_snapshot,
          referral_source,
          referral_captured_at,
          created_at
        )
        values (
          v_entry.id,
          v_entry.offer_id,
          v_referral.partner_id,
          v_referral.referrer_user_id,
          v_referral.referral_code_snapshot,
          coalesce(v_referral.referral_source, 'unknown'),
          now(),
          now()
        )
        on conflict (entry_id) do nothing
        returning true into v_inserted;

        if coalesce(v_inserted, false) and to_regclass('public.special_offer_audit_log') is not null then
          begin
            insert into public.special_offer_audit_log (
              offer_id,
              actor_id,
              action,
              entity_type,
              entity_id,
              old_value,
              new_value,
              metadata
            )
            values (
              v_entry.offer_id,
              v_uid,
              'special_offer.entry_referral_attributed',
              'special_offer_entry',
              v_entry.id,
              null,
              jsonb_build_object('attributed', true),
              jsonb_build_object(
                'source', coalesce(v_referral.referral_source, 'unknown'),
                'attributed', true,
                'pii_logged', false,
                'referral_code_logged', false,
                'answers_logged', false
              )
            );
          exception when others then
            null;
          end;
        end if;
      end if;
    end if;
  end if;

  entry_id := v_result.entry_id;
  status := v_result.status;
  reference := v_result.reference;
  idempotent := coalesce(v_result.idempotent, false);
  referral_attributed := coalesce(v_inserted, false) or exists (
    select 1
    from public.special_offer_entry_referrals r
    where r.entry_id = v_result.entry_id
  );
  return next;
end;
$$;

alter function public.special_offer_resolve_entry_referral(uuid, text, text)
  owner to postgres;
alter function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  owner to postgres;

revoke all on function public.special_offer_resolve_entry_referral(uuid, text, text)
  from public, anon, authenticated, service_role;

revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  to authenticated;

comment on table public.special_offer_entry_referrals is
  'One immutable partner attribution record per Special Offer entry. Stores partner/referrer ids and referral code snapshot without participant form data.';
comment on function public.special_offer_resolve_entry_referral(uuid, text, text) is
  'Backend-only resolver for Special Offer entry partner attribution. Applies first-touch profile referral only when missing and only for active partners.';
comment on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text) is
  'Compatibility wrapper around the existing Special Offer submit RPC that persists immutable partner attribution for newly created entries when a valid active partner referral exists.';

commit;
