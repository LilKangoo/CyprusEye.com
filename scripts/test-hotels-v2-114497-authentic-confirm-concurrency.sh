#!/usr/bin/env bash
set -euo pipefail

# Requires the user's explicitly selected synthetic-only CI run.
# Uses authentic production 114494 confirm_core/lock_inventory source,
# but all schema/quote_core/customers/inventory constraints are simulated.
[ "${HOTELS_114497_SYNTHETIC_ONLY:-}" = "YES" ] || {
  echo "STOP: synthetic-only test gate not set"; exit 2;
}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOT="$ROOT/tests/integration/hotels-v2-114497-postgres-synthetic-bootstrap.sql"
MIG="$ROOT/supabase/migrations/20260811449700_hotels_v2_public_request_only_partner_accept.sql"
SETUP="$ROOT/tests/integration/hotels-v2-114497-authentic-confirm-setup.sql"
CORE="$ROOT/tests/integration/hotels-v2-114497-authentic-confirm-core-114494.sql"
BEGIN_CORE="$ROOT/tests/integration/hotels-v2-114497-authentic-begin-core-114494.sql"
BEGIN_ACCEPT="$ROOT/tests/integration/hotels-v2-114497-authentic-begin-setup-and-tests.sql"
IMAGE="postgres:17.6-alpine"
CTR="hotel-114497-real-core-${GITHUB_RUN_ID:-local}-$$"
for f in "$BOOT" "$MIG" "$SETUP" "$CORE" "$BEGIN_CORE" "$BEGIN_ACCEPT"; do
  [ -f "$f" ] || { echo "STOP: missing $f"; exit 2; }
done
docker info >/dev/null
if docker container inspect "$CTR" >/dev/null 2>&1; then
  echo "STOP: generated Docker name is not unique";exit 2
fi
TMP="$(mktemp -d)"
started=false
cleanup() {
  if [ "$started" = true ]; then docker rm -f "$CTR" >/dev/null 2>&1 || true;fi
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "===== HOTEL 114497 AUTHENTIC 114494 CORE COMPETITION ====="
echo "PRODUCTION_DATA=NONE"
echo "PRODUCTION_NETWORK=NONE"
echo "SYNTHETIC_PRICE_CORE=YES"
docker pull "$IMAGE" >/dev/null
docker run -d --name "$CTR" --network none --read-only \
  --security-opt no-new-privileges \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=268435456 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16777216 \
  --tmpfs /tmp:rw,nosuid,nodev,size=67108864 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE" >/dev/null
started=true
ready=false
for n in $(seq 1 45);do
  if docker exec "$CTR" pg_isready -q -U postgres -d postgres;then ready=true;break;fi
  sleep 1
done
[ "$ready" = true ] || { echo "STOP: test PostgreSQL not started";exit 1; }

run_sql() {
  local path="$1"
  docker exec -i -u postgres "$CTR" psql -X -v ON_ERROR_STOP=1 \
    -q -P pager=off -U postgres -d postgres < "$path"
}
run_sql "$BOOT"
run_sql "$MIG"
run_sql "$SETUP"
run_sql "$CORE"
echo "AUTHENTIC_SHA_PINNED_114494_CORE=PASS"

# Both sessions attempt Confirm on two distinct mode-A orders for
# identical room/date. Winning request is nondeterministic by design.
run_accept() {
  local order="$1"
  docker exec -i -u postgres "$CTR" \
    psql -X -q -v ON_ERROR_STOP=1 -P pager=off -U postgres -d postgres <<SQL
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
SELECT pg_sleep(0.25);
SELECT public.hotel_v2_partner_accept_request_114497(
  '$order'::uuid,
  '40000000-0000-4000-8000-000000000001'::uuid
);
COMMIT;
SQL
}
run_accept '91111111-1111-4111-8111-111111111111' >"$TMP/first.log" 2>&1 & pid1=$!
run_accept '92222222-2222-4222-8222-222222222222' >"$TMP/second.log" 2>&1 & pid2=$!
result1=0;result2=0
wait "$pid1" || result1=$?
wait "$pid2" || result2=$?

if [ "$result1" -eq 0 ] && [ "$result2" -ne 0 ];then
  echo "FIRST_CONFIRMATION=COMMITTED"
  echo "SECOND_CONFIRMATION=BLOCKED"
elif [ "$result1" -ne 0 ] && [ "$result2" -eq 0 ];then
  echo "FIRST_CONFIRMATION=BLOCKED"
  echo "SECOND_CONFIRMATION=COMMITTED"
else
  echo "STOP: expected one success and one rejected overlap, got $result1/$result2"
  sed -n '1,28p' "$TMP/first.log"
  sed -n '1,28p' "$TMP/second.log"
  exit 1
fi

WIN="$(docker exec -u postgres "$CTR" psql -X -qAt -v ON_ERROR_STOP=1 \
  -U postgres -d postgres -c "
  SELECT
    (SELECT count(*) FROM hotels_public_booking_114494_private.orders
      WHERE status='confirmed')=1
    AND (SELECT count(*) FROM hotels_public_booking_114494_private.orders
      WHERE status='request_pending')=1
    AND (SELECT count(*) FROM public.hotel_bookings
      WHERE status='confirmed')=1
    AND (SELECT count(*) FROM public.hotel_booking_room_allocations)=1
    AND (SELECT count(*) FROM public.hotel_inventory_commitments)=2
    AND (SELECT count(*) FROM public.hotel_inventory_holds)=0
    AND (SELECT count(*) FROM hotels_public_booking_114494_private.orders
      WHERE mode<>'A')=0;
  ")"
if [ "$WIN" != "t" ];then
  echo "STOP: persisted synthetic inventory does not match one approved stay"
  exit 1
fi
echo "COMPETING_SAME_ROOM_APPROVALS=ONE_ONLY_PASS"
echo "AUTHENTIC_LOCK_INVENTORY_AND_CONFIRM_CORE=PASS"
run_sql "$BEGIN_CORE"
echo "AUTHENTIC_SHA_PINNED_114494_BEGIN_CORE=PASS"
run_sql "$BEGIN_ACCEPT"
echo "AUTHENTIC_BEGIN_CORE_IDEMPOTENCY_AND_NO_PAYMENT=PASS"
echo "SIMULATED_CALENDAR_PRICE_AND_CONSTRAINTS=YES"
echo "FULL_REAL_114494_INTEGRATION=NOT_TESTED"
echo "PRODUCTION_CHANGES=NONE"
echo "===== AUTHENTIC CORE TEST COMPLETE ====="
