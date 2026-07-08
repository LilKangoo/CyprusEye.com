-- Special Offers 3C.5C-2 backend foundation.
-- Adds official posts, participant activity claims, admin activity review RPC
-- and dynamic score calculation.
--
-- Prepared for manual execution only.
--
-- Scope:
-- - public.special_offer_official_posts
-- - public.special_offer_entry_activities
-- - public.admin_upsert_special_offer_official_post(...)
-- - public.admin_deactivate_special_offer_official_post(uuid)
-- - public.submit_special_offer_activity_claim(...)
-- - public.review_special_offer_activity(...)
-- - public.special_offer_entry_score_summary(uuid, uuid)
--
-- Out of scope:
-- - UI changes
-- - public activity claim UI
-- - admin manual verification UI
-- - tasks
-- - draws
-- - winners
-- - backfill from shared_post_url

begin;

do $$
begin
  if to_regclass('public.special_offers') is null then
    raise exception 'Missing required table public.special_offers';
  end if;

  if to_regclass('public.special_offer_entries') is null then
    raise exception 'Missing required table public.special_offer_entries';
  end if;

  if to_regclass('public.special_offer_audit_log') is null then
    raise exception 'Missing required table public.special_offer_audit_log';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception 'Missing required admin helper public.is_current_user_admin()';
  end if;

  if to_regprocedure('public.special_offers_set_updated_at()') is null then
    raise exception 'Missing required updated_at helper public.special_offers_set_updated_at()';
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

create table if not exists public.special_offer_official_posts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.special_offers(id) on delete cascade,
  post_order integer not null,
  week_number integer,
  admin_title text not null,
  platform text not null,
  official_url text not null,
  external_post_id text,
  published_at timestamptz not null,
  comment_deadline_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_official_posts_offer_id_id_key unique (id, offer_id),
  constraint special_offer_official_posts_offer_url_key unique (offer_id, official_url),
  constraint special_offer_official_posts_offer_order_key unique (offer_id, post_order),
  constraint special_offer_official_posts_order_check check (post_order > 0),
  constraint special_offer_official_posts_week_check check (week_number is null or week_number > 0),
  constraint special_offer_official_posts_title_check check (length(btrim(admin_title)) > 0 and char_length(admin_title) <= 200),
  constraint special_offer_official_posts_platform_check check (platform in ('facebook')),
  constraint special_offer_official_posts_url_check check (
    char_length(official_url) between 1 and 2048
    and official_url = btrim(official_url)
    and official_url !~ '[[:space:][:cntrl:]]'
    and official_url ~* '^https?://[^/?#[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$'
  ),
  constraint special_offer_official_posts_external_id_check check (
    external_post_id is null
    or (length(btrim(external_post_id)) > 0 and char_length(external_post_id) <= 300)
  ),
  constraint special_offer_official_posts_deadline_check check (comment_deadline_at >= published_at)
);

create table if not exists public.special_offer_entry_activities (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.special_offers(id) on delete cascade,
  entry_id uuid not null,
  official_post_id uuid not null,
  activity_type text not null,
  evidence_url text not null,
  evidence_text text,
  participant_reported_at timestamptz,
  verified_activity_at timestamptz,
  status text not null default 'pending',
  points_awarded integer not null default 0,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  review_note text,
  rejection_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  client_submission_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_entry_activities_entry_offer_fkey
    foreign key (entry_id, offer_id)
    references public.special_offer_entries(id, offer_id)
    on delete cascade,
  constraint special_offer_entry_activities_post_offer_fkey
    foreign key (official_post_id, offer_id)
    references public.special_offer_official_posts(id, offer_id)
    on delete restrict,
  constraint special_offer_entry_activities_entry_post_type_key unique (entry_id, official_post_id, activity_type),
  constraint special_offer_entry_activities_entry_client_key unique (entry_id, client_submission_id),
  constraint special_offer_entry_activities_type_check check (activity_type in ('share', 'comment')),
  constraint special_offer_entry_activities_status_check check (status in ('pending', 'approved', 'rejected', 'invalid')),
  constraint special_offer_entry_activities_points_check check (points_awarded in (0, 1)),
  constraint special_offer_entry_activities_status_points_check check (
    (status = 'approved' and points_awarded = 1)
    or (status <> 'approved' and points_awarded = 0)
  ),
  constraint special_offer_entry_activities_comment_approved_time_check check (
    activity_type <> 'comment'
    or status <> 'approved'
    or verified_activity_at is not null
  ),
  constraint special_offer_entry_activities_evidence_url_check check (
    char_length(evidence_url) between 1 and 2048
    and evidence_url = btrim(evidence_url)
    and evidence_url !~ '[[:space:][:cntrl:]]'
    and evidence_url ~* '^https?://[^/?#[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$'
  ),
  constraint special_offer_entry_activities_evidence_text_check check (
    evidence_text is null
    or char_length(evidence_text) <= 2000
  ),
  constraint special_offer_entry_activities_review_note_check check (
    review_note is null
    or char_length(review_note) <= 2000
  ),
  constraint special_offer_entry_activities_rejection_reason_check check (
    rejection_reason is null
    or char_length(rejection_reason) <= 1000
  )
);

