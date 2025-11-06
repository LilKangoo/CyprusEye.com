# Test Car Availability Feature

## Co zostało naprawione:

### 1. **Kolory Dropdown** 
- ✅ Kolumna `is_available` **już istnieje** w bazie (boolean, default: true)
- ✅ **Zielone tło (#d1fae5)** + ciemnozielony tekst (#065f46) dla "Available"
- ✅ **Czerwone tło (#fee2e2)** + ciemnoczerwony tekst (#991b1b) dla "Not Available"
- ✅ Wyraźne ramki (2px) w kolorze zielonym (#10b981) lub czerwonym (#ef4444)
- ✅ Min width 140px dla czytelności

### 2. **Event Listener**
- ✅ Funkcje przeniesione PRZED `loadFleetData()` (linia 1811-1842)
- ✅ Event listener dodawany po każdym załadowaniu danych (linia 1963)
- ✅ Dodatkowe wywołanie w `switchCarsTab` z timeoutem (linia 2512)
- ✅ Event delegation na `#fleetTableBody` zamiast całego `document`

### 3. **Debugging**
- ✅ Console.log na każdym etapie (emoji do łatwego rozpoznania)
- ✅ Sprawdzanie czy element istnieje przed podpięciem listenera
- ✅ Logowanie każdej zmiany dropdown'a

## Jak przetestować:

### Krok 1: Hard Refresh
```
Mac: Cmd + Shift + R
Windows/Linux: Ctrl + Shift + R
```

### Krok 2: Otwórz Console (F12)

### Krok 3: Idź do Admin Panel → Cars → Fleet Management

W konsoli powinieneś zobaczyć:
```
Loading fleet data...
Loaded X cars
🔧 Setting up fleet event listeners...
✅ Event listener attached to fleetTableBody
✅ Fleet event listeners initialized
```

### Krok 4: Kliknij na dropdown i zmień wartość

W konsoli powinieneś zobaczyć:
```
🎯 Change event detected on: <select class="car-availability-select"...>
🔄 Availability dropdown changed: {carId: "uuid...", newValue: "false", element: select}
toggleCarAvailability called: {carId: "uuid...", isAvailable: "false"}
Updating car availability: {carId: "uuid...", availableBoolean: false}
```

### Krok 5: Po zapisie:
- ✅ Toast: "✗ Car hidden from site"
- ✅ Dropdown zmienia kolor z zielonego na czerwony
- ✅ Tabela się odświeża automatycznie

### Krok 6: Sprawdź stronę publiczną Paphos
```
/public/auto-paphos.html
```
Auto powinno zniknąć z listy (lub pojawić się gdy zmienisz na Available)

## Jeśli nadal nie działa:

### Scenariusz A: Brak logów "🎯 Change event detected"
- Problem: Event listener się nie podpina
- Rozwiązanie: Sprawdź czy w konsoli jest "✅ Event listener attached to fleetTableBody"
- Jeśli nie ma: przeładuj stronę, upewnij się że jesteś w zakładce Fleet Management

### Scenariusz B: Są logi, ale dropdown wraca do poprzedniej wartości
- Problem: Supabase zwraca błąd lub nie ma uprawnień
- Rozwiązanie: Sprawdź logi "Supabase error:" i RLS policies

### Scenariusz C: Dropdown nie zmienia koloru
- Problem: Przeglądarka nie obsługuje inline styles
- Rozwiązanie: Zaktualizuj przeglądarkę lub użyj Chrome/Firefox

## Struktura bazy danych:

Tabela `car_offers` **już ma** kolumnę:
```sql
is_available boolean DEFAULT true
```

Publiczny dostęp filtruje po tej kolumnie:
```sql
-- RLS Policy w migrations/001_car_rentals_system.sql
CREATE POLICY "Anyone can view available car offers" 
ON car_offers FOR SELECT 
USING (is_available = true);
```

**NIE TRZEBA DODAWAĆ ŻADNYCH KOLUMN!** Wszystko już jest w bazie.

## Kod - kluczowe fragmenty:

### Dropdown (admin.js line ~1930):
```javascript
<select 
  class="car-availability-select" 
  style="padding: 8px 12px; font-size: 13px; font-weight: 600; 
         background-color: ${car.is_available ? '#d1fae5' : '#fee2e2'};
         color: ${car.is_available ? '#065f46' : '#991b1b'};"
  data-car-id="${car.id}"
>
  <option value="true">✓ Available</option>
  <option value="false">✗ Not Available</option>
</select>
```

### Event Handler (admin.js line ~1828):
```javascript
function handleAvailabilityChange(e) {
  if (e.target && e.target.classList.contains('car-availability-select')) {
    const carId = e.target.dataset.carId;
    const newValue = e.target.value;
    toggleCarAvailability(carId, newValue);
  }
}
```

### Supabase Update (admin.js line ~2125):
```javascript
async function toggleCarAvailability(carId, isAvailable) {
  const availableBoolean = typeof isAvailable === 'string' 
    ? isAvailable === 'true' 
    : !!isAvailable;
    
  await client
    .from('car_offers')
    .update({ is_available: availableBoolean }, { returning: 'minimal' })
    .eq('id', carId);
    
  await loadFleetData(); // Refresh table
}
```

## Gotowe do testu! 🚀
