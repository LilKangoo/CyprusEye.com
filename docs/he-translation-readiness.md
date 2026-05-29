# HE Translation Readiness

Generated: 2026-05-28T22:59:52.783Z
Source audit: `translations/audit-he-vs-en.json`

Hebrew is still internal/hidden. This report does not activate HE in the public language switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes.

## Summary

- EN keys: 2815
- HE keys: 1557
- Missing HE keys: 1503
- Extra HE keys: 245
- HE keys identical to EN: 936
- HE keys added in Stage 8: 0

## Missing Keys By Rollout Group

| Grupa | Priorytet | Braki | Przyklady |
| --- | --- | ---: | --- |
| Critical UI / navigation | P0 | 107 | `accessibility.skipToContent`, `common.close`, `common.save`, `footer.app.tagline`, `footer.referral.copied`, `footer.referral.copy`, ... +6 |
| Errors / validation | P0 | 196 | `account.loading`, `account.security.password.hint`, `account.security.username.hint`, `account.xpEvents.empty`, `advertise.form.feedback.error`, `advertise.form.feedback.success`, ... +6 |
| Booking flows | P0 | 380 | `carRental.calculator.breakdown.package3`, `carRental.calculator.breakdown.tiered`, `carRental.calculator.confirmationNote`, `carRental.calculator.fillButton`, `carRental.calculator.successMessage`, `carRental.calculator.successTitle`, ... +6 |
| Auth | P0 | 110 | `account.close.attributes.aria-label`, `account.close.text`, `account.profile.desc`, `account.profile.heading`, `account.profile.labels.displayName`, `account.profile.labels.email`, ... +6 |
| Checkout / shop | P0 | 90 | `shop.cart.aria`, `shop.cart.checkout`, `shop.cart.continue`, `shop.cart.remove`, `shop.cart.shipping_note`, `shop.cart.subtotal`, ... +6 |
| Partner panel | P1 | 223 | `advertise.affiliate.badge`, `advertise.affiliate.cardBadge`, `advertise.affiliate.cardDescription`, `advertise.affiliate.cardTitle`, `advertise.affiliate.cta`, `advertise.affiliate.description`, ... +6 |
| Admin | P2 | 27 | `dashboard.achievements.tab.badges`, `dashboard.achievements.tab.quests`, `dashboard.achievements.title`, `dashboard.activity.title`, `dashboard.content.comments`, `dashboard.content.photos`, ... +6 |
| Blog / public content | P1 | 317 | `badges.landmark`, `blogUi.admin.allowComments`, `blogUi.admin.approve`, `blogUi.admin.featured`, `blogUi.admin.newPost`, `blogUi.admin.reject`, ... +6 |
| SEO / static meta | P1 before public launch | 53 | `seo.account.description`, `seo.account.ogDescription`, `seo.account.ogTitle`, `seo.account.title`, `seo.auth.description`, `seo.auth.ogDescription`, ... +6 |
| Low priority / internal | P3 | 0 | - |

## Quality Workflow

| Status | Znaczenie | Aktualna liczba |
| --- | --- | ---: |
| missing | Klucza nie ma w `translations/he.json`. | 1503 |
| needs_human_review | Klucz istnieje, ale jest taki sam jak EN albo wymaga potwierdzenia native/review. | 936 |
| machine_translated | Tlumaczenie maszynowe oczekujace na review. Ten status nie jest jeszcze automatycznie sledzony. | 0 |
| reviewed | Tlumaczenie zaakceptowane przez czlowieka/native speaker. Ten status nie jest jeszcze automatycznie sledzony. | 0 |

Full machine-readable lists live in `translations/he-readiness-report.json`:

- `keysByStatus.missing`
- `keysByStatus.needs_human_review`
- `keysByStatus.machine_translated`
- `keysByStatus.reviewed`

For now, `needs_human_review` is derived from keys where HE is exactly the same value as EN. If a dedicated translation management tool is introduced later, this report can be extended to read a separate reviewed/machine-translated status file.

## Same As EN Risk

| Grupa | Klucze takie same jak EN | Przyklady |
| --- | ---: | --- |
| Critical UI / navigation | 10 | `header.brand`, `header.logoAlt`, `header.sosToggle`, `mobile.nav.mediaTrips`, `notifications.close`, `notifications.empty`, ... +4 |
| Errors / validation | 83 | `account.error.currentMissing`, `account.error.loginRequired`, `account.error.password.invalidCurrent`, `account.error.password.loginRequired`, `account.error.password.mismatch`, `account.error.password.missingFields`, ... +6 |
| Booking flows | 251 | `carRental.brand.title`, `carRental.calculator.breakdown.pickupIncluded`, `carRental.calculator.breakdown.pickupWithFee`, `carRental.calculator.breakdown.returnIncluded`, `carRental.calculator.breakdown.returnWithFee`, `carRental.calculator.breakdown.title`, ... +6 |
| Auth | 32 | `account.close`, `account.password.confirm`, `account.password.current`, `account.password.guestNote`, `account.password.new`, `account.password.submit`, ... +6 |
| Checkout / shop | 0 | - |
| Partner panel | 4 | `advertise.back`, `advertise.form.submit`, `advertise.hero.badge`, `advertise.overline` |
| Admin | 0 | - |
| Blog / public content | 65 | `sos.close`, `sos.description`, `sos.embassy.address`, `sos.embassy.email`, `sos.embassy.hotline`, `sos.embassy.reception`, ... +6 |
| SEO / static meta | 20 | `seo.carRental.ogDescription`, `seo.carRentalLanding.ogDescription`, `seo.carRentalPfo.description`, `seo.carRentalPfo.ogDescription`, `seo.coupon.locale`, `seo.coupon.localeAlternate`, ... +6 |
| Low priority / internal | 471 | `attractions.back`, `attractions.brand.overline`, `attractions.catalog.subtitle`, `attractions.catalog.title`, `attractions.link.achievements`, `attractions.nav.aria`, ... +6 |

## Largest Missing Roots

| Root | Braki |
| --- | ---: |
| `advertise` | 218 |
| `transport` | 205 |
| `plan` | 155 |
| `carRental` | 103 |
| `shop` | 94 |
| `carRentalPfo` | 70 |
| `community` | 63 |
| `seo` | 53 |
| `profile` | 50 |
| `carRentalLanding` | 49 |
| `header` | 40 |
| `coupon` | 36 |
| `account` | 35 |
| `tasks` | 30 |
| `dashboard` | 29 |
| `blogUi` | 28 |
| `home` | 22 |
| `resetPage` | 22 |
| `trips` | 22 |
| `tutorial` | 21 |

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
