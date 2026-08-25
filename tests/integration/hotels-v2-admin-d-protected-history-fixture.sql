-- Production-shaped protected-history relations omitted by the compact H3/A-C
-- PostgREST base. These disposable empty relations let ADMIN-D prove that its
-- immutable baseline includes the complete accepted history graph.

create table auth.users(
  id uuid primary key,email text,created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_program_settings(
  id integer primary key default 1 check(id=1),
  level1_bps_default integer not null default 500,
  level2_bps_default integer not null default 100,
  level3_bps_default integer not null default 50,
  payout_threshold numeric(12,2) not null default 70,
  currency text not null default 'EUR',updated_at timestamptz not null default now()
);
insert into public.affiliate_program_settings(id) values(1);

create table public.affiliate_referrer_overrides(
  referrer_user_id uuid primary key references auth.users(id) on delete cascade,
  level1_bps_override integer,level2_bps_override integer,level3_bps_override integer,
  notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.affiliate_payouts(
  id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.partners(id) on delete cascade,
  amount numeric(12,2) not null,currency text not null default 'EUR',
  status text not null default 'pending' check(status in('pending','paid','cancelled')),
  created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
  paid_by uuid references auth.users(id) on delete set null,paid_at timestamptz,notes text
);
create table public.affiliate_commission_events(
  id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.partners(id) on delete cascade,
  deposit_request_id uuid not null references public.service_deposit_requests(id) on delete cascade,
  level smallint not null check(level in(1,2,3)),referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check(resource_type in('cars','trips','hotels')),booking_id uuid not null,
  fulfillment_id uuid not null,deposit_paid_at timestamptz,deposit_amount numeric(12,2) not null,
  commission_bps integer not null,commission_amount numeric(12,2) not null,currency text not null default 'EUR',
  payout_id uuid references public.affiliate_payouts(id) on delete set null,created_at timestamptz not null default now(),
  unique(deposit_request_id,level)
);
create table public.affiliate_cashout_requests(
  id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.partners(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,requested_amount numeric(12,2) not null,
  currency text not null default 'EUR',balance_at_request numeric(12,2) not null default 0,
  threshold_at_request numeric(12,2) not null default 70,
  status text not null default 'pending' check(status in('pending','approved','rejected','paid','cancelled')),
  admin_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.affiliate_adjustments(
  id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.partners(id) on delete cascade,
  amount numeric(12,2) not null,currency text not null default 'EUR',reason text,
  created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
  payout_id uuid references public.affiliate_payouts(id) on delete set null
);
create table public.referrals(
  id uuid primary key default gen_random_uuid(),referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,status text not null default 'pending',
  created_at timestamptz not null default now(),unique(referred_id)
);
create table public.profile_referral_code_aliases(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,referral_code_normalized text not null,created_at timestamptz not null default now(),
  retired_at timestamptz,created_by uuid references public.profiles(id) on delete set null,reason text
);
create table public.service_coupons(
  id uuid primary key default gen_random_uuid(),
  service_type text not null check(service_type in('trips','hotels','transport','shop')),
  code text not null,name text,description text,internal_notes text,
  status text not null default 'draft' check(status in('draft','active','paused','expired')),
  is_active boolean not null default true,discount_type text not null default 'percent'
    check(discount_type in('percent','fixed')),discount_value numeric(12,2) not null check(discount_value>0),
  currency text not null default 'EUR',starts_at timestamptz,expires_at timestamptz,
  single_use boolean not null default false,usage_limit_total integer,usage_limit_per_user integer,
  min_order_total numeric(12,2),partner_id uuid references public.partners(id) on delete set null,
  partner_commission_bps_override integer,rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