create index if not exists idx_special_offer_official_posts_offer_order
  on public.special_offer_official_posts(offer_id, post_order);

create index if not exists idx_special_offer_official_posts_offer_active
  on public.special_offer_official_posts(offer_id, active, post_order);

create index if not exists idx_special_offer_official_posts_platform
  on public.special_offer_official_posts(platform);

create index if not exists idx_special_offer_official_posts_published
  on public.special_offer_official_posts(published_at);

create index if not exists idx_special_offer_entry_activities_offer_status
  on public.special_offer_entry_activities(offer_id, status);

create index if not exists idx_special_offer_entry_activities_entry
  on public.special_offer_entry_activities(entry_id, created_at desc);

create index if not exists idx_special_offer_entry_activities_post
  on public.special_offer_entry_activities(official_post_id, activity_type, status);

create index if not exists idx_special_offer_entry_activities_created_by
  on public.special_offer_entry_activities(created_by, created_at desc);

drop trigger if exists trg_special_offer_official_posts_set_updated_at
  on public.special_offer_official_posts;
create trigger trg_special_offer_official_posts_set_updated_at
  before update on public.special_offer_official_posts
  for each row
  execute function public.special_offers_set_updated_at();

drop trigger if exists trg_special_offer_entry_activities_set_updated_at
  on public.special_offer_entry_activities;
create trigger trg_special_offer_entry_activities_set_updated_at
  before update on public.special_offer_entry_activities
  for each row
  execute function public.special_offers_set_updated_at();

create or replace function public.special_offer_official_posts_set_defaults()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.platform := lower(btrim(coalesce(new.platform, '')));
  new.admin_title := btrim(coalesce(new.admin_title, ''));
  new.official_url := btrim(coalesce(new.official_url, ''));
  new.external_post_id := nullif(btrim(coalesce(new.external_post_id, '')), '');

  if new.comment_deadline_at is null and new.published_at is not null then
    new.comment_deadline_at := new.published_at + interval '24 hours';
  end if;

  return new;
end;
$$;

create or replace function public.special_offer_official_post_is_public(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.special_offers o
    where o.id = p_offer_id
      and o.status = 'active'
      and o.visibility = 'public'
  );
$$;

drop trigger if exists trg_special_offer_official_posts_set_defaults
  on public.special_offer_official_posts;
create trigger trg_special_offer_official_posts_set_defaults
  before insert or update on public.special_offer_official_posts
  for each row
  execute function public.special_offer_official_posts_set_defaults();

alter table public.special_offer_official_posts enable row level security;
alter table public.special_offer_entry_activities enable row level security;

revoke all on table public.special_offer_official_posts from public;
revoke all on table public.special_offer_official_posts from anon;
revoke all on table public.special_offer_official_posts from authenticated;
revoke all on table public.special_offer_entry_activities from public;
revoke all on table public.special_offer_entry_activities from anon;
revoke all on table public.special_offer_entry_activities from authenticated;

grant select on table public.special_offer_official_posts to anon, authenticated;
grant select on table public.special_offer_entry_activities to authenticated;
grant all on table public.special_offer_official_posts to service_role;
grant all on table public.special_offer_entry_activities to service_role;

drop policy if exists special_offer_official_posts_admin_select
  on public.special_offer_official_posts;
create policy special_offer_official_posts_admin_select
  on public.special_offer_official_posts
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_official_posts_public_active_select
  on public.special_offer_official_posts;
