-- Special Offers 3C.6A Manual Winner Selection schema + admin RPC foundation.
-- Prepared for manual execution only. Do not run from Codex.
--
-- Scope:
-- - Manual winner workflow tables
-- - Admin-only winner workflow RPC
-- - Read-only admin readiness summary
-- - Correction and hard-delete workflow guards
--
-- Out of scope:
-- - Admin UI
-- - Draw Machine
-- - Automatic score-based winner selection
-- - Public winner display UI
-- - Automatic email sending

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
  if to_regprocedure('public.special_offer_entry_score_summary(uuid,uuid)') is null then
    raise exception 'Missing required score summary RPC public.special_offer_entry_score_summary(uuid,uuid)';
  end if;
  if to_regprocedure('public.update_special_offer_entry_once(uuid,jsonb,uuid)') is null then
    raise exception 'Missing required correction RPC public.update_special_offer_entry_once(uuid,jsonb,uuid)';
  end if;
  if to_regprocedure('public.admin_delete_special_offer_entry(uuid,text,text)') is null then
    raise exception 'Missing required hard-delete RPC public.admin_delete_special_offer_entry(uuid,text,text)';
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

create table if not exists public.special_offer_winner_workflows (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.special_offers(id) on delete restrict,
  status text not null default 'not_started',
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  decision_reason text,
  confirmed_entry_id uuid,
  confirmed_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_winner_workflows_offer_id_id_key unique (id, offer_id),
  constraint special_offer_winner_workflows_confirmed_entry_offer_fkey
    foreign key (confirmed_entry_id, offer_id)
    references public.special_offer_entries(id, offer_id)
    on delete restrict,
  constraint special_offer_winner_workflows_status_check check (
    status in ('not_started', 'shortlisting', 'candidate_selected', 'contacting', 'winner_confirmed', 'published', 'cancelled')
  ),
  constraint special_offer_winner_workflows_decision_reason_check check (
    decision_reason is null or char_length(decision_reason) <= 2000
  ),
  constraint special_offer_winner_workflows_started_status_check check (
    status = 'not_started' or started_at is not null
  ),
  constraint special_offer_winner_workflows_confirmed_status_check check (
    (status not in ('winner_confirmed', 'published') and confirmed_entry_id is null and confirmed_at is null)
    or (status in ('winner_confirmed', 'published') and confirmed_entry_id is not null and confirmed_at is not null)
  ),
  constraint special_offer_winner_workflows_published_status_check check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  ),
  constraint special_offer_winner_workflows_cancelled_status_check check (
    (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
    or (status <> 'cancelled' and cancelled_at is null and cancelled_by is null)
  )
);

create unique index if not exists idx_special_offer_winner_workflows_one_active
  on public.special_offer_winner_workflows(offer_id)
  where status <> 'cancelled';

create index if not exists idx_special_offer_winner_workflows_offer_status
  on public.special_offer_winner_workflows(offer_id, status);

create table if not exists public.special_offer_winner_shortlist (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  offer_id uuid not null,
  entry_id uuid not null,
  status text not null default 'active',
  role text not null default 'shortlisted',
  backup_rank integer,
  score_snapshot_json jsonb not null default '{}'::jsonb,
  entry_status_snapshot text not null,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  rechecked_by uuid references auth.users(id) on delete set null,
  rechecked_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_offer_winner_shortlist_workflow_offer_fkey
    foreign key (workflow_id, offer_id)
    references public.special_offer_winner_workflows(id, offer_id)
    on delete cascade,
  constraint special_offer_winner_shortlist_entry_offer_fkey
    foreign key (entry_id, offer_id)
    references public.special_offer_entries(id, offer_id)
    on delete restrict,
  constraint special_offer_winner_shortlist_workflow_entry_key unique (workflow_id, entry_id),
  constraint special_offer_winner_shortlist_status_check check (status in ('active', 'removed', 'needs_recheck')),
  constraint special_offer_winner_shortlist_role_check check (role in ('shortlisted', 'primary', 'backup')),
  constraint special_offer_winner_shortlist_backup_rank_check check (
    (role = 'backup' and backup_rank is not null and backup_rank > 0)
    or (role <> 'backup' and backup_rank is null)
  ),
  constraint special_offer_winner_shortlist_removed_check check (
    (status = 'removed' and removed_at is not null and removed_by is not null)
    or (status <> 'removed' and removed_at is null and removed_by is null)
  ),
  constraint special_offer_winner_shortlist_rechecked_check check (
    (status <> 'needs_recheck') or (role = 'shortlisted' and backup_rank is null)
  ),
  constraint special_offer_winner_shortlist_score_object_check check (jsonb_typeof(score_snapshot_json) = 'object'),
  constraint special_offer_winner_shortlist_entry_status_check check (
    entry_status_snapshot in ('submitted', 'pending_review', 'approved', 'rejected', 'disqualified', 'withdrawn')
  )
);

create unique index if not exists idx_special_offer_winner_shortlist_one_primary
  on public.special_offer_winner_shortlist(workflow_id)
  where status = 'active' and role = 'primary';

create unique index if not exists idx_special_offer_winner_shortlist_backup_rank
  on public.special_offer_winner_shortlist(workflow_id, backup_rank)
  where status = 'active' and role = 'backup';

create index if not exists idx_special_offer_winner_shortlist_entry
  on public.special_offer_winner_shortlist(entry_id, status);

create index if not exists idx_special_offer_winner_shortlist_offer
  on public.special_offer_winner_shortlist(offer_id, status, role);

create table if not exists public.special_offer_winner_committee_notes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.special_offer_winner_workflows(id) on delete cascade,
  shortlist_id uuid references public.special_offer_winner_shortlist(id) on delete set null,
  entry_id uuid references public.special_offer_entries(id) on delete restrict,
  note_text text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  constraint special_offer_winner_committee_notes_text_check check (
    length(btrim(note_text)) > 0 and char_length(note_text) <= 3000
  ),
  constraint special_offer_winner_committee_notes_archived_check check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  )
);

create index if not exists idx_special_offer_winner_committee_notes_workflow
  on public.special_offer_winner_committee_notes(workflow_id, created_at desc);

create index if not exists idx_special_offer_winner_committee_notes_entry
  on public.special_offer_winner_committee_notes(entry_id)
  where entry_id is not null;

create table if not exists public.special_offer_winner_contact_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.special_offer_winner_workflows(id) on delete cascade,
  shortlist_id uuid not null references public.special_offer_winner_shortlist(id) on delete restrict,
  entry_id uuid not null references public.special_offer_entries(id) on delete restrict,
  status text not null default 'not_started',
  contact_started_at timestamptz,
  response_deadline_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  no_response_at timestamptz,
  replaced_at timestamptz,
  note_text text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint special_offer_winner_contact_events_status_check check (
    status in ('not_started', 'contact_started', 'accepted', 'declined', 'no_response', 'replaced')
  ),
  constraint special_offer_winner_contact_events_note_check check (
    note_text is null or char_length(note_text) <= 2000
  ),
  constraint special_offer_winner_contact_events_started_check check (
    status = 'not_started'
    or (contact_started_at is not null and response_deadline_at is not null and response_deadline_at > contact_started_at)
  ),
  constraint special_offer_winner_contact_events_terminal_check check (
    (case when accepted_at is not null then 1 else 0 end)
    + (case when declined_at is not null then 1 else 0 end)
    + (case when no_response_at is not null then 1 else 0 end) <= 1
  ),
  constraint special_offer_winner_contact_events_status_timestamp_check check (
    (status = 'not_started' and contact_started_at is null and response_deadline_at is null and accepted_at is null and declined_at is null and no_response_at is null and replaced_at is null)
    or (status = 'contact_started' and contact_started_at is not null and response_deadline_at is not null and accepted_at is null and declined_at is null and no_response_at is null and replaced_at is null)
    or (status = 'accepted' and accepted_at is not null and declined_at is null and no_response_at is null and replaced_at is null)
    or (status = 'declined' and declined_at is not null and accepted_at is null and no_response_at is null and replaced_at is null)
    or (status = 'no_response' and no_response_at is not null and accepted_at is null and declined_at is null and replaced_at is null)
    or (status = 'replaced' and replaced_at is not null and accepted_at is null)
  )
);

