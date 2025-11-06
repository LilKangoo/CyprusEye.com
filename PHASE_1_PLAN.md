# FAZA 1 - PLAN KROK PO KROKU (Zero Błędów)

## PRZYGOTOWANIE (przed rozpoczęciem)

### ✅ Checklist przed startem:
- [ ] Backup całego projektu (git commit + tag)
- [ ] Utworzyć branch: `feature/phase-1-critical-fixes`
- [ ] Upewnić się że testy E2E działają
- [ ] Zapisać obecne Lighthouse scores (baseline)

```bash
git add .
git commit -m "Pre-Phase-1 checkpoint"
git tag phase-0-baseline
git checkout -b feature/phase-1-critical-fixes
npm run test:e2e  # Weryfikacja że testy przechodzą
```

---

## DZIEŃ 1: BEZPIECZEŃSTWO (3-4h)

### ZADANIE 1.1: Scentralizować Supabase Config (1h)
**Cel:** Jedno źródło prawdy dla credentials

**Krok 1:** Utworzyć `/js/config.js`
**Krok 2:** Usunąć meta tagi z HTML
**Krok 3:** Update importy w JS
**Krok 4:** Test

### ZADANIE 1.2: Dodać CSP Headers (1h)
**Cel:** Content Security Policy dla bezpieczeństwa

**Krok 1:** Dodać meta CSP do template
**Krok 2:** Apply do wszystkich HTML
**Krok 3:** Test w przeglądarce (sprawdzić console)

### ZADANIE 1.3: Setup Build dla usunięcia console.log (1-2h)
**Cel:** Przygotować automatyczne czyszczenie logów

**Krok 1:** Dodać terser do package.json
**Krok 2:** Utworzyć build script
**Krok 3:** Test build
**Krok 4:** Update netlify.toml

---

## DZIEŃ 2: SEO + ACCESSIBILITY (3h)

### ZADANIE 2.1: Meta Descriptions (1h)
**Pliki:** packing.html, tasks.html, achievements.html, attractions.html

**Dla każdego pliku:**
- [ ] Dodać unique <meta name="description">
- [ ] Sprawdzić długość (150-160 znaków)
- [ ] Test w view-source

### ZADANIE 2.2: Skip Links (1h)
**Cel:** Keyboard navigation accessibility

**Krok 1:** Dodać CSS dla .skip-link
**Krok 2:** Dodać HTML do każdej strony
**Krok 3:** Test z TAB keyboard

### ZADANIE 2.3: ARIA Labels Audit (1h)
**Cel:** Fix brakujące accessibility labels

---

## DZIEŃ 3: OPTYMALIZACJA ZASOBÓW (4h)

### ZADANIE 3.1: Conditional Leaflet Loading (1h)
**Pliki:** packing.html, tasks.html, vip.html

**Dla każdego:**
- [ ] Usunąć <link> Leaflet CSS
- [ ] Usunąć <script> Leaflet JS
- [ ] Sprawdzić czy strona działa
- [ ] Test funkcjonalności

### ZADANIE 3.2: Lazy Loading Images (1h)
**Cel:** Dodać loading="lazy" do wszystkich <img>

**Krok 1:** Find all <img> tags
**Krok 2:** Dodać loading="lazy"
**Krok 3:** Dodać width/height attributes
**Krok 4:** Test

### ZADANIE 3.3: Font Optimization (2h)
**Opcja A:** Self-host Jost
**Opcja B:** Preload Google Fonts

---

## DZIEŃ 4: NETLIFY CONFIG (2h)

### ZADANIE 4.1: Rozszerzyć netlify.toml
**Krok 1:** Dodać headers
**Krok 2:** Dodać build command
**Krok 3:** Dodać redirects
**Krok 4:** Deploy test

---

## DZIEŃ 5: TESTING + WERYFIKACJA (3h)

### ZADANIE 5.1: E2E Tests
- [ ] npm run test:e2e - wszystkie przechodzą?
- [ ] Manual testing na localhost
- [ ] Test na mobile (Chrome DevTools)

### ZADANIE 5.2: Lighthouse Audit
- [ ] Run Lighthouse (before/after comparison)
- [ ] Verify improvements
- [ ] Document scores

### ZADANIE 5.3: Deploy Preview
- [ ] Deploy na Netlify preview
- [ ] Test wszystkie strony
- [ ] Sprawdzić console errors
- [ ] Final approval

---

## WERYFIKACJA KOŃCOWA

### ✅ Checklist przed merge:
- [ ] Wszystkie testy E2E przechodzą
- [ ] Lighthouse Performance > 80
- [ ] Brak console.log w produkcji
- [ ] CSP działa (sprawdzić console)
- [ ] Wszystkie strony mają meta descriptions
- [ ] Skip links działają (test keyboard)
- [ ] Images lazy loading
- [ ] Fonts zoptymalizowane

### Merge:
```bash
git add .
git commit -m "Phase 1 complete: Security, SEO, Performance"
npm run test:e2e
git checkout main
git merge feature/phase-1-critical-fixes
git push origin main
```

---

**TOTAL CZAS:** 15-17 godzin (5 dni × 3-4h/dzień)
**NASTĘPNY KROK:** Faza 2 (Refaktoryzacja app.js)
