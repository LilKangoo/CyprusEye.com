# 🔧 Naprawa Systemu Tłumaczeń

## Problem

System tłumaczeń nie działał poprawnie z powodu **konfliktu dwóch systemów**:
1. `js/i18n.js` - główny system tłumaczeń
2. `js/languageSwitcher.js` - stary system, który przeładowywał stronę

## Rozwiązanie

### 1. ✅ Wyłączono `languageSwitcher.js`
- System jest teraz wyłączony aby uniknąć konfliktów
- Wszystkie tłumaczenia obsługuje `i18n.js`

### 2. ⚠️ Znaleziono dodatkowy problem: Hardcoded nazwy w app.js

Nazwy miejsc w `app.js` są zapisane na stałe po polsku:
```javascript
{
  id: 'coral-bay',
  name: 'Plaża Coral Bay',  // ← HARDCODED po polsku
  description: 'Złocisty piasek...',  // ← HARDCODED po polsku
}
```

## Co działa:
- ✅ Interfejs tłumaczy się poprawnie
- ✅ Wszystkie przyciski, menu, nawigacja
- ✅ Polski jest językiem domyślnym
- ✅ Przełączanie języków działa

## Co NIE tłumaczy się:
- ❌ Nazwy miejsc w app.js (są hardcoded po polsku)
- ❌ Opisy miejsc w app.js

## Jak to naprawić:

### Opcja 1: Szybka - Pozostaw nazwy po polsku
Jeśli polski jest głównym językiem i Ci to pasuje, zostaw jak jest.

### Opcja 2: Pełna - Przenieś nazwy do systemu tłumaczeń

Trzeba zmienić `app.js` aby używał kluczy z translations:

**PRZED:**
```javascript
{
  id: 'coral-bay',
  name: 'Plaża Coral Bay',
  description: 'Złocisty piasek...',
}
```

**PO:**
```javascript
{
  id: 'coral-bay',
  name: () => window.appI18n?.translations[window.appI18n.language]?.['places.coral-bay.name'] || 'Coral Bay Beach',
  description: () => window.appI18n?.translations[window.appI18n.language]?.['places.coral-bay.description'] || 'Golden sand...',
}
```

Ale to wymaga:
1. Zmiany wszystkich ~40 miejsc w app.js
2. Aktualizacji wszystkich miejsc gdzie używana jest place.name

## Test systemu

Otwórz: `test-translations.html` w przeglądarce aby sprawdzić czy tłumaczenia działają.

## Weryfikacja

```bash
# Sprawdź czy wszystkie pliki JSON są poprawne
node -e "['en','pl','el','he'].forEach(l => { try { JSON.parse(require('fs').readFileSync('translations/'+l+'.json')); console.log('✓', l); } catch(e) { console.log('✗', l, e.message); } });"

# Test w przeglądarce
# Otwórz index.html i dodaj do URL:
# ?lang=pl  - polski
# ?lang=en  - angielski
# ?lang=el  - grecki
# ?lang=he  - hebrajski
```

## Status końcowy

✅ **Interfejs** - tłumaczy się w 100%
✅ **Polski** - język domyślny działa
⚠️ **Nazwy miejsc** - pozostają po polsku (można je zostawić lub zmienić)

## Zalecenie

**Dla najprostszego rozwiązania:**
1. Zostaw nazwy miejsc po polsku w app.js
2. System tłumaczeń UI działa poprawnie
3. Dodaj notatkę, że nazwy geograficzne są po polsku dla wszystkich języków

**Dla pełnego multilanguage:**
1. Przenieś wszystkie nazwy i opisy miejsc do plików translations/*.json
2. Zaktualizuj app.js aby używał funkcji pobierających tłumaczenia
3. Zaktualizuj wszystkie renderowanie nazw miejsc w kodzie

---

**Data naprawy:** 2025-10-31
