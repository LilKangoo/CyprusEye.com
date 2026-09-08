# Hotels lifecycle checkpoint and latency safety audit — 08 Sep 2026

Repository/local-only review, baseline `bd382df5695e8e9dbcedcaeb2dad226377be28f6`,
branch `feature/hotels-admin-partner-functional-completion`.
No production access, SQL, migration repair, live Stripe, push, merge or deployment.
User-confirmed recovery point: **08 Sep 2026 05:38:06 UTC, COMPLETED, Restore available**.
`POST_114415_RECOVERY_POINT_CONFIRMED=YES`; not authorization for a production write.

## Result and remaining boundaries

Local checkpoint gates PASS: scope, latency, complete fresh forward chain,
UI matrix, security, historical migrations and excluded owner-file preservation.
The package is ready for human checkpoint review and separately authorized,
stage-by-stage rollout preparation. It does not authorize enabling public booking,
Instant Booking, live Stripe configuration, real money routing or a customer booking.
The real local Admin pricing DTO still carries a pre-existing synthetic legacy
fixture hash different from the accepted production pin; the complete parser
correctly rejects it. Its new lifecycle envelope and real Partner DTO validate
with source/dist clients. Accepted production-shaped full DTOs pass Jest/E2E;
no client production pin was weakened to accommodate that fixture.

## 114460 explicit source audit

`supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql`
adds a Partner-scoped Standard OAuth account/state/event persistence boundary.
It depends on the exact protected 114450 provider-safe function and existing
Partner/Hotel membership, assignment and permission contracts. 114470 then
evolves the original per-assignment onboarding check into audited Partner grants.
One account is unique per Partner; account identity is verified through the
server OAuth flow, not supplied by the browser. No Express account creation or
charges/transfers/split settlement/commission computation exists in this package.

Install-time business mutation=NO; auto-enable flags=NO. Private schema and
three tables deny raw PUBLIC/anon/authenticated/service-role access; tables use
RLS + FORCE RLS, with no browser policies. PostgreSQL-owned SECURITY DEFINER
helpers use protected search paths. Only the persistence RPC grants service-role
EXECUTE; browser identity is verified by Edge auth.getUser and every scoped use
checks Partner ownership plus Hotel assignment and the two independent gates.
OAuth state is high-entropy, actor-bound, expiring, atomically claimed once;
account replacement is rejected, webhook reconciliation is signed/deduplicated,
revision conflicts fail closed and revocation is sticky. No OAuth access/refresh
token is stored or returned. Account IDs are not returned by the browser-facing
service. Callback pages are no-store/no-referrer and excluded from PWA caching.
Security audit=PASS, with offline/mock and real local service persistence tests.

## Exact latency diagnosis

The original 57,066ms sample was **Stripe platform enable, version 1 → 2** via
`public.hotel_v2_admin_set_capability_lifecycle(text,boolean,bigint,uuid,text,text)`.
It was a normal sequential decision, not the concurrent Rooms race. Other prior
normal transitions were 47,153ms and 46,052ms. No artificial delay was present.

The dominant phases are the repeated protected BEFORE and AFTER validations.
One baseline provider-safe call executed payment lineage 187 times, catalog seal
608 times, allocation preview 380 times and reviewed oracle 209 times. The same
ADMIN-D snapshot appeared three times in the outer SQL predicate; its nested
PL/pgSQL expressions repeated the same provider bridge and receipt validators.
This is repeated evaluation of overlapping validation graphs, not one large
business update, pg_net/Stripe HTTP, Vault network work or an 8s timeout exception.

An instrumented **disposable-only copy**, with its DDL and transition rolled back,
reproduced Stripe enable on the unchanged baseline fixture. It did not modify the
original function. Total ~44.27s on this run (not a claim to reproduce exactly
57.066s under identical host scheduling). Breakdown in milliseconds:

