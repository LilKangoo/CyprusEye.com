# 📋 QUESTS I18N MIGRATION PLAN

## 📊 CURRENT STATE

### Database Structure
- **Table:** `tasks` 
- **Filter:** `category = 'quest'`
- **Current Fields:**
  - `id` (TEXT, PRIMARY KEY) - slug identifier
  - `xp` (INTEGER) - experience points reward
  - `is_active` (BOOLEAN) - visibility toggle
  - `sort_order` (INTEGER) - display order
  - `category` (TEXT) - fixed value 'quest'
  - `title` (TEXT) - **NEEDS i18n** ⚠️
  - `description` (TEXT) - **NEEDS i18n** ⚠️
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)

### Admin Panel
- **File:** `admin/dashboard.html`
- **Location:** Lines 1087-1116 (view), 2283-2334 (modal)
- **Current Form Fields:**
  - ID (text input - slug)
  - Title (single text input) ⚠️
  - XP (number)
  - Sort Order (number)
  - Active (boolean select)
  - Description (single textarea) ⚠️

### Admin Logic
- **File:** `admin/admin.js`
- **Functions:**
  - `loadQuestsData()` (lines 3033-3067)
  - `openQuestForm()` (lines 3069-3101)
  - `handleQuestFormSubmit()` (lines 3121-3142)
  - `handleQuestEdit()` (lines 3116-3119)
  - `handleQuestDelete()` (lines 3103-3114)

### Frontend Usage
- **File:** `js/tasks.js`
- **Usage:**
  - Loads from `tasks` table where `category='quest'`
  - Uses `title` and `description` directly (no i18n) ⚠️
  - Lines 142-154: Maps DB data to TASKS array

---

## 🎯 MIGRATION GOALS

1. **Convert title & description to JSONB** for multi-language support
2. **Update admin panel** with i18n tabs component
3. **Update frontend** to use translated fields
4. **Maintain backward compatibility** during migration
5. **Follow established pattern** from Trips/Hotels/Cars

---

## 📝 MIGRATION STEPS

### ✅ STEP 1: DATABASE MIGRATION

**File:** `QUESTS_I18N_MIGRATION.sql`

```sql
-- 1. Backup current data
CREATE TABLE tasks_backup_i18n AS 
SELECT * FROM tasks WHERE category = 'quest';

-- 2. Add new JSONB columns (parallel to existing)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS title_i18n JSONB,
ADD COLUMN IF NOT EXISTS description_i18n JSONB;

-- 3. Migrate existing data
-- Assume current data is Polish (pl)
UPDATE tasks
SET 
  title_i18n = jsonb_build_object('pl', title),
  description_i18n = jsonb_build_object('pl', description)
WHERE category = 'quest' 
  AND title IS NOT NULL;

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_title_i18n 
ON tasks USING gin(title_i18n);

CREATE INDEX IF NOT EXISTS idx_tasks_description_i18n 
ON tasks USING gin(description_i18n);

-- 5. Verify migration
SELECT 
  id,
  title as old_title,
  title_i18n,
  description as old_description,
  description_i18n
FROM tasks 
WHERE category = 'quest'
LIMIT 5;

-- NOTE: Keep old columns for backward compatibility
-- We'll drop them after frontend is updated and tested
```

---

### ✅ STEP 2: ADMIN PANEL HTML UPDATE

**File:** `admin/dashboard.html`

**Replace lines 2304-2325:**

```html
<!-- BEFORE -->
<label class="admin-form-field">
  <span>Title</span>
  <input type="text" id="questTitle" name="title" placeholder="Optional display title" />
</label>

<label class="admin-form-field">
  <span>Description</span>
  <textarea id="questDescription" name="description" rows="3" placeholder="Optional quest description shown on /tasks"></textarea>
</label>
```

```html
<!-- AFTER -->
<label class="admin-form-field">
  <span>Title (i18n) *</span>
  <div id="questTitleI18nContainer"></div>
</label>

<label class="admin-form-field">
  <span>Description (i18n)</span>
  <div id="questDescriptionI18nContainer"></div>
</label>
```

---

### ✅ STEP 3: ADMIN LOGIC UPDATE

