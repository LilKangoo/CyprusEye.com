-- Special Offers 3C.5C-6K official post hard delete - Stage 1.
-- Adds admin-only permanent delete for inactive official posts with zero activities.
-- Prepared for manual execution only. Do not run from Codex.

begin;

do $$
begin
  if to_regclass('public.special_offer_official_posts') is null then
    raise exception 'Missing required table public.special_offer_official_posts';
  end if;
  if to_regclass('public.special_offer_entry_activities') is null then
    raise exception 'Missing required table public.special_offer_entry_activities';
  end if;
  if to_regclass('public.special_offer_audit_log') is null then
    raise exception 'Missing required table public.special_offer_audit_log';
  end if;
  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;
end;
$$;

create or replace function public.admin_delete_special_offer_official_post(
  p_official_post_id uuid,
  p_expected_admin_title text,
  p_reason text
)
returns table(official_post_id uuid, deleted boolean, activity_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_post public.special_offer_official_posts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_activity_count integer := 0;
begin
  if v_actor is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_official_post_id is null then
    raise exception 'official_post_not_found' using errcode = 'P0001';
  end if;
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'delete_reason_required' using errcode = '23514';
  end if;

  select *
    into v_post
  from public.special_offer_official_posts p
  where p.id = p_official_post_id
  for update;

  if not found then
    if exists (
      select 1
      from public.special_offer_audit_log a
      where a.action = 'official_post_hard_deleted'
        and a.entity_type = 'special_offer_official_post'
        and a.entity_id = p_official_post_id
    ) then
      official_post_id := p_official_post_id;
      deleted := false;
      activity_count := 0;
      return next;
      return;
    end if;
    raise exception 'official_post_not_found' using errcode = 'P0001';
  end if;

  if coalesce(p_expected_admin_title, '') <> coalesce(v_post.admin_title, '') then
    raise exception 'official_post_title_mismatch' using errcode = '23514';
  end if;

  if v_post.active is true then
    raise exception 'official_post_must_be_inactive' using errcode = '23514';
  end if;

  select count(*)::integer
    into v_activity_count
  from public.special_offer_entry_activities act
  where act.official_post_id = v_post.id;

  if v_activity_count > 0 then
    raise exception 'official_post_has_activities' using errcode = '23514';
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
    v_post.offer_id,
    v_actor,
    'official_post_hard_deleted',
    'special_offer_official_post',
    v_post.id,
    jsonb_build_object(
      'active', v_post.active,
      'post_order', v_post.post_order,
      'week_number', v_post.week_number
    ),
    jsonb_build_object('deleted', true),
    jsonb_build_object(
      'official_post_id', v_post.id,
      'post_order', v_post.post_order,
      'week_number', v_post.week_number,
      'activity_count', v_activity_count,
      'reason_present', true,
      'pii_logged', false
    )
  );

  delete from public.special_offer_official_posts p
  where p.id = v_post.id;

  official_post_id := v_post.id;
  deleted := true;
  activity_count := v_activity_count;
  return next;
end;
$$;

alter function public.admin_delete_special_offer_official_post(uuid, text, text)
  owner to postgres;

revoke all on function public.admin_delete_special_offer_official_post(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_special_offer_official_post(uuid, text, text)
  to authenticated;

comment on function public.admin_delete_special_offer_official_post(uuid, text, text) is
  'Admin-only hard delete for inactive Special Offer official posts with zero activity rows. Requires title confirmation and minimal no-PII audit tombstone.';

commit;
