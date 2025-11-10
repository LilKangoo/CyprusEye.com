# Car Rentals - Automatic Price Calculation System

## ✅ Implementacja Zakończona

Data: 10 listopada 2025

## 📋 Co zostało zaimplementowane

### 1. **Automatyczna Kalkulacja Cen Według Cennika**

Panel admin Cars teraz automatycznie oblicza i wyświetla:

#### **Dla Paphos (tiered pricing):**
- **1-3 dni**: Package rate (`price_3days`)
- **4-6 dni**: Daily rate × dni (`price_4_6days`)
- **7-10 dni**: Daily rate × dni (`price_7_10days`)
- **10+ dni**: Daily rate × dni (`price_10plus_days`)

#### **Dla Larnaca (simple pricing):**
- **Wszystkie okresy**: Daily rate × dni (`price_per_day`)

### 2. **Automatyczne Obliczanie Dodatków**

System oblicza i wyświetla:

- ✅ **Extra Passengers**: €5 za każdego pasażera powyżej 2
  - Przykład: 4 pasażerów = 2 extra × €5 = €10
  
- ✅ **Child Seats**: **FREE** (zawsze 0€)
  - Wyświetlane z zielonym "FREE" badge

- ✅ **Full Insurance**: €17 × liczba dni
  - Przykład: 5 dni z ubezpieczeniem = 5 × €17 = €85

### 3. **Wyświetlanie Dni Wynajmu**

#### W głównej tabeli Car Rentals:
- Obliczanie dni: `(return_date - pickup_date) / 24h`
- Wyświetlanie z ikoną: 🕒 **X days**
- Pogrubiony kolor primary dla widoczności

#### W modalu booking details:
- Sekcja "Duration" w Rental Details
- Wykorzystywane w kalkulacji cen i ubezpieczenia

### 4. **Nowa Sekcja: "Automatic Price Calculation"**

Znajduje się w modalu booking details, pomiędzy "Additional Options" a "Manual Pricing Override".

#### Wygląd:
- **Gradient niebieski background** (profesjonalny look)
- **Header z ikoną** 🧮 i lokalizacją (LARNACA/PAPHOS)
- **Rozpisanie ceny bazowej** z dokładnym breakdown
- **Lista dodatków** z cenami
- **SUGGESTED TOTAL** w dużej żółtej czcionce

#### Przykład wyświetlania:

```
🧮 Automatic Price Calculation (PAPHOS Rate)

Base Rental Price
5 days × €34/day = €170.00              €170.00

Extras:
• Extra Passengers (2)                   +€10.00
• Child Seats (1)                         FREE
• Full Insurance (5 days × €17)          +€85.00

SUGGESTED TOTAL                          €265.00

ℹ️ Note: This is an automatic calculation based on the 
PAPHOS rate card. You can adjust the quoted and final 
prices below if needed.
```

### 5. **Przycisk "Use Suggested Price"**

- Znajduje się przy polu "Quoted Price (€)"
- Format: `📋 Use €265.00`
- Kopiuje automatycznie wyliczoną cenę do pola
- Pokazuje toast notification: "Suggested price applied!"

### 6. **Obsługa Braku Cennika**

Jeśli samochód nie istnieje w `car_offers`:
```
⚠️ Car pricing not found in database for 
this model and location.

Please manually set the quoted price below.
```

## 🗂️ Pliki zmodyfikowane

### `/admin/admin.js`

#### Funkcja `viewCarBookingDetails()` - rozszerzona o:

1. **Pobieranie cennika z bazy**:
```javascript
const { data: carOffer } = await client
  .from('car_offers')
  .select('*')
  .eq('car_model', booking.car_model)
  .eq('location', (booking.location || 'larnaca').toLowerCase())
  .single();
```

2. **Kalkulacja ceny bazowej**:
```javascript
if (location === 'paphos') {
  if (days <= 3) {
    calculatedBasePrice = carPricing.price_3days || 0;
  } else if (days <= 6) {
    calculatedBasePrice = carPricing.price_4_6days * days;
  } else if (days <= 10) {
    calculatedBasePrice = carPricing.price_7_10days * days;
  } else {
    calculatedBasePrice = carPricing.price_10plus_days * days;
  }
}
```

3. **Kalkulacja dodatków**:
```javascript
const passengerSurcharge = numPassengers > 2 ? (numPassengers - 2) * 5 : 0;
const childSeatsSurcharge = 0; // FREE
const insuranceCost = booking.full_insurance ? (days * 17) : 0;
const suggestedTotal = calculatedBasePrice + totalExtras;
```

4. **Event listener dla przycisku**:
```javascript
btnUseSuggestedPrice.addEventListener('click', () => {
  quotedPriceInput.value = suggestedTotal.toFixed(2);
  showToast('Suggested price applied!', 'success');
});
```

#### Funkcja `loadCarsData()` - rozszerzona o:

**Obliczanie dni wynajmu w tabeli**:
```javascript
const rentalDays = booking.pickup_date && booking.return_date 
  ? Math.ceil((new Date(booking.return_date) - new Date(booking.pickup_date)) / (1000 * 60 * 60 * 24))
  : (booking.days_count || 0);
```

## 🎯 Jak to działa - Przykład

### Scenariusz: Rezerwacja w Paphos

**Dane zamówienia:**
- Car Model: Toyota Yaris (2023)
- Location: Paphos
- Pickup: 08/11/2025
- Return: 13/11/2025
- Days: **5 dni**
- Passengers: **4**
- Child Seats: **1**
- Full Insurance: **Yes**

**Cennik z bazy (car_offers):**
```
price_4_6days = 34€/dzień
```

