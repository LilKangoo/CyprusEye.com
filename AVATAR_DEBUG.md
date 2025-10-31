# 🔍 Avatar Upload - Debugging Guide

## Problem: Nie można wstawić zdjęcia / funkcjonalność nie działa

### Krok 1: Otwórz Console w przeglądarce

**Chrome/Edge**: `F12` lub `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)  
**Firefox**: `F12` lub `Ctrl+Shift+K`

### Krok 2: Sprawdź czy są błędy

Odśwież stronę (`F5`) i sprawdź czy w Console są czerwone błędy.

### Krok 3: Test diagnostyczny

W Console wpisz i uruchom:

```javascript
// 1. Sprawdź czy funkcja debug jest dostępna
checkAvatarSetup()
```

Jeśli funkcja nie istnieje, dodaj do `index.html` przed `</body>`:

```html
<script type="module" src="/js/avatarDebug.js"></script>
```

### Krok 4: Analiza błędów

#### ❌ Bucket "avatars" NOT FOUND

**Problem**: Bucket nie istnieje w Supabase Storage

**Rozwiązanie**:
1. Otwórz [Supabase Dashboard](https://app.supabase.com)
2. Wybierz swój projekt
3. Kliknij **Storage** w menu
4. Kliknij **Create a new bucket**
5. Nazwa: `avatars`
6. **Public bucket**: ✅ Zaznacz
7. Kliknij **Create bucket**

#### ❌ Column avatar_url doesn't exist

**Problem**: Kolumna nie istnieje w tabeli `profiles`

**Rozwiązanie**:
1. Otwórz [Supabase Dashboard](https://app.supabase.com)
2. Kliknij **SQL Editor**
3. Wklej i uruchom:

```sql
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
```

#### ❌ Error 403 / Permission denied / RLS policy

**Problem**: Brak uprawnień RLS

**Rozwiązanie**:
W **SQL Editor** uruchom:

```sql
-- Usuń stare policies jeśli istnieją
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;

-- Utwórz nowe
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public avatar read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

#### ❌ UI elements NOT FOUND

**Problem**: Elementy HTML nie istnieją

**Sprawdź**:
1. Czy jesteś na stronie z account modal? (np. `/account/`)
2. Czy modal jest otwarty?
3. Czy zmiany w `index.html` zostały zapisane?

### Krok 5: Test ręczny uploadu

W Console wpisz:

```javascript
// Sprawdź czy binding działa
const btn = document.querySelector('#btnUploadAvatar');
console.log('Upload button:', btn);

if (btn) {
  btn.addEventListener('click', () => {
    console.log('Button clicked!');
  });
}

// Test uploadu
const input = document.querySelector('#avatarUpload');
console.log('File input:', input);
```

Kliknij przycisk "Zmień zdjęcie" i sprawdź czy w Console pojawi się "Button clicked!".

### Krok 6: Sprawdź czy Supabase jest dostępny

```javascript
const sb = window.getSupabase();
console.log('Supabase client:', sb);

sb.auth.getUser().then(({ data, error }) => {
  if (error) {
    console.error('Auth error:', error);
  } else {
    console.log('User:', data.user);
  }
});
```

### Krok 7: Test uploadu z logowaniem

Po wybraniu pliku, sprawdź w Console logi zaczynające się od `[uploadAvatar]`.

Przykładowe logi:
```
[uploadAvatar] Start uploading avatar
[uploadAvatar] User ID: abc-123-def
[uploadAvatar] File: photo.jpg Size: 524288 Type: image/jpeg
[uploadAvatar] Checking for old avatars...
[uploadAvatar] No old avatars found
[uploadAvatar] Uploading new file: abc-123-def/avatar-1698765432.jpg
[uploadAvatar] Upload successful
[uploadAvatar] Public URL: https://...
[uploadAvatar] Updating profile...
[uploadAvatar] Profile updated successfully
```

### Częste błędy i rozwiązania

| Błąd | Przyczyna | Rozwiązanie |
|------|-----------|-------------|
| `Bucket not found` | Bucket nie istnieje | Utwórz bucket `avatars` |
| `new row violates row-level security` | Brak RLS policy | Dodaj policies (SQL wyżej) |
| `column "avatar_url" does not exist` | Brak kolumny | `ALTER TABLE profiles ADD COLUMN avatar_url TEXT;` |
| `Cannot read properties of null` | Element UI nie istnieje | Sprawdź czy HTML został zaktualizowany |
| `No user logged in` | Brak sesji | Zaloguj się najpierw |

### Szybki checklist ✅

- [ ] Bucket `avatars` istnieje w Supabase Storage
- [ ] Bucket jest **publiczny** (public)
- [ ] Kolumna `avatar_url` istnieje w tabeli `profiles`
- [ ] RLS policies są ustawione (4 policies)
- [ ] Użytkownik jest zalogowany
- [ ] Elementy HTML są w DOM (#profileAvatarImg, #avatarUpload, #btnUploadAvatar)
- [ ] Pliki JS są załadowane (js/profile.js, js/account.js)
- [ ] Nie ma błędów w Console przy ładowaniu strony

### Dalsze kroki

Jeśli problem nadal występuje:

1. Skopiuj całą zawartość Console (wszystkie błędy)
2. Wykonaj `checkAvatarSetup()` i skopiuj wynik
3. Sprawdź Network tab (F12 → Network) i poszukaj failed requestów do Supabase
4. Udostępnij błędy do debugowania

---

**Ostatnia aktualizacja**: 2025-10-31
