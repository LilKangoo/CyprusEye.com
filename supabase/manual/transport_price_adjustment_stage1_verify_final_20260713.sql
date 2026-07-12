-- Transport Price 4.0B - FINAL VERIFY 2026-07-13 v1.
-- Read-only. Returns a vertical table: check_name, pass, details.
--
-- This file intentionally has a unique build marker so Supabase results prove
-- that the final verifier, not an older draft verifier, was executed.

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
column_checks as (
  select
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'adjusted_total_price' and data_type = 'numeric') > 0 as adjusted_total_price_column,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'price_revision' and data_type = 'integer') > 0 as price_revision_column,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'price_adjusted_at' and data_type = 'timestamp with time zone') > 0 as price_adjusted_at_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'id' and data_type = 'uuid') > 0 as adjustment_id_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'booking_id' and data_type = 'uuid') > 0 as adjustment_booking_id_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'original_total_price' and data_type = 'numeric') > 0 as original_total_price_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'previous_effective_total' and data_type = 'numeric') > 0 as previous_effective_total_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'new_effective_total' and data_type = 'numeric') > 0 as new_effective_total_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'currency' and data_type = 'text') > 0 as adjustment_currency_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'previous_revision' and data_type = 'integer') > 0 as previous_revision_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'new_revision' and data_type = 'integer') > 0 as new_revision_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'internal_reason' and data_type = 'text') > 0 as internal_reason_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'customer_note' and data_type = 'text') > 0 as customer_note_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'adjusted_by' and data_type = 'uuid') > 0 as adjusted_by_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'idempotency_key' and data_type = 'uuid') > 0 as idempotency_key_column,
    count(*) filter (where table_name = 'transport_booking_price_adjustments' and column_name = 'created_at' and data_type = 'timestamp with time zone') > 0 as adjustment_created_at_column
  from columns
),
constraints_raw as (
  select
    c.oid,
    c.conname,
    c.contype,
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
constraint_checks as (
  select
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_bookings'
        and c.conname = 'transport_bookings_adjusted_total_price_check'
        and c.contype = 'c'
        and c.normalized_def like '%adjusted_total_price%'
        and c.normalized_def like '%> 0%'
    ) as adjusted_total_price_check,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_bookings'
        and c.conname = 'transport_bookings_price_revision_check'
        and c.contype = 'c'
        and c.normalized_def like '%price_revision%'
        and c.normalized_def like '%>= 0%'
    ) as price_revision_check,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.contype = 'p'
        and c.normalized_def like '%primary key (id)%'
    ) as adjustment_pk,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.referenced_table_schema = 'public'
        and c.referenced_table_name = 'transport_bookings'
        and c.normalized_def like '%foreign key (booking_id)%'
        and c.normalized_def like '%on delete cascade%'
    ) as adjustment_booking_fk_cascade,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.referenced_table_schema = 'auth'
        and c.referenced_table_name = 'users'
        and c.normalized_def like '%foreign key (adjusted_by)%'
    ) as adjustment_adjusted_by_fk,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_amounts_check'
        and c.contype = 'c'
        and c.normalized_def like '%original_total_price > 0%'
        and c.normalized_def like '%previous_effective_total > 0%'
        and c.normalized_def like '%new_effective_total > 0%'
    ) as adjustment_amounts_check,
    exists (
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_revision_check'
        and c.contype = 'c'
        and c.normalized_def like '%previous_revision >= 0%'
        and c.normalized_def like '%new_revision = (previous_revision + 1)%'
    ) as adjustment_revision_check,
    exists (
      select 1 from constraints_raw c
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
      select 1 from constraints_raw c
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
      select 1 from constraints_raw c
      where c.table_name = 'transport_booking_price_adjustments'
        and c.conname = 'transport_booking_price_adjustments_customer_note_check'
        and c.contype = 'c'
        and c.normalized_def like '%customer_note%'
        and c.normalized_def like '%<= 1000%'
    ) as adjustment_customer_note_check,
    exists (
      select 1 from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_idempotency_uidx'
        and i.normalized_def like '%unique index%'
        and i.normalized_def like '%idempotency_key%'
    ) as idempotency_unique,
    exists (
      select 1 from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_booking_revision_uidx'
        and i.normalized_def like '%unique index%'
        and i.normalized_def like '%booking_id%'
        and i.normalized_def like '%new_revision%'
    ) as booking_revision_unique,
    exists (
      select 1 from indexes_raw i
      where i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_booking_created_idx'
        and i.normalized_def like '%booking_id%'
        and i.normalized_def like '%created_at%'
    ) as booking_created_index
),
rls_checks as (
  select
    coalesce((select c.relrowsecurity from pg_class c where c.oid = 'public.transport_booking_price_adjustments'::regclass), false) as adjustment_rls_enabled,
    exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'transport_booking_price_adjustments'
        and p.policyname = 'transport_booking_price_adjustments_admin_select'
        and p.cmd = 'SELECT'
        and p.qual ilike '%is_current_user_admin%'
    ) as admin_select_policy
),
table_grants as (
  select
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'transport_booking_price_adjustments'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as no_public_anon_adjustment_access,
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'transport_booking_price_adjustments'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_authenticated_adjustment_writes,
    exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'transport_booking_price_adjustments'
        and grantee = 'authenticated'
        and privilege_type = 'SELECT'
    ) as authenticated_select_for_admin_policy
),
fns as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.proowner,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    p.proacl,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and p.proname in (
      'admin_adjust_transport_booking_price',
      'get_transport_booking_financial_summary',
      'admin_get_transport_booking_price_adjustments',
      'transport_booking_financial_summary_core',
      'get_service_deposit_status',
      'trg_apply_service_coupon_transport_booking',
      'trg_service_coupon_redemption_from_transport_booking',
      'trg_sync_transport_coupon_to_fulfillment'
    )
),
admin_adjust as (
  select * from fns
  where proname = 'admin_adjust_transport_booking_price'
    and identity_args = 'p_booking_id uuid, p_new_total numeric, p_reason text, p_customer_note text, p_expected_revision integer, p_idempotency_key uuid'
  limit 1
),
public_summary as (
  select * from fns
  where proname = 'get_transport_booking_financial_summary'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
admin_history as (
  select * from fns
  where proname = 'admin_get_transport_booking_price_adjustments'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
summary_core as (
  select * from fns
  where proname = 'transport_booking_financial_summary_core'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
deposit_status as (
  select * from fns
  where proname = 'get_service_deposit_status'
    and identity_args = 'p_id uuid'
  limit 1
),
coupon_fn as (
  select * from fns
  where proname = 'trg_apply_service_coupon_transport_booking'
  limit 1
),
coupon_redemption_fn as (
  select * from fns
  where proname = 'trg_service_coupon_redemption_from_transport_booking'
  limit 1
),
fulfillment_coupon_fn as (
  select * from fns
  where proname = 'trg_sync_transport_coupon_to_fulfillment'
  limit 1
),
admin_acl as (
  select acl.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, acl.privilege_type
  from admin_adjust fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) acl
  left join pg_roles r on r.oid = acl.grantee
),
summary_acl as (
  select acl.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, acl.privilege_type
  from public_summary fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) acl
  left join pg_roles r on r.oid = acl.grantee
),
deposit_status_acl as (
  select acl.grantee, coalesce(r.rolname, 'PUBLIC') as grantee_name, acl.privilege_type
  from deposit_status fn
  cross join lateral aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) acl
  left join pg_roles r on r.oid = acl.grantee
),
checks as (
  select *
  from (
    values
      ('verify_build_marker'::text, true, 'Transport Price 4.0B FINAL VERIFY 2026-07-13 v1'::text),
      ('adjustment_table_exists', to_regclass('public.transport_booking_price_adjustments') is not null, 'public.transport_booking_price_adjustments exists'),
      ('columns_ok', (select adjusted_total_price_column and price_revision_column and price_adjusted_at_column and adjustment_id_column and adjustment_booking_id_column and original_total_price_column and previous_effective_total_column and new_effective_total_column and adjustment_currency_column and previous_revision_column and new_revision_column and internal_reason_column and customer_note_column and adjusted_by_column and idempotency_key_column and adjustment_created_at_column from column_checks), 'all adjustment columns and transport booking adjustment columns exist with expected types'),
      ('adjusted_total_price_check', (select adjusted_total_price_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjusted_total_price_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_bookings_adjusted_total_price_check' limit 1), 'missing transport_bookings_adjusted_total_price_check')),
      ('price_revision_check', (select price_revision_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', price_revision_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_bookings_price_revision_check' limit 1), 'missing transport_bookings_price_revision_check')),
      ('adjustment_pk', (select adjustment_pk from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_pk::text) from constraints_raw cross join constraint_checks where table_name = 'transport_booking_price_adjustments' and contype = 'p' limit 1), 'missing primary key')),
      ('adjustment_booking_fk_cascade', (select adjustment_booking_fk_cascade from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | delete=', case confdeltype when 'c' then 'CASCADE' else confdeltype::text end, ' | semantic=', adjustment_booking_fk_cascade::text) from constraints_raw cross join constraint_checks where table_name = 'transport_booking_price_adjustments' and referenced_table_schema = 'public' and referenced_table_name = 'transport_bookings' limit 1), 'missing booking FK')),
      ('adjustment_adjusted_by_fk', (select adjustment_adjusted_by_fk from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | delete=', case confdeltype when 'r' then 'RESTRICT' else confdeltype::text end, ' | semantic=', adjustment_adjusted_by_fk::text) from constraints_raw cross join constraint_checks where table_name = 'transport_booking_price_adjustments' and referenced_table_schema = 'auth' and referenced_table_name = 'users' limit 1), 'missing adjusted_by FK')),
      ('adjustment_amounts_check', (select adjustment_amounts_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_amounts_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_booking_price_adjustments_amounts_check' limit 1), 'missing amounts check')),
      ('adjustment_revision_check', (select adjustment_revision_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_revision_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_booking_price_adjustments_revision_check' limit 1), 'missing revision check')),
      ('adjustment_reason_required', (select adjustment_reason_required from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_reason_required::text) from constraints_raw cross join constraint_checks where conname = 'transport_booking_price_adjustments_reason_check' limit 1), 'missing reason check')),
      ('adjustment_currency_check', (select adjustment_currency_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_currency_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_booking_price_adjustments_currency_check' limit 1), 'missing currency check')),
      ('adjustment_customer_note_check', (select adjustment_customer_note_check from constraint_checks), coalesce((select concat(conname, ' [', contype, '] ', constraint_def, ' | semantic=', adjustment_customer_note_check::text) from constraints_raw cross join constraint_checks where conname = 'transport_booking_price_adjustments_customer_note_check' limit 1), 'missing customer note check')),
      ('idempotency_unique', (select idempotency_unique from constraint_checks), coalesce((select concat(indexname, ' ', indexdef, ' | semantic=', idempotency_unique::text) from indexes_raw cross join constraint_checks where indexname = 'transport_booking_price_adjustments_idempotency_uidx' limit 1), 'missing idempotency unique index')),
      ('booking_revision_unique', (select booking_revision_unique from constraint_checks), coalesce((select concat(indexname, ' ', indexdef, ' | semantic=', booking_revision_unique::text) from indexes_raw cross join constraint_checks where indexname = 'transport_booking_price_adjustments_booking_revision_uidx' limit 1), 'missing booking revision unique index')),
      ('booking_created_index', (select booking_created_index from constraint_checks), coalesce((select concat(indexname, ' ', indexdef, ' | semantic=', booking_created_index::text) from indexes_raw cross join constraint_checks where indexname = 'transport_booking_price_adjustments_booking_created_idx' limit 1), 'missing booking created index')),
      ('constraints_indexes_ok', (select adjusted_total_price_check and price_revision_check and adjustment_pk and adjustment_booking_fk_cascade and adjustment_adjusted_by_fk and adjustment_amounts_check and adjustment_revision_check and adjustment_reason_required and adjustment_currency_check and adjustment_customer_note_check and idempotency_unique and booking_revision_unique and booking_created_index from constraint_checks), 'aggregate of the visible constraint/index checks above'),
      ('rls_policy_ok', (select adjustment_rls_enabled and admin_select_policy from rls_checks), 'RLS enabled and admin SELECT policy present'),
      ('table_grants_ok', (select no_public_anon_adjustment_access and no_authenticated_adjustment_writes and authenticated_select_for_admin_policy from table_grants), 'no public/anon adjustment access, no authenticated writes, authenticated SELECT gated by RLS admin policy'),
      ('admin_rpc_exists', exists (select 1 from admin_adjust), 'admin_adjust_transport_booking_price exact signature exists'),
      ('admin_rpc_security_definer', coalesce((select prosecdef from admin_adjust), false), 'admin adjustment RPC SECURITY DEFINER'),
      ('admin_rpc_owner_postgres', coalesce((select owner_name = 'postgres' from admin_adjust), false), 'admin adjustment RPC owner postgres'),
      ('admin_rpc_safe_search_path', coalesce((select exists (select 1 from unnest(coalesce(proconfig, array[]::text[])) cfg where cfg = 'search_path=pg_catalog, public') from admin_adjust), false), 'admin adjustment RPC search_path=pg_catalog, public'),
      ('admin_rpc_auth_admin_guard', coalesce((select source like '%auth.uid()%' and source like '%public.is_current_user_admin()%' from admin_adjust), false), 'auth.uid and is_current_user_admin guards present'),
      ('admin_rpc_select_for_update', coalesce((select source like '%for update%' from admin_adjust), false), 'admin adjustment locks booking row FOR UPDATE'),
      ('optimistic_revision_guard', coalesce((select source like '%price_revision_mismatch%' and source like '%p_expected_revision%' from admin_adjust), false), 'expected revision guard present'),
      ('idempotency_guard', coalesce((select source like '%idempotency_key%' and source like '%idempotent_replay%' from admin_adjust), false), 'idempotency key and replay handling present'),
      ('input_guards', coalesce((select source like '%new_total_must_be_positive%' and source like '%adjustment_reason_required%' from admin_adjust), false), 'positive price and required reason guards present'),
      ('adjustment_write_scope_present', coalesce((select source like '%insert into public.transport_booking_price_adjustments%' and source like '%update public.transport_bookings%' from admin_adjust), false), 'admin RPC only writes booking adjustment fields and append-only history'),
      ('no_payment_mutation', coalesce((select source not like '%update public.service_deposit_requests%' and source not like '%insert into public.service_deposit_requests%' and source not like '%delete from public.service_deposit_requests%' from admin_adjust), false), 'admin RPC does not mutate service_deposit_requests'),
      ('no_stripe_mutation', coalesce((select source not like '%stripe_%' from admin_adjust), false), 'admin RPC does not reference Stripe mutation fields'),
      ('no_commission_payout_mutation', coalesce((select source not like '%affiliate_commission_events%' and source not like '%affiliate_payouts%' from admin_adjust), false), 'admin RPC does not mutate commission or payout tables'),
      ('no_fulfillment_total_overwrite_in_admin_rpc', coalesce((select source not like '%partner_service_fulfillments%' from admin_adjust), false), 'admin RPC does not write partner_service_fulfillments'),
      ('summary_uses_confirmed_paid_gross_only', coalesce((select source like '%confirmed_paid_gross%' from summary_core), false), 'summary uses confirmed_paid_gross naming, not net_paid'),
      ('confirmed_paid_gross_semantics', coalesce((select source like '%service_deposit_requests%' and source like '%status = ''paid''%' and source like '%paid_at is not null%' from summary_core), false), 'paid amount derives from paid service_deposit_requests with paid_at'),
      ('balance_due_semantics', coalesce((select source like '%greatest(b.effective_total - p.confirmed_paid_gross, 0)%' from summary_core), false), 'balance_due = greatest(effective_total - confirmed_paid_gross, 0)'),
      ('overpayment_semantics', coalesce((select source like '%greatest(p.confirmed_paid_gross - b.effective_total, 0)%' from summary_core), false), 'overpayment = greatest(confirmed_paid_gross - effective_total, 0)'),
      ('refund_review_required_semantics', coalesce((select source like '%p.confirmed_paid_gross > b.effective_total%' and source like '%refund_review_required%' from summary_core), false), 'refund_review_required when confirmed_paid_gross > effective_total'),
      ('deposit_status_rpc_exists', exists (select 1 from deposit_status), 'get_service_deposit_status(p_id uuid) exact overload exists'),
      ('deposit_status_return_type_preserved', coalesce((select result_type = 'TABLE(id uuid, status text, paid_at timestamp with time zone, amount numeric, currency text, fulfillment_reference text, fulfillment_summary text, resource_type text, booking_id uuid, stripe_checkout_session_id text, stripe_payment_intent_id text, fulfillment_id uuid, fulfillment_total_price numeric, booking_total_price numeric, trip_title_en text, trip_title_pl text)' from deposit_status), false), coalesce((select result_type from deposit_status), 'get_service_deposit_status missing')),
      ('deposit_status_security_definer', coalesce((select prosecdef from deposit_status), false), 'get_service_deposit_status SECURITY DEFINER'),
      ('deposit_status_owner_postgres', coalesce((select owner_name = 'postgres' from deposit_status), false), 'get_service_deposit_status owner postgres'),
      ('deposit_status_safe_search_path', coalesce((select exists (select 1 from unnest(coalesce(proconfig, array[]::text[])) cfg where cfg = 'search_path=pg_catalog, public') from deposit_status), false), 'get_service_deposit_status search_path=pg_catalog, public'),
      ('deposit_status_uses_financial_summary', coalesce((select source like '%transport_booking_financial_summary_core(r.booking_id)%' and source like '%then ts.effective_total%' from deposit_status), false), 'deposit status uses central financial summary effective_total for transport'),
      ('deposit_status_return_total_not_used', coalesce((select source not like '%return_total_price%' from deposit_status), false), 'return_total_price is not used in get_service_deposit_status'),
      ('deposit_status_no_total_plus_return', coalesce((select not (source ~ 'total_price.{0,220}\+.{0,220}return_total_price' or source ~ 'return_total_price.{0,220}\+.{0,220}total_price') from deposit_status), false), 'no total_price + return_total_price pattern in get_service_deposit_status'),
      ('deposit_status_public_execute_absent', not exists (select 1 from deposit_status_acl where grantee = 0 and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from deposit_status_acl), 'no ACL rows')),
      ('deposit_status_anon_execute_present', exists (select 1 from deposit_status_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from deposit_status_acl), 'no ACL rows')),
      ('deposit_status_authenticated_execute_present', exists (select 1 from deposit_status_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from deposit_status_acl), 'no ACL rows')),
      ('deposit_status_service_role_execute_present', exists (select 1 from deposit_status_acl where grantee_name = 'service_role' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from deposit_status_acl), 'no ACL rows')),
      ('role_safe_public_summary', coalesce((select source like '%not_authenticated%' and source like '%is_partner_user%' and source like '%customer_email%' and source not like '%internal_reason%' from public_summary), false), 'public financial summary is role-safe and excludes internal_reason'),
      ('admin_history_internal_reason_only_admin', coalesce((select source like '%internal_reason%' and source like '%public.is_current_user_admin()%' from admin_history), false), 'adjustment history exposes internal_reason only through admin RPC'),
      ('coupon_trigger_guard_present', coalesce((select source like '%tg_op = ''update''%' and source like '%return new%' and source like '%new.total_price is not distinct from old.total_price%' and source like '%new.coupon_discount_amount is not distinct from old.coupon_discount_amount%' and source like '%new.deposit_amount is not distinct from old.deposit_amount%' from coupon_fn), false), 'coupon trigger early-returns for adjustment-only updates'),
      ('coupon_redemption_guard_present', coalesce((select source like '%tg_op = ''update''%' and source like '%return new%' and source like '%new.total_price is not distinct from old.total_price%' and source like '%new.coupon_discount_amount is not distinct from old.coupon_discount_amount%' and source like '%service_coupon_redemptions%' from coupon_redemption_fn), false), 'coupon redemption trigger early-returns for adjustment-only updates'),
      ('fulfillment_coupon_sync_guard_present', coalesce((select source like '%tg_op = ''update''%' and source like '%return new%' and source like '%new.total_price is not distinct from old.total_price%' and source like '%update public.partner_service_fulfillments%' from fulfillment_coupon_fn), false), 'fulfillment coupon sync is guarded against adjustment-only updates'),
      ('admin_rpc_public_execute_absent', not exists (select 1 from admin_acl where grantee = 0 and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from admin_acl), 'no ACL rows')),
      ('admin_rpc_anon_execute_absent', not exists (select 1 from admin_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from admin_acl), 'no ACL rows')),
      ('admin_rpc_authenticated_execute_present', exists (select 1 from admin_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from admin_acl), 'no ACL rows')),
      ('summary_public_execute_absent', not exists (select 1 from summary_acl where grantee = 0 and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from summary_acl), 'no ACL rows')),
      ('summary_anon_execute_absent', not exists (select 1 from summary_acl where grantee_name = 'anon' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from summary_acl), 'no ACL rows')),
      ('summary_authenticated_execute_present', exists (select 1 from summary_acl where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'), coalesce((select string_agg(grantee_name || ':' || privilege_type, ', ' order by grantee_name, privilege_type) from summary_acl), 'no ACL rows'))
  ) as t(check_name, pass, details)
),
overall as (
  select
    'overall_pass'::text as check_name,
    bool_and(pass) filter (where check_name <> 'verify_build_marker') as pass,
    'AND of every visible check in this file except verify_build_marker'::text as details
  from checks
)
select check_name, pass, details
from (
  select check_name, pass, details, 0 as section_order
  from checks
  where check_name = 'verify_build_marker'
  union all
  select check_name, pass, details, 1 as section_order
  from checks
  where check_name <> 'verify_build_marker'
  union all
  select check_name, pass, details, 2 as section_order
  from overall
) final
order by
  section_order,
  case
    when section_order = 1 and (pass is false or pass is null) then 0
    when section_order = 1 then 1
    else 0
  end,
  check_name;