create index if not exists idx_special_offer_winner_contact_events_workflow
  on public.special_offer_winner_contact_events(workflow_id, created_at desc);

create index if not exists idx_special_offer_winner_contact_events_shortlist
  on public.special_offer_winner_contact_events(shortlist_id, status);

create table if not exists public.special_offer_winner_publications (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  offer_id uuid not null references public.special_offers(id) on delete restrict,
  entry_id uuid not null,
  public_name text not null,
  publication_consent_confirmed boolean not null default false,
  consent_confirmed_by uuid references auth.users(id) on delete set null,
  consent_confirmed_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null,
  unpublished_at timestamptz,
  unpublish_reason_present boolean not null default false,
  created_at timestamptz not null default now(),
  constraint special_offer_winner_publications_workflow_key unique (workflow_id),
  constraint special_offer_winner_publications_workflow_offer_fkey foreign key (workflow_id, offer_id)
    references public.special_offer_winner_workflows(id, offer_id) on delete restrict,
  constraint special_offer_winner_publications_entry_offer_fkey foreign key (entry_id, offer_id)
    references public.special_offer_entries(id, offer_id) on delete restrict,
  constraint special_offer_winner_publications_public_name_check check (
    length(btrim(public_name)) > 0 and char_length(public_name) <= 160
  ),
  constraint special_offer_winner_publications_consent_check check (
    publication_consent_confirmed is true
    and consent_confirmed_by is not null
    and consent_confirmed_at is not null
  ),
  constraint special_offer_winner_publications_unpublish_check check (
    (unpublished_at is null and unpublish_reason_present is false)
    or (unpublished_at is not null and unpublish_reason_present is true)
  )
);

create unique index if not exists idx_special_offer_winner_publications_offer_active
  on public.special_offer_winner_publications(offer_id)
  where unpublished_at is null;

create index if not exists idx_special_offer_winner_publications_entry
  on public.special_offer_winner_publications(entry_id);

drop trigger if exists trg_special_offer_winner_workflows_set_updated_at
  on public.special_offer_winner_workflows;
create trigger trg_special_offer_winner_workflows_set_updated_at
  before update on public.special_offer_winner_workflows
  for each row
  execute function public.special_offers_set_updated_at();

drop trigger if exists trg_special_offer_winner_shortlist_set_updated_at
  on public.special_offer_winner_shortlist;
create trigger trg_special_offer_winner_shortlist_set_updated_at
  before update on public.special_offer_winner_shortlist
  for each row
  execute function public.special_offers_set_updated_at();

alter table public.special_offer_winner_workflows enable row level security;
alter table public.special_offer_winner_shortlist enable row level security;
alter table public.special_offer_winner_committee_notes enable row level security;
alter table public.special_offer_winner_contact_events enable row level security;
alter table public.special_offer_winner_publications enable row level security;

revoke all on table public.special_offer_winner_workflows from public, anon, authenticated;
revoke all on table public.special_offer_winner_shortlist from public, anon, authenticated;
revoke all on table public.special_offer_winner_committee_notes from public, anon, authenticated;
revoke all on table public.special_offer_winner_contact_events from public, anon, authenticated;
revoke all on table public.special_offer_winner_publications from public, anon, authenticated;

grant select on table public.special_offer_winner_workflows to authenticated;
grant select on table public.special_offer_winner_shortlist to authenticated;
grant select on table public.special_offer_winner_committee_notes to authenticated;
grant select on table public.special_offer_winner_contact_events to authenticated;
grant select on table public.special_offer_winner_publications to authenticated;

grant all on table public.special_offer_winner_workflows to service_role;
grant all on table public.special_offer_winner_shortlist to service_role;
grant all on table public.special_offer_winner_committee_notes to service_role;
grant all on table public.special_offer_winner_contact_events to service_role;
grant all on table public.special_offer_winner_publications to service_role;

drop policy if exists special_offer_winner_workflows_admin_select on public.special_offer_winner_workflows;
create policy special_offer_winner_workflows_admin_select
  on public.special_offer_winner_workflows
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_winner_shortlist_admin_select on public.special_offer_winner_shortlist;
create policy special_offer_winner_shortlist_admin_select
  on public.special_offer_winner_shortlist
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_winner_committee_notes_admin_select on public.special_offer_winner_committee_notes;
create policy special_offer_winner_committee_notes_admin_select
  on public.special_offer_winner_committee_notes
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_winner_contact_events_admin_select on public.special_offer_winner_contact_events;
create policy special_offer_winner_contact_events_admin_select
  on public.special_offer_winner_contact_events
  for select
  to authenticated
  using (public.is_current_user_admin());

drop policy if exists special_offer_winner_publications_admin_select on public.special_offer_winner_publications;
create policy special_offer_winner_publications_admin_select
  on public.special_offer_winner_publications
  for select
  to authenticated
  using (public.is_current_user_admin());

