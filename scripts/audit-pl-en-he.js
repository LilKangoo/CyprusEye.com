#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const LANGUAGES = ['pl', 'en', 'he'];
const outputPath = path.join(rootDir, 'translations', 'audit-pl-en-he.json');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTranslationLeaf(value) {
  if (!isPlainObject(value)) {
    return true;
  }

  return (
    typeof value.text === 'string'
    || typeof value.html === 'string'
  );
}

function flattenTranslations(value, prefix = '', output = {}, metadata = { sources: {}, collisions: [] }, source = 'nested') {
  if (!prefix && !isPlainObject(value)) {
    return output;
  }

  if (prefix && isTranslationLeaf(value)) {
    const existingSource = metadata.sources[prefix];
    if (existingSource) {
      metadata.collisions.push({
        key: prefix,
        keptSource: existingSource === 'direct' ? 'direct' : source,
        ignoredSource: existingSource === 'direct' ? source : existingSource,
      });
      if (existingSource === 'direct' && source !== 'direct') {
        return output;
      }
    }

    output[prefix] = value;
    metadata.sources[prefix] = source;
    return output;
  }

  Object.entries(value || {}).forEach(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const nextSource = !prefix && key.includes('.') ? 'direct' : source;
    flattenTranslations(child, nextKey, output, metadata, nextSource);
  });

  return output;
}

function sortKeys(keys) {
  return [...keys].sort((left, right) => left.localeCompare(right, 'en'));
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function collectStringValues(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, output));
    return output;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((entry) => collectStringValues(entry, output));
  }

  return output;
}

function collectEmptyAndNullValues(value, prefix, output) {
  if (value === null) {
    output.nullValues.push(prefix);
    return;
  }

  if (typeof value === 'string' && value.trim() === '') {
    output.emptyStrings.push(prefix);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectEmptyAndNullValues(entry, `${prefix}[${index}]`, output));
    return;
  }

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      collectEmptyAndNullValues(entry, `${prefix}.${key}`, output);
    });
  }
}

function extractSingleBraceTokens(input) {
  const tokens = [];
  const matches = String(input || '').matchAll(/\{(?!\{)([A-Za-z0-9_.:-]+)\}(?!\})/g);
  for (const match of matches) {
    tokens.push(`{${match[1]}}`);
  }
  return tokens;
}

function extractTokens(input) {
  const source = String(input || '');
  return sortKeys([
    ...(source.match(/\{\{[^{}]+\}\}/g) || []),
    ...extractSingleBraceTokens(source),
    ...(source.match(/%(?:\d+\$)?[sdif]/g) || []),
  ]);
}

function extractHtmlTags(input) {
  const tags = [];
  const matches = String(input || '').matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>/g);
  for (const match of matches) {
    tags.push(match[0].startsWith('</') ? `/${match[1].toLowerCase()}` : match[1].toLowerCase());
  }
  return tags;
}

function extractEmojiAndSymbols(input) {
  const source = String(input || '');
  const matches = source.match(/[\p{Extended_Pictographic}\u2600-\u27BF]/gu) || [];
  return sortKeys([...new Set(matches)]);
}

function uniqueSorted(values) {
  return sortKeys([...new Set(values.filter(Boolean))]);
}