**File:** `admin/admin.js`

#### 3A. Update `openQuestForm()` (lines 3069-3101)

**Add after line 3080:**

```javascript
// Render i18n components for title and description
if (window.renderI18nInput && window.renderI18nTextarea) {
  const titleContainer = $('#questTitleI18nContainer');
  const descContainer = $('#questDescriptionI18nContainer');
  
  if (titleContainer) {
    const titleData = (mode === 'edit' && quest?.title_i18n) 
      ? quest.title_i18n 
      : (mode === 'edit' && quest?.title) 
        ? { pl: quest.title } 
        : {};
    
    window.renderI18nInput(
      titleContainer,
      'title',
      titleData,
      { placeholder: 'Quest title', required: true }
    );
  }
  
  if (descContainer) {
    const descData = (mode === 'edit' && quest?.description_i18n) 
      ? quest.description_i18n 
      : (mode === 'edit' && quest?.description) 
        ? { pl: quest.description } 
        : {};
    
    window.renderI18nTextarea(
      descContainer,
      'description',
      descData,
      { placeholder: 'Quest description (optional)', rows: 3 }
    );
  }
}
```

**Remove legacy lines (3085, 3089, 3094, 3098):**
- `if (titleInput) titleInput.value = quest.title || '';`
- `if (descInput) descInput.value = quest.description || '';`
- `if (titleInput) titleInput.value = '';`
- `if (descInput) descInput.value = '';`

---

#### 3B. Update `handleQuestFormSubmit()` (lines 3121-3142)

**Replace lines 3126-3132:**

```javascript
// BEFORE
const id = ($('#questId').value || '').trim();
const qtitle = ($('#questTitle').value || '').trim();
const xp = Number($('#questXp').value || '0') || 0;
const sort_order = Number($('#questSort').value || '1000') || 1000;
const is_active = $('#questActive').value === 'true';
const description = ($('#questDescription').value || '').trim();
const payload = { id, xp, sort_order, is_active, category: 'quest', title: qtitle || null, description: description || null };
```

```javascript
// AFTER
const id = ($('#questId').value || '').trim();
const xp = Number($('#questXp').value || '0') || 0;
const sort_order = Number($('#questSort').value || '1000') || 1000;
const is_active = $('#questActive').value === 'true';

// Extract i18n values
const fd = new FormData($('#questForm'));
const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;

// Validate title (at least one language required)
if (window.validateI18nField) {
  const titleError = window.validateI18nField(titleI18n, 'Title');
  if (titleError) {
    showToast(titleError, 'error');
    return;
  }
}

// Build payload
const payload = { 
  id, 
  xp, 
  sort_order, 
  is_active, 
  category: 'quest'
};

// Add i18n fields
if (titleI18n) payload.title_i18n = titleI18n;
if (descriptionI18n) payload.description_i18n = descriptionI18n;

// Clean legacy fields (backward compatibility)
payload.title = null;
payload.description = null;
```

---

#### 3C. Update `loadQuestsData()` (lines 3033-3067)

**Update line 3041 to include i18n fields:**

```javascript
// BEFORE
.select('id,xp,is_active,sort_order,category,title,description')

// AFTER
.select('id,xp,is_active,sort_order,category,title,description,title_i18n,description_i18n')
```

**Update line 3054 to show translated title in table:**

```javascript
// BEFORE
<td>${escapeHtml(q.id)}</td>

// AFTER
<td>
  ${escapeHtml(q.id)}
  ${q.title_i18n?.pl || q.title_i18n?.en || q.title || ''}
</td>
```

---

### ✅ STEP 4: FRONTEND UPDATE

**File:** `js/tasks.js`

#### 4A. Add i18n helper function (after line 10)

