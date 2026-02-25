-- Safety migration: ensure round-trip columns exist and force PostgREST schema reload.
-- This protects environments where a previous migration was only partially applied.

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD COLUMN IF NOT EXISTS trip_type text NOT NULL DEFAULT 'one_way',
    ADD COLUMN IF NOT EXISTS return_route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_origin_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_destination_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_travel_date date,
    ADD COLUMN IF NOT EXISTS return_travel_time time without time zone,
    ADD COLUMN IF NOT EXISTS return_pickup_address text,
    ADD COLUMN IF NOT EXISTS return_dropoff_address text,
    ADD COLUMN IF NOT EXISTS return_flight_number text,
    ADD COLUMN IF NOT EXISTS return_base_price numeric(12,2),
    ADD COLUMN IF NOT EXISTS return_extras_price numeric(12,2),
    ADD COLUMN IF NOT EXISTS return_total_price numeric(12,2);
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.transport_bookings
  SET trip_type = 'one_way'
  WHERE trip_type IS NULL OR btrim(trip_type) = '';
END $$;

DO $$
BEGIN
  -- Force PostgREST to refresh schema cache immediately.
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN others THEN
  NULL;
END $$;
