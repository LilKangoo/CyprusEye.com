# 🧪 Test wyświetlania poziomu użytkownika w komentarzach

## Zmiany wprowadzone:

### 1. ✅ Aktualizacja zapytań Supabase
- **`js/community/comments.js`** - dodano `level, xp` do zapytań `loadComments()` i `loadReplies()`
- **`js/community/ui.js`** - dodano `level, xp` do zapytania `loadUserProfile()`
- **`js/community/notifications.js`** - dodano `level, xp` do zapytania profili w powiadomieniach

### 2. ✅ Aktualizacja renderowania
- **`js/community/ui.js`** - funkcja `renderComment()` teraz wyświetla poziom użytkownika
- Dodano `<div class="comment-author-name-row">` z nazwą użytkownika i poziomem
- Badge poziomu: `<span class="comment-author-level">Lvl ${userLevel}</span>`

### 3. ✅ Style CSS
- **`assets/css/community.css`** - dodano style dla:
  - `.comment-author-name-row` - kontener flex dla nazwy i poziomu
  - `.comment-author-level` - gradient badge z kolorami primary

## Jak przetestować:

### Krok 1: Sprawdź konsolę przeglądarki
Otwórz community.html i sprawdź console (F12):

```javascript
// Powinieneś zobaczyć logi:
✅ User profile loaded: { username: "...", level: X, xp: Y }
🔍 Full comment profile data: { comment_id: "...", profile: {...}, level_value: X }
👤 Comment render: user="...", level=X
```

### Krok 2: Zweryfikuj strukturę HTML
W DevTools (Inspect Element) znajdź komentarz i sprawdź strukturę:

```html
<div class="comment-author-info">
  <div class="comment-author-name-row">
    <span class="comment-author-name">Username</span>
    <span class="comment-author-level">Lvl 5</span>
  </div>
  <span class="comment-timestamp">...</span>
</div>
```

### Krok 3: Sprawdź czy CSS jest załadowany
W DevTools sprawdź czy `.comment-author-level` ma style:

```css
.comment-author-level {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
  color: white;
}
```

### Krok 4: Test w konsoli przeglądarki
Uruchom w konsoli aby sprawdzić czy level jest w profilu:

```javascript
// Sprawdź czy level jest pobierany
const sb = window.getSupabase();
const { data } = await sb.from('profiles').select('username, level, xp').limit(5);
console.log('Profile z level:', data);
```

### Krok 5: Jeśli poziom nadal nie widać

1. **Sprawdź czy kolumny istnieją w bazie:**
   - Otwórz Supabase Dashboard
   - Przejdź do Table Editor → profiles
   - Sprawdź czy są kolumny `level` (integer) i `xp` (integer)
   - Jeśli nie ma, uruchom plik `ADD_XP_COLUMNS_TO_PROFILES.sql`

2. **Wyczyść cache przeglądarki:**
   - Ctrl+Shift+R (hard refresh)
   - Lub wyczyść cache w ustawieniach

3. **Sprawdź błędy w konsoli:**
   - Szukaj błędów związanych z Supabase query
   - Sprawdź czy są błędy permisji (RLS policies)

## Jak to działa na żywo:

1. **Przy każdym załadowaniu komentarzy** - level jest pobierany z JOIN z tabelą profiles
2. **Automatyczna aktualizacja** - gdy użytkownik zdobywa nowy level, wyświetli się po odświeżeniu
3. **Domyślna wartość** - jeśli level nie istnieje, pokazuje "Lvl 1"

## Struktura danych:

```javascript
comment = {
  id: "uuid",
  user_id: "uuid",
  content: "text",
  profiles: {
    username: "username",
    name: "Full Name",
    avatar_url: "url",
    level: 5,        // ← NOWE
    xp: 1250         // ← NOWE
  }
}
```

## Kolejne kroki (opcjonalne):

### Realtime aktualizacje poziomu
Jeśli chcesz aby poziom aktualizował się na żywo bez odświeżania:

```javascript
// Dodaj subscription do zmian w profiles
const subscription = sb
  .channel('profile-changes')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'profiles' },
    (payload) => {
      // Zaktualizuj poziom w już załadowanych komentarzach
      updateCommentLevels(payload.new);
    }
  )
  .subscribe();
```

---

**Status:** ✅ Implementacja zakończona
**Testowane:** Czeka na weryfikację użytkownika
