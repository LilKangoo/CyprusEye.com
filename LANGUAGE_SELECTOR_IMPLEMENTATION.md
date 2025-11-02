# Language Selector - Implementation Complete

## Overview
Zaimplementowany system wyboru języka przy pierwszym odwiedzeniu strony. Popup pojawia się przed instrukcją obsługi i wymusza wybór jednego z 4 języków.

## Zaimplementowane Pliki

### 1. JavaScript - `/js/languageSelector.js`
- **Funkcjonalność:**
  - Wykrywa pierwsze odwiedzenie strony (brak `ce_lang_selected` w localStorage)
  - Wyświetla modal z 4 językami: Polski, English, Ελληνικά, עברית
  - Blokuje zamknięcie (ESC disabled) - użytkownik MUSI wybrać język
  - Nawigacja klawiaturą (Arrow Up/Down, Tab, Home, End)
  - Trap focus w dialogu dla accessibility
  - Po wyborze: zapisuje wybór, ustawia język przez `window.appI18n.setLanguage()`, inicjalizuje tutorial
  
- **Storage Key:** `ce_lang_selected` (true po wyborze języka)
- **Integracja:** Eksponuje `window.languageSelector` dla innych skryptów

### 2. CSS - `/assets/css/language-selector.css`
- **Styling:**
  - Overlay z backdrop blur (rgba(0,0,0,0.85))
  - Dialog z animacją slide-in
  - 4 przyciski w układzie pionowym (flex-direction: column)
  - Każdy przycisk: tekst ("Wybierz", "Choose", etc.) + flaga emoji
  - Hover/focus effects z transform translateX(4px)
  - RTL support dla Hebrew
  - Responsive dla mobile
  - High contrast mode support
  - Reduced motion support

### 3. Integracja HTML - `/index.html`
- **Dodane:**
  - `<link rel="stylesheet" href="assets/css/language-selector.css" />` w `<head>`
  - `<script src="js/languageSelector.js" defer></script>` PRZED `js/i18n.js`
  
- **Kolejność skryptów (ważne!):**
  ```html
  <script src="js/languageSelector.js" defer></script>  <!-- PIERWSZY -->
  <script src="js/i18n.js" defer></script>
  <script src="js/forms.js" defer></script>
  <script src="js/tutorial.js" defer></script>
  ```

### 4. Modyfikacje i18n - `/js/i18n.js`
- **Zmieniona funkcja `init()`:**
  - Sprawdza czy `window.languageSelector.shouldShow()` zwraca true
  - Jeśli tak, NIE inicjalizuje automatycznie (czeka na wybór użytkownika)
  - Dodany timeout 10ms aby language selector zdążył się zainicjalizować

### 5. Modyfikacje tutorial - `/js/tutorial.js`
- **Zmieniona funkcja `init()`:**
  - Sprawdza czy language selector jest aktywny
  - Jeśli tak, NIE uruchamia automatycznie tutoriala
  - Tutorial wystartuje dopiero PO wyborze języka (wywołane przez languageSelector.js)

## ⚡ Event-Driven Architecture - Jak to działa

### Mechanizm Blokowania:
```javascript
// 1. Language Selector ustawia BLOKADĘ
document.documentElement.setAttribute('data-language-selection-pending', 'true');
window.languageSelectorActive = true;

// 2. Inne skrypty SPRAWDZAJĄ blokadę
if (document.documentElement.hasAttribute('data-language-selection-pending')) {
  // CZEKAJ na event
  document.addEventListener('languageSelector:ready', handleReady, { once: true });
}

// 3. Po wyborze - USUŃ blokadę i WYŚLIJ event
document.documentElement.removeAttribute('data-language-selection-pending');
document.dispatchEvent(new CustomEvent('languageSelector:ready', {
  detail: { languageSelected: true, language: 'pl' }
}));
```

## Przepływ Działania (Event-Driven Architecture)

### Pierwsze Odwiedzenie (localStorage: ce_lang_selected = null):
1. **languageSelector.js** ładuje się pierwszy
   - Sprawdza `!hasSelectedLanguage() && isHomePage()`
   - Wyświetla modal z 4 językami
   
