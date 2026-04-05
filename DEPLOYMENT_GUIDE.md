# Deployment Guide - CyprusEye Admin Panel Fix

## Problem Fixed ✅

The admin panel was showing 404 errors for CSS and JS files because Cloudflare Pages was deploying from the **root directory** instead of the **`dist/` build output directory**.

## Changes Made

### 1. **Configuration Files Updated**

#### `.cloudflare-pages.toml` (NEW)
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--verbose"
```

#### `docs/infra/netlify.toml` (UPDATED)
```toml
[build]
  publish = "dist"
  command = "npm run build"
```

#### `_headers` (FIXED)
- Removed leading space from `/admin/*` path
- Ensured admin panel CSP rules are properly applied

### 2. **Build Output Verified**

```
dist/
├── admin/
│   ├── index.html (70KB)
│   ├── admin.css (30KB)
│   └── admin.js (146KB)
├── assets/
├── blog.html
├── blog-post.html
├── js/
├── _headers
├── _redirects
└── ...
```

### 3. **Blog rollout included**
- Public routes:
  - `/blog`
  - `/blog/<slug>`
- Dynamic SEO for blog list and blog post is served through Functions/local `server.js`.
- Before deployment, make sure blog migration `supabase/migrations/130_blog_posts_and_translations.sql` has been applied.
- Admin panel now includes a `Blog` section for bilingual post management and partner approval workflow.

## Deployment Instructions for Cloudflare Pages

### Method 1: Via Cloudflare Dashboard (RECOMMENDED)

1. **Login to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Navigate to Workers & Pages → Pages

2. **Update Build Configuration**
   - Select your `CyprusEye.com` project
   - Go to Settings → Builds & deployments
   - Update the following:
     - **Build command**: `npm run build`
     - **Build output directory**: `dist`
     - **Root directory**: `/` (leave as default)
     - **Node version**: `18`

3. **Save and Redeploy**
   - Click "Save"
   - Go to Deployments tab
   - Click "Retry deployment" or push a new commit to trigger deployment

### Method 2: Via Git Push (AUTOMATIC)

Since we've updated the configuration files:

```bash
# Commit all changes
git add .
git commit -m "Fix: Update Cloudflare Pages to deploy from dist directory"
git push origin main
```

Cloudflare Pages will automatically:
1. Detect the `.cloudflare-pages.toml` configuration
2. Run `npm run build`
3. Deploy from the `dist/` directory

## Verification Steps

After deployment, test the admin panel:

1. **Access Admin Panel**
   - Navigate to: `https://cypruseye.com/admin`
   
2. **Check Browser Console** (F12)
   - ✅ No 404 errors for `/admin/admin.css`
   - ✅ No 404 errors for `/admin/admin.js`
   - ✅ No CSP violations for admin resources
   - ✅ Login screen should appear

3. **Test Login**
   - Use admin credentials: `lilkangoomedia@gmail.com`
   - Should successfully authenticate and show admin dashboard

4. **Test blog routes**
   - `https://cypruseye.com/blog`
   - `https://cypruseye.com/blog/<slug>`
   - Verify title/description/canonical/hreflang in raw HTML
   - Verify CTA cards and author byline on the public post

## Common Issues & Solutions

### Issue: Still getting 404s after deployment

**Solution**: Clear Cloudflare cache
1. Go to Cloudflare Dashboard → Caching → Configuration
2. Click "Purge Everything"
3. Wait 30 seconds and try again

### Issue: CSP errors in console

**Solution**: The `_headers` file has been updated with proper admin panel CSP rules. Ensure it was deployed correctly.

### Issue: Build fails on Cloudflare

**Solution**: Check build logs
- Ensure Node.js version is 18+
- Verify all dependencies are in `package.json`
- Check that `scripts/build.js` exists and is executable

## Local Testing

To test the build output locally:

```bash
# Build the project
npm run build

# Serve the dist directory
cd dist
npx http-server -p 8080

# Open browser
open http://localhost:8080/admin
```

## Build Process Overview

The build script (`scripts/build.js`):
1. Cleans the `dist/` directory
2. Minifies all JavaScript files
3. Copies static assets (HTML, CSS, images)
4. Copies admin panel files to `dist/admin/`
5. Copies configuration files (`_headers`, `_redirects`, etc.)

## Files Modified

- ✅ `docs/infra/netlify.toml` - Fixed publish directory
- ✅ `.cloudflare-pages.toml` - Created new Cloudflare config
- ✅ `_headers` - Fixed admin panel path formatting
- ✅ `dist/` - Complete rebuild with all files
- ✅ Blog public pages, Functions SEO handlers and admin blog workflow

## Next Steps

1. ✅ Commit changes to Git
2. ✅ Push to main branch
3. ⏳ Wait for Cloudflare Pages automatic deployment
4. ⏳ Test admin panel at `https://cypruseye.com/admin`
5. ⏳ Verify no console errors

---

**Date**: November 7, 2024  
**Status**: ✅ Ready for Deployment  
**Build Output**: All files verified in `dist/` directory
