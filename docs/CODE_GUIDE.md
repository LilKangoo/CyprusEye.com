# 👨‍💻 Przewodnik Programisty - CyprusEye.com

> Jak rozwijać, modyfikować i utrzymywać projekt

---

## 🚀 Quick Start

### 1. Sklonuj i zainstaluj
```bash
git clone https://github.com/LilKangoo/CyprusEye.com.git
cd CyprusEye.com
npm install
```

### 2. Uruchom lokalnie
```bash
npm run serve
# Otwórz: http://localhost:3001
```

### 3. Włącz debug mode
```javascript
// W konsoli przeglądarki:
localStorage.setItem('CE_DEBUG', 'true');
// LUB dodaj ?debug do URL
```

---

## 📍 Jak Dodać Nowe Miejsce (POI)

### Krok 1: Dodaj do `app.js`

```javascript
// W tablicy `places` dodaj nowy obiekt:
{
  id: 'unique-slug-name',  // Unikalny ID (lowercase, kebab-case)
  get name() { return getTranslation('places.unique-slug-name.name', 'Nazwa miejsca'); },
  get description() { return getTranslation('places.unique-slug-name.description', 'Opis miejsca...'); },
  get badge() { return getTranslation('places.unique-slug-name.badge', 'Nazwa odznaki'); },
  lat: 34.7234,            // Szerokość geograficzna
  lng: 32.4567,            // Długość geograficzna
  googleMapsUrl: 'https://maps.google.com/?q=34.7234,32.4567',
  xp: 150,                 // Punkty XP za check-in (100-250)
  requiredLevel: 3,        // Wymagany poziom (1-10)
}
```

### Krok 2: Dodaj tłumaczenia

**`translations/pl.json`:**
```json
{
  "places": {
    "unique-slug-name": {
      "name": "Nazwa po polsku",
      "description": "Opis po polsku...",
      "badge": "Nazwa odznaki po polsku"
    }
  }
}
```

**`translations/en.json`:**
```json
{
  "places": {
    "unique-slug-name": {
      "name": "Name in English",
      "description": "Description in English...",
      "badge": "Badge name in English"
    }
  }
}
```

### Krok 3: Przetestuj

1. Odśwież stronę
2. Znajdź nowe miejsce na liście
3. Sprawdź czy marker pojawił się na mapie
4. Wykonaj check-in (jeśli jesteś blisko)

---

## 🌍 Jak Dodać Tłumaczenie

### System tłumaczeń

Projekt używa `i18n.js` z 4 językami:
- **PL** (Polski) - domyślny
- **EN** (English)
- **EL** (Ελληνικά - grecki)
- **HE** (עברית - hebrajski, RTL)

### Dodawanie nowego klucza

**1. HTML - użyj `data-i18n`:**
```html
<h1 data-i18n="home.welcome">Witaj w CyprusEye!</h1>
<button data-i18n="buttons.start">Start</button>
```

**2. JavaScript - użyj `translate()`:**
```javascript
import { translate } from '/js/i18n.js';

const message = translate('home.welcome', 'Fallback text');
```

**3. Dodaj do wszystkich plików JSON:**

`translations/pl.json`:
```json
{
  "home": {
    "welcome": "Witaj w CyprusEye!"
  },
  "buttons": {
    "start": "Rozpocznij"
  }
}
```

`translations/en.json`, `translations/el.json`, `translations/he.json` - analogicznie.

### RTL (Right-to-Left) dla hebrajskiego

Hebrajski pozostaje ukryty publicznie. RTL można testować tylko w trybie QA: `?ce_he_preview=1&lang=he`.
Style RTL: `assets/css/rtl.css`

---

## 🎨 Jak Dodać Nowy Komponent UI

### 1. Dodaj style do `assets/css/components.css`

```css
/* Naming convention: BEM (Block Element Modifier) */
.my-component {
  /* Base styles */
}

.my-component__element {
  /* Element inside component */
}

.my-component--variant {
  /* Modifier/variant */
}

.my-component.is-active {
  /* State class */
}
```

