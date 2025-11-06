// Improved script to extract places data with fallback values
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Extract places array
const placesMatch = appJsContent.match(/const places = \[([\s\S]*?)\];[\s\S]*?const tasks/);

if (!placesMatch) {
  console.error('Could not find places array in app.js');
  process.exit(1);
}

const placesStr = placesMatch[1];

// More comprehensive regex to extract place data including fallback values
const placeObjects = placesStr.split(/\},\s*\{/).map((str, index, arr) => {
  // Add back the braces
  if (index === 0) str = str + '}';
  else if (index === arr.length - 1) str = '{' + str;
  else str = '{' + str + '}';
  
  return str;
});

const places = [];

placeObjects.forEach(placeStr => {
  // Extract id
  const idMatch = placeStr.match(/id:\s*'([^']+)'/);
  if (!idMatch) return;
  const id = idMatch[1];
  
  // Extract name fallback
  const nameMatch = placeStr.match(/get name\(\).*?getTranslation\([^,]+,\s*'([^']+)'\)/s);
  const nameFallback = nameMatch ? nameMatch[1] : id;
  
  // Extract description fallback
  const descMatch = placeStr.match(/get description\(\).*?getTranslation\([^,]+,\s*'([^']+)'\)/s);
  const descriptionFallback = descMatch ? descMatch[1] : '';
  
  // Extract badge fallback
  const badgeMatch = placeStr.match(/get badge\(\).*?getTranslation\([^,]+,\s*'([^']+)'\)/s);
  const badgeFallback = badgeMatch ? badgeMatch[1] : '';
  
  // Extract coordinates
  const latMatch = placeStr.match(/lat:\s*([\d.]+)/);
  const lngMatch = placeStr.match(/lng:\s*([\d.]+)/);
  const lat = latMatch ? parseFloat(latMatch[1]) : 0;
  const lng = lngMatch ? parseFloat(lngMatch[1]) : 0;
  
  // Extract other fields
  const googleMapsMatch = placeStr.match(/googleMapsUrl:\s*'([^']+)'/);
  const xpMatch = placeStr.match(/xp:\s*(\d+)/);
  const levelMatch = placeStr.match(/requiredLevel:\s*(\d+)/);
  
  places.push({
    id,
    nameKey: `places.${id}.name`,
    nameFallback,
    descriptionKey: `places.${id}.description`,
    descriptionFallback,
    badgeKey: `places.${id}.badge`,
    badgeFallback,
    lat,
    lng,
    googleMapsUrl: googleMapsMatch ? googleMapsMatch[1] : '',
    xp: xpMatch ? parseInt(xpMatch[1]) : 0,
    requiredLevel: levelMatch ? parseInt(levelMatch[1]) : 1
  });
});

// Write to output file
const output = `// Places data - extracted from app.js with fallback values
// Total: ${places.length} places
const PLACES_DATA = ${JSON.stringify(places, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'js', 'data-places.js');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✅ Extracted ${places.length} places with fallback values to js/data-places.js`);
