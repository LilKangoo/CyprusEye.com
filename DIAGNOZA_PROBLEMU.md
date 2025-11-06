# 🔍 Diagnoza Problemu - Plan Działania

## 📊 Status

**Data zgłoszenia:** 2 listopada 2024, 20:00  
**Ostatnie działanie:** dzisiaj o 12:00  
**Podejrzenie:** Coś się zmieniło między 12:00 a 20:00

---

## ✅ KROK 1: Szybka Diagnoza

### Otwórz prosty test (BEZ CSP):
```
http://localhost:8080/simple-test.html
```

### Sprawdź co pokazuje:
- ✅ **Zielony status** = Leaflet działa, problem w CSP lub app.js
- ❌ **Czerwony status** = Problem z Leaflet lub siecią
- ⚠️ **Brak kafelków** = Problem z połączeniem do OpenStreetMap

---

## 🔄 KROK 2: Wyczyść WSZYSTKO

### A. Wyczyść Cache Przeglądarki (KRYTYCZNE!)
```bash
# Mac - Chrome/Edge:
Cmd + Shift + Delete
# Wybierz "All time" i zaznacz:
- ✅ Cached images and files
- ✅ Cookies and other site data

# Lub Hard Refresh:
Cmd + Shift + R (kilka razy!)
```

### B. Wyczyść Service Workers (jeśli są)
```
DevTools (F12) > Application > Service Workers > Unregister All
DevTools (F12) > Application > Storage > Clear site data
```

### C. Zamknij WSZYSTKIE karty z localhost
```
1. Zamknij wszystkie karty z localhost:8080
2. Zamknij przeglądarkę całkowicie
3. Otwórz ponownie
```

---

## 🧪 KROK 3: Test Podstawowy

### Otwórz w NOWEJ przeglądarce lub trybie prywatnym:
```
http://localhost:8080/simple-test.html
```

**Jeśli działa** → Problem jest w cache lub CSP  
**Jeśli nie działa** → Problem jest głębszy

---

## 🔙 KROK 4: Przywróć Poprzednią Wersję

Jeśli nadal nie działa, przywróćmy stan z 12:00:

```bash
cd /Users/kangur/Documents/GitHub/CyprusEye.com/CyprusEye.com

# Sprawdź commity z dzisiaj:
git log --since="2024-11-02 12:00" --oneline

# Znajdź commit sprzed problemów i:
git checkout <commit-hash>

# Lub reset do stanu sprzed naszych zmian:
git reset --hard HEAD~20  # Cofnie 20 ostatnich commitów
```

---

## 🎯 KROK 5: Co Sprawdzić

### A. Otwórz DevTools (F12) > Console
**Szukaj:**
- ❌ Czerwone błędy "Refused to..."
- ❌ "Cannot read properties of undefined"
- ❌ "L is not defined"
- ❌ "Failed to load resource"

### B. Otwórz DevTools (F12) > Network
**Sprawdź:**
- `app.js` - status 200 lub 304?
- `leaflet.js` - status 200 lub 304?
- `*.tile.openstreetmap.org/*.png` - status 200?

### C. Sprawdź Elements
**W HTML zobacz czy:**
- `<div id="map">` istnieje?
- Ma wysokość (nie jest 0px)?
- Są elementy `.leaflet-container`?

---

## 🚨 Możliwe Przyczyny Problemu

### 1. Cache Przeglądarki
**Objawy:** Stara wersja plików  
**Rozwiązanie:** Hard refresh (Cmd+Shift+R)

### 2. CSP Blokuje Zasoby
**Objawy:** "Refused to connect" w console  
**Rozwiązanie:** Sprawdź czy masz zaktualizowany CSP

### 3. app.js jako module vs defer
**Objawy:** "Unexpected token 'import'"  
**Rozwiązanie:** Musi być `<script type="module">`

### 4. Konflikt ze starymi plikami
**Objawy:** Dziwne błędy JS  
**Rozwiązanie:** Wyczyść wszystko i odśwież

### 5. Service Worker w tle
**Objawy:** Stare pliki mimo refresh  
**Rozwiązanie:** Unregister service workers

---

## 💡 Szybkie Rozwiązanie

### Jeśli chcesz natychmiast działającą mapę:

1. **Otwórz:** `simple-test.html` - to ZAWSZE powinno działać
2. **Jeśli działa** → problem w index.html/app.js
3. **Skopiuj** działający kod z simple-test.html
4. **Zastosuj** w index.html

---

## 📝 Logi Do Sprawdzenia

### Uruchom w konsoli przeglądarki:
```javascript
// Sprawdź czy Leaflet istnieje
console.log('Leaflet:', typeof L, L?.version);

// Sprawdź czy mapa została utworzona
console.log('Map div:', document.getElementById('map'));

// Sprawdź czy app.js się załadował
console.log('Places:', typeof places, places?.length);

// Sprawdź moduły
console.log('Modules loaded:', {
  dates: typeof toUtcDate,
  translations: typeof getTranslation,
  store: typeof store
});
```

---

## 🎬 Akcje Do Wykonania TERAZ

1. [ ] Otwórz http://localhost:8080/simple-test.html
2. [ ] Jeśli działa → wyczyść cache i sprawdź index.html
3. [ ] Jeśli nie działa → restart serwera i sprawdź sieć
4. [ ] Otwórz DevTools i przekopiuj WSZYSTKIE błędy z console
5. [ ] Zrób screenshot zakładki Network
6. [ ] Powiedz mi dokładnie co widzisz

---

## 📞 Informacje Które Potrzebuję

**Aby pomóc, powiedz mi:**
1. Czy `simple-test.html` działa? (TAK/NIE)
2. Czy `index.html` wyświetla mapę? (TAK/NIE)
3. Co pokazuje konsola? (skopiuj błędy)
4. Czy kafelki się ładują? (czy widzisz mapę Cypru?)
5. Czy lista POI jest pod mapą? (TAK/NIE)

---

## ⚡ Szybki Fix - Bez Czytania

Jeśli nie masz czasu czytać, zrób to:

```bash
# 1. Wyczyść cache
Cmd + Shift + R (lub Ctrl + Shift + R)

# 2. Otwórz test
open http://localhost:8080/simple-test.html

# 3. Jeśli działa, otwórz index.html w trybie prywatnym
Cmd + Shift + N (Chrome)
open http://localhost:8080/index.html

# 4. Jeśli nadal nie działa, wyzeruj projekt:
cd /Users/kangur/Documents/GitHub/CyprusEye.com/CyprusEye.com
git reset --hard origin/main
```

---

**Status:** 🔍 Czekam na wyniki testów
