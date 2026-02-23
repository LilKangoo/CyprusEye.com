-- =====================================================
-- Transport: route direction, hourly waiting fee, pricing-level deposit controls
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.transport_routes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_routes
    ADD COLUMN IF NOT EXISTS allows_round_trip boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS round_trip_multiplier numeric(6,3) NOT NULL DEFAULT 2.000;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_routes') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_routes'::regclass
      AND c.conname = 'transport_routes_round_trip_multiplier_check'
  ) THEN
    ALTER TABLE public.transport_routes
      ADD CONSTRAINT transport_routes_round_trip_multiplier_check
      CHECK (round_trip_multiplier >= 1 AND round_trip_multiplier <= 5);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_pricing_rules') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_pricing_rules
    ADD COLUMN IF NOT EXISTS waiting_fee_per_hour numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deposit_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deposit_mode text NOT NULL DEFAULT 'percent_total',
    ADD COLUMN IF NOT EXISTS deposit_value numeric(12,2) NOT NULL DEFAULT 0;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_pricing_rules') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_pricing_rules'::regclass
      AND c.conname = 'transport_pricing_rules_waiting_fee_per_hour_check'
  ) THEN
    ALTER TABLE public.transport_pricing_rules
      ADD CONSTRAINT transport_pricing_rules_waiting_fee_per_hour_check
      CHECK (waiting_fee_per_hour >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_pricing_rules'::regclass
      AND c.conname = 'transport_pricing_rules_deposit_value_check'
  ) THEN
    ALTER TABLE public.transport_pricing_rules
      ADD CONSTRAINT transport_pricing_rules_deposit_value_check
      CHECK (deposit_value >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_pricing_rules'::regclass
      AND c.conname = 'transport_pricing_rules_deposit_mode_check'
  ) THEN
    ALTER TABLE public.transport_pricing_rules
      ADD CONSTRAINT transport_pricing_rules_deposit_mode_check
      CHECK (deposit_mode IN ('fixed_amount', 'percent_total', 'per_person'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_pricing_rules') IS NULL THEN
    RETURN;
  END IF;

  -- Backfill hourly wait fee from legacy per-minute fee if present.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'transport_pricing_rules'
      AND c.column_name = 'waiting_fee_per_minute'
  ) THEN
    UPDATE public.transport_pricing_rules
    SET waiting_fee_per_hour = round(COALESCE(waiting_fee_per_minute, 0) * 60.0, 2)
    WHERE COALESCE(waiting_fee_per_hour, 0) = 0
      AND COALESCE(waiting_fee_per_minute, 0) > 0;
  END IF;

  UPDATE public.transport_pricing_rules
  SET
    deposit_mode = 'percent_total',
    deposit_value = COALESCE(deposit_value, 0),
    deposit_enabled = COALESCE(deposit_enabled, false)
  WHERE deposit_mode IS NULL
     OR trim(deposit_mode) = '';
END $$;

CREATE INDEX IF NOT EXISTS transport_pricing_rules_deposit_enabled_idx
  ON public.transport_pricing_rules (route_id, deposit_enabled, is_active, priority);
