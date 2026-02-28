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

### 2. CSS - `/assets/css/language-selector.css?v=2`
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
  - `<link rel="stylesheet" href="assets/css/language-selector.css?v=2" />` w `<head>`
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

## Przepływ Działania

### Pierwsze Odwiedzenie (localStorage: ce_lang_selected = null):
1. **languageSelector.js** ładuje się pierwszy
   - Sprawdza `!hasSelectedLanguage() && isHomePage()`
   - Wyświetla modal z 4 językami
   
2. **i18n.js** ładuje się, ale NIE inicjalizuje
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

## Status: ✅ COMPLETE

System jest w pełni zintegrowany i gotowy do produkcji.
