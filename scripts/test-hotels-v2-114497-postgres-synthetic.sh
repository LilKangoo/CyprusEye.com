#!/usr/bin/env bash
set -euo pipefail

# This script tests ONLY the new SQL against synthetic copies of 114494
# signatures in a freshly created, network-isolated PostgreSQL 17.6 container.
# It cannot test production Hotels V2 prices, actual inventory, or real JWT RLS.
[ "${HOTELS_114497_SYNTHETIC_ONLY:-}" = "YES" ] || {
  echo "STOP: set HOTELS_114497_SYNTHETIC_ONLY=YES"
  exit 2
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20260811449700_hotels_v2_public_request_only_partner_accept.sql"
BOOT="$ROOT/tests/integration/hotels-v2-114497-postgres-synthetic-bootstrap.sql"
ASSERT="$ROOT/tests/integration/hotels-v2-114497-postgres-synthetic-assert.sql"
IMAGE="postgres:17.6-alpine"
CTR="hotels-114497-synthetic-${GITHUB_RUN_ID:-local}-$$"

for required in "$MIGRATION" "$BOOT" "$ASSERT"; do
  [ -f "$required" ] || { echo "STOP: missing tracked test file: $required"; exit 2; }
done
docker info >/dev/null
if docker container inspect "$CTR" >/dev/null 2>&1; then
  echo "STOP: generated container name already in use"
  exit 2
fi

started=false
cleanup() {
  if [ "$started" = true ]; then
    docker rm -f "$CTR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "===== HOTELS 114497 / EPHEMERAL POSTGRES CONTRACT ====="
echo "DATABASE=NEW_SYNTHETIC_ONLY"
echo "POSTGRES_IMAGE=$IMAGE"
echo "NETWORK=NONE"
echo "HOST_PORTS=NONE"
echo "PRODUCTION_CONNECTIONS=NONE"

docker pull "$IMAGE" >/dev/null
docker run -d \
  --name "$CTR" \
  --network none \
  --read-only \
  --security-opt no-new-privileges \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=268435456 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16777216 \
  --tmpfs /tmp:rw,nosuid,nodev,size=67108864 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE" >/dev/null
started=true

ready=false
for attempt in $(seq 1 45); do
  if docker exec "$CTR" pg_isready -q -U postgres -d postgres; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = true ] || { echo "STOP: disposable Postgres did not start"; exit 1; }

run_sql() {
  local label="$1" path="$2"
  echo "===== $label ====="
  docker exec -i -u postgres "$CTR" \
    psql -X -v ON_ERROR_STOP=1 -P pager=off -U postgres -d postgres \
    < "$path"
}

run_sql "SYNTHETIC SCHEMA BOOTSTRAP" "$BOOT"
run_sql "EXACT TRACKED 114497 MIGRATION" "$MIGRATION"
run_sql "AUTH, ACL AND A-ONLY ROUTE ASSERTIONS" "$ASSERT"

echo "MIGRATION_COMPILE=PASS"
echo "SYNTHETIC_RLS_AND_ACL=PASS"
echo "SYNTHETIC_A_ONLY_AND_PARTNER_ROUTE=PASS"
echo "REAL_114494_INVENTORY_CONCURRENCY=NOT_TESTED"
echo "PRODUCTION_CHANGES=NONE"
echo "===== POSTGRES CONTRACT TEST COMPLETE ====="