```javascript
/**
 * Get translated quest title
 */
function getQuestTitle(quest) {
  if (!quest) return '';
  
  const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'pl';
  
  // Try i18n field first
  if (quest.title_i18n && typeof quest.title_i18n === 'object') {
    if (quest.title_i18n[currentLang]) return quest.title_i18n[currentLang];
    if (quest.title_i18n.pl) return quest.title_i18n.pl;
    if (quest.title_i18n.en) return quest.title_i18n.en;
  }
  
  // Fallback to legacy field
  if (quest.title) return quest.title;
  
  // Fallback to ID
  return quest.id;
}

/**
 * Get translated quest description
 */
function getQuestDescription(quest) {
  if (!quest) return '';
  
  const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'pl';
  
  // Try i18n field first
  if (quest.description_i18n && typeof quest.description_i18n === 'object') {
    if (quest.description_i18n[currentLang]) return quest.description_i18n[currentLang];
    if (quest.description_i18n.pl) return quest.description_i18n.pl;
    if (quest.description_i18n.en) return quest.description_i18n.en;
  }
  
  // Fallback to legacy field
  return quest.description || '';
}

// Make functions globally accessible
window.getQuestTitle = getQuestTitle;
window.getQuestDescription = getQuestDescription;
```

---

#### 4B. Update data loading (lines 137-154)

**Update line 137 to include i18n fields:**

```javascript
// BEFORE
let query = sb.from('public_tasks').select('id,xp,sort_order,title,description');

// AFTER
let query = sb.from('public_tasks').select('id,xp,sort_order,title,description,title_i18n,description_i18n');
```

**Update line 142:**

```javascript
// BEFORE
.select('id,xp,sort_order,is_active,category,title,description')

// AFTER
.select('id,xp,sort_order,is_active,category,title,description,title_i18n,description_i18n')
```

**Update line 153 to use i18n helpers:**

```javascript
// BEFORE
TASKS.push({ 
  id: row.id, 
  xp: Number(row.xp)||0, 
  requiredLevel: 1, 
  title: row.title || null, 
  description: row.description || null 
});

// AFTER
TASKS.push({ 
  id: row.id, 
  xp: Number(row.xp)||0, 
  requiredLevel: 1, 
  title: getQuestTitle(row), 
  description: getQuestDescription(row),
  // Keep raw data for future use
  _raw: row
});
```

---

#### 4C. Add language change listener (end of file)

```javascript
// Register language change handler for quest re-rendering
if (typeof window.registerLanguageChangeHandler === 'function') {
  window.registerLanguageChangeHandler((language) => {
    console.log('📋 Tasks: Re-loading for language:', language);
    
    // Reload tasks from DB to get fresh translations
    loadTasksFromDB().then(success => {
      if (success) {
        console.log('✅ Tasks reloaded with new language');
        // Trigger any UI updates if needed
        window.dispatchEvent(new CustomEvent('tasksLanguageChanged'));
      }
    });
  });
}
```

---

### ✅ STEP 5: languageSwitcher.js HELPERS

**File:** `js/languageSwitcher.js`

**Add after Trip functions (around line 460):**

```javascript
/**
 * Get a translated field from a quest/task object
 * @param {Object} quest - Quest/Task object
 * @param {string} fieldName - Field to translate (e.g., 'title', 'description')
 * @returns {string} Translated value
 */
function getQuestTranslatedField(quest, fieldName) {
  if (!quest) return '';
  
  const currentLang = getCurrentLanguage();
  const i18nField = `${fieldName}_i18n`;
  
  // Check if i18n field exists
  if (quest[i18nField] && typeof quest[i18nField] === 'object') {
    // Try current language
    if (quest[i18nField][currentLang]) return quest[i18nField][currentLang];
    
    // Fallback to Polish
    if (quest[i18nField].pl) return quest[i18nField].pl;
    
    // Fallback to English
    if (quest[i18nField].en) return quest[i18nField].en;
  }
  
  // Fallback to legacy field (backward compatibility)
  if (typeof quest[fieldName] === 'string') return quest[fieldName];
  
  return '';
}

/**
 * Convenience function to get translated quest title
 * @param {Object} quest - Quest object
 * @returns {string} Translated title
 */
function getQuestTitle(quest) {
  return getQuestTranslatedField(quest, 'title') || quest.id || 'Unnamed Quest';
}

/**
 * Convenience function to get translated quest description
 * @param {Object} quest - Quest object
 * @returns {string} Translated description
 */
function getQuestDescription(quest) {
  return getQuestTranslatedField(quest, 'description') || '';
}

// Make Quest functions globally accessible
window.getQuestTitle = getQuestTitle;
window.getQuestDescription = getQuestDescription;
window.getQuestTranslatedField = getQuestTranslatedField;
```

