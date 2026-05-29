# HE P0 Human Review Notes

Generated: 2026-05-29T15:29:48.022Z
Stage: stage13_p0_static

HE remains hidden/public-off. This report only tracks Stage 13 static P0 translation follow-up.

## Summary

- P0 keys considered in the Stage 13 translation batch: 1259
- P0 missing keys before Stage 13: 883
- P0 missing keys after Stage 13: 25
- P0 same-as-EN review keys before Stage 13: 376
- P0 same-as-EN review keys after Stage 13: 122
- P0 static coverage after Stage 13: 98.3%
- P0 review-adjusted readiness after Stage 13: 90.1%
- Intentionally skipped non-critical marketing/content keys: 140
- Unresolved P0 keys needing manual translation in the Stage 13 batch: 0

## Human Review Required

The Stage 13 Hebrew values are beta-prep translations and must be reviewed by a
Hebrew speaker before public launch. Review is especially important for:

- booking confirmations, deposits, coupon terms and payment-adjacent copy
- transport and car rental validation/status messages
- auth/account/security wording
- checkout/shop critical labels
- direction-sensitive button labels that include arrows or icons

Current remaining P0 same-as-EN keys are tracked in
`translations/he-readiness-report.json -> sameAsEnglishGroups.*`. Some are brand
names, product names, placeholders, or intentionally English terms; each should
be explicitly accepted or replaced before public launch.

## Intentionally Skipped

These keys are P0 by broad prefix grouping, but were not translated in Stage 13 because they are long marketing/editorial copy or SEO-like content rather than controlled-beta form/navigation copy.

