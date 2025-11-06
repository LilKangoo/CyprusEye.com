# ZADANIE 3.2: Lazy Loading Images

**Czas:** 1 godzina  
**Priorytet:** ŚREDNI (Performance)  
**Ryzyko:** NISKIE

---

## KROK 1: Find all images (10 min)

```bash
grep -r '<img' *.html | grep -v 'loading=' | wc -l
```

Ile obrazów bez loading="lazy"? _____

---

## KROK 2: Dodać loading="lazy" (30 min)

### Reguła:
- **Above-the-fold images** (logo, hero): loading="eager" lub BRAK atrybutu
- **Below-the-fold images**: loading="lazy"

### Przykład - index.html:

**Logo (NIE ZMIENIAJ):**
```html
<img
  src="assets/cyprus_logo-1000x1054.png"
  alt="Logo"
  loading="eager"  <!-- ✅ Above fold -->
/>
```

**Obrazy poniżej (DODAJ lazy):**
```html
<img
  src="path/to/image.jpg"
  alt="Description"
  loading="lazy"  <!-- ✅ DODAJ -->
  width="800"
  height="600"
/>
```

### ZAWSZE dodaj width/height:
- Zapobiega layout shift (CLS)
- Lepszy Lighthouse score

---

## KROK 3: Edytować wszystkie HTML (30 min)

### Dla każdego pliku:
1. Otwórz
2. Znajdź <img> (bez loading=)
3. Dodaj loading="lazy" width height
4. Zapisz

### Checklist:
- [ ] index.html
- [ ] community.html
- [ ] achievements.html
- [ ] packing.html
- [ ] tasks.html
- [ ] vip.html
- [ ] cruise.html
- [ ] kupon.html
- [ ] car-rental.html
- [ ] attractions.html
- [ ] advertise.html

---

## KROK 4: TEST (10 min)

### Network throttling:
1. DevTools → Network
2. Throttling: "Slow 3G"
3. Reload page
4. Sprawdź: Czy obrazy ładują się stopniowo podczas scrollowania?

---

## COMMIT

```bash
git add *.html
git commit -m "Task 3.2: Add lazy loading to images

- Added loading='lazy' to below-fold images
- Added width/height to prevent layout shift
- Improved Cumulative Layout Shift (CLS)
- Reduced initial page load by deferring off-screen images"
```

---

## ✅ DONE

- [ ] loading="lazy" dodany
- [ ] width/height dodane
- [ ] Test passed
- [ ] Commit

---

**NASTĘPNE:** TASK_3.3_FONT_OPTIMIZATION.md