| Phase | Baseline Stripe enable | Optimized Rooms transition |
|---|---:|---:|
| Input/Admin authorization | 0.992 | 0.690 |
| Advisory + settings row locks | 0.093 | 0.103 |
| Current-state/prerequisite checks | 31.281 | 35.568 |
| Protected BEFORE checks | 21881.086 | 3571.827 |
| Decision/flag/context writes and cleanup | 1.586 | 1.105 |
| Protected AFTER + safe-state check | 22341.850 | 3383.365 |
| Result construction | 9.609 | 8.641 |

The original 57.066s request had no contemporaneous lock snapshot; historical
lock contribution cannot be retrospectively excluded. The reproduced baseline
shows negligible lock acquisition. Six new sequential RPC samples observed zero
PostgREST Lock wait samples at 500ms polling (not proof no sub-500ms wait existed).

## Optimization and integrity proof

Only undeployed 114480 changes. Six of its already-bound 31 STABLE validators
share identical zero-argument STABLE/IMMUTABLE inputs. SQL uses MATERIALIZED CTEs;
PL/pgSQL uses invocation-local constants. The existing stable invocation snapshot
is retained. No cache table, caller-set GUC, cross-request cache, cross-transaction
reuse, or BEFORE-to-AFTER reuse was added. No predicate, lock, source/metadata
assertion, receipt check, equality, parity or authorization is removed.
Early evaluation of a read-only input may reject an invalid state earlier; it
does not authorize a state previously rejected. Mutation functions remain untouched.
The six installed bodies are reversibly reconstructed byte-for-byte to their
accepted prior source hashes by the dedicated regression gate.

| Already-bound function | Before optimization source SHA | After source SHA |
|---|---|---|
| task2_stage2_canonical_snapshot | 845fb884c65e4f7032a842b65f72e51781dc735752f0a7187089b0d738598fe7 | 6e53ef01e748a54cb1dbbae5d35010a343aa4331a0c5450a4d2fc967a1e253fd |
| task2_stage2_compatibility_is_exact | 13189dd3da497e5b7b2ecbbf19adbf17768dbeaa0652f1bcfc6de61d2bee4ae7 | 17b801fefd47c93859f1e7868b606d3d56288dd590f931aa4c385148a72d85cc |
| independent_pricing_activation_lineage | ab261970543cec2947000ead306dd76a1fde664b3b9965bedee838dcd01635f1 | 2c40bc68f2d7dd54bb50654d0ca3e5a528509964377fc57e460718e7baa82fd9 |
| reviewed_pricing_receipt_chain_is_exact | edb12f7c33b4baf5d7c220e5a82066ab011987feddfc5a84c038df7421fa1d0e | 2b2be7bc649fd8c152a5c07e1f2aef62d8ec837d29d77adfd78ff4603e794a07 |
| admin_d_current_foundation_snapshot | 926d2ebcd38d3de0fc704f84a68d64115464021a17207d2b086d581d62e812d8 | 19a0f835c9baeee68bc35614424ac92022aa087d9c760f7b9f2fe9068be18218 |
| external_calendar_provider_evolution_is_safe | 02a87de27c33ea05b373692e9a48119972ffe66568ce80e0a62230f4fa7d6916 | 04cedf05665423bd1f01dc28aefe9be7e59ae34688601bcee759b57cc099c5a3 |

All six preserve PostgreSQL owner, language, STABLE, SECURITY DEFINER, protected
search_path and exact ACL metadata. Manifest BEFORE pins and historical source
evidence are unchanged; only six directly affected AFTER pins rotate. The seal
still validates actual evolved sources and metadata before predecessor projection.
One optimized provider-safe query passed at 3514.230ms: payment checks 31,
allocation previews 64, reviewed oracle 37; no validation result is fabricated.

## Performance safety results

Real loopback PostgREST 12.2.12 / PostgreSQL 16.13, real local Vault/pg_net fixture:

