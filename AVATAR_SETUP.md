# 📸 Instrukcja Konfiguracji Avatarów - Supabase

## ✅ Zrobione w kodzie

Kod został zaktualizowany i jest gotowy do użycia. Teraz musisz skonfigurować backend w Supabase.

---

## 🔧 Konfiguracja Supabase (WAŻNE!)

### Krok 1: Dodaj kolumnę `avatar_url` do tabeli `profiles`

W **Supabase SQL Editor** wykonaj:

```sql
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
```

### Krok 2: Utwórz bucket dla avatarów

1. Przejdź do **Storage** w Supabase Dashboard
2. Kliknij **"Create a new bucket"**
3. Nazwa bucketa: `avatars`
4. **Public bucket**: ✅ TAK (zaznacz checkbox)
5. Kliknij **"Create bucket"**

### Krok 3: Ustaw polityki RLS dla Storage

W **Supabase SQL Editor** wykonaj:

```sql
-- Pozwól użytkownikom uploadować własne avatary
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Pozwól użytkownikom aktualizować własne avatary
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Pozwól użytkownikom usuwać własne avatary
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Pozwól wszystkim odczytywać avatary (publiczne)
CREATE POLICY "Public avatar read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

---

## 🧪 Testowanie

Po wdrożeniu zmian:

1. Zaloguj się do aplikacji
2. Otwórz Panel Konta (Account Modal)
3. W sekcji "Twój profil" zobaczysz okrągły avatar (domyślnie ikona użytkownika)
4. Kliknij **"📷 Zmień zdjęcie"**
5. Wybierz plik (JPG, PNG, GIF, WebP, max 2MB)
6. Avatar powinien się zaktualizować
7. Przycisk **"🗑️ Usuń"** pojawi się po uploading avatara

### Sprawdź w Supabase:
- **Storage > avatars** → Powinien być folder z ID użytkownika i plik avatara
- **Table Editor > profiles** → Kolumna `avatar_url` powinna zawierać publiczny URL

---

## 📋 Zmiany w plikach

### Zmodyfikowane:
- ✅ `js/profile.js` - funkcje `uploadAvatar()`, `removeAvatar()`, dodano `avatar_url` do profilu
- ✅ `js/account.js` - obsługa upload/remove, renderowanie avatara
- ✅ `index.html` - sekcja avatara w account modal
- ✅ `assets/css/components.css` - style dla avatara

### Funkcjonalności:
- ✅ Upload zdjęcia profilowego (max 2MB)
- ✅ Walidacja typu pliku (tylko obrazy)
- ✅ Automatyczne usuwanie starego avatara przy uploading nowego
- ✅ Przycisk usuwania avatara z potwierdzeniem
- ✅ Domyślny avatar SVG (ikona użytkownika)
- ✅ Responsywność (mobile: 100px, desktop: 120px)
- ✅ Komunikaty sukcesu/błędu

---

## ⚠️ Znane ograniczenia

1. **Rozmiar pliku**: Max 2MB (można zwiększyć w `js/profile.js` linia 174)
2. **Typy plików**: JPG, PNG, GIF, WebP
3. **Storage**: Pliki są przechowywane w Supabase Storage (bucket: `avatars`)
4. **Nazewnictwo**: Pliki nazywane jako `{user_id}/avatar-{timestamp}.{ext}`

---

## 🚀 Następny krok

Po przetestowaniu avatarów, możemy przejść do implementacji **logowania przez nazwę użytkownika**.

Potwierdź że wszystko działa, a wtedy zacznę nad tym pracować! 👍
