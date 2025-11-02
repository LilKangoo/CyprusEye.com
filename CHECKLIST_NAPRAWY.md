# ✅ Checklist Naprawy Mapy - Szybka Weryfikacja

## 🔴 KRYTYCZNE - Zrób to NAJPIERW!

### 1. Wyczyść Cache Przeglądarki
- [ ] **Chrome/Edge:** Naciśnij `Cmd+Shift+R` (Mac) lub `Ctrl+Shift+R` (Windows)
- [ ] **Firefox:** Naciśnij `Cmd+Shift+R` (Mac) lub `Ctrl+F5` (Windows)
- [ ] **Safari:** Cmd+Option+R
- [ ] Lub zamknij i otwórz przeglądarkę ponownie

**Dlaczego to jest ważne?**  
Przeglądarka może mieć w cache starą wersję `app.js` bez `type="module"`, co powoduje błędy.

---

## 🧪 Test 1: Strona Diagnostyczna

### Otwórz:
```
http://localhost:8080/diagnoza-mapy.html
```

### Sprawdź - wszystkie powinny być ✅:
- [ ] Test podstawowy - ✅ OK
- [ ] Test CSP - ✅ OK
- [ ] Test Leaflet CSS - ✅ OK
- [ ] Test Leaflet JS - ✅ OK
- [ ] Test kafelków OpenStreetMap - ✅ OK
- [ ] Test pełnej inicjalizacji - ✅ OK (mapa się wyświetla)

**Jeśli któryś test to ❌ BŁĄD - zobacz NAPRAWA_MAPY_KOMPLETNA.md**

---

## 🗺️ Test 2: Strona Główna

### Otwórz:
```
http://localhost:8080/index.html
```

### Wizualna weryfikacja:
- [ ] Mapa jest widoczna (nie pusta szara ramka)
- [ ] Kafelki mapy się załadowały (widać mapę Cypru)
- [ ] Pod mapą widoczna jest lista miejsc (minimum 6 pozycji)
- [ ] Pierwszy element listy to "Kato Paphos Archaeological Park"

### Funkcjonalna weryfikacja:
- [ ] Kliknij na marker na mapie → wyświetla się popup z nazwą miejsca
- [ ] Kliknij na miejsce z listy → mapa centruje się na tym miejscu
- [ ] Przewiń stronę w dół → lista POI jest widoczna

---

## 🔍 Test 3: Konsola Przeglądarki (F12)

### Otwórz DevTools:
- **Mac:** `Cmd+Option+I`
- **Windows:** `F12` lub `Ctrl+Shift+I`

### Zakładka Console:
- [ ] **BRAK** błędów w kolorze czerwonym
- [ ] **BRAK** błędu "Unexpected token 'import'"
- [ ] **BRAK** błędu "Cannot use import statement"
- [ ] **BRAK** błędu "Refused to connect"
- [ ] (OK) Mogą być ostrzeżenia żółte od Supabase - to normalne

### Zakładka Network:
- [ ] `app.js` - status 200 lub 304
- [ ] `leaflet.css` - status 200 lub 304
- [ ] `leaflet.js` - status 200 lub 304
- [ ] Kafelki `*.tile.openstreetmap.org/*.png` - status 200

---

## ⚠️ Co Robić Jeśli Coś Nie Działa

### Problem: Nadal pusta mapa / brak kafelków

#### Krok 1: Sprawdź CSP
```bash
# Otwórz plik w edytorze:
/index.html (linia 18)
```

Upewnij się że zawiera:
```
https://*.tile.openstreetmap.org
```

#### Krok 2: Sprawdź type="module"
```bash
# Otwórz plik w edytorze:
/index.html (linia 554)
```

Powinno być:
```html
<script type="module" src="app.js"></script>
```

NIE:
```html
<script src="app.js" defer></script>
```

#### Krok 3: Hard Refresh
1. Zamknij WSZYSTKIE karty przeglądarki
2. Wyczyść cache całkowicie:
   - Chrome: Settings > Privacy > Clear browsing data
   - Zaznacz "Cached images and files"
   - Time range: "All time"
   - Clear data
