begin;
set transaction read only;
select 'hotels_partner_stripe_connect_prewrite_v1' contract_version,
  current_setting('transaction_read_only')='on' transaction_read_only,
  to_regnamespace('hotel_stripe_connect_private') is null private_schema_absent,
  to_regprocedure('public.hotel_v2_stripe_connect_service(text,jsonb)') is null service_rpc_absent,
  public.hotel_v2_external_calendar_provider_evolution_is_safe() is true provider_boundary_safe,
  (select count(*)=1 and bool_and(id=1 and hotel_stripe_connect_enabled is false) from public.site_settings) stripe_disabled;
rollback;
