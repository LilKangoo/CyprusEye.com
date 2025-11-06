# ZADANIE 3.1: Conditional Leaflet Loading

**Czas:** 1 godzina  
**Priorytet:** WYSOKI (Performance)  
**Ryzyko:** NISKIE

---

## KROK 1: Zidentyfikować strony BEZ mapy

### Strony z mapą (NIE ZMIENIAĆ):
- ✅ index.html - ma mapę
- ✅ community.html - ma mapę  
- ✅ attractions.html - ma mapę

### Strony BEZ mapy (DO USUNIĘCIA Leaflet):
- ❌ packing.html
- ❌ tasks.html
- ❌ vip.html
- ❌ cruise.html
- ❌ achievements.html
- ❌ kupon.html
- ❌ car-rental.html
- ❌ car-rental-landing.html
- ❌ autopfo.html
- ❌ advertise.html

---

## KROK 2: Usunąć Leaflet CSS z non-map pages (20 min)

### W KAŻDYM pliku z listy powyżej, USUNĄĆ:

```html
<!-- ❌ USUŃ TO -->
<link
  rel="preload"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  as="style"
  crossorigin
  data-leaflet-resource="style"
/>
<link
  rel="preload"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  as="script"
  crossorigin
  data-leaflet-resource="script"
/>
```

LUB jeśli jest normalny link:
```html
<!-- ❌ USUŃ TO -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin />
```

### Weryfikacja dla każdego:
- [ ] packing.html - Leaflet removed
- [ ] tasks.html - Leaflet removed
- [ ] vip.html - Leaflet removed
- [ ] cruise.html - Leaflet removed
- [ ] achievements.html - Leaflet removed
- [ ] kupon.html - Leaflet removed
- [ ] car-rental.html - Leaflet removed
- [ ] car-rental-landing.html - Leaflet removed
- [ ] autopfo.html - Leaflet removed
- [ ] advertise.html - Leaflet removed

---

## KROK 3: TEST każdej strony (20 min)

```bash
npm run serve
```

### Sprawdź WSZYSTKIE edytowane strony:
1. Otwórz stronę
2. DevTools Console - brak błędów?
3. DevTools Network - czy Leaflet NIE ładuje się?
4. Funkcjonalność działa?

### Checklist:
- [ ] packing.html - działa ✅
- [ ] tasks.html - działa ✅
- [ ] vip.html - działa ✅
- [ ] cruise.html - działa ✅
- [ ] achievements.html - działa ✅
- [ ] kupon.html - działa ✅
- [ ] car-rental.html - działa ✅
- [ ] car-rental-landing.html - działa ✅
- [ ] autopfo.html - działa ✅
- [ ] advertise.html - działa ✅

### Sprawdź strony Z mapą (NIE powinny być zmienione):
- [ ] index.html - mapa działa ✅
- [ ] community.html - mapa działa ✅
- [ ] attractions.html - mapa działa ✅

---

## KROK 4: Lighthouse Performance Test (10 min)

### Before/After comparison:

**Test packing.html:**
```bash
npx lighthouse http://localhost:3001/packing.html --only-categories=performance --output=json --output-path=./lighthouse-packing-before.json
```

Po zmianach:
```bash
npx lighthouse http://localhost:3001/packing.html --only-categories=performance --output=json --output-path=./lighthouse-packing-after.json
```

### Oczekiwany wynik:
- Performance score: +5-10 punktów
- Network payload: -50KB (Leaflet CSS/JS)
- FCP (First Contentful Paint): szybszy

### Zapisz wyniki:
**Before:** Performance ___ / 100  
**After:** Performance ___ / 100  
**Improvement:** +___ punktów

---

## KROK 5: Dynamic Loading dla map pages (10 min - OPCJONALNE)

### Jeśli chcesz dalej optymalizować:

W `index.html`, zamień:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

Na:
```html
<!-- Leaflet loaded dynamically -->
<script>
  // Load Leaflet only when map container is visible
  if (document.querySelector('#map')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
</script>
```

**UWAGA:** To może wymagać update app.js. Zrób to tylko jeśli masz czas.

---

## COMMIT

```bash
git add packing.html tasks.html vip.html cruise.html achievements.html
git add kupon.html car-rental.html car-rental-landing.html autopfo.html advertise.html
git commit -m "Task 3.1: Remove Leaflet from non-map pages

- Removed Leaflet CSS/JS from 10 pages without maps
- Reduced bundle size by ~50KB per page
- Lighthouse performance improved by 5-10 points
- All functionality tested and working
- Map pages (index, community, attractions) unchanged"
```

---

## ✅ DONE CRITERIA

- [ ] Leaflet usunięty z 10 stron
- [ ] Wszystkie strony działają
- [ ] Strony z mapą niezmienione
- [ ] Lighthouse test pokazuje improvement
- [ ] Network payload reduced
- [ ] Commit wykonany

**Before Performance:** ___ / 100  
**After Performance:** ___ / 100  
**Savings:** ___ KB

---

**POPRZEDNIE:** TASK_2.2_SKIP_LINKS.md  
**NASTĘPNE:** TASK_3.2_LAZY_LOADING.md
