\set ON_ERROR_STOP on
-- Only a disposable synthetic database cloned from the accepted 114415 fixture.
DO $local$ BEGIN
 IF current_database() !~ '^hotels_functional_global_' OR host(inet_server_addr())<>'127.0.0.1'
 OR inet_server_port()<>55479 THEN RAISE EXCEPTION 'local_lifecycle_fixture_required'; END IF;
END $local$;
-- The historical phase fixtures intentionally retain the 113500 snapshot.
-- Model the accepted production 113700 digest qualification before 114420,
-- without rerunning its unrelated writer evolutions over later contracts.
do $accepted_snapshot_fixture$
declare v_oid oid := 'public.hotel_v2_admin_c_pricing_control_snapshot(uuid)'::regprocedure;
  v_source text;
begin
  select prosrc into v_source from pg_proc where oid=v_oid;
  if encode(extensions.digest(convert_to(v_source,'UTF8'),'sha256'),'hex') <>
    'd6cec06410e28b4138de5776b66f622ad8c9402662672862726e81ecb7ea613a' then
    raise exception 'unexpected historical snapshot fixture';
  end if;
  execute replace(pg_get_functiondef(v_oid),'digest(convert_to','extensions.digest(convert_to');
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    from pg_proc where oid=v_oid) <>
    '3f954c525277c771c3009e9ca1fbbf6c68776904f40bc70978d01f7f10a060b0' then
    raise exception 'accepted 113700 snapshot fixture mismatch';
  end if;
end
$accepted_snapshot_fixture$;

-- The accepted focused Hotels V2 chain intentionally carries a reduced
-- hotel_bookings fixture.  Restore the committed production booking columns
-- consumed by the application bridge without replaying unrelated migrations.
alter table public.hotel_bookings
  add column if not exists hotel_slug text,
  add column if not exists user_id uuid,
  add column if not exists created_by uuid,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists nights integer,
  add column if not exists notes text,
  add column if not exists source text,
  add column if not exists lang text,
  add column if not exists base_price numeric(12,2),
  add column if not exists final_price numeric(12,2),
  add column if not exists extras_price numeric(12,2),
  add column if not exists selected_extras jsonb default '[]'::jsonb,
  add column if not exists pricing_breakdown jsonb default '{}'::jsonb,
  add column if not exists booking_details jsonb default '{}'::jsonb,
  add column if not exists rate_plan_id text,
  add column if not exists coupon_id uuid,
  add column if not exists coupon_code text,
  add column if not exists coupon_discount_amount numeric(12,2) default 0,
  add column if not exists coupon_partner_id uuid,
  add column if not exists coupon_partner_commission_bps integer,
  add column if not exists referral_code text,
  add column if not exists referral_source text,
  add column if not exists referral_captured_at timestamptz;

-- The focused accepted-chain fixture predates the repository's general coupon
-- migration.  Production has this helper; install a fail-closed signature-exact
-- local stand-in so the application bridge can exercise its no-coupon and
-- invalid-coupon paths without replaying unrelated service migrations.
do $application_bridge_coupon_fixture$
begin
  if to_regprocedure(
      'public.service_coupon_quote(text,text,numeric,timestamp with time zone,uuid,text[],uuid,text)')
       is null then
    execute $ddl$
      create function public.service_coupon_quote(
        p_service_type text,p_coupon_code text,p_base_total numeric,
        p_service_at timestamptz default null,p_resource_id uuid default null,
        p_category_keys text[] default null,p_user_id uuid default null,
        p_user_email text default null)
      returns table(is_valid boolean,message text,coupon_id uuid,coupon_code text,
        discount_type text,discount_value numeric,base_total numeric,
        discount_amount numeric,final_total numeric,currency text,partner_id uuid,
        partner_commission_bps_override integer)
      language sql stable security definer set search_path=pg_catalog
      as $fixture$
        select p_coupon_code='UTC_BOUNDARY'
            and (p_service_at at time zone 'UTC')::date=
              (transaction_timestamp() at time zone 'UTC')::date+45,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 'Coupon applied' else 'Coupon not found' end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then '42000000-0000-4000-8000-000000000001'::uuid else null::uuid end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then p_coupon_code else null::text end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 'fixed' else null::text end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 5::numeric else null::numeric end,
          round(greatest(coalesce(p_base_total,0),0),2),
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then 5::numeric else 0::numeric end,
          case when p_coupon_code='UTC_BOUNDARY'
              and (p_service_at at time zone 'UTC')::date=
                (transaction_timestamp() at time zone 'UTC')::date+45
            then round(greatest(coalesce(p_base_total,0)-5,0),2)
            else round(greatest(coalesce(p_base_total,0),0),2) end,
          'EUR',null::uuid,null::integer
      $fixture$
    $ddl$;
    alter function public.service_coupon_quote(
      text,text,numeric,timestamptz,uuid,text[],uuid,text) owner to postgres;
  end if;
end
$application_bridge_coupon_fixture$;

create or replace function public.application_bridge_coupon_fixture_mutator()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $fixture$
declare v_quote record;
begin
  if current_setting('test.hotels_114420_coupon_rewrite',true)='on' then
    new.total_price:=coalesce(new.total_price,0)+1;
    new.final_price:=coalesce(new.final_price,new.total_price,0)+1;
    return new;
  end if;
  if nullif(new.coupon_code,'') is null then return new; end if;
  select * into v_quote from public.service_coupon_quote(
    'hotels',new.coupon_code,new.base_price,new.arrival_date::timestamptz,
    new.hotel_id,array['seven-arches-hotel'],new.user_id,new.customer_email);
  if coalesce(v_quote.is_valid,false) is not true then
    raise exception using errcode='22023',message='Coupon not found';
  end if;
  new.coupon_id:=v_quote.coupon_id;
  new.coupon_code:=v_quote.coupon_code;
  new.coupon_discount_amount:=v_quote.discount_amount;
  new.base_price:=v_quote.base_total;
  new.final_price:=v_quote.final_total;
  new.total_price:=v_quote.final_total;
  return new;
end
$fixture$;
alter function public.application_bridge_coupon_fixture_mutator() owner to postgres;
drop trigger if exists trg_apply_service_coupon_hotel_booking_biu on public.hotel_bookings;
create trigger trg_apply_service_coupon_hotel_booking_biu
before insert or update on public.hotel_bookings
for each row execute function public.application_bridge_coupon_fixture_mutator();
\ir ../../supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql
\ir ../../supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_preflight.sql
\ir ../../supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql
\ir ../../supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql
\ir ../../supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql
\ir ../../supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql
\ir ../../supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql
\ir ../../supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql
\ir ../../supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql
\ir ../../supabase/manual/hotels_v2_capability_lifecycle_prewrite_readonly.sql
\ir ../../supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql
\ir ../../supabase/manual/hotels_v2_capability_lifecycle_postinstall_readonly.sql
SELECT 'HOTELS_CAPABILITY_FULL_FORWARD_CHAIN_PASS' AS sentinel;
