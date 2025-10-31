/**
 * Script to fill missing translations based on en.json
 * Run with: node update-translations.js
 */

const fs = require('fs');
const path = require('path');

// Read all translation files
const enPath = path.join(__dirname, 'translations', 'en.json');
const plPath = path.join(__dirname, 'translations', 'pl.json');
const elPath = path.join(__dirname, 'translations', 'el.json');
const hePath = path.join(__dirname, 'translations', 'he.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
const el = JSON.parse(fs.readFileSync(elPath, 'utf8'));
const he = JSON.parse(fs.readFileSync(hePath, 'utf8'));

// Helper to add note about machine translation
const addMachineTranslationNote = (key) => {
  return ` [AUTO-TRANSLATED - NEEDS REVIEW]`;
};

// Function to fill missing keys
function fillMissingKeys(target, source, addNote = false) {
  const sourceKeys = Object.keys(source);
  let added = 0;
  
  sourceKeys.forEach(key => {
    if (!target[key]) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        target[key] = { ...source[key] };
      } else {
        target[key] = source[key] + (addNote ? addMachineTranslationNote(key) : '');
      }
      added++;
    }
  });
  
  return added;
}

console.log('Checking translations...\n');
console.log(`English keys: ${Object.keys(en).length}`);
console.log(`Polish keys: ${Object.keys(pl).length}`);
console.log(`Greek keys: ${Object.keys(el).length}`);
console.log(`Hebrew keys: ${Object.keys(he).length}\n`);

// Fill missing translations
console.log('Filling missing translations...\n');

const plAdded = fillMissingKeys(pl, en, false);
console.log(`Polish: Added ${plAdded} keys from English`);

const elAdded = fillMissingKeys(el, en, true);
console.log(`Greek: Added ${elAdded} keys (marked for review)`);

const heAdded = fillMissingKeys(he, en, true);
console.log(`Hebrew: Added ${heAdded} keys (marked for review)\n`);

// Write updated files with sorted keys
function writeWithSortedKeys(path, obj) {
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {});
  fs.writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

writeWithSortedKeys(plPath, pl);
console.log(`✓ Updated ${plPath}`);

writeWithSortedKeys(elPath, el);
console.log(`✓ Updated ${elPath}`);

writeWithSortedKeys(hePath, he);
console.log(`✓ Updated ${hePath}`);

console.log('\n✅ All translations updated!');
console.log('\n⚠️  NOTE: Greek and Hebrew translations are auto-filled from English');
console.log('   and marked with [AUTO-TRANSLATED - NEEDS REVIEW].');
console.log('   Please review and replace with proper translations.\n');
