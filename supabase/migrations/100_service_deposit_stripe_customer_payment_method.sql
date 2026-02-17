DO $$
BEGIN
  IF to_regclass('public.service_deposit_requests') IS NOT NULL THEN
    ALTER TABLE public.service_deposit_requests
      ADD COLUMN IF NOT EXISTS stripe_customer_id text,
      ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS service_deposit_requests_stripe_customer_idx
  ON public.service_deposit_requests (stripe_customer_id);

CREATE INDEX IF NOT EXISTS service_deposit_requests_stripe_payment_method_idx
  ON public.service_deposit_requests (stripe_payment_method_id);
