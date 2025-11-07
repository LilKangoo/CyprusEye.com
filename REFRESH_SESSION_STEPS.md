# 🔄 ODŚWIEŻ SESSION - KROK PO KROKU

## ✅ SQL działa poprawnie!

Widać że:
- total_users: 4
- total_pois: 61
- total_comments: 5

**Views działają!** Problem: Session w przeglądarce jest stara.

---

## 🚀 ODŚWIEŻ SESSION (3 minuty)

### Krok 1: Wyczyść cache i wyloguj się

#### A. Hard Refresh (wymuś przeładowanie)
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

#### B. Wyloguj się
1. Otwórz: https://cypruseye.com/admin
2. Kliknij **Logout** (lub przycisk wylogowania)
3. **Poczekaj aż przekieruje do login**

#### C. Wyczyść całkowicie (opcjonalnie)
```
1. Otwórz DevTools: F12 (lub Cmd+Opt+I)
2. Kliknij prawym na przycisk Refresh
3. Wybierz: "Empty Cache and Hard Reload"
```

### Krok 2: Zaloguj się na nowo

1. **Login page:** https://cypruseye.com/admin
2. **Email:** lilkangoomedia@gmail.com
3. **Hasło:** (twoje hasło)
4. **Kliknij Login**

### Krok 3: Test w konsoli (WAŻNE!)

Po zalogowaniu:

1. **Otwórz konsolę:** F12
2. **Wklej i uruchom:**

```javascript
// Test 1: Sprawdź session
const session = await supabase.auth.getSession();
console.log('Session:', session.data.session);
console.log('User ID:', session.data.session?.user?.id);
console.log('Email:', session.data.session?.user?.email);

// Test 2: Sprawdź czy jesteś adminem
const { data: isAdmin, error: adminError } = await supabase.rpc('is_current_user_admin');
console.log('Is Admin:', isAdmin, 'Error:', adminError);

// Test 3: Sprawdź diagnostics
const { data: diagnostics, error: diagError } = await supabase
  .from('admin_system_diagnostics')
  .select('*');
console.log('Diagnostics:', diagnostics, 'Error:', diagError);

// Test 4: Sprawdź user details
const { data: userDetails, error: userError } = await supabase
  .rpc('admin_get_user_details', {
    target_user_id: '15f3d442-092d-4eb8-9627-db90da0283eb'
  });
console.log('User Details:', userDetails, 'Error:', userError);
```

3. **Zrób screenshot outputu** i prześlij mi!

---

## 🎯 Co powinno się stać:

### ✅ Jeśli działa:
```
Is Admin: true
Diagnostics: [{metric: "total_users", value: "4", ...}]
User Details: {profile: {...}, auth_data: {...}, stats: {...}}
```

### ❌ Jeśli nie działa:
```
Is Admin: false (lub error)
User Details: Error: "Access denied: Admin only"
```

---

## 🔧 Jeśli NADAL nie działa po logoucie/loginie:

### Opcja A: Sprawdź profile w Supabase
```sql
SELECT id, email, is_admin, ban_permanent, banned_until
FROM profiles
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';
```

Powinno być:
- is_admin = TRUE
- ban_permanent = FALSE
- banned_until = NULL

### Opcja B: Sprawdź auth.users
```sql
SELECT id, email, banned_until
FROM auth.users
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';
```

**WAŻNE:** Jeśli `auth.users.banned_until` ma wartość, to NADAL jesteś zbanowany!

Naprawa:
```sql
-- Usuń ban z auth.users
UPDATE auth.users
SET banned_until = NULL
WHERE id = '15f3d442-092d-4eb8-9627-db90da0283eb';
```

---

## 📝 Po testach powiedz mi:

1. Czy wylogowałeś się i zalogowałeś na nowo? ✅/❌
2. Co pokazuje konsola (screenshot)?
3. Czy admin panel działa teraz? ✅/❌
4. Jakie błędy widzisz (jeśli są)?

---

## ⚡ NAJWAŻNIEJSZE:

**Musisz się WYLOGOWAĆ i ZALOGOWAĆ ponownie!**

Stara session w przeglądarce nie ma nowych uprawnień admin.
Dopiero nowa session po zalogowaniu będzie miała is_admin = TRUE.
