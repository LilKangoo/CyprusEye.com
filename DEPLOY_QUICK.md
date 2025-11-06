# ⚡ SZYBKIE WDROŻENIE - 1 Komenda!

## ❌ Problem:
**Produkcja (cypruseye.com) nie ma markerów** - stare pliki na serwerze!

## ✅ Rozwiązanie:

### **Metoda 1: Automatyczny Skrypt** (NAJSZYBSZE!)

```bash
# W terminalu (w folderze projektu):
./deploy.sh
```

**To wykona automatycznie:**
1. ✅ `git add .`
2. ✅ `git commit`
3. ✅ `git push`
4. ✅ Netlify auto-deploy

**Czas: 30 sekund** ⚡

---

### **Metoda 2: Ręcznie (3 komendy)**

```bash
# Terminal:
git add .
git commit -m "Fix: Markery mapy"
git push origin main
```

**Czas: 1 minuta**

---

### **Metoda 3: Drag & Drop** (bez Git)

```
1. Otwórz: https://app.netlify.com/drop
2. Przeciągnij cały folder projektu
3. Poczekaj na upload
4. Gotowe!
```

**Czas: 3 minuty**

---

## 🧪 Po Wdrożeniu:

```
1. Poczekaj 2 minuty (Netlify deploy)
2. Otwórz: https://cypruseye.com
3. Wyczyść cache: Cmd+Shift+Delete
4. Hard refresh: Cmd+Shift+R
5. Sprawdź markery ✅
```

---

## 🔍 Sprawdź Status Deploy:

```
1. Idź do: https://app.netlify.com
2. Znajdź swoją stronę
3. Sprawdź "Deploys"
4. Poczekaj na: "✅ Published"
```

---

## 📚 Szczegółowa Dokumentacja:

Zobacz: `WDROZENIE_NAPRAWY.md`

---

**Polecam:** Użyj `./deploy.sh` - to najszybsze! ⚡
