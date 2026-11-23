-- READ-ONLY 114496 preflight. No RPC execution, no writes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='3s';

WITH wanted(signature, expected_sha256) AS (
 VALUES
  ('public.hotel_v2_external_calendar_apply_common_114493(text,jsonb,uuid,uuid,text)',
   '062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52'),
  ('public.hotel_v2_external_calendar_preview_common_114493(text,jsonb)',
   'f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d'),
  ('public.hotel_v2_external_calendar_control_common_114493(text,uuid,uuid)',
   'c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891')
), refs AS (
 SELECT w.signature, p.oid, w.expected_sha256,
   CASE WHEN p.oid IS NULL THEN NULL ELSE
       encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')
   END AS observed_sha256,
   CASE WHEN p.oid IS NULL THEN false ELSE
       pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND
       p.proconfig @> ARRAY['search_path=pg_catalog, public, auth']::text[]
   END AS owner_definer_path
 FROM wanted w LEFT JOIN pg_proc p ON p.oid=to_regprocedure(w.signature)
)
SELECT signature, oid IS NOT NULL AS installed,
  observed_sha256=expected_sha256 AS source_matches_114493,
  owner_definer_path
FROM refs ORDER BY signature;

-- Do not assume 114495 was applied: confirm separately, if needed.
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260811449300','20260811449400','20260811449500','20260811449600')
ORDER BY version;

ROLLBACK;
