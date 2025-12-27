(function () {
  const state = {
    sb: null,
    session: null,
    user: null,
    memberships: [],
    partnersById: {},
    selectedPartnerId: null,
    fulfillments: [],
    itemsByFulfillmentId: {},
    contactsByFulfillmentId: {},
    blocks: [],
    calendar: {
      resourcesByType: { shop: [], cars: [], trips: [], hotels: [] },
      monthValue: '',
      monthBlocks: [],
      monthBusyRanges: [],
    },
  };

  const els = {
    warning: null,
    loginPrompt: null,
    btnOpenLogin: null,
    noPartner: null,
    app: null,
    status: null,
    partnerSelect: null,
    btnRefresh: null,
    suspendedInfo: null,
    tabFulfillments: null,
    tabCalendar: null,
    tabBtnFulfillments: null,
    tabBtnCalendar: null,
    fulfillmentsHint: null,
    fulfillmentsBody: null,
    kpiPending: null,
    kpiAccepted: null,
    kpiRejected: null,
    blocksBody: null,
    blockForm: null,
    blockResourceType: null,
    blockResourceId: null,
    calendarMonthInput: null,
    calendarPrevMonth: null,
    calendarNextMonth: null,
    calendarMonthGrid: null,
    blockStart: null,
    blockEnd: null,
    blockNote: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(message, type) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(message, type || 'info');
      return;
    }
    console.log(type || 'info', message);
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text || '';
  }

  function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function getMonthValue(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function monthToStartEnd(monthValue) {
    const mv = String(monthValue || '').trim();
    const [yStr, mStr] = mv.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      const fallback = getMonthValue();
      return monthToStartEnd(fallback);
    }
    const start = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
    const end = new Date(Date.UTC(y, m, 0, 12, 0, 0));
    const startIso = start.toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);
    return { start, end, startIso, endIso };
  }

  function addMonths(monthValue, delta) {
    const mv = String(monthValue || '').trim();
    const [yStr, mStr] = mv.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const base = (Number.isFinite(y) && Number.isFinite(m))
      ? new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
      : new Date();
    base.setUTCMonth(base.getUTCMonth() + Number(delta || 0));
    return getMonthValue(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12, 0, 0)));
  }

  function setCalendarMonthInput(value) {
    const input = els.calendarMonthInput;
    if (!input) return;
    const next = value || getMonthValue();
    input.value = next;
    state.calendar.monthValue = next;
  }

  function ensureCalendarMonthInput() {
    const input = els.calendarMonthInput;
    if (!input) return;
    if (!input.value) {
      setCalendarMonthInput(getMonthValue());
    } else {
      state.calendar.monthValue = input.value;
    }
  }

  function dateRangeOverlapsMonth(startIso, endIso, monthStartIso, monthEndIso) {
    if (!startIso || !endIso) return false;
    return String(startIso) <= String(monthEndIso) && String(endIso) >= String(monthStartIso);
  }

  function isBusyOnDay(dayIso, blocks, ranges) {
    const d = String(dayIso);
    const bb = Array.isArray(blocks) ? blocks : [];
    const rr = Array.isArray(ranges) ? ranges : [];
    return bb.some(b => String(b.start_date) <= d && String(b.end_date) >= d)
      || rr.some(r => String(r.start_date) <= d && String(r.end_date) >= d);
  }

  async function loadCalendarMonthData() {
    if (!els.calendarMonthGrid) return;

    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();
    ensureCalendarMonthInput();
    const monthValue = state.calendar.monthValue || getMonthValue();
    const { startIso, endIso } = monthToStartEnd(monthValue);

    state.calendar.monthBlocks = [];
    state.calendar.monthBusyRanges = [];

    if (!state.selectedPartnerId || !type || !resourceId) {
      renderCalendarMonthGrid();
      return;
    }

    try {
      const { data: monthBlocks, error: blocksError } = await state.sb
        .from('partner_availability_blocks')
        .select('id, partner_id, resource_type, resource_id, start_date, end_date, note')
        .eq('partner_id', state.selectedPartnerId)
        .eq('resource_type', type)
        .eq('resource_id', resourceId)
        .lte('start_date', endIso)
        .gte('end_date', startIso)
        .limit(500);
      if (blocksError) throw blocksError;
      state.calendar.monthBlocks = monthBlocks || [];

      const ranges = [];
      if (type === 'cars') {
        try {
          const { data, error } = await state.sb
            .from('car_bookings')
            .select('pickup_date, return_date, status')
            .eq('offer_id', resourceId)
            .neq('status', 'cancelled')
            .lte('pickup_date', endIso)
            .gte('return_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.pickup_date || !r.return_date) return;
            ranges.push({ start_date: r.pickup_date, end_date: r.return_date });
          });
        } catch (_e) {}
      }

      if (type === 'hotels') {
        try {
          const { data, error } = await state.sb
            .from('hotel_bookings')
            .select('arrival_date, departure_date, status')
            .eq('hotel_id', resourceId)
            .neq('status', 'cancelled')
            .lte('arrival_date', endIso)
            .gte('departure_date', startIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r.arrival_date || !r.departure_date) return;
            ranges.push({ start_date: r.arrival_date, end_date: r.departure_date });
          });
        } catch (_e) {}
      }

      if (type === 'trips') {
        try {
          const { data, error } = await state.sb
            .from('trip_bookings')
            .select('trip_date, arrival_date, status, trip_id')
            .eq('trip_id', resourceId)
            .neq('status', 'cancelled')
            .gte('arrival_date', startIso)
            .lte('arrival_date', endIso)
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            const d = r.trip_date || r.arrival_date;
            if (!d) return;
            ranges.push({ start_date: d, end_date: d });
          });
        } catch (_e) {}
      }

      state.calendar.monthBusyRanges = ranges;
    } catch (error) {
      console.error(error);
      state.calendar.monthBlocks = [];
      state.calendar.monthBusyRanges = [];
    }

    renderCalendarMonthGrid();
  }

  function renderCalendarMonthGrid() {
    const grid = els.calendarMonthGrid;
    if (!grid) return;

    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();
    ensureCalendarMonthInput();
    const monthValue = state.calendar.monthValue || getMonthValue();
    const { start, end, startIso, endIso } = monthToStartEnd(monthValue);

    if (!type || !resourceId) {
      setHtml(grid, '<div style="grid-column: 1 / -1; color: var(--admin-text-muted); padding: 10px;">Select resource type + resource to view calendar</div>');
      return;
    }

    const blocks = (state.calendar.monthBlocks || [])
      .filter(b => b.resource_type === type && String(b.resource_id) === resourceId && dateRangeOverlapsMonth(b.start_date, b.end_date, startIso, endIso));
    const ranges = state.calendar.monthBusyRanges || [];

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const headerHtml = dayNames.map(d => `<div style="padding: 8px 6px; font-size: 12px; text-align:center; color: var(--admin-text-muted);">${d}</div>`).join('');

    const firstDow = (start.getUTCDay() + 6) % 7;
    const blanks = Array.from({ length: firstDow }).map(() => '<div style="height: 44px;"></div>').join('');

    const todayIso = new Date().toISOString().slice(0, 10);
    const days = [];
    for (let day = 1; day <= end.getUTCDate(); day += 1) {
      const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 12, 0, 0));
      const iso = dt.toISOString().slice(0, 10);
      const busy = isBusyOnDay(iso, blocks, ranges);
      const bg = busy ? 'rgba(107,114,128,0.35)' : 'rgba(34,197,94,0.20)';
      const border = busy ? 'rgba(107,114,128,0.60)' : 'rgba(34,197,94,0.55)';
      const outline = iso === todayIso ? '0 0 0 2px rgba(59,130,246,0.65) inset' : 'none';
      days.push(`
        <button
          type="button"
          data-day="${escapeHtml(iso)}"
          style="height: 44px; border-radius: 8px; background:${bg}; border: 1px solid ${border}; display:flex; align-items:center; justify-content:center; font-weight: 600; box-shadow: ${outline}; cursor:pointer;"
          title="${escapeHtml(iso)}"
        >${day}</button>
      `);
    }

    setHtml(grid, headerHtml + blanks + days.join(''));

    grid.querySelectorAll('button[data-day]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dayIso = btn.getAttribute('data-day');
        if (!dayIso) return;
        await toggleSingleDayBlock(dayIso);
      });
    });
  }

  async function toggleSingleDayBlock(dayIso) {
    if (!state.selectedPartnerId) return;
    const type = String(els.blockResourceType?.value || '').trim();
    const resourceId = String(els.blockResourceId?.value || '').trim();
    if (!type || !resourceId) {
      showToast('Wybierz zasób', 'error');
      return;
    }

    try {
      const existing = (state.calendar.monthBlocks || [])
        .find(b => String(b.start_date) === String(dayIso) && String(b.end_date) === String(dayIso) && String(b.resource_id) === String(resourceId) && String(b.resource_type) === String(type));

      if (existing?.id) {
        const { error } = await state.sb
          .from('partner_availability_blocks')
          .delete()
          .eq('id', existing.id)
          .eq('partner_id', state.selectedPartnerId);
        if (error) throw error;
        showToast('Day unblocked', 'success');
      } else {
        const payload = {
          partner_id: state.selectedPartnerId,
          resource_type: type,
          resource_id: resourceId,
          start_date: dayIso,
          end_date: dayIso,
          note: null,
          created_by: state.user?.id || null,
        };
        const { error } = await state.sb
          .from('partner_availability_blocks')
          .insert(payload);
        if (error) throw error;
        showToast('Day blocked', 'success');
      }

      await refreshCalendar();
    } catch (error) {
      console.error(error);
      showToast(`Błąd: ${error.message || 'Update failed'}`, 'error');
    }
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('pl-PL');
    } catch (_e) {
      return String(value);
    }
  }

  function formatSla(deadlineIso) {
    if (!deadlineIso) return '—';
    const deadline = new Date(deadlineIso);
    const diffMs = deadline.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    if (!Number.isFinite(diffMin)) return '—';
    if (diffMin <= 0) return `OVERDUE (${formatDateTime(deadlineIso)})`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${m}m (${formatDateTime(deadlineIso)})`;
  }

  function statusBadge(status) {
    const s = String(status || '');
    const colors = {
      awaiting_payment: '#6b7280',
      pending_acceptance: '#f59e0b',
      accepted: '#22c55e',
      rejected: '#ef4444',
      expired: '#ef4444',
    };
    const label = s === 'pending_acceptance'
      ? '⏳ pending'
      : s === 'accepted'
        ? '✅ accepted'
        : s === 'rejected'
          ? '❌ rejected'
          : s === 'awaiting_payment'
            ? '💳 awaiting'
            : s ? s : '—';
    const color = colors[s] || '#6b7280';
    return `<span class="badge" style="background:${color};">${escapeHtml(label)}</span>`;
  }

  function selectPersistKey() {
    return 'ce_partner_selected_v1';
  }

  function getPersistedPartnerId() {
    try {
      return localStorage.getItem(selectPersistKey());
    } catch (_e) {
      return null;
    }
  }

  function setPersistedPartnerId(partnerId) {
    try {
      localStorage.setItem(selectPersistKey(), partnerId || '');
    } catch (_e) {}
  }

  function showWarning(text) {
    if (!els.warning) return;
    if (!text) {
      els.warning.hidden = true;
      els.warning.textContent = '';
      return;
    }
    els.warning.hidden = false;
    els.warning.textContent = text;
  }

  async function openAuthModal(tab) {
    const controller = window.__authModalController;
    if (controller && typeof controller.open === 'function') {
      controller.open(tab || 'login');
      return;
    }

    const openers = document.querySelectorAll('[data-open-auth]');
    const opener = Array.from(openers).find((el) => (el.getAttribute('data-auth-target') || 'login') === (tab || 'login')) || openers[0];
    if (opener instanceof HTMLElement) {
      opener.click();
      return;
    }

    await new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('ce-auth:modal-ready', handler);
        resolve(null);
      };
      document.addEventListener('ce-auth:modal-ready', handler);
      setTimeout(() => {
        document.removeEventListener('ce-auth:modal-ready', handler);
        resolve(null);
      }, 1500);
    });

    const retryController = window.__authModalController;
    if (retryController && typeof retryController.open === 'function') {
      retryController.open(tab || 'login');
    }
  }

  async function ensureSession() {
    const { data, error } = await state.sb.auth.getSession();
    if (error) throw error;
    state.session = data?.session || null;
    state.user = state.session?.user || null;
    return state.session;
  }

  async function loadMemberships() {
    const { data: partnerUsers, error } = await state.sb
      .from('partner_users')
      .select('partner_id, role')
      .eq('user_id', state.user?.id || '')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(partnerUsers) ? partnerUsers : [];
    state.memberships = rows;
    state.partnersById = {};

    const partnerIds = rows.map((r) => r.partner_id).filter(Boolean);
    if (partnerIds.length) {
      let partners = null;
      let pErr = null;

      ({ data: partners, error: pErr } = await state.sb
        .from('partners')
        .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, cars_locations')
        .in('id', partnerIds)
        .limit(50));

      if (pErr && /cars_locations/i.test(String(pErr.message || ''))) {
        ({ data: partners, error: pErr } = await state.sb
          .from('partners')
          .select('id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels')
          .in('id', partnerIds)
          .limit(50));
      }

      if (pErr) throw pErr;

      (partners || []).forEach((partner) => {
        if (partner && partner.id) {
          state.partnersById[partner.id] = partner;
        }
      });
    }

    const persisted = getPersistedPartnerId();
    if (persisted && partnerIds.includes(persisted)) {
      state.selectedPartnerId = persisted;
    } else {
      state.selectedPartnerId = partnerIds[0] || null;
    }
  }

  function renderPartnerSelect() {
    if (!els.partnerSelect) return;

    const options = Object.values(state.partnersById)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map((partner) => {
        const label = `${partner.name}${partner.slug ? ` (${partner.slug})` : ''}`;
        return `<option value="${escapeHtml(partner.id)}">${escapeHtml(label)}</option>`;
      });

    setHtml(els.partnerSelect, options.join(''));

    if (state.selectedPartnerId) {
      els.partnerSelect.value = state.selectedPartnerId;
    }

    els.partnerSelect.disabled = options.length <= 1;
  }

  function renderSuspendedInfo() {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (!els.suspendedInfo) return;

    if (partner && partner.status === 'suspended') {
      els.suspendedInfo.hidden = false;
      els.suspendedInfo.textContent = 'Ten partner jest zawieszony. Skontaktuj się z administracją.';
      return;
    }

    els.suspendedInfo.hidden = true;
    els.suspendedInfo.textContent = '';
  }

  async function loadFulfillments() {
    if (!state.selectedPartnerId) return;

    const { data, error } = await state.sb
      .from('shop_order_fulfillments')
      .select('id, order_id, order_number, status, sla_deadline_at, accepted_at, rejected_at, rejected_reason, contact_revealed_at, created_at, subtotal, total_allocated')
      .eq('partner_id', state.selectedPartnerId)
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) throw error;

    state.fulfillments = Array.isArray(data) ? data : [];

    const ids = state.fulfillments.map((f) => f.id).filter(Boolean);
    state.itemsByFulfillmentId = {};
    state.contactsByFulfillmentId = {};

    if (ids.length) {
      const { data: items } = await state.sb
        .from('shop_order_fulfillment_items')
        .select('fulfillment_id, product_name, variant_name, quantity')
        .in('fulfillment_id', ids)
        .limit(500);

      (items || []).forEach((it) => {
        const fid = it.fulfillment_id;
        if (!fid) return;
        if (!state.itemsByFulfillmentId[fid]) state.itemsByFulfillmentId[fid] = [];
        state.itemsByFulfillmentId[fid].push(it);
      });

      const acceptedIds = state.fulfillments
        .filter((f) => String(f.status) === 'accepted')
        .map((f) => f.id)
        .filter(Boolean);

      if (acceptedIds.length) {
        const { data: contacts } = await state.sb
          .from('shop_order_fulfillment_contacts')
          .select('fulfillment_id, customer_name, customer_email, customer_phone, shipping_address')
          .in('fulfillment_id', acceptedIds)
          .limit(200);

        (contacts || []).forEach((c) => {
          const fid = c.fulfillment_id;
          if (!fid) return;
          state.contactsByFulfillmentId[fid] = c;
        });
      }
    }
  }

  function updateKpis() {
    const rows = state.fulfillments || [];
    const pending = rows.filter((f) => String(f.status) === 'pending_acceptance').length;
    const accepted = rows.filter((f) => String(f.status) === 'accepted').length;
    const rejected = rows.filter((f) => String(f.status) === 'rejected').length;

    setText(els.kpiPending, String(pending));
    setText(els.kpiAccepted, String(accepted));
    setText(els.kpiRejected, String(rejected));

    if (els.fulfillmentsHint) {
      const hint = pending > 0
        ? `Masz ${pending} fulfillmentów do akceptacji. Akceptacja ujawnia kontakt klienta.`
        : 'Brak fulfillmentów do akceptacji.';
      els.fulfillmentsHint.textContent = hint;
    }
  }

  async function callFulfillmentAction(fulfillmentId, action, reason) {
    const { data, error } = await state.sb.functions.invoke('partner-fulfillment-action', {
      body: { fulfillment_id: fulfillmentId, action, reason: reason || undefined },
    });
    if (error) {
      throw new Error(error.message || 'Request failed');
    }
    return data;
  }

  function renderFulfillmentsTable() {
    if (!els.fulfillmentsBody) return;

    if (!state.fulfillments.length) {
      setHtml(els.fulfillmentsBody, '<tr><td colspan="5" class="muted" style="padding: 16px 8px;">No fulfillments found.</td></tr>');
      return;
    }

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const isSuspended = partner && partner.status === 'suspended';

    const rowsHtml = state.fulfillments
      .map((f) => {
        const id = f.id;
        const items = state.itemsByFulfillmentId[id] || [];
        const contact = state.contactsByFulfillmentId[id] || null;

        const itemsSummary = (() => {
          if (!items.length) return '<span class="muted">—</span>';
          const parts = items.slice(0, 2).map((it) => {
            const name = it.product_name || 'Product';
            const variant = it.variant_name ? ` (${it.variant_name})` : '';
            const qty = Number(it.quantity || 0);
            return `${escapeHtml(name)}${escapeHtml(variant)} × ${qty}`;
          });
          const more = items.length > 2 ? ` +${items.length - 2} more` : '';
          return `${parts.join('<br/>')}${more ? `<div class="muted small">${escapeHtml(more)}</div>` : ''}`;
        })();

        const contactHtml = (() => {
          if (!contact) return '';
          const name = contact.customer_name || '';
          const email = contact.customer_email || '';
          const phone = contact.customer_phone || '';
          const address = contact.shipping_address && typeof contact.shipping_address === 'object'
            ? contact.shipping_address
            : null;
          const addressLine = address
            ? [address.line1, address.line2, address.postal_code, address.city, address.country].filter(Boolean).join(', ')
            : '';

          return `
            <div class="partner-contact" style="margin-top: 10px;">
              <strong>Contact</strong>
              <div class="small">${escapeHtml(name)}</div>
              <div class="small">${email ? `<a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a>` : ''}</div>
              <div class="small">${phone ? `<a href="tel:${encodeURIComponent(phone)}">${escapeHtml(phone)}</a>` : ''}</div>
              ${addressLine ? `<div class="small muted">${escapeHtml(addressLine)}</div>` : ''}
            </div>
          `;
        })();

        const orderLabel = f.order_number ? escapeHtml(f.order_number) : escapeHtml(String(f.order_id || '').slice(0, 8));
        const sla = String(f.status) === 'pending_acceptance' ? formatSla(f.sla_deadline_at) : f.sla_deadline_at ? formatDateTime(f.sla_deadline_at) : '—';

        const actionsHtml = (() => {
          const st = String(f.status || '');
          if (st !== 'pending_acceptance') {
            if (st === 'accepted' && f.contact_revealed_at) {
              return `<div class="muted small">Contact revealed: ${escapeHtml(formatDateTime(f.contact_revealed_at))}</div>`;
            }
            if (st === 'rejected' && f.rejected_reason) {
              return `<div class="muted small">Reason: ${escapeHtml(f.rejected_reason)}</div>`;
            }
            return '<div class="muted">—</div>';
          }

          const disabledAttr = isSuspended ? 'disabled' : '';

          return `
            <div class="btn-row">
              <button class="btn-sm primary" type="button" data-action="accept" data-id="${escapeHtml(id)}" ${disabledAttr}>Accept</button>
              <button class="btn-sm danger" type="button" data-action="reject" data-id="${escapeHtml(id)}" ${disabledAttr}>Reject</button>
            </div>
          `;
        })();

        const rejectedInfo = String(f.status) === 'rejected' && f.rejected_reason
          ? `<div class="muted small" style="margin-top:6px;">${escapeHtml(f.rejected_reason)}</div>`
          : '';

        return `
          <tr>
            <td>
              <strong>${orderLabel}</strong>
              <div class="muted small">Created: ${escapeHtml(formatDateTime(f.created_at))}</div>
            </td>
            <td>
              ${statusBadge(f.status)}
              ${rejectedInfo}
            </td>
            <td class="small">${escapeHtml(sla)}</td>
            <td>
              ${itemsSummary}
              ${contactHtml}
            </td>
            <td>${actionsHtml}</td>
          </tr>
        `;
      })
      .join('');

    setHtml(els.fulfillmentsBody, rowsHtml);

    els.fulfillmentsBody.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const fulfillmentId = btn.getAttribute('data-id');
        if (!action || !fulfillmentId) return;

        try {
          if (action === 'reject') {
            const reason = prompt('Podaj powód odrzucenia (opcjonalnie):') || '';
            if (!confirm('Czy na pewno chcesz odrzucić ten fulfillment?')) return;
            btn.disabled = true;
            await callFulfillmentAction(fulfillmentId, 'reject', reason);
            showToast('Fulfillment rejected', 'success');
          } else {
            if (!confirm('Akceptacja ujawni kontakt klienta. Czy kontynuować?')) return;
            btn.disabled = true;
            await callFulfillmentAction(fulfillmentId, 'accept');
            showToast('Fulfillment accepted', 'success');
          }

          await refreshFulfillments();
        } catch (error) {
          console.error(error);
          showToast(`Błąd: ${error.message || 'Action failed'}`, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  async function loadBlocks() {
    if (!state.selectedPartnerId) return;

    const { data, error } = await state.sb
      .from('partner_availability_blocks')
      .select('id, resource_type, resource_id, start_date, end_date, note, created_at')
      .eq('partner_id', state.selectedPartnerId)
      .order('start_date', { ascending: false })
      .limit(200);

    if (error) throw error;
    state.blocks = Array.isArray(data) ? data : [];
  }

  function normalizeTitleJson(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.pl || value.en || '';
    return '';
  }

  async function loadPartnerResourceIdsForType(resourceType) {
    if (!state.selectedPartnerId) return [];
    const t = String(resourceType || '').trim();
    if (!t) return [];

    const { data, error } = await state.sb
      .from('partner_resources')
      .select('resource_id')
      .eq('partner_id', state.selectedPartnerId)
      .eq('resource_type', t)
      .limit(500);

    if (error) throw error;
    return (data || []).map(r => r.resource_id).filter(Boolean);
  }

  async function loadCalendarResourcesForType(resourceType) {
    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const type = String(resourceType || '').trim();
    if (!partner || !type) return [];

    if (type === 'shop') {
      const vendorId = partner.shop_vendor_id;
      if (!vendorId) return [];

      const rows = [{ id: vendorId, label: 'All shop products (vendor)' }];
      try {
        const { data, error } = await state.sb
          .from('shop_products')
          .select('id, name, slug, status')
          .eq('vendor_id', vendorId)
          .order('updated_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          rows.push({ id: r.id, label: r.name || r.slug || r.id });
        });
      } catch (_e) {
      }
      return rows;
    }

    if (type === 'cars') {
      const assignedIds = await loadPartnerResourceIdsForType('cars');
      const rowsMap = new Map();

      try {
        const { data, error } = await state.sb
          .from('car_offers')
          .select('id, car_model, car_type, location')
          .eq('owner_partner_id', partner.id)
          .order('updated_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const label = `${r.car_model || r.car_type || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
          rowsMap.set(r.id, { id: r.id, label });
        });
      } catch (_e) {}

      if (assignedIds.length) {
        try {
          const { data, error } = await state.sb
            .from('car_offers')
            .select('id, car_model, car_type, location')
            .in('id', assignedIds)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const label = `${r.car_model || r.car_type || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
            rowsMap.set(r.id, { id: r.id, label });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Car (${String(id).slice(0, 8)})` });
          });
        }
      }

      const locs = Array.isArray(partner.cars_locations) ? partner.cars_locations.filter(Boolean) : [];
      if (locs.length) {
        try {
          const { data, error } = await state.sb
            .from('car_offers')
            .select('id, car_model, car_type, location')
            .in('location', locs)
            .eq('is_published', true)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const label = `${r.car_model || r.car_type || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
            rowsMap.set(r.id, { id: r.id, label });
          });
        } catch (_e) {}
      }

      return Array.from(rowsMap.values());
    }

    if (type === 'trips') {
      const assignedIds = await loadPartnerResourceIdsForType('trips');
      const rowsMap = new Map();

      try {
        const { data, error } = await state.sb
          .from('trips')
          .select('id, slug, title, start_city')
          .eq('owner_partner_id', partner.id)
          .order('updated_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const title = normalizeTitleJson(r.title) || r.slug || r.id;
          const city = r.start_city ? ` — ${r.start_city}` : '';
          rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
        });
      } catch (_e) {}

      if (assignedIds.length) {
        try {
          const { data, error } = await state.sb
            .from('trips')
            .select('id, slug, title, start_city')
            .in('id', assignedIds)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const title = normalizeTitleJson(r.title) || r.slug || r.id;
            const city = r.start_city ? ` — ${r.start_city}` : '';
            rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Trip (${String(id).slice(0, 8)})` });
          });
        }
      }

      return Array.from(rowsMap.values());
    }

    if (type === 'hotels') {
      const assignedIds = await loadPartnerResourceIdsForType('hotels');
      const rowsMap = new Map();

      try {
        const { data, error } = await state.sb
          .from('hotels')
          .select('id, slug, title, city')
          .eq('owner_partner_id', partner.id)
          .order('updated_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        (data || []).forEach((r) => {
          if (!r?.id) return;
          const title = normalizeTitleJson(r.title) || r.slug || r.id;
          const city = r.city ? ` — ${r.city}` : '';
          rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
        });
      } catch (_e) {}

      if (assignedIds.length) {
        try {
          const { data, error } = await state.sb
            .from('hotels')
            .select('id, slug, title, city')
            .in('id', assignedIds)
            .order('updated_at', { ascending: false })
            .limit(500);
          if (error) throw error;
          (data || []).forEach((r) => {
            if (!r?.id) return;
            const title = normalizeTitleJson(r.title) || r.slug || r.id;
            const city = r.city ? ` — ${r.city}` : '';
            rowsMap.set(r.id, { id: r.id, label: `${title}${city}` });
          });
        } catch (_e) {
          assignedIds.forEach((id) => {
            if (!id) return;
            if (!rowsMap.has(id)) rowsMap.set(id, { id, label: `Hotel (${String(id).slice(0, 8)})` });
          });
        }
      }

      return Array.from(rowsMap.values());
    }

    return [];
  }

  async function loadCalendarResourceOptions() {
    const type = String(els.blockResourceType?.value || '').trim();
    const select = els.blockResourceId;
    if (!select) return;

    if (!type) {
      setHtml(select, '<option value="">Select resource</option>');
      return;
    }

    try {
      const rows = await loadCalendarResourcesForType(type);
      state.calendar.resourcesByType[type] = rows;

      const existing = select.value;
      const options = ['<option value="">Select resource</option>']
        .concat(rows.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`));
      setHtml(select, options.join(''));

      if (existing && rows.some(r => String(r.id) === String(existing))) {
        select.value = existing;
        return;
      }

      const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
      if (type === 'shop' && partner?.shop_vendor_id && rows.some(r => String(r.id) === String(partner.shop_vendor_id))) {
        select.value = partner.shop_vendor_id;
        return;
      }

      if (rows.length) {
        select.value = rows[0].id;
      }
    } catch (error) {
      console.error(error);
      setHtml(select, '<option value="">Select resource</option>');
    }
  }

  function renderBlocksTable() {
    if (!els.blocksBody) return;

    if (!state.blocks.length) {
      setHtml(els.blocksBody, '<tr><td colspan="4" class="muted" style="padding: 16px 8px;">No blocks yet.</td></tr>');
      return;
    }

    const rows = state.blocks
      .map((b) => {
        const note = b.note ? escapeHtml(b.note) : '<span class="muted">—</span>';
        return `
          <tr>
            <td>
              <div><strong>${escapeHtml(b.resource_type)}</strong></div>
              <div class="muted small"><code>${escapeHtml(String(b.resource_id || ''))}</code></div>
            </td>
            <td class="small">${escapeHtml(String(b.start_date))} → ${escapeHtml(String(b.end_date))}</td>
            <td>${note}</td>
            <td style="text-align:right;">
              <button class="btn-sm danger" type="button" data-delete-block="${escapeHtml(b.id)}">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');

    setHtml(els.blocksBody, rows);

    els.blocksBody.querySelectorAll('button[data-delete-block]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const blockId = btn.getAttribute('data-delete-block');
        if (!blockId) return;
        if (!confirm('Delete this availability block?')) return;

        try {
          btn.disabled = true;
          const { error } = await state.sb
            .from('partner_availability_blocks')
            .delete()
            .eq('id', blockId)
            .eq('partner_id', state.selectedPartnerId);

          if (error) throw error;
          showToast('Block deleted', 'success');
          await refreshCalendar();
        } catch (error) {
          console.error(error);
          showToast(`Błąd: ${error.message || 'Delete failed'}`, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  function syncResourceTypeOptions() {
    const select = els.blockResourceType;
    if (!select) return;

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    const canShop = Boolean(partner?.can_manage_shop && partner?.shop_vendor_id);
    const canCars = Boolean(partner?.can_manage_cars);
    const canTrips = Boolean(partner?.can_manage_trips);
    const canHotels = Boolean(partner?.can_manage_hotels);

    const prev = String(select.value || '').trim();
    const allowed = [];
    if (canShop) allowed.push('shop');
    if (canCars) allowed.push('cars');
    if (canTrips) allowed.push('trips');
    if (canHotels) allowed.push('hotels');

    const opts = [];
    if (allowed.includes('shop')) opts.push('<option value="shop">shop</option>');
    if (allowed.includes('cars')) opts.push('<option value="cars">cars</option>');
    if (allowed.includes('trips')) opts.push('<option value="trips">trips</option>');
    if (allowed.includes('hotels')) opts.push('<option value="hotels">hotels</option>');

    setHtml(select, opts.join(''));

    if (prev && allowed.includes(prev)) {
      select.value = prev;
      return;
    }

    if (allowed.length) {
      select.value = allowed[0];
    }
  }

  async function refreshFulfillments() {
    if (!state.selectedPartnerId) return;
    setText(els.status, 'Loading fulfillments…');

    try {
      await loadFulfillments();
      updateKpis();
      renderFulfillmentsTable();
      setText(els.status, `Loaded ${state.fulfillments.length} fulfillments.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load fulfillments.');
      showToast(`Błąd: ${error.message || 'Failed to load fulfillments'}`, 'error');
    }
  }

  async function refreshBlocks() {
    if (!state.selectedPartnerId) return;
    setText(els.status, 'Loading availability…');

    try {
      await loadBlocks();
      renderBlocksTable();
      setText(els.status, `Loaded ${state.blocks.length} blocks.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load availability.');
      showToast(`Błąd: ${error.message || 'Failed to load availability'}`, 'error');
    }
  }

  async function refreshCalendar() {
    if (!state.selectedPartnerId) return;
    setText(els.status, 'Loading availability…');

    try {
      await loadCalendarResourceOptions();
      ensureCalendarMonthInput();
      await loadCalendarMonthData();
      await loadBlocks();
      renderBlocksTable();
      setText(els.status, `Loaded ${state.blocks.length} blocks.`);
    } catch (error) {
      console.error(error);
      setText(els.status, 'Failed to load availability.');
      showToast(`Błąd: ${error.message || 'Failed to load availability'}`, 'error');
    }
  }

  function setActiveTab(tab) {
    const isFulfillments = tab === 'fulfillments';
    els.tabBtnFulfillments?.classList.toggle('is-active', isFulfillments);
    els.tabBtnCalendar?.classList.toggle('is-active', !isFulfillments);
    setHidden(els.tabFulfillments, !isFulfillments);
    setHidden(els.tabCalendar, isFulfillments);

    if (isFulfillments) {
      refreshFulfillments();
    } else {
      refreshCalendar();
    }
  }

  async function handlePartnerChange(nextPartnerId) {
    state.selectedPartnerId = nextPartnerId || null;
    if (state.selectedPartnerId) {
      setPersistedPartnerId(state.selectedPartnerId);
    }

    renderSuspendedInfo();

    syncResourceTypeOptions();

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (partner && els.blockResourceType && els.blockResourceId) {
      if (els.blockResourceType.value === 'shop' && !els.blockResourceId.value && partner.shop_vendor_id) {
        els.blockResourceId.value = partner.shop_vendor_id;
      }
    }

    setActiveTab(els.tabBtnCalendar?.classList.contains('is-active') ? 'calendar' : 'fulfillments');
  }

  async function bootstrapPortal() {
    showWarning('');

    if (!state.sb) {
      showWarning('Supabase client not available.');
      setHidden(els.loginPrompt, true);
      setHidden(els.app, true);
      setHidden(els.noPartner, true);
      return;
    }

    try {
      await ensureSession();
    } catch (error) {
      console.error(error);
      showWarning('Błąd sesji.');
      setHidden(els.loginPrompt, false);
      setHidden(els.app, true);
      setHidden(els.noPartner, true);
      return;
    }

    if (!state.session || !state.user) {
      setHidden(els.loginPrompt, false);
      setHidden(els.app, true);
      setHidden(els.noPartner, true);
      setText(els.status, 'Not logged in.');
      return;
    }

    setHidden(els.loginPrompt, true);

    try {
      await loadMemberships();
    } catch (error) {
      console.error(error);
      showWarning(`Nie udało się wczytać partnera: ${error.message || 'Error'}`);
      setHidden(els.app, true);
      setHidden(els.noPartner, true);
      return;
    }

    if (!state.selectedPartnerId) {
      setHidden(els.noPartner, false);
      setHidden(els.app, true);
      setText(els.status, 'No partner membership.');
      return;
    }

    setHidden(els.noPartner, true);
    setHidden(els.app, false);

    renderPartnerSelect();
    renderSuspendedInfo();

    syncResourceTypeOptions();
    ensureCalendarMonthInput();

    const partner = state.selectedPartnerId ? state.partnersById[state.selectedPartnerId] : null;
    if (partner && els.blockResourceType && els.blockResourceId) {
      if (els.blockResourceType.value === 'shop' && !els.blockResourceId.value && partner.shop_vendor_id) {
        els.blockResourceId.value = partner.shop_vendor_id;
      }
    }

    setActiveTab('fulfillments');
    setText(els.status, 'Ready.');
  }

  function attachEventListeners() {
    els.btnOpenLogin?.addEventListener('click', () => openAuthModal('login'));

    els.btnRefresh?.addEventListener('click', async () => {
      await bootstrapPortal();
    });

    els.partnerSelect?.addEventListener('change', async () => {
      const nextId = els.partnerSelect.value;
      await handlePartnerChange(nextId);
    });

    els.tabBtnFulfillments?.addEventListener('click', () => setActiveTab('fulfillments'));
    els.tabBtnCalendar?.addEventListener('click', () => setActiveTab('calendar'));

    if (els.blockForm) {
      els.blockForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!state.selectedPartnerId) return;

        const resourceType = els.blockResourceType?.value || '';
        const resourceId = (els.blockResourceId?.value || '').trim();
        const startDate = els.blockStart?.value || '';
        const endDate = els.blockEnd?.value || '';
        const note = (els.blockNote?.value || '').trim();

        if (!resourceType || !resourceId || !startDate || !endDate) {
          showToast('Uzupełnij wszystkie wymagane pola', 'error');
          return;
        }

        try {
          const payload = {
            partner_id: state.selectedPartnerId,
            resource_type: resourceType,
            resource_id: resourceId,
            start_date: startDate,
            end_date: endDate,
            note: note || null,
            created_by: state.user?.id || null,
          };

          const { error } = await state.sb.from('partner_availability_blocks').insert(payload);
          if (error) throw error;

          showToast('Block created', 'success');

          if (els.blockNote) els.blockNote.value = '';

          await refreshCalendar();
        } catch (error) {
          console.error(error);
          showToast(`Błąd: ${error.message || 'Create failed'}`, 'error');
        }
      });
    }

    els.blockResourceType?.addEventListener('change', async () => {
      await loadCalendarResourceOptions();
      await loadCalendarMonthData();
    });

    els.blockResourceId?.addEventListener('change', async () => {
      await loadCalendarMonthData();
    });

    els.calendarPrevMonth?.addEventListener('click', async () => {
      ensureCalendarMonthInput();
      setCalendarMonthInput(addMonths(state.calendar.monthValue || getMonthValue(), -1));
      await loadCalendarMonthData();
    });

    els.calendarNextMonth?.addEventListener('click', async () => {
      ensureCalendarMonthInput();
      setCalendarMonthInput(addMonths(state.calendar.monthValue || getMonthValue(), 1));
      await loadCalendarMonthData();
    });

    els.calendarMonthInput?.addEventListener('change', async () => {
      state.calendar.monthValue = els.calendarMonthInput?.value || getMonthValue();
      await loadCalendarMonthData();
    });

    if (state.sb?.auth?.onAuthStateChange) {
      state.sb.auth.onAuthStateChange((_event, session) => {
        state.session = session;
        state.user = session?.user || null;
        bootstrapPortal();
      });
    }
  }

  function cacheEls() {
    els.warning = $('partnerPortalWarning');
    els.loginPrompt = $('partnerPortalLoginPrompt');
    els.btnOpenLogin = $('btnPartnerOpenLogin');
    els.noPartner = $('partnerPortalNoPartner');
    els.app = $('partnerPortalApp');
    els.status = $('partnerPortalStatus');
    els.partnerSelect = $('partnerSelect');
    els.btnRefresh = $('btnPartnerRefresh');
    els.suspendedInfo = $('partnerSuspendedInfo');

    els.tabFulfillments = $('partnerTabFulfillments');
    els.tabCalendar = $('partnerTabCalendar');
    els.tabBtnFulfillments = $('partnerTabBtnFulfillments');
    els.tabBtnCalendar = $('partnerTabBtnCalendar');

    els.fulfillmentsHint = $('fulfillmentsHint');
    els.fulfillmentsBody = $('fulfillmentsTableBody');
    els.kpiPending = $('kpiPending');
    els.kpiAccepted = $('kpiAccepted');
    els.kpiRejected = $('kpiRejected');

    els.blocksBody = $('blocksTableBody');
    els.blockForm = $('partnerBlockForm');
    els.blockResourceType = $('blockResourceType');
    els.blockResourceId = $('blockResourceId');
    els.calendarMonthInput = $('partnerCalendarMonthInput');
    els.calendarPrevMonth = $('partnerCalendarPrevMonth');
    els.calendarNextMonth = $('partnerCalendarNextMonth');
    els.calendarMonthGrid = $('partnerCalendarMonthGrid');
    els.blockStart = $('blockStart');
    els.blockEnd = $('blockEnd');
    els.blockNote = $('blockNote');
  }

  async function init() {
    cacheEls();

    state.sb = typeof window.getSupabase === 'function' ? window.getSupabase() : window.supabase;

    if (!state.sb) {
      showWarning('Supabase is not loaded yet. Please refresh.');
      return;
    }

    attachEventListeners();
    await bootstrapPortal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
