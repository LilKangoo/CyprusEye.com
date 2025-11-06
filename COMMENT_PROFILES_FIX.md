# ✅ NAPRAWA WYŚWIETLANIA PROFILI W KOMENTARZACH

## 📅 Data: 1 Listopad 2025, 12:30

---

## 🎯 PROBLEM

### Objaw:
- **Wszyscy użytkownicy** (nawet zalogowani) widzieli domyślne logo i "Użytkownik" przy komentarzach
- Tylko **autor komentarza** widział swoje dane gdy był zalogowany
- **Niezalogowani** nie widzieli kim są komentujący
- **Inni zalogowani** nie widzieli profili innych użytkowników

### Oczekiwane zachowanie:
- **WSZYSCY** (zalogowani i niezalogowani) powinni widzieć:
  - Rzeczywiste zdjęcie profilowe autora komentarza
  - Username lub imię autora (priorytet: username > name)

---

## 🔍 DIAGNOZA

### Problem 1: Brak JOIN do profiles w loadComments

**Plik:** `/js/community/comments.js`

**Przed:**
```javascript
const { data: comments, error } = await sb
  .from('poi_comments')
  .select(`
    id,
    poi_id,
    user_id,
    content,
    ...
  `)
  // ❌ BRAK JOIN DO PROFILES!
```

**Efekt:** Komentarze nie miały danych o profilach użytkowników

### Problem 2: Niepotrzebne zapytanie w renderComment

**Plik:** `/js/community/ui.js`

**Przed:**
```javascript
async function renderComment(comment, isReply = false) {
  const sb = window.getSupabase();
  
  // ❌ DODATKOWE zapytanie do bazy dla KAŻDEGO komentarza
  const { data: profile } = await sb
    .from('profiles')
    .select('username, name, avatar_url')
    .eq('id', comment.user_id)
    .single();
  ...
}
```

**Problemy:**
- N+1 query problem (jedno zapytanie na każdy komentarz!)
- Nieefektywne
- Wolne ładowanie przy wielu komentarzach

---

## ✅ ROZWIĄZANIE

### 1. Dodano JOIN do profiles w loadComments

**Plik:** `/js/community/comments.js`

```javascript
// Get all parent comments with user profiles
const { data: comments, error } = await sb
  .from('poi_comments')
  .select(`
    id,
    poi_id,
    user_id,
    content,
    parent_comment_id,
    created_at,
    updated_at,
    is_edited,
    profiles (          // ✅ JOIN do tabeli profiles
      username,
      name,
      avatar_url
    )
  `)
  .eq('poi_id', poiId)
  .is('parent_comment_id', null)
  .order('created_at', { ascending: false });
```

**Co to daje:**
- Profile użytkowników pobierane w JEDNYM zapytaniu
- Dostępne dla wszystkich (zalogowanych i niezalogowanych)
- Dane w `comment.profiles`

### 2. Dodano JOIN do profiles w loadReplies

**To samo dla odpowiedzi na komentarze:**

```javascript
const { data: replies, error } = await sb
  .from('poi_comments')
  .select(`
    id,
    poi_id,
    user_id,
    content,
    parent_comment_id,
    created_at,
    updated_at,
    is_edited,
    profiles (          // ✅ JOIN do tabeli profiles
      username,
      name,
      avatar_url
    )
  `)
  .eq('parent_comment_id', parentCommentId)
  .order('created_at', { ascending: true });
```

### 3. Użycie już pobranych danych w renderComment

**Plik:** `/js/community/ui.js`

**Po:**
```javascript
async function renderComment(comment, isReply = false) {
  // ✅ Use profile data from JOIN (already loaded in loadComments)
  const profile = comment.profiles;
  
  // Priority: username > name > fallback
  let displayName = 'Użytkownik';
  if (profile) {
    if (profile.username && profile.username.trim()) {
      displayName = profile.username;
    } else if (profile.name && profile.name.trim()) {
      displayName = profile.name;
    }
  }
  
  const username = escapeHtml(displayName);
  const avatar = profile?.avatar_url || DEFAULT_AVATAR;
  ...
}
```

