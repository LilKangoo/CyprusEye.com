create table if not exists public.partner_plus_applications (
  id uuid primary key default gen_random_uuid(),
  source_context text not null default 'advertise-partner',
  workflow_status text not null default 'pending'
    check (workflow_status in ('pending', 'approved', 'rejected')),
  language text null,
  partner_type text null,
  package_tier text null,
  service text not null,
  name text not null,
  email text not null,
  phone text null,
  location text null,
  website text null,
  service_description text null,
  tour_types text null,
  tour_languages text null,
  tour_area text null,
  accommodation_type text null,
  accommodation_capacity text null,
  local_service_category text null,
  local_service_offer text null,
  message text null,
  referer text null,
  user_agent text null,
  matched_profile_id uuid null references public.profiles(id) on delete set null,
  approved_partner_id uuid null references public.partners(id) on delete set null,
  approved_partner_user_id uuid null references public.profiles(id) on delete set null,
  access_granted boolean not null default false,
  review_note text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_partner_plus_applications_created_at
  on public.partner_plus_applications(created_at desc);

create index if not exists idx_partner_plus_applications_workflow_status
  on public.partner_plus_applications(workflow_status);

create index if not exists idx_partner_plus_applications_partner_type
  on public.partner_plus_applications(partner_type);

create index if not exists idx_partner_plus_applications_email
  on public.partner_plus_applications(email);

drop trigger if exists trg_partner_plus_applications_set_updated_at
  on public.partner_plus_applications;

create trigger trg_partner_plus_applications_set_updated_at
  before update on public.partner_plus_applications
  for each row
  execute function public.set_updated_at();

alter table public.partner_plus_applications enable row level security;

drop policy if exists partner_plus_applications_admin_all
  on public.partner_plus_applications;

create policy partner_plus_applications_admin_all
  on public.partner_plus_applications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
