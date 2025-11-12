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
    try {
      // Prefer view if exists
      let query = sb.from('public_tasks').select('id,xp,sort_order,title,description,title_i18n,description_i18n');
      let { data, error } = await query.order('sort_order', { ascending: true });
      if (error) {
        // Fallback to table
        ({ data, error } = await sb
          .from('tasks')
          .select('id,xp,sort_order,is_active,category,title,description,title_i18n,description_i18n')
          .eq('is_active', true)
          .eq('category', 'quest')
          .order('sort_order', { ascending: true }));
      }
      if (error) throw error;
      if (Array.isArray(data) && data.length) {
        // Replace TASKS with DB data (map to expected shape)
        TASKS.length = 0;
        data.forEach(row => {
          // Use i18n helpers for translated content
          const title = window.getQuestTitle ? window.getQuestTitle(row) : (row.title || null);
          const description = window.getQuestDescription ? window.getQuestDescription(row) : (row.description || null);
          
          TASKS.push({ 
            id: row.id, 
            xp: Number(row.xp)||0, 
            requiredLevel: 1, 
            title: title, 
            description: description,
            _raw: row // Keep raw data for future reference
          });
        });
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
    if (task && task.title) return task.title;
    return t(`tasks.items.${task.id}.title`, task.id);
  }
  function getTaskDescription(task){
    if (task && task.description) return task.description;
    return t(`tasks.items.${task.id}.description`, '');
  }

  function isUnlocked(task){
    // All tasks unlocked for authenticated users; guests cannot complete
    return !!state.auth.isAuthenticated;
  }

  function renderTasks(){
    const listEl = document.getElementById('tasksList');
    if (!listEl) return;
    listEl.innerHTML = '';

    TASKS.forEach((task) => {
      const unlocked = isUnlocked(task);
      const completed = state.tasksCompleted.has(task.id);
      const li = document.createElement('li');
      li.className = 'task';
      if (completed) li.classList.add('completed');
      if (!unlocked) li.classList.add('locked');

      const info = document.createElement('div');
      info.className = 'task-info';

      const titleEl = document.createElement('p');
      titleEl.className = 'task-title';
      titleEl.textContent = getTaskTitle(task);
      info.appendChild(titleEl);

      const descriptionText = getTaskDescription(task);
      if (descriptionText) {
        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'task-description';
        descriptionEl.textContent = descriptionText;
        info.appendChild(descriptionEl);
      }

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const xp = document.createElement('span');
      xp.className = 'task-xp';
      xp.textContent = `+${task.xp} XP`;
      meta.appendChild(xp);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'task-action';
      button.setAttribute('aria-pressed', completed ? 'true' : 'false');

      if (completed) {
        button.textContent = t('tasks.action.undo', 'Cofnij');
        button.classList.add('is-completed');
        button.addEventListener('click', () => revertTask(task));
      } else if (!unlocked) {
        button.textContent = t('auth.login.button', 'Zaloguj');
        button.addEventListener('click', () => {
          const btn = document.querySelector('[data-auth="login"]');
          if (btn) btn.click();
        });
      } else {
        button.textContent = t('tasks.action.complete', 'Wykonaj');
        button.addEventListener('click', () => completeTask(task));
      }

      meta.appendChild(button);
      li.appendChild(info);
      li.appendChild(meta);
      listEl.appendChild(li);
    });
  }

  async function completeTask(task){
    if (!state.auth.isAuthenticated) return; // only logged-in users can complete tasks
    if (state.tasksCompleted.has(task.id)) return;
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
