-- Hotel booking admin manual price adjustments.
-- Keeps production payment history intact while allowing admins to correct the
-- displayed/operational booking total and partner fulfillment total.

ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS admin_manual_adjustment jsonb,
  ADD COLUMN IF NOT EXISTS admin_manual_adjustment_reason text,
  ADD COLUMN IF NOT EXISTS admin_manual_adjustment_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_manual_adjustment_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hotel_bookings_admin_manual_adjustment_at_idx
  ON public.hotel_bookings(admin_manual_adjustment_at DESC)
  WHERE admin_manual_adjustment_at IS NOT NULL;

COMMENT ON COLUMN public.hotel_bookings.admin_manual_adjustment IS
  'Audit payload for manual admin booking total adjustments. Paid deposit records are not changed.';

COMMENT ON COLUMN public.hotel_bookings.admin_manual_adjustment_reason IS
  'Admin-provided reason for the latest manual booking total adjustment.';

CREATE OR REPLACE FUNCTION public.trg_apply_service_coupon_hotel_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(NEW.coupon_code, '')));
  v_base numeric;
  v_quote record;
  v_hotel_slug text;
  v_hotel_city text;
  v_service_at timestamptz;
  v_categories text[];
  v_manual_adjustment jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_manual_adjustment := to_jsonb(NEW)->'admin_manual_adjustment';
  IF lower(coalesce(v_manual_adjustment->>'enabled', 'false')) IN ('true', 't', '1', 'yes') THEN
    NEW.total_price := round(greatest(coalesce(NEW.total_price, NEW.final_price, 0), 0), 2);
    NEW.final_price := round(greatest(coalesce(NEW.final_price, NEW.total_price, 0), 0), 2);
    NEW.base_price := round(greatest(coalesce(NEW.base_price, NEW.final_price, NEW.total_price, 0), 0), 2);
    RETURN NEW;
  END IF;

  v_base := round(greatest(coalesce(
    NEW.base_price,
    NEW.final_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.total_price,
    0
  ), 0), 2);

  IF v_code = '' AND NEW.coupon_id IS NOT NULL THEN
    SELECT upper(trim(coalesce(code, '')))
    INTO v_code
    FROM public.service_coupons
    WHERE id = NEW.coupon_id
      AND service_type = 'hotels'
    LIMIT 1;
  END IF;

  IF v_code = '' THEN
    NEW.coupon_id := NULL;
    NEW.coupon_code := NULL;
    NEW.coupon_discount_amount := 0;
    NEW.coupon_partner_id := NULL;
    NEW.coupon_partner_commission_bps := NULL;
    NEW.base_price := coalesce(NEW.base_price, v_base);
    NEW.final_price := coalesce(NEW.final_price, NEW.total_price, NEW.base_price, v_base);
    NEW.total_price := coalesce(NEW.final_price, NEW.total_price, v_base);
    RETURN NEW;
  END IF;

  IF NEW.hotel_id IS NOT NULL THEN
    SELECT slug, city
    INTO v_hotel_slug, v_hotel_city
    FROM public.hotels
    WHERE id = NEW.hotel_id
    LIMIT 1;
  END IF;

  v_categories := array_remove(ARRAY[
    lower(nullif(NEW.hotel_slug, '')),
    lower(nullif(v_hotel_slug, '')),
    lower(nullif(v_hotel_city, ''))
  ], NULL);

  v_service_at := COALESCE(
    NEW.arrival_date::timestamptz,
    NEW.created_at,
    now()
  );

  SELECT *
  INTO v_quote
  FROM public.service_coupon_quote(
    'hotels',
    v_code,
    v_base,
    v_service_at,
    NEW.hotel_id,
    v_categories,
    public.try_uuid(to_jsonb(NEW)->>'user_id'),
    NEW.customer_email
  );

  IF coalesce(v_quote.is_valid, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_quote.message, 'Invalid coupon');
  END IF;

  NEW.coupon_id := v_quote.coupon_id;
  NEW.coupon_code := v_quote.coupon_code;
  NEW.coupon_discount_amount := round(coalesce(v_quote.discount_amount, 0), 2);
  NEW.coupon_partner_id := v_quote.partner_id;
  NEW.coupon_partner_commission_bps := v_quote.partner_commission_bps_override;
  NEW.base_price := round(coalesce(v_quote.base_total, v_base), 2);
  NEW.final_price := round(coalesce(v_quote.final_total, v_base), 2);
  NEW.total_price := NEW.final_price;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_apply_hotel_booking_manual_adjustment(
  p_booking_id uuid,
  p_manual_total numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_reason text := trim(coalesce(p_reason, ''));
  v_manual_total numeric := round(p_manual_total, 2);
  v_old public.hotel_bookings%rowtype;
  v_new public.hotel_bookings%rowtype;
  v_previous_total numeric;
  v_adjustment jsonb;
  v_fulfillment public.partner_service_fulfillments%rowtype;
  v_deposit public.service_deposit_requests%rowtype;
  v_deposit_found boolean := false;
  v_deposit_paid boolean := false;
  v_deposit_checkout_invalidated boolean := false;
BEGIN
  IF NOT coalesce(public.is_current_user_admin(), false) THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking id is required' USING ERRCODE = '22023';
  END IF;

  IF p_manual_total IS NULL OR p_manual_total < 0 OR p_manual_total > 9999999 THEN
    RAISE EXCEPTION 'Manual total must be a valid non-negative amount' USING ERRCODE = '22023';
  END IF;

  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Adjustment reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_old
  FROM public.hotel_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hotel booking not found' USING ERRCODE = 'P0002';
  END IF;

  v_previous_total := round(coalesce(v_old.final_price, v_old.total_price, 0), 2);

  v_adjustment := jsonb_strip_nulls(jsonb_build_object(
    'enabled', true,
    'type', 'manual_admin_adjustment',
    'previous_total', v_previous_total,
    'manual_total', v_manual_total,
    'currency', 'EUR',
    'reason', v_reason,
    'adjusted_at', v_now,
    'adjusted_by', v_actor,
    'payment_scope', 'booking_and_partner_fulfillment_total',
    'payment_note', 'Paid deposit records are preserved and are not rewritten by this adjustment.'
  ));

  UPDATE public.hotel_bookings
  SET
    total_price = v_manual_total,
    final_price = v_manual_total,
    admin_manual_adjustment = v_adjustment,
    admin_manual_adjustment_reason = v_reason,
    admin_manual_adjustment_at = v_now,
    admin_manual_adjustment_by = v_actor,
    pricing_breakdown = jsonb_set(
      coalesce(pricing_breakdown, '{}'::jsonb),
      '{admin_manual_adjustment}',
      v_adjustment,
      true
    ),
    updated_at = v_now
  WHERE id = p_booking_id
  RETURNING * INTO v_new;

  SELECT *
  INTO v_fulfillment
  FROM public.partner_service_fulfillments
  WHERE resource_type = 'hotels'
    AND booking_id = p_booking_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.partner_service_fulfillments
    SET
      total_price = v_manual_total,
      currency = coalesce(currency, 'EUR'),
      details = jsonb_strip_nulls(
        coalesce(details, '{}'::jsonb)
        || jsonb_build_object(
          'base_price', v_new.base_price,
          'final_price', v_new.final_price,
          'total_price', v_new.total_price,
          'pricing_breakdown', v_new.pricing_breakdown,
          'admin_manual_adjustment', v_adjustment
        )
      ),
      updated_at = v_now
    WHERE id = v_fulfillment.id;

    IF to_regclass('public.partner_service_fulfillment_form_snapshots') IS NOT NULL THEN
      UPDATE public.partner_service_fulfillment_form_snapshots
      SET payload = jsonb_strip_nulls(
        coalesce(payload, '{}'::jsonb)
        || jsonb_build_object(
          'total_price', v_new.total_price,
          'final_price', v_new.final_price,
          'admin_manual_adjustment', v_adjustment
        )
      )
      WHERE fulfillment_id = v_fulfillment.id;
    END IF;

    SELECT *
    INTO v_deposit
    FROM public.service_deposit_requests
    WHERE fulfillment_id = v_fulfillment.id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_deposit_found := true;
      v_deposit_paid := lower(coalesce(v_deposit.status, '')) = 'paid' OR v_deposit.paid_at IS NOT NULL;

      IF NOT v_deposit_paid THEN
        UPDATE public.service_deposit_requests
        SET
          status = 'pending',
          checkout_url = NULL,
          stripe_checkout_session_id = NULL,
          stripe_payment_intent_id = NULL,
          email_sent_at = NULL,
          fulfillment_summary = coalesce(fulfillment_summary, v_fulfillment.summary),
          updated_at = v_now
        WHERE id = v_deposit.id;

        v_deposit_checkout_invalidated := true;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.admin_activity_log') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_activity_log'
        AND column_name = 'target_user_id'
    ) THEN
      INSERT INTO public.admin_activity_log(actor_id, target_user_id, action, details)
      VALUES (
        v_actor,
        v_actor,
        'hotel_booking_manual_adjustment',
        jsonb_build_object(
          'booking_id', p_booking_id,
          'previous_total', v_previous_total,
          'manual_total', v_manual_total,
          'reason', v_reason,
          'deposit_found', v_deposit_found,
          'deposit_paid', v_deposit_paid,
          'deposit_checkout_invalidated', v_deposit_checkout_invalidated
        )
      );
    ELSE
      INSERT INTO public.admin_activity_log(actor_id, action, details)
      VALUES (
        v_actor,
        'hotel_booking_manual_adjustment',
        jsonb_build_object(
          'booking_id', p_booking_id,
          'previous_total', v_previous_total,
          'manual_total', v_manual_total,
          'reason', v_reason,
          'deposit_found', v_deposit_found,
          'deposit_paid', v_deposit_paid,
          'deposit_checkout_invalidated', v_deposit_checkout_invalidated
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'previous_total', v_previous_total,
    'manual_total', v_manual_total,
    'fulfillment_synced', v_fulfillment.id IS NOT NULL,
    'deposit_found', v_deposit_found,
    'deposit_paid', v_deposit_paid,
    'deposit_checkout_invalidated', v_deposit_checkout_invalidated,
    'adjustment', v_adjustment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_hotel_booking_manual_adjustment(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_hotel_booking_manual_adjustment(uuid, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.admin_apply_hotel_booking_manual_adjustment(uuid, numeric, text) IS
  'Admin-only RPC for hotel booking manual price adjustments. Syncs booking and partner fulfillment totals; paid deposit records are preserved.';
