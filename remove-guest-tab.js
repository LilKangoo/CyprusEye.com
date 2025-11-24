#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of HTML files to update
const htmlFiles = [
  'index.html',
  'community.html',
  'tasks.html',
  'recommendations.html',
  'packing.html',
  'trips.html',
  'hotels.html',
  'kupon.html',
  'car-rental.html',
  'car-rental-landing.html',
  'achievements.html',
  '404.html',
  'advertise.html',
  'attractions.html',
  'autopfo.html',
  'cruise.html',
  'hotel.html',
  'trip.html'
];

function removeGuestTab(filename) {
  const filepath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  Skipping ${filename} - not found`);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Check if guest tab exists
  if (!content.includes('authTabGuest') && !content.includes('authPanelGuest')) {
    console.log(`✓ ${filename} - no guest tab found`);
    return;
  }
  
  let modified = false;
  
  // Remove the guest tab button (including button element and all attributes)
  const guestTabPattern = /<button[^>]*id="authTabGuest"[^>]*>[\s\S]*?<\/button>/g;
  if (content.match(guestTabPattern)) {
    content = content.replace(guestTabPattern, '');
    modified = true;
  }
  
  // Remove the guest panel section (including section element and all content)
  const guestPanelPattern = /<section[^>]*id="authPanelGuest"[^>]*>[\s\S]*?<\/section>/g;
  if (content.match(guestPanelPattern)) {
    content = content.replace(guestPanelPattern, '');
    modified = true;
  }
  
  if (!modified) {
    console.log(`⚠️  Could not remove guest tab from ${filename}`);
    return;
  }
  
  // Write back
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`✓ Removed guest tab and panel from ${filename}`);
}

console.log('Removing guest tab and panel from HTML files...\n');
htmlFiles.forEach(removeGuestTab);
console.log('\n✓ Guest tab removal complete!');
