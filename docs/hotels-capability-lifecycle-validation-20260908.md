# Clean checkpoint validation and evidence boundaries

Baseline: `c439ae465b66184179cf1abc86bc6a4275cc4ca2`.
Branch: `feature/hotels-functional-rollout-clean`.

## Evidence reuse

The complete migration tree and backend/Edge runtime inputs are compared
byte-for-byte against accepted checkpoint ddb49beaacfb8f983e762d28294d5ee273920d45.
No migration, source pin, timeout or backend business behavior is edited here.
The four selected integration tests from its fifth commit are copied exactly.

Where that comparison passes, the earlier full disposable forward chain remains
applicable: 114420 → 114425 → 114450 → 114460 → 114470 → 114480; parity 100/0,
guest-one 20/0, exact allocation, provider-safe/ADMIN-D/Property/payment lineage,
EUR 10 commission, rollback containment and 26 catalog/security negatives before
and after decisions. This is reused local evidence, not a new production proof.

Client files changed because the base changed. Their earlier all-suite counts
are not represented as new clean-checkpoint results. New focused results and
commands are recorded in the checkpoint audit after completion.

## Latency

114480 candidate SHA-256:
`90b7eadeb7486684865a9745b24a4dcb9bfaef8b04f61e1b6b0ddf4814335399`.

Accepted normal local samples in ms:
7796, 6946, 7227, 7052, 6894, 6901, 6909, 6911, 7234.
Worst observed normal time is 7796ms; the function timeout remains 60s.
No timeout change is required. This is local margin evidence, not a production SLA.

The optimization shares repeated STABLE inputs within each invocation only.
The accepted six-body inverse proof restores exact prior source hashes.
The new static check verifies the six-function set and unchanged metadata.
Historical production lock waiting remains unproven.

## Known fixture limitation

The old synthetic full Admin Pricing DTO carries a pre-existing legacy fixture
hash unlike the accepted production pin. The full parser rejects it; no client
pin was weakened. New lifecycle envelopes and real Partner DTOs were validated
previously; production-shaped complete DTOs are covered by focused client/UI
fixtures. Do not represent that limitation as a successful full synthetic DTO parse.

No PG/PostgREST mutation suite is rerun merely to rebase documentation.
