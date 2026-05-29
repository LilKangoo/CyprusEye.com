# HE Beta Hidden Journey Final

Generated: 2026-05-29

HE remains internal/beta-only. This checklist does not enable public HE, the
public language switcher, sitemap, hreflang, canonical metadata, SEO, indexing,
or public `/he/` routes.

## Stage 17 Files

- Apply manually after review: `supabase/manual/he_beta_content_pack_stage17_apply.sql`
- Verify after apply: `supabase/manual/he_beta_verify_after_apply.sql`
- Stage 16 source pack remains rollback-safe: `supabase/manual/he_beta_content_pack_stage16.sql`

## Content Pack Review

| Check | Result | Note |
| --- | --- | --- |
| Does not update PL/EN source fields directly | Passed | Adds/fills HE-only values or `*.he` JSONB keys |
| Narrow beta scope only | Passed | 5 blog, 9 transport locations, 10 POI, 5 recommendations, 3 trips, 2 hotels, 5 cars |
| Blog slugs valid | Passed | ASCII lowercase hyphen slugs matching `blog_post_translations.slug` constraint |
| Blog IDs match selected posts | Passed | Uses the 5 Stage 15 post IDs |
| POI IDs match real table IDs | Passed | Uses `pois.id`; no dependency on missing `pois.slug` |
| JSONB structure valid by construction | Passed | Uses `jsonb_set`, `to_jsonb`, and TipTap-like `doc/content` structure |
| Public exposure changes | Passed | No switcher, SEO, sitemap, hreflang, canonical, indexing or route changes |
| SQL helper scope | Fixed for Stage 17 | Uses `pg_temp` helper functions instead of persistent schema functions |

Review status: `safe to apply on staging/beta after human content review`.

Human review is still required for the Hebrew wording. The pack is technically
safe, but it is not public-launch reviewed content.

## Hidden HE Journey

Run after applying `supabase/manual/he_beta_content_pack_stage17_apply.sql` on
staging/beta and then running `supabase/manual/he_beta_verify_after_apply.sql`.

| Step | Flow | Expected HE result | Fallback / safety check |
| ---: | --- | --- | --- |
| 1 | Home `/?ce_he_preview=1&lang=he` | Page is `lang=he`, `dir=rtl`; core UI comes from P0 static HE | Public selector still hides HE |
| 2 | Blog list | 5 scoped posts show HE title/summary/taxonomy after apply | Non-scoped posts may fallback to EN |
| 3 | Blog detail | Selected HE post opens with HE slug/title/lead/content | No public SEO HE or hreflang HE |
| 4 | Map | Map loads without horizontal overflow | Non-scoped POI may fallback to EN |
| 5 | POI card/detail | 10 scoped POI show HE name/description/badge | No blank badges or `undefined` labels |
| 6 | Recommendation card/detail | 5 scoped cards show HE title/description/category/offer | CTA labels remain static P0 HE |
| 7 | Trip | 3 scoped trips show HE title/description | Booking labels and validation use static P0 HE |
| 8 | Hotel | 2 scoped hotels show HE title/description | Amenities may fallback unless translated later |
| 9 | Car | 5 scoped cars show HE model/features | Price, dates and numeric summary remain stable |
| 10 | Transport | 9 selected locations show HE names in forms and summary | Route pricing and validation unchanged |

## Fail Conditions

- Public `?lang=he` activates HE for a non-beta user.
- HE appears in public switcher, sitemap, hreflang, canonical, SEO or `/he/`.
- Any scoped card shows `undefined`, `null`, empty title, or empty CTA.
- Any scoped flow falls back to PL while EN exists.
- Map overlays, modals, dropdowns or booking summaries overflow on mobile.
- Shop appears as a Hebrew customer checkout experience.

## Invite-Only Beta Assessment

After the apply file is reviewed and committed on staging/beta:

| Module | Invite-only beta status | Remaining review |
| --- | --- | --- |
| Home shell / navigation | Ready | Standard RTL smoke |
| Blog scoped posts | Ready after apply | Hebrew editorial review |
| Transport scoped locations | Ready after apply | Name wording review |
| POI scoped records | Ready after apply | Description/badge wording review |
| Recommendations scoped records | Ready after apply | Partner copy/offer review |
| Trips scoped records | Ready after apply | Tour description review |
| Hotels scoped records | Ready after apply | Property description review |
| Cars scoped records | Ready after apply | Feature label review |
| Shop | Out of scope | Separate shop HE pass before paid beta |
| SEO/public indexing | Out of scope | Later public-launch stage only |

Estimated invite-only beta readiness after apply and hidden journey QA: 85-90%.

Public launch readiness remains below 50% because HE SEO, sitemap, hreflang,
canonical/indexing, full dynamic content and Shop are intentionally not ready.

## Manual Run Order

1. Run `supabase/manual/he_beta_content_pack_stage16.sql` unchanged first if you
   want a transaction preview; it ends with `ROLLBACK`.
2. Review output and Hebrew text.
3. Run `supabase/manual/he_beta_content_pack_stage17_apply.sql` on staging/beta.
4. Run `supabase/manual/he_beta_verify_after_apply.sql`.
5. Run hidden journey smoke with `?ce_he_preview=1&lang=he`.
6. Keep public `?lang=he`, `/he/`, SEO, sitemap and hreflang blocked.
