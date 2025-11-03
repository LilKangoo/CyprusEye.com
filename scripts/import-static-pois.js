#!/usr/bin/env node

/**
 * Import Static POIs to Supabase
 * Converts data-places.js to SQL INSERT statements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read data-places.js and extract POI data
const dataPlacesPath = path.join(__dirname, '../js/data-places.js');
const content = fs.readFileSync(dataPlacesPath, 'utf8');

// Extract the array content between [ and ];
const match = content.match(/const STATIC_PLACES_DATA = (\[[\s\S]*?\]);/);
if (!match) {
  console.error('❌ Could not extract STATIC_PLACES_DATA');
  process.exit(1);
}

// Convert JavaScript object notation to JSON
const arrayContent = match[1]
  .replace(/(\w+):/g, '"$1":') // Quote keys
  .replace(/'/g, '"');         // Convert single quotes to double

try {
  var poisData = JSON.parse(arrayContent);
  console.log(`✅ Found ${poisData.length} POIs in data-places.js`);
} catch (err) {
  console.error('❌ Failed to parse POI data:', err.message);
  console.error('Trying alternative method...');
  
  // Fallback: use Function constructor (safer than eval)
  const parsedData = new Function(`return ${match[1]}`)();
  poisData = parsedData;
  console.log(`✅ Found ${poisData.length} POIs using fallback parser`);
}

// Generate SQL
let sql = `-- =====================================================
-- IMPORT STATIC POIs TO SUPABASE
-- =====================================================
-- Generated from: js/data-places.js
-- Total POIs: ${poisData.length}
-- =====================================================

-- Delete existing POIs (optional - comment out if you want to keep existing)
-- DELETE FROM pois;

-- Insert all POIs
INSERT INTO pois (id, name, description, lat, lng, badge, xp, required_level, status, google_maps_url)
VALUES\n`;

const values = [];

poisData.forEach((poi, index) => {
  const id = poi.id || '';
  const name = (poi.nameFallback || poi.name || '').replace(/'/g, "''");
  const description = (poi.descriptionFallback || poi.description || '').replace(/'/g, "''");
  const lat = poi.lat || 0;
  const lng = poi.lng || 0;
  const badge = (poi.badgeFallback || poi.badge || 'Explorer').replace(/'/g, "''");
  const xp = poi.xp || 100;
  const requiredLevel = poi.requiredLevel || 1;
  const status = 'published';
  const googleMapsUrl = poi.googleMapsUrl || `https://maps.google.com/?q=${lat},${lng}`;
  
  values.push(`  ('${id}', '${name}', '${description}', ${lat}, ${lng}, '${badge}', ${xp}, ${requiredLevel}, '${status}', '${googleMapsUrl}')`);
});

sql += values.join(',\n');
sql += '\nON CONFLICT (id) DO UPDATE SET\n';
sql += '  name = EXCLUDED.name,\n';
sql += '  description = EXCLUDED.description,\n';
sql += '  lat = EXCLUDED.lat,\n';
sql += '  lng = EXCLUDED.lng,\n';
sql += '  badge = EXCLUDED.badge,\n';
sql += '  xp = EXCLUDED.xp,\n';
sql += '  required_level = EXCLUDED.required_level,\n';
sql += '  status = EXCLUDED.status,\n';
sql += '  google_maps_url = EXCLUDED.google_maps_url;\n\n';

sql += `-- =====================================================
-- VERIFY
-- =====================================================

SELECT 
  'Import completed!' as status,
  COUNT(*) as total_pois,
  COUNT(*) FILTER (WHERE status = 'published') as published_pois
FROM pois;

-- Show sample
SELECT id, name, lat, lng, status, xp 
FROM pois 
WHERE status = 'published'
ORDER BY xp DESC
LIMIT 10;

-- =====================================================
-- RESULT:
-- Should show ${poisData.length} total POIs, all published
-- =====================================================
`;

// Write SQL file
const outputPath = path.join(__dirname, '../IMPORT_ALL_POIS.sql');
fs.writeFileSync(outputPath, sql, 'utf8');

console.log(`✅ Generated SQL: ${outputPath}`);
console.log(`📊 Total POIs: ${poisData.length}`);
console.log(`📝 Next step: Run this SQL in Supabase SQL Editor`);
console.log(``);
console.log(`   https://supabase.com/dashboard/project/daoohnbnnowmmcizgvrq/editor`);
console.log(``);