create or replace function public.special_offer_winner_score_snapshot(
  p_offer_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_score record;
begin
  select
    base_points,
    share_points,
    comment_points,
    bonus_points,
    total_points,
    approved_activity_count
    into v_score
  from public.special_offer_entry_score_summary(p_offer_id, p_entry_id)
  limit 1;

  return jsonb_build_object(
    'base_points', coalesce(v_score.base_points, 0),
    'share_points', coalesce(v_score.share_points, 0),
    'comment_points', coalesce(v_score.comment_points, 0),
    'bonus_points', coalesce(v_score.bonus_points, 0),
    'total_points', coalesce(v_score.total_points, 0),
    'approved_activity_count', coalesce(v_score.approved_activity_count, 0),
    'snapshot_at', now()
  );
end;
$$;

create or replace function public.special_offer_winner_workflow_readiness(
  p_offer_id uuid
)
returns table(
  offer_id uuid,
  winner_selection_mode text,
  campaign_status text,
  campaign_end_at timestamptz,
  campaign_ended boolean,
  approved_entries_count integer,
  pending_review_entries_count integer,
  pending_activities_count integer,
  approved_activities_count integer,
  active_workflow_exists boolean,
  can_start_workflow boolean,
  blocking_reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_offer public.special_offers%rowtype;
  v_pending_reviews integer := 0;
  v_approved_entries integer := 0;
  v_pending_activities integer := 0;
  v_approved_activities integer := 0;
  v_active_workflow_exists boolean := false;
  v_campaign_ended boolean := false;
  v_blocking_reason text := null;
begin
  if v_actor is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select *
    into v_offer
  from public.special_offers o
  where o.id = p_offer_id;

  if not found then
    raise exception 'offer_not_found' using errcode = 'P0001';
  end if;

  select
    count(*) filter (where status = 'approved')::integer,
    count(*) filter (where status in ('submitted', 'pending_review'))::integer
    into v_approved_entries, v_pending_reviews
  from public.special_offer_entries
  where offer_id = v_offer.id;

  if to_regclass('public.special_offer_entry_activities') is not null then
    select
      count(*) filter (where status = 'pending')::integer,
      count(*) filter (where status = 'approved')::integer
      into v_pending_activities, v_approved_activities
    from public.special_offer_entry_activities
    where offer_id = v_offer.id;
  end if;

  select exists (
    select 1
    from public.special_offer_winner_workflows w
    where w.offer_id = v_offer.id
      and w.status <> 'cancelled'
  ) into v_active_workflow_exists;

  v_campaign_ended := v_offer.end_at is not null and now() > v_offer.end_at;

  v_blocking_reason := case
    when v_offer.winner_selection_mode <> 'manual_selection' then 'winner_selection_mode_not_manual'
    when v_offer.status in ('draft', 'archived') then 'campaign_status_not_allowed'
    when v_offer.end_at is null then 'campaign_end_missing'
    when now() <= v_offer.end_at then 'campaign_not_ended'
    when v_active_workflow_exists then 'active_workflow_exists'
    when v_pending_reviews > 0 then 'pending_entry_reviews'
    when v_pending_activities > 0 then 'pending_activity_reviews'
    else null
  end;

  offer_id := v_offer.id;
  winner_selection_mode := v_offer.winner_selection_mode;
  campaign_status := v_offer.status;
  campaign_end_at := v_offer.end_at;
  campaign_ended := v_campaign_ended;
  approved_entries_count := coalesce(v_approved_entries, 0);
  pending_review_entries_count := coalesce(v_pending_reviews, 0);
  pending_activities_count := coalesce(v_pending_activities, 0);
  approved_activities_count := coalesce(v_approved_activities, 0);
  active_workflow_exists := v_active_workflow_exists;
  can_start_workflow := v_blocking_reason is null;
  blocking_reason := v_blocking_reason;
  return next;
end;
$$;

create or replace function public.special_offer_winner_guard_admin()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function public.special_offer_winner_audit(
  p_offer_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_value jsonb,
  p_new_value jsonb,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
    p_offer_id,
    p_actor_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_value,
    p_new_value,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.admin_start_special_offer_winner_workflow(
  p_offer_id uuid,
  p_reason text
)
returns table(workflow_id uuid, offer_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_offer public.special_offers%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_readiness record;
  v_workflow public.special_offer_winner_workflows%rowtype;
begin
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'workflow_reason_required' using errcode = '23514';
  end if;

  select *
    into v_offer
  from public.special_offers o
  where o.id = p_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found' using errcode = 'P0001';
  end if;

  select *
    into v_readiness
  from public.special_offer_winner_workflow_readiness(v_offer.id);

  if coalesce(v_readiness.can_start_workflow, false) is not true then
    raise exception 'winner_workflow_not_ready: %', v_readiness.blocking_reason using errcode = '23514';
  end if;

  insert into public.special_offer_winner_workflows (
    offer_id,
    status,
    started_by,
    started_at,
    decision_reason
  )
  values (
    v_offer.id,
    'shortlisting',
    v_actor,
    now(),
    v_reason
  )
  returning * into v_workflow;

  perform public.special_offer_winner_audit(
    v_offer.id,
    v_actor,
    'winner_workflow_started',
    'special_offer_winner_workflow',
    v_workflow.id,
    null,
    jsonb_build_object('status', v_workflow.status),
    jsonb_build_object('workflow_id', v_workflow.id, 'reason_present', true)
  );

  workflow_id := v_workflow.id;
  offer_id := v_workflow.offer_id;
  status := v_workflow.status;
  return next;
exception
  when unique_violation then
    raise exception 'active_winner_workflow_exists' using errcode = '23505';
end;
$$;

create or replace function public.admin_add_special_offer_shortlist_entry(
  p_workflow_id uuid,
  p_entry_id uuid
)
returns table(shortlist_id uuid, workflow_id uuid, entry_id uuid, status text, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_entry public.special_offer_entries%rowtype;
  v_shortlist public.special_offer_winner_shortlist%rowtype;
begin
  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = p_workflow_id
  for update;

  if not found then
    raise exception 'winner_workflow_not_found' using errcode = 'P0001';
  end if;
  if v_workflow.status not in ('shortlisting', 'candidate_selected') then
    raise exception 'winner_workflow_not_shortlisting' using errcode = '23514';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
    and e.offer_id = v_workflow.offer_id
  for update;

  if not found then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if v_entry.status <> 'approved' then
    raise exception 'entry_not_eligible_for_shortlist' using errcode = '23514';
  end if;

  insert into public.special_offer_winner_shortlist (
    workflow_id,
    offer_id,
    entry_id,
    status,
    role,
    score_snapshot_json,
    entry_status_snapshot,
    added_by
  )
  values (
    v_workflow.id,
    v_workflow.offer_id,
    v_entry.id,
    'active',
    'shortlisted',
    public.special_offer_winner_score_snapshot(v_workflow.offer_id, v_entry.id),
    v_entry.status,
    v_actor
  )
  returning * into v_shortlist;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_shortlist_added',
    'special_offer_winner_shortlist',
    v_shortlist.id,
    null,
    jsonb_build_object('status', v_shortlist.status, 'role', v_shortlist.role),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_entry.id, 'score_snapshot', v_shortlist.score_snapshot_json)
  );

  shortlist_id := v_shortlist.id;
  workflow_id := v_shortlist.workflow_id;
  entry_id := v_shortlist.entry_id;
  status := v_shortlist.status;
  role := v_shortlist.role;
  return next;
exception
  when unique_violation then
    raise exception 'shortlist_entry_duplicate' using errcode = '23505';
end;
$$;

create or replace function public.admin_remove_special_offer_shortlist_entry(
  p_shortlist_id uuid,
  p_reason text
)
returns table(shortlist_id uuid, previous_status text, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'remove_reason_required' using errcode = '23514';
  end if;

  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_shortlist_id
  for update;

  if not found then
    raise exception 'shortlist_entry_not_found' using errcode = 'P0001';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_item.workflow_id
  for update;

  if v_workflow.status not in ('shortlisting', 'candidate_selected') then
    raise exception 'winner_workflow_not_editable' using errcode = '23514';
  end if;

  update public.special_offer_winner_shortlist
     set status = 'removed',
         role = 'shortlisted',
         backup_rank = null,
         removed_by = v_actor,
         removed_at = now()
   where id = v_item.id
   returning * into v_item;

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_shortlist_removed',
    'special_offer_winner_shortlist',
    v_item.id,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'removed'),
    jsonb_build_object('workflow_id', v_item.workflow_id, 'entry_id', v_item.entry_id, 'reason_present', true)
  );

  shortlist_id := v_item.id;
  previous_status := 'active';
  status := v_item.status;
  return next;
end;
$$;

create or replace function public.admin_mark_special_offer_shortlist_rechecked(
  p_shortlist_id uuid
)
returns table(shortlist_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
begin
  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_shortlist_id
  for update;

  if not found then
    raise exception 'shortlist_entry_not_found' using errcode = 'P0001';
  end if;
  if v_item.status <> 'needs_recheck' then
    raise exception 'shortlist_recheck_not_required' using errcode = '23514';
  end if;

  update public.special_offer_winner_shortlist
     set status = 'active',
         rechecked_by = v_actor,
         rechecked_at = now(),
         score_snapshot_json = public.special_offer_winner_score_snapshot(offer_id, entry_id)
   where id = v_item.id
   returning * into v_item;

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_shortlist_rechecked',
    'special_offer_winner_shortlist',
    v_item.id,
    jsonb_build_object('status', 'needs_recheck'),
    jsonb_build_object('status', 'active'),
    jsonb_build_object('workflow_id', v_item.workflow_id, 'entry_id', v_item.entry_id)
  );

  shortlist_id := v_item.id;
  status := v_item.status;
  return next;
end;
$$;

create or replace function public.admin_add_special_offer_committee_note(
  p_workflow_id uuid,
  p_shortlist_id uuid,
  p_entry_id uuid,
  p_note_text text
)
returns table(note_id uuid, workflow_id uuid, archived boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_note_text text := nullif(btrim(coalesce(p_note_text, '')), '');
  v_note public.special_offer_winner_committee_notes%rowtype;
begin
  if v_note_text is null or char_length(v_note_text) > 3000 then
    raise exception 'committee_note_invalid' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = p_workflow_id
  for update;

  if not found then
    raise exception 'winner_workflow_not_found' using errcode = 'P0001';
  end if;

  if p_shortlist_id is not null and not exists (
    select 1 from public.special_offer_winner_shortlist s
    where s.id = p_shortlist_id
      and s.workflow_id = v_workflow.id
  ) then
    raise exception 'shortlist_entry_not_found' using errcode = 'P0001';
  end if;
  if p_shortlist_id is not null
     and p_entry_id is not null
     and not exists (
       select 1 from public.special_offer_winner_shortlist s
       where s.id = p_shortlist_id
         and s.workflow_id = v_workflow.id
         and s.entry_id = p_entry_id
     ) then
    raise exception 'committee_note_entry_mismatch' using errcode = '23514';
  end if;

  if p_entry_id is not null and not exists (
    select 1 from public.special_offer_entries e
    where e.id = p_entry_id
      and e.offer_id = v_workflow.offer_id
  ) then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  insert into public.special_offer_winner_committee_notes (
    workflow_id,
    shortlist_id,
    entry_id,
    note_text,
    created_by
  )
  values (
    v_workflow.id,
    p_shortlist_id,
    p_entry_id,
    v_note_text,
    v_actor
  )
  returning * into v_note;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_committee_note_added',
    'special_offer_winner_committee_note',
    v_note.id,
    null,
    jsonb_build_object('created', true),
    jsonb_build_object('workflow_id', v_workflow.id, 'shortlist_id', p_shortlist_id, 'entry_id', p_entry_id, 'note_present', true)
  );

  note_id := v_note.id;
  workflow_id := v_note.workflow_id;
  archived := false;
  return next;
end;
$$;

create or replace function public.admin_archive_special_offer_committee_note(
  p_note_id uuid,
  p_reason text
)
returns table(note_id uuid, archived boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_note public.special_offer_winner_committee_notes%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'archive_reason_required' using errcode = '23514';
  end if;

  select *
    into v_note
  from public.special_offer_winner_committee_notes n
  where n.id = p_note_id
  for update;

  if not found then
    raise exception 'committee_note_not_found' using errcode = 'P0001';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows
  where id = v_note.workflow_id;

  update public.special_offer_winner_committee_notes
     set archived_at = now(),
         archived_by = v_actor
   where id = v_note.id
   returning * into v_note;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_committee_note_archived',
    'special_offer_winner_committee_note',
    v_note.id,
    null,
    jsonb_build_object('archived', true),
    jsonb_build_object('workflow_id', v_note.workflow_id, 'reason_present', true, 'note_text_logged', false)
  );

  note_id := v_note.id;
  archived := true;
  return next;
end;
$$;

create or replace function public.admin_set_special_offer_primary_candidate(
  p_shortlist_id uuid,
  p_reason text
)
returns table(shortlist_id uuid, workflow_id uuid, entry_id uuid, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'candidate_reason_required' using errcode = '23514';
  end if;

  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_shortlist_id
  for update;

  if not found then
    raise exception 'shortlist_entry_not_found' using errcode = 'P0001';
  end if;
  if v_item.status <> 'active' then
    raise exception 'shortlist_entry_not_active' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_item.workflow_id
  for update;

  if v_workflow.status not in ('shortlisting', 'candidate_selected') then
    raise exception 'winner_workflow_not_editable' using errcode = '23514';
  end if;

  update public.special_offer_winner_shortlist
     set role = 'shortlisted',
         backup_rank = null
   where workflow_id = v_workflow.id
     and status = 'active'
     and role = 'primary';

  update public.special_offer_winner_shortlist
     set role = 'primary',
         backup_rank = null,
         score_snapshot_json = public.special_offer_winner_score_snapshot(offer_id, entry_id)
   where id = v_item.id
   returning * into v_item;

  update public.special_offer_winner_workflows
     set status = 'candidate_selected',
         decision_reason = v_reason
   where id = v_workflow.id
   returning * into v_workflow;

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_primary_candidate_selected',
    'special_offer_winner_shortlist',
    v_item.id,
    jsonb_build_object('workflow_status', v_workflow.status),
    jsonb_build_object('role', 'primary'),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_item.entry_id, 'reason_present', true, 'score_snapshot', v_item.score_snapshot_json)
  );

  shortlist_id := v_item.id;
  workflow_id := v_item.workflow_id;
  entry_id := v_item.entry_id;
  role := v_item.role;
  return next;
end;
$$;

create or replace function public.admin_set_special_offer_backup_candidate(
  p_shortlist_id uuid,
  p_backup_rank integer,
  p_reason text
)
returns table(shortlist_id uuid, workflow_id uuid, entry_id uuid, role text, backup_rank integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'candidate_reason_required' using errcode = '23514';
  end if;
  if p_backup_rank is null or p_backup_rank <= 0 then
    raise exception 'invalid_backup_rank' using errcode = '23514';
  end if;

  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_shortlist_id
  for update;

  if not found then
    raise exception 'shortlist_entry_not_found' using errcode = 'P0001';
  end if;
  if v_item.status <> 'active' then
    raise exception 'shortlist_entry_not_active' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_item.workflow_id
  for update;

  if v_workflow.status not in ('shortlisting', 'candidate_selected') then
    raise exception 'winner_workflow_not_editable' using errcode = '23514';
  end if;

  update public.special_offer_winner_shortlist
     set role = 'backup',
         backup_rank = p_backup_rank,
         score_snapshot_json = public.special_offer_winner_score_snapshot(offer_id, entry_id)
   where id = v_item.id
   returning * into v_item;

  update public.special_offer_winner_workflows
     set status = 'candidate_selected',
         decision_reason = coalesce(decision_reason, v_reason)
   where id = v_workflow.id
   returning * into v_workflow;

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_backup_candidate_selected',
    'special_offer_winner_shortlist',
    v_item.id,
    null,
    jsonb_build_object('role', 'backup', 'backup_rank', v_item.backup_rank),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_item.entry_id, 'reason_present', true, 'score_snapshot', v_item.score_snapshot_json)
  );

  shortlist_id := v_item.id;
  workflow_id := v_item.workflow_id;
  entry_id := v_item.entry_id;
  role := v_item.role;
  backup_rank := v_item.backup_rank;
  return next;
