-- =====================================================
-- Special Offers Lefkara activation - Stage 1
-- =====================================================
-- Purpose:
-- - manually activate Lefkara for public soft launch
-- - update only public launch fields on public.special_offers
-- - do not touch entries, answers, activities, official posts, draws, or winners
--
-- REQUIRED BEFORE RUNNING:
-- 1. Choose one date mode:
--    A. Set v_use_existing_dates := true to keep the dates already stored in DB.
--    B. Keep v_use_existing_dates := false and replace v_start_at_text/v_end_at_text.
-- 2. Confirm Supabase Auth Redirect URLs are configured.
-- 3. Confirm campaign legal/privacy/rules links are ready.
-- 4. Run special_offer_lefkara_launch_preflight.sql and review output.
--
-- Example date format:
--   2026-07-15 00:00:00+03
-- =====================================================

begin;

do $$
declare
  v_expected_slug constant text := 'lefkara-giveaway-2026';
  v_use_existing_dates boolean := false;
  v_start_at_text text := '__REPLACE_WITH_FINAL_START_AT__';
  v_end_at_text text := '__REPLACE_WITH_FINAL_END_AT__';
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_offer public.special_offers%rowtype;
  v_offer_count integer;
  v_translation_count integer;
  v_active_field_count integer;
  v_required_field_count integer;
  v_consent_field_count integer;
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

  if v_use_existing_dates is true then
    if v_offer.start_at is null or v_offer.end_at is null then
      raise exception 'Cannot use existing dates because start_at or end_at is null.';
    end if;

    v_start_at := v_offer.start_at;
    v_end_at := v_offer.end_at;
  else
    if v_start_at_text like '__REPLACE_%' or v_end_at_text like '__REPLACE_%' then
      raise exception 'Choose date mode before running: set v_use_existing_dates=true or replace v_start_at_text/v_end_at_text.';
    end if;

    begin
      v_start_at := v_start_at_text::timestamptz;
      v_end_at := v_end_at_text::timestamptz;
    exception when others then
      raise exception 'Invalid activation date format. Use explicit timestamptz values such as 2026-07-15 00:00:00+03.';
    end;
  end if;

  if v_start_at >= v_end_at then
    raise exception 'Activation requires start_at before end_at.';
  end if;

  if v_offer.winner_selection_mode <> 'manual_selection' then
    raise exception 'Refusing activation: winner_selection_mode must be manual_selection.';
  end if;

  if v_offer.allow_bonus_points is not true then
    raise exception 'Refusing activation: allow_bonus_points must be true.';
  end if;

  if v_offer.requires_form is not true then
    raise exception 'Refusing activation: requires_form must be true.';
  end if;

  if v_offer.requires_manual_approval is not true then
    raise exception 'Refusing activation: requires_manual_approval must be true.';
  end if;

  select count(*)
  into v_translation_count
  from public.special_offer_translations t
  where t.offer_id = v_offer.id
    and t.lang in ('pl', 'en', 'he')
    and nullif(btrim(coalesce(t.title, '')), '') is not null
    and nullif(btrim(coalesce(t.full_description, '')), '') is not null;

  if v_translation_count <> 3 then
    raise exception 'Refusing activation: PL/EN/HE translations are incomplete. Ready count=%', v_translation_count;
  end if;

  select
    count(*) filter (where f.active = true),
    count(*) filter (where f.active = true and f.required = true),
    count(*) filter (where f.active = true and f.field_type = 'consent')
  into v_active_field_count, v_required_field_count, v_consent_field_count
  from public.special_offer_form_fields f
  where f.offer_id = v_offer.id;

  if coalesce(v_active_field_count, 0) = 0 then
    raise exception 'Refusing activation: no active form fields.';
  end if;

  if coalesce(v_required_field_count, 0) = 0 then
    raise exception 'Refusing activation: no required form fields.';
  end if;

  if coalesce(v_consent_field_count, 0) = 0 then
    raise exception 'Refusing activation: no consent field.';
  end if;

  v_old_value := jsonb_build_object(
    'status', v_offer.status,
    'visibility', v_offer.visibility,
    'start_at', v_offer.start_at,
    'end_at', v_offer.end_at,
    'archived_at', v_offer.archived_at
  );

  update public.special_offers
  set
    status = 'active',
    visibility = 'public',
    start_at = v_start_at,
    end_at = v_end_at,
    archived_at = null,
    updated_at = now()
  where id = v_offer.id;

  v_new_value := jsonb_build_object(
    'status', 'active',
    'visibility', 'public',
    'start_at', v_start_at,
    'end_at', v_end_at,
    'archived_at', null
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
    'campaign_activated_for_soft_launch',
    'special_offer',
    v_offer.id,
    v_old_value,
    v_new_value,
    jsonb_build_object(
      'source', 'special_offer_lefkara_activate_stage1',
      'slug', v_expected_slug,
      'manual_activation', true,
      'used_existing_dates', v_use_existing_dates,
      'winner_selection_mode', v_offer.winner_selection_mode
    )
  );
end $$;

commit;