### 2. Używaj CSS variables z `tokens.css`

```css
.my-button {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-family: var(--font-family);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-4);
}
```

### 3. Dodaj do HTML

```html
<div class="my-component">
  <h2 class="my-component__title">Title</h2>
  <p class="my-component__text">Text content</p>
</div>
```

---

## ✅ Jak Dodać Nowe Osiągnięcie

### Krok 1: Dodaj do `app.js` - `achievements`

```javascript
const achievements = [
  // ... existing
  {
    id: 'new-achievement-id',
    get title() { return getTranslation('achievements.new-achievement-id.title', 'Tytuł'); },
    get description() { return getTranslation('achievements.new-achievement-id.description', 'Opis...'); },
    get badge() { return getTranslation('achievements.new-achievement-id.badge', 'Odznaka'); },
    icon: '🏆',           // Emoji icon
    requiredLevel: 5,     // Wymagany poziom
    unlocked: false,      // Początkowy stan
  }
];
```

### Krok 2: Dodaj logikę odblokowywania

W `app.js` znajdź funkcję `checkAchievements()` i dodaj:

```javascript
function checkAchievements() {
  // ... existing code
  
  // Custom condition
  if (state.someCondition && !achievements.find(a => a.id === 'new-achievement-id').unlocked) {
    unlockAchievement('new-achievement-id');
  }
}
```

### Krok 3: Dodaj tłumaczenia

W `translations/*.json`:
```json
{
  "achievements": {
    "new-achievement-id": {
      "title": "Tytuł osiągnięcia",
      "description": "Opis jak odblokować",
      "badge": "Nazwa odznaki"
    }
  }
}
```

---

## 🗺️ Jak Zmodyfikować Mapę

### Zmiana centrum i zoomu

**`app.js`** - szukaj:
```javascript
const DEFAULT_MAP_CENTER = [34.9, 33.3];  // [lat, lng]
const DEFAULT_MAP_ZOOM = 9;               // 1-18
```

### Dodanie niestandardowej warstwy (layer)

```javascript
// W funkcji initMap():
const customLayer = L.tileLayer('https://custom-tiles.com/{z}/{x}/{y}.png', {
  attribution: '© Custom Provider',
  maxZoom: 18
});

customLayer.addTo(map);
```

### Zmiana promienia geofence

```javascript
const GEOFENCE_RADIUS = 100; // metry (domyślnie ~50-100m)
```

---

## 🔐 Supabase - Autentykacja i Baza Danych

### Konfiguracja

Klucze w meta tags (`index.html`):
```html
<meta name="supabase-url" content="https://YOUR_PROJECT.supabase.co" />
<meta name="supabase-anon" content="YOUR_ANON_KEY" />
```

### Struktura tabeli `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  name TEXT,
  username TEXT UNIQUE,
  xp INTEGER DEFAULT 0,
  level INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN xp >= 2000 THEN 10
      WHEN xp >= 1500 THEN 9
      -- ... więcej poziomów
      ELSE 1
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Synchronizacja postępu

`app.js` automatycznie synchronizuje:
- **Local → Cloud**: Po każdym check-in
- **Cloud → Local**: Po zalogowaniu i co 30s

---

## 📱 React Native (Expo) - Aplikacja Mobilna

### Struktura

```
app/
├── (tabs)/
│   ├── map/index.tsx        # Mapa
│   ├── pois/index.tsx       # Lista POI
│   ├── services/index.tsx   # Usługi
│   └── settings/index.tsx   # Ustawienia
├── _layout.tsx
└── index.tsx
```

### Uruchomienie

```bash
# Development
npx expo start

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android
```

### Współdzielone API

Web i mobile dzielą:
- Tłumaczenia (`translations/*.json`)
- Typy danych (POI, achievements)
- Logikę XP (`lib/geo.ts`, `hooks/useLiveLocation.ts`)

---

## 🧪 Testowanie

### E2E Tests (Playwright)

