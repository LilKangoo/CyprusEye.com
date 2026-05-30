# HE Invite-Only Beta Launch

Generated: 2026-05-30

This is a launch gate for 1-3 invited testers only. It does not enable public
HE, public SEO, sitemap, hreflang, canonical metadata, indexing, public `/he/`
routes, or Shop HE.

## Preconditions

Do not continue unless all are true:

- `supabase/manual/he_beta_content_pack_stage17_apply.sql` has been run on the
  target environment.
- `supabase/manual/he_beta_verify_after_apply.sql` has been run after apply.
- Verify results match:
  - Blog: 5
  - Transport: 9
  - POI: 10
  - Recommendations: 5
  - Trips: 3
  - Hotels: 2
  - Cars: 5
- Human review accepted the scoped Hebrew content.
- Tester list is final: 1-3 Supabase user IDs and optional emails.
- `hiddenPreview:false` is used for the invite-only window.

## Final Beta Config

The deployed client config uses Supabase user IDs as the source of truth. The
email is intentionally kept out of the static client allowlist to avoid exposing
PII in a public asset. If an email gate is needed for server-only checks, set it
in the Cloudflare/Page Functions environment.

```json
{
  "he": {
    "mode": "beta_users",
    "switcher": true,
    "routes": true,
    "publicApi": true,
    "seo": false,
    "sitemap": false,
    "hreflang": false,
    "canonical": false,
    "indexing": false,
    "hiddenPreview": false,
    "betaUserIds": [
      "15f3d442-092d-4eb8-9627-db90da0283eb"
    ],
    "betaEmails": [],
    "shopEnabled": false,
    "seoEnabled": false,
    "sitemapEnabled": false,
    "hreflangEnabled": false,
    "canonicalEnabled": false,
    "indexingEnabled": false
  }
}
```

Runtime keys used by the current code are `mode`, `switcher`, `routes`,
`publicApi`, `seo`, `sitemap`, `hreflang`, `canonical`, `indexing`,
`hiddenPreview`, `betaUserIds`, and `betaEmails`.

Server-only optional email gate:

```json
{
  "he": {
    "mode": "beta_users",
    "switcher": true,
    "routes": true,
    "publicApi": true,
    "seo": false,
    "sitemap": false,
    "hreflang": false,
    "canonical": false,
    "indexing": false,
    "hiddenPreview": false,
    "betaUserIds": ["15f3d442-092d-4eb8-9627-db90da0283eb"],
    "betaEmails": ["lilkangoomedia@gmail.com"]
  }
}
```

The `*Enabled` and `shopEnabled` fields are audit labels only. Shop exclusion is
enforced by `shop.html` and `js/shop.js`, not by the rollout config.

## Where To Set Config

Client runtime:

- Must be available as `window.CE_LANGUAGE_ROLLOUT_CONFIG` before `js/i18n.js`
  loads.
- If this is hardcoded into HTML/static JS, it requires deploy.
- If a runtime-injected config layer is added later, tester changes can be
  runtime-only.

Cloudflare/Page Functions:

- Set `CE_LANGUAGE_ROLLOUT_CONFIG` to the same JSON for server helpers.
- Unset `CE_HE_ROLLOUT_MODE`, or set `CE_HE_ROLLOUT_MODE=beta_users`.
- If `CE_HE_ROLLOUT_MODE=internal_only` remains set, it can override the mode
  and block beta.
- Treat Cloudflare env changes as deploy-required unless the dashboard/runtime
  is verified to refresh function bindings without deploy.

Current repo reality:

- Static client JS does not read Cloudflare env directly.
- Client browser access is currently handled by `js/he-beta-rollout-config.js`,
  loaded before `js/i18n.js` on narrow beta pages.
- If the signed-in session is loaded after `js/i18n.js`, the page re-checks
  `?lang=he` on the `ce-auth:state` event and enables HE only when the loaded
  user matches the allowlist.
- Do not publish tester emails in public static files unless the privacy tradeoff
  is explicitly accepted. Prefer user IDs for the client config.

## Expected Behavior

Beta tester:

- `?lang=he` can activate HE through the allowlist gate.
- HTML becomes `lang="he"` and `dir="rtl"`.
- HE switcher option may be visible only to the beta user.
- Shop remains PL/EN and out of beta.
- SEO, sitemap, hreflang, canonical and indexing stay off.
- `/he/` remains redirected and is not a public route.

Non-beta user:

- `?lang=he` falls back to EN/LTR.
- No HE switcher/selector.
- No HE routes.
- No HE SEO/sitemap/hreflang/canonical/indexing.

Hidden preview:

- `?ce_he_preview=1&lang=he` should not activate HE while
  `hiddenPreview:false`.

## Beta Smoke Tests

Beta user:

- Homepage renders HE/RTL.
- Blog scoped post opens with HE or explicitly accepted fallback.
- POI and recommendation scoped records show HE.
- Trip, hotel and car scoped records render without `undefined` labels.
- Transport selected locations show HE names.
- Shop remains PL/EN and checkout/payment are not tested as HE.

Non-beta user:

- `/?lang=he` remains EN/LTR.
- Public switcher/selector has no HE.
- `/he/` redirects to `/?lang=en`.
- Sitemap and page source have no HE SEO surfaces.

## Monitoring Checklist

During the first tester session, monitor:

- Console errors.
- Layout overflow and broken RTL.
- Missing labels, `undefined`, `null`, empty cards.
- EN fallback where expected.
- PL fallback only when EN is absent.
- Booking flow validation and summaries.
- Referral/affiliate parameters remain unchanged.
- No Shop checkout/payment path is tested as HE.

## Rollback

Use `docs/he-beta-rollback.md`.

Fast rollback:

- Remove tester user IDs/emails from allowlist.
- Set `mode:"internal_only"` or `mode:"off"`.
- Keep `hiddenPreview:false`.
- Keep all SEO/indexing surfaces false.
- Purge Cloudflare cache if stale static/runtime config continues to expose the
  beta state.
- Do not delete HE content or drop HE columns.

## GO / NO-GO

GO for 1-3 testers only if:

- Verify SQL passed.
- Human review passed.
- Allowlist config is deployed/injected before `js/i18n.js`.
- Non-beta smoke passes.
- Shop exclusion passes.
- Rollback owner is assigned.

NO-GO if:

- Tester IDs/emails are missing.
- `hiddenPreview` remains true for public pages.
- HE appears for a non-beta user.
- Shop checkout appears in HE.
- Any HE SEO/sitemap/hreflang/canonical/indexing appears.
- Blog HE cannot be verified but is included in tester tasks.
