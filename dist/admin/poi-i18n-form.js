/**
 * POI I18N FORM COMPONENT
 * Multilingual form with language tabs
 */

// Auto-save timer
let poiAutoSaveTimer = null;

/**
 * Render POI form with i18n tabs
 */
function renderPOII18nForm(poi = null) {
  const languages = [
    { code: 'pl', label: '🇵🇱 Polski', required: true, rtl: false },
    { code: 'en', label: '🇬🇧 English', required: true, rtl: false },
    { code: 'el', label: '🇬🇷 Ελληνικά', required: false, rtl: false },
    { code: 'he', label: '🇮🇱 עברית', required: false, rtl: true }
  ];
  
  // Load draft if exists
  const draftKey = `poi_draft_${poi?.id || 'new'}`;
  const draft = localStorage.getItem(draftKey);
  const data = draft ? JSON.parse(draft) : poi;
  
  return `
    <form id="poiI18nForm" onsubmit="handlePOII18nSubmit(event)" oninput="schedulePoiAutoSave()">
      ${draft ? `
        <div class="draft-notice">
          💾 Draft saved: ${new Date(JSON.parse(draft).savedAt).toLocaleString()}
          <button type="button" onclick="clearPoiDraft('${draftKey}')">Clear</button>
        </div>
      ` : ''}
      
      <!-- Basic fields (non-translatable) -->
      <div class="form-section">
        <h4>Basic Information</h4>
        <div class="form-row">
          <div class="form-field">
            <label>Latitude *</label>
            <input type="number" name="lat" step="any" value="${data?.lat || data?.latitude || ''}" required>
          </div>
          <div class="form-field">
            <label>Longitude *</label>
            <input type="number" name="lng" step="any" value="${data?.lng || data?.longitude || ''}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>XP Points</label>
            <input type="number" name="xp" value="${data?.xp || 100}">
          </div>
          <div class="form-field">
            <label>Radius (m)</label>
            <input type="number" name="radius" value="${data?.radius || 500}">
          </div>
          <div class="form-field">
            <label>Status</label>
            <select name="status">
              <option value="published" ${data?.status === 'published' ? 'selected' : ''}>Published</option>
              <option value="draft" ${data?.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="hidden" ${data?.status === 'hidden' ? 'selected' : ''}>Hidden</option>
            </select>
          </div>
        </div>
        <div class="form-field">
          <label>Google Maps URL</label>
          <input type="url" name="google_url" value="${data?.google_url || ''}">
        </div>
      </div>
      
      <!-- Language tabs -->
      <div class="form-section">
        <h4>Translations</h4>
        <p class="form-hint">🇵🇱 Polish and 🇬🇧 English are required</p>
        
        <div class="lang-tabs">
          ${languages.map((lang, i) => `
            <button type="button" 
                    class="lang-tab ${i === 0 ? 'active' : ''}" 
                    data-lang="${lang.code}"
                    onclick="switchPoiLangTab('${lang.code}')">
              ${lang.label} ${lang.required ? '<span class="required">*</span>' : ''}
            </button>
          `).join('')}
        </div>
        
        ${languages.map((lang, i) => `
          <div class="lang-content ${i === 0 ? 'active' : ''}" 
               data-lang="${lang.code}"
               ${lang.rtl ? 'dir="rtl"' : ''}>
            
            <div class="form-field">
              <label>Name (${lang.code.toUpperCase()}) ${lang.required ? '*' : ''}</label>
              <input type="text" 
                     name="name_${lang.code}" 
                     value="${data?.name_i18n?.[lang.code] || (lang.code === 'pl' && data?.name) || ''}"
                     ${lang.required ? 'required' : ''}
                     placeholder="Enter POI name in ${lang.label}">
            </div>
            
            <div class="form-field">
              <label>Description (${lang.code.toUpperCase()}) ${lang.required ? '*' : ''}</label>
              <textarea name="description_${lang.code}" 
                        rows="4"
                        ${lang.required ? 'required' : ''}
                        placeholder="Enter description in ${lang.label}">${data?.description_i18n?.[lang.code] || (lang.code === 'pl' && data?.description) || ''}</textarea>
            </div>
            
            <div class="form-field">
              <label>Badge (${lang.code.toUpperCase()})</label>
              <input type="text" 
                     name="badge_${lang.code}" 
                     value="${data?.badge_i18n?.[lang.code] || (lang.code === 'pl' && data?.badge) || ''}"
                     placeholder="e.g., Beach Explorer, Mountain Hiker">
            </div>
          </div>
        `).join('')}
      </div>
      
      <input type="hidden" name="id" value="${data?.id || ''}">
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closePoiI18nForm()">
          Cancel
        </button>
        <button type="submit" class="btn-primary">
          💾 Save POI
        </button>
      </div>
    </form>
  `;
}

/**
 * Switch language tab
 */
function switchPoiLangTab(langCode) {
  document.querySelectorAll('.lang-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === langCode);
  });
  
  document.querySelectorAll('.lang-content').forEach(div => {
    div.classList.toggle('active', div.dataset.lang === langCode);
  });
}

