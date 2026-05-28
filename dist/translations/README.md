# Translation Status

This folder contains the static translation JSON files used by the public frontend and internal panels.

## Current HE Policy

Hebrew (`he`) is still internal/hidden. Do not expose it in the public language switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes until the final rollout checklist is complete.

Hidden runtime preview is allowed only through the developer QA flow:

```text
?ce_he_preview=1&lang=he
```

Plain `?lang=he` must remain ignored publicly until the final activation stage.

## Audit Commands

```bash
npm run i18n:audit
npm run i18n:he-readiness
npm run i18n:test
```

`npm run i18n:audit` writes `translations/audit-he-vs-en.json`.

`npm run i18n:he-readiness` writes:

- `translations/he-readiness-report.json`
- `docs/he-translation-readiness.md`

## Quality Workflow

Use these statuses while preparing Hebrew:

| Status | Meaning |
| --- | --- |
| `missing` | Key is absent from `translations/he.json`. |
| `machine_translated` | Value was machine translated and must be reviewed before public launch. |
| `needs_human_review` | Value exists but needs native/human review, including values identical to EN. |
| `reviewed` | Value was reviewed and accepted for public launch. |

Do not bulk-publish long marketing or SEO copy from machine translation without review. Preserve JSON keys, placeholders like `{{value}}`, HTML tags and punctuation tokens.

## Rollout Checklists

- Static HE readiness: `docs/he-translation-readiness.md`
- Machine-readable HE readiness: `translations/he-readiness-report.json`
- Public launch gates and dynamic content readiness: `docs/he-public-rollout-checklist.md`
