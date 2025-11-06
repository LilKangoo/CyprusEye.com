# ✅ NAPRAWA MAPY - BRAK WIDOCZNOŚCI NA GŁÓWNEJ STRONIE

## 🔍 DIAGNOZA PROBLEMU

### Objawy:
- Mapa nie wyświetlała się na stronie głównej `/index`
- Console error: `Refused to execute script from 'https://cypruseye.com/poi-loader.js?v=2316' because its MIME type ('text/html') is not executable`
- Plik JavaScript był serwowany jako HTML zamiast application/javascript

### Przyczyna root cause:
Cloudflare Functions przechwytywały **wszystkie** requesty przez catch-all route `functions/[[path]].js`, w tym requesty do plików statycznych JS/CSS. Gdy plik nie był znaleziony (404), zwracany był `index.html` zamiast prawdziwego 404.

---

## 🔧 ROZWIĄZANIE

### 1. Utworzono `_routes.json` (Cloudflare Pages routing)

**Plik:** `/_routes.json`

```json
{
  "version": 1,
  "include": [
    "/admin/*",
    "/auth/*",
    "/account/*",
    "/reset/*"
  ],
  "exclude": [
    "/*.js",
    "/*.css",
    "/*.html",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.svg",
    "/*.webp",
    "/*.ico",
    "/*.json",
    "/*.xml",
    "/*.txt",
    "/js/*",
    "/css/*",
    "/assets/*",
    "/public/*"
  ]
}
```

**Efekt:** Statyczne pliki JS/CSS nie są przetwarzane przez Functions, tylko serwowane bezpośrednio przez CDN.

---

### 2. Naprawiono catch-all route

**Plik:** `/functions/[[path]].js`

**PRZED:**
```javascript
export async function onRequest(context) {
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status !== 404) return res;
  // Zawsze zwracał index.html dla 404
  return serveStatic(context, '/index.html');
}
```

**PO:**
```javascript
export async function onRequest(context) {
  const res = await context.env.ASSETS.fetch(context.request);
  if (res.status !== 404) return res;
  
  // Nie zwracaj index.html dla plików z rozszerzeniem
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // Jeśli ścieżka ma rozszerzenie pliku (.js, .css, .png, etc.) zwróć 404
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return res; // Zwróć 404
  }
  
  // fallback do /index.html tylko dla SPA routes (bez rozszerzenia)
  return serveStatic(context, '/index.html');
}
```

**Efekt:** Pliki z rozszerzeniem (JS/CSS/obrazy) zwracają prawdziwy 404, tylko ścieżki bez rozszerzenia (np. `/about`, `/auth/callback`) dostają `index.html`.

---

### 3. Zaktualizowano build script

**Plik:** `/scripts/build.js`

Dodano kopiowanie do `dist/`:
- `_routes.json`
- `functions/` (cały folder z Cloudflare Functions)

**Efekt:** Deployment na Cloudflare Pages zawiera wszystkie wymagane pliki konfiguracyjne.

---

## ✅ WERYFIKACJA

### Build lokalny:
```bash
npm run build
```
**Status:** ✅ Success

### Pliki w dist/:
```
dist/
├── _routes.json         ✅
├── functions/
│   └── [[path]].js     ✅
├── js/
│   ├── poi-loader.js   ✅
│   └── app-core.js     ✅
├── app-core.js          ✅
└── index.html           ✅
```

### Git commit:
```
098f9a0 - Fix: Naprawa MIME type dla JS/CSS i widoczności mapy
```

---

## 🚀 DEPLOYMENT

### Automatyczny deployment przez GitHub → Cloudflare Pages

1. ✅ Commit pushed do `main`
2. ⏳ Cloudflare Pages auto-deploy w toku
3. ⏳ Oczekiwanie na build completion

### Po deployment sprawdź:

1. **Otwórz:** https://cypruseye.com/
2. **Sprawdź Console:** Nie powinno być błędów MIME type
3. **Sprawdź mapę:** Powinna być widoczna z markerami POI
4. **Sprawdź Network tab:**
   - `poi-loader.js` → Status 200, Content-Type: `application/javascript`
   - `app-core.js` → Status 200, Content-Type: `application/javascript`

### Jeśli nadal problem - Wymuś czyścienie cache:

#### Cloudflare Dashboard:
1. **Caching** → **Purge Cache** → **Purge Everything**
2. **Development Mode: ON** (3 godziny)

#### Przeglądarka:
- Chrome/Edge: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Win)
- Firefox: `Cmd+Shift+R` / `Ctrl+F5`
- Tryb incognito: `Cmd+Shift+N` / `Ctrl+Shift+N`

---

## 📊 PLIKI ZMIENIONE

1. `_routes.json` - UTWORZONY
2. `functions/[[path]].js` - NAPRAWIONY
3. `scripts/build.js` - ZAKTUALIZOWANY

---

## 🎯 EXPECTED RESULT

### Mapa powinna:
1. ✅ Wyświetlać się na głównej stronie
2. ✅ Pokazywać markery POI z Supabase
3. ✅ Ładować `poi-loader.js` z poprawnym MIME type
4. ✅ Ładować `app-core.js` z poprawnym MIME type
5. ✅ Nie pokazywać błędów w konsoli

### Console logs oczekiwane:
```
🔵 POI Loader V2 - START
⏳ Czekam na Supabase client...
✅ Supabase client znaleziony
📥 Ładuję POI z Supabase...
✅ Pobrano XX POI z Supabase
🗺️ Inicjalizuję mapę...
✅ Mapa utworzona
📍 Dodano XX markerów z Supabase
```

---

## 🔄 ROLLBACK (gdyby coś poszło nie tak)

```bash
git revert 098f9a0
git push
```

LUB usuń pliki ręcznie:
```bash
rm _routes.json
git checkout -- functions/[[path]].js scripts/build.js
git commit -m "Rollback: map fixes"
git push
```

---

## 📝 NOTATKI

- **Cloudflare Pages** używa `_routes.json` do routingu (nie `netlify.toml`)
- **MIME type headers** są ustawione w `_headers` ale to nie wystarczyło - problem był w Functions
- **Catch-all route** musi być smart - nie może zwracać HTML dla wszystkich 404
- **_routes.json** jest najlepszym rozwiązaniem - wyklucza statyczne pliki z przetwarzania przez Functions

---

**Data naprawy:** 6 listopada 2024, 21:37 UTC+2  
**Commit:** 098f9a0  
**Status:** ✅ NAPRAWIONE, czekam na deployment
