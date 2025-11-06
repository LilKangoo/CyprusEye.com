# ✅ Naprawa: "TASKS_DATA not found or empty"

## 🐛 Problem
```
❌ TASKS_DATA not found or empty
init @ tasks-manager.js:32
```

Zadania nie wyświetlały się na stronie online, mimo że kod był poprawny.

## 🔍 Przyczyna
**Problem z kolejnością ładowania ES6 modules:**

ES6 moduł (`tasks-manager.js`) ładuje się **asynchronicznie** i wykonuje się **przed** zwykłymi skryptami, więc gdy moduł próbował odczytać `window.TASKS_DATA`, zmienna ta jeszcze nie istniała.

### Sekwencja błędna:
```
1. ⏳ app-core.js ładuje się
2. ⏳ import('./js/tasks-manager.js') - moduł zaczyna się ładować
3. ⏳ tasks-manager.js wykonuje kod
4. ❌ window.TASKS_DATA nie istnieje jeszcze!
5. ⏳ js/data-tasks.js ładuje TASKS_DATA (za późno!)
```

## ✅ Rozwiązanie

### 1. Przekazywanie TASKS_DATA jako parametr

**app-core.js** (linia 620):
```javascript
// PRZED (nie działało):
await tasksModule.initTasks();

// PO (działa):
await tasksModule.initTasks(TASKS_DATA);
```

**tasks-manager.js** (linia 20-31):
```javascript
// Dodano parametr tasksData
async init(tasksData = null) {
  // Użyj parametru zamiast polegać tylko na window
  this.tasks = tasksData || window.TASKS_DATA || [];
  
  if (this.tasks.length === 0) {
    console.error('❌ TASKS_DATA not found or empty');
    return;
  }
  // ... reszta kodu
}
```

### 2. Cache busting

Zaktualizowano wersję do `v=2.1`:
- `app-core.js?v=2.1`
- `js/data-tasks.js?v=2.1`
- Import modułu: `./js/tasks-manager.js?v=2.1`

## 📊 Sekwencja poprawna

```
1. ✅ js/data-tasks.js ładuje TASKS_DATA
2. ✅ app-core.js czeka na TASKS_DATA
3. ✅ initializeTasks() wywołuje import()
4. ✅ Przekazuje TASKS_DATA jako parametr
5. ✅ tasks-manager.js otrzymuje dane
6. ✅ Renderuje zadania
```

## 🧪 Weryfikacja

Po naprawie console powinien pokazać:

```javascript
✅ All data loaded:
   - Places: 30
   - Tasks: 22
   - Packing seasons: 4
🎯 Initializing tasks system...
🎯 Initializing Tasks Manager...
✅ Loaded X completed tasks
✅ Tasks Manager initialized with 22 tasks
✅ Tasks initialized via tasks-manager module
```

## 📝 Zmienione pliki

| Plik | Linia | Zmiana |
|------|-------|--------|
| `app-core.js` | 620 | Przekazywanie `TASKS_DATA` jako parametr |
| `app-core.js` | 617 | Cache busting `?v=2.1` w import() |
| `tasks-manager.js` | 20 | Parametr `tasksData` w `init()` |
| `tasks-manager.js` | 31 | Użycie parametru: `tasksData \|\| window.TASKS_DATA` |
| `tasks-manager.js` | 450 | Parametr w `initTasks(tasksData)` |
| `tasks.html` | 337-342 | Cache busting `?v=2.1` |

## ✅ Status

**Problem**: TASKS_DATA nie był dostępny w module ES6  
**Rozwiązanie**: Przekazywanie jako parametr + cache busting  
**Status**: 🟢 NAPRAWIONE

## 🚀 Deploy

Po wdrożeniu na serwer:
1. Sprawdź czy pliki z `?v=2.1` ładują się
2. Sprawdź console - powinny być logi z "Tasks Manager"
3. Sprawdź czy zadania się wyświetlają
4. Hard refresh w przeglądarce (`Ctrl+Shift+R`)

---

**Data**: 3 listopada 2025, 13:20  
**Fix**: Przekazywanie TASKS_DATA jako parametr funkcji
