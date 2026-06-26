-- Verify booking_access_tokens after manual migration.

SELECT
  to_regclass('public.booking_access_tokens') IS NOT NULL AS table_exists;

SELECT
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'booking_access_tokens';

SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'booking_access_tokens'
ORDER BY policyname;

SELECT
  count(*) FILTER (
    WHERE 'anon' = ANY(roles)
      AND cmd IN ('SELECT', 'ALL')
  ) AS anon_select_policy_count,
  count(*) FILTER (
    WHERE 'authenticated' = ANY(roles)
      AND cmd IN ('SELECT', 'ALL')
  ) AS authenticated_select_policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'booking_access_tokens';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'booking_access_tokens'
ORDER BY indexname;

SELECT
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'booking_access_tokens'
      AND indexname = 'booking_access_tokens_token_hash_uq'
      AND indexdef ILIKE '%UNIQUE%'
  ) AS token_hash_unique_exists;

SELECT
  count(*) AS token_rows,
  count(*) FILTER (WHERE revoked_at IS NULL) AS active_token_rows,
  count(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= now()) AS expired_token_rows
FROM public.booking_access_tokens;

