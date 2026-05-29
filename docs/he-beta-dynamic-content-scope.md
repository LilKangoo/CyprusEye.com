# HE Beta Dynamic Content Scope

Generated: 2026-05-29

HE remains internal/beta-only. This scope does not enable public HE, the public
language switcher, sitemap, hreflang, canonical metadata, SEO, indexing, or
public `/he/` routes.

This document narrows the first controlled HE beta to a small set of manually
reviewed dynamic records. It is intentionally not a full translation plan for
the whole platform.

## First Controlled Beta Scope

| Area | Selected scope | Beta decision | Human review |
| --- | ---: | --- | --- |
| Blog | 5 top posts | Include only selected posts after HE translation rows exist | Required |
| Blog taxonomy | Key categories/tags only | Include for selected posts | Required |
| Transport locations | 9 locations | Include after `name_he` is reviewed | Recommended |
| POI | Top 10 POI | Include map/recommendations with selected HE records only | Required |
| Recommendations | Top 5 partner recommendations | Include selected cards only after HE copy review | Required |
| Shop | Audit only | Keep out of first HE beta, or EN fallback only for internal testers | Required before paid beta |
| Trips | 3 top trips | Include only as fallback-safe, translate before content beta | Required |
| Hotels | 2 hotels | Include only as fallback-safe, translate descriptions before content beta | Required |
| Cars | 5 top cars | Include with model fallback accepted; translate features/types before content beta | Required |

## Blog Top Posts

These are the 5 blog posts selected for the first HE content beta. Do not treat
blog as ready until each selected post has a reviewed `blog_post_translations`
row with `lang = 'he'`.

| Priority | Topic | Post ID | EN slug | PL slug | HE fields required |
| ---: | --- | --- | --- | --- | --- |
| 1 | Tourism / affiliate earning | `0477e103-ee8a-47b3-9b54-69757dfbc07f` | `how-to-earn-from-tourism-in-cyprus-cypruseye-affiliate-system` | `jak-zarabiac-na-turystyce-na-cyprze-system-afiliacyjny-cypruseye` | slug, title, meta_description, summary, lead, content_html, categories_he, tags_he |
| 2 | ETIAS | `2a59c0a7-52fd-498f-b4fe-d0d76617c882` | `etias-cyprus-2026` | `etias-cypr-2026` | slug, title, meta_description, summary, lead, content_html, categories_he, tags_he |
| 3 | Cyprus in 7 days | `2e88f39b-5b5c-4e04-82b5-c125f19920b3` | `cyprus-in-7-days-itinerary` | `cypr-w-7-dni-gotowy-plan-podrozy` | slug, title, meta_description, summary, lead, content_html, categories_he, tags_he |
| 4 | Car rental without deposit | `a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef` | `car-rental-cyprus-no-deposit-cypruseye` | `wynajem-samochodu-cypr-bez-kaucji-cypruseye` | slug, title, meta_description, summary, lead, content_html, categories_he, tags_he |
| 5 | Larnaca vs Paphos | `1c1f8eb6-c709-4302-8611-6322b5ed5fad` | `larnaca-or-paphos-where-to-stay-in-cyprus` | `larnaka-czy-pafos-gdzie-lepiej-leciec` | slug, title, meta_description, summary, lead, content_html, categories_he, tags_he |

### Blog Translation Checklist

- Create or edit only `blog_post_translations.lang = 'he'`.
- Keep EN/PL translation rows unchanged.
- Use short Hebrew slugs without spaces; example style: `etias-cyprus-2026-hebrew` or a reviewed Hebrew transliteration.
- Fill `title`, `meta_description`, `summary`, `lead`, `content_html` and `content_json` where the editor requires it.
- Add `categories_he` and `tags_he` on `blog_posts` for the selected posts.
- Reopen each post in Admin and Partner flow after save to confirm persistence.
- Mark every machine-assisted translation as `needs human review` outside runtime before beta.

## Blog Taxonomy HE

Use these as the first taxonomy vocabulary. Terms should be reviewed by a
native Hebrew speaker before public launch.

| Source term | HE value | Review note |
| --- | --- | --- |
| Guide | מדריך | Review |
| Car | רכב | Review |
| Trips | טיולים | Review |
| Hotels | מלונות | Review |
| Transport | תחבורה | Review |
| Cyprus | קפריסין | Review |
| Paphos / Pafos | פאפוס | Review |
| Larnaca | לרנקה | Review |
| Ayia Napa | איה נאפה | Review |
| Affiliate | אפיליאציה | Needs business wording review |
| ETIAS | ETIAS | Keep acronym unless Hebrew editorial style changes it |
| Troodos | טרודוס | Review |
| Nicosia | ניקוסיה | Review |

