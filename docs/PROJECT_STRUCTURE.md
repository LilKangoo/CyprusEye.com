# 📁 Struktura Projektu CyprusEye.com

> Ostatnia aktualizacja: 2025-10-31 (Faza 2A)

## 🎯 Przegląd

CyprusEye to hybr aplikacja gamifikacji dla turystów na Cyprze:
- **Web App**: Interaktywna mapa + system check-inów + osiągnięcia
- **Mobile App**: React Native (Expo) z tymi samymi funkcjami
- **Backend**: Supabase (auth + profiles) + Netlify Functions

---

## 📂 Główna Struktura

```
cypruseye.com/
├── 📄 HTML Pages (15 plików)      # Główne strony aplikacji
├── 📁 js/                         # Główne moduły JavaScript
├── 📁 assets/                     # Zasoby (CSS, obrazy, dane)
├── 📁 functions/                  # Netlify Functions (API)
├── 📁 auth/                       # Strony autentykacji
├── 📁 account/                    # Panel użytkownika
├── 📁 reset/                      # Reset hasła
├── 📁 translations/               # Pliki językowe (4 języki)
├── 📁 tests/                      # Testy E2E (Playwright)
├── 📁 docs/                       # Dokumentacja
├── 📁 scripts/                    # Utility scripts (dev)
├── 📁 app/                        # React Native (Expo)
├── 📁 context/                    # React contexts
├── 📁 hooks/                      # React hooks
├── 📁 lib/                        # React Native libs
└── 🔧 Config files                # package.json, tsconfig, etc.
```

---

## 📄 Główne Strony HTML

### Strony Główne
- **`index.html`** - Strona główna (mapa interaktywna + check-iny)
- **`packing.html`** - Planer pakowania
- **`tasks.html`** - Lista zadań turystycznych
- **`achievements.html`** - System osiągnięć i odznak
- **`vip.html`** - VIP wyjazdy medialne
- **`cruise.html`** - Prywatne rejsy

### Strony Pomocnicze
- **`kupon.html`** - Wyszukiwarka kuponów
- **`car-rental.html`** - Formularz wynajmu auta (szczegóły)
- **`car-rental-landing.html`** - Landing page wynajmu
- **`autopfo.html`** - Kalkulator wynajmu (Paphos-Famagusta-Nicosia)
- **`attractions.html`** - Lista atrakcji
- **`advertise.html`** - Formularz reklamowy
- **`404.html`** - Strona błędu

### Strony Autentykacji
- **`auth/index.html`** - Login/Register
- **`auth/callback/index.html`** - Callback po logowaniu
- **`account/index.html`** - Panel użytkownika
- **`reset/index.html`** - Reset hasła

---

## 📁 JavaScript (`/js/`) - 15 modułów

### 🔐 Autentykacja & Użytkownicy
- **`auth.js`** (36 KB) - Core autentykacja Supabase
- **`authUi.js`** (28 KB) - UI dla logowania/rejestracji
- **`authCallback.js`** (4 KB) - Obsługa callback po OAuth
- **`authMessages.js`** (1 KB) - Komunikaty błędów auth
- **`account.js`** (16 KB) - Panel użytkownika (edycja profilu, XP, hasło)
- **`profile.js`** (4 KB) - Operacje na profilach
- **`xp.js`** (3 KB) - System XP i eventów

### 🌍 Internacjonalizacja
- **`i18n.js`** (17 KB) - System tłumaczeń (4 języki: PL, EN, EL, HE)
- **`languageSwitcher.js`** (9 KB) - Przełącznik języków w UI

### 🎮 Funkcjonalności
- **`supabaseClient.js`** (1 KB) - Inicjalizacja klienta Supabase
- **`toast.js`** (2 KB) - Powiadomienia toast
- **`tutorial.js`** (20 KB) - Onboarding i tutorial
- **`coupon.js`** (6 KB) - Logika kuponów rabatowych
- **`forms.js`** (5 KB) - Obsługa formularzy kontaktowych
- **`seo.js`** (15 KB) - Dynamiczne meta tagi i SEO

