# FIX: Hotels Date Fields Validation Error

## Problem
Pola dat w formularzu hoteli pokazują błąd: **"Please fill in this field"**

## Root Cause
**Hotels HTML (błąd):**
```html
<input type="date" name="arrival_date" id="arrivalDate" required min="" />
<input type="date" name="departure_date" id="departureDate" required min="" />
```

❌ **Pusty atrybut `min=""`** powoduje, że HTML5 uważa datę za nieprawidłową!

## Working Implementation (TRIPS)
**Trips HTML (działa):**
```html
<input type="date" id="arrivalDate" name="arrival_date" required />
<input type="date" id="departureDate" name="departure_date" required />
```

✅ **Brak `min`** w HTML - ustawiany dynamicznie przez JS

## Solution
Usuń puste `min=""` z pól dat w hotels HTML. JS ustawi `min` dynamicznie przy otwarciu modala.

**home-hotels.js już ma kod:**
```javascript
// Linia 306-310
const today = new Date().toISOString().split('T')[0];
const arrivalEl = document.getElementById('arrivalDate');
const departureEl = document.getElementById('departureDate');
if (arrivalEl) arrivalEl.min = today;
if (departureEl) departureEl.min = today;
```

## Fix
Zmień w `index.html`:
```diff
- <input type="date" name="arrival_date" id="arrivalDate" required min="" />
+ <input type="date" name="arrival_date" id="arrivalDate" required />

- <input type="date" name="departure_date" id="departureDate" required min="" />
+ <input type="date" name="departure_date" id="departureDate" required />
```

---

**Status:** Gotowe do naprawy