- `carRentalPfo.page.benefits.aria`
- `carRentalPfo.page.benefits.flexible.body`
- `carRentalPfo.page.benefits.flexible.title`
- `carRentalPfo.page.benefits.nature.body`
- `carRentalPfo.page.benefits.nature.title`
- `carRentalPfo.page.benefits.package.body`
- `carRentalPfo.page.benefits.package.title`
- `carRentalPfo.page.fleet.description`
- `carRentalPfo.page.hero.description`
- `carRentalPfo.page.hero.note.link`
- `carRentalPfo.page.hero.note.prefix`
- `carRentalPfo.page.hero.note.suffix`
- `coupon.conditions.rules.cash`
- `coupon.conditions.rules.combine`
- `coupon.conditions.rules.groupIntro`
- `coupon.conditions.rules.groupMultiple`
- `coupon.conditions.rules.groupStay`
- `coupon.conditions.rules.named`
- `coupon.conditions.rules.show`
- `coupon.conditions.rules.usage`
- `coupon.conditions.rules.verify`
- `coupon.conditions.title`
- `coupon.hero_kicker`
- `coupon.how.step1.description`
- `coupon.how.step1.noteMultiple`
- `coupon.how.step1.noteSingle`
- `coupon.how.step1.title`
- `coupon.how.step2.description`
- `coupon.how.step2.title`
- `coupon.how.step3.description`
- `coupon.how.step3.title`
- `coupon.how.subtitle`
- `coupon.how.title`
- `coupon.offers.items.davinci.benefit`
- `coupon.offers.items.davinci.category`
- `coupon.offers.items.davinci.title`
- `coupon.offers.items.lefkaraLong.benefit`
- `coupon.offers.items.lefkaraLong.category`
- `coupon.offers.items.lefkaraLong.title`
- `coupon.offers.items.lefkaraShort.benefit`
- `coupon.offers.items.lefkaraShort.category`
- `coupon.offers.items.lefkaraShort.title`
- `coupon.offers.items.noDeposit.benefit`
- `coupon.offers.items.noDeposit.category`
- `coupon.offers.items.noDeposit.title`
- `coupon.offers.items.noDepositPaphos.benefit`
- `coupon.offers.items.noDepositPaphos.category`
- `coupon.offers.items.noDepositPaphos.title`
- `coupon.offers.items.photo.benefit`
- `coupon.offers.items.photo.category`
- `coupon.offers.items.photo.title`
- `coupon.offers.items.privateCruise.benefit`
- `coupon.offers.items.privateCruise.category`
- `coupon.offers.items.privateCruise.title`
- `coupon.offers.items.silver.benefit`
- `coupon.offers.items.silver.category`
- `coupon.offers.items.silver.title`
- `coupon.offers.items.tours.benefit`
- `coupon.offers.items.tours.category`
- `coupon.offers.items.tours.title`
- `coupon.offers.items.transport.benefit`
- `coupon.offers.items.transport.category`
- `coupon.offers.items.transport.title`
- `coupon.offers.subtitle`
- `coupon.offers.title`
- `coupon.recommendations.seo.description`
- `coupon.recommendations.seo.title`
- `coupon.smallprint`
- `coupon.subtitle`
- `coupon.summary.instant`
- `coupon.summary.price_current`
- `coupon.summary.price_label`
- `coupon.summary.price_note`
- `coupon.summary.price_original`
- `coupon.summary.secure`
- `coupon.summary.secure_note`
- `coupon.summary.support`
- `coupon.title`
- `packing.guide.seasons.autumn.camera.hint`
- `packing.guide.seasons.autumn.eveningLayer.hint`
- `packing.guide.seasons.autumn.rainProtection.hint`
- `packing.guide.seasons.autumn.sandals.hint`
- `packing.guide.seasons.autumn.summerClothes.hint`
- `packing.guide.seasons.autumn.sunAccessories.hint`
- `packing.guide.seasons.autumn.sunscreen.hint`
- `packing.guide.seasons.autumn.swimwear.hint`
- `packing.guide.seasons.autumn.trekkingShoes.hint`
- `packing.guide.seasons.spring.camera.hint`
- `packing.guide.seasons.spring.layers.hint`
- `packing.guide.seasons.spring.longSleeves.hint`
- `packing.guide.seasons.spring.rainProtection.hint`
- `packing.guide.seasons.spring.scarf.hint`
- `packing.guide.seasons.spring.shoes.hint`
- `packing.guide.seasons.spring.sunAccessories.hint`
- `packing.guide.seasons.spring.sunscreen.hint`
- `packing.guide.seasons.spring.swimwear.hint`
- `packing.guide.seasons.summer.afterSun.hint`
- `packing.guide.seasons.summer.bottle.hint`
- `packing.guide.seasons.summer.clothing.hint`
- `packing.guide.seasons.summer.coverUp.hint`
- `packing.guide.seasons.summer.footwear.hint`
- `packing.guide.seasons.summer.hat.hint`
- `packing.guide.seasons.summer.sunscreen.hint`
- `packing.guide.seasons.summer.swimwear.hint`
- `packing.guide.seasons.summer.towel.hint`
- `packing.guide.seasons.summer.waterproofCase.hint`
- `packing.guide.seasons.winter.accessories.hint`
- `packing.guide.seasons.winter.boots.hint`
- `packing.guide.seasons.winter.coat.hint`
- `packing.guide.seasons.winter.equipmentPlan.hint`
- `packing.guide.seasons.winter.layers.hint`
- `packing.guide.seasons.winter.rainProtection.hint`
- `packing.guide.seasons.winter.sunglasses.hint`
- `packing.guide.seasons.winter.thermal.hint`
- `packing.guide.seasons.winter.thermos.hint`
- `shop.footer.about`
- `shop.footer.about_text`
- `shop.footer.contact`
- `shop.footer.privacy`
- `shop.footer.returns`
- `shop.footer.rights`
- `shop.footer.ship1`
- `shop.footer.ship2`
- `shop.footer.ship3`
- `shop.footer.shipping_info`
- `shop.footer.terms`
- `shop.hero.badge`
- `shop.hero.gift.desc`
- `shop.hero.gift.title`
- `shop.hero.quality.desc`
- `shop.hero.quality.title`
- `shop.hero.shipping.desc`
- `shop.hero.shipping.title`
- `shop.hero.subtitle`
- `shop.hero.title`
- `shop.pageTitle`
- `shop.subtitle`
- `shop.title`
- `vip.calculator.output.empty`
- `vip.reservation.price.empty`

## Needs Human Review / Manual Translation