**Łącznie: ~163 KB JS (bez app.js)**

---

## 📁 Assets (`/assets/`)

### CSS (`/assets/css/`) - 8 plików
- **`tokens.css`** (2.5 KB) - CSS variables (kolory, czcionki)
- **`base.css`** (1.6 KB) - Reset i base styles
- **`components.css`** (152 KB) - Główne komponenty UI ⚠️ DUŻY
- **`mobile.css`** (6.6 KB) - Media queries mobile
- **`rtl.css`** (2.7 KB) - Right-to-left (hebrajski)
- **`language-switcher.css`** (2.9 KB) - Switcher języków
- **`vip.css`** (14 KB) - Style dla strony VIP
- **`pages.css`** - Style dla podstron

**Łącznie: ~182 KB CSS**

### JavaScript (`/assets/js/`) - 4 moduły
- **`auth-ui.js`** (7 KB) - Wrapper dla authUi.js
- **`modal-auth.js`** (7 KB) - Modal autentykacji (focus trap, keyboard nav)
- **`account-modal.js`** (16 KB) - Modal konta użytkownika
- **`auth/config.js`** - Konfiguracja auth

### Dane
- **`pois.json`** - Lista punktów POI (Places of Interest)
- **`cyprus_logo-1000x1054.png`** - Logo aplikacji
- **`kupon logo.jpeg`** - Logo kuponów

---

## 🚀 Backend & Functions

### Netlify Functions (`/functions/`)
- **`account/[[path]].js`** - API dla konta użytkownika
- **`auth/[[path]].js`** - API autentykacji
- **`reset/[[path]].js`** - API reset hasła
- **`[[path]].js`** - Główny catch-all
- **`_utils/serveStatic.js`** - Helper dla statycznych plików

### Node.js Server (`server.js`)
Opcjonalny backend z:
- Rejestracją użytkowników
- Reset hasła (nodemailer)
- Community journal
- Formularz kontaktowy
- CORS i security headers

**⚠️ UWAGA:** Projekt używa głównie Netlify Functions + Supabase. `server.js` to opcja dla self-hosted.

---

## 🌍 Translations (`/translations/`)

4 języki z pełnymi tłumaczeniami:
- **`en.json`** - English (domyślny)
- **`pl.json`** - Polski
- **`el.json`** - Ελληνικά (grecki)
- **`he.json`** - עברית (hebrajski, RTL)

System: `i18n.js` + `data-i18n` attributes w HTML

---

## 📱 React Native (`/app/`)

Expo aplikacja mobilna (struktura tabs):
```
app/
├── (tabs)/
│   ├── map/          # Mapa interaktywna
│   ├── pois/         # Lista POI
│   ├── services/     # Usługi
│   └── settings/     # Ustawienia
├── _layout.tsx       # Root layout
└── index.tsx         # Entry point
```

**Współdzielone:**
- `context/SettingsContext.tsx` - Ustawienia (język, jednostki)
- `hooks/useLiveLocation.ts` - GPS tracking
- `lib/` - Geo utilities (geofencing, navigation, permissions)

---

## 🧪 Tests (`/tests/`)

### E2E Tests (Playwright) - 14 testów
- **`auth-acceptance.spec.ts`** - Login/register flow
- **`auth-session-persistence.spec.ts`** - Persistencja sesji
- **`account-stats-switching.spec.ts`** - Przełączanie stat
- **`language-switching.spec.ts`** - Zmiana języka
- **`checkin-*.spec.ts`** - System check-inów
- **`modal-*.spec.ts`** - Modale
- **`navigation-*.spec.ts`** - Nawigacja

**Uruchomienie:** `npm test` lub `npx playwright test`

---

## 🔧 Scripts (`/scripts/`)

