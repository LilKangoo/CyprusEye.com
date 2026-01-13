ALTER TABLE IF EXISTS public.shop_orders
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.car_bookings
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.trip_bookings
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.hotel_bookings
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_received_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'cars',
    'record_id', NEW.id::text,
    'event', 'customer_received',
    'table', 'car_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'cars',
    'customer_received',
    NEW.id::text,
    'car_bookings',
    payload,
    'cars_customer_received:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_received_car_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_enqueue_customer_received_car_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_customer_received_car_booking();

CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_received_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'trips',
    'record_id', NEW.id::text,
    'event', 'customer_received',
    'table', 'trip_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'trips',
    'customer_received',
    NEW.id::text,
    'trip_bookings',
    payload,
    'trips_customer_received:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_received_trip_booking_ins ON public.trip_bookings;
CREATE TRIGGER trg_enqueue_customer_received_trip_booking_ins
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_customer_received_trip_booking();

CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_received_hotel_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'hotels',
    'record_id', NEW.id::text,
    'event', 'customer_received',
    'table', 'hotel_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'hotels',
    'customer_received',
    NEW.id::text,
    'hotel_bookings',
    payload,
    'hotels_customer_received:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_received_hotel_booking_ins ON public.hotel_bookings;
CREATE TRIGGER trg_enqueue_customer_received_hotel_booking_ins
  AFTER INSERT ON public.hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_customer_received_hotel_booking();

CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_received_shop_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'shop',
    'record_id', NEW.id::text,
    'event', 'customer_received',
    'table', 'shop_orders',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'shop',
    'customer_received',
    NEW.id::text,
    'shop_orders',
    payload,
    'shop_customer_received:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enqueue_customer_received_shop_order_ins ON public.shop_orders;
CREATE TRIGGER trg_enqueue_customer_received_shop_order_ins
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_customer_received_shop_order();
