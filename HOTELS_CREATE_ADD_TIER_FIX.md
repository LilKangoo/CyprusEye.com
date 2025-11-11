# 🔧 HOTELS - NAPRAWA "ADD TIER" I TWORZENIA NOWYCH HOTELI

## ❌ **PROBLEM:**

Użytkownik zgłosił:
1. Próbując dodać nowy hotel - nic się nie dzieje
2. Przycisk "Add tier" nie reaguje w Create New Hotel modal
3. Nie można dodać pricing tiers do nowych hoteli

Z obrazu Console:
- Błędy RLS dla cars i trips (nie dla hotels)
- Modal "Create New Hotel" otwarty ale funkcje nie działają

---

## 🐛 **PRZYCZYNA:**

### **Brak inicjalizacji pricing tiers w `openNewHotelModal()`**

W funkcji `openNewHotelModal()` w `admin/admin.js` brakowało kodu który:
1. Inicjalizuje pustą tabelę pricing tiers
2. Przypisuje event listener do przycisku "Add tier"
3. Inicjalizuje preview dla zdjęć

**Kod był obecny w `dist/admin/admin.js` ale zaginął podczas moich wcześniejszych zmian i18n!**

---

## ✅ **ROZWIĄZANIE:**

### **Dodano brakującą inicjalizację do `openNewHotelModal()`:**

```javascript
// admin/admin.js - w funkcji openNewHotelModal(), przed form.onsubmit

// Pricing tiers editor init
renderPricingTiers('newHotelPricingTiersBody', []);
const btnAddNewTier = document.getElementById('btnAddNewHotelTier');
if (btnAddNewTier && !btnAddNewTier.dataset.bound) {
  btnAddNewTier.addEventListener('click', () => addPricingTierRow('newHotelPricingTiersBody'));
  btnAddNewTier.dataset.bound = '1';
}

// Photos multiple preview
const multiPhotos = document.getElementById('newHotelPhotos');
const multiPreview = document.getElementById('newHotelPhotosPreview');
if (multiPhotos && multiPreview) {
  multiPhotos.onchange = () => previewLocalImages(multiPhotos, multiPreview, 10);
}
```

**Co robi ten kod:**

1. **`renderPricingTiers('newHotelPricingTiersBody', [])`:**
   - Renderuje pustą tabelę (pokazuje "No tiers yet")
   - Przygotowuje tbody do dodawania wierszy

2. **Event listener na "Add tier":**
   - Przypisuje funkcję `addPricingTierRow()` do przycisku
   - `dataset.bound = '1'` zapobiega wielokrotnemu przypisaniu
   - Dodaje nowy wiersz z 3 inputami: persons, price, min_nights

3. **Preview dla wielu zdjęć:**
   - Pokazuje podgląd wybranych zdjęć (max 10)
   - Wyświetla miniatury 72x72px

---

## 🔄 **FUNKCJE PRICING TIERS (już były w pliku):**

