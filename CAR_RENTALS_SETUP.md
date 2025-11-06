# Car Rentals System - Setup Guide

## 🚗 Przegląd Systemu

System wynajmu samochodów z obsługą dwóch lokalizacji: **Paphos** i **Larnaca**.

### Funkcje:
- ✅ Zarządzanie ofertami samochodów (admin)
- ✅ Rezerwacje klientów
- ✅ Tracking statusów (pending, confirmed, active, completed, cancelled)
- ✅ Tracking płatności
- ✅ Statystyki i raporty
- ✅ Różne lokalizacje odbioru/zwrotu
- ✅ Integracja Stripe (opcjonalnie)

## 📋 Instalacja w Supabase

### Krok 1: Uruchom Migrację SQL

1. Zaloguj się do **Supabase Dashboard**
2. Przejdź do **SQL Editor**
3. Otwórz plik: `supabase/migrations/001_car_rentals_system.sql`
4. Skopiuj cały kod i wklej do SQL Editor
5. Kliknij **RUN** lub naciśnij `Cmd/Ctrl + Enter`

### Krok 2: Sprawdź Tabele

Po uruchomieniu migracji powinieneś mieć:

#### Tabele:
- `car_offers` - Oferty samochodów zarządzane przez admina
- `car_bookings` - Rezerwacje klientów

#### Funkcje:
- `admin_get_car_booking_stats()` - Statystyki rezerwacji
- `admin_update_booking_status()` - Aktualizacja statusu
- `check_car_availability()` - Sprawdzanie dostępności

### Krok 3: Sprawdź Przykładowe Dane

Migracja automatycznie dodaje przykładowe oferty:

**Paphos:**
- Economy (Toyota Yaris) - €25/dzień
- Compact (Nissan Micra) - €30/dzień
- SUV (Nissan Qashqai) - €55/dzień
- Luxury (Mercedes C-Class) - €85/dzień

**Larnaca:**
- Economy (Hyundai i10) - €23/dzień
- Compact (Peugeot 208) - €28/dzień
- SUV (Toyota RAV4 Hybrid) - €60/dzień
- Minivan (Opel Zafira) - €65/dzień

## 🔧 Konfiguracja Admin Panel

### Problem: Nie widzę karty "Cars" w panelu

**Rozwiązanie:**

1. **Wyczyść Cache Cloudflare:**
   - Zaloguj się do Cloudflare Dashboard
   - Przejdź do swojej domeny
   - Caching → Purge Everything

2. **Wyczyść Cache przeglądarki:**
   - Chrome/Edge: `Ctrl + Shift + R` (Windows) lub `Cmd + Shift + R` (Mac)
   - Firefox: `Ctrl + F5` (Windows) lub `Cmd + Shift + R` (Mac)

3. **Sprawdź wdrożenie:**
   ```bash
   # Jeśli używasz Git:
   git status
   git add .
   git commit -m "Add Cars section to admin panel"
   git push
   ```

4. **Rebuild na Cloudflare:**
   - Jeśli używasz Cloudflare Pages, odbuduj deployment

## 📊 Struktura Danych

### car_offers (Oferty)

```sql
{
  id: uuid,
  location: 'paphos' | 'larnaca',
  car_type: 'Economy' | 'Compact' | 'SUV' | 'Luxury' | 'Minivan',
  car_model: string,
  price_per_day: decimal,
  features: jsonb[], -- ['AC', 'GPS', 'Automatic', ...]
  transmission: 'manual' | 'automatic',
  fuel_type: 'petrol' | 'diesel' | 'electric' | 'hybrid',
  is_available: boolean,
  stock_count: integer,
  deposit_amount: decimal,
  insurance_per_day: decimal
}
```

### car_bookings (Rezerwacje)

```sql
{
  id: uuid,
  offer_id: uuid,
  customer_name: string,
  customer_email: string,
  customer_phone: string,
  pickup_location: 'paphos' | 'larnaca',
  return_location: 'paphos' | 'larnaca',
  pickup_date: date,
  return_date: date,
  days_count: integer,
  total_price: decimal,
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled',
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded',
  admin_notes: text
}
```

## 🔐 Bezpieczeństwo (RLS)

System używa Row Level Security:

- ✅ **Publiczny dostęp:** Odczyt dostępnych ofert
- ✅ **Zalogowani:** Własne rezerwacje
- ✅ **Admini:** Pełny dostęp do wszystkiego

## 📈 Statystyki (Dashboard)

Admin panel pokazuje:

1. **Total Bookings** - Wszystkie rezerwacje
2. **Active Rentals** - Aktywne wypożyczenia (confirmed + active)
3. **Pending** - Oczekujące potwierdzenia
4. **Revenue** - Całkowity przychód (tylko opłacone)

## 🎯 Workflow Statusów

```
pending → confirmed → active → completed
   ↓          ↓          ↓
cancelled  cancelled  cancelled
```

- `pending` - Nowa rezerwacja
- `confirmed` - Potwierdzona przez admina
- `active` - Klient odebrał samochód
- `completed` - Zakończona, samochód zwrócony
- `cancelled` - Anulowana
- `no_show` - Klient się nie pojawił

## 🚀 Następne Kroki

Po uruchomieniu migracji możesz:

1. ✅ Zobaczyć kartę "Cars" w admin panel
2. ✅ Przeglądać przykładowe oferty
3. ✅ Edytować oferty dla Paphos i Larnaca
4. ✅ Zarządzać rezerwacjami klientów
5. ⏳ Dodać formularz rezerwacji dla klientów (frontend)
6. ⏳ Integracja z Stripe dla płatności
7. ⏳ Email notifications dla klientów

## 📞 Potrzebujesz Pomocy?

Jeśli coś nie działa:
1. Sprawdź console przeglądarki (F12)
2. Sprawdź logi Supabase
3. Upewnij się, że jesteś zalogowany jako admin (`is_admin = true`)

---

**Gotowe!** System car rentals jest teraz zainstalowany i gotowy do użycia.
