#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  getLanguageFallbackChain,
  pickLocalizedField,
  pickLocalizedValue,
} from '../src/utils/translations.js';

assert.deepEqual(getLanguageFallbackChain('he'), ['he', 'en', 'pl']);
assert.deepEqual(getLanguageFallbackChain('en'), ['en', 'pl']);
assert.deepEqual(getLanguageFallbackChain('pl'), ['pl', 'en']);
assert.deepEqual(getLanguageFallbackChain('unknown'), ['en', 'pl']);

assert.equal(pickLocalizedValue({ pl: 'PL', en: 'EN', he: 'HE' }, 'he'), 'HE');
assert.equal(pickLocalizedValue({ pl: 'PL', en: 'EN' }, 'he'), 'EN');
assert.equal(pickLocalizedValue({ pl: 'PL' }, 'he'), 'PL');
assert.equal(pickLocalizedValue({ fr: 'FR' }, 'he'), 'FR');
assert.equal(pickLocalizedValue('Direct string', 'he'), 'Direct string');

assert.equal(
  pickLocalizedField({ title_he: 'HE', title_en: 'EN', title: 'PL' }, 'title', 'he'),
  'HE',
);
assert.equal(
  pickLocalizedField({ title_en: 'EN', title: 'PL' }, 'title', 'he'),
  'EN',
);
assert.equal(
  pickLocalizedField({ title: { en: 'EN', pl: 'PL' } }, 'title', 'he'),
  'EN',
);
assert.equal(
  pickLocalizedField({ title_pl: 'PL', title_en: 'EN' }, 'title', 'he'),
  'EN',
);
assert.equal(
  pickLocalizedField({ title_pl: 'PL' }, 'title', 'he'),
  'PL',
);
assert.equal(
  pickLocalizedField({ title_fr: 'FR' }, 'title', 'he'),
  'FR',
);

const productRow = { name: 'Produkt PL', name_en: 'Product EN', name_he: 'Product HE' };
assert.equal(pickLocalizedField(productRow, 'name', 'he'), 'Product HE');
assert.equal(pickLocalizedField(productRow, 'name', 'en'), 'Product EN');
assert.equal(pickLocalizedField(productRow, 'name', 'pl'), 'Produkt PL');

const productWithoutHe = { name: 'Produkt PL', name_en: 'Product EN' };
assert.equal(pickLocalizedField(productWithoutHe, 'name', 'he'), 'Product EN');

const productWithoutEn = { name: 'Produkt PL', name_he: '' };
assert.equal(pickLocalizedField(productWithoutEn, 'name', 'he'), 'Produkt PL');

const features = pickLocalizedValue({ en: ['A'], pl: ['B'] }, 'he');
assert.deepEqual(features, ['A']);

console.log('Language fallback tests passed.');
