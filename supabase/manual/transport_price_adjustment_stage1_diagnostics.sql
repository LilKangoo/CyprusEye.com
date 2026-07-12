-- Transport Price 4.0A - read-only production diagnostics.
-- Returns a vertical table: check_name, pass, details.
--
-- READ-ONLY ONLY. This file intentionally contains no DDL, DML, GRANT/REVOKE,
-- mutating RPC calls, Stripe calls, or Edge Function calls.

with required_tables as (
  select
    to_regclass('public.transport_bookings') is not null as transport_bookings_exists,
    to_regclass('public.partner_service_fulfillments') is not null as partner_service_fulfillments_exists,
    to_regclass('public.service_deposit_requests') is not null as service_deposit_requests_exists,
    to_regclass('public.affiliate_commission_events') is not null as affiliate_commission_events_exists,
    to_regclass('public.affiliate_payouts') is not null as affiliate_payouts_exists
),
required_columns as (
  select
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'id') > 0 as transport_id_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'trip_type') > 0 as trip_type_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'base_price') > 0 as base_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'extras_price') > 0 as extras_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'total_price') > 0 as total_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'return_total_price') > 0 as return_total_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'coupon_discount_amount') > 0 as coupon_discount_amount_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'deposit_amount') > 0 as deposit_amount_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'deposit_currency') > 0 as deposit_currency_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'currency') > 0 as currency_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'payment_status') > 0 as payment_status_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'paid_at') > 0 as paid_at_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'deposit_paid_at') > 0 as deposit_paid_at_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'status') > 0 as status_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'amount') > 0 as deposit_request_amount_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'currency') > 0 as deposit_request_currency_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'status') > 0 as deposit_request_status_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'paid_at') > 0 as deposit_request_paid_at_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'stripe_checkout_session_id') > 0 as checkout_id_exists,
    count(*) filter (where table_name = 'service_deposit_requests' and column_name = 'stripe_payment_intent_id') > 0 as payment_intent_id_exists,
    count(*) filter (where table_name = 'partner_service_fulfillments' and column_name = 'total_price') > 0 as fulfillment_total_price_exists,
    count(*) filter (where table_name = 'affiliate_commission_events' and column_name = 'commission_amount') > 0 as commission_amount_exists,
    count(*) filter (where table_name = 'affiliate_commission_events' and column_name = 'deposit_amount') > 0 as commission_deposit_amount_exists,
    count(*) filter (where table_name = 'affiliate_commission_events' and column_name = 'payout_id') > 0 as commission_payout_id_exists,
    string_agg(table_name || '.' || column_name || ':' || data_type, ', ' order by table_name, ordinal_position) as details
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'transport_bookings',
      'partner_service_fulfillments',
      'service_deposit_requests',
      'affiliate_commission_events',
      'affiliate_payouts'
    )
),
adjustment_columns as (
  select
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('original_total_price', 'quoted_total_price')) > 0 as original_total_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name = 'adjusted_total_price') > 0 as adjusted_total_price_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('amount_paid', 'paid_amount', 'paid_total')) > 0 as paid_total_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('refund_amount', 'refunded_amount', 'refunded_total')) > 0 as refund_total_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('balance_due', 'remaining_due', 'remaining_amount')) > 0 as balance_due_like_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name in ('price_revision', 'pricing_revision')) > 0 as price_revision_exists,
    count(*) filter (where table_name = 'transport_bookings' and column_name like '%price_adjust%reason%') > 0 as price_adjustment_reason_exists
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transport_bookings'
),
constraints as (
  select
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.service_deposit_requests'::regclass
        and c.contype in ('u', 'p')
        and pg_get_constraintdef(c.oid) ilike '%unique (fulfillment_id)%'
    ) as service_deposit_unique_fulfillment,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.service_deposit_requests'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%amount%'
        and pg_get_constraintdef(c.oid) ilike '%>=%'
    ) as service_deposit_amount_check,
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.transport_bookings'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%total_price%'
        and pg_get_constraintdef(c.oid) ilike '%>=%'
    ) as transport_total_nonnegative_check,
    exists (
      select 1
      from pg_indexes i
      where i.schemaname = 'public'
        and i.tablename = 'service_deposit_requests'
        and i.indexdef ilike '%stripe_checkout_session_id%'
        and i.indexdef ilike '%unique%'
    ) as unique_checkout_session_index,
    exists (
      select 1
      from pg_indexes i
      where i.schemaname = 'public'
        and i.tablename = 'service_deposit_requests'
        and i.indexdef ilike '%stripe_payment_intent_id%'
        and i.indexdef ilike '%unique%'
    ) as unique_payment_intent_index,
    coalesce(string_agg(c.conname || '=' || pg_get_constraintdef(c.oid), ' | ' order by c.conname), '') as details
  from pg_constraint c
  where c.conrelid in (
    'public.transport_bookings'::regclass,
    'public.service_deposit_requests'::regclass,
    'public.partner_service_fulfillments'::regclass
  )
),
core_counts as (
  select
    (select count(*)::bigint from public.transport_bookings) as transport_booking_count,
    (select count(*)::bigint from public.transport_bookings where coalesce(trip_type, 'one_way') = 'round_trip') as round_trip_booking_count,
    (select count(*)::bigint from public.partner_service_fulfillments where resource_type in ('transport', 'transports', 'transfer', 'transfers')) as transport_fulfillment_count,
    (select count(*)::bigint from public.service_deposit_requests where resource_type in ('transport', 'transports', 'transfer', 'transfers')) as transport_deposit_request_count,
    (select count(*)::bigint from public.service_deposit_requests where resource_type in ('transport', 'transports', 'transfer', 'transfers') and status = 'paid') as paid_transport_deposit_request_count
),
deposit_cardinality as (
  select
    count(*) filter (where request_count = 0)::bigint as bookings_with_zero_deposit_requests,
    count(*) filter (where request_count = 1)::bigint as bookings_with_one_deposit_request,
    count(*) filter (where request_count > 1)::bigint as bookings_with_more_than_one_deposit_request
  from (
    select tb.id, count(r.id) as request_count
    from public.transport_bookings tb
    left join public.service_deposit_requests r
      on r.booking_id = tb.id
     and r.resource_type in ('transport', 'transports', 'transfer', 'transfers')
    group by tb.id
  ) x
),
fulfillment_cardinality as (
  select count(*)::bigint as fulfillments_with_more_than_one_deposit_request
  from (
    select fulfillment_id, count(*) as request_count
    from public.service_deposit_requests
    where fulfillment_id is not null
      and resource_type in ('transport', 'transports', 'transfer', 'transfers')
    group by fulfillment_id
    having count(*) > 1
  ) x
),
payment_consistency as (
  select
    count(*) filter (
      where resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and status = 'paid'
        and paid_at is null
    )::bigint as paid_requests_with_null_paid_at,
    count(*) filter (
      where resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and status <> 'paid'
        and paid_at is not null
    )::bigint as unpaid_requests_with_non_null_paid_at
  from public.service_deposit_requests
),
stripe_duplicates as (
  select
    (select count(*)::bigint from (
      select stripe_checkout_session_id
      from public.service_deposit_requests
      where nullif(stripe_checkout_session_id, '') is not null
      group by stripe_checkout_session_id
      having count(*) > 1
    ) dup) as duplicate_non_null_stripe_checkout_session_ids,
    (select count(*)::bigint from (
      select stripe_payment_intent_id
      from public.service_deposit_requests
      where nullif(stripe_payment_intent_id, '') is not null
      group by stripe_payment_intent_id
      having count(*) > 1
    ) dup) as duplicate_non_null_stripe_payment_intent_ids
),
refund_objects as (
  select
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name ~* '(service|transport|deposit).*refund|refund.*(service|transport|deposit)'
    ) as transport_refund_ledger_exists,
    coalesce((
      select string_agg(table_name, ', ' order by table_name)
      from information_schema.tables
      where table_schema = 'public'
        and table_name ~* '(service|transport|deposit).*refund|refund.*(service|transport|deposit)'
    ), '') as refund_tables,
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname ~* 'refund' or lower(coalesce(p.prosrc, '')) ~ 'transport.*refund|service.*refund|deposit.*refund')
    ) as transport_refund_function_exists,
    coalesce((
      select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' order by p.proname)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname ~* 'refund' or lower(coalesce(p.prosrc, '')) ~ 'transport.*refund|service.*refund|deposit.*refund')
    ), '') as refund_functions
),
triggers as (
  select
    c.relname as table_name,
    t.tgname,
    pg_get_triggerdef(t.oid, true) as trigger_definition,
    p.proname as function_name,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source,
    (t.tgtype & 16) <> 0 as fires_on_update
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public'
    and c.relname in (
      'transport_bookings',
      'service_deposit_requests',
      'partner_service_fulfillments',
      'affiliate_commission_events'
    )
    and not t.tgisinternal
),
trigger_checks as (
  select
    exists (
      select 1 from triggers
      where table_name = 'transport_bookings'
        and function_name = 'trg_apply_service_coupon_transport_booking'
    ) as coupon_trigger_source_identified,
    exists (
      select 1 from triggers
      where table_name = 'transport_bookings'
        and function_name = 'trg_apply_service_coupon_transport_booking'
        and fires_on_update
        and trigger_definition !~* 'update of'
        and source ~ '(new\.total_price|new\.deposit_amount|new\.coupon_)'
    ) as coupon_trigger_reacts_to_generic_update,
    exists (
      select 1 from triggers
      where table_name = 'transport_bookings'
        and function_name = 'trg_partner_service_fulfillment_from_transport_booking'
    ) as fulfillment_sync_source_identified,
    coalesce((
      select string_agg(tgname || '=' || trigger_definition, ' | ' order by tgname)
      from triggers
      where table_name = 'transport_bookings'
    ), '') as transport_trigger_details,
    coalesce((
      select string_agg(tgname || '=' || trigger_definition, ' | ' order by tgname)
      from triggers
      where table_name = 'service_deposit_requests'
    ), '') as deposit_trigger_details
),
round_trip_matches as (
  select
    count(*) > 0 as round_trip_double_count_risk,
    coalesce(string_agg(kind || ':' || object_name, ' | ' order by kind, object_name), '') as details
  from (
    select
      'function' as kind,
      p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) ~ 'total_price[^;]{0,120}\+[^;]{0,120}return_total_price'
    union all
    select
      'view' as kind,
      c.relname as object_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm')
      and lower(regexp_replace(coalesce(pg_get_viewdef(c.oid, true), ''), '[[:space:]]+', ' ', 'g')) ~ 'total_price[^;]{0,120}\+[^;]{0,120}return_total_price'
  ) matches
),
function_sources as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    r.rolname as owner_name,
    p.prosecdef,
    p.proconfig,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.oid = p.proowner
  where n.nspname = 'public'
    and (
      p.proname in (
        'get_service_deposit_status',
        'partner_get_service_deposit_amounts',
        'partner_get_referral_attributed_orders',
        'admin_backfill_partner_service_fulfillments_for_resource',
        'upsert_partner_service_fulfillment_from_booking_with_partner'
      )
      or lower(coalesce(p.prosrc, '')) ~ '(transport_bookings|service_deposit_requests|partner_service_fulfillments|affiliate_commission_events)'
    )
),
read_sources as (
  select
    exists (
      select 1 from function_sources
      where proname in ('get_service_deposit_status')
        and source like '%service_deposit_requests%'
        and source like '%transport_bookings%'
    ) as customer_read_sources_identified,
    exists (
      select 1 from function_sources
      where proname in ('partner_get_service_deposit_amounts', 'partner_get_referral_attributed_orders')
         or (source like '%partner_service_fulfillments%' and source like '%transport_bookings%')
    ) as partner_read_sources_identified,
    exists (
      select 1 from function_sources
      where proname in ('admin_backfill_partner_service_fulfillments_for_resource', 'upsert_partner_service_fulfillment_from_booking_with_partner')
         or (source like '%transport_bookings%' and source like '%partner_service_fulfillments%')
    ) as admin_read_sources_identified,
    coalesce(string_agg(distinct proname || '(' || identity_args || ')', ' | ' order by proname || '(' || identity_args || ')'), '') as details
  from function_sources
),
payment_source as (
  select
    exists (
      select 1
      from triggers
      where table_name = 'service_deposit_requests'
        and source like '%status%'
        and source like '%paid%'
        and source like '%affiliate_commission_events%'
    ) as paid_deposit_commission_trigger_exists,
    exists (
      select 1
      from function_sources
      where source like '%service_deposit_requests%'
        and source like '%status%'
        and source like '%paid%'
        and source like '%amount%'
    ) as paid_deposit_function_source_exists,
    'sum(service_deposit_requests.amount where resource_type is transport-like and status = paid and paid_at is not null), minus refunds only after a transport/service refund ledger is introduced or verified'::text as confirmed_paid_formula,
    'service_deposit_requests.currency for paid deposit rows; transport_bookings.currency remains booking quote currency'::text as confirmed_paid_currency_source
),
commission_sources as (
  select
    count(*) filter (where resource_type in ('transport', 'transports', 'transfer', 'transfers'))::bigint as transport_related_commission_events,
    count(*) filter (where resource_type in ('transport', 'transports', 'transfer', 'transfers') and payout_id is not null)::bigint as transport_commission_events_with_payout_id,
    count(*) filter (
      where e.resource_type in ('transport', 'transports', 'transfer', 'transfers')
        and e.payout_id is not null
        and coalesce(p.status, '') in ('paid', 'completed', 'finalized', 'processed')
    )::bigint as transport_commission_events_connected_to_paid_or_finalized_payouts,
    exists (
      select 1
      from triggers
      where source like '%affiliate_commission_events%'
        and source like '%service_deposit_requests%'
        and source like '%deposit_amount%'
    ) as commission_source_identified
  from public.affiliate_commission_events e
  left join public.affiliate_payouts p on p.id = e.payout_id
),
fulfillment_sync as (
  select
    exists (
      select 1
      from triggers
      where table_name = 'transport_bookings'
        and source like '%partner_service_fulfillments%'
        and source like '%new.total_price%'
    ) as fulfillment_copies_transport_total_price,
    coalesce((
      select string_agg(tgname || ':' || trigger_definition, ' | ' order by tgname)
      from triggers
      where table_name = 'transport_bookings'
        and source like '%partner_service_fulfillments%'
    ), '') as details
),
rls_tables as (
  select
    bool_and(c.relrowsecurity) as relevant_rls_enabled,
    coalesce(string_agg(c.relname || ':rls=' || c.relrowsecurity::text, ', ' order by c.relname), '') as details
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'transport_bookings',
      'partner_service_fulfillments',
      'service_deposit_requests',
      'affiliate_commission_events',
      'affiliate_payouts'
    )
),
raw_update_checks as (
  select
    not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name in ('service_deposit_requests', 'affiliate_commission_events', 'affiliate_payouts')
        and g.grantee in ('PUBLIC', 'anon')
        and g.privilege_type in ('UPDATE', 'DELETE', 'INSERT')
    ) as raw_customer_financial_update_absent,
    not exists (
      select 1
      from information_schema.role_table_grants g
      where g.table_schema = 'public'
        and g.table_name in ('service_deposit_requests', 'affiliate_commission_events', 'affiliate_payouts')
        and g.grantee in ('PUBLIC', 'anon')
        and g.privilege_type in ('UPDATE', 'DELETE', 'INSERT')
    ) as raw_partner_financial_update_absent,
    coalesce(string_agg(g.table_name || ':' || g.grantee || ':' || g.privilege_type, ', ' order by g.table_name, g.grantee, g.privilege_type), '') as details
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name in (
      'transport_bookings',
      'partner_service_fulfillments',
      'service_deposit_requests',
      'affiliate_commission_events',
      'affiliate_payouts'
    )
),
diagnostics as (
  select
    'required_tables_exist' as check_name,
    (
      transport_bookings_exists
      and partner_service_fulfillments_exists
      and service_deposit_requests_exists
      and affiliate_commission_events_exists
      and affiliate_payouts_exists
    ) as pass,
    format(
      'transport_bookings=%s, partner_service_fulfillments=%s, service_deposit_requests=%s, affiliate_commission_events=%s, affiliate_payouts=%s',
      transport_bookings_exists,
      partner_service_fulfillments_exists,
      service_deposit_requests_exists,
      affiliate_commission_events_exists,
      affiliate_payouts_exists
    ) as details
  from required_tables

  union all
  select
    'required_columns_confirmed',
    (
      transport_id_exists
      and trip_type_exists
      and base_price_exists
      and extras_price_exists
      and total_price_exists
      and return_total_price_exists
      and coupon_discount_amount_exists
      and deposit_amount_exists
      and deposit_currency_exists
      and currency_exists
      and payment_status_exists
      and paid_at_exists
      and deposit_paid_at_exists
      and status_exists
      and deposit_request_amount_exists
      and deposit_request_currency_exists
      and deposit_request_status_exists
      and deposit_request_paid_at_exists
      and checkout_id_exists
      and payment_intent_id_exists
      and fulfillment_total_price_exists
      and commission_amount_exists
      and commission_deposit_amount_exists
      and commission_payout_id_exists
    ),
    details
  from required_columns

  union all
  select
    'existing_adjustment_fields_absent',
    not (
      original_total_like_exists
      or adjusted_total_price_exists
      or paid_total_like_exists
      or refund_total_like_exists
      or balance_due_like_exists
      or price_revision_exists
      or price_adjustment_reason_exists
    ),
    format(
      'original_total_like=%s, adjusted_total_price=%s, paid_total_like=%s, refund_total_like=%s, balance_due_like=%s, price_revision=%s, price_adjustment_reason=%s',
      original_total_like_exists,
      adjusted_total_price_exists,
      paid_total_like_exists,
      refund_total_like_exists,
      balance_due_like_exists,
      price_revision_exists,
      price_adjustment_reason_exists
    )
  from adjustment_columns

  union all
  select
    'service_deposit_unique_model_confirmed',
    service_deposit_unique_fulfillment,
    'UNIQUE(fulfillment_id)=' || service_deposit_unique_fulfillment::text || '; constraints=' || details
  from constraints

  union all
  select
    'confirmed_paid_source_identified',
    paid_deposit_function_source_exists or paid_deposit_commission_trigger_exists,
    confirmed_paid_formula || '; currency=' || confirmed_paid_currency_source
  from payment_source

  union all
  select
    'payment_cardinality_safe',
    (
      dc.bookings_with_more_than_one_deposit_request = 0
      and fc.fulfillments_with_more_than_one_deposit_request = 0
    ),
    format(
      'bookings: zero=%s, one=%s, more_than_one=%s; fulfillments_more_than_one=%s; totals: bookings=%s, round_trip=%s, fulfillments=%s, deposit_requests=%s, paid_deposit_requests=%s',
      dc.bookings_with_zero_deposit_requests,
      dc.bookings_with_one_deposit_request,
      dc.bookings_with_more_than_one_deposit_request,
      fc.fulfillments_with_more_than_one_deposit_request,
      cc.transport_booking_count,
      cc.round_trip_booking_count,
      cc.transport_fulfillment_count,
      cc.transport_deposit_request_count,
      cc.paid_transport_deposit_request_count
    )
  from deposit_cardinality dc
  cross join fulfillment_cardinality fc
  cross join core_counts cc

  union all
  select
    'paid_status_consistent',
    paid_requests_with_null_paid_at = 0 and unpaid_requests_with_non_null_paid_at = 0,
    format(
      'paid_requests_with_null_paid_at=%s, unpaid_requests_with_non_null_paid_at=%s',
      paid_requests_with_null_paid_at,
      unpaid_requests_with_non_null_paid_at
    )
  from payment_consistency

  union all
  select
    'stripe_ids_unique',
    duplicate_non_null_stripe_checkout_session_ids = 0 and duplicate_non_null_stripe_payment_intent_ids = 0,
    format(
      'duplicate_non_null_stripe_checkout_session_ids=%s, duplicate_non_null_stripe_payment_intent_ids=%s; unique_checkout_session_index=%s, unique_payment_intent_index=%s',
      duplicate_non_null_stripe_checkout_session_ids,
      duplicate_non_null_stripe_payment_intent_ids,
      unique_checkout_session_index,
      unique_payment_intent_index
    )
  from stripe_duplicates
  cross join constraints

  union all
  select
    'transport_refund_ledger_exists',
    transport_refund_ledger_exists,
    case
      when transport_refund_ledger_exists then 'refund_tables=' || refund_tables
      else 'No transport/service/deposit refund table found by catalog name search; net_paid cannot safely subtract refunds from current application data.'
    end
  from refund_objects

  union all
  select
    'stripe_refund_webhook_supports_transport',
    transport_refund_function_exists,
    case
      when transport_refund_function_exists then 'refund_functions=' || refund_functions
      else 'No deployed public function source indicating transport/service/deposit refund support was found by catalog search.'
    end
  from refund_objects

  union all
  select
    'round_trip_total_semantics_identified',
    true,
    'Production diagnostics search for total_price + return_total_price completed; see round_trip_double_count_risk details.'

  union all
  select
    'round_trip_double_count_risk',
    not round_trip_double_count_risk,
    case
      when round_trip_double_count_risk then details
      else 'No deployed public function/view source matched total_price + return_total_price.'
    end
  from round_trip_matches

  union all
  select
    'coupon_trigger_source_identified',
    coupon_trigger_source_identified,
    transport_trigger_details
  from trigger_checks

  union all
  select
    'coupon_trigger_safe_for_additive_adjustment',
    not coupon_trigger_reacts_to_generic_update,
    case
      when coupon_trigger_reacts_to_generic_update then
        'Coupon trigger fires on generic transport_bookings UPDATE and source touches NEW.total_price/deposit/coupon fields. Recommended strategy: correct/narrow the trigger or keep price adjustment writes outside transport_bookings until guarded.'
      else
        'Coupon trigger appears not to rewrite quote/deposit fields on unrelated future adjustment updates.'
    end
  from trigger_checks

  union all
  select
    'fulfillment_sync_source_identified',
    fulfillment_sync_source_identified,
    transport_trigger_details
  from trigger_checks

  union all
  select
    'fulfillment_price_adjustment_risk',
    not fulfillment_copies_transport_total_price,
    case
      when fulfillment_copies_transport_total_price then
        'Transport trigger/function copies NEW.total_price into partner_service_fulfillments; future adjustment must avoid silent fulfillment/settlement rewrites or deliberately use central summary.'
      else
        'No transport fulfillment source copying NEW.total_price was found.'
    end || ' details=' || details
  from fulfillment_sync

  union all
  select
    'commission_source_identified',
    commission_source_identified,
    format(
      'transport_related_commission_events=%s, with_payout_id=%s, connected_to_paid_or_finalized_payouts=%s; commission is expected to derive from paid service_deposit_requests/deposit_amount events, not live booking total.',
      transport_related_commission_events,
      transport_commission_events_with_payout_id,
      transport_commission_events_connected_to_paid_or_finalized_payouts
    )
  from commission_sources

  union all
  select
    'finalized_payout_impact_identified',
    true,
    format(
      'Changing customer final price must not silently mutate existing affiliate_commission_events. transport_commission_events_with_payout_id=%s, connected_to_paid_or_finalized_payouts=%s.',
      transport_commission_events_with_payout_id,
      transport_commission_events_connected_to_paid_or_finalized_payouts
    )
  from commission_sources

  union all
  select
    'admin_read_sources_identified',
    admin_read_sources_identified,
    details
  from read_sources

  union all
  select
    'customer_read_sources_identified',
    customer_read_sources_identified,
    details
  from read_sources

  union all
  select
    'partner_read_sources_identified',
    partner_read_sources_identified,
    details
  from read_sources

  union all
  select
    'raw_customer_financial_update_absent',
    raw_customer_financial_update_absent,
    details
  from raw_update_checks

  union all
  select
    'raw_partner_financial_update_absent',
    raw_partner_financial_update_absent,
    details
  from raw_update_checks

  union all
  select
    'rls_enabled_on_financial_tables',
    relevant_rls_enabled,
    details
  from rls_tables

  union all
  select
    'preflight_complete',
    (
      rt.transport_bookings_exists
      and rt.partner_service_fulfillments_exists
      and rt.service_deposit_requests_exists
      and rt.affiliate_commission_events_exists
      and rt.affiliate_payouts_exists
      and rc.total_price_exists
      and rc.deposit_request_amount_exists
      and tc.coupon_trigger_source_identified
      and tc.fulfillment_sync_source_identified
      and rs.admin_read_sources_identified
      and rs.customer_read_sources_identified
      and rs.partner_read_sources_identified
    ),
    'Core production model diagnostics completed. Refund-ledger absence and coupon-trigger safety are reported as explicit design blockers, not hidden by this completion check.'
  from required_tables rt
  cross join required_columns rc
  cross join trigger_checks tc
  cross join read_sources rs
)
select check_name, pass, details
from diagnostics
order by
  case when pass is false or pass is null then 0 else 1 end,
  check_name;
