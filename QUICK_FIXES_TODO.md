# ✅ QUICK FIXES - DO ZROBIENIA NATYCHMIAST

## 🔴 PRIORYTET KRYTYCZNY (Dzisiaj)

### 1. Scentralizować Supabase Config (30 min)
**Pliki do zmiany:**
- Utworzyć `/js/config.js`
- Usunąć meta tagi z HTML
- Update wszystkie importy

### 2. Dodać CSP Headers (1h)
**Plik:** Dodać do każdego HTML
```html
<meta http-equiv="Content-Security-Policy" content="...">
```

### 3. Dodać Meta Descriptions (30 min)
**Pliki:**
- packing.html
- tasks.html
- achievements.html
- attractions.html

### 4. Usunąć console.log (Setup) (1h)
**Action:** Dodać build script z terser

---

## ⚠️ PRIORYTET WYSOKI (Ten tydzień)

### 5. Skip Links (30 min)
Dodać do wszystkich stron głównych

### 6. Conditional Leaflet Loading (1h)
Usunąć z packing, tasks, vip HTML

### 7. Lazy Loading Images (1h)
Dodać loading="lazy" do <img>

### 8. Self-host Fonts (2h)
Download Jost, setup local

### 9. Netlify Config (30 min)
Rozszerzyć netlify.toml

---

## 🟡 NASTĘPNY KROK (Za tydzień)

### 10. Split app.js - PLAN
- Utworzyć /js/core/
- Utworzyć /js/features/
- Migracja modułowa

### 11. Setup Vite
- package.json update
- vite.config.js
- Test build

---

**TOTAL CZAS (Quick wins):** ~7 godzin
**IMPACT:** Massywna poprawa wydajności i bezpieczeństwa
