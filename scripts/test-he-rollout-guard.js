#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ROLLOUT_MODES,
  assertHebrewPubliclyHidden,
  getLanguageFallbackChain,
  getPublicLanguageCodes,
  normalizePublicLanguage,
} from '../functions/_utils/languageRollout.js';

assert.deepEqual(getLanguageFallbackChain('he'), ['he', 'en', 'pl']);
assert.deepEqual(getLanguageFallbackChain('en'), ['en', 'pl']);
assert.deepEqual(getLanguageFallbackChain('pl'), ['pl', 'en']);

assert.equal(normalizePublicLanguage('he', 'en', 'seo'), 'en');
assert.equal(normalizePublicLanguage('he', 'en', 'routes'), 'en');
assert.equal(normalizePublicLanguage('pl', 'en', 'seo'), 'pl');
assert.deepEqual(getPublicLanguageCodes('switcher'), ['pl', 'en']);
assert.deepEqual(getPublicLanguageCodes('seo'), ['pl', 'en']);
assert.deepEqual(getPublicLanguageCodes('sitemap'), ['pl', 'en']);
assert.equal(ROLLOUT_MODES.OFF, 'off');
assert.equal(ROLLOUT_MODES.BETA, 'beta');
assert.equal(ROLLOUT_MODES.PUBLIC, 'public');

const hiddenStatus = assertHebrewPubliclyHidden();
assert.equal(hiddenStatus.ok, true);
assert.deepEqual(hiddenStatus.publicSurfaces, []);

const sitemapSource = fs.readFileSync('functions/_utils/sitemap.js', 'utf8');
assert.match(sitemapSource, /getPublicLanguageCodes\('sitemap'\)/);

const rolloutSource = fs.readFileSync('functions/_utils/languageRollout.js', 'utf8');
assert.match(rolloutSource, /CE_LANGUAGE_ROLLOUT_CONFIG/);
assert.match(rolloutSource, /CE_HE_ROLLOUT_MODE/);

const seoSource = fs.readFileSync('js/seo.js', 'utf8');
assert.match(seoSource, /getPublicLanguageCodes\?\.\('seo'\)/);