2. **i18n.js** ładuje się, ale NIE inicjalizuje
   - Sprawdza czy `window.languageSelector.shouldShow()` zwraca true
   - Jeśli tak, NIE inicjalizuje automatycznie (czeka na wybór użytkownika)
   
   - Wykrywa że `languageSelector.shouldShow() === true`
   - Czeka na akcję użytkownika

3. **tutorial.js** ładuje się, ale NIE startuje
   - Wykrywa że language selector jest aktywny
   - Czeka na wybór języka

4. **Użytkownik wybiera język (np. Polski)**
   - `languageSelector.selectLanguage('pl')` wywołuje:
     - `markLanguageAsSelected()` → zapisuje `ce_lang_selected = true`
     - `window.appI18n.setLanguage('pl')` → ustawia język
     - Zamyka modal
     - Po 100ms wywołuje `window.appTutorial.init()` → startuje tutorial

### Kolejne Odwiedzenia (localStorage: ce_lang_selected = true):
1. **languageSelector.js** - `shouldShow()` zwraca false (język już wybrany)
2. **i18n.js** - normalna inicjalizacja z zapisanym językiem
3. **tutorial.js** - normalny przepływ (sprawdza `seenTutorial`)

## Języki i Ich Reprezentacja

```javascript
const SUPPORTED_LANGUAGES = {
  pl: { label: 'Wybierz', flag: '🇵🇱', fullName: 'Polski' },
  en: { label: 'Choose', flag: '🇬🇧', fullName: 'English' },
  el: { label: 'Επιλέξτε', flag: '🇬🇷', fullName: 'Ελληνικά' },
  he: { label: 'בחר', flag: '🇮🇱', fullName: 'עברית' },
};
```

### Układ Przycisków (pionowo):
```
┌─────────────────────────────┐
│ Wybierz                  🇵🇱 │
├─────────────────────────────┤
│ Choose                   🇬🇧 │
├─────────────────────────────┤
│ Επιλέξτε                 🇬🇷 │
├─────────────────────────────┤
│ בחר                      🇮🇱 │ (RTL)
└─────────────────────────────┘
```

## Accessibility Features

- **ARIA Labels:** Pełne etykiety dla screen readers
- **Keyboard Navigation:** Arrow keys, Tab, Home, End
- **Focus Trap:** Focus zamknięty w dialogu
- **Role Dialog:** Proper ARIA roles (dialog, modal)
- **No Escape:** Użytkownik MUSI wybrać (nie można pominąć)
- **RTL Support:** Automatyczne RTL dla Hebrew

## Testowanie

### Wyczyść localStorage aby przetestować:
```javascript
// W konsoli przeglądarki:
localStorage.removeItem('ce_lang_selected');
localStorage.removeItem('seenTutorial');
localStorage.removeItem('ce_lang');
location.reload();
```

### Oczekiwane Zachowanie:
1. Strona się ładuje
2. **NATYCHMIAST** pojawia się language selector (przed wszystkim)
3. Nie można zamknąć (ESC nie działa)
4. Po kliknięciu na język:
   - Modal znika
   - Strona ustawia się na wybrany język
   - Tutorial automatycznie startuje

### Weryfikacja kolejnych wizyt:
```javascript
// Sprawdź localStorage:
localStorage.getItem('ce_lang_selected'); // "true"
localStorage.getItem('ce_lang'); // "pl" / "en" / "el" / "he"
localStorage.getItem('seenTutorial'); // "true" (po zakończeniu tutorial)

// Odśwież stronę - language selector NIE powinien się pojawić
```

## Z-Index Hierarchy
- Language Selector: `z-index: 10000` (najwyższy)
- Tutorial Overlay: niższy (pojawia się PO wyborze języka)

## Styling Details

### Colors:
- Background: `white`
- Backdrop: `rgba(0, 0, 0, 0.85)` + `backdrop-filter: blur(8px)`
- Border: `#e1e4e8` (default), `#0066cc` (hover/focus)
- Text: `#1a1a1a`
- Button background: `#f8f9fa` (default), `#e8f4f8` (hover/focus)