function sameList(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function stringsForKey(flatByLanguage, language, key) {
  if (!Object.prototype.hasOwnProperty.call(flatByLanguage[language], key)) {
    return [];
  }

  return collectStringValues(flatByLanguage[language][key]);
}

function tokenSummary(flatByLanguage, key, extractor) {
  return Object.fromEntries(LANGUAGES.map((language) => [
    language,
    uniqueSorted(stringsForKey(flatByLanguage, language, key).flatMap((value) => extractor(value))),
  ]));
}

function detectMismatch(flatByLanguage, key, extractor) {
  const summary = tokenSummary(flatByLanguage, key, extractor);
  const presentLanguages = LANGUAGES.filter((language) => (
    Object.prototype.hasOwnProperty.call(flatByLanguage[language], key)
  ));

  if (presentLanguages.length < 2) {
    return null;
  }

  const referenceLanguage = presentLanguages.includes('en') ? 'en' : presentLanguages[0];
  const reference = summary[referenceLanguage];
  const mismatchedLanguages = presentLanguages.filter((language) => !sameList(summary[language], reference));

  if (!mismatchedLanguages.length) {
    return null;
  }

  return {
    key,
    referenceLanguage,
    reference,
    values: summary,
    mismatchedLanguages,
  };
}

function hasHebrew(input) {
  return /[\u0590-\u05FF]/.test(String(input || ''));
}

function hasRtlPunctuationRisk(input) {
  const value = String(input || '').trim();
  if (!hasHebrew(value)) {
    return false;
  }

  return /^[,.;:!?)]/.test(value) || /[(]$/.test(value);
}

function countByRoot(keys) {
  return keys.reduce((accumulator, key) => {
    const root = key.split('.')[0] || 'unknown';
    accumulator[root] = (accumulator[root] || 0) + 1;
    return accumulator;
  }, {});
}

function sortObjectByCount(input) {
  return Object.fromEntries(
    Object.entries(input).sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0], 'en');
    }),
  );
}

function compactIssueList(issues, limit = 500) {
  return issues.slice(0, limit);
}

