-- Special Offers 3C.5C-6K entry hard delete repair - Stage 1.
-- Fixes ambiguous entry_id references inside admin_delete_special_offer_entry.
-- Prepared for manual execution only. Do not run from Codex.

begin;

do $$
begin
  if to_regclass('public.special_offer_entries') is null then
    raise exception 'Missing required table public.special_offer_entries';
  end if;
  if to_regclass('public.special_offer_entry_answers') is null then
    raise exception 'Missing required table public.special_offer_entry_answers';
  end if;
  if to_regclass('public.special_offer_audit_log') is null then
    raise exception 'Missing required table public.special_offer_audit_log';
  end if;
  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create or replace function public.admin_delete_special_offer_entry(
  p_entry_id uuid,
  p_expected_reference text,
  p_reason text
)
returns table(entry_id uuid, deleted boolean, answers_deleted integer, activities_deleted integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_entry public.special_offer_entries%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_answers_count integer := 0;
  v_activities_count integer := 0;
  v_winner_count integer := 0;
begin
  if v_actor is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_entry_id is null then
    raise exception 'entry_id_required' using errcode = '23514';
  end if;
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'delete_reason_required' using errcode = '23514';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found then
    if exists (
      select 1
      from public.special_offer_audit_log a
      where a.action = 'entry_hard_deleted'
        and a.entity_type = 'special_offer_entry'
        and a.entity_id = p_entry_id
    ) then
      entry_id := p_entry_id;
      deleted := false;
      answers_deleted := 0;
      activities_deleted := 0;
      return next;
      return;
    end if;
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  if coalesce(p_expected_reference, '') <> coalesce(v_entry.reference, '') then
    raise exception 'entry_reference_mismatch' using errcode = '23514';
  end if;

  if to_regclass('public.special_offer_winners') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_winners'
        and column_name = 'entry_id'
    ) then
      execute 'select count(*) from public.special_offer_winners w where w.entry_id = $1'
        into v_winner_count
        using v_entry.id;
      if v_winner_count > 0 then
        raise exception 'entry_has_winner_record' using errcode = '23514';
      end if;
    else
      raise exception 'entry_winner_guard_unverifiable' using errcode = 'P0001';
    end if;
  end if;

  select count(*)::integer
    into v_answers_count
  from public.special_offer_entry_answers ans
  where ans.entry_id = v_entry.id;

  if to_regclass('public.special_offer_entry_activities') is not null then
    select count(*)::integer
      into v_activities_count
    from public.special_offer_entry_activities act
    where act.entry_id = v_entry.id;
  end if;

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
    v_actor,
    'entry_hard_deleted',
    'special_offer_entry',
    v_entry.id,
    null,
    jsonb_build_object('deleted', true),
    jsonb_build_object(
      'entry_id', v_entry.id,
      'answers_deleted', v_answers_count,
      'activities_deleted', v_activities_count,
      'reason_present', true,
      'pii_logged', false
    )
  );

  delete from public.special_offer_entries e
  where e.id = v_entry.id;

  entry_id := v_entry.id;
  deleted := true;
  answers_deleted := v_answers_count;
  activities_deleted := v_activities_count;
  return next;
end;
$$;

alter function public.admin_delete_special_offer_entry(uuid, text, text)
  owner to postgres;

revoke all on function public.admin_delete_special_offer_entry(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_special_offer_entry(uuid, text, text)
  to authenticated;

comment on function public.admin_delete_special_offer_entry(uuid, text, text) is
  'Admin-only hard delete for a Special Offer entry and dependent entry data. Requires reference confirmation and minimal no-PII audit tombstone.';

commit;