**Korzyści:**
- Brak dodatkowych zapytań do bazy
- Szybsze renderowanie
- Używa już pobranych danych

---

## 🔧 WYMAGANIA SUPABASE

### Foreign Key Relationship

Aby JOIN działał, musi istnieć relacja:

```sql
-- W tabeli poi_comments musi być foreign key:
ALTER TABLE poi_comments
  ADD CONSTRAINT poi_comments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;
```

**Sprawdź w Supabase:**
1. Table Editor → poi_comments
2. Kolumna `user_id` powinna mieć foreign key do `profiles.id`

### Row Level Security (RLS)

Profile muszą być dostępne publicznie (read-only):

```sql
-- Pozwól wszystkim czytać profile (bez logowania)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);
```

**Sprawdź w Supabase:**
1. Authentication → Policies → profiles
2. Musi być policy pozwalająca na SELECT dla wszystkich

---

## 📊 PRZED vs PO

### PRZED (Broken):

```
Query 1: SELECT * FROM poi_comments WHERE poi_id = 'x'
  → Zwraca: { user_id: 'abc', content: '...' }
  → Brak danych o użytkowniku!

Query 2: SELECT * FROM profiles WHERE id = 'abc'  ← dla KAŻDEGO komentarza
Query 3: SELECT * FROM profiles WHERE id = 'def'
Query 4: SELECT * FROM profiles WHERE id = 'ghi'
...

Result:
- Tylko autor widział swoje dane (bo był zalogowany)
- Inni widzieli "Użytkownik" + default avatar
- N+1 query problem
```

### PO (Fixed):

```
Query 1: SELECT 
  poi_comments.*,
  profiles.username,
  profiles.name,
  profiles.avatar_url
FROM poi_comments
LEFT JOIN profiles ON poi_comments.user_id = profiles.id
WHERE poi_id = 'x'

Result:
{
  user_id: 'abc',
  content: '...',
  profiles: {               ← Profile data included!
    username: 'john_doe',
    name: 'John Doe',
    avatar_url: 'https://...'
  }
}

✅ WSZYSCY widzą profile autorów
✅ Tylko 1 zapytanie zamiast N+1
✅ Szybkie ładowanie
```

---

## 🧪 TESTOWANIE

### Test 1: Niezalogowany użytkownik

```bash
1. Otwórz /community.html БEZ logowania
2. Kliknij dowolne miejsce z komentarzami
3. Sprawdź komentarze

✅ Powinno być widać:
   - Avatar użytkownika (nie default logo)
   - Username lub imię użytkownika (nie "Użytkownik")
   
❌ Jeśli widać:
   - Default logo + "Użytkownik"
   → Sprawdź RLS policies w Supabase
```

### Test 2: Zalogowany użytkownik (inny niż autor)

```bash
1. Zaloguj się na konto A
2. Zobacz komentarze od użytkownika B
3. Sprawdź czy widać dane użytkownika B

✅ Powinno być widać:
   - Avatar użytkownika B
   - Username użytkownika B
   
❌ Jeśli widać tylko swoje dane:
   → Problem z JOIN lub RLS
```

### Test 3: Sprawdź console

```bash
1. Otwórz DevTools (F12)
2. Zobacz Console
3. Sprawdź logi:

✅ Powinno być:
   "👤 Comment by user abc: username="john_doe", name="John", displaying as: "john_doe""
   
❌ Jeśli:
   "username="undefined", name="undefined""
   → Profile nie są pobierane z JOIN
```

### Test 4: Network tab

