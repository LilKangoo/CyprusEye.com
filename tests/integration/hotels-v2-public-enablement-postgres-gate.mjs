// Local catalog fixture only: real 114420 RPC bodies, never production.
// All setup and calls roll back. No full forward-chain success is inferred.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const socket = process.env.HOTELS_ENABLEMENT_SOCKET;
const psql = process.env.HOTELS_ENABLEMENT_PSQL;
assert.match(socket || '', /^\/private\/tmp\/hotels-rollout-catalog\.[A-Za-z0-9]+$/);
assert.ok(psql && fs.existsSync(psql));
assert.equal(process.env.HOTELS_ENABLEMENT_PORT, '55491');
const source = fs.readFileSync('supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql', 'utf8');
const names = ['hotel_v2_public_quote_seven_arches', 'hotel_v2_public_create_seven_arches_booking'];
const definitions = names.map(name => {
  const match = source.match(new RegExp(`create function public\\.${name}\\(p_request jsonb\\)[\\s\\S]*?\\$function\\$;`));
  assert.ok(match);
  return match[0].replace('create function', 'create or replace function');
});
const foundation = fs.readFileSync('supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql', 'utf8');
const keysAllowed = foundation.match(/create or replace function public\.hotel_v2_h2a_keys_allowed\([\s\S]*?\$function\$;/);
assert.ok(keysAllowed, 'exact real request-validation dependency required');
const sql = `BEGIN;
SET LOCAL check_function_bodies=off;
${keysAllowed[0]}
CREATE TABLE public.site_settings(id integer PRIMARY KEY, hotel_rooms_v2_enabled boolean,
 hotel_external_sync_enabled boolean);
INSERT INTO public.site_settings VALUES(1,false,true);
${definitions.join('\n')}
GRANT USAGE ON SCHEMA public TO anon,authenticated;
DO $test$
DECLARE role_name text; rpc text; scenario integer; actual_state text; actual_message text;
 blocked integer:=0; downstream integer:=0;
BEGIN
 FOR scenario IN 1..4 LOOP
  IF scenario=2 THEN UPDATE public.site_settings SET hotel_rooms_v2_enabled=null;
  ELSIF scenario=3 THEN DELETE FROM public.site_settings;
  ELSIF scenario=4 THEN INSERT INTO public.site_settings VALUES(1,false,false); END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH rpc IN ARRAY ARRAY['${names.join("','")}'] LOOP
    EXECUTE format('SET LOCAL ROLE %I',role_name);
    BEGIN
     EXECUTE format('SELECT public.%I(null::jsonb)',rpc);
     RAISE EXCEPTION 'gate did not reject';
    EXCEPTION WHEN insufficient_privilege THEN
     GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE,actual_message=MESSAGE_TEXT;
     IF actual_state<>'42501' OR actual_message<>'hotels_v2_public_booking_disabled' THEN
      RAISE EXCEPTION 'wrong rejection: % %',actual_state,actual_message; END IF;
     blocked:=blocked+1;
    END;
    RESET ROLE;
   END LOOP;
  END LOOP;
 END LOOP;
 UPDATE public.site_settings SET hotel_rooms_v2_enabled=true;
 -- No successful booking is attempted: NULL must reach normal request validation.
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH rpc IN ARRAY ARRAY['${names.join("','")}'] LOOP
   EXECUTE format('SET LOCAL ROLE %I',role_name);
   BEGIN
    EXECUTE format('SELECT public.%I(null::jsonb)',rpc);
    RAISE EXCEPTION 'normal request guard did not reject';
   EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS actual_message=MESSAGE_TEXT;
    IF actual_message NOT IN ('hotels_v2_seven_arches_public_quote_invalid',
       'hotels_v2_seven_arches_public_booking_invalid') THEN RAISE; END IF;
    downstream:=downstream+1;
   END;
   RESET ROLE;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.hotel_seven_arches_public_quote_issuances)
 OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_public_booking_receipts)
 OR EXISTS(SELECT 1 FROM public.hotel_seven_arches_public_booking_transaction_context)
 OR EXISTS(SELECT 1 FROM public.hotel_bookings) THEN RAISE EXCEPTION 'unexpected state'; END IF;
 IF blocked<>16 OR downstream<>4 THEN RAISE EXCEPTION 'counts wrong'; END IF;
 RAISE NOTICE 'PUBLIC_ENABLEMENT=PASS blocked=16 downstream_request_validation=4 state_writes=0';
END $test$;
ROLLBACK;
`;
const result = spawnSync(psql, ['-X', '-h', socket, '-p', '55491', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
  input: sql, encoding: 'utf8', env: { PATH: process.env.PATH, LC_ALL: 'C' },
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
assert.equal(result.status, 0);
assert.match(result.stderr, /PUBLIC_ENABLEMENT=PASS blocked=16 downstream_request_validation=4 state_writes=0/);
assert.match(result.stdout, /ROLLBACK/);