const i18nSource = fs.readFileSync('js/i18n.js', 'utf8');
assert.match(i18nSource, /mode:\s*ROLLOUT_MODES\.INTERNAL_ONLY/);
assert.match(i18nSource, /CE_LANGUAGE_ROLLOUT_CONFIG/);
assert.match(i18nSource, /betaEmails/);
assert.match(i18nSource, /hiddenPreviewAllowedByRollout/);
assert.match(i18nSource, /pageDisablesHiddenLanguage/);
assert.match(i18nSource, /maybeApplyDeferredBetaLanguage/);
assert.match(i18nSource, /hiddenPreview:\s*false/);
assert.match(i18nSource, /dataset\.testid\s*=\s*`language-pill-/);
assert.match(i18nSource, /previewParam === '1'[\s\S]*?return true;[\s\S]*?!isLocalPreviewHost/);
assert.match(i18nSource, /switcher:\s*false/);
assert.match(i18nSource, /seo:\s*false/);
assert.match(i18nSource, /sitemap:\s*false/);
assert.match(i18nSource, /publicApi:\s*false/);
assert.match(i18nSource, /indexing:\s*false/);
assert.match(i18nSource, /function buildLocalizedUrl/);
assert.match(i18nSource, /function getHePageKeyForUrl/);
assert.match(i18nSource, /function isLanguageAllowedForUrl/);
assert.match(i18nSource, /function isRecordReadyForLanguage/);
assert.match(i18nSource, /function filterRecordsReadyForLanguage/);
assert.match(i18nSource, /RECORD_GATED:\s*'record-gated'/);
assert.match(i18nSource, /recordGatedWhenStage33SqlApplied/);
assert.match(i18nSource, /allowPartialPagesPublic/);
assert.match(i18nSource, /data-page-url/);
assert.match(i18nSource, /blog:\s*\{[\s\S]*?status:\s*HE_PAGE_READINESS_STATUS\.BLOCKED/);
assert.match(i18nSource, /blogPost:\s*\{[\s\S]*?status:\s*HE_PAGE_READINESS_STATUS\.BLOCKED/);

const betaConfigSource = fs.readFileSync('js/he-beta-rollout-config.js', 'utf8');
assert.match(betaConfigSource, /mode:\s*'partial_public'/);
assert.match(betaConfigSource, /pageGated:\s*true/);
assert.match(betaConfigSource, /stage25SqlApplied:\s*true/);
assert.match(betaConfigSource, /stage33SqlApplied:\s*true/);
assert.match(betaConfigSource, /recordGatedPagesPublic:\s*true/);
assert.match(betaConfigSource, /allowPartialPagesPublic:\s*false/);
assert.match(betaConfigSource, /15f3d442-092d-4eb8-9627-db90da0283eb/);
assert.match(betaConfigSource, /hiddenPreview:\s*false/);
assert.match(betaConfigSource, /seo:\s*false/);
assert.match(betaConfigSource, /sitemap:\s*false/);
assert.match(betaConfigSource, /hreflang:\s*false/);
assert.match(betaConfigSource, /canonical:\s*false/);
assert.match(betaConfigSource, /indexing:\s*false/);
assert.match(fs.readFileSync('index.html', 'utf8'), /he-beta-rollout-config\.js[\s\S]*?i18n\.js/);

const redirectsSource = fs.readFileSync('_redirects', 'utf8');
assert.match(redirectsSource, /^\/he\s+\/\?lang=en\s+302/m);
assert.match(redirectsSource, /^\/he\/\*\s+\/\?lang=en\s+302/m);
assert.doesNotMatch(fs.readFileSync('car.html', 'utf8'), /src=["']app\.js["']/);

const shopHtmlSource = fs.readFileSync('shop.html', 'utf8');
const shopSource = fs.readFileSync('js/shop.js', 'utf8');
assert.match(shopHtmlSource, /data-disable-hidden-language="true"/);
assert.match(shopSource, /isHiddenLanguageDisabledForShop/);
assert.match(shopSource, /normalizeShopLang/);
assert.match(rolloutSource, /betaEmails/);
assert.match(rolloutSource, /allowPreferredLanguage/);

const blogDataSource = fs.readFileSync('functions/_utils/blogData.js', 'utf8');
const blogListSource = fs.readFileSync('js/blog.js', 'utf8');
const blogPostSource = fs.readFileSync('js/blog-post.js', 'utf8');
const blogCtaSource = fs.readFileSync('js/blog-cta-resolver.js', 'utf8');
assert.match(blogDataSource, /review_status'\s*,\s*'public_ready|review_status.*public_ready/s);
assert.match(blogDataSource, /getPublishedHebrewBlogListPage/);
assert.match(blogDataSource, /getPublishedHebrewBlogPostBySlug/);
assert.match(blogListSource, /fetchHebrewBlogListPage/);
assert.match(blogPostSource, /fetchHebrewPublicReadyPost/);
assert.match(blogCtaSource, /function isBlogTranslationPublicReady/);
assert.match(blogCtaSource, /localized === 'he' \? 'en' : localized/);

const blogStage41DraftSql = fs.readFileSync('supabase/manual/he_blog_stage41_public_read_draft.sql', 'utf8');
const blogStage41ApplySql = fs.readFileSync('supabase/manual/he_blog_stage41_public_read_apply.sql', 'utf8');
const blogStage41VerifySql = fs.readFileSync('supabase/manual/he_blog_stage41_public_read_verify.sql', 'utf8');
const blogStage42DraftSql = fs.readFileSync('supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql', 'utf8');
const blogStage42ApplySql = fs.readFileSync('supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql', 'utf8');
const blogStage42VerifySql = fs.readFileSync('supabase/manual/he_blog_stage42_public_ready_verify.sql', 'utf8');
for (const source of [blogStage41DraftSql, blogStage41ApplySql]) {
  assert.doesNotMatch(source, /\bDROP\s+(POLICY|CONSTRAINT|TABLE|COLUMN|INDEX)\b/i);
  assert.match(source, /review_status = 'public_ready'/);
  assert.match(source, /lang IN \('pl', 'en'\)/);
  assert.match(source, /lang = 'he'/);
}
assert.match(blogStage41DraftSql, /ROLLBACK;/);
assert.match(blogStage41ApplySql, /COMMIT;/);
assert.match(blogStage41VerifySql, /public_ready_he_rows/);
for (const source of [blogStage42DraftSql, blogStage42ApplySql]) {
  assert.doesNotMatch(source, /\bDROP\s+(POLICY|CONSTRAINT|TABLE|COLUMN|INDEX)\b/i);
  assert.match(source, /blog_post_translations/);
  assert.match(source, /lang = 'he'/);
  assert.match(source, /review_status = 'public_ready'/);
  assert.doesNotMatch(source, /lang IN \('pl', 'en'\)[\s\S]*UPDATE/i);
}
assert.match(blogStage42DraftSql, /ROLLBACK;/);
assert.match(blogStage42ApplySql, /COMMIT;/);
assert.match(blogStage42ApplySql, /complete_count <> 5/);
assert.match(blogStage42ApplySql, /duplicate_slug_count <> 0/);
assert.match(blogStage42VerifySql, /stage42_blog_top5_public_ready/);
assert.match(blogStage42VerifySql, /stage42_blog_public_ready_parent_not_public/);

console.log('HE rollout guard tests passed.');
