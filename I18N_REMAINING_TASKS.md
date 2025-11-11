# 📋 I18N REMAINING TASKS

## ✅ **GOTOWE:**
- POI - hybrid mode, działa
- Cars - hybrid mode, gotowe do testu

---

## ⏳ **DO ZROBIENIA:**

### **1. TRIPS**

#### **Dashboard.html:**
```html
<!-- Zamienić: -->
<input name="title_pl" />         → <div id="tripTitleI18n"></div> + legacy
<textarea name="description_pl"/> → <div id="tripDescI18n"></div> + legacy
```

#### **Admin.js:**
- `editTrip()` - dodać hybrid mode logic
- `handleNewTripSubmit()` - dodać i18n extraction
- `handleEditTripSubmit()` - dodać i18n save

---

### **2. HOTELS**

#### **Dashboard.html:**
```html
<!-- Zamienić: -->
<input name="title_pl" />         → <div id="hotelTitleI18n"></div> + legacy
<textarea name="description_pl"/> → <div id="hotelDescI18n"></div> + legacy
```

#### **Admin.js:**
- `editHotel()` - dodać hybrid mode logic  
- `handleNewHotelSubmit()` - dodać i18n extraction
- `handleEditHotelSubmit()` - dodać i18n save

---

### **3. QUESTS (TASKS)**

#### **Dashboard.html:**
```html
<!-- Zamienić: -->
<input name="name" />             → <div id="questNameI18n"></div> + legacy
<textarea name="description" />   → <div id="questDescI18n"></div> + legacy
<textarea name="hint" />          → <div id="questHintI18n"></div> + legacy
```

#### **Admin.js:**
- `loadQuestsData()` / edit modal - dodać hybrid mode logic
- `handleQuestFormSubmit()` - dodać i18n extraction + save

---

## 🔧 **PATTERN DO ZASTOSOWANIA (TAK JAK W POI I CARS):**

### **1. Dashboard.html - Każda encja:**
```html
<!-- I18N Fields (hidden by default) -->
<div id="{entity}I18nFields" style="display: none;">
  <div id="{entity}TitleI18n"></div>
  <div id="{entity}DescriptionI18n"></div>
</div>

<!-- Legacy Fields (visible by default) -->
<div id="{entity}LegacyFields">
  <input id="{entity}Title" name="title" />
  <textarea id="{entity}Description" name="description"></textarea>
</div>
```

### **2. Admin.js - Open/Edit funkcja:**
```javascript
function openEntityModal(data = null) {
  // Check if i18n
  const useI18n = data?.title_i18n || data?.description_i18n;
  
  if (useI18n) {
    // Render i18n fields
    renderI18nInput('title', ...);
    renderI18nInput('description', ...);
    
    // Show i18n, hide legacy
    i18nFields.style.display = 'block';
    legacyFields.style.display = 'none';
  } else {
    // Show legacy
    i18nFields.style.display = 'none';
    legacyFields.style.display = 'block';
    
    // Fill legacy fields
    titleInput.value = data?.title || '';
    descInput.value = data?.description || '';
  }
}
```

### **3. Admin.js - Submit funkcja:**
```javascript
async function handleEntitySubmit(event) {
  // Check which mode
  const usingI18n = $('#entityI18nFields')?.style.display !== 'none';
  
  if (usingI18n) {
    // Extract i18n
    const titleI18n = extractI18nValues(formData, 'title');
    const descI18n = extractI18nValues(formData, 'description');
    
    // Validate
    if (validateI18nField(titleI18n, 'Title')) throw error;
    
    // Save
    const data = {
      title: titleI18n.pl,
      description: descI18n.pl,
      title_i18n: titleI18n,
      description_i18n: descI18n,
    };
  } else {
    // Use legacy
    const data = {
      title: $('#entityTitle').value,
      description: $('#entityDescription').value,
    };
  }
}
```

---

## 📊 **SZACOWANY CZAS:**

- Trips: ~15 min
- Hotels: ~15 min  
- Quests: ~20 min (3 pola zamiast 2)

**TOTAL: ~50 minut**

---

## 🎯 **OPCJE:**

**A)** Zrobię wszystkie 3 encje teraz (~50 min) → potem test wszystkich

**B)** Przetestuj Cars teraz → potem zrobię pozostałe 3

**C)** Zrobię tylko Trips teraz → test → potem Hotels → test → Quests → test

---

## ✅ **ZALECENIE:**

**OPCJA A** - Zrobię wszystkie naraz, używając gotowego patternu. Potem jeden deploy i test wszystkich encji razem.

**CZY MAM KONTYNUOWAĆ Z OPCJĄ A?** 🚀

---

**Data:** 2025-01-11 03:10 AM  
**Status:** Czeka na decyzję użytkownika
