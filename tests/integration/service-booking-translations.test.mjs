import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const resolve = (pack, key) => pack[key] ?? key.split('.').reduce((node, part) => node?.[part], pack);
const pages = ['index.html', 'trip.html', 'trips.html', 'hotel.html', 'hotels.html', 'js/home-trips.js', 'js/home-hotels.js'];
const keys = new Set(pages.flatMap(page => readFileSync(page, 'utf8').match(/(?:trips\.booking\.[\w.]+|hotels\.booking\.[\w.]+|modal\.form\.[\w.]+)/g) || []));
const packs = Object.fromEntries(['pl', 'en', 'he'].map(language => [language, JSON.parse(readFileSync(`translations/${language}.json`, 'utf8'))]));
for (const language of ['pl', 'en', 'he']) {
  test(`Booking labels and messages are complete in ${language}`, () => {
    for (const key of keys) {
      const value = resolve(packs[language], key);
      assert.equal(typeof value, 'string', `${language}: ${key}`);
      assert.ok(value.trim(), `${language}: empty ${key}`);
      const parameters = text => [...text.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
      assert.deepEqual(parameters(value), parameters(resolve(packs.en, key)), `${language}: parameters in ${key}`);
    }
  });
}
