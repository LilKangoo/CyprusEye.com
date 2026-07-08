-- =====================================================
-- Special Offers Lefkara emergency pause verify - read only
-- =====================================================

with target_offer as (
  select *
  from public.special_offers
  where slug = 'lefkara-giveaway-2026'
),
counts as (
  select count(*)::integer as offer_count from target_offer
),
data_counts as (
  select
    (select count(*) from public.special_offer_entries e join target_offer o on o.id = e.offer_id)::integer as entries_count,
    (select count(*) from public.special_offer_entry_answers a join public.special_offer_entries e on e.id = a.entry_id join target_offer o on o.id = e.offer_id)::integer as answers_count,
    (select count(*) from public.special_offer_entry_activities a join target_offer o on o.id = a.offer_id)::integer as activities_count,
    (select count(*) from public.special_offer_official_posts p join target_offer o on o.id = p.offer_id)::integer as official_posts_count
),
summary as (
  select
    coalesce(c.offer_count, 0) = 1 as exactly_one_campaign,
    o.id as offer_id,
    o.slug,
    o.status = 'locked' as status_locked,
    o.visibility = 'private' as visibility_private,
    (o.status <> 'active' and o.visibility <> 'public') as new_entries_and_claims_blocked,
    d.entries_count,
    d.answers_count,
    d.activities_count,
    d.official_posts_count,
    true as existing_data_preserved_by_design,
    (
      coalesce(c.offer_count, 0) = 1
      and o.status = 'locked'
      and o.visibility = 'private'
    ) as pause_verified
  from counts c
  left join target_offer o on true
  cross join data_counts d
)
select
  *,
  pause_verified as overall_pass
from summary;