/**
 * Auto-save draft
 */
function schedulePoiAutoSave() {
  clearTimeout(poiAutoSaveTimer);
  poiAutoSaveTimer = setTimeout(() => {
    const form = document.getElementById('poiI18nForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const draft = {
      id: formData.get('id'),
      lat: formData.get('lat'),
      lng: formData.get('lng'),
      xp: formData.get('xp'),
      radius: formData.get('radius'),
      status: formData.get('status'),
      google_url: formData.get('google_url'),
      name_i18n: {},
      description_i18n: {},
      badge_i18n: {},
      savedAt: new Date().toISOString()
    };
    
    ['pl', 'en', 'el', 'he'].forEach(lang => {
      const name = formData.get(`name_${lang}`);
      const desc = formData.get(`description_${lang}`);
      const badge = formData.get(`badge_${lang}`);
      
      if (name) draft.name_i18n[lang] = name.trim();
      if (desc) draft.description_i18n[lang] = desc.trim();
      if (badge) draft.badge_i18n[lang] = badge.trim();
    });
    
    const draftKey = `poi_draft_${draft.id || 'new'}`;
    localStorage.setItem(draftKey, JSON.stringify(draft));
    console.log('✅ Draft auto-saved');
  }, 2000);
}

/**
 * Clear draft
 */
function clearPoiDraft(key) {
  localStorage.removeItem(key);
  showToast('Draft cleared', 'info');
  closePoiI18nForm();
}

/**
 * Submit handler
 */
async function handlePOII18nSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  
  // Build payload
  const payload = {
    lat: parseFloat(formData.get('lat')),
    lng: parseFloat(formData.get('lng')),
    xp: parseInt(formData.get('xp')) || 100,
    radius: parseInt(formData.get('radius')) || 500,
    status: formData.get('status') || 'published',
    google_url: formData.get('google_url') || null,
    name_i18n: {},
    description_i18n: {},
    badge_i18n: {}
  };
  
  // Collect translations
  ['pl', 'en', 'el', 'he'].forEach(lang => {
    const name = formData.get(`name_${lang}`);
    const desc = formData.get(`description_${lang}`);
    const badge = formData.get(`badge_${lang}`);
    
    if (name && name.trim()) payload.name_i18n[lang] = name.trim();
    if (desc && desc.trim()) payload.description_i18n[lang] = desc.trim();
    if (badge && badge.trim()) payload.badge_i18n[lang] = badge.trim();
  });
  
  // Validate required languages
  if (!payload.name_i18n.pl || !payload.name_i18n.en) {
    showToast('Nazwa wymagana w języku polskim i angielskim!', 'error');
    return;
  }
  if (!payload.description_i18n.pl || !payload.description_i18n.en) {
    showToast('Opis wymagany w języku polskim i angielskim!', 'error');
    return;
  }
  
  // Backward compatibility - keep old columns synced
  payload.name = payload.name_i18n.pl;
  payload.description = payload.description_i18n.pl;
  payload.badge = payload.badge_i18n.pl || 'Explorer';
  
  // Save to database
  try {
    const sb = ensureSupabase();
    if (!sb) {
      throw new Error('Supabase not available');
    }
    
    const poiId = formData.get('id');
    let result;
    
    if (poiId) {
      // Update existing
      const { data, error } = await sb
        .from('pois')
        .update(payload)
        .eq('id', poiId)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      showToast('✅ POI zaktualizowane pomyślnie!', 'success');
    } else {
      // Create new
      const { data, error } = await sb
        .from('pois')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      showToast('✅ POI utworzone pomyślnie!', 'success');
    }
    
    // Clear draft
    localStorage.removeItem(`poi_draft_${poiId || 'new'}`);
    
    // Refresh list and close form
    await loadPoisData(true);
    closePoiI18nForm();
    
  } catch (err) {
    console.error('Save error:', err);
    showToast(`❌ Błąd zapisu: ${err.message}`, 'error');
  }
}

/**
 * Open POI i18n form
 */
function openPoiI18nForm(poiId = null) {
  let poi = null;
  if (poiId) {
    poi = adminState.pois.find(p => p.id === poiId);
  }
  
  const container = document.getElementById('poiFormContainer');
  if (!container) {
    console.error('POI form container not found');
    return;
  }
  
  container.innerHTML = renderPOII18nForm(poi);
  container.style.display = 'block';
  
  // Scroll to top
  container.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Close POI i18n form
 */
function closePoiI18nForm() {
  const container = document.getElementById('poiFormContainer');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

// Make functions global
window.renderPOII18nForm = renderPOII18nForm;
window.switchPoiLangTab = switchPoiLangTab;
window.schedulePoiAutoSave = schedulePoiAutoSave;
window.clearPoiDraft = clearPoiDraft;
window.handlePOII18nSubmit = handlePOII18nSubmit;
window.openPoiI18nForm = openPoiI18nForm;
window.closePoiI18nForm = closePoiI18nForm;
