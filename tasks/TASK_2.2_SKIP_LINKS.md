# ZADANIE 2.2: Dodać Skip Links (Accessibility)

**Czas:** 1 godzina  
**Priorytet:** WYSOKI  
**Ryzyko:** NISKIE (tylko HTML + CSS)

---

## CO TO JEST SKIP LINK?

Skip link pozwala użytkownikom klawiatury (osobom niewidomym, z dysfunkcjami motorycznymi) pominąć nawigację i przejść bezpośrednio do głównej treści.

**Przykład:**
User naciska TAB → pojawia się "Przejdź do treści" → ENTER → focus na main content

---

## KROK 1: Dodać CSS dla skip-link (10 min)

### Edytować `/assets/css/base.css`:

Dodać na końcu pliku:
```css
/* ============================================
   SKIP LINK (Accessibility)
   ============================================ */

.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 10000;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary, #0ea5e9);
  color: white;
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 4px 0;
  transition: top 0.2s ease-in-out;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.skip-link:focus {
  top: 0;
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.skip-link:hover {
  background: var(--color-primary-dark, #0284c7);
}

/* Screen reader only (utility class) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 0.5rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### Weryfikacja:
- [ ] CSS dodany do base.css
- [ ] Syntax poprawny
- [ ] Zmienne CSS używane (--color-primary)
- [ ] Plik zapisany

---

## KROK 2: Dodać skip link do index.html (5 min)

### Lokalizacja:
Na **samym początku** <body>, PRZED headerem.

### Kod do dodania:
```html
<body data-navigation="multi-page" data-initial-view="adventureView" data-seo-page="home">
  <!-- ✅ SKIP LINK - Accessibility -->
  <a href="#main-content" class="skip-link" data-i18n="accessibility.skipToContent">
    Przejdź do głównej treści
  </a>
  
  <div id="authMessage" class="auth-message" role="status" aria-live="polite"></div>
  <header class="app-header">
    <!-- ... -->
  </header>
  
  <main id="main-content">  <!-- ✅ Dodać id="main-content" -->
    <!-- treść -->
  </main>
</body>
```

### Zmiany:
1. Dodać skip-link jako pierwszy element w <body>
2. Dodać `id="main-content"` do <main>

### Weryfikacja:
- [ ] Skip link dodany na początku <body>
- [ ] id="main-content" dodany do <main>
- [ ] href="#main-content" poprawny
- [ ] Plik zapisany

---

## KROK 3: Dodać skip link do pozostałych stron (30 min)

### Strony do edycji:
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

**Krok A:** Dodać skip link na początku <body>
```html
<a href="#main-content" class="skip-link" data-i18n="accessibility.skipToContent">
  Przejdź do głównej treści
</a>
```

**Krok B:** Znaleźć <main> i dodać id:
```html
<main id="main-content">
```

**JEŚLI NIE MA <main>:**
- Dodać `<main id="main-content">` wokół głównej treści
- Lub dodać id do głównego <div> kontenera

**Krok C:** Zaznacz na liście powyżej

### Weryfikacja dla każdego:
- [ ] Skip link dodany
- [ ] id="main-content" dodany
- [ ] Struktura HTML poprawna
- [ ] Plik zapisany

---

## KROK 4: Dodać tłumaczenia (5 min)

### Edytować `/translations/en.json`:
```json
"accessibility": {
  "skipToContent": "Skip to main content",
  "skipToNav": "Skip to navigation"
}
```

### Edytować `/translations/pl.json`:
```json
"accessibility": {
  "skipToContent": "Przejdź do głównej treści",
  "skipToNav": "Przejdź do nawigacji"
}
```

### Edytować `/translations/el.json`:
```json
"accessibility": {
  "skipToContent": "Μετάβαση στο κύριο περιεχόμενο",
  "skipToNav": "Μετάβαση στην πλοήγηση"
}
```

### Edytować `/translations/he.json`:
```json
"accessibility": {
  "skipToContent": "דלג לתוכן הראשי",
  "skipToNav": "דלג לניווט"
}
```

### Weryfikacja:
- [ ] 4 pliki językowe zaktualizowane
- [ ] JSON syntax poprawny
- [ ] Tłumaczenia sensowne

---

## KROK 5: TEST Accessibility (10 min)

### Test 1: Keyboard Navigation
```bash
npm run serve
```

1. Otwórz http://localhost:3001
2. **Nie używaj myszy!**
3. Naciśnij **TAB** (jeden raz)
4. **Sprawdź:** Czy pojawił się niebieski box "Przejdź do głównej treści"?
5. Naciśnij **ENTER**
6. **Sprawdź:** Czy focus przeskoczył do main content?

### Test 2: Każda strona
Powtórz Test 1 dla:
- [ ] index.html
- [ ] community.html
- [ ] achievements.html
- [ ] packing.html
- [ ] tasks.html
- [ ] car-rental.html

### Test 3: Screen Reader (opcjonalne)
Jeśli masz Mac:
1. Włącz VoiceOver (CMD + F5)
2. Otwórz stronę
3. VoiceOver powinien odczytać "Link, Przejdź do głównej treści"

### Test 4: WAVE Tool
1. Zainstaluj WAVE extension: https://wave.webaim.org/extension/
2. Otwórz index.html
3. Kliknij WAVE icon
4. **Sprawdź:** 
   - ✅ Brak accessibility errors
   - ✅ Skip link wykryty
   - ✅ Semantic structure OK

---

## KROK 6: Update dokumentacji (5 min)

### Utworzyć `/docs/ACCESSIBILITY.md`:
```markdown
# Accessibility Features

## Skip Links
All pages include a skip link allowing keyboard users to bypass navigation.

**Implementation:**
- Skip link appears on first TAB press
- Jumps to `#main-content`
- Hidden by default (position: absolute; top: -40px)
- Visible on focus

**Testing:**
1. Press TAB on any page
2. Skip link should appear at top-left
3. Press ENTER to jump to main content

## Screen Reader Support
- ARIA labels on all interactive elements
- Semantic HTML5 structure
- Alt text on all images
- Form labels properly associated

## Keyboard Navigation
- All functionality accessible via keyboard
- Logical tab order
- Focus indicators visible
- No keyboard traps
```

### Weryfikacja:
- [ ] Plik utworzony
- [ ] Dokumentacja kompletna

---

## COMMIT

```bash
git add assets/css/base.css
git add *.html
git add auth/*.html
git add account/*.html
git add reset/*.html
git add translations/*.json
git add docs/ACCESSIBILITY.md
git commit -m "Task 2.2: Add skip links for keyboard accessibility

- Added skip-link CSS to base.css
- Implemented skip links on all 18 pages
- Added id='main-content' to main content areas
- Added i18n translations (4 languages)
- Tested keyboard navigation (TAB + ENTER)
- Created accessibility documentation
- WAVE accessibility test passed"
```

---

## ✅ DONE CRITERIA

- [ ] CSS dla skip-link dodany
- [ ] Skip link na 18 stronach
- [ ] id="main-content" na wszystkich stronach
- [ ] Tłumaczenia (4 języki)
- [ ] TEST: TAB pokazuje skip link ✅
- [ ] TEST: ENTER przenosi do treści ✅
- [ ] WAVE test passed
- [ ] Dokumentacja utworzona
- [ ] Commit wykonany

**Czas faktyczny:** _____ min  
**WAVE errors before:** _____  
**WAVE errors after:** _____

---

**POPRZEDNIE:** TASK_2.1_META_DESCRIPTIONS.md  
**NASTĘPNE:** TASK_2.3_ARIA_LABELS.md
