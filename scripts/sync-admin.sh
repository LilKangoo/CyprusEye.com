#!/bin/bash

# Sync admin files to public/ for Cloudflare Pages deployment
# This ensures admin panel assets are available in the build output

echo "🔄 Syncing admin panel files to public/admin/..."

# Create public/admin directory if it doesn't exist
mkdir -p public/admin

# Copy admin files
cp -v admin/admin.js public/admin/
cp -v admin/admin.css public/admin/
cp -v admin/index.html public/admin/

echo "✅ Admin files synced successfully!"
echo ""
echo "Files copied:"
echo "  - admin/admin.js → public/admin/admin.js"
echo "  - admin/admin.css → public/admin/admin.css"
echo "  - admin/index.html → public/admin/index.html"
echo ""
echo "💡 Remember to commit these changes to git!"
