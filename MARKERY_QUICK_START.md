# ⚡ Quick Start - Markery na Mapie

## ✅ Naprawione!

Mapa teraz automatycznie:
- ✅ Pokazuje markery po załadowaniu POI z Supabase
- ✅ Aktualizuje markery po dodaniu POI w admin
- ✅ Usuwa markery po zmianie statusu na Draft/Hidden
- ✅ Usuwa markery po usunięciu POI

---

## 📝 CO MUSISZ ZROBIĆ (2 KROKI):

### KROK 1: Wyczyść Cache ⚠️

**KRYTYCZNE!** Nowy app-core.js musi się załadować!

```
1. Cmd+Shift+Delete (Mac) lub Ctrl+Shift+Delete (Win)
2. Zaznacz "Cached images and files"
3. Clear data
4. Zamknij WSZYSTKIE karty cypruseye.com
5. Zamknij przeglądarkę
6. Otwórz ponownie
```

---

### KROK 2: Test

```
1. Otwórz stronę główną
2. Cmd+Shift+R (hard refresh)
3. Sprawdź konsolę (Cmd+Option+J):
```

**Oczekiwane logi:**
```
✅ Supabase client ready
✅ Loaded X POIs from Supabase
✅ Map instance created
✅ Updated map with X markers
✅ Map initialized with X markers
```

**Mapa powinna pokazać niebieskie markery! 📍**

---

## 🧪 Quick Test

### Test 1: Dodaj POI w admin
```
1. /admin → Add New POI
2. Name: Test Marker
3. Lat: 34.864225, Lng: 33.306262
4. Status: Published
5. Save
6. Wróć do mapy głównej (NIE odświeżaj strony!)
7. Nowy marker powinien pojawić się automatycznie ✅
```

### Test 2: Zmień status na Draft
```
1. /admin → edytuj "Test Marker"
2. Status → Draft
3. Save
4. Wróć do mapy głównej
5. Marker powinien zniknąć automatycznie ✅
```

---

## 🔍 Jeśli coś nie działa:

### Markery nie pojawiają się?

**Check 1:** Czy POI są w bazie z statusem 'published'?
```sql
SELECT id, name, status FROM pois WHERE status = 'published';
```

**Check 2:** Czy PLACES_DATA jest załadowany?
```javascript
console.log(window.PLACES_DATA?.length);
```

**Check 3:** Czy app-core.js się załadował?
```javascript
console.log(typeof window.updateMapMarkers);
// Powinno być: "function"
```

**Jeśli undefined:**
→ Cache nie został wyczyszczony!
→ Wyczyść ponownie i zamknij całą przeglądarkę

---

### Markery nie aktualizują się po zmianach?

**Check:** Czy event działa?
```javascript
window.addEventListener('poisDataRefreshed', () => {
  console.log('✅ Event works!');
});
```

**Potem w /admin dodaj POI → sprawdź czy log się pojawi**

**Jeśli NIE:**
→ Sprawdź czy uruchomiłeś 3 SQL w Supabase:
  1. ADD_POI_STATUS_COLUMN.sql
  2. FIX_POI_COLUMNS.sql
  3. FIX_ADMIN_DELETE_POI.sql

---

## 📚 Dokumentacja:

Jeśli chcesz więcej szczegółów:
- `MARKERY_MAPY_AUTO_REFRESH.md` - Pełna dokumentacja techniczna
- `FINAL_FIX_WSZYSTKO.md` - Kompletna instrukcja wszystkich napraw

---

## ✅ Powinno Działać:

Po wyczyszczeniu cache:
- ✅ Markery pokazują się przy ładowaniu strony
- ✅ Nowe POI → marker pojawia się auto
- ✅ Status Draft → marker znika auto
- ✅ Usuwanie POI → marker znika auto
- ✅ Bez konieczności odświeżania strony!

---

**Czas:** 2 minuty (wyczyść cache + test)  
**Status:** ✅ Ready to use!

**Gotowe! 🎉**