exception
  when unique_violation then
    raise exception 'backup_rank_duplicate' using errcode = '23505';
end;
$$;

create or replace function public.admin_start_special_offer_winner_contact(
  p_shortlist_id uuid,
  p_response_deadline_at timestamptz,
  p_note_text text default null
)
returns table(contact_event_id uuid, workflow_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_note text := nullif(btrim(coalesce(p_note_text, '')), '');
  v_contact public.special_offer_winner_contact_events%rowtype;
  v_now timestamptz := now();
begin
  if p_response_deadline_at is null or p_response_deadline_at <= v_now then
    raise exception 'invalid_response_deadline' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'contact_note_too_long' using errcode = '23514';
  end if;

  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_shortlist_id
  for update;

  if not found or v_item.status <> 'active' or v_item.role <> 'primary' then
    raise exception 'primary_candidate_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_item.workflow_id
  for update;

  if v_workflow.status <> 'candidate_selected' then
    raise exception 'winner_workflow_not_ready_for_contact' using errcode = '23514';
  end if;

  insert into public.special_offer_winner_contact_events (
    workflow_id,
    shortlist_id,
    entry_id,
    status,
    contact_started_at,
    response_deadline_at,
    note_text,
    created_by
  )
  values (
    v_workflow.id,
    v_item.id,
    v_item.entry_id,
    'contact_started',
    v_now,
    p_response_deadline_at,
    v_note,
    v_actor
  )
  returning * into v_contact;

  update public.special_offer_winner_workflows
     set status = 'contacting'
   where id = v_workflow.id;

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_contact_started',
    'special_offer_winner_contact_event',
    v_contact.id,
    null,
    jsonb_build_object('status', 'contact_started'),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_item.entry_id, 'note_present', v_note is not null)
  );

  contact_event_id := v_contact.id;
  workflow_id := v_contact.workflow_id;
  status := v_contact.status;
  return next;
