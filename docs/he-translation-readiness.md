# HE Translation Readiness

Generated: 2026-06-05T16:48:16.979Z
Source audit: `translations/audit-he-vs-en.json`

Hebrew is still internal/hidden. This report does not activate HE in the public language switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes.

## Summary

- EN keys: 3116
- HE keys: 2929
- Missing HE keys: 194
- Extra HE keys: 7
- HE keys identical to EN: 684
- HE keys added in Stage 8: 0

## PL/EN/HE Structure Completeness

| Check | Count |
| --- | ---: |
| PL keys missing EN | 0 |
| PL keys missing HE | 194 |
| EN keys missing PL | 94 |
| EN keys missing HE | 194 |
| HE keys missing PL | 101 |
| HE keys missing EN | 7 |
| Placeholder mismatches | 0 |
| HTML tag mismatches | 0 |

Rules:

- If a key exists in PL and is used in UI, EN must exist because EN is the primary fallback for HE.
- If a key exists in EN and is used in UI, HE must exist unless the key is explicitly parked for human review.
- If a key exists only in HE, treat it as legacy/extra until PL/EN ownership is confirmed.
- Preserve placeholders, HTML tags, and runtime tokens across PL/EN/HE.
- Long blog content, SEO meta, email templates, legal/payment copy, and dynamic marketing content require manual review before public use.

## Missing Keys By Rollout Group

| Grupa | Priorytet | Braki | Przyklady |
| --- | --- | ---: | --- |
| Critical UI / navigation | P0 | 0 | - |
| Errors / validation | P0 | 0 | - |
| Booking flows | P0 | 0 | - |
| Auth | P0 | 0 | - |
| Checkout / shop | P0 | 3 | `shop.footer.about_text`, `shop.hero.subtitle`, `shop.pageTitle` |
| Partner panel | P1 | 160 | `advertise.affiliate.badge`, `advertise.affiliate.cardBadge`, `advertise.affiliate.cardDescription`, `advertise.affiliate.cardTitle`, `advertise.affiliate.cta`, `advertise.affiliate.description`, ... +6 |
| Admin | P2 | 0 | - |
| Blog / public content | P1 | 0 | - |
| SEO / static meta | P1 before public launch | 31 | `seo.account.description`, `seo.account.ogDescription`, `seo.account.ogTitle`, `seo.account.title`, `seo.auth.description`, `seo.auth.ogDescription`, ... +6 |
| Low priority / internal | P3 | 0 | - |

## Quality Workflow

| Status | Znaczenie | Aktualna liczba |
| --- | --- | ---: |
| missing | Klucza nie ma w `translations/he.json`. | 194 |
| needs_human_review | Klucz istnieje, ale jest taki sam jak EN albo wymaga potwierdzenia native/review. | 684 |
| machine_translated | Tlumaczenie maszynowe oczekujace na review. Ten status nie jest jeszcze automatycznie sledzony. | 0 |
| reviewed | Tlumaczenie zaakceptowane przez czlowieka/native speaker. Ten status nie jest jeszcze automatycznie sledzony. | 0 |

Full machine-readable lists live in `translations/he-readiness-report.json`:

- `keysByStatus.missing`
- `keysByStatus.needs_human_review`
- `keysByStatus.machine_translated`
- `keysByStatus.reviewed`

For now, `needs_human_review` is derived from keys where HE is exactly the same value as EN. If a dedicated translation management tool is introduced later, this report can be extended to read a separate reviewed/machine-translated status file.

## Manual Review Packs

| Pack | Records |
| --- | ---: |
| Static UI | 797 |
| Advertise | 235 |
| SEO | 122 |
| Shop | 96 |
| Email/payment templates | 506 |
| Same-as-EN HE | 684 |
| Dynamic content | 237 |
| Blog | 21 |

Manual review packs are workflow files only. They do not activate Blog HE,
Shop HE, SEO HE, sitemap/hreflang/canonical HE, indexing HE or public `/he/`
routes. Import is dry-run by default through
`npm run i18n:review-import -- --input=<pack>`.

## Same As EN Risk

| Grupa | Klucze takie same jak EN | Przyklady |
| --- | ---: | --- |
| Critical UI / navigation | 6 | `footer.referral.facebook`, `header.brand`, `header.profile.footer.referral.facebook`, `header.sosToggle`, `metrics.xp.progressTemplate`, `mobile.nav.mediaTrips` |
| Errors / validation | 26 | `packing.guide.seasons.autumn.eveningLayer.hint`, `packing.guide.seasons.autumn.summerClothes.hint`, `packing.guide.seasons.autumn.sunscreen.hint`, `packing.guide.seasons.autumn.swimwear.hint`, `packing.guide.seasons.spring.layers.hint`, `packing.guide.seasons.spring.rainProtection.hint`, ... +6 |
| Booking flows | 187 | `carRental.calculator.breakdown.tiered`, `carRental.categories.comfort.badge`, `carRental.categories.comfort.description`, `carRental.categories.comfort.label`, `carRental.categories.economy.badge`, `carRental.categories.economy.description`, ... +6 |
| Auth | 4 | `account.close.text`, `account.profile.labels.xp`, `profile.avatar.remove`, `profile.settings.email.placeholder` |
| Checkout / shop | 0 | - |
| Partner panel | 4 | `advertise.form.placeholders.email`, `advertise.form.placeholders.phone`, `advertise.form.placeholders.website`, `advertise.overline` |
| Admin | 0 | - |
| Blog / public content | 5 | `community.gallery.panoramaBadge`, `plan.ui.itemType.poiShort`, `sos.embassy.email`, `sos.quick.whatsapp`, `sos.title` |
| SEO / static meta | 19 | `seo.carRental.ogDescription`, `seo.carRentalPfo.description`, `seo.carRentalPfo.ogDescription`, `seo.coupon.locale`, `seo.coupon.localeAlternate`, `seo.coupon.ogDescription`, ... +6 |
| Low priority / internal | 433 | `attractions.brand.overline`, `attractions.catalog.subtitle`, `attractions.nav.catalog`, `attractions.nav.current`, `attractions.subtitle`, `cruise.back`, ... +6 |

## Largest Missing Roots

| Root | Braki |
| --- | ---: |
| `advertise` | 160 |
| `seo` | 31 |
| `shop` | 3 |

## Recommended Fill Order

1. P0 static UI: `common`, `nav`, `header`, `mobile`, `modal`, accessibility and global buttons.
2. P0 flows: booking validation/status, transport, car rental, trips/hotels booking, shop checkout and cart.
3. P0 auth/account: login, reset, profile, account security and user-facing status copy.
4. P1 public content shell: homepage, blog UI, plan, recommendations, map and community labels.
5. P1 SEO/static meta preparation: translate, review and keep hidden until SEO rollout is explicitly enabled.
6. P2/P3 partner/admin/internal copy after the public critical path is stable.

## Manual Review Rules

- Do not bulk-publish machine translated long marketing copy without human review.
- Preserve placeholders like `{{value}}`, HTML tags, line breaks and punctuation tokens.
- Prefer English fallback over Polish fallback for HE until native Hebrew text is reviewed.
- Mark each completed batch as reviewed in the translation workflow before public HE activation.

## Related Checklist

Public launch gates and dynamic content readiness are tracked in `docs/he-public-rollout-checklist.md`.
