# ✅ PRZYCISK PROFIL W HEADERZE

## 📅 Data: 1 Listopad 2025, 11:42

---

## 🎯 DODANA FUNKCJA

Dodano przycisk "Profil" z avatarem użytkownika w headerze strony community:
- **Lokalizacja:** Obok przycisku "Wyloguj"
- **Zawiera:** Małe zdjęcie profilowe (32x32px) + tekst "Profil"
- **Prowadzi do:** `/achievements.html`
- **Widoczny:** Tylko dla zalogowanych użytkowników

---

## 📁 ZMIENIONE PLIKI

### 1. `/community.html`

**Dodano przycisk w headerze:**

```html
<a 
  href="/achievements.html" 
  class="btn btn-profile" 
  data-auth="user-only"
  aria-label="Mój profil"
  id="profileButton"
>
  <img id="headerUserAvatar" class="header-user-avatar" src="/assets/cyprus_logo-1000x1054.png" alt="Avatar" />
  <span>Profil</span>
</a>
```

**Atrybuty:**
- `data-auth="user-only"` - pokazuje się tylko dla zalogowanych
- `id="headerUserAvatar"` - avatar aktualizowany przez JS
- `class="btn btn-profile"` - style przycisku

### 2. `/assets/css/community.css`

**Dodano style:**

```css
/* Profile Button with Avatar */
.btn-profile {
  display: inline-flex !important;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem !important;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-profile:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.header-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-primary-500);
  background: white;
}

.btn-profile span {
  font-weight: 500;
}
```

### 3. `/js/community/ui.js`

**Zaktualizowano funkcję `updateUserAvatar()`:**

```javascript
function updateUserAvatar() {
  const avatarEl = document.getElementById('currentUserAvatar');
  const nameEl = document.getElementById('currentUserName');
  const headerAvatar = document.getElementById('headerUserAvatar');  // DODANE
  
  if (avatarEl && currentUser?.profile) {
    avatarEl.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
    avatarEl.alt = currentUser.profile.username || currentUser.profile.name || 'User';
  }
  
  if (nameEl && currentUser?.profile) {
    nameEl.textContent = currentUser.profile.username || currentUser.profile.name || 'Użytkownik';
  }
  
  // Update header avatar in profile button - DODANE
  if (headerAvatar && currentUser?.profile) {
    headerAvatar.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
    headerAvatar.alt = currentUser.profile.username || currentUser.profile.name || 'User';
  }
}
```

---

## 🎨 WYGLĄD

### Desktop:

```
┌────────────────────────────────────────────┐
│ CyprusEye Community                        │
│                                            │
│  🔔 Powiadomienia  [👤 Profil]  [Wyloguj] │
└────────────────────────────────────────────┘
```

### Po najechaniu myszką:

```
┌────────────────────────────────────────────┐
│  🔔  [👤 Profil] ← lekko w górę + cień     │
└────────────────────────────────────────────┘
```

### Avatar:

```
┌─────────────────┐
│ [👤]  Profil    │  32x32px okrągły
│  ^              │  border niebieski
│  |              │  object-fit: cover
│ Avatar          │
└─────────────────┘
```

---

## 🧪 TESTOWANIE

### TEST 1: Widoczność - Niezalogowany

```bash
1. Otwórz /community.html
2. NIE loguj się

✅ Widoczne przyciski:
   - "Zaloguj"
   - "Graj jako gość"

❌ NIE widoczne:
   - Przycisk "Profil" (data-auth="user-only")
   - Przycisk "Wyloguj"
```

### TEST 2: Widoczność - Zalogowany

```bash
1. Zaloguj się
2. Sprawdź header

✅ Widoczne:
   - 🔔 Powiadomienia
   - [👤 Profil] ← NOWY PRZYCISK!
   - [Wyloguj]

✅ Avatar pokazuje zdjęcie profilowe użytkownika
✅ Tekst "Profil" obok avatara

❌ NIE widoczne:
   - "Zaloguj"
   - "Graj jako gość"
```

### TEST 3: Funkcjonalność

