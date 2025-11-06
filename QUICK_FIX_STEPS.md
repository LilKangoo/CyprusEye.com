# 🚀 SZYBKIE KROKI - Poziom się nie wyświetla

## ⚡ Co zrobić TERAZ:

### KROK 1: Odśwież stronę community
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### KROK 2: Otwórz konsolę (F12) i uruchom:
```javascript
await window.debugCommentLevels()
```

### KROK 3: Przeczytaj output w konsoli

Skrypt sprawdzi **automatycznie**:
- ✅ Czy kolumny `level` i `xp` istnieją w bazie
- ✅ Czy dane są pobierane poprawnie
- ✅ Czy CSS działa
- ✅ Twój profil

---

## 🔍 Co zobaczysz w konsoli:

### Jeśli wszystko działa poprawnie:
```
📥 Loading comments for POI: limassol-castle
📊 Sample comment profile data: { 
  total_comments: 3,
  first_comment: { level_value: 5 } 
}
👤 Comment render: user="Admin", level=5
```

### Jeśli kolumny nie istnieją:
```
❌ Błąd przy pobieraniu profiles: column "level" does not exist
💡 Rozwiązanie: Uruchom ADD_XP_COLUMNS_TO_PROFILES.sql
```

**CO ZROBIĆ:**
1. Otwórz Supabase Dashboard
2. SQL Editor
3. Wklej zawartość: `ADD_XP_COLUMNS_TO_PROFILES.sql`
4. Uruchom (Run)

### Jeśli profile są null:
```
⚠️ Brak danych profilu dla tego komentarza!
💡 Możliwa przyczyna: RLS policy blokuje dostęp
```

**CO ZROBIĆ:**
W Supabase SQL Editor uruchom:
```sql
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);
```

---

## 📊 Logi automatyczne

Po odświeżeniu strony i otwarciu modalu komentarzy, automatycznie zobaczysz:

```javascript
📥 Loading comments for POI: nazwa-miejsca
📊 Sample comment profile data: {
  total_comments: 2,
  first_comment: {
    id: "uuid",
    user_id: "uuid", 
    profile: {
      username: "Admin",
      level: 5,        // ← TO POWINNO BYĆ
      xp: 1250
    },
    has_level: true,   // ← TO POWINNO BYĆ true
    level_value: 5
  }
}

🔍 Full comment profile data: {
  comment_id: "uuid",
  profile: { username: "Admin", level: 5, xp: 1250 },
  has_level: true,
  level_value: 5
}

👤 Comment render: user="Admin", level=5
```

Jeśli widzisz `level_value: 1` lub `has_level: false` - **kolumny nie istnieją w bazie**.

---

## ⚠️ Błąd 406 - NAPRAWIONY

Błąd:
```
GET poi_rating_stats 406 (Not Acceptable)
```

**Status:** ✅ Naprawiony - już NIE blokuje renderowania komentarzy

Jeśli nadal widzisz ten błąd - to normalne, ratings są opcjonalne.

---

## 📁 Pliki zmienione:

1. ✅ `js/community/comments.js` - dodano level/xp + logi
2. ✅ `js/community/ui.js` - renderowanie badge + logi
3. ✅ `js/community/ratings.js` - naprawa błędu 406
4. ✅ `js/community/notifications.js` - dodano level/xp
5. ✅ `assets/css/community.css` - style dla badge

---

## 💡 TL;DR

1. **Odśwież stronę** (Ctrl+Shift+R)
2. **Otwórz konsolę** (F12)
3. **Uruchom:** `await window.debugCommentLevels()`
4. **Przeczytaj wynik** i zastosuj sugerowane rozwiązania

Jeśli widzisz błąd o braku kolumny → uruchom `ADD_XP_COLUMNS_TO_PROFILES.sql` w Supabase.

---

**Dokumentacja pełna:** `TEST_COMMENT_LEVEL.md`
**Skrypt diagnostyczny:** `DEBUG_COMMENT_LEVEL.js`
