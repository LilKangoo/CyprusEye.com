#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
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

const hiddenStatus = assertHebrewPubliclyHidden();
assert.equal(hiddenStatus.ok, true);
assert.deepEqual(hiddenStatus.publicSurfaces, []);

const sitemapSource = fs.readFileSync('functions/_utils/sitemap.js', 'utf8');
assert.match(sitemapSource, /getPublicLanguageCodes\('sitemap'\)/);

const seoSource = fs.readFileSync('js/seo.js', 'utf8');
assert.match(seoSource, /getPublicLanguageCodes\?\.\('seo'\)/);

const i18nSource = fs.readFileSync('js/i18n.js', 'utf8');
assert.match(i18nSource, /mode:\s*ROLLOUT_MODES\.INTERNAL_ONLY/);
assert.match(i18nSource, /switcher:\s*false/);
assert.match(i18nSource, /seo:\s*false/);
assert.match(i18nSource, /sitemap:\s*false/);
assert.match(i18nSource, /publicApi:\s*false/);
assert.match(i18nSource, /indexing:\s*false/);

console.log('HE rollout guard tests passed.');
