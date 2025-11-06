# ZADANIE 1.1: Centralizacja Supabase Config

**Czas:** 1 godzina  
**Priorytet:** KRYTYCZNY  
**Ryzyko:** NISKIE (tylko refactoring)

---

## KROK 1: Utworzyć `/js/config.js` (10 min)

### Co zrobić:
Utworzyć nowy plik z centralną konfiguracją.

### Kod do dodania:

```javascript
// /js/config.js
/**
 * Central configuration for CyprusEye application
 * All environment-specific settings should be defined here
 */

export const SUPABASE_CONFIG = {
  url: 'https://daoohnbnnowmmcizgvrq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM',
  storageKey: 'sb-daoohnbnnowmmcizgvrq-auth-token',
};

export const APP_CONFIG = {
  name: 'CyprusEye Quest',
  version: '1.0.0',
  debug: localStorage.getItem('CE_DEBUG') === 'true',
};

export const URLS = {
  passwordReset: 'https://cypruseye.com/reset/',
  verification: 'https://cypruseye.com/auth/',
  base: 'https://cypruseye.com',
};
```

### Weryfikacja:
- [ ] Plik utworzony w `/js/config.js`
- [ ] Kod skopiowany poprawnie
- [ ] Brak literówek

---

## KROK 2: Update `/js/supabaseClient.js` (10 min)

### Zmienić z:
```javascript
const SUPABASE_URL = 'https://daoohnbnnowmmcizgvrq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJ...'
```

### Na:
```javascript
import { SUPABASE_CONFIG } from './config.js'

export const sb = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_CONFIG.storageKey,
    storage: window.localStorage,
    flowType: 'pkce',
    multiTab: true,
  },
})
```

### Weryfikacja:
- [ ] Import dodany na górze pliku
- [ ] SUPABASE_URL i SUPABASE_ANON_KEY usunięte
- [ ] createClient używa SUPABASE_CONFIG
- [ ] Plik zapisany

---

## KROK 3: Update `/js/auth.js` (5 min)

### Znaleźć:
```javascript
const PASSWORD_RESET_REDIRECT = 'https://cypruseye.com/reset/';
const VERIFICATION_REDIRECT = 'https://cypruseye.com/auth/';
```

### Zamienić na:
```javascript
import { URLS } from './config.js'

// Użyj w kodzie:
const PASSWORD_RESET_REDIRECT = URLS.passwordReset;
const VERIFICATION_REDIRECT = URLS.verification;
```

### Weryfikacja:
- [ ] Import dodany
- [ ] Stare linijki usunięte
- [ ] Nowe używają URLS z config
- [ ] Plik zapisany

---

## KROK 4: Usunąć meta tagi z HTML (20 min)

### Pliki do edycji:
1. index.html
2. community.html
3. achievements.html
4. packing.html
5. tasks.html
6. vip.html
7. auth/index.html
8. account/index.html
9. reset/index.html

### W każdym pliku USUNĄĆ:
```html
<meta name="supabase-url" content="https://..." />
<meta name="supabase-anon" content="eyJ..." />
<meta name="supabase-publishable" content="sb_..." />
```

### ZOSTAWIĆ TYLKO:
```html
<meta name="ce-auth" content="on" />
```

### Weryfikacja dla KAŻDEGO pliku:
- [ ] Meta tagi Supabase usunięte
- [ ] ce-auth meta zostaje
- [ ] Brak innych zmian
- [ ] Plik zapisany

---

## KROK 5: TEST (15 min)

### Test 1: Sprawdzić czy auth działa
```bash
# Uruchom local server
npm run serve
```

### W przeglądarce:
1. Otwórz http://localhost:3001
2. Otwórz DevTools Console
3. Wpisz: `window.sb`
4. Powinno pokazać Supabase client object

### Test 2: Sprawdzić logowanie
1. Kliknij "Zaloguj"
2. Wpisz test credentials
3. Sprawdź czy auth działa
4. Sprawdź console - brak błędów?

### Test 3: Sprawdzić wszystkie strony
- [ ] index.html - działa?
- [ ] community.html - działa?
- [ ] achievements.html - działa?
- [ ] packing.html - działa?
- [ ] tasks.html - działa?

### Weryfikacja końcowa:
- [ ] Wszystkie strony ładują się
- [ ] Auth działa
- [ ] Brak błędów w console
- [ ] Supabase client dostępny

---

## ROLLBACK (jeśli coś nie działa)

```bash
git stash
git checkout main
npm run serve
```

Zdiagnozuj problem przed kontynuacją.

---

## COMMIT

```bash
git add js/config.js
git add js/supabaseClient.js
git add js/auth.js
git add *.html
git add auth/*.html
git add account/*.html
git add reset/*.html
git commit -m "Task 1.1: Centralize Supabase configuration

- Created central /js/config.js for all config
- Removed hardcoded credentials from JS files
- Removed unnecessary meta tags from HTML
- All auth functionality tested and working"
```

---

## ✅ DONE CRITERIA

- [ ] config.js utworzony
- [ ] supabaseClient.js używa config
- [ ] auth.js używa config
- [ ] Meta tagi usunięte z 9 plików HTML
- [ ] Wszystkie testy przechodzą
- [ ] Auth działa poprawnie
- [ ] Commit wykonany

**Czas faktyczny:** _____ min  
**Problemy napotkane:** _____  
**Notatki:** _____

---

**NASTĘPNE:** TASK_1.2_CSP_HEADERS.md
