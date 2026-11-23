-- PRICE PARITY ACCEPTANCE / read-only SQL, 2026-11-23.
-- Production baseline for the already-reviewed 7 Kamares pricing contract.
-- The customer UI MUST NOT embed these prices. Quote via the existing 114494 backend.
-- Dates: 2027-04-10 onward; direct checks for 2, 7 and 14 nights.
-- Re-run after any approved price / calendar change, then revise baseline intentionally.
-- quote_core is installed STABLE. This script DOES NOT insert a booking, quote or payment.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';

WITH expected(guests,nights,expected_eur) AS (
 VALUES
 (1,2,200.00),(2,2,200.00),(3,2,260.00),(4,2,310.00),
 (5,2,400.00),(6,2,520.00),(7,2,620.00),(8,2,620.00),
 (1,7,532.00),(2,7,532.00),(3,7,665.00),(4,7,798.00),
 (5,7,1064.00),(6,7,1330.00),(7,7,1596.00),(8,7,1596.00),
 (2,14,980.00),(5,14,1960.00),(8,14,2996.00)
),
scenarios AS (
 SELECT e.guests,e.nights,e.expected_eur,
        CASE WHEN e.guests<=4 THEN r.id ELSE NULL::uuid END AS room_id,
        CASE WHEN e.guests<=4 THEN r.code ELSE 'both-apartments' END AS apartment
 FROM expected e
 LEFT JOIN public.hotel_room_types r
   ON e.guests<=4
  AND r.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  AND r.status='active'
 WHERE e.guests>4 OR r.id IS NOT NULL
),
quotes AS MATERIALIZED (
 SELECT sc.*,
   hotels_public_booking_114494_private.quote_core(
     jsonb_build_object(
       'hotel_id','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
       'arrival_date','2027-04-10',
       'departure_date',('2027-04-10'::date+sc.nights)::text,
       'adults',sc.guests,'child_ages','[]'::jsonb,
       'room_type_id',sc.room_id,'selected_extra_ids','[]'::jsonb
     )
   ) AS quote
 FROM scenarios sc
)
SELECT
 apartment,guests,nights,expected_eur,
 (quote->>'gross')::numeric AS authoritative_eur,
 quote->>'mode' AS booking_mode,
 quote->>'available' AS available_for_test_dates,
 CASE WHEN quote->>'mode'='A'
  AND quote->>'currency'='EUR'
  AND quote->>'available'='true'
  AND (quote->>'due_now')::numeric=0
  AND (quote->>'gross')::numeric=expected_eur
  AND jsonb_array_length(quote->'allocation')=
    CASE WHEN guests<=4 THEN 1 ELSE 2 END
 THEN 'PASS' ELSE 'FAIL' END AS parity
FROM quotes
ORDER BY nights,guests,apartment;

ROLLBACK;
