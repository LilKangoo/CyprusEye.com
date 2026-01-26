import { showToast } from './toast.js';

const sb = typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null;

const el = (id) => document.getElementById(id);

const planListEl = () => el('planList');
const createStatusEl = () => el('planCreateStatus');

const emptyStateEl = () => el('planEmptyState');
const detailsWrapEl = () => el('planDetails');
const daysEl = () => el('planDays');

const saveStatusEl = () => el('planSaveStatus');

let currentPlan = null;

function formatPlanLabel(plan) {
  const title = (plan?.title || '').trim() || 'Untitled plan';
  const start = plan?.start_date ? String(plan.start_date) : '';
  const end = plan?.end_date ? String(plan.end_date) : '';
  const range = start && end ? `${start} → ${end}` : (start || end);
  return range ? `${title} · ${range}` : title;
}

function setStatus(targetEl, msg, type) {
  if (!(targetEl instanceof HTMLElement)) return;
  targetEl.textContent = msg || '';
  if (type) {
    targetEl.dataset.tone = type;
  } else {
    delete targetEl.dataset.tone;
  }
}

function parseHashPlanId() {
  const hash = String(window.location.hash || '').trim();
  const m = hash.match(/^#plan:([0-9a-fA-F-]{36})$/);
  return m ? m[1] : null;
}

function setHashPlanId(id) {
  if (!id) {
    if (window.location.hash) window.location.hash = '';
    return;
  }
  window.location.hash = `plan:${id}`;
}

async function getCurrentUser() {
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.user || null;
}

function daysBetweenInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (!Number.isFinite(diffDays) || diffDays < 0) return null;
  return diffDays + 1;
}

function addDays(dateStr, offsetDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offsetDays);
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

async function loadPlans({ selectId } = {}) {
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) {
    if (planListEl()) planListEl().innerHTML = '';
    currentPlan = null;
    renderPlanDetails(null);
    return;
  }

  const { data, error } = await sb
    .from('user_plans')
    .select('id,title,start_date,end_date,days_count,base_city,include_north,status,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load plans', error);
    showToast(error.message || 'Failed to load plans', 'error');
    return;
  }

  const plans = Array.isArray(data) ? data : [];
  const list = planListEl();
  if (list) {
    if (!plans.length) {
      list.innerHTML = '<div style="color:#64748b;">No plans yet. Create your first plan above.</div>';
    } else {
      list.innerHTML = plans
        .map((plan) => {
          const label = formatPlanLabel(plan);
          const isActive = currentPlan?.id && plan.id === currentPlan.id;
          return `
            <button
              type="button"
              class="btn ${isActive ? 'btn-primary primary' : ''}"
              data-plan-id="${plan.id}"
              style="text-align:left; width:100%; justify-content:flex-start; white-space:normal;"
            >${escapeHtml(label)}</button>
          `;
        })
        .join('');

      list.querySelectorAll('[data-plan-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-plan-id');
          if (id) {
            setHashPlanId(id);
            await selectPlanById(id);
          }
        });
      });
    }
  }

  const desiredId = selectId || parseHashPlanId() || currentPlan?.id || null;
  if (desiredId) {
    const match = plans.find((p) => p.id === desiredId);
    if (match) {
      await selectPlanById(match.id, { skipListReload: true });
      return;
    }
  }

  if (plans.length && !currentPlan) {
    await selectPlanById(plans[0].id, { skipListReload: true });
  }
}

async function selectPlanById(id, { skipListReload = false } = {}) {
  if (!sb || !id) return;

  const { data, error } = await sb
    .from('user_plans')
    .select('id,user_id,title,start_date,end_date,days_count,base_city,include_north,currency,status,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load plan', error);
    showToast(error.message || 'Failed to load plan', 'error');
    return;
  }

  if (!data) {
    currentPlan = null;
    renderPlanDetails(null);
    if (!skipListReload) await loadPlans();
    return;
  }

  currentPlan = data;
  renderPlanDetails(currentPlan);
  await loadPlanDays(currentPlan.id);

  if (!skipListReload) {
    await loadPlans({ selectId: currentPlan.id });
  }
}

