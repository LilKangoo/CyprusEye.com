# Naprawa Problemu z Wylogowywaniem przy Odświeżeniu Strony

## Problem

Użytkownik był wylogowywany przy każdym odświeżeniu strony lub przejściu na inną podstronę, mimo że:
- Supabase miał włączone `multiTab: true`
- Była implementacja custom storage w `js/auth.js`
- Sesja była zapisywana do localStorage

## Przyczyna

Istniały **dwa niezależne systemy zapisu sesji** bez synchronizacji:

1. **Wbudowany storage Supabase** - automatyczny zapis sesji przez `@supabase/supabase-js`
2. **Custom storage** - funkcja `persistAuthSession()` zapisująca do klucza `ce_auth_session_v1`

Funkcja `loadAuthSession()` w `authUi.js` **nie odczytywała** custom storage, tylko sprawdzała Supabase storage, który czasami był pusty lub niezsynchronizowany.

Dodatkowo były **podwójne subskrypcje** `onAuthStateChange`:
- Jedna w `authUi.js` (poprawna)
- Druga na końcu `auth.js` (duplikat powodujący konflikty)

## Rozwiązanie

### 1. Naprawiono `loadAuthSession()` w `authUi.js`

Dodano odczytywanie custom storage **przed** sprawdzeniem Supabase:

```javascript
// KRYTYCZNE: Najpierw sprawdź custom storage przed Supabase
const ceAuthGlobal = window.CE_AUTH || {};
let persistedSnapshot = null;
try {
  if (typeof ceAuthGlobal.readPersistedSession === 'function') {
    persistedSnapshot = ceAuthGlobal.readPersistedSession();
    if (persistedSnapshot?.session && typeof ceAuthGlobal.applyPersistedSession === 'function') {
      ceAuthGlobal.applyPersistedSession(persistedSnapshot, { emitEvent: false });
      console.log('[auth-ui] Przywrócono sesję z custom storage');
    }
  }
} catch (error) {
  console.warn('Nie udało się przywrócić sesji z custom storage:', error);
}

// Użyj finalSession = session || persistedSnapshot?.session || null
```

### 2. Usunięto duplikat inicjalizacji z `auth.js`

Usunięto:
```javascript
refreshSessionAndProfile()
  .then(() => { updateAuthUI(); })
  .catch((error) => { /* ... */ });

sb.auth.onAuthStateChange(async () => {
  await refreshSessionAndProfile();
  updateAuthUI();
});
```

### 3. Ulepszona konfiguracja Supabase w `supabaseClient.js`

Dodano explicit storageKey i flowType:
```javascript
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-daoohnbnnowmmcizgvrq-auth-token',
    storage: window.localStorage,
    flowType: 'pkce',
    multiTab: true,
  },
})
```

### 4. Automatyczna inicjalizacja w `authUi.js`

Dodano auto-start `bootAuth()` przy załadowaniu strony:
```javascript
if (typeof window !== 'undefined') {
  window.bootAuth = bootAuth;
  window.updateAuthUI = updateAuthUI;
  
  // Automatyczna inicjalizacja przy załadowaniu strony
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootAuth().catch((error) => {
        console.warn('[auth-ui] Błąd podczas automatycznej inicjalizacji auth:', error);
      });
    });
  } else {
    bootAuth().catch((error) => {
      console.warn('[auth-ui] Błąd podczas automatycznej inicjalizacji auth:', error);
    });
  }
}
```

## Jak Testować

### Test 1: Odświeżenie strony
1. Zaloguj się na stronie
2. Sprawdź że jesteś zalogowany (widzisz nazwę użytkownika)
3. Odśwież stronę (F5 lub Cmd+R)
4. ✅ **Oczekiwany wynik**: Nadal jesteś zalogowany

### Test 2: Nawigacja między stronami
1. Zaloguj się na `/index.html`
2. Przejdź na `/vip.html`
3. Przejdź na `/attractions.html`
4. Wróć do `/index.html`
5. ✅ **Oczekiwany wynik**: Przez cały czas jesteś zalogowany

### Test 3: Wiele kart
1. Zaloguj się w karcie A
2. Otwórz nową kartę B z tą samą stroną
3. ✅ **Oczekiwany wynik**: W karcie B też jesteś zalogowany
4. Wyloguj się w karcie A
5. ✅ **Oczekiwany wynik**: Karta B też pokazuje stan wylogowany

### Test 4: Sprawdzenie localStorage

W konsoli przeglądarki sprawdź:
```javascript
// Custom storage
console.log('Custom:', localStorage.getItem('ce_auth_session_v1'));

// Supabase storage
console.log('Supabase:', localStorage.getItem('sb-daoohnbnnowmmcizgvrq-auth-token'));

// Oba powinny zawierać sesję
```

## Pliki Zmodyfikowane

1. `/js/authUi.js` - naprawa `loadAuthSession()`, auto-init
2. `/js/auth.js` - usunięcie duplikatu inicjalizacji
3. `/js/supabaseClient.js` - ulepszona konfiguracja storage

## Debug

W konsoli przeglądarki sprawdź:
```javascript
// Stan sesji
console.log('CE_STATE:', window.CE_STATE);

// Funkcje dostępne
console.log('bootAuth:', typeof window.bootAuth);
console.log('CE_AUTH:', window.CE_AUTH);

// Ręczne uruchomienie
window.bootAuth().then(() => console.log('Boot OK'));
```

## Rozwiązywanie Problemów

### Problem: Nadal się wylogowuję
1. Otwórz DevTools (F12)
2. Przejdź do Application → Local Storage
3. Sprawdź czy istnieją klucze:
   - `ce_auth_session_v1`
   - `sb-daoohnbnnowmmcizgvrq-auth-token`
4. W Console wpisz: `window.bootAuth()`
5. Sprawdź logi w konsoli

### Problem: W konsoli błędy
Sprawdź czy wszystkie pliki zostały poprawnie załadowane:
```javascript
console.log('Supabase client:', window.getSupabase);
console.log('CE_AUTH:', window.CE_AUTH);
```

## Data naprawy
2025-10-31
