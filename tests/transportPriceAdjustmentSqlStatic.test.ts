import fs from 'node:fs';
import path from 'node:path';

describe('Transport Price 4.0B SQL draft', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const normalize = (value: string) =>
    value
      .replace(/--.*$/gm, '')
      .replace(/'([^']|'')*'/g, "''")
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const preflight = read('supabase/manual/transport_price_adjustment_stage1_preflight.sql');
  const sql = read('supabase/manual/transport_price_adjustment_stage1.sql');
  const verify = read('supabase/manual/transport_price_adjustment_stage1_verify.sql');
  const finalVerify = read('supabase/manual/transport_price_adjustment_stage1_verify_final_20260713.sql');
  const diagnostics = read('supabase/manual/transport_price_adjustment_stage1_diagnostics.sql');
  const verifyDiagnostics = read('supabase/manual/transport_price_adjustment_stage1_verify_diagnostics.sql');
  const aclFix = read('supabase/manual/transport_price_adjustment_stage1_acl_fix.sql');
  const aclFixVerify = read('supabase/manual/transport_price_adjustment_stage1_acl_fix_verify.sql');
  const roundTripDiagnostics = read('supabase/manual/transport_price_round_trip_stage1_diagnostics.sql');
  const emailSummaryPreflight = read('supabase/manual/transport_price_email_summary_stage1_preflight.sql');
  const emailSummarySql = read('supabase/manual/transport_price_email_summary_stage1.sql');
  const emailSummaryVerify = read('supabase/manual/transport_price_email_summary_stage1_verify.sql');
  const rpcAmbiguityPreflight = read('supabase/manual/transport_price_adjustment_rpc_ambiguity_preflight.sql');
  const rpcAmbiguityFix = read('supabase/manual/transport_price_adjustment_rpc_ambiguity_fix.sql');
  const rpcAmbiguityVerify = read('supabase/manual/transport_price_adjustment_rpc_ambiguity_verify.sql');

  const functionSlice = (source: string, name: string) => {
    const marker = `create or replace function public.${name}`;
    const start = source.toLowerCase().indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = source.slice(start + marker.length);
    const next = rest.toLowerCase().indexOf('create or replace function public.');
    return source.slice(start, next === -1 ? source.length : start + marker.length + next);
  };

  test('preflight and diagnostics remain read-only', () => {
    [preflight, diagnostics, verifyDiagnostics, finalVerify, aclFixVerify, roundTripDiagnostics, verify, emailSummaryPreflight, emailSummaryVerify, rpcAmbiguityPreflight, rpcAmbiguityVerify].forEach((source) => {
      expect(source).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
    });
    expect(preflight).toContain('preflight_safe_to_continue');
    expect(diagnostics).toContain('round_trip_double_count_removed');
    expect(roundTripDiagnostics).toContain('round_trip_double_count_confirmed');
    expect(verify).toContain('overall_pass');
  });

  test('final verify has unique marker and visible overall inputs', () => {
    expect(finalVerify).toContain('Transport Price 4.0B FINAL VERIFY 2026-07-13 v1');
    expect(finalVerify).toContain("'verify_build_marker'::text");
    expect(finalVerify).toContain('select check_name, pass, details');
    expect(finalVerify).toContain("'overall_pass'::text as check_name");
    expect(finalVerify).toContain("where check_name <> 'verify_build_marker'");
    expect(finalVerify).toContain('deposit_status_service_role_execute_present');
    expect(finalVerify).not.toContain('deposit_status_service_role_execute_absent');

    [
      'adjustment_table_exists',
      'columns_ok',
      'adjusted_total_price_check',
      'price_revision_check',
      'adjustment_pk',
      'adjustment_booking_fk_cascade',
      'adjustment_adjusted_by_fk',
      'adjustment_amounts_check',
      'adjustment_revision_check',
      'adjustment_reason_required',
      'adjustment_currency_check',
      'adjustment_customer_note_check',
      'idempotency_unique',
      'booking_revision_unique',
      'booking_created_index',
      'constraints_indexes_ok',
      'rls_policy_ok',
      'table_grants_ok',
      'admin_rpc_exists',
      'admin_rpc_security_definer',
      'admin_rpc_owner_postgres',
      'admin_rpc_safe_search_path',
      'admin_rpc_auth_admin_guard',
      'admin_rpc_select_for_update',
      'optimistic_revision_guard',
      'idempotency_guard',
      'input_guards',
      'adjustment_write_scope_present',
      'no_payment_mutation',
      'no_stripe_mutation',
      'no_commission_payout_mutation',
      'no_fulfillment_total_overwrite_in_admin_rpc',
      'summary_uses_confirmed_paid_gross_only',
      'confirmed_paid_gross_semantics',
      'balance_due_semantics',
      'overpayment_semantics',
      'refund_review_required_semantics',
      'deposit_status_rpc_exists',
      'deposit_status_return_type_preserved',
      'deposit_status_security_definer',
      'deposit_status_owner_postgres',
      'deposit_status_safe_search_path',
      'deposit_status_uses_financial_summary',
      'deposit_status_return_total_not_used',
      'deposit_status_no_total_plus_return',
      'deposit_status_public_execute_absent',
      'deposit_status_anon_execute_present',
      'deposit_status_authenticated_execute_present',
      'deposit_status_service_role_execute_present',
      'role_safe_public_summary',
      'admin_history_internal_reason_only_admin',
      'coupon_trigger_guard_present',
      'coupon_redemption_guard_present',
      'fulfillment_coupon_sync_guard_present',
      'admin_rpc_public_execute_absent',
      'admin_rpc_anon_execute_absent',
      'admin_rpc_authenticated_execute_present',
      'summary_public_execute_absent',
      'summary_anon_execute_absent',
      'summary_authenticated_execute_present',
    ].forEach((check) => expect(finalVerify).toContain(`'${check}'`));
  });

  test('acl fix is limited to service_role execute on deposit status RPC', () => {
    const normalizedFix = normalize(aclFix);
    expect(normalizedFix).toContain("to_regprocedure('')");
    expect(aclFix).toContain("to_regprocedure('public.get_service_deposit_status(uuid)')");
    expect(aclFix).toContain('grant execute on function public.get_service_deposit_status(uuid) to service_role');
    expect(normalizedFix).not.toMatch(/\b(create|alter|drop)\s+(table|function|trigger|policy|index)\b/);
    expect(normalizedFix).not.toMatch(/\b(insert into|update public|delete from|truncate|merge into)\b/);
    expect(normalizedFix).not.toContain('stripe');
    expect(normalizedFix).not.toContain('affiliate_commission_events');
    expect(normalizedFix).not.toContain('affiliate_payouts');
    expect(normalizedFix).not.toContain('partner_service_fulfillments');

    expect(aclFixVerify).toContain('aclexplode');
    expect(aclFixVerify).toContain('service_role_execute_present');
    expect(aclFixVerify).toContain('public_execute_absent');
    expect(aclFixVerify).toContain('anon_execute_present');
    expect(aclFixVerify).toContain('authenticated_execute_present');
    expect(aclFixVerify).toContain('overall_pass');
  });

  test('email summary stage adds only a service-role server-side read wrapper', () => {
    expect(emailSummaryPreflight).toContain('preflight_safe_to_continue');
    expect(emailSummaryPreflight).toContain("to_regprocedure('public.transport_booking_financial_summary_core(uuid)')");
    expect(emailSummaryPreflight).toContain('public_summary_requires_user_context');
    expect(emailSummaryPreflight).toContain('wrapper_absent_or_compatible');
    expect(emailSummaryPreflight).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);

    expect(emailSummarySql).toContain('create or replace function public.service_get_transport_booking_financial_summary(p_booking_id uuid)');
    expect(emailSummarySql).toContain('security definer');
    expect(emailSummarySql).toContain('set search_path = pg_catalog, public');
    expect(emailSummarySql).toContain('from public.transport_booking_financial_summary_core(p_booking_id) s');
    expect(emailSummarySql).toContain('s.effective_total');
    expect(emailSummarySql).toContain('s.confirmed_paid_gross');
    expect(emailSummarySql).toContain('s.balance_due');
    expect(emailSummarySql).toContain('revoke all on function public.service_get_transport_booking_financial_summary(uuid) from public');
    expect(emailSummarySql).toContain('revoke all on function public.service_get_transport_booking_financial_summary(uuid) from anon');
    expect(emailSummarySql).toContain('revoke all on function public.service_get_transport_booking_financial_summary(uuid) from authenticated');
    expect(emailSummarySql).toContain('grant execute on function public.service_get_transport_booking_financial_summary(uuid) to service_role');
    expect(emailSummarySql).not.toContain('internal_reason');
    expect(emailSummarySql).not.toContain('idempotency_key');
    expect(emailSummarySql).not.toContain('stripe_');
    expect(emailSummarySql).not.toContain('customer_email');
    expect(emailSummarySql).not.toContain('partner_id');
    expect(emailSummarySql).not.toMatch(/\b(insert into|update public|delete from|merge into)\b/i);

    expect(emailSummaryVerify).toContain('service_role_execute_present');
    expect(emailSummaryVerify).toContain('public_execute_absent');
    expect(emailSummaryVerify).toContain('anon_execute_absent');
    expect(emailSummaryVerify).toContain('authenticated_execute_absent');
    expect(emailSummaryVerify).toContain('public_summary_still_role_safe');
    expect(emailSummaryVerify).toContain('overall_pass');
    expect(emailSummaryVerify).not.toMatch(/(^|\n)\s*(insert\s+into|update\s+\w|delete\s+from|merge\s+into|truncate\s+|alter\s+|create\s+|drop\s+|grant\s+|revoke\s+)/i);
  });

  test('RPC ambiguity hotfix only repairs admin price revision qualification', () => {
    expect(rpcAmbiguityPreflight).toContain('preflight_safe_to_continue');
    expect(rpcAmbiguityPreflight).toContain("to_regprocedure('public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)')");
    expect(rpcAmbiguityPreflight).toContain('ambiguous_update_pattern_present');
    expect(rpcAmbiguityPreflight).toContain('already_fixed_pattern_present');

    const fixSource = rpcAmbiguityFix.toLowerCase();
    const fixedAdminRpc = normalize(functionSlice(rpcAmbiguityFix, 'admin_adjust_transport_booking_price'));
    expect(fixSource).toContain("to_regprocedure('public.admin_adjust_transport_booking_price(uuid,numeric,text,text,integer,uuid)'");
    expect(fixedAdminRpc).toContain('v_current_price_revision');
    expect(fixedAdminRpc).toContain('v_new_price_revision');
    expect(fixedAdminRpc).toContain('select tb.* into v_booking from public.transport_bookings tb where tb.id = p_booking_id for update');
    expect(fixedAdminRpc).toContain('update public.transport_bookings tb set adjusted_total_price = v_new_total, price_revision = v_new_price_revision');
    expect(fixedAdminRpc).not.toContain('price_revision = coalesce(price_revision, 0) + 1');
    expect(fixedAdminRpc).toContain('idempotency_key = p_idempotency_key');
    expect(fixedAdminRpc).toContain('p_expected_revision');
    expect(rpcAmbiguityFix).toContain("raise exception 'price_revision_mismatch'");
    expect(fixedAdminRpc).not.toContain('service_deposit_requests');
    expect(fixedAdminRpc).not.toContain('stripe_');
    expect(fixedAdminRpc).not.toContain('affiliate_commission_events');
    expect(fixedAdminRpc).not.toContain('affiliate_payouts');
    expect(fixedAdminRpc).not.toContain('partner_service_fulfillments');

    expect(rpcAmbiguityVerify).toContain('ambiguous_update_removed');
    expect(rpcAmbiguityVerify).toContain('qualified_or_variable_revision_update');
    expect(rpcAmbiguityVerify).toContain('local_revision_variables_present');
    expect(rpcAmbiguityVerify).toContain('overall_pass');
  });

  test('post-install verify diagnostics decomposes constraints and indexes', () => {
    [
      'adjusted_total_price_check',
      'price_revision_check',
      'adjustment_pk',
      'adjustment_booking_fk_cascade',
      'adjustment_adjusted_by_fk',
      'adjustment_amounts_check',
      'adjustment_revision_check',
      'adjustment_reason_required',
      'adjustment_customer_note_check',
      'adjustment_currency_check',
      'idempotency_unique',
      'booking_revision_unique',
      'booking_created_index',
      'constraints_indexes_ok',
      'constraints_inventory',
      'indexes_inventory',
      'diagnostics_read_only',
    ].forEach((check) => expect(verifyDiagnostics).toContain(check));
    expect(verifyDiagnostics).toContain('select check_name, pass, details');
    expect(verifyDiagnostics).not.toMatch(/\|\|\s*contype\s*\|\|/i);
    expect(verifyDiagnostics).not.toMatch(/\|\|\s*confdeltype\s*\|\|/i);
    expect(verifyDiagnostics).not.toMatch(/\|\|\s*relkind\s*\|\|/i);
    expect(verifyDiagnostics).not.toMatch(/\|\|\s*prokind\s*\|\|/i);
    expect(verifyDiagnostics).toContain("concat(table_schema, '.', table_name, '.', conname");
    expect(verifyDiagnostics).toContain("c.conname = 'transport_booking_price_adjustments_reason_check'");
    expect(verifyDiagnostics).toContain("c.normalized_def like '%btrim(internal_reason%'");
    expect(verifyDiagnostics).toContain("c.normalized_def like '%>= 3%'");
    expect(verifyDiagnostics).toContain("c.normalized_def like '%<= 2000%'");
    expect(verifyDiagnostics).toContain("c.conname = 'transport_booking_price_adjustments_currency_check'");
    expect(verifyDiagnostics).toContain("c.normalized_def like '%btrim(currency%'");
    expect(verifyDiagnostics).toContain("c.normalized_def like '%<= 12%'");
    expect(verifyDiagnostics).not.toContain("between 3 and 2000");
    expect(verifyDiagnostics).not.toContain("between 3 and 12");
  });

  test('preflight final statement is a single summary row with preflight_safe_to_continue', () => {
    const withoutComments = preflight.replace(/--.*$/gm, '').trim();
    const statements = withoutComments
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
    const finalStatement = statements[statements.length - 1].toLowerCase();

    expect(finalStatement).toContain('with required_tables as');
    expect(finalStatement).toContain('preflight_safe_to_continue');
    expect(finalStatement).toContain('get_service_deposit_status_exact_overload');
    expect(finalStatement).toContain('deposit_status_service_role_execute_present');
    expect(finalStatement).toContain('round_trip_source_state_recognized');
    expect(finalStatement).toContain('partial_install_detected');
    expect(finalStatement).toContain('payment_cardinality_supported_for_stage1');
    expect(finalStatement).not.toContain('function_signature');
    expect(finalStatement).not.toMatch(/select\s+table_schema,\s*table_name,\s*grantee,\s*privilege_type/);
  });

  test('base SQL is additive and defines the adjustment foundation', () => {
    expect(sql).toContain('alter table public.transport_bookings');
    expect(sql).toContain('add column if not exists adjusted_total_price numeric(12,2)');
    expect(sql).toContain('add column if not exists price_revision integer not null default 0');
    expect(sql).toContain('add column if not exists price_adjusted_at timestamptz');
    expect(sql).toContain('create table if not exists public.transport_booking_price_adjustments');
    expect(sql).toContain('transport_booking_price_adjustments_idempotency_uidx');
    expect(sql).toContain('transport_booking_price_adjustments_booking_revision_uidx');
    expect(sql).toContain('references public.transport_bookings(id) on delete cascade');
  });

  test('admin RPC is guarded and does not mutate payment, Stripe, commission, payout or fulfillment rows', () => {
    const adminRpc = normalize(functionSlice(sql, 'admin_adjust_transport_booking_price'));
    expect(adminRpc).toContain('security definer');
    expect(adminRpc).toContain('set search_path = pg_catalog, public');
    expect(adminRpc).toContain('auth.uid()');
    expect(adminRpc).toContain('public.is_current_user_admin()');
    expect(adminRpc).toContain('for update');
    expect(adminRpc).toContain('v_booking.price_revision');
    expect(adminRpc).toContain('p_expected_revision');
    expect(adminRpc).toContain('idempotency_key');
    expect(adminRpc).toContain('insert into public.transport_booking_price_adjustments');
    expect(adminRpc).toContain('update public.transport_bookings');
    expect(adminRpc).not.toMatch(/\b(update|insert into|delete from)\s+public\.service_deposit_requests\b/);
    expect(adminRpc).not.toContain('stripe_');
    expect(adminRpc).not.toContain('affiliate_commission_events');
    expect(adminRpc).not.toContain('affiliate_payouts');
    expect(adminRpc).not.toContain('partner_service_fulfillments');
  });

  test('financial summary uses confirmed paid gross and refund review without refund subtraction', () => {
    const summary = normalize(functionSlice(sql, 'transport_booking_financial_summary_core'));
    expect(summary).toContain('confirmed_paid_gross');
    expect(summary).toContain("r.status = ''");
    expect(summary).toContain('r.paid_at is not null');
    expect(summary).toContain('greatest(b.effective_total - p.confirmed_paid_gross, 0)');
    expect(summary).toContain('greatest(p.confirmed_paid_gross - b.effective_total, 0)');
    expect(summary).toContain('p.confirmed_paid_gross > b.effective_total');
    expect(summary).not.toContain(`net_${'paid'}`);
    expect(summary).not.toMatch(/\brefunds?\b.*-/);
  });

  test('deposit status RPC preserves output and uses central summary for transport totals', () => {
    const depositStatus = normalize(functionSlice(sql, 'get_service_deposit_status'));
    expect(depositStatus).toContain('returns table(');
    expect(depositStatus).toContain('booking_total_price numeric');
    expect(depositStatus).toContain('transport_booking_financial_summary_core(r.booking_id)');
    expect(depositStatus).toContain('then ts.effective_total');
    expect(depositStatus).not.toContain('return_total_price');
    expect(depositStatus).not.toMatch(/total_price.{0,220}\+.{0,220}return_total_price/);
    expect(depositStatus).not.toMatch(/return_total_price.{0,220}\+.{0,220}total_price/);
    expect(sql).toContain('grant execute on function public.get_service_deposit_status(uuid) to anon, authenticated, service_role');
    expect(sql).not.toContain('revoke all on function public.get_service_deposit_status(uuid) from service_role');
  });

  test('coupon-related transport triggers are guarded for adjustment-only updates', () => {
    [
      'trg_apply_service_coupon_transport_booking',
      'trg_service_coupon_redemption_from_transport_booking',
      'trg_sync_transport_coupon_to_fulfillment',
    ].forEach((name) => {
      const source = normalize(functionSlice(sql, name));
      expect(source).toContain("tg_op = ''");
      expect(source).toContain('new.total_price is not distinct from old.total_price');
      expect(source).toContain('new.coupon_discount_amount is not distinct from old.coupon_discount_amount');
      expect(source).toContain('return new');
    });
  });

  test('verify covers round-trip, ACL, no mutation and summary semantics', () => {
    [
      'deposit_status_uses_financial_summary',
      'deposit_status_no_total_plus_return',
      'deposit_status_return_type_preserved',
      'deposit_status_anon_execute_present',
      'deposit_status_service_role_execute_present',
      'coupon_trigger_guard_present',
      'coupon_redemption_guard_present',
      'fulfillment_coupon_sync_guard_present',
      'no_payment_mutation',
      'no_stripe_mutation',
      'no_commission_payout_mutation',
      'no_fulfillment_total_overwrite_in_admin_rpc',
      'confirmed_paid_gross_semantics',
      'balance_due_semantics',
      'overpayment_semantics',
      'refund_review_required_semantics',
      'booking_created_index',
    ].forEach((check) => expect(verify).toContain(check));
    expect(verify).not.toContain('deposit_status_service_role_execute_absent');
    expect(diagnostics).toContain('deposit_status_acl_preserved');
    expect(diagnostics).toContain('transport_refund_ledger_absent_confirmed');
    expect(diagnostics).toContain('adjustment_fields_installed');
    expect(diagnostics).toContain('post_install_diagnostics_complete');
    expect(diagnostics).not.toContain('existing_adjustment_fields_absent');
    expect(diagnostics).not.toContain('preflight_complete');
  });
});
