\set ON_ERROR_STOP on

-- Disposable local-only H3.2A fixture. It composes the production-shaped,
-- public-inert H3.1P graph, then adds only synthetic Partner memberships and
-- assignments needed to prove owner/staff isolation over real PostgREST.
\ir hotels-v2-h3-1p-postgrest-base.sql

-- H3.2A starts from the completed reviewed H3.1P state, not merely its inert
-- schema. Perform the exact local Admin promotion through the public RPC.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',
  true
);
with preview as (
  select public.hotel_v2_admin_get_legacy_pricing_promotion_preview(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  ) value
)
select public.hotel_v2_admin_apply_legacy_pricing_promotion(
  jsonb_build_object(
    'hotel_id', '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
    'reviewed_at', clock_timestamp(),
    'snapshot_token', preview.value->>'snapshot_token',
    'expected', preview.value->'expected',
    'decision', 'promote_room_schedule_to_reviewed',
    'acknowledge_pricing_occupancy_mapping', true
  ),
  '31900000-0000-4000-8000-000000000001'::uuid
)
from preview;
commit;

begin;

-- The compact H2A fixture predates the production staff-resource table. H3.2A
-- deliberately consumes its established five-column contract instead of
-- inventing a second staff-scope model.
create table public.partner_user_resources (
  id uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references public.partner_users(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  created_at timestamptz default now(),
  unique(partner_user_id, resource_type, resource_id)
);
alter table public.partner_user_resources enable row level security;

create policy partner_user_resources_admin_all
on public.partner_user_resources for all to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy partner_user_resources_self_read
on public.partner_user_resources for select to authenticated
using (exists (
  select 1
  from public.partner_users membership
  where membership.id = partner_user_id
    and membership.user_id = auth.uid()
));

-- Reproduce the existing legacy raw Hotel partner policies verbatim. H3.2A is
-- not allowed to replace or relax these policies; its migration and verify
-- gates fingerprint their definitions while the new portal uses RPCs only.
alter table public.hotels enable row level security;
create policy "Anyone can view published hotels"
on public.hotels for select
using (is_published = true);
create policy hotels_authenticated_select
on public.hotels for select to authenticated
using (
  is_current_user_admin()
  or (owner_partner_id is not null and is_partner_user(owner_partner_id))
  or is_published = true
);
create policy hotels_admin_all
on public.hotels for all to authenticated
using (is_current_user_admin())
with check (is_current_user_admin());
create policy hotels_partner_insert
on public.hotels for insert to authenticated
with check (
  owner_partner_id is not null
  and is_partner_user(owner_partner_id)
  and is_published = false
);
create policy hotels_partner_update
on public.hotels for update to authenticated
using (
  owner_partner_id is not null
  and is_partner_user(owner_partner_id)
  and is_published = false
)
with check (
  owner_partner_id is not null
  and is_partner_user(owner_partner_id)
  and is_published = false
);
create policy hotels_partner_delete
on public.hotels for delete to authenticated
using (
  owner_partner_id is not null
  and is_partner_user(owner_partner_id)
  and is_published = false
);

-- Deterministic IDs keep the HTTP plan and its assignment relationship exact.
update public.partner_resources
set id = '32000000-0000-4000-8000-000000000001'
where partner_id = '20000000-0000-4000-8000-000000000001'
  and resource_type = 'hotels'
  and resource_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';

update public.partner_users
set id = '33000000-0000-4000-8000-000000000001'
where partner_id = '20000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000002';

insert into public.profiles(id, email, is_admin) values
  ('10000000-0000-4000-8000-000000000004', 'scoped-staff@example.test', false),
  ('10000000-0000-4000-8000-000000000005', 'unscoped-staff@example.test', false),
  ('10000000-0000-4000-8000-000000000006', 'suspended-owner@example.test', false),
  ('10000000-0000-4000-8000-000000000007', 'unassigned-owner@example.test', false),
  ('10000000-0000-4000-8000-000000000008', 'second-owner@example.test', false),
  ('10000000-0000-4000-8000-000000000009', 'disabled-owner@example.test', false),
  ('10000000-0000-4000-8000-000000000010', 'co-owner-a@example.test', false),
  ('10000000-0000-4000-8000-000000000011', 'co-owner-b@example.test', false);

insert into public.partners(id, name, status, can_manage_hotels) values
  ('20000000-0000-4000-8000-000000000003', 'Synthetic Suspended Hotel Partner', 'suspended', true),
  ('20000000-0000-4000-8000-000000000004', 'Synthetic Unassigned Hotel Partner', 'active', true),
  ('20000000-0000-4000-8000-000000000005', 'Synthetic Second Hotel Partner', 'active', true);

insert into public.partner_users(id, partner_id, user_id, role) values
  ('33000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'staff'),
  ('33000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'staff'),
  ('33000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', 'owner'),
  ('33000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000007', 'owner'),
  ('33000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000008', 'owner'),
  ('33000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', 'owner'),
  ('33000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'owner'),
  ('33000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'owner');

-- RGB has no booking in this fixture. Multiple assignments there exercise the
-- sole-mutator rule without touching the protected 7 Kamares history.
insert into public.partner_resources(id, partner_id, resource_type, resource_id) values
  ('32000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'hotels', 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'),
  ('32000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', 'hotels', 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'),
  ('32000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'hotels', 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'),
  ('32000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'hotels', 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1');

insert into public.partner_user_resources(
  id, partner_user_id, resource_type, resource_id
) values (
  '34000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002',
  'hotels',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
);

commit;

\ir ../../supabase/migrations/20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql

notify pgrst, 'reload schema';
