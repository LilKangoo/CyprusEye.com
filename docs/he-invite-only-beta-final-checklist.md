# HE Invite-Only Beta Final Checklist

Generated: 2026-05-30

HE remains invite-only/internal. This checklist does not enable public HE,
public switchers, sitemap, hreflang, canonical metadata, SEO, indexing,
public `/he/` routes, or Shop HE.

## 1. Before Applying Content Pack

- Confirm migrations 177, 178 and 179 have already been applied.
- Confirm `blog_post_translations.lang` accepts `he`.
- Confirm Shop is still excluded from HE beta.
- Confirm no public HE SEO, sitemap, hreflang, canonical or `/he/` routes exist.
- Review all Hebrew text in
  `supabase/manual/he_beta_content_pack_stage17_apply.sql` with a human reviewer.
- Keep a copy of `supabase/manual/he_beta_verify_after_apply.sql` open for the
  post-apply checks.

## 2. Apply Content Pack

Run manually in Supabase SQL Editor:

```sql
-- paste and run:
-- supabase/manual/he_beta_content_pack_stage17_apply.sql
```

The apply file already contains `BEGIN;` and ends with `COMMIT;`. Do not add a
second manual `COMMIT`.

Success signals:

- SQL Editor returns `Success. No rows returned` or returns the internal
  verification counts without an error.
- No constraint errors for `blog_post_translations.lang`.
- No missing-column errors for the scoped tables.
- No JSONB syntax errors.

Error signals:

- Any `ERROR:` response.
- Any constraint failure.
- Any missing table/column error.
- Any JSON/JSONB parse error.

If an error appears:

- Stop. Do not run partial follow-up updates manually.
- Copy the exact SQL error and line number.
- Re-run only after the SQL file is fixed.
- If a transaction aborted before `COMMIT`, Supabase/Postgres should roll back
  the failed transaction automatically.

## 3. Verify After Apply

Run manually in Supabase SQL Editor:

```sql
-- paste and run:
-- supabase/manual/he_beta_verify_after_apply.sql
```

Expected scoped results:

| Module | Expected rows | Expected status |
| --- | ---: | --- |
| Blog | 5 | `he_complete` for selected posts |
| Transport | 9 | `he_complete` |
| POI | 10 | `he_complete` or reviewed `he_partial` |
| Recommendations | 5 | `he_complete` or reviewed `he_partial` |
| Trips | 3 | `he_complete` or accepted EN fallback |
| Hotels | 2 | `he_complete` or accepted EN fallback |
| Cars | 5 | `he_complete` |

If verify shows missing HE:

- Confirm the ID/slug in the verify result matches the Stage 17 scope.
- Check whether the row existed before apply.
- Check if the apply file intentionally only fills empty HE fields.
- If the row has an existing wrong/empty-looking HE value, fix it manually in
  admin or with a reviewed SQL update; do not overwrite PL/EN fields.
- Re-run only the verify file after the fix.

## 4. Allowlist Config

Primary gate: `betaUserIds`.

Secondary gate: `betaEmails`.

Use `profiles.preferred_language='he'` only as a preference after allowlist
passes, not as the permission gate.

