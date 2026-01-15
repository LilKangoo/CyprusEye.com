DO $$
DECLARE
  q1 text;
  q2 text;
BEGIN

  ALTER TABLE public.service_deposit_rules
    DROP CONSTRAINT IF EXISTS service_deposit_rules_mode_check;

  ALTER TABLE public.service_deposit_overrides
    DROP CONSTRAINT IF EXISTS service_deposit_overrides_mode_check;

  SELECT string_agg(format('ALTER TABLE public.service_deposit_rules DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q1
  FROM pg_constraint c
  WHERE c.conrelid = 'public.service_deposit_rules'::regclass
    AND c.contype = 'c'
    AND c.conname <> 'service_deposit_rules_mode_check'
    AND pg_get_constraintdef(c.oid) ILIKE '%mode%'
    AND pg_get_constraintdef(c.oid) ILIKE '%per_day%';

  IF q1 IS NOT NULL THEN
    EXECUTE q1;
  END IF;

  SELECT string_agg(format('ALTER TABLE public.service_deposit_overrides DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q2
  FROM pg_constraint c
  WHERE c.conrelid = 'public.service_deposit_overrides'::regclass
    AND c.contype = 'c'
    AND c.conname <> 'service_deposit_overrides_mode_check'
    AND pg_get_constraintdef(c.oid) ILIKE '%mode%'
    AND pg_get_constraintdef(c.oid) ILIKE '%per_day%';

  IF q2 IS NOT NULL THEN
    EXECUTE q2;
  END IF;

  ALTER TABLE public.service_deposit_rules
    ADD CONSTRAINT service_deposit_rules_mode_check
    CHECK (mode IN ('per_day','per_hour','per_person','flat','percent_total'));

  ALTER TABLE public.service_deposit_overrides
    ADD CONSTRAINT service_deposit_overrides_mode_check
    CHECK (mode IN ('per_day','per_hour','per_person','flat','percent_total'));
END $$;