```bash
# Uruchom wszystkie testy
npm test

# Tylko jeden test
npx playwright test auth-acceptance.spec.ts

# Debug mode
npx playwright test --debug

# UI mode (interaktywny)
npx playwright test --ui
```

### Dodanie nowego testu

**`tests/e2e/my-feature.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

---

## 🚀 Deployment

### Netlify (Produkcja)

**Automatyczny deployment:**
1. Push do `main` branch
2. Netlify wykrywa zmianę
3. Build i deploy (~2 min)
4. Live na https://cypruseye.com

**Environment Variables:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Cloudflare Pages (Alternatywa)

```bash
# Build command
echo "Static site"

# Publish directory
.

# Environment variables
# (jak w Netlify)
```

---

## 🐛 Debugowanie

### Debug mode (logi)

```javascript
// Włącz w konsoli:
localStorage.setItem('CE_DEBUG', 'true');

// LUB dodaj do URL:
https://cypruseye.com/?debug

// Wyłącz:
localStorage.removeItem('CE_DEBUG');
```

### Częste problemy

#### 1. **Mapa się nie ładuje**
- Sprawdź console - błąd Leaflet?
- Upewnij się że `<div id="map">` istnieje w HTML
- Sprawdź czy `initMap()` została wywołana

#### 2. **Tłumaczenia nie działają**
- Sprawdź czy klucz istnieje we wszystkich `translations/*.json`
- Upewnij się że używasz `data-i18n` w HTML lub `translate()` w JS
- Wyczyść cache przeglądarki

#### 3. **Check-in nie działa**
- Sprawdź GPS w ustawieniach przeglądarki
- Debug: Sprawdź `console.log` w funkcji `attemptCheckIn()`
- Upewnij się że jesteś w promieniu geofence (domyślnie 100m)

#### 4. **Supabase auth error**
- Sprawdź klucze w meta tags
- Upewnij się że Supabase project jest aktywny
- Sprawdź CORS settings w Supabase dashboard

---

## 📋 Code Style

### JavaScript

```javascript
// ✅ Dobre
const userName = getCurrentDisplayName();
const places = getFilteredPlaces({ level: 5 });

// ❌ Złe
var userName=getCurrentDisplayName()
let places=getFilteredPlaces({level:5})
```

### CSS

```css
/* ✅ Dobre */
.button-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
}

/* ❌ Złe */
.button-primary{padding:8px 16px;background:#0ea5e9}
```

### Commity

```bash
# ✅ Dobre
git commit -m "feat: Dodano nowe miejsce - Kato Paphos"
git commit -m "fix: Naprawiono bug w check-in"
git commit -m "docs: Zaktualizowano CODE_GUIDE"

# ❌ Złe
git commit -m "update"
git commit -m "fixes"
```

---

## 📦 Struktura Plików

```
cypruseye.com/
├── app.js                    # 🧠 Główna logika (10,326 linii)
├── index.html                # 🏠 Strona główna (mapa)
├── js/                       # 📜 Moduły JavaScript
│   ├── auth.js              # Autentykacja Supabase
│   ├── i18n.js              # System tłumaczeń
│   └── ...                  # (15 modułów total)
├── assets/
│   ├── css/                 # 🎨 Style
│   └── js/                  # 📜 Dodatkowe moduły
├── translations/            # 🌍 4 języki (PL, EN, EL, HE)
├── functions/               # ⚡ Netlify Functions
├── tests/                   # 🧪 E2E (Playwright)
└── docs/                    # 📚 Dokumentacja
```

---

## 🔗 Przydatne Linki

- **Supabase Dashboard**: https://app.supabase.com
- **Netlify Dashboard**: https://app.netlify.com
- **Leaflet Docs**: https://leafletjs.com/reference.html
- **Playwright Docs**: https://playwright.dev/
- **Expo Docs**: https://docs.expo.dev/

---

## 💬 Wsparcie

- **Email**: kontakt@wakacjecypr.com
- **Issues**: https://github.com/LilKangoo/CyprusEye.com/issues

---

**Aktualizacja**: 2025-10-31 (Faza 2B)  
**Autor**: CyprusEye Team
