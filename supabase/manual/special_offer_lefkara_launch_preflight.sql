-- =====================================================
-- Special Offers Lefkara launch preflight - read only
-- =====================================================
-- Purpose:
-- - inspect current launch readiness without exposing PII
-- - do not activate or modify anything
--
-- Safe to run repeatedly in Supabase SQL Editor.
-- =====================================================

with target_offer as (
  select *
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
offer_counts as (
  select count(*)::integer as offer_count from target_offer
),
translations as (
  select
    t.offer_id,
    count(*) filter (where t.lang = 'pl')::integer as pl_count,
    count(*) filter (where t.lang = 'en')::integer as en_count,
    count(*) filter (where t.lang = 'he')::integer as he_count,
    count(*) filter (
      where t.lang in ('pl', 'en', 'he')
        and nullif(btrim(coalesce(t.title, '')), '') is not null
        and nullif(btrim(coalesce(t.full_description, '')), '') is not null
    )::integer as ready_translation_count
  from public.special_offer_translations t
  join target_offer o on o.id = t.offer_id
  group by t.offer_id
),
fields as (
  select
    f.offer_id,
    count(*) filter (where f.active = true)::integer as active_form_fields_count,
    count(*) filter (where f.active = true and f.required = true)::integer as required_fields_count,
    count(*) filter (where f.active = true and f.field_type = 'consent')::integer as consent_fields_count
  from public.special_offer_form_fields f
  join target_offer o on o.id = f.offer_id
  group by f.offer_id
),
official_posts as (
  select
    p.offer_id,
    count(*)::integer as official_posts_count,
    count(*) filter (where p.active = true)::integer as public_official_posts_count
  from public.special_offer_official_posts p
  join target_offer o on o.id = p.offer_id
  group by p.offer_id
),
entries as (
  select
    e.offer_id,
    count(*)::integer as current_entries_count
  from public.special_offer_entries e
  join target_offer o on o.id = e.offer_id
  group by e.offer_id
),
activities as (
  select
    a.offer_id,
    count(*)::integer as current_activities_count
  from public.special_offer_entry_activities a
  join target_offer o on o.id = a.offer_id
  group by a.offer_id
),
rpc_checks as (
  select
    to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as submit_rpc_exists,
    to_regprocedure('public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)') is not null as activity_claim_rpc_exists
),
summary as (
  select
    coalesce(c.offer_count, 0) = 1 as exactly_one_offer,
    o.id as offer_id,
    o.slug,
    o.status,
    o.visibility,
    (o.status = 'active' and o.visibility = 'public') as public_state,
    o.status as active_state,
    o.start_at as starts_at,
    o.end_at as ends_at,
    (
      o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and now() between o.start_at and o.end_at
    ) as now_in_campaign_window,
    null::timestamptz as published_at,
    false as published_at_column_exists,
    o.winner_selection_mode,
    coalesce(o.allow_bonus_points, false) as allow_bonus_points,
    coalesce(o.requires_form, false) as requires_form,
    coalesce(o.requires_manual_approval, false) as requires_manual_approval,
    coalesce(t.pl_count, 0) as translation_count_pl,
    coalesce(t.en_count, 0) as translation_count_en,
    coalesce(t.he_count, 0) as translation_count_he,
    null::uuid as active_form_id,
    'fields_per_offer'::text as active_form_model,
    coalesce(f.active_form_fields_count, 0) as active_form_fields_count,
    coalesce(f.required_fields_count, 0) as required_fields_count,
    coalesce(f.consent_fields_count, 0) as consent_fields_count,
    coalesce(p.official_posts_count, 0) as official_posts_count,
    coalesce(p.public_official_posts_count, 0) as public_official_posts_count,
    coalesce(e.current_entries_count, 0) as current_entries_count,
    coalesce(a.current_activities_count, 0) as current_activities_count,
    r.submit_rpc_exists,
    r.activity_claim_rpc_exists,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and (o.start_at is null or now() >= o.start_at)
      and (o.end_at is null or now() <= o.end_at)
    ) as currently_publicly_available,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and o.requires_form is true
      and coalesce(f.active_form_fields_count, 0) > 0
      and (o.start_at is null or now() >= o.start_at)
      and (o.end_at is null or now() <= o.end_at)
      and r.submit_rpc_exists
    ) as currently_accepts_entries,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and now() between o.start_at and o.end_at
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(p.public_official_posts_count, 0) > 0
      and r.activity_claim_rpc_exists
    ) as currently_accepts_claims,
    (
      o.slug = 'lefkara-giveaway-2026'
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(t.ready_translation_count, 0) = 3
    ) as required_slug_and_translations_exist,
    (o.winner_selection_mode = 'manual_selection') as winner_selection_manual,
    (
      coalesce(c.offer_count, 0) = 1
      and o.slug = 'lefkara-giveaway-2026'
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
      and r.activity_claim_rpc_exists
    ) as activation_structure_ready,
    (
      o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
    ) as dates_present_and_valid,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and o.requires_form is true
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and now() between o.start_at and o.end_at
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
    ) as entry_collection_currently_ready,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and now() between o.start_at and o.end_at
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(p.public_official_posts_count, 0) > 0
      and r.submit_rpc_exists
      and r.activity_claim_rpc_exists
    ) as activity_claims_currently_ready,
    true as official_post_required_only_for_activity_claims,
    'manual_check_required: configure Supabase Auth Redirect URLs and test production signup/email confirmation before activation'::text as manual_auth_gate_pending,
    'manual_check_required: confirm campaign rules, privacy link, organizer details, and legal copy before activation/public promotion'::text as manual_legal_gate_pending,
    (
      coalesce(c.offer_count, 0) = 1
      and o.slug = 'lefkara-giveaway-2026'
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
      and r.activity_claim_rpc_exists
    ) as safe_to_activate,
    (
      o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and (now() between o.start_at and o.end_at)
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
    ) as launch_preflight_pass
  from offer_counts c
  left join target_offer o on true
  cross join rpc_checks r
  left join translations t on t.offer_id = o.id
  left join fields f on f.offer_id = o.id
  left join official_posts p on p.offer_id = o.id
  left join entries e on e.offer_id = o.id
  left join activities a on a.offer_id = o.id
)
select *
from summary;
