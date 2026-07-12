-- Transport Price 4.0B - verify draft.
-- Read-only. Expected after approved execution of transport_price_adjustment_stage1.sql.

with cols as (
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
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('transport_bookings', 'transport_booking_price_adjustments')
),
constraints as (
  select
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_bookings'::regclass
        and c.conname = 'transport_bookings_adjusted_total_price_check'
        and pg_get_constraintdef(c.oid) ilike '%adjusted_total_price%'
        and pg_get_constraintdef(c.oid) ilike '%> 0%'
    ) as adjusted_total_price_check,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_bookings'::regclass
        and c.conname = 'transport_bookings_price_revision_check'
        and pg_get_constraintdef(c.oid) ilike '%price_revision%'
        and pg_get_constraintdef(c.oid) ilike '%>= 0%'
    ) as price_revision_check,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.contype = 'p'
        and pg_get_constraintdef(c.oid) ilike '%primary key (id)%'
    ) as adjustment_pk,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.confrelid = 'public.transport_bookings'::regclass
        and pg_get_constraintdef(c.oid) ilike '%foreign key (booking_id)%'
        and pg_get_constraintdef(c.oid) ilike '%on delete cascade%'
    ) as adjustment_booking_fk_cascade,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.confrelid = 'auth.users'::regclass
        and pg_get_constraintdef(c.oid) ilike '%foreign key (adjusted_by)%'
    ) as adjustment_adjusted_by_fk,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.conname = 'transport_booking_price_adjustments_amounts_check'
    ) as adjustment_amounts_check,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.conname = 'transport_booking_price_adjustments_revision_check'
        and pg_get_constraintdef(c.oid) ilike '%new_revision%'
        and pg_get_constraintdef(c.oid) ilike '%previous_revision + 1%'
    ) as adjustment_revision_check,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_booking_price_adjustments'::regclass
        and c.conname = 'transport_booking_price_adjustments_reason_check'
    ) as adjustment_reason_required,
    exists (
      select 1
      from pg_indexes i
      where i.schemaname = 'public'
        and i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_idempotency_uidx'
        and i.indexdef ilike '%unique%'
        and i.indexdef ilike '%idempotency_key%'
    ) as idempotency_unique,
    exists (
      select 1
      from pg_indexes i
      where i.schemaname = 'public'
        and i.tablename = 'transport_booking_price_adjustments'
        and i.indexname = 'transport_booking_price_adjustments_booking_revision_uidx'
        and i.indexdef ilike '%unique%'
        and i.indexdef ilike '%booking_id%'
        and i.indexdef ilike '%new_revision%'
    ) as booking_revision_unique
),
rls as (
  select
    coalesce((select c.relrowsecurity from pg_class c where c.oid = 'public.transport_booking_price_adjustments'::regclass), false) as adjustment_rls_enabled,
    exists (
      select 1
      from pg_policies p
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
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'transport_booking_price_adjustments'
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ) as no_public_anon_adjustment_access,
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'transport_booking_price_adjustments'
        and grantee = 'authenticated'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as no_authenticated_adjustment_writes,
    exists (
      select 1
      from information_schema.role_table_grants
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
      'trg_apply_service_coupon_transport_booking',
      'trg_service_coupon_redemption_from_transport_booking',
      'trg_sync_transport_coupon_to_fulfillment'
    )
),
admin_adjust as (
  select *
  from fns
  where proname = 'admin_adjust_transport_booking_price'
    and identity_args = 'p_booking_id uuid, p_new_total numeric, p_reason text, p_customer_note text, p_expected_revision integer, p_idempotency_key uuid'
  limit 1
),
public_summary as (
  select *
  from fns
  where proname = 'get_transport_booking_financial_summary'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
admin_history as (
  select *
  from fns
  where proname = 'admin_get_transport_booking_price_adjustments'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
summary_core as (
  select *
  from fns
  where proname = 'transport_booking_financial_summary_core'
    and identity_args = 'p_booking_id uuid'
  limit 1
),
coupon_fn as (
  select *
  from fns
  where proname = 'trg_apply_service_coupon_transport_booking'
  limit 1
),
coupon_redemption_fn as (
  select *
  from fns
  where proname = 'trg_service_coupon_redemption_from_transport_booking'
  limit 1
),
fulfillment_coupon_fn as (
  select *
  from fns
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
checks as (
  select
    true as marker,
    to_regclass('public.transport_booking_price_adjustments') is not null as adjustment_table_exists,
    (
      select adjusted_total_price_column
        and price_revision_column
        and price_adjusted_at_column
        and adjustment_id_column
        and adjustment_booking_id_column
        and original_total_price_column
        and previous_effective_total_column
        and new_effective_total_column
        and adjustment_currency_column
        and previous_revision_column
        and new_revision_column
        and internal_reason_column
        and customer_note_column
        and adjusted_by_column
        and idempotency_key_column
        and adjustment_created_at_column
      from cols
    ) as columns_ok,
    (
      select adjusted_total_price_check
        and price_revision_check
        and adjustment_pk
        and adjustment_booking_fk_cascade
        and adjustment_adjusted_by_fk
        and adjustment_amounts_check
        and adjustment_revision_check
        and adjustment_reason_required
        and idempotency_unique
        and booking_revision_unique
      from constraints
    ) as constraints_indexes_ok,
    (select adjustment_rls_enabled and admin_select_policy from rls) as rls_policy_ok,
    (
      select no_public_anon_adjustment_access
        and no_authenticated_adjustment_writes
        and authenticated_select_for_admin_policy
      from table_grants
    ) as table_grants_ok,
    exists (select 1 from admin_adjust) as admin_rpc_exists,
    coalesce((select prosecdef from admin_adjust), false) as admin_rpc_security_definer,
    coalesce((select owner_name = 'postgres' from admin_adjust), false) as admin_rpc_owner_postgres,
    coalesce((
      select exists (
        select 1 from unnest(coalesce(proconfig, array[]::text[])) cfg
        where cfg = 'search_path=pg_catalog, public'
      )
      from admin_adjust
    ), false) as admin_rpc_safe_search_path,
    coalesce((select source like '%auth.uid()%' and source like '%public.is_current_user_admin()%' from admin_adjust), false) as admin_rpc_auth_admin_guard,
    coalesce((select source like '%for update%' from admin_adjust), false) as admin_rpc_select_for_update,
    coalesce((select source like '%price_revision_mismatch%' and source like '%p_expected_revision%' from admin_adjust), false) as optimistic_revision_guard,
    coalesce((select source like '%idempotency_key%' and source like '%idempotent_replay%' from admin_adjust), false) as idempotency_guard,
    coalesce((select source like '%new_total_must_be_positive%' and source like '%adjustment_reason_required%' from admin_adjust), false) as input_guards,
    coalesce((select source like '%insert into public.transport_booking_price_adjustments%' and source like '%update public.transport_bookings%' from admin_adjust), false) as adjustment_write_scope_present,
    coalesce((select source not like '%update public.service_deposit_requests%' and source not like '%insert into public.service_deposit_requests%' and source not like '%delete from public.service_deposit_requests%' from admin_adjust), false) as no_payment_mutation,
    coalesce((select source not like '%stripe_%' from admin_adjust), false) as no_stripe_mutation,
    coalesce((select source not like '%affiliate_commission_events%' and source not like '%affiliate_payouts%' from admin_adjust), false) as no_commission_payout_mutation,
    coalesce((select source not like '%partner_service_fulfillments%' from admin_adjust), false) as no_fulfillment_total_overwrite_in_admin_rpc,
    coalesce((select source like '%confirmed_paid_gross%' from summary_core), false) as summary_uses_confirmed_paid_gross_only,
    coalesce((select source like '%service_deposit_requests%' and source like '%status = ''paid''%' and source like '%paid_at is not null%' from summary_core), false) as confirmed_paid_gross_semantics,
    coalesce((select source like '%greatest(b.effective_total - p.confirmed_paid_gross, 0)%' from summary_core), false) as balance_due_semantics,
    coalesce((select source like '%greatest(p.confirmed_paid_gross - b.effective_total, 0)%' from summary_core), false) as overpayment_semantics,
    coalesce((select source like '%p.confirmed_paid_gross > b.effective_total%' and source like '%refund_review_required%' from summary_core), false) as refund_review_required_semantics,
    coalesce((select source like '%not_authenticated%' and source like '%is_partner_user%' and source like '%customer_email%' and source not like '%internal_reason%' from public_summary), false) as role_safe_public_summary,
    coalesce((select source like '%internal_reason%' and source like '%public.is_current_user_admin()%' from admin_history), false) as admin_history_internal_reason_only_admin,
    coalesce((
      select
        source like '%tg_op = ''update''%'
        and source like '%return new%'
        and source like '%new.total_price is not distinct from old.total_price%'
        and source like '%new.coupon_discount_amount is not distinct from old.coupon_discount_amount%'
        and source like '%new.deposit_amount is not distinct from old.deposit_amount%'
      from coupon_fn
    ), false) as coupon_trigger_guard_present,
    coalesce((
      select
        source like '%tg_op = ''update''%'
        and source like '%return new%'
        and source like '%new.total_price is not distinct from old.total_price%'
        and source like '%new.coupon_discount_amount is not distinct from old.coupon_discount_amount%'
        and source like '%service_coupon_redemptions%'
      from coupon_redemption_fn
    ), false) as coupon_redemption_guard_present,
    coalesce((
      select
        source like '%tg_op = ''update''%'
        and source like '%return new%'
        and source like '%new.total_price is not distinct from old.total_price%'
        and source like '%update public.partner_service_fulfillments%'
      from fulfillment_coupon_fn
    ), false) as fulfillment_coupon_sync_guard_present,
    not exists (
      select 1 from admin_acl
      where grantee = 0 and privilege_type = 'EXECUTE'
    ) as admin_rpc_public_execute_absent,
    not exists (
      select 1 from admin_acl
      where grantee_name = 'anon' and privilege_type = 'EXECUTE'
    ) as admin_rpc_anon_execute_absent,
    exists (
      select 1 from admin_acl
      where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'
    ) as admin_rpc_authenticated_execute_present,
    not exists (
      select 1 from summary_acl
      where grantee = 0 and privilege_type = 'EXECUTE'
    ) as summary_public_execute_absent,
    not exists (
      select 1 from summary_acl
      where grantee_name = 'anon' and privilege_type = 'EXECUTE'
    ) as summary_anon_execute_absent,
    exists (
      select 1 from summary_acl
      where grantee_name = 'authenticated' and privilege_type = 'EXECUTE'
    ) as summary_authenticated_execute_present
)
select
  *,
  (
    adjustment_table_exists
    and columns_ok
    and constraints_indexes_ok
    and rls_policy_ok
    and table_grants_ok
    and admin_rpc_exists
    and admin_rpc_security_definer
    and admin_rpc_owner_postgres
    and admin_rpc_safe_search_path
    and admin_rpc_auth_admin_guard
    and admin_rpc_select_for_update
    and optimistic_revision_guard
    and idempotency_guard
    and input_guards
    and adjustment_write_scope_present
    and no_payment_mutation
    and no_stripe_mutation
    and no_commission_payout_mutation
    and no_fulfillment_total_overwrite_in_admin_rpc
    and summary_uses_confirmed_paid_gross_only
    and confirmed_paid_gross_semantics
    and balance_due_semantics
    and overpayment_semantics
    and refund_review_required_semantics
    and role_safe_public_summary
    and admin_history_internal_reason_only_admin
    and coupon_trigger_guard_present
    and coupon_redemption_guard_present
    and fulfillment_coupon_sync_guard_present
    and admin_rpc_public_execute_absent
    and admin_rpc_anon_execute_absent
    and admin_rpc_authenticated_execute_present
    and summary_public_execute_absent
    and summary_anon_execute_absent
    and summary_authenticated_execute_present
  ) as overall_pass
from checks;
