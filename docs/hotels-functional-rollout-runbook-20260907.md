# Prepared rollout package — NOT execution authorization

**HOLD for checkpoint review and separate production authorization.** The
additive 114480 lifecycle implementation and current validation are documented
in `hotels-capability-lifecycle-validation-20260908.md`. The earlier diagnosis
is retained as historical evidence, not the current feature contract.

The exact dependency order is 114420 → 114425 → 114450 → **114460** → 114470 →
**114480** → separately authorized Edge/configuration verification → explicit
platform capabilities / explicit Admin Partner grants. 114460 must not be
omitted: 114470 uses its private Partner-scoped account/service contract.
Installation,
global Stripe enablement, Partner onboarding permission, account connection,
public booking and instant booking are distinct decisions. Keep Instant false;
no money-routing design or automatic confirmation is inferred.

Production project supplied by user: `daoohnbnnowmmcizgvrq`.
User-reported DB boundary: 114415. The local checkpoint series is on
`feature/hotels-admin-partner-functional-completion`; deployment requires human
review of the checkpoint hashes and separate authorization. Do not push/merge or
deploy this branch from this runbook. Recheck exact release identity at handoff.

## Prerequisites for any later production write

Recovery point supplied and manually confirmed by the user on 08 Sep 2026:
**08 Sep 2026 05:38:06 UTC — COMPLETED — Restore available**.
`POST_114415_RECOVERY_POINT_CONFIRMED=YES` and
`RECOVERY_POINT_EXTERNAL_GATE=PASS`. This is user confirmation, not a database
query by this task, and is not production-write authorization. Reconfirm its
continued applicability immediately before each separately authorized phase.

1. Require the final local lifecycle validation report and immutable-receipt
   safety proof. Public booking is a separate blocked future stage; no new
   customer booking is authorized by completing this lifecycle release.
2. Review/checkpoint only approved scoped changes. Preserve the unrelated owner
   preflight; never execute its dirty primary-worktree content.
3. Obtain explicit authorization for each production phase and a current,
   user-confirmed post-114415 recovery point. No old backup date is inferred.
4. Use the clean accepted checkout, verify remote/local commit and linked project.
5. Run the stage's read-only prewrite and immediate gate; require every leaf,
   expected history, no blocking locks/jobs/leases and all source hashes exact.
6. A failed SQL transaction, inconsistent source, unexpected history or ambiguous
   client response means STOP, not repair/retry. No automatic rollback migration.

## Exact existing artifacts (rehashed locally; none executed in production)

All paths below are under `/private/tmp/`. SHA-256 and lines:

| File | SHA-256 | Lines |
|---|---|---:|
| hotels_v2_114420_prod_prewrite_readonly.sql | 40951c1f46662b15761d6cacd57a1c885f0d75eb7329089b74b9acb6abc6d876 | 419 |
| hotels_v2_114420_final_preaction_readonly.sql | c745bc6627df5d76a2497a3a410b5e91067652641555d357b3b6717e35685c1f | 111 |
| hotels_v2_prod_114420.sql | a047bf49ec88d24684139f2e831dd831de90e86ca53eded0405f5684d80082c4 | 1299 |
| hotels_v2_114420_prod_postinstall_readonly.sql | 011f49e53a0aead8e53a79e3ace87df2f4d470526ea95ce97e8011d7a34906fb | 729 |
| hotels_v2_114425_prod_prewrite_readonly.sql | 4f689ecc33d7417f7fb020a8b5d5b63702835a85f15f754ad16a8345cebd3e44 | 735 |
| hotels_v2_114425_final_preaction_readonly.sql | 2e87b5804917c5d370edefa976f15c0f83f6bcf663153a7dfb4b386ed83ebaae | 82 |
| hotels_v2_prod_114425.sql | d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5 | 306 |
| hotels_v2_114425_prod_postinstall_readonly.sql | aea376255afe3a521105a6660e4d5acd164fcfa0a5848e3fd53e8cad2b6a6018 | 736 |
| hotels_v2_114450_prod_prewrite_readonly.sql | 1a4c19eb72c5df3ad7f8ad97728ad13b979d30353c50fe18c26737394bc7ffdb | 962 |
| hotels_v2_114450_final_preaction_readonly.sql | db208c6a30f79c9c150fddb7fb52eed5b555346221487b237c64a0ba3270de89 | 96 |
| hotels_v2_prod_114450.sql | b679b8f65200d345ce154ef99343f1488dbb93394b65dab9fbf1d17c16688c84 | 3016 |
| hotels_v2_114450_prod_postinstall_readonly.sql | 9f5f092e9a7dc489cd21db4fa6debc084c8c1dac0ece5ee36d6a74821b6da4ec | 1256 |
| hotels_v2_external_calendar_postdeploy_readonly.sql | bec79dff2b6eafc5b23f28b90dc131c4bdea6f38b61ef32aceb36e16e1ce9886 | 1257 |
| hotels_v2_external_calendar_deployment_plan.md | 154ce8809d61d9f01faef26667672af4574ba7ba04bd4e7bc81f3450edfef834 | 62 |

