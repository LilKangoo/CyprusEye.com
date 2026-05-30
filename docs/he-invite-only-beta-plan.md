# HE Invite-Only Beta Plan

Generated: 2026-05-29

HE remains internal/beta-only. This plan does not enable public HE, public
switchers, sitemap, hreflang, canonical metadata, SEO, indexing, or public
`/he/` routes.

## Source Review

Reviewed inputs:

- `supabase/manual/he_beta_content_pack_stage17_apply.sql`
- `supabase/manual/he_beta_verify_after_apply.sql`
- `docs/he-beta-hidden-journey-final.md`
- `docs/he-stage10-beta-rollout.md`
- `docs/he-beta-go-no-go.md`

Stage 17 narrow content pack scope:

| Area | Scoped records |
| --- | ---: |
| Blog posts | 5 |
| Transport locations | 9 |
| POI | 10 |
| Recommendations | 5 |
| Trips | 3 |
| Hotels | 2 |
| Cars | 5 |

Total scoped dynamic records: 39, plus blog taxonomy and POI/recommendation
category labels.

## Access Control Options

| Option | Strength | Risk | Recommendation |
| --- | --- | --- | --- |
| Allowlist user IDs | High | Requires known Supabase IDs before invite | Primary access gate |
| Allowlist emails | Medium | Email can change; client availability depends on session state | Secondary convenience gate |
| `profiles.preferred_language = 'he'` | Low as permission, useful as preference | A stored preference is not an access decision | Use only after allowlist passes |
| Partner/admin test users | High when explicit IDs are used | Internal accounts can mask customer issues | Include as separate internal cohort |

Recommended invite-only beta gate:

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
    "betaUserIds": ["<supabase-user-id>"],
    "betaEmails": ["tester@example.com"]
  }
}
```

Keep user IDs as the source of truth. Emails are acceptable as a secondary UI
gate. `preferred_language='he'` should select HE only for users who already
passed allowlist validation.

## Runtime Safety Findings

| Area | Status | Notes |
| --- | --- | --- |
| `js/i18n.js` | Guarded | `?lang=he` is blocked unless hidden preview or beta routes are allowed. |
| `functions/_utils/languageRollout.js` | Hardened | Server beta checks now support user IDs, emails, and optional preferred-language gating. |
| `js/languageSelector.js` | Safe | Public selector still exposes only PL/EN. |
| `js/languageSwitcher.js` | Safe for public | Legacy switcher cannot set HE publicly. |
| `functions/_utils/pageSeo.js` | Safe | SEO normalizes HE to EN while HE SEO is disabled. |
| `functions/_utils/sitemap.js` | Safe | Sitemap languages come from `sitemap` surface; HE remains excluded. |
| `js/shop.js` | Hardened | Shop now ignores hidden HE on pages marked `data-disable-hidden-language="true"`. |
| `shop.html` | Hardened | Shop page disables hidden-language rendering because Shop is outside first HE beta. |
| `js/header-dropdown.js` | Watch | It can carry raw `lang` into Shop URLs, but Shop now blocks HE locally. |
| `js/compact-header.js` | Watch | It can pass raw URL language to auth links before i18n settles; auth itself only accepts PL/EN. |
| `functions/_utils/blogData.js` | Beta limitation | Server-side blog routes still normalize HE to public routes without request user context. |

No public HE SEO, sitemap, hreflang, canonical, indexing, or `/he/` route was
enabled.

## Hidden Preview vs Beta Users

`ce_he_preview=1` remains an internal QA bypass for visual/runtime testing.
`beta_users` should be the customer-facing invite-only mode.

Potential conflict:

- Hidden preview does not require an authenticated allowlist.
- Beta users should not need `ce_he_preview=1`.

Mitigation:

- Do not share hidden preview URLs with external testers.
- Use `beta_users` plus explicit allowlist for invite-only testing.
- If strict invite-only access is required, set runtime config
  `he.hiddenPreview=false` before the beta window.

## Dynamic Content Readiness

After the Stage 17 content pack is applied and verified:

| Module | Technical readiness | Content readiness | Beta suitability |
| --- | ---: | ---: | --- |
| Blog | 90% | 85% | Ready for 5 scoped posts after editorial review |
| POI | 90% | 85% | Ready for 10 scoped POI after wording review |
| Recommendations | 90% | 85% | Ready for 5 scoped records after partner/offer review |
| Transport | 90% | 80% | Ready for selected locations and basic booking labels |
| Trips | 85% | 75% | Beta-suitable for 3 scoped trips with accepted EN fallback |
| Hotels | 85% | 70% | Beta-suitable for 2 scoped hotels with accepted EN fallback |
| Cars | 85% | 80% | Beta-suitable for 5 scoped cars and feature labels |
| Shop | 40% | 0% | Out of scope; keep EN/blocked for HE beta |

## Shop Exclusion

Shop remains outside the first HE beta. The current safety rule is:

- `shop.html` disables hidden-language rendering.
- `js/shop.js` treats HE as unavailable on that page.
- Checkout, shipping, payment and cart should remain PL/EN only.

Before allowing Shop into a later HE beta, complete a separate Shop pass for:
products, variants, categories, vendors, discounts, shipping methods, cart,
checkout validation, Stripe return states, and email/order confirmation text.

## Analytics And Tracking

Observed tracking surfaces:

- GA/gtag exists on public HTML pages.
- Referral capture runs through `js/referral-bootstrap.js`, `js/referral.js`,
  `js/footer-referral.js`, and referral UI modules.
- Recommendation views/clicks are tracked in `js/recommendations.js`.
- Affiliate/referral links are language-agnostic and should continue to work
  with HE query parameters.

Recommended before first beta users:

- Add a lightweight event dimension for `language` and `he_rollout_mode` if
  analytics segmentation is required.
- Confirm referral URLs preserve `ref`/UTM parameters when `lang=he` is present.
- Do not create HE SEO events or HE sitemap monitoring until public rollout.

## Readiness Assessment

Invite-only beta readiness: 82%.

Remaining blockers before first invited users:

- Run the full `he_beta_verify_after_apply.sql` after applying the Stage 17 pack
  and confirm every scoped module returns expected `he_complete` or accepted
  `he_partial`.
- Complete human review for the scoped HE wording.
- Decide the first allowlist user IDs/emails.
- Inject beta runtime config before `js/i18n.js` loads, or use an auth gate that
  reloads the page after setting `window.CE_HE_BETA_USER=true`.
- Keep production hidden preview disabled for external invite-only testers with
  `hiddenPreview:false`, unless an internal/admin-only preview gate is added.
- Confirm blog HE delivery path. Current public blog RLS intentionally keeps
  `blog_post_translations_public_read` limited to PL/EN; direct customer-facing
  HE blog detail should not be treated as ready until beta read access is
  explicitly verified through the chosen authenticated/runtime path.
- Run live hidden journey QA with Shop excluded.

Estimated tasks before first beta users: 1-2 focused QA sessions.

Estimated tasks before public launch: multiple content and SEO passes. Public
launch remains below 50% because full dynamic content, Shop, SEO, sitemap,
hreflang, canonical/indexing, and public URL strategy are intentionally not
ready.