3. Otwórz przeglądarkę na nowo

#### Krok 4: Tryb Incognito/Prywatny
- Chrome: `Cmd+Shift+N` (Mac) lub `Ctrl+Shift+N` (Windows)
- Firefox: `Cmd+Shift+P` (Mac) lub `Ctrl+Shift+P` (Windows)
- Safari: `Cmd+Shift+N`

Spróbuj otworzyć stronę w trybie prywatnym.

#### Krok 5: Wyłącz rozszerzenia
Niektóre rozszerzenia mogą blokować zasoby:
- uBlock Origin
- Adblock Plus
- Privacy Badger
- Any ad blocker

Wyłącz je tymczasowo lub użyj trybu incognito.

---

## 🎯 Quick Fix dla Najczęstszych Problemów

### "Mapa się ładuje ale są same szare kafelki"
→ Problem z połączeniem do OpenStreetMap  
→ Sprawdź CSP (Krok 1 powyżej)  
→ Sprawdź połączenie internetowe  
→ Sprawdź DevTools > Network > Filtruj "tile" - czy status to 200?

### "Console pokazuje: Unexpected token 'import'"
→ `app.js` nie jest ładowany jako moduł  
→ Sprawdź czy masz `type="module"` (Krok 2 powyżej)  
→ Wyczyść cache i odśwież

### "Console pokazuje: Cannot find module"
→ Sprawdź czy wszystkie pliki istnieją:
  - `/src/utils/dates.js`
  - `/src/utils/translations.js`
  - `/src/state/store.js`
  - `/src/state/accounts.js`

### "Lista POI pod mapą jest pusta"
→ Sprawdź czy `places` array w `app.js` ma 86 elementów  
→ Sprawdź console czy są błędy  
→ Sprawdź czy `renderLocations()` jest wywoływana

---

## 📊 Ostateczna Weryfikacja

Po wykonaniu wszystkich kroków powyżej, odpowiedz na te pytania:

1. **Czy diagnoza-mapy.html pokazuje wszystkie ✅?**
   - TAK → Idź dalej
   - NIE → Zobacz sekcję diagnostyki błędów w NAPRAWA_MAPY_KOMPLETNA.md

2. **Czy index.html wyświetla mapę z kafelkami?**
   - TAK → Idź dalej
   - NIE → Wykonaj Hard Refresh i sprawdź console

3. **Czy lista POI jest widoczna pod mapą?**
   - TAK → ✅ SUKCES!
   - NIE → Sprawdź console i Network tab

4. **Czy kliknięcie markera wyświetla popup?**
   - TAK → ✅ SUKCES!
   - NIE → Sprawdź czy Leaflet się załadował (console: `L.version`)

5. **Czy kliknięcie miejsca z listy centruje mapę?**
   - TAK → ✅ WSZYSTKO DZIAŁA!
   - NIE → Sprawdź event listenery w DevTools

---

## ✅ Jeśli Wszystko Działa

**Gratulacje! Mapa została naprawiona! 🎉**

Możesz teraz:
- Usunąć pliki testowe:
  - `test-map.html`
  - `diagnoza-mapy.html`
- Zrobić commit zmian:
  ```bash
  git add .
  git commit -m "fix: naprawa mapy Leaflet - CSP i ES6 modules"
  git push
  ```

---

## 📞 Nadal Nie Działa?

Jeśli po wykonaniu WSZYSTKICH kroków powyżej mapa nadal nie działa:

1. Sprawdź pełną dokumentację: `NAPRAWA_MAPY_KOMPLETNA.md`
2. Skopiuj błędy z konsoli (F12 > Console)
3. Zrób screenshot zakładki Network (F12 > Network)
4. Sprawdź która DOKŁADNIE część nie działa:
   - Nie ładuje się Leaflet?
   - Nie ładują się kafelki?
   - Nie ma markerów?
   - Nie ma listy POI?

---

**Czas szacunkowy na całą weryfikację: 5-10 minut**  
**Data: 2 listopada 2024**
