# ZADANIE 1.2: Dodać CSP (Content Security Policy) Headers

**Czas:** 1 godzina  
**Priorytet:** KRYTYCZNY  
**Ryzyko:** ŚREDNIE (może zepsuć ładowanie zewnętrznych zasobów)

---

## KROK 1: Przygotować CSP meta tag template (10 min)

### Jaki CSP potrzebujemy:
Aplikacja używa zewnętrznych zasobów:
- Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
- Google Analytics (googletagmanager.com)
- Leaflet CDN (unpkg.com)
- Supabase ESM (esm.sh)
- Supabase API (daoohnbnnowmmcizgvrq.supabase.co)

### CSP Meta Tag:
```html
<meta http-equiv="Content-Security-Policy" content="
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
">
```

### Weryfikacja:
- [ ] Template przygotowany
- [ ] Wszystkie wymagane domeny uwzględnione

---

## KROK 2: Dodać CSP do index.html (5 min)

### Gdzie dodać:
W `<head>`, **PRZED** innymi meta tagami (ale po charset i viewport).

### Lokalizacja w index.html:
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- ✅ DODAJ TUTAJ -->
  <meta http-equiv="Content-Security-Policy" content="...">
  
  <meta name="theme-color" content="#2563eb" />
  <!-- reszta meta tagów -->
</head>
```

### Weryfikacja:
- [ ] CSP dodany w odpowiednim miejscu
- [ ] Wcięcia poprawne
- [ ] Cudzysłowy zamknięte
- [ ] Plik zapisany

---

## KROK 3: Dodać CSP do pozostałych stron HTML (20 min)

### Pliki do edycji (w tej kolejności):
1. ✅ index.html (już zrobione)
2. community.html
3. achievements.html
4. packing.html
5. tasks.html
6. vip.html
7. cruise.html
8. kupon.html
9. car-rental-landing.html
10. car-rental.html
11. autopfo.html
12. attractions.html
13. advertise.html
14. 404.html
15. auth/index.html
16. auth/callback/index.html
17. account/index.html
18. reset/index.html

### Dla KAŻDEGO pliku:
- [ ] Otwórz plik
- [ ] Znajdź `<head>`
- [ ] Dodaj CSP meta tag w tym samym miejscu co w index.html
- [ ] Zapisz
- [ ] Zaznacz na liście

### UWAGA:
**404.html** może mieć uproszczony CSP (usuń Google Analytics):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
">
```

---

## KROK 4: TEST w przeglądarce (15 min)

### Test 1: Sprawdzić Console
```bash
npm run serve
```

1. Otwórz http://localhost:3001
2. Otwórz DevTools (F12)
3. Przejdź do zakładki **Console**
4. **SPRAWDŹ:** Czy są błędy CSP violations?

### Oczekiwany rezultat:
✅ **BRAK błędów** typu:
```
Refused to load... because it violates the following CSP directive...
```

❌ **JEŚLI SĄ BŁĘDY:**
- Skopiuj dokładny komunikat
- Sprawdź jaką domenę blokuje
- Dodaj tę domenę do odpowiedniej dyrektywy CSP
- Zapisz i odśwież

### Test 2: Sprawdzić czy wszystko ładuje się
- [ ] Google Fonts - widoczne?
- [ ] Leaflet mapa - działa? (na index.html)
- [ ] Google Analytics - trackuje? (sprawdź Network tab)
- [ ] Supabase - auth działa?
- [ ] Obrazy - wyświetlają się?

### Test 3: Przetestować każdą stronę
Otwórz i sprawdź console:
- [ ] index.html
- [ ] community.html
- [ ] achievements.html
- [ ] packing.html
- [ ] tasks.html
- [ ] vip.html
- [ ] kupon.html
- [ ] car-rental.html
- [ ] auth/index.html

### Test 4: Security Headers Check
Użyj narzędzia online:
1. Deploy preview na Netlify (lub użyj produkcji)
2. Sprawdź: https://securityheaders.com/
3. Wpisz URL swojej strony
4. **Cel:** Score minimum **B** (z CSP)

---

## KROK 5: Update netlify.toml dla Production Headers (10 min)

### Dodać do netlify.toml:
```toml
[[headers]]
  for = "/*"
  [headers.values]
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
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(self), microphone=(), camera=()"
```

### Weryfikacja:
- [ ] Kod dodany do netlify.toml
- [ ] Wcięcia TOML poprawne
- [ ] Triple-quotes """ dla multi-line
- [ ] Plik zapisany

---

## ROLLBACK (jeśli CSP blokuje coś ważnego)

### Tymczasowe wyłączenie:
Zamień CSP na **report-only** (nie blokuje, tylko raportuje):
```html
<meta http-equiv="Content-Security-Policy-Report-Only" content="...">
```

### Pełny rollback:
```bash
git checkout -- *.html
git checkout -- auth/*.html
git checkout -- account/*.html
git checkout -- reset/*.html
git checkout -- netlify.toml
```

---

## COMMIT

```bash
git add *.html
git add auth/*.html
git add account/*.html
git add reset/*.html
git add netlify.toml
git commit -m "Task 1.2: Add Content Security Policy headers

- Added CSP meta tags to all HTML pages
- Configured CSP for external resources (Google, Supabase, CDNs)
- Added security headers to netlify.toml
- Tested all pages for CSP violations
- Zero blocking issues, all resources load correctly"
```

---

## ✅ DONE CRITERIA

- [ ] CSP dodany do 18 plików HTML
- [ ] netlify.toml zaktualizowany z headers
- [ ] Wszystkie strony ładują się poprawnie
- [ ] Brak CSP violations w console
- [ ] Google Fonts działa
- [ ] Leaflet działa
- [ ] Supabase auth działa
- [ ] Security headers test passed (minimum B)
- [ ] Commit wykonany

**Czas faktyczny:** _____ min  
**Problemy napotkane:** _____  
**Security score:** _____

---

**POPRZEDNIE:** TASK_1.1_CONFIG_CENTRALIZATION.md  
**NASTĘPNE:** TASK_1.3_BUILD_SETUP.md
