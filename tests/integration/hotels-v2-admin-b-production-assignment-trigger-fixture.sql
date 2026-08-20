\set ON_ERROR_STOP on

-- The real baseline intentionally exposes the shared amenity catalog to
-- authenticated public/Admin clients. The compact fixture predates that grant;
-- add it here so ADMIN-B proves it preserves, rather than fabricates, the ACL.
grant select on table public.hotel_amenities to authenticated;

-- The compact H3.2A fixture intentionally does not load the much larger
-- fulfillment-form migration. ADMIN-B patches the production assignment
-- trigger, so this disposable-only fixture supplies the same trigger anchor
-- and an observable legacy side effect. It is never part of a deployment.
alter table public.hotel_bookings
  add column if not exists room_type_id text;

create table public.partner_service_fulfillment_form_snapshots(
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create table public.hotels_v2_admin_b_test_assignment_backfill_calls(
  assignment_id uuid primary key,
  hotel_id uuid not null,
  partner_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);

create function public.trg_partner_resources_backfill_service_fulfillments()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
begin
  IF NEW.resource_type = 'trips' THEN
    return NEW;
  end if;

  if NEW.resource_type = 'hotels' then
    insert into public.hotels_v2_admin_b_test_assignment_backfill_calls(
      assignment_id,hotel_id,partner_id
    ) values(NEW.id,NEW.resource_id,NEW.partner_id);
  end if;

  return NEW;
end
$function$;

create trigger trg_partner_resources_backfill_service_fulfillments_ins
after insert on public.partner_resources
for each row execute function public.trg_partner_resources_backfill_service_fulfillments();
