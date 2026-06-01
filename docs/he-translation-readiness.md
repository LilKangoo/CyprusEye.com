# HE Translation Readiness

Generated: 2026-06-01T13:19:35.865Z
Source audit: `translations/audit-he-vs-en.json`

Hebrew is still internal/hidden. This report does not activate HE in the public language switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes.

## Summary

- EN keys: 2815
- HE keys: 2739
- Missing HE keys: 317
- Extra HE keys: 241
- HE keys identical to EN: 553
- HE keys added in Stage 8: 0

## Missing Keys By Rollout Group

| Grupa | Priorytet | Braki | Przyklady |
| --- | --- | ---: | --- |
| Critical UI / navigation | P0 | 0 | - |
| Errors / validation | P0 | 0 | - |
| Booking flows | P0 | 0 | - |
| Auth | P0 | 0 | - |
| Checkout / shop | P0 | 23 | `shop.footer.about`, `shop.footer.about_text`, `shop.footer.contact`, `shop.footer.privacy`, `shop.footer.returns`, `shop.footer.rights`, ... +6 |
| Partner panel | P1 | 214 | `advertise.affiliate.badge`, `advertise.affiliate.cardBadge`, `advertise.affiliate.cardDescription`, `advertise.affiliate.cardTitle`, `advertise.affiliate.cta`, `advertise.affiliate.description`, ... +6 |
| Admin | P2 | 27 | `dashboard.achievements.tab.badges`, `dashboard.achievements.tab.quests`, `dashboard.achievements.title`, `dashboard.activity.title`, `dashboard.content.comments`, `dashboard.content.photos`, ... +6 |
| Blog / public content | P1 | 0 | - |
| SEO / static meta | P1 before public launch | 53 | `seo.account.description`, `seo.account.ogDescription`, `seo.account.ogTitle`, `seo.account.title`, `seo.auth.description`, `seo.auth.ogDescription`, ... +6 |
| Low priority / internal | P3 | 0 | - |

## Quality Workflow

| Status | Znaczenie | Aktualna liczba |
| --- | --- | ---: |
| missing | Klucza nie ma w `translations/he.json`. | 317 |
| needs_human_review | Klucz istnieje, ale jest taki sam jak EN albo wymaga potwierdzenia native/review. | 553 |
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
| Critical UI / navigation | 5 | `footer.referral.facebook`, `header.brand`, `header.profile.footer.referral.facebook`, `header.sosToggle`, `mobile.nav.mediaTrips` |
| Errors / validation | 26 | `packing.guide.seasons.autumn.eveningLayer.hint`, `packing.guide.seasons.autumn.summerClothes.hint`, `packing.guide.seasons.autumn.sunscreen.hint`, `packing.guide.seasons.autumn.swimwear.hint`, `packing.guide.seasons.spring.layers.hint`, `packing.guide.seasons.spring.rainProtection.hint`, ... +6 |
| Booking flows | 27 | `carRental.calculator.breakdown.tiered`, `carRental.page.reservation.fields.email.placeholder`, `carRental.page.reservation.fields.flight.placeholder`, `carRental.page.reservation.fields.fullName.placeholder`, `carRental.page.reservation.fields.phone.placeholder`, `carRentalPfo.fleet.honda-fit-paphos.feature2`, ... +6 |
| Auth | 4 | `account.close.text`, `account.profile.labels.xp`, `profile.avatar.remove`, `profile.settings.email.placeholder` |
| Checkout / shop | 0 | - |
| Partner panel | 4 | `advertise.back`, `advertise.form.submit`, `advertise.hero.badge`, `advertise.overline` |
| Admin | 0 | - |
| Blog / public content | 5 | `community.gallery.panoramaBadge`, `plan.ui.itemType.poiShort`, `sos.embassy.email`, `sos.quick.whatsapp`, `sos.title` |
| SEO / static meta | 20 | `seo.carRental.ogDescription`, `seo.carRentalLanding.ogDescription`, `seo.carRentalPfo.description`, `seo.carRentalPfo.ogDescription`, `seo.coupon.locale`, `seo.coupon.localeAlternate`, ... +6 |
| Low priority / internal | 462 | `attractions.back`, `attractions.brand.overline`, `attractions.catalog.subtitle`, `attractions.catalog.title`, `attractions.link.achievements`, `attractions.nav.aria`, ... +6 |

## Largest Missing Roots

| Root | Braki |
| --- | ---: |
| `advertise` | 214 |
| `seo` | 53 |
| `dashboard` | 27 |
| `shop` | 23 |

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
