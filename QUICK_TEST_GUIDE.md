# 🚀 Przewodnik Szybkiego Testowania - Language Selector

## Jak przetestować w 3 krokach:

### Metoda 1: Użyj strony testowej
```bash
# Otwórz w przeglądarce:
test-language-selector.html
```

1. Kliknij przycisk "Clear All Data"
2. Odśwież stronę (F5)
3. Popup z wyborem języka powinien się pojawić ✅

---

### Metoda 2: Użyj głównej strony (index.html)

1. **Otwórz konsolę przeglądarki** (F12)
2. **Wklej i wykonaj:**
   ```javascript
   localStorage.removeItem('ce_lang_selected');
   localStorage.removeItem('seenTutorial');
   localStorage.removeItem('ce_lang');
   location.reload();
   ```
3. Popup powinien się pokazać natychmiast po odświeżeniu

---

## Co testować?

### ✅ Test 1: Pierwsze odwiedzenie
- [ ] Popup pojawia się automatycznie
- [ ] Widać 4 języki w pionie z flagami
- [ ] Polski: "Wybierz 🇵🇱"
- [ ] English: "Choose 🇬🇧"
- [ ] Ελληνικά: "Επιλέξτε 🇬🇷"
- [ ] עברית: "בחר 🇮🇱" (RTL)

### ✅ Test 2: Nawigacja klawiaturą
- [ ] Naciśnij Tab - focus przesuwa się między przyciskami
- [ ] Naciśnij Arrow Down - przechodzi do następnego
- [ ] Naciśnij Arrow Up - przechodzi do poprzedniego
- [ ] Naciśnij Home - skacze do pierwszego
- [ ] Naciśnij End - skacze do ostatniego
- [ ] Naciśnij ESC - **NIC SIĘ NIE DZIEJE** (popup nie zamyka się!)

### ✅ Test 3: Wybór języka
- [ ] Kliknij na jeden z języków (np. Polski)
- [ ] Popup znika z animacją
- [ ] Strona ustawia się na wybrany język
- [ ] Tutorial automatycznie startuje (jeśli to pierwsze odwiedzenie)

### ✅ Test 4: Kolejne odwiedzenia
- [ ] Odśwież stronę (F5)
- [ ] Popup **NIE** pojawia się
- [ ] Język jest zachowany z poprzedniego wyboru

### ✅ Test 5: Hover effects
- [ ] Najedź myszką na przycisk
- [ ] Przycisk zmienia kolor i przesuwa się w prawo
- [ ] Flaga pozostaje na swoim miejscu

---

## Sprawdzenie localStorage

Otwórz konsolę (F12) i wklej:

```javascript
// Sprawdź zapisane wartości:
console.log({
  languageSelected: localStorage.getItem('ce_lang_selected'),  // "true"
  chosenLanguage: localStorage.getItem('ce_lang'),             // "pl"/"en"/"el"/"he"
  tutorialSeen: localStorage.getItem('seenTutorial')           // "true" po obejrzeniu
});
```

---

## Scenariusze testowe

### Scenariusz A: Nowy użytkownik
```
1. Wejście na stronę (index.html)
   → Popup z wyborem języka
2. Wybiera "English"
   → Popup znika
   → Strona w języku angielskim
   → Tutorial startuje automatycznie
3. Kończy tutorial
   → Tutorial znika
4. Odświeża stronę
   → Język English zachowany
   → Popup NIE pokazuje się
   → Tutorial NIE startuje (już oglądany)
```

### Scenariusz B: Powracający użytkownik
```
1. Wejście na stronę
   → Język zapamiętany (np. Polski)
   → Popup NIE pokazuje się
   → Tutorial NIE startuje (już oglądany)
2. Może ręcznie zmienić język przez language switcher
```

### Scenariusz C: Reset dla testowania
```javascript
// W konsoli:
localStorage.clear();
location.reload();

// Wszystko resetuje się do stanu początkowego
```

---

## Troubleshooting

### Popup się nie pokazuje?
```javascript
// Sprawdź:
console.log('Should show?', !localStorage.getItem('ce_lang_selected'));
console.log('Is home page?', document.body.dataset.seoPage === 'home');

// Jeśli oba true, popup powinien się pokazać
```

### Popup pokazuje się za każdym razem?
```javascript
// Sprawdź czy zapisuje się wybór:
console.log(localStorage.getItem('ce_lang_selected')); // powinno być "true"

// Jeśli null, sprawdź czy localStorage działa:
localStorage.setItem('test', '123');
console.log(localStorage.getItem('test')); // powinno być "123"
```

### Tutorial nie startuje po wyborze języka?
```javascript
// Sprawdź czy tutorial jest dostępny:
console.log('Tutorial exists?', !!window.appTutorial);
console.log('Init function?', typeof window.appTutorial?.init);
```

---

## Pliki do sprawdzenia

Po implementacji, te pliki zostały utworzone/zmodyfikowane:

**Nowe pliki:**
- ✅ `/js/languageSelector.js` - logika
- ✅ `/assets/css/language-selector.css` - styling
- ✅ `/test-language-selector.html` - strona testowa
- ✅ `LANGUAGE_SELECTOR_IMPLEMENTATION.md` - dokumentacja

**Zmodyfikowane pliki:**
- ✅ `/index.html` - dodane CSS i JS
- ✅ `/js/i18n.js` - integracja z selectorem
- ✅ `/js/tutorial.js` - opóźnienie startu

---

## Quick Commands

```javascript
// === KONSOLA PRZEGLĄDARKI (F12) ===

// 1. Reset wszystkiego (test pierwszego odwiedzenia)
localStorage.clear(); location.reload();

// 2. Usuń tylko wybór języka
localStorage.removeItem('ce_lang_selected'); location.reload();

// 3. Pokaż popup ręcznie
window.languageSelector?.show();

// 4. Sprawdź stan
console.table({
  'Language Selected': localStorage.getItem('ce_lang_selected'),
  'Chosen Lang': localStorage.getItem('ce_lang'),
  'Tutorial Seen': localStorage.getItem('seenTutorial'),
  'Selector Active': window.languageSelector?.shouldShow()
});

// 5. Symuluj wybór języka
if(window.appI18n) window.appI18n.setLanguage('en');
```

---

## Status: ✅ GOTOWE DO TESTOWANIA

Wszystkie pliki są zaimplementowane i zintegrowane.
System działa automatycznie przy pierwszym odwiedzeniu strony.
