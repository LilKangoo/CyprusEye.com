-- REVIEW-ONLY, READ-ONLY PRODUCTION EVIDENCE.
-- No hotel functions are called. No source URL, Vault secret or user info returned.
-- Applies to successor design 114496, NOT to installing it.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';

WITH expected(signature, source_sha256, public_partner_rpc) AS (
  VALUES
    ('public.hotel_v2_external_calendar_control_common_114493(text,uuid,uuid)',
      'c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891', false),
    ('public.hotel_v2_external_calendar_preview_common_114493(text,jsonb)',
      'f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d', false),
    ('public.hotel_v2_external_calendar_apply_common_114493(text,jsonb,uuid,uuid,text)',
      '062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52', false),
    ('public.hotel_v2_partner_preview_external_calendar_plan_114493(jsonb)',
      '019a2ffb9825f781c575dc097746558974dee9859628667215f19b80dcc93b53', true),
    ('public.hotel_v2_partner_apply_external_calendar_plan_114493(jsonb,uuid,uuid,text)',
      '8c5de4e9ad4f05b060538241537e715b1be3f7b9d03f4fc8a30e9e590d244f76', true)
), observed AS (
  SELECT
    e.signature,
    e.public_partner_rpc,
    p.oid,
    p.prosrc,
    p.proowner,
    p.prosecdef,
    p.provolatile,
    p.proconfig
  FROM expected e
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(e.signature)
)
SELECT
  o.signature,
  o.oid IS NOT NULL AS installed,
  COALESCE(
    encode(sha256(convert_to(o.prosrc,'UTF8')), 'hex') = e.source_sha256,
    false
  ) AS source_matches_reviewed,
  COALESCE(
    pg_get_userbyid(o.proowner) = 'postgres'
    AND o.prosecdef
    AND EXISTS (
      SELECT 1
      FROM unnest(o.proconfig) AS c(value)
      WHERE regexp_replace(c.value, '[[:space:]]+', '', 'g')
        = 'search_path=pg_catalog,public,auth'
    )
    AND NOT has_function_privilege('anon',o.oid,'EXECUTE')
    AND NOT has_function_privilege('service_role',o.oid,'EXECUTE')
    AND has_function_privilege('authenticated',o.oid,'EXECUTE')
      = o.public_partner_rpc,
    false
  ) AS access_matches_reviewed
FROM observed o
JOIN expected e USING (signature)
ORDER BY o.signature;

ROLLBACK;
