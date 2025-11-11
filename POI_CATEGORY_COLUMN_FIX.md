# ✅ POI EDIT - CATEGORY COLUMN FIX

## ❌ **BŁĄD:**
```
Could not find the category column of 'poi' or the schema cache
```

## 🔍 **PRZYCZYNA:**
Próbowałem zapisać do kolumny `category` która **nie istnieje** w tabeli `pois`:

```javascript
const updateData = {
  name: name,
  description: description,
  category: category,  // ❌ Ta kolumna nie istnieje!
  // ...
};
```

## 🔧 **ROZWIĄZANIE:**
Usunąłem `category` z obiektu `updateData`:

```javascript
const updateData = {
  name: name,
  description: description,
  // category: category,  ✅ USUNIĘTE
  xp: xp,
  status: status,
  // ...
};
```

---

## 📋 **CO ZAPISUJĘ TERAZ:**

### **Update POI:**
```javascript
{
  name: "Limassol - Marina",
  description: "Nowoczesna przystań...",
  lat: 34.755670,
  lng: 32.404170,
  xp: 600,
  status: "published",
  radius: 150,
  google_url: "https://...",
  tags: ["city explorer", "heritage"],
  // I18N fields (jeśli używane):
  name_i18n: { pl: "...", en: "...", el: "...", he: "..." },
  description_i18n: { pl: "...", en: "...", el: "...", he: "..." },
  badge_i18n: { pl: "...", en: "...", el: "...", he: "..." }
}
```

---

## 📁 **ZMODYFIKOWANE PLIKI:**

### **1. admin/admin.js**
```diff
- category: category,
```

### **2. dist/admin/admin.js**
✅ Skopiowane

---

## ✅ **STATUS:**

| Feature | Status |
|---------|--------|
| **POI Edit - All fields visible** | ✅ DZIAŁA |
| **POI Edit - Save (no category error)** | ✅ **NAPRAWIONE** |
| **POI Add** | ✅ DZIAŁA |
| **Cars i18n** | ⏳ Czeka na test POI |
| **Trips i18n** | ⏳ Czeka na test POI |
| **Hotels i18n** | ⏳ Czeka na test POI |
| **Quests i18n** | ⏳ Czeka na test POI |

---

## 🧪 **PRZETESTUJ:**

1. Deploy do Cloudflare
2. Otwórz admin panel → POIs
3. Kliknij "Edit" na POI
4. Zmień jakieś dane (np. Name, XP, Status)
5. Kliknij "Save Changes"
6. ✅ Powinno zapisać się **BEZ BŁĘDU**

---

## 📝 **NOTATKA:**

Pole "Category" nadal **jest widoczne** w formularzu, ale **nie jest zapisywane** do bazy.
To pole może być używane tylko do wyświetlania (normalizePoi używa `badge` zamiast `category`).

Jeśli chcesz używać category, trzeba:
1. Dodać kolumnę `category` do tabeli `pois` w SQL
2. Dodać z powrotem `category: category` do `updateData`

---

**Data:** 2025-01-11 02:33 AM  
**Status:** ✅ READY TO TEST - Category error fixed
