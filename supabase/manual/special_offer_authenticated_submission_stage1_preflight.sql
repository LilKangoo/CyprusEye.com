-- Special Offers 3C.5C-0 preflight only.
-- Read-only check for existing entry ownership before authenticated-only submit.
-- Do not use this script to modify data.

select
  count(*) as total_entries,
  count(*) filter (where e.user_id is null) as entries_without_user_id,
  count(*) filter (where e.user_id is not null) as entries_with_user_id
from public.special_offer_entries e;

select
  o.id as offer_id,
  o.slug,
  o.status,
  o.visibility,
  count(e.id) as total_entries,
  count(e.id) filter (where e.user_id is null) as entries_without_user_id,
  count(e.id) filter (where e.user_id is not null) as entries_with_user_id
from public.special_offers o
left join public.special_offer_entries e on e.offer_id = o.id
group by o.id, o.slug, o.status, o.visibility
order by o.slug;

with totals as (
  select
    count(*) as total_entries,
    count(*) filter (where user_id is null) as entries_without_user_id,
    count(*) filter (where user_id is not null) as entries_with_user_id
  from public.special_offer_entries
),
by_campaign as (
  select
    jsonb_agg(
      jsonb_build_object(
        'offer_id', o.id,
        'slug', o.slug,
        'status', o.status,
        'visibility', o.visibility,
        'total_entries', coalesce(c.total_entries, 0),
        'entries_without_user_id', coalesce(c.entries_without_user_id, 0),
        'entries_with_user_id', coalesce(c.entries_with_user_id, 0)
      )
      order by o.slug
    ) as campaigns
  from public.special_offers o
  left join (
    select
      offer_id,
      count(*) as total_entries,
      count(*) filter (where user_id is null) as entries_without_user_id,
      count(*) filter (where user_id is not null) as entries_with_user_id
    from public.special_offer_entries
    group by offer_id
  ) c on c.offer_id = o.id
)
select
  t.total_entries,
  t.entries_without_user_id,
  t.entries_with_user_id,
  coalesce(b.campaigns, '[]'::jsonb) as campaigns,
  true as preflight_read_only
from totals t
cross join by_campaign b;
