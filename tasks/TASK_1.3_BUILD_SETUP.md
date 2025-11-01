# ZADANIE 1.3: Setup Build Process (Usuwanie console.log)

**Czas:** 1-2 godziny  
**Priorytet:** KRYTYCZNY  
**Ryzyko:** ŚREDNIE (nowe narzędzia build)

---

## KROK 1: Instalacja terser (5 min)

### Instalacja:
```bash
npm install --save-dev terser
```

### Weryfikacja:
```bash
npm list terser
# Powinno pokazać: terser@5.x.x
```

### Checklist:
- [ ] terser zainstalowany
- [ ] package.json zaktualizowany
- [ ] node_modules/terser istnieje

---

## KROK 2: Utworzyć build script (15 min)

### Utworzyć `/scripts/build.js`:
```javascript
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Pliki JS do zminifikowania
const JS_FILES = [
  'app.js',
  'car-rental.js',
  'js/auth.js',
  'js/authUi.js',
  'js/i18n.js',
  'js/account.js',
  'js/profile.js',
  'js/toast.js',
  'js/tutorial.js',
  'js/seo.js',
  'js/forms.js',
  'js/coupon.js',
  'js/xp.js',
  'js/supabaseClient.js',
  'js/authCallback.js',
  'js/authMessages.js',
  'js/languageSwitcher.js',
  'js/mobileTabbar.js',
  'js/achievements-profile.js',
  'assets/js/modal-auth.js',
  'assets/js/account-modal.js',
  'assets/js/auth-ui.js',
];

// Community files
const COMMUNITY_FILES = [
  'js/community/ui.js',
  'js/community/photos.js',
  'js/community/comments.js',
  'js/community/likes.js',
  'js/community/ratings.js',
  'js/community/notifications.js',
  'js/community/location-filter.js',
  'js/community/i18nHelper.js',
];

async function buildFile(filePath) {
  const fullPath = join(ROOT, filePath);
  console.log(`Building: ${filePath}`);
  
  try {
    const code = await readFile(fullPath, 'utf-8');
    
    const result = await minify(code, {
      compress: {
        drop_console: true,  // ✅ Usuń console.log/warn (zostaw error)
        drop_debugger: true,
        dead_code: true,
        passes: 2,
      },
      mangle: false,  // Nie zmieniaj nazw zmiennych (dla debugowania)
      format: {
        comments: false,  // Usuń komentarze
      },
    });
    
    if (result.error) {
      throw result.error;
    }
    
    // Zapisz do /dist/
    const distPath = join(ROOT, 'dist', filePath);
    await mkdir(dirname(distPath), { recursive: true });
    await writeFile(distPath, result.code, 'utf-8');
    
    console.log(`✅ Built: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error building ${filePath}:`, error.message);
    throw error;
  }
}

async function build() {
  console.log('🚀 Starting build process...\n');
  
  const allFiles = [...JS_FILES, ...COMMUNITY_FILES];
  
  for (const file of allFiles) {
    await buildFile(file);
  }
  
  console.log('\n✅ Build complete! Files in /dist/');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
```

### Weryfikacja:
- [ ] Plik utworzony: `/scripts/build.js`
- [ ] Kod skopiowany poprawnie
- [ ] Brak błędów składni

---

## KROK 3: Dodać npm scripts (5 min)

### W `package.json`, dodać do `"scripts"`:
```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "playwright test",
    "serve": "node server.js",
    "serve:web": "node server.js",
    "dev": "node server.js",
    
    "build": "node scripts/build.js",
    "build:clean": "rm -rf dist && npm run build",
    "build:watch": "nodemon --watch js --watch assets/js --exec npm run build"
  }
}
```

### Weryfikacja:
- [ ] Scripts dodane do package.json
- [ ] JSON format poprawny (przecinki!)
- [ ] Plik zapisany

---

## KROK 4: Test build lokalnie (10 min)

### Uruchom build:
```bash
npm run build
```

### Oczekiwany output:
```
🚀 Starting build process...

Building: app.js
✅ Built: app.js
Building: car-rental.js
✅ Built: car-rental.js
...
✅ Build complete! Files in /dist/
```

### Sprawdź wynik:
```bash
ls -lh dist/
ls -lh dist/js/
```

### Weryfikacja:
- [ ] Build zakończył się bez błędów
- [ ] Folder `/dist/` utworzony
- [ ] Pliki JS w dist/ są mniejsze niż oryginały
- [ ] Sprawdź jeden plik: `cat dist/app.js | grep "console.log"` → powinno być PUSTE

---

## KROK 5: Cloudflare Pages build configuration (10 min)

### CLOUDFLARE PAGES - build settings:

**UWAGA:** Build konfigurujemy w Cloudflare Dashboard (nie w pliku).

1. Otwórz Cloudflare Dashboard
2. Workers & Pages → Twój projekt
3. Settings → Builds & deployments
4. Ustaw:

**Build command:**
```bash
npm run build
```

**Build output directory:**
```
dist
```

**Environment variables:**
- NODE_VERSION = 18
- NPM_VERSION = 9

### OPCJONALNIE - wrangler.toml:
Jeśli chcesz mieć config w repo:
```toml
name = "cypruseye"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"
```