async function loadPlanDays(planId) {
  if (!sb || !planId) return;

  const { data, error } = await sb
    .from('user_plan_days')
    .select('id,day_index,date,city,notes')
    .eq('plan_id', planId)
    .order('day_index', { ascending: true });

  if (error) {
    console.error('Failed to load plan days', error);
    showToast(error.message || 'Failed to load plan days', 'error');
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  const container = daysEl();
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div style="color:#64748b;">No days generated yet.</div>';
    return;
  }

  container.innerHTML = rows
    .map((d) => {
      const label = d.date ? `Day ${d.day_index} · ${d.date}` : `Day ${d.day_index}`;
      const city = (d.city || '').trim();
      const notes = (d.notes || '').trim();
      return `
        <div class="card" style="padding: 0.75rem; border: 1px solid #e2e8f0;">
          <div style="display:flex; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
            <strong>${escapeHtml(label)}</strong>
            <span style="color:#64748b;">${escapeHtml(city)}</span>
          </div>
          ${notes ? `<div style="margin-top:0.5rem; color:#475569;">${escapeHtml(notes)}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function renderPlanDetails(plan) {
  const empty = emptyStateEl();
  const wrap = detailsWrapEl();

  const delBtn = el('planDeleteBtn');
  const refreshBtn = el('planRefreshBtn');
  const saveBtn = el('planSaveBtn');

  if (delBtn instanceof HTMLButtonElement) {
    delBtn.disabled = !plan;
  }
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.disabled = !plan;
  }
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = !plan;
  }

  if (!plan) {
    if (wrap) wrap.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  if (wrap) wrap.hidden = false;

  const titleEl = el('planEditTitle');
  const baseCityEl = el('planEditBaseCity');
  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const includeNorthEl = el('planEditIncludeNorth');

  if (titleEl instanceof HTMLInputElement) titleEl.value = plan.title || '';
  if (baseCityEl instanceof HTMLInputElement) baseCityEl.value = plan.base_city || '';
  if (startEl instanceof HTMLInputElement) startEl.value = plan.start_date || '';
  if (endEl instanceof HTMLInputElement) endEl.value = plan.end_date || '';
  if (includeNorthEl instanceof HTMLInputElement) includeNorthEl.checked = !!plan.include_north;

  setStatus(saveStatusEl(), '', null);
}

async function handleCreatePlan(event) {
  event.preventDefault();
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) {
    showToast('Please log in first.', 'info');
    return;
  }

  const form = el('planCreateForm');
  if (!(form instanceof HTMLFormElement)) return;

  setStatus(createStatusEl(), 'Creating…', 'info');

  const title = String(new FormData(form).get('title') || '').trim();
  const baseCity = String(new FormData(form).get('base_city') || '').trim();
  const startDate = String(new FormData(form).get('start_date') || '').trim();
  const endDate = String(new FormData(form).get('end_date') || '').trim();
  const includeNorth = String(new FormData(form).get('include_north') || '') === 'on';

  const daysCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : null;
  if ((startDate && endDate) && !daysCount) {
    setStatus(createStatusEl(), 'Invalid dates.', 'error');
    return;
  }

  const payload = {
    user_id: user.id,
    title: title || null,
    base_city: baseCity || null,
    start_date: startDate || null,
    end_date: endDate || null,
    days_count: daysCount || null,
    include_north: includeNorth,
    currency: 'EUR',
  };

  const { data: created, error } = await sb
    .from('user_plans')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create plan', error);
    setStatus(createStatusEl(), error.message || 'Failed to create plan', 'error');
    showToast(error.message || 'Failed to create plan', 'error');
    return;
  }

  if (created?.id && daysCount && startDate) {
    const dayRows = [];
    for (let i = 0; i < daysCount; i += 1) {
      const date = addDays(startDate, i);
      dayRows.push({
        plan_id: created.id,
        day_index: i + 1,
        date: date,
        city: baseCity || null,
      });
    }

    const { error: dayErr } = await sb
      .from('user_plan_days')
      .insert(dayRows);

    if (dayErr) {
      console.warn('Failed to create plan days', dayErr);
    }
  }

  setStatus(createStatusEl(), 'Created.', 'success');
  form.reset();

  if (created?.id) {
    setHashPlanId(created.id);
    await selectPlanById(created.id, { skipListReload: true });
  }
  await loadPlans({ selectId: created?.id || null });
}