### Animations:
- Fade in: opacity 0 → 1 (0.3s)
- Slide in: translateY(-20px) scale(0.95) → translateY(0) scale(1) (0.4s)
- Hover: translateX(4px)
- Active: scale(0.98)

## Bezpieczeństwo

- **localStorage Fallback:** Graceful degradation jeśli localStorage niedostępne
- **Safe Checks:** Wszystkie funkcje sprawdzają czy window.appI18n istnieje
- **No Hardcoding:** Używa istniejących kluczy i systemu tłumaczeń

## Kompatybilność

- ✅ Działa na wszystkich nowoczesnych przeglądarkach
- ✅ Mobile responsive
- ✅ RTL support (Hebrew)
- ✅ High contrast mode
- ✅ Reduced motion preferences
- ✅ Screen readers

## 🧪 Instrukcje Testowania

### Krok 1: Otwórz stronę testową
```
http://localhost:8000/test-language-selector.html
```

### Krok 2: Test pierwszego odwiedzenia
1. Kliknij "Clear All Data"
2. Kliknij "Refresh Page"
3. **Sprawdź:**
   - ✅ Language Selector pojawia się NATYCHMIAST
   - ✅ HTML Flag (pending): "true"
   - ✅ Console pokazuje: "Language Selector Debug: shouldShow: true"
   - ✅ Tutorial NIE startuje

### Krok 3: Wybierz język
1. Kliknij na jeden z języków (np. Polski)
2. **Sprawdź:**
   - ✅ Modal znika
   - ✅ HTML Flag (pending): "NOT SET"
   - ✅ Console pokazuje: "Language pl selected by user"
   - ✅ Console pokazuje: "🎉 EVENT FIRED: languageSelector:ready"
   - ✅ Events Fired: "languageSelector:ready at [time]"

### Krok 4: Test kolejnych wizyt
1. Odśwież stronę (F5)
2. **Sprawdź:**
   - ✅ Language Selector NIE pojawia się
   - ✅ HTML Flag (pending): "NOT SET"
   - ✅ Console pokazuje: "Language selector not needed"
   - ✅ Język zachowany z poprzedniego wyboru

### Krok 5: Test głównej strony
1. Otwórz `http://localhost:8000/index.html`
2. Wyczyść localStorage w konsoli:
   ```javascript
   localStorage.clear(); location.reload();
   ```
3. **Sprawdź:**
   - ✅ Language Selector pojawia się PRZED tutorialem
   - ✅ Po wyborze języka tutorial startuje automatycznie
   - ✅ Tutorial jest w wybranym języku

---

## 🎯 Kluczowe Punkty Rozwiązania

### 1. HTML Attribute jako flaga synchronizacji
- `data-language-selection-pending="true"` - blokuje inne skrypty
- Dostępna natychmiast dla wszystkich skryptów
- Nie ma race condition

### 2. Custom Event jako trigger
- `languageSelector:ready` - sygnał że język jest gotowy
- Event wysyłany w 2 przypadkach:
  - Po wyborze języka przez użytkownika
  - Gdy język już był wybrany (skipSelector: true)

### 3. Event Listeners z `{ once: true }`
- Automatycznie usuwają się po pierwszym wywołaniu
- Zapobiega memory leaks
- Czysta implementacja

### 4. Console Logging dla diagnostyki
- Każdy krok jest logowany
- Łatwe debugowanie
- Transparentny flow

---

## 📊 Porównanie: Przed vs. Po

### PRZED (setTimeout hack):
```javascript
// ❌ Niepewna kolejność
setTimeout(init, 10); // Może nie wystarczyć
if (window.languageSelector?.shouldShow()) { ... } // Race condition
```

### PO (Event-driven):
```javascript
// ✅ Gwarantowana kolejność
if (document.documentElement.hasAttribute('data-language-selection-pending')) {
  document.addEventListener('languageSelector:ready', init, { once: true });
}
```

---

## Status: ✅ COMPLETE & TESTED

System jest w pełni zintegrowany, przetestowany i gotowy do produkcji.

**Event-driven architecture gwarantuje że Language Selector ZAWSZE pokazuje się przed Tutorial.**
