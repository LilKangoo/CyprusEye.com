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
let dayItemsByDayId = new Map();

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

function setCurrentYear() {
  try {
    document.querySelectorAll('[data-current-year]').forEach((node) => {
      if (node instanceof HTMLElement) {
        node.textContent = String(new Date().getFullYear());
      }
    });
  } catch (_) {}
}

async function fetchPlanItemsForDays(dayIds) {
  if (!sb) return new Map();
  if (!Array.isArray(dayIds) || !dayIds.length) return new Map();

  const { data, error } = await sb
    .from('user_plan_items')
    .select('id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at')
    .in('plan_day_id', dayIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load plan items', error);
    showToast(error.message || 'Failed to load plan items', 'error');
    return new Map();
  }

  const rows = Array.isArray(data) ? data : [];
  const grouped = new Map();
  for (const row of rows) {
    const key = row.plan_day_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

async function updateDayField(dayId, patch) {
  if (!sb || !dayId) return null;

  const { data, error } = await sb
    .from('user_plan_days')
    .update(patch)
    .eq('id', dayId)
    .select('id,day_index,date,city,notes')
    .single();

  if (error) {
    console.error('Failed to update day', error);
    showToast(error.message || 'Failed to update day', 'error');
    return null;
  }

  return data;
}

async function addDayNoteItem(planDayId, text) {
  if (!sb || !planDayId) return null;
  const clean = String(text || '').trim();
  if (!clean) return null;

  const payload = {
    plan_day_id: planDayId,
    item_type: 'note',
    data: { text: clean },
    sort_order: 0,
  };

  const { data, error } = await sb
    .from('user_plan_items')
    .insert([payload])
    .select('id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at')
    .single();

  if (error) {
    console.error('Failed to add note item', error);
    showToast(error.message || 'Failed to add note', 'error');
    return null;
  }
  return data;
}

async function deleteDayItem(itemId) {
  if (!sb || !itemId) return false;
  const { error } = await sb
    .from('user_plan_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Failed to delete item', error);
    showToast(error.message || 'Failed to delete item', 'error');
    return false;
  }
  return true;
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

  const dayIds = rows.map((r) => r.id).filter(Boolean);
  dayItemsByDayId = await fetchPlanItemsForDays(dayIds);

  container.innerHTML = rows
    .map((d) => {
      const label = d.date ? `Day ${d.day_index} · ${d.date}` : `Day ${d.day_index}`;
      const city = (d.city || '').trim();
      const notes = (d.notes || '').trim();
      const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
      const noteItems = items.filter((it) => it && it.item_type === 'note');
      const itemsHtml = noteItems.length
        ? `
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            ${noteItems
              .map((it) => {
                const text = it?.data && typeof it.data === 'object' ? String(it.data.text || '').trim() : '';
                return `
                  <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                    <div style="flex:1 1 auto; color:#475569;">${escapeHtml(text)}</div>
                    <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="Delete">✕</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `
        : '';
      return `
        <div class="card" style="padding: 0.75rem; border: 1px solid #e2e8f0;">
          <div style="display:flex; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
            <strong>${escapeHtml(label)}</strong>
            <span style="color:#64748b;">${escapeHtml(city)}</span>
          </div>
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayCity_${d.id}">City</label>
              <input id="dayCity_${d.id}" type="text" value="${escapeHtml(city)}" data-day-city="${d.id}" placeholder="City" />
            </div>
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayNotes_${d.id}">Notes</label>
              <textarea id="dayNotes_${d.id}" rows="2" data-day-notes="${d.id}" placeholder="Notes">${escapeHtml(notes)}</textarea>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn btn-sm" data-day-save="${d.id}">Save day</button>
              <span style="color:#64748b; font-size:12px;" data-day-status="${d.id}"></span>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
              <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">Day notes</div>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                <input type="text" data-day-note-input="${d.id}" placeholder="Add a note…" style="flex:1 1 220px;" />
                <button type="button" class="btn btn-sm" data-day-note-add="${d.id}">Add</button>
              </div>
              ${itemsHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-day-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayId = btn.getAttribute('data-day-save');
      if (!dayId) return;

      const cityInput = container.querySelector(`[data-day-city="${dayId}"]`);
      const notesInput = container.querySelector(`[data-day-notes="${dayId}"]`);
      const statusEl = container.querySelector(`[data-day-status="${dayId}"]`);

      const city = cityInput instanceof HTMLInputElement ? cityInput.value.trim() : '';
      const notes = notesInput instanceof HTMLTextAreaElement ? notesInput.value.trim() : '';

      if (statusEl instanceof HTMLElement) statusEl.textContent = 'Saving…';
      const updated = await updateDayField(dayId, { city: city || null, notes: notes || null });
      if (updated) {
        if (statusEl instanceof HTMLElement) statusEl.textContent = 'Saved.';
      } else {
        if (statusEl instanceof HTMLElement) statusEl.textContent = 'Error.';
      }
    });
  });

  container.querySelectorAll('[data-day-note-add]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayId = btn.getAttribute('data-day-note-add');
      if (!dayId) return;
      const input = container.querySelector(`[data-day-note-input="${dayId}"]`);
      const text = input instanceof HTMLInputElement ? input.value : '';
      const created = await addDayNoteItem(dayId, text);
      if (created) {
        if (input instanceof HTMLInputElement) input.value = '';
        await loadPlanDays(planId);
      }
    });
  });

  container.querySelectorAll('[data-day-item-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.getAttribute('data-day-item-delete');
      if (!itemId) return;
      const ok = await deleteDayItem(itemId);
      if (ok) {
        await loadPlanDays(planId);
      }
    });
  });
}

