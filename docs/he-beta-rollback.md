# HE Beta Rollback

Generated: 2026-05-29

HE remains internal/beta-only. These steps disable invite-only beta exposure
without deleting HE content. Do not drop HE columns or remove translated data as
part of rollback.

## Fast Rollback

Set HE back to internal-only:

```json
{
  "he": {
    "mode": "internal_only",
    "switcher": false,
    "routes": false,
    "publicApi": false,
    "seo": false,
    "sitemap": false,
    "hreflang": false,
    "canonical": false,
    "indexing": false,
    "hiddenPreview": false,
    "betaUserIds": [],
    "betaEmails": []
  }
}
```

For a harder stop, use `mode:"off"` with the same public surfaces set to
`false`. `internal_only` keeps internal admin/editorial HE data usable;
`off` should be reserved for emergency rollback when all HE runtime access must
stop.

If the project uses Cloudflare Pages environment variables:

- Set `CE_HE_ROLLOUT_MODE=internal_only`.
- Set `CE_LANGUAGE_ROLLOUT_CONFIG` to the JSON above, or remove the beta config.
- Redeploy only if the runtime cannot read config without a deploy.

If the project injects `window.CE_LANGUAGE_ROLLOUT_CONFIG` at runtime:

- Replace the injected HE block with the JSON above.
- Remove or empty `betaUserIds` and `betaEmails`.
- Ensure `window.CE_HE_BETA_USER` is not set.

## Disable Allowlist

- Remove all IDs from `he.betaUserIds`.
- Remove all emails from `he.betaEmails`.
- Do not use `profiles.preferred_language='he'` as an access permission.
- Leave existing profile values intact; the rollout guard should block HE.

## Disable Hidden Preview

Set:

```json
{
  "he": {
    "hiddenPreview": false
  }
}
```

For already-open browser sessions, testers can also clear local state:

```js
sessionStorage.removeItem('ce_hidden_language_preview');
sessionStorage.removeItem('ce_hidden_language_preview_lang');
localStorage.removeItem('ce_he_beta');
localStorage.removeItem('ce_he_rollout_mode');
localStorage.setItem('ce_lang', 'en');
```

Opening `/?ce_he_preview=0&lang=en` should also clear the preview session.

## Keep SEO Off

During rollback confirm all HE public surfaces remain false:

- `seo:false`
- `sitemap:false`
- `hreflang:false`
- `canonical:false`
- `indexing:false`
- no public `/he/` route

`/he/` and `/he/*` should continue redirecting safely to `/?lang=en`.

## Database Rollback Policy

Do not delete HE beta content unless there is a legal/editorial reason. The
safe rollback is to disable access, not to undo content migrations.

Allowed:

- Leave `blog_post_translations.lang='he'` rows in place.
- Leave `*_he` columns and `*.he` JSONB values in place.
- Leave `profiles.preferred_language='he'` values in place while HE is gated.

Avoid:

- Dropping HE columns.
- Removing `he` from constraints without a separate migration plan.
- Running destructive cleanup in production.

## Verification After Rollback

Manual checks:

- `/?lang=he` renders EN/LTR for non-beta users.
- `/?ce_he_preview=1&lang=he` does not activate HE if `hiddenPreview:false`.
- Public language switcher shows only PL/EN.
- `sitemap.xml` contains no HE URLs.
- Page source has no HE hreflang/canonical alternates.
- `/he/` redirects to `/?lang=en`.
- `shop.html?lang=he` stays PL/EN only.

Recommended commands:

```bash
npm run i18n:test
npm run i18n:audit
npm run seo:audit
npm run build
```
