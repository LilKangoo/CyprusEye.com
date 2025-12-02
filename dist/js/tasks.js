(function(){
  'use strict';

  // --- i18n helper ---
  function t(key, fallback = '', repl = {}) {
    try {
      const i18n = window.appI18n;
      if (i18n && i18n.translations) {
        const lang = i18n.language || 'pl';
        const entry = i18n.translations[lang] && i18n.translations[lang][key];
        let result = null;
        if (typeof entry === 'string') result = entry;
        else if (entry && typeof entry === 'object') {
          if (typeof entry.text === 'string') result = entry.text;
          else if (typeof entry.html === 'string') result = entry.html;
        }
        if (typeof result === 'string' && result) {
          return result.replace(/\{\{(\w+)\}\}/g, (m, p) => (p in repl ? String(repl[p]) : m));
        }
      }
    } catch (_) {}
    return (fallback || '').replace(/\{\{(\w+)\}\}/g, (m, p) => (p in repl ? String(repl[p]) : m));
  }

  // --- Data source ---
  const TASKS = (function(){
    try { if (typeof TASKS_DATA !== 'undefined') return TASKS_DATA; } catch(_) {}
    try { if (window.TASKS_DATA) return window.TASKS_DATA; } catch(_) {}
    return [];
  })();

  // --- Simple state & storage ---
  const STORAGE_KEY = 'wakacjecypr-tasks-progress';
  const XP_PER_LEVEL = 150;
  const MAX_LEVEL = 100;

  const state = {
    xp: 0,
    level: 1,
    tasksCompleted: new Set(),
    auth: { userId: null, isAuthenticated: false },
  };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      if (Number.isFinite(data?.xp)) state.xp = data.xp;
      if (Array.isArray(data?.tasksCompleted)) state.tasksCompleted = new Set(data.tasksCompleted);
      recalcLevel();
    }catch(_){/* ignore */}
  }

  function saveState(){
    try{
      const payload = { xp: state.xp, tasksCompleted: Array.from(state.tasksCompleted) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }catch(_){/* ignore */}
  }

  function recalcLevel(){
    const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(state.xp / XP_PER_LEVEL) + 1));
    state.level = level;
  }

  function gainXp(amount){
    const inc = Number.isFinite(amount) ? amount : 0;
    state.xp = Math.max(0, state.xp + inc);
    recalcLevel();
    updateHeaderMetrics();
    saveState();
  }

  // --- Header metrics update ---
  function updateHeaderMetrics(){
    const xpEl = document.getElementById('headerXpPoints');
    const levelEl = document.getElementById('headerLevelNumber');
    const fillEl = document.getElementById('headerXpFill');
    const progressText = document.getElementById('headerXpProgressText');

    if (levelEl) levelEl.textContent = String(state.level);
    if (xpEl) xpEl.textContent = String(state.xp);

    const into = state.xp % XP_PER_LEVEL;
    const pct = Math.max(0, Math.min(100, Math.round((into / XP_PER_LEVEL) * 100)));
    if (fillEl) {
      if (pct <= 0) fillEl.classList.add('is-width-zero'); else fillEl.classList.remove('is-width-zero');
      fillEl.style.width = pct + '%';
    }
    if (progressText) {
      progressText.textContent = t('metrics.xp.progress', `${into} / ${XP_PER_LEVEL} XP do kolejnego poziomu`, {
        current: into,
        next: XP_PER_LEVEL
      });
    }
  }

  // --- Supabase integration ---
  let sb = null;
  async function initSupabase(){
    try {
      if (typeof window.getSupabase === 'function') sb = window.getSupabase();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return; // guest
      state.auth = { userId: user.id, isAuthenticated: true };

      // Load profile xp/level
      const { data: profile } = await sb
        .from('profiles')
        .select('xp, level')
        .eq('id', user.id)
        .single();
      if (profile) {
        if (Number.isFinite(profile.xp)) state.xp = profile.xp;
        if (Number.isFinite(profile.level)) state.level = profile.level;
      }

      // Load completed tasks
      const { data: ct } = await sb
        .from('completed_tasks')
        .select('task_id')
        .eq('user_id', user.id);
      if (Array.isArray(ct)) {
        state.tasksCompleted = new Set(ct.map(r => r.task_id));
      }

      saveState();
    } catch (_) { /* ignore */ }
  }

  async function loadTasksFromDB(){
    if (!sb) return false;
    
    // Wait for languageSwitcher to load (with timeout)
    let attempts = 0;
    while (!window.getQuestTitle && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.getQuestTitle) {
      console.warn('⚠️ getQuestTitle not available after 5s, using fallback');
    } else {
      console.log('✅ getQuestTitle is available');
    }
    
    try {
      // Prefer view if exists
      // Fetch tasks with verification fields
      let { data, error } = await sb
        .from('tasks')
        .select('id,xp,sort_order,is_active,category,title,description,title_i18n,description_i18n,verification_type,location_name_i18n,latitude,longitude,location_radius')
        .eq('is_active', true)
        .eq('category', 'quest')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        // Replace TASKS with DB data (map to expected shape)
        TASKS.length = 0;
        data.forEach(row => {
          // Use i18n helpers for translated content
          const title = window.getQuestTitle ? window.getQuestTitle(row) : (row.title || null);
          const description = window.getQuestDescription ? window.getQuestDescription(row) : (row.description || null);
          
          // Get location name from i18n
          let locationName = null;
          if (row.location_name_i18n) {
            const lang = window.appI18n?.language || 'pl';
            locationName = row.location_name_i18n[lang] || row.location_name_i18n['pl'] || row.location_name_i18n['en'] || null;
          }
          
          TASKS.push({ 
            id: row.id, 
            xp: Number(row.xp)||0, 
            requiredLevel: 1, 
            title: title, 
            description: description,
            verification_type: row.verification_type || 'none',
            location_name: locationName,
            latitude: row.latitude,
            longitude: row.longitude,
            location_radius: row.location_radius || 100,
            _raw: row // Keep raw data for future reference
          });
        });
        
        console.log('📋 Tasks loaded:', TASKS.length, 'Sample:', TASKS[0]);
        return true;
      }
    } catch (e) {
      console.warn('loadTasksFromDB failed', e);
    }
    return false;
  }

  async function awardTaskServer(task){
    if (!sb || !state.auth.isAuthenticated) return false;
    try {
      // Ensure row in completed_tasks exists
      await sb.from('completed_tasks').upsert({ user_id: state.auth.userId, task_id: task.id }, {
        onConflict: 'user_id,task_id',
        ignoreDuplicates: true,
      });
      // Call RPC to add XP and update level
      await sb.rpc('award_task', { p_task_id: task.id });
      // Refresh profile
      const { data: profile } = await sb
        .from('profiles')
        .select('xp, level')
        .eq('id', state.auth.userId)
        .single();
      if (profile) {
        state.xp = Number(profile.xp) || 0;
        state.level = Number(profile.level) || 1;
      }
      return true;
    } catch (e) {
      console.error('awardTaskServer error', e);
      return false;
    }
  }

  async function revertTaskServer(task){
    if (!sb || !state.auth.isAuthenticated) return false;
    try {
      await sb.from('completed_tasks')
        .delete()
        .eq('user_id', state.auth.userId)
        .eq('task_id', task.id);
      // Prefer RPC if available; otherwise adjust xp client-side only
      let ok = false;
      try {
        const { error } = await sb.rpc('revert_task', { p_task_id: task.id });
        ok = !error;
      } catch(_) { ok = false; }
      if (ok) {
        const { data: profile } = await sb
          .from('profiles')
          .select('xp, level')
          .eq('id', state.auth.userId)
          .single();
        if (profile) {
          state.xp = Number(profile.xp) || 0;
          state.level = Number(profile.level) || 1;
        }
      }
      return true;
    } catch (e) {
      console.error('revertTaskServer error', e);
      return false;
    }
  }

  // --- Tasks UI ---
  function getTaskTitle(task){
    // Try to use i18n helper first (for live language switching)
    if (window.getQuestTitle && task._raw) {
      const translated = window.getQuestTitle(task._raw);
      if (translated) return translated;
    }
    
    // Fallback to pre-processed title
    if (task && task.title) return task.title;
    
    // Final fallback to i18n key or id
    return t(`tasks.items.${task.id}.title`, task.id);
  }
  
  function getTaskDescription(task){
    // Try to use i18n helper first (for live language switching)
    if (window.getQuestDescription && task._raw) {
      const translated = window.getQuestDescription(task._raw);
      if (translated) return translated;
    }
    
    // Fallback to pre-processed description
    if (task && task.description) return task.description;
    
    // Final fallback to i18n key
    return t(`tasks.items.${task.id}.description`, '');
  }

  function isUnlocked(task){
    // All tasks unlocked for authenticated users; guests cannot complete
    return !!state.auth.isAuthenticated;
  }

  // Add CSS styles for quest verification buttons
  function injectQuestStyles() {
    if (document.getElementById('quest-verification-styles')) return;
    const style = document.createElement('style');
    style.id = 'quest-verification-styles';
    style.textContent = `
      .task-verify-btn {
        background: #3b82f6 !important;
        color: white !important;
        border: 2px solid #3b82f6 !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
        cursor: pointer !important;
      }
      .task-verify-btn:hover {
        background: white !important;
        color: #3b82f6 !important;
      }
      .task-details-toggle {
        background: none;
        border: none;
        color: #3b82f6;
        font-size: 0.85em;
        cursor: pointer;
        padding: 4px 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .task-details-toggle:hover {
        text-decoration: underline;
      }
      .task-details-panel {
        background: #f8fafc;
        border-radius: 8px;
        padding: 12px 16px;
        margin-top: 12px;
        border: 1px solid #e2e8f0;
        display: none;
      }
      .task-details-panel.is-open {
        display: block;
        animation: slideDown 0.2s ease;
      }
      .task-details-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 0.9em;
        color: #475569;
      }
      .task-details-row:last-child {
        margin-bottom: 0;
      }
      .task-details-row a {
        color: #3b82f6;
        text-decoration: none;
      }
      .task-details-row a:hover {
        text-decoration: underline;
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  function renderTasks(){
    injectQuestStyles();
    const listEl = document.getElementById('tasksList');
    if (!listEl) return;
    listEl.innerHTML = '';

    TASKS.forEach((task) => {
      const unlocked = isUnlocked(task);
      const completed = state.tasksCompleted.has(task.id);
      const requiresCode = task.verification_type === 'code' || task.verification_type === 'both';
      const requiresLocation = task.verification_type === 'location' || task.verification_type === 'both';
      const hasDetails = task.location_name || (task.latitude && task.longitude);
      
      const li = document.createElement('li');
      li.className = 'task';
      li.id = `task-${task.id}`;
      if (completed) li.classList.add('completed');
      if (!unlocked) li.classList.add('locked');

      const info = document.createElement('div');
      info.className = 'task-info';

      const titleEl = document.createElement('p');
      titleEl.className = 'task-title';
      titleEl.textContent = getTaskTitle(task);
      
      // Add verification badge
      if (requiresCode || requiresLocation) {
        const badge = document.createElement('span');
        badge.className = 'task-verification-badge';
        badge.style.cssText = 'margin-left: 8px; font-size: 0.75em; padding: 2px 6px; border-radius: 4px; background: #3b82f6; color: white;';
        badge.textContent = requiresCode && requiresLocation ? '🔑📍' : requiresCode ? '🔑' : '📍';
        titleEl.appendChild(badge);
      }
      info.appendChild(titleEl);

      const descriptionText = getTaskDescription(task);
      if (descriptionText) {
        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'task-description';
        descriptionEl.textContent = descriptionText;
        info.appendChild(descriptionEl);
      }
      
      // Show details toggle button if quest has location info
      if (hasDetails && !completed) {
        const detailsToggle = document.createElement('button');
        detailsToggle.type = 'button';
        detailsToggle.className = 'task-details-toggle';
        detailsToggle.innerHTML = `<span class="toggle-icon">▶</span> ${t('tasks.details.show', 'Pokaż szczegóły')}`;
        detailsToggle.addEventListener('click', () => {
          const panel = document.getElementById(`details-${task.id}`);
          const icon = detailsToggle.querySelector('.toggle-icon');
          if (panel) {
            panel.classList.toggle('is-open');
            icon.textContent = panel.classList.contains('is-open') ? '▼' : '▶';
            detailsToggle.innerHTML = `<span class="toggle-icon">${panel.classList.contains('is-open') ? '▼' : '▶'}</span> ${panel.classList.contains('is-open') ? t('tasks.details.hide', 'Ukryj szczegóły') : t('tasks.details.show', 'Pokaż szczegóły')}`;
          }
        });
        info.appendChild(detailsToggle);
        
        // Details panel
        const detailsPanel = document.createElement('div');
        detailsPanel.className = 'task-details-panel';
        detailsPanel.id = `details-${task.id}`;
        
        // Location name
        if (task.location_name) {
          const locRow = document.createElement('div');
          locRow.className = 'task-details-row';
          locRow.innerHTML = `<span>📍</span> <strong>${t('tasks.details.location', 'Lokalizacja')}:</strong> ${task.location_name}`;
          detailsPanel.appendChild(locRow);
        }
        
        // Coordinates with Google Maps link
        if (task.latitude && task.longitude) {
          const coordRow = document.createElement('div');
          coordRow.className = 'task-details-row';
          const mapsUrl = `https://www.google.com/maps?q=${task.latitude},${task.longitude}`;
          coordRow.innerHTML = `<span>🗺️</span> <a href="${mapsUrl}" target="_blank" rel="noopener">${t('tasks.details.openMaps', 'Otwórz w Mapach Google')}</a>`;
          detailsPanel.appendChild(coordRow);
        }
        
        // Radius info
        if (task.location_radius && requiresLocation) {
          const radiusRow = document.createElement('div');
          radiusRow.className = 'task-details-row';
          radiusRow.innerHTML = `<span>📏</span> ${t('tasks.details.radius', 'Promień weryfikacji')}: ${task.location_radius}m`;
          detailsPanel.appendChild(radiusRow);
        }
        
        // Verification type info
        const typeRow = document.createElement('div');
        typeRow.className = 'task-details-row';
        let typeText = '';
        if (requiresCode && requiresLocation) {
          typeText = t('tasks.details.typeBoth', 'Wymagany kod + potwierdzenie lokalizacji');
        } else if (requiresCode) {
          typeText = t('tasks.details.typeCode', 'Poproś o kod u partnera i wpisz go poniżej');
        } else if (requiresLocation) {
          typeText = t('tasks.details.typeLocation', 'Kliknij "Jestem na miejscu" gdy będziesz w lokalizacji');
        }
        if (typeText) {
          typeRow.innerHTML = `<span>ℹ️</span> ${typeText}`;
          detailsPanel.appendChild(typeRow);
        }
        
        info.appendChild(detailsPanel);
      }

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const xp = document.createElement('span');
      xp.className = 'task-xp';
      xp.textContent = `+${task.xp} XP`;
      meta.appendChild(xp);

      // Actions container
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'task-actions';
      actionsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; align-items: flex-end;';

      if (completed) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'task-action is-completed';
        button.textContent = t('tasks.action.undo', 'Cofnij');
        button.addEventListener('click', () => revertTask(task));
        actionsContainer.appendChild(button);
      } else if (!unlocked) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'task-action';
        button.textContent = t('auth.login.button', 'Zaloguj');
        button.addEventListener('click', () => {
          const btn = document.querySelector('[data-auth="login"]');
          if (btn) btn.click();
        });
        actionsContainer.appendChild(button);
      } else if (requiresCode) {
        // Code verification UI
        const codeForm = document.createElement('div');
        codeForm.className = 'task-code-form';
        codeForm.style.cssText = 'display: flex; gap: 6px; align-items: center;';
        
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.placeholder = t('tasks.code.placeholder', 'Wpisz kod');
        codeInput.className = 'task-code-input';
        codeInput.style.cssText = 'padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; text-transform: uppercase; width: 120px; font-family: monospace;';
        codeInput.maxLength = 20;
        codeInput.id = `code-input-${task.id}`;
        
        const verifyBtn = document.createElement('button');
        verifyBtn.type = 'button';
        verifyBtn.className = 'task-verify-btn';
        verifyBtn.textContent = t('tasks.code.verify', 'Weryfikuj');
        verifyBtn.addEventListener('click', () => verifyQuestCode(task, codeInput.value));
        
        // Allow Enter key to submit
        codeInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') verifyBtn.click();
        });
        
        codeForm.appendChild(codeInput);
        codeForm.appendChild(verifyBtn);
        actionsContainer.appendChild(codeForm);
        
        // Error message container
        const errorMsg = document.createElement('div');
        errorMsg.id = `code-error-${task.id}`;
        errorMsg.style.cssText = 'color: #ef4444; font-size: 0.8em; display: none;';
        actionsContainer.appendChild(errorMsg);
        
      } else if (requiresLocation) {
        // Location verification UI
        const locBtn = document.createElement('button');
        locBtn.type = 'button';
        locBtn.className = 'task-action task-location-btn';
        locBtn.textContent = t('tasks.location.verify', '📍 Jestem na miejscu');
        locBtn.style.cssText = 'background: linear-gradient(135deg, #3b82f6, #2563eb);';
        locBtn.addEventListener('click', () => verifyQuestLocation(task));
        actionsContainer.appendChild(locBtn);
        
        // Error message container
        const errorMsg = document.createElement('div');
        errorMsg.id = `loc-error-${task.id}`;
        errorMsg.style.cssText = 'color: #ef4444; font-size: 0.8em; display: none;';
        actionsContainer.appendChild(errorMsg);
        
      } else {
        // Standard completion button
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'task-action';
        button.textContent = t('tasks.action.complete', 'Wykonaj');
        button.addEventListener('click', () => completeTask(task));
        actionsContainer.appendChild(button);
      }

      meta.appendChild(actionsContainer);
      li.appendChild(info);
      li.appendChild(meta);
      listEl.appendChild(li);
    });
  }
  
  // --- Code Verification ---
  async function verifyQuestCode(task, code) {
    if (!sb || !state.auth.isAuthenticated) {
      showCodeError(task.id, t('tasks.error.login', 'Musisz być zalogowany'));
      return;
    }
    
    const trimmedCode = (code || '').trim();
    if (!trimmedCode) {
      showCodeError(task.id, t('tasks.error.empty_code', 'Wpisz kod'));
      return;
    }
    
    // Show loading state
    const btn = document.querySelector(`#task-${task.id} .task-verify-btn`);
    const originalText = btn?.textContent;
    if (btn) {
      btn.textContent = '...';
      btn.disabled = true;
    }
    
    try {
      const { data, error } = await sb.rpc('verify_quest_code', {
        p_quest_id: task.id,
        p_submitted_code: trimmedCode
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        // Success!
        state.tasksCompleted.add(task.id);
        state.xp += data.xp_awarded || 0;
        recalcLevel();
        saveState();
        updateHeaderMetrics();
        renderTasks();
        
        // Show success message
        showSuccessPopup(data.message || t('tasks.success', 'Quest ukończony!'), data.xp_awarded);
      } else {
        // Error from RPC
        showCodeError(task.id, data?.message || t('tasks.error.invalid_code', 'Nieprawidłowy kod'));
      }
    } catch (e) {
      console.error('verifyQuestCode error:', e);
      showCodeError(task.id, t('tasks.error.server', 'Błąd serwera'));
    } finally {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  }
  
  // --- Location Verification ---
  async function verifyQuestLocation(task) {
    if (!sb || !state.auth.isAuthenticated) {
      showLocationError(task.id, t('tasks.error.login', 'Musisz być zalogowany'));
      return;
    }
    
    if (!navigator.geolocation) {
      showLocationError(task.id, t('tasks.error.no_gps', 'GPS niedostępny'));
      return;
    }
    
    // Show loading state
    const btn = document.querySelector(`#task-${task.id} .task-location-btn`);
    const originalText = btn?.textContent;
    if (btn) {
      btn.textContent = '📍 Sprawdzam...';
      btn.disabled = true;
    }
    
    try {
      // Get user's current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      
      const { data, error } = await sb.rpc('verify_quest_location', {
        p_quest_id: task.id,
        p_user_lat: userLat,
        p_user_lng: userLng
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        // Success!
        state.tasksCompleted.add(task.id);
        state.xp += data.xp_awarded || 0;
        recalcLevel();
        saveState();
        updateHeaderMetrics();
        renderTasks();
        
        showSuccessPopup(data.message || t('tasks.success', 'Quest ukończony!'), data.xp_awarded);
      } else {
        // Too far or other error
        let errorMsg = data?.message || t('tasks.error.too_far', 'Za daleko od lokalizacji');
        if (data?.distance) {
          errorMsg += ` (${Math.round(data.distance)}m)`;
        }
        showLocationError(task.id, errorMsg);
      }
    } catch (e) {
      console.error('verifyQuestLocation error:', e);
      if (e.code === 1) {
        showLocationError(task.id, t('tasks.error.gps_denied', 'Brak dostępu do GPS'));
      } else if (e.code === 2) {
        showLocationError(task.id, t('tasks.error.gps_unavailable', 'GPS niedostępny'));
      } else if (e.code === 3) {
        showLocationError(task.id, t('tasks.error.gps_timeout', 'Timeout GPS'));
      } else {
        showLocationError(task.id, t('tasks.error.server', 'Błąd serwera'));
      }
    } finally {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  }
  
  function showCodeError(taskId, message) {
    const el = document.getElementById(`code-error-${taskId}`);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }
  
  function showLocationError(taskId, message) {
    const el = document.getElementById(`loc-error-${taskId}`);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
  }
  
  function showSuccessPopup(message, xpAwarded) {
    // Try to use existing toast system
    if (window.showToast) {
      window.showToast(message, 'success');
      return;
    }
    
    // Fallback: create simple popup
    const popup = document.createElement('div');
    popup.className = 'quest-success-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 24px 32px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      text-align: center;
      animation: popIn 0.3s ease;
    `;
    popup.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
      <div style="font-size: 18px; font-weight: 600;">${message}</div>
      ${xpAwarded ? `<div style="font-size: 24px; margin-top: 8px;">+${xpAwarded} XP</div>` : ''}
    `;
    
    // Add animation keyframes if not exists
    if (!document.getElementById('quest-popup-styles')) {
      const style = document.createElement('style');
      style.id = 'quest-popup-styles';
      style.textContent = `
        @keyframes popIn {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transition = 'opacity 0.3s';
      setTimeout(() => popup.remove(), 300);
    }, 2500);
  }

  async function completeTask(task){
    if (!state.auth.isAuthenticated) return; // only logged-in users can complete tasks
    if (state.tasksCompleted.has(task.id)) return;
    
    // If task requires verification, don't allow direct completion
    if (task.verification_type && task.verification_type !== 'none') {
      console.log('Task requires verification:', task.verification_type);
      return;
    }
    
    state.tasksCompleted.add(task.id);
    const ok = await awardTaskServer(task);
    if (!ok) {
      // Do not grant local XP when server fails; revert completion state
      state.tasksCompleted.delete(task.id);
    }
    saveState();
    updateHeaderMetrics();
    renderTasks();
  }

  async function revertTask(task){
    if (!state.auth.isAuthenticated) return;
    if (!state.tasksCompleted.has(task.id)) return;
    state.tasksCompleted.delete(task.id);
    const ok = await revertTaskServer(task);
    if (!ok) {
      // If server failed, restore completion mark
      state.tasksCompleted.add(task.id);
    }
    saveState();
    updateHeaderMetrics();
    renderTasks();
  }

  function unhideView(){
    const view = document.getElementById('tasksView');
    if (view && view.hasAttribute('hidden')) view.removeAttribute('hidden');
  }

  async function onReady(){
    loadState();
    await initSupabase(); // if logged in -> overrides state with server xp/level/completed tasks
    await loadTasksFromDB();
    updateHeaderMetrics();
    renderTasks();
    unhideView();

    window.addEventListener('i18n:updated', () => {
      updateHeaderMetrics();
      renderTasks();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
})();

// Register global language change handler for quest re-rendering
if (typeof window.registerLanguageChangeHandler === 'function') {
  window.registerLanguageChangeHandler((language) => {
    console.log('📋 Tasks: Re-rendering for language:', language);
    
    // Trigger the existing i18n:updated event that tasks.js already listens to
    // This will re-render tasks with the new language
    window.dispatchEvent(new CustomEvent('i18n:updated'));
    
    console.log('✅ Tasks re-render triggered');
  });
}
