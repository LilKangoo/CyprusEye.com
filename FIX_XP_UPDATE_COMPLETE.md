# ✅ Naprawa Aktualizacji XP i Levelu

## 🐛 Problemy Znalezione

### 1. **Funkcja updateHeaderMetrics nie była dostępna globalnie**
`tasks-manager.js` próbował wywołać `window.updateHeaderMetrics()`, ale funkcja nie była wyeksportowana z IIFE w `app-core.js`.

**Objaw:** Nagłówek nie aktualizował się po wykonaniu/cofnięciu zadania.

### 2. **Niespójna formuła obliczania levelu**

| Miejsce | Formuła | Status |
|---------|---------|--------|
| Frontend (`app-core.js`) | `1000 XP = 1 level` | ✅ Poprawne |
| SQL (`award_task`) | `100 XP = 1 level` | ❌ BŁĄD |
| JS (`tasks-manager.js`) | `100 XP = 1 level` | ❌ BŁĄD |

**Objaw:** 
- Wykonanie zadania: level skakał o 10 poziomów (bo 1000 XP / 100 = 10)
- Cofnięcie zadania: level skakał w dół
- Frontend pokazywał błędne postępy do następnego poziomu

---

## ✅ Rozwiązania

### Fix 1: Eksport updateHeaderMetrics

**Plik:** `app-core.js` (linia 177)

```javascript
// PRZED:
window.updateUserStatsDisplay = updateUserStatsDisplay;

// PO:
window.updateUserStatsDisplay = updateUserStatsDisplay;
window.updateHeaderMetrics = updateHeaderMetrics;
```

**Efekt:** `tasks-manager.js` może teraz wywołać funkcję i zaktualizować nagłówek.

---

### Fix 2: Ujednolicenie formuły levelu w SQL

**Plik:** `CREATE_COMPLETED_TASKS_TABLE.sql` (linia 116-117)

```sql
-- PRZED:
-- Oblicz nowy level (prosta formuła: 100 XP na level)
v_new_level := GREATEST(1, (v_new_xp / 100) + 1);

-- PO:
-- Oblicz nowy level (formuła: 1000 XP na level, zgodnie z frontendem)
v_new_level := GREATEST(1, FLOOR(v_new_xp / 1000.0) + 1);
```

**Efekt:** SQL funkcja `award_task()` teraz oblicza level poprawnie.

---

### Fix 3: Ujednolicenie formuły levelu w JS

**Plik:** `js/tasks-manager.js` (linia 281-283)

```javascript
// PRZED:
const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);

// PO:
// Formuła: 1000 XP = 1 level (zgodnie z frontendem i SQL)
const newLevel = Math.max(1, Math.floor(newXp / 1000) + 1);
```

**Efekt:** Funkcja `undoTask()` teraz oblicza level poprawnie.

---

### Fix 4: Cache Busting v2.2

Zaktualizowano wersję w:
- `tasks.html` → `?v=2.2`
- `app-core.js` (dynamic import) → `?v=2.2`

---

## 📊 Formuła Levelu - Specyfikacja

```javascript
Level = floor(XP / 1000) + 1

Przykłady:
    0 XP → Level 1
  500 XP → Level 1
  999 XP → Level 1
 1000 XP → Level 2
 1390 XP → Level 2  ← Twój przypadek
 2000 XP → Level 3
10000 XP → Level 11
```

### Postęp do następnego levelu:

```javascript
currentLevelXP = (level - 1) * 1000
nextLevelXP = level * 1000
xpNeededForLevel = nextLevelXP - currentLevelXP  // zawsze 1000
xpInCurrentLevel = xp - currentLevelXP
percentage = (xpInCurrentLevel / xpNeededForLevel) * 100

Dla 1390 XP (Level 2):
currentLevelXP = (2-1) * 1000 = 1000
nextLevelXP = 2 * 1000 = 2000
xpNeededForLevel = 1000
xpInCurrentLevel = 1390 - 1000 = 390
percentage = 390 / 1000 * 100 = 39%
```

---

## 🔄 Sekwencja Działania (Po Naprawie)

### Wykonanie Zadania:

```
1. Użytkownik klika "Wykonaj" (np. zadanie 80 XP)
2. tasks-manager.js:
   ├─ INSERT do completed_tasks (Supabase)
   ├─ Wywołaj RPC award_task(task_id)
   │  └─ SQL: xp += 80, level = floor(newXp/1000)+1
   ├─ Wywołaj refreshUserStats()
   │  ├─ SELECT xp, level, visited_places FROM profiles
   │  └─ Wywołaj window.updateHeaderMetrics(xp, level, badges)
   │     └─ Zaktualizuj DOM: poziom, XP, progress bar
   ├─ Aktualizuj UI karty (zielona, przycisk "Cofnij")
   └─ Pokaż toast: "✅ Ukończono: [nazwa] (+80 XP)"
```

### Cofnięcie Zadania:

```
1. Użytkownik klika "Cofnij"
2. tasks-manager.js:
   ├─ DELETE FROM completed_tasks (Supabase)
   ├─ SELECT xp FROM profiles
   ├─ newXp = xp - 80
   ├─ newLevel = floor(newXp/1000)+1
   ├─ UPDATE profiles SET xp=newXp, level=newLevel
   ├─ Wywołaj refreshUserStats()
   │  └─ Zaktualizuj nagłówek
   ├─ Aktualizuj UI karty (biała, przycisk "Wykonaj")
   └─ Pokaż toast: "↩️ Cofnięto: [nazwa] (-80 XP)"
```

---

## 🧪 Testowanie

### Test 1: Wykonanie zadania
1. Zaloguj się
2. Zapisz obecne XP i level (np. 1390 XP, Level 2)
3. Kliknij "Wykonaj" na zadaniu (np. 80 XP)
4. **Sprawdź:**
   - ✅ Nagłówek pokazuje: 1470 XP, Level 2
   - ✅ Progress bar się przesunął
   - ✅ Karta zadania jest zielona
   - ✅ Toast powiadomienie się pojawiło
5. Odśwież stronę (F5)
6. **Sprawdź:**
   - ✅ XP i level są zachowane
   - ✅ Zadanie jest nadal zaznaczone

### Test 2: Cofnięcie zadania
1. Kliknij "Cofnij" na ukończonym zadaniu
2. **Sprawdź:**
   - ✅ Nagłówek wraca do: 1390 XP, Level 2
   - ✅ Progress bar się cofnął
   - ✅ Karta zadania jest biała
   - ✅ Toast powiadomienie: "↩️ Cofnięto..."

### Test 3: Przejście przez level
1. Jeśli masz np. 1950 XP (blisko Level 3)
2. Wykonaj zadanie 80 XP
3. **Sprawdź:**
   - ✅ XP: 2030
   - ✅ Level: 3 ← Powinien przeskoczyć
   - ✅ Progress bar od nowa (30/1000)

### Test 4: Supabase konsystencja
1. Wykonaj kilka zadań
2. Otwórz **Supabase Dashboard** → Table Editor → `profiles`
3. Znajdź swój profil
4. **Sprawdź:**
   - ✅ Kolumna `xp` się aktualizuje
   - ✅ Kolumna `level` się aktualizuje
   - ✅ `updated_at` jest świeży

---

## 📝 Pliki Zmienione

| Plik | Linie | Co naprawiono |
|------|-------|---------------|
| `app-core.js` | 177 | Eksport `window.updateHeaderMetrics` |
| `CREATE_COMPLETED_TASKS_TABLE.sql` | 116-117 | Formuła levelu: 1000 XP zamiast 100 |
| `js/tasks-manager.js` | 282-283 | Formuła levelu: 1000 XP zamiast 100 |
| `tasks.html` | 337-342 | Cache busting `?v=2.2` |
| `app-core.js` | 618 | Cache busting w import `?v=2.2` |

---

## ⚠️ WAŻNE: Aktualizacja SQL w Supabase

Po wgraniu plików na serwer, **MUSISZ** zaktualizować funkcję SQL w Supabase:

### Opcja 1: Przeładuj całą funkcję
```sql
-- Uruchom cały plik CREATE_COMPLETED_TASKS_TABLE.sql ponownie
-- Funkcja zostanie zastąpiona (CREATE OR REPLACE FUNCTION)
```

### Opcja 2: Tylko zmień formułę
```sql
CREATE OR REPLACE FUNCTION award_task(p_task_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- ... (reszta deklaracji bez zmian)
BEGIN
  -- ... (reszta kodu bez zmian do linii obliczania levelu)
  
  -- TA LINIA ZOSTAŁA ZMIENIONA:
  v_new_level := GREATEST(1, FLOOR(v_new_xp / 1000.0) + 1);
  
  -- ... (reszta kodu bez zmian)
END;
$$;
```

---

## ✅ Status

| Problem | Status |
|---------|--------|
| Nagłówek nie aktualizuje się | 🟢 NAPRAWIONE |
| Level obliczany błędnie | 🟢 NAPRAWIONE |
| XP nie zapisuje się | 🟢 NAPRAWIONE |
| Niespójna formuła | 🟢 NAPRAWIONE |
| Cache busting | 🟢 ZAKTUALIZOWANE |

---

## 🚀 Wdrożenie

### Krok 1: Wgraj pliki na serwer
- `app-core.js` (z v2.2)
- `js/tasks-manager.js` (z poprawką)
- `tasks.html` (z v2.2)

### Krok 2: Zaktualizuj SQL w Supabase
- Otwórz Supabase Dashboard → SQL Editor
- Uruchom zaktualizowany `CREATE_COMPLETED_TASKS_TABLE.sql`

### Krok 3: Hard refresh przeglądarki
```
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

### Krok 4: Przetestuj
- Wykonaj zadanie → sprawdź XP i level
- Cofnij zadanie → sprawdź czy wraca
- Odśwież stronę → sprawdź trwałość

---

**Data**: 3 listopada 2025, 13:30  
**Status**: 🟢 Wszystkie problemy naprawione  
**Action**: Wgraj pliki + zaktualizuj SQL + hard refresh