### Weryfikacja:
- [ ] Build command ustawiony w Cloudflare
- [ ] Output directory = dist
- [ ] Environment variables ustawione

---

## KROK 6: Kopiować statyczne pliki do dist/ (15 min)

### Problem:
Build tylko minifikuje JS, ale musimy skopiować:
- HTML files
- CSS files
- Obrazy
- Translations
- assets/

### Rozwiązanie - update build.js:

Dodaj na końcu pliku (przed `build()`):
```javascript
import { cp } from 'fs/promises';

async function copyStaticFiles() {
  console.log('\n📦 Copying static files...');
  
  // Kopiuj HTML
  await cp(join(ROOT, '*.html'), join(ROOT, 'dist/'), { recursive: true });
  await cp(join(ROOT, 'auth'), join(ROOT, 'dist/auth'), { recursive: true });
  await cp(join(ROOT, 'account'), join(ROOT, 'dist/account'), { recursive: true });
  await cp(join(ROOT, 'reset'), join(ROOT, 'dist/reset'), { recursive: true });
  
  // Kopiuj CSS
  await cp(join(ROOT, 'assets/css'), join(ROOT, 'dist/assets/css'), { recursive: true });
  await cp(join(ROOT, 'css'), join(ROOT, 'dist/css'), { recursive: true });
  
  // Kopiuj obrazy
  await cp(join(ROOT, 'assets/*.png'), join(ROOT, 'dist/assets/'), { recursive: true });
  await cp(join(ROOT, 'assets/*.jpeg'), join(ROOT, 'dist/assets/'), { recursive: true });
  await cp(join(ROOT, 'assets/*.json'), join(ROOT, 'dist/assets/'), { recursive: true });
  
  // Kopiuj translations
  await cp(join(ROOT, 'translations'), join(ROOT, 'dist/translations'), { recursive: true });
  
  // Kopiuj inne
  await cp(join(ROOT, 'robots.txt'), join(ROOT, 'dist/robots.txt'));
  await cp(join(ROOT, 'sitemap.xml'), join(ROOT, 'dist/sitemap.xml'));
  
  console.log('✅ Static files copied');
}

async function build() {
  console.log('🚀 Starting build process...\n');
  
  const allFiles = [...JS_FILES, ...COMMUNITY_FILES];
  
  for (const file of allFiles) {
    await buildFile(file);
  }
  
  await copyStaticFiles();  // ✅ Dodaj to
  
  console.log('\n✅ Build complete! Files in /dist/');
}
```

**PROSTSZE ROZWIĄZANIE - użyj cp command:**

Lub dodaj do package.json:
```json
"scripts": {
  "build": "npm run build:js && npm run build:copy",
  "build:js": "node scripts/build.js",
  "build:copy": "cp -r *.html auth account reset assets css translations robots.txt sitemap.xml dist/ 2>/dev/null || true"
}
```

---

## KROK 7: .gitignore dla dist/ (2 min)

### Dodać do `.gitignore`:
```
# Build output
dist/
build/

# Node
node_modules/
```

### Weryfikacja:
- [ ] dist/ dodany do .gitignore
- [ ] Plik zapisany

---

## KROK 8: Final test (10 min)

### Test 1: Clean build
```bash
npm run build:clean
```

### Test 2: Sprawdź dist/
```bash
# Sprawdź strukturę
tree dist/ -L 2

# Sprawdź czy console.log usunięte
grep -r "console.log" dist/js/ || echo "✅ No console.log found"

# Sprawdź rozmiary
du -sh dist/
du -sh .
```

### Test 3: Uruchom z dist/
```bash
cd dist/
npx http-server -p 8080
# Otwórz http://localhost:8080
```

### Sprawdź w przeglądarce:
- [ ] Strona ładuje się
- [ ] Auth działa
- [ ] Brak console.log w DevTools
- [ ] Wszystkie funkcje działają

---

## ROLLBACK

```bash
# Usuń dist/
rm -rf dist/

# Przywróć package.json
git checkout package.json

# Przywróć netlify.toml
git checkout netlify.toml

# Usuń build.js
rm scripts/build.js
```

---

## COMMIT

```bash
git add scripts/build.js
git add package.json
git add netlify.toml
git add .gitignore
git commit -m "Task 1.3: Setup production build process

- Added terser for JS minification
- Created build script to remove console.log
- Setup npm build commands
- Updated netlify.toml for production builds
- Configured dist/ as publish directory
- Tested: all console.log removed, functionality preserved"
```

---

## ✅ DONE CRITERIA

- [ ] terser zainstalowany
- [ ] scripts/build.js utworzony
- [ ] npm scripts dodane
- [ ] Build działa lokalnie
- [ ] dist/ folder generowany poprawnie
- [ ] console.log usunięte z dist/ files
- [ ] Static files kopiowane
- [ ] netlify.toml zaktualizowany
- [ ] .gitignore zaktualizowany
- [ ] Test w przeglądarce - wszystko działa
- [ ] Commit wykonany

**Czas faktyczny:** _____ min  
**Problemy:** _____  
**Redukcja rozmiaru:** _____ KB → _____ KB

---

**POPRZEDNIE:** TASK_1.2_CSP_HEADERS.md  
**NASTĘPNE:** TASK_2.1_META_DESCRIPTIONS.md
