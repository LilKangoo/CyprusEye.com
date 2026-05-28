#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getArg(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim() || fallback;
  }

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1].trim() || fallback;
  }

  return fallback;
}

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

function flattenTranslations(value, prefix = '', output = {}) {
  if (!prefix && !isPlainObject(value)) {
    return output;
  }

  if (prefix && isTranslationLeaf(value)) {
    output[prefix] = value;
    return output;
  }

  Object.entries(value || {}).forEach(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    flattenTranslations(child, nextKey, output);
  });

  return output;
}

function sortKeys(keys) {
  return [...keys].sort((a, b) => a.localeCompare(b, 'en'));
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const baseLang = getArg('--base', 'en').toLowerCase();
  const targetLang = getArg('--target', 'he').toLowerCase();
  const outputArg = getArg('--output', '');
  const outputPath = outputArg
    ? path.resolve(rootDir, outputArg)
    : path.join(rootDir, 'translations', `audit-${targetLang}-vs-${baseLang}.json`);

  const basePath = path.join(rootDir, 'translations', `${baseLang}.json`);
  const targetPath = path.join(rootDir, 'translations', `${targetLang}.json`);

  const [base, target] = await Promise.all([
    readJson(basePath),
    readJson(targetPath),
  ]);

  const baseFlat = flattenTranslations(base);
  const targetFlat = flattenTranslations(target);
  const baseKeys = sortKeys(Object.keys(baseFlat));
  const targetKeys = sortKeys(Object.keys(targetFlat));
  const targetSet = new Set(targetKeys);
  const baseSet = new Set(baseKeys);

  const missingKeys = baseKeys.filter((key) => !targetSet.has(key));
  const extraKeys = targetKeys.filter((key) => !baseSet.has(key));
  const sameAsBaseKeys = baseKeys.filter((key) => (
    targetSet.has(key)
    && JSON.stringify(targetFlat[key]) === JSON.stringify(baseFlat[key])
  ));

  const report = {
    baseLanguage: baseLang,
    targetLanguage: targetLang,
    generatedAt: new Date().toISOString(),
    counts: {
      baseKeys: baseKeys.length,
      targetKeys: targetKeys.length,
      missingKeys: missingKeys.length,
      extraKeys: extraKeys.length,
      sameAsBaseKeys: sameAsBaseKeys.length,
    },
    missingKeys,
    extraKeys,
    sameAsBaseKeys,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Translation audit: ${targetLang} vs ${baseLang}`);
  console.log(`Base keys (${baseLang}): ${report.counts.baseKeys}`);
  console.log(`Target keys (${targetLang}): ${report.counts.targetKeys}`);
  console.log(`Missing in ${targetLang}: ${report.counts.missingKeys}`);
  console.log(`Extra in ${targetLang}: ${report.counts.extraKeys}`);
  console.log(`Same as ${baseLang}: ${report.counts.sameAsBaseKeys}`);
  console.log(`Report: ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
