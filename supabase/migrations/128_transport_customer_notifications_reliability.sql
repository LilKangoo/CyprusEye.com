CREATE INDEX IF NOT EXISTS transport_bookings_customer_email_idx
  ON public.transport_bookings (lower(customer_email), created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_transport_booking_require_customer_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.customer_email := lower(NULLIF(trim(COALESCE(NEW.customer_email, '')), ''));

  IF NEW.customer_email IS NULL THEN
    RAISE EXCEPTION 'customer_email is required for transport booking notifications'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'customer_email must be a valid email address for transport booking notifications'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  jwt_email_expr text := 'lower(coalesce(auth.jwt() ->> ''email'', auth.jwt() -> ''user_metadata'' ->> ''email'', ''''))';
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_transport_booking_require_customer_email_biu ON public.transport_bookings';
  EXECUTE 'CREATE TRIGGER trg_transport_booking_require_customer_email_biu
    BEFORE INSERT OR UPDATE OF customer_email
    ON public.transport_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_transport_booking_require_customer_email()';

  DROP POLICY IF EXISTS transport_bookings_user_select ON public.transport_bookings;
  EXECUTE
    'CREATE POLICY transport_bookings_user_select
      ON public.transport_bookings
      FOR SELECT
      TO authenticated
      USING (lower(trim(coalesce(customer_email, ''''))) = ' || jwt_email_expr || ')';

  EXECUTE 'GRANT SELECT ON TABLE public.transport_bookings TO authenticated';
END $$;
