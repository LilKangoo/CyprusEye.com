// Script to extract places data from app.js
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Extract places array using regex
const placesMatch = appJsContent.match(/const places = \[([\s\S]*?)\];[\s\S]*?const tasks/);

if (!placesMatch) {
  console.error('Could not find places array in app.js');
  process.exit(1);
}

const placesStr = placesMatch[1];

// Parse places - this is complex because of get functions
// We'll create a simplified version
const places = [];
const placeRegex = /\{[\s\S]*?id:\s*'([^']+)'[\s\S]*?lat:\s*([\d.]+),[\s\S]*?lng:\s*([\d.]+),[\s\S]*?googleMapsUrl:\s*'([^']+)'[\s\S]*?xp:\s*(\d+),[\s\S]*?requiredLevel:\s*(\d+),[\s\S]*?\}/g;

let match;
while ((match = placeRegex.exec(placesStr)) !== null) {
  const id = match[1];
  const lat = parseFloat(match[2]);
  const lng = parseFloat(match[3]);
  const googleMapsUrl = match[4];
  const xp = parseInt(match[5]);
  const requiredLevel = parseInt(match[6]);
  
  places.push({
    id,
    nameKey: `places.${id}.name`,
    descriptionKey: `places.${id}.description`,
    badgeKey: `places.${id}.badge`,
    lat,
    lng,
    googleMapsUrl,
    xp,
    requiredLevel
  });
}

// Write to output file
const output = `// Places data - extracted from app.js
// Total: ${places.length} places
const PLACES_DATA = ${JSON.stringify(places, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'js', 'data-places.js');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✅ Extracted ${places.length} places to js/data-places.js`);