end;
$$;

create or replace function public.admin_record_special_offer_winner_response(
  p_contact_event_id uuid,
  p_response_status text,
  p_note_text text default null
)
returns table(contact_event_id uuid, workflow_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_contact public.special_offer_winner_contact_events%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_status text := lower(btrim(coalesce(p_response_status, '')));
  v_note text := nullif(btrim(coalesce(p_note_text, '')), '');
  v_now timestamptz := now();
begin
  if v_status not in ('accepted', 'declined', 'no_response') then
    raise exception 'invalid_winner_response_status' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'contact_note_too_long' using errcode = '23514';
  end if;

  select *
    into v_contact
  from public.special_offer_winner_contact_events c
  where c.id = p_contact_event_id
  for update;

  if not found or v_contact.status <> 'contact_started' then
    raise exception 'contact_event_not_open' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_contact.workflow_id
  for update;

  if v_workflow.status <> 'contacting' then
    raise exception 'winner_workflow_not_contacting' using errcode = '23514';
  end if;

  update public.special_offer_winner_contact_events
     set status = v_status,
         accepted_at = case when v_status = 'accepted' then v_now else null end,
         declined_at = case when v_status = 'declined' then v_now else null end,
         no_response_at = case when v_status = 'no_response' then v_now else null end,
         note_text = coalesce(v_note, note_text)
   where id = v_contact.id
   returning * into v_contact;

  if v_status in ('declined', 'no_response') then
    update public.special_offer_winner_workflows
       set status = 'candidate_selected'
     where id = v_workflow.id;
  end if;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_contact_response_recorded',
    'special_offer_winner_contact_event',
    v_contact.id,
    jsonb_build_object('status', 'contact_started'),
    jsonb_build_object('status', v_status),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_contact.entry_id, 'note_present', v_note is not null)
  );

  contact_event_id := v_contact.id;
  workflow_id := v_contact.workflow_id;
  status := v_contact.status;
  return next;
end;
$$;

create or replace function public.admin_promote_special_offer_backup(
  p_backup_shortlist_id uuid,
  p_reason text
)
returns table(shortlist_id uuid, workflow_id uuid, entry_id uuid, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_item public.special_offer_winner_shortlist%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'promote_reason_required' using errcode = '23514';
  end if;

  select *
    into v_item
  from public.special_offer_winner_shortlist s
  where s.id = p_backup_shortlist_id
  for update;

  if not found or v_item.status <> 'active' or v_item.role <> 'backup' then
    raise exception 'backup_candidate_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_item.workflow_id
  for update;

  if v_workflow.status <> 'candidate_selected' then
    raise exception 'winner_workflow_not_ready_for_backup' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.special_offer_winner_contact_events c
    where c.workflow_id = v_workflow.id
      and c.status in ('declined', 'no_response')
  ) then
    raise exception 'replacement_contact_required' using errcode = '23514';
  end if;

  update public.special_offer_winner_shortlist
     set role = 'shortlisted',
         backup_rank = null
   where workflow_id = v_workflow.id
     and status = 'active'
     and role = 'primary';

  update public.special_offer_winner_shortlist
     set role = 'primary',
         backup_rank = null,
         score_snapshot_json = public.special_offer_winner_score_snapshot(offer_id, entry_id)
   where id = v_item.id
   returning * into v_item;

  update public.special_offer_winner_contact_events
     set status = 'replaced',
         replaced_at = now()
   where workflow_id = v_workflow.id
     and status in ('declined', 'no_response');

  perform public.special_offer_winner_audit(
    v_item.offer_id,
    v_actor,
    'winner_backup_promoted',
    'special_offer_winner_shortlist',
    v_item.id,
    null,
    jsonb_build_object('role', 'primary'),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_item.entry_id, 'reason_present', true, 'score_snapshot', v_item.score_snapshot_json)
  );

  shortlist_id := v_item.id;
  workflow_id := v_item.workflow_id;
  entry_id := v_item.entry_id;
  role := v_item.role;
  return next;
end;
$$;

create or replace function public.admin_confirm_special_offer_winner(
  p_contact_event_id uuid,
  p_reason text
)
returns table(workflow_id uuid, entry_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_contact public.special_offer_winner_contact_events%rowtype;
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_snapshot jsonb;
begin
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception 'confirm_reason_required' using errcode = '23514';
  end if;

  select *
    into v_contact
  from public.special_offer_winner_contact_events c
  where c.id = p_contact_event_id
  for update;

  if not found or v_contact.status <> 'accepted' or v_contact.accepted_at is null then
    raise exception 'accepted_contact_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = v_contact.workflow_id
  for update;

  if v_workflow.status <> 'contacting' then
    raise exception 'winner_workflow_not_contacting' using errcode = '23514';
  end if;

  v_snapshot := public.special_offer_winner_score_snapshot(v_workflow.offer_id, v_contact.entry_id);

  update public.special_offer_winner_workflows
     set status = 'winner_confirmed',
         confirmed_entry_id = v_contact.entry_id,
         confirmed_at = now(),
         decision_reason = v_reason
   where id = v_workflow.id
   returning * into v_workflow;

  update public.special_offer_winner_shortlist
     set score_snapshot_json = v_snapshot
   where id = v_contact.shortlist_id;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_confirmed',
    'special_offer_winner_workflow',
    v_workflow.id,
    jsonb_build_object('status', 'contacting'),
    jsonb_build_object('status', v_workflow.status),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_contact.entry_id, 'reason_present', true, 'score_snapshot', v_snapshot)
  );

  workflow_id := v_workflow.id;
  entry_id := v_workflow.confirmed_entry_id;
  status := v_workflow.status;
  return next;
end;
$$;

