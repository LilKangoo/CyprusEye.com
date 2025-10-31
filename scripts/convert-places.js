/**
 * Script to convert hardcoded place names to translation getters
 * Run with: node convert-places.js
 */

const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Add helper function at the top if not already there
const helperFunction = `// Helper function to get translated text
function getTranslation(key, fallback = '') {
  if (window.appI18n && window.appI18n.translations) {
    const currentLang = window.appI18n.language || 'pl';
    const translations = window.appI18n.translations[currentLang] || {};
    return translations[key] || fallback;
  }
  return fallback;
}

`;

if (!content.includes('function getTranslation(')) {
  // Remove old const places = [ line and add helper before it
  content = content.replace('const places = [', helperFunction + 'const places = [');
}

// List of all place IDs from the translations
const placeIds = [
  'kato-pafos-archaeological-park',
  'tombs-of-the-kings',
  'coral-bay',
  'aphrodite-rock',
  'blue-lagoon-akamas',
  'kourion-archaeological-site',
  'kolossi-castle',
  'molos-promenade',
  'amathus-ruins',
  'limassol-castle',
  'saint-lazarus-church',
  'larnaca-salt-lake-hala-sultan',
  'finikoudes-beach',
  'chirokitia-archaeological-site',
  'lefkara-village',
  'nissi-beach',
  'cape-greco',
  'fig-tree-bay',
  'ayia-napa-monastery',
  'ayia-napa-sculpture-park',
  'troodos-olympos',
  'kykkos-monastery',
  'omodos-village',
  'kakopetria-village',
  'caledonia-waterfall',
  'kyrenia-old-harbour',
  'kyrenia-castle',
  'st-hilarion-castle',
  'famagusta-old-town',
  'karpaz-golden-beach',
  'zenobia-wreck',
  'avakas-gorge',
  'aphrodites-baths',
  'polis-latchi-marina'
];

console.log('Converting places to use translation system...\n');

let converted = 0;

placeIds.forEach(placeId => {
  // Pattern to find the place object
  const pattern = new RegExp(
    `(\\{\\s*id:\\s*'${placeId}',[^}]*?)name:\\s*'([^']*)',([^}]*?)description:\\s*'([^']*)',([^}]*?)badge:\\s*'([^']*)',`,
    'gs'
  );

  const match = content.match(pattern);
  if (match) {
    const oldBlock = match[0];
    const nameFallback = match[0].match(/name:\s*'([^']*)'/)?.[1] || '';
    const descFallback = match[0].match(/description:\s*'([^']*)'/)?.[1] || '';
    const badgeFallback = match[0].match(/badge:\s*'([^']*)'/)?.[1] || '';

    // Create new block with getters
    let newBlock = oldBlock.replace(
      /name:\s*'[^']*',/,
      `get name() { return getTranslation('places.${placeId}.name', '${nameFallback.replace(/'/g, "\\'")}'); },`
    );
    
    newBlock = newBlock.replace(
      /description:\s*'[^']*',/,
      `get description() { return getTranslation('places.${placeId}.description', '${descFallback.replace(/'/g, "\\'")}'); },`
    );
    
    newBlock = newBlock.replace(
      /badge:\s*'[^']*',/,
      `get badge() { return getTranslation('places.${placeId}.badge', '${badgeFallback.replace(/'/g, "\\'")}'); },`
    );

    content = content.replace(oldBlock, newBlock);
    converted++;
    console.log(`✓ Converted ${placeId}`);
  } else {
    console.log(`⚠ Could not find ${placeId}`);
  }
});

// Handle multi-line descriptions with special regex
const multiLinePattern = /(\{\s*id:\s*'([^']+)',.*?)name:\s*'([^']+)',\s*description:\s*'([^']+)'/gs;

content = content.replace(multiLinePattern, (match, prefix, id, name, desc) => {
  return `${prefix}get name() { return getTranslation('places.${id}.name', '${name.replace(/'/g, "\\'")}'); },
    get description() { return getTranslation('places.${id}.description', '${desc.replace(/'/g, "\\'")}'); }`;
});

// Write the updated content
fs.writeFileSync(appJsPath, content, 'utf8');

console.log(`\n✅ Converted ${converted} places to use translations!`);
console.log('📝 All place names, descriptions, and badges now use the i18n system.');
console.log('\n⚠️  Note: Some manual verification may be needed for complex descriptions.');
