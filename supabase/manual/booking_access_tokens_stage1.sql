-- Stage 1 booking preview token access.
-- Review only. Do not run until approved.
--
-- Scope:
-- - transport / cars / trips / hotels only
-- - stores token hashes only, never raw tokens
-- - no public SELECT policy; public access goes through the booking-access Edge Function

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pgcrypto'
  ) THEN
    RAISE EXCEPTION 'Required extension pgcrypto is not installed. Install/enable it before running this migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.booking_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type text NOT NULL,
  booking_id uuid NOT NULL,
  booking_reference text,
  customer_email text NOT NULL,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  CONSTRAINT booking_access_tokens_booking_type_check
    CHECK (booking_type IN ('transport','cars','trips','hotels')),
  CONSTRAINT booking_access_tokens_customer_email_not_blank
    CHECK (length(trim(customer_email)) > 0),
  CONSTRAINT booking_access_tokens_token_hash_not_blank
    CHECK (length(trim(token_hash)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_access_tokens_token_hash_uq
  ON public.booking_access_tokens (token_hash);

CREATE INDEX IF NOT EXISTS booking_access_tokens_booking_idx
  ON public.booking_access_tokens (booking_type, booking_id);

CREATE INDEX IF NOT EXISTS booking_access_tokens_customer_email_lower_idx
  ON public.booking_access_tokens ((lower(customer_email)));

CREATE INDEX IF NOT EXISTS booking_access_tokens_active_booking_idx
  ON public.booking_access_tokens (booking_type, booking_id, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.booking_access_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_access_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_access_tokens TO service_role;

DO $$
DECLARE
  token_hash_unique_count integer;
  anon_select_policy_count integer;
  rls_enabled boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'booking_access_tokens';

  IF rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'booking_access_tokens RLS is not enabled';
  END IF;

  SELECT count(*)
    INTO token_hash_unique_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'booking_access_tokens'
    AND indexname = 'booking_access_tokens_token_hash_uq'
    AND indexdef ILIKE '%UNIQUE%';

  IF token_hash_unique_count <> 1 THEN
    RAISE EXCEPTION 'booking_access_tokens token_hash unique index is missing';
  END IF;

  SELECT count(*)
    INTO anon_select_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'booking_access_tokens'
    AND 'anon' = ANY(roles)
    AND cmd IN ('SELECT', 'ALL');

  IF anon_select_policy_count <> 0 THEN
    RAISE EXCEPTION 'booking_access_tokens has anon SELECT/ALL policy; expected none';
  END IF;
END $$;

COMMIT;

