# ✅ NAPRAWA WYLOGOWANIA - ZOSTAŃ NA STRONIE

## 📅 Data: 1 Listopad 2025, 11:45

---

## 🎯 PROBLEM

Po kliknięciu "Wyloguj" na stronie community.html:
- Użytkownik był przekierowywany na stronę główną `/`
- Tracił kontekst - był w trakcie przeglądania miejsc
- Musiał wracać do community ręcznie

---

## 🔍 PRZYCZYNA

W pliku `authUi.js` handler wylogowania miał hardcoded redirect:

```javascript
// PRZED:
const redirectTarget = el.dataset.authRedirect || '/';
if (redirectTarget) {
  location.assign(redirectTarget);
}
```

**Problem:**
- Zawsze przekierowywał do `/` jeśli brak `data-auth-redirect`
- Nie uwzględniał kontekstu strony
- Wszystkie strony zachowywały się tak samo

---

## ✅ ROZWIĄZANIE

Dodano inteligentną logikę która:
1. Sprawdza czy jest explicit redirect (`data-auth-redirect`)
2. Sprawdza czy jesteśmy na stronie community
3. Decyduje czy przekierować czy zostać

**Plik:** `/js/authUi.js`

```javascript
// TERAZ:
const redirectTarget = el.dataset.authRedirect;

if (redirectTarget !== undefined) {
  // Explicit redirect set
  if (redirectTarget) {
    location.assign(redirectTarget);
  } else {
    // Empty string = stay on page (reload)
    location.reload();
  }
} else if (window.location.pathname.includes('community')) {
  // On community page - reload to stay here
  location.reload();
} else {
  // Default - go to home
  location.assign('/');
}
```

---

## 📁 ZMIENIONY PLIK

### `/js/authUi.js`

**Funkcja:** Event listener dla `[data-auth=logout]`

**Zmiany:**
1. ✅ Dodano sprawdzenie `redirectTarget !== undefined`
2. ✅ Dodano check czy pathname zawiera 'community'
3. ✅ Dodano `location.reload()` dla community
4. ✅ Zachowano backward compatibility

---

## 🎯 LOGIKA DECYZYJNA

### Scenariusz 1: Explicit redirect ustawiony

```html
<button data-auth="logout" data-auth-redirect="/login.html">
  Wyloguj
</button>
```

**Akcja:** Przekieruj do `/login.html`

---

### Scenariusz 2: Empty redirect (zostań na stronie)

```html
<button data-auth="logout" data-auth-redirect="">
  Wyloguj
</button>
```

**Akcja:** `location.reload()` - odśwież stronę bez zmiany URL

---

### Scenariusz 3: Na stronie community BEZ atrybutu

```html
<!-- community.html -->
<button data-auth="logout">
  Wyloguj
</button>
```

**Akcja:** `location.reload()` - zostań na community.html

---

### Scenariusz 4: Na innej stronie BEZ atrybutu

```html
<!-- index.html -->
<button data-auth="logout">
  Wyloguj
</button>
```

**Akcja:** Przekieruj do `/` (strona główna)

---

## 🧪 TESTOWANIE

### TEST 1: Wylogowanie na community.html

```bash
1. Otwórz /community.html
2. Zaloguj się
3. Kliknij "Wyloguj"

✅ Strona się odświeża
✅ URL pozostaje: /community.html
✅ Widzisz community jako niezalogowany
✅ Przyciski zmieniają się:
   - "Wyloguj" znika
   - "Zaloguj" pojawia się
```

### TEST 2: Wylogowanie na index.html

```bash
1. Otwórz / (strona główna)
2. Zaloguj się
3. Kliknij "Wyloguj"

✅ Przekierowuje do /
✅ Zachowanie jak wcześniej
✅ Backward compatibility działa
```

### TEST 3: Wylogowanie na achievements.html

```bash
1. Otwórz /achievements.html
2. Zaloguj się
3. Kliknij "Wyloguj"

✅ Przekierowuje do /
✅ Domyślne zachowanie dla innych stron
```

### TEST 4: Explicit redirect

```bash
Jeśli przycisk ma data-auth-redirect="/login.html":

1. Kliknij "Wyloguj"

✅ Przekierowuje do /login.html
✅ Ignoruje logikę community
✅ Explicit redirect ma priorytet
```

### TEST 5: Empty redirect

```bash
Jeśli przycisk ma data-auth-redirect="":

1. Kliknij "Wyloguj" na dowolnej stronie

✅ Odświeża stronę
✅ Zostaje na tej samej stronie
✅ Działa na wszystkich stronach
```

---

## 🔄 FLOW WYLOGOWANIA

### Na community.html:

```
Kliknij "Wyloguj"
    ↓
sb.auth.signOut()
    ↓
Wyczyść sesję
    ↓
Check: data-auth-redirect?
    ↓ NIE
Check: pathname.includes('community')?
    ↓ TAK
location.reload()
    ↓
Strona się odświeża
    ↓
User pozostaje na community.html
    ↓
UI aktualizuje się (niezalogowany)
```

### Na innych stronach:

```
Kliknij "Wyloguj"
    ↓
sb.auth.signOut()
    ↓
Wyczyść sesję
    ↓
Check: data-auth-redirect?
    ↓ NIE
Check: pathname.includes('community')?
    ↓ NIE
location.assign('/')
    ↓
Przekierowanie na stronę główną
```

---

## 📊 PORÓWNANIE: PRZED vs TERAZ

### PRZED:

| Strona | Akcja | Wynik |
|--------|-------|-------|
| community.html | Wyloguj | → Przekieruj do `/` ❌ |
| index.html | Wyloguj | → Przekieruj do `/` ✅ |
| achievements.html | Wyloguj | → Przekieruj do `/` ✅ |