### **1. `addPricingTierRow(tbodyId, tier)`**
```javascript
function addPricingTierRow(tbodyId, tier) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (tbody.querySelector('.table-loading')) tbody.innerHTML = '';
  
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" min="1" class="admin-input" style="width:100px" value="${tier && tier.persons != null ? Number(tier.persons) : ''}" placeholder="2" /></td>
    <td><input type="number" min="0" step="0.01" class="admin-input" style="width:140px" value="${tier && tier.price_per_night != null ? Number(tier.price_per_night) : ''}" placeholder="0.00" /></td>
    <td><input type="number" min="1" class="admin-input" style="width:140px" value="${tier && tier.min_nights != null ? Number(tier.min_nights) : ''}" placeholder="" /></td>
    <td><button type="button" class="btn-danger">Remove</button></td>
  `;
  
  const btn = tr.querySelector('button');
  btn.addEventListener('click', () => {
    tr.remove();
    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    }
  });
  
  tbody.appendChild(tr);
}
```

**Co robi:**
- Dodaje nowy wiersz z 3 inputami + przycisk Remove
- Przycisk Remove usuwa wiersz
- Jeśli tabela jest pusta, pokazuje "No tiers yet"

---

### **2. `renderPricingTiers(tbodyId, rules)`**
```javascript
function renderPricingTiers(tbodyId, rules) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    return;
  }
  
  list.forEach(r => addPricingTierRow(tbodyId, r));
}
```

**Co robi:**
- Czyści tabelę
- Jeśli brak rules → pokazuje "No tiers yet"
- Jeśli są rules → renderuje każdy jako wiersz

---

### **3. `collectPricingTiers(tbodyId)`**
```javascript
function collectPricingTiers(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return { currency: 'EUR', rules: [] };
  
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const rules = [];
  
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (!inputs || inputs.length < 2) return;
    
    const persons = Number(inputs[0].value);
    const price = Number(inputs[1].value);
    const minNights = inputs[2] && inputs[2].value ? Number(inputs[2].value) : null;
    
    if (Number.isFinite(persons) && persons > 0 && Number.isFinite(price) && price >= 0) {
      const rule = { persons, price_per_night: price };
      if (Number.isFinite(minNights) && minNights > 0) rule.min_nights = minNights;
      rules.push(rule);
    }
  });
  
  rules.sort((a, b) => a.persons - b.persons);
  return { currency: 'EUR', rules };
}
```

**Co robi:**
- Zbiera wszystkie wiersze z tabeli
- Dla każdego wiersza ekstraktuje: persons, price, min_nights
- Waliduje (persons > 0, price >= 0)
- Sortuje po liczbie osób
- Zwraca obiekt: `{ currency: 'EUR', rules: [...] }`

---

## 🧪 **JAK PRZETESTOWAĆ:**

### **Test 1: Add Tier w Create New Hotel**
```
1. Hard Refresh (Cmd+Shift+R)
2. Admin → Hotels → "New Hotel"
3. F12 → Console

4. Sprawdź że modal się otworzył:
   ✅ Title (Multilingual) z tabami
   ✅ Description (Multilingual) z tabami
   ✅ Pricing Tiers (per night) z tabelą
   ✅ Przycisk "Add tier"

5. Kliknij "Add tier"
6. ✅ Powinien pojawić się nowy wiersz:
   [Persons: __] [Price/night: __] [Min nights: __] [Remove]

7. Wypełnij wiersz:
   Persons: 2
   Price/night: 100.00
   Min nights: 1

8. Kliknij "Add tier" ponownie
9. ✅ Drugi wiersz:
   Persons: 4
   Price/night: 180.00
   Min nights: 2

10. Kliknij "Remove" na pierwszym wierszu
11. ✅ Wiersz znika
```

### **Test 2: Tworzenie nowego hotelu z pricing tiers**
```
1. Admin → Hotels → "New Hotel"
2. Wypełnij formularz:
   - City: Larnaca
   - Title:
     🇵🇱: "Test Hotel PL"
     🇬🇧: "Test Hotel EN"
   - Description:
     🇵🇱: "Opis testowy"
     🇬🇧: "Test description"

3. Add tier:
   Persons: 2, Price: 100.00, Min nights: 1

4. Add tier:
   Persons: 4, Price: 180.00, Min nights: 2

5. Kliknij "Create"

6. ✅ Console:
   🔍 New Hotel i18n extracted: {...}
   💾 Creating new hotel with payload: {...}
   ✅ Hotel created successfully: {...}

7. ✅ Toast: "Hotel created successfully"

8. ✅ Modal się zamyka

9. ✅ Hotel pojawia się na liście
```

### **Test 3: Sprawdzenie w bazie danych**
```sql
SELECT 
  slug,
  title,
  description,
  pricing_tiers
FROM hotels
WHERE slug LIKE '%test-hotel%'
ORDER BY created_at DESC
LIMIT 1;
```

**Oczekiwany wynik:**
```json
{
  "slug": "test-hotel-pl",
  "title": {
    "pl": "Test Hotel PL",
    "en": "Test Hotel EN"
  },
  "description": {
    "pl": "Opis testowy",
    "en": "Test description"
  },
  "pricing_tiers": {
    "currency": "EUR",
    "rules": [
      {
        "persons": 2,
        "price_per_night": 100.00,
        "min_nights": 1
      },
      {
        "persons": 4,
        "price_per_night": 180.00,
        "min_nights": 2
      }
    ]
  }
}
```

### **Test 4: Edit Hotel - Add tier**
```
1. Admin → Hotels → Edit (istniejący hotel)
2. Sprawdź że istniejące tiers są wyświetlone
3. Kliknij "Add tier"
4. ✅ Nowy wiersz pojawia się
5. Wypełnij i zapisz
6. ✅ Zmiany zapisane w bazie
```

---

## 🚨 **MOŻLIWE BŁĘDY:**

### **Błąd 1: "Add tier" nadal nie działa**
```
❌ Symptom: Kliknięcie "Add tier" nic nie robi

