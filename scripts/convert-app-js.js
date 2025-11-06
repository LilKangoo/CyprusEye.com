const fs = require('fs');

console.log('Converting app.js to use translation system for place names...\n');

const appJsPath = './app.js';
let content = fs.readFileSync(appJsPath, 'utf8');

// Add helper function at the beginning if not present
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

if (!content.includes('function getTranslation')) {
  content = helperFunction + content;
}

// Convert each place entry
// Pattern: id: 'place-id', name: 'Name', description: 'Desc', ...badge: 'Badge',
const placePattern = /(\{\s*id:\s*'([^']+)',\s*)name:\s*'([^']+)',\s*description:\s*'([^']+)',/g;

content = content.replace(placePattern, (match, prefix, id, name, desc) => {
  const safeName = name.replace(/'/g, "\\'");
  const safeDesc = desc.replace(/'/g, "\\'");
  
  return `${prefix}get name() { return getTranslation('places.${id}.name', '${safeName}'); },
    get description() { return getTranslation('places.${id}.description', '${safeDesc}'); },`;
});

// Convert badge separately as it comes after lat/lng
const badgePattern = /(badge:\s*)'([^']+)',/g;
let badgeCount = 0;

// We need to match badge with its place ID - let's do it differently
// Find all place blocks and convert them
const placeBlockPattern = /\{[\s\S]*?id:\s*'([^']+)'[\s\S]*?badge:\s*'([^']+)',[\s\S]*?\}/g;
let placeMatches = [];
let match;

while ((match = placeBlockPattern.exec(content)) !== null) {
  placeMatches.push({
    fullMatch: match[0],
    id: match[1],
    badge: match[2],
    index: match.index
  });
}

// Replace badges from end to beginning to maintain indices
for (let i = placeMatches.length - 1; i >= 0; i--) {
  const pm = placeMatches[i];
  const oldBadge = `badge: '${pm.badge}',`;
  const safeBadge = pm.badge.replace(/'/g, "\\'");
  const newBadge = `get badge() { return getTranslation('places.${pm.id}.badge', '${safeBadge}'); },`;
  
  const placeBlock = content.substring(pm.index, pm.index + pm.fullMatch.length);
  const updatedBlock = placeBlock.replace(oldBadge, newBadge);
  
  content = content.substring(0, pm.index) + updatedBlock + content.substring(pm.index + pm.fullMatch.length);
  badgeCount++;
}

// Remove duplicate helper if it was added
const helperCount = (content.match(/function getTranslation\(/g) || []).length;
if (helperCount > 1) {
  // Keep only the first occurrence
  let firstFound = false;
  content = content.replace(/\/\/ Helper function to get translated text[\s\S]*?}\n\n/g, () => {
    if (!firstFound) {
      firstFound = true;
      return helperFunction;
    }
    return '';
  });
}

// Write back
fs.writeFileSync(appJsPath, content, 'utf8');

console.log(`✅ Conversion complete!`);
console.log(`   - Converted ${placeMatches.length} place entries`);
console.log(`   - All name, description, and badge fields now use getTranslation()`);
console.log(`\n📝 The app will now dynamically translate place names based on selected language!`);
