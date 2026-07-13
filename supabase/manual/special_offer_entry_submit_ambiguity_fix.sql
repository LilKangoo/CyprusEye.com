-- Special Offer entry submit ambiguity hotfix.
-- Minimal repair for PostgreSQL 42702 in submit_special_offer_entry wrapper.
-- Does not modify tables, existing entries, activities, points, winner workflow or RLS.

begin;

do $$
begin
  if to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is null then
    raise exception 'missing public.submit_special_offer_entry(text,text,jsonb,uuid)';
  end if;
  if to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid,text,text)') is null then
    raise exception 'missing public.submit_special_offer_entry(text,text,jsonb,uuid,text,text)';
  end if;
  if to_regclass('public.special_offer_entry_referrals') is null then
    raise exception 'missing public.special_offer_entry_referrals';
  end if;
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
  v_return_entry_id uuid := null;
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

  v_return_entry_id := v_result.entry_id;

  if v_return_entry_id is null then
    raise exception 'submission_not_accepted' using errcode = 'P0001';
  end if;

  if coalesce(v_result.idempotent, false) is false then
    select *
      into v_entry
    from public.special_offer_entries e
    where e.id = v_return_entry_id
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
        on conflict on constraint special_offer_entry_referrals_pkey do nothing
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

  entry_id := v_return_entry_id;
  status := v_result.status;
  reference := v_result.reference;
  idempotent := coalesce(v_result.idempotent, false);
  referral_attributed := coalesce(v_inserted, false) or exists (
    select 1
    from public.special_offer_entry_referrals r
    where r.entry_id = v_return_entry_id
  );
  return next;
end;
$$;

alter function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  owner to postgres;

revoke all on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text)
  to authenticated;

comment on function public.submit_special_offer_entry(text, text, jsonb, uuid, text, text) is
  'Compatibility wrapper around the existing Special Offer submit RPC that persists immutable partner attribution for newly created entries when a valid active partner referral exists. Hotfix qualifies entry_id conflict handling for PL/pgSQL OUT variable safety.';

commit;