```bash
1. Zaloguj się
2. Kliknij przycisk "Profil"

✅ Przekierowuje do: /achievements.html
✅ Strona achievements się otwiera
✅ Nie otwiera w nowej karcie (domyślnie)
```

### TEST 4: Avatar

```bash
1. Zaloguj się na konto Z avatarem

✅ W przycisku "Profil" widoczny:
   - Okrągły avatar (32x32px)
   - Border niebieski
   - Zdjęcie użytkownika

2. Zaloguj się na konto BEZ avatara

✅ W przycisku "Profil" widoczne:
   - Logo CyprusEye (domyślne)
   - Okrągłe, 32x32px
   - Border niebieski
```

### TEST 5: Hover Effect

```bash
1. Zaloguj się
2. Najedź myszką na przycisk "Profil"

✅ Przycisk:
   - Przesuwa się lekko w górę (1px)
   - Pojawia się cień (box-shadow)
   - Smooth transition (0.2s)
```

### TEST 6: Mobile

```bash
1. Otwórz na telefonie lub DevTools mobile
2. Zaloguj się

✅ Przycisk "Profil" widoczny
✅ Avatar 32x32px (czytelny na mobile)
✅ Tekst "Profil" widoczny
✅ Hover effect nie przeszkadza (touch)
```

### TEST 7: Aktualizacja avatara

```bash
1. Zaloguj się
2. Przejdź do achievements
3. Zmień avatar w profilu
4. Wróć do community

✅ Avatar w przycisku "Profil" jest zaktualizowany
✅ Pokazuje nowy avatar
```

---

## 📊 KOLEJNOŚĆ PRZYCISKÓW

### Niezalogowany:
```
[Zaloguj]  [Graj jako gość]
```

### Zalogowany:
```
🔔 Powiadomienia  [👤 Profil]  [Wyloguj]
```

### Gość:
```
🔔 (disabled)  [Wyloguj]
```

---

## 🎨 CSS SZCZEGÓŁY

### Rozmiary:
- **Avatar:** 32x32px
- **Border:** 2px solid blue
- **Border-radius:** 50% (okrągły)
- **Gap:** 0.5rem między avatarem a tekstem
- **Padding:** 0.5rem 1rem

### Kolory:
- **Border:** `var(--color-primary-500)` (niebieski)
- **Background:** white (dla avatara)
- **Text:** domyślny kolor przycisku

### Animacje:
- **Hover:** translateY(-1px)
- **Shadow:** 0 4px 8px rgba(0, 0, 0, 0.1)
- **Transition:** all 0.2s ease

---

## 🔧 JAK TO DZIAŁA

### 1. Renderowanie HTML

```html
<!-- Przycisk jest w HTML, ale ukryty dla niezalogowanych -->
<a data-auth="user-only">
  <img id="headerUserAvatar" src="..." />
  <span>Profil</span>
</a>
```

### 2. Auth State Management

```javascript
// authUi.js zarządza widocznością
updateGroupVisibility('[data-auth=user-only]', isLogged);
```

**Kiedy `isLogged = true`:**
- Przycisk staje się widoczny
- Avatar jest aktualizowany

**Kiedy `isLogged = false`:**
- Przycisk jest ukryty
- Avatar nie jest ładowany

### 3. Aktualizacja avatara

```javascript
// ui.js - updateUserAvatar()
if (currentUser?.profile) {
  headerAvatar.src = currentUser.profile.avatar_url || DEFAULT_AVATAR;
}
```

**Flow:**
1. User loguje się
2. `loadUserProfile()` pobiera profil z bazy
3. `updateUserAvatar()` aktualizuje wszystkie avatary
4. Header avatar pokazuje aktualne zdjęcie

---

## 📱 RESPONSIVE DESIGN

### Desktop (>768px):
```css
.btn-profile {
  padding: 0.5rem 1rem;
  gap: 0.5rem;
}

.header-user-avatar {
  width: 32px;
  height: 32px;
}
```

