-- Trip date-selection flow hardening for partner/admin/customer process.
-- 1) Add canonical request table for 1-3 proposed dates.
-- 2) Extend trip_bookings with preferred/selected date fields.
-- 3) Preserve custom fulfillment.details keys when booking-trigger sync runs.

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS preferred_trip_date date,
      ADD COLUMN IF NOT EXISTS selected_trip_date date;

    UPDATE public.trip_bookings
    SET preferred_trip_date = COALESCE(preferred_trip_date, trip_date)
    WHERE preferred_trip_date IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.trip_date_selection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.trip_bookings(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.partner_service_fulfillments(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  proposed_dates date[] NOT NULL,
  preferred_date date,
  stay_from date,
  stay_to date,
  selected_date date,
  status text NOT NULL DEFAULT 'pending_admin'
    CHECK (status IN ('pending_admin','sent_to_customer','selected','expired','cancelled')),
  selection_token_hash text,
  selection_token_expires_at timestamptz,
  customer_email_sent_at timestamptz,
  selected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_date_selection_requests_proposed_dates_len_check
    CHECK (coalesce(cardinality(proposed_dates), 0) BETWEEN 1 AND 3),
  CONSTRAINT trip_date_selection_requests_selected_in_proposed_check
    CHECK (selected_date IS NULL OR selected_date = ANY(proposed_dates)),
  UNIQUE (fulfillment_id)
);

CREATE INDEX IF NOT EXISTS trip_date_selection_requests_booking_idx
  ON public.trip_date_selection_requests(booking_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS trip_date_selection_requests_partner_idx
  ON public.trip_date_selection_requests(partner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS trip_date_selection_requests_token_idx
  ON public.trip_date_selection_requests(selection_token_hash);

CREATE OR REPLACE FUNCTION public.trip_date_selection_requests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_date_selection_requests_set_updated_at ON public.trip_date_selection_requests;
CREATE TRIGGER trg_trip_date_selection_requests_set_updated_at
  BEFORE UPDATE ON public.trip_date_selection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trip_date_selection_requests_set_updated_at();

ALTER TABLE public.trip_date_selection_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_date_selection_requests_admin_all ON public.trip_date_selection_requests;
CREATE POLICY trip_date_selection_requests_admin_all
ON public.trip_date_selection_requests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
);

DROP POLICY IF EXISTS trip_date_selection_requests_partner_read ON public.trip_date_selection_requests;
CREATE POLICY trip_date_selection_requests_partner_read
ON public.trip_date_selection_requests
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

REVOKE ALL ON public.trip_date_selection_requests FROM anon;
GRANT SELECT ON public.trip_date_selection_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trip_date_selection_requests TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillments_for_resource_partners(
  p_resource_type TEXT,
  p_booking_id UUID,
  p_resource_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price NUMERIC,
  p_currency TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_reference TEXT,
  p_summary TEXT,
  p_created_at TIMESTAMPTZ,
  p_details JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  fid UUID;
  cnt INTEGER := 0;
  has_details BOOLEAN;
BEGIN
  has_details := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_service_fulfillments'
      AND column_name = 'details'
  );

  FOR pid IN
    SELECT partner_id
    FROM public.partner_service_fulfillment_partner_ids_for_resource(p_resource_type, p_resource_id)
  LOOP
    SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      p_start_date,
      p_end_date,
      p_total_price,
      p_currency,
      p_customer_name,
      p_customer_email,
      p_customer_phone,
      p_reference,
      p_summary,
      p_created_at
    )
    INTO fid;

    IF fid IS NOT NULL THEN
      cnt := cnt + 1;
      IF has_details AND p_details IS NOT NULL THEN
        UPDATE public.partner_service_fulfillments
        SET details = COALESCE(details, '{}'::jsonb) || p_details
        WHERE id = fid;
      END IF;
    END IF;
  END LOOP;

  RETURN cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details_json JSONB;
  form_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.trip_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'preferred_date', COALESCE(NEW.preferred_trip_date, NEW.trip_date),
    'trip_date', NEW.trip_date,
    'selected_trip_date', NEW.selected_trip_date,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'trip_id', NEW.trip_id,
    'trip_slug', NULLIF(NEW.trip_slug, ''),
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'preferred_trip_date', COALESCE(NEW.preferred_trip_date, NEW.trip_date),
    'selected_trip_date', NEW.selected_trip_date,
    'trip_date', NEW.trip_date,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children,
    'num_hours', NEW.num_hours,
    'num_days', NEW.num_days,
    'notes', NULLIF(NEW.notes, ''),
    'total_price', NEW.total_price
  ));

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
    'trips',
    NEW.id,
    NEW.trip_id,
    COALESCE(NEW.selected_trip_date::date, NEW.trip_date::date, NEW.arrival_date::date),
    NEW.departure_date::date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRIP-', SUBSTRING(NEW.id::text, 1, 8)),
    'Trip booking',
    NEW.created_at::timestamptz,
    details_json
  );

  INSERT INTO public.partner_service_fulfillment_form_snapshots(
    fulfillment_id,
    payload,
    created_at
  )
  SELECT
    f.id,
    COALESCE(form_json, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW())
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = 'trips'
    AND f.booking_id = NEW.id
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    payload = EXCLUDED.payload;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_ins ON public.trip_bookings';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_ins AFTER INSERT ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()';

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_upd ON public.trip_bookings';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_upd AFTER UPDATE OF trip_id, trip_date, preferred_trip_date, selected_trip_date, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status, num_adults, num_children ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()';
END $$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL OR to_regclass('public.trip_bookings') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.partner_service_fulfillments f
  SET details = COALESCE(f.details, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'preferred_date', COALESCE(tb.preferred_trip_date, tb.trip_date),
    'trip_date', tb.trip_date,
    'selected_trip_date', tb.selected_trip_date,
    'arrival_date', tb.arrival_date,
    'departure_date', tb.departure_date
  ))
  FROM public.trip_bookings tb
  WHERE f.resource_type = 'trips'
    AND f.booking_id = tb.id;
END $$;
