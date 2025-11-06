# 🚀 Panel Administracyjny - Quick Start

## Szybki start w 3 krokach

### Krok 1: Setup bazy danych ⚙️

Przejdź do **Supabase SQL Editor** i uruchom:

```sql
-- Skopiuj całą zawartość pliku:
ADMIN_PANEL_SETUP.sql
```

Kliknij **RUN** i poczekaj na komunikat sukcesu.

---

### Krok 2: Weryfikacja ✅

Sprawdź czy wszystko działa:

```sql
-- Sprawdź czy masz flagę admina
SELECT id, username, email, is_admin 
FROM profiles 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Wynik powinien pokazać: is_admin = true
```

---

### Krok 3: Zaloguj się i korzystaj 🎉

1. **Zaloguj się** na stronie jako `lilkangoomedia@gmail.com`

2. **Przejdź do panelu:**
   ```
   https://cypruseye.com/admin/
   ```

3. **Gotowe!** Powinieneś zobaczyć dashboard z metrykami.

---

## 🎯 Co możesz zrobić w panelu?

### Dashboard
- ✅ Zobacz statystyki użytkowników
- ✅ Sprawdź liczbę POI, komentarzy
- ✅ Monitoruj aktywność

### Users
- ✅ Przeglądaj wszystkich użytkowników
- ✅ Szukaj po username/email
- ✅ Zobacz szczegóły profilu
- ✅ Sprawdź statystyki użytkownika

### Diagnostics
- ✅ Sprawdź status bazy danych
- ✅ Monitoruj API status
- ✅ Zobacz metryki systemowe

---

## 🔧 Struktura plików

```
ADMIN_PANEL_SETUP.sql          ← Uruchom to w Supabase
ADMIN_PANEL_DOCUMENTATION.md   ← Pełna dokumentacja

/admin/
  ├── index.html               ← Panel admina (HTML)
  ├── admin.css                ← Style (dark theme)
  └── admin.js                 ← Logika (auth + data)

/functions/admin/              ← Routing Cloudflare
  ├── index.js
  └── [[path]].js
```

---

## 🛡️ Bezpieczeństwo

Panel jest zabezpieczony na **3 poziomach:**

1. **Frontend** - sprawdza czy user.id === '15f3d442-092d-4eb8-9627-db90da0283eb'
2. **Backend** - Row Level Security blokuje nieuprawniony dostęp
3. **Functions** - każda funkcja admin_* sprawdza `is_current_user_admin()`

Tylko Ty masz dostęp! 🔒

---

## 🆘 Problemy?

### "Access Denied"
```sql
-- Upewnij się że masz flagę admina:
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';
```

### Panel nie ładuje się
1. Otwórz Console (F12)
2. Szukaj błędów w zakładce Console
3. Sprawdź czy wszystkie pliki się załadowały (Network tab)

### Brak danych w tabelach
```sql
-- Sprawdź czy funkcje istnieją:
SELECT proname FROM pg_proc WHERE proname LIKE 'admin_%';

-- Powinny być:
-- is_current_user_admin
-- is_user_admin
-- admin_get_user_details
-- admin_update_user_profile
-- admin_get_activity_log
```

---

## 📖 Pełna dokumentacja

Wszystkie szczegóły, funkcje i rozbudowa:
```
ADMIN_PANEL_DOCUMENTATION.md
```

---

## ✅ Checklist

- [ ] Uruchomiono SQL setup
- [ ] Zweryfikowano flagę is_admin
- [ ] Zalogowano jako lilkangoomedia@gmail.com
- [ ] Otwarto /admin/
- [ ] Dashboard pokazuje statystyki
- [ ] Users table działa
- [ ] Diagnostics działają

---

**Gotowe!** 🎉

Panel admina jest w pełni funkcjonalny i bezpieczny.

**Dostęp:** https://cypruseye.com/admin/  
**Login:** lilkangoomedia@gmail.com

---

Masz pytania? Sprawdź `ADMIN_PANEL_DOCUMENTATION.md`
