-- Special Offers 3C.6F-1
-- Minimal corrective SQL for public.special_offer_winner_workflow_readiness(uuid).
-- Fixes ambiguous unqualified offer_id/status references only.
-- Does not create workflow data, does not change tables/RLS, and does not modify campaign data.

begin;

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
    count(*) filter (where e.status = 'approved')::integer,
    count(*) filter (where e.status in ('submitted', 'pending_review'))::integer
    into v_approved_entries, v_pending_reviews
  from public.special_offer_entries e
  where e.offer_id = v_offer.id;

  if to_regclass('public.special_offer_entry_activities') is not null then
    select
      count(*) filter (where a.status = 'pending')::integer,
      count(*) filter (where a.status = 'approved')::integer
      into v_pending_activities, v_approved_activities
    from public.special_offer_entry_activities a
    where a.offer_id = v_offer.id;
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

alter function public.special_offer_winner_workflow_readiness(uuid) owner to postgres;

revoke all on function public.special_offer_winner_workflow_readiness(uuid) from public, anon, authenticated, service_role;
grant execute on function public.special_offer_winner_workflow_readiness(uuid) to authenticated;

comment on function public.special_offer_winner_workflow_readiness(uuid) is
  'Admin-only read-only readiness summary for manual Special Offer winner workflow. 3C.6F-1 qualifies entry/activity offer_id references to avoid PL/pgSQL ambiguity.';

commit;

