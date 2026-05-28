# Stage 5 HE Internal Staging Rollout QA

Hebrew must remain internal/hidden throughout this checklist. Do not add HE to
the public language switcher, language selector, sitemap, hreflang, canonical
routing, or public SEO runtime.

## 1. Before Rollout

- Take a database backup/snapshot.
- Run `supabase db push --dry-run` and confirm no one is about to run
  `--include-all` for the 095-176 backlog.
- Run the pre-rollout section in `supabase/manual/he_stage4_schema_checks.sql`.
- Confirm whether `177` and `178` are absent from
  `supabase_migrations.schema_migrations`.
- Keep the existing remote lint errors separate from this rollout unless a new
  HE-specific error appears.

## 2. Manual Rollout

- Run `supabase/manual/manual_he_rollout_177_178.sql` in Supabase SQL Editor.
- Run the post-rollout column/constraint/index checks from
  `supabase/manual/he_stage4_schema_checks.sql`.
- Run the transactional sanity section from the same file and confirm each
  `returning` result either shows a HE value or returns no row because that
  table has no seed data.
- Only after SQL checks pass, repair migration history for the HE migrations:

```bash
supabase migration repair 177 178 --status applied --linked
```

Do not mark 095-176 as applied in this HE rollout unless each migration has
been separately verified against remote.

## 3. Admin Save/Reload QA

- Blog admin:
  - Create or edit a draft.
  - Add HE title, slug, lead, content.
  - Add `categories_he` and `tags_he`.
  - Save, close, reopen, confirm HE reloads.
  - Confirm PL/EN title, slug, lead, content, categories and tags are unchanged.
  - Clear optional HE content, save, reopen, confirm HE translation is removed
    while PL/EN remain.
- POI:
  - Add HE name, description, badge through i18n form.
  - Save, reload, confirm `name_i18n.he`, `description_i18n.he`, `badge_i18n.he`.
  - Confirm map/check-in/radius/status behavior did not change.
- Recommendations:
  - Add HE name/title, description, category/label fields available in the form.
  - Save, reload, confirm HE values persist.
  - Confirm PL/EN cards still display correctly.
- Shop:
  - Product: add HE name, description, short description and variant name.
  - Category: add HE name and description.
  - Vendor: add HE name and description.
  - Discount: add HE description.
  - Shipping class/method: add HE name and description.
  - Save/reopen each item and confirm PL/EN prices, stock, payment, order and
    shipping logic are unchanged.
- Email templates:
  - In the database email draft editor, switch to HE.
  - Add subject, heading, intro, CTA, optional HTML.
  - Save draft, reload, confirm `email_template_versions.content.he`.
  - Confirm PL/EN required validation still works and HE remains optional.
- Transport:
  - Add `transport_locations.name_he`.
  - Save, reload, confirm location routes/pricing remain unchanged.

## 4. Partner Panel Save/Reload QA

- Partner blog:
  - Add HE title, slug, lead, content.
  - Add HE categories/tags.
  - Use Copy from EN to HE and confirm generated HE draft fields can be edited.
  - Save, close, reopen, confirm HE reloads.
  - Clear optional HE content, save, reopen, confirm HE is removed and PL/EN
    remain.
  - Confirm saved HE content does not publish to public blog UI.

## 5. Internal RTL QA

Check only admin/partner screens:

- Inputs and textareas align correctly in HE fields.
- Editor surface uses RTL direction for HE.
- Tabs do not overflow.
- Accordion headers remain readable.
- Modals do not clip HE fields.
- Preview blocks do not show `undefined` or `null`.

## 6. PL/EN Regression QA

- Blog PL/EN create/edit/save/reload still works.
- Shop PL/EN create/edit/save/reload still works.
- Recommendations and POI PL/EN create/edit/save/reload still works.
- Transport PL/EN/name/name_local flows still work.
- Public PL/EN frontend still renders the same language options.
- Existing checkout/order/payment flows are untouched.

## 7. Public Hidden Check

Run after build and deployment candidate:

- Public switcher contains PL/EN only.
- Public selector contains PL/EN only.
- No HE in sitemap.
- No `hreflang="he"`.
- No `/he/` routes.
- No `?lang=he` in sitemap.
- No public SEO HE.
- No canonical HE.

Useful local checks:

```bash
rg -n 'hreflang="he|lang=he|/he/|languageSwitcherOption-he' \
  index.html dist/index.html sitemap.xml dist/sitemap.xml js/seo.js dist/js/seo.js

npm run i18n:test
npm run i18n:audit
npm run build
```

## 8. Exit Criteria for Stage 6

- Manual rollout SQL applied on staging.
- SQL checks pass.
- Migration history for 177/178 is repaired intentionally or documented as
  intentionally manual.
- Admin HE save/reload passes.
- Partner HE save/reload passes.
- PL/EN regression checklist passes.
- Public hidden check passes.
- Known remote lint errors are documented as unrelated and not mixed into HE.
