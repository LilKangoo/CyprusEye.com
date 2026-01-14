DO $$
BEGIN
  IF to_regclass('public.email_settings') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_settings TO authenticated;
  END IF;

  IF to_regclass('public.service_deposit_rules') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_rules TO authenticated;
  END IF;

  IF to_regclass('public.service_deposit_overrides') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_overrides TO authenticated;
  END IF;

  IF to_regclass('public.service_deposit_requests') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_requests TO authenticated;
  END IF;
END $$;
