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

const betaConfigSource = fs.readFileSync('js/he-beta-rollout-config.js', 'utf8');
assert.match(betaConfigSource, /mode:\s*'beta_users'/);
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

console.log('HE rollout guard tests passed.');