Recommended runtime config:

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
      "00000000-0000-0000-0000-000000000000"
    ],
    "betaEmails": [
      "tester@example.com"
    ]
  }
}
```

Where to set it:

- Client runtime: inject as `window.CE_LANGUAGE_ROLLOUT_CONFIG` before
  `js/i18n.js` loads.
- Cloudflare/Page Functions: set `CE_LANGUAGE_ROLLOUT_CONFIG` for server-side
  helpers.
- Do not leave a conflicting `CE_HE_ROLLOUT_MODE=internal_only` if using the
  beta config. Either unset it or set it to `beta_users`.

Deploy/runtime behavior:

- If config is injected at runtime before `js/i18n.js`, changing testers can be
  runtime-only.
- If config is baked into static HTML/JS or Cloudflare build-time env, a deploy
  is required.
- Cloudflare Pages Functions env changes may still require a redeploy depending
  on how the project binds and serves the config; verify on staging before
  relying on no-deploy changes.

Admin and partner testers:

- Add their Supabase user IDs to `betaUserIds`.
- Add emails only as a secondary convenience gate.
- Keep them in a separate internal cohort list in the release notes.

## 5. Hidden Preview Decision

Recommendation for invite-only beta: set `hiddenPreview:false`.

Pros:

- Prevents ordinary users from opening `?ce_he_preview=1&lang=he`.
- Makes invite-only access depend on allowlist, not a shareable URL.
- Reduces accidental public screenshots and analytics noise.

Cons:

- Internal QA loses the simple preview URL unless an internal/admin gate is
  added.
- Debugging external reports may require temporarily adding a tester to the
  allowlist.

Allowed internal alternative:

- Keep `hiddenPreview:false` for public pages.
- Use admin/partner/internal accounts through `betaUserIds`.
- Re-enable hidden preview only for a short internal QA window, then disable it
  again before inviting external testers.

## 6. Expected Beta Behavior

Beta tester:

- Can activate HE through the controlled beta gate.
- Sees `lang="he"` and `dir="rtl"` on scoped public pages.
- Can use narrow-scope content: Blog, POI, Recommendations, Transport, Trips,
  Hotels and Cars.
- Does not get HE SEO, sitemap, hreflang, canonical or indexing.
- Does not get public `/he/` routes.
- Does not get Shop HE.

Non-beta user:

- `?lang=he` falls back to EN/LTR.
- No HE option appears in public switchers or selectors.
- `/he/` redirects safely to `/?lang=en`.
- Sitemap/hreflang/canonical/SEO remain PL/EN only.

Known beta limitation:

- Public blog RLS intentionally keeps anonymous public reads limited to PL/EN.
  Treat HE blog detail as ready only after the actual authenticated/beta path is
  verified for the selected testers.

## 7. Shop Exclusion

Shop is outside the first invite-only HE beta.

Must remain true:

- `shop.html?ce_he_preview=1&lang=he` does not activate HE checkout.
- Cart, checkout, shipping and payment remain PL/EN only.
- Stripe/payment flows are not part of HE beta.
- Shop is not tested as a Hebrew customer purchase flow.

## 8. Before Deploy

- Confirm `docs/he-beta-rollback.md` is current.
- Confirm `hiddenPreview:false` decision is reflected in runtime config.
- Confirm allowlist contains only intended tester IDs/emails.
- Confirm `seo`, `sitemap`, `hreflang`, `canonical`, `indexing` are all false.
- Confirm Shop is excluded.
- Run local checks:
  - `npm run i18n:test`
  - `npm run i18n:audit`
  - `npm run i18n:he-readiness`
  - `npm run seo:audit`
  - `npm run build`
  - `npm test`
  - Playwright HE hidden/beta smoke

## 9. After Deploy

Non-beta smoke:

- `/?lang=he` -> EN/LTR.
- No HE switcher or selector.
- `/he/` redirects to `/?lang=en`.
- `sitemap.xml` has no HE URLs.
- Page source has no HE hreflang/canonical alternates.

Beta smoke:

- Allowlisted tester can activate HE.
- HTML is `lang=he`, `dir=rtl`.
- Shop remains PL/EN if opened.
- Blog/POI/Recommendation/Transport/Trip/Hotel/Car scoped paths render without
  `undefined`, empty cards, horizontal overflow or PL-first fallback.

## 10. User Journey

Run with one allowlisted tester:

1. Home
2. Blog scoped post
3. Map/POI scoped record
4. Recommendation scoped record
5. Trip scoped record
6. Hotel scoped record
7. Car scoped record
8. Transport location selection

Pass criteria:

- HE content appears where scoped and verified.
- EN fallback is acceptable where explicitly documented.
- No direct PL fallback while EN exists.
- No broken RTL layout.
- No public SEO/indexing exposure.
- No Shop HE checkout flow.

## 11. Rollback

Use `docs/he-beta-rollback.md`.

Fast rollback expectations:

- Set HE mode back to `internal_only` or `off`.
- Empty `betaUserIds` and `betaEmails`.
- Set `hiddenPreview:false`.
- Keep all SEO/indexing surfaces false.
- Do not delete HE content or drop HE columns.
- Verify `?lang=he` and `?ce_he_preview=1&lang=he` no longer activate HE for
  non-beta users.

## 12. GO / NO-GO

GO for 1-3 invite-only testers only if:

- Stage 17 content pack apply succeeded.
- Verify SQL returns expected scoped rows.
- Human review accepted the scoped HE content.
- Allowlist config is deployed or injected correctly.
- Hidden preview is disabled or internal-only.
- Non-beta `?lang=he` stays EN/LTR.
- Shop remains excluded.
- SEO/sitemap/hreflang/canonical/indexing remain off.
- Rollback path is known and tested logically.

NO-GO if:

- Any verify query returns `missing` for a scoped beta record.
- Blog HE path cannot be verified for selected testers but Blog is advertised as
  part of beta.
- HE appears for a non-beta user.
- Shop checkout starts in HE.
- Any HE SEO/sitemap/hreflang/canonical/indexing surface becomes visible.
- There are unresolved RTL breakages in the scoped user journey.

