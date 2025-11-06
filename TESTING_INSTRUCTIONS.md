# 🧪 Instrukcje Testowania - CyprusEye Account System

## Testy Automatyczne (Playwright)

### Uruchomienie wszystkich testów:

```bash
# Z głównego katalogu projektu
npm run test:e2e
```

### Uruchomienie tylko testów Supabase:

```bash
npx playwright test supabase-integration
```

### Uruchomienie z interfejsem UI:

```bash
npx playwright test --ui
```

---

## Testy Manualne

### ✅ Test 1: Logowanie i wyświetlanie statystyk

**Kroki:**
1. Otwórz `http://localhost:8888`
2. Kliknij "Zaloguj się"
3. Zaloguj się swoim kontem Supabase
4. Sprawdź czy w headerze wyświetla się:
   - Poziom (powinien być > 0)
   - Doświadczenie (XP > 0)
   - Odznaki

**Oczekiwany rezultat:**
- ✅ Statystyki wyświetlają się poprawnie
- ✅ Poziom zgadza się z tym w Supabase
- ✅ Brak błędów w konsoli

---

### ✅ Test 2: Panel konta

**Kroki:**
1. Po zalogowaniu, kliknij "📊 Statystyki i ustawienia"
2. Sprawdź sekcję "Twój profil":
   - E-mail
   - Nazwa użytkownika
   - Imię wyświetlane
   - XP
   - Poziom
   - Ostatnia aktualizacja
3. Sprawdź sekcję "Ostatnie zdarzenia XP"
4. Sprawdź sekcję "Poziom" (dolna część)

**Oczekiwany rezultat:**
- ✅ Wszystkie dane się wyświetlają
- ✅ Poziom w "Twój profil" = Poziom w statystykach (dół strony)
- ✅ XP w obu sekcjach jest taki sam
- ✅ Jeśli brak zdarzeń XP: "Brak zarejestrowanych zdarzeń XP"

---

### ✅ Test 3: Reset postępu

**Kroki:**
1. W panelu konta kliknij "🔄 Zresetuj postęp"
2. Potwierdź w oknie dialogowym
3. Sprawdź czy wyświetla się komunikat sukcesu
4. Sprawdź wartości:
   - XP powinno być = 0
   - Poziom powinien być = 1
5. Odśwież stronę (F5)
6. Sprawdź ponownie wartości
7. Sprawdź w Supabase Dashboard → profiles → twój rekord

**Oczekiwany rezultat:**
- ✅ XP = 0, Poziom = 1 po resecie
- ✅ Po odświeżeniu strony wartości pozostają zresetowane
- ✅ W Supabase XP = 0, level = 1
- ✅ Brak błędów w konsoli

---

### ✅ Test 4: Nawigacja między stronami

**Kroki:**
1. Zaloguj się na stronie głównej
2. Odwiedź kolejno:
   - `/achievements.html` (Osiągnięcia)
   - `/tasks.html` (Zadania)
   - `/packing.html` (Packing List)
   - `/vip.html` (VIP)
3. Na każdej stronie sprawdź:
   - Czy statystyki w headerze są widoczne
   - Czy wartości są spójne
   - Czy nie ma błędów w konsoli

**Oczekiwany rezultat:**
- ✅ Statystyki wyświetlają się na wszystkich stronach
- ✅ Wartości są takie same na każdej stronie
- ✅ Poziom i XP są synchronizowane
- ✅ Brak błędów krytycznych w konsoli

---

### ✅ Test 5: Mobile

**Kroki:**
1. Otwórz na telefonie `cypruseye.com` (lub localhost przez tunnel)
2. Zaloguj się
3. Sprawdź header metrics (poziom, XP, odznaki)
4. Przejdź do panelu konta
5. Sprawdź czy wszystkie dane się wyświetlają

**Oczekiwany rezultat:**
- ✅ Header metrics widoczne i czytelne na mobile
- ✅ Panel konta działa poprawnie
- ✅ Wszystkie funkcje działają jak na desktop

---

### ✅ Test 6: Błędy konsoli

**Kroki:**
1. Otwórz DevTools (F12) → Console
2. Odwiedź każdą stronę aplikacji
3. Sprawdź czy nie ma:
   - ❌ Błędów 404 (poza xp_events - to OK)
   - ❌ Błędów "cannot update generated column level"
   - ❌ Błędów undefined functions

**Dopuszczalne ostrzeżenia:**
- ⚠️ "Community journal stream nie jest dostępny" - OK
- ⚠️ "Tabela xp_events nie istnieje" - OK jeśli tabeli rzeczywiście nie ma

**Niedopuszczalne błędy:**
- ❌ "getSupabase is not a function"
- ❌ "cannot update column level"
- ❌ 404 dla profiles
- ❌ Błędy TypeScript/JavaScript

---

## Checklist końcowy

### Funkcjonalność:
- [ ] Logowanie działa na wszystkich stronach
- [ ] Statystyki wyświetlają się w headerze
- [ ] Panel konta pokazuje wszystkie dane
- [ ] Reset postępu synchronizuje z Supabase
- [ ] Poziom z Supabase = poziom w aplikacji
- [ ] XP jest spójne na wszystkich stronach

### Wydajność:
- [ ] Strony ładują się < 3 sekundy
- [ ] Brak zbędnych requestów do API
- [ ] Brak memory leaks

### Bezpieczeństwo:
- [ ] Klucze API nie są w kodzie klienta
- [ ] Dane użytkownika są szyfrowane
- [ ] Session handling działa poprawnie

### UX:
- [ ] Wszystkie komunikaty są w języku użytkownika
- [ ] Brak "zer" i pustych pól w UI
- [ ] Loading states są widoczne
- [ ] Error states są czytelne

---

## Raportowanie błędów

Jeśli znajdziesz błąd, dodaj do `VERIFICATION_REPORT.md`:

```markdown
### 🔴 Błąd: [Krótki opis]

**Strona:** [URL]  
**Kroki reprodukcji:**
1. ...
2. ...

**Oczekiwane:** ...  
**Faktyczne:** ...  
**Konsola:** [błędy jeśli są]
```

---

## Kontakt

W razie pytań lub problemów, sprawdź:
- `VERIFICATION_REPORT.md` - pełny raport weryfikacji
- `docs/` - dokumentacja techniczna
- Console logs - szczegółowe informacje o błędach
