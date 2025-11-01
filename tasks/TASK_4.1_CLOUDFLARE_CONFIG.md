# ZADANIE 4.1: Cloudflare Pages Configuration

**Czas:** 2 godziny  
**Priorytet:** WYSOKI  
**Ryzyko:** ŚREDNI (deployment config)

---

## KROK 1: Backup (5 min)

```bash
# Backup istniejących plików
cp netlify.toml netlify.toml.backup 2>/dev/null || true
```

---

## KROK 2: Utworzyć `_headers` dla Cloudflare (20 min)

### Utworzyć plik `/_headers`:

```
# Security & Performance Headers dla wszystkich stron
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(self), microphone=(), camera=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://esm.sh https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://daoohnbnnowmmcizgvrq.supabase.co https://www.google-analytics.com; frame-src 'self' https://docs.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;

# Cache static assets (1 year)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=31536000, immutable

/translations/*
  Cache-Control: public, max-age=86400

# Don't cache HTML (always fresh)
/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

### Weryfikacja:
- [ ] Plik `_headers` utworzony w root
- [ ] Format poprawny (newline po każdej sekcji)
- [ ] Wszystkie headers obecne
- [ ] Plik zapisany

---

## KROK 3: Utworzyć `_redirects` dla SPA routing (15 min)

### Utworzyć plik `/_redirects`:

```
# SPA routing - preserve URL path
/auth/*    /auth/index.html    200
/account/* /account/index.html 200
/reset/*   /reset/index.html   200

# 404 fallback
/*         /404.html           404
```

### Weryfikacja:
- [ ] Plik `_redirects` utworzony w root
- [ ] Format: `source destination status`
- [ ] SPA routes covered
- [ ] Plik zapisany

---

## KROK 4: Cloudflare Pages build settings (15 min)

### W Cloudflare Dashboard:
1. Workers & Pages → Twój projekt
2. Settings → Builds & deployments
3. Configure:

**Build command:**
```bash
npm run build
```

**Build output directory:**
```
dist
```

**Environment variables:**
```
NODE_VERSION=18
NPM_VERSION=9
```

### Screenshot:
Zrób screenshot ustawień build dla dokumentacji.

### Weryfikacja:
- [ ] Build command ustawiony
- [ ] Output directory = dist
- [ ] Node version = 18
- [ ] Zapisane

---

## KROK 5: Test lokalnie z Wrangler (20 min)

### Zainstaluj Wrangler (Cloudflare CLI):
```bash
npm install -g wrangler
```

### Test build:
```bash
npm run build
```

### Test lokalnie:
```bash
cd dist/
npx wrangler pages dev .
```

Otwórz: http://localhost:8788

### Weryfikacja:
- [ ] Build działa
- [ ] Strona ładuje się lokalnie
- [ ] Redirects działają
- [ ] Headers present (sprawdź DevTools)

---

## KROK 6: Opcjonalnie - wrangler.toml (10 min)

### Jeśli chcesz mieć config w repo:

Utworzyć `/wrangler.toml`:
```toml
name = "cypruseye"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"

[env.production]
name = "cypruseye-production"
```

**UWAGA:** To opcjonalne - Cloudflare Pages może działać bez tego.

---

## KROK 7: Deploy preview (20 min)

### Jeśli masz Wrangler skonfigurowany:
```bash
wrangler pages deploy dist
```

### LUB przez Git:
```bash
git add _headers _redirects
git commit -m "Add Cloudflare Pages configuration"
git push origin feature/phase-1-critical-fixes
```

Cloudflare automatycznie zbuduje preview.

### Sprawdź preview URL:
1. Otwórz Cloudflare Dashboard
2. Workers & Pages → Twój projekt
3. Zobacz najnowszy deployment
4. Test preview URL

---

## KROK 8: Verify Headers w produkcji (10 min)

### Test security headers:
```bash
curl -I https://your-preview-url.pages.dev | grep -i "x-frame\|csp\|strict"
```

### Lub w przeglądarce:
1. Otwórz preview URL
2. DevTools → Network
3. Kliknij pierwszy request
4. Headers → Response Headers
5. Sprawdź czy wszystkie są obecne

### Checklist:
- [ ] Content-Security-Policy ✅
- [ ] X-Frame-Options ✅
- [ ] Strict-Transport-Security ✅
- [ ] X-Content-Type-Options ✅
- [ ] Referrer-Policy ✅

---

## KROK 9: Test redirects (10 min)

### Test w przeglądarce:
1. Otwórz: `https://your-url.pages.dev/auth/callback`
2. Powinno załadować `/auth/index.html`
3. URL bar powinien pokazać `/auth/callback`

### Test pozostałych:
- [ ] /auth/callback → działa
- [ ] /account/settings → działa
- [ ] /reset/password → działa
- [ ] /nieistniejaca-strona → 404.html

---

## KROK 10: Security Headers Test (5 min)

### Online tool:
https://securityheaders.com/

Wpisz preview URL.

**Target score:** A lub A+

### Jeśli nie A+:
- Sprawdź czy `_headers` file jest w dist/
- Sprawdź format headers
- Re-deploy

---

## ROLLBACK

Jeśli coś nie działa:
```bash
# Usuń nowe pliki
rm _headers _redirects wrangler.toml

# Przywróć stary stan
git checkout -- .
```

---

## COMMIT

```bash
git add _headers
git add _redirects
git add wrangler.toml  # jeśli utworzony
git commit -m "Task 4.1: Cloudflare Pages configuration

- Created _headers file with security headers
- Added CSP, HSTS, X-Frame-Options, etc.
- Created _redirects for SPA routing
- Configured cache headers for static assets
- Tested deployment preview
- Security headers test: A+ score"
```

---

## WAŻNE RÓŻNICE vs Netlify:

| Feature | Netlify | Cloudflare |
|---------|---------|------------|
| Config | netlify.toml | _headers + _redirects |
| Headers format | TOML | Cloudflare format |
| Redirects | netlify.toml | _redirects file |
| CLI | netlify-cli | wrangler |
| Deploy | `netlify deploy` | `wrangler pages deploy` lub git push |

---

## ✅ DONE CRITERIA

- [ ] `_headers` utworzony i działa
- [ ] `_redirects` utworzony i działa
- [ ] Cloudflare build settings skonfigurowane
- [ ] Preview deployment successful
- [ ] Security headers: A+
- [ ] All redirects working
- [ ] Cache headers correct
- [ ] Commit wykonany

**Security score:** _____  
**Preview URL:** _____

---

**POPRZEDNIE:** TASK_3.3_FONT_OPTIMIZATION.md  
**NASTĘPNE:** TASK_5.1_FINAL_TESTING.md
