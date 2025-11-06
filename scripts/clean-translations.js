/**
 * Script to clean auto-translation markers
 * Run with: node clean-translations.js
 */

const fs = require('fs');
const path = require('path');

const elPath = path.join(__dirname, 'translations', 'el.json');
const hePath = path.join(__dirname, 'translations', 'he.json');

const el = JSON.parse(fs.readFileSync(elPath, 'utf8'));
const he = JSON.parse(fs.readFileSync(hePath, 'utf8'));

function cleanMarkers(obj) {
  let cleaned = 0;
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string' && obj[key].includes('[AUTO-TRANSLATED - NEEDS REVIEW]')) {
      obj[key] = obj[key].replace(' [AUTO-TRANSLATED - NEEDS REVIEW]', '');
      cleaned++;
    } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Handle nested objects like { html: "...", text: "..." }
      if (obj[key].html && typeof obj[key].html === 'string') {
        obj[key].html = obj[key].html.replace(' [AUTO-TRANSLATED - NEEDS REVIEW]', '');
      }
      if (obj[key].text && typeof obj[key].text === 'string') {
        obj[key].text = obj[key].text.replace(' [AUTO-TRANSLATED - NEEDS REVIEW]', '');
      }
    }
  });
  return cleaned;
}

console.log('Cleaning translation markers...\n');

const elCleaned = cleanMarkers(el);
console.log(`Greek: Cleaned ${elCleaned} markers`);

const heCleaned = cleanMarkers(he);
console.log(`Hebrew: Cleaned ${heCleaned} markers\n`);

// Write cleaned files
fs.writeFileSync(elPath, JSON.stringify(el, null, 2) + '\n', 'utf8');
console.log(`✓ Updated ${elPath}`);

fs.writeFileSync(hePath, JSON.stringify(he, null, 2) + '\n', 'utf8');
console.log(`✓ Updated ${hePath}`);

console.log('\n✅ Translation markers cleaned!');
console.log('\n📝 NOTE: Greek and Hebrew files now contain English text.');
console.log('   These should be professionally translated by native speakers.');
console.log('   The structure is 100% complete and ready for translation.\n');