create policy special_offer_official_posts_public_active_select
  on public.special_offer_official_posts
  for select
  to anon, authenticated
  using (
    active = true
    and public.special_offer_official_post_is_public(offer_id)
  );

drop policy if exists special_offer_activities_admin_select
  on public.special_offer_entry_activities;
create policy special_offer_activities_admin_select
  on public.special_offer_entry_activities
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_activities_user_select_own
  on public.special_offer_entry_activities;
create policy special_offer_activities_user_select_own
  on public.special_offer_entry_activities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.special_offer_entries e
      where e.id = special_offer_entry_activities.entry_id
        and e.user_id = auth.uid()
    )
  );

create or replace function public.admin_upsert_special_offer_official_post(
  p_post_id uuid,
  p_offer_id uuid,
  p_post_order integer,
  p_week_number integer,
  p_admin_title text,
  p_platform text,
  p_official_url text,
  p_external_post_id text,
  p_published_at timestamptz,
  p_comment_deadline_at timestamptz default null,
  p_active boolean default true
)
returns table(
  official_post_id uuid,
  offer_id uuid,
  post_order integer,
  active boolean,
  action text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_offer public.special_offers%rowtype;
  v_existing public.special_offer_official_posts%rowtype;
  v_post public.special_offer_official_posts%rowtype;
  v_title text := nullif(btrim(coalesce(p_admin_title, '')), '');
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_url text := btrim(coalesce(p_official_url, ''));
  v_external_id text := nullif(btrim(coalesce(p_external_post_id, '')), '');
  v_deadline timestamptz := coalesce(p_comment_deadline_at, p_published_at + interval '24 hours');
  v_action text;
begin
  if v_actor_id is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  if coalesce(public.is_current_user_admin(), false) is not true then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_offer_id is null then
    raise exception 'offer_required' using errcode = '23514';
  end if;

  select *
  into v_offer
  from public.special_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found' using errcode = 'P0001';
  end if;

  if v_title is null or char_length(v_title) > 200 then
    raise exception 'invalid_post_title' using errcode = '23514';
  end if;

  if p_post_order is null or p_post_order <= 0 then
    raise exception 'invalid_post_order' using errcode = '23514';
  end if;

  if p_week_number is not null and p_week_number <= 0 then
    raise exception 'invalid_week_number' using errcode = '23514';
  end if;

  if v_platform not in ('facebook') then
    raise exception 'invalid_platform' using errcode = '23514';
  end if;

  if v_url = ''
     or char_length(v_url) > 2048
     or v_url ~ '[[:space:][:cntrl:]]'
     or v_url !~* '^https?://[^/?#[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$'
  then
    raise exception 'invalid_official_url' using errcode = '23514';
  end if;

  if p_published_at is null then
    raise exception 'published_at_required' using errcode = '23514';
  end if;

  if v_deadline is null or v_deadline < p_published_at then
    raise exception 'invalid_comment_deadline' using errcode = '23514';
  end if;

  if p_post_id is null then
    insert into public.special_offer_official_posts (
      offer_id,
      post_order,
      week_number,
      admin_title,
      platform,
      official_url,
      external_post_id,
      published_at,
      comment_deadline_at,
      active,
      created_by,
      updated_by
    )
    values (
      v_offer.id,
      p_post_order,
      p_week_number,
      v_title,
      v_platform,
      v_url,
      v_external_id,
      p_published_at,
      v_deadline,
      coalesce(p_active, true),
      v_actor_id,
      v_actor_id
    )
    returning * into v_post;

    v_action := 'official_post_created';
  else
    select *
    into v_existing
    from public.special_offer_official_posts p
    where p.id = p_post_id
    for update;

    if not found then
      raise exception 'official_post_not_found' using errcode = 'P0001';
    end if;

    if v_existing.offer_id <> v_offer.id then
      raise exception 'official_post_offer_mismatch' using errcode = '23514';
    end if;

    update public.special_offer_official_posts
      set
        post_order = p_post_order,
        week_number = p_week_number,
        admin_title = v_title,
        platform = v_platform,
        official_url = v_url,
        external_post_id = v_external_id,
        published_at = p_published_at,
        comment_deadline_at = v_deadline,
        active = coalesce(p_active, true),
        updated_by = v_actor_id
    where id = v_existing.id
    returning * into v_post;

    v_action := 'official_post_updated';
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
    v_offer.id,
    v_actor_id,
    v_action,
    'special_offer_official_post',
    v_post.id,
    case
      when p_post_id is null then null
      else jsonb_build_object(
        'post_order', v_existing.post_order,
        'active', v_existing.active,
        'platform', v_existing.platform
      )
    end,
    jsonb_build_object(
      'post_order', v_post.post_order,
      'active', v_post.active,
      'platform', v_post.platform
    ),
    jsonb_build_object(
      'official_post_id', v_post.id,
      'post_order', v_post.post_order,
      'week_number', v_post.week_number,
      'platform', v_post.platform
    )
  );

  official_post_id := v_post.id;
  offer_id := v_post.offer_id;
  post_order := v_post.post_order;
  active := v_post.active;
  action := v_action;
  return next;
