DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.partner_service_fulfillment_contacts') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
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
    p_created_at TIMESTAMPTZ
  )
  RETURNS UUID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $body$
  DECLARE
    pid UUID;
    fid UUID;
    deadline TIMESTAMPTZ;
  BEGIN
    pid := public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id);
    IF pid IS NULL THEN
      RETURN NULL;
    END IF;

    deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date,
      p_end_date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id)
    DO UPDATE SET
      partner_id = EXCLUDED.partner_id,
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;

    INSERT INTO public.partner_service_fulfillment_contacts(
      fulfillment_id,
      customer_name,
      customer_email,
      customer_phone,
      created_at
    )
    VALUES (
      fid,
      p_customer_name,
      p_customer_email,
      p_customer_phone,
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone;

    RETURN fid;
  END;
  $body$;
  $fn$;

  EXECUTE $fn$
  CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
    p_resource_type TEXT,
    p_booking_id UUID,
    p_resource_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_total_price NUMERIC,
    p_currency TEXT,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_reference TEXT,
    p_summary TEXT,
    p_created_at TIMESTAMPTZ
  )
  RETURNS UUID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $body$
  DECLARE
    pid UUID;
    fid UUID;
    deadline TIMESTAMPTZ;
  BEGIN
    pid := public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id);
    IF pid IS NULL THEN
      RETURN NULL;
    END IF;

    deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date::date,
      p_end_date::date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id)
    DO UPDATE SET
      partner_id = EXCLUDED.partner_id,
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;

    INSERT INTO public.partner_service_fulfillment_contacts(
      fulfillment_id,
      customer_name,
      customer_email,
      customer_phone,
      created_at
    )
    VALUES (
      fid,
      p_customer_name,
      p_customer_email,
      p_customer_phone,
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone;

    RETURN fid;
  END;
  $body$;
  $fn$;
END $$;
