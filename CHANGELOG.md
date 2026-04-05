# Changelog

## 2026-04-05

### Added
- Public blog module with `/blog` list and `/blog/<slug>` article pages.
- Dynamic SEO for blog list and article routes with language-aware meta, canonical and hreflang.
- Blog admin module with bilingual PL/EN editing, cover upload, author byline, CTA services and publish workflow.
- Partner blog workflow with moderation states and approval handling.
- Global `Blog` link in the public header navigation.

### Improved
- Blog list now supports pagination, tag/category filters and EN default URLs without `?lang=en`.
- Blog article pages render author byline fallbacks and linked service CTA cards.
- Blog smoke tests now cover public list, public article and admin create/approve flow using the Supabase stub.

### Infrastructure
- Added migration `130_blog_posts_and_translations.sql`.
- Added blog Functions helpers and local server routing for dynamic SEO payload injection.