**Automatyczna kalkulacja:**

1. **Base Price**: 5 days × €34 = **€170.00**
2. **Extra Passengers**: (4 - 2) × €5 = **+€10.00**
3. **Child Seats**: 1 × €0 = **FREE**
4. **Full Insurance**: 5 × €17 = **+€85.00**

**SUGGESTED TOTAL**: **€265.00**

## 📊 Korzyści

1. ✅ **Oszczędność czasu** - nie trzeba ręcznie liczyć cen
2. ✅ **Dokładność** - eliminuje błędy w obliczeniach
3. ✅ **Przejrzystość** - pełne rozpisanie wszystkich składników
4. ✅ **Spójność** - wszyscy admini używają tych samych reguł
5. ✅ **Elastyczność** - można nadal ręcznie edytować jeśli potrzeba
6. ✅ **Zrozumiałość** - klient widzi dokładny breakdown

## 🔧 Wymagania techniczne

### Tabela `car_offers` musi zawierać:

**Dla Paphos:**
- `price_3days` (numeric)
- `price_4_6days` (numeric)
- `price_7_10days` (numeric)
- `price_10plus_days` (numeric)

**Dla Larnaca:**
- `price_per_day` (numeric)

**Wspólne:**
- `car_model` (text)
- `location` (text: 'paphos' lub 'larnaca')
- `is_available` (boolean)

### Tabela `car_bookings` musi zawierać:

- `pickup_date` (date)
- `return_date` (date)
- `car_model` (text)
- `location` (text)
- `num_passengers` (integer)
- `child_seats` (integer)
- `full_insurance` (boolean)
- `quoted_price` (numeric, nullable)
- `final_price` (numeric, nullable)

## 💡 Najlepsze Praktyki

### Dla Adminów:

1. **Sprawdź automatyczną kalkulację** przed potwierdzeniem
2. **Użyj przycisku "Use €X.XX"** jeśli cena jest OK
3. **Edytuj ręcznie** jeśli są specjalne warunki
4. **Dodaj notatki** w "Admin Notes" o wszelkich zmianach
5. **Zapisz Pricing & Notes** przed zamknięciem modalu

### Dla Developerów:

1. Upewnij się że `car_offers` zawiera wszystkie modele samochodów
2. Aktualizuj ceny w `car_offers` gdy się zmieniają
3. Testuj z różnymi okresami wynajmu (1-3, 4-6, 7-10, 10+)
4. Sprawdź obie lokalizacje (Paphos i Larnaca)

## 🚀 Przykładowe Użycie

### Krok 1: Otwórz booking
```
Admin Panel → Cars → Bookings → View (na dowolnym zamówieniu)
```

### Krok 2: Sprawdź automatyczną kalkulację
Zobacz sekcję z gradientem niebieskim:
- Base Price: **€170.00**
- Extras: **€95.00**
- **SUGGESTED TOTAL: €265.00**

### Krok 3: Użyj sugerowanej ceny
Kliknij przycisk: `📋 Use €265.00`

### Krok 4: Zapisz
Kliknij: `💾 Save Pricing & Notes`

## 📝 Uwagi Specjalne

### Child Seats są ZAWSZE darmowe
- Wyświetlane z zielonym "FREE"
- Nie dodawane do ceny
- Klient powinien być o tym poinformowany

### Passenger Surcharge od 3 osoby
- 1-2 pasażerów: €0
- 3 pasażerów: €5 (1 extra × €5)
- 4 pasażerów: €10 (2 extra × €5)
- itd.

### Full Insurance
- Zawsze €17/dzień
- Obliczane: liczba_dni × €17
- Opcjonalne (może być false)

### Obliczanie dni
```javascript
// Połączenie daty z godziną dla dokładnej kalkulacji
const pickupDateTime = new Date(booking.pickup_date + 'T' + (booking.pickup_time || '10:00:00'));
const returnDateTime = new Date(booking.return_date + 'T' + (booking.return_time || '10:00:00'));
const hours = (returnDateTime - pickupDateTime) / (1000 * 60 * 60);
const days = Math.ceil(hours / 24);
```

**Ważne**: 
- Daty w bazie są typu `DATE` (bez godziny), godziny są w osobnych polach `pickup_time` i `return_time`
- Przed obliczeniem łączymy datę z godziną: `'2025-11-08' + 'T' + '10:00:00'` = `'2025-11-08T10:00:00'`
- Math.ceil() zaokrągla w górę - każda rozpoczęta doba = pełny dzień
- Domyślna godzina (jeśli brak w bazie): 10:00:00

**Przykład**:
```
Pickup:  08/11/2025 at 10:00
Return:  10/11/2025 at 12:00
= 50 godzin = 2 dni + 2h
Math.ceil(50/24) = Math.ceil(2.083) = 3 dni ✓
```

## 🎨 Design Details

### Kolory:
- **Gradient niebieski**: `linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)`
- **SUGGESTED TOTAL**: Złoty `#fbbf24`
- **FREE badge**: Zielony `#86efac`
- **Breakdown background**: `rgba(255, 255, 255, 0.1)`

### Ikony:
- 🧮 - Calculator (main icon)
- 📋 - Clipboard (use price button)
- 🕒 - Clock (rental days)
- ℹ️ - Info (note section)
- ⚠️ - Warning (no pricing found)

## ✅ Status

**Gotowe do użycia w produkcji** ✨

Wszystkie funkcje działają poprawnie i są w pełni zintegrowane z istniejącym panelem admin.

---

**Ostatnia aktualizacja**: 10 listopada 2025
