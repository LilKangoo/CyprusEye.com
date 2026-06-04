# HE Manual Translation Export / Import Workflow

Status: **manual review workflow only**.

This workflow does not enable global HE, Blog HE public, Shop HE, SEO HE,
sitemap HE, hreflang HE, canonical HE, indexing HE or public `/he/` routes.
It does not touch booking/payment, partner fulfillment, Stripe webhook or
transport deposit flow.

## Generate Review Packs

Run:

```bash
npm run i18n:tri-audit
npm run i18n:review-export
```

Generated files:

| File | Purpose |
| --- | --- |
| `translations/manual-review/static-ui-review.json` | Static UI keys that still need manual decision or review. |
| `translations/manual-review/advertise-review.json` | Long advertise/partner copy. Manual review only. |
| `translations/manual-review/seo-review.json` | SEO copy preparation. SEO HE remains off. |
| `translations/manual-review/shop-review.json` | Shop copy backlog. Shop HE remains excluded. |
| `translations/manual-review/email-template-review.json` | Email/payment/notification template review. |
| `translations/manual-review/same-as-en-review.json` | HE values identical to EN, classified for decision. |
| `translations/manual-review/dynamic-content-review.json` | Read-only Supabase dynamic content export where available. |
| `translations/manual-review/blog-review.json` | Blog manual translation backlog. No `public_ready` automation. |
| `translations/manual-review/review-pack-summary.json` | Counts and safety summary. |

Each record includes:

- `key` / `record_id`
- `module`
- PL source
- EN source
- current HE value
- missing EN / missing HE flags
- same-as-EN flag and classification
- placeholder/tag status
- human review requirement
- recommended action
- notes
- `safe_to_auto_apply`

Current policy sets `safe_to_auto_apply=false` for these packs. They are review
inputs, not publishing instructions.

## Fill Translations Manually

For static JSON keys, add one of these fields to the reviewed record before
import:

- `reviewed_he`
- `new_he`
- `reviewed_value` for HE-only update
- `target_value` for HE-only update

If an EN source key must be filled manually, set:

- `target_language: "en"`
- `reviewed_en: "..."`

Source-language updates require an explicit import flag and should be rare.

Never add these fields to trigger publication:

- `public_ready`
- `mark_public_ready`
- `review_status: "public_ready"`

The importer rejects those changes.

## Validate Import Dry-run

Run dry-run first:

```bash
npm run i18n:review-import -- --input=translations/manual-review/static-ui-review.json
```

Dry-run writes:

```text
translations/manual-review/import-dry-run-report.json
```

The dry-run validates:

- placeholders such as `{{name}}`, `{amount}`, `%s`, `%d`
- HTML tags
- target language
- static translation key shape
- no `public_ready` attempt

Dynamic/database records are skipped by this importer. Use admin UI or reviewed
manual SQL for dynamic content.

## Apply Static JSON Changes

Apply only after dry-run is clean:

```bash
npm run i18n:review-import -- --input=translations/manual-review/static-ui-review.json --apply
```

For EN/PL source-key repairs:

```bash
npm run i18n:review-import -- --input=translations/manual-review/static-ui-review.json --apply --allow-source-language-update
```

After apply:

```bash
npm run i18n:tri-audit
npm run i18n:audit
npm run i18n:he-readiness
npm run i18n:test
npm run build
```

## Dynamic Content Workflow

Use `translations/manual-review/dynamic-content-review.json` to decide which
records require manual translation.

Recommended edit path:

| Module | Preferred edit path | Public-ready gate |
| --- | --- | --- |
| Blog | Admin/partner Blog editor | `review_status='public_ready'` only after manual review |
| Trips | Admin trips editor or reviewed narrow SQL | Record-level HE readiness |
| Hotels | Admin hotels editor or reviewed narrow SQL | Page/record readiness |
| Cars | Admin cars editor or reviewed narrow SQL | Record-level HE readiness |
| POI | Admin POI i18n form | Record-level HE readiness |
| Recommendations | Admin recommendations form | Page/record readiness |
| Shop | Shop admin only in a dedicated Shop stage | Shop remains excluded |
| Email templates | Admin email template workspace | Live DB sending separate from translation |

Do not use the static importer for database records.

## Blog Manual Rules

Blog remains blocked until specific posts are manually reviewed.

Workflow:

1. Export `blog-review.json`.
2. Translate title, slug, lead, summary, content, categories and tags manually.
3. Save/reload in admin or partner panel.
4. Run duplicate slug and public-read verify SQL.
5. Mark `public_ready` only with the dedicated Stage42 apply SQL after manual
   approval.
6. Verify again before Blog page-gated rollout.

Codex must not auto-translate full Blog posts or mark Blog rows `public_ready`.

## SEO Manual Rules

SEO HE remains off.

Workflow:

1. Export `seo-review.json`.
2. Translate meta title/description manually.
3. Validate length and duplicated slugs/canonicals.
4. Keep sitemap/hreflang/canonical/indexing off until a dedicated SEO stage.

Translation does not activate SEO.

## Email / Payment Template Rules

Email/payment copy is placeholder-sensitive.

Always verify:

- deposit/payment amount placeholders
- booking reference
- customer/partner/admin names
- payment URL
- currency
- service summary

Do not change:

- transport deposit calculation
- partner fulfillment
- Stripe webhook
- notification dispatch logic

Translation review and live sending are separate gates.

## Rollback

Static JSON rollback:

1. Restore the affected keys from git.
2. Run `npm run i18n:tri-audit`.
3. Run `npm run i18n:test`.
4. Rebuild and redeploy if necessary.

Dynamic content rollback:

1. Move the affected record back to `needs_review` or clear only the HE field
   that was wrong.
2. Keep page readiness unchanged until verify is clean.
3. Never drop HE columns as rollback.

Blog public-ready rollback:

1. Change `review_status` from `public_ready` to `reviewed` or `needs_review`.
2. Keep Blog blocked or record-gated.
3. Purge cache after any public readiness change.