---

## 🧪 TESTING PLAN

### 1. Database Migration Testing
```sql
-- Run migration script
\i QUESTS_I18N_MIGRATION.sql

-- Verify all quests migrated
SELECT 
  id,
  title,
  title_i18n,
  description,
  description_i18n
FROM tasks 
WHERE category = 'quest';

-- Test: Should show Polish in title_i18n
```

### 2. Admin Panel Testing

**Test A: Create New Quest**
1. Open Admin → Quests
2. Click "New Quest"
3. Fill i18n tabs:
   - PL: "Test Quest PL"
   - EN: "Test Quest EN"
   - EL: "Test Quest EL"
4. Save
5. Verify in database

**Test B: Edit Existing Quest**
1. Click "Edit" on existing quest
2. Verify i18n tabs show correct values
3. Update EN translation
4. Save
5. Verify update in database

**Test C: Legacy Data Handling**
1. Edit quest with old `title` field
2. Verify fallback to `{pl: old_title}`
3. Add EN translation
4. Save
5. Verify both languages saved

### 3. Frontend Testing

**Test A: Quest Display**
1. Open `/tasks` page
2. Switch language to EN
3. Verify quest titles show English
4. Switch to PL
5. Verify titles show Polish

**Test B: Language Auto-Refresh**
1. Open `/tasks`
2. Click language switcher
3. Verify quests refresh in 0.2s
4. No page reload needed

**Test C: Fallback Behavior**
1. Quest with only PL translation
2. Switch to EN
3. Should show PL as fallback
4. No errors in console

---

## 📊 ROLLBACK PLAN

If migration fails:

```sql
-- 1. Restore from backup
DELETE FROM tasks WHERE category = 'quest';
INSERT INTO tasks SELECT * FROM tasks_backup_i18n;

-- 2. Remove i18n columns
ALTER TABLE tasks 
DROP COLUMN IF EXISTS title_i18n,
DROP COLUMN IF EXISTS description_i18n;

-- 3. Drop backup table
DROP TABLE IF EXISTS tasks_backup_i18n;
```

---

## ✅ COMPLETION CHECKLIST

- [ ] Create `QUESTS_I18N_MIGRATION.sql`
- [ ] Run database migration
- [ ] Verify data migrated correctly
- [ ] Update `admin/dashboard.html` (form fields)
- [ ] Update `admin/admin.js` (openQuestForm)
- [ ] Update `admin/admin.js` (handleQuestFormSubmit)
- [ ] Update `admin/admin.js` (loadQuestsData)
- [ ] Update `js/tasks.js` (add i18n helpers)
- [ ] Update `js/tasks.js` (data loading)
- [ ] Update `js/tasks.js` (language change listener)
- [ ] Update `js/languageSwitcher.js` (add Quest helpers)
- [ ] Test: Create new quest with i18n
- [ ] Test: Edit existing quest
- [ ] Test: Frontend display
- [ ] Test: Language switching
- [ ] Test: Fallback behavior
- [ ] Copy to `dist/`
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Clean up legacy fields (after 1 week)

---

## 🎯 ESTIMATED TIME

- Database Migration: 15 min
- Admin Panel Update: 30 min
- Frontend Update: 30 min
- Testing: 30 min
- **Total: ~2 hours**

---

## 📌 NOTES

1. **Follows established pattern** from Trips/Hotels/Cars migrations
2. **Backward compatible** - keeps old fields during transition
3. **Uses existing i18n component** from `universal-i18n-component.js`
4. **Auto-refresh support** via `languageRefresh.js`
5. **Database indexed** for performance
6. **Rollback ready** with backup table

---

## 🔗 RELATED FILES

- Migration pattern: `TRIPS_I18N_MIGRATION.sql`
- I18n component: `admin/universal-i18n-component.js`
- Language refresh: `js/languageRefresh.js`
- Similar helpers: `js/languageSwitcher.js` (getTripName, getHotelName)