The three `hotels_v2_prod_<version>.sql` files match the corresponding committed
repository migrations. Do not regenerate or concatenate later stages silently.
Old comments identifying preparation commits are provenance, not permission to
skip current hash/history/security checks. Rehash these ephemeral files at use.

## Later staged order — commands prepared, NOT run

For each of 114420, 114425 and 114450 separately:

1. Read-only migration ledger, exact prewrite, immediate gate and current recovery
   confirmation. Do not install if any required predicate fails.
2. SQL Editor → New query in the exact project. Paste only that exact migration
   file; keep its committed transaction wrapper. Run once.
3. Require atomic COMMIT/embedded checks. On error preserve SQLSTATE/SQLERRM and
   stop; never mark a failed migration applied.
4. Only after explicit reconciliation authorization, record that one version and
   inspect history. Prepared commands, one stage at a time:

```sh
supabase migration repair 20260811442000 --status applied --linked
supabase migration list --linked
# STOP for exact history and 114420 postinstall verification / allowed Partner smoke.
supabase migration repair 20260811442500 --status applied --linked
supabase migration list --linked
# STOP for exact history and 114425 postinstall verification.
supabase migration repair 20260811445000 --status applied --linked
supabase migration list --linked
```

5. Execute only the matching postinstall read-only verifier; require exact
   source/ACL/topology/lineage/parity/payment/commission. Do not continue on a
   false leaf. Partner pricing Get is a read; Partner Submit and Admin pricing
   Preview/Apply are writes requiring their own authorization.
6. Installation does not authorize public booking, enable flags, create a
   provider source, set an iCal URL or trigger a sync.

## Calendar Edge package — separate later authorization

Follow the existing exact source manifest in the deployment plan above.
Prepared command only:

```sh
supabase functions deploy hotels-v2-external-calendar-sync --project-ref daoohnbnnowmmcizgvrq --no-verify-jwt
```

Require source identity and terminal deployment success, a non-POST 405 health
check and the exact read-only postdeploy verifier. Do not trigger a sync as a
health check; even a worker call without scheduled enqueue can mutate jobs and
leases. URLs/Vault values remain private. No Edge command was run in this task.

## New Stripe package — optional future stage, separate approval required

| Repository file | SHA-256 | Lines |
|---|---|---:|
| supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql | 1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14 | 248 |
| supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql | a0be7418a204c19d7f1cdce69a6107299005a8b497b07fc3f9ef7378120938cc | 9 |
| supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql | 68045435854818d326f8ba4be2ce56a89c6842598f0549ac1db06e5150301fb0 | 28 |

Prewrite requires exact safe 114450 boundary, absent new schema/RPC and Stripe
false. Install adds no account/business rows or flags. Postinstall requires all
security leaves true, account/state/event counts zero and Stripe false. The
operator must compare source hashes against the accepted reviewed checkpoint;
use the final checkpoint manifest, not a historical WIP hash. No production SQL Editor copy or
history repair was performed for 114460.

Only after separate migration and Edge release approval, the connection function
package is `supabase/functions/hotels-stripe-connect/`. Its webhook route is
`/functions/v1/hotels-stripe-connect/webhook`. The gateway JWT check must be
disabled for signed Stripe deliveries; the function itself verifies signatures
and separately verifies browser authentication with `auth.getUser()`.

Prepared command only, not permission to deploy:

```sh
supabase functions deploy hotels-stripe-connect --project-ref daoohnbnnowmmcizgvrq --no-verify-jwt
```

Required future configuration names (no values requested/stored here):

