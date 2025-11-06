// Script to extract packing guide data from app.js
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Extract packingGuide object
const packingMatch = appJsContent.match(/const packingGuide = \{([\s\S]*?)\};[\s\S]*?let selectedPackingSeasonId/);

if (!packingMatch) {
  console.error('Could not find packingGuide in app.js');
  process.exit(1);
}

// Write the extracted packing guide as-is (it's already well structured)
const output = `// Packing guide data - extracted from app.js
const PACKING_GUIDE = {
${packingMatch[1]}
};
`;

const outputPath = path.join(__dirname, '..', 'js', 'data-packing.js');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✅ Extracted packing guide to js/data-packing.js`);