- Concurrent Rooms enable: winner 6971ms; stale loser 7004ms; exactly one receipt.
- Normal Stripe enable 7796ms; Rooms disable 6946ms; Stripe disable 7227ms.
- Six additional sequential normal decisions: 7052, 6894, 6901, 6909, 6911, 7234ms.
- Worst of nine normal samples / empirical nearest-rank P95: **7796ms**.
- Local safety budget 20000ms: PASS; measured margin to 60000ms ceiling: 52204ms.
- These synthetic host measurements are not a production P95/SLA guarantee.
- Timeout change required=NO; timeout change=NONE. Existing function 60s remains.
- Ordinary unexempted authenticated RPC still canceled with 57014 at **8029ms**;
  global database/role settings unchanged. No new persisted lock_timeout override.

## Fresh validation matrix

- Fresh clone through 114415, then uninterrupted 114420 → 114425 → 114450 →
  114460 → 114470 → optimized 114480, including manual pre/post gates: PASS.
- Original receipt hashes unchanged, installation decision/account counts zero,
  external=true and Rooms/Stripe/Instant=false: PASS.
- Real RPC matrix: 24 negatives, one-winner concurrency, replay/conflict handling,
  separate Partner grant and server-only synthetic connected account: PASS.
- Catalog/ACL/security/direct-flag negatives 26/26 before decisions and 26/26
  after ten decisions, each fully rolled back; no context leak: PASS.
- Six exact predicate-source reconstructions and one static optimization test: PASS.
- Rooms ON/public OFF, Stripe ON/public OFF, permission independent of global
  Stripe in both directions; unsupported public/Instant/External decisions deny: PASS.
- Public quote and booking fail closed; prices/payment/EUR10 commission/old
  Partner permission preset/11 historical receipts byte-hash unchanged: PASS.
- Final reviewed parity 100/0, guest-one 20/0, allocation exact, provider-safe,
  Property/payment lineage, ADMIN-D original receipt and audit chain: PASS.
- Jest 80/80 across six suites; E2E 108/108 across four suites: PASS.
- Admin/Partner six lifecycle combinations, connected fixture and permission
  denial, fresh Get/explicit decision, no automatic retry and no pricing mutation: PASS.
- Stripe offline 31/31; actual Stripe SDK signature validation cached/offline 1/1: PASS.
- Real lifecycle/Partner source+dist DTO parsers 6/6, three reads, zero writes: PASS,
  with the pre-existing full pricing fixture pin limitation documented above.
- Build and ten source/dist mirror checks: PASS. No live Stripe request.
- Historical 238 tracked migrations match baseline bytes, including 114420,
  114425 and 114450. Protected PID40407 remained alive on port55463.

## Reproduction commands (LOCAL ONLY)

Fresh database: clone `hotels_functional_chain3` on 127.0.0.1:55479 into
`hotels_functional_global_latency_20260908`; use the existing isolated PG16 runtime.
Execute `tests/integration/hotels-v2-capability-lifecycle-forward-postgres-gate.sql`
with psql `-X -v ON_ERROR_STOP=1`. Start loopback PostgREST on53079 with synthetic
fixture JWT material in memory and connection `statement_timeout=8000`.
Set `HOTELS_LIFECYCLE_TEST_DATABASE` and `HOTELS_CONNECT_TEST_PSQL` to the above
isolated DB/runtime, then run the lifecycle `postgrest-gate.mjs`,
`latency-postgrest-gate.mjs`, `timeout-postgrest-gate.mjs`,
`client-postgrest-gate.mjs`, and security SQL before/after. No production URL is
accepted by these new gates. The fresh fixture is retained for local review;
task-owned PostgREST and rollback-only profiling functions are cleaned up.

## Deployment manifest and scope

The following generated manifest is an exact repository-path inventory, not
permission to execute its contents. Every manual pre/post file uses BEGIN /
READ ONLY / one result row / ROLLBACK. Final-preaction for 460/470/480 is not yet
a separate file: exact linked history, object/maintenance state and backup must
be freshly checked at the separately authorized stage. Do not invent current
production results from these local files. Existing 420/425/450 wrappers remain
in the runbook and must be rehashed when used.


