-- Read-only checks after applying special_offer_winner_actions_ambiguity_fix.sql.
-- Does not select a winner or expose participant contact data.
with functions as (
  select p.proname, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in (
    'admin_set_special_offer_primary_candidate',
    'admin_set_special_offer_backup_candidate',
    'admin_promote_special_offer_backup',
    'admin_publish_special_offer_winner'
  )
)
select proname,
  case when proname = 'admin_publish_special_offer_winner'
    then definition like '%public_winner_display_disabled%'
    else definition like '%special_offer_winner_score_snapshot(target.offer_id, target.entry_id)%'
  end as repair_present,
  definition like '%special_offer_winner_guard_admin()%' as admin_guard_present
from functions order by proname;

select o.slug, w.status, w.confirmed_entry_id is not null as winner_confirmed,
  (select count(*) from public.special_offer_entries e where e.offer_id = o.id) as entries,
  (select count(*) from public.special_offer_winner_shortlist s where s.workflow_id = w.id) as shortlist_entries,
  (select count(*) from public.special_offer_winner_publications p where p.workflow_id = w.id and p.unpublished_at is null) as active_publications
from public.special_offers o
left join public.special_offer_winner_workflows w on w.offer_id = o.id and w.status <> 'cancelled'
where o.slug = 'lefkara-giveaway-2026';
