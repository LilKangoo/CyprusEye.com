-- =====================================================
-- Special Offers Lefkara activation verify - read only
-- =====================================================
-- Run after special_offer_lefkara_activate_stage1.sql.
-- This verify does not modify data.
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
    count(*) filter (where t.lang = 'he')::integer as he_count
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
posts as (
  select
    p.offer_id,
    count(*)::integer as official_posts_count,
    count(*) filter (where p.active = true)::integer as active_official_posts_count
  from public.special_offer_official_posts p
  join target_offer o on o.id = p.offer_id
  group by p.offer_id
),
forbidden_objects as (
  select
    to_regclass('public.special_offer_draws') is null as no_draws_table,
    to_regclass('public.special_offer_draw_entries') is null as no_draw_entries_table,
    to_regclass('public.special_offer_winners') is null as no_winners_table
),
rpc_checks as (
  select
    to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as submit_rpc_exists,
    to_regprocedure('public.submit_special_offer_activity_claim(uuid,uuid,text,text,uuid,text,timestamp with time zone)') is not null as activity_claim_rpc_exists
),
summary as (
  select
    coalesce(c.offer_count, 0) = 1 as exactly_one_campaign,
    o.id as offer_id,
    o.slug,
    o.status = 'active' as status_active,
    o.visibility = 'public' as visibility_public,
    (o.status = 'active' and o.visibility = 'public') as public_state,
    o.start_at is not null as starts_at_set,
    o.end_at is not null as ends_at_set,
    (o.start_at is not null and o.end_at is not null and o.start_at < o.end_at) as dates_valid,
    null::timestamptz as published_at,
    false as published_at_column_exists,
    o.winner_selection_mode = 'manual_selection' as manual_selection,
    coalesce(o.allow_bonus_points, false) is true as allow_bonus_points,
    coalesce(o.requires_form, false) is true as requires_form,
    coalesce(o.requires_manual_approval, false) is true as requires_manual_approval,
    coalesce(t.pl_count, 0) = 1 as pl_translation_exists,
    coalesce(t.en_count, 0) = 1 as en_translation_exists,
    coalesce(t.he_count, 0) = 1 as he_translation_exists,
    coalesce(f.active_form_fields_count, 0) > 0 as active_form_exists,
    coalesce(f.required_fields_count, 0) > 0 as required_fields_exist,
    coalesce(f.consent_fields_count, 0) > 0 as consent_fields_exist,
    true as public_clean_route_ready,
    r.submit_rpc_exists,
    r.activity_claim_rpc_exists,
    x.no_draws_table and x.no_draw_entries_table and x.no_winners_table as no_winner_draw_tables,
    coalesce(p.official_posts_count, 0) as official_posts_count,
    coalesce(p.active_official_posts_count, 0) as active_official_posts_count,
    coalesce(p.active_official_posts_count, 0) > 0 as active_official_posts_exist,
    (
      coalesce(c.offer_count, 0) = 1
      and o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
      and x.no_draws_table
      and x.no_draw_entries_table
      and x.no_winners_table
    ) as entry_collection_ready,
    (
      coalesce(c.offer_count, 0) = 1
      and o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
      and r.activity_claim_rpc_exists
      and x.no_draws_table
      and x.no_draw_entries_table
      and x.no_winners_table
      and coalesce(p.active_official_posts_count, 0) > 0
    ) as activity_claims_ready,
    (
      coalesce(c.offer_count, 0) = 1
      and o.status = 'active'
      and o.visibility = 'public'
      and o.start_at is not null
      and o.end_at is not null
      and o.start_at < o.end_at
      and o.winner_selection_mode = 'manual_selection'
      and coalesce(o.allow_bonus_points, false) is true
      and coalesce(o.requires_form, false) is true
      and coalesce(o.requires_manual_approval, false) is true
      and coalesce(t.pl_count, 0) = 1
      and coalesce(t.en_count, 0) = 1
      and coalesce(t.he_count, 0) = 1
      and coalesce(f.active_form_fields_count, 0) > 0
      and coalesce(f.required_fields_count, 0) > 0
      and coalesce(f.consent_fields_count, 0) > 0
      and r.submit_rpc_exists
      and r.activity_claim_rpc_exists
      and x.no_draws_table
      and x.no_draw_entries_table
      and x.no_winners_table
      and coalesce(p.active_official_posts_count, 0) > 0
    ) as full_promotion_ready
  from offer_counts c
  left join target_offer o on true
  cross join rpc_checks r
  cross join forbidden_objects x
  left join translations t on t.offer_id = o.id
  left join fields f on f.offer_id = o.id
  left join posts p on p.offer_id = o.id
)
select
  *,
  entry_collection_ready as overall_pass
from summary;
