# Standalone Admin pricing Review action

Base: `785b6353d2003956fae366d96394be700c1af7b4` (current main).
Branch: `fix/admin-pricing-review-self-contained`.
This is a new patch on main, not a cherry-pick or merge of the functional branch.
No production access, SQL execution, push, merge or deployment.

## Extraction and self-containment

Approved UX source: `bd382df5695e8e9dbcedcaeb2dad226377be28f6`.
Only two prerequisite fragments from `323e932dbd0143c5ef74eda56e0de6e4dfca58db`:

1. The Admin editor's locally declared `buildInFlight`, early guard, pre-RPC set
   and terminal-error reset. Success closes the form, preserving one logical call.
2. The E2E Admin Preview transport fixture: exact RPC branch, generated proposal
   ID/version, correct response envelope and a 30-minute Review. Deferred/error
   controls are test-only. The Admin single-flight/error assertions are retained
   as focused tests; additional Partner cases from 323e932 are excluded.

Runtime scope is **only** `admin/hotels-v2-workspace.js` and its normal dist mirror.
Core, Repository, Partner, Bookings, Stripe, Calendar, SQL and migrations remain
byte-identical to main. The UI uses existing main exports and DOM/state contracts.
In particular `Core.isExactMoney`, the pricing i18n helpers, reviewed-pricing
Repository methods, `state.reviewedPricingControl`, and Repository error fields
already exist in main. Every `buildInFlight` use resolves within this editor.

The broader Repository error-message change in 323e932 is **not** included or
required. This editor now renders bounded feedback itself using main's existing
`isDefinitiveFailure` and safe `userMessage` fields. Unknown/transport outcomes
say a Review may have been stored, no Apply was called and nothing was retried.
Definitive rejection is visible inline. Raw exceptions are not normal UI copy.
Both messages have EN/PL/HE equivalents. No other workflow's error policy changes.

## Contract and behavior

The submit button targets `sevenArchesReviewedPricingAdminForm`; the handler is a
direct form submit listener, not delegated click logic. Native invalid events and
input/change events also update accessible inline feedback.

Baseline no-op diagnosis: selected unchanged prices reached Core's
`validateSevenArchesReviewedPricingItem` and failed `before_price === requested_price`
before transport; only a generic toast was attempted. The corrected handler
explicitly explains: “Change at least one selected price before building the Review.”
No-op handler executes; Preview RPC count 0; Apply count 0.

The unmodified 114415 `hotel_v2_seven_arches_reviewed_pricing_build_plan` rejects
`v_requested=v_before` with `hotels_v2_seven_arches_reviewed_pricing_unchanged_item`.
Admin Preview expects 1–54 **changed selected tiers**, not a complete snapshot.
Prices remain JSON numbers, EUR 10–9999999999.99, at most two decimals. The local
fixture's 100→101 is valid; 100→100.00 is unchanged. No SQL was executed to audit
this existing source contract.

`ADMIN_PREVIEW_CONTRACT_INPUT_MODE=CHANGED_TIERS_ONLY`.
`UNCHANGED_SELECTED_ROWS_ALLOWED=NO` in the RPC payload.
`NO_CHANGE_PREVIEW_ALLOWED=NO`.
Unchanged checkboxes may stay selected but their items are omitted explicitly.

- Select all / Clear all / Select changed change checkboxes and enabled state
  only. Price values survive every bulk action and deselection.
- Counts show total rows, selected rows and all edited rows, including unselected
  edits. Only changed selected items are submitted; no commercial totals are
  calculated in the browser.
- Upper and Ground retain separate identities and schedules, 27 tiers each.
- One valid operation produces one client Preview, one HTTP POST and one Review
  render. Apply remains a separate explicit action and is not invoked by Build.
- Transport/server failures are visible, release the in-flight guard and never
  trigger automatic retry. A distinct explicit second action in the local fixture
  proves recovery without permanent deadlock. Production retries are not authorized.
- Preview may write its proposal/Review server-side, but does not apply prices.
  Browser tests are not represented as a new backend transaction-chain proof.

## Local validation on main plus this patch

Commands (run from the isolated checkout):

```sh
node --check admin/hotels-v2-workspace.js
./node_modules/.bin/tsc -p tsconfig.jest.json
./node_modules/.bin/jest --config jest.config.cjs --runInBand --runTestsByPath .jest-dist/tests/hotelsV2SevenArchesReviewedPricingAdminClient.test.js .jest-dist/tests/hotelsV2WorkspaceHelp.test.js
PORT=4317 ./node_modules/.bin/playwright test tests/e2e/hotels-v2-seven-arches-reviewed-pricing-ui.spec.ts --grep 'Admin' --workers=2 --output=/private/tmp/hotels-admin-self-contained-e2e
npm run build
git diff --check
```

- Jest **25/25 PASS**, two focused suites. Jest TypeScript compilation PASS.
- E2E **16/16 PASS**: no-op, zero selection, invalid reason/price, one/multiple
  Upper/Ground/both changes, all54, clear/select changed, identity/value preservation,
  EN/PL/HE, rapid repeat submit, transport/401/403/500, explicit recovery and success.
- New real-change cases: handler 1, Repository Preview 1, intercepted loopback HTTP
  POST 1, render 1, Apply 0. Uses real main Core/Repository, fixture response only.
- Strict standalone E2E TypeScript retains two unrelated **main baseline** errors:
  TS2322 literal schedule-ID assignment at line211 and TS2307 esm.sh declaration
  in utils/supabase.ts. Compiler-host comparison against exact main: zero new
  diagnostics. The combined strict check is not a clean PASS.
- JavaScript syntax, normal build and Terser dist reproduction PASS.
- All238 migrations unchanged, including 114420/425/450. No SQL files added.
- Primary-worktree owner preflight remains excluded, with exact file hash
  `dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62`
  and binary-diff hash
  `ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54`.

## Exact hunk audit

| File / changed region | Classification |
|---|---|
| Admin editor local in-flight declaration/check/set/reset | DEPENDENCY_SINGLE_FLIGHT |
| Admin translations, bulk buttons/listeners and counters | APPROVED_BULK_UX, APPROVED_NO_OP_UX |
| Admin changed-only extraction, inline validation and bounded error feedback | APPROVED_NO_OP_UX |
| E2E exact Admin Preview transport fixture | DEPENDENCY_E2E_FIXTURE |
| E2E HTTP instrumentation, Admin scenarios and explicit error recovery | TEST |
| Admin client Jest request/no-op/money/guard assertions | TEST |
| This standalone extraction/validation report | DOC |
| Generated Admin workspace dist | DIST_MIRROR |

`UNRELATED_HUNKS=0`. No broader functional-completion commit is an ancestor of
this patch. Main and the primary functional branch are not modified.

Next step: human review of this new standalone commit, then a separately
authorized controlled feature-preview release before production. No production
changed-price Preview, Apply, migration or deployment is authorized here.
