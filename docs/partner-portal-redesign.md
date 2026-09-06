# Partner Portal redesign — isolated frontend phase

## Production frontend release / backend boundary 114415

The human-approved frontend release does not enable any backend stage. The
following inventory is from committed SQL definitions, not production RPC calls.
Every name below has the `hotel_v2_partner_` prefix:

| RPC suffix | Availability at 114415 | UI boundary |
| --- | --- | --- |
| `list_assigned_properties` | AVAILABLE_AT_114415 | Existing authorized assignment selector |
| `get_workspace` | AVAILABLE_AT_114415 (113800) | All seven sections, strict DTO/capability validation |
| `preview_content_plan`, `apply_content_plan` | AVAILABLE_AT_114415 (113800) | Explicit reviewed content/photo/Room actions only |
| `preview_pricing_plan`, `apply_pricing_plan` | AVAILABLE_AT_114415 (113800, evolved 114415) | Generic pricing does not bypass Seven Arches dedicated controls |
| `preview_commercial_stay` | AVAILABLE_AT_114415 (113800) | Explicit existing commercial preview only |
| `preview_availability_plan`, `apply_availability_plan` | AVAILABLE_AT_114415 (113800) | Existing explicit reviewed availability actions only |
| `preview_seven_arches_pricing_proposal`, `submit_seven_arches_pricing_proposal` | AVAILABLE_AT_114415 | Unreachable until validated dedicated Get succeeds |
| `get_seven_arches_reviewed_pricing` | FUTURE_114420 | Missing/error result leaves actual current tiers read-only, no proposal form |
| `get_external_calendar_control`, `preview_external_calendar_plan`, `apply_external_calendar_plan` | AVAILABLE_AT_114415 (114200) | Exact provider capability contract controls available actions |

FUTURE_114425 adds no new RPC called by this workspace. FUTURE_114450 evolves
provider capability/Apply behavior but introduces no new automatic call here.
Before that stage the validated `provider_types_unavailable` state disables
provider proposals, URL operations, activation and manual sync. No polling or
automatic retry was added. Bookings/Payments presentation is derived locally from
the existing authorized availability projection, not a new API. Media upload uses
the unchanged permission-protected storage flow and only an explicit user action.

Optional pricing/calendar Get failures display localized unavailable copy, with
only a bounded error code behind collapsed Diagnostics. Raw response bodies are
not displayed or retained in that UI state. Authentication, malformed response
and transport failures remain fail-closed; they are not classified as successful
or granted future capabilities. Public booking continues to display Disabled
when `hotel_rooms_v2_enabled=false`; no flags or commercial data are changed.

Base: `2e8e462ff323290c1d9f04272e8fec7c6401bf97`.
Branch: `feature/partner-portal-redesign`. No production access or rollout changes.

## Existing architecture and reuse

`partners.html` and `partners/index.html` load the existing portal. `js/partners.js`
opens `HotelsV2PartnerWorkspace.open()` with an exact authorized assignment.
The seven local workspace sections are overview, property_content, rooms,
rates_pricing, calendar_availability, bookings and payments. Navigation is local;
it must not issue an RPC merely because a visual tab changes.

`hotels-v2-partner-workspace-repository.js` remains the RPC boundary;
`hotels-v2-partner-workspace-core.js` retains strict DTO, identity, permission,
snapshot and reviewed-plan validation. Neither is replaced by presentation logic.
The existing media module handles reviewed uploads; existing help controller handles
localized accessible dialogs. `partners/hotels-v2-workspace.css` scopes the design.

Reused contracts:

- Assigned Partner workspace Get, capability-driven sections and actions.
- Existing content, photo, Room structure and draft-Room Preview/reviewed Save.
- Dedicated Seven Arches independent pricing Get/Preview/Submit; no direct publish.
- Existing server commercial-stay preview and server review impact calculations.
- Scoped external-calendar Get and reviewed source/proposal workflows.
- Existing authorized availability-derived booking/payment presentation. Missing
  fields remain unavailable; no new booking or financial authority is introduced.
- Existing booking/payment management handoff event; no manual booking feature.

## Data and lifecycle rules

Workspace operation is not public enablement. Public booking status uses the exact
`feature_flags.hotel_rooms_v2_enabled` boolean. External Sync is independent.
Pricing matrices group existing tier rows by threshold and guest count, preserving
every tier ID, value, currency and Room/schedule relationship. There is no price
calculation or fixed 27-tier data in the runtime UI. Commission uses the server
policy mode/amount/currency, never an invented percentage or forecast.

Active Property data is displayed separately from the existing proposal form.
No unsupported Save draft / Discard server action or shadow proposal API is added.
Room size NULL means Not provided, not a numeric default. No generated marketing
images, guest/revenue examples, payouts, provider connections or reviews are used.

## Side effects and testing boundaries

Workspace refresh retains its existing one-shot reads. No timer/poll/retry is added.
After 114450 the **Admin** provider-review Get may run expiry cleanup. It is not
called by this Partner redesign and must not be used for read-only smoke.
Partner review/submit/save and media uploads remain explicit user actions.
Tests use synthetic local DTOs and intercepted requests, never production records.
Screenshots are labeled local fixtures, not evidence of production state.

## Responsive and accessibility approach

