-- Special Offers 3C.5C-6I preflight - read only.
-- Checks whether one-entry-per-user can be enforced safely.
-- Do not modify data in this file.

with entry_counts as (
  select
    count(*)::bigint as total_entries,
    count(*) filter (where user_id is null)::bigint as entries_without_user_id,
    count(*) filter (where user_id is not null)::bigint as entries_with_user_id
  from public.special_offer_entries
),
duplicate_pairs as (
  select
    count(*)::bigint as duplicate_offer_user_pairs,
    coalesce(max(entry_count), 0)::integer as max_entries_per_offer_user
  from (
    select offer_id, user_id, count(*)::integer as entry_count
    from public.special_offer_entries
    where user_id is not null
    group by offer_id, user_id
    having count(*) > 1
  ) d
),
user_id_column as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
    ) as user_id_column_exists,
    coalesce((
      select udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
      limit 1
    ), '') as user_id_udt_name,
    coalesce((
      select is_nullable = 'YES'
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
      limit 1
    ), false) as user_id_is_nullable
),
entry_indexes as (
  select
    exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      join pg_index i on i.indexrelid = idx.oid
      where ns.nspname = 'public'
        and idx.relname = 'idx_special_offer_entries_offer_user_unique'
        and i.indisunique
        and pg_get_expr(i.indpred, i.indrelid) ilike '%user_id is not null%'
    ) as offer_user_unique_index_exists,
    exists (
      select 1
      from pg_class idx
      join pg_namespace ns on ns.oid = idx.relnamespace
      join pg_index i on i.indexrelid = idx.oid
      join pg_class tbl on tbl.oid = i.indrelid
      where ns.nspname = 'public'
        and tbl.relname = 'special_offer_entries'
        and i.indisunique
        and pg_get_indexdef(i.indexrelid) ilike '%offer_id%'
        and pg_get_indexdef(i.indexrelid) ilike '%client_submission_id%'
    ) as offer_client_submission_unique_exists
),
rpc_state as (
  select
    to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)') is not null as submit_rpc_exists,
    coalesce((
      select p.prosecdef
      from pg_proc p
      where p.oid = to_regprocedure('public.submit_special_offer_entry(text,text,jsonb,uuid)')
    ), false) as submit_rpc_security_definer
)
select
  ec.total_entries,
  ec.entries_without_user_id,
  ec.entries_with_user_id,
  dp.duplicate_offer_user_pairs,
  dp.max_entries_per_offer_user,
  uc.user_id_column_exists,
  (uc.user_id_udt_name = 'uuid') as user_id_is_uuid,
  uc.user_id_is_nullable,
  ix.offer_user_unique_index_exists,
  ix.offer_client_submission_unique_exists,
  rs.submit_rpc_exists,
  rs.submit_rpc_security_definer,
  (dp.duplicate_offer_user_pairs = 0) as no_duplicate_offer_user_pairs,
  (
    uc.user_id_column_exists
    and uc.user_id_udt_name = 'uuid'
    and uc.user_id_is_nullable
    and ix.offer_client_submission_unique_exists
    and rs.submit_rpc_exists
    and rs.submit_rpc_security_definer
    and dp.duplicate_offer_user_pairs = 0
  ) as preflight_safe_to_continue
from entry_counts ec
cross join duplicate_pairs dp
cross join user_id_column uc
cross join entry_indexes ix
cross join rpc_state rs;