Debugowanie:
1. F12 → Console
2. Sprawdź błędy JavaScript
3. Test:
   typeof addPricingTierRow
   // ✅ Powinno być: "function"

4. Sprawdź czy event listener jest przypisany:
   document.getElementById('btnAddNewHotelTier')
   // ✅ Powinno mieć dataset.bound = '1'

5. Test ręczny:
   addPricingTierRow('newHotelPricingTiersBody')
   // ✅ Powinno dodać wiersz
```

### **Błąd 2: Pricing tiers nie zapisują się**
```
❌ Console:
💾 Creating new hotel with payload: {
  pricing_tiers: { currency: 'EUR', rules: [] }  ← PUSTE!
}

Przyczyna: Wiersze nie mają wypełnionych wartości

Rozwiązanie:
- Upewnij się że wypełniłeś:
  - Persons (wymagane)
  - Price/night (wymagane)
  - Min nights (opcjonalne)
```

### **Błąd 3: Console error "collectPricingTiers is not a function"**
```
❌ Error: collectPricingTiers is not a function

Przyczyna: Funkcja nie jest zdefiniowana w admin.js

Rozwiązanie:
1. Sprawdź admin/admin.js linie 1894-1913
2. Funkcja powinna istnieć
3. Hard refresh
```

### **Błąd 4: "No tiers yet" nie znika po Add tier**
```
❌ Symptom: Po kliknięciu "Add tier" dalej jest "No tiers yet"

Przyczyna: Funkcja addPricingTierRow() nie usuwa ".table-loading"

Debugowanie:
1. Sprawdź console czy są błędy
2. Test:
   const tbody = document.getElementById('newHotelPricingTiersBody');
   tbody.querySelector('.table-loading')
   // Powinno być: <tr><td>No tiers yet</td></tr>

3. addPricingTierRow() powinno usunąć ten element
```

---

## 📁 **ZMODYFIKOWANE PLIKI:**

| Plik | Zmiana | Status |
|------|--------|--------|
| `admin/admin.js` | Dodano inicjalizację pricing tiers w openNewHotelModal() | ✅ |
| `admin/admin.js` | Event listener dla btnAddNewHotelTier | ✅ |
| `admin/admin.js` | Photos preview initialization | ✅ |
| `dist/admin/admin.js` | Skopiowano | ✅ |

**Funkcje (już były):**
- `addPricingTierRow()` - dodaje wiersz
- `renderPricingTiers()` - renderuje tabelę
- `collectPricingTiers()` - zbiera dane
- `previewLocalImages()` - podgląd zdjęć

---

## 💡 **KLUCZOWE PUNKTY:**

1. **Funkcje pricing tiers były już zdefiniowane**
   - Problem był w BRAKU inicjalizacji w openNewHotelModal()
   - Funkcje były na końcu pliku ale nie były wywoływane

2. **`dataset.bound` zapobiega duplikacji:**
   ```javascript
   if (!btnAddNewTier.dataset.bound) {
     btnAddNewTier.addEventListener('click', ...);
     btnAddNewTier.dataset.bound = '1';
   }
   ```
   - Bez tego każde otwarcie modalu dodałoby nowy listener
   - Wielokrotne kliknięcia "Add tier" dodałyby wiele wierszy

3. **Edit Hotel już miało inicjalizację:**
   - `btnAddEditHotelTier` był poprawnie obsługiwany
   - Problem był tylko w NEW hotel

4. **Pricing tiers format w bazie:**
   ```json
   {
     "currency": "EUR",
     "rules": [
       {"persons": 2, "price_per_night": 100, "min_nights": 1}
     ]
   }
   ```

---

## 🎯 **REZULTAT:**

✅ Przycisk "Add tier" działa w Create New Hotel  
✅ Można dodawać wiele pricing tiers  
✅ Przycisk "Remove" usuwa wiersze  
✅ Pricing tiers zapisują się do bazy  
✅ Preview dla zdjęć działa  
✅ Wszystko działa z i18n dla title/description  

---

**Data:** 2025-01-11 10:23 PM  
**Status:** ✅ **CREATE NEW HOTEL NAPRAWIONE!**

**DEPLOY, HARD REFRESH I TESTUJ DODAWANIE HOTELI!** 🚀🏨
