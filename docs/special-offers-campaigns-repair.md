# Campaigns repair — 7 October 2026

This change updates the admin workspace and repairs manual winner actions. It does not select a participant, change historical campaign rules, alter entry scores or publish a result.

## Deployment order

1. Record the current workflow, entry and shortlist counts with `supabase/manual/special_offer_winner_actions_ambiguity_verify.sql`. Save the existing definitions of the four named functions with `pg_get_functiondef` for rollback.
2. Apply **only** `supabase/manual/special_offer_winner_actions_ambiguity_fix.sql`. This transactional, repeatable patch replaces four functions, retains their signatures/permissions, qualifies ambiguous column references and requires `public_winner_display` before publication. Do not reapply the full historical stage migration.
3. Run the read-only verification again. Expect four function rows with both flags true. Campaign counts, selected candidate and publication state must remain unchanged.
4. Build and deploy the frontend through the existing site deployment process. Check Campaigns, participant search, verification and the winner panel. The live confirmation and publication actions are not smoke tests.

## Completing the existing campaign

The existing approved entry and shortlist should be reused. The administrator records the primary candidate and decision reason, records actual private contact and the actual response, then confirms the winner. Public display is disabled for Lefkara; confirmation completes the private selection. No publication or notification is automatic.

Historical discrepancies remain unchanged for review: configured start date versus rules (9 vs 15 July), response deadline (9 days vs 72 hours), and partner exclusion. Do not silently rewrite rules or participant eligibility after submissions.

## Verification

- `npx playwright test tests/e2e/admin-special-offers-*.spec.ts tests/e2e/special-offer-public-winner.spec.ts --workers=1`
- `npm test -- --runInBand specialOfferManualWinnerSqlStatic specialOfferPublicWinnerSqlStatic`
- `node scripts/test-special-offer-winner-sql.mjs /absolute/path/to/@electric-sql/pglite/dist/index.js`

The PostgreSQL smoke test uses an isolated, ephemeral PGlite database with real workflow table constraints and functions, synthetic participants and stubbed authentication/score dependencies. It reproduces original error 42702, checks transaction atomicity, admin/reason guards, backup promotion, contact acceptance, confirmation and publication privacy. It is not a live RLS or production deployment check.

## Rollback

Redeploy the previous frontend and restore the four saved function definitions if necessary. No participant data migration or deletion is needed. Restoring the former primary/backup functions also restores their original ambiguity defect.

## Production verification — 7 October 2026

Applied the incremental SQL repair through the signed-in Supabase SQL Editor to project `daoohnbnnowmmcizgvrq`. All four original function bodies matched the repository baseline. Saved their definitions for rollback before replacing them. All four repair/admin-guard checks passed afterward; authenticated-only execution ACLs remained unchanged.

Lefkara state before and after: 3 entries, 2 shortlist entries, `shortlisting`, no confirmed winner, no contact events, no active publication. Full-row digests of entries, shortlist and workflow were identical. No live winner action was executed.

Responsive coverage includes 360, 390, 768 and 1440 px, with reachable dialog close controls and unclipped workspace navigation. Failed image previews no longer reload on unrelated form edits and displace language controls.

Production frontend is prepared from `origin/main` (`2b71b3e`), preserving unrelated hotel and public-navigation changes. Cloudflare Pages production project: `cypruseye-com-new`.