async function main() {
  const translations = Object.fromEntries(await Promise.all(LANGUAGES.map(async (language) => [
    language,
    await readJson(path.join(rootDir, 'translations', `${language}.json`)),
  ])));

  const flattenMetadata = Object.fromEntries(LANGUAGES.map((language) => [
    language,
    { sources: {}, collisions: [] },
  ]));
  const flat = Object.fromEntries(LANGUAGES.map((language) => [
    language,
    flattenTranslations(translations[language], '', {}, flattenMetadata[language]),
  ]));

  const keySets = Object.fromEntries(LANGUAGES.map((language) => [
    language,
    new Set(Object.keys(flat[language])),
  ]));

  const allKeys = sortKeys([
    ...new Set(LANGUAGES.flatMap((language) => Object.keys(flat[language]))),
  ]);

  const missing = {
    plMissingEn: sortKeys(Object.keys(flat.pl).filter((key) => !keySets.en.has(key))),
    plMissingHe: sortKeys(Object.keys(flat.pl).filter((key) => !keySets.he.has(key))),
    enMissingPl: sortKeys(Object.keys(flat.en).filter((key) => !keySets.pl.has(key))),
    enMissingHe: sortKeys(Object.keys(flat.en).filter((key) => !keySets.he.has(key))),
    heMissingPl: sortKeys(Object.keys(flat.he).filter((key) => !keySets.pl.has(key))),
    heMissingEn: sortKeys(Object.keys(flat.he).filter((key) => !keySets.en.has(key))),
  };

  const heExtraAgainstPlAndEn = sortKeys(Object.keys(flat.he).filter((key) => (
    !keySets.pl.has(key) && !keySets.en.has(key)
  )));

  const sameAsEnHe = sortKeys(Object.keys(flat.en).filter((key) => (
    keySets.he.has(key) && stableStringify(flat.en[key]) === stableStringify(flat.he[key])
  )));

  const emptyAndNull = Object.fromEntries(LANGUAGES.map((language) => {
    const output = {
      emptyStrings: [],
      nullValues: [],
    };

    Object.entries(flat[language]).forEach(([key, value]) => {
      collectEmptyAndNullValues(value, key, output);
    });

    return [
      language,
      {
        emptyStrings: sortKeys(output.emptyStrings),
        nullValues: sortKeys(output.nullValues),
      },
    ];
  }));

  const placeholderMismatches = [];
  const htmlTagMismatches = [];
  const emojiSymbolMismatches = [];
  const rtlPunctuationWarnings = [];

  allKeys.forEach((key) => {
    const placeholderMismatch = detectMismatch(flat, key, extractTokens);
    if (placeholderMismatch) {
      placeholderMismatches.push(placeholderMismatch);
    }

    const htmlMismatch = detectMismatch(flat, key, extractHtmlTags);
    if (htmlMismatch) {
      htmlTagMismatches.push(htmlMismatch);
    }

    const emojiMismatch = detectMismatch(flat, key, extractEmojiAndSymbols);
    if (emojiMismatch) {
      emojiSymbolMismatches.push(emojiMismatch);
    }

    stringsForKey(flat, 'he', key).forEach((value) => {
      if (hasRtlPunctuationRisk(value)) {
        rtlPunctuationWarnings.push({ key, value });
      }
    });
  });

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    languages: LANGUAGES,
    counts: {
      keys: Object.fromEntries(LANGUAGES.map((language) => [language, Object.keys(flat[language]).length])),
      unionKeys: allKeys.length,
      missing: Object.fromEntries(Object.entries(missing).map(([key, values]) => [key, values.length])),
      heExtraAgainstPlAndEn: heExtraAgainstPlAndEn.length,
      sameAsEnHe: sameAsEnHe.length,
      emptyStrings: Object.fromEntries(LANGUAGES.map((language) => [language, emptyAndNull[language].emptyStrings.length])),
      nullValues: Object.fromEntries(LANGUAGES.map((language) => [language, emptyAndNull[language].nullValues.length])),
      placeholderMismatches: placeholderMismatches.length,
      htmlTagMismatches: htmlTagMismatches.length,
      emojiSymbolMismatches: emojiSymbolMismatches.length,
      rtlPunctuationWarnings: rtlPunctuationWarnings.length,
      flatNestedCollisions: Object.fromEntries(LANGUAGES.map((language) => [
        language,
        flattenMetadata[language].collisions.length,
      ])),
    },
    missing,
    extra: {
      heExtraAgainstPlAndEn,
    },
    sameAsEnHe,
    emptyAndNull,
    qualityIssues: {
      placeholderMismatches: compactIssueList(placeholderMismatches),
      htmlTagMismatches: compactIssueList(htmlTagMismatches),
      emojiSymbolMismatches: compactIssueList(emojiSymbolMismatches),
      rtlPunctuationWarnings: compactIssueList(rtlPunctuationWarnings),
    },
    roots: {
      plMissingEn: sortObjectByCount(countByRoot(missing.plMissingEn)),
      plMissingHe: sortObjectByCount(countByRoot(missing.plMissingHe)),
      enMissingPl: sortObjectByCount(countByRoot(missing.enMissingPl)),
      enMissingHe: sortObjectByCount(countByRoot(missing.enMissingHe)),
      heMissingPl: sortObjectByCount(countByRoot(missing.heMissingPl)),
      heMissingEn: sortObjectByCount(countByRoot(missing.heMissingEn)),
    },
    flatNestedCollisions: Object.fromEntries(LANGUAGES.map((language) => [
      language,
      compactIssueList(flattenMetadata[language].collisions),
    ])),
    notes: [
      'This report is structural and does not activate public HE, SEO HE, sitemap HE, hreflang HE, canonical HE, indexing HE, Shop HE, Blog HE, or /he/ routes.',
      'Long blog content, long marketing copy, legal/payment copy, SEO meta, and email templates still require human review before public_ready.',
      'Flattening supports both flat keys and nested translation objects so PL, EN, and HE can be compared consistently.',
    ],
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('PL/EN/HE translation audit generated.');
  console.log(`PL keys: ${report.counts.keys.pl}`);
  console.log(`EN keys: ${report.counts.keys.en}`);
  console.log(`HE keys: ${report.counts.keys.he}`);
  console.log(`PL keys missing EN: ${report.counts.missing.plMissingEn}`);
  console.log(`PL keys missing HE: ${report.counts.missing.plMissingHe}`);
  console.log(`EN keys missing PL: ${report.counts.missing.enMissingPl}`);
  console.log(`EN keys missing HE: ${report.counts.missing.enMissingHe}`);
  console.log(`HE keys missing PL: ${report.counts.missing.heMissingPl}`);
  console.log(`HE keys missing EN: ${report.counts.missing.heMissingEn}`);
  console.log(`HE same as EN: ${report.counts.sameAsEnHe}`);
  console.log(`Placeholder mismatches: ${report.counts.placeholderMismatches}`);
  console.log(`HTML tag mismatches: ${report.counts.htmlTagMismatches}`);
  console.log(`Report: ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