exception
  when unique_violation then
    raise exception 'official_post_duplicate' using errcode = '23505';
  when others then
    if sqlerrm in (
      'login_required',
      'admin_required',
      'offer_required',
      'offer_not_found',
      'invalid_post_title',
      'invalid_post_order',
      'invalid_week_number',
      'invalid_platform',
      'invalid_official_url',
      'published_at_required',
      'invalid_comment_deadline',
      'official_post_not_found',
      'official_post_offer_mismatch',
      'official_post_duplicate'
    ) then
      raise;
    end if;
    raise exception 'official_post_not_saved' using errcode = 'P0001';
end;
$$;

create or replace function public.admin_deactivate_special_offer_official_post(
  p_post_id uuid
)
returns table(
  official_post_id uuid,
  offer_id uuid,
  active boolean,
  idempotent boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_post public.special_offer_official_posts%rowtype;
begin
  if v_actor_id is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  if coalesce(public.is_current_user_admin(), false) is not true then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_post_id is null then
    raise exception 'official_post_not_found' using errcode = 'P0001';
  end if;

  select *
  into v_post
  from public.special_offer_official_posts p
  where p.id = p_post_id
  for update;

  if not found then
    raise exception 'official_post_not_found' using errcode = 'P0001';
  end if;

  if v_post.active is false then
    official_post_id := v_post.id;
    offer_id := v_post.offer_id;
    active := false;
    idempotent := true;
    return next;
    return;
  end if;

  update public.special_offer_official_posts
    set active = false,
        updated_by = v_actor_id
  where id = v_post.id
  returning * into v_post;

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
    v_actor_id,
    'official_post_deactivated',
    'special_offer_official_post',
    v_post.id,
    jsonb_build_object('active', true),
    jsonb_build_object('active', false),
    jsonb_build_object('official_post_id', v_post.id)
  );

  official_post_id := v_post.id;
  offer_id := v_post.offer_id;
  active := v_post.active;
  idempotent := false;
  return next;
end;
$$;

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