```bash
1. Otwórz DevTools → Network
2. Odśwież stronę community
3. Kliknij na miejsce z komentarzami
4. Sprawdź zapytania do Supabase

✅ Powinno być:
   - 1 zapytanie SELECT z JOIN
   - Payload zawiera: "profiles(username,name,avatar_url)"
   
❌ Jeśli:
   - Wiele zapytań SELECT do profiles
   → renderComment nadal robi dodatkowe query
```

---

## 🔧 TROUBLESHOOTING

### Problem: Nadal widać "Użytkownik"

**Możliwe przyczyny:**

1. **Brak foreign key relationship:**
```sql
-- Sprawdź w Supabase SQL Editor:
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'poi_comments' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- Powinno zwrócić: user_id → profiles.id
```

2. **Brak RLS policy:**
```sql
-- Sprawdź policies dla profiles:
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Dodaj jeśli brak:
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);
```

3. **Zła nazwa tabeli w JOIN:**
```javascript
// Spróbuj zmienić "profiles" na "profile":
profiles (...)  // lub
profile (...)
```

4. **Cache problemy:**
```bash
# Hard refresh:
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)
```

---

## 📋 CHECKLIST

### Kod:
- [x] JOIN do profiles w loadComments()
- [x] JOIN do profiles w loadReplies()
- [x] Usunięto dodatkowe query w renderComment()
- [x] Używa comment.profiles

### Supabase:
- [ ] Foreign key: poi_comments.user_id → profiles.id
- [ ] RLS policy: Public SELECT na profiles
- [ ] Tabela profiles ma kolumny: username, name, avatar_url

### Testing:
- [ ] Niezalogowani widzą profile
- [ ] Zalogowani widzą profile innych
- [ ] Tylko 1 query zamiast N+1
- [ ] Console pokazuje poprawne dane

---

## 🎯 PRIORYTET WYŚWIETLANIA

### Logika wyboru nazwy:

```javascript
if (profile.username && profile.username.trim()) {
  displayName = profile.username;        // 1. Priorytet
} else if (profile.name && profile.name.trim()) {
  displayName = profile.name;            // 2. Fallback
} else {
  displayName = 'Użytkownik';            // 3. Default
}
```

**Przykłady:**

| username | name | Wyświetlane |
|----------|------|-------------|
| john_doe | John Doe | john_doe |
| null | John Doe | John Doe |
| "" | John Doe | John Doe |
| john_doe | null | john_doe |
| null | null | Użytkownik |

---

## 🚀 PERFORMANCE

### Przed (N+1 problem):
```
1 query dla komentarzy (10 comments)
+ 10 queries dla profili (1 per comment)
+ 5 queries dla replies (1 per reply)
= 16 queries total ❌
```

### Po (Optimized):
```
1 query dla komentarzy z JOIN (10 comments + profiles)
+ 0 dodatkowych queries
= 1 query total ✅
```

**Zysk:**
- 94% mniej zapytań do bazy
- Szybsze ładowanie
- Mniejsze obciążenie Supabase

---

## 📝 PODSUMOWANIE

### Zmiany:
1. ✅ Dodano JOIN do `profiles` w `loadComments()`
2. ✅ Dodano JOIN do `profiles` w `loadReplies()`
3. ✅ Usunięto niepotrzebne query w `renderComment()`
4. ✅ Używamy `comment.profiles` zamiast robić nowe zapytania

### Efekt:
- ✅ **WSZYSCY** widzą prawdziwe profile komentujących
- ✅ Niezalogowani widzą kto skomentował
- ✅ Zalogowani widzą profile innych użytkowników
- ✅ 16x mniej zapytań do bazy (przykład: 1 zamiast 16)
- ✅ Szybsze ładowanie komentarzy

### Wymagania Supabase:
- ⚠️ Musi być foreign key: `poi_comments.user_id` → `profiles.id`
- ⚠️ Musi być RLS policy: Public SELECT na `profiles`

---

**Status:** ✅ KOD NAPRAWIONY - Wymaga weryfikacji relacji w Supabase
**Testuj:** Odśwież stronę i sprawdź czy profile się pokazują!
