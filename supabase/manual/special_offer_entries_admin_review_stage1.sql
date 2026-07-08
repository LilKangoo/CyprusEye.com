-- Special Offers 3C.5A draft only.
-- Adds an admin-only RPC for manual entry review decisions.
-- Prepared for manual review. Do not run automatically.
--
-- Scope:
-- - public.review_special_offer_entry(uuid, text, text, text)
-- - revoke direct authenticated UPDATE grants on special_offer_entries
--
-- Out of scope:
-- - UI changes
-- - public submit changes
-- - entries/answers data migration
-- - tasks
-- - draws
-- - winners

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

create or replace function public.review_special_offer_entry(
  p_entry_id uuid,
  p_new_status text,
  p_review_note text default null,
  p_rejection_reason text default null
)
returns table(
  entry_id uuid,
  reference text,
  previous_status text,
  status text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  idempotent boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := null;
  v_entry public.special_offer_entries%rowtype;
  v_new_status text := lower(trim(coalesce(p_new_status, '')));
  v_review_note text := nullif(trim(coalesce(p_review_note, '')), '');
  v_rejection_reason text := nullif(trim(coalesce(p_rejection_reason, '')), '');
  v_final_rejection_reason text := null;
  v_reviewed_at timestamptz := now();
  v_transition_allowed boolean := false;
begin
  begin
    v_actor_id := auth.uid();
  exception when others then
    v_actor_id := null;
  end;

  if v_actor_id is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  if coalesce(public.is_current_user_admin(), false) is not true then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_entry_id is null then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  if v_new_status not in ('pending_review', 'approved', 'rejected', 'disqualified') then
    raise exception 'invalid_review_status' using errcode = '23514';
  end if;

  if p_new_status is distinct from null and trim(p_new_status) <> p_new_status then
    raise exception 'invalid_review_status' using errcode = '23514';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  if v_entry.status = v_new_status then
    entry_id := v_entry.id;
    reference := v_entry.reference;
    previous_status := v_entry.status;
    status := v_entry.status;
    reviewed_at := v_entry.reviewed_at;
    reviewed_by := v_entry.reviewed_by;
    idempotent := true;
    return next;
    return;
  end if;

  if v_entry.status = 'withdrawn' or v_new_status in ('withdrawn', 'submitted') then
    raise exception 'invalid_status_transition' using errcode = '23514';
  end if;

  v_transition_allowed := case
    when v_entry.status = 'submitted'
      and v_new_status in ('approved', 'rejected', 'disqualified') then true
    when v_entry.status = 'pending_review'
      and v_new_status in ('approved', 'rejected', 'disqualified') then true
    when v_entry.status = 'rejected'
      and v_new_status = 'pending_review' then true
    when v_entry.status = 'disqualified'
      and v_new_status = 'pending_review' then true
    when v_entry.status = 'approved'
      and v_new_status = 'disqualified' then true
    else false
  end;

  if not v_transition_allowed then
    raise exception 'invalid_status_transition' using errcode = '23514';
  end if;

  if v_review_note is not null and char_length(v_review_note) > 2000 then
    raise exception 'review_note_too_long' using errcode = '23514';
  end if;

  if v_rejection_reason is not null and char_length(v_rejection_reason) > 1000 then
    raise exception 'rejection_reason_too_long' using errcode = '23514';
  end if;

  if v_new_status in ('rejected', 'disqualified') and v_rejection_reason is null then
    raise exception 'rejection_reason_required' using errcode = '23514';
  end if;

  v_final_rejection_reason := case
    when v_new_status in ('rejected', 'disqualified') then v_rejection_reason
    else null
  end;

  update public.special_offer_entries
    set
      status = v_new_status,
      reviewed_at = v_reviewed_at,
      reviewed_by = v_actor_id,
      review_note = v_review_note,
      rejection_reason = v_final_rejection_reason
  where id = v_entry.id;

  insert into public.special_offer_audit_log (
    offer_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    metadata,
    created_at
  )
  values (
    v_entry.offer_id,
    v_actor_id,
    'entry_status_reviewed',
    'special_offer_entry',
    v_entry.id,
    jsonb_build_object('status', v_entry.status),
    jsonb_build_object('status', v_new_status),
    jsonb_build_object(
      'entry_id', v_entry.id,
      'reference', v_entry.reference,
      'review_note_present', v_review_note is not null,
      'rejection_reason_present', v_final_rejection_reason is not null
    ),
    v_reviewed_at
  );

  entry_id := v_entry.id;
  reference := v_entry.reference;
  previous_status := v_entry.status;
  status := v_new_status;
  reviewed_at := v_reviewed_at;
  reviewed_by := v_actor_id;
  idempotent := false;
  return next;
exception
  when others then
    if sqlerrm in (
      'login_required',
      'admin_required',
      'entry_not_found',
      'invalid_review_status',
      'invalid_status_transition',
      'rejection_reason_required',
      'review_note_too_long',
      'rejection_reason_too_long'
    ) then
      raise;
    end if;
    raise exception 'review_not_accepted' using errcode = 'P0001';
end;
$$;

alter function public.review_special_offer_entry(uuid, text, text, text)
  owner to postgres;

revoke all on function public.review_special_offer_entry(uuid, text, text, text)
  from public;
revoke all on function public.review_special_offer_entry(uuid, text, text, text)
  from anon;
revoke all on function public.review_special_offer_entry(uuid, text, text, text)
  from authenticated;
revoke all on function public.review_special_offer_entry(uuid, text, text, text)
  from service_role;

grant execute on function public.review_special_offer_entry(uuid, text, text, text)
  to authenticated;

-- Review decisions must go through review_special_offer_entry() so transition
-- rules and audit logging cannot be bypassed by the admin UI.
revoke update on table public.special_offer_entries
  from public;
revoke update on table public.special_offer_entries
  from anon;
revoke update on table public.special_offer_entries
  from authenticated;
revoke update (
  status,
  reviewed_at,
  reviewed_by,
  review_note,
  rejection_reason,
  updated_at
) on table public.special_offer_entries
  from public;
revoke update (
  status,
  reviewed_at,
  reviewed_by,
  review_note,
  rejection_reason,
  updated_at
) on table public.special_offer_entries
  from anon;
revoke update (
  status,
  reviewed_at,
  reviewed_by,
  review_note,
  rejection_reason,
  updated_at
) on table public.special_offer_entries
  from authenticated;

comment on function public.review_special_offer_entry(uuid, text, text, text) is
  'Admin-only Special Offers entry review RPC. Applies status transition rules, review metadata and minimal audit log atomically.';

commit;
