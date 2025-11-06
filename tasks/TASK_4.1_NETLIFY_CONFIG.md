# ZADANIE 4.1: Rozszerzyć netlify.toml

**Czas:** 2 godziny  
**Priorytet:** WYSOKI  
**Ryzyko:** ŚREDNI (deployment config)

---

## KROK 1: Backup (5 min)

```bash
cp netlify.toml netlify.toml.backup
```

---

## KROK 2: Pełna konfiguracja netlify.toml (30 min)

Zastąpić zawartość:

```toml
# ============================================
# BUILD CONFIGURATION
# ============================================
[build]
  publish = "dist"
  command = "npm run build"
  
[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

# ============================================
# REDIRECTS & REWRITES
# ============================================

# SPA fallback dla subfolderów
[[redirects]]
  from = "/auth/*"
  to = "/auth/index.html"
  status = 200

[[redirects]]
  from = "/account/*"
  to = "/account/index.html"
  status = 200

[[redirects]]
  from = "/reset/*"
  to = "/reset/index.html"
  status = 200

# 404 page
[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
  force = false

# ============================================
# SECURITY HEADERS
# ============================================
[[headers]]
  for = "/*"
  [headers.values]
    # Content Security Policy
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://esm.sh https://unpkg.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https: blob:;
      connect-src 'self' https://daoohnbnnowmmcizgvrq.supabase.co https://www.google-analytics.com;
      frame-src 'self' https://docs.google.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      upgrade-insecure-requests;
    """
    
    # Security Headers
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(self), microphone=(), camera=()"
    
    # HSTS (Strict Transport Security)
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"

# Cache static assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/js/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/css/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Don't cache HTML
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

# ============================================
# PLUGINS (opcjonalne)
# ============================================
# [[plugins]]
#   package = "@netlify/plugin-lighthouse"
```

---

## KROK 3: Test lokalnie (15 min)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Test build
netlify build

# Test dev server
netlify dev
```

---

## KROK 4: Deploy Preview (30 min)

```bash
# Deploy preview
netlify deploy

# Test preview URL
# Sprawdź:
# - Redirects działają
# - Headers present (sprawdź DevTools)
# - Build successful
```

---

## KROK 5: Production Deploy (15 min)

```bash
netlify deploy --prod
```

---

## KROK 6: Verify (15 min)

### Security Headers:
https://securityheaders.com/ → Wpisz URL → **Cel: A+**

### Redirects:
- Otwórz: yourdomain.com/auth/callback
- Sprawdź czy działa

### Performance:
```bash
npx lighthouse https://yourdomain.com --view
```

---

## COMMIT

```bash
git add netlify.toml
git commit -m "Task 4.1: Complete Netlify configuration

- Configured build command and publish directory
- Added SPA redirects for auth/account/reset
- Implemented comprehensive security headers
- Added cache headers for static assets
- Configured CSP, HSTS, X-Frame-Options
- Tested deployment: all features working"
```

---

## ✅ DONE

- [ ] netlify.toml complete
- [ ] Build tested
- [ ] Deploy preview successful
- [ ] Production deploy
- [ ] Security headers A+
- [ ] All redirects working

---

**NASTĘPNE:** TASK_5.1_FINAL_TESTING.md
