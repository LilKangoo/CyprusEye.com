# System Rekomendacji - Przewodnik

## 🎯 Co zostało zbudowane

Kompletny system rekomendacji dla CyprusEye, który pozwala na:
- **Zarządzanie rekomendacjami** w panelu administratora
- **Wyświetlanie rekomendacji** użytkownikom na dedykowanej stronie
- **Wielojęzyczność** (EN, EL, PL, HE, RU)
- **Śledzenie statystyk** (wyświetlenia, kliknięcia)
- **Kategorie** (zakwaterowanie, restauracje, wynajem aut, plaże, etc.)

---

## 📁 Pliki utworzone

### 1. **Backend (Supabase)**
- `supabase/migrations/027_recommendations_system.sql`
  - Tabele: `recommendation_categories`, `recommendations`, `recommendation_views`, `recommendation_clicks`
  - Funkcje, triggery, RLS policies
  - Domyślne kategorie (8 kategorii)

### 2. **Panel Administratora**
- `admin/dashboard.html` - dodano sekcję "Recommendations"
- `admin/admin.js` - moduł zarządzania rekomendacjami
- Pliki w `dist/admin/` - skopiowane dla Cloudflare

### 3. **Strona Publiczna**
- `recommendations.html` - strona z rekomendacjami
- `assets/css/recommendations.css` - style
- `js/recommendations.js` - logika
- Pliki w `dist/` - skopiowane dla Cloudflare

---

## 🚀 Jak uruchomić

### Krok 1: Uruchom migrację SQL w Supabase
1. Otwórz Supabase Dashboard
2. Przejdź do **SQL Editor**
3. Skopiuj zawartość pliku `supabase/migrations/027_recommendations_system.sql`
4. Wklej i wykonaj (Run)
5. Sprawdź czy tabele zostały utworzone

### Krok 2: Sprawdź kategorie
W Supabase powinno być automatycznie utworzonych 8 kategorii:
- Accommodation (Zakwaterowanie)
- Restaurants (Restauracje)
- Car Rentals (Wynajem Aut)
- Beaches (Plaże)
- Activities (Aktywności)
- Shopping (Zakupy)
- Nightlife (Życie Nocne)
- Services (Usługi)

### Krok 3: Dodaj pierwszą rekomendację
1. Zaloguj się do panelu admin: `/admin/dashboard.html`
2. Kliknij **Recommendations** w lewej nawigacji
3. Kliknij **New Recommendation**
4. Wypełnij formularz:
   - Wybierz kategorię
   - Wpisz tytuł (obowiązkowo EN)
   - Wpisz opis (obowiązkowo EN)
   - Dodaj lokalizację
   - Opcjonalnie: współrzędne GPS, zdjęcie, kod promocyjny
5. Kliknij **Save Recommendation**

### Krok 4: Zobacz rekomendacje
1. Otwórz stronę: `/recommendations.html`
2. Powinieneś zobaczyć dodane rekomendacje
3. Możesz filtrować po kategoriach
4. Kliknij na kartę aby zobaczyć szczegóły

---

## 🎨 Funkcje Panelu Admin

### Widok główny
- **Statystyki**: liczba rekomendacji, aktywnych, wyświetleń, kliknięć
- **Filtrowanie**: po kategorii, statusie, wyszukiwanie
- **Tabela**: lista wszystkich rekomendacji z możliwością edycji/usunięcia

### Formularz dodawania/edycji
**Podstawowe informacje:**
- Kategoria (lista rozwijana)
- Display Order (kolejność wyświetlania, 0 = najwyżej)
- Active (czy aktywna)
- Featured (czy wyróżniona - złota gwiazdka)

**Tytuły wielojęzyczne:**
- English (obowiązkowy)
- Greek, Polish, Hebrew, Russian (opcjonalne)

**Opisy wielojęzyczne:**
- English (obowiązkowy)
- Greek, Polish, Hebrew, Russian (opcjonalne)

**Lokalizacja:**
- Nazwa miasta (obowiązkowa)
- Latitude/Longitude (opcjonalne - dla mapy)

**Media:**
- Image URL (URL do zdjęcia)

**Linki i kontakt:**
- Google Maps URL
- Website URL
- Telefon
- Email

**Promocje:**
- Promo Code (np. "CYPRUS2024")
- Discount Text (w 5 językach)
- Special Offer Text (w 5 językach)