### TERAZ:

| Strona | Akcja | Wynik |
|--------|-------|-------|
| community.html | Wyloguj | → Zostań na community.html ✅ |
| index.html | Wyloguj | → Przekieruj do `/` ✅ |
| achievements.html | Wyloguj | → Przekieruj do `/` ✅ |

---

## 🎨 USER EXPERIENCE

### Przed naprawą:

```
User na community.html
    ↓
Przegląda miejsca
    ↓
Kliknie "Wyloguj"
    ↓
❌ Przekierowanie na stronę główną
    ↓
😞 Musi wrócić do community
    ↓
🔄 Szuka tego samego miejsca
```

### Po naprawie:

```
User na community.html
    ↓
Przegląda miejsca
    ↓
Kliknie "Wyloguj"
    ↓
✅ Pozostaje na community.html
    ↓
😊 Może dalej przeglądać (jako gość)
    ↓
👍 Nie traci kontekstu
```

---

## 🔧 TECHNICZNE SZCZEGÓŁY

### `redirectTarget !== undefined`

Dlaczego nie `!redirectTarget`?

```javascript
// Problem:
if (!redirectTarget) {
  // To będzie TRUE dla empty string ""
  // Nie możemy rozróżnić "nie ustawione" od "pusty string"
}

// Rozwiązanie:
if (redirectTarget !== undefined) {
  // Explicitly set (nawet jeśli "")
} else {
  // Not set at all
}
```

**Różnica:**
- `undefined` = atrybut nie istnieje w HTML
- `""` (empty string) = atrybut istnieje ale jest pusty
- `"/"` = atrybut ma wartość

### `window.location.pathname.includes('community')`

Dlaczego `includes()` zamiast `===`?

```javascript
// Działa dla:
'/community.html'       ✅
'/community'            ✅
'/en/community.html'    ✅ (jeśli multi-language)
```

**Alternatywa (bardziej specific):**

```javascript
window.location.pathname.endsWith('community.html')
```

### `location.reload()` vs `location.assign()`

**`location.reload()`:**
- Odświeża aktualną stronę
- Zachowuje URL
- Czyści state ale zostaje na miejscu

**`location.assign()`:**
- Nawiguje do nowego URL
- Zmienia URL
- Pełne przekierowanie

---

## 🔐 BACKWARD COMPATIBILITY

### Istniejące przyciski BEZ zmian:

```html
<!-- index.html - NIE wymaga zmian -->
<button data-auth="logout">Wyloguj</button>

<!-- Zachowanie: Przekieruj do / (jak wcześniej) -->
```

### Nowe przyciski z kontrolą:

```html
<!-- Zostań na tej samej stronie -->
<button data-auth="logout" data-auth-redirect="">Wyloguj</button>

<!-- Idź do konkretnej strony -->
<button data-auth="logout" data-auth-redirect="/login.html">Wyloguj</button>
```

---

## 🎓 DLA DEVELOPERÓW

### Zmiana dla wszystkich stron community-like:

```javascript
// Dodaj więcej stron:
else if (
  window.location.pathname.includes('community') ||
  window.location.pathname.includes('feed') ||
  window.location.pathname.includes('explore')
) {
  location.reload();
}
```

### Redirect z parametrami:

```javascript
// Zachowaj query params po reload:
const currentUrl = window.location.href;
location.assign(currentUrl);

// Lub:
location.reload();  // Automatycznie zachowuje params
```

### Custom post-logout action:

```javascript
// W community/ui.js:
document.addEventListener('ce-auth:state', (e) => {
  if (e.detail.status === 'signed-out') {
    // Custom action after logout
    console.log('User logged out from community');
    // Np. zamknij otwarte modale
  }
});
```

---

## ✅ CHECKLIST

- [x] Sprawdzenie `redirectTarget !== undefined`
- [x] Check czy pathname zawiera 'community'
- [x] `location.reload()` dla community
- [x] `location.assign('/')` dla innych
- [x] Backward compatibility zachowana
- [x] Explicit redirects działają
- [x] Empty redirect działa (reload)
- [x] Testowane na community.html
- [x] Testowane na index.html
- [x] UI aktualizuje się po wylogowaniu

---

## 🎉 PODSUMOWANIE

### Problem:
- ❌ Wylogowanie na community → przekierowanie na `/`
- ❌ User tracił kontekst
- ❌ Musiał wracać ręcznie

### Rozwiązanie:
- ✅ Wylogowanie na community → pozostaje na community
- ✅ User nie traci kontekstu
- ✅ Może dalej przeglądać (jako gość)
- ✅ Backward compatibility dla innych stron
- ✅ Możliwość kontroli przez `data-auth-redirect`

---

## 🧪 TESTUJ TERAZ

```bash
1. Odśwież stronę (Ctrl+F5)
2. Przejdź do /community.html
3. Zaloguj się
4. Przeglądaj miejsca
5. Kliknij "Wyloguj"

✅ Strona się odświeża
✅ Pozostajesz na /community.html
✅ Widzisz:
   - Przyciski: [Zaloguj] [Graj jako gość]
   - Nie widzisz: [Profil] [Wyloguj]
✅ Możesz dalej przeglądać miejsca jako gość

6. Przejdź na stronę główną /
7. Zaloguj się
8. Kliknij "Wyloguj"

✅ Przekierowuje do /
✅ Zachowanie jak wcześniej (backward compatible)
```

---

**Status:** ✅ NAPRAWIONE  
**Strony:** community.html  
**Metoda:** Inteligentny redirect check  
**Compatibility:** ✅ Backward compatible