async function handleSavePlan() {
  if (!sb || !currentPlan?.id) return;

  const user = await getCurrentUser();
  if (!user) return;

  const titleEl = el('planEditTitle');
  const baseCityEl = el('planEditBaseCity');
  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const includeNorthEl = el('planEditIncludeNorth');

  const title = titleEl instanceof HTMLInputElement ? titleEl.value.trim() : '';
  const baseCity = baseCityEl instanceof HTMLInputElement ? baseCityEl.value.trim() : '';
  const startDate = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
  const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
  const includeNorth = includeNorthEl instanceof HTMLInputElement ? includeNorthEl.checked : false;

  const daysCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : null;
  if ((startDate && endDate) && !daysCount) {
    setStatus(saveStatusEl(), 'Invalid dates.', 'error');
    return;
  }

  setStatus(saveStatusEl(), 'Saving…', 'info');

  const patch = {
    title: title || null,
    base_city: baseCity || null,
    start_date: startDate || null,
    end_date: endDate || null,
    days_count: daysCount || null,
    include_north: includeNorth,
  };

  const { data: updated, error } = await sb
    .from('user_plans')
    .update(patch)
    .eq('id', currentPlan.id)
    .select('*')
    .single();

  if (error) {
    console.error('Failed to save plan', error);
    setStatus(saveStatusEl(), error.message || 'Failed to save', 'error');
    showToast(error.message || 'Failed to save', 'error');
    return;
  }

  currentPlan = updated || currentPlan;
  setStatus(saveStatusEl(), 'Saved.', 'success');
  await loadPlans({ selectId: currentPlan.id });
  await loadPlanDays(currentPlan.id);
}

async function handleDeletePlan() {
  if (!sb || !currentPlan?.id) return;
  const sure = window.confirm('Delete this plan? This cannot be undone.');
  if (!sure) return;

  const { error } = await sb
    .from('user_plans')
    .delete()
    .eq('id', currentPlan.id);

  if (error) {
    console.error('Failed to delete plan', error);
    showToast(error.message || 'Failed to delete plan', 'error');
    return;
  }

  showToast('Plan deleted.', 'success');
  currentPlan = null;
  setHashPlanId(null);
  renderPlanDetails(null);
  await loadPlans();
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wireEvents() {
  const form = el('planCreateForm');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', handleCreatePlan);
  }

  const refreshBtn = el('planRefreshBtn');
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.addEventListener('click', async () => {
      if (currentPlan?.id) {
        await selectPlanById(currentPlan.id, { skipListReload: true });
        await loadPlans({ selectId: currentPlan.id });
      } else {
        await loadPlans();
      }
    });
  }

  const saveBtn = el('planSaveBtn');
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.addEventListener('click', handleSavePlan);
  }

  const delBtn = el('planDeleteBtn');
  if (delBtn instanceof HTMLButtonElement) {
    delBtn.addEventListener('click', handleDeletePlan);
  }

  window.addEventListener('hashchange', async () => {
    const id = parseHashPlanId();
    if (id) {
      await selectPlanById(id);
    }
  });
}

async function init() {
  if (!sb) return;

  wireEvents();

  try {
    sb.auth.onAuthStateChange(async () => {
      currentPlan = null;
      renderPlanDetails(null);
      await loadPlans();
    });
  } catch (_) {}

  await loadPlans();

  const hashId = parseHashPlanId();
  if (hashId) {
    await selectPlanById(hashId);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  void init();
}
