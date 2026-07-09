-- =====================================================
-- Special Offers activity claim campaign date guard - Stage 1
-- =====================================================
-- Purpose:
-- - keep the existing submit_special_offer_activity_claim signature
-- - add backend enforcement for campaign start_at/end_at
-- - preserve ownership, confirmed-email, idempotency, duplicate and audit behavior
--
-- Safe to run manually after review. Do not run from Codex.
-- =====================================================

begin;

create or replace function public.submit_special_offer_activity_claim(
  p_entry_id uuid,
  p_official_post_id uuid,
  p_activity_type text,
  p_evidence_url text,
  p_client_submission_id uuid,
  p_evidence_text text default null,
  p_participant_reported_at timestamptz default null
)
returns table(
  activity_id uuid,
  status text,
  points_awarded integer,
  idempotent boolean,
  duplicate boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email_confirmed_at timestamptz;
  v_entry public.special_offer_entries%rowtype;
  v_post public.special_offer_official_posts%rowtype;
  v_offer public.special_offers%rowtype;
  v_existing public.special_offer_entry_activities%rowtype;
  v_activity public.special_offer_entry_activities%rowtype;
  v_activity_type text := lower(btrim(coalesce(p_activity_type, '')));
  v_evidence_url text := btrim(coalesce(p_evidence_url, ''));
  v_evidence_text text := nullif(btrim(coalesce(p_evidence_text, ''), E' \t\n\r\f'), '');
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  select coalesce(u.email_confirmed_at, u.confirmed_at)
  into v_auth_email_confirmed_at
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_auth_email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  if p_entry_id is null or p_official_post_id is null then
    raise exception 'activity_claim_not_accepted' using errcode = '23514';
  end if;

  if p_client_submission_id is null then
    raise exception 'client_submission_id_required' using errcode = '23514';
  end if;

  if v_activity_type not in ('share', 'comment') then
    raise exception 'invalid_activity_type' using errcode = '23514';
  end if;

  if v_evidence_url = ''
     or char_length(v_evidence_url) > 2048
     or v_evidence_url ~ '[[:space:][:cntrl:]]'
     or v_evidence_url !~* '^https?://[^/?#[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$'
  then
    raise exception 'invalid_evidence_url' using errcode = '23514';
  end if;

  if v_evidence_text is not null and char_length(v_evidence_text) > 2000 then
    raise exception 'evidence_text_too_long' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'special_offer_activity_claim:' || p_entry_id::text || ':' || p_official_post_id::text || ':' || v_activity_type,
    0
  ));

  select *
  into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found or v_entry.user_id is distinct from v_uid then
    raise exception 'activity_claim_not_allowed' using errcode = '42501';
  end if;

  if v_entry.status not in ('submitted', 'pending_review', 'approved') then
    raise exception 'entry_not_eligible_for_activity' using errcode = '23514';
  end if;

  select *
  into v_post
  from public.special_offer_official_posts p
  where p.id = p_official_post_id
  for update;

  if not found then
    raise exception 'official_post_not_available' using errcode = 'P0001';
  end if;

  if v_post.offer_id <> v_entry.offer_id then
    raise exception 'activity_campaign_mismatch' using errcode = '23514';
  end if;

  if v_post.active is not true then
    raise exception 'official_post_inactive' using errcode = '23514';
  end if;

  select *
  into v_offer
  from public.special_offers o
  where o.id = v_entry.offer_id
  for update;

  if not found
     or v_offer.status <> 'active'
     or v_offer.visibility <> 'public'
     or coalesce(v_offer.allow_bonus_points, false) is not true
  then
    raise exception 'activity_claim_not_available' using errcode = 'P0001';
  end if;

  select *
  into v_existing
  from public.special_offer_entry_activities a
  where a.entry_id = v_entry.id
    and a.client_submission_id = p_client_submission_id
  limit 1;

  if found then
    if v_existing.created_by = v_uid then
      activity_id := v_existing.id;
      status := v_existing.status;
      points_awarded := v_existing.points_awarded;
      idempotent := true;
      duplicate := false;
      return next;
      return;
    end if;

    raise exception 'activity_claim_not_accepted' using errcode = '23505';
  end if;

  if v_offer.start_at is null
     or v_offer.end_at is null
     or v_now < v_offer.start_at
     or v_now > v_offer.end_at
  then
    raise exception 'activity_claim_not_available' using errcode = 'P0001';
  end if;

  select *
  into v_existing
  from public.special_offer_entry_activities a
  where a.entry_id = v_entry.id
    and a.official_post_id = v_post.id
    and a.activity_type = v_activity_type
  limit 1;

  if found then
    activity_id := v_existing.id;
    status := v_existing.status;
    points_awarded := v_existing.points_awarded;
    idempotent := false;
    duplicate := true;
    return next;
    return;
  end if;

  insert into public.special_offer_entry_activities (
    offer_id,
    entry_id,
    official_post_id,
    activity_type,
    evidence_url,
    evidence_text,
    participant_reported_at,
    status,
    points_awarded,
    created_by,
    client_submission_id
  )
  values (
    v_entry.offer_id,
    v_entry.id,
    v_post.id,
    v_activity_type,
    v_evidence_url,
    v_evidence_text,
    p_participant_reported_at,
    'pending',
    0,
    v_uid,
    p_client_submission_id
  )
  returning * into v_activity;

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
    v_activity.offer_id,
    v_uid,
    'activity_claimed',
    'special_offer_entry_activity',
    v_activity.id,
    null,
    jsonb_build_object('status', v_activity.status, 'points_awarded', v_activity.points_awarded),
    jsonb_build_object(
      'entry_id', v_activity.entry_id,
      'official_post_id', v_activity.official_post_id,
      'activity_type', v_activity.activity_type
    )
  );

  activity_id := v_activity.id;
  status := v_activity.status;
  points_awarded := v_activity.points_awarded;
  idempotent := false;
  duplicate := false;
  return next;
exception
  when unique_violation then
    raise exception 'activity_claim_duplicate' using errcode = '23505';
  when others then
    if sqlerrm in (
      'login_required',
      'email_not_confirmed',
      'client_submission_id_required',
      'invalid_activity_type',
      'invalid_evidence_url',
      'evidence_text_too_long',
      'activity_claim_not_allowed',
      'entry_not_eligible_for_activity',
      'official_post_not_available',
      'activity_campaign_mismatch',
      'official_post_inactive',
      'activity_claim_not_available',
      'activity_claim_not_accepted',
      'activity_claim_duplicate'
    ) then
      raise;
    end if;
    raise exception 'activity_claim_not_accepted' using errcode = 'P0001';
end;
$$;

alter function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  owner to postgres;

revoke all on function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  from public, anon;

grant execute on function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  to authenticated;

comment on function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz) is
  'Authenticated, confirmed-email participant activity claim RPC. Enforces ownership, active public campaign state, campaign date window, active official post, duplicate prevention and idempotency.';

commit;