- `HOTELS_CONNECT_ORIGIN`: one approved HTTPS CyprusEye frontend origin.
- `STRIPE_CONNECT_CLIENT_ID`: Standard OAuth client ID for the platform.
- `HOTELS_CONNECT_MODE`: exactly `test` or `live`; separate environments.
- `STRIPE_SECRET_KEY`: operator-managed platform key for the chosen mode.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: separate Connect endpoint signing secret.
- Standard Supabase URL/service-role environment, never exposed to the browser.

Configure exact callback `<approved-origin>/partners/stripe-connect-return.html`
in Stripe. Subscribe the signed Connect endpoint to `account.updated` and
`account.application.deauthorized`; do not reuse the deposit webhook secret.
Confirm the platform permits Standard OAuth. Publish/activate the callback's
PWA cache exclusion and no-store/no-referrer headers before any connection.

**Keep `hotel_stripe_connect_enabled=false` during installation.** After 114480,
the authenticated Admin-only `verify_platform_configuration` Edge action can
attest server configuration readiness for 15 minutes. It checks configured
origin/client/mode/key formats, not account connection or money routing. It
does not contact Stripe, grant permission or enable a flag. Actual credentials,
callback/webhook registration and live/test environment remain a separately
authorized operator configuration responsibility. `SUPABASE_ANON_KEY` is also
required by the Edge action to verify Admin access using the caller's JWT.
Then the Admin Hotels global lifecycle card offers a separate reason + explicit
confirmation. It fetches a fresh version and makes one decision RPC; inspect
state after an ambiguous response, never automatically retry. The Partner
account is shared across its Hotels, but every use rechecks Hotel authorization.
No payment routing/split settlement/payout model is implied by connecting it.

## New booking and final human smoke

Intentionally blocked by the 114480 public-release contract, NOT an unresolved
Rooms/Stripe enablement defect. Rooms now means backend capability and cannot
publish the booking API. Both public quote and booking writers additionally
require `hotels_lifecycle_private.public_booking_enabled()`, which returns false
under this installed lifecycle. Instant also remains false. There is no enabled
public-release transition in this batch; its controller rejects missing
prerequisites. A separately approved additive public-release contract must
precede these future steps:

1. Authorize exact public lifecycle activation explicitly; don't infer it from
   database infrastructure installation.
2. Create one specifically authorized NEW controlled booking using the public
   server quote/booking contract, never direct DML.
3. Verify Admin and correct Hotel Partner visibility, room allocation, EUR 10
   per allocated Room/night commission and unchanged authoritative payment terms.
4. Verify absence from another Hotel/Partner and correct new booking/payment
   binding; no historical backfill or real price change is part of this smoke.
5. Run final allowed Admin/Partner browser checks including mobile EN/PL/HE.
   A failed or ambiguous mutation ends the phase; never automatically retry.

Booking history/backfill remains DEFERRED. Production remains unmodified by this
preparation. The next safe action is the scoped checkpoint audit, not executing
this runbook or enabling a flag.

## 114470 / 114480 exact stage handoff

For each stage separately: clean accepted release → current user-confirmed
recovery point → linked history/object/maintenance read-only audit → matching
prewrite file → one separately authorized atomic installation → separately
authorized history repair → matching postinstall file. Never mark failed SQL
applied or reuse an old manual wrapper. All new manual files start BEGIN, set
READ ONLY, emit one result row and end ROLLBACK; hashes/line counts are in the
validation report. Postinstall is installation-only and expects zero decisions.

114470 grants nothing at install. Its explicit grant/revoke is per Partner,
versioned and audited, and may happen independently of global Stripe. 114480
enables nothing at install. Rooms and Stripe allow audited enable/disable;
External keeps its existing source/worker lifecycle and current boolean; Instant
and Public show precise unavailable prerequisites. Account connection requires
platform Stripe + Partner permission + authorized owner/Hotel relationship.
Disabling capability or revoking permission does not delete a connected account.

The Admin global decision RPC retains statement_timeout=60s. The 46–57s BEFORE
measurements were remediated by sharing identical STABLE validator inputs within
each invocation, without removing any condition or caching across BEFORE/AFTER.
Normal local RPC decisions now take 6.89–7.80s; see the checkpoint audit for all
samples and limitations. Global database/role timeouts are unchanged; the ordinary
RPC control still cancels at 8s. No lock timeout
override is added to that function. Use an empty maintenance window, and stop on
contention, timeout or ambiguous response rather than retrying automatically.
