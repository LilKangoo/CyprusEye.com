# ✅ Z-INDEX HIERARCHY FIX - Modal nad WSZYSTKIM na telefonie

## Problem ❌
Pop-up hotelu/wycieczki był **zasłaniany przez przełącznik języka** i inne elementy na telefonie.

### Przyczyna:
```
Language Selector: z-index: 10000-10001  ← Konflikt!
Trip/Hotel Modal:  z-index: 10000        ← Ten sam poziom!
```

Elementy na tym samym z-index **nakładają się chaotycznie**!

---

## ✅ ROZWIĄZANIE - Prawidłowa hierarchia

### `/css/modal-ios-fix.css` - JEDNA CENTRALNA DEFINICJA

```css
/* Z-INDEX HIERARCHY - FIXED FOR MOBILE */

/* 1. Lightbox (fullscreen photos) - NAJWYŻSZY */
.lightbox,
#imgLightbox {
  z-index: 20000 !important;
}

/* 2. Toast notifications - zawsze widoczne */
.toast-notifications,
.ce-toast {
  z-index: 15000 !important;
}

/* 3. Success popup - nad modalem gdy pokazuje sukces */
.success-popup-overlay {
  z-index: 12500 !important;
}

/* 4. Trip/Hotel Modals - NAD WSZYSTKIM (język, header, etc) */
.trip-modal,
#hotelModal,
#tripModal {
  z-index: 12000 !important;  ← KLUCZ! Wyższy niż language!
}

/* 5. Detail modal */
.detail-modal {
  z-index: 11000 !important;
}

/* 6. Language selector - PONIŻEJ modali rezerwacji */
.language-selector,
.language-selector-dialog,
.language-mobile-overlay,
.language-switcher-panel {
  z-index: 10000 !important;  ← Niższy niż modals!
}

/* 7. Tutorial overlay */
.tutorial-overlay {
  z-index: 9000 !important;
}

/* 8. Header - daleko poniżej */
header,
.header,
.app-header {
  z-index: 1000 !important;
}

/* 9. Mobile nav */
.mobile-nav {
  z-index: 1000 !important;
}
```

---

## 📊 NOWA HIERARCHIA Z-INDEX

```
┌─────────────────────────────────────────┐
│ 20000 - Lightbox (zdjęcia fullscreen)  │ ← Najwyższy
├─────────────────────────────────────────┤
│ 15000 - Toast Notifications             │
├─────────────────────────────────────────┤
│ 12500 - Success Popup                   │
├─────────────────────────────────────────┤
│ 12000 - Trip/Hotel Modals ✨ KLUCZ!     │ ← NAD językiem!
├─────────────────────────────────────────┤
│ 11000 - Detail Modal                    │
├─────────────────────────────────────────┤
│ 10000 - Language Selector               │ ← POD modalami!
├─────────────────────────────────────────┤
│  9000 - Tutorial Overlay                │
├─────────────────────────────────────────┤
│  1000 - Header + Mobile Nav             │
├─────────────────────────────────────────┤
│   100 - Other elements                  │
└─────────────────────────────────────────┘
```

---

## 🎯 CO SIĘ ZMIENIŁO

### PRZED ❌:
```
Language: 10000-10001
Modal:    10000          ← Ten sam poziom = konflikt!
```
**Rezultat:** Przełącznik języka mógł zasłaniać modal!

### PO ✅:
```
Modal:    12000   ← Wyższy!
Language: 10000   ← Niższy!
```
**Rezultat:** Modal **ZAWSZE** nad językiem!

---

## 🧪 TEST NA TELEFONIE

### iPhone/Android Chrome:
```
1. Otwórz stronę na telefonie
2. Kliknij na przełącznik języka (prawy górny róg)
3. ✅ Język się otwiera
4. Kliknij na hotel/wycieczkę
5. ✅ MODAL POJAWIA SIĘ NAD JĘZYKIEM!
6. ✅ Język jest ZAKRYTY przez modal
7. ✅ Nic nie blokuje widoku modala
```

### Test DevTools:
```
1. F12 → Device Toolbar (Ctrl+Shift+M)
2. iPhone 12 Pro
3. Otwórz language selector
4. Kliknij hotel
5. Inspect element → Computed styles
6. Modal powinien mieć: z-index: 12000
7. Language powinien mieć: z-index: 10000
```

---

## 🔍 DLACZEGO TO DZIAŁA

### 1. `!important` override
```css
z-index: 12000 !important;
```
- Nadpisuje WSZYSTKIE inne z-indexy
- Gwarantuje że modal jest na wierzchu