## Transport Locations

The first beta can include transport after these 9 `transport_locations.name_he`
values are reviewed and saved. Route descriptions are not in scope for this
stage.

| Code | Current name | Suggested HE | Row ID |
| --- | --- | --- | --- |
| `larnaca` | Larnaca | לרנקה | `028d87d2-a743-48e7-8897-174ccd492168` |
| `larnaca_airport` | Larnaca Airport | נמל התעופה לרנקה | `a29fa9a8-483b-4630-a9d5-1df3a8d86eba` |
| `paphos` | Paphos | פאפוס | `b07a74b5-e4f0-4dbe-bb7b-e16a37e9cb99` |
| `paphos_airport` | Paphos Airport | נמל התעופה פאפוס | `a83cb43c-6a76-4534-b0a9-0595cc445041` |
| `ayia_napa` | Ayia Napa | איה נאפה | `6f912927-9d70-46dc-88bf-eb57daf64a66` |
| `protaras` | Protaras | פרוטארס | `d076be12-b07e-4404-a7f5-44218723763b` |
| `limassol` | Limassol | לימסול | `525342cf-3861-4c99-b051-827c785604a5` |
| `nicosia` | Nicosia | ניקוסיה | `6759e171-7b93-4b8c-a924-4f79cd2bc272` |
| `lefkara` | Lefkara | לפקרה | `b498d19a-008b-4f44-b1f1-da0532688c1a` |

## POI Minimal HE

Do not translate all 139 POI for the first beta. Use this top-10 shortlist and
review `name_i18n.he`, `description_i18n.he` and `badge_i18n.he` manually.

| Priority | POI ID / slug | Current status | Beta requirement |
| ---: | --- | --- | --- |
| 1 | `larnaca-beach` | Partial HE name/description exists, badge missing | Review existing HE and add badge |
| 2 | `limassol-marina` | Partial HE name/description exists, badge missing | Review existing HE and add badge |
| 3 | `nicosia-old-town` | Partial HE name/description exists, badge missing | Review existing HE and add badge |
| 4 | `Love-Bridge` | EN fallback | Add HE name, short description and badge |
| 5 | `konnos-bay-beach` | EN fallback | Add HE name, short description and badge |
| 6 | `cape-greco-sea-caves` | EN fallback | Add HE name, short description and badge |
| 7 | `Cyclops-Cave` | EN fallback | Add HE name, short description and badge |
| 8 | `saint-lazarus-church` | EN fallback | Add HE name, short description and badge |
| 9 | `famagusta-old-town` | EN fallback | Add HE name, short description and badge |
| 10 | `larnaca-castle` | EN fallback | Add HE name, short description and badge |

If any slug above is not present in the current POI table during manual entry,
replace it with the next high-traffic POI from the map audit rather than adding
a new record.

## Recommendations Minimal HE

Use only 5 partner recommendation cards in the first HE beta. Business names
may remain as brand names, but descriptions, category labels, discount/offer
text and CTA-adjacent copy require review.

| Priority | Recommendation ID | Title | Category | Beta requirement |
| ---: | --- | --- | --- | --- |
| 1 | `c085ebc6-1de8-4963-954a-8c67b56db892` | Avramis Jewellery Shop | Shop | Add title_he if localized brand style is needed, description_he, category HE |
| 2 | `6013a7c6-f8a1-4259-8286-fb43a88f3a53` | Kaffenest | Caffe | Add description_he and category HE |
| 3 | `feaf6154-bc82-4208-a0c6-21d6ada9e5af` | Restaurant Da Vinci's Garden | Restaurants | Review existing category HE, add description_he |
| 4 | `7451b6d5-9f5e-466e-8256-acb401650c3b` | Lefkara Da Vinci Cafe & Traditional Italian Pizza | Restaurants | Review existing category HE, add description_he |
| 5 | `d7bf97d4-7175-4fee-bbea-eb491d72e101` | G-Raf Silversmith | Shop | Add description_he and category HE |

## Shop P0 Audit

Shop stays out of the first HE customer beta. Current dynamic readiness is 0%
across products, categories, vendors, shipping classes/zones/methods,
attributes and attribute values.

Recommended first beta decision:

- Do not promote shop as a Hebrew experience.
- Keep shop hidden from the HE beta navigation if the beta tester expects a
  Hebrew-only flow.
- If shop must remain visible for internal QA, allow EN fallback and label the
  test as content-incomplete.
- Do not run a paid HE checkout beta until product, shipping and discount copy
  has reviewed HE.

## Trips Minimal Scope

Trips can render through fallback, but no trip has HE title/description yet.
Use only these 3 records for the first content-prep pass.