create or replace function public.review_special_offer_activity(
  p_activity_id uuid,
  p_new_status text,
  p_verified_activity_at timestamptz default null,
  p_review_note text default null,
  p_rejection_reason text default null
)
returns table(
  activity_id uuid,
  previous_status text,
  status text,
  points_awarded integer,
  verified_at timestamptz,
  verified_by uuid,
  idempotent boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_activity public.special_offer_entry_activities%rowtype;
  v_post public.special_offer_official_posts%rowtype;
  v_new_status text := lower(btrim(coalesce(p_new_status, '')));
  v_review_note text := nullif(btrim(coalesce(p_review_note, ''), E' \t\n\r\f'), '');
  v_rejection_reason text := nullif(btrim(coalesce(p_rejection_reason, ''), E' \t\n\r\f'), '');
  v_final_rejection_reason text := null;
  v_final_verified_activity_at timestamptz := null;
  v_new_points integer := 0;
  v_now timestamptz := now();
  v_transition_allowed boolean := false;
begin
  if v_actor_id is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  if coalesce(public.is_current_user_admin(), false) is not true then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'activity_not_found' using errcode = 'P0001';
  end if;

  if v_new_status not in ('pending', 'approved', 'rejected', 'invalid') then
    raise exception 'invalid_activity_review_status' using errcode = '23514';
  end if;

  select *
  into v_activity
  from public.special_offer_entry_activities a
  where a.id = p_activity_id
  for update;

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0001';
  end if;

  if v_activity.status = v_new_status then
    activity_id := v_activity.id;
    previous_status := v_activity.status;
    status := v_activity.status;
    points_awarded := v_activity.points_awarded;
    verified_at := v_activity.verified_at;
    verified_by := v_activity.verified_by;
    idempotent := true;
    return next;
    return;
  end if;

  v_transition_allowed := case
    when v_activity.status = 'pending'
      and v_new_status in ('approved', 'rejected', 'invalid') then true
    when v_activity.status = 'rejected'
      and v_new_status = 'pending' then true
    when v_activity.status = 'invalid'
      and v_new_status = 'pending' then true
    when v_activity.status = 'approved'
      and v_new_status in ('invalid', 'pending') then true
    else false
  end;

  if not v_transition_allowed then
    raise exception 'invalid_activity_status_transition' using errcode = '23514';
  end if;

  if v_review_note is not null and char_length(v_review_note) > 2000 then
    raise exception 'review_note_too_long' using errcode = '23514';
  end if;

  if v_rejection_reason is not null and char_length(v_rejection_reason) > 1000 then
    raise exception 'rejection_reason_too_long' using errcode = '23514';
  end if;

  if v_new_status in ('rejected', 'invalid') and v_rejection_reason is null then
    raise exception 'rejection_reason_required' using errcode = '23514';
  end if;

  select *
  into v_post
  from public.special_offer_official_posts p
  where p.id = v_activity.official_post_id
    and p.offer_id = v_activity.offer_id
  for update;

  if not found then
    raise exception 'official_post_not_found' using errcode = 'P0001';
  end if;

  if v_new_status = 'approved' then
    if v_activity.activity_type = 'comment' then
      if p_verified_activity_at is null then
        raise exception 'verified_activity_at_required' using errcode = '23514';
      end if;

      if p_verified_activity_at < v_post.published_at
         or p_verified_activity_at > v_post.comment_deadline_at
      then
        raise exception 'comment_time_not_eligible' using errcode = '23514';
      end if;

      v_final_verified_activity_at := p_verified_activity_at;
    else
      v_final_verified_activity_at := p_verified_activity_at;
    end if;

    v_new_points := 1;
  elsif v_new_status = 'pending' then
    v_final_verified_activity_at := null;
    v_new_points := 0;
  else
    v_final_verified_activity_at := null;
    v_new_points := 0;
  end if;

  v_final_rejection_reason := case
    when v_new_status in ('rejected', 'invalid') then v_rejection_reason
    else null
  end;

  update public.special_offer_entry_activities
    set
      status = v_new_status,
      points_awarded = v_new_points,
      verified_activity_at = v_final_verified_activity_at,
      verified_at = v_now,
      verified_by = v_actor_id,
      review_note = v_review_note,
      rejection_reason = v_final_rejection_reason
  where id = v_activity.id;

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
    v_actor_id,
    'activity_reviewed',
    'special_offer_entry_activity',
    v_activity.id,
    jsonb_build_object('status', v_activity.status, 'points_awarded', v_activity.points_awarded),
    jsonb_build_object('status', v_new_status, 'points_awarded', v_new_points),
    jsonb_build_object(
      'entry_id', v_activity.entry_id,
      'official_post_id', v_activity.official_post_id,
      'activity_type', v_activity.activity_type,
      'old_status', v_activity.status,
      'new_status', v_new_status,
      'old_points', v_activity.points_awarded,
      'new_points', v_new_points,
      'review_note_present', v_review_note is not null,
      'rejection_reason_present', v_final_rejection_reason is not null,
      'verified_activity_at_present', v_final_verified_activity_at is not null
    )
  );

  activity_id := v_activity.id;
  previous_status := v_activity.status;
  status := v_new_status;
  points_awarded := v_new_points;
  verified_at := v_now;
  verified_by := v_actor_id;
  idempotent := false;
  return next;
exception
  when others then
    if sqlerrm in (
      'login_required',
      'admin_required',
      'activity_not_found',
      'invalid_activity_review_status',
      'invalid_activity_status_transition',
      'review_note_too_long',
      'rejection_reason_too_long',
      'rejection_reason_required',
      'official_post_not_found',
      'verified_activity_at_required',
      'comment_time_not_eligible'
    ) then
      raise;
    end if;
    raise exception 'activity_review_not_accepted' using errcode = 'P0001';