create or replace function public.admin_publish_special_offer_winner(
  p_workflow_id uuid,
  p_public_name text,
  p_publication_consent_confirmed boolean,
  p_reason text
)
returns table(publication_id uuid, workflow_id uuid, entry_id uuid, published_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_public_name text := nullif(btrim(coalesce(p_public_name, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_publication public.special_offer_winner_publications%rowtype;
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'publish_reason_required' using errcode = '23514';
  end if;
  if v_public_name is null or char_length(v_public_name) > 160 then
    raise exception 'public_name_required' using errcode = '23514';
  end if;
  if p_publication_consent_confirmed is not true then
    raise exception 'publication_consent_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = p_workflow_id
  for update;

  if not found then
    raise exception 'winner_workflow_not_found' using errcode = 'P0001';
  end if;
  if v_workflow.status <> 'winner_confirmed' or v_workflow.confirmed_entry_id is null then
    raise exception 'winner_not_confirmed' using errcode = '23514';
  end if;

  insert into public.special_offer_winner_publications (
    workflow_id,
    offer_id,
    entry_id,
    public_name,
    publication_consent_confirmed,
    consent_confirmed_by,
    consent_confirmed_at,
    published_by,
    published_at
  )
  values (
    v_workflow.id,
    v_workflow.offer_id,
    v_workflow.confirmed_entry_id,
    v_public_name,
    true,
    v_actor,
    now(),
    v_actor,
    now()
  )
  returning * into v_publication;

  update public.special_offer_winner_workflows
     set status = 'published',
         published_at = v_publication.published_at
   where id = v_workflow.id;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_published',
    'special_offer_winner_publication',
    v_publication.id,
    jsonb_build_object('status', 'winner_confirmed'),
    jsonb_build_object('status', 'published'),
    jsonb_build_object('workflow_id', v_workflow.id, 'entry_id', v_workflow.confirmed_entry_id, 'reason_present', true, 'public_name_logged', false)
  );

  publication_id := v_publication.id;
  workflow_id := v_publication.workflow_id;
  entry_id := v_publication.entry_id;
  published_at := v_publication.published_at;
  return next;
exception
  when unique_violation then
    raise exception 'winner_publication_duplicate' using errcode = '23505';
end;
$$;

create or replace function public.admin_unpublish_special_offer_winner(
  p_publication_id uuid,
  p_reason text
)
returns table(publication_id uuid, unpublished_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_publication public.special_offer_winner_publications%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'unpublish_reason_required' using errcode = '23514';
  end if;

  select *
    into v_publication
  from public.special_offer_winner_publications p
  where p.id = p_publication_id
  for update;

  if not found then
    raise exception 'winner_publication_not_found' using errcode = 'P0001';
  end if;
  if v_publication.unpublished_at is not null then
    publication_id := v_publication.id;
    unpublished_at := v_publication.unpublished_at;
    return next;
    return;
  end if;

  update public.special_offer_winner_publications
     set unpublished_at = now(),
         unpublish_reason_present = true
   where id = v_publication.id
   returning * into v_publication;

  perform public.special_offer_winner_audit(
    v_publication.offer_id,
    v_actor,
    'winner_unpublished',
    'special_offer_winner_publication',
    v_publication.id,
    null,
    jsonb_build_object('unpublished', true),
    jsonb_build_object('workflow_id', v_publication.workflow_id, 'entry_id', v_publication.entry_id, 'reason_present', true)
  );

  publication_id := v_publication.id;
  unpublished_at := v_publication.unpublished_at;
  return next;
end;
$$;

create or replace function public.admin_cancel_special_offer_winner_workflow(
  p_workflow_id uuid,
  p_reason text
)
returns table(workflow_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'cancel_reason_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = p_workflow_id
  for update;

  if not found then
    raise exception 'winner_workflow_not_found' using errcode = 'P0001';
  end if;
  if v_workflow.status in ('published', 'cancelled') then
    raise exception 'winner_workflow_not_cancellable' using errcode = '23514';
  end if;

  update public.special_offer_winner_workflows
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_actor,
         confirmed_entry_id = null,
         confirmed_at = null
   where id = v_workflow.id
   returning * into v_workflow;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_workflow_cancelled',
    'special_offer_winner_workflow',
    v_workflow.id,
    null,
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object('workflow_id', v_workflow.id, 'reason_present', true)
  );

  workflow_id := v_workflow.id;
  status := v_workflow.status;
  return next;
end;
$$;

create or replace function public.admin_reopen_special_offer_winner_workflow(
  p_workflow_id uuid,
  p_reason text
)
returns table(workflow_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := public.special_offer_winner_guard_admin();
  v_workflow public.special_offer_winner_workflows%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'reopen_reason_required' using errcode = '23514';
  end if;

  select *
    into v_workflow
  from public.special_offer_winner_workflows w
  where w.id = p_workflow_id
  for update;

  if not found then
    raise exception 'winner_workflow_not_found' using errcode = 'P0001';
  end if;
  if v_workflow.status <> 'cancelled' then
    raise exception 'winner_workflow_not_cancelled' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.special_offer_winner_workflows other
    where other.offer_id = v_workflow.offer_id
      and other.id <> v_workflow.id
      and other.status <> 'cancelled'
  ) then
    raise exception 'active_winner_workflow_exists' using errcode = '23505';
  end if;

  update public.special_offer_winner_workflows
     set status = 'shortlisting',
         cancelled_at = null,
         cancelled_by = null,
         started_at = coalesce(started_at, now()),
         started_by = coalesce(started_by, v_actor)
   where id = v_workflow.id
   returning * into v_workflow;

  perform public.special_offer_winner_audit(
    v_workflow.offer_id,
    v_actor,
    'winner_workflow_reopened',
    'special_offer_winner_workflow',
    v_workflow.id,
    jsonb_build_object('status', 'cancelled'),
    jsonb_build_object('status', 'shortlisting'),
    jsonb_build_object('workflow_id', v_workflow.id, 'reason_present', true)
  );

  workflow_id := v_workflow.id;
  status := v_workflow.status;
  return next;
end;
$$;

-- Correction integration: a correction during shortlisting/candidate selection
-- marks the shortlist item for re-check and removes active candidate role. Once
-- contact/final/publication has started, participant correction is blocked.
create or replace function public.update_special_offer_entry_once(
  p_entry_id uuid,
  p_answers jsonb,
  p_client_correction_id uuid
)
returns table(entry_id uuid, status text, reference text, correction_count smallint, idempotent boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_entry public.special_offer_entries%rowtype;
  v_offer public.special_offers%rowtype;
  v_blocking_workflow_count integer := 0;
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_auth_email text := '';
  v_auth_email_confirmed_at timestamptz;
  v_now timestamptz := now();
  v_answer record;
  v_key text;
  v_snapshot jsonb;
  v_type text;
  v_required boolean;
  v_value jsonb;
  v_value_type text;
  v_text text;
  v_value_json jsonb;
  v_new_answers jsonb := '{}'::jsonb;
  v_changed_fields text[] := array[]::text[];
  v_previous_status text;
  v_first_name text := null;
  v_last_name text := null;
  v_phone text := null;
  v_profile_name text := null;
  v_profile_enriched_fields text[] := array[]::text[];
  v_profile_update_count integer := 0;
  v_previous_profile_name text := null;
  v_previous_phone text := null;
  v_lang text := 'pl';
  v_allowed boolean;
  v_min_age integer;
  v_birth_date date;
  v_today date;
begin
  if v_uid is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if p_entry_id is null then
    raise exception 'entry_id_required' using errcode = '23514';
  end if;
  if p_client_correction_id is null then
    raise exception 'client_correction_id_required' using errcode = '23514';
  end if;
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'answers_must_be_object' using errcode = '23514';
  end if;
  if octet_length(v_answers::text) > 65536 then
    raise exception 'answers_payload_too_large' using errcode = '23514';
  end if;

  select lower(btrim(coalesce(u.email, ''))), coalesce(u.email_confirmed_at, u.confirmed_at)
    into v_auth_email, v_auth_email_confirmed_at
  from auth.users u
  where u.id = v_uid
  limit 1;

  if v_auth_email = '' then
    raise exception 'authenticated_email_missing' using errcode = '23514';
  end if;
  if v_auth_email_confirmed_at is null then
    raise exception 'email_not_confirmed' using errcode = '42501';
  end if;

  select *
    into v_entry
  from public.special_offer_entries e
  where e.id = p_entry_id
  for update;

  if not found or v_entry.user_id is distinct from v_uid then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;

  if v_entry.correction_count = 1
     and v_entry.correction_client_submission_id = p_client_correction_id then
    entry_id := v_entry.id;
    status := v_entry.status;
    reference := v_entry.reference;
    correction_count := v_entry.correction_count;
    idempotent := true;
    return next;
    return;
  end if;

  select count(*)::integer
    into v_blocking_workflow_count
  from public.special_offer_winner_shortlist s
  join public.special_offer_winner_workflows w on w.id = s.workflow_id
  where s.entry_id = v_entry.id
    and s.status in ('active', 'needs_recheck')
    and w.status in ('contacting', 'winner_confirmed', 'published');

  if v_blocking_workflow_count > 0 then
    raise exception 'entry_locked_by_winner_workflow' using errcode = '23514';
  end if;

  if v_entry.correction_count >= 1 then
    raise exception 'correction_already_used' using errcode = '23505';
  end if;

  if v_entry.status not in ('submitted', 'pending_review', 'approved', 'rejected') then
    raise exception 'entry_not_correctable' using errcode = '23514';
  end if;

  select *
    into v_offer
  from public.special_offers o
  where o.id = v_entry.offer_id
  for update;

  if not found
     or v_offer.status <> 'active'
     or v_offer.visibility <> 'public'
     or v_offer.start_at is null
     or v_offer.end_at is null
     or v_now < v_offer.start_at
     or v_now > v_offer.end_at then
    raise exception 'campaign_not_available' using errcode = 'P0001';
  end if;

  for v_key in select jsonb_object_keys(v_answers)
  loop
    if not exists (
      select 1
      from public.special_offer_entry_answers a
      where a.entry_id = v_entry.id
        and a.field_key = v_key
    ) then
      raise exception 'unknown_or_inactive_field: %', v_key using errcode = '23514';
    end if;
  end loop;

  v_previous_status := v_entry.status;
  v_previous_profile_name := nullif(btrim(concat_ws(' ', v_entry.first_name, v_entry.last_name)), '');
  v_previous_phone := nullif(btrim(coalesce(v_entry.phone, '')), '');
  v_lang := case
    when lower(coalesce(v_entry.submitted_lang, 'pl')) in ('pl', 'en', 'he')
      then lower(coalesce(v_entry.submitted_lang, 'pl'))
    else 'pl'
  end;

  for v_answer in
    select *
    from public.special_offer_entry_answers a
    where a.entry_id = v_entry.id
    order by coalesce((a.field_snapshot_json ->> 'sort_order')::integer, 9999), a.created_at asc
  loop
    v_snapshot := coalesce(v_answer.field_snapshot_json, '{}'::jsonb);
    v_key := v_answer.field_key;
    v_type := lower(coalesce(v_snapshot ->> 'field_type', 'text'));
    v_required := coalesce((v_snapshot ->> 'required')::boolean, false);
    v_value := v_answers -> v_key;

    if v_key = 'email' then
      v_value := to_jsonb(v_auth_email);
    elsif not (v_answers ? v_key) then
      v_value := coalesce(v_answer.value_json, 'null'::jsonb);
    end if;

    v_value_type := coalesce(jsonb_typeof(v_value), 'missing');
    v_text := null;
    v_value_json := 'null'::jsonb;

    if v_value_type in ('missing', 'null') then
      if v_required then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
    elsif v_type in ('checkbox', 'consent') then
      if v_value_type <> 'boolean' then
        raise exception 'invalid_boolean_field: %', v_key using errcode = '23514';
      end if;
      if v_required and v_value <> 'true'::jsonb then
        raise exception 'must_be_true_field: %', v_key using errcode = '23514';
      end if;
      v_value_json := v_value;
      v_text := v_value #>> '{}';
    elsif v_type = 'checkbox_group' then
      if v_value_type <> 'array' then
        raise exception 'invalid_checkbox_group_field: %', v_key using errcode = '23514';
      end if;
      if v_required and jsonb_array_length(v_value) = 0 then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
      select not exists (
        select 1
        from jsonb_array_elements_text(v_value) selected(value)
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(v_snapshot -> 'options_json', '[]'::jsonb)) opt
          where opt ->> 'value' = selected.value
        )
      ) into v_allowed;
      if not coalesce(v_allowed, false) then
        raise exception 'invalid_option_field: %', v_key using errcode = '23514';
      end if;
      v_value_json := v_value;
      v_text := array_to_string(array(select jsonb_array_elements_text(v_value)), ', ');
    else
      if v_value_type <> 'string' then
        raise exception 'invalid_text_field: %', v_key using errcode = '23514';
      end if;
      v_text := btrim(v_value #>> '{}');
      if v_required and v_text = '' then
        raise exception 'required_field_missing: %', v_key using errcode = '23514';
      end if;
      v_value_json := to_jsonb(v_text);
    end if;

    if v_type in ('text', 'textarea', 'contest_answer', 'custom') and char_length(coalesce(v_text, '')) > 5000 then
      raise exception 'field_payload_too_large: %', v_key using errcode = '23514';
    end if;

    if v_type in ('url', 'facebook_profile_url', 'shared_post_url') and coalesce(v_text, '') <> '' and v_text !~* '^https?://[^[:space:]]+$' then
      raise exception 'invalid_url_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'email' and lower(coalesce(v_text, '')) <> v_auth_email then
      raise exception 'invalid_email_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'phone' and coalesce(v_text, '') <> '' and v_text !~ '^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$' then
      raise exception 'invalid_phone_field: %', v_key using errcode = '23514';
    end if;

    if v_type = 'date_of_birth' and coalesce(v_text, '') <> '' then
      begin
        v_birth_date := v_text::date;
      exception when others then
        raise exception 'invalid_date_of_birth_field: %', v_key using errcode = '23514';
      end;
      v_min_age := nullif(v_snapshot #>> '{validation_json,min_age}', '')::integer;
      v_today := (v_now at time zone coalesce(nullif(v_offer.timezone, ''), 'Asia/Nicosia'))::date;
      if v_min_age is not null and v_birth_date > (v_today - make_interval(years => v_min_age))::date then
        raise exception 'min_age_field: %', v_key using errcode = '23514';
      end if;
    end if;

    if v_type = 'select' and coalesce(v_text, '') <> '' then
      select exists (
        select 1
        from jsonb_array_elements(coalesce(v_snapshot -> 'options_json', '[]'::jsonb)) opt
        where opt ->> 'value' = v_text
      ) into v_allowed;
      if not coalesce(v_allowed, false) then
        raise exception 'invalid_option_field: %', v_key using errcode = '23514';
      end if;
    end if;

    if coalesce(v_answer.value_json, 'null'::jsonb) is distinct from v_value_json then
      v_changed_fields := array_append(v_changed_fields, v_key);
    end if;

    update public.special_offer_entry_answers
       set value_text = nullif(v_text, ''),
           value_json = v_value_json,
           field_snapshot_json = v_answer.field_snapshot_json
     where id = v_answer.id;

    v_new_answers := v_new_answers || jsonb_build_object(v_key, v_value_json);
  end loop;

  v_first_name := nullif(left(btrim(coalesce(v_new_answers ->> 'first_name', '')), 120), '');
  v_last_name := nullif(left(btrim(coalesce(v_new_answers ->> 'last_name', '')), 120), '');
  v_phone := nullif(left(btrim(coalesce(v_new_answers ->> 'phone', '')), 80), '');
  v_profile_name := nullif(left(btrim(concat_ws(' ', v_first_name, v_last_name)), 160), '');

  update public.special_offer_entries
     set status = 'pending_review',
         answers_json = v_new_answers,
         first_name = v_first_name,
         last_name = v_last_name,
         phone = v_phone,
         reviewed_at = null,
         reviewed_by = null,
         review_note = null,
         rejection_reason = null,
         correction_count = 1,
         corrected_at = v_now,
         correction_client_submission_id = p_client_correction_id,
         updated_at = v_now
   where id = v_entry.id;

  update public.special_offer_winner_shortlist s
     set status = 'needs_recheck',
         role = 'shortlisted',
         backup_rank = null,
         score_snapshot_json = public.special_offer_winner_score_snapshot(s.offer_id, s.entry_id)
    from public.special_offer_winner_workflows w
   where w.id = s.workflow_id
     and s.entry_id = v_entry.id
     and s.status = 'active'
     and w.status in ('shortlisting', 'candidate_selected');

  if to_regclass('public.profiles') is not null then
    if v_profile_name is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'name'
    ) then
      execute
        'update public.profiles
            set name = $1, updated_at = now()
          where id = $2
            and (nullif(btrim(coalesce(name, '''')), '''') is null or name = $3)'
      using v_profile_name, v_uid, v_previous_profile_name;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'name');
      end if;
    end if;

    if v_phone is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
    ) then
      execute
        'update public.profiles
            set phone = $1, updated_at = now()
          where id = $2
            and (nullif(btrim(coalesce(phone, '''')), '''') is null or phone = $3)'
      using v_phone, v_uid, v_previous_phone;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'phone');
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'preferred_language'
    ) and (
      v_lang <> 'he'
      or not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
      )
      or exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
          and pg_get_constraintdef(con.oid) ilike '%he%'
      )
    ) then
      execute
        'update public.profiles
            set preferred_language = $1, updated_at = now()
          where id = $2
            and (preferred_language is null or preferred_language = $1)'
      using v_lang, v_uid;
      get diagnostics v_profile_update_count = row_count;
      if v_profile_update_count > 0 then
        v_profile_enriched_fields := array_append(v_profile_enriched_fields, 'preferred_language');
      end if;
    end if;
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
    v_uid,
    'entry_corrected',
    'special_offer_entry',
    v_entry.id,
    jsonb_build_object('status', v_previous_status, 'correction_count', v_entry.correction_count),
    jsonb_build_object('status', 'pending_review', 'correction_count', 1),
    jsonb_build_object(
      'entry_id', v_entry.id,
      'changed_fields', to_jsonb(v_changed_fields),
      'profile_enriched_fields', to_jsonb(v_profile_enriched_fields),
      'shortlist_needs_recheck_applied', true,
      'answers_logged', false
    )
  );

  entry_id := v_entry.id;
  status := 'pending_review';
  reference := v_entry.reference;
  correction_count := 1;
  idempotent := false;
  return next;
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
  v_workflow_link_count integer := 0;
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

  select
    (
      select count(*)::integer
      from public.special_offer_winner_shortlist s
      where s.entry_id = v_entry.id
        and s.status in ('active', 'needs_recheck')
    )
    + (
      select count(*)::integer
      from public.special_offer_winner_contact_events c
      where c.entry_id = v_entry.id
    )
    + (
      select count(*)::integer
      from public.special_offer_winner_workflows w
      where w.confirmed_entry_id = v_entry.id
    )
    + (
      select count(*)::integer
      from public.special_offer_winner_publications p
      where p.entry_id = v_entry.id
    )
    + (
      select count(*)::integer
      from public.special_offer_winner_committee_notes n
      where n.entry_id = v_entry.id
        or exists (
          select 1
          from public.special_offer_winner_shortlist s
          where s.id = n.shortlist_id
            and s.entry_id = v_entry.id
        )
    )
    into v_workflow_link_count;

  if v_workflow_link_count > 0 then
    raise exception 'entry_has_winner_workflow_record' using errcode = '23514';
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
      'winner_workflow_link_count', v_workflow_link_count,
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

alter function public.special_offer_winner_score_snapshot(uuid, uuid) owner to postgres;
alter function public.special_offer_winner_workflow_readiness(uuid) owner to postgres;
alter function public.special_offer_winner_guard_admin() owner to postgres;
alter function public.special_offer_winner_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, jsonb) owner to postgres;
alter function public.admin_start_special_offer_winner_workflow(uuid, text) owner to postgres;
alter function public.admin_add_special_offer_shortlist_entry(uuid, uuid) owner to postgres;
alter function public.admin_remove_special_offer_shortlist_entry(uuid, text) owner to postgres;
alter function public.admin_mark_special_offer_shortlist_rechecked(uuid) owner to postgres;
alter function public.admin_add_special_offer_committee_note(uuid, uuid, uuid, text) owner to postgres;
alter function public.admin_archive_special_offer_committee_note(uuid, text) owner to postgres;
alter function public.admin_set_special_offer_primary_candidate(uuid, text) owner to postgres;
alter function public.admin_set_special_offer_backup_candidate(uuid, integer, text) owner to postgres;
alter function public.admin_start_special_offer_winner_contact(uuid, timestamptz, text) owner to postgres;
alter function public.admin_record_special_offer_winner_response(uuid, text, text) owner to postgres;
alter function public.admin_promote_special_offer_backup(uuid, text) owner to postgres;
alter function public.admin_confirm_special_offer_winner(uuid, text) owner to postgres;
alter function public.admin_publish_special_offer_winner(uuid, text, boolean, text) owner to postgres;
alter function public.admin_unpublish_special_offer_winner(uuid, text) owner to postgres;
alter function public.admin_cancel_special_offer_winner_workflow(uuid, text) owner to postgres;
alter function public.admin_reopen_special_offer_winner_workflow(uuid, text) owner to postgres;
alter function public.update_special_offer_entry_once(uuid, jsonb, uuid) owner to postgres;
alter function public.admin_delete_special_offer_entry(uuid, text, text) owner to postgres;

revoke all on function public.special_offer_winner_score_snapshot(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.special_offer_winner_workflow_readiness(uuid) from public, anon, authenticated, service_role;
revoke all on function public.special_offer_winner_guard_admin() from public, anon, authenticated, service_role;
revoke all on function public.special_offer_winner_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_start_special_offer_winner_workflow(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_add_special_offer_shortlist_entry(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_remove_special_offer_shortlist_entry(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_mark_special_offer_shortlist_rechecked(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_add_special_offer_committee_note(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_archive_special_offer_committee_note(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_special_offer_primary_candidate(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_special_offer_backup_candidate(uuid, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_start_special_offer_winner_contact(uuid, timestamptz, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_record_special_offer_winner_response(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_promote_special_offer_backup(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_confirm_special_offer_winner(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_publish_special_offer_winner(uuid, text, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_unpublish_special_offer_winner(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_cancel_special_offer_winner_workflow(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.admin_reopen_special_offer_winner_workflow(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.update_special_offer_entry_once(uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_special_offer_entry(uuid, text, text) from public, anon, authenticated, service_role;

grant execute on function public.special_offer_winner_workflow_readiness(uuid) to authenticated;
grant execute on function public.admin_start_special_offer_winner_workflow(uuid, text) to authenticated;
grant execute on function public.admin_add_special_offer_shortlist_entry(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_special_offer_shortlist_entry(uuid, text) to authenticated;
grant execute on function public.admin_mark_special_offer_shortlist_rechecked(uuid) to authenticated;
grant execute on function public.admin_add_special_offer_committee_note(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.admin_archive_special_offer_committee_note(uuid, text) to authenticated;
grant execute on function public.admin_set_special_offer_primary_candidate(uuid, text) to authenticated;
grant execute on function public.admin_set_special_offer_backup_candidate(uuid, integer, text) to authenticated;
grant execute on function public.admin_start_special_offer_winner_contact(uuid, timestamptz, text) to authenticated;
grant execute on function public.admin_record_special_offer_winner_response(uuid, text, text) to authenticated;
grant execute on function public.admin_promote_special_offer_backup(uuid, text) to authenticated;
grant execute on function public.admin_confirm_special_offer_winner(uuid, text) to authenticated;
grant execute on function public.admin_publish_special_offer_winner(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_unpublish_special_offer_winner(uuid, text) to authenticated;
grant execute on function public.admin_cancel_special_offer_winner_workflow(uuid, text) to authenticated;
grant execute on function public.admin_reopen_special_offer_winner_workflow(uuid, text) to authenticated;
grant execute on function public.update_special_offer_entry_once(uuid, jsonb, uuid) to authenticated;
grant execute on function public.admin_delete_special_offer_entry(uuid, text, text) to authenticated;

comment on table public.special_offer_winner_workflows is
  'Manual winner selection workflow for Special Offers. Does not run a draw and does not auto-select by score.';
comment on table public.special_offer_winner_shortlist is
  'Admin-only shortlist and candidate roles. Score snapshot is supporting context only.';
comment on table public.special_offer_winner_committee_notes is
  'Private append-only committee notes for administrators. Not public and not copied into audit metadata.';
comment on table public.special_offer_winner_contact_events is
  'Manual contact workflow status. No automatic emails are sent by this stage.';
comment on table public.special_offer_winner_publications is
  'Public-safe winner publication records requiring explicit publication consent.';
comment on function public.special_offer_winner_workflow_readiness(uuid) is
  'Admin-only read-only readiness summary for manual winner workflow start. Returns counts only and no PII.';
comment on function public.admin_publish_special_offer_winner(uuid, text, boolean, text) is
  'Admin-only winner publication RPC. Requires confirmed winner, explicit public name and publication consent.';

commit;
