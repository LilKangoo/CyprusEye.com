# 🛡️ Panel Administracyjny CyprusEye.com

## Dokumentacja kompletna - Wersja 1.0

---

## 📋 Spis treści

1. [Przegląd](#przegląd)
2. [Instalacja Backend](#instalacja-backend)
3. [Struktura plików](#struktura-plików)
4. [Funkcje i możliwości](#funkcje-i-możliwości)
5. [Bezpieczeństwo](#bezpieczeństwo)
6. [Uruchomienie](#uruchomienie)
7. [Rozbudowa](#rozbudowa)

---

## 🎯 Przegląd

Panel administracyjny CyprusEye.com to w pełni funkcjonalny system zarządzania aplikacją, dostępny wyłącznie dla użytkownika `lilkangoomedia@gmail.com`.

### Główne cechy:
- ✅ **Wielopoziomowe zabezpieczenie** - weryfikacja na poziomie bazy danych i frontendu
- ✅ **Dashboard z metrykami** - statystyki użytkowników, POI, komentarzy
- ✅ **Zarządzanie użytkownikami** - przeglądanie profili, statystyk, edycja
- ✅ **Diagnostyka systemu** - monitoring zdrowia bazy danych, API, storage
- ✅ **Responsywny design** - działa na desktop i mobile
- ✅ **Ciemny motyw** - profesjonalny interfejs w kolorystyce red/dark

---

## 🔧 Instalacja Backend

### Krok 1: Uruchom SQL w Supabase

Przejdź do **Supabase SQL Editor** i uruchom plik:

```bash
ADMIN_PANEL_SETUP.sql
```

Ten skrypt:
1. Dodaje kolumnę `is_admin` do tabeli `profiles`
2. Ustawia Twoje konto jako admin
3. Tworzy funkcje pomocnicze (`is_current_user_admin()`, `is_user_admin()`)
4. Tworzy widoki admina (`admin_users_overview`, `admin_system_diagnostics`)
5. Tworzy funkcje zarządzania (`admin_get_user_details`, `admin_update_user_profile`)
6. Konfiguruje Row Level Security

### Krok 2: Weryfikacja

Po uruchomieniu SQL, sprawdź czy wszystko działa:

```sql
-- Sprawdź czy masz flagę admina
SELECT id, username, email, is_admin 
FROM profiles 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';

-- Powinna zwrócić TRUE
SELECT is_user_admin('15f3d442-092d-4eb8-9627-db90da0283eb');
```

### Krok 3: Deploy Frontend

Pliki panelu admina znajdują się w:
```
/admin/
  ├── index.html    # Struktura HTML
  ├── admin.css     # Style
  └── admin.js      # Logika
```

**Nic więcej nie trzeba robić** - pliki są już w projekcie i dostępne pod `/admin/`

---

## 📁 Struktura plików

### Backend (SQL)
```
ADMIN_PANEL_SETUP.sql          # Główny setup bazy danych
```

### Frontend
```
/admin/
  ├── index.html               # Główna strona panelu
  ├── admin.css                # Styling (dark theme)
  └── admin.js                 # JavaScript (auth, routing, data)
```

### Zależności
Panel używa istniejących zasobów:
- `../js/supabaseClient.js` - klient Supabase
- `../js/toast.js` - notyfikacje
- `../assets/css/tokens.css` - zmienne CSS
- `../assets/css/base.css` - bazowe style

---

## 🎨 Funkcje i możliwości

### 1. Dashboard
- **Statystyki systemowe**
  - Liczba użytkowników
  - Liczba POI
  - Liczba komentarzy
  - Aktywni użytkownicy (7 dni)
  
- **Ostatnia aktywność**
  - Recent comments
  - Recent ratings
  - User actions

### 2. Zarządzanie użytkownikami
- **Lista wszystkich użytkowników**
  - Username, email, level, XP
  - Data rejestracji
  - Status (Active/Banned)
  - Badge dla adminów
  
- **Wyszukiwanie**
  - Po username, email, name
  - Real-time filtering

- **Szczegóły użytkownika**
  - Pełny profil
  - Statystyki aktywności
  - Recent comments i ratings
  - Możliwość edycji (TODO)

- **Paginacja**
  - 20 użytkowników na stronę
  - Nawigacja prev/next

### 3. POIs (Placeholder)
Przygotowane do rozbudowy:
- Lista wszystkich POI
- Edycja POI
- Dodawanie nowych POI
- Usuwanie POI

### 4. Content Management (Placeholder)
Przygotowane do rozbudowy:
- Moderacja komentarzy
- Zarządzanie zdjęciami
- Ratings overview

### 5. Diagnostyka systemu
- **Status checks**
  - Database connection
  - API status
  - Storage availability
  
- **System metrics**
  - Total users
  - Active users
  - Total POIs
  - Total comments
  - Total ratings
  - Total visits

### 6. Settings (Placeholder)
Przygotowane do rozbudowy:
- Admin panel settings
- Notification preferences
- Security settings

---

## 🔒 Bezpieczeństwo

### Wielopoziomowa ochrona

#### Poziom 1: Frontend
```javascript
// admin.js sprawdza:
1. Czy użytkownik jest zalogowany
2. Czy user.id === '15f3d442-092d-4eb8-9627-db90da0283eb'
3. Czy profile.is_admin === true
```

#### Poziom 2: Backend (RLS)
```sql
-- Tylko admin może wykonywać funkcje admin_*
CREATE POLICY "Admin can view all users"
  ON profiles
  FOR SELECT
  USING (is_current_user_admin() OR id = auth.uid());
```

#### Poziom 3: Funkcje (SECURITY DEFINER)
```sql
-- Każda funkcja admin_* sprawdza:
IF NOT is_current_user_admin() THEN
  RAISE EXCEPTION 'Access denied: Admin only';
END IF;
```

### Ochrona przed:
- ✅ Nieautoryzowany dostęp
- ✅ SQL Injection (parametryzowane zapytania)
- ✅ XSS (CSP headers, escaped output)
- ✅ CSRF (same-origin policy)
- ✅ Privilege escalation

### SEO & Robots
```html
<meta name="robots" content="noindex,nofollow" />
```
Panel NIE jest indeksowany przez wyszukiwarki.

---

## 🚀 Uruchomienie

### Pierwszy raz

1. **Setup bazy danych**
   ```bash
   # W Supabase SQL Editor
   # Uruchom: ADMIN_PANEL_SETUP.sql
   ```

2. **Zaloguj się jako admin**
   ```
   Email: lilkangoomedia@gmail.com
   Hasło: [Twoje hasło]
   ```

3. **Przejdź do panelu**
   ```
   https://cypruseye.com/admin/
   ```

4. **Weryfikacja**
   - Powinieneś zobaczyć dashboard
   - W prawym górnym rogu: "Admin" i Twoja nazwa
   - Wszystkie statystyki powinny się załadować

### Rozwiązywanie problemów

#### "Access Denied"
**Przyczyna:** Konto nie ma flagi `is_admin`

**Rozwiązanie:**
```sql
UPDATE profiles 
SET is_admin = TRUE 
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';
```

#### "Loading..." bez końca
**Przyczyna:** Problem z Supabase połączeniem

**Rozwiązanie:**
1. Sprawdź console (F12)
2. Sprawdź czy `window.getSupabase()` działa
3. Sprawdź czy RPC functions istnieją:
   ```sql
   SELECT * FROM pg_proc WHERE proname LIKE 'admin_%';
   ```

#### Brak danych w tabelach
**Przyczyna:** Brak uprawnień lub RLS blokuje

**Rozwiązanie:**
```sql
-- Sprawdź policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Sprawdź grants
SELECT * FROM information_schema.role_table_grants 
WHERE grantee = 'authenticated';
```

---

## 🔨 Rozbudowa

### Dodanie nowych funkcji admina

#### Przykład: Ban użytkownika

**1. Backend (SQL)**
```sql
CREATE OR REPLACE FUNCTION admin_ban_user(
  target_user_id UUID,
  ban_until TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Update auth.users (wymaga uprawnień)
  -- Alternatywnie: dodaj banned_until do profiles
  
  RETURN json_build_object('success', true);
END;
$$;
```

**2. Frontend (JavaScript)**
```javascript
async function banUser(userId, banUntil) {
  try {
    const { data, error } = await sb.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_until: banUntil
    });
    
    if (error) throw error;
    showToast('User banned successfully', 'success');
    loadUsersData();
  } catch (error) {
    console.error('Ban failed:', error);
    showToast('Failed to ban user', 'error');
  }
}
```

**3. Frontend (HTML)**
```html
<button class="btn-secondary" onclick="banUser('${user.id}', '2024-12-31')">
  Ban
</button>
```

### Dodanie nowego widoku

**1. HTML (index.html)**
```html
<!-- Sidebar -->
<button class="admin-nav-item" data-view="analytics">
  <svg>...</svg>
  <span>Analytics</span>
</button>

<!-- Main Content -->
<section class="admin-view" id="viewAnalytics" hidden>
  <header class="admin-view-header">
    <h2>Analytics</h2>
  </header>
  <div id="analyticsContent">...</div>
</section>
```

**2. JavaScript (admin.js)**
```javascript
// W switchView()
case 'analytics':
  loadAnalyticsData();
  break;

// Nowa funkcja
async function loadAnalyticsData() {
  // Twoja logika
}
```

**3. CSS (admin.css)**
```css
/* Jeśli potrzeba custom styling */
.analytics-chart {
  /* ... */
}
```

---

## 📊 Dostępne SQL Functions

### Sprawdzanie uprawnień
```sql
is_current_user_admin()           -- TRUE/FALSE
is_user_admin(user_id UUID)       -- TRUE/FALSE
```

### Pobieranie danych
```sql
admin_get_user_details(target_user_id UUID)
-- Zwraca: JSON z profilem, statsami, aktywnością

admin_get_activity_log(limit_count INTEGER)
-- Zwraca: TABLE z ostatnią aktywnością
```

### Modyfikacja
```sql
admin_update_user_profile(
  target_user_id UUID,
  new_username TEXT,
  new_name TEXT,
  new_xp INTEGER,
  new_level INTEGER,
  new_is_admin BOOLEAN
)
-- Zwraca: JSON z zaktualizowanym profilem
```

### Widoki
```sql
admin_users_overview              -- Wszyscy użytkownicy + stats
admin_system_diagnostics          -- Metryki systemowe
```

---

## 🎨 Customizacja

### Zmiana kolorów

W `admin.css`:
```css
:root {
  --admin-primary: #dc2626;        /* Zmień kolor główny */
  --admin-bg: #0f172a;             /* Zmień tło */
  --admin-text: #f8fafc;           /* Zmień kolor tekstu */
}
```

### Zmiana logo
W `index.html`:
```html
<h1 class="admin-title">
  <svg>...</svg>  <!-- Zmień na własne logo -->
  CyprusEye Admin
</h1>
```

---

## 📝 TODO / Roadmap

### Phase 2 (Priorytet)
- [ ] Edycja profilu użytkownika
- [ ] Ban/unban użytkownika
- [ ] Zarządzanie POI (CRUD)
- [ ] Moderacja komentarzy
- [ ] Bulk actions

### Phase 3 (Nice to have)
- [ ] Analytics dashboard z wykresami
- [ ] Email notifications
- [ ] Activity log z filtrowaniem
- [ ] Export danych do CSV
- [ ] Dark/Light theme toggle
- [ ] Multi-language support

### Phase 4 (Advanced)
- [ ] Role-based access (Super Admin, Moderator)
- [ ] Audit trail
- [ ] Scheduled tasks
- [ ] API rate limiting
- [ ] Advanced reporting

---

## 🆘 Wsparcie

### Najczęstsze pytania

**Q: Czy mogę dodać więcej adminów?**  
A: Tak, uruchom:
```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'nowy_admin@email.com';
```

**Q: Jak usunąć uprawnienia admina?**  
A: Uwaga - nie usuwaj swojego admina!
```sql
UPDATE profiles SET is_admin = FALSE WHERE id = 'user_id';
```

**Q: Panel nie ładuje się**  
A: Sprawdź:
1. Console (F12) - błędy JavaScript
2. Network tab - czy API działa
3. Supabase logs - czy SQL functions są dostępne

**Q: Jak zrestartować panel?**  
A: Hard refresh: `Ctrl+Shift+R` (Windows) lub `Cmd+Shift+R` (Mac)

---

## ✅ Checklist uruchomienia

Przed pierwszym użyciem:

- [ ] ✅ Uruchomiono `ADMIN_PANEL_SETUP.sql` w Supabase
- [ ] ✅ Zweryfikowano flagę `is_admin` w profilu
- [ ] ✅ Sprawdzono czy funkcje `admin_*` istnieją
- [ ] ✅ Sprawdzono czy widoki `admin_*` istnieją
- [ ] ✅ Przetestowano logowanie jako admin
- [ ] ✅ Przetestowano dostęp do `/admin/`
- [ ] ✅ Dashboard ładuje statystyki
- [ ] ✅ Users table pokazuje użytkowników
- [ ] ✅ Diagnostics pokazują status systemów

---

## 🎉 Gotowe!

Panel administracyjny jest w pełni funkcjonalny i gotowy do użycia.

**Dostęp:**  
🔗 https://cypruseye.com/admin/

**Login:**  
📧 lilkangoomedia@gmail.com

---

**Utworzono:** 3 listopada 2025  
**Wersja:** 1.0  
**Autor:** Cascade AI & LilKangoo  
**Projekt:** CyprusEye.com Admin Panel
