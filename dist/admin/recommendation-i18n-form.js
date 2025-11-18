/**
 * RECOMMENDATION I18N FORM COMPONENT
 * Multilingual form with language tabs for recommendations
 */

// Auto-save timer
let recAutoSaveTimer = null;

/**
 * Render Recommendation form with i18n tabs
 */
function renderRecommendationI18nForm(rec = null) {
  const languages = [
    { code: 'pl', label: '🇵🇱 Polski', required: true, rtl: false },
    { code: 'en', label: '🇬🇧 English', required: true, rtl: false },
    { code: 'el', label: '🇬🇷 Ελληνικά', required: false, rtl: false },
    { code: 'he', label: '🇮🇱 עברית', required: false, rtl: true }
  ];
  
  // Load draft if exists
  const draftKey = `rec_draft_${rec?.id || 'new'}`;
  const draft = localStorage.getItem(draftKey);
  const data = draft ? JSON.parse(draft) : rec;
  
  return `
    <form id="recI18nForm" onsubmit="handleRecI18nSubmit(event)" oninput="scheduleRecAutoSave()">
      ${draft ? `
        <div class="draft-notice">
          💾 Draft saved: ${new Date(JSON.parse(draft).savedAt).toLocaleString()}
          <button type="button" onclick="clearRecDraft('${draftKey}')">Clear</button>
        </div>
      ` : ''}
      
      <!-- Basic fields (non-translatable) -->
      <div class="form-section">
        <h4>Basic Information</h4>
        
        <div class="form-row">
          <div class="form-field">
            <label>Category *</label>
            <select name="category_id" required>
              <option value="">Select category...</option>
              ${recommendationsCategories.map(cat => `
                <option value="${cat.id}" ${data?.category_id === cat.id ? 'selected' : ''}>
                  ${cat.name_pl} / ${cat.name_en}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-field">
            <label>Display Order</label>
            <input type="number" name="display_order" value="${data?.display_order || 0}" min="0">
            <small>0 = highest, displayed first</small>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-field">
            <label>
              <input type="checkbox" name="active" ${data?.active !== false ? 'checked' : ''}>
              Active
            </label>
          </div>
          <div class="form-field">
            <label>
              <input type="checkbox" name="featured" ${data?.featured ? 'checked' : ''}>
              Featured (⭐ gold star)
            </label>
          </div>
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
                    onclick="switchRecLangTab('${lang.code}')">
              ${lang.label} ${lang.required ? '<span class="required">*</span>' : ''}
            </button>
          `).join('')}
        </div>
        
        ${languages.map((lang, i) => `
          <div class="lang-content ${i === 0 ? 'active' : ''}" 
               data-lang="${lang.code}"
               ${lang.rtl ? 'dir="rtl"' : ''}>
            
            <div class="form-field">
              <label>Title (${lang.code.toUpperCase()}) ${lang.required ? '*' : ''}</label>
              <input type="text" 
                     name="title_${lang.code}" 
                     value="${data?.[`title_${lang.code}`] || ''}"
                     ${lang.required ? 'required' : ''}
                     placeholder="Enter title in ${lang.label}">
            </div>
            
            <div class="form-field">
              <label>Description (${lang.code.toUpperCase()}) ${lang.required ? '*' : ''}</label>
              <textarea name="description_${lang.code}" 
                        rows="4"
                        ${lang.required ? 'required' : ''}
                        placeholder="Enter description in ${lang.label}">${data?.[`description_${lang.code}`] || ''}</textarea>
            </div>
            
            <div class="form-field">
              <label>Discount Text (${lang.code.toUpperCase()})</label>
              <input type="text" 
                     name="discount_text_${lang.code}" 
                     value="${data?.[`discount_text_${lang.code}`] || ''}"
                     placeholder="e.g., 15% discount with promo code">
            </div>
            
            <div class="form-field">
              <label>Special Offer (${lang.code.toUpperCase()})</label>
              <textarea name="offer_text_${lang.code}" 
                        rows="2"
                        placeholder="e.g., Book now and get free breakfast!">${data?.[`offer_text_${lang.code}`] || ''}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
      
      <!-- Location -->
      <div class="form-section">
        <h4>Location</h4>
        <div class="form-field">
          <label>Location Name *</label>
          <input type="text" name="location_name" value="${data?.location_name || ''}" required placeholder="e.g., Larnaka, Paphos, Limassol...">
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Latitude</label>
            <input type="number" name="latitude" step="0.000001" value="${data?.latitude || ''}" placeholder="34.9176">
          </div>
          <div class="form-field">
            <label>Longitude</label>
            <input type="number" name="longitude" step="0.000001" value="${data?.longitude || ''}" placeholder="33.6369">
          </div>
        </div>
      </div>
      
      <!-- Media & Links -->
      <div class="form-section">
        <h4>Media & Links</h4>
        <div class="form-field">
          <label>Image URL</label>
          <input type="url" name="image_url" value="${data?.image_url || ''}" placeholder="https://...">
          <small>Upload to Supabase Storage or use external URL</small>
        </div>
        <div class="form-field">
          <label>Google Maps URL</label>
          <input type="url" name="google_url" value="${data?.google_url || ''}" placeholder="https://maps.google.com/?q=...">
        </div>
        <div class="form-field">
          <label>Website URL</label>
          <input type="url" name="website_url" value="${data?.website_url || ''}" placeholder="https://...">
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Phone</label>
            <input type="tel" name="phone" value="${data?.phone || ''}" placeholder="+357...">
          </div>
          <div class="form-field">
            <label>Email</label>
            <input type="email" name="email" value="${data?.email || ''}" placeholder="contact@...">
          </div>
        </div>
      </div>
      
      <!-- Promo Code -->
      <div class="form-section">
        <h4>Promo Code</h4>
        <div class="form-field">
          <label>Promo Code</label>
          <input type="text" name="promo_code" value="${data?.promo_code || ''}" placeholder="CYPRUS2024">
          <small>Discount texts are translated above in each language tab</small>
        </div>
      </div>
      
      <input type="hidden" name="id" value="${data?.id || ''}">
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeRecI18nForm()">
          Cancel
        </button>
        <button type="submit" class="btn-primary">
          💾 Save Recommendation
        </button>
      </div>
    </form>
  `;
}

/**
 * Switch language tab
 */
function switchRecLangTab(langCode) {
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
function scheduleRecAutoSave() {
  clearTimeout(recAutoSaveTimer);
  recAutoSaveTimer = setTimeout(() => {
    const form = document.getElementById('recI18nForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const draft = {
      id: formData.get('id'),
      category_id: formData.get('category_id'),
      display_order: formData.get('display_order'),
      active: formData.get('active') === 'on',
      featured: formData.get('featured') === 'on',
      location_name: formData.get('location_name'),
      latitude: formData.get('latitude'),
      longitude: formData.get('longitude'),
      image_url: formData.get('image_url'),
      google_url: formData.get('google_url'),
      website_url: formData.get('website_url'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      promo_code: formData.get('promo_code'),
      savedAt: new Date().toISOString()
    };
    
    ['pl', 'en', 'el', 'he'].forEach(lang => {
      const title = formData.get(`title_${lang}`);
      const desc = formData.get(`description_${lang}`);
      const discount = formData.get(`discount_text_${lang}`);
      const offer = formData.get(`offer_text_${lang}`);
      
      if (title) draft[`title_${lang}`] = title.trim();
      if (desc) draft[`description_${lang}`] = desc.trim();
      if (discount) draft[`discount_text_${lang}`] = discount.trim();
      if (offer) draft[`offer_text_${lang}`] = offer.trim();
    });
    
    const draftKey = `rec_draft_${draft.id || 'new'}`;
    localStorage.setItem(draftKey, JSON.stringify(draft));
    console.log('✅ Draft auto-saved');
  }, 2000);
}

/**
 * Clear draft
 */
function clearRecDraft(key) {
  localStorage.removeItem(key);
  showToast('Draft cleared', 'info');
  closeRecI18nForm();
}

/**
 * Close form
 */
function closeRecI18nForm() {
  document.getElementById('recommendationFormModal').hidden = true;
  currentRecommendation = null;
}

/**
 * Submit handler
 */
async function handleRecI18nSubmit(event) {
  event.preventDefault();
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const formData = new FormData(event.target);
    
    const data = {
      category_id: formData.get('category_id'),
      display_order: parseInt(formData.get('display_order')) || 0,
      active: formData.get('active') === 'on',
      featured: formData.get('featured') === 'on' || false,
      
      title_pl: formData.get('title_pl')?.trim() || null,
      title_en: formData.get('title_en')?.trim() || null,
      title_el: formData.get('title_el')?.trim() || null,
      title_he: formData.get('title_he')?.trim() || null,
      
      description_pl: formData.get('description_pl')?.trim() || null,
      description_en: formData.get('description_en')?.trim() || null,
      description_el: formData.get('description_el')?.trim() || null,
      description_he: formData.get('description_he')?.trim() || null,
      
      location_name: formData.get('location_name')?.trim() || null,
      latitude: formData.get('latitude') ? parseFloat(formData.get('latitude')) : null,
      longitude: formData.get('longitude') ? parseFloat(formData.get('longitude')) : null,
      
      image_url: formData.get('image_url')?.trim() || null,
      google_url: formData.get('google_url')?.trim() || null,
      website_url: formData.get('website_url')?.trim() || null,
      phone: formData.get('phone')?.trim() || null,
      email: formData.get('email')?.trim() || null,
      
      promo_code: formData.get('promo_code')?.trim() || null,
      discount_text_pl: formData.get('discount_text_pl')?.trim() || null,
      discount_text_en: formData.get('discount_text_en')?.trim() || null,
      discount_text_el: formData.get('discount_text_el')?.trim() || null,
      discount_text_he: formData.get('discount_text_he')?.trim() || null,
      
      offer_text_pl: formData.get('offer_text_pl')?.trim() || null,
      offer_text_en: formData.get('offer_text_en')?.trim() || null,
      offer_text_el: formData.get('offer_text_el')?.trim() || null,
      offer_text_he: formData.get('offer_text_he')?.trim() || null,
    };

    const recId = formData.get('id');
    
    if (recId && recommendationFormMode === 'edit') {
      // Update existing
      data.updated_by = adminState.user?.id;
      
      const { error } = await client
        .from('recommendations')
        .update(data)
        .eq('id', recId);

      if (error) throw error;
      showToast('Recommendation updated successfully', 'success');
    } else {
      // Insert new
      data.created_by = adminState.user?.id;
      
      const { error } = await client
        .from('recommendations')
        .insert([data]);

      if (error) throw error;
      showToast('Recommendation created successfully', 'success');
    }

    // Clear draft
    const draftKey = `rec_draft_${recId || 'new'}`;
    localStorage.removeItem(draftKey);
    
    closeRecI18nForm();
    await loadRecommendationsData();
    
  } catch (error) {
    console.error('Error saving recommendation:', error);
    showToast('Failed to save: ' + error.message, 'error');
  }
}
