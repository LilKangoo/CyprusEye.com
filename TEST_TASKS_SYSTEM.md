# 🧪 Test Systemu Zadań - Szybki Przewodnik

## Krok 1: Uruchom SQL (OBOWIĄZKOWE)

1. Otwórz **Supabase Dashboard** → **SQL Editor**
2. Skopiuj **całą** zawartość `CREATE_COMPLETED_TASKS_TABLE.sql`
3. Wklej i kliknij **Run**

**Oczekiwany rezultat:**
```sql
✅ Tabela completed_tasks utworzona pomyślnie
✅ RPC function award_task utworzona pomyślnie

-- Plus dane o strukturze tabeli i policies
```

❌ **Jeśli widzisz błąd** - napisz jaki dokładnie błąd się pojawia.

---

## Krok 2: Otwórz tasks.html

1. Uruchom lokalny serwer (np. `python -m http.server 8000`)
2. Otwórz: `http://localhost:8000/tasks.html`
3. Otwórz **DevTools Console** (F12)

---

## Krok 3: Sprawdź Console Logs

### ✅ Poprawne logi (wszystko działa):
```
🎯 Initializing tasks system...
🎯 Initializing Tasks Manager...
✅ User authenticated: abc-123-xyz
✅ Loaded 0 completed tasks
✅ Tasks Manager initialized with 22 tasks
✅ Tasks initialized via tasks-manager module
```

### ❌ Błędne logi (trzeba naprawić):
```
⚠️ Using fallback tasks display (no completion tracking)
❌ TASKS_DATA not found or empty
Error loading completed tasks: ...
```

---

## Krok 4: Sprawdź Wyświetlanie

### ✅ CO POWINNO BYĆ WIDOCZNE:

Każda karta zadania powinna mieć:
- **Tytuł**: "Poranny spacer po plaży" (NIE "sunrise-challenge")
- **Opis**: "Wstań przed wschodem słońca i wybierz się..."
- **XP**: "✨ 80 XP"
- **Przycisk**: "Wykonaj" lub "Zaloguj się"

### ❌ CO NIE POWINNO BYĆ WIDOCZNE:
- ~~"📍 Level 1"~~ ← To powinno być usunięte
- ~~"sunrise-challenge"~~ ← To powinno być zamienione na tytuł

---

## Krok 5: Test Ukończenia Zadania (Zalogowany)

1. Zaloguj się jako użytkownik testowy
2. Kliknij **"Wykonaj"** na dowolnym zadaniu
3. Sprawdź:

### ✅ Oczekiwane zachowanie:
- Pojawia się **zielone powiadomienie** w prawym dolnym rogu
- Tekst: "✅ Ukończono: [nazwa zadania] (+XX XP)"
- Karta zmienia kolor na **zielony**
- Przycisk zmienia się na **"Cofnij"**
- **XP w nagłówku się zwiększa**

### ❌ Jeśli coś nie działa:
- Sprawdź Console - jaki błąd?
- Sprawdź Network tab - czy request do Supabase przeszedł?
- Sprawdź czy tabela `completed_tasks` istnieje w Supabase

---

## Krok 6: Test Cofnięcia (Zalogowany)

1. Kliknij **"Cofnij"** na ukończonym zadaniu
2. Sprawdź:

### ✅ Oczekiwane zachowanie:
- Pojawia się **niebieskie powiadomienie**
- Tekst: "↩️ Cofnięto: [nazwa zadania] (-XX XP)"
- Karta wraca do **białego koloru**
- Przycisk wraca na **"Wykonaj"**
- **XP w nagłówku się zmniejsza**

---

## Krok 7: Test Trwałości Danych

1. Ukończ 2-3 zadania
2. **Odśwież stronę** (F5)
3. Sprawdź:

### ✅ Oczekiwane zachowanie:
- Ukończone zadania **pozostają zaznaczone** (zielone)
- Przyciski pokazują **"Cofnij"**
- Dane są **pobrane z Supabase**

Console powinien pokazać:
```
✅ Loaded 3 completed tasks
```

---

## 🐛 Najczęstsze Problemy i Rozwiązania

### Problem 1: "completed_tasks does not exist"
**Rozwiązanie**: SQL nie został uruchomiony. Wróć do Kroku 1.

### Problem 2: Nazwy wciąż "sunrise-challenge"
**Rozwiązanie**: 
- Sprawdź czy plik `translations/pl.json` istnieje
- Sprawdź czy zawiera klucz: `"tasks.items.sunrise-challenge.title"`

### Problem 3: "User not authenticated"
**Rozwiązanie**: 
- Zaloguj się używając przycisku logowania
- Sprawdź czy Supabase client jest skonfigurowany

### Problem 4: "Tasks manager module not available"
**Rozwiązanie**:
- Sprawdź czy plik `js/tasks-manager.js` istnieje
- Upewnij się że strona jest otwarta przez HTTP (nie file://)
- Sprawdź Console na błędy importu

### Problem 5: XP nie aktualizuje się
**Rozwiązanie**:
- Sprawdź czy funkcja `award_task()` istnieje w Supabase
- Sprawdź czy kolumny `xp` i `level` istnieją w tabeli `profiles`
- Uruchom `ADD_XP_COLUMNS_TO_PROFILES.sql` jeśli potrzeba

### Problem 6: "Permission denied"
**Rozwiązanie**:
- Sprawdź czy RLS policies są włączone
- Sprawdź czy `auth.uid()` zwraca poprawne ID użytkownika

---

## ✅ Pełna Lista Kontrolna

Przed wdrożeniem na produkcję, upewnij się że:

- [ ] SQL został uruchomiony bez błędów
- [ ] Tabela `completed_tasks` istnieje
- [ ] Funkcja `award_task()` istnieje  
- [ ] 3 policies RLS są aktywne
- [ ] Plik `js/tasks-manager.js` jest na serwerze
- [ ] Nazwy zadań wyświetlają się poprawnie
- [ ] Opisy zadań są widoczne
- [ ] NIE MA wskaźnika "Level X"
- [ ] Przyciski "Wykonaj"/"Cofnij" działają
- [ ] Toast notifications pojawiają się
- [ ] XP aktualizuje się w nagłówku
- [ ] Stan zapisuje się po odświeżeniu
- [ ] Wszystko działa dla zalogowanych użytkowników
- [ ] Niezalogowani widzą "Zaloguj się"

---

## 📝 Szybki Raport

Po przetestowaniu, wypełnij:

**Data testu**: ___________  
**Środowisko**: [ ] Lokalne  [ ] Staging  [ ] Production

**Wyniki:**
- SQL uruchomiony: [ ] TAK [ ] NIE
- Zadania się wyświetlają: [ ] TAK [ ] NIE
- Nazwy są poprawne: [ ] TAK [ ] NIE
- Opisy są widoczne: [ ] TAK [ ] NIE
- Przyciski działają: [ ] TAK [ ] NIE
- Toast notifications: [ ] TAK [ ] NIE
- XP aktualizuje się: [ ] TAK [ ] NIE
- Stan jest zapisywany: [ ] TAK [ ] NIE

**Problemy (jeśli są):**
________________________________
________________________________
________________________________

**Status końcowy**: [ ] ✅ DZIAŁA [ ] ❌ WYMAGA NAPRAWY

---

## 🚀 Gotowe do użycia!

Jeśli wszystkie testy przeszły - system jest gotowy na produkcję! 🎉
