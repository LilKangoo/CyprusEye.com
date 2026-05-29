# HE Stage 11.5 Manual QA

## Admin Blog HE Save/Reload

1. Open Admin > Blog.
2. Create a new draft or open an existing non-public test draft.
3. Fill HE title, slug, lead, content, categories and tags.
4. Save.
5. Close the modal.
6. Reopen the same draft.

Expected: HE values reload exactly as saved. PL/EN fields are unchanged. The post is not publicly exposed as HE.

## Partner Blog HE Save/Reload

1. Open Partner panel with a test partner account.
2. Create or open a non-public draft/pending blog post.
3. Fill HE title, slug, lead, content, categories and tags.
4. Use copy-from-EN to HE once, then edit one HE field manually.
5. Save.
6. Close and reopen.

Expected: HE values persist. The edited HE field is not overwritten. PL/EN fields are unchanged.

## Public Hidden Safety

1. Open `/?lang=he`.
2. Open `/?ce_he_preview=1&lang=he`.
3. Open `/sitemap.xml`.
4. Open `/he/`.

Expected: plain `?lang=he` stays EN/LTR. Preview URL renders HE/RTL. Sitemap has no HE URLs or hreflang. `/he/` redirects or returns a non-public safe response without `/he/js/` or `/he/assets/` errors.
