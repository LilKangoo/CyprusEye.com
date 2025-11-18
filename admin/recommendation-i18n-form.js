/**
 * RECOMMENDATION I18N FORM COMPONENT
 * Multilingual form with language tabs for recommendations
 */

// Auto-save timer
let recAutoSaveTimer = null;

/**
 * Render Recommendation form with i18n tabs
 */
window.renderRecommendationI18nForm = function(rec = null) {
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
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <select name="category_id" id="recCategorySelect" required style="flex: 1;">
                <option value="">Select category...</option>
                ${(() => {
                  const cats = window.recommendationsCategories || [];
                  console.log('📋 Rendering categories in form:', cats.length, cats);
                  return cats.map(cat => `
                    <option value="${cat.id}" ${data?.category_id === cat.id ? 'selected' : ''}>
                      ${cat.name_pl || cat.name_en} / ${cat.name_en}
                    </option>
                  `).join('');
                })()}
              </select>
              <button type="button" 
                      class="btn-secondary" 
                      onclick="openAddCategoryModal()"
                      style="white-space: nowrap; padding: 8px 12px;"
                      title="Add new category">
                ➕
              </button>
            </div>
            ${(() => {
              const cats = window.recommendationsCategories || [];
              return cats.length === 0 ? `
                <small style="color: #f59e0b; display: block; margin-top: 4px;">
                  ⚠️ No categories found. Click ➕ to add one.
                </small>
              ` : '';
            })()}
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
          <label>Image</label>
          
          ${data?.image_url ? `
            <div style="margin-bottom: 12px;">
              <img src="${data.image_url}" alt="Current image" style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover;">
            </div>
          ` : ''}
          
          <div style="margin-bottom: 8px;">
            <input type="file" 
                   id="recImageFile" 
                   accept="image/jpeg,image/png,image/webp,image/jpg" 
                   onchange="handleRecImageUpload(event)"
                   style="display: none;">
            <button type="button" 
                    class="btn-secondary" 
                    onclick="document.getElementById('recImageFile').click()"
                    style="width: 100%; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              📁 Upload Image
            </button>
            <small style="display: block; margin-top: 4px; color: var(--admin-text-muted);">
              Max 5MB • JPG, PNG, WEBP
            </small>
          </div>
          
          <div id="recImageProgress" style="display: none; margin: 8px 0;">
            <div style="background: var(--admin-bg-secondary); border-radius: 4px; overflow: hidden; height: 4px;">
              <div id="recImageProgressBar" style="background: var(--admin-primary); height: 100%; width: 0%; transition: width 0.3s;"></div>
            </div>
            <small style="color: var(--admin-text-muted); display: block; margin-top: 4px;">Uploading...</small>
          </div>
          
          <input type="hidden" name="image_url" id="recImageUrl" value="${data?.image_url || ''}">
          
          <small style="color: var(--admin-text-muted); display: block; margin-top: 4px;">
            Or paste URL: <input type="url" 
                                  placeholder="https://..." 
                                  value="${data?.image_url || ''}"
                                  onchange="document.getElementById('recImageUrl').value = this.value"
                                  style="width: 100%; margin-top: 4px; padding: 6px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 4px; color: var(--admin-text);">
          </small>
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
window.switchRecLangTab = function(langCode) {
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
window.scheduleRecAutoSave = function() {
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
window.clearRecDraft = function(key) {
  localStorage.removeItem(key);
  showToast('Draft cleared', 'info');
  closeRecI18nForm();
}

/**
 * Close form
 */
window.closeRecI18nForm = function() {
  document.getElementById('recommendationFormModal').hidden = true;
  if (typeof currentRecommendation !== 'undefined') {
    currentRecommendation = null;
  }
}

/**
 * Submit handler
 */
window.handleRecI18nSubmit = async function(event) {
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
    
    // Get mode from global scope or default to 'create'
    const mode = window.recommendationFormMode || 'create';
    
    if (recId && mode === 'edit') {
      // Update existing
      if (typeof adminState !== 'undefined' && adminState.user) {
        data.updated_by = adminState.user.id;
      }
      
      const { error } = await client
        .from('recommendations')
        .update(data)
        .eq('id', recId);

      if (error) throw error;
      showToast('Recommendation updated successfully', 'success');
    } else {
      // Insert new
      if (typeof adminState !== 'undefined' && adminState.user) {
        data.created_by = adminState.user.id;
      }
      
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
    
    // Reload recommendations if function exists
    if (typeof loadRecommendationsData === 'function') {
      await loadRecommendationsData();
    }
    
  } catch (error) {
    console.error('Error saving recommendation:', error);
    showToast('Failed to save: ' + error.message, 'error');
  }
}

/**
 * Open modal to add new category
 */
window.openAddCategoryModal = function() {
  const modalHtml = `
    <div id="addCategoryModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7);">
      <div style="background: var(--admin-bg); border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin: 0 0 20px; color: var(--admin-text);">Add New Category</h3>
        
        <form id="addCategoryForm" onsubmit="handleAddCategory(event)">
          <div style="display: grid; gap: 16px;">
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">🇵🇱 Name (Polish) *</label>
              <input type="text" name="name_pl" required style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">🇬🇧 Name (English) *</label>
              <input type="text" name="name_en" required style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">🇬🇷 Name (Greek)</label>
              <input type="text" name="name_el" style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">🇮🇱 Name (Hebrew)</label>
              <input type="text" name="name_he" dir="rtl" style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">Icon (emoji or text)</label>
              <input type="text" name="icon" placeholder="🏨 or hotel" style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
              <small style="color: var(--admin-text-muted); display: block; margin-top: 4px;">Example: 🏨, 🍽️, 🚗, 🏖️</small>
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">Color (hex)</label>
              <input type="color" name="color" value="#FF6B35" style="width: 100%; height: 40px; padding: 4px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px;">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 4px; font-weight: 600;">Display Order</label>
              <input type="number" name="display_order" value="0" min="0" style="width: 100%; padding: 10px; background: var(--admin-bg-secondary); border: 1px solid var(--admin-border); border-radius: 6px; color: var(--admin-text);">
            </div>
            
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button type="button" onclick="closeAddCategoryModal()" class="btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn-primary">
              💾 Save Category
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeAddCategoryModal = function() {
  const modal = document.getElementById('addCategoryModal');
  if (modal) modal.remove();
};

window.handleAddCategory = async function(event) {
  event.preventDefault();
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const formData = new FormData(event.target);
    
    const categoryData = {
      name_pl: formData.get('name_pl').trim(),
      name_en: formData.get('name_en').trim(),
      name_el: formData.get('name_el')?.trim() || null,
      name_he: formData.get('name_he')?.trim() || null,
      icon: formData.get('icon')?.trim() || null,
      color: formData.get('color') || '#FF6B35',
      display_order: parseInt(formData.get('display_order')) || 0,
      active: true
    };
    
    console.log('Creating category:', categoryData);
    
    const { data, error } = await client
      .from('recommendation_categories')
      .insert([categoryData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }
    
    console.log('Category created:', data);
    showToast('Category created successfully!', 'success');
    
    // Update global categories arrays
    if (typeof recommendationsCategories !== 'undefined') {
      recommendationsCategories.push(data);
    }
    if (window.recommendationsCategories) {
      window.recommendationsCategories.push(data);
    } else {
      window.recommendationsCategories = [data];
    }
    
    // Close modal
    closeAddCategoryModal();
    
    // Refresh the recommendation form to show new category
    const select = document.getElementById('recCategorySelect');
    if (select) {
      // Remove "no categories" warning if exists
      const warning = select.parentElement.parentElement.querySelector('small');
      if (warning) warning.remove();
      
      const option = document.createElement('option');
      option.value = data.id;
      option.textContent = `${data.name_pl} / ${data.name_en}`;
      option.selected = true;
      select.appendChild(option);
    }
    
  } catch (error) {
    console.error('Error adding category:', error);
    showToast('Failed to add category: ' + error.message, 'error');
  }
};

/**
 * Handle image upload to Supabase Storage
 */
window.handleRecImageUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Please select a valid image file (JPG, PNG, WEBP)', 'error');
    event.target.value = '';
    return;
  }
  
  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Image size must be less than 5MB', 'error');
    event.target.value = '';
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    // Show progress
    const progressDiv = document.getElementById('recImageProgress');
    const progressBar = document.getElementById('recImageProgressBar');
    if (progressDiv) progressDiv.style.display = 'block';
    if (progressBar) progressBar.style.width = '30%';
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop();
    const fileName = `rec_${timestamp}_${randomStr}.${extension}`;
    const filePath = `recommendations/${fileName}`;
    
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw new Error(error.message);
    }
    
    if (progressBar) progressBar.style.width = '70%';
    
    // Get public URL
    const { data: urlData } = client.storage
      .from('images')
      .getPublicUrl(filePath);
    
    const publicUrl = urlData.publicUrl;
    
    if (progressBar) progressBar.style.width = '100%';
    
    // Update hidden input and preview
    const imageUrlInput = document.getElementById('recImageUrl');
    if (imageUrlInput) {
      imageUrlInput.value = publicUrl;
    }
    
    // Show success message
    showToast('Image uploaded successfully!', 'success');
    
    // Hide progress after delay
    setTimeout(() => {
      if (progressDiv) progressDiv.style.display = 'none';
      if (progressBar) progressBar.style.width = '0%';
    }, 1000);
    
    // Create preview
    const previewContainer = event.target.parentElement.parentElement;
    let preview = previewContainer.querySelector('.image-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'image-preview';
      preview.style.cssText = 'margin-top: 12px;';
      previewContainer.insertBefore(preview, event.target.parentElement);
    }
    preview.innerHTML = `
      <img src="${publicUrl}" 
           alt="Uploaded image" 
           style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover; display: block;">
    `;
    
  } catch (error) {
    console.error('Error uploading image:', error);
    showToast('Failed to upload image: ' + error.message, 'error');
    
    // Hide progress
    const progressDiv = document.getElementById('recImageProgress');
    if (progressDiv) progressDiv.style.display = 'none';
    
    // Clear file input
    event.target.value = '';
  }
}
