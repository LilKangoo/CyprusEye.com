-- =====================================================
-- Transport: base deposit floor for MAX(default transport, route rule)
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.transport_pricing_rules') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_pricing_rules
    ADD COLUMN IF NOT EXISTS deposit_base_floor numeric(12,2) NOT NULL DEFAULT 0;
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
      AND c.conname = 'transport_pricing_rules_deposit_base_floor_check'
  ) THEN
    ALTER TABLE public.transport_pricing_rules
      ADD CONSTRAINT transport_pricing_rules_deposit_base_floor_check
      CHECK (deposit_base_floor >= 0);
  END IF;
END $$;

DO $$
DECLARE
  base_floor_value numeric(12,2) := 0;
BEGIN
  IF to_regclass('public.transport_pricing_rules') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.service_deposit_rules') IS NOT NULL THEN
    SELECT CASE
      WHEN COALESCE(enabled, false) = true
       AND lower(trim(COALESCE(mode, ''))) = 'flat'
       AND COALESCE(amount, 0) > 0
      THEN round(COALESCE(amount, 0)::numeric, 2)
      ELSE 0
    END
    INTO base_floor_value
    FROM public.service_deposit_rules
    WHERE resource_type = 'transport'
    LIMIT 1;
  END IF;

  base_floor_value := GREATEST(COALESCE(base_floor_value, 0), 0);

  UPDATE public.transport_pricing_rules
  SET deposit_base_floor = base_floor_value;
END $$;

CREATE INDEX IF NOT EXISTS transport_pricing_rules_deposit_base_floor_idx
  ON public.transport_pricing_rules (route_id, deposit_base_floor, is_active, priority);
