# ZADANIE 3.3: Font Optimization

**Czas:** 2 godziny  
**Priorytet:** ŚREDNI  
**Ryzyko:** ŚREDNI

---

## OPCJA A: Self-Host Fonts (Recommended - 2h)

### KROK 1: Download Jost fonts (15 min)

1. Google Fonts Helper: https://gwfh.mranftl.com/fonts/jost?subsets=latin
2. Select weights: 300, 400, 500, 600, 700
3. Download modern formats (woff2)
4. Unzip do `/assets/fonts/`

### KROK 2: @font-face w CSS (15 min)

Utworzyć `/assets/css/fonts.css`:
```css
@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url('/assets/fonts/jost-v14-latin-300.woff2') format('woff2');
}

@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/assets/fonts/jost-v14-latin-regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/assets/fonts/jost-v14-latin-500.woff2') format('woff2');
}

@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/assets/fonts/jost-v14-latin-600.woff2') format('woff2');
}

@font-face {
  font-family: 'Jost';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/assets/fonts/jost-v14-latin-700.woff2') format('woff2');
}
```

### KROK 3: Update HTML (30 min)

Zamienić w WSZYSTKICH HTML:
```html
<!-- ❌ USUŃ -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

<!-- ✅ DODAJ -->
<link rel="preload" href="/assets/fonts/jost-v14-latin-400.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/assets/css/fonts.css" />
```

### KROK 4: Test (15 min)
- Sprawdź czy fonty ładują się
- Network: brak requestów do Google Fonts
- Lighthouse: FOIT avoided

---

## OPCJA B: Preload Google Fonts (Fast - 30 min)

Jeśli nie chcesz self-host:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'" />
<noscript>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap" />
</noscript>
```

---

## COMMIT

```bash
git add assets/fonts/
git add assets/css/fonts.css
git add *.html
git commit -m "Task 3.3: Optimize font loading

- Self-hosted Jost font (woff2)
- Added font-display: swap
- Preload critical font files
- Eliminated Google Fonts network requests
- Improved First Contentful Paint"
```

---

**NASTĘPNE:** TASK_4.1_NETLIFY_CONFIG.md