Files changed (tracked): 21; untracked: 41; scoped to commit: 60.
Excluded: owner preflight (UNRELATED) and generated deno.lock (TEMP_ARTIFACT).
UNRELATED_FILES=0 inside the scoped checkpoint. No local DB/log/env/token artifact is included.
The deno.lock is left untouched and excluded; it was generated by the preceding offline SDK test.
Owner SHA dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62;
owner binary diff SHA ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54.

| Migration path | SHA-256 | Lines |
|---|---|---:|
| supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql | 1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14 | 248 |
| supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | 7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0 | 265 |
| supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql | 90b7eadeb7486684865a9745b24a4dcb9bfaef8b04f61e1b6b0ddf4814335399 | 416 |

| Read-only manual path | SHA-256 | Lines | Result rows |
|---|---|---:|---:|
| supabase/manual/hotels_v2_capability_lifecycle_postinstall_readonly.sql | 223a2cf62272d8876abe9d61538bcfb93c7dc1b50a8577a3288e761fb37acdc7 | 21 | 1 |
| supabase/manual/hotels_v2_capability_lifecycle_prewrite_readonly.sql | fe8192e10977fbd8bcf3006eb5665762444636c1a90bf9800ed842c0acaa5044 | 17 | 1 |
| supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql | 5f0b51adc88261428b2f859648b359e38a8ba729bc76e7f8eae350b76433cb50 | 72 | 1 |
| supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | 2aace5cfa94917d6fdecbd41693b51a0307550aea600bef8c390940158eea387 | 29 | 1 |
| supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql | 68045435854818d326f8ba4be2ce56a89c6842598f0549ac1db06e5150301fb0 | 28 | 1 |
| supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql | a0be7418a204c19d7f1cdce69a6107299005a8b497b07fc3f9ef7378120938cc | 9 | 1 |