| Priority | Trip ID | Slug | EN title | Start city | Must have HE | EN fallback allowed |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `47fd4793-647b-45fd-a2ce-1ecaa4b95922` | `trasa-blue-lagoon` | Blue lagoon | Paphos | title, description | price, numeric booking details |
| 2 | `2d937b4f-3da7-4fed-bc06-bdc66eb25612` | `trasa-skaa-afrodyty` | Aphrodite Trip | Paphos | title, description | price, numeric booking details |
| 3 | `b0a24297-89f9-4f60-a1d6-b59d84bee877` | `trasa-gory-trodos-i-lefkara` | Trodos and Lefkara | Paphos | title, description | price, numeric booking details |

Safe for beta: only after HE title/description are reviewed. Without that, trips
should be EN fallback only for internal testers.

## Hotels Minimal Scope

There are 2 hotel records. Both have HE title values copied from EN, but no HE
description.

| Priority | Hotel ID | Slug | Title | City | Must have HE | EN fallback allowed |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `f9fbaa61-fdce-4418-8579-ddb2b0a75fb1` | `rgb-cabins-larnaka-centrum` | RGB Cabins - Larnaca City Centre | Larnaca | description, booking policy if present | brand name, amenity codes |
| 2 | `9b6d99a0-923a-4fbc-be54-c066e856e6ca` | `7-ukow` | 7 Arches | Lefkara | description, booking policy if present | brand name, amenity codes |

Safe for beta: partial only. Hotel amenities still need schema/content work
because `hotel_amenities` has no reviewed `name_he` coverage.

## Cars Minimal Scope

Car models already have HE values that are effectively brand/model names.
Features, car type and descriptions still need HE review.

| Priority | Car ID | Model | Location | Must have HE | EN fallback allowed |
| ---: | --- | --- | --- | --- | --- |
| 1 | `353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca` | Nissan Serena | Paphos | car_type, feature labels if shown | model name, numeric price |
| 2 | `b4f784d3-22d2-421a-829f-2394e3a72a76` | Mazda CX5 | Paphos | car_type, feature labels if shown | model name, numeric price |
| 3 | `8a1158af-6b05-4723-b2eb-93b130d22f24` | Mitsubishi Outlander | Paphos | car_type, feature labels if shown | model name, numeric price |
| 4 | `5ba581c3-08c6-47cd-ab29-4d2b9213cebc` | Toyota Sienta (2022) | Larnaca | car_type, feature labels if shown | model name, numeric price |
| 5 | `64981eb1-e9a3-41a4-bd93-1fd4c78581d7` | Honda Fit Hybrid (2019) | Larnaca | car_type, feature labels if shown | model name, numeric price |

Safe for beta: yes for internal/beta booking smoke with EN fallback accepted.
Not ready as a Hebrew content experience until visible feature/type labels are
reviewed.

## What Stays Out Of First Beta

- Full shop Hebrew checkout.
- All 139 POI.
- All 10 recommendations.
- All 12 trips.
- Full blog archive.
- SEO metadata and public indexing for HE.
- Public `/he/` routes and public HE language switcher.

## Manual SQL / Admin Path

- Use `supabase/manual/he_beta_dynamic_content_scope.sql` as a draft only.
- It is wrapped with `ROLLBACK` by default so it can be pasted safely for
  review.
- Prefer Admin/Partner UI for full blog body translations so TipTap JSON and
  HTML stay consistent.
- Never overwrite PL/EN rows or fields when adding HE.

## Beta Dynamic Readiness After This Scope

This stage does not claim global dynamic readiness. It creates a narrow target:

| Area | Selected records | Ready now | Ready after manual HE content |
| --- | ---: | ---: | ---: |
| Blog | 5 | 0% | 100% for selected posts |
| Transport locations | 9 | 0% | 100% for selected locations |
| POI | 10 | 30% partial from existing HE | 100% for selected POI |
| Recommendations | 5 | 0-40% partial category coverage | 100% for selected cards |
| Shop | 0 selected | Excluded | Excluded until separate shop pass |
| Trips | 3 | 0% HE content | 100% for selected trips after title/description |
| Hotels | 2 | 50% title-level partial | 100% for selected hotels after descriptions |
| Cars | 5 | Model-level partial | Safe for beta with EN fallback; full after feature/type review |

## Public Launch Blockers

- `blog_post_translations.lang = 'he'` rows must be reviewed for selected posts.
- Shop dynamic content is still 0% and should not enter paid public HE checkout.
- POI/recommendation selected records need reviewed HE descriptions and badges.
- Trips/hotels/cars selected records need reviewed HE details beyond names.
- Full HE SEO, sitemap, hreflang, canonical and public language exposure remain
  intentionally disabled until a later approved stage.
