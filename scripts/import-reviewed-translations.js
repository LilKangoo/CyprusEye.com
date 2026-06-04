#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const translationDir = path.join(rootDir, 'translations');
const reportDir = path.join(translationDir, 'manual-review');
const LANGUAGES = new Set(['pl', 'en', 'he']);

function parseArgs(argv) {
  const options = {
    input: '',
    apply: false,
    allowSourceLanguageUpdate: false,
  };

  argv.forEach((arg) => {
    if (arg === '--apply') {
      options.apply = true;
      return;
    }
    if (arg === '--allow-source-language-update') {
      options.allowSourceLanguageUpdate = true;
      return;
    }
    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
      return;
    }
  });

  return options;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortKeys(keys) {
  return [...keys].sort((left, right) => left.localeCompare(right, 'en'));
}

function extractSingleBraceTokens(input) {
  const tokens = [];
  const matches = String(input || '').matchAll(/\{(?!\{)([A-Za-z0-9_.:-]+)\}(?!\})/g);
  for (const match of matches) tokens.push(`{${match[1]}}`);
  return tokens;
}

function extractTokens(input) {
  return sortKeys([
    ...(String(input || '').match(/\{\{[^{}]+\}\}/g) || []),
    ...extractSingleBraceTokens(input),
    ...(String(input || '').match(/%(?:\d+\$)?[sdif]/g) || []),
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

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tokenValidation(referenceValue, targetValue) {
  const referenceTokens = extractTokens(referenceValue);
  const targetTokens = extractTokens(targetValue);
  const referenceTags = extractHtmlTags(referenceValue);
  const targetTags = extractHtmlTags(targetValue);

  const errors = [];
  if (!sameArray(referenceTokens, targetTokens)) {
    errors.push(`placeholder_mismatch reference=${JSON.stringify(referenceTokens)} target=${JSON.stringify(targetTokens)}`);
  }
  if (!sameArray(referenceTags, targetTags)) {
    errors.push(`html_tag_mismatch reference=${JSON.stringify(referenceTags)} target=${JSON.stringify(targetTags)}`);
  }

  return errors;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getPathValue(object, key) {
  if (Object.prototype.hasOwnProperty.call(object, key)) {
    return object[key];
  }

  const parts = key.split('.');
  let cursor = object;
  for (const part of parts) {
    if (!isPlainObject(cursor) || !Object.prototype.hasOwnProperty.call(cursor, part)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setPathValue(object, key, value) {
  if (Object.prototype.hasOwnProperty.call(object, key)) {
    object[key] = value;
    return;
  }

  const parts = key.split('.');
  let cursor = object;
  parts.slice(0, -1).forEach((part) => {
    if (!isPlainObject(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function stringifyLeaf(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(stringifyLeaf).filter(Boolean).join(' | ');
  if (isPlainObject(value)) {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.html === 'string') return value.html;
    return Object.values(value).map(stringifyLeaf).filter(Boolean).join(' | ');
  }
  return String(value);
}

function extractRecords(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.records)) return input.records;
  throw new Error('Input must be an array or an object with a records array.');
}

function reviewedValueFor(record, language) {
  const directKey = `reviewed_${language}`;
  const newKey = `new_${language}`;
  if (Object.prototype.hasOwnProperty.call(record, directKey)) return record[directKey];
  if (Object.prototype.hasOwnProperty.call(record, newKey)) return record[newKey];
  if (language === 'he' && Object.prototype.hasOwnProperty.call(record, 'reviewed_value')) return record.reviewed_value;
  if (language === 'he' && Object.prototype.hasOwnProperty.call(record, 'target_value')) return record.target_value;
  return undefined;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.input) {
    throw new Error('Usage: node scripts/import-reviewed-translations.js --input=translations/manual-review/static-ui-review.json [--apply]');
  }

  const inputPath = path.resolve(rootDir, options.input);
  const rawInput = await readJson(inputPath);
  const records = extractRecords(rawInput);

  const translations = Object.fromEntries(await Promise.all([...LANGUAGES].map(async (language) => [
    language,
    await readJson(path.join(translationDir, `${language}.json`)),
  ])));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    input: path.relative(rootDir, inputPath),
    mode: options.apply ? 'apply' : 'dry-run',
    publicReadyAutomation: false,
    databaseUpdates: false,
    applied: [],
    skipped: [],
    errors: [],
  };

  records.forEach((record, index) => {
    const key = String(record.key || record.record_id || '').trim();
    if (!key || key.includes(':')) {
      report.skipped.push({
        index,
        key,
        reason: 'not_a_static_translation_key',
      });
      return;
    }

    if (record.public_ready || record.mark_public_ready || record.review_status === 'public_ready') {
      report.errors.push({
        index,
        key,
        reason: 'public_ready_changes_are_not_allowed_by_this_importer',
      });
      return;
    }

    const requestedLanguage = String(record.language || record.target_language || 'he').trim();
    if (!LANGUAGES.has(requestedLanguage)) {
      report.errors.push({
        index,
        key,
        reason: `unsupported_language_${requestedLanguage}`,
      });
      return;
    }

    if (requestedLanguage !== 'he' && !options.allowSourceLanguageUpdate) {
      report.skipped.push({
        index,
        key,
        language: requestedLanguage,
        reason: 'source_language_updates_require_--allow-source-language-update',
      });
      return;
    }

    const reviewedValue = reviewedValueFor(record, requestedLanguage);
    if (typeof reviewedValue !== 'string' || !reviewedValue.trim()) {
      report.skipped.push({
        index,
        key,
        language: requestedLanguage,
        reason: 'no_reviewed_value_provided',
      });
      return;
    }

    const currentValue = getPathValue(translations[requestedLanguage], key);
    const referenceLanguage = requestedLanguage === 'pl'
      ? 'en'
      : (getPathValue(translations.en, key) !== undefined ? 'en' : 'pl');
    const referenceValue = stringifyLeaf(getPathValue(translations[referenceLanguage], key));
    const validationErrors = tokenValidation(referenceValue, reviewedValue);
    if (validationErrors.length) {
      report.errors.push({
        index,
        key,
        language: requestedLanguage,
        reason: 'validation_failed',
        validationErrors,
      });
      return;
    }

    report.applied.push({
      index,
      key,
      language: requestedLanguage,
      previous: currentValue,
      next: reviewedValue,
      applied: options.apply,
    });

    if (options.apply) {
      setPathValue(translations[requestedLanguage], key, reviewedValue);
    }
  });

  if (options.apply && report.errors.length === 0) {
    await Promise.all([...LANGUAGES].map(async (language) => {
      await writeJson(path.join(translationDir, `${language}.json`), translations[language]);
    }));
  }

  const reportPath = path.join(
    reportDir,
    options.apply ? 'import-apply-report.json' : 'import-dry-run-report.json',
  );
  await writeJson(reportPath, report);
  console.log(JSON.stringify({
    mode: report.mode,
    input: report.input,
    appliedCandidates: report.applied.length,
    skipped: report.skipped.length,
    errors: report.errors.length,
    report: path.relative(rootDir, reportPath),
    wroteTranslations: options.apply && report.errors.length === 0,
  }, null, 2));

  if (report.errors.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
