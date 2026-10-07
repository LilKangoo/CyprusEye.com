-- Function-only repair for ambiguous OUT parameter / column references.
-- Preserves existing tables, grants, entries, shortlist, contacts and audit history.
-- Also enforces the campaign public_winner_display setting before publication.
-- Apply after the manual winner stage. No winner is selected by this migration.
begin;

-- Refuse to install new entry points with default privileges on an incomplete schema.
do $preflight$
begin
  if to_regprocedure('public.admin_set_special_offer_primary_candidate(uuid,text)') is null
     or to_regprocedure('public.admin_set_special_offer_backup_candidate(uuid,integer,text)') is null
     or to_regprocedure('public.admin_promote_special_offer_backup(uuid,text)') is null
     or to_regprocedure('public.admin_publish_special_offer_winner(uuid,text,boolean,text)') is null then
    raise exception 'Manual winner functions must already exist before applying this repair';
  end if;
end;
$preflight$;

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

  update public.special_offer_winner_shortlist as target
     set role = 'shortlisted',
         backup_rank = null
   where target.workflow_id = v_workflow.id
     and target.status = 'active'
     and target.role = 'primary';

  update public.special_offer_winner_shortlist as target
     set role = 'primary',
         backup_rank = null,
         score_snapshot_json = public.special_offer_winner_score_snapshot(target.offer_id, target.entry_id)
   where target.id = v_item.id
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

  update public.special_offer_winner_shortlist as target
     set role = 'backup',
         backup_rank = p_backup_rank,
         score_snapshot_json = public.special_offer_winner_score_snapshot(target.offer_id, target.entry_id)
   where target.id = v_item.id
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

  update public.special_offer_winner_shortlist as target
     set role = 'shortlisted',
         backup_rank = null
   where target.workflow_id = v_workflow.id
     and target.status = 'active'
     and target.role = 'primary';

  update public.special_offer_winner_shortlist as target
     set role = 'primary',
         backup_rank = null,
         score_snapshot_json = public.special_offer_winner_score_snapshot(target.offer_id, target.entry_id)
   where target.id = v_item.id
   returning * into v_item;

  update public.special_offer_winner_contact_events as target
     set status = 'replaced',
         replaced_at = now()
   where target.workflow_id = v_workflow.id
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
  if not exists (
    select 1 from public.special_offers o
    where o.id = v_workflow.offer_id and o.public_winner_display is true
  ) then
    raise exception 'public_winner_display_disabled' using errcode = '23514';
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

commit;
