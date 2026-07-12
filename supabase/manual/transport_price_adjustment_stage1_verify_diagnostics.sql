-- Transport Price 4.0B - post-install verify diagnostics.
-- Read-only. Returns a vertical table: check_name, pass, details.
--
-- Purpose:
-- - Explain a false constraints_indexes_ok result from
--   transport_price_adjustment_stage1_verify.sql.
-- - Show deployed constraints, indexes, FK delete actions and column metadata
--   without mutating bookings, payments, Stripe, refunds, commissions or payouts.

with columns as (
  select
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
  from information_schema.columns c
  where c.table_schema = 'public'
    and (
      (c.table_name = 'transport_bookings'
        and c.column_name in ('adjusted_total_price', 'price_revision', 'price_adjusted_at'))
      or c.table_name = 'transport_booking_price_adjustments'
    )
),
constraints_raw as (
  select
    c.oid,
    c.conname,
    c.contype,
    c.conrelid,
    c.confrelid,
    rel.relname as table_name,
    nsp.nspname as table_schema,
    confrel.relname as referenced_table_name,
    confnsp.nspname as referenced_table_schema,
    c.confdeltype,
    pg_get_constraintdef(c.oid, true) as constraint_def,
    lower(regexp_replace(pg_get_constraintdef(c.oid, true), '[[:space:]]+', ' ', 'g')) as normalized_def
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  left join pg_class confrel on confrel.oid = c.confrelid
  left join pg_namespace confnsp on confnsp.oid = confrel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname in ('transport_bookings', 'transport_booking_price_adjustments')
),
indexes_raw as (
  select
    i.schemaname,
    i.tablename,
    i.indexname,
    i.indexdef,
    lower(regexp_replace(i.indexdef, '[[:space:]]+', ' ', 'g')) as normalized_def
  from pg_indexes i
  where i.schemaname = 'public'
    and i.tablename in ('transport_bookings', 'transport_booking_price_adjustments')
),
expected as (
  select
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_bookings'
        and c.conname = 'transport_bookings_adjusted_total_price_check'
        and c.normalized_def like '%adjusted_total_price%'
        and c.normalized_def like '%> 0%'
    ) as adjusted_total_price_check,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_bookings'
        and c.conname = 'transport_bookings_price_revision_check'
        and c.normalized_def like '%price_revision%'
        and c.normalized_def like '%>= 0%'
    ) as price_revision_check,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.contype = 'p'
        and c.normalized_def like '%primary key (id)%'
    ) as adjustment_pk,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.referenced_table_schema = 'public'
        and c.referenced_table_name = 'transport_bookings'
        and c.normalized_def like '%foreign key (booking_id)%'
        and c.normalized_def like '%on delete cascade%'
    ) as adjustment_booking_fk_cascade,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.referenced_table_schema = 'auth'
        and c.referenced_table_name = 'users'
        and c.normalized_def like '%foreign key (adjusted_by)%'
    ) as adjustment_adjusted_by_fk,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_amounts_check'
        and c.normalized_def like '%original_total_price > 0%'
        and c.normalized_def like '%previous_effective_total > 0%'
        and c.normalized_def like '%new_effective_total > 0%'
    ) as adjustment_amounts_check,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_revision_check'
        and c.normalized_def like '%previous_revision >= 0%'
        and c.normalized_def like '%new_revision = (previous_revision + 1)%'
    ) as adjustment_revision_check,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_reason_check'
        and c.contype = 'c'
        and c.normalized_def like '%internal_reason%'
        and c.normalized_def like '%btrim(internal_reason%'
        and c.normalized_def like '%length%'
        and c.normalized_def like '%>= 3%'
        and c.normalized_def like '%<= 2000%'
    ) as adjustment_reason_required,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_customer_note_check'
        and c.normalized_def like '%customer_note%'
        and c.normalized_def like '%<= 1000%'
    ) as adjustment_customer_note_check,
    exists (
      select 1
      from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_currency_check'
        and c.contype = 'c'
        and c.normalized_def like '%currency%'
        and c.normalized_def like '%btrim(currency%'
        and c.normalized_def like '%length%'
        and c.normalized_def like '%>= 3%'
        and c.normalized_def like '%<= 12%'
    ) as adjustment_currency_check,
    exists (
      select 1
      from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_idempotency_uidx'
        and i.normalized_def like '%unique index%'
        and i.normalized_def like '%idempotency_key%'
    ) as idempotency_unique,
    exists (
      select 1
      from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_booking_revision_uidx'
        and i.normalized_def like '%unique index%'
        and i.normalized_def like '%booking_id%'
        and i.normalized_def like '%new_revision%'
    ) as booking_revision_unique,
    exists (
      select 1
      from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_booking_created_idx'
        and i.normalized_def like '%booking_id%'
        and i.normalized_def like '%created_at%'
    ) as booking_created_index
),
inventory as (
  select
    coalesce((
      select string_agg(
        concat(table_schema, '.', table_name, '.', conname, ' [', contype, '] ', constraint_def),
        E'\n'
        order by table_schema, table_name, conname
      )
      from constraints_raw
    ), '') as constraints_inventory,
    coalesce((
      select string_agg(
        concat(schemaname, '.', tablename, '.', indexname, ' = ', indexdef),
        E'\n'
        order by schemaname, tablename, indexname
      )
      from indexes_raw
    ), '') as indexes_inventory,
    coalesce((
      select string_agg(
        concat(
          table_name,
          '.',
          column_name,
          ' ',
          data_type,
          ' nullable=',
          is_nullable,
          ' default=',
          coalesce(column_default, '<null>')
        ),
        E'\n'
        order by table_name, column_name
      )
      from columns
    ), '') as columns_inventory,
    coalesce((
      select string_agg(
        concat(
          conname,
          ': ',
          coalesce(concat(referenced_table_schema, '.', referenced_table_name), '<none>'),
          ' delete=',
          case confdeltype
            when 'a' then 'NO ACTION'
            when 'r' then 'RESTRICT'
            when 'c' then 'CASCADE'
            when 'n' then 'SET NULL'
            when 'd' then 'SET DEFAULT'
            else confdeltype::text
          end
        ),
        E'\n'
        order by conname
      )
      from constraints_raw
      where contype = 'f'
    ), '') as fk_inventory
),
diagnostics as (
  select
    'adjusted_total_price_check' as check_name,
    adjusted_total_price_check as pass,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_bookings_adjusted_total_price_check'
      limit 1
    ), 'missing transport_bookings_adjusted_total_price_check') as details
  from expected

  union all
  select
    'price_revision_check',
    price_revision_check,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_bookings_price_revision_check'
      limit 1
    ), 'missing transport_bookings_price_revision_check')
  from expected

  union all
  select
    'adjustment_pk',
    adjustment_pk,
    coalesce((
      select constraint_def
      from constraints_raw
      where table_name = 'transport_booking_price_adjustments'
        and contype = 'p'
      limit 1
    ), 'missing primary key on transport_booking_price_adjustments')
  from expected

  union all
  select
    'adjustment_booking_fk_cascade',
    adjustment_booking_fk_cascade,
    coalesce((
      select constraint_def || ' | delete_action=' ||
        case confdeltype
          when 'c' then 'CASCADE'
          else confdeltype::text
        end
      from constraints_raw
      where table_name = 'transport_booking_price_adjustments'
        and referenced_table_schema = 'public'
        and referenced_table_name = 'transport_bookings'
      limit 1
    ), 'missing FK booking_id -> public.transport_bookings(id)')
  from expected

  union all
  select
    'adjustment_adjusted_by_fk',
    adjustment_adjusted_by_fk,
    coalesce((
      select constraint_def || ' | delete_action=' ||
        case confdeltype
          when 'r' then 'RESTRICT'
          else confdeltype::text
        end
      from constraints_raw
      where table_name = 'transport_booking_price_adjustments'
        and referenced_table_schema = 'auth'
        and referenced_table_name = 'users'
      limit 1
    ), 'missing FK adjusted_by -> auth.users(id)')
  from expected

  union all
  select
    'adjustment_amounts_check',
    adjustment_amounts_check,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_booking_price_adjustments_amounts_check'
      limit 1
    ), 'missing transport_booking_price_adjustments_amounts_check')
  from expected

  union all
  select
    'adjustment_revision_check',
    adjustment_revision_check,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_booking_price_adjustments_revision_check'
      limit 1
    ), 'missing transport_booking_price_adjustments_revision_check')
  from expected

  union all
  select
    'adjustment_reason_required',
    adjustment_reason_required,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_booking_price_adjustments_reason_check'
      limit 1
    ), 'missing transport_booking_price_adjustments_reason_check')
  from expected

  union all
  select
    'adjustment_customer_note_check',
    adjustment_customer_note_check,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_booking_price_adjustments_customer_note_check'
      limit 1
    ), 'missing transport_booking_price_adjustments_customer_note_check')
  from expected

  union all
  select
    'adjustment_currency_check',
    adjustment_currency_check,
    coalesce((
      select constraint_def
      from constraints_raw
      where conname = 'transport_booking_price_adjustments_currency_check'
      limit 1
    ), 'missing transport_booking_price_adjustments_currency_check')
  from expected

  union all
  select
    'idempotency_unique',
    idempotency_unique,
    coalesce((
      select indexdef
      from indexes_raw
      where indexname = 'transport_booking_price_adjustments_idempotency_uidx'
      limit 1
    ), 'missing unique index transport_booking_price_adjustments_idempotency_uidx')
  from expected

  union all
  select
    'booking_revision_unique',
    booking_revision_unique,
    coalesce((
      select indexdef
      from indexes_raw
      where indexname = 'transport_booking_price_adjustments_booking_revision_uidx'
      limit 1
    ), 'missing unique index transport_booking_price_adjustments_booking_revision_uidx')
  from expected

  union all
  select
    'booking_created_index',
    booking_created_index,
    coalesce((
      select indexdef
      from indexes_raw
      where indexname = 'transport_booking_price_adjustments_booking_created_idx'
      limit 1
    ), 'missing index transport_booking_price_adjustments_booking_created_idx')
  from expected

  union all
  select
    'constraints_indexes_ok',
    adjusted_total_price_check
      and price_revision_check
      and adjustment_pk
      and adjustment_booking_fk_cascade
      and adjustment_adjusted_by_fk
      and adjustment_amounts_check
      and adjustment_revision_check
      and adjustment_reason_required
      and adjustment_customer_note_check
      and adjustment_currency_check
      and idempotency_unique
      and booking_revision_unique
      and booking_created_index,
    'Aggregated post-install constraint/index result; see individual checks above.'
  from expected

  union all
  select
    'column_defaults_and_nullability_inventory',
    true,
    columns_inventory
  from inventory

  union all
  select
    'fk_delete_actions_inventory',
    true,
    fk_inventory
  from inventory

  union all
  select
    'constraints_inventory',
    true,
    constraints_inventory
  from inventory

  union all
  select
    'indexes_inventory',
    true,
    indexes_inventory
  from inventory

  union all
  select
    'diagnostics_read_only',
    true,
    'This diagnostics file reads pg_catalog, information_schema and pg_indexes only; it does not execute mutating RPCs or DDL/DML.'
)
select check_name, pass, details
from diagnostics
order by
  case when pass is false or pass is null then 0 else 1 end,
  check_name;
