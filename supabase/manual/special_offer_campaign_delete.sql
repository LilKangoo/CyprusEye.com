-- Admin-only campaign deletion. Installing this function deletes no data.
-- Every deletion is atomic, scoped by campaign ID, and requires exact confirmation.
begin;
create or replace function public.admin_delete_special_offer_campaign(
  p_offer_id uuid,
  p_expected_slug text,
  p_confirmation text
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if not coalesce(public.is_current_user_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'DELETE' then
    raise exception 'delete_confirmation_required' using errcode = '23514';
  end if;
  select o.slug into v_slug from public.special_offers o where o.id = p_offer_id for update;
  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0001';
  end if;
  if p_expected_slug is distinct from v_slug then
    raise exception 'campaign_slug_mismatch' using errcode = '23514';
  end if;
  -- Lock workflow parents before deleting their children. Foreign-key locks
  -- prevent concurrent additions from leaving partial or orphaned data.
  perform 1 from public.special_offer_winner_workflows w where w.offer_id = p_offer_id for update;
  delete from public.special_offer_winner_publications p where p.offer_id = p_offer_id;
  delete from public.special_offer_winner_contact_events c
    using public.special_offer_winner_workflows w where c.workflow_id = w.id and w.offer_id = p_offer_id;
  delete from public.special_offer_winner_committee_notes n
    using public.special_offer_winner_workflows w where n.workflow_id = w.id and w.offer_id = p_offer_id;
  delete from public.special_offer_winner_shortlist s where s.offer_id = p_offer_id;
  delete from public.special_offer_winner_workflows w where w.offer_id = p_offer_id;
  delete from public.special_offer_entry_activities a where a.offer_id = p_offer_id;
  delete from public.special_offer_entries e where e.offer_id = p_offer_id;
  -- Remaining campaign-owned data cascades: translations, prizes, links,
  -- form definitions/translations, official posts and campaign audit history.
  -- Answers and referral attribution cascade with entries. Shared users,
  -- partners, linked service records and media library files are untouched.
  delete from public.special_offers o where o.id = p_offer_id;
  return true;
end;
$$;
revoke all on function public.admin_delete_special_offer_campaign(uuid,text,text) from public, anon, service_role;
grant execute on function public.admin_delete_special_offer_campaign(uuid,text,text) to authenticated;
commit;
