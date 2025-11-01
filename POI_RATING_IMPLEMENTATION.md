# System Ocen i Społeczności dla POI - Implementacja

## ✅ Co zostało zaimplementowane

### 1. **Klient Supabase dla React Native**
- Plik: `/lib/supabase.ts`
- Funkcje:
  - `getRatingStats(poiId)` - pobiera statystyki ocen dla miejsca
  - `getUserRating(poiId)` - pobiera ocenę użytkownika
  - `ratePlace(poiId, rating)` - zapisuje ocenę (1-5 gwiazdek)

### 2. **Komponent PoiRatingCard**
- Plik: `/components/PoiRatingCard.tsx`
- Funkcjonalności:
  - ⭐ Wyświetlanie średniej oceny miejsca
  - 📊 Liczba wszystkich ocen
  - 🎯 Możliwość oceny miejsca (gwiazdki 1-5)
  - 📸 Przycisk "Zobacz społeczność" - przekierowanie do zdjęć i komentarzy
  - ❌ Przycisk zamknięcia karty

### 3. **Integracja z mapą**
- Plik: `/app/(tabs)/map/index.tsx`
- Karta oceny wyświetla się gdy:
  - Użytkownik wybierze POI na mapie (kliknięcie na marker)
  - Użytkownik przełączy POI za pomocą nawigacji (← Poprzedni / Następny →)
- Karta pojawia się nad nawigacją POI z piękną animacją

## 📦 Wymagane zależności

**MUSISZ ZAINSTALOWAĆ** następujące pakiety w projekcie:

```bash
npm install @supabase/supabase-js@^2.39.0
npm install @react-native-async-storage/async-storage@^1.21.0
npm install react-native-url-polyfill@^2.0.0
```

lub jeśli używasz yarn:

```bash
yarn add @supabase/supabase-js@^2.39.0
yarn add @react-native-async-storage/async-storage@^1.21.0
yarn add react-native-url-polyfill@^2.0.0
```

## 🗄️ Baza danych Supabase

System ocen wymaga wykonania SQL z pliku:
- `SUPABASE_POI_RATINGS_SETUP.sql`

Ten plik zawiera:
- Tabelę `poi_ratings` (oceny użytkowników)
- Widok `poi_rating_stats` (statystyki agregowane)
- Polityki RLS (Row Level Security)
- Indeksy dla wydajności

**Krok 1:** Zaloguj się do Supabase Dashboard
**Krok 2:** Przejdź do SQL Editor
**Krok 3:** Wklej i wykonaj zawartość `SUPABASE_POI_RATINGS_SETUP.sql`

## 🎨 Design i UX

### Wygląd karty oceny:
- **Biała karta** z zaokrąglonymi rogami i cieniem
- **Górna sekcja:** Nazwa POI + przycisk zamknięcia (X)
- **Średnia ocena:** Gwiazdki + liczba (np. 4.5) + ilość ocen
- **Twoja ocena:** Interaktywne gwiazdki do kliknięcia
- **Przycisk społeczności:** Niebieski przycisk z ikoną 📸 i tekstem

### Kolory:
- **Gwiazdki pełne:** `#f59e0b` (pomarańczowy)
- **Gwiazdki puste:** `#d1d5db` (szary)
- **Przycisk społeczności:** `#2563eb` (niebieski)
- **Tło karty:** `#ffffff` (białe)

## 🔗 Integracja ze społecznością

Przycisk "Zobacz społeczność" otwiera URL:
```
https://www.cypruseye.com/community.html?location={poi_id}
```

**Przykład:** 
- POI ID: `kato-pafos-archaeological-park`
- URL: `https://www.cypruseye.com/community.html?location=kato-pafos-archaeological-park`

Strona `community.html` musi obsługiwać parametr `location` i filtrować:
- Zdjęcia dla tego miejsca
- Komentarze dla tego miejsca
- Inne treści społecznościowe

## 📱 Użytkowanie

### Dla użytkownika:
1. **Otwórz mapę** w aplikacji
2. **Kliknij na marker POI** lub użyj nawigacji (← →)
3. **Pojawi się karta** z oceną miejsca
4. **Kliknij gwiazdki** aby ocenić (wymagane logowanie)
5. **Kliknij "Zobacz społeczność"** aby zobaczyć zdjęcia i komentarze
6. **Kliknij X** aby zamknąć kartę

### Logika:
- **Bez logowania:** Można zobaczyć średnią ocenę, ale nie można ocenić
- **Po zalogowaniu:** Można ocenić miejsce (1-5 gwiazdek)
- **Aktualizacja:** Po ocenie, średnia automatycznie się odświeża

## 🔧 Rozwiązywanie problemów

### Błędy TypeScript
Jeśli widzisz błędy TypeScript o brakujących modułach:
1. Upewnij się że zainstalowałeś wszystkie zależności
2. Uruchom `npm install` ponownie
3. Zrestartuj serwer/bundler

### Błąd: "Cannot find module"
```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### Brak danych ocen
1. Sprawdź czy wykonałeś SQL w Supabase
2. Sprawdź czy tabela `poi_ratings` istnieje
3. Sprawdź polityki RLS w Supabase Dashboard

### Przycisk społeczności nie działa
1. Sprawdź czy URL jest prawidłowy
2. Sprawdź czy strona `community.html` obsługuje parametr `?location=`
3. Sprawdź konsolę przeglądarki/aplikacji dla błędów

## 🎯 Następne kroki (opcjonalne)

### Możliwe rozszerzenia:
1. **Animacje:** Dodaj animacje przy pojawianiu/znikaniu karty
2. **Komentarze:** Pokaż ostatnie komentarze w karcie
3. **Zdjęcia:** Pokaż miniaturki zdjęć w karcie
4. **Statystyki:** Rozkład ocen (ile 5★, 4★, itd.)
5. **Mapa cieplna:** Pokaż najlepiej oceniane miejsca innym kolorem

## 📝 Struktura plików

```
├── lib/
│   └── supabase.ts              # Klient Supabase + funkcje API
├── components/
│   └── PoiRatingCard.tsx        # Komponent karty oceny
├── app/(tabs)/map/
│   └── index.tsx                # Widok mapy (zintegrowany)
├── SUPABASE_POI_RATINGS_SETUP.sql   # SQL dla bazy danych
└── POI_RATING_IMPLEMENTATION.md     # Ta dokumentacja
```

## 🌟 Podsumowanie

System jest **gotowy do użycia** po zainstalowaniu zależności i wykonaniu SQL w Supabase!

Użytkownicy mogą teraz:
- ✅ Widzieć oceny miejsc bezpośrednio na mapie
- ✅ Oceniać miejsca które odwiedzili
- ✅ Przejść do społeczności z zdjęciami i komentarzami
- ✅ Mieć piękny, nowoczesny interfejs

**Enjoy! 🎉**
