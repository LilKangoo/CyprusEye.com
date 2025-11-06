# 🎯 System Check-in - Prosta Integracja

**Status:** ✅ GOTOWE - Używa istniejącej struktury Supabase

---

## 📋 Co zostało dodane

### 1. Przycisk "✅ Zamelduj się"
Widoczny w sekcji "Aktualne miejsce" na stronie głównej.

### 2. Geolokalizacja
- **Automatyczne** w promieniu 1 km
- **Manualne** jeśli poza promieniem lub brak lokalizacji

### 3. XP i poziomy
- Dodaje XP do profilu użytkownika
- Automatyczny awans poziomów (co 1000 XP)
- Zapisuje odwiedzone miejsca

---

## 🗄️ Supabase Setup (OPCJONALNIE)

**TYLKO jeśli nie masz jeszcze kolumn `xp`, `level`, `visited_places` w tabeli `profiles`:**

W Supabase SQL Editor uruchom:

```sql
-- Sprawdź czy kolumny istnieją
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('xp', 'level', 'visited_places');
```

Jeśli wynik jest pusty lub brakuje kolumn, skopiuj i uruchom cały plik:
```
ADD_XP_COLUMNS_TO_PROFILES.sql
```

To doda tylko brakujące kolumny do istniejącej tabeli `profiles`.

---

## 💾 Struktura danych

### Tabela: `profiles`

**Nowe kolumny (jeśli ich nie masz):**
- `xp INTEGER DEFAULT 0` - Całkowite doświadczenie użytkownika
- `level INTEGER DEFAULT 1` - Aktualny poziom
- `visited_places TEXT[]` - Tablica ID odwiedzonych miejsc

**Przykładowy profil:**
```json
{
  "id": "123...",
  "username": "jan_kowalski",
  "xp": 380,
  "level": 1,
  "visited_places": ["tombs-of-the-kings", "coral-bay"]
}
```

---

## 🎮 Jak to działa

### Krok 1: Użytkownik klika "✅ Zamelduj się"

### Krok 2: Sprawdzenie lokalizacji
```
📍 Sprawdzam Twoją lokalizację...
```

### Krok 3: Walidacja
- **W promieniu 1 km** → Automatyczne ✅
- **Poza promieniem** → Pokazuje odległość, opcja manualna
- **Brak lokalizacji** → Tylko manualne potwierdzenie

### Krok 4: Aktualizacja profilu
```javascript
// Pobierz profil
const profile = await supabase
  .from('profiles')
  .select('xp, level, visited_places')
  .eq('id', userId)
  .single();

// Sprawdź czy już odwiedzony
if (visited_places.includes(place.id)) {
  alert('Już odwiedziłeś to miejsce!');
  return;
}

// Dodaj XP i miejsce
const newXP = xp + place.xp;
const newLevel = Math.floor(newXP / 1000) + 1;
const newVisitedPlaces = [...visited_places, place.id];

// Zapisz
await supabase
  .from('profiles')
  .update({ xp: newXP, level: newLevel, visited_places: newVisitedPlaces })
  .eq('id', userId);
```

### Krok 5: Komunikat sukcesu
```
✅
Zameldowanie udane!
Tombs of the Kings in Paphos

+190 XP
Razem: 190 XP | Poziom: 1

[🎉 Super!]
```

---

## 🎯 Logika poziomów

```
Level 1: 0 - 999 XP
Level 2: 1000 - 1999 XP
Level 3: 2000 - 2999 XP
...
```

**Wzór:** `level = floor(xp / 1000) + 1`

---

## ✅ Zabezpieczenia

1. **Nie można odwiedzić 2 razy** - miejsce dodawane do `visited_places`
2. **Sprawdzanie autoryzacji** - tylko zalogowani użytkownicy
3. **Weryfikacja lokalizacji** - automatyczna w promieniu 1km
4. **Ostrzeżenia** - komunikat o fałszywych zameldowaniach

---

## 🧪 Testowanie

1. **Odśwież stronę główną**
2. **Zaloguj się**
3. **Kliknij "✅ Zamelduj się"**
4. **Sprawdź komunikaty**
5. **Sprawdź w Supabase:**
   ```sql
   SELECT xp, level, visited_places 
   FROM profiles 
   WHERE id = 'twoj_user_id';
   ```

---

## 🚀 To wszystko!

System check-in działa z istniejącą strukturą Supabase:
- ✅ Brak nowych tabel
- ✅ Tylko 3 dodatkowe kolumny w `profiles`
- ✅ Prosty i szybki
- ✅ Gotowy do użycia!

**Jeśli kolumny już istnieją, nie musisz nic robić w Supabase!**