### 2. Centralna definicja
- **Wszystkie z-indexy w JEDNYM pliku**
- Łatwo zarządzać hierarchią
- Brak konfliktów między plikami CSS

### 3. Logiczny spacing
```
20000, 15000, 12500, 12000, 11000, 10000, 9000, 1000
```
- Duże odstępy między poziomami
- Łatwo dodać nowy element "pomiędzy"
- Czytelna struktura

---

## 📦 BUILD

```bash
✅ Build complete!
✅ css/modal-ios-fix.css updated
✅ dist/css/modal-ios-fix.css updated
```

---

## ✅ WERYFIKACJA

### Co sprawdzić:

1. **Hotel modal NAD językiem** ✅
   ```
   Click hotel → Modal z-index 12000
   Language z-index 10000
   Modal zasłania język ✓
   ```

2. **Trip modal NAD językiem** ✅
   ```
   Click trip → Modal z-index 12000
   Language z-index 10000
   Modal zasłania język ✓
   ```

3. **Success popup NAD modalem** ✅
   ```
   Submit booking → Popup z-index 12500
   Modal z-index 12000
   Popup zasłania modal ✓
   ```

4. **Lightbox NAD WSZYSTKIM** ✅
   ```
   Click photo → Lightbox z-index 20000
   Wszystko inne < 20000
   Lightbox na wierzchu ✓
   ```

5. **Header POD modalem** ✅
   ```
   Header z-index 1000
   Modal z-index 12000
   Header schowany pod modalem ✓
   ```

---

## 🎨 VISUAL VERIFICATION

### Mobile (iPhone/Android):

**Scenariusz 1: Language PRZED modalem**
```
1. Otwórz język
2. Otwórz hotel
   ✅ Hotel ZASŁANIA język
   ✅ Widzisz TYLKO modal hotelu
```

**Scenariusz 2: Language PODCZAS modala**
```
1. Otwórz hotel
2. Spróbuj otworzyć język (przycisk schowany)
   ✅ Nie możesz kliknąć przycisku języka
   ✅ Modal blokuje dostęp
```

**Scenariusz 3: Toast podczas modala**
```
1. Otwórz hotel
2. Toast się pojawia (np. error)
   ✅ Toast NAD modalem (15000 > 12000)
   ✅ Widzisz toast
```

---

## 🚨 EDGE CASES - Przetestowane

### 1. Wiele modalów naraz
```
Modal A (12000) + Modal B (12000) = Ostatni otwarty na wierzchu ✅
```

### 2. Language + Modal + Toast
```
Language (10000) < Modal (12000) < Toast (15000) ✅
Hierarchia zachowana!
```

### 3. Lightbox z modala
```
Modal (12000) → Click photo → Lightbox (20000) ✅
Lightbox nad modalem!
```

### 4. Success popup z modala
```
Modal (12000) → Submit → Success (12500) ✅
Success nad modalem!
```

---

## 📱 MOBILE-SPECIFIC FIXES

### iOS:
- ✅ Modal 12000 > Language 10000
- ✅ Body scroll locked
- ✅ 100dvh viewport
- ✅ -webkit-overflow-scrolling: touch

### Android:
- ✅ Modal 12000 > Language 10000
- ✅ Body scroll locked
- ✅ 100dvh support

---

## 🔧 TROUBLESHOOTING

### Problem: Language nadal nad modalem
**Fix:** Hard reload (Ctrl+Shift+R) - CSS cache

### Problem: Modal nie zasłania nic
**Fix:** Check z-index in DevTools
```
.trip-modal { z-index: 12000 !important; }
```

### Problem: Success popup pod modalem
**Fix:** Sprawdź czy jest 12500:
```
.success-popup-overlay { z-index: 12500 !important; }
```

---

## 🎯 FINAL CHECKLIST

- [x] Modal z-index: 12000 (wyższy niż language 10000)
- [x] Language z-index: 10000 (niższy niż modal)
- [x] Lightbox z-index: 20000 (najwyższy)
- [x] Success popup z-index: 12500 (nad modalem)
- [x] Toast z-index: 15000 (zawsze widoczny)
- [x] Header z-index: 1000 (daleko poniżej)
- [x] Wszystkie z !important (force override)
- [x] Centralna definicja w modal-ios-fix.css
- [x] Build successful
- [x] Tested on mobile emulation

---

## ✅ STATUS: COMPLETE! 🎉

**Modal hotelu/wycieczki jest teraz NAD WSZYSTKIM na telefonie!**

- ✅ Nad przełącznikiem języka
- ✅ Nad headerem
- ✅ Nad mobile nav
- ✅ Nad tutorialem
- ✅ Nic nie blokuje widoku modala!

**GOTOWE DO DEPLOY! 🚀📱**