Desktop sidebar; mobile Overview/Property/Rooms/Rates plus More dialog. Capability
visibility applies equally to both. Pricing uses a full desktop matrix and a mobile
guest selector with vertical night thresholds, without duplicating editable inputs.
Native dialogs, escape/close behavior, focus restoration, labeled controls, logical
CSS properties, reduced motion and explicit EN/PL/HE copy are retained or added.

No backend, migration, flag, commission, price, allocation, public client or rollout
artifact is in this frontend change scope. Main remains the backend release branch.

## Implemented pages and limits

- Overview: assignment-driven status cards, permissions and quick navigation;
  public booking is explicitly separate from workspace operation.
- Property: canonical data card, proposal lifecycle, existing content/photo forms.
- Rooms: real facts, safe missing size, permission-driven content/photo/structure
  filters and existing draft-Room form. No direct publish action.
- Pricing: separate Room cards, existing tier IDs grouped by nights/guests, mobile
  guest selector, active/requested values, existing Preview/Submit and commercial
  Review impact. No client-side price/commission calculation.
- Calendar: bounded real availability cells and existing provider controls.
  Operational availability does not imply public booking is enabled.
- Bookings: authorized allocation projection, desktop table/mobile cards, search
  by ID/status/Room. A short ID is a display locator, not a new booking reference.
  Unknown customer totals remain unavailable; no guest-name/source is invented.
- Payments: existing safe handoff plus server commission and explicit unconfigured
  payouts when Stripe is disabled. The current availability-derived presentation
  deliberately has `payments_visible=false`; no payment dataset is fabricated.
- Diagnostics/Support: local dialogs, no additional requests. Contextual Help uses
  the existing localized controller. No polling or automatic mutation retry.

## Local validation — 6 September 2026

- Chromium: **41/41 PASS**. Includes all seven pages at 1440/1024/768/390 in
  EN/PL/HE, independent 27/27 matrices at the same combinations, RTL, More/help
  focus, real outer portal CSS, loading/denied refresh, booking table/cards,
  permissions, Room editors, existing content/photo Review/Save and pricing
  Preview/Submit separation, stale rejection and provider error handling.
- Jest: **70 PASS, 1 pre-existing failure**, nine selected suites. Six new
  redesign checks pass. The failure is in
  `hotelsV2H32aPartnerPermissionsClient.test.ts`, expecting Admin CSS
  `20260821_1`; the unchanged baseline Admin dashboard has `20260831_2`.
  Both values were independently read from release commit `2e8e462`.
  No unrelated Admin asset pin was changed to hide it.
- `tsc -p tsconfig.jest.json`: PASS. `node --check` on the controller: PASS.
  Focused strict ES2022 typechecking of the redesigned Partner E2E harness: PASS.
- Repository-wide `npm run typecheck`: FAIL in existing mobile-app/dependency
  and compiler configuration (missing Expo/React Native modules, legacy target
  iteration errors). Broader direct E2E typechecking also encounters the existing
  pre-114405 fixture literal-type constraint and remote Supabase module import.
  These unrelated dependencies/configuration were not changed.
- Normal `npm run build`: PASS. Four changed source/entrypoint files match their
  generated dist mirrors byte-for-byte. `git diff --check`: PASS.

Browser data and screenshots are synthetic local fixtures, not live Hotel evidence.
The 27/27 fixture intentionally varies price values to catch accidental flattening.
Its numerical prices must not be interpreted as production prices.

## Final checkpoint baseline exceptions

Both exceptions were independently reproduced in a detached temporary worktree at
the exact release commit, using the same installed dependencies as the feature branch.
No runtime, style or test correction was needed during checkpoint preparation.

- Admin asset pin: the clean-base command
  `./node_modules/.bin/jest --config jest.config.cjs --runInBand --runTestsByPath .jest-dist/tests/hotelsV2H32aPartnerPermissionsClient.test.js`
  returned exit 1, with 9 passing tests and the same single CSS-pin assertion failure.
  Clean-base test SHA-256:
  `bd307b39f4c301a248252e523c69cc19819ffbf27457b3582fd46cac1321fd89`.
  Clean-base dashboard SHA-256:
  `3f0d6368c18494e17f0b43dc31b52ce2968bf7393d1c7a63f2bc96a3d8772d95`.
- Repository TypeScript: `npm run typecheck` returned exit 2 in both checkouts.
  Both produced 153 diagnostics. After normalizing checkout paths and source line
  numbers, the file/error-code/message lists were identical. No redesign-added
  TypeScript error was found. No dependency or compiler setting was changed.
- Both are classified **BASELINE_EXCEPTION**, under the conditional checkpoint
  authorization. They are not represented as successful repository-wide checks.
- Final directly affected validation: 61/61 Jest tests across eight suites PASS;
  41/41 Chromium tests PASS; focused Jest and Partner E2E TypeScript PASS;
  controller syntax PASS; normal build and four dist mirrors PASS.

The isolated feature branch is ready for one local checkpoint and human visual
review under these documented exceptions. No push, merge, deployment or production
operation is authorized. The screenshot review package is kept outside Git under
`/private/tmp/partner_portal_visual_review/` and uses local synthetic fixtures only.

Final scope is 14 frontend/test/documentation paths, including four generated
mirrors. All 238 migration files match the release baseline. The excluded dirty
owner preflight retains its original file and binary-diff hashes. Neither the
strict Partner core/repository nor the parent portal controller was modified.
