# Admin pricing Review: explicit changed-tier action

Local follow-up to `323e932dbd0143c5ef74eda56e0de6e4dfca58db` on
`feature/hotels-admin-partner-functional-completion`.
Production main remains `785b6353d2003956fae366d96394be700c1af7b4`.
No production access, SQL execution, push, merge or deployment.

## Proven diagnosis

The human evidence describes multiple selected rows with unchanged requested prices
and no new RPC in Network. A baseline local browser test reproduced precisely that
case: reason `Test`, two selected unchanged tiers, one submit handler execution,
zero RPC calls. Core threw `7 Arches reviewed pricing item is invalid, stale or
cross-Room.` before transport. The global toast was invoked, but the form contained
no inline explanation. Classification: **NO_OP_VALIDATION_SILENT** (silent in the
modal, not an assertion that no global error was attempted).

The baseline reproduction ran before the implementation and passed 1/1:
`PORT=4317 ./node_modules/.bin/playwright test tests/e2e/hotels-v2-seven-arches-reviewed-pricing-ui.spec.ts --grep 'Admin no-op diagnosis before' --workers=1 --output=/private/tmp/hotels-admin-review-noop-baseline`.
The test now asserts the corrected inline behavior.

This is not a handler-binding, delegation, authentication or 114420 dependency bug.
It does not explain a separate historical `Failed to fetch` request with unknown
network evidence. The earlier functional-completion report remains historical
evidence for that separate symptom, not a blocker to this proven no-op correction.

## Exact execution path

| Step | Evidence |
|---|---|
| Button | `.btn-primary[type=submit][form=sevenArchesReviewedPricingAdminForm]`, outside the form in the modal footer |
| Binding | Direct form `submit` listener in `openSevenArchesReviewedPricingEditor`; no delegated click handler |
| Native validation | Required reason, minlength 3, maxlength 500; enabled selected number inputs, required, min 10, max 9999999999.99, step .01. Invalid events also update inline feedback |
| Local validation | Trimmed reason 3–500 characters, no control characters; selection nonempty; selected money exact; at least one selected actual change |
| Selection | Checkboxes only; `Number(input.value)` versus `Number(data-before-price)`; no rounding or client-calculated commercial totals |
| Payload | Only `current.changed` selected rows; retain Hotel/Room Type/Room Rate/schedule/tier IDs, guests, minimum nights, EUR, before and requested prices; action `accept`, reason |
| Repository | `previewSevenArchesReviewedPricing` → Core `validateSevenArchesReviewedPricingAdminRequest` → `runRpc` |
| Original failing leaf | Core `validateSevenArchesReviewedPricingItem`: `value.before_price === value.requested_price` |
| Network call site | Repository `runRpc`: one `client.rpc(name, payload)` through the existing Supabase client |
| RPC | `public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb)`; POST `/rest/v1/rpc/hotel_v2_admin_preview_seven_arches_reviewed_pricing` with `{p_request: request}` |
| Response | Core validates the exact server Preview; editor closes, one reviewed commercial-impact panel opens; Apply is a separate explicit confirmation |

## Unmodified authoritative contract

114415 `hotel_v2_seven_arches_reviewed_pricing_build_plan` accepts **1–54 changed
tiers**, not a full snapshot. Its `v_requested=v_before` guard rejects
`hotels_v2_seven_arches_reviewed_pricing_unchanged_item`. Requested prices must be
numeric EUR values from 10 through 9999999999.99 with at most two decimals.
Thus the local fixture's 100→101 is valid; 100→100.00 is not a change.

`ADMIN_PREVIEW_CONTRACT_INPUT_MODE=CHANGED_TIERS_ONLY`.
`UNCHANGED_SELECTED_ROWS_ALLOWED=NO` in the RPC payload; a checkbox may stay
selected, but its unchanged value is omitted explicitly.
`NO_CHANGE_PREVIEW_ALLOWED=NO`.
Core and SQL validation are unchanged. Preview can persist its own proposal/Review
server-side; no statement here claims it is a read-only database operation.

## Corrected UI

- Inline EN/PL/HE feedback explains reason, selection, invalid prices, no-op,
  in-flight and request failures; `role=status`, polite live updates and button
  `aria-describedby`. Native validation cannot silently bypass that explanation.
- Select all / Clear all / Select changed only update checkboxes and enabled input
  state, never price values. Existing values survive deselection.
- Counters show total rows, selected rows and all actual edited rows (including
  currently unselected edits). Copy says only changed selected prices are sent.
- Upper and Ground retain independent schedules and 27 rows each. No merging or
  shared-schedule fallback; optional Room-only buttons were not added.
- Single-flight guard remains before transport, with exactly one Preview and one
  render. No automatic retry. Inline transport feedback does not falsely promise
  that the server stored no Review. No automatic Apply.

## Focused local validation

- Admin E2E: **16/16 PASS**. Includes zero selection, selected no-op, exact
  100→101, Upper, Ground, both, multiple changes, all54, clear/select changed,
  value/identity preservation, numeric scale equivalence, invalid reason/price,
  EN/PL/HE, repeated submit, transport/401/403/500, success and existing Admin paths.
- Real Core and Repository are used by new request tests. Four valid scenarios
  use browser fetch to a **loopback, Playwright-intercepted HTTP fixture** with
  JSON request/response serialization: client call 1, HTTP POST 1, render 1,
  Apply 0. This is not a new real PostgreSQL/PostgREST backend-chain result.
- Jest: **38/38 PASS**, reviewed Admin, reviewed Partner and Workspace Help;
  `tsc -p tsconfig.jest.json` PASS.
- Standalone strict E2E TypeScript: two **unchanged baseline** diagnostics
  (TS2322 schedule literal at line211; TS2307 esm.sh declaration in utils).
  Compiler-host comparison against exact `323e932` source: zero new diagnostics.
  The combined strict command is not represented as a clean PASS.
- Normal build PASS; Admin dist matches normal Terser output, with no CSS change.
- All238 migrations unchanged; excluded owner-preflight file and binary-diff
  hashes retained. `git diff --check` PASS.

## Future controlled frontend release

This branch is not live. After human review and a separately authorized frontend
release, unchanged selected prices should show “Change at least one selected
price before building the Review.” with zero requests. Valid changed selections
should generate one Preview and show the server Review. Selecting all must not
change a price or send unchanged tiers. No fresh production Preview/Apply is
authorized by this report; maintain the separate explicit Apply boundary.