| Path | State | Classification | Include | SHA-256 |
|---|---|---|---|---|
| _headers | M | STRIPE_CONNECT_RUNTIME | YES | c3185a386852ef40cd751d6bf94e20f2796a39bcba8db8c36ad97fe31b41fce7 |
| admin/hotels-v2-workspace-core.js | M | ADMIN_UI | YES | 96b533782488442ed8f2f48c34c5b199ae53d8df532f46443e6cd8b4b1c1d95d |
| admin/hotels-v2-workspace-repository.js | M | ADMIN_UI | YES | b87c36fb7c74ef048a669d7b7fe6addad797df31717d34cd58624cf7c8c4d918 |
| admin/hotels-v2-workspace.js | M | ADMIN_UI | YES | 17a19a0bea38fff5a2e21009f37be6211d6e9320691c8a3206686c3c4ab52dfd |
| deno.lock | A | TEMP_ARTIFACT | NO | 18c7e086cb03ff28dee642db1b1d1bb673e3444c195db35eeb3c8707a503e715 |
| dist/_headers | M | STRIPE_CONNECT_RUNTIME | YES | c3185a386852ef40cd751d6bf94e20f2796a39bcba8db8c36ad97fe31b41fce7 |
| dist/admin/hotels-v2-workspace-core.js | M | ADMIN_UI | YES | 65c06325f44a4095cd294227a9f6e7d3160e3a6a495ca421171d18aaba0b6f8d |
| dist/admin/hotels-v2-workspace-repository.js | M | ADMIN_UI | YES | a8ef1ae770c43c21bd4e4316b7fea91cd87a414847b68b375ff445a45aa02a4d |
| dist/admin/hotels-v2-workspace.js | M | ADMIN_UI | YES | 72b0d849a640a40cf56eec0b043b6168fec06dae20b222a6583f6b0a5046ca24 |
| dist/js/hotels-stripe-connect-page.js | A | STRIPE_CONNECT_RUNTIME | YES | 2548bf26ec274323c44586c990ac8bc21ad9edf70bf0d8f0b6dad4e049cc658a |
| dist/js/hotels-v2-partner-workspace-core.js | M | PARTNER_UI | YES | 7ad9f38e744cf72e947d2f8b44e667be46ba269f063b792fcae734281f832aaf |
| dist/js/hotels-v2-partner-workspace.js | M | PARTNER_UI | YES | 299b53d0965f7095eb10868d2ce84325548ce1e97a4c9d6b7f10fe71af022c13 |
| dist/partners/stripe-connect-return.html | A | STRIPE_CONNECT_RUNTIME | YES | 9593e26697c00f048f98808a5e733ec6da48ebf0c6cbbea60d83b5e207625045 |
| dist/partners/stripe-connect.html | A | STRIPE_CONNECT_RUNTIME | YES | 3ef7b5aeada59a35614492da20c9ce56753da39516affd466cabc25dd193c50d |
| dist/partners/sw.js | M | STRIPE_CONNECT_RUNTIME | YES | 9038d1145a7345d6d94b1c20a43530c22bed8d89cc4a876e6b5a873ae22112a4 |
| docs/hotels-activation-lifecycle-remediation-20260907.md | A | DOC | YES | ec989eaf6f2dea533ee0643d328277f3698876a49fbd33ea20d0ed01e3a53de1 |
| docs/hotels-admin-partner-functional-completion.md | M | DOC | YES | 020a8978a04adc0696803ca61d09ce385d59aa8e6abe00c9075200c527d78fab |
| docs/hotels-capability-lifecycle-validation-20260908.md | A | DOC | YES | 12ddc626dba522285b6d1782fb51dbf5eb3f54f1ed90aa617f61eb03c3568999 |
| docs/hotels-functional-completion-20260907.md | A | DOC | YES | 301b5f4a43e07680a074c41a66ac45e3a63a801a18fdd99b1298ca387fc3934d |
| docs/hotels-functional-rollout-runbook-20260907.md | A | RUNBOOK | YES | 3f2bf4879c3dcd4e5bb1d2bf32c57311f57c21d6e92432f3890265e4b944fd51 |
| docs/hotels-lifecycle-checkpoint-audit-20260908.md | A | DOC | YES | Self: use Git blob/commit identity, no recursive hash |
| js/hotels-stripe-connect-page.js | A | STRIPE_CONNECT_RUNTIME | YES | 2548bf26ec274323c44586c990ac8bc21ad9edf70bf0d8f0b6dad4e049cc658a |
| js/hotels-v2-partner-workspace-core.js | M | PARTNER_UI | YES | 7ad9f38e744cf72e947d2f8b44e667be46ba269f063b792fcae734281f832aaf |
| js/hotels-v2-partner-workspace.js | M | PARTNER_UI | YES | 299b53d0965f7095eb10868d2ce84325548ce1e97a4c9d6b7f10fe71af022c13 |
| partners/stripe-connect-return.html | A | STRIPE_CONNECT_RUNTIME | YES | 9593e26697c00f048f98808a5e733ec6da48ebf0c6cbbea60d83b5e207625045 |
| partners/stripe-connect.html | A | STRIPE_CONNECT_RUNTIME | YES | 3ef7b5aeada59a35614492da20c9ce56753da39516affd466cabc25dd193c50d |
| partners/sw.js | M | STRIPE_CONNECT_RUNTIME | YES | 5b1346f7856501fcfbe529fabdd9ee102dda7af92c6e9b9d05d963129ce86a95 |
| supabase/functions/hotels-stripe-connect/index.ts | A | STRIPE_CONNECT_RUNTIME | YES | 1c90f5732a67a7cf2d02c20ed440d20979f0822109bcf5a50ddbda18e7817164 |
| supabase/functions/hotels-stripe-connect/service.mjs | A | STRIPE_CONNECT_RUNTIME | YES | 371463ef538ce57e2ea590b8567f938d06135e4ed04a101b924dba05b755b7ed |
| supabase/manual/hotels_v2_capability_lifecycle_postinstall_readonly.sql | A | VERIFIER | YES | 223a2cf62272d8876abe9d61538bcfb93c7dc1b50a8577a3288e761fb37acdc7 |
| supabase/manual/hotels_v2_capability_lifecycle_prewrite_readonly.sql | A | VERIFIER | YES | fe8192e10977fbd8bcf3006eb5665762444636c1a90bf9800ed842c0acaa5044 |
| supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql | A | VERIFIER | YES | 5f0b51adc88261428b2f859648b359e38a8ba729bc76e7f8eae350b76433cb50 |
| supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | A | VERIFIER | YES | 2aace5cfa94917d6fdecbd41693b51a0307550aea600bef8c390940158eea387 |
| supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql | A | VERIFIER | YES | 68045435854818d326f8ba4be2ce56a89c6842598f0549ac1db06e5150301fb0 |
| supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql | A | VERIFIER | YES | a0be7418a204c19d7f1cdce69a6107299005a8b497b07fc3f9ef7378120938cc |
| supabase/manual/hotels_v2_seven_arches_owner_operational_capabilities_preflight.sql | M | UNRELATED | NO | dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62 |
| supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql | A | STRIPE_CONNECT_SCHEMA | YES | 1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14 |
| supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | A | STRIPE_PARTNER_PERMISSION_114470 | YES | 7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0 |
| supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql | A | GLOBAL_LIFECYCLE_114480 | YES | 90b7eadeb7486684865a9745b24a4dcb9bfaef8b04f61e1b6b0ddf4814335399 |
| tests/e2e/admin-hotels-v2-admin-d-availability.spec.ts | M | TEST | YES | a2ceb5bbe39e15ea026e67be3a35ebe92ad5b3003335f85625ce64ebbeefe336 |
| tests/e2e/hotels-v2-seven-arches-reviewed-pricing-ui.spec.ts | M | TEST | YES | 1f932bed843587f73553afcf3d9185d8c2144a70ef54e7b4a890423d8f7c8d46 |
| tests/e2e/hotels-v2-stripe-connect.spec.ts | A | STRIPE_CONNECT_TEST | YES | a4a225374ddfbc34913de328bf0700fbaacbbe12efa6284426f20baa20a26280 |
| tests/e2e/partner-hotels-v2-h3-2b-workspace.spec.ts | M | TEST | YES | 29a28da863b97d354103b0dfc4c867f2e2fbe2c58484e073b8b0396e73417894 |
| tests/hotelsV2CapabilityLifecycle.test.ts | A | TEST | YES | 185ddb5045fc98ad84c5e54568c20e561ab852f6a16d20e088152304f11f8c2c |
| tests/integration/hotels-v2-activation-lifecycle-boundary-postgres-gate.sql | A | TEST | YES | 43a6313f5593879de6c353f8c374e91dae4916de07fe2e38df36e2675566f7d8 |
| tests/integration/hotels-v2-capability-lifecycle-client-postgrest-gate.mjs | A | TEST | YES | ca5c4dc736d35c12e22f2f4f7db175d658caae99cd058e72054230acc17b5a3f |
| tests/integration/hotels-v2-capability-lifecycle-forward-postgres-gate.sql | A | TEST | YES | ec0e345320e74e628583e9ecd9cb2d30c63aa59d8ab052e98e5c8f268eec8ac0 |
| tests/integration/hotels-v2-capability-lifecycle-latency-postgrest-gate.mjs | A | TEST | YES | 4f2f3546d002af7e9aceffebb2cb344b31a9050ce876a7ee557e3aad8c5274d9 |
| tests/integration/hotels-v2-capability-lifecycle-latency-static-gate.mjs | A | TEST | YES | 4fae9043893e3eeb531d305922e6e84553a3d8ce6f3a46ca2745fd144dbc6340 |
| tests/integration/hotels-v2-capability-lifecycle-postgrest-gate.mjs | A | TEST | YES | 9a24b7e85c7e1554213939993d8017bbad2ab27a4a82a95d0569a6f0479f7897 |
| tests/integration/hotels-v2-capability-lifecycle-security-postgres-gate.sql | A | TEST | YES | a62c7798ecaa630d6796cbaabe0dad294250a89df0e60da6eb3059d3564a0fb7 |
| tests/integration/hotels-v2-capability-lifecycle-timeout-postgrest-gate.mjs | A | TEST | YES | 664e325b477699541444fb0354c2c6db29db7c6da1a5bd2639966203c3847f3d |
| tests/integration/hotels-v2-public-enable-boundary-diagnostic.sql | A | TEST | YES | 5e050b08b55fa3d060117b72d1299e163cf85e7a787f70c2892f271783b896ad |
| tests/integration/hotels-v2-seven-arches-application-pricing-bridge-postgres-gate.sql | M | TEST | YES | 9a73e3283200d47f7f24838325090c9a9bf61fb598ee59328a4a04e31358da86 |
| tests/integration/hotels-v2-seven-arches-reviewed-pricing-postgrest-gate.mjs | M | TEST | YES | 50f9d519df3b39ca1e47280c9353c7676f4953857b08933dd2ed302b555a83ed |
| tests/integration/hotels-v2-stripe-authorization-postgrest-gate.mjs | A | STRIPE_CONNECT_TEST | YES | 49e6f49fc73dcf954447d5302061d40db1b8b6adceca426acd745c6983384b7a |
| tests/integration/hotels-v2-stripe-connect-mock-gate.mjs | A | STRIPE_CONNECT_TEST | YES | ac4b2933d6fa2c6c109516efaf3770454b344a920fb7cc767aaceb442dbfd378 |
| tests/integration/hotels-v2-stripe-connect-postgres-gate.sql | A | STRIPE_CONNECT_TEST | YES | 128ece2df0d78b2cb37f99f94286bfd9e57e8710ebbc54d99811d1a045561d26 |
| tests/integration/hotels-v2-stripe-connect-postgrest-gate.mjs | A | STRIPE_CONNECT_TEST | YES | 6d278fe5b3fffdea3748fc439aa659ffd9de680607f871c04061963f6417231c |
| tests/integration/hotels-v2-stripe-connect-signature.deno.ts | A | STRIPE_CONNECT_TEST | YES | 1736bc8be59aa942a0a758b7b9995a9da413be5035deffd75f9136c6d22c9fbf |
| tests/integration/hotels-v2-stripe-connect-static-gate.mjs | A | STRIPE_CONNECT_TEST | YES | 1184b8b736becfdbf1d69e54f8fafd3315a66e25b752a4058c453c8775a49b2f |
| tests/integration/hotels-v2-stripe-platform-readiness-handler-gate.mjs | A | STRIPE_CONNECT_TEST | YES | 8b4727da8bf2c81f19fef027cf89efc39761aa831228714336dcc83b9199918b |

## Local checkpoint organization

Five dependency-ordered local commits: (1) Stripe foundation/runtime and its focused tests;
(2) separate audited Partner permission and test; (3) global lifecycle migration/guards,
performance and RPC tests; (4) source/dist Admin/Partner UI plus matching client/E2E tests;
(5) historical boundary fixtures, documentation, final manifest/runbook. Some Edge readiness
code in (1) depends on (3); the series is one reviewed release and intermediate commits
are not independently authorized deployment units. No production or remote action is included.

## Next action

Human review of the local checkpoint hashes. Then, only with separate explicit authorization,
begin controlled rollout from 114420 using the confirmed 08 Sep recovery point and fresh
pre-action checks. Each stage stops for verification. Edge/configuration, platform enablement,
Partner permission and account connection each require their own authorization. Never auto-enable.