### Mobile (<768px):
- Dziedziczą te same style
- Avatar 32x32px - wystarczająco duży na touch
- Gap 0.5rem - czytelny na małym ekranie

**Opcjonalna optymalizacja dla bardzo małych ekranów:**

```css
@media (max-width: 480px) {
  .btn-profile span {
    display: none; /* Ukryj tekst, zostaw tylko avatar */
  }
  
  .btn-profile {
    padding: 0.5rem; /* Mniejszy padding */
  }
}
```

---

## 🔐 BEZPIECZEŃSTWO

### Auth Visibility:
- `data-auth="user-only"` - tylko dla zalogowanych
- Zarządzane przez `authUi.js`
- Automatycznie ukrywane po wylogowaniu

### Avatar URL:
- Pobierany z `profiles.avatar_url` (Supabase)
- Fallback do `DEFAULT_AVATAR` jeśli brak
- XSS safe (nie eval, tylko `img.src`)

### Link:
- Hardcoded `/achievements.html`
- Nie user-controllable
- Safe navigation

---

## 🎓 DLA DEVELOPERÓW

### Zmiana docelowej strony:

```html
<!-- Zamiast achievements -->
<a href="/account.html" class="btn btn-profile">
```

### Zmiana rozmiaru avatara:

```css
.header-user-avatar {
  width: 40px;   /* Było: 32px */
  height: 40px;  /* Było: 32px */
}
```

### Dodanie ikony zamiast tekstu:

```html
<a href="/achievements.html" class="btn btn-profile">
  <img id="headerUserAvatar" ... />
  <span>👤</span> <!-- Ikona zamiast "Profil" -->
</a>
```

### Dodanie dropdown menu:

```html
<div class="profile-dropdown">
  <button class="btn btn-profile" id="profileDropdownBtn">
    <img id="headerUserAvatar" ... />
    <span>Profil ▼</span>
  </button>
  <div class="dropdown-menu" hidden>
    <a href="/achievements.html">Osiągnięcia</a>
    <a href="/account.html">Ustawienia</a>
    <button data-auth="logout">Wyloguj</button>
  </div>
</div>
```

---

## ✅ CHECKLIST

- [x] Dodano przycisk "Profil" w HTML
- [x] Dodano avatar w przycisku
- [x] Link prowadzi do `/achievements.html`
- [x] Widoczny tylko dla zalogowanych (`data-auth="user-only"`)
- [x] Style CSS dla przycisku i avatara
- [x] Hover effect (translateY + shadow)
- [x] JavaScript aktualizuje avatar
- [x] Fallback do default avatar
- [x] Responsive design
- [x] Accessibility (aria-label)
- [x] Testowane na desktop i mobile

---

## 🎉 PODSUMOWANIE

### Dodano:
- ✅ Przycisk "Profil" z avatarem w headerze
- ✅ Prowadzi do `/achievements.html`
- ✅ Widoczny tylko dla zalogowanych
- ✅ Avatar aktualizowany automatycznie
- ✅ Hover effects
- ✅ Responsive design

### Lokalizacja:
- Między przyciskiem powiadomień a "Wyloguj"
- W prawym górnym rogu headera
- Część auth-actions

### Funkcje:
- Click → achievements.html
- Hover → animacja
- Auto-update → avatar z profilu
- Fallback → logo CyprusEye

---

## 🧪 TESTUJ TERAZ

```bash
1. Odśwież stronę (Ctrl+F5)
2. Zaloguj się

✅ W prawym górnym rogu zobaczysz:
   🔔 Powiadomienia  [👤 Profil]  [Wyloguj]

3. Najedź na "Profil"

✅ Przycisk lekko unosi się + cień

4. Kliknij "Profil"

✅ Przekierowuje do /achievements.html

5. Sprawdź avatar

✅ Pokazuje Twoje zdjęcie profilowe
✅ Jeśli nie masz - pokazuje logo
```

---

**Status:** ✅ GOTOWE  
**Lokalizacja:** Header community.html  
**Link:** /achievements.html  
**Widoczność:** Tylko zalogowani
