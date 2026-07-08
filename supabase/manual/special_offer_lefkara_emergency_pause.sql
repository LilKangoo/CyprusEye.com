-- =====================================================
-- Special Offers Lefkara emergency pause
-- =====================================================
-- Purpose:
-- - block new entries and activity claims without deleting data
-- - preserve entries, answers, activities, official posts, and admin review access
--
-- Safe to run if production smoke/soft launch finds a critical issue.
-- =====================================================

begin;

do $$
declare
  v_expected_slug constant text := 'lefkara-giveaway-2026';
  v_offer public.special_offers%rowtype;
  v_offer_count integer;
  v_old_value jsonb;
  v_new_value jsonb;
begin
  select count(*)
  into v_offer_count
  from public.special_offers
  where slug = v_expected_slug;

  if v_offer_count <> 1 then
    raise exception 'Expected exactly one Lefkara campaign for slug %, found %', v_expected_slug, v_offer_count;
  end if;

  select *
  into v_offer
  from public.special_offers
  where slug = v_expected_slug
  for update;

  v_old_value := jsonb_build_object(
    'status', v_offer.status,
    'visibility', v_offer.visibility,
    'archived_at', v_offer.archived_at
  );

  update public.special_offers
  set
    status = 'locked',
    visibility = 'private',
    updated_at = now()
  where id = v_offer.id;

  v_new_value := jsonb_build_object(
    'status', 'locked',
    'visibility', 'private',
    'archived_at', v_offer.archived_at
  );

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
    null,
    'campaign_emergency_paused',
    'special_offer',
    v_offer.id,
    v_old_value,
    v_new_value,
    jsonb_build_object(
      'source', 'special_offer_lefkara_emergency_pause',
      'slug', v_expected_slug,
      'data_deleted', false
    )
  );
end $$;

commit;