---

## 🌍 Funkcje Strony Publicznej

### Widok główny (`/recommendations.html`)
- **Hero banner** z tytułem
- **Filtry kategorii** (All, Accommodation, Restaurants, etc.)
- **Grid z kartami** rekomendacji
- **Karty pokazują**:
  - Zdjęcie (lub gradient jeśli brak)
  - Kategorię
  - Tytuł i lokalizację
  - Opis (skrócony)
  - Kod promocyjny (jeśli jest)
  - Przyciski: Map, Website

### Modal ze szczegółami
Po kliknięciu na kartę otwiera się modal z:
- Pełnym zdjęciem
- Kompletnym opisem
- Special Offer (jeśli jest)
- Kodem promocyjnym (jeśli jest)
- Przyciskami akcji
- Mapą (jeśli podano współrzędne)

### Śledzenie statystyk
System automatycznie śledzi:
- **Wyświetlenia**: gdy użytkownik zobaczy rekomendację
- **Kliknięcia**: gdy użytkownik kliknie link (map, website, phone)

---

## 📊 Struktura bazy danych

### `recommendation_categories`
Kategorie rekomendacji z tłumaczeniami

### `recommendations`
Główna tabela z rekomendacjami, zawiera:
- Podstawowe info (kategoria, kolejność, status)
- Wielojęzyczne tytuły i opisy
- Lokalizacja (nazwa + GPS)
- Media (obrazy)
- Kontakt (linki, telefon, email)
- Promocje (kod, zniżka, oferta specjalna)
- Statystyki (view_count, click_count)

### `recommendation_views`
Śledzenie wyświetleń rekomendacji

### `recommendation_clicks`
Śledzenie kliknięć (typ: google, website, phone, promo)

---

## 🔐 Bezpieczeństwo (RLS)

**Dla admina:**
- Pełny dostęp do wszystkich tabel

**Dla użytkowników:**
- Odczyt aktywnych rekomendacji i kategorii
- Dodawanie własnych wyświetleń i kliknięć

---

## 🎯 Kolejne kroki (opcjonalne)

### 1. Integracja z mapą główną
W pliku `index.html` lub `map.js` możesz dodać:
- Pobieranie rekomendacji z Supabase
- Wyświetlanie ich jako specjalne znaczniki (np. gwiazdki)
- Inny kolor/ikona niż zwykłe POI

### 2. Dodanie kategorii
W panelu admin możesz zarządzać kategoriami:
```sql
INSERT INTO recommendation_categories (name_en, name_el, name_pl, icon, color, display_order)
VALUES ('New Category', 'Νέα Κατηγορία', 'Nowa Kategoria', 'star', '#FF0000', 10);
```

### 3. Wielojęzyczność strony
Dodaj detekcję języka użytkownika i wyświetlaj odpowiednie tłumaczenia:
```javascript
const lang = detectUserLanguage(); // 'en', 'pl', 'el', etc.
const title = rec[`title_${lang}`] || rec.title_en;
```

### 4. Upload zdjęć do Supabase Storage
Zamiast zewnętrznych URL-i, upload zdjęć bezpośrednio do Supabase:
```javascript
const { data, error } = await supabase.storage
  .from('recommendations')
  .upload(`${rec.id}.jpg`, file);
```

---

## 🐛 Troubleshooting

### Nie widzę rekomendacji w panelu admin
1. Sprawdź czy migracja SQL została wykonana
2. Sprawdź console w przeglądarce
3. Sprawdź czy jesteś zalogowany jako admin

### Nie widzę rekomendacji na stronie publicznej
1. Sprawdź czy rekomendacje są ustawione jako "Active"
2. Sprawdź console w przeglądarce
3. Sprawdź połączenie z Supabase

### Nie działają statystyki
1. Sprawdź RLS policies w Supabase
2. Sprawdź czy użytkownik ma dostęp do insert na `recommendation_views` i `recommendation_clicks`

---

## 📞 Kontakt

Jeśli masz pytania lub problemy, sprawdź:
- Console w przeglądarce (F12)
- Logi w Supabase Dashboard
- RLS policies w Supabase

---

**System gotowy do użycia! 🎉**

Możesz teraz dodawać rekomendacje przez panel admin i będą one automatycznie widoczne na `/recommendations.html`.