Utility scripts (dev only):
- **`convert-app-js.js`** - Konwersja app.js
- **`convert-places.js`** - Konwersja danych POI
- **`clean-translations.js`** - Czyszczenie tłumaczeń
- **`update-translations.js`** - Update translation keys

---

## 📋 Główne Pliki

### Core Logic
- **`app.js`** (321 KB / 10,326 linii) ⚠️ MONOLITH
  - System check-inów
  - Zarządzanie XP i poziomami
  - Synchronizacja z Supabase
  - Interaktywna mapa (Leaflet)
  - System osiągnięć

### Helpers
- **`car-rental.js`** - Logika formularza wynajmu

### Config
- **`package.json`** - Dependencies (nodemailer, Playwright, TypeScript)
- **`tsconfig.json`** - TypeScript config (Expo)
- **`app.config.ts`** - Expo config
- **`netlify.toml`** - Netlify deployment
- **`playwright.config.ts`** - E2E tests config
- **`.eslintrc.js`** - Linting rules
- **`babel.config.js`** - Babel (Expo)

---

## 🔍 Zależności (Key Dependencies)

### Production
- **Supabase** - Auth + Database
- **Leaflet** - Mapy interaktywne
- **Nodemailer** - Email (opcjonalne)

### Development
- **Playwright** - E2E testing
- **ESLint** - Linting
- **Prettier** - Formatting
- **TypeScript** - Type checking
- **Expo** - React Native framework

---

## 🎨 Design System

### CSS Variables (`tokens.css`)
```css
--color-primary: #0ea5e9;
--color-secondary: #8b5cf6;
--font-family: 'Jost', sans-serif;
--radius: 12px;
```

### Components (`components.css`)
- Buttons (primary, secondary, ghost)
- Cards (metric, attraction, achievement)
- Modals (auth, account, explorer)
- Forms (input, textarea, select)
- Navigation (header, tabs, breadcrumbs)
- Language switcher

---

## 🚀 Deployment

### Netlify (Production)
1. Build: Automatyczny (static files)
2. Functions: `/functions/` → Netlify Edge Functions
3. Redirects: `/_redirects` (SPA routing)
4. Env vars: SUPABASE_URL, SUPABASE_ANON_KEY

### Cloudflare Pages (Alternatywa)
- Build command: `echo "Static"`
- Publish directory: `.`
- Env vars: jak w Netlify

---

## 📊 Metryki Projektu

| Metryka | Wartość |
|---------|---------|
| **Rozmiar repo** | ~91 MB (bez node_modules) |
| **Pliki HTML** | 50 |
| **Pliki JS** | 40 |
| **Pliki CSS** | 9 |
| **Języki** | 4 (PL, EN, EL, HE) |
| **Testy E2E** | 14 specs |
| **POI (miejsca)** | 50+ |
| **Bundle size** | ~500 KB (niezoptymalizowane) |

---

## 🔮 Następne Kroki (Opcjonalne)

### Priorytet ŚREDNI
1. **Podzielić `app.js`** (10,326 linii → moduły)
   - `/js/core/places.js`
   - `/js/core/map.js`
   - `/js/core/checkins.js`
   - `/js/features/achievements.js`

2. **Podzielić `components.css`** (152 KB → moduły)
   - `buttons.css`
   - `cards.css`
   - `forms.css`
   - `modals.css`

### Priorytet NISKI
3. **Build system** (Vite/esbuild)
4. **Image optimization** (WebP)
5. **Lazy loading** (Leaflet tylko na stronach z mapą)

---

## 📞 Debug Mode

### Włączanie logów debug:

```javascript
// W konsoli przeglądarki:
localStorage.setItem('CE_DEBUG', 'true');
// LUB dodaj ?debug do URL:
https://cypruseye.com/?debug
```

Teraz `app.js` będzie pokazywał szczegółowe logi sync, auth i save operations.

---

**Utrzymywane przez:** CyprusEye Team  
**Licencja:** Proprietary  
**Kontakt:** kontakt@wakacjecypr.com
