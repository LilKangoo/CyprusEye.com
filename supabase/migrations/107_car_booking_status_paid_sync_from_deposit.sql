-- Keep car_bookings status/payment in sync with paid service deposits.
-- Rule: when a cars deposit is paid, booking should be confirmed + paid.

CREATE OR REPLACE FUNCTION public.sync_car_booking_status_from_deposit_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_payment_status boolean := false;
BEGIN
  IF NEW.resource_type IS DISTINCT FROM 'cars' THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') <> 'paid' AND NEW.paid_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_bookings'
      AND column_name = 'payment_status'
  )
  INTO has_payment_status;

  IF has_payment_status THEN
    UPDATE public.car_bookings cb
    SET
      payment_status = 'paid',
      status = CASE
        WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
        ELSE cb.status
      END
    WHERE cb.id = NEW.booking_id;
  ELSE
    UPDATE public.car_bookings cb
    SET
      status = CASE
        WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
        ELSE cb.status
      END
    WHERE cb.id = NEW.booking_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_car_booking_status_from_deposit_paid ON public.service_deposit_requests;
CREATE TRIGGER trg_sync_car_booking_status_from_deposit_paid
AFTER INSERT OR UPDATE OF status, paid_at ON public.service_deposit_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_car_booking_status_from_deposit_paid();

-- Backfill old records where deposit was already paid.
DO $$
DECLARE
  has_payment_status boolean := false;
BEGIN
  IF to_regclass('public.service_deposit_requests') IS NOT NULL
     AND to_regclass('public.car_bookings') IS NOT NULL THEN

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'payment_status'
    )
    INTO has_payment_status;

    IF has_payment_status THEN
      UPDATE public.car_bookings cb
      SET
        payment_status = 'paid',
        status = CASE
          WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
          ELSE cb.status
        END
      WHERE EXISTS (
        SELECT 1
        FROM public.service_deposit_requests dr
        WHERE dr.resource_type = 'cars'
          AND dr.booking_id = cb.id
          AND (COALESCE(dr.status, '') = 'paid' OR dr.paid_at IS NOT NULL)
      );
    ELSE
      UPDATE public.car_bookings cb
      SET
        status = CASE
          WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
          ELSE cb.status
        END
      WHERE EXISTS (
        SELECT 1
        FROM public.service_deposit_requests dr
        WHERE dr.resource_type = 'cars'
          AND dr.booking_id = cb.id
          AND (COALESCE(dr.status, '') = 'paid' OR dr.paid_at IS NOT NULL)
      );
    END IF;
  END IF;
END;
$$;