async function regeneratePlanDays() {
  if (!sb || !currentPlan?.id) return;

  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const baseCityEl = el('planEditBaseCity');

  const startDate = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
  const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
  const baseCity = baseCityEl instanceof HTMLInputElement ? baseCityEl.value.trim() : '';

  if (!startDate || !endDate) {
    showToast('Set start and end date first.', 'info');
    return;
  }

  const daysCount = daysBetweenInclusive(startDate, endDate);
  if (!daysCount) {
    showToast('Invalid dates.', 'error');
    return;
  }

  const sure = window.confirm('Regenerate days? This will remove existing days and their items.');
  if (!sure) return;

  setStatus(saveStatusEl(), 'Regenerating…', 'info');

  const { data: existing, error: loadErr } = await sb
    .from('user_plan_days')
    .select('id')
    .eq('plan_id', currentPlan.id);

  if (loadErr) {
    console.error('Failed to load existing days', loadErr);
    setStatus(saveStatusEl(), loadErr.message || 'Failed to load days', 'error');
    return;
  }

  const existingIds = (Array.isArray(existing) ? existing : []).map((d) => d.id).filter(Boolean);

  if (existingIds.length) {
    const { error: itemsDelErr } = await sb
      .from('user_plan_items')
      .delete()
      .in('plan_day_id', existingIds);

    if (itemsDelErr) {
      console.warn('Failed to delete day items before regen', itemsDelErr);
    }

    const { error: daysDelErr } = await sb
      .from('user_plan_days')
      .delete()
      .eq('plan_id', currentPlan.id);

    if (daysDelErr) {
      console.error('Failed to delete existing days', daysDelErr);
      setStatus(saveStatusEl(), daysDelErr.message || 'Failed to delete days', 'error');
      return;
    }
  }

  const dayRows = [];
  for (let i = 0; i < daysCount; i += 1) {
    const date = addDays(startDate, i);
    dayRows.push({
      plan_id: currentPlan.id,
      day_index: i + 1,
      date: date,
      city: baseCity || null,
      notes: null,
    });
  }

  const { error: insertErr } = await sb
    .from('user_plan_days')
    .insert(dayRows);

  if (insertErr) {
    console.error('Failed to regenerate days', insertErr);
    setStatus(saveStatusEl(), insertErr.message || 'Failed to regenerate', 'error');
    return;
  }

  const { error: planErr } = await sb
    .from('user_plans')
    .update({
      start_date: startDate || null,
      end_date: endDate || null,
      days_count: daysCount || null,
      base_city: baseCity || null,
    })
    .eq('id', currentPlan.id);

  if (planErr) {
    console.warn('Failed to update plan after day regen', planErr);
  }

  await loadPlans({ selectId: currentPlan.id });
  setStatus(saveStatusEl(), 'Days regenerated.', 'success');
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

  const regenBtn = el('planRegenDaysBtn');
  if (regenBtn instanceof HTMLButtonElement) {
    regenBtn.addEventListener('click', regeneratePlanDays);
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

  setCurrentYear();

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
