#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, needle, message) {
  assert.ok(read(file).includes(needle), `${message} (${file})`);
}

function assertNotIncludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), `${message} (${file})`);
}

JSON.parse(read('translations/en.json'));
JSON.parse(read('translations/pl.json'));
JSON.parse(read('translations/he.json'));

assertIncludes('admin/blog-i18n-form.js', "code: 'he'", 'Blog form must expose internal HE editing');
assertIncludes('admin/blog-i18n-form.js', 'internal: true', 'Blog HE language must be marked internal');
assertIncludes('admin/universal-i18n-component.js', "code: 'he'", 'Universal i18n component must support HE');
assertIncludes('admin/universal-i18n-component.js', 'copyI18nField', 'Universal i18n component must keep copy-from support');
assertIncludes('admin/dashboard.html', 'blogFormCategoriesHe', 'Admin blog taxonomy must include HE categories');
assertIncludes('admin/dashboard.html', 'shopProductNameHe', 'Admin shop products must include HE fields');
assertIncludes('admin/dashboard.html', 'transportLocationNameHe', 'Admin transport locations must include HE fields');
assertIncludes('admin/admin.js', 'EMAIL_EDITABLE_LANGUAGES = [\'pl\', \'en\', \'he\']', 'Admin email editor must allow internal HE drafts');
assertIncludes('admin/blog-admin.js', 'emptyOptionalLangs', 'Admin blog save must clean cleared optional HE translations');
assertIncludes('admin/blog-admin.js', 'BLOG_TAXONOMY_LANGUAGES.reduce', 'Admin blog taxonomy suggestions must initialize all languages including HE');
assertIncludes('admin/poi-i18n-form.js', 'localStorage.setItem', 'POI form must keep draft autosave behavior');
assertIncludes('admin/poi-i18n-form.js', 'name_i18n', 'POI form must save localized JSON payloads');

assertIncludes('partners/index.html', 'partnerBlogTitleHe', 'Partner blog modal must include HE title input');
assertIncludes('partners/index.html', 'data-partner-blog-lang-tab="he"', 'Partner blog modal must include internal HE tab');
assertIncludes('partners/index.html', 'partnerBlogFormCoverPreview', 'Partner blog modal must retain preview UI');
assertIncludes('js/partners.js', "{ code: 'he', label: 'Hebrew', required: false, rtl: true, internal: true }", 'Partner blog JS must define internal HE');
assertIncludes('js/partners.js', 'categories_he', 'Partner blog JS must save HE taxonomy');
assertIncludes('js/partners.js', 'getPartnerBlogFallbackChain', 'Partner blog JS must keep HE fallback chain');
assertIncludes('js/partners.js', 'emptyOptionalLangs', 'Partner blog save must clean cleared optional HE translations');

assertIncludes('supabase/migrations/177_profiles_preferred_language_he.sql', "IN ('pl', 'en', 'he')", 'preferred_language migration must allow HE');
assertIncludes('supabase/migrations/178_he_internal_content_fields.sql', 'categories_he', 'Schema migration must add HE blog taxonomy');
assertIncludes('supabase/migrations/178_he_internal_content_fields.sql', 'name_i18n jsonb', 'Schema migration must add POI i18n JSONB fields');
assertIncludes('supabase/migrations/178_he_internal_content_fields.sql', 'name_he text', 'Schema migration must add HE text fields');
assertIncludes('supabase/migrations/178_he_internal_content_fields.sql', 'subject_he text', 'Schema migration must add HE email template fields');
assertIncludes('supabase/migrations/179_blog_translations_he_internal_guard.sql', "CHECK (lang IN ('pl', 'en', 'he'))", 'Blog translations migration must allow internal HE rows');
assertIncludes('supabase/migrations/179_blog_translations_he_internal_guard.sql', "lang IN ('pl', 'en')", 'Blog public read policy must still hide HE rows');

const i18n = read('js/i18n.js');
const publicLanguagesBlock = i18n.match(/const PUBLIC_LANGUAGES = \{[\s\S]*?\n  \};/)?.[0] || '';
const supportedLanguagesAssignment = i18n.match(/const SUPPORTED_LANGUAGES = .*;/)?.[0] || '';
assert.ok(!publicLanguagesBlock.includes('he:'), 'HE must not be present in PUBLIC_LANGUAGES');
assert.equal(supportedLanguagesAssignment, 'const SUPPORTED_LANGUAGES = PUBLIC_LANGUAGES;', 'Supported public languages must remain public-only');
assertIncludes('js/i18n.js', 'window.CELanguageRollout', 'Runtime must expose central rollout guard');
assertIncludes('js/i18n.js', 'mode: ROLLOUT_MODES.INTERNAL_ONLY', 'HE must remain internal-only');
assertIncludes('js/i18n.js', 'publicApi: false', 'HE public API guard must remain off');

assertIncludes('js/languageSwitcher.js', 'const HIDDEN_LANGUAGES', 'Legacy switcher must keep HE hidden');
const switcherPublicBlock = read('js/languageSwitcher.js').match(/const SUPPORTED_LANGUAGES = \{[\s\S]*?\n\};/)?.[0] || '';
assert.ok(!switcherPublicBlock.includes('he:'), 'Legacy public switcher must not expose HE');

assertIncludes('js/seo.js', "const FALLBACK_SEO_LANGUAGES = ['pl', 'en'];", 'Public SEO fallback must stay PL/EN only');
assertIncludes('js/seo.js', "getPublicLanguageCodes?.('seo')", 'Public SEO must read central rollout guard');
assertNotIncludes('index.html', 'hreflang="he"', 'Home page must not include HE hreflang');
assertNotIncludes('sitemap.xml', 'hreflang="he"', 'Sitemap must not expose HE hreflang');
assertNotIncludes('sitemap.xml', '/he/', 'Sitemap must not expose HE routes');

console.log('Admin/partner internal Hebrew tests passed.');
