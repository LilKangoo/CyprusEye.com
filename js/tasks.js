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

  // --- Tasks UI ---
  function getTaskTitle(task){
    return t(`tasks.items.${task.id}.title`, task.id);
  }
  function getTaskDescription(task){
    return t(`tasks.items.${task.id}.description`, '');
  }

  function isUnlocked(task){
    return (Number(task.requiredLevel)||1) <= state.level;
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
        button.textContent = t('tasks.action.locked', 'Poziom {{level}}', { level: task.requiredLevel });
        button.disabled = true;
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

  function completeTask(task){
    if (state.tasksCompleted.has(task.id)) return;
    state.tasksCompleted.add(task.id);
    gainXp(Number(task.xp)||0);
    renderTasks();
  }

  function revertTask(task){
    if (!state.tasksCompleted.has(task.id)) return;
    state.tasksCompleted.delete(task.id);
    gainXp(-1 * (Number(task.xp)||0));
    renderTasks();
  }

  function unhideView(){
    const view = document.getElementById('tasksView');
    if (view && view.hasAttribute('hidden')) view.removeAttribute('hidden');
  }

  function onReady(){
    loadState();
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
