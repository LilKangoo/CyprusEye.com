// Minimal ranking module scaffold (built)
(function(){
  const DEFAULT_AVATAR = '/assets/cyprus_logo-1000x1054.png';
  const state = { initialized: false, loading: false, data: [] };

  async function fetchTopUsers() {
    const sb = window.getSupabase?.();
    if (!sb) return [];
    const { data, error } = await sb
      .from('profiles')
      .select('id, username, name, avatar_url, level, xp')
      .order('level', { ascending: false })
      .order('xp', { ascending: false })
      .limit(100);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  }

  async function fetchUserStats(userId) {
    // TODO: replace with real counts from Supabase (completed tasks, visited places)
    return { tasksCompleted: 0, placesVisited: 0 };
  }

  function renderSkeleton(container, count = 10) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<div class="ranking-item skeleton">\n' +
              '  <div class="ranking-rank">#</div>\n' +
              '  <div class="ranking-user">\n' +
              '    <div class="ranking-avatar"></div>\n' +
              '    <div class="ranking-user-info">\n' +
              '      <div class="ranking-username"></div>\n' +
              '      <div class="ranking-meta"></div>\n' +
              '    </div>\n' +
              '  </div>\n' +
              '  <div class="ranking-stats">\n' +
              '    <div class="ranking-stat"></div>\n' +
              '    <div class="ranking-stat"></div>\n' +
              '  </div>\n' +
              '</div>';
    }
    container.innerHTML = html;
  }

  function renderList(container, users) {
    let html = '';
    users.forEach((u, idx) => {
      const name = u.username || u.name || 'Użytkownik';
      const avatar = u.avatar_url || DEFAULT_AVATAR;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`;
      html += `
        <div class="ranking-item" data-user-id="${u.id}">
          <div class="ranking-rank">${medal}</div>
          <div class="ranking-user">
            <img class="ranking-avatar" src="${avatar}" alt="${name}" />
            <div class="ranking-user-info">
              <div class="ranking-username">${name}</div>
              <div class="ranking-meta">Lvl ${u.level || 1} • ${u.xp || 0} XP</div>
            </div>
          </div>
          <div class="ranking-stats">
            <div class="ranking-stat" data-stat="tasks">✅ <span>0</span></div>
            <div class="ranking-stat" data-stat="places">📍 <span>0</span></div>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  }

  async function enrichStats(container, users) {
    const items = Array.from(container.querySelectorAll('.ranking-item'));
    await Promise.all(users.map(async (u, i) => {
      const stats = await fetchUserStats(u.id);
      const item = items[i];
      if (!item) return;
      const tasksEl = item.querySelector('[data-stat="tasks"] span');
      const placesEl = item.querySelector('[data-stat="places"] span');
      if (tasksEl) tasksEl.textContent = String(stats.tasksCompleted || 0);
      if (placesEl) placesEl.textContent = String(stats.placesVisited || 0);
    }));
  }

  async function init() {
    if (state.loading) return;
    state.loading = true;
    const list = document.getElementById('rankingList');
    if (!list) { state.loading = false; return; }
    renderSkeleton(list, 8);
    const users = await fetchTopUsers();
    state.data = users;
    renderList(list, users);
    await enrichStats(list, users);
    state.loading = false;
    state.initialized = true;
  }

  window.communityRanking = window.communityRanking || { init, get state(){ return state; } };
})();