end;
$$;

create or replace function public.special_offer_entry_score_summary(
  p_offer_id uuid default null,
  p_entry_id uuid default null
)
returns table(
  offer_id uuid,
  entry_id uuid,
  reference text,
  entry_status text,
  base_points integer,
  share_points integer,
  comment_points integer,
  bonus_points integer,
  total_points integer,
  approved_activity_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := coalesce(public.is_current_user_admin(), false);
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;

  return query
  with scored as (
    select
      e.offer_id,
      e.id as entry_id,
      e.reference,
      e.status as entry_status,
      case when e.status = 'approved' then 1 else 0 end as base_points,
      coalesce(sum(a.points_awarded) filter (
        where a.status = 'approved'
          and a.activity_type = 'share'
      ), 0)::integer as share_points,
      coalesce(sum(a.points_awarded) filter (
        where a.status = 'approved'
          and a.activity_type = 'comment'
          and a.verified_activity_at is not null
          and a.verified_activity_at >= p.published_at
          and a.verified_activity_at <= p.comment_deadline_at
      ), 0)::integer as comment_points,
      coalesce(count(a.id) filter (where a.status = 'approved'), 0)::integer as approved_activity_count
    from public.special_offer_entries e
    left join public.special_offer_entry_activities a
      on a.entry_id = e.id
    left join public.special_offer_official_posts p
      on p.id = a.official_post_id
     and p.offer_id = a.offer_id
    where (v_is_admin or e.user_id = v_uid)
      and (p_offer_id is null or e.offer_id = p_offer_id)
      and (p_entry_id is null or e.id = p_entry_id)
    group by e.offer_id, e.id, e.reference, e.status
  )
  select
    s.offer_id,
    s.entry_id,
    s.reference,
    s.entry_status,
    s.base_points,
    s.share_points,
    s.comment_points,
    (s.share_points + s.comment_points)::integer as bonus_points,
    (s.base_points + s.share_points + s.comment_points)::integer as total_points,
    s.approved_activity_count
  from scored s
  order by total_points desc, s.entry_id asc;
end;
$$;

alter function public.special_offer_official_posts_set_defaults()
  owner to postgres;
alter function public.special_offer_official_post_is_public(uuid)
  owner to postgres;
alter function public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)
  owner to postgres;
alter function public.admin_deactivate_special_offer_official_post(uuid)
  owner to postgres;
alter function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  owner to postgres;
alter function public.review_special_offer_activity(uuid, text, timestamptz, text, text)
  owner to postgres;
alter function public.special_offer_entry_score_summary(uuid, uuid)
  owner to postgres;

revoke all on function public.special_offer_official_posts_set_defaults()
  from public, anon, authenticated;
revoke all on function public.special_offer_official_post_is_public(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_deactivate_special_offer_official_post(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.review_special_offer_activity(uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.special_offer_entry_score_summary(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.admin_upsert_special_offer_official_post(uuid, uuid, integer, integer, text, text, text, text, timestamptz, timestamptz, boolean)
  to authenticated, service_role;
grant execute on function public.special_offer_official_post_is_public(uuid)
  to anon, authenticated;
grant execute on function public.admin_deactivate_special_offer_official_post(uuid)
  to authenticated, service_role;
grant execute on function public.submit_special_offer_activity_claim(uuid, uuid, text, text, uuid, text, timestamptz)
  to authenticated;
grant execute on function public.review_special_offer_activity(uuid, text, timestamptz, text, text)
  to authenticated, service_role;
grant execute on function public.special_offer_entry_score_summary(uuid, uuid)
  to authenticated;

comment on table public.special_offer_official_posts is
  'Official campaign posts eligible for manual share/comment activity claims. Soft deactivate with active=false.';
comment on table public.special_offer_entry_activities is
  'Participant-submitted share/comment claims for official Special Offers posts. Review and points are controlled by admin RPC.';
comment on column public.special_offer_entry_activities.points_awarded is
  'Dynamic scoring input: 1 only for approved share/comment, 0 for all other statuses.';
comment on function public.special_offer_entry_score_summary(uuid, uuid) is
  'Read-only dynamic Special Offers score summary. Returns admin-visible entries or only the caller-owned entries.';

commit;
