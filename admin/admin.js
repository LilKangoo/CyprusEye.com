/**
 * ADMIN PANEL - CYPRUSEYE.COM
 * Main JavaScript for admin panel functionality
 */
import { buildPricingMatrixForOfferRow, calculateCarRentalQuote } from '../js/car-pricing.js';

// =====================================================
// CONFIGURATION & GLOBALS
// =====================================================

const ADMIN_CONFIG = {
  requiredEmail: 'lilkangoomedia@gmail.com',
  requiredUserId: '15f3d442-092d-4eb8-9627-db90da0283eb',
  usersPerPage: 20,
};

let adminState = {
  user: null,
  profile: null,
  isAdmin: false,
  currentView: 'dashboard',
  usersPage: 1,
  usersTotal: 0,
  loading: true,
  pois: [],
  poisLoaded: false,
  poiLoading: false,
  poiSearch: '',
  poiFilterCategory: 'all',
  poiFilterStatus: 'all',
  poiDataSource: 'supabase',
  selectedPoi: null,
  poiFormMode: 'create',
  quests: [],
  questFormMode: 'create',
  selectedQuest: null,
};

const FORCE_REFRESH_ROW_ID = 1;

// =====================================================
// SUPABASE CLIENT
// =====================================================

// Wait for Supabase client to be available
function getSupabaseClient() {
  if (typeof window.getSupabase === 'function') {
    return window.getSupabase();
  }

  if (window.sb) {
    return window.sb;
  }
  if (window.__SB__) {
    return window.__SB__;
  }
  return null;
}

async function loadCalendarsCreateResourceOptions() {
  const client = ensureSupabase();
  if (!client) return;

  const type = String(document.getElementById('calendarsCreateType')?.value || '').trim();
  const select = document.getElementById('calendarsCreateResource');
  if (!select) return;

  if (!type) {
    select.innerHTML = '<option value="">Select resource</option>';
    return;
  }

  try {
    const normalizeI18n = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
      return '';
    };

    let rows = [];
    if (type === 'cars') {
      const { data, error } = await client
        .from('car_offers')
        .select('id, car_model, car_type, location')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => {
        const title = normalizeI18n(r.car_model) || normalizeI18n(r.car_type) || 'Car';
        const loc = r.location ? ` (${r.location})` : '';
        return { id: r.id, label: `${title}${loc}` };
      });
    } else if (type === 'trips') {
      const { data, error } = await client
        .from('trips')
        .select('id, slug, title, start_city')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => {
        const title = normalizeI18n(r.title) || r.slug || r.id;
        const city = r.start_city ? ` — ${r.start_city}` : '';
        return { id: r.id, label: `${title}${city}` };
      });
    } else if (type === 'hotels') {
      const { data, error } = await client
        .from('hotels')
        .select('id, slug, title, city')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => {
        const title = normalizeI18n(r.title) || r.slug || r.id;
        const city = r.city ? ` — ${r.city}` : '';
        return { id: r.id, label: `${title}${city}` };
      });
    } else if (type === 'shop') {
      const { data, error } = await client
        .from('shop_products')
        .select('id, name, slug, status')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => ({ id: r.id, label: r.name || r.slug || r.id }));
    }

    calendarsState.resourcesByType[type] = rows;
    const existing = select.value;
    select.innerHTML = '<option value="">Select resource</option>' + rows
      .map(r => `<option value="${r.id}">${escapeHtml(r.label)}</option>`)
      .join('');
    if (existing) select.value = existing;
  } catch (error) {
    console.error('Failed to load create resource options:', error);
    select.innerHTML = '<option value="">Select resource</option>';
  }
}

function supportsAdminPushNotifications() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function isIosDevice() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}

function isStandaloneDisplayMode() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return Boolean((navigator).standalone);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function ensureAdminServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }
  if (!window.isSecureContext) {
    throw new Error('Push requires HTTPS');
  }

  const existing = await navigator.serviceWorker.getRegistration('/admin/');
  if (existing) return existing;

  return navigator.serviceWorker.register('/admin/sw.js?v=20260210_2', { scope: '/admin/' });
}

async function fetchAdminVapidPublicKey() {
  const client = ensureSupabase();
  if (!client) throw new Error('Supabase client not available');
  if (!client.functions || typeof client.functions.invoke !== 'function') {
    throw new Error('Supabase functions not available');
  }

  let token = '';
  try {
    if (client.auth && typeof client.auth.getSession === 'function') {
      const { data: sessionData } = await client.auth.getSession();
      token = String(sessionData?.session?.access_token || '').trim();
    }
  } catch (_e) {
  }

  const { data, error, response } = await client.functions.invoke('get-admin-vapid-public-key', {
    body: {},
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (error) {
    const status = Number(response?.status || 0);

    let bodyText = '';
    try {
      bodyText = response ? await response.clone().text() : '';
    } catch (_e) {
    }

    let bodyMsg = String(bodyText || '').trim();
    let parsedBody = null;
    let bodyMsgFromErrorField = false;
    try {
      parsedBody = bodyMsg ? JSON.parse(bodyMsg) : null;
      if (parsedBody && typeof parsedBody === 'object' && parsedBody.error) {
        bodyMsg = String(parsedBody.error || '').trim();
        bodyMsgFromErrorField = true;
      }
    } catch (_e) {
    }

    let msg = String(error?.message || 'Failed to fetch VAPID public key');
    if (status === 401) msg = 'Unauthorized (please sign in again)';
    if (status === 403) msg = 'Forbidden (admin access required)';
    if (status === 404) msg = 'Missing Edge Function (not deployed)';

    // Supabase often returns 404 with { code: "NOT_FOUND", message: "Requested function was not found" }.
    // Keep the actionable "Missing Edge Function" message for 404, unless the body has an explicit { error } field.
    const isSupabaseNotFound =
      status === 404 &&
      parsedBody &&
      typeof parsedBody === 'object' &&
      String(parsedBody.code || '').toUpperCase() === 'NOT_FOUND';

    if (bodyMsg && (status !== 404 || bodyMsgFromErrorField) && !isSupabaseNotFound) msg = bodyMsg;

    console.error('get-admin-vapid-public-key failed', { status, bodyText, error });

    const details = status ? ` (HTTP ${status}${bodyMsg ? `: ${bodyMsg}` : ''})` : '';
    throw new Error(`${msg}${details}`);
  }

  const publicKey = String(data?.publicKey || '').trim();
  if (!publicKey) throw new Error('Missing VAPID public key');
  return publicKey;
}

async function upsertAdminPushSubscription(subscription) {
  const client = ensureSupabase();
  if (!client) throw new Error('Supabase client not available');

  const userId = String(adminState?.user?.id || '').trim();
  if (!userId) throw new Error('Not authenticated');

  const json = (subscription && typeof subscription.toJSON === 'function') ? subscription.toJSON() : {};
  const endpoint = String(json.endpoint || subscription?.endpoint || '').trim();
  const keys = json.keys || {};

  const payload = {
    user_id: userId,
    endpoint,
    p256dh: String(keys.p256dh || '').trim(),
    auth: String(keys.auth || '').trim(),
    subscription: json,
    user_agent: navigator.userAgent || null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('admin_push_subscriptions')
    .upsert(payload, { onConflict: 'user_id,endpoint' });

  if (error) throw error;
}

async function deleteAdminPushSubscriptionByEndpoint(endpoint) {
  const client = ensureSupabase();
  if (!client) throw new Error('Supabase client not available');

  const userId = String(adminState?.user?.id || '').trim();
  if (!userId) throw new Error('Not authenticated');

  const ep = String(endpoint || '').trim();
  if (!ep) return;

  const { error } = await client
    .from('admin_push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', ep);

  if (error) throw error;
}

async function loadAdminPushNotificationSettings() {
  const statusEl = document.getElementById('adminPushStatus');
  const hintEl = document.getElementById('adminPushHint');
  const btnEnable = document.getElementById('btnAdminEnablePush');
  const btnDisable = document.getElementById('btnAdminDisablePush');

  if (!statusEl || !btnEnable || !btnDisable) return;

  const setHint = (text) => {
    if (!hintEl) return;
    hintEl.textContent = String(text || '');
  };

  const ios = isIosDevice();
  const standalone = isStandaloneDisplayMode();
  if (ios && !standalone) {
    statusEl.textContent = 'Install required';
    btnEnable.hidden = true;
    btnDisable.hidden = true;
    setHint('On iPhone, push works only after installing the app (Share → Add to Home Screen) and opening it from the Home Screen.');
    return;
  }

  if (!supportsAdminPushNotifications()) {
    statusEl.textContent = 'Unsupported';
    btnEnable.hidden = true;
    btnDisable.hidden = true;
    setHint('Your browser/device does not support Web Push, or the page is not served over HTTPS.');
    return;
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    statusEl.textContent = 'Blocked';
    btnEnable.hidden = true;
    btnDisable.hidden = true;
    setHint('Notifications are blocked in your browser. Unblock them in browser settings and refresh.');
    return;
  }

  if (permission !== 'granted') {
    statusEl.textContent = 'Disabled';
    btnEnable.hidden = false;
    btnDisable.hidden = true;
    setHint('Click "Enable push" to request permission.');
    return;
  }

  try {
    const reg = await ensureAdminServiceWorkerRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      statusEl.textContent = 'Enabled';
      btnEnable.hidden = true;
      btnDisable.hidden = false;
      setHint('Push is active on this device.');
    } else {
      statusEl.textContent = 'Disabled';
      btnEnable.hidden = false;
      btnDisable.hidden = true;
      setHint('Permission is granted, but there is no subscription yet. Click "Enable push" to subscribe.');
    }
  } catch (e) {
    statusEl.textContent = 'Error';
    btnEnable.hidden = false;
    btnDisable.hidden = true;
    setHint(String(e?.message || 'Failed to initialize push.'));
  }
}

async function enableAdminPushNotifications() {
  try {
    if (isIosDevice() && !isStandaloneDisplayMode()) {
      showToast('Install required: add to Home Screen and open the app to enable push on iPhone.', 'info');
      await loadAdminPushNotificationSettings();
      return;
    }

    if (!supportsAdminPushNotifications()) {
      showToast('Push is not supported on this device', 'error');
      await loadAdminPushNotificationSettings();
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notification permission was not granted', 'error');
      await loadAdminPushNotificationSettings();
      return;
    }

    const reg = await ensureAdminServiceWorkerRegistration();
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await upsertAdminPushSubscription(existing);
      showToast('Push was already enabled (subscription refreshed)', 'success');
      await loadAdminPushNotificationSettings();
      return;
    }

    const publicKey = await fetchAdminVapidPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    await upsertAdminPushSubscription(subscription);
    showToast('Push enabled', 'success');
  } catch (e) {
    console.error('Failed to enable push:', e);
    showToast(String(e?.message || 'Failed to enable push'), 'error');
  } finally {
    await loadAdminPushNotificationSettings();
  }
}

async function disableAdminPushNotifications() {
  try {
    if (!supportsAdminPushNotifications()) {
      await loadAdminPushNotificationSettings();
      return;
    }

    const reg = await ensureAdminServiceWorkerRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      showToast('Push was already disabled', 'info');
      await loadAdminPushNotificationSettings();
      return;
    }

    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch (_e) {
    }

    await deleteAdminPushSubscriptionByEndpoint(endpoint);
    showToast('Push disabled', 'success');
  } catch (e) {
    console.error('Failed to disable push:', e);
    showToast(String(e?.message || 'Failed to disable push'), 'error');
  } finally {
    await loadAdminPushNotificationSettings();
  }
}

async function renderPartnerFormPayoutDetails(partnerId) {
  const form = document.getElementById('partnerForm');
  if (!form) return;

  const anchor = document.getElementById('partnerAssignmentsHint')?.parentElement || null;
  let card = document.getElementById('partnerFormPayoutDetailsCard');
  if (!card) {
    const html = `
      <div id="partnerFormPayoutDetailsCard" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
        <h4 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Payout details (bank transfer)</h4>
        <div id="partnerFormPayoutDetailsBody" style="color: var(--admin-text); font-size: 13px;"><div style="color: var(--admin-text-muted);">Loading...</div></div>
      </div>
    `;
    if (anchor) {
      anchor.insertAdjacentHTML('beforebegin', html);
    } else {
      form.insertAdjacentHTML('beforeend', html);
    }
    card = document.getElementById('partnerFormPayoutDetailsCard');
  }

  const body = document.getElementById('partnerFormPayoutDetailsBody');
  if (!body) return;

  const pid = String(partnerId || '').trim();
  if (!pid) {
    body.innerHTML = '<div style="color: var(--admin-text-muted);">Save partner first to add payout details.</div>';
    return;
  }

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('partner_payout_details')
      .select('partner_id, account_holder_name, bank_name, iban, bic, notes, updated_at')
      .eq('partner_id', pid)
      .maybeSingle();
    if (error) throw error;

    const row = data || null;
    if (!row) {
      body.innerHTML = '<div style="color: var(--admin-text-muted);">No payout details saved.</div>';
      return;
    }

    const updatedAt = row.updated_at ? escapeHtml(formatDate(row.updated_at)) : '';
    const items = [
      { k: 'Account holder', v: row.account_holder_name },
      { k: 'Bank name', v: row.bank_name },
      { k: 'IBAN', v: row.iban },
      { k: 'BIC/SWIFT', v: row.bic },
      { k: 'Notes', v: row.notes },
    ];

    body.innerHTML = `
      <div style="display:grid; gap: 6px;">
        ${updatedAt ? `<div style="color: var(--admin-text-muted); font-size: 12px;">Updated: ${updatedAt}</div>` : ''}
        ${items.map(it => {
          const value = it.v == null ? '' : String(it.v);
          return `<div style="display:grid; grid-template-columns: 140px 1fr; gap: 10px;"><div style="color: var(--admin-text-muted);">${escapeHtml(it.k)}</div><div style="font-weight: 600;">${value ? escapeHtml(value) : '—'}</div></div>`;
        }).join('')}
      </div>
    `;
  } catch (e) {
    const msg = String(e?.message || 'Failed to load payout details');
    body.innerHTML = `<div style="color:#ef4444;">${escapeHtml(msg)}</div>`;
  }
}

function messageForServiceFulfillmentAction(action, result) {
  const act = String(action || '').trim();
  const ok = Boolean(result && typeof result === 'object' && result.ok !== false);
  const skipped = Boolean(result && typeof result === 'object' && result.skipped);
  const reason = result && typeof result === 'object' ? String(result.reason || '').trim() : '';
  const nextStatus = result && typeof result === 'object' && result.data && typeof result.data === 'object'
    ? String(result.data.status || '').trim()
    : '';

  if (!ok) {
    return act === 'reject' ? 'Failed to reject fulfillment' : act === 'mark_paid' ? 'Failed to mark paid' : 'Failed to accept fulfillment';
  }

  if (skipped) {
    if (reason === 'already_claimed') return 'This order was already accepted by another partner.';
    if (reason === 'already_accepted') return 'This fulfillment is already accepted.';
    if (reason === 'already_rejected') return 'This fulfillment is already rejected.';
    if (reason === 'status_changed') return 'This fulfillment status changed. Please refresh.';
    return 'No changes were applied.';
  }

  if (act === 'reject') return 'Fulfillment rejected';
  if (act === 'mark_paid') return 'Marked as paid';
  if (nextStatus === 'awaiting_payment') return 'Accepted. Awaiting deposit payment.';
  return 'Fulfillment accepted';
}

function renderAdminCalendarsResourceTypePanels() {
  const root = document.getElementById('adminCalendarsResourceTypePanels');
  if (!root) return;

  const current = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const items = [
    { id: '', label: 'All' },
    { id: 'shop', label: 'Shop' },
    { id: 'cars', label: 'Cars' },
    { id: 'trips', label: 'Trips' },
    { id: 'hotels', label: 'Hotels' },
  ];

  root.innerHTML = items.map((it) => {
    const active = String(it.id) === current;
    const style = active
      ? 'background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.65); font-weight: 700;'
      : '';
    return `<button type="button" class="btn-small btn-secondary" data-admin-cal-type="${escapeHtml(String(it.id))}" style="${style}">${escapeHtml(it.label)}</button>`;
  }).join('');

  root.querySelectorAll('button[data-admin-cal-type]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = String(btn.getAttribute('data-admin-cal-type') || '').trim();
      const typeSelect = document.getElementById('calendarsResourceTypeFilter');
      const resourceSelect = document.getElementById('calendarsResourceIdFilter');
      if (typeSelect) typeSelect.value = type;
      if (resourceSelect) resourceSelect.value = '';
      renderAdminCalendarsResourceTypePanels();
      await loadCalendarsResourceOptions();
      renderAdminCalendarsResourcePanels();
      syncAdminCalendarsCreateFields();
      renderCalendarsTable();
      await loadCalendarsMonthData();
    });
  });
}

function renderAdminCalendarsResourcePanels() {
  const root = document.getElementById('adminCalendarsResourcePanels');
  if (!root) return;

  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const resourceId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();

  if (!type) {
    root.innerHTML = '<div style="color: var(--admin-text-muted); padding: 6px 0;">Select resource type</div>';
    return;
  }

  const rows = Array.isArray(calendarsState.resourcesByType?.[type]) ? calendarsState.resourcesByType[type] : [];
  if (!rows.length) {
    root.innerHTML = '<div style="color: var(--admin-text-muted); padding: 6px 0;">No resources loaded</div>';
    return;
  }

  const maxTiles = 60;
  const tiles = rows.slice(0, maxTiles);
  const extra = rows.length - tiles.length;

  const selected = calendarsState.bulkMode ? ensureCalendarsSelectedSetForType(type) : new Set();

  root.innerHTML = tiles.map((r) => {
    const id = r?.id ? String(r.id) : '';
    const label = r?.label ? String(r.label) : id;
    const active = id && resourceId && id === resourceId;
    const isSelected = calendarsState.bulkMode && id && selected.has(id);
    const style = active
      ? 'background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.65); font-weight: 700;'
      : (isSelected ? 'background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.55); font-weight: 700;' : '');
    return `<button type="button" class="btn-small btn-secondary" data-admin-cal-resource="${escapeHtml(id)}" style="${style}">${escapeHtml(label)}</button>`;
  }).join('') + (extra > 0 ? `<div style="padding: 6px 0; color: var(--admin-text-muted); font-size: 12px;">+${extra} more (use dropdown)</div>` : '');

  root.querySelectorAll('button[data-admin-cal-resource]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = String(btn.getAttribute('data-admin-cal-resource') || '').trim();
      const resourceSelect = document.getElementById('calendarsResourceIdFilter');
      if (resourceSelect) resourceSelect.value = id;

      if (calendarsState.bulkMode && type && id) {
        const set = ensureCalendarsSelectedSetForType(type);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        updateAdminCalendarsSelectionSummary();
      }

      renderAdminCalendarsResourcePanels();
      syncAdminCalendarsCreateFields();
      await loadCalendarsMonthData();
    });
  });
}

function syncAdminCalendarsCreateFields() {
  const partnerFilter = document.getElementById('calendarsPartnerFilter');
  const typeSelect = document.getElementById('calendarsResourceTypeFilter');
  const resourceSelect = document.getElementById('calendarsResourceIdFilter');

  const createPartner = document.getElementById('calendarsCreatePartner');
  const createType = document.getElementById('calendarsCreateType');
  const createResource = document.getElementById('calendarsCreateResource');

  if (createPartner && partnerFilter) createPartner.value = String(partnerFilter.value || '');
  if (createType && typeSelect) createType.value = String(typeSelect.value || '');

  if (createType) {
    loadCalendarsCreateResourceOptions().then(() => {
      if (createResource && resourceSelect) {
        createResource.value = String(resourceSelect.value || '');
      }
    });
  }
}

function initAdminCalendarsRealtime() {
  const client = ensureSupabase();
  if (!client) return;
  if (typeof client.channel !== 'function') return;
  if (adminCalendarsRealtimeChannel) return;

  try {
    adminCalendarsRealtimeChannel = client
      .channel('admin-calendars-blocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_availability_blocks' },
        () => {
          try {
            if (adminState.currentView !== 'calendars') return;
            loadAdminCalendarsData();
          } catch (_e) {
          }
        },
      )
      .subscribe();
  } catch (e) {
    console.warn('Failed to init calendars realtime:', e);
  }
}

function fillCalendarsCreatePartnerSelect() {
  const select = document.getElementById('calendarsCreatePartner');
  if (!select) return;

  const existing = select.value;
  select.innerHTML = '<option value="">Select partner</option>' + (calendarsState.partners || [])
    .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join('');
  if (existing) select.value = existing;
}

async function createAvailabilityBlockFromAdminForm() {
  const client = ensureSupabase();
  if (!client) return;

  const partnerId = String(document.getElementById('calendarsCreatePartner')?.value || '').trim();
  const type = String(document.getElementById('calendarsCreateType')?.value || '').trim();
  const resourceId = String(document.getElementById('calendarsCreateResource')?.value || '').trim();
  const start = String(document.getElementById('calendarsCreateStart')?.value || '').trim();
  const end = String(document.getElementById('calendarsCreateEnd')?.value || '').trim();
  const note = String(document.getElementById('calendarsCreateNote')?.value || '').trim();

  if (calendarsState.bulkMode) {
    if (!partnerId || !start || !end) {
      showToast('Wypełnij partner/start/end', 'error');
      return;
    }
    const targets = await getAdminCalendarsTargets();
    if (!targets.length) {
      showToast('No target resources selected', 'error');
      return;
    }

    try {
      await createRangeBlocksForTargetsAdmin(partnerId, start, end, note, targets);
      const noteInput = document.getElementById('calendarsCreateNote');
      if (noteInput) noteInput.value = '';
      await loadAdminCalendarsData();
    } catch (error) {
      console.error('Failed to create blocks:', error);
      showToast(error.message || 'Failed to create blocks', 'error');
    }
    return;
  }

  if (!partnerId || !type || !resourceId || !start || !end) {
    showToast('Wypełnij partner/type/resource/start/end', 'error');
    return;
  }

  try {
    const payload = {
      partner_id: partnerId,
      resource_type: type,
      resource_id: resourceId,
      start_date: start,
      end_date: end,
      note: note || null,
      created_by: adminState.user?.id || null,
    };
    const { error } = await client
      .from('partner_availability_blocks')
      .insert(payload);
    if (error) throw error;

    showToast('Block created', 'success');
    const noteInput = document.getElementById('calendarsCreateNote');
    if (noteInput) noteInput.value = '';
    await loadAdminCalendarsData();
  } catch (error) {
    console.error('Failed to create block:', error);
    showToast(error.message || 'Failed to create block', 'error');
  }
}

async function deleteAvailabilityBlockAdmin(blockId) {
  const client = ensureSupabase();
  if (!client) return;
  if (!blockId) return;
  if (!confirm('Delete this availability block?')) return;

  try {
    const { error } = await client
      .from('partner_availability_blocks')
      .delete()
      .eq('id', blockId);
    if (error) throw error;
    showToast('Block deleted', 'success');
    await loadAdminCalendarsData();
  } catch (error) {
    console.error('Failed to delete block:', error);
    showToast(error.message || 'Failed to delete block', 'error');
  }
}

// Helper to ensure Supabase is available
function ensureSupabase() {
  if (!sb) {
    sb = getSupabaseClient();
  }
  return sb;
}

// Try to get client immediately
let sb = getSupabaseClient();

// If not available, wait a bit
if (!sb) {
  console.warn('Supabase client not immediately available, waiting...');
}

// =====================================================
// DOM HELPERS
// =====================================================

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => root.querySelectorAll(selector);

function showElement(element) {
  if (element) {
    element.hidden = false;
    element.style.display = '';
  }
}

function isSchemaCacheError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code.startsWith('PGRST') && /schema cache/i.test(msg);
}

function isMissingColumnError(err, columnName) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  const col = String(columnName || '').trim();
  if (!col) return false;
  return (
    code === '42703'
    || (code.startsWith('PGRST') && /column/i.test(msg))
    || /column .* does not exist/i.test(msg)
    || /Could not find the '.*' column/i.test(msg)
  ) && msg.toLowerCase().includes(col.toLowerCase());
}

function stripAffiliatePartnerPayload(payload) {
  const next = { ...(payload || {}) };
  delete next.affiliate_enabled;
  delete next.affiliate_level1_bps_override;
  delete next.affiliate_level2_bps_override;
  delete next.affiliate_level3_bps_override;
  return next;
}

const partnersState = {
  partners: [],
  partnersById: {},
  partnerUsersCountByPartnerId: {},
  fulfillmentStatsByPartnerId: {},
  servicesByPartnerId: {},
  servicesLoadingByPartnerId: {},
  expandedServicesPartnerId: null,
};

const partnersUiState = {
  activeTab: 'list',
  depositLoadedOnce: false,
  affiliateLoadedOnce: false,
  affiliateEligibleLoadedOnce: false,
  affiliatePayoutOverviewLoadedOnce: false,
  affiliateAdjustmentsLoadedOnce: false,
  affiliateCashoutRequestsLoadedOnce: false,
  affiliateEligibleUsers: [],
  affiliateEligibleUsersById: {},
  affiliateEligibleMemberships: [],
  affiliateEligiblePartners: [],
  affiliateEligibleUsersByPartnerId: {},
  affiliatePayoutOverviewRows: [],
  affiliateAdjustmentsRows: [],
  affiliateCashoutRequestsRows: [],
  depositOverrideSearchTimer: null,
  depositOverrideSearchResults: [],
  depositOverrides: [],
  depositOverrideLabels: {},
  depositRequests: [],
  affiliateSettings: null,
  affiliateOverrides: [],
};

let adminPartnerAuditChannel = null;

let adminCalendarsRealtimeChannel = null;

let partnersAutoRefreshTimer = null;

let adminDashboardOrdersChannel = null;

let dashboardAutoRefreshTimer = null;

function initAdminPartnerRealtime() {
  const client = ensureSupabase();
  if (!client) return;
  if (typeof client.channel !== 'function') return;
  if (adminPartnerAuditChannel) return;

  try {
    adminPartnerAuditChannel = client
      .channel('admin-partner-audit')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'partner_audit_log' },
        (payload) => {
          const row = payload?.new || {};
          const action = String(row.action || '');
          if (action !== 'fulfillment_accepted' && action !== 'fulfillment_rejected') return;

          const pid = row.partner_id;
          const partnerName = partnersState.partnersById?.[pid]?.name || (pid ? String(pid).slice(0, 8) : 'partner');
          const verb = action === 'fulfillment_accepted' ? 'accepted' : 'rejected';
          const et = String(row.entity_type || '').toLowerCase();
          const kind = et.includes('service') ? 'service' : (et.includes('shop') ? 'shop' : '');
          const label = kind ? ` ${kind}` : '';
          showToast(`Partner ${partnerName} ${verb} a${label} fulfillment`, 'info');

          if (adminState.currentView === 'partners') {
            loadPartnersData();
          }
        },
      )
      .subscribe();
  } catch (e) {
    console.warn('Failed to init partner realtime:', e);
  }
}

function ensurePartnersAutoRefresh() {
  if (partnersAutoRefreshTimer) return;

  partnersAutoRefreshTimer = setInterval(() => {
    try {
      if (adminState.currentView !== 'partners') return;
      loadPartnersData();
    } catch (_e) {
    }
  }, 30000);
}

function initAdminDashboardRealtime() {
  const client = ensureSupabase();
  if (!client) return;
  if (typeof client.channel !== 'function') return;
  if (adminDashboardOrdersChannel) return;

  try {
    adminDashboardOrdersChannel = client
      .channel('admin-dashboard-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_service_fulfillments' },
        () => {
          if (adminState.currentView !== 'dashboard') return;
          loadAllOrders({ silent: true });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_deposit_requests' },
        () => {
          if (adminState.currentView !== 'dashboard') return;
          loadAllOrders({ silent: true });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_orders' },
        () => {
          if (adminState.currentView !== 'dashboard') return;
          loadAllOrders({ silent: true });
        },
      )
      .subscribe();
  } catch (e) {
    console.warn('Failed to init dashboard realtime:', e);
  }
}

function ensureDashboardAutoRefresh() {
  if (dashboardAutoRefreshTimer) return;
  dashboardAutoRefreshTimer = setInterval(() => {
    try {
      if (adminState.currentView !== 'dashboard') return;
      loadAllOrders({ silent: true });
    } catch (_e) {
    }
  }, 30000);
}

const partnersAdminState = {
  vendors: [],
  vendorsById: {},
};

const partnerAssignmentsState = {
  bound: false,
  activeTab: 'cars',
  partnerId: null,
  partnerVendorId: null,
  rows: [],
  rowsByType: { cars: [], trips: [], hotels: [], shop: [] },
  resourceDetails: { cars: {}, trips: {}, hotels: {}, shop: {} },
  shopVendorProducts: [],
  searchResults: { cars: [], trips: [], hotels: [], shop: [] },
  searchTimers: { cars: null, trips: null, hotels: null, shop: null },
};

function normalizeTitleJson(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
  return '';
}

function capitalize(value) {
  const v = String(value || '');
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}

function setPartnerAssignmentsHint(text) {
  const el = document.getElementById('partnerAssignmentsHint');
  if (!el) return;
  el.textContent = text || '';
}

function setPartnerAssignShopModeText(text) {
  const el = document.getElementById('partnerAssignShopMode');
  if (!el) return;
  el.textContent = text || '';
}

function partnerAssignTbodyId(type) {
  const t = String(type || '').trim();
  return `partnerAssignList${capitalize(t)}`;
}

function clearPartnerAssignTable(type, colspan) {
  const t = String(type || '').trim();
  const tbody = document.getElementById(partnerAssignTbodyId(t));
  if (!tbody) return;
  const span = Number(colspan || 3) || 3;
  tbody.innerHTML = `<tr><td colspan="${span}" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">—</td></tr>`;
}

function partnerAssignFieldId(kind, type) {
  const t = capitalize(String(type || '').trim());
  if (kind === 'search') return `partnerAssignSearch${t}`;
  if (kind === 'select') return `partnerAssignSelect${t}`;
  if (kind === 'add') return `btnPartnerAssignAdd${t}`;
  return '';
}

function partnerAssignShopControlsEnabled(enabled) {
  const wrap = document.getElementById('partnerAssignShopControls');
  if (!wrap) return;
  wrap.querySelectorAll('input, select, button').forEach((el) => {
    el.disabled = !enabled;
  });
}

function setPartnerAssignActiveTab(nextTab) {
  const tab = String(nextTab || '').trim();
  if (!tab) return;
  partnerAssignmentsState.activeTab = tab;

  const tabs = document.getElementById('partnerAssignTabButtons');
  if (tabs) {
    tabs.querySelectorAll('button[data-partner-assign-tab]').forEach((btn) => {
      const t = String(btn.getAttribute('data-partner-assign-tab') || '').trim();
      const active = t === tab;
      btn.style.background = active ? 'rgba(59,130,246,0.18)' : '';
      btn.style.borderColor = active ? 'rgba(59,130,246,0.65)' : '';
      btn.style.fontWeight = active ? '700' : '';
    });
  }

  const panels = document.getElementById('partnerAssignPanels');
  if (panels) {
    panels.querySelectorAll('[data-partner-assign-panel]').forEach((panel) => {
      const t = String(panel.getAttribute('data-partner-assign-panel') || '').trim();
      panel.style.display = t === tab ? '' : 'none';
    });
  }
}

function setPartnerAssignSelectOptions(type, rows) {
  const selectId = partnerAssignFieldId('select', type);
  const select = selectId ? document.getElementById(selectId) : null;
  if (!select) return;
  const options = (rows || []).map((r) => {
    const id = r?.id ? String(r.id) : '';
    const label = r?.label ? String(r.label) : id;
    return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
  });
  select.innerHTML = `<option value="">—</option>${options.join('')}`;
  select.value = '';
}

async function loadPartnerAssignments(partnerId) {
  const client = ensureSupabase();
  if (!client) return;
  const pid = String(partnerId || '').trim();
  if (!pid) return;

  partnerAssignmentsState.rows = [];
  partnerAssignmentsState.rowsByType = { cars: [], trips: [], hotels: [], shop: [] };
  partnerAssignmentsState.resourceDetails = { cars: {}, trips: {}, hotels: {}, shop: {} };

  const { data, error } = await client
    .from('partner_resources')
    .select('id, resource_type, resource_id, created_at')
    .eq('partner_id', pid)
    .limit(2000);
  if (error) throw error;

  const rows = (data || []).filter(Boolean).map((r) => {
    return {
      id: r.id,
      resource_type: String(r.resource_type || '').trim(),
      resource_id: r.resource_id,
      created_at: r.created_at,
    };
  }).filter((r) => r.resource_type && r.resource_id);

  partnerAssignmentsState.rows = rows;
  ['cars', 'trips', 'hotels', 'shop'].forEach((t) => {
    partnerAssignmentsState.rowsByType[t] = rows.filter((r) => r.resource_type === t);
  });

  const idsForType = (t) => Array.from(new Set((partnerAssignmentsState.rowsByType[t] || []).map((r) => r.resource_id).filter(Boolean)));
  const [carsIds, tripIds, hotelIds, shopIds] = ['cars', 'trips', 'hotels', 'shop'].map(idsForType);

  if (carsIds.length) {
    try {
      const { data: rr, error: ee } = await client
        .from('car_offers')
        .select('id, car_model, car_type, location')
        .in('id', carsIds)
        .limit(500);
      if (ee) throw ee;
      (rr || []).forEach((r) => {
        if (r?.id) partnerAssignmentsState.resourceDetails.cars[r.id] = r;
      });
    } catch (_e) {}
  }

  if (tripIds.length) {
    try {
      const attempts = [
        { select: 'id, slug, title, start_city', order: 'updated_at' },
        { select: 'id, slug, title, start_city', order: 'created_at' },
        { select: 'id, slug, title', order: 'updated_at' },
        { select: 'id, slug, title', order: 'created_at' },
      ];
      for (const attempt of attempts) {
        try {
          const { data: rr, error: ee } = await client
            .from('trips')
            .select(attempt.select)
            .in('id', tripIds)
            .order(attempt.order, { ascending: false })
            .limit(500);
          if (ee) throw ee;
          (rr || []).forEach((r) => {
            if (r?.id) partnerAssignmentsState.resourceDetails.trips[r.id] = r;
          });
          break;
        } catch (_inner) {
        }
      }
    } catch (_e) {}
  }

  if (hotelIds.length) {
    try {
      const { data: rr, error: ee } = await client
        .from('hotels')
        .select('id, slug, title, city')
        .in('id', hotelIds)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (ee) throw ee;
      (rr || []).forEach((r) => {
        if (r?.id) partnerAssignmentsState.resourceDetails.hotels[r.id] = r;
      });
    } catch (_e) {}
  }

  if (shopIds.length) {
    try {
      const { data: rr, error: ee } = await client
        .from('shop_products')
        .select('id, name, slug, status')
        .in('id', shopIds)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (ee) throw ee;
      (rr || []).forEach((r) => {
        if (r?.id) partnerAssignmentsState.resourceDetails.shop[r.id] = r;
      });
    } catch (_e) {}
  }
}

function renderPartnerAssignmentsHint() {
  const cars = (partnerAssignmentsState.rowsByType.cars || []).length;
  const trips = (partnerAssignmentsState.rowsByType.trips || []).length;
  const hotels = (partnerAssignmentsState.rowsByType.hotels || []).length;
  const shop = (partnerAssignmentsState.rowsByType.shop || []).length;
  setPartnerAssignmentsHint(`Assigned: cars ${cars}, trips ${trips}, hotels ${hotels}, shop ${shop}`);
}

function renderPartnerAssignmentsTables() {
  ['cars', 'trips', 'hotels'].forEach((t) => {
    renderPartnerAssignmentsTable(t);
  });
  renderPartnerAssignmentsShop();
  renderPartnerAssignmentsHint();
}

function renderPartnerAssignmentsTable(type) {
  const t = String(type || '').trim();
  const tbody = document.getElementById(partnerAssignTbodyId(t));
  if (!tbody) return;

  const rows = partnerAssignmentsState.rowsByType?.[t] || [];
  if (!rows.length) {
    clearPartnerAssignTable(t, 3);
    return;
  }

  const details = partnerAssignmentsState.resourceDetails?.[t] || {};

  tbody.innerHTML = rows.map((r) => {
    const rid = r.resource_id;
    const d = rid ? details[rid] : null;

    if (t === 'cars') {
      const title = d ? (normalizeTitleJson(d.car_model) || normalizeTitleJson(d.car_type) || String(rid).slice(0, 8)) : String(rid).slice(0, 8);
      const loc = d?.location ? String(d.location) : '—';
      return `
        <tr>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(loc)}</td>
          <td style="text-align: right;"><button class="btn-small btn-secondary" onclick="removePartnerResourceAssignment('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Remove</button></td>
        </tr>
      `;
    }

    if (t === 'trips') {
      const title = d ? (normalizeTitleJson(d.title) || d.slug || String(rid).slice(0, 8)) : String(rid).slice(0, 8);
      const city = d?.start_city ? String(d.start_city) : '—';
      return `
        <tr>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(city)}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn-small btn-secondary" onclick="backfillPartnerResourceFulfillments('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Backfill</button>
            <button class="btn-small btn-secondary" onclick="removePartnerResourceAssignment('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Remove</button>
          </td>
        </tr>
      `;
    }

    if (t === 'hotels') {
      const title = d ? (normalizeTitleJson(d.title) || d.slug || String(rid).slice(0, 8)) : String(rid).slice(0, 8);
      const city = d?.city ? String(d.city) : '—';
      return `
        <tr>
          <td>${escapeHtml(title)}</td>
          <td>${escapeHtml(city)}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn-small btn-secondary" onclick="backfillPartnerResourceFulfillments('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Backfill</button>
            <button class="btn-small btn-secondary" onclick="removePartnerResourceAssignment('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Remove</button>
          </td>
        </tr>
      `;
    }

    if (t === 'shop') {
      const label = d ? (d.name || d.slug || String(rid).slice(0, 8)) : String(rid).slice(0, 8);
      const status = d?.status ? String(d.status) : '—';
      return `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${escapeHtml(status)}</td>
          <td style="text-align: right;"><button class="btn-small btn-secondary" onclick="removePartnerResourceAssignment('${escapeHtml(t)}','${escapeHtml(String(rid))}')">Remove</button></td>
        </tr>
      `;
    }

    return '';
  }).join('');
}

function renderPartnerAssignmentsShop() {
  const tbody = document.getElementById(partnerAssignTbodyId('shop'));
  if (!tbody) return;

  const vendorId = String(partnerAssignmentsState.partnerVendorId || '').trim();
  if (vendorId) {
    partnerAssignShopControlsEnabled(false);
    const assignedCount = (partnerAssignmentsState.rowsByType.shop || []).length;
    setPartnerAssignShopModeText(assignedCount ? `Vendor mode. (Ignoring ${assignedCount} assigned products)` : 'Vendor mode. Products are linked by vendor.');
    const products = Array.isArray(partnerAssignmentsState.shopVendorProducts) ? partnerAssignmentsState.shopVendorProducts : [];
    if (!products.length) {
      clearPartnerAssignTable('shop', 3);
      return;
    }
    tbody.innerHTML = products.map((p) => {
      const label = p?.name || p?.slug || (p?.id ? String(p.id).slice(0, 8) : '—');
      const status = p?.status ? String(p.status) : '—';
      return `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${escapeHtml(status)}</td>
          <td style="text-align:right;">—</td>
        </tr>
      `;
    }).join('');
    return;
  }

  partnerAssignShopControlsEnabled(true);
  setPartnerAssignShopModeText('Partner mode. Assign individual products.');
  renderPartnerAssignmentsTable('shop');
}

async function loadShopVendorProducts(vendorId) {
  const client = ensureSupabase();
  if (!client) return;
  const vid = String(vendorId || '').trim();
  if (!vid) {
    partnerAssignmentsState.shopVendorProducts = [];
    return;
  }
  try {
    const { data, error } = await client
      .from('shop_products')
      .select('id, name, slug, status')
      .eq('vendor_id', vid)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    partnerAssignmentsState.shopVendorProducts = data || [];
  } catch (_e) {
    partnerAssignmentsState.shopVendorProducts = [];
  }
}

async function refreshPartnerAssignments() {
  const pid = String(partnerAssignmentsState.partnerId || '').trim();

  ['cars', 'trips', 'hotels', 'shop'].forEach((t) => {
    clearPartnerAssignTable(t, 3);
    setPartnerAssignSelectOptions(t, []);
  });

  if (!pid) {
    setPartnerAssignmentsHint('Save partner first to manage assigned resources.');
    setPartnerAssignShopModeText('');
    partnerAssignShopControlsEnabled(false);
    return;
  }

  await loadPartnerAssignments(pid);
  await loadShopVendorProducts(partnerAssignmentsState.partnerVendorId);
  renderPartnerAssignmentsTables();

  ['cars', 'trips', 'hotels', 'shop'].forEach((t) => {
    schedulePartnerAssignSearch(t);
  });
}

async function removePartnerResourceAssignment(type, resourceId) {
  const client = ensureSupabase();
  if (!client) return;
  const pid = String(partnerAssignmentsState.partnerId || '').trim();
  const t = String(type || '').trim();
  const rid = String(resourceId || '').trim();
  if (!pid || !t || !rid) return;

  try {
    const { error } = await client
      .from('partner_resources')
      .delete()
      .eq('partner_id', pid)
      .eq('resource_type', t)
      .eq('resource_id', rid);
    if (error) throw error;
    showToast('Assignment removed', 'success');
    await refreshPartnerAssignments();
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Failed to remove assignment', 'error');
  }
}

window.removePartnerResourceAssignment = (type, resourceId) => removePartnerResourceAssignment(type, resourceId);

async function backfillPartnerResourceFulfillments(type, resourceId) {
  const client = ensureSupabase();
  if (!client) return;
  const t = String(type || '').trim();
  const rid = String(resourceId || '').trim();
  if (!rid) return;
  if (t !== 'trips' && t !== 'hotels') return;

  try {
    const { data, error } = await client.rpc('admin_backfill_partner_service_fulfillments_for_resource', {
      p_resource_type: t,
      p_resource_id: rid,
    });
    if (error) throw error;
    const n = Number(data || 0);
    const cnt = Number.isFinite(n) ? n : 0;
    showToast(`Backfilled ${cnt} booking(s)`, 'success');
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Backfill failed', 'error');
  }
}

window.backfillPartnerResourceFulfillments = (type, resourceId) => backfillPartnerResourceFulfillments(type, resourceId);

async function addPartnerResourceAssignment(type) {
  const client = ensureSupabase();
  if (!client) return;
  const pid = String(partnerAssignmentsState.partnerId || '').trim();
  const t = String(type || '').trim();
  if (!pid || !t) return;
  if (t === 'shop' && String(partnerAssignmentsState.partnerVendorId || '').trim()) return;

  const selectId = partnerAssignFieldId('select', t);
  const select = selectId ? document.getElementById(selectId) : null;
  const rid = String(select?.value || '').trim();
  if (!rid) {
    showToast('Select a resource first', 'error');
    return;
  }

  try {
    const { error } = await client
      .from('partner_resources')
      .insert({ partner_id: pid, resource_type: t, resource_id: rid });
    if (error) throw error;

    let backfilled = null;
    if (t === 'trips' || t === 'hotels') {
      try {
        const { data, error: backfillError } = await client.rpc('admin_backfill_partner_service_fulfillments_for_resource', {
          p_resource_type: t,
          p_resource_id: rid,
        });
        if (!backfillError) {
          const n = Number(data || 0);
          if (Number.isFinite(n)) backfilled = n;
        }
      } catch (_e) {
      }
    }

    const msg = (backfilled != null && backfilled > 0)
      ? `Resource assigned (backfilled ${backfilled} booking(s))`
      : 'Resource assigned';
    showToast(msg, 'success');
    await refreshPartnerAssignments();
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || 'Failed to assign resource');
    showToast(msg, 'error');
  }
}

async function searchPartnerResources(type, term) {
  const client = ensureSupabase();
  if (!client) return [];
  const t = String(type || '').trim();
  const q = String(term || '').toLowerCase().trim();

  if (t === 'shop' && String(partnerAssignmentsState.partnerVendorId || '').trim()) {
    return [];
  }

  if (t === 'cars') {
    try {
      const { data, error } = await client
        .from('car_offers')
        .select('id, car_model, car_type, location')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []).map((r) => {
        const label = `${normalizeTitleJson(r.car_model) || normalizeTitleJson(r.car_type) || 'Car'}${r.location ? ` (${r.location})` : ''}`.trim();
        return { id: r.id, label, raw: r };
      });
      if (!q) return rows.slice(0, 50);
      return rows.filter((r) => String(r.label || '').toLowerCase().includes(q)).slice(0, 50);
    } catch (_e) {
      return [];
    }
  }

  if (t === 'trips') {
    const attempts = [
      { select: 'id, slug, title, start_city', order: 'updated_at' },
      { select: 'id, slug, title, start_city', order: 'created_at' },
      { select: 'id, slug, title', order: 'updated_at' },
      { select: 'id, slug, title', order: 'created_at' },
    ];
    for (const attempt of attempts) {
      try {
        const { data, error } = await client
          .from('trips')
          .select(attempt.select)
          .order(attempt.order, { ascending: false })
          .limit(500);
        if (error) throw error;
        const rows = (data || []).map((r) => {
          const title = normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8);
          const city = r.start_city ? ` — ${r.start_city}` : '';
          return { id: r.id, label: `${title}${city}` };
        });
        if (!q) return rows.slice(0, 50);
        return rows.filter((r) => String(r.label || '').toLowerCase().includes(q)).slice(0, 50);
      } catch (_e) {
      }
    }
    return [];
  }

  if (t === 'hotels') {
    try {
      const { data, error } = await client
        .from('hotels')
        .select('id, slug, title, city')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []).map((r) => {
        const title = normalizeTitleJson(r.title) || r.slug || String(r.id).slice(0, 8);
        const city = r.city ? ` — ${r.city}` : '';
        return { id: r.id, label: `${title}${city}` };
      });
      if (!q) return rows.slice(0, 50);
      return rows.filter((r) => String(r.label || '').toLowerCase().includes(q)).slice(0, 50);
    } catch (_e) {
      return [];
    }
  }

  if (t === 'shop') {
    try {
      const { data, error } = await client
        .from('shop_products')
        .select('id, name, slug, status')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []).map((r) => {
        const label = r.name || r.slug || String(r.id).slice(0, 8);
        return { id: r.id, label };
      });
      if (!q) return rows.slice(0, 50);
      return rows.filter((r) => String(r.label || '').toLowerCase().includes(q)).slice(0, 50);
    } catch (_e) {
      return [];
    }
  }

  return [];
}

function schedulePartnerAssignSearch(type) {
  const t = String(type || '').trim();
  const searchId = partnerAssignFieldId('search', t);
  const input = searchId ? document.getElementById(searchId) : null;
  if (!input) return;
  const term = String(input.value || '');

  if (partnerAssignmentsState.searchTimers[t]) {
    clearTimeout(partnerAssignmentsState.searchTimers[t]);
  }

  partnerAssignmentsState.searchTimers[t] = setTimeout(async () => {
    partnerAssignmentsState.searchTimers[t] = null;
    try {
      const rows = await searchPartnerResources(t, term);
      partnerAssignmentsState.searchResults[t] = rows;
      setPartnerAssignSelectOptions(t, rows);
    } catch (_e) {
      setPartnerAssignSelectOptions(t, []);
    }
  }, 250);
}

function bindPartnerAssignmentsUi() {
  if (partnerAssignmentsState.bound) return;
  partnerAssignmentsState.bound = true;

  const tabs = document.getElementById('partnerAssignTabButtons');
  if (tabs) {
    tabs.querySelectorAll('button[data-partner-assign-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-partner-assign-tab');
        if (tab) setPartnerAssignActiveTab(tab);
      });
    });
  }

  ['cars', 'trips', 'hotels', 'shop'].forEach((t) => {
    const searchId = partnerAssignFieldId('search', t);
    const input = searchId ? document.getElementById(searchId) : null;
    if (input) {
      input.addEventListener('input', () => schedulePartnerAssignSearch(t));
    }

    const addId = partnerAssignFieldId('add', t);
    const addBtn = addId ? document.getElementById(addId) : null;
    if (addBtn) {
      addBtn.addEventListener('click', () => addPartnerResourceAssignment(t));
    }
  });

  setPartnerAssignActiveTab(partnerAssignmentsState.activeTab || 'cars');
}

async function loadPartnersData() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('partnersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px;">Loading partners...</td></tr>';

  try {
    let partners = null;
    let partnersError = null;
    ({ data: partners, error: partnersError } = await client
      .from('partners')
      .select('id, name, slug, status, shop_vendor_id, affiliate_enabled, vendor:shop_vendors(name)')
      .order('created_at', { ascending: false })
      .limit(200));

    if (partnersError && (isMissingColumnError(partnersError, 'affiliate_enabled') || /affiliate_enabled/i.test(String(partnersError.message || '')))) {
      ({ data: partners, error: partnersError } = await client
        .from('partners')
        .select('id, name, slug, status, shop_vendor_id, vendor:shop_vendors(name)')
        .order('created_at', { ascending: false })
        .limit(200));
    }

    if (partnersError) throw partnersError;

    partnersState.partners = partners || [];
    partnersState.partnersById = {};
    (partnersState.partners || []).forEach((p) => {
      if (p?.id) partnersState.partnersById[p.id] = p;
    });

    const partnerIds = (partnersState.partners || []).map(p => p.id).filter(Boolean);

    partnersState.partnerUsersCountByPartnerId = {};
    if (partnerIds.length) {
      const { data: partnerUsers } = await client
        .from('partner_users')
        .select('partner_id')
        .in('partner_id', partnerIds)
        .limit(1000);

      (partnerUsers || []).forEach(pu => {
        const pid = pu.partner_id;
        partnersState.partnerUsersCountByPartnerId[pid] = (partnersState.partnerUsersCountByPartnerId[pid] || 0) + 1;
      });
    }

    partnersState.fulfillmentStatsByPartnerId = {};
    if (partnerIds.length) {
      const ensureBucket = (pid) => {
        if (!pid) return;
        if (!partnersState.fulfillmentStatsByPartnerId[pid]) {
          partnersState.fulfillmentStatsByPartnerId[pid] = { pending: 0, accepted: 0, rejected: 0 };
        }
      };

      const applyStatus = (pid, statusRaw) => {
        if (!pid) return;
        ensureBucket(pid);
        const status = String(statusRaw || '');
        if (status === 'pending_acceptance') partnersState.fulfillmentStatsByPartnerId[pid].pending += 1;
        if (status === 'accepted') partnersState.fulfillmentStatsByPartnerId[pid].accepted += 1;
        if (status === 'rejected') partnersState.fulfillmentStatsByPartnerId[pid].rejected += 1;
      };

      const { data: fulfillments } = await client
        .from('shop_order_fulfillments')
        .select('partner_id, status, created_at')
        .in('partner_id', partnerIds)
        .in('status', ['pending_acceptance', 'accepted', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1000);

      (fulfillments || []).forEach((f) => {
        applyStatus(f?.partner_id, f?.status);
      });

      try {
        const { data: serviceFulfillments } = await client
          .from('partner_service_fulfillments')
          .select('partner_id, status, created_at')
          .in('partner_id', partnerIds)
          .in('status', ['pending_acceptance', 'accepted', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(2000);

        (serviceFulfillments || []).forEach((f) => {
          applyStatus(f?.partner_id, f?.status);
        });
      } catch (_e) {
      }
    }

    renderPartnersTable();

    try {
      fillAffiliatePayoutPartnerSelect();
      if (String(partnersUiState.activeTab || '') === 'affiliate') {
        loadAffiliatePayoutAdminData(true);
      }
    } catch (_e) {
    }
  } catch (error) {
    console.error('Failed to load partners:', error);
    const tbodyErr = document.getElementById('partnersTableBody');
    if (tbodyErr) tbodyErr.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444; padding: 24px;">Error: ${escapeHtml(error.message || 'Failed to load')}</td></tr>`;
  }
}

function renderPartnersTable() {
  const tbody = document.getElementById('partnersTableBody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('partnersSearch')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('partnersStatusFilter')?.value || '';

  const partners = Array.isArray(partnersState.partners) ? partnersState.partners : [];
  const filtered = partners.filter(p => {
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesSearch = !searchTerm ||
      String(p.name || '').toLowerCase().includes(searchTerm) ||
      String(p.slug || '').toLowerCase().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No partners found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const usersCount = partnersState.partnerUsersCountByPartnerId[p.id] || 0;
    const stats = partnersState.fulfillmentStatsByPartnerId[p.id] || { pending: 0, accepted: 0, rejected: 0 };
    const statusColor = p.status === 'active' ? '#22c55e' : '#ef4444';
    const vendorName = (p.vendor && p.vendor.name) ? p.vendor.name : (p.shop_vendor_id ? String(p.shop_vendor_id).slice(0, 8) : '—');

    const isExpanded = partnersState.expandedServicesPartnerId === p.id;
    const servicesLoading = Boolean(partnersState.servicesLoadingByPartnerId?.[p.id]);
    const serviceRows = Array.isArray(partnersState.servicesByPartnerId?.[p.id]) ? partnersState.servicesByPartnerId[p.id] : [];

    const servicesHtml = (() => {
      if (!isExpanded) return '';

      if (servicesLoading) {
        return '<div style="padding: 10px 0; color: var(--admin-text-muted);">Loading services…</div>';
      }

      if (!serviceRows.length) {
        return '<div style="padding: 10px 0; color: var(--admin-text-muted);">No services.</div>';
      }

      const rowsHtml = serviceRows.map((row) => {
        const createdAt = row.created_at ? escapeHtml(formatDateTimeValue(row.created_at)) : '—';
        const label = escapeHtml(row.label || '—');
        const ref = escapeHtml(row.reference || '—');
        const summary = escapeHtml(row.summary || '—');
        const status = String(row.status || '');
        const statusBg = status === 'accepted'
          ? 'rgba(34,197,94,0.18)'
          : status === 'rejected'
            ? 'rgba(239,68,68,0.18)'
            : status === 'awaiting_payment'
              ? 'rgba(245,158,11,0.18)'
              : 'rgba(59,130,246,0.18)';
        const statusBorder = status === 'accepted'
          ? 'rgba(34,197,94,0.65)'
          : status === 'rejected'
            ? 'rgba(239,68,68,0.65)'
            : status === 'awaiting_payment'
              ? 'rgba(245,158,11,0.65)'
              : 'rgba(59,130,246,0.65)';
        const statusHtml = `<span style="display:inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid ${statusBorder}; background:${statusBg}; font-weight: 700; font-size: 12px;">${escapeHtml(status || '—')}</span>`;

        const customerName = escapeHtml(row.customer_name || '');
        const customerEmail = escapeHtml(row.customer_email || '');
        const customerPhone = escapeHtml(row.customer_phone || '');
        const customerHtml = (customerName || customerEmail || customerPhone)
          ? `
              <div class="partner-contact" style="margin-top: 10px;">
                <strong>Contact</strong>
                ${customerName ? `<div class="small">${customerName}</div>` : ''}
                ${customerEmail ? `<div class="small"><a href="mailto:${encodeURIComponent(String(row.customer_email || ''))}">${customerEmail}</a></div>` : ''}
                ${customerPhone ? `<div class="small"><a href="tel:${encodeURIComponent(String(row.customer_phone || ''))}">${customerPhone}</a></div>` : ''}
                ${row.contact_revealed_at ? `<div class="small muted">Revealed: ${escapeHtml(formatDateTimeValue(row.contact_revealed_at))}</div>` : ''}
              </div>
            `
          : '';

        const durationDays = (() => {
          const t = String(row.resource_type || row.label || '').trim();
          if (t !== 'cars' && t !== 'hotels') return null;
          if (!row.start_date || !row.end_date) return null;
          try {
            const start = new Date(`${String(row.start_date).slice(0, 10)}T00:00:00`);
            const end = new Date(`${String(row.end_date).slice(0, 10)}T00:00:00`);
            const days = Math.round((end.getTime() - start.getTime()) / 86400000);
            return Number.isFinite(days) ? Math.max(days, 0) : null;
          } catch (_e) {
            return null;
          }
        })();

        const datesHtml = (() => {
          if (row.start_date || row.end_date) {
            const start = escapeHtml(String(row.start_date || '').slice(0, 10) || '—');
            const end = escapeHtml(String(row.end_date || '').slice(0, 10) || '—');
            const duration = durationDays != null ? `<div class="muted small">Duration: ${escapeHtml(String(durationDays))} day(s)</div>` : '';
            return `<div class="small">${start} → ${end}</div>${duration}`;
          }
          return '<span class="muted">—</span>';
        })();

        const priceHtml = (() => {
          if (row.price == null) return '<span class="muted">—</span>';
          const val = escapeHtml(formatMoney(row.price, row.currency));
          const t = String(row.resource_type || row.label || '').trim();
          if (t === 'cars') {
            return `
              <div class="muted small">Suggested Total</div>
              <div class="small" style="margin-top:6px; padding:8px 10px; border-radius:10px; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:#fff; font-weight:700; display:inline-block;">${val}</div>
            `;
          }
          return `<span class="small">${val}</span>`;
        })();

        const itemsHtml = (() => {
          const typeLabel = row.resource_type ? String(row.resource_type) : (row.label || 'service');
          const parts = [
            `<div class="small"><strong>${escapeHtml(typeLabel)}</strong></div>`,
            `<div class="small">${summary}</div>`,
            customerHtml,
          ].filter(Boolean).join('');
          return parts || '<span class="muted">—</span>';
        })();

        const actionsHtml = (() => {
          const st = String(row.status || '');
          if (st === 'pending_acceptance') {
            return `
              <div class="btn-row">
                <button class="btn-action btn-success" type="button" onclick="adminServiceFulfillmentAction('${escapeHtml(p.id)}','${escapeHtml(row.id)}','accept')">Accept</button>
                <button class="btn-action btn-danger" type="button" onclick="adminServiceFulfillmentAction('${escapeHtml(p.id)}','${escapeHtml(row.id)}','reject')">Reject</button>
              </div>
            `;
          }
          if (st === 'awaiting_payment') {
            return `
              <div class="btn-row">
                <button class="btn-action btn-warning" type="button" onclick="adminServiceFulfillmentAction('${escapeHtml(p.id)}','${escapeHtml(row.id)}','mark_paid')">Mark paid</button>
              </div>
            `;
          }
          if (st === 'accepted' && row.contact_revealed_at) {
            return '<div class="muted small">Contact revealed</div>';
          }
          if (st === 'rejected' && row.rejected_reason) {
            return `<div class="muted small">Reason: ${escapeHtml(String(row.rejected_reason))}</div>`;
          }
          return '<div class="muted">—</div>';
        })();

        return `
          <tr>
            <td>
              <strong><code>${ref}</code></strong>
              <div class="muted small">Created: ${createdAt}</div>
            </td>
            <td>${statusHtml}</td>
            <td>${datesHtml}</td>
            <td>${priceHtml}</td>
            <td>${itemsHtml}</td>
            <td>${actionsHtml}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-top: 6px;">
          <div style="font-weight: 600; margin: 0 0 10px;">Services</div>
          <div class="admin-table-container" style="margin:0;" aria-label="Partner Services">
            <table class="admin-table" style="margin:0;">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th>Price</th>
                  <th>Items</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })();

    return `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td><code>${escapeHtml(p.slug)}</code></td>
        <td><span class="badge" style="background: ${statusColor};">${escapeHtml(p.status)}</span></td>
        <td>${escapeHtml(vendorName)}</td>
        <td>${usersCount}</td>
        <td>${stats.pending}</td>
        <td>${stats.rejected}</td>
        <td>${stats.accepted}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
            <button class="btn-small btn-secondary" onclick="editPartner('${p.id}')">Edit</button>
            <button class="btn-small btn-secondary" onclick="managePartnerUsers('${p.id}')">Users</button>
            <button class="btn-small btn-secondary" onclick="togglePartnerServices('${p.id}')">${isExpanded ? 'Hide services' : 'Show services'}</button>
          </div>
        </td>
      </tr>
      ${isExpanded ? `<tr><td colspan="9" style="padding: 12px 14px; background: rgba(255,255,255,0.03);">${servicesHtml}</td></tr>` : ''}
    `;
  }).join('');
}

function formatDateTimeValue(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_e) {
    return String(value);
  }
}

function formatMoney(value, currency) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const cur = String(currency || 'EUR');
  if (cur.toUpperCase() === 'EUR') return `€${num.toFixed(2)}`;
  return `${num.toFixed(2)} ${cur}`;
}

function getServiceFulfillmentPriceMeta(row) {
  const currency = String(row?.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const fallback = Number(row?.total_price);
  const fallbackAmount = Number.isFinite(fallback) ? fallback : 0;
  if (String(row?.resource_type || '').trim().toLowerCase() !== 'cars') {
    return { amount: fallbackAmount, currency, hasCoupon: false, couponCode: '' };
  }

  const detailsRaw = row?.details;
  const details = (detailsRaw && typeof detailsRaw === 'object')
    ? detailsRaw
    : (() => {
      if (typeof detailsRaw !== 'string') return null;
      try {
        const parsed = JSON.parse(detailsRaw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_e) {
        return null;
      }
    })();

  const finalRental = Number(details?.final_rental_price);
  const finalAmount = Number.isFinite(finalRental) ? finalRental : fallbackAmount;
  const couponCode = String(details?.coupon_code || '').trim().toUpperCase();
  return {
    amount: finalAmount,
    currency,
    hasCoupon: Boolean(couponCode || Number(details?.coupon_discount_amount) > 0),
    couponCode,
  };
}

async function loadServiceFulfillmentsForPartner(partnerId) {
  const client = ensureSupabase();
  if (!client) return [];

  const pid = String(partnerId || '').trim();
  if (!pid) return [];

  let serviceRes = await client
    .from('partner_service_fulfillments')
    .select('id, resource_type, booking_id, resource_id, status, created_at, accepted_at, contact_revealed_at, rejected_reason, total_price, currency, start_date, end_date, reference, summary, details')
    .eq('partner_id', pid)
    .in('status', ['pending_acceptance', 'awaiting_payment', 'accepted', 'rejected', 'expired'])
    .order('created_at', { ascending: false })
    .limit(300);
  if (serviceRes.error && /details/i.test(String(serviceRes.error.message || ''))) {
    serviceRes = await client
      .from('partner_service_fulfillments')
      .select('id, resource_type, booking_id, resource_id, status, created_at, accepted_at, contact_revealed_at, rejected_reason, total_price, currency, start_date, end_date, reference, summary')
      .eq('partner_id', pid)
      .in('status', ['pending_acceptance', 'awaiting_payment', 'accepted', 'rejected', 'expired'])
      .order('created_at', { ascending: false })
      .limit(300);
  }
  const { data: serviceRows, error: serviceErr } = serviceRes;
  if (serviceErr) throw serviceErr;

  const service = (serviceRows || []).filter(r => String(r?.status || '').trim() !== 'closed');
  const serviceIds = service.map(r => r.id).filter(Boolean);

  const serviceContactsRes = serviceIds.length
    ? await client
      .from('partner_service_fulfillment_contacts')
      .select('fulfillment_id, customer_name, customer_email, customer_phone')
      .in('fulfillment_id', serviceIds)
      .limit(1000)
    : { data: [] };

  const serviceContactsById = {};
  (serviceContactsRes?.data || []).forEach((c) => {
    if (c?.fulfillment_id) serviceContactsById[c.fulfillment_id] = c;
  });

  const normalized = [];

  service.forEach((f) => {
    const contact = serviceContactsById[f.id] || {};
    const reference = f.reference || (f.booking_id ? String(f.booking_id).slice(0, 8) : String(f.id).slice(0, 8));
    const label = f.resource_type ? String(f.resource_type) : 'service';
    const priceMeta = getServiceFulfillmentPriceMeta(f);
    normalized.push({
      id: f.id,
      resource_type: f.resource_type,
      label,
      reference,
      summary: f.summary || '',
      status: f.status,
      created_at: f.created_at,
      accepted_at: f.accepted_at,
      contact_revealed_at: f.contact_revealed_at,
      rejected_reason: f.rejected_reason,
      start_date: f.start_date,
      end_date: f.end_date,
      price: priceMeta.amount,
      currency: priceMeta.currency || 'EUR',
      has_coupon: priceMeta.hasCoupon,
      coupon_code: priceMeta.couponCode || '',
      customer_name: contact.customer_name || '',
      customer_email: contact.customer_email || '',
      customer_phone: contact.customer_phone || '',
    });
  });

  return normalized;
}

async function togglePartnerServices(partnerId) {
  const pid = String(partnerId || '').trim();
  if (!pid) return;

  if (partnersState.expandedServicesPartnerId === pid) {
    partnersState.expandedServicesPartnerId = null;
    renderPartnersTable();
    return;
  }

  partnersState.expandedServicesPartnerId = pid;
  renderPartnersTable();

  if (Array.isArray(partnersState.servicesByPartnerId?.[pid])) return;

  partnersState.servicesLoadingByPartnerId[pid] = true;
  renderPartnersTable();

  try {
    const rows = await loadServiceFulfillmentsForPartner(pid);
    partnersState.servicesByPartnerId[pid] = rows;
  } catch (e) {
    console.error('Failed to load partner services:', e);
    partnersState.servicesByPartnerId[pid] = [];
    showToast(e.message || 'Failed to load partner services', 'error');
  } finally {
    partnersState.servicesLoadingByPartnerId[pid] = false;
    if (partnersState.expandedServicesPartnerId === pid) {
      renderPartnersTable();
    }
  }
}

async function adminServiceFulfillmentAction(partnerId, fulfillmentId, action) {
  const client = ensureSupabase();
  if (!client) return;

  const pid = String(partnerId || '').trim();
  const fid = String(fulfillmentId || '').trim();
  const act = String(action || '').trim();
  if (!pid || !fid) return;
  if (act !== 'accept' && act !== 'reject' && act !== 'mark_paid') return;

  let reason = '';
  let stripePaymentIntentId = '';
  let stripeCheckoutSessionId = '';
  let forceEmails = false;
  let emailDedupeSuffix = '';

  if (act === 'mark_paid') {
    if (!confirm('Mark this deposit as PAID and reveal customer contact details?\n\nUse ONLY if you have confirmed the payment in Stripe (webhook failed).')) return;
    const pi = prompt('Stripe PaymentIntent ID (optional):', '');
    if (pi === null) return;
    stripePaymentIntentId = String(pi || '').trim();
    const cs = prompt('Stripe Checkout Session ID (optional):', '');
    if (cs === null) return;
    stripeCheckoutSessionId = String(cs || '').trim();

    forceEmails = confirm('Force re-enqueue deposit paid emails?\n\nUse if emails were not sent (worker/cron issue). This will enqueue new jobs safely.');
    if (forceEmails) {
      const suffix = prompt('Optional email dedupe suffix (leave empty for auto):', '');
      if (suffix === null) return;
      emailDedupeSuffix = String(suffix || '').trim() || `admin_force_${Date.now()}`;
    }
  } else if (act === 'reject') {
    const input = prompt('Reject reason (optional):', '');
    if (input === null) return;
    reason = String(input || '');
  } else {
    if (!confirm('Accept this fulfillment?')) return;
  }

  try {
    if (!client.functions || typeof client.functions.invoke !== 'function') {
      throw new Error('Supabase functions client not available');
    }

    const { data, error } = await client.functions.invoke('partner-fulfillment-action', {
      body: {
        fulfillment_id: fid,
        action: act,
        reason: reason || undefined,
        stripe_payment_intent_id: stripePaymentIntentId || undefined,
        stripe_checkout_session_id: stripeCheckoutSessionId || undefined,
        force_emails: act === 'mark_paid' ? (forceEmails || undefined) : undefined,
        email_dedupe_suffix: act === 'mark_paid' ? (emailDedupeSuffix || undefined) : undefined,
      },
    });
    if (error) throw error;

    const msg = messageForServiceFulfillmentAction(act, data);
    const tone = data && typeof data === 'object' && data.skipped ? 'info' : 'success';
    showToast(msg, tone);

    partnersState.servicesByPartnerId[pid] = null;
    partnersState.servicesLoadingByPartnerId[pid] = true;
    renderPartnersTable();

    const rows = await loadServiceFulfillmentsForPartner(pid);
    partnersState.servicesByPartnerId[pid] = rows;
    partnersState.servicesLoadingByPartnerId[pid] = false;
    renderPartnersTable();

    if (adminState.currentView === 'dashboard') {
      await loadAllOrders({ silent: true });
    }
  } catch (e) {
    console.error('Failed to perform fulfillment action:', e);
    showToast(e.message || 'Failed to perform action', 'error');
    partnersState.servicesLoadingByPartnerId[pid] = false;
    renderPartnersTable();
  }
}

async function adminServiceFulfillmentActionForBooking(category, bookingId, fulfillmentId, action) {
  const client = ensureSupabase();
  if (!client) return;

  const cat = String(category || '').trim();
  const bid = String(bookingId || '').trim();
  const fid = String(fulfillmentId || '').trim();
  const act = String(action || '').trim();
  if (!fid || !act) return;
  if (act !== 'accept' && act !== 'reject' && act !== 'mark_paid') return;

  let reason = '';
  let stripePaymentIntentId = '';
  let stripeCheckoutSessionId = '';
  let forceEmails = false;
  let emailDedupeSuffix = '';

  if (act === 'mark_paid') {
    if (!confirm('Mark this deposit as PAID and reveal customer contact details?\n\nUse ONLY if you have confirmed the payment in Stripe (webhook failed).')) return;
    const pi = prompt('Stripe PaymentIntent ID (optional):', '');
    if (pi === null) return;
    stripePaymentIntentId = String(pi || '').trim();
    const cs = prompt('Stripe Checkout Session ID (optional):', '');
    if (cs === null) return;
    stripeCheckoutSessionId = String(cs || '').trim();

    forceEmails = confirm('Force re-enqueue deposit paid emails?\n\nUse if emails were not sent (worker/cron issue). This will enqueue new jobs safely.');
    if (forceEmails) {
      const suffix = prompt('Optional email dedupe suffix (leave empty for auto):', '');
      if (suffix === null) return;
      emailDedupeSuffix = String(suffix || '').trim() || `admin_force_${Date.now()}`;
    }
  } else if (act === 'reject') {
    const input = prompt('Reject reason (optional):', '');
    if (input === null) return;
    reason = String(input || '');
  } else {
    if (!confirm('Accept this fulfillment?')) return;
  }

  try {
    if (!client.functions || typeof client.functions.invoke !== 'function') {
      throw new Error('Supabase functions client not available');
    }

    const { data, error } = await client.functions.invoke('partner-fulfillment-action', {
      body: {
        fulfillment_id: fid,
        action: act,
        reason: reason || undefined,
        stripe_payment_intent_id: stripePaymentIntentId || undefined,
        stripe_checkout_session_id: stripeCheckoutSessionId || undefined,
        force_emails: act === 'mark_paid' ? (forceEmails || undefined) : undefined,
        email_dedupe_suffix: act === 'mark_paid' ? (emailDedupeSuffix || undefined) : undefined,
      },
    });
    if (error) throw error;

    const msg = messageForServiceFulfillmentAction(act, data);
    const tone = data && typeof data === 'object' && data.skipped ? 'info' : 'success';
    showToast(msg, tone);

    await loadAllOrders({ silent: true });
    if (cat === 'cars') await viewCarBookingDetails(bid);
    if (cat === 'trips') await viewTripBookingDetails(bid);
    if (cat === 'hotels') await viewHotelBookingDetails(bid);
  } catch (e) {
    console.error('Failed to perform fulfillment action:', e);
    showToast(e.message || 'Failed to perform action', 'error');
  }
}

window.togglePartnerServices = (partnerId) => togglePartnerServices(partnerId);
window.adminServiceFulfillmentAction = (partnerId, fulfillmentId, action) => adminServiceFulfillmentAction(partnerId, fulfillmentId, action);
window.adminServiceFulfillmentActionForBooking = (category, bookingId, fulfillmentId, action) => adminServiceFulfillmentActionForBooking(category, bookingId, fulfillmentId, action);

function setPartnersActiveTab(tabName) {
  const next = String(tabName || '').trim() || 'list';
  partnersUiState.activeTab = next;

  document.querySelectorAll('[data-partners-tab]').forEach((btn) => {
    const t = String(btn.getAttribute('data-partners-tab') || '').trim();
    btn.classList.toggle('active', t === next);
  });

  const listEl = document.getElementById('partnersTabList');
  const emailsEl = document.getElementById('partnersTabEmails');
  const affiliateEl = document.getElementById('partnersTabAffiliate');

  if (listEl) {
    listEl.hidden = next !== 'list';
    listEl.classList.toggle('active', next === 'list');
  }
  if (emailsEl) {
    emailsEl.hidden = next !== 'emails';
    emailsEl.classList.toggle('active', next === 'emails');
  }
  if (affiliateEl) {
    affiliateEl.hidden = next !== 'affiliate';
    affiliateEl.classList.toggle('active', next === 'affiliate');
  }

  if (next === 'emails') {
    loadPartnersDepositAdminData();
  }

  if (next === 'affiliate') {
    loadPartnersAffiliateAdminData();
  }
}

async function loadPartnersAffiliateAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  if (partnersUiState.affiliateLoadedOnce && !force) return;
  partnersUiState.affiliateLoadedOnce = true;

  await Promise.all([
    loadAffiliateSettings(),
    loadAffiliateOverrides(),
    loadAffiliateCashoutRequestsAdminData(),
    loadAffiliatePayoutOverviewAdminData(),
    loadAffiliateAdjustmentsAdminData(),
    loadAffiliatePayoutAdminData(),
    loadAffiliateLedgerAdminData(),
    loadAffiliateUnattributedDepositsAdminData(),
    loadAffiliateEligibleUsers(),
  ]);
}

function bpsToPercent(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toFixed(2);
}

function percentToBps(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

async function loadAffiliateSettings() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('affiliate_program_settings')
      .select('id, level1_bps_default, level2_bps_default, level3_bps_default, payout_threshold, currency')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;

    partnersUiState.affiliateSettings = data || null;

    const l1 = document.getElementById('affiliateLevel1Percent');
    const l2 = document.getElementById('affiliateLevel2Percent');
    const l3 = document.getElementById('affiliateLevel3Percent');
    const thr = document.getElementById('affiliatePayoutThreshold');
    if (l1) l1.value = data ? bpsToPercent(data.level1_bps_default) : '';
    if (l2) l2.value = data ? bpsToPercent(data.level2_bps_default) : '';
    if (l3) l3.value = data ? bpsToPercent(data.level3_bps_default) : '';
    if (thr) thr.value = data?.payout_threshold ?? '';
  } catch (e) {
    console.error('Failed to load affiliate settings:', e);
    if (isSchemaCacheError(e)) {
      showToast('Affiliate settings table not available yet (apply migration 068_affiliate_referral_earnings.sql and refresh).', 'error');
    } else {
      showToast(e.message || 'Failed to load affiliate settings', 'error');
    }
  }
}

async function saveAffiliateSettings() {
  const client = ensureSupabase();
  if (!client) return;

  const l1 = document.getElementById('affiliateLevel1Percent');
  const l2 = document.getElementById('affiliateLevel2Percent');
  const l3 = document.getElementById('affiliateLevel3Percent');
  const thr = document.getElementById('affiliatePayoutThreshold');

  try {
    const existing = partnersUiState.affiliateSettings || null;
    const rawL1 = String(l1?.value ?? '').trim();
    const rawL2 = String(l2?.value ?? '').trim();
    const rawL3 = String(l3?.value ?? '').trim();
    const rawThr = String(thr?.value ?? '').trim();

    const level1Bps = rawL1 ? percentToBps(rawL1) : null;
    const level2Bps = rawL2 ? percentToBps(rawL2) : null;
    const level3Bps = rawL3 ? percentToBps(rawL3) : null;

    if (rawL1 && level1Bps == null) throw new Error('Invalid Level 1 %');
    if (rawL2 && level2Bps == null) throw new Error('Invalid Level 2 %');
    if (rawL3 && level3Bps == null) throw new Error('Invalid Level 3 %');

    const payoutThreshold = rawThr ? Number(rawThr) : null;
    if (rawThr && !Number.isFinite(payoutThreshold)) throw new Error('Invalid payout threshold');

    const payload = {
      id: 1,
      level1_bps_default: rawL1 ? level1Bps : (existing?.level1_bps_default ?? 500),
      level2_bps_default: rawL2 ? level2Bps : (existing?.level2_bps_default ?? 100),
      level3_bps_default: rawL3 ? level3Bps : (existing?.level3_bps_default ?? 50),
      payout_threshold: rawThr ? payoutThreshold : (existing?.payout_threshold ?? 70),
    };

    const { error } = await client
      .from('affiliate_program_settings')
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    showToast('Saved affiliate settings', 'success');
    await loadAffiliateSettings();
  } catch (e) {
    console.error('Failed to save affiliate settings:', e);
    if (isSchemaCacheError(e)) {
      showToast('Affiliate settings table not available yet (apply migration 068_affiliate_referral_earnings.sql and refresh).', 'error');
    } else {
      showToast(e.message || 'Failed to save affiliate settings', 'error');
    }
  }
}

async function loadAffiliateOverrides() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('affiliate_referrer_overrides')
      .select('referrer_user_id, level1_bps_override, level2_bps_override, level3_bps_override, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    partnersUiState.affiliateOverrides = Array.isArray(data) ? data : [];
    renderAffiliateOverridesTable();
  } catch (e) {
    console.error('Failed to load affiliate overrides:', e);
    if (isSchemaCacheError(e)) {
      showToast('Affiliate overrides table not available yet (apply migration 068_affiliate_referral_earnings.sql and refresh).', 'error');
    } else {
      showToast(e.message || 'Failed to load affiliate overrides', 'error');
    }
  }
}

function renderAffiliateOverridesTable() {
  const tbody = document.getElementById('affiliateOverridesTableBody');
  if (!tbody) return;

  const rows = Array.isArray(partnersUiState.affiliateOverrides) ? partnersUiState.affiliateOverrides : [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No overrides</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const uid = escapeHtml(String(r.referrer_user_id || ''));
    const l1 = r.level1_bps_override == null ? '—' : `${bpsToPercent(r.level1_bps_override)}%`;
    const l2 = r.level2_bps_override == null ? '—' : `${bpsToPercent(r.level2_bps_override)}%`;
    const l3 = r.level3_bps_override == null ? '—' : `${bpsToPercent(r.level3_bps_override)}%`;
    return `
      <tr>
        <td><code>${uid}</code></td>
        <td style="text-align:right;">${escapeHtml(String(l1))}</td>
        <td style="text-align:right;">${escapeHtml(String(l2))}</td>
        <td style="text-align:right;">${escapeHtml(String(l3))}</td>
        <td style="text-align:right;">
          <div class="btn-row" style="justify-content:flex-end;">
            <button class="btn-small btn-secondary" onclick="editAffiliateOverride('${uid}')">Edit</button>
            <button class="btn-small btn-danger" onclick="deleteAffiliateOverride('${uid}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function clearAffiliateOverrideForm() {
  const userId = document.getElementById('affiliateOverrideUserId');
  const l1 = document.getElementById('affiliateOverrideL1');
  const l2 = document.getElementById('affiliateOverrideL2');
  const l3 = document.getElementById('affiliateOverrideL3');
  if (userId) userId.value = '';
  if (l1) l1.value = '';
  if (l2) l2.value = '';
  if (l3) l3.value = '';
}

async function saveAffiliateOverride() {
  const client = ensureSupabase();
  if (!client) return;

  const userId = String(document.getElementById('affiliateOverrideUserId')?.value || '').trim();
  if (!userId) {
    showToast('Referrer user ID is required', 'error');
    return;
  }

  const l1 = document.getElementById('affiliateOverrideL1');
  const l2 = document.getElementById('affiliateOverrideL2');
  const l3 = document.getElementById('affiliateOverrideL3');

  const payload = {
    referrer_user_id: userId,
    level1_bps_override: l1?.value ? percentToBps(l1.value) : null,
    level2_bps_override: l2?.value ? percentToBps(l2.value) : null,
    level3_bps_override: l3?.value ? percentToBps(l3.value) : null,
  };

  try {
    const { error } = await client
      .from('affiliate_referrer_overrides')
      .upsert(payload, { onConflict: 'referrer_user_id' });
    if (error) throw error;
    showToast('Saved override', 'success');
    clearAffiliateOverrideForm();
    await loadAffiliateOverrides();
  } catch (e) {
    console.error('Failed to save override:', e);
    showToast(e.message || 'Failed to save override', 'error');
  }
}

async function deleteAffiliateOverrideByUserId(userId) {
  const client = ensureSupabase();
  if (!client) return;

  const ok = confirm('Delete this override?');
  if (!ok) return;

  try {
    const { error } = await client
      .from('affiliate_referrer_overrides')
      .delete()
      .eq('referrer_user_id', userId);
    if (error) throw error;
    showToast('Override deleted', 'success');
    await loadAffiliateOverrides();
  } catch (e) {
    console.error('Failed to delete override:', e);
    showToast(e.message || 'Failed to delete override', 'error');
  }
}

window.editAffiliateOverride = (userId) => {
  const row = (partnersUiState.affiliateOverrides || []).find(r => String(r.referrer_user_id) === String(userId));
  if (!row) return;
  const uid = document.getElementById('affiliateOverrideUserId');
  const l1 = document.getElementById('affiliateOverrideL1');
  const l2 = document.getElementById('affiliateOverrideL2');
  const l3 = document.getElementById('affiliateOverrideL3');
  if (uid) uid.value = row.referrer_user_id || '';
  if (l1) l1.value = row.level1_bps_override == null ? '' : bpsToPercent(row.level1_bps_override);
  if (l2) l2.value = row.level2_bps_override == null ? '' : bpsToPercent(row.level2_bps_override);
  if (l3) l3.value = row.level3_bps_override == null ? '' : bpsToPercent(row.level3_bps_override);
};

window.deleteAffiliateOverride = (userId) => deleteAffiliateOverrideByUserId(userId);

function fillAffiliatePayoutPartnerSelect() {
  const select = document.getElementById('affiliatePayoutPartnerSelect');
  if (!select) return;

  const current = String(select.value || '').trim();
  const partners = Array.isArray(partnersState.partners) ? partnersState.partners : [];
  const rows = partners.slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

  select.innerHTML = `<option value="">—</option>${rows.map(p => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(String(p.name || p.slug || String(p.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

async function loadAffiliateEligibleUsers(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  if (partnersUiState.affiliateEligibleLoadedOnce && !force) {
    try {
      fillAffiliateAttributionReferrerSelect();
      fillAffiliateAttributionPayerSelect();
      fillAffiliateAttributionPartnerSelect();
      fillAffiliateLedgerReferrerSelect();
    } catch (_e) {
    }
    return;
  }
  partnersUiState.affiliateEligibleLoadedOnce = true;

  try {
    const { data: affiliatePartners, error: partnersError } = await client
      .from('partners')
      .select('id, name, slug, status, affiliate_enabled')
      .eq('affiliate_enabled', true)
      .order('name', { ascending: true })
      .limit(1000);
    if (partnersError) throw partnersError;

    const partners = (affiliatePartners || []).filter((p) => String(p.status || '') === 'active' || !p.status);
    partnersUiState.affiliateEligiblePartners = partners;

    const partnerIds = partners.map((p) => p.id).filter(Boolean);
    if (!partnerIds.length) {
      partnersUiState.affiliateEligibleMemberships = [];
      partnersUiState.affiliateEligibleUsers = [];
      partnersUiState.affiliateEligibleUsersById = {};
      partnersUiState.affiliateEligibleUsersByPartnerId = {};
      fillAffiliateAttributionReferrerSelect();
      fillAffiliateAttributionPayerSelect();
      fillAffiliateAttributionPartnerSelect();
      return;
    }

    const { data: memberships, error: membershipsError } = await client
      .from('partner_users')
      .select('partner_id, user_id, role, created_at')
      .in('partner_id', partnerIds)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (membershipsError) throw membershipsError;

    const cleanedMemberships = Array.isArray(memberships) ? memberships.filter((m) => m?.user_id && m?.partner_id) : [];
    partnersUiState.affiliateEligibleMemberships = cleanedMemberships;

    const userIds = [...new Set(cleanedMemberships.map((m) => String(m.user_id)))];
    let profilesById = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await client
        .from('profiles')
        .select('id, username, email, name')
        .in('id', userIds)
        .limit(5000);
      if (profilesError) throw profilesError;
      profilesById = (profiles || []).reduce((acc, p) => {
        acc[String(p.id)] = p;
        return acc;
      }, {});
    }

    const partnersById = (partnersUiState.affiliateEligiblePartners || []).reduce((acc, p) => {
      acc[String(p.id)] = p;
      return acc;
    }, {});

    const byPartnerId = {};
    cleanedMemberships.forEach((m) => {
      const pid = String(m.partner_id);
      const uid = String(m.user_id);
      if (!byPartnerId[pid]) byPartnerId[pid] = [];
      byPartnerId[pid].push({ ...m, _uid: uid, _pid: pid });
    });

    Object.keys(byPartnerId).forEach((pid) => {
      byPartnerId[pid].sort((a, b) => {
        const aOwner = a.role === 'owner' ? 1 : 0;
        const bOwner = b.role === 'owner' ? 1 : 0;
        if (aOwner !== bOwner) return bOwner - aOwner;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
    });

    const uniqueUsers = userIds.map((uid) => {
      const p = profilesById[uid] || {};
      const labelBase = p.username || p.email || p.name || uid.slice(0, 8);

      const membershipsForUser = cleanedMemberships.filter((m) => String(m.user_id) === uid);
      const partnerNames = membershipsForUser
        .map((m) => partnersById[String(m.partner_id)]?.name)
        .filter(Boolean);
      const partnerLabel = partnerNames.length ? ` — ${partnerNames.slice(0, 2).join(', ')}${partnerNames.length > 2 ? ` +${partnerNames.length - 2}` : ''}` : '';

      return {
        id: uid,
        label: String(labelBase) + partnerLabel,
        username: p.username || null,
        email: p.email || null,
        name: p.name || null,
      };
    });

    uniqueUsers.sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));

    partnersUiState.affiliateEligibleUsers = uniqueUsers;
    partnersUiState.affiliateEligibleUsersById = uniqueUsers.reduce((acc, u) => {
      acc[String(u.id)] = u;
      return acc;
    }, {});
    partnersUiState.affiliateEligibleUsersByPartnerId = byPartnerId;

    fillAffiliateAttributionReferrerSelect();
    fillAffiliateAttributionPayerSelect();
    fillAffiliateAttributionPartnerSelect();
    fillAffiliateLedgerReferrerSelect();
  } catch (e) {
    console.error('Failed to load affiliate eligible users:', e);
  }
}

function fillAffiliateAttributionReferrerSelect() {
  const select = document.getElementById('affiliateAttributionReferrerUserId');
  if (!select) return;
  const current = String(select.value || '').trim();
  const rows = Array.isArray(partnersUiState.affiliateEligibleUsers) ? partnersUiState.affiliateEligibleUsers : [];
  select.innerHTML = `<option value="">Select affiliate user</option>${rows.map((u) => `<option value="${escapeHtml(String(u.id))}">${escapeHtml(String(u.label || String(u.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

function fillAffiliateAttributionPayerSelect() {
  const select = document.getElementById('affiliateAttributionPayerUserId');
  if (!select) return;
  const current = String(select.value || '').trim();
  const rows = Array.isArray(partnersUiState.affiliateEligibleUsers) ? partnersUiState.affiliateEligibleUsers : [];
  select.innerHTML = `<option value="">Auto-detect by customer email</option>${rows.map((u) => `<option value="${escapeHtml(String(u.id))}">${escapeHtml(String(u.label || String(u.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

function fillAffiliateAttributionPartnerSelect() {
  const select = document.getElementById('affiliateAttributionPartnerId');
  if (!select) return;
  const current = String(select.value || '').trim();
  const rows = Array.isArray(partnersUiState.affiliateEligiblePartners) ? partnersUiState.affiliateEligiblePartners : [];
  select.innerHTML = `<option value="">Auto (from affiliate user)</option>${rows.map((p) => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(String(p.name || p.slug || String(p.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

function fillAffiliateLedgerPartnerSelect() {
  const select = document.getElementById('affiliateLedgerPartnerSelect');
  if (!select) return;

  const current = String(select.value || '').trim();
  const partners = Array.isArray(partnersState.partners) ? partnersState.partners : [];
  const rows = partners.slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

  select.innerHTML = `<option value="">—</option>${rows.map(p => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(String(p.name || p.slug || String(p.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

async function loadAffiliateLedgerAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliateLedgerPartnerSelect');
  const tbody = document.getElementById('affiliateLedgerTableBody');
  if (!select || !tbody) return;

  fillAffiliateLedgerPartnerSelect();
  setAffiliatePartnerSelectAllOption(select, 'All partners');
  fillAffiliateLedgerReferrerSelect();

  if (!String(select.value || '').trim()) {
    const payoutSelect = document.getElementById('affiliatePayoutPartnerSelect');
    const payoutSelected = String(payoutSelect?.value || '').trim();
    if (payoutSelected) {
      select.value = payoutSelected;
    } else {
      const first = (Array.isArray(partnersState.partners) ? partnersState.partners : [])[0];
      if (first?.id) select.value = String(first.id);
    }
  }

  await refreshAffiliateLedgerPartnerData({ force });
}

async function refreshAffiliateLedgerPartnerData({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliateLedgerPartnerSelect');
  const tbody = document.getElementById('affiliateLedgerTableBody');
  if (!select || !tbody) return;

  const partnerId = String(select.value || '').trim();
  if (!partnerId) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">—</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 18px;">Loading…</td></tr>';

  const referrerSelect = document.getElementById('affiliateLedgerReferrerSelect');
  const referrerUserId = String(referrerSelect?.value || '').trim();

  try {
    let q = client
      .from('affiliate_commission_events')
      .select('id, partner_id, deposit_request_id, level, referrer_user_id, referred_user_id, resource_type, booking_id, fulfillment_id, deposit_paid_at, deposit_amount, commission_bps, commission_amount, currency, payout_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (partnerId !== '__all__') {
      q = q.eq('partner_id', partnerId);
    }

    if (referrerUserId) {
      q = q.eq('referrer_user_id', referrerUserId);
    }

    const { data: events, error } = await q;
    if (error) throw error;

    const rows = Array.isArray(events) ? events : [];
    const payoutIds = Array.from(new Set(rows.map((r) => r?.payout_id).filter(Boolean).map(String)));
    let payoutStatusById = {};
    if (payoutIds.length) {
      try {
        const { data: payouts, error: payoutsErr } = await client
          .from('affiliate_payouts')
          .select('id, status')
          .in('id', payoutIds)
          .limit(5000);
        if (!payoutsErr && Array.isArray(payouts)) {
          payoutStatusById = payouts.reduce((acc, p) => {
            acc[String(p.id)] = String(p.status || '');
            return acc;
          }, {});
        }
      } catch (_e) {
      }
    }
    const userIds = [...new Set(rows.flatMap((r) => [r.referrer_user_id, r.referred_user_id]).filter(Boolean).map(String))];
    let profilesById = {};

    if (userIds.length) {
      const { data: profiles, error: profilesError } = await client
        .from('profiles')
        .select('id, username, email, name')
        .in('id', userIds);
      if (!profilesError && Array.isArray(profiles)) {
        profilesById = profiles.reduce((acc, p) => {
          acc[String(p.id)] = p;
          return acc;
        }, {});
      }
    }

    renderAffiliateLedgerTable(rows, profilesById, payoutStatusById);
  } catch (e) {
    console.error('Failed to load affiliate ledger:', e);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderAffiliateLedgerTable(rows, profilesById, payoutStatusById) {
  const tbody = document.getElementById('affiliateLedgerTableBody');
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  const profiles = profilesById && typeof profilesById === 'object' ? profilesById : {};
  const payoutStatuses = payoutStatusById && typeof payoutStatusById === 'object' ? payoutStatusById : {};

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No events</td></tr>';
    return;
  }

  const fmtMoney = (value, currency = 'EUR') => {
    const num = Number(value) || 0;
    if (currency === 'EUR') {
      if (typeof formatCurrencyEUR === 'function') {
        try {
          return formatCurrencyEUR(num);
        } catch (_e) {
        }
      }
      return `€${num.toFixed(2)}`;
    }
    return `${num.toFixed(2)} ${String(currency || '')}`;
  };

  const displayUser = (id) => {
    const key = String(id || '').trim();
    if (!key) return '—';
    const p = profiles[key];
    const label = p?.username || p?.email || p?.name;
    return label ? escapeHtml(String(label)) : `<code>${escapeHtml(key.slice(0, 8))}</code>`;
  };

  const renderActions = (row) => {
    const bookingId = escapeHtml(String(row.booking_id || ''));
    const type = String(row.resource_type || '');

    let bookingAction = '';
    if (type === 'cars') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewCarBookingDetails('${bookingId}')">Booking</button>`;
    } else if (type === 'trips') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewTripBookingDetails('${bookingId}')">Booking</button>`;
    } else if (type === 'hotels') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewHotelBookingDetails('${bookingId}')">Booking</button>`;
    }

    const depositId = escapeHtml(String(row.deposit_request_id || ''));
    const linkDeposit = depositId
      ? `<button class="btn-small btn-secondary" type="button" onclick="selectAffiliateAttributionDeposit('${depositId}')">Deposit</button>`
      : '';

    const reassignAction = depositId
      ? `<button class="btn-small btn-warning" type="button" onclick="startAffiliateReassign('${depositId}')">Reassign</button>`
      : '';

    const actions = [bookingAction, linkDeposit, reassignAction].filter(Boolean).join(' ');
    return actions || '<span class="muted">—</span>';
  };

  tbody.innerHTML = list.map((r) => {
    const paidAt = r.deposit_paid_at ? escapeHtml(formatDateTimeValue(r.deposit_paid_at)) : '—';
    const partnerLabel = escapeHtml(getPartnerLabel(r.partner_id));
    const level = escapeHtml(String(r.level || ''));
    const referrer = displayUser(r.referrer_user_id);
    const referred = displayUser(r.referred_user_id);
    const type = escapeHtml(String(r.resource_type || ''));
    const deposit = escapeHtml(fmtMoney(r.deposit_amount, r.currency || 'EUR'));
    const commission = escapeHtml(fmtMoney(r.commission_amount, r.currency || 'EUR'));
    let status = 'unpaid';
    if (r.payout_id) {
      const ps = payoutStatuses[String(r.payout_id)] || '';
      if (ps === 'paid') status = 'paid';
      else status = 'in_payout';
    }
    const actions = renderActions(r);

    return `
      <tr>
        <td>${paidAt}</td>
        <td>${partnerLabel}</td>
        <td>${level}</td>
        <td>${referrer}</td>
        <td>${referred}</td>
        <td>${type}</td>
        <td style="text-align:right;">${deposit}</td>
        <td style="text-align:right;">${commission}</td>
        <td>${escapeHtml(status)}</td>
        <td style="text-align:right;">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function loadAffiliateUnattributedDepositsAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliateUnattributedTableBody');
  if (!tbody) return;

  await refreshAffiliateUnattributedDeposits({ force });
}

async function refreshAffiliateUnattributedDeposits({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliateUnattributedTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px;">Loading…</td></tr>';

  try {
    const { data: deposits, error } = await client
      .from('service_deposit_requests')
      .select('id, status, amount, currency, resource_type, booking_id, fulfillment_id, partner_id, customer_email, customer_name, paid_at, created_at')
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const depRows = Array.isArray(deposits) ? deposits : [];
    const depIds = depRows.map((d) => d?.id).filter(Boolean);
    let hasEvents = {};

    if (depIds.length) {
      const { data: events, error: eventsError } = await client
        .from('affiliate_commission_events')
        .select('deposit_request_id')
        .in('deposit_request_id', depIds)
        .limit(5000);
      if (!eventsError && Array.isArray(events)) {
        hasEvents = events.reduce((acc, ev) => {
          const id = String(ev.deposit_request_id || '');
          if (id) acc[id] = true;
          return acc;
        }, {});
      }
    }

    const unattributed = depRows.filter((d) => !hasEvents[String(d.id || '')]);
    renderAffiliateUnattributedDepositsTable(unattributed);
  } catch (e) {
    console.error('Failed to load unattributed deposits:', e);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderAffiliateUnattributedDepositsTable(rows) {
  const tbody = document.getElementById('affiliateUnattributedTableBody');
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No unattributed deposits 🎉</td></tr>';
    return;
  }

  const fmtMoney = (value, currency = 'EUR') => {
    const num = Number(value) || 0;
    if (currency === 'EUR') {
      if (typeof formatCurrencyEUR === 'function') {
        try {
          return formatCurrencyEUR(num);
        } catch (_e) {
        }
      }
      return `€${num.toFixed(2)}`;
    }
    return `${num.toFixed(2)} ${String(currency || '')}`;
  };

  tbody.innerHTML = list.map((d) => {
    const id = escapeHtml(String(d.id || ''));
    const paidAt = d.paid_at ? escapeHtml(formatDateTimeValue(d.paid_at)) : '—';
    const type = escapeHtml(String(d.resource_type || ''));
    const bookingId = escapeHtml(String(d.booking_id || ''));
    const customer = escapeHtml(String(d.customer_email || d.customer_name || '—'));
    const amount = escapeHtml(fmtMoney(d.amount, d.currency || 'EUR'));

    let bookingAction = '';
    if (String(d.resource_type) === 'cars') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewCarBookingDetails('${bookingId}')">Booking</button>`;
    } else if (String(d.resource_type) === 'trips') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewTripBookingDetails('${bookingId}')">Booking</button>`;
    } else if (String(d.resource_type) === 'hotels') {
      bookingAction = `<button class="btn-small btn-secondary" type="button" onclick="viewHotelBookingDetails('${bookingId}')">Booking</button>`;
    }

    const selectAction = `<button class="btn-small btn-primary" type="button" onclick="selectAffiliateAttributionDeposit('${id}')">Use</button>`;

    return `
      <tr>
        <td>${paidAt}</td>
        <td>${type || '—'}</td>
        <td><code>${bookingId ? bookingId.slice(0, 8) : ''}</code></td>
        <td>${customer}</td>
        <td style="text-align:right;">${amount}</td>
        <td style="text-align:right;">${selectAction} ${bookingAction || ''}</td>
      </tr>
    `;
  }).join('');
}

function clearAffiliateAttributionForm() {
  const depId = document.getElementById('affiliateAttributionDepositId');
  const payerId = document.getElementById('affiliateAttributionPayerUserId');
  const refId = document.getElementById('affiliateAttributionReferrerUserId');
  const partnerId = document.getElementById('affiliateAttributionPartnerId');
  const replace = document.getElementById('affiliateAttributionReplaceExisting');
  if (depId) depId.value = '';
  if (payerId) payerId.value = '';
  if (refId) refId.value = '';
  if (partnerId) partnerId.value = '';
  if (replace) replace.checked = false;
}

async function applyAffiliateAttributionFromForm() {
  const client = ensureSupabase();
  if (!client) return;

  const depId = String(document.getElementById('affiliateAttributionDepositId')?.value || '').trim();
  if (!depId) {
    showToast('Deposit request ID is required', 'error');
    return;
  }

  const payerUserId = String(document.getElementById('affiliateAttributionPayerUserId')?.value || '').trim() || null;
  let referrerUserId = String(document.getElementById('affiliateAttributionReferrerUserId')?.value || '').trim() || null;
  let partnerId = String(document.getElementById('affiliateAttributionPartnerId')?.value || '').trim() || null;
  const replaceExisting = Boolean(document.getElementById('affiliateAttributionReplaceExisting')?.checked);

  if (!referrerUserId && partnerId) {
    const pool = partnersUiState.affiliateEligibleUsersByPartnerId?.[String(partnerId)] || [];
    const best = pool.find((m) => String(m.role || '') === 'owner') || pool[0] || null;
    if (best?.user_id) {
      referrerUserId = String(best.user_id);
    }
  }

  if (!referrerUserId && !partnerId) {
    showToast('Select affiliate user or partner', 'error');
    return;
  }

  const ok = confirm(replaceExisting
    ? 'Replace existing unpaid affiliate events for this deposit and recompute?'
    : 'Create missing affiliate commission events for this deposit?'
  );
  if (!ok) return;

  try {
    const rpcName = replaceExisting
      ? 'affiliate_admin_reset_commissions_for_deposit'
      : 'affiliate_admin_recompute_commissions_for_deposit';

    const { data, error } = await client.rpc(rpcName, {
      p_deposit_request_id: depId,
      p_force_referrer_user_id: referrerUserId,
      p_force_payer_user_id: payerUserId,
      p_force_partner_id: partnerId,
    });
    if (error) throw error;

    if (replaceExisting) {
      if (data?.ok) {
        const inner = data?.result || {};
        if (inner?.ok) {
          showToast(`Affiliate attribution replaced (inserted: ${inner.inserted || 0})`, 'success');
        } else {
          showToast(`Attribution not applied: ${inner?.reason || 'unknown'}`, 'error');
        }
      } else {
        showToast(`Reset not allowed: ${data?.reason || 'unknown'}`, 'error');
      }
    } else {
      if (data?.ok) {
        showToast(`Affiliate attribution applied (inserted: ${data.inserted || 0})`, 'success');
      } else {
        showToast(`Attribution not applied: ${data?.reason || 'unknown'}`, 'error');
      }
    }

    await Promise.all([
      refreshAffiliateUnattributedDeposits({ force: true }),
      refreshAffiliateLedgerPartnerData({ force: true }),
      refreshAffiliatePayoutPartnerData({ force: true }),
    ]);
  } catch (e) {
    console.error('Failed to apply affiliate attribution:', e);
    showToast(e.message || 'Failed to apply attribution', 'error');
  }
}

window.selectAffiliateAttributionDeposit = (depositId) => {
  const depId = document.getElementById('affiliateAttributionDepositId');
  if (depId) depId.value = String(depositId || '').trim();
};

window.startAffiliateReassign = (depositId) => {
  const dep = String(depositId || '').trim();
  if (!dep) return;
  const depEl = document.getElementById('affiliateAttributionDepositId');
  if (depEl) depEl.value = dep;
  const replace = document.getElementById('affiliateAttributionReplaceExisting');
  if (replace) replace.checked = true;
};

async function loadUserAffiliateReferralOptions(userId, currentReferredBy) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    await loadAffiliateEligibleUsers();
  } catch (_e) {
  }

  const select = document.getElementById('userReferralReferrerSelect');
  const currentLabelEl = document.getElementById('userReferralCurrent');
  if (!select) return;

  const rows = Array.isArray(partnersUiState.affiliateEligibleUsers) ? partnersUiState.affiliateEligibleUsers : [];
  const current = String(currentReferredBy || '').trim();

  select.innerHTML = `<option value="">—</option>${rows.map((u) => `<option value="${escapeHtml(String(u.id))}">${escapeHtml(String(u.label || String(u.id).slice(0, 8)))}</option>`).join('')}`;

  if (current) {
    select.value = current;
  }

  if (currentLabelEl) {
    const known = partnersUiState.affiliateEligibleUsersById?.[current] || null;
    if (known) {
      currentLabelEl.textContent = String(known.label || '—');
    } else if (current) {
      try {
        const { data: refProfile } = await client
          .from('profiles')
          .select('id, username, email, name')
          .eq('id', current)
          .maybeSingle();
        const label = refProfile?.username || refProfile?.email || refProfile?.name || current.slice(0, 8);
        currentLabelEl.textContent = String(label);
      } catch (_e) {
        currentLabelEl.textContent = current.slice(0, 8);
      }
    } else {
      currentLabelEl.textContent = '—';
    }
  }
}

async function setUserReferredBy(userId, referrerUserId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.rpc('admin_set_user_referred_by', {
      target_user_id: userId,
      new_referred_by: referrerUserId || null,
    });
    if (error) throw error;
    showToast('Affiliate referral updated', 'success');

    if (adminState.currentView === 'referrals') {
      try {
        await loadReferralsData();
        await loadReferralStats();
      } catch (_e) {
      }
    }

    const currentLabelEl = document.getElementById('userReferralCurrent');
    if (currentLabelEl) {
      if (!referrerUserId) {
        currentLabelEl.textContent = '—';
      } else {
        const known = partnersUiState.affiliateEligibleUsersById?.[String(referrerUserId)] || null;
        currentLabelEl.textContent = String(known?.label || String(referrerUserId).slice(0, 8));
      }
    }
  } catch (e) {
    console.error('Failed to update referred_by:', e);
    showToast(e.message || 'Failed to update referral', 'error');
  }
}

function getPartnerLabel(partnerId) {
  const id = String(partnerId || '').trim();
  if (!id) return '—';
  const partners = Array.isArray(partnersState.partners) ? partnersState.partners : [];
  const p = partners.find((x) => String(x?.id || '') === id) || null;
  const label = p?.name || p?.slug;
  return label ? String(label) : id.slice(0, 8);
}

function fillAffiliateLedgerReferrerSelect() {
  const select = document.getElementById('affiliateLedgerReferrerSelect');
  if (!select) return;

  const current = String(select.value || '').trim();
  const rows = Array.isArray(partnersUiState.affiliateEligibleUsers) ? partnersUiState.affiliateEligibleUsers : [];
  select.innerHTML = `<option value="">All affiliates</option>${rows.map((u) => `<option value="${escapeHtml(String(u.id))}">${escapeHtml(String(u.label || String(u.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

function setAffiliatePartnerSelectAllOption(selectEl, label) {
  const select = selectEl;
  if (!select) return;
  const first = select.querySelector('option');
  const current = String(select.value || '').trim();
  const desiredLabel = String(label || 'All partners');

  if (first && String(first.value || '') === '__all__') {
    first.textContent = desiredLabel;
  } else {
    select.insertAdjacentHTML('afterbegin', `<option value="__all__">${escapeHtml(desiredLabel)}</option>`);
  }

  if (current === '__all__') select.value = '__all__';
}

async function loadAffiliateCashoutRequestsAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliateCashoutRequestsTableBody');
  if (!tbody) return;

  if (partnersUiState.affiliateCashoutRequestsLoadedOnce && !force) return;
  partnersUiState.affiliateCashoutRequestsLoadedOnce = true;

  await refreshAffiliateCashoutRequests({ force });
}

async function refreshAffiliateCashoutRequests({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliateCashoutRequestsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px;">Loading…</td></tr>';

  try {
    const { data, error } = await client
      .from('affiliate_cashout_requests')
      .select('id, partner_id, requested_by, requested_amount, currency, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    rows.sort((a, b) => {
      const ap = String(a?.status || '') === 'pending' ? 0 : 1;
      const bp = String(b?.status || '') === 'pending' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
    });
    partnersUiState.affiliateCashoutRequestsRows = rows;

    const userIds = Array.from(new Set(rows.map(r => String(r?.requested_by || '')).filter(Boolean)));
    let profilesById = {};
    if (userIds.length) {
      const { data: profs, error: profErr } = await client
        .from('profiles')
        .select('id, username, email, name')
        .in('id', userIds)
        .limit(5000);
      if (profErr) throw profErr;
      profilesById = (Array.isArray(profs) ? profs : []).reduce((acc, p) => {
        acc[String(p.id)] = p;
        return acc;
      }, {});
    }

    const pendingCount = rows.filter(r => String(r?.status || '') === 'pending').length;
    if (pendingCount > 0 && !partnersUiState.affiliateCashoutRequestsToastShown) {
      partnersUiState.affiliateCashoutRequestsToastShown = true;
      showToast(`Pending cashout requests: ${pendingCount}`, 'info');
    }

    renderAffiliateCashoutRequestsTable(rows, profilesById);
  } catch (e) {
    console.error('Failed to load affiliate cashout requests:', e);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderAffiliateCashoutRequestsTable(rows, profilesById) {
  const tbody = document.getElementById('affiliateCashoutRequestsTableBody');
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  const profiles = profilesById && typeof profilesById === 'object' ? profilesById : {};

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No requests</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((r) => {
    const rid = String(r.id || '').trim();
    const created = r.created_at ? escapeHtml(formatDateTimeValue(r.created_at)) : '—';
    const pid = String(r.partner_id || '').trim();
    const partnerLabel = escapeHtml(getPartnerLabel(pid));
    const cur = String(r.currency || 'EUR');
    const amtNum = Number(r.requested_amount || 0) || 0;
    const amount = escapeHtml(formatMoney(amtNum, cur));
    const rawStatus = String(r.status || '').trim();
    const status = escapeHtml(rawStatus) || '—';
    const uid = String(r.requested_by || '').trim();
    const p = uid ? (profiles[uid] || {}) : {};
    const reqBy = uid ? escapeHtml(p.username || p.email || p.name || uid.slice(0, 8)) : '—';

    const openBtn = pid
      ? `<button class="btn-small btn-secondary" type="button" data-action="affiliate-cashout-open" data-partner-id="${escapeHtml(pid)}">Open</button>`
      : '<span class="muted">—</span>';

    const approveBtn = rawStatus === 'pending' && rid
      ? ` <button class="btn-small btn-primary" type="button" data-action="affiliate-cashout-approve" data-request-id="${escapeHtml(rid)}">Approve</button>`
      : '';

    const rejectBtn = rawStatus === 'pending' && rid
      ? ` <button class="btn-small btn-secondary btn-danger" type="button" data-action="affiliate-cashout-reject" data-request-id="${escapeHtml(rid)}">Reject</button>`
      : '';

    return `
      <tr>
        <td>${created}</td>
        <td>${partnerLabel}</td>
        <td style="text-align:right;">${amount}</td>
        <td>${reqBy}</td>
        <td>${status}</td>
        <td style="text-align:right;">${openBtn}${approveBtn}${rejectBtn}</td>
      </tr>
    `;
  }).join('');
}

async function updateAffiliateCashoutRequestStatus(requestId, status) {
  const client = ensureSupabase();
  if (!client) return;

  const rid = String(requestId || '').trim();
  const st = String(status || '').trim();
  if (!rid) return;
  if (!['approved', 'rejected'].includes(st)) return;

  const ok = confirm(`Set cashout request to ${st}?`);
  if (!ok) return;

  const note = String(prompt('Admin notes (optional):', '') || '').trim();

  try {
    const { error } = await client
      .from('affiliate_cashout_requests')
      .update({ status: st, admin_notes: note || null })
      .eq('id', rid);
    if (error) throw error;

    showToast('Cashout request updated', 'success');
    await refreshAffiliateCashoutRequests({ force: true });
  } catch (e) {
    console.error('Failed to update cashout request:', e);
    showToast(String(e?.message || 'Failed to update cashout request'), 'error');
  }
}

async function loadAffiliatePayoutOverviewAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliatePayoutOverviewTableBody');
  if (!tbody) return;

  if (partnersUiState.affiliatePayoutOverviewLoadedOnce && !force) return;
  partnersUiState.affiliatePayoutOverviewLoadedOnce = true;

  await refreshAffiliatePayoutOverview({ force });
}

async function refreshAffiliatePayoutOverview({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('affiliatePayoutOverviewTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px;">Loading…</td></tr>';

  try {
    const { data, error } = await client.rpc('affiliate_admin_get_partner_balances_v1');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    partnersUiState.affiliatePayoutOverviewRows = rows;
    renderAffiliatePayoutOverviewTable(rows);
  } catch (e) {
    console.error('Failed to load affiliate payout overview:', e);
    if (isSchemaCacheError(e)) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">Payout overview RPC not available yet (apply migrations and refresh).</td></tr>';
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
    }
  }
}

function renderAffiliatePayoutOverviewTable(rows) {
  const tbody = document.getElementById('affiliatePayoutOverviewTableBody');
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No partners</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((r) => {
    const pid = String(r.partner_id || '').trim();
    const partner = escapeHtml(String(r.partner_name || getPartnerLabel(pid) || (pid ? pid.slice(0, 8) : '—')));
    const cur = String(r.currency || 'EUR');
    const unpaid = Number(r.unpaid_total || 0) || 0;
    const pending = Number(r.pending_total || 0) || 0;
    const paid = Number(r.paid_total || 0) || 0;
    const thr = Number(r.payout_threshold || 0) || 0;

    const thrMet = thr > 0 && unpaid >= thr;
    const canCreate = thrMet && pending <= 0.0001;

    const openBtn = pid
      ? `<button class="btn-small btn-secondary" type="button" data-action="affiliate-overview-open" data-partner-id="${escapeHtml(pid)}">Open</button>`
      : '<span class="muted">—</span>';

    const createBtn = canCreate && pid
      ? ` <button class="btn-small btn-primary" type="button" data-action="affiliate-overview-create-payout" data-partner-id="${escapeHtml(pid)}">Create payout</button>`
      : '';

    const actions = `${openBtn}${createBtn}`;

    return `
      <tr>
        <td>${partner}</td>
        <td style="text-align:right; font-weight:${thrMet ? '800' : '600'};">${escapeHtml(formatMoney(unpaid, cur))}</td>
        <td style="text-align:right;">${escapeHtml(formatMoney(pending, cur))}</td>
        <td style="text-align:right;">${escapeHtml(formatMoney(paid, cur))}</td>
        <td style="text-align:right;">${escapeHtml(formatMoney(thr, cur))}</td>
        <td style="text-align:right;">${actions}</td>
      </tr>
    `;
  }).join('');
}

function selectAffiliatePayoutPartner(partnerId) {
  const pid = String(partnerId || '').trim();
  if (!pid) return;
  const select = document.getElementById('affiliatePayoutPartnerSelect');
  if (select) select.value = pid;
  refreshAffiliatePayoutPartnerData({ force: true });
}

async function createAffiliatePayoutFromOverview(partnerId) {
  selectAffiliatePayoutPartner(partnerId);
  await createAffiliatePayout();
}

window.selectAffiliatePayoutPartner = (partnerId) => selectAffiliatePayoutPartner(partnerId);
window.createAffiliatePayoutFromOverview = (partnerId) => createAffiliatePayoutFromOverview(partnerId);

function fillAffiliateAdjustmentsPartnerSelect() {
  const select = document.getElementById('affiliateAdjustmentsPartnerSelect');
  if (!select) return;

  const current = String(select.value || '').trim();
  const partners = Array.isArray(partnersState.partners) ? partnersState.partners : [];
  const rows = partners.slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));

  select.innerHTML = `<option value="">—</option>${rows.map(p => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(String(p.name || p.slug || String(p.id).slice(0, 8)))}</option>`).join('')}`;
  if (current) select.value = current;
}

async function loadAffiliateAdjustmentsAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliateAdjustmentsPartnerSelect');
  const tbody = document.getElementById('affiliateAdjustmentsTableBody');
  if (!select || !tbody) return;

  fillAffiliateAdjustmentsPartnerSelect();
  setAffiliatePartnerSelectAllOption(select, 'All partners');
  if (!String(select.value || '').trim()) {
    select.value = '__all__';
  }

  if (partnersUiState.affiliateAdjustmentsLoadedOnce && !force) return;
  partnersUiState.affiliateAdjustmentsLoadedOnce = true;

  await refreshAffiliateAdjustmentsPartnerData({ force });
}

async function refreshAffiliateAdjustmentsPartnerData({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliateAdjustmentsPartnerSelect');
  const tbody = document.getElementById('affiliateAdjustmentsTableBody');
  if (!select || !tbody) return;

  const partnerId = String(select.value || '').trim();
  if (!partnerId) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">—</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 18px;">Loading…</td></tr>';

  try {
    let q = client
      .from('affiliate_adjustments')
      .select('id, partner_id, amount, currency, reason, created_at, payout_id')
      .order('created_at', { ascending: false })
      .limit(200);

    if (partnerId !== '__all__') {
      q = q.eq('partner_id', partnerId);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    partnersUiState.affiliateAdjustmentsRows = rows;

    const payoutIds = Array.from(new Set(rows.map((r) => r?.payout_id).filter(Boolean).map(String)));
    let payoutStatusById = {};
    if (payoutIds.length) {
      const { data: payouts, error: payoutsErr } = await client
        .from('affiliate_payouts')
        .select('id, status')
        .in('id', payoutIds)
        .limit(5000);
      if (payoutsErr) throw payoutsErr;
      payoutStatusById = (Array.isArray(payouts) ? payouts : []).reduce((acc, p) => {
        acc[String(p.id)] = String(p.status || '');
        return acc;
      }, {});
    }

    renderAffiliateAdjustmentsTable(rows, payoutStatusById);
  } catch (e) {
    console.error('Failed to load affiliate adjustments:', e);
    if (isSchemaCacheError(e)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 18px; color:#ef4444;">Adjustments table not available yet (apply migrations and refresh).</td></tr>';
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
    }
  }
}

function renderAffiliateAdjustmentsTable(rows, payoutStatusById) {
  const tbody = document.getElementById('affiliateAdjustmentsTableBody');
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  const payoutStatuses = payoutStatusById && typeof payoutStatusById === 'object' ? payoutStatusById : {};

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No adjustments</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((r) => {
    const created = r.created_at ? escapeHtml(formatDateTimeValue(r.created_at)) : '—';
    const partnerLabel = escapeHtml(getPartnerLabel(r.partner_id));
    const cur = String(r.currency || 'EUR');
    const amtNum = Number(r.amount || 0) || 0;
    const amt = escapeHtml(formatMoney(amtNum, cur));
    const reason = escapeHtml(String(r.reason || '')) || '—';
    const payoutId = String(r.payout_id || '').trim();
    let status = 'unpaid';
    if (payoutId) {
      const ps = payoutStatuses[payoutId] || '';
      status = ps === 'paid' ? 'paid' : 'in_payout';
    }
    const payoutCell = payoutId ? `<code>${escapeHtml(payoutId.slice(0, 8))}</code>` : '—';
    const color = amtNum < 0 ? '#ef4444' : (amtNum > 0 ? '#22c55e' : '');
    const amountCell = color ? `<span style="color:${color}; font-weight:700;">${amt}</span>` : amt;

    const deleteBtn = !payoutId
      ? `<button class="btn-small btn-secondary btn-danger" type="button" data-action="affiliate-adjustment-delete" data-adjustment-id="${escapeHtml(String(r.id))}">Delete</button>`
      : '<span class="muted">—</span>';

    return `
      <tr>
        <td>${created}</td>
        <td>${partnerLabel}</td>
        <td style="text-align:right;">${amountCell}</td>
        <td>${reason}</td>
        <td>${escapeHtml(status)}</td>
        <td>${payoutCell}</td>
        <td style="text-align:right;">${deleteBtn}</td>
      </tr>
    `;
  }).join('');
}

async function deleteAffiliateAdjustmentById(adjustmentId) {
  const client = ensureSupabase();
  if (!client) return;

  const aid = String(adjustmentId || '').trim();
  if (!aid) return;

  const row = Array.isArray(partnersUiState.affiliateAdjustmentsRows)
    ? partnersUiState.affiliateAdjustmentsRows.find(r => String(r?.id || '') === aid)
    : null;

  if (row && row.payout_id) {
    showToast('Cannot delete: adjustment already attached to a payout', 'error');
    return;
  }

  const ok = confirm('Delete this adjustment?');
  if (!ok) return;

  try {
    let q = client.from('affiliate_adjustments').delete().eq('id', aid);
    if (q && typeof q.is === 'function') {
      q = q.is('payout_id', null);
    }

    const { error } = await q;
    if (error) throw error;

    showToast('Adjustment deleted', 'success');

    await Promise.all([
      refreshAffiliateAdjustmentsPartnerData({ force: true }),
      refreshAffiliatePayoutOverview({ force: true }),
      refreshAffiliatePayoutPartnerData({ force: true }),
    ]);
  } catch (e) {
    console.error('Failed to delete adjustment:', e);
    showToast(String(e?.message || 'Failed to delete adjustment'), 'error');
  }
}

async function createAffiliateAdjustmentFromForm() {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliateAdjustmentsPartnerSelect');
  const partnerId = String(select?.value || '').trim();
  if (!partnerId || partnerId === '__all__') {
    showToast('Select partner first', 'error');
    return;
  }

  const amountEl = document.getElementById('affiliateAdjustmentAmount');
  const reasonEl = document.getElementById('affiliateAdjustmentReason');
  const amountRaw = String(amountEl?.value ?? '').trim();
  const amount = Number(amountRaw);

  if (!amountRaw || !Number.isFinite(amount) || Math.abs(amount) < 0.0001) {
    showToast('Enter a non-zero amount', 'error');
    return;
  }

  const reason = String(reasonEl?.value ?? '').trim();
  const ok = confirm('Create this adjustment?');
  if (!ok) return;

  try {
    const { error } = await client.rpc('affiliate_admin_create_adjustment', {
      p_partner_id: partnerId,
      p_amount: amount,
      p_reason: reason || null,
    });
    if (error) throw error;

    if (amountEl) amountEl.value = '';
    if (reasonEl) reasonEl.value = '';

    showToast('Adjustment created', 'success');

    await Promise.all([
      refreshAffiliateAdjustmentsPartnerData({ force: true }),
      refreshAffiliatePayoutOverview({ force: true }),
      refreshAffiliatePayoutPartnerData({ force: true }),
      refreshAffiliateLedgerPartnerData({ force: true }),
    ]);
  } catch (e) {
    console.error('Failed to create affiliate adjustment:', e);
    if (isSchemaCacheError(e)) {
      showToast('Adjustments RPC not available yet (apply migrations and refresh).', 'error');
    } else {
      showToast(e.message || 'Failed to create adjustment', 'error');
    }
  }
}

async function loadAffiliatePayoutAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliatePayoutPartnerSelect');
  const balanceEl = document.getElementById('affiliatePayoutBalance');
  const tbody = document.getElementById('affiliatePayoutsTableBody');
  if (!select || !balanceEl || !tbody) return;

  fillAffiliatePayoutPartnerSelect();
  setAffiliatePartnerSelectAllOption(select, 'All partners');
  if (!String(select.value || '').trim()) {
    select.value = '__all__';
  }

  await refreshAffiliatePayoutPartnerData({ force });
}

async function refreshAffiliatePayoutPartnerData({ force = false } = {}) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliatePayoutPartnerSelect');
  const balanceEl = document.getElementById('affiliatePayoutBalance');
  const tbody = document.getElementById('affiliatePayoutsTableBody');
  if (!select || !balanceEl || !tbody) return;

  const partnerId = String(select.value || '').trim();
  if (!partnerId) {
    balanceEl.textContent = '—';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">—</td></tr>';
    return;
  }

  if (partnerId === '__all__') {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px;">Loading…</td></tr>';
    balanceEl.textContent = '—';

    try {
      const { data: payoutsData, error: payoutsErr } = await client
        .from('affiliate_payouts')
        .select('id, partner_id, amount, currency, status, created_at, paid_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (payoutsErr) throw payoutsErr;
      renderAffiliatePayoutsTable(Array.isArray(payoutsData) ? payoutsData : []);
    } catch (e) {
      console.error('Failed to load affiliate payouts:', e);
      balanceEl.textContent = '—';
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
    }
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px;">Loading…</td></tr>';
  balanceEl.textContent = 'Loading…';

  try {
    const payoutsPromise = client
      .from('affiliate_payouts')
      .select('id, partner_id, amount, currency, status, created_at, paid_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(50);

    let balanceData;
    try {
      const { data: bd, error: be } = await client.rpc('affiliate_get_partner_balance_v2', { p_partner_id: partnerId });
      if (be) throw be;
      balanceData = bd;
    } catch (_e) {
      const { data: bd, error: be } = await client.rpc('affiliate_get_partner_balance', { p_partner_id: partnerId });
      if (be) throw be;
      balanceData = bd;
    }

    const { data: payoutsData, error: payoutsErr } = await payoutsPromise;
    if (payoutsErr) throw payoutsErr;

    const row = Array.isArray(balanceData) ? balanceData[0] : balanceData;
    const unpaid = row?.unpaid_total ?? 0;
    const pending = row?.pending_total ?? 0;
    const paid = row?.paid_total ?? 0;
    const thr = row?.payout_threshold ?? 0;
    const cur = row?.currency || 'EUR';

    balanceEl.textContent = `Unpaid: ${formatMoney(unpaid, cur)} · In payout: ${formatMoney(pending, cur)} · Paid: ${formatMoney(paid, cur)} · Threshold: ${formatMoney(thr, cur)}`;
    renderAffiliatePayoutsTable(Array.isArray(payoutsData) ? payoutsData : []);
  } catch (e) {
    console.error('Failed to load affiliate payouts:', e);
    balanceEl.textContent = '—';
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 18px; color:#ef4444;">${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderAffiliatePayoutsTable(rows) {
  const tbody = document.getElementById('affiliatePayoutsTableBody');
  if (!tbody) return;

  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 18px; color: var(--admin-text-muted);">No payouts</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((r) => {
    const id = escapeHtml(String(r.id || ''));
    const partnerLabel = escapeHtml(getPartnerLabel(r.partner_id));
    const created = r.created_at ? escapeHtml(formatDateTimeValue(r.created_at)) : '—';
    const paidAt = r.paid_at ? escapeHtml(formatDateTimeValue(r.paid_at)) : '—';
    const cur = String(r.currency || 'EUR');
    const amt = formatMoney(r.amount, cur);
    const status = escapeHtml(String(r.status || ''));
    const canMarkPaid = String(r.status || '') === 'pending';
    const canUndoPaid = String(r.status || '') === 'paid';

    const actions = canMarkPaid
      ? `<button class="btn-small btn-success" type="button" onclick="markAffiliatePayoutPaid('${id}')">Mark paid</button>`
      : (canUndoPaid
        ? `<button class="btn-small btn-warning" type="button" onclick="unmarkAffiliatePayoutPaid('${id}')">Undo paid</button>`
        : '<span class="muted">—</span>'
      );

    return `
      <tr>
        <td>${partnerLabel}</td>
        <td>${created}</td>
        <td style="text-align:right;">${escapeHtml(amt)}</td>
        <td>${status || '—'}</td>
        <td>${paidAt}</td>
        <td style="text-align:right;">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function createAffiliatePayout() {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('affiliatePayoutPartnerSelect');
  const markPaid = Boolean(document.getElementById('affiliatePayoutMarkPaid')?.checked);
  const partnerId = String(select?.value || '').trim();
  if (!partnerId || partnerId === '__all__') {
    showToast('Select partner first', 'error');
    return;
  }

  const ok = confirm(markPaid ? 'Create payout and mark as paid?' : 'Create payout?');
  if (!ok) return;

  try {
    const { data, error } = await client.rpc('affiliate_admin_create_payout', {
      p_partner_id: partnerId,
      p_mark_paid: markPaid,
    });
    if (error) throw error;
    if (!data) throw new Error('Failed to create payout');
    showToast('Payout created', 'success');
    await refreshAffiliatePayoutPartnerData({ force: true });
  } catch (e) {
    console.error('Failed to create payout:', e);
    const msg = String(e?.message || '');
    if (/threshold_not_met/i.test(msg)) {
      showToast('Threshold not met yet', 'error');
    } else {
      showToast(e.message || 'Failed to create payout', 'error');
    }
  }
}

async function markAffiliatePayoutPaid(payoutId) {
  const client = ensureSupabase();
  if (!client) return;

  const id = String(payoutId || '').trim();
  if (!id) return;

  const ok = confirm('Mark this payout as paid?');
  if (!ok) return;

  try {
    const { error } = await client.rpc('affiliate_admin_mark_payout_paid', { p_payout_id: id });
    if (error) throw error;
    showToast('Payout marked as paid', 'success');
    await refreshAffiliatePayoutPartnerData({ force: true });
  } catch (e) {
    console.error('Failed to mark payout paid:', e);
    showToast(e.message || 'Failed to mark payout paid', 'error');
  }
}

async function unmarkAffiliatePayoutPaid(payoutId) {
  const client = ensureSupabase();
  if (!client) return;

  const id = String(payoutId || '').trim();
  if (!id) return;

  const ok = confirm('Undo paid status for this payout?');
  if (!ok) return;

  try {
    const { error } = await client.rpc('affiliate_admin_unmark_payout_paid', { p_payout_id: id });
    if (error) throw error;
    showToast('Payout set to pending', 'success');

    await Promise.all([
      refreshAffiliatePayoutPartnerData({ force: true }),
      refreshAffiliateLedgerPartnerData({ force: true }),
    ]);
  } catch (e) {
    console.error('Failed to undo payout paid:', e);
    showToast(e.message || 'Failed to undo payout', 'error');
  }
}

window.markAffiliatePayoutPaid = (payoutId) => markAffiliatePayoutPaid(payoutId);
window.unmarkAffiliatePayoutPaid = (payoutId) => unmarkAffiliatePayoutPaid(payoutId);

async function loadPartnersDepositAdminData(force = false) {
  const client = ensureSupabase();
  if (!client) return;

  if (partnersUiState.depositLoadedOnce && !force) return;
  partnersUiState.depositLoadedOnce = true;

  await Promise.all([
    loadDepositSettings(),
    loadDefaultDepositRules(),
    loadDepositOverrides(),
    loadDepositRequests(),
  ]);
}

async function loadDepositSettings() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('email_settings')
      .select('id, deposit_enabled')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    const toggle = document.getElementById('depositEnabledToggle');
    if (toggle) toggle.checked = Boolean(data?.deposit_enabled);
  } catch (e) {
    console.error('Failed to load deposit settings:', e);
    showToast(e.message || 'Failed to load deposit settings', 'error');
  }
}

async function saveDepositSettings() {
  const client = ensureSupabase();
  if (!client) return;

  const toggle = document.getElementById('depositEnabledToggle');
  const enabled = Boolean(toggle?.checked);

  try {
    const { error } = await client
      .from('email_settings')
      .upsert({ id: 1, deposit_enabled: enabled }, { onConflict: 'id' });
    if (error) throw error;
    showToast('Saved deposit settings', 'success');
  } catch (e) {
    console.error('Failed to save deposit settings:', e);
    showToast(e.message || 'Failed to save deposit settings', 'error');
  }
}

function getDepositRuleInputs(type) {
  const t = String(type || '').trim();
  const up = t.charAt(0).toUpperCase() + t.slice(1);
  return {
    mode: document.getElementById(`depositRuleMode${up}`),
    amount: document.getElementById(`depositRuleAmount${up}`),
    currency: document.getElementById(`depositRuleCurrency${up}`),
    includeChildren: document.getElementById(`depositRuleIncludeChildren${up}`),
    enabled: document.getElementById(`depositRuleEnabled${up}`),
  };
}

async function loadDefaultDepositRules() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('service_deposit_rules')
      .select('resource_type, mode, amount, currency, include_children, enabled')
      .in('resource_type', ['cars', 'trips', 'hotels']);

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const byType = {};
    rows.forEach((r) => {
      if (r?.resource_type) byType[r.resource_type] = r;
    });

    ['cars', 'trips', 'hotels'].forEach((t) => {
      const row = byType[t] || {};
      const inputs = getDepositRuleInputs(t);
      if (inputs.mode) inputs.mode.value = row.mode || 'flat';
      if (inputs.amount) inputs.amount.value = row.amount != null ? Number(row.amount) : '';
      if (inputs.currency) inputs.currency.value = row.currency || 'EUR';
      if (inputs.includeChildren) inputs.includeChildren.checked = Boolean(row.include_children);
      if (inputs.enabled) inputs.enabled.checked = Boolean(row.enabled);
    });
  } catch (e) {
    console.error('Failed to load deposit rules:', e);
    showToast(e.message || 'Failed to load deposit rules', 'error');
  }
}

async function saveDefaultDepositRules() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const rows = ['cars', 'trips', 'hotels'].map((t) => {
      const inputs = getDepositRuleInputs(t);
      const mode = String(inputs.mode?.value || '').trim();
      const amount = Number(inputs.amount?.value || 0);
      const currency = String(inputs.currency?.value || 'EUR').trim() || 'EUR';
      const includeChildren = Boolean(inputs.includeChildren?.checked);
      const enabled = Boolean(inputs.enabled?.checked);
      return {
        resource_type: t,
        mode,
        amount,
        currency,
        include_children: includeChildren,
        enabled,
      };
    });

    const bad = rows.find((r) => {
      if (!r.mode) return true;
      if (!Number.isFinite(Number(r.amount))) return true;
      if (!r.enabled) return false;
      if (!(Number(r.amount) > 0)) return true;
      if (r.mode === 'percent_total' && !(Number(r.amount) <= 100)) return true;
      return false;
    });
    if (bad) throw new Error('Invalid deposit rule');

    const { error } = await client
      .from('service_deposit_rules')
      .upsert(rows, { onConflict: 'resource_type' });
    if (error) throw error;
    showToast('Saved deposit rules', 'success');
  } catch (e) {
    console.error('Failed to save deposit rules:', e);
    showToast(e.message || 'Failed to save deposit rules', 'error');
  }
}

function normalizeI18nTitle(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
  return '';
}

async function loadDepositOverrides() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('depositOverridesTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Loading...</td></tr>';

  try {
    const { data, error } = await client
      .from('service_deposit_overrides')
      .select('id, resource_type, resource_id, mode, amount, currency, include_children, enabled, updated_at')
      .order('updated_at', { ascending: false })
      .limit(300);

    if (error) throw error;
    partnersUiState.depositOverrides = Array.isArray(data) ? data : [];
    partnersUiState.depositOverrideLabels = {};

    const idsByType = { cars: [], trips: [], hotels: [] };
    partnersUiState.depositOverrides.forEach((r) => {
      const t = String(r.resource_type || '').trim();
      const id = r.resource_id;
      if (t && id && idsByType[t]) idsByType[t].push(id);
    });

    const [carsRes, tripsRes, hotelsRes] = await Promise.all([
      idsByType.cars.length
        ? client.from('car_offers').select('id, car_model, car_type, location').in('id', idsByType.cars)
        : Promise.resolve({ data: [] }),
      idsByType.trips.length
        ? client.from('trips').select('id, slug, title, start_city').in('id', idsByType.trips)
        : Promise.resolve({ data: [] }),
      idsByType.hotels.length
        ? client.from('hotels').select('id, slug, title, city').in('id', idsByType.hotels)
        : Promise.resolve({ data: [] }),
    ]);

    (carsRes.data || []).forEach((r) => {
      const title = normalizeI18nTitle(r.car_model) || normalizeI18nTitle(r.car_type) || 'Car';
      const loc = r.location ? ` (${r.location})` : '';
      partnersUiState.depositOverrideLabels[`cars:${r.id}`] = `${title}${loc}`;
    });
    (tripsRes.data || []).forEach((r) => {
      const title = normalizeI18nTitle(r.title) || r.slug || String(r.id).slice(0, 8);
      const city = r.start_city ? ` — ${r.start_city}` : '';
      partnersUiState.depositOverrideLabels[`trips:${r.id}`] = `${title}${city}`;
    });
    (hotelsRes.data || []).forEach((r) => {
      const title = normalizeI18nTitle(r.title) || r.slug || String(r.id).slice(0, 8);
      const city = r.city ? ` — ${r.city}` : '';
      partnersUiState.depositOverrideLabels[`hotels:${r.id}`] = `${title}${city}`;
    });

    renderDepositOverridesTable();
  } catch (e) {
    console.error('Failed to load deposit overrides:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 24px;">Error: ${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function renderDepositOverridesTable() {
  const tbody = document.getElementById('depositOverridesTableBody');
  if (!tbody) return;

  const rows = Array.isArray(partnersUiState.depositOverrides) ? partnersUiState.depositOverrides : [];
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">—</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const type = String(r.resource_type || '').trim();
    const rid = r.resource_id ? String(r.resource_id) : '';
    const label = partnersUiState.depositOverrideLabels[`${type}:${rid}`] || rid.slice(0, 8);
    const enabled = Boolean(r.enabled);
    const mode = String(r.mode || '');
    const amount = Number(r.amount || 0);
    const currency = String(r.currency || 'EUR');
    const amtLabel = currency.toUpperCase() === 'EUR' ? `€${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;
    return `
      <tr>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(label)}</td>
        <td><code>${escapeHtml(mode)}</code></td>
        <td style="text-align: right;">${escapeHtml(amtLabel)}</td>
        <td>${escapeHtml(currency)}</td>
        <td>${enabled ? '<span class="badge" style="background:#22c55e;">enabled</span>' : '<span class="badge" style="background:#6b7280;">disabled</span>'}</td>
        <td style="text-align: right;">
          <button class="btn-small btn-secondary" onclick="deleteDepositOverride('${escapeHtml(String(r.id))}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteDepositOverride(overrideId) {
  const client = ensureSupabase();
  if (!client) return;
  const id = String(overrideId || '').trim();
  if (!id) return;
  if (!confirm('Delete this override?')) return;

  try {
    const { error } = await client
      .from('service_deposit_overrides')
      .delete()
      .eq('id', id);
    if (error) throw error;
    showToast('Override deleted', 'success');
    await loadDepositOverrides();
  } catch (e) {
    console.error('Failed to delete override:', e);
    showToast(e.message || 'Failed to delete override', 'error');
  }
}

window.deleteDepositOverride = (id) => deleteDepositOverride(id);

function setDepositOverrideSelectOptions(rows) {
  const select = document.getElementById('depositOverrideResourceSelect');
  if (!select) return;
  const options = (rows || []).map((r) => {
    const id = r?.id ? String(r.id) : '';
    const label = r?.label ? String(r.label) : id;
    return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
  });
  select.innerHTML = `<option value="">—</option>${options.join('')}`;
}

function applySelectedOverrideToForm() {
  const type = String(document.getElementById('depositOverrideType')?.value || '').trim();
  const rid = String(document.getElementById('depositOverrideResourceSelect')?.value || '').trim();
  updateDepositOverrideModeOptions(type);
  if (!type || !rid) return;

  const row = (partnersUiState.depositOverrides || []).find((o) => String(o.resource_type || '').trim() === type && String(o.resource_id || '') === rid);
  if (!row) return;

  const mode = document.getElementById('depositOverrideMode');
  const amount = document.getElementById('depositOverrideAmount');
  const currency = document.getElementById('depositOverrideCurrency');
  const includeChildren = document.getElementById('depositOverrideIncludeChildren');
  const enabled = document.getElementById('depositOverrideEnabled');

  if (mode) mode.value = row.mode || 'flat';
  if (amount) amount.value = row.amount != null ? Number(row.amount) : '';
  if (currency) currency.value = row.currency || 'EUR';
  if (includeChildren) includeChildren.checked = Boolean(row.include_children);
  if (enabled) enabled.checked = Boolean(row.enabled);

  updateDepositOverrideModeOptions(type);
}

function updateDepositOverrideModeOptions(resourceType) {
  const type = String(resourceType || '').trim();
  const modeEl = document.getElementById('depositOverrideMode');
  if (!modeEl) return;

  const perHourOpt = Array.from(modeEl.options || []).find((o) => String(o.value || '') === 'per_hour');
  if (perHourOpt) {
    perHourOpt.hidden = type !== 'trips';
    perHourOpt.disabled = type !== 'trips';
  }

  if (type !== 'trips' && String(modeEl.value || '') === 'per_hour') {
    modeEl.value = 'per_day';
  }
}

function scheduleDepositOverrideSearch() {
  if (partnersUiState.depositOverrideSearchTimer) {
    clearTimeout(partnersUiState.depositOverrideSearchTimer);
  }

  partnersUiState.depositOverrideSearchTimer = setTimeout(async () => {
    partnersUiState.depositOverrideSearchTimer = null;
    const type = String(document.getElementById('depositOverrideType')?.value || '').trim();
    const term = String(document.getElementById('depositOverrideSearch')?.value || '');
    try {
      const rows = await searchPartnerResources(type, term);
      partnersUiState.depositOverrideSearchResults = rows;
      setDepositOverrideSelectOptions(rows);
    } catch (_e) {
      setDepositOverrideSelectOptions([]);
    }
  }, 250);
}

async function saveDepositOverride() {
  const client = ensureSupabase();
  if (!client) return;

  const resourceType = String(document.getElementById('depositOverrideType')?.value || '').trim();
  const resourceId = String(document.getElementById('depositOverrideResourceSelect')?.value || '').trim();
  const mode = String(document.getElementById('depositOverrideMode')?.value || '').trim();
  const amount = Number(document.getElementById('depositOverrideAmount')?.value || 0);
  const currency = String(document.getElementById('depositOverrideCurrency')?.value || 'EUR').trim() || 'EUR';
  const includeChildren = Boolean(document.getElementById('depositOverrideIncludeChildren')?.checked);
  const enabled = Boolean(document.getElementById('depositOverrideEnabled')?.checked);

  if (!resourceType || !resourceId) {
    showToast('Select a resource', 'error');
    return;
  }

  if (enabled) {
    if (!Number.isFinite(amount) || !(amount > 0)) {
      showToast('Invalid amount', 'error');
      return;
    }
    if (mode === 'per_hour' && resourceType !== 'trips') {
      showToast('Per hour is supported only for Trips', 'error');
      return;
    }
    if (mode === 'percent_total' && !(amount <= 100)) {
      showToast('Percent must be <= 100', 'error');
      return;
    }
  }

  try {
    const payload = {
      resource_type: resourceType,
      resource_id: resourceId,
      mode,
      amount,
      currency,
      include_children: includeChildren,
      enabled,
    };

    const { error } = await client
      .from('service_deposit_overrides')
      .upsert(payload, { onConflict: 'resource_type,resource_id' });
    if (error) throw error;

    showToast('Override saved', 'success');
    await loadDepositOverrides();
  } catch (e) {
    console.error('Failed to save override:', e);
    showToast(e.message || 'Failed to save override', 'error');
  }
}

async function loadDepositRequests() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('depositRequestsTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px;">Loading...</td></tr>';

  try {
    const { data, error } = await client
      .from('service_deposit_requests')
      .select('id, resource_type, booking_id, fulfillment_reference, customer_name, customer_email, customer_phone, amount, currency, status, paid_at, created_at, stripe_checkout_session_id, checkout_url')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    partnersUiState.depositRequests = Array.isArray(data) ? data : [];
    renderDepositRequestsTable();
  } catch (e) {
    console.error('Failed to load deposit requests:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444; padding: 24px;">Error: ${escapeHtml(e.message || 'Failed to load')}</td></tr>`;
  }
}

function depositStatusBadge(status) {
  const s = String(status || '');
  if (s === 'paid') return '<span class="badge" style="background:#22c55e;">paid</span>';
  if (s === 'pending') return '<span class="badge" style="background:#f59e0b;">pending</span>';
  if (s === 'expired') return '<span class="badge" style="background:#6b7280;">expired</span>';
  if (s === 'cancelled') return '<span class="badge" style="background:#ef4444;">cancelled</span>';
  return `<span class="badge" style="background:#6b7280;">${escapeHtml(s || 'unknown')}</span>`;
}

function renderDepositRequestsTable() {
  const tbody = document.getElementById('depositRequestsTableBody');
  if (!tbody) return;

  const statusFilter = String(document.getElementById('depositRequestsStatus')?.value || '').trim();
  const q = String(document.getElementById('depositRequestsSearch')?.value || '').toLowerCase().trim();

  const rows = Array.isArray(partnersUiState.depositRequests) ? partnersUiState.depositRequests : [];
  const filtered = rows.filter((r) => {
    if (statusFilter && String(r.status || '') !== statusFilter) return false;
    if (!q) return true;

    const hay = [
      r.id,
      r.booking_id,
      r.fulfillment_reference,
      r.customer_email,
      r.customer_name,
      r.customer_phone,
      r.stripe_checkout_session_id,
    ].map(v => String(v || '').toLowerCase());
    return hay.some(v => v.includes(q));
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">—</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((r) => {
    const created = r.created_at ? escapeHtml(formatDateTimeValue(r.created_at)) : '—';
    const type = escapeHtml(String(r.resource_type || ''));
    const ref = escapeHtml(String(r.fulfillment_reference || '').trim() || String(r.booking_id || '').slice(0, 8));
    const customer = (() => {
      const name = String(r.customer_name || '').trim();
      const email = String(r.customer_email || '').trim();
      const phone = String(r.customer_phone || '').trim();
      const parts = [];
      if (name) parts.push(`<div><strong>${escapeHtml(name)}</strong></div>`);
      if (email) parts.push(`<div><a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></div>`);
      if (phone) parts.push(`<div><a href="tel:${encodeURIComponent(phone)}">${escapeHtml(phone)}</a></div>`);
      return parts.length ? parts.join('') : '—';
    })();

    const amount = Number(r.amount || 0);
    const currency = String(r.currency || 'EUR');
    const amountLabel = currency.toUpperCase() === 'EUR' ? `€${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;

    const paidAt = r.paid_at ? escapeHtml(formatDateTimeValue(r.paid_at)) : '—';
    const session = String(r.stripe_checkout_session_id || '').trim();
    const sessionLabel = session ? `<code>${escapeHtml(session.slice(0, 16))}…</code>` : '—';

    const checkoutUrl = String(r.checkout_url || '').trim();
    const actions = (() => {
      const btns = [];
      if (checkoutUrl) {
        btns.push(`<button class="btn-small btn-secondary" onclick="openDepositCheckout('${escapeHtml(String(r.id))}')">Open</button>`);
        btns.push(`<button class="btn-small btn-secondary" onclick="copyDepositCheckout('${escapeHtml(String(r.id))}')">Copy link</button>`);
      }
      return btns.join(' ');
    })();

    return `
      <tr>
        <td style="white-space: nowrap;">${created}</td>
        <td>${type}</td>
        <td><code>${ref}</code></td>
        <td>${customer}</td>
        <td style="text-align: right; white-space: nowrap;">${escapeHtml(amountLabel)}</td>
        <td>${depositStatusBadge(r.status)}</td>
        <td style="white-space: nowrap;">${paidAt}</td>
        <td>${sessionLabel}</td>
        <td style="text-align: right; white-space: nowrap;">${actions}</td>
      </tr>
    `;
  }).join('');
}

async function openDepositCheckout(depositRequestId) {
  const id = String(depositRequestId || '').trim();
  if (!id) return;
  const row = (partnersUiState.depositRequests || []).find(r => String(r.id || '') === id);
  const url = String(row?.checkout_url || '').trim();
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

async function copyDepositCheckout(depositRequestId) {
  const id = String(depositRequestId || '').trim();
  if (!id) return;
  const row = (partnersUiState.depositRequests || []).find(r => String(r.id || '') === id);
  const url = String(row?.checkout_url || '').trim();
  if (!url) return;

  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('Copied', 'success');
    }
  } catch {
    showToast('Failed to copy', 'error');
  }
}

window.openDepositCheckout = (id) => openDepositCheckout(id);
window.copyDepositCheckout = (id) => copyDepositCheckout(id);

async function loadPartnerFormVendors() {
  const client = ensureSupabase();
  if (!client) return;

  const { data, error } = await client
    .from('shop_vendors')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('Failed to load vendors:', error);
    partnersAdminState.vendors = [];
    partnersAdminState.vendorsById = {};
    return;
  }

  partnersAdminState.vendors = data || [];
  partnersAdminState.vendorsById = {};
  (partnersAdminState.vendors || []).forEach(v => {
    partnersAdminState.vendorsById[v.id] = v;
  });
}

function fillPartnerVendorSelect(selectedVendorId) {
  const select = document.getElementById('partnerFormVendor');
  if (!select) return;

  const current = selectedVendorId || select.value || '';

  const options = (partnersAdminState.vendors || []).map(v => {
    return `<option value="${v.id}">${escapeHtml(v.name)}</option>`;
  }).join('');

  select.innerHTML = `<option value="">—</option>${options}`;
  select.value = current || '';
}

function setPartnerFormValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? '';
}

function setPartnerFormChecked(id, checked) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = Boolean(checked);
}

function setPartnerFormCarsLocations(locs) {
  const p = Array.isArray(locs) ? locs : [];
  setPartnerFormChecked('partnerFormCarsLocPaphos', p.includes('paphos'));
  setPartnerFormChecked('partnerFormCarsLocLarnaca', p.includes('larnaca'));
}

function getPartnerFormCarsLocations() {
  const locs = [];
  if (Boolean(document.getElementById('partnerFormCarsLocPaphos')?.checked)) locs.push('paphos');
  if (Boolean(document.getElementById('partnerFormCarsLocLarnaca')?.checked)) locs.push('larnaca');
  return locs;
}

function closePartnerForm() {
  const modal = document.getElementById('partnerFormModal');
  hideElement(modal);

  partnerAssignmentsState.partnerId = null;
  partnerAssignmentsState.partnerVendorId = null;
  setPartnerAssignmentsHint('');
  setPartnerAssignShopModeText('');
}

async function openPartnerForm(partnerId = null) {
  const modal = document.getElementById('partnerFormModal');
  const title = document.getElementById('partnerFormTitle');
  const form = document.getElementById('partnerForm');
  if (!modal || !form) return;

  form.reset();
  setPartnerFormValue('partnerFormId', '');

  await loadPartnerFormVendors();
  fillPartnerVendorSelect('');

  const nameInput = document.getElementById('partnerFormName');
  const slugInput = document.getElementById('partnerFormSlug');
  if (nameInput && slugInput) {
    nameInput.oninput = () => {
      const currentSlug = String(slugInput.value || '').trim();
      if (!currentSlug) {
        slugInput.value = slugify(nameInput.value || '');
      }
    };
  }

  if (partnerId) {
    if (title) title.textContent = 'Edit partner';

    const client = ensureSupabase();
    if (!client) return;

    let partner = null;
    let error = null;

    const selectFull = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_create_offers, can_view_stats, can_view_payouts, cars_locations, affiliate_enabled, affiliate_level1_bps_override, affiliate_level2_bps_override, affiliate_level3_bps_override';
    const selectNoCars = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_create_offers, can_view_stats, can_view_payouts, affiliate_enabled, affiliate_level1_bps_override, affiliate_level2_bps_override, affiliate_level3_bps_override';
    const selectBase = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_create_offers, can_view_stats, can_view_payouts, cars_locations';
    const selectBaseNoCars = 'id, name, slug, status, shop_vendor_id, can_manage_shop, can_manage_cars, can_manage_trips, can_manage_hotels, can_create_offers, can_view_stats, can_view_payouts';

    ({ data: partner, error } = await client
      .from('partners')
      .select(selectFull)
      .eq('id', partnerId)
      .single());

    if (error && /cars_locations/i.test(String(error.message || ''))) {
      ({ data: partner, error } = await client
        .from('partners')
        .select(selectNoCars)
        .eq('id', partnerId)
        .single());
    }

    if (error && (/affiliate_/i.test(String(error.message || '')) || isMissingColumnError(error, 'affiliate_enabled'))) {
      ({ data: partner, error } = await client
        .from('partners')
        .select(selectBase)
        .eq('id', partnerId)
        .single());

      if (error && /cars_locations/i.test(String(error.message || ''))) {
        ({ data: partner, error } = await client
          .from('partners')
          .select(selectBaseNoCars)
          .eq('id', partnerId)
          .single());
      }
    }

    if (error) {
      showToast(error.message || 'Failed to load partner', 'error');
      return;
    }

    setPartnerFormValue('partnerFormId', partner.id);
    setPartnerFormValue('partnerFormName', partner.name || '');
    setPartnerFormValue('partnerFormSlug', partner.slug || '');
    setPartnerFormValue('partnerFormStatus', partner.status || 'active');
    fillPartnerVendorSelect(partner.shop_vendor_id || '');

    setPartnerFormChecked('partnerFormCanManageShop', partner.can_manage_shop);
    setPartnerFormChecked('partnerFormCanManageCars', partner.can_manage_cars);
    setPartnerFormChecked('partnerFormCanManageTrips', partner.can_manage_trips);
    setPartnerFormChecked('partnerFormCanManageHotels', partner.can_manage_hotels);
    setPartnerFormChecked('partnerFormCanCreateOffers', partner.can_create_offers);
    setPartnerFormChecked('partnerFormCanViewStats', partner.can_view_stats);
    setPartnerFormChecked('partnerFormCanViewPayouts', partner.can_view_payouts);

    setPartnerFormCarsLocations(partner.cars_locations);

    setPartnerFormChecked('partnerFormAffiliateEnabled', partner.affiliate_enabled);
    setPartnerFormValue('partnerFormAffiliateL1', partner.affiliate_level1_bps_override == null ? '' : bpsToPercent(partner.affiliate_level1_bps_override));
    setPartnerFormValue('partnerFormAffiliateL2', partner.affiliate_level2_bps_override == null ? '' : bpsToPercent(partner.affiliate_level2_bps_override));
    setPartnerFormValue('partnerFormAffiliateL3', partner.affiliate_level3_bps_override == null ? '' : bpsToPercent(partner.affiliate_level3_bps_override));

    partnerAssignmentsState.partnerId = partner.id;
    partnerAssignmentsState.partnerVendorId = partner.shop_vendor_id || null;
  } else {
    if (title) title.textContent = 'New partner';
    setPartnerFormValue('partnerFormStatus', 'active');
    setPartnerFormChecked('partnerFormCanViewStats', true);

    setPartnerFormCarsLocations([]);

    partnerAssignmentsState.partnerId = null;
    partnerAssignmentsState.partnerVendorId = null;
  }

  showElement(modal);

  try {
    await renderPartnerFormPayoutDetails(partnerId);
  } catch (_e) {
  }

  bindPartnerAssignmentsUi();
  setPartnerAssignActiveTab(partnerAssignmentsState.activeTab || 'cars');
  try {
    await refreshPartnerAssignments();
  } catch (_e) {
  }
}

async function savePartnerFromForm() {
  const client = ensureSupabase();
  if (!client) return;

  const partnerId = String(document.getElementById('partnerFormId')?.value || '').trim();
  const name = String(document.getElementById('partnerFormName')?.value || '').trim();
  const slugRaw = String(document.getElementById('partnerFormSlug')?.value || '').trim();
  const status = String(document.getElementById('partnerFormStatus')?.value || 'active').trim();
  const vendorId = String(document.getElementById('partnerFormVendor')?.value || '').trim();

  if (!name) {
    showToast('Partner name is required', 'error');
    return;
  }

  const slug = slugRaw || slugify(name);
  if (!slug) {
    showToast('Partner slug is required', 'error');
    return;
  }

  const payload = {
    name,
    slug,
    status,
    shop_vendor_id: vendorId || null,
    can_manage_shop: Boolean(document.getElementById('partnerFormCanManageShop')?.checked),
    can_manage_cars: Boolean(document.getElementById('partnerFormCanManageCars')?.checked),
    can_manage_trips: Boolean(document.getElementById('partnerFormCanManageTrips')?.checked),
    can_manage_hotels: Boolean(document.getElementById('partnerFormCanManageHotels')?.checked),
    can_create_offers: Boolean(document.getElementById('partnerFormCanCreateOffers')?.checked),
    can_view_stats: Boolean(document.getElementById('partnerFormCanViewStats')?.checked),
    can_view_payouts: Boolean(document.getElementById('partnerFormCanViewPayouts')?.checked),
    cars_locations: getPartnerFormCarsLocations(),
    affiliate_enabled: Boolean(document.getElementById('partnerFormAffiliateEnabled')?.checked),
    affiliate_level1_bps_override: document.getElementById('partnerFormAffiliateL1')?.value ? percentToBps(document.getElementById('partnerFormAffiliateL1').value) : null,
    affiliate_level2_bps_override: document.getElementById('partnerFormAffiliateL2')?.value ? percentToBps(document.getElementById('partnerFormAffiliateL2').value) : null,
    affiliate_level3_bps_override: document.getElementById('partnerFormAffiliateL3')?.value ? percentToBps(document.getElementById('partnerFormAffiliateL3').value) : null,
  };

  try {
    if (partnerId) {
      let { error } = await client.from('partners').update(payload).eq('id', partnerId);
      if (error && (/affiliate_/i.test(String(error.message || '')) || isMissingColumnError(error, 'affiliate_enabled'))) {
        const fallbackPayload = stripAffiliatePartnerPayload(payload);
        ({ error } = await client.from('partners').update(fallbackPayload).eq('id', partnerId));
      }
      if (error) throw error;
      showToast('Partner updated', 'success');
    } else {
      let { data: inserted, error } = await client.from('partners').insert(payload).select('id').single();
      if (error && (/affiliate_/i.test(String(error.message || '')) || isMissingColumnError(error, 'affiliate_enabled'))) {
        const fallbackPayload = stripAffiliatePartnerPayload(payload);
        ({ data: inserted, error } = await client.from('partners').insert(fallbackPayload).select('id').single());
      }
      if (error) throw error;
      if (inserted?.id) {
        const hidden = document.getElementById('partnerFormId');
        if (hidden) hidden.value = inserted.id;
      }
      showToast('Partner created', 'success');
    }

    const effectivePartnerId = String(document.getElementById('partnerFormId')?.value || partnerId || '').trim();
    partnerAssignmentsState.partnerId = effectivePartnerId || null;
    partnerAssignmentsState.partnerVendorId = vendorId || null;
    try {
      await refreshPartnerAssignments();
    } catch (_e) {
    }

    closePartnerForm();
    await loadPartnersData();
  } catch (error) {
    showToast(error.message || 'Failed to save partner', 'error');
  }
}

function closePartnerUsersModal() {
  const modal = document.getElementById('partnerUsersModal');
  hideElement(modal);
}

async function loadPartnerUsers(partnerId) {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('partnerUsersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 24px;">Loading...</td></tr>';

  try {
    const { data, error } = await client
      .from('partner_users')
      .select('id, user_id, role, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No users assigned</td></tr>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = rows.map(r => {
        return `
          <tr>
            <td><code>${escapeHtml(String(r.user_id || ''))}</code></td>
            <td>${escapeHtml(String(r.role || ''))}</td>
            <td style="text-align: right;">
              <button class="btn-small btn-secondary" onclick="removePartnerUser('${r.id}', '${partnerId}')">Remove</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color:#ef4444;">${escapeHtml(error.message || 'Failed to load')}</td></tr>`;
  }
}

async function openPartnerUsersModal(partnerId) {
  const modal = document.getElementById('partnerUsersModal');
  const title = document.getElementById('partnerUsersTitle');
  const hiddenId = document.getElementById('partnerUsersPartnerId');
  if (!modal || !hiddenId) return;

  const partner = (partnersState.partners || []).find(p => p.id === partnerId) || null;
  if (title) title.textContent = partner ? `Partner users – ${partner.name}` : 'Partner users';

  hiddenId.value = partnerId;
  showElement(modal);
  await loadPartnerUsers(partnerId);
}

async function addPartnerUserFromModal() {
  const partnerId = String(document.getElementById('partnerUsersPartnerId')?.value || '').trim();
  const userId = String(document.getElementById('partnerUsersUserId')?.value || '').trim();
  const role = String(document.getElementById('partnerUsersRole')?.value || 'staff').trim();
  if (!partnerId) return;
  if (!userId) {
    showToast('User ID is required', 'error');
    return;
  }

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('partner_users').insert({ partner_id: partnerId, user_id: userId, role });
    if (error) throw error;
    showToast('User added to partner', 'success');
    const input = document.getElementById('partnerUsersUserId');
    if (input) input.value = '';
    await loadPartnerUsers(partnerId);
    await loadPartnersData();
  } catch (error) {
    showToast(error.message || 'Failed to add user', 'error');
  }
}

async function removePartnerUserById(partnerUserId, partnerId) {
  const ok = confirm('Remove this user from partner?');
  if (!ok) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('partner_users').delete().eq('id', partnerUserId);
    if (error) throw error;
    showToast('User removed', 'success');
    await loadPartnerUsers(partnerId);
    await loadPartnersData();
  } catch (error) {
    showToast(error.message || 'Failed to remove user', 'error');
  }
}

async function renderUserPartnerAccess(userId) {
  const content = document.getElementById('userDetailContent');
  if (!content) return;
  const grid = content.querySelector('.user-detail-grid');
  if (!grid) return;

  let card = content.querySelector('#userPartnerAccessCard');
  if (!card) {
    grid.insertAdjacentHTML('beforeend', `
      <section class="user-detail-card user-detail-card--full" id="userPartnerAccessCard">
        <h4 class="user-detail-section-title">Partners</h4>
        <div id="userPartnerAccessBody"><p class="user-detail-hint">Loading...</p></div>
      </section>
    `);
    card = content.querySelector('#userPartnerAccessCard');
  }

  const body = content.querySelector('#userPartnerAccessBody');
  if (!body) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    let partnersRes;
    let membershipsRes;
    [partnersRes, membershipsRes] = await Promise.all([
      client.from('partners').select('id, name, affiliate_enabled').order('name', { ascending: true }).limit(1000),
      client.from('partner_users').select('id, partner_id, role, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
    ]);

    if (partnersRes.error && (isMissingColumnError(partnersRes.error, 'affiliate_enabled') || /affiliate_enabled/i.test(String(partnersRes.error.message || '')))) {
      partnersRes = await client.from('partners').select('id, name').order('name', { ascending: true }).limit(1000);
    }

    if (partnersRes.error) throw partnersRes.error;
    if (membershipsRes.error) throw membershipsRes.error;

    const partners = Array.isArray(partnersRes.data) ? partnersRes.data : [];
    const partnersById = {};
    partners.forEach(p => { partnersById[p.id] = p; });

    const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];

    const hasAffiliateMembership = memberships.some((m) => {
      const p = partnersById[m.partner_id];
      return Boolean(p && p.affiliate_enabled);
    });

    const options = partners.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

    const listHtml = memberships.length
      ? `<div class="admin-table-container" style="margin-top: 10px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Role</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${memberships.map(m => {
                const partnerName = partnersById[m.partner_id]?.name || String(m.partner_id || '').slice(0, 8);
                return `
                  <tr>
                    <td>${escapeHtml(partnerName)}</td>
                    <td>${escapeHtml(String(m.role || ''))}</td>
                    <td style="text-align: right;">
                      <button class="btn-small btn-secondary" onclick="removeUserFromPartner('${m.id}', '${userId}')">Remove</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>`
      : '<p class="user-detail-hint">No partner access.</p>';

    body.innerHTML = `
      <div class="admin-form-grid" style="grid-template-columns: 1fr 160px 180px 140px; gap: 10px; align-items: end;">
        <label class="admin-form-field" style="margin: 0;">
          <span>Partner</span>
          <select id="userPartnerSelect"><option value="">—</option>${options}</select>
        </label>
        <label class="admin-form-field" style="margin: 0;">
          <span>Role</span>
          <select id="userPartnerRole">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label class="admin-form-field" style="margin: 0;">
          <span>Affiliate</span>
          <select id="userPartnerAffiliateMode">
            <option value="">No change</option>
            <option value="enable">Enable</option>
          </select>
        </label>
        <button class="btn btn-primary" type="button" onclick="addUserToPartner('${userId}')">Add</button>
      </div>
      <div style="margin-top: 10px; display:flex; justify-content:flex-end; gap: 10px;">
        <button class="btn-secondary" type="button" onclick="enableAffiliateOnlyUser('${userId}')" ${hasAffiliateMembership ? 'disabled' : ''}>
          Enable affiliate-only
        </button>
      </div>
      ${listHtml}
    `;
  } catch (error) {
    body.innerHTML = `<p class="user-detail-hint" style="color:#ef4444;">${escapeHtml(error.message || 'Failed to load')}</p>`;
  }
}

async function renderUserPartnerPayoutDetails(userId) {
  const content = document.getElementById('userDetailContent');
  if (!content) return;
  const grid = content.querySelector('.user-detail-grid');
  if (!grid) return;

  let card = content.querySelector('#userPartnerPayoutDetailsCard');
  if (!card) {
    grid.insertAdjacentHTML('beforeend', `
      <section class="user-detail-card user-detail-card--full" id="userPartnerPayoutDetailsCard">
        <h4 class="user-detail-section-title">Partner payout details</h4>
        <div id="userPartnerPayoutDetailsBody"><p class="user-detail-hint">Loading...</p></div>
      </section>
    `);
    card = content.querySelector('#userPartnerPayoutDetailsCard');
  }

  const body = content.querySelector('#userPartnerPayoutDetailsBody');
  if (!body) return;

  const client = ensureSupabase();
  if (!client) return;

  body.innerHTML = '<p class="user-detail-hint">Loading...</p>';

  try {
    const { data: memberships, error: membershipsError } = await client
      .from('partner_users')
      .select('partner_id, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (membershipsError) throw membershipsError;

    const ms = Array.isArray(memberships) ? memberships : [];
    const partnerIds = [...new Set(ms.map((m) => String(m.partner_id || '')).filter(Boolean))];
    if (!partnerIds.length) {
      body.innerHTML = '<p class="user-detail-hint">No partner access.</p>';
      return;
    }

    const [partnersRes, payoutsRes] = await Promise.all([
      client.from('partners').select('id, name').in('id', partnerIds).limit(1000),
      client.from('partner_payout_details').select('partner_id, account_holder_name, bank_name, iban, bic, notes, updated_at').in('partner_id', partnerIds).limit(1000),
    ]);

    if (partnersRes.error) throw partnersRes.error;
    if (payoutsRes.error) throw payoutsRes.error;

    const partners = Array.isArray(partnersRes.data) ? partnersRes.data : [];
    const partnerNameById = {};
    partners.forEach((p) => {
      if (!p?.id) return;
      partnerNameById[String(p.id)] = String(p.name || String(p.id).slice(0, 8));
    });

    const payoutRows = Array.isArray(payoutsRes.data) ? payoutsRes.data : [];
    const payoutByPartnerId = {};
    payoutRows.forEach((r) => {
      if (!r?.partner_id) return;
      payoutByPartnerId[String(r.partner_id)] = r;
    });

    const rows = ms.map((m) => {
      const pid = String(m.partner_id || '');
      const payout = payoutByPartnerId[pid] || null;
      return {
        partnerId: pid,
        partnerName: partnerNameById[pid] || (pid ? pid.slice(0, 8) : '—'),
        role: String(m.role || ''),
        payout,
      };
    });

    body.innerHTML = `
      <div class="admin-table-container" style="margin-top: 10px;">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Role</th>
              <th>Account holder</th>
              <th>Bank</th>
              <th>IBAN</th>
              <th>BIC</th>
              <th>Notes</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const p = r.payout || {};
              const updated = p.updated_at ? escapeHtml(formatDate(p.updated_at)) : '—';
              return `
                <tr>
                  <td>${escapeHtml(r.partnerName)}</td>
                  <td>${escapeHtml(r.role || '—')}</td>
                  <td>${escapeHtml(p.account_holder_name || '—')}</td>
                  <td>${escapeHtml(p.bank_name || '—')}</td>
                  <td><code>${escapeHtml(p.iban || '—')}</code></td>
                  <td><code>${escapeHtml(p.bic || '—')}</code></td>
                  <td>${escapeHtml(p.notes || '—')}</td>
                  <td>${updated}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    const msg = String(error?.message || 'Failed to load payout details');
    body.innerHTML = `<p class="user-detail-hint" style="color:#ef4444;">${escapeHtml(msg)}</p>`;
  }
}

async function enableAffiliateOnlyUserFromUserModal(userId) {
  const ok = confirm('Enable affiliate-only for this user? This will create an affiliate partner and grant owner access.');
  if (!ok) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data, error } = await client.rpc('admin_enable_affiliate_only_user', {
      target_user_id: userId,
    });
    if (error) throw error;

    const partnerId = String(data || '').trim();
    showToast(partnerId ? `Affiliate-only enabled (${partnerId.slice(0, 8)})` : 'Affiliate-only enabled', 'success');

    partnersUiState.affiliateEligibleLoadedOnce = false;
    await Promise.all([
      renderUserPartnerAccess(userId),
      renderUserPartnerPayoutDetails(userId),
      loadPartnersData(),
      loadAffiliateEligibleUsers(true),
    ]);
  } catch (e) {
    console.error('Failed to enable affiliate-only:', e);
    showToast(e.message || 'Failed to enable affiliate-only', 'error');
  }
}

async function addUserToPartnerFromUserModal(userId) {
  const partnerId = String(document.getElementById('userPartnerSelect')?.value || '').trim();
  const role = String(document.getElementById('userPartnerRole')?.value || 'staff').trim();
  if (!partnerId) {
    showToast('Select partner', 'error');
    return;
  }

  const affiliateMode = String(document.getElementById('userPartnerAffiliateMode')?.value || '').trim();

  const client = ensureSupabase();
  if (!client) return;

  try {
    if (affiliateMode === 'enable') {
      let { error: affiliateErr } = await client
        .from('partners')
        .update({ affiliate_enabled: true })
        .eq('id', partnerId);

      if (affiliateErr && (isMissingColumnError(affiliateErr, 'affiliate_enabled') || /affiliate_enabled/i.test(String(affiliateErr.message || '')))) {
        affiliateErr = null;
      }
      if (affiliateErr) throw affiliateErr;
    }

    const { error } = await client.from('partner_users').insert({ partner_id: partnerId, user_id: userId, role });
    if (error) throw error;
    showToast('Partner access granted', 'success');
    await renderUserPartnerAccess(userId);
    await renderUserPartnerPayoutDetails(userId);
    await loadPartnersData();
  } catch (error) {
    showToast(error.message || 'Failed to grant access', 'error');
  }
}

async function removeUserFromPartnerFromUserModal(partnerUserId, userId) {
  const ok = confirm('Remove partner access?');
  if (!ok) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('partner_users').delete().eq('id', partnerUserId);
    if (error) throw error;
    showToast('Partner access removed', 'success');
    await renderUserPartnerAccess(userId);
    await renderUserPartnerPayoutDetails(userId);
    await loadPartnersData();
  } catch (error) {
    showToast(error.message || 'Failed to remove access', 'error');
  }
}

window.editPartner = (partnerId) => openPartnerForm(partnerId);
window.managePartnerUsers = (partnerId) => openPartnerUsersModal(partnerId);
window.removePartnerUser = (partnerUserId, partnerId) => removePartnerUserById(partnerUserId, partnerId);
window.addUserToPartner = (userId) => addUserToPartnerFromUserModal(userId);
window.removeUserFromPartner = (partnerUserId, userId) => removeUserFromPartnerFromUserModal(partnerUserId, userId);
window.enableAffiliateOnlyUser = (userId) => enableAffiliateOnlyUserFromUserModal(userId);

const calendarsState = {
  partnersById: {},
  partners: [],
  blocks: [],
  resourcesByType: { shop: [], cars: [], trips: [], hotels: [] },
  bulkMode: false,
  selectedByType: {
    shop: new Set(),
    cars: new Set(),
    trips: new Set(),
    hotels: new Set(),
  },
  monthValue: '',
  monthBlocks: [],
  monthBusyRanges: [],
};

function calendarsAvailabilityTypes() {
  return ['shop', 'cars', 'trips', 'hotels'];
}

function isCalendarsAvailabilityType(value) {
  return calendarsAvailabilityTypes().includes(String(value || '').trim());
}

function ensureCalendarsSelectedSetForType(type) {
  const t = String(type || '').trim();
  if (!isCalendarsAvailabilityType(t)) return new Set();
  if (!calendarsState.selectedByType[t] || !(calendarsState.selectedByType[t] instanceof Set)) {
    calendarsState.selectedByType[t] = new Set();
  }
  return calendarsState.selectedByType[t];
}

function clearCalendarsSelectionsAll() {
  calendarsAvailabilityTypes().forEach((t) => {
    ensureCalendarsSelectedSetForType(t).clear();
  });
}

function updateAdminCalendarsSelectionSummary() {
  const el = document.getElementById('adminCalendarsSelectionSummary');
  if (!el) return;

  const bulk = Boolean(calendarsState.bulkMode);
  if (!bulk) {
    el.textContent = '';
    return;
  }

  const parts = [];
  let total = 0;
  calendarsAvailabilityTypes().forEach((t) => {
    const count = ensureCalendarsSelectedSetForType(t).size;
    if (!count) return;
    parts.push(`${t}: ${count}`);
    total += count;
  });

  const sel = parts.length ? parts.join(', ') : 'none';
  el.textContent = `Selected: ${sel} (total ${total}).`;
}

function setAdminCalendarsBulkMode(enabled) {
  calendarsState.bulkMode = Boolean(enabled);
  const checkbox = document.getElementById('adminCalendarsBulkMode');
  if (checkbox) checkbox.checked = calendarsState.bulkMode;

  if (calendarsState.bulkMode) {
    const currentType = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
    const currentId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();
    if (currentType && currentId) {
      ensureCalendarsSelectedSetForType(currentType).add(currentId);
    }
  }

  const disabled = !calendarsState.bulkMode;
  const btnSelectAll = document.getElementById('btnAdminCalendarsSelectAllType');
  const btnClearAll = document.getElementById('btnAdminCalendarsClearAll');
  if (btnSelectAll) btnSelectAll.disabled = disabled;
  if (btnClearAll) btnClearAll.disabled = disabled;

  updateAdminCalendarsSelectionSummary();
  renderAdminCalendarsResourcePanels();
}

async function adminCalendarsSelectAllCurrentType() {
  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  if (!type) {
    showToast('Select resource type', 'error');
    return;
  }

  try {
    const existing = Array.isArray(calendarsState.resourcesByType?.[type]) ? calendarsState.resourcesByType[type] : [];
    if (!existing.length) {
      await loadCalendarsResourceOptions();
    }

    const rows = Array.isArray(calendarsState.resourcesByType?.[type]) ? calendarsState.resourcesByType[type] : [];
    const set = ensureCalendarsSelectedSetForType(type);
    rows.forEach((r) => {
      const id = r?.id ? String(r.id) : '';
      if (!id) return;
      set.add(id);
    });
    updateAdminCalendarsSelectionSummary();
    renderAdminCalendarsResourcePanels();
  } catch (error) {
    console.error('Select all type failed:', error);
    showToast(error.message || 'Select all failed', 'error');
  }
}

function adminCalendarsClearAllSelections() {
  clearCalendarsSelectionsAll();
  updateAdminCalendarsSelectionSummary();
  renderAdminCalendarsResourcePanels();
}

function chunkArray(input, size) {
  const arr = Array.isArray(input) ? input : [];
  const s = Math.max(1, Number(size || 0) || 50);
  const out = [];
  for (let i = 0; i < arr.length; i += s) out.push(arr.slice(i, i + s));
  return out;
}

async function getAdminCalendarsTargets() {
  const currentType = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const currentId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();

  if (!calendarsState.bulkMode) {
    return (currentType && currentId) ? [{ resource_type: currentType, resource_id: currentId }] : [];
  }

  const targets = [];
  calendarsAvailabilityTypes().forEach((t) => {
    const set = ensureCalendarsSelectedSetForType(t);
    Array.from(set).forEach((id) => {
      if (!id) return;
      targets.push({ resource_type: t, resource_id: String(id) });
    });
  });

  const dedup = new Map();
  targets.forEach((t) => {
    const rt = String(t.resource_type || '').trim();
    const rid = String(t.resource_id || '').trim();
    if (!rt || !rid) return;
    dedup.set(`${rt}:${rid}`, { resource_type: rt, resource_id: rid });
  });
  return Array.from(dedup.values());
}

async function bulkDeleteBlocksByIdsAdmin(ids) {
  const client = ensureSupabase();
  if (!client) return;
  const list = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
  if (!list.length) return;
  for (const chunk of chunkArray(list, 50)) {
    const { error } = await client
      .from('partner_availability_blocks')
      .delete()
      .in('id', chunk);
    if (error) throw error;
  }
}

async function bulkInsertBlocksAdmin(payloads) {
  const client = ensureSupabase();
  if (!client) return;
  const list = Array.isArray(payloads) ? payloads : [];
  if (!list.length) return;
  for (const chunk of chunkArray(list, 50)) {
    const { error } = await client
      .from('partner_availability_blocks')
      .insert(chunk);
    if (error) throw error;
  }
}

async function toggleSingleDayBlocksForTargetsAdmin(partnerId, dayIso, targets) {
  const client = ensureSupabase();
  if (!client) return;
  const pid = String(partnerId || '').trim();
  const day = String(dayIso || '').trim();
  const list = Array.isArray(targets) ? targets : [];
  if (!pid || !day || !list.length) return;

  const byType = {};
  list.forEach((t) => {
    const rt = String(t.resource_type || '').trim();
    const rid = String(t.resource_id || '').trim();
    if (!rt || !rid) return;
    if (!byType[rt]) byType[rt] = new Set();
    byType[rt].add(rid);
  });

  const existingByKey = new Map();
  for (const rt of Object.keys(byType)) {
    const ids = Array.from(byType[rt]);
    for (const chunk of chunkArray(ids, 50)) {
      const { data, error } = await client
        .from('partner_availability_blocks')
        .select('id, resource_type, resource_id, start_date, end_date')
        .eq('partner_id', pid)
        .eq('resource_type', rt)
        .in('resource_id', chunk)
        .eq('start_date', day)
        .eq('end_date', day)
        .limit(500);
      if (error) throw error;
      (data || []).forEach((b) => {
        if (!b?.id || !b?.resource_type || !b?.resource_id) return;
        existingByKey.set(`${String(b.resource_type)}:${String(b.resource_id)}`, b);
      });
    }
  }

  const keys = list.map(t => `${String(t.resource_type)}:${String(t.resource_id)}`);
  const existingKeys = keys.filter(k => existingByKey.has(k));
  const shouldUnblockAll = existingKeys.length === keys.length;

  if (shouldUnblockAll) {
    const idsToDelete = existingKeys.map(k => existingByKey.get(k)?.id).filter(Boolean);
    await bulkDeleteBlocksByIdsAdmin(idsToDelete);
    showToast(list.length > 1 ? `Day unblocked (${list.length} resources)` : 'Day unblocked', 'success');
    return;
  }

  const payloads = [];
  list.forEach((t) => {
    const key = `${String(t.resource_type)}:${String(t.resource_id)}`;
    if (existingByKey.has(key)) return;
    payloads.push({
      partner_id: pid,
      resource_type: t.resource_type,
      resource_id: t.resource_id,
      start_date: day,
      end_date: day,
      note: null,
      created_by: adminState.user?.id || null,
    });
  });
  await bulkInsertBlocksAdmin(payloads);
  showToast(list.length > 1 ? `Day blocked (${payloads.length} resources)` : 'Day blocked', 'success');
}

async function createRangeBlocksForTargetsAdmin(partnerId, startDate, endDate, note, targets) {
  const client = ensureSupabase();
  if (!client) return;
  const pid = String(partnerId || '').trim();
  const start = String(startDate || '').trim();
  const end = String(endDate || '').trim();
  const list = Array.isArray(targets) ? targets : [];
  if (!pid || !start || !end || !list.length) return;

  const byType = {};
  list.forEach((t) => {
    const rt = String(t.resource_type || '').trim();
    const rid = String(t.resource_id || '').trim();
    if (!rt || !rid) return;
    if (!byType[rt]) byType[rt] = new Set();
    byType[rt].add(rid);
  });

  const existingByKey = new Set();
  for (const rt of Object.keys(byType)) {
    const ids = Array.from(byType[rt]);
    for (const chunk of chunkArray(ids, 50)) {
      const { data, error } = await client
        .from('partner_availability_blocks')
        .select('id, resource_type, resource_id, start_date, end_date')
        .eq('partner_id', pid)
        .eq('resource_type', rt)
        .in('resource_id', chunk)
        .eq('start_date', start)
        .eq('end_date', end)
        .limit(500);
      if (error) throw error;
      (data || []).forEach((b) => {
        if (!b?.resource_type || !b?.resource_id) return;
        existingByKey.add(`${String(b.resource_type)}:${String(b.resource_id)}`);
      });
    }
  }

  const payloads = [];
  list.forEach((t) => {
    const key = `${String(t.resource_type)}:${String(t.resource_id)}`;
    if (existingByKey.has(key)) return;
    payloads.push({
      partner_id: pid,
      resource_type: t.resource_type,
      resource_id: t.resource_id,
      start_date: start,
      end_date: end,
      note: note || null,
      created_by: adminState.user?.id || null,
    });
  });

  await bulkInsertBlocksAdmin(payloads);
  showToast(payloads.length > 1 ? `Blocks created (${payloads.length} resources)` : 'Block created', 'success');
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
  const base = (Number.isFinite(y) && Number.isFinite(m)) ? new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)) : new Date();
  base.setUTCMonth(base.getUTCMonth() + Number(delta || 0));
  return getMonthValue(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 12, 0, 0)));
}

function setCalendarsMonthInput(value) {
  const input = document.getElementById('calendarsMonthInput');
  if (!input) return;
  const next = value || getMonthValue();
  input.value = next;
  calendarsState.monthValue = next;
}

function ensureCalendarsMonthInput() {
  const input = document.getElementById('calendarsMonthInput');
  if (!input) return;
  if (!input.value) {
    setCalendarsMonthInput(getMonthValue());
  } else {
    calendarsState.monthValue = input.value;
  }
}

async function loadCalendarsResourceOptions() {
  const client = ensureSupabase();
  if (!client) return;

  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const select = document.getElementById('calendarsResourceIdFilter');
  if (!select) return;

  if (!type) {
    select.innerHTML = '<option value="">Select resource</option>';
    return;
  }

  try {
    let rows = [];
    if (type === 'cars') {
      const { data, error } = await client
        .from('car_offers')
        .select('id, car_model, car_type, location')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const normalizeI18n = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
        return '';
      };

      rows = (data || []).map(r => ({
        id: r.id,
        label: `${normalizeI18n(r.car_model) || normalizeI18n(r.car_type) || 'Car'} (${r.location || ''})`.trim()
      }));
    } else if (type === 'trips') {
      const normalizeI18n = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return value.pl || value.en || value.el || value.he || '';
        return '';
      };

      async function selectTrips() {
        const attempts = [
          { select: 'id, slug, title, start_city', order: 'updated_at' },
          { select: 'id, slug, title, start_city', order: 'created_at' },
          { select: 'id, slug, title', order: 'updated_at' },
          { select: 'id, slug, title', order: 'created_at' },
        ];

        let lastError = null;
        for (const attempt of attempts) {
          try {
            const { data, error } = await client
              .from('trips')
              .select(attempt.select)
              .order(attempt.order, { ascending: false })
              .limit(500);
            if (error) throw error;
            return data || [];
          } catch (e) {
            lastError = e;
          }
        }
        if (lastError) throw lastError;
        return [];
      }

      const data = await selectTrips();
      rows = (data || []).map(r => {
        const title = normalizeI18n(r.title) || r.slug || r.id;
        const city = r.start_city ? ` — ${r.start_city}` : '';
        return { id: r.id, label: `${title}${city}` };
      });
    } else if (type === 'hotels') {
      const { data, error } = await client
        .from('hotels')
        .select('id, slug, title, city')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => {
        const title = (r.title && (r.title.pl || r.title.en)) || r.slug || r.id;
        const city = r.city ? ` — ${r.city}` : '';
        return { id: r.id, label: `${title}${city}` };
      });
    } else if (type === 'shop') {
      const { data, error } = await client
        .from('shop_products')
        .select('id, name, slug, status')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      rows = (data || []).map(r => ({ id: r.id, label: r.name || r.slug || r.id }));
    }

    const existing = select.value;
    select.innerHTML = '<option value="">Select resource</option>' + rows
      .map(r => `<option value="${r.id}">${escapeHtml(r.label)}</option>`)
      .join('');

    if (existing) select.value = existing;

    calendarsState.resourcesByType[type] = rows;
    renderAdminCalendarsResourcePanels();
    syncAdminCalendarsCreateFields();
  } catch (error) {
    console.error('Failed to load resource options:', error);
    select.innerHTML = '<option value="">Select resource</option>';
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

async function resolvePartnerIdForCalendarsResource(client, resourceType, resourceId) {
  if (!client) return null;
  const type = String(resourceType || '').trim();
  const rid = String(resourceId || '').trim();
  if (!type || !rid) return null;

  try {
    const { data, error } = await client
      .from('partner_resources')
      .select('partner_id')
      .eq('resource_type', type)
      .eq('resource_id', rid)
      .limit(1)
      .maybeSingle();
    if (!error && data?.partner_id) return data.partner_id;
  } catch (_e) {}

  if (type === 'shop') {
    try {
      const { data, error } = await client
        .from('shop_products')
        .select('vendor_id')
        .eq('id', rid)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const vendorId = data?.vendor_id;
      if (!vendorId) return null;
      const res = await client
        .from('partners')
        .select('id')
        .eq('shop_vendor_id', vendorId)
        .limit(1)
        .maybeSingle();
      if (res.error) throw res.error;
      return res.data?.id || null;
    } catch (_e) {
      return null;
    }
  }

  if (type === 'cars') {
    try {
      const { data, error } = await client
        .from('car_offers')
        .select('owner_partner_id')
        .eq('id', rid)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.owner_partner_id || null;
    } catch (_e) {
      return null;
    }
  }

  if (type === 'trips') {
    try {
      const { data, error } = await client
        .from('trips')
        .select('owner_partner_id')
        .eq('id', rid)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.owner_partner_id || null;
    } catch (_e) {
      return null;
    }
  }

  if (type === 'hotels') {
    try {
      const { data, error } = await client
        .from('hotels')
        .select('owner_partner_id')
        .eq('id', rid)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.owner_partner_id || null;
    } catch (_e) {
      return null;
    }
  }

  return null;
}

async function loadCalendarsMonthData() {
  const client = ensureSupabase();
  if (!client) return;

  const partnerId = String(document.getElementById('calendarsPartnerFilter')?.value || '').trim();
  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const resourceId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();
  ensureCalendarsMonthInput();
  const monthValue = calendarsState.monthValue || getMonthValue();
  const { startIso, endIso } = monthToStartEnd(monthValue);

  calendarsState.monthBlocks = [];
  calendarsState.monthBusyRanges = [];

  if (!type || !resourceId) {
    renderCalendarsMonthGrid();
    return;
  }

  try {
    let blocksQuery = client
      .from('partner_availability_blocks')
      .select('id, partner_id, resource_type, resource_id, start_date, end_date, note')
      .eq('resource_type', type)
      .eq('resource_id', resourceId)
      .lte('start_date', endIso)
      .gte('end_date', startIso)
      .limit(500);

    if (partnerId) {
      blocksQuery = blocksQuery.eq('partner_id', partnerId);
    }

    const { data: monthBlocks, error: blocksError } = await blocksQuery;
    if (blocksError) throw blocksError;
    calendarsState.monthBlocks = monthBlocks || [];

    const ranges = [];
    if (type === 'cars') {
      const { data, error } = await client
        .from('car_bookings')
        .select('pickup_date, return_date, status')
        .eq('offer_id', resourceId)
        .neq('status', 'cancelled')
        .lte('pickup_date', endIso)
        .gte('return_date', startIso)
        .limit(500);
      if (error) throw error;
      (data || []).forEach(r => {
        if (!r.pickup_date || !r.return_date) return;
        ranges.push({ start_date: r.pickup_date, end_date: r.return_date });
      });
    }

    if (type === 'hotels') {
      const { data, error } = await client
        .from('hotel_bookings')
        .select('arrival_date, departure_date, status')
        .eq('hotel_id', resourceId)
        .neq('status', 'cancelled')
        .lte('arrival_date', endIso)
        .gte('departure_date', startIso)
        .limit(500);
      if (error) throw error;
      (data || []).forEach(r => {
        if (!r.arrival_date || !r.departure_date) return;
        ranges.push({ start_date: r.arrival_date, end_date: r.departure_date });
      });
    }

    if (type === 'trips') {
      const { data, error } = await client
        .from('trip_bookings')
        .select('trip_date, arrival_date, status')
        .eq('trip_id', resourceId)
        .neq('status', 'cancelled')
        .gte('arrival_date', startIso)
        .lte('arrival_date', endIso)
        .limit(500);
      if (error) throw error;
      (data || []).forEach(r => {
        const d = r.trip_date || r.arrival_date;
        if (!d) return;
        ranges.push({ start_date: d, end_date: d });
      });
    }

    calendarsState.monthBusyRanges = ranges;
    renderCalendarsMonthGrid();
  } catch (error) {
    console.error('Failed to load month data:', error);
    renderCalendarsMonthGrid();
  }
}

function renderCalendarsMonthGrid() {
  const grid = document.getElementById('calendarsMonthGrid');
  if (!grid) return;

  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const resourceId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();
  ensureCalendarsMonthInput();
  const monthValue = calendarsState.monthValue || getMonthValue();
  const { start, end, startIso, endIso } = monthToStartEnd(monthValue);

  if (!type || !resourceId) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; color: var(--admin-text-muted); padding: 10px;">Select resource type + resource to view calendar</div>';
    return;
  }

  const blocks = (calendarsState.monthBlocks || []).filter(b => b.resource_type === type && String(b.resource_id) === resourceId && dateRangeOverlapsMonth(b.start_date, b.end_date, startIso, endIso));
  const ranges = calendarsState.monthBusyRanges || [];

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const headerHtml = dayNames.map(d => `<div style="padding: 8px 6px; font-size: 12px; text-align:center; color: var(--admin-text-muted);">${d}</div>`).join('');

  const firstDow = (start.getUTCDay() + 6) % 7;
  const blanks = Array.from({ length: firstDow }).map(() => `<div style="height: 44px;"></div>`).join('');

  const days = [];
  const todayIso = new Date().toISOString().slice(0, 10);
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

  grid.innerHTML = headerHtml + blanks + days.join('');

  grid.querySelectorAll('button[data-day]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayIso = btn.getAttribute('data-day');
      if (!dayIso) return;
      await toggleAdminCalendarsSingleDayBlock(dayIso);
    });
  });
}

async function toggleAdminCalendarsSingleDayBlock(dayIso) {
  const client = ensureSupabase();
  if (!client) return;

  const partnerId = String(document.getElementById('calendarsPartnerFilter')?.value || '').trim();
  const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
  const resourceId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();
  const day = String(dayIso || '').trim();

  if (!type) {
    showToast('Please select a resource', 'error');
    return;
  }
  if (!day) return;

  try {
    let effectivePartnerId = partnerId;

    if (calendarsState.bulkMode && !effectivePartnerId) {
      showToast('Select partner', 'error');
      return;
    }

    if (!calendarsState.bulkMode) {
      if (!resourceId) {
        showToast('Please select a resource', 'error');
        return;
      }

      if (!effectivePartnerId) {
        effectivePartnerId = await resolvePartnerIdForCalendarsResource(client, type, resourceId);
      }
    }

    if (!effectivePartnerId) {
      showToast('Select partner', 'error');
      return;
    }

    if (calendarsState.bulkMode) {
      const targets = await getAdminCalendarsTargets();
      if (!targets.length) {
        showToast('No target resources selected', 'error');
        return;
      }
      await toggleSingleDayBlocksForTargetsAdmin(effectivePartnerId, day, targets);
      await loadAdminCalendarsData();
      return;
    }

    const existing = (calendarsState.monthBlocks || [])
      .find(b => String(b.start_date) === String(day) && String(b.end_date) === String(day) && String(b.resource_id) === String(resourceId) && String(b.resource_type) === String(type) && String(b.partner_id) === String(effectivePartnerId));

    if (existing?.id) {
      const { error } = await client
        .from('partner_availability_blocks')
        .delete()
        .eq('id', existing.id)
        .eq('partner_id', effectivePartnerId);
      if (error) throw error;
      showToast('Day unblocked', 'success');
    } else {
      const payload = {
        partner_id: effectivePartnerId,
        resource_type: type,
        resource_id: resourceId,
        start_date: day,
        end_date: day,
        note: null,
        created_by: adminState.user?.id || null,
      };
      const { error } = await client
        .from('partner_availability_blocks')
        .insert(payload);
      if (error) throw error;
      showToast('Day blocked', 'success');
    }

    await loadAdminCalendarsData();
  } catch (error) {
    console.error(error);
    showToast(`Error: ${error.message || 'Update failed'}`, 'error');
  }
}

async function loadAdminCalendarsData() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('calendarsTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">Loading availability...</td></tr>';

  try {
    const { data: partners, error: partnersError } = await client
      .from('partners')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(500);

    if (partnersError) throw partnersError;
    calendarsState.partners = partners || [];
    calendarsState.partnersById = {};
    calendarsState.partners.forEach(p => {
      calendarsState.partnersById[p.id] = p;
    });

    fillCalendarsCreatePartnerSelect();

    const partnerFilter = document.getElementById('calendarsPartnerFilter');
    if (partnerFilter) {
      const existing = partnerFilter.value;
      partnerFilter.innerHTML = '<option value="">All partners</option>' + calendarsState.partners.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      if (existing) partnerFilter.value = existing;
    }

    const { data: blocks, error: blocksError } = await client
      .from('partner_availability_blocks')
      .select('id, partner_id, resource_type, resource_id, start_date, end_date, note, created_at')
      .order('start_date', { ascending: false })
      .limit(300);

    if (blocksError) throw blocksError;

    calendarsState.blocks = blocks || [];

    renderCalendarsTable();
    ensureCalendarsMonthInput();
    renderAdminCalendarsResourceTypePanels();
    await loadCalendarsResourceOptions();
    await loadCalendarsCreateResourceOptions();
    syncAdminCalendarsCreateFields();
    await loadCalendarsMonthData();
  } catch (error) {
    console.error('Failed to load calendars:', error);
    const tbodyErr = document.getElementById('calendarsTableBody');
    if (tbodyErr) tbodyErr.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444; padding: 24px;">Error: ${escapeHtml(error.message || 'Failed to load')}</td></tr>`;
  }
}

function renderCalendarsTable() {
  const tbody = document.getElementById('calendarsTableBody');
  if (!tbody) return;

  const partnerIdFilter = document.getElementById('calendarsPartnerFilter')?.value || '';
  const resourceTypeFilter = document.getElementById('calendarsResourceTypeFilter')?.value || '';

  const blocks = Array.isArray(calendarsState.blocks) ? calendarsState.blocks : [];
  const filtered = blocks.filter(b => {
    const matchesPartner = !partnerIdFilter || b.partner_id === partnerIdFilter;
    const matchesType = !resourceTypeFilter || b.resource_type === resourceTypeFilter;
    return matchesPartner && matchesType;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--admin-text-muted);">No availability blocks found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const partnerName = calendarsState.partnersById[b.partner_id]?.name || (b.partner_id ? String(b.partner_id).slice(0, 8) : '—');
    return `
      <tr>
        <td>${escapeHtml(partnerName)}</td>
        <td>${escapeHtml(b.resource_type || '')}</td>
        <td><code>${escapeHtml(String(b.resource_id || ''))}</code></td>
        <td style="white-space: nowrap;">${escapeHtml(String(b.start_date || ''))}</td>
        <td style="white-space: nowrap;">${escapeHtml(String(b.end_date || ''))}</td>
        <td>${escapeHtml(b.note || '')}</td>
        <td style="text-align: right;">
          <button class="btn-small btn-danger" type="button" data-cal-del="${escapeHtml(String(b.id))}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-cal-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cal-del');
      deleteAvailabilityBlockAdmin(id);
    });
  });
}

async function deleteShopOrder(orderId, orderNumber, paymentStatus) {
  const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();
  const isPaidLike = ['paid', 'partially_refunded', 'refunded'].includes(normalizedPaymentStatus);

  const warning = isPaidLike
    ? `UWAGA: Zamówienie ma status płatności: ${normalizedPaymentStatus}.\n\nJeśli płatność przeszła, usunięcie może utrudnić późniejsze wyjaśnienia.\n\nCzy na pewno chcesz usunąć zamówienie ${orderNumber}?\n\nTa operacja jest nieodwracalna.`
    : `Czy na pewno chcesz usunąć zamówienie ${orderNumber}?\n\nTa operacja jest nieodwracalna.`;

  if (!confirm(warning)) return;

  const typed = prompt(`Aby potwierdzić, wpisz dokładnie numer zamówienia: ${orderNumber}`);
  if (String(typed || '').trim() !== String(orderNumber || '').trim()) {
    showToast('Anulowano usuwanie (nieprawidłowe potwierdzenie).', 'info');
    return;
  }

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: orderRow, error: orderLoadError } = await client
      .from('shop_orders')
      .select('id, order_source')
      .eq('id', orderId)
      .single();
    if (orderLoadError) throw orderLoadError;
    if (!orderRow || String(orderRow.order_source || '') !== 'admin') {
      showToast('Delete allowed only for admin-created orders', 'error');
      return;
    }

    const { error } = await client
      .from('shop_orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;

    showToast('Zamówienie usunięte', 'success');
    const modal = document.getElementById('shopOrderModal');
    if (modal) modal.hidden = true;
    await loadShopOrders();
    await loadShopStats();
  } catch (error) {
    console.error('Failed to delete order:', error);
    showToast('Nie udało się usunąć zamówienia: ' + error.message, 'error');
  }
}

// =====================================================
// TRIP BOOKINGS MODULE
// =====================================================

async function loadTripBookingsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading trip bookings data...');

    const { data: bookings, error } = await client
      .from('trip_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading trip bookings:', error);
      throw error;
    }

    console.log('Trip bookings loaded:', bookings);

    // Calculate stats
    const totalBookings = bookings?.length || 0;
    const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const totalRevenue = bookings
      ?.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.total_price)
      .reduce((sum, b) => sum + parseFloat(b.total_price), 0) || 0;

    // Update stats if elements exist
    const statTotal = $('#statTripBookingsTotal');
    const statPending = $('#statTripBookingsPending');
    const statConfirmed = $('#statTripBookingsConfirmed');
    const statRevenue = $('#statTripBookingsRevenue');

    if (statTotal) statTotal.textContent = totalBookings;
    if (statPending) statPending.textContent = pendingBookings;
    if (statConfirmed) statConfirmed.textContent = confirmedBookings;
    if (statRevenue) statRevenue.textContent = `€${totalRevenue.toFixed(2)}`;

    // Update table
    const tableBody = $('#tripBookingsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">
            No trip bookings yet. System is ready to accept bookings!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${escapeHtml(booking.trip_slug || 'N/A')}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_email || '')}</div>
            ${booking.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 12px;">
              ${booking.trip_date ? '🎯 ' + new Date(booking.trip_date).toLocaleDateString('en-GB') : ''}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 4px;">
              ${booking.arrival_date && booking.departure_date ? 
                `✈️ ${new Date(booking.arrival_date).toLocaleDateString('en-GB')} - ${new Date(booking.departure_date).toLocaleDateString('en-GB')}` 
                : 'No dates'}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${booking.num_adults || booking.num_hours || booking.num_days ? 
                (booking.num_adults ? `👥 ${booking.num_adults}+${booking.num_children || 0}` : '') +
                (booking.num_hours ? ` ⏱️ ${booking.num_hours}h` : '') +
                (booking.num_days ? ` 📅 ${booking.num_days}d` : '')
                : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}">
              ${(booking.status || 'unknown').toUpperCase()}
            </span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            €${Number(booking.total_price || 0).toFixed(2)}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewTripBookingDetails('${booking.id}')" title="View details">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    showToast('Trip bookings loaded successfully', 'success');

  } catch (error) {
    console.error('Failed to load trip bookings:', error);
    showToast('Failed to load trip bookings: ' + (error.message || 'Unknown error'), 'error');
    
    const tableBody = $('#tripBookingsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the trip_bookings table exists in Supabase. 
              Run the migration: supabase/migrations/015_trip_bookings_table.sql
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewTripBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    console.log('Loading trip booking details:', bookingId);

    const { data: booking, error } = await client
      .from('trip_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking details', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    const modal = $('#tripBookingDetailsModal');
    const content = $('#tripBookingDetailsContent');
    if (!modal || !content) {
      console.error('Modal elements not found');
      return;
    }

    const tripDate = booking.trip_date ? new Date(booking.trip_date).toLocaleDateString('en-GB') : 'Not set';
    const arrivalDate = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : 'N/A';
    const departureDate = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';

    let fulfillment = null;
    try {
      const { data: fRows } = await client
        .from('partner_service_fulfillments')
        .select('id, status, contact_revealed_at, rejected_reason, partner_id, created_at')
        .eq('resource_type', 'trips')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(50);
      fulfillment = pickBestServiceFulfillment(fRows || []) || null;
    } catch (_e) {
    }

    const fulfillmentStatus = String(fulfillment?.status || '').trim();
    const fulfillmentPillClass =
      fulfillmentStatus === 'accepted' ? 'badge-success' :
      fulfillmentStatus === 'rejected' ? 'badge-danger' :
      fulfillmentStatus === 'awaiting_payment' ? 'badge-warning' :
      fulfillmentStatus === 'pending_acceptance' ? 'badge-warning' : 'badge';

    const fulfillmentActions = (() => {
      if (!fulfillment || !fulfillment.id) return '';
      if (fulfillmentStatus === 'pending_acceptance') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('trips','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','accept')">Accept</button>
            <button type="button" class="btn-danger" onclick="adminServiceFulfillmentActionForBooking('trips','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','reject')">Reject</button>
          </div>
        `;
      }
      if (fulfillmentStatus === 'awaiting_payment') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('trips','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','mark_paid')">Mark paid</button>
          </div>
        `;
      }
      return '';
    })();

    const fulfillmentHtml = (() => {
      if (!fulfillment || !fulfillment.id) {
        return `
          <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
            <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
              <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
                <div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">No linked fulfillment found for this booking.</div>
              </div>
            </div>
          </div>
        `;
      }

      const extra = fulfillmentStatus === 'rejected' && fulfillment.rejected_reason
        ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Reason: ${escapeHtml(String(fulfillment.rejected_reason))}</div>`
        : (fulfillmentStatus === 'accepted' && fulfillment.contact_revealed_at
          ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Contact revealed</div>`
          : '');

      return `
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
              <div style="margin-top: 6px;">
                <span class="badge ${fulfillmentPillClass}">${escapeHtml(fulfillmentStatus || 'unknown')}</span>
              </div>
              ${extra}
            </div>
            ${fulfillmentActions}
          </div>
        </div>
      `;
    })();

    const canDelete = String(booking.source || '') === 'admin';

    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' :
      booking.status === 'completed' ? 'badge-success' : 'badge';

    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <!-- Header Info -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Trip: ${escapeHtml(booking.trip_slug || 'N/A')}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="tripBookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateTripBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Customer Information -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.customer_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.customer_email)}">${escapeHtml(booking.customer_email || 'N/A')}</a></span>
            </div>
            ${booking.customer_phone ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.customer_phone)}">${escapeHtml(booking.customer_phone)}</a></span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Trip Details -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Trip Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Preferred Date:</span>
              <span>🎯 ${tripDate}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Stay on Cyprus:</span>
              <span>✈️ ${arrivalDate} → ${departureDate}</span>
            </div>
            ${booking.num_adults ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Participants:</span>
              <span>👥 ${booking.num_adults} adult(s), ${booking.num_children || 0} child(ren)</span>
            </div>
            ` : ''}
            ${booking.num_hours ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span>⏱️ ${booking.num_hours} hour(s)</span>
            </div>
            ` : ''}
            ${booking.num_days ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span>📅 ${booking.num_days} day(s)</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Notes:</span>
              <span>${escapeHtml(booking.notes)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Pricing -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Price</h4>
          <div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: white;">€${Number(booking.total_price || 0).toFixed(2)}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 4px;">Total Price</div>
          </div>
        </div>

        ${fulfillmentHtml}

        <!-- Actions -->
        <div style="display: flex; gap: 12px;">
          <button 
            type="button" 
            class="btn-secondary"
            onclick="document.getElementById('tripBookingDetailsModal').hidden=true"
            style="flex: 1;"
          >
            Close
          </button>
          ${canDelete ? `
          <button 
            type="button" 
            class="btn-danger"
            onclick="deleteTripBooking('${booking.id}')"
            style="flex: 1;"
          >
            🗑️ Delete Booking
          </button>
          ` : ''}
        </div>
      </div>
    `;

    // Show modal
    modal.hidden = false;

  } catch (e) {
    console.error('Failed to load trip booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

// Update trip booking status
async function updateTripBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const updateData = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add timestamp for confirmed/cancelled
    if (newStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { error } = await client
      .from('trip_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    showToast(`Status updated to: ${newStatus}`, 'success');
    await loadTripBookingsData(); // Refresh table
    await loadAllOrders({ silent: true });
    
    // Update badge in modal
    const badge = document.querySelector('#tripBookingDetailsModal .badge');
    if (badge) {
      badge.textContent = newStatus.toUpperCase();
      badge.className = 'badge ' + (
        newStatus === 'confirmed' ? 'badge-success' :
        newStatus === 'pending' ? 'badge-warning' :
        newStatus === 'cancelled' ? 'badge-danger' :
        newStatus === 'completed' ? 'badge-success' : 'badge'
      );
    }

  } catch (e) {
    console.error('Failed to update status:', e);
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

// Delete trip booking
async function deleteTripBooking(bookingId) {
  if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    let bookingRow = null;
    try {
      const res = await client
        .from('trip_bookings')
        .select('id, source')
        .eq('id', bookingId)
        .single();
      if (res.error) throw res.error;
      bookingRow = res.data;
    } catch (e) {
      if (/column\s+"source"\s+does\s+not\s+exist/i.test(String(e.message || ''))) {
        showToast('DB not upgraded: trip_bookings.source missing (run migrations).', 'error');
        return;
      }
      throw e;
    }

    if (!bookingRow || String(bookingRow.source || '') !== 'admin') {
      showToast('Delete allowed only for admin-created bookings', 'error');
      return;
    }

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'trips')
        .eq('booking_id', bookingId);
    } catch (_e) {
    }

    const { error } = await client
      .from('trip_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking deleted successfully', 'success');
    document.getElementById('tripBookingDetailsModal').hidden = true;
    await loadTripBookingsData(); // Refresh table
    await loadAllOrders({ silent: true });

  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + e.message, 'error');
  }
}

// Export functions
window.viewTripBookingDetails = viewTripBookingDetails;
window.updateTripBookingStatus = updateTripBookingStatus;
window.deleteTripBooking = deleteTripBooking;

// =====================================================
// TRIPS MANAGEMENT
// =====================================================

async function loadTripsAdminData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    // Load trips list
    const { data: trips, error } = await client
      .from('trips')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Store list globally for reordering helpers
    window.tripsAdminList = Array.isArray(trips) ? trips.slice() : [];

    // Stats
    const total = window.tripsAdminList?.length || 0;
    const published = (window.tripsAdminList || []).filter(t => t.is_published).length;
    const statTotal = document.getElementById('tripsStatTotal');
    const statPub = document.getElementById('tripsStatPublished');
    const sub = document.getElementById('tripsStatSubtitle');
    if (statTotal) statTotal.textContent = total;
    if (statPub) statPub.textContent = published;
    if (sub) sub.textContent = total ? `${published} published` : 'No trips yet';

    // Table
    const tbody = document.getElementById('tripsTableBody');
    if (!tbody) return;
    if (!trips || trips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-loading">No trips found</td></tr>';
      return;
    }

    tbody.innerHTML = trips.map(t => {
      const title = (t.title && (t.title.pl || t.title.en)) || t.slug || t.id;
      const updated = t.updated_at ? new Date(t.updated_at).toLocaleString('en-GB') : '-';
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(title)}</div>
            ${t.display_mode ? `<div style=\"font-size:11px;color:var(--admin-text-muted)\">${escapeHtml(t.display_mode)}</div>` : ''}
          </td>
          <td>${escapeHtml(t.slug || '')}</td>
          <td>${escapeHtml(t.start_city || '')}</td>
          <td>
            <label class="admin-switch" title="Toggle publish">
              <input type="checkbox" ${t.is_published ? 'checked' : ''} onchange="toggleTripPublish('${t.id}', this.checked)">
              <span></span>
            </label>
          </td>
          <td>${updated}</td>
          <td>
            <button class="btn-secondary" onclick="moveTripOrder('${t.id}', 'up')">⬆️</button>
            <button class="btn-secondary" onclick="moveTripOrder('${t.id}', 'down')">⬇️</button>
          </td>
          <td style="display:flex;gap:8px;">
            <button class="btn-primary" onclick="editTrip('${t.id}')">Edit</button>
            <a class="btn-secondary" href="/trip.html?slug=${encodeURIComponent(t.slug)}" target="_blank">Preview</a>
            <button class="btn-danger" onclick="deleteTripResource('${t.id}', '${escapeHtml(String(title)).replace(/'/g, "\\'")}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Button: New Trip
    const addBtn = document.getElementById('btnAddTrip');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.addEventListener('click', openNewTripModal);
      addBtn.dataset.bound = '1';
    }

    showToast('Trips loaded', 'success');
  } catch (e) {
    console.error('Failed to load trips:', e);
    showToast('Failed to load trips: ' + (e.message || 'Unknown error'), 'error');
    const tbody = document.getElementById('tripsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function moveTripOrder(tripId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.tripsAdminList) ? window.tripsAdminList : [];
    const index = list.findIndex(t => t.id === tripId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    // Swap sort_order values between the two trips
    const { error: err1 } = await client
      .from('trips')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('trips')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Trip order updated', 'success');
    await loadTripsAdminData();
  } catch (e) {
    console.error('Failed to update trip order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function toggleTripPublish(tripId, publish) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client
      .from('trips')
      .update({ is_published: !!publish, updated_at: new Date().toISOString() })
      .eq('id', tripId);
    if (error) throw error;
    showToast(publish ? 'Trip published' : 'Trip unpublished', 'success');
    await loadTripsAdminData();
  } catch (e) {
    console.error('Publish toggle failed:', e);
    showToast('Failed to update publish state', 'error');
  }
}

async function editTrip(tripId) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    // Fetch trip data
    const { data: trip, error } = await client
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();
    
    if (error) throw error;
    
    // Populate form fields
    const modal = document.getElementById('editTripModal');
    const form = document.getElementById('editTripForm');
    if (!modal || !form) return;
    
    document.getElementById('editTripId').value = trip.id;
    document.getElementById('editTripSlug').value = trip.slug || '';
    document.getElementById('editTripCity').value = trip.start_city || 'Larnaca';
    document.getElementById('editTripCoverUrl').value = trip.cover_image_url || '';
    document.getElementById('editTripPricing').value = trip.pricing_model || 'per_person';
    document.getElementById('editTripPublished').checked = !!trip.is_published;
    
    // Check if we should use i18n fields
    // All trips use i18n (title and description are JSONB)
    const useI18n = true;
    const i18nContainer = document.getElementById('tripI18nFields');
    const legacyFields = document.getElementById('tripLegacyFields');
    
    if (useI18n && i18nContainer && legacyFields && window.renderI18nInput) {
      // Render i18n fields
      const titleContainer = document.getElementById('tripTitleI18n');
      const descContainer = document.getElementById('tripDescriptionI18n');
      
      if (titleContainer) {
        titleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          placeholder: 'Trip title',
          currentValues: trip?.title || {}
        });
      }
      
      if (descContainer) {
        descContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 4,
          placeholder: 'Trip description',
          currentValues: trip?.description || {}
        });
      }
      
      // Show i18n container, hide legacy fields
      i18nContainer.style.display = 'block';
      legacyFields.style.display = 'none';
    } else if (legacyFields && i18nContainer) {
      // Use legacy fields
      i18nContainer.style.display = 'none';
      legacyFields.style.display = 'contents';
      
      // Fill legacy fields
      document.getElementById('editTripTitlePl').value = (trip.title && trip.title.pl) || '';
      document.getElementById('editTripDescPl').value = (trip.description && trip.description.pl) || '';
    }
    
    // Show cover preview if URL exists
    updateTripCoverPreview(trip.cover_image_url || '');
    
    // Render price fields based on pricing model
    renderEditTripPriceFields(trip.pricing_model, trip);
    
    // Setup pricing model change listener
    const pricingSelect = document.getElementById('editTripPricing');
    if (pricingSelect) {
      pricingSelect.onchange = (e) => renderEditTripPriceFields(e.target.value, trip);
    }
    
    // Setup cover URL input preview (live update as user types)
    const urlInput = document.getElementById('editTripCoverUrl');
    if (urlInput) {
      urlInput.oninput = () => {
        updateTripCoverPreview(urlInput.value);
      };
    }
    
    // Setup form submit handler
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditTripSubmit(e, trip);
    };
    
    modal.hidden = false;
  } catch (e) {
    console.error('Failed to open edit modal:', e);
    showToast('Failed to load trip for editing', 'error');
  }
}

function renderEditTripPriceFields(model, trip) {
  const container = document.getElementById('editTripPriceFields');
  if (!container) return;
  
  if (model === 'per_person') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per person</span><input name="price_per_person" type="number" step="0.01" value="${trip.price_per_person || ''}" /></label>
    `;
  } else if (model === 'base_plus_extra') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Base price</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
      <label class="admin-form-field"><span>Included people</span><input name="included_people" type="number" step="1" value="${trip.included_people || ''}" /></label>
      <label class="admin-form-field"><span>Extra per person</span><input name="price_extra_person" type="number" step="0.01" value="${trip.price_extra_person || ''}" /></label>
    `;
  } else if (model === 'per_hour') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per hour</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
      <label class="admin-form-field"><span>Min hours</span><input name="min_hours" type="number" step="1" value="${trip.min_hours || ''}" /></label>
    `;
  } else if (model === 'per_day') {
    container.innerHTML = `
      <label class="admin-form-field"><span>Price per day</span><input name="price_base" type="number" step="0.01" value="${trip.price_base || ''}" /></label>
    `;
  } else {
    container.innerHTML = '';
  }
}

async function handleEditTripSubmit(event, originalTrip) {
  event.preventDefault();
  
  try {
    console.log('📝 Trip edit form submitted');
    
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const form = event.target;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    
    // Normalize types
    ['price_base', 'price_per_person', 'price_extra_person', 'included_people', 'min_hours'].forEach(k => {
      if (payload[k] === '' || payload[k] == null) delete payload[k];
      else payload[k] = Number(payload[k]);
    });
    
    // Extract i18n values (title and description are JSONB)
    if (window.extractI18nValues) {
      const titleI18n = window.extractI18nValues(fd, 'title');
      const descriptionI18n = window.extractI18nValues(fd, 'description');
      
      console.log('🔍 Extracted i18n values:', { titleI18n, descriptionI18n });
      
      // Validate i18n fields
      if (window.validateI18nField) {
        const titleError = window.validateI18nField(titleI18n, 'Title');
        if (titleError) {
          console.error('❌ Validation error:', titleError);
          throw new Error(titleError);
        }
        console.log('✅ Validation passed');
      }
      
      // Save directly to title and description (JSONB columns, like Hotels)
      if (titleI18n) payload.title = titleI18n;
      if (descriptionI18n) payload.description = descriptionI18n;
      
      console.log('💾 Payload title:', payload.title);
      console.log('💾 Payload description:', payload.description);
      
      // Clean up legacy fields from payload
      delete payload.title_pl;
      delete payload.title_en;
      delete payload.title_el;
      delete payload.title_he;
      delete payload.description_pl;
      delete payload.description_en;
      delete payload.description_el;
      delete payload.description_he;
    }
    
    // Handle is_published checkbox
    payload.is_published = form.querySelector('#editTripPublished').checked;
    
    // Update timestamp
    payload.updated_at = new Date().toISOString();
    
    const tripId = document.getElementById('editTripId').value;
    
    console.log('🚀 Updating trip in database...');
    console.log('   Trip ID:', tripId);
    console.log('   Payload:', payload);
    
    // Update via Supabase client
    const { error } = await client
      .from('trips')
      .update(payload)
      .eq('id', tripId);
    
    if (error) {
      console.error('❌ Trip update error:', error);
      throw error;
    }
    
    console.log('✅ Trip updated successfully');
    showToast('Trip updated successfully', 'success');
    document.getElementById('editTripModal').hidden = true;
    await loadTripsAdminData();
    
  } catch (err) {
    console.error('❌ Failed to update trip:', err);
    showToast(err.message || 'Failed to update trip', 'error');
  }
}

// Trip cover image upload
async function handleTripCoverUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  
  // Validate file
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image must be smaller than 5MB', 'error');
    return;
  }
  
  const uploadBtn = input.previousElementSibling?.previousElementSibling?.querySelector?.('.btn-upload-image') 
    || document.querySelector('.btn-upload-image');
  
  try {
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '⏳ Uploading...';
    }
    
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `trips/cover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = client.storage
      .from('images')
      .getPublicUrl(filename);
    
    // Set URL in input field
    const urlInput = document.getElementById('editTripCoverUrl');
    if (urlInput) {
      urlInput.value = publicUrl;
      // Trigger preview update
      updateTripCoverPreview(publicUrl);
    }
    
    showToast('Image uploaded successfully', 'success');
    
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Failed to upload image: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '📤 Upload';
    }
    input.value = ''; // Reset file input
  }
}

function updateTripCoverPreview(url) {
  const previewWrap = document.getElementById('editTripCoverPreview');
  const previewImg = previewWrap?.querySelector('img');
  
  if (!previewWrap || !previewImg) return;
  
  if (url && url.trim()) {
    previewImg.src = url;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
  }
}

function removeTripCoverImage() {
  const urlInput = document.getElementById('editTripCoverUrl');
  if (urlInput) {
    urlInput.value = '';
  }
  updateTripCoverPreview('');
}

// expose trip helpers for inline handlers
window.toggleTripPublish = toggleTripPublish;
window.editTrip = editTrip;
window.moveTripOrder = moveTripOrder;
window.handleTripCoverUpload = handleTripCoverUpload;
window.removeTripCoverImage = removeTripCoverImage;
window.updateTripCoverPreview = updateTripCoverPreview;

// =====================================================
// NEW TRIP MODAL (create + link to POI)
// =====================================================

function renderNewTripPriceFields(model) {
  const c = document.getElementById('newTripPriceFields');
  if (!c) return;
  if (model === 'per_person') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per person</span><input name="price_per_person" type="number" step="0.01" /></label>
    `;
  } else if (model === 'base_plus_extra') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Base price</span><input name="price_base" type="number" step="0.01" /></label>
      <label class="admin-form-field"><span>Included people</span><input name="included_people" type="number" step="1" /></label>
      <label class="admin-form-field"><span>Extra per person</span><input name="price_extra_person" type="number" step="0.01" /></label>
    `;
  } else if (model === 'per_hour') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per hour</span><input name="price_base" type="number" step="0.01" /></label>
      <label class="admin-form-field"><span>Min hours</span><input name="min_hours" type="number" step="1" /></label>
    `;
  } else if (model === 'per_day') {
    c.innerHTML = `
      <label class="admin-form-field"><span>Price per day</span><input name="price_base" type="number" step="0.01" /></label>
    `;
  } else {
    c.innerHTML = '';
  }
}

function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `trip-${Date.now()}`;
}

function compressToWebp(file, maxWidth = 1920, maxHeight = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compression failed'));
            const out = new File([blob], (file.name.split('.')[0] || 'cover') + '.webp', { type: 'image/webp' });
            resolve(out);
          }, 'image/webp', quality);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsDataURL(file);
    } catch (e) { reject(e); }
  });
}

async function openNewTripModal() {
  try {
    // Defaults
    const pricingSel = document.getElementById('newTripPricing');
    if (pricingSel) {
      renderNewTripPriceFields(pricingSel.value || 'per_person');
      pricingSel.onchange = (e) => renderNewTripPriceFields(e.target.value);
    }

    const form = document.getElementById('newTripForm');
    if (form) {
      // reset fields
      form.reset();
      
      // Render i18n fields for title and description
      const titleContainer = document.getElementById('newTripTitleI18n');
      const descContainer = document.getElementById('newTripDescriptionI18n');
      
      if (titleContainer && window.renderI18nInput) {
        titleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          placeholder: 'Trip title',
          currentValues: {}
        });
      }
      
      if (descContainer && window.renderI18nInput) {
        descContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          rows: 3,
          placeholder: 'Trip description',
          currentValues: {}
        });
      }
      
      // cover preview setup
      const fileInput = document.getElementById('newTripCoverFile');
      const urlInput = document.getElementById('newTripCoverUrl');
      const previewWrap = document.getElementById('newTripCoverPreview');
      const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
      if (fileInput && previewWrap && previewImg) {
        fileInput.onchange = () => {
          const f = fileInput.files && fileInput.files[0];
          if (f && f.type && f.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              previewImg.src = reader.result;
              previewWrap.style.display = '';
            };
            reader.readAsDataURL(f);
            // Clear URL if file chosen
            if (urlInput) urlInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }
      if (urlInput && previewWrap && previewImg) {
        urlInput.oninput = () => {
          const v = (urlInput.value || '').trim();
          if (v) {
            previewImg.src = v;
            previewWrap.style.display = '';
            if (fileInput) fileInput.value = '';
          } else {
            previewWrap.style.display = 'none';
            previewImg.removeAttribute('src');
          }
        };
      }
      // Pricing tiers editor init
      renderPricingTiers('newHotelPricingTiersBody', []);
      const btnAddNewTier = document.getElementById('btnAddNewHotelTier');
      if (btnAddNewTier && !btnAddNewTier.dataset.bound) {
        btnAddNewTier.addEventListener('click', () => addPricingTierRow('newHotelPricingTiersBody'));
        btnAddNewTier.dataset.bound = '1';
      }

      // Photos multiple preview
      const multiPhotos = document.getElementById('newHotelPhotos');
      const multiPreview = document.getElementById('newHotelPhotosPreview');
      if (multiPhotos && multiPreview) {
        multiPhotos.onchange = () => previewLocalImages(multiPhotos, multiPreview, 10);
      }

      form.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());
          
          console.log('📝 Creating new trip...');
          
          // Normalize types
          ['price_base','price_per_person','price_extra_person','included_people','min_hours'].forEach(k=>{
            if (payload[k] === '' || payload[k] == null) delete payload[k];
            else payload[k] = Number(payload[k]);
          });
          
          // Extract i18n values (title and description are JSONB)
          if (window.extractI18nValues) {
            const titleI18n = window.extractI18nValues(fd, 'title');
            const descriptionI18n = window.extractI18nValues(fd, 'description');
            
            console.log('🔍 Extracted i18n values:', { titleI18n, descriptionI18n });
            
            // Validate i18n fields
            if (window.validateI18nField) {
              const titleError = window.validateI18nField(titleI18n, 'Title');
              if (titleError) {
                console.error('❌ Validation error:', titleError);
                throw new Error(titleError);
              }
              console.log('✅ Validation passed');
            }
            
            // Save directly to title and description (JSONB columns, like Hotels)
            if (titleI18n) payload.title = titleI18n;
            if (descriptionI18n) payload.description = descriptionI18n;
            
            // Clean up legacy fields from payload
            delete payload.title_pl;
            delete payload.title_en;
            delete payload.title_el;
            delete payload.title_he;
            delete payload.description_pl;
            delete payload.description_en;
            delete payload.description_el;
            delete payload.description_he;
            
            // Auto-generate slug from Polish title
            payload.slug = slugifyTitle(titleI18n?.pl || 'trip');
          } else {
            throw new Error('i18n functions not available');
          }

          // Optional direct upload of cover image to Storage
          let coverUrl = (payload.cover_image_url || '').trim() || '';
          const file = fileInput && fileInput.files ? fileInput.files[0] : null;
          if (file) {
            if (!file.type.startsWith('image/')) throw new Error('Nieprawidłowy typ pliku okładki');
            const maxSize = 8 * 1024 * 1024;
            if (file.size > maxSize) throw new Error('Plik okładki jest za duży (max 8MB)');
            
            const compressed = await compressToWebp(file, 1920, 1080, 0.82);
            const path = `trips/${payload.slug}/cover-${Date.now()}.webp`;
            const { error: upErr } = await client.storage.from('poi-photos').upload(path, compressed, { 
              cacheControl: '3600', 
              upsert: false, 
              contentType: 'image/webp' 
            });
            if (upErr) throw upErr;
            
            const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
            coverUrl = pub?.publicUrl || '';
          }
          if (coverUrl) payload.cover_image_url = coverUrl; 
          else delete payload.cover_image_url;

          // Set timestamps
          const now = new Date().toISOString();
          payload.created_at = now;
          payload.updated_at = now;
          payload.is_published = false; // New trips start as drafts

          console.log('🚀 Inserting trip into database...');
          console.log('   Payload:', payload);

          // Insert directly via Supabase client (like Cars does)
          const { data, error } = await client
            .from('trips')
            .insert(payload)
            .select('*')
            .single();

          if (error) {
            console.error('❌ Trip insert error:', error);
            throw error;
          }

          console.log('✅ Trip created successfully:', data);
          showToast('Trip created successfully', 'success');
          document.getElementById('newTripModal').hidden = true;
          await loadTripsAdminData();
          
        } catch (err) {
          console.error('❌ Create trip failed:', err);
          showToast(err.message || 'Failed to create trip', 'error');
        }
      };
    }

    const modal = document.getElementById('newTripModal');
    if (modal) modal.hidden = false;
  } catch (e) {
    console.error('openNewTripModal failed', e);
    showToast('Failed to open New Trip', 'error');
  }
}

// =====================================================
// HOTELS MANAGEMENT (mirrors Trips)
// =====================================================

// =====================================================
// HOTEL CITIES MANAGEMENT
// =====================================================
let hotelCitiesCache = [];

async function loadHotelCities() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data, error } = await client
      .from('hotel_cities')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.warn('Failed to load hotel cities from DB, using fallback:', error);
      // Fallback to hardcoded cities
      hotelCitiesCache = [
        { name: 'Larnaca' },
        { name: 'Paphos' },
        { name: 'Limassol' },
        { name: 'Ayia Napa' },
        { name: 'Nicosia' }
      ];
    } else {
      hotelCitiesCache = data || [];
      console.log('✅ Hotel cities loaded:', hotelCitiesCache.length);
    }
    
    populateHotelCitySelects();
  } catch (e) {
    console.error('Failed to load hotel cities:', e);
    hotelCitiesCache = [
      { name: 'Larnaca' },
      { name: 'Paphos' },
      { name: 'Limassol' },
      { name: 'Ayia Napa' },
      { name: 'Nicosia' }
    ];
    populateHotelCitySelects();
  }
}

function populateHotelCitySelects(selectedValue = null) {
  const selectIds = ['newHotelCity', 'editHotelCity'];
  
  selectIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentValue = selectedValue || select.value;
    
    select.innerHTML = hotelCitiesCache.map(city => 
      `<option value="${escapeHtml(city.name)}">${escapeHtml(city.name)}</option>`
    ).join('');
    
    // Restore selected value if exists
    if (currentValue) {
      const option = Array.from(select.options).find(o => o.value === currentValue);
      if (option) {
        select.value = currentValue;
      }
    }
  });
}

function openAddCityModal() {
  const modal = document.getElementById('addCityModal');
  const form = document.getElementById('addCityForm');
  
  if (!modal || !form) {
    // Fallback to prompt if modal doesn't exist
    const cityName = prompt('Enter new city name:');
    if (cityName && cityName.trim()) {
      addNewHotelCity(cityName.trim());
    }
    return;
  }
  
  form.reset();
  modal.hidden = false;
  setTimeout(() => document.getElementById('newCityName')?.focus(), 100);
}

async function addNewHotelCity(name, namePl = null) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Check if city already exists
    const exists = hotelCitiesCache.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      showToast(`City "${name}" already exists`, 'warning');
      return;
    }
    
    const payload = {
      name: name.trim(),
      name_en: name.trim(),
      name_pl: namePl?.trim() || name.trim(),
      display_order: hotelCitiesCache.length + 1,
      is_active: true
    };
    
    const { error } = await client
      .from('hotel_cities')
      .insert(payload);
    
    if (error) throw error;
    
    showToast(`City "${name}" added successfully`, 'success');
    
    // Reload cities and update selects
    await loadHotelCities();
    
    // Select the new city in the active form
    populateHotelCitySelects(name);
    
    // Close modal if open
    const modal = document.getElementById('addCityModal');
    if (modal) modal.hidden = true;
    
  } catch (e) {
    console.error('Failed to add city:', e);
    showToast('Failed to add city: ' + (e.message || 'Unknown error'), 'error');
  }
}

// Form handler for Add City modal
function setupAddCityForm() {
  const form = document.getElementById('addCityForm');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('newCityName')?.value?.trim();
    const namePl = document.getElementById('newCityNamePl')?.value?.trim();
    
    if (!name) {
      showToast('City name is required', 'error');
      return;
    }
    
    await addNewHotelCity(name, namePl || null);
  });
}

// Export functions globally
window.openAddCityModal = openAddCityModal;
window.addNewHotelCity = addNewHotelCity;

// =====================================================
// HOTEL AMENITIES MANAGEMENT
// =====================================================
let hotelAmenitiesCache = [];

const AMENITY_CATEGORY_LABELS = {
  general: { label: 'General', icon: '🏨' },
  wellness: { label: 'Wellness & Spa', icon: '💆' },
  food: { label: 'Food & Drink', icon: '🍽️' },
  room: { label: 'Room Features', icon: '🛏️' },
  outdoor: { label: 'Outdoor', icon: '🌳' },
  services: { label: 'Services', icon: '🛎️' }
};

async function loadHotelAmenities() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data, error } = await client
      .from('hotel_amenities')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      console.warn('Failed to load hotel amenities:', error);
      hotelAmenitiesCache = [];
    } else {
      hotelAmenitiesCache = data || [];
      console.log('✅ Hotel amenities loaded:', hotelAmenitiesCache.length);
    }
  } catch (e) {
    console.error('Failed to load hotel amenities:', e);
    hotelAmenitiesCache = [];
  }
}

function renderAmenitiesCheckboxes(containerId, selectedCodes = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!hotelAmenitiesCache.length) {
    container.innerHTML = '<div class="table-loading">No amenities available</div>';
    return;
  }
  
  // Group by category
  const categories = {};
  hotelAmenitiesCache.forEach(a => {
    if (!categories[a.category]) categories[a.category] = [];
    categories[a.category].push(a);
  });
  
  // Order categories
  const categoryOrder = ['general', 'wellness', 'food', 'room', 'outdoor', 'services'];
  
  let html = '';
  categoryOrder.forEach(cat => {
    const items = categories[cat];
    if (!items || !items.length) return;
    
    const catInfo = AMENITY_CATEGORY_LABELS[cat] || { label: cat, icon: '📍' };
    
    html += `
      <div class="amenity-category">
        <div class="amenity-category-header">
          <span class="category-icon">${catInfo.icon}</span>
          ${catInfo.label}
        </div>
        <div class="amenity-items">
          ${items.map(a => `
            <label class="amenity-checkbox">
              <input type="checkbox" name="amenities" value="${escapeHtml(a.code)}" 
                ${selectedCodes.includes(a.code) ? 'checked' : ''}>
              <span>${a.icon} ${escapeHtml(a.name_en)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function collectSelectedAmenities(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const checked = container.querySelectorAll('input[name="amenities"]:checked');
  return Array.from(checked).map(cb => cb.value);
}

function openAddAmenityModal() {
  const modal = document.getElementById('addAmenityModal');
  const form = document.getElementById('addAmenityForm');
  if (!modal || !form) return;
  
  form.reset();
  modal.hidden = false;
  setTimeout(() => document.getElementById('newAmenityCode')?.focus(), 100);
}

async function addNewAmenity(data) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database not available');
    
    // Check if code already exists
    const exists = hotelAmenitiesCache.find(a => a.code === data.code);
    if (exists) {
      showToast(`Amenity with code "${data.code}" already exists`, 'warning');
      return false;
    }
    
    const payload = {
      code: data.code.toLowerCase().replace(/[^a-z_]/g, ''),
      category: data.category,
      icon: data.icon,
      name_en: data.name_en,
      name_pl: data.name_pl,
      display_order: hotelAmenitiesCache.length + 1,
      is_popular: data.is_popular || false,
      is_active: true
    };
    
    const { error } = await client
      .from('hotel_amenities')
      .insert(payload);
    
    if (error) throw error;
    
    showToast(`Amenity "${data.name_en}" added successfully`, 'success');
    
    // Reload amenities
    await loadHotelAmenities();
    
    // Re-render checkboxes in both forms
    renderAmenitiesCheckboxes('newHotelAmenities', collectSelectedAmenities('newHotelAmenities'));
    renderAmenitiesCheckboxes('editHotelAmenities', collectSelectedAmenities('editHotelAmenities'));
    
    return true;
  } catch (e) {
    console.error('Failed to add amenity:', e);
    showToast('Failed to add amenity: ' + (e.message || 'Unknown error'), 'error');
    return false;
  }
}

function setupAddAmenityForm() {
  const form = document.getElementById('addAmenityForm');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      code: document.getElementById('newAmenityCode')?.value?.trim(),
      category: document.getElementById('newAmenityCategory')?.value,
      icon: document.getElementById('newAmenityIcon')?.value?.trim(),
      name_en: document.getElementById('newAmenityNameEn')?.value?.trim(),
      name_pl: document.getElementById('newAmenityNamePl')?.value?.trim(),
      is_popular: document.getElementById('newAmenityPopular')?.checked || false
    };
    
    if (!data.code || !data.name_en || !data.name_pl || !data.icon) {
      showToast('All fields are required', 'error');
      return;
    }
    
    const success = await addNewAmenity(data);
    if (success) {
      document.getElementById('addAmenityModal').hidden = true;
    }
  });
}

// Export amenity functions globally
window.openAddAmenityModal = openAddAmenityModal;
window.addNewAmenity = addNewAmenity;

// =====================================================
// HOTEL PHOTO MANAGER
// =====================================================

// =====================================================
// POI PHOTO MANAGER
// =====================================================

let poiPhotosState = {
  photos: [],
  coverUrl: '',
};

function renderPoiPhotoManager() {
  const container = document.getElementById('poiPhotosManager');
  const countEl = document.getElementById('poiPhotosCount');
  const coverImg = document.getElementById('poiCoverPreviewImg');
  const coverUrlInput = document.getElementById('poiMainImageUrl');
  if (countEl) countEl.textContent = String(poiPhotosState.photos.length);
  if (coverImg) {
    coverImg.src = poiPhotosState.coverUrl || '';
    coverImg.style.display = poiPhotosState.coverUrl ? 'block' : 'none';
  }
  if (coverUrlInput) {
    coverUrlInput.value = poiPhotosState.coverUrl || '';
  }
  if (!container) return;
  if (!poiPhotosState.photos.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = poiPhotosState.photos
    .map((url, index) => {
      const isCover = url === poiPhotosState.coverUrl;
      return `
        <div class="photo-item ${isCover ? 'is-cover' : ''}" data-index="${index}">
          <img src="${escapeHtml(url)}" alt="Photo ${index + 1}" loading="lazy">
          <div class="photo-actions">
            <button type="button" onclick="movePoiPhoto(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move left">◀</button>
            <button type="button" onclick="movePoiPhoto(${index}, 1)" ${index === poiPhotosState.photos.length - 1 ? 'disabled' : ''} title="Move right">▶</button>
            <button type="button" class="btn-cover" onclick="setPoiAsCoverImage(${index})" title="Set as cover">⭐</button>
            <button type="button" class="btn-delete" onclick="deletePoiPhoto(${index})" title="Delete">✕</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function movePoiPhoto(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= poiPhotosState.photos.length) return;
  const tmp = poiPhotosState.photos[index];
  poiPhotosState.photos[index] = poiPhotosState.photos[newIndex];
  poiPhotosState.photos[newIndex] = tmp;
  renderPoiPhotoManager();
}

function deletePoiPhoto(index) {
  const deletedUrl = poiPhotosState.photos[index];
  poiPhotosState.photos.splice(index, 1);
  if (deletedUrl === poiPhotosState.coverUrl) {
    poiPhotosState.coverUrl = poiPhotosState.photos[0] || '';
  }
  renderPoiPhotoManager();
}

function setPoiAsCoverImage(index) {
  poiPhotosState.coverUrl = poiPhotosState.photos[index] || '';
  const mainInput = document.getElementById('poiMainImageUrl');
  if (mainInput) mainInput.value = poiPhotosState.coverUrl;
  renderPoiPhotoManager();
  showToast('Cover image updated', 'success');
}

function removePoiCoverImage() {
  poiPhotosState.coverUrl = '';
  const mainInput = document.getElementById('poiMainImageUrl');
  if (mainInput) mainInput.value = '';
  renderPoiPhotoManager();
}

async function uploadPoiImage(file, poiSlug, kind) {
  if (!file || !file.type || !file.type.startsWith('image/')) return '';
  const client = ensureSupabase();
  if (!client) throw new Error('Database connection not available');
  const compressed = await compressToWebp(file, 1920, 1080, 0.82);
  const safeSlug = String(poiSlug || 'poi').trim() || 'poi';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `pois/${safeSlug}/${kind}-${suffix}.webp`;
  const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/webp',
  });
  if (error) throw error;
  const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
  return pub?.publicUrl || '';
}

async function handlePoiCoverFileUpload(file, poiSlug) {
  try {
    const url = await uploadPoiImage(file, poiSlug, 'cover');
    if (url) {
      poiPhotosState.coverUrl = url;
      if (!poiPhotosState.photos.includes(url)) poiPhotosState.photos.unshift(url);
      renderPoiPhotoManager();
    }
  } catch (e) {
    console.error('POI cover upload failed:', e);
    showToast('Failed to upload cover image', 'error');
  }
}

async function handlePoiPhotosUpload(files, poiSlug) {
  const maxPhotos = 10;
  const available = maxPhotos - poiPhotosState.photos.length;
  if (available <= 0) {
    showToast('Maximum 10 photos allowed', 'warning');
    return;
  }
  const list = Array.from(files || []).slice(0, available);
  if (!list.length) return;
  try {
    for (const f of list) {
      if (!f || !f.type || !f.type.startsWith('image/')) continue;
      const url = await uploadPoiImage(f, poiSlug, 'photo');
      if (url) {
        poiPhotosState.photos.push(url);
        if (!poiPhotosState.coverUrl) poiPhotosState.coverUrl = url;
      }
    }
    renderPoiPhotoManager();
    showToast(`${list.length} photo(s) uploaded`, 'success');
  } catch (e) {
    console.error('POI photos upload failed:', e);
    showToast('Failed to upload photos', 'error');
  }
}

function setupPoiPhotoManagerBindings(poiSlug) {
  const coverFileInput = document.getElementById('poiCoverFile');
  const photosAddInput = document.getElementById('poiPhotosAdd');
  const mainUrlInput = document.getElementById('poiMainImageUrl');
  if (coverFileInput) {
    coverFileInput.onchange = async () => {
      const file = coverFileInput.files?.[0];
      if (file) {
        showToast('Uploading cover...', 'info');
        await handlePoiCoverFileUpload(file, poiSlug);
      }
      coverFileInput.value = '';
    };
  }
  if (photosAddInput) {
    photosAddInput.onchange = async () => {
      const files = photosAddInput.files;
      if (files?.length) {
        showToast('Uploading photos...', 'info');
        await handlePoiPhotosUpload(files, poiSlug);
      }
      photosAddInput.value = '';
    };
  }
  if (mainUrlInput) {
    mainUrlInput.oninput = () => {
      poiPhotosState.coverUrl = (mainUrlInput.value || '').trim();
      if (poiPhotosState.coverUrl && !poiPhotosState.photos.includes(poiPhotosState.coverUrl)) {
        poiPhotosState.photos.unshift(poiPhotosState.coverUrl);
      }
      renderPoiPhotoManager();
    };
  }
}

window.movePoiPhoto = movePoiPhoto;
window.deletePoiPhoto = deletePoiPhoto;
window.setPoiAsCoverImage = setPoiAsCoverImage;
window.removePoiCoverImage = removePoiCoverImage;

// Local state for photo management
let editHotelPhotosState = {
  photos: [],
  coverUrl: '',
  pendingUploads: []
};

let newHotelPhotosState = {
  photos: [],
  coverUrl: '',
  pendingUploads: []
};

function getPhotoState(formType) {
  return formType === 'edit' ? editHotelPhotosState : newHotelPhotosState;
}

function renderPhotoManager(formType) {
  const state = getPhotoState(formType);
  const containerId = formType === 'edit' ? 'editHotelPhotosManager' : 'newHotelPhotosManager';
  const countId = formType === 'edit' ? 'editHotelPhotosCount' : 'newHotelPhotosCount';
  const coverImgId = formType === 'edit' ? 'editHotelCoverPreviewImg' : 'newHotelCoverPreviewImg';
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  
  const container = document.getElementById(containerId);
  const countEl = document.getElementById(countId);
  const coverImg = document.getElementById(coverImgId);
  const coverUrlInput = document.getElementById(coverUrlId);
  
  if (!container) return;
  
  // Update count
  if (countEl) countEl.textContent = state.photos.length;
  
  // Update cover preview
  if (coverImg) {
    coverImg.src = state.coverUrl || '';
    coverImg.style.display = state.coverUrl ? 'block' : 'none';
  }
  if (coverUrlInput && state.coverUrl) {
    coverUrlInput.value = state.coverUrl;
  }
  
  // Render photo grid
  if (!state.photos.length) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = state.photos.map((url, index) => {
    const isCover = url === state.coverUrl;
    return `
      <div class="photo-item ${isCover ? 'is-cover' : ''}" data-index="${index}">
        <img src="${escapeHtml(url)}" alt="Photo ${index + 1}" loading="lazy">
        <div class="photo-actions">
          <button type="button" onclick="moveHotelPhoto('${formType}', ${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Move left">◀</button>
          <button type="button" onclick="moveHotelPhoto('${formType}', ${index}, 1)" ${index === state.photos.length - 1 ? 'disabled' : ''} title="Move right">▶</button>
          <button type="button" class="btn-cover" onclick="setAsCoverImage('${formType}', ${index})" title="Set as cover">⭐</button>
          <button type="button" class="btn-delete" onclick="deleteHotelPhoto('${formType}', ${index})" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function moveHotelPhoto(formType, index, direction) {
  const state = getPhotoState(formType);
  const newIndex = index + direction;
  
  if (newIndex < 0 || newIndex >= state.photos.length) return;
  
  // Swap
  const temp = state.photos[index];
  state.photos[index] = state.photos[newIndex];
  state.photos[newIndex] = temp;
  
  renderPhotoManager(formType);
}

function deleteHotelPhoto(formType, index) {
  const state = getPhotoState(formType);
  const deletedUrl = state.photos[index];
  
  state.photos.splice(index, 1);
  
  // If deleted photo was cover, reset cover
  if (deletedUrl === state.coverUrl) {
    state.coverUrl = state.photos[0] || '';
  }
  
  renderPhotoManager(formType);
}

function setAsCoverImage(formType, index) {
  const state = getPhotoState(formType);
  state.coverUrl = state.photos[index];
  
  // Also update the URL input
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  const coverUrlInput = document.getElementById(coverUrlId);
  if (coverUrlInput) coverUrlInput.value = state.coverUrl;
  
  renderPhotoManager(formType);
  showToast('Cover image updated', 'success');
}

function removeCoverImage(formType) {
  const state = getPhotoState(formType);
  state.coverUrl = '';
  
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  const coverUrlInput = document.getElementById(coverUrlId);
  if (coverUrlInput) coverUrlInput.value = '';
  
  renderPhotoManager(formType);
}

async function handleCoverFileUpload(formType, file, hotelSlug) {
  if (!file || !file.type.startsWith('image/')) return null;
  
  const state = getPhotoState(formType);
  
  try {
    const client = ensureSupabase();
    const compressed = await compressToWebp(file, 1920, 1080, 0.82);
    const path = `hotels/${hotelSlug}/cover-${Date.now()}.webp`;
    
    const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp'
    });
    
    if (error) throw error;
    
    const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
    const url = pub?.publicUrl || '';
    
    state.coverUrl = url;
    renderPhotoManager(formType);
    
    return url;
  } catch (e) {
    console.error('Cover upload failed:', e);
    showToast('Failed to upload cover image', 'error');
    return null;
  }
}

async function handlePhotosUpload(formType, files, hotelSlug) {
  const state = getPhotoState(formType);
  const maxPhotos = 10;
  const available = maxPhotos - state.photos.length;
  
  if (available <= 0) {
    showToast('Maximum 10 photos allowed', 'warning');
    return;
  }
  
  const filesToUpload = Array.from(files).slice(0, available);
  
  try {
    const client = ensureSupabase();
    
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) continue;
      
      const compressed = await compressToWebp(file, 1920, 1080, 0.82);
      const path = `hotels/${hotelSlug}/photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webp`;
      
      const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp'
      });
      
      if (error) {
        console.error('Photo upload failed:', error);
        continue;
      }
      
      const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
      const url = pub?.publicUrl || '';
      
      if (url) {
        state.photos.push(url);
        
        // Set as cover if no cover yet
        if (!state.coverUrl) {
          state.coverUrl = url;
        }
      }
    }
    
    renderPhotoManager(formType);
    showToast(`${filesToUpload.length} photo(s) uploaded`, 'success');
    
  } catch (e) {
    console.error('Photos upload failed:', e);
    showToast('Failed to upload photos', 'error');
  }
}

function setupPhotoManagerBindings(formType, hotelSlug) {
  const coverFileId = formType === 'edit' ? 'editHotelCoverFile' : 'newHotelCoverFile';
  const photosAddId = formType === 'edit' ? 'editHotelPhotosAdd' : 'newHotelPhotosAdd';
  const coverUrlId = formType === 'edit' ? 'editHotelCoverUrl' : 'newHotelCoverUrl';
  
  const coverFileInput = document.getElementById(coverFileId);
  const photosAddInput = document.getElementById(photosAddId);
  const coverUrlInput = document.getElementById(coverUrlId);
  
  // Cover file upload
  if (coverFileInput) {
    coverFileInput.onchange = async () => {
      const file = coverFileInput.files?.[0];
      if (file) {
        showToast('Uploading cover...', 'info');
        await handleCoverFileUpload(formType, file, hotelSlug);
      }
      coverFileInput.value = '';
    };
  }
  
  // Photos upload
  if (photosAddInput) {
    photosAddInput.onchange = async () => {
      const files = photosAddInput.files;
      if (files?.length) {
        showToast('Uploading photos...', 'info');
        await handlePhotosUpload(formType, files, hotelSlug);
      }
      photosAddInput.value = '';
    };
  }
  
  // Cover URL input
  if (coverUrlInput) {
    coverUrlInput.oninput = () => {
      const state = getPhotoState(formType);
      state.coverUrl = coverUrlInput.value.trim();
      renderPhotoManager(formType);
    };
  }
}

// Export photo manager functions
window.moveHotelPhoto = moveHotelPhoto;
window.deleteHotelPhoto = deleteHotelPhoto;
window.setAsCoverImage = setAsCoverImage;
window.removeCoverImage = removeCoverImage;

async function loadHotelsAdminData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    // Load cities and amenities first
    await loadHotelCities();
    await loadHotelAmenities();
    setupAddCityForm();
    setupAddAmenityForm();

    const { data: hotels, error } = await client
      .from('hotels')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Store list globally for reordering helpers
    window.hotelsAdminList = Array.isArray(hotels) ? hotels.slice() : [];

    const total = window.hotelsAdminList?.length || 0;
    const published = (window.hotelsAdminList || []).filter(h => h.is_published).length;
    const statTotal = document.getElementById('hotelsStatTotal');
    const statPub = document.getElementById('hotelsStatPublished');
    const sub = document.getElementById('hotelsStatSubtitle');
    if (statTotal) statTotal.textContent = total;
    if (statPub) statPub.textContent = published;
    if (sub) sub.textContent = total ? `${published} published` : 'No hotels yet';

    const tbody = document.getElementById('hotelsTableBody');
    if (!tbody) return;
    if (!window.hotelsAdminList || window.hotelsAdminList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No hotels found</td></tr>';
      return;
    }

    function formatHotelPriceSummary(h) {
      try {
        const tiers = h.pricing_tiers && h.pricing_tiers.rules ? h.pricing_tiers.rules : [];
        if (!tiers || tiers.length === 0) return '-';
        // prefer price for 2 persons, otherwise min price
        const by2 = tiers.find(t => Number(t.persons) === 2 && t.price_per_night != null);
        const price = by2 ? Number(by2.price_per_night) : Math.min(...tiers.map(t => Number(t.price_per_night || Infinity)));
        if (!isFinite(price)) return '-';
        return `€${price.toFixed(2)}/night`;
      } catch (_) { return '-'; }
    }

    tbody.innerHTML = window.hotelsAdminList.map((h, index) => {
      const title = (h.title && (h.title.pl || h.title.en)) || h.slug || h.id;
      const updated = h.updated_at ? new Date(h.updated_at).toLocaleString('en-GB') : '-';
      const priceSummary = formatHotelPriceSummary(h);
      const sortOrder = typeof h.sort_order === 'number' ? h.sort_order : (index + 1);
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(title)}</div>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--admin-text-muted);">#${index + 1}</span>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <button type="button" title="Move up" onclick="moveHotelOrder('${h.id}','up')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▲</button>
                <button type="button" title="Move down" onclick="moveHotelOrder('${h.id}','down')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▼</button>
              </div>
              <span style="font-size:10px;color:var(--admin-text-muted);">${sortOrder}</span>
            </div>
          </td>
          <td>${escapeHtml(h.slug || '')}</td>
          <td>${escapeHtml(h.city || '')}</td>
          <td>${escapeHtml(priceSummary)}</td>
          <td>
            <label class="admin-switch" title="Toggle publish">
              <input type="checkbox" ${h.is_published ? 'checked' : ''} onchange="toggleHotelPublish('${h.id}', this.checked)">
              <span></span>
            </label>
          </td>
          <td>${updated}</td>
          <td style="display:flex;gap:8px;">
            <button class="btn-primary" onclick="editHotel('${h.id}')">Edit</button>
            <a class="btn-secondary" href="/hotel.html?slug=${encodeURIComponent(h.slug)}" target="_blank">Preview</a>
            <button class="btn-danger" onclick="deleteHotelResource('${h.id}', '${escapeHtml(String(title)).replace(/'/g, "\\'")}')">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    const addBtn = document.getElementById('btnAddHotel');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.addEventListener('click', openNewHotelModal);
      addBtn.dataset.bound = '1';
    }

    showToast('Hotels loaded', 'success');
  } catch (e) {
    console.error('Failed to load hotels:', e);
    showToast('Failed to load hotels: ' + (e.message || 'Unknown error'), 'error');
    const tbody = document.getElementById('hotelsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="table-loading" style="color:var(--admin-danger)">Error: ${escapeHtml(e.message||'')}</td></tr>`;
  }
}

async function moveHotelOrder(hotelId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.hotelsAdminList) ? window.hotelsAdminList : [];
    const index = list.findIndex(h => h.id === hotelId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    const { error: err1 } = await client
      .from('hotels')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('hotels')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Hotel order updated', 'success');
    await loadHotelsAdminData();
  } catch (e) {
    console.error('Failed to update hotel order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function toggleHotelPublish(hotelId, publish) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client
      .from('hotels')
      .update({ is_published: !!publish, updated_at: new Date().toISOString() })
      .eq('id', hotelId);
    if (error) throw error;
    showToast(publish ? 'Hotel published' : 'Hotel unpublished', 'success');
    await loadHotelsAdminData();
  } catch (e) {
    console.error('Publish toggle failed:', e);
    showToast('Failed to update publish state', 'error');
  }
}

async function editHotel(hotelId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data: hotel, error } = await client
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (error) throw error;

    const modal = document.getElementById('editHotelModal');
    const form = document.getElementById('editHotelForm');
    if (!modal || !form) return;

    document.getElementById('editHotelId').value = hotel.id;
    document.getElementById('editHotelSlug').value = hotel.slug || '';
    
    // Ensure cities are loaded and set the value
    if (hotelCitiesCache.length === 0) {
      await loadHotelCities();
    }
    const citySelect = document.getElementById('editHotelCity');
    if (citySelect && hotel.city) {
      // Ensure city exists in options, if not add it temporarily
      const cityExists = Array.from(citySelect.options).find(o => o.value === hotel.city);
      if (!cityExists) {
        const opt = document.createElement('option');
        opt.value = hotel.city;
        opt.textContent = hotel.city;
        citySelect.appendChild(opt);
      }
      citySelect.value = hotel.city;
    }
    
    // Render i18n inputs for Title
    const titleContainer = document.getElementById('editHotelTitleI18n');
    if (titleContainer && typeof window.renderI18nInput === 'function') {
      titleContainer.innerHTML = window.renderI18nInput({
        fieldName: 'title',
        label: 'Title',
        type: 'text',
        currentValues: hotel.title || {},
        placeholder: 'Hotel title'
      });
    }
    
    // Render i18n inputs for Description
    const descContainer = document.getElementById('editHotelDescriptionI18n');
    if (descContainer && typeof window.renderI18nInput === 'function') {
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        currentValues: hotel.description || {},
        placeholder: 'Hotel description',
        rows: 4
      });
    }
    
    document.getElementById('editHotelCoverUrl').value = hotel.cover_image_url || '';
    document.getElementById('editHotelPricing').value = hotel.pricing_model || 'per_person_per_night';
    document.getElementById('editHotelPublished').checked = !!hotel.is_published;

    const previewWrap = document.getElementById('editHotelCoverPreview');
    const previewImg = previewWrap ? previewWrap.querySelector('img') : null;
    if (hotel.cover_image_url && previewImg) {
      previewImg.src = hotel.cover_image_url;
      previewWrap.style.display = '';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }

    const urlInput = document.getElementById('editHotelCoverUrl');
    if (urlInput && previewWrap && previewImg) {
      urlInput.oninput = () => {
        const url = (urlInput.value || '').trim();
        if (url) {
          previewImg.src = url;
          previewWrap.style.display = '';
        } else {
          previewWrap.style.display = 'none';
        }
      };
    }

    // Pricing tiers populate
    renderPricingTiers('editHotelPricingTiersBody', hotel.pricing_tiers && hotel.pricing_tiers.rules ? hotel.pricing_tiers.rules : []);
    const btnAddEditTier = document.getElementById('btnAddEditHotelTier');
    if (btnAddEditTier && btnAddEditTier.dataset.boundFor !== hotel.id) {
      btnAddEditTier.addEventListener('click', () => addPricingTierRow('editHotelPricingTiersBody'));
      btnAddEditTier.dataset.boundFor = hotel.id;
    }

    // Max persons
    const maxPersonsEl = document.getElementById('editHotelMaxPersons');
    if (maxPersonsEl) {
      maxPersonsEl.value = hotel.max_persons != null ? Number(hotel.max_persons) : '';
    }

    // Initialize photo manager state
    editHotelPhotosState.photos = Array.isArray(hotel.photos) ? hotel.photos.slice() : [];
    editHotelPhotosState.coverUrl = hotel.cover_image_url || '';
    
    // Setup bindings and render
    setupPhotoManagerBindings('edit', hotel.slug);
    renderPhotoManager('edit');

    // Render amenities checkboxes with currently selected values
    const hotelAmenities = Array.isArray(hotel.amenities) ? hotel.amenities : [];
    renderAmenitiesCheckboxes('editHotelAmenities', hotelAmenities);

    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleEditHotelSubmit(e, hotel);
    };

    modal.hidden = false;
  } catch (e) {
    console.error('Failed to open edit hotel modal:', e);
    showToast('Failed to load hotel for editing', 'error');
  }
}

async function handleEditHotelSubmit(event, originalHotel) {
  event.preventDefault();
  console.log('📝 Hotel edit form submitted');
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const form = event.target;
    const fd = new FormData(form);
    
    console.log('📋 FormData entries:');
    for (let [key, value] of fd.entries()) {
      if (key.includes('title') || key.includes('description')) {
        console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      }
    }
    
    const payload = Object.fromEntries(fd.entries());

    // Extract i18n values
    console.log('🔧 Checking i18n functions:', {
      extractI18nValues: typeof window.extractI18nValues,
      validateI18nField: typeof window.validateI18nField
    });
    
    const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
    const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
    
    console.log('🔍 Hotel i18n extracted:', { titleI18n, descriptionI18n });
    
    // Validate required fields (PL and EN)
    if (window.validateI18nField) {
      const titleError = window.validateI18nField(titleI18n, 'Title');
      if (titleError) {
        console.error('❌ Validation error:', titleError);
        throw new Error(titleError);
      }
    }
    
    // Assign i18n fields
    if (titleI18n) payload.title = titleI18n;
    if (descriptionI18n) payload.description = descriptionI18n;
    
    // Clean up legacy fields from payload
    delete payload.title_pl;
    delete payload.title_en;
    delete payload.title_el;
    delete payload.title_he;
    delete payload.description_pl;
    delete payload.description_en;
    delete payload.description_el;
    delete payload.description_he;

    payload.is_published = form.querySelector('#editHotelPublished').checked;
    payload.updated_at = new Date().toISOString();

    const hotelId = document.getElementById('editHotelId').value;

    // pricing tiers
    payload.pricing_tiers = collectPricingTiers('editHotelPricingTiersBody');

    // max persons
    const maxP = document.getElementById('editHotelMaxPersons');
    if (maxP && maxP.value) {
      const v = Number(maxP.value);
      payload.max_persons = Number.isFinite(v) && v > 0 ? v : null;
    } else {
      payload.max_persons = null;
    }

    // Collect amenities
    payload.amenities = collectSelectedAmenities('editHotelAmenities');

    // Get photos and cover from state
    payload.photos = editHotelPhotosState.photos.slice(0, 10);
    payload.cover_image_url = editHotelPhotosState.coverUrl || null;

    console.log('💾 Updating hotel with payload:', {
      hotelId,
      title: payload.title,
      description: payload.description,
      slug: payload.slug
    });

    const { error } = await client
      .from('hotels')
      .update(payload)
      .eq('id', hotelId);

    if (error) {
      console.error('❌ Hotel update error:', error);
      throw error;
    }
    
    console.log('✅ Hotel updated successfully');

    showToast('Hotel updated successfully', 'success');
    document.getElementById('editHotelModal').hidden = true;
    await loadHotelsAdminData();
  } catch (err) {
    console.error('Failed to update hotel:', err);
    showToast(err.message || 'Failed to update hotel', 'error');
  }
}

function slugifyHotelTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `hotel-${Date.now()}`;
}

async function openNewHotelModal() {
  try {
    const form = document.getElementById('newHotelForm');
    if (form) {
      form.reset();
      
      // Render i18n inputs for Title
      const newTitleContainer = document.getElementById('newHotelTitleI18n');
      if (newTitleContainer && typeof window.renderI18nInput === 'function') {
        newTitleContainer.innerHTML = window.renderI18nInput({
          fieldName: 'title',
          label: 'Title',
          type: 'text',
          currentValues: {},
          placeholder: 'Hotel title'
        });
      }
      
      // Render i18n inputs for Description
      const newDescContainer = document.getElementById('newHotelDescriptionI18n');
      if (newDescContainer && typeof window.renderI18nInput === 'function') {
        newDescContainer.innerHTML = window.renderI18nInput({
          fieldName: 'description',
          label: 'Description',
          type: 'textarea',
          currentValues: {},
          placeholder: 'Hotel description',
          rows: 3
        });
      }

      // Initialize photo manager state for new hotel
      newHotelPhotosState.photos = [];
      newHotelPhotosState.coverUrl = '';
      
      // Note: bindings will be set up after slug is generated in form submit
      // For now, just render empty state
      renderPhotoManager('new');

      // Pricing tiers editor init
      renderPricingTiers('newHotelPricingTiersBody', []);
      const btnAddNewTier = document.getElementById('btnAddNewHotelTier');
      if (btnAddNewTier && !btnAddNewTier.dataset.bound) {
        btnAddNewTier.addEventListener('click', () => addPricingTierRow('newHotelPricingTiersBody'));
        btnAddNewTier.dataset.bound = '1';
      }
      
      // Setup temporary slug for uploads (will be updated)
      const tempSlug = `new-hotel-${Date.now()}`;
      setupPhotoManagerBindings('new', tempSlug);

      form.onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const fd = new FormData(form);
          const payload = Object.fromEntries(fd.entries());

          // Extract i18n values
          const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
          const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
          
          console.log('🔍 New Hotel i18n extracted:', { titleI18n, descriptionI18n });
          
          // Validate required fields (PL and EN)
          if (window.validateI18nField) {
            const titleError = window.validateI18nField(titleI18n, 'Title');
            if (titleError) {
              console.error('❌ Validation error:', titleError);
              throw new Error(titleError);
            }
          }
          
          // Assign i18n fields
          if (titleI18n) payload.title = titleI18n;
          if (descriptionI18n) payload.description = descriptionI18n;
          
          // Clean up legacy fields from payload
          delete payload.title_pl;
          delete payload.title_en;
          delete payload.title_el;
          delete payload.title_he;
          delete payload.description_pl;
          delete payload.description_en;
          delete payload.description_el;
          delete payload.description_he;
          
          // Generate slug from Polish title (fallback to English)
          const slugSource = titleI18n?.pl || titleI18n?.en || `hotel-${Date.now()}`;
          payload.slug = slugifyHotelTitle(slugSource);

          // Get photos and cover from state (already uploaded via photo manager)
          payload.photos = newHotelPhotosState.photos.slice(0, 10);
          payload.cover_image_url = newHotelPhotosState.coverUrl || null;

          // pricing tiers
          payload.pricing_tiers = collectPricingTiers('newHotelPricingTiersBody');

          // max persons
          const maxPNew = document.getElementById('newHotelMaxPersons');
          if (maxPNew && maxPNew.value) {
            const v = Number(maxPNew.value);
            payload.max_persons = Number.isFinite(v) && v > 0 ? v : null;
          }

          // Collect amenities
          payload.amenities = collectSelectedAmenities('newHotelAmenities');

          const now = new Date().toISOString();
          payload.created_at = now;
          payload.updated_at = now;
          payload.is_published = false;

          console.log('💾 Creating new hotel with payload:', {
            slug: payload.slug,
            title: payload.title,
            description: payload.description
          });

          const { data, error } = await client
            .from('hotels')
            .insert(payload)
            .select('*')
            .single();

          if (error) {
            console.error('❌ Hotel insert error:', error);
            throw error;
          }
          
          console.log('✅ Hotel created successfully:', data);

          showToast('Hotel created successfully', 'success');
          document.getElementById('newHotelModal').hidden = true;
          await loadHotelsAdminData();
        } catch (err) {
          console.error('Create hotel failed:', err);
          showToast(err.message || 'Failed to create hotel', 'error');
        }
      };
    }

    // Render amenities checkboxes
    renderAmenitiesCheckboxes('newHotelAmenities', []);

    const modal = document.getElementById('newHotelModal');
    if (modal) modal.hidden = false;
  } catch (e) {
    console.error('openNewHotelModal failed', e);
    showToast('Failed to open New Hotel', 'error');
  }
}

// =====================================================
// HOTEL BOOKINGS MODULE (mirrors Trip bookings)
// =====================================================

async function loadHotelBookingsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { data: bookings, error } = await client
      .from('hotel_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const totalBookings = bookings?.length || 0;
    const pendingBookings = bookings?.filter(b => b.status === 'pending').length || 0;
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const totalRevenue = bookings
      ?.filter(b => (b.status === 'confirmed' || b.status === 'completed') && b.total_price)
      .reduce((sum, b) => sum + parseFloat(b.total_price), 0) || 0;

    const statTotal = document.getElementById('statHotelBookingsTotal');
    const statPending = document.getElementById('statHotelBookingsPending');
    const statConfirmed = document.getElementById('statHotelBookingsConfirmed');
    const statRevenue = document.getElementById('statHotelBookingsRevenue');

    if (statTotal) statTotal.textContent = totalBookings;
    if (statPending) statPending.textContent = pendingBookings;
    if (statConfirmed) statConfirmed.textContent = confirmedBookings;
    if (statRevenue) statRevenue.textContent = `€${totalRevenue.toFixed(2)}`;

    const tableBody = document.getElementById('hotelBookingsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">
            No hotel bookings yet. System is ready to accept bookings!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      const arr = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : '';
      const dep = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : '';
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${escapeHtml(booking.hotel_slug || 'N/A')}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_email || '')}</div>
            ${booking.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 12px;">
              ${arr && dep ? `🏨 ${arr} - ${dep}` : 'No dates'}
            </div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${booking.num_adults || booking.num_children ? `👥 ${booking.num_adults || 0}+${booking.num_children || 0}` : ''}
              ${booking.nights ? ` 📅 ${booking.nights} night(s)` : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}">${(booking.status || 'unknown').toUpperCase()}</span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            €${Number(booking.total_price || 0).toFixed(2)}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewHotelBookingDetails('${booking.id}')" title="View details">
              View
            </button>
            ${adminState && adminState.isAdmin ? `
            <button class="btn-danger" onclick="deleteHotelBooking('${booking.id}')" title="Delete booking" style="margin-left: 8px;">
              Delete
            </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    showToast('Hotel bookings loaded successfully', 'success');

  } catch (error) {
    console.error('Failed to load hotel bookings:', error);
    showToast('Failed to load hotel bookings: ' + (error.message || 'Unknown error'), 'error');
    const tableBody = document.getElementById('hotelBookingsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the hotel tables exist in Supabase.
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewHotelBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data: booking, error } = await client
      .from('hotel_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      showToast('Failed to load booking details', 'error');
      return;
    }
    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    const modal = document.getElementById('hotelBookingDetailsModal');
    const content = document.getElementById('hotelBookingDetailsContent');
    if (!modal || !content) return;

    const arrivalDate = booking.arrival_date ? new Date(booking.arrival_date).toLocaleDateString('en-GB') : 'N/A';
    const departureDate = booking.departure_date ? new Date(booking.departure_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';

    let fulfillment = null;
    try {
      const { data: fRows } = await client
        .from('partner_service_fulfillments')
        .select('id, status, contact_revealed_at, rejected_reason, partner_id, created_at')
        .eq('resource_type', 'hotels')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(50);
      fulfillment = pickBestServiceFulfillment(fRows || []) || null;
    } catch (_e) {
    }

    const fulfillmentStatus = String(fulfillment?.status || '').trim();
    const fulfillmentPillClass =
      fulfillmentStatus === 'accepted' ? 'badge-success' :
      fulfillmentStatus === 'rejected' ? 'badge-danger' :
      fulfillmentStatus === 'awaiting_payment' ? 'badge-warning' :
      fulfillmentStatus === 'pending_acceptance' ? 'badge-warning' : 'badge';

    const fulfillmentActions = (() => {
      if (!fulfillment || !fulfillment.id) return '';
      if (fulfillmentStatus === 'pending_acceptance') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('hotels','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','accept')">Accept</button>
            <button type="button" class="btn-danger" onclick="adminServiceFulfillmentActionForBooking('hotels','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','reject')">Reject</button>
          </div>
        `;
      }
      if (fulfillmentStatus === 'awaiting_payment') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('hotels','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','mark_paid')">Mark paid</button>
          </div>
        `;
      }
      return '';
    })();

    const fulfillmentHtml = (() => {
      if (!fulfillment || !fulfillment.id) {
        return `
          <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
            <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
              <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
                <div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">No linked fulfillment found for this booking.</div>
              </div>
            </div>
          </div>
        `;
      }

      const extra = fulfillmentStatus === 'rejected' && fulfillment.rejected_reason
        ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Reason: ${escapeHtml(String(fulfillment.rejected_reason))}</div>`
        : (fulfillmentStatus === 'accepted' && fulfillment.contact_revealed_at
          ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Contact revealed</div>`
          : '');

      return `
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
              <div style="margin-top: 6px;">
                <span class="badge ${fulfillmentPillClass}">${escapeHtml(fulfillmentStatus || 'unknown')}</span>
              </div>
              ${extra}
            </div>
            ${fulfillmentActions}
          </div>
        </div>
      `;
    })();
    const canDelete = !!(adminState && adminState.isAdmin);
    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' :
      booking.status === 'completed' ? 'badge-success' : 'badge';

    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Hotel: ${escapeHtml(booking.hotel_slug || 'N/A')}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="hotelBookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateHotelBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.customer_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.customer_email)}">${escapeHtml(booking.customer_email || 'N/A')}</a></span>
            </div>
            ${booking.customer_phone ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.customer_phone)}">${escapeHtml(booking.customer_phone)}</a></span>
            </div>
            ` : ''}
          </div>
        </div>

        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Stay Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Stay:</span>
              <span>🏨 ${arrivalDate} → ${departureDate}</span>
            </div>
            ${booking.num_adults ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Guests:</span>
              <span>👥 ${booking.num_adults} adult(s), ${booking.num_children || 0} child(ren)</span>
            </div>
            ` : ''}
            ${booking.nights ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Nights:</span>
              <span>📅 ${booking.nights}</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Notes:</span>
              <span>${escapeHtml(booking.notes)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Price</h4>
          <div style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: white;">€${Number(booking.total_price || 0).toFixed(2)}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-top: 4px;">Total Price</div>
          </div>
        </div>

        ${fulfillmentHtml}

        <div style="display: flex; gap: 12px;">
          <button type="button" class="btn-secondary" onclick="document.getElementById('hotelBookingDetailsModal').hidden=true" style="flex: 1;">Close</button>
          ${canDelete ? `<button type="button" class="btn-danger" onclick="deleteHotelBooking('${booking.id}')" style="flex: 1;">🗑️ Delete Booking</button>` : ''}
        </div>
      </div>
    `;

    modal.hidden = false;
  } catch (e) {
    console.error('Failed to load hotel booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

async function updateHotelBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const updateData = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'confirmed') updateData.confirmed_at = new Date().toISOString();
    else if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();

    const { error } = await client
      .from('hotel_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;
    showToast(`Status updated to: ${newStatus}`, 'success');
    await loadHotelBookingsData();
    await loadAllOrders({ silent: true });

    const badge = document.querySelector('#hotelBookingDetailsModal .badge');
    if (badge) {
      badge.textContent = newStatus.toUpperCase();
      badge.className = 'badge ' + (
        newStatus === 'confirmed' ? 'badge-success' :
        newStatus === 'pending' ? 'badge-warning' :
        newStatus === 'cancelled' ? 'badge-danger' :
        newStatus === 'completed' ? 'badge-success' : 'badge'
      );
    }
  } catch (e) {
    console.error('Failed to update status:', e);
    showToast('Failed to update status: ' + e.message, 'error');
  }
}

async function deleteHotelBooking(bookingId) {
  if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
    return;
  }
  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'hotels')
        .eq('booking_id', bookingId);
    } catch (_e) {
    }

    const { error } = await client
      .from('hotel_bookings')
      .delete()
      .eq('id', bookingId);
    if (error) throw error;
    showToast('Booking deleted successfully', 'success');
    document.getElementById('hotelBookingDetailsModal').hidden = true;
    await loadHotelBookingsData();
    await loadAllOrders({ silent: true });
  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + e.message, 'error');
  }
}

// Expose for inline handlers
window.toggleHotelPublish = toggleHotelPublish;
window.editHotel = editHotel;
window.openNewHotelModal = openNewHotelModal;
window.viewHotelBookingDetails = viewHotelBookingDetails;
window.moveHotelOrder = moveHotelOrder;
window.updateHotelBookingStatus = updateHotelBookingStatus;
window.deleteHotelBooking = deleteHotelBooking;

async function deletePartnerResourcesFor(resourceType, resourceId) {
  const client = ensureSupabase();
  if (!client) return;
  try {
    await client
      .from('partner_resources')
      .delete()
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId);
  } catch (_e) {
  }
}

async function deleteTripResource(tripId, label) {
  if (!confirm(`Are you sure you want to delete trip "${label}"?\n\nThis action cannot be undone.`)) return;
  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }
  const client = ensureSupabase();
  if (!client) return;
  try {
    await deletePartnerResourcesFor('trips', tripId);
    const { error } = await client.from('trips').delete().eq('id', tripId);
    if (error) throw error;
    showToast('Trip deleted', 'success');
    await loadTripsAdminData();
  } catch (e) {
    console.error('Failed to delete trip:', e);
    showToast('Failed to delete trip: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function deleteHotelResource(hotelId, label) {
  if (!confirm(`Are you sure you want to delete hotel "${label}"?\n\nThis action cannot be undone.`)) return;
  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }
  const client = ensureSupabase();
  if (!client) return;
  try {
    await deletePartnerResourcesFor('hotels', hotelId);
    const { error } = await client.from('hotels').delete().eq('id', hotelId);
    if (error) throw error;
    showToast('Hotel deleted', 'success');
    await loadHotelsAdminData();
  } catch (e) {
    console.error('Failed to delete hotel:', e);
    showToast('Failed to delete hotel: ' + (e.message || 'Unknown error'), 'error');
  }
}

window.deleteTripResource = deleteTripResource;
window.deleteHotelResource = deleteHotelResource;

function addPricingTierRow(tbodyId, tier) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (tbody.querySelector('.table-loading')) tbody.innerHTML = '';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" min="1" class="admin-input" style="width:100px" value="${tier && tier.persons != null ? Number(tier.persons) : ''}" placeholder="2" /></td>
    <td><input type="number" min="0" step="0.01" class="admin-input" style="width:140px" value="${tier && tier.price_per_night != null ? Number(tier.price_per_night) : ''}" placeholder="0.00" /></td>
    <td><input type="number" min="1" class="admin-input" style="width:140px" value="${tier && tier.min_nights != null ? Number(tier.min_nights) : ''}" placeholder="" /></td>
    <td><button type="button" class="btn-danger">Remove</button></td>
  `;
  const btn = tr.querySelector('button');
  btn.addEventListener('click', () => {
    tr.remove();
    if (!tbody.children.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    }
  });
  tbody.appendChild(tr);
}

function renderPricingTiers(tbodyId, rules) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No tiers yet</td></tr>';
    return;
  }
  list.forEach(r => addPricingTierRow(tbodyId, r));
}

function collectPricingTiers(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return { currency: 'EUR', rules: [] };
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const rules = [];
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (!inputs || inputs.length < 2) return;
    const persons = Number(inputs[0].value);
    const price = Number(inputs[1].value);
    const minNights = inputs[2] && inputs[2].value ? Number(inputs[2].value) : null;
    if (Number.isFinite(persons) && persons > 0 && Number.isFinite(price) && price >= 0) {
      const rule = { persons, price_per_night: price };
      if (Number.isFinite(minNights) && minNights > 0) rule.min_nights = minNights;
      rules.push(rule);
    }
  });
  rules.sort((a, b) => a.persons - b.persons);
  return { currency: 'EUR', rules };
}

function previewLocalImages(fileInput, container, max = 10) {
  container.innerHTML = '';
  if (!fileInput || !fileInput.files) return;
  const files = Array.from(fileInput.files).slice(0, max);
  files.forEach(f => {
    if (!f.type.startsWith('image/')) return;
    const img = document.createElement('img');
    img.alt = f.name;
    img.style.width = '72px';
    img.style.height = '72px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.readAsDataURL(f);
    container.appendChild(img);
  });
}

async function uploadHotelPhotosBatch(slug, files) {
  const client = ensureSupabase();
  if (!client) throw new Error('Database connection not available');
  const results = [];
  for (const file of files) {
    if (!file || !file.type || !file.type.startsWith('image/')) continue;
    const compressed = await compressToWebp(file, 1600, 1200, 0.82);
    const path = `hotels/${slug}/gallery/${Date.now()}-${Math.random().toString(36).slice(2,8)}.webp`;
    const { error: upErr } = await client.storage.from('poi-photos').upload(path, compressed, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp'
    });
    if (upErr) throw upErr;
    const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
    if (pub && pub.publicUrl) results.push(pub.publicUrl);
  }
  return results;
}

window.openNewTripModal = openNewTripModal;

function hideElement(element) {
  if (element) {
    element.hidden = true;
    element.style.display = 'none';
  }
}

function setLoading(isLoading) {
  adminState.loading = isLoading;
  const loadingEl = $('#adminLoading');
  if (isLoading) {
    showElement(loadingEl);
  } else {
    hideElement(loadingEl);
  }
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function showToast(message, type = 'info') {
  // Use existing toast system if available
  if (window.showToast) {
    window.showToast(message, type);
    return;
  }

  // Fallback toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// AUTHENTICATION & ACCESS CONTROL
// =====================================================

async function checkAdminAccess() {
  try {
    console.log('=== checkAdminAccess START ===');
    setLoading(true);

    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available');
    }

    // Get current session
    console.log('Getting session...');
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw sessionError;
    }
    
    if (!session || !session.user) {
      console.log('No active session - showing login screen');
      showLoginScreen();
      return false;
    }

    console.log('Session found. User:', session.user.email, 'ID:', session.user.id);
    adminState.user = session.user;

    // Check if user ID matches admin
    console.log('Required admin ID:', ADMIN_CONFIG.requiredUserId);
    console.log('Current user ID:', session.user.id);
    
    if (session.user.id !== ADMIN_CONFIG.requiredUserId) {
      console.log('❌ User ID does NOT match admin ID');
      console.log('User is not admin:', session.user.id);
      showAccessDenied();
      return false;
    }
    
    console.log('✅ User ID matches! Checking profile...');

    // Get user profile and verify is_admin flag
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    console.log('Profile loaded:', profile);
    console.log('is_admin flag:', profile?.is_admin);

    if (!profile) {
      console.log('⚠️ No profile row found; continuing because user ID is whitelisted');
    } else if (!profile.is_admin) {
      console.log('⚠️ Profile is_admin is false; continuing because user ID is whitelisted');
    } else {
      console.log('✅ Admin flag confirmed!');
    }

    const profileSafe = profile || {
      id: session.user.id,
      email: session.user.email,
      username: session.user.email,
      is_admin: true,
    };

    adminState.profile = profileSafe;
    adminState.isAdmin = true;

    console.log('✅✅✅ Admin access GRANTED:', profileSafe.username || profileSafe.email);
    console.log('=== checkAdminAccess END - SUCCESS ===');
    showAdminPanel();
    return true;

  } catch (error) {
    console.error('❌ Admin access check failed:', error);
    console.log('=== checkAdminAccess END - FAILED ===');
    showLoginScreen();
    return false;
  } finally {
    setLoading(false);
  }
}

function showLoginScreen() {
  console.log('showLoginScreen() called');
  
  const loading = $('#adminLoading');
  const accessDenied = $('#adminAccessDenied');
  const container = $('#adminContainer');
  const loginScreen = $('#adminLoginScreen');
  
  console.log('Elements:', {
    loading: !!loading,
    accessDenied: !!accessDenied,
    container: !!container,
    loginScreen: !!loginScreen
  });
  
  hideElement(loading);
  hideElement(accessDenied);
  hideElement(container);
  showElement(loginScreen);
  
  console.log('Login screen should now be visible');
}

function showAccessDenied() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminContainer'));
  showElement($('#adminAccessDenied'));
}

function showAdminPanel() {
  hideElement($('#adminLoading'));
  hideElement($('#adminLoginScreen'));
  hideElement($('#adminAccessDenied'));
  showElement($('#adminContainer'));
  
  // Update admin info in header
  updateAdminHeader();
  
  // Load initial data
  loadDashboardData();
  loadAllOrders({ silent: true });
}

function updateAdminHeader() {
  const nameEl = $('#adminUserName');
  if (nameEl && adminState.profile) {
    nameEl.textContent = adminState.profile.username || adminState.profile.name || adminState.user.email;
  }
}

function hydrateResponsiveTableLabels(root = document) {
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  const tables = scope.querySelectorAll('table.admin-table');
  tables.forEach((table) => {
    let headers = Array.from(table.querySelectorAll('thead th')).map((th) => String(th.textContent || '').trim());
    if (!headers.length) {
      headers = Array.from(table.querySelectorAll('tr:first-child th')).map((th) => String(th.textContent || '').trim());
    }
    if (!headers.length) return;

    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells = row.querySelectorAll('td');
      cells.forEach((cell, index) => {
        if (cell.hasAttribute('colspan')) {
          cell.setAttribute('data-label', '');
          return;
        }
        const label = headers[index] || '';
        cell.setAttribute('data-label', label);
      });
    });
  });
}

let responsiveTableHydrateScheduled = false;
function scheduleResponsiveTableHydration(root = document) {
  if (responsiveTableHydrateScheduled) return;
  responsiveTableHydrateScheduled = true;
  requestAnimationFrame(() => {
    responsiveTableHydrateScheduled = false;
    hydrateResponsiveTableLabels(root);
  });
}

// =====================================================
// NAVIGATION
// =====================================================

function switchView(viewName) {
  // Update state
  adminState.currentView = viewName;

  // Update nav items
  $$('.admin-nav-item').forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update views
  $$('.admin-view').forEach(view => {
    if (view.id === `view${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}`) {
      view.classList.add('active');
      view.hidden = false;
    } else {
      view.classList.remove('active');
      view.hidden = true;
    }
  });

  // Update breadcrumb
  const breadcrumb = $('#breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `<span>${viewName.charAt(0).toUpperCase()}${viewName.slice(1)}</span>`;
  }

  scheduleResponsiveTableHydration();

  if (viewName === 'cars') {
    setCarsLiveSyncStatus('Live sync: updating...', 'syncing');
    startCarsLiveRefresh();
  } else {
    stopCarsLiveRefresh();
  }

  // Load view-specific data
  switch (viewName) {
    case 'dashboard':
      loadDashboardData();
      loadAllOrders({ silent: true });
      break;
    case 'users':
      loadUsersData();
      break;
    case 'pois':
      loadPoisData();
      break;
    case 'quests':
      loadQuestsData();
      break;
    case 'cars':
      switchCarsTab(getActiveCarsTab());
      break;
    case 'trips':
      loadTripsAdminData();
      break;
    case 'hotels':
      loadHotelsAdminData();
      break;
    case 'referrals':
      loadReferralSettings();
      loadReferralsData();
      break;
    case 'recommendations':
      loadRecommendationsData();
      break;
    case 'content':
      loadContentData();
      break;
    case 'moderation':
      loadModerationData();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'diagnostics':
      loadDiagnosticsData();
      break;
    case 'xp-control':
      loadXpControlData();
      break;
    case 'shop':
      loadShopData();
      break;
    case 'partners':
      setPartnersActiveTab(partnersUiState.activeTab || 'list');
      loadPartnersData();
      break;
    case 'calendars':
      loadAdminCalendarsData();
      break;
    case 'settings':
      loadAdminNotificationSettings();
      loadAdminPushNotificationSettings();
      break;
  }
}

// =====================================================
// DASHBOARD DATA
// =====================================================

async function loadDashboardData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Supabase client not available');
    }
    
    console.log('Loading dashboard data...');
    
    // Load system diagnostics
    const { data: diagnostics, error: diagError } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (diagError) {
      console.error('Diagnostics error:', diagError);
      throw diagError;
    }

    console.log('Diagnostics loaded:', diagnostics);

    // Update stat cards
    if (diagnostics && diagnostics.length > 0) {
      diagnostics.forEach(metric => {
        // Convert metric name to element ID
        // e.g., "total_users" -> "statTotalUsers"
        const elementId = `stat${metric.metric.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('')}`;
        
        console.log(`Setting ${elementId} = ${metric.value}`);
        
        const valueEl = $(`#${elementId}`);
        if (valueEl) {
          valueEl.textContent = metric.value;
        } else {
          console.warn(`Element #${elementId} not found`);
        }
      });
    } else {
      console.warn('No diagnostics data received');
    }

    // Load recent activity
    await loadRecentActivity();

    await loadForceRefreshStatus();

  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

async function loadForceRefreshStatus() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data, error } = await client
      .from('site_settings')
      .select('force_refresh_version, updated_at')
      .eq('id', FORCE_REFRESH_ROW_ID)
      .maybeSingle();

    if (error) {
      console.error('Failed to load force refresh status:', error);
      return;
    }

    const versionValue = String(data?.force_refresh_version ?? '-');
    const updatedValue = data?.updated_at ? formatDate(data.updated_at) : '-';

    const versionIds = ['forceRefreshVersion', 'forceRefreshVersionSettings'];
    const updatedIds = ['forceRefreshUpdatedAt', 'forceRefreshUpdatedAtSettings'];

    versionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = versionValue;
    });

    updatedIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = updatedValue;
    });

    refreshForceRefreshLocalDiagnostics();
  } catch (error) {
    console.error('Failed to load force refresh status:', error);
  }
}

function readForceRefreshLocalValue(storage, key) {
  try {
    return Number(storage.getItem(key) || 0);
  } catch (_) {
    return 0;
  }
}

function refreshForceRefreshLocalDiagnostics() {
  const keys = window.CE_FORCE_REFRESH_KEYS || { applied: 'ce_force_refresh_applied_version', pending: 'ce_force_refresh_pending_version' };
  const applied = readForceRefreshLocalValue(window.localStorage, keys.applied);
  const pending = readForceRefreshLocalValue(window.sessionStorage, keys.pending);
  const debug = (window.CE_FORCE_REFRESH_DEBUG && typeof window.CE_FORCE_REFRESH_DEBUG === 'object')
    ? window.CE_FORCE_REFRESH_DEBUG
    : null;

  const appliedEl = document.getElementById('forceRefreshAppliedLocal');
  const pendingEl = document.getElementById('forceRefreshPendingLocal');
  const checkedEl = document.getElementById('forceRefreshLastCheckLocal');

  if (appliedEl) appliedEl.textContent = String(applied || 0);
  if (pendingEl) pendingEl.textContent = String(pending || 0);
  if (checkedEl) checkedEl.textContent = debug?.lastCheckAt ? formatDate(debug.lastCheckAt) : '-';
}

async function handleForceRefreshClick() {
  const client = ensureSupabase();
  if (!client) {
    showToast('Database connection not available', 'error');
    return;
  }

  try {
    const { data: existing, error: existingError } = await client
      .from('site_settings')
      .select('force_refresh_version')
      .eq('id', FORCE_REFRESH_ROW_ID)
      .maybeSingle();

    if (existingError) throw existingError;

    const currentVersion = Number(existing?.force_refresh_version || 0);
    const nextVersion = currentVersion + 1;

    const { error } = await client
      .from('site_settings')
      .upsert(
        {
          id: FORCE_REFRESH_ROW_ID,
          force_refresh_version: nextVersion,
          updated_at: new Date().toISOString(),
          updated_by: adminState.user?.id || null,
        },
        { onConflict: 'id' }
      );

    if (error) throw error;

    showToast('Force refresh triggered', 'success');
    await loadForceRefreshStatus();
  } catch (error) {
    console.error('Force refresh failed:', error);
    showToast('Force refresh failed', 'error');
  }
}

async function handleForceRefreshCheckNowClick() {
  try {
    const fn = window.CE_FORCE_REFRESH_CHECK_NOW;
    if (typeof fn !== 'function') {
      showToast('Force-refresh checker is not available on this page', 'error');
      return;
    }

    const result = await fn();
    refreshForceRefreshLocalDiagnostics();

    if (result?.action === 'noop' || result?.action === 'applied_pending') {
      showToast('This device is already up to date', 'success');
      return;
    }
    if (result?.action === 'reload') {
      showToast('Reload triggered for this device', 'info');
      return;
    }
    showToast('Check completed (no immediate action)', 'info');
  } catch (error) {
    console.error('Force refresh check failed:', error);
    showToast('Force refresh check failed', 'error');
  }
}

async function runForceRefreshAction(button, handler) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await handler();
  } finally {
    if (button) button.disabled = false;
  }
}

function bindTapAndClickAction(button, handler) {
  if (!button || button.dataset.forceRefreshBound === '1') return;
  button.dataset.forceRefreshBound = '1';

  let lastTouchAt = 0;
  const run = () => runForceRefreshAction(button, handler);

  button.addEventListener('touchend', (event) => {
    lastTouchAt = Date.now();
    event.preventDefault();
    run();
  }, { passive: false });

  button.addEventListener('click', (event) => {
    if (Date.now() - lastTouchAt < 700) {
      event.preventDefault();
      return;
    }
    run();
  });
}

function exposeForceRefreshGlobalHandlers() {
  window.__adminForceReloadFromDashboard = (event) => {
    if (event?.preventDefault) event.preventDefault();
    const button = document.getElementById('btnForceRefreshSite');
    return runForceRefreshAction(button, handleForceRefreshClick);
  };

  window.__adminForceReloadFromSettings = (event) => {
    if (event?.preventDefault) event.preventDefault();
    const button = document.getElementById('btnForceReloadAppSettings');
    return runForceRefreshAction(button, handleForceRefreshClick);
  };

  window.__adminForceRefreshCheckNowFromSettings = (event) => {
    if (event?.preventDefault) event.preventDefault();
    const button = document.getElementById('btnForceRefreshCheckNow');
    return runForceRefreshAction(button, handleForceRefreshCheckNowClick);
  };
}

async function loadRecentActivity() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: activity, error } = await client.rpc('admin_get_activity_log', { 
      limit_count: 10 
    });

    if (error) throw error;

    const tableBody = $('#recentActivityTable');
    if (!tableBody) return;

    if (!activity || activity.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="table-loading">No recent activity</td></tr>';
      return;
    }

    tableBody.innerHTML = activity.map(item => `
      <tr>
        <td>
          <span class="badge badge-${item.activity_type === 'comment' ? 'success' : 'warning'}">
            ${item.activity_type}
          </span>
        </td>
        <td>${item.username || 'Unknown'}</td>
        <td>${JSON.stringify(item.details).slice(0, 60)}...</td>
        <td>${formatDate(item.created_at)}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load recent activity:', error);
  }
}

// =====================================================
// USERS MANAGEMENT
// =====================================================

async function getUsersPartnerAffiliateFlags(client, userIds) {
  const flagsByUserId = {};
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  ids.forEach((id) => {
    flagsByUserId[id] = { is_partner: false, is_affiliate: false };
  });

  if (!client || ids.length === 0) return flagsByUserId;

  let membershipsRes;
  try {
    membershipsRes = await client
      .from('partner_users')
      .select('user_id, partner_id')
      .in('user_id', ids)
      .limit(5000);
  } catch (_e) {
    return flagsByUserId;
  }

  if (membershipsRes?.error) {
    return flagsByUserId;
  }

  const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];
  const partnerIds = Array.from(new Set(memberships.map((m) => m.partner_id).filter(Boolean)));

  const partnersById = {};
  if (partnerIds.length > 0) {
    let partnersRes = await client
      .from('partners')
      .select('id, affiliate_enabled')
      .in('id', partnerIds)
      .limit(5000);

    if (partnersRes.error && (isMissingColumnError(partnersRes.error, 'affiliate_enabled') || /affiliate_enabled/i.test(String(partnersRes.error.message || '')))) {
      partnersRes = await client
        .from('partners')
        .select('id')
        .in('id', partnerIds)
        .limit(5000);
    }

    if (!partnersRes.error) {
      (partnersRes.data || []).forEach((p) => {
        partnersById[p.id] = p;
      });
    }
  }

  memberships.forEach((m) => {
    const uid = m.user_id;
    if (!uid) return;
    if (!flagsByUserId[uid]) flagsByUserId[uid] = { is_partner: false, is_affiliate: false };
    flagsByUserId[uid].is_partner = true;
    const p = partnersById[m.partner_id];
    if (p && p.affiliate_enabled === true) {
      flagsByUserId[uid].is_affiliate = true;
    }
  });

  return flagsByUserId;
}

async function loadUsersData(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    adminState.usersPage = page;

    const { data: users, error, count } = await client
      .from('admin_users_overview')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * ADMIN_CONFIG.usersPerPage, page * ADMIN_CONFIG.usersPerPage - 1);

    if (error) throw error;

    adminState.usersTotal = count || 0;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    const flagsByUserId = await getUsersPartnerAffiliateFlags(client, users.map((u) => u.id));
    const usersWithFlags = users.map((u) => ({
      ...u,
      ...(flagsByUserId[u.id] || { is_partner: false, is_affiliate: false }),
    }));

    tableBody.innerHTML = usersWithFlags.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
          ${user.is_partner ? '<span class="badge badge-partner">PARTNER</span>' : ''}
          ${user.is_affiliate ? '<span class="badge badge-affiliate">AFFILIATE</span>' : ''}
          ${!user.is_admin && user.is_moderator ? '<span class="badge">MODERATOR</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

    // Update pagination
    updateUsersPagination();

  } catch (error) {
    console.error('Failed to load users:', error);
    showToast('Failed to load users', 'error');
  }
}

function updateUsersPagination() {
  const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
  const currentPage = adminState.usersPage;

  const prevBtn = $('#btnUsersPrev');
  const nextBtn = $('#btnUsersNext');
  const infoEl = $('#usersPaginationInfo');

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (infoEl) infoEl.textContent = `Page ${currentPage} of ${totalPages}`;
}

async function viewUserDetails(userId) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Loading user details...', 'info');

    const { data, error } = await client.rpc('admin_get_user_details', { 
      target_user_id: userId 
    });

    if (error) throw error;

    // Show modal with user details
    const modal = $('#userDetailModal');
    const content = $('#userDetailContent');
    
    if (!modal || !content) return;
    content.classList.add('user-detail-modal-content');
    
    const profile = data.profile || {};
    const stats = data.stats || {};
    const authData = data.auth_data || {};
    const isCurrentUserAdmin = Boolean(profile.is_admin);
    const isSelf = profile && profile.id === ADMIN_CONFIG.requiredUserId;
    const authEmail = authData.email || profile.email || '';
    const bannedUntil = authData.banned_until;
    const banLabel = bannedUntil
      ? `Banned until ${formatDate(bannedUntil)}`
      : 'Active';
    const statusBadgeClass = bannedUntil ? 'badge-danger' : 'badge-success';
    const formattedJoined = authData.created_at ? formatDate(authData.created_at) : 'Unknown';
    const formattedLastSignIn = authData.last_sign_in_at ? formatDate(authData.last_sign_in_at) : 'Never';
    const emailConfirmedAt = authData.email_confirmed_at || authData.confirmed_at;
    const formattedEmailConfirmedAt = emailConfirmedAt ? formatDate(emailConfirmedAt) : 'Not confirmed';
    const emailEscaped = escapeHtml(authEmail);
    const usernameEscaped = escapeHtml(profile.username || '');
    const nameEscaped = escapeHtml(profile.name || '');
    const escapeJsString = (value) => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, ' ');
    const safeEmailForJs = escapeHtml(escapeJsString(authEmail));
    const safeLabelForJs = escapeHtml(escapeJsString(profile.username || authEmail || profile.id || userId));
    const normalizedEmail = String(authEmail || '').trim().toLowerCase();

    let shopAddresses = [];
    let shopOrders = [];
    let shopRefunds = [];
    let carBookings = [];
    let tripBookings = [];
    let hotelBookings = [];
    let depositRequests = [];
    let commissionEventsByDepositId = {};
    const mergeUniqueRecordsById = (...groups) => {
      const map = new Map();
      groups.flat().forEach((row) => {
        const id = String(row?.id || '').trim();
        if (!id || map.has(id)) return;
        map.set(id, row);
      });
      return Array.from(map.values()).sort((a, b) => {
        const aTime = new Date(a?.created_at || 0).getTime() || 0;
        const bTime = new Date(b?.created_at || 0).getTime() || 0;
        return bTime - aTime;
      });
    };

    try {
      const ordersByEmailPromise = normalizedEmail
        ? client
            .from('shop_orders')
            .select('id, order_number, created_at, total, currency, status, payment_status, shipping_address, customer_phone, customer_email')
            .ilike('customer_email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null });

      const [addressesResult, ordersByUserResult, ordersByEmailResult] = await Promise.all([
        client
          .from('shop_addresses')
          .select('*')
          .eq('user_id', userId)
          .order('is_default_shipping', { ascending: false })
          .order('updated_at', { ascending: false }),
        client
          .from('shop_orders')
          .select('id, order_number, created_at, total, currency, status, payment_status, shipping_address, customer_phone, customer_email')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        ordersByEmailPromise,
      ]);

      if (!addressesResult.error && Array.isArray(addressesResult.data)) {
        shopAddresses = addressesResult.data;
      }
      const mergedShopOrders = mergeUniqueRecordsById(
        !ordersByUserResult.error && Array.isArray(ordersByUserResult.data) ? ordersByUserResult.data : [],
        !ordersByEmailResult.error && Array.isArray(ordersByEmailResult.data) ? ordersByEmailResult.data : [],
      );
      if (mergedShopOrders.length) {
        shopOrders = mergedShopOrders.slice(0, 50);
      }
    } catch (e) {
    }

    try {
      const orderIds = shopOrders.map((order) => order?.id).filter(Boolean);
      if (orderIds.length) {
        const { data: refundsData, error: refundsError } = await client
          .from('shop_refunds')
          .select('order_id, amount, status, processed_at')
          .in('order_id', orderIds)
          .limit(500);
        if (!refundsError && Array.isArray(refundsData)) {
          shopRefunds = refundsData;
        }
      }
    } catch (_e) {
    }

    try {
      if (normalizedEmail) {
        const [carsByEmailResult, carsByCustomerEmailResult, tripsResult, hotelsResult, depositsResult] = await Promise.all([
          client
            .from('car_bookings')
            .select('*')
            .ilike('email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(50),
          client
            .from('car_bookings')
            .select('*')
            .ilike('customer_email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(50),
          client
            .from('trip_bookings')
            .select('id, created_at, customer_name, customer_email, customer_phone, trip_slug, arrival_date, departure_date, status, total_price')
            .ilike('customer_email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(25),
          client
            .from('hotel_bookings')
            .select('id, created_at, customer_name, customer_email, customer_phone, hotel_slug, arrival_date, departure_date, status, total_price')
            .ilike('customer_email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(25),
          client
            .from('service_deposit_requests')
            .select('id, status, amount, currency, resource_type, booking_id, fulfillment_id, partner_id, customer_email, customer_name, customer_phone, paid_at, created_at')
            .ilike('customer_email', normalizedEmail)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        const mergedCarBookings = mergeUniqueRecordsById(
          !carsByEmailResult.error && Array.isArray(carsByEmailResult.data) ? carsByEmailResult.data : [],
          !carsByCustomerEmailResult.error && Array.isArray(carsByCustomerEmailResult.data) ? carsByCustomerEmailResult.data : [],
        );
        if (mergedCarBookings.length) {
          carBookings = mergedCarBookings.slice(0, 50);
        }
        if (!tripsResult.error && Array.isArray(tripsResult.data)) {
          tripBookings = tripsResult.data;
        }
        if (!hotelsResult.error && Array.isArray(hotelsResult.data)) {
          hotelBookings = hotelsResult.data;
        }
        if (!depositsResult.error && Array.isArray(depositsResult.data)) {
          depositRequests = depositsResult.data;
        }

        const depositIds = depositRequests.map((d) => d?.id).filter(Boolean);
        if (depositIds.length) {
          const { data: commissionEvents, error: commissionEventsError } = await client
            .from('affiliate_commission_events')
            .select('deposit_request_id, level, commission_amount, currency, payout_id, partner_id')
            .in('deposit_request_id', depositIds)
            .order('created_at', { ascending: false })
            .limit(500);

          if (!commissionEventsError && Array.isArray(commissionEvents)) {
            commissionEventsByDepositId = commissionEvents.reduce((acc, ev) => {
              const id = String(ev.deposit_request_id || '');
              if (!id) return acc;
              acc[id] = acc[id] || [];
              acc[id].push(ev);
              return acc;
            }, {});
          }
        }
      }
    } catch (_e) {
    }

    const formatMoney = (value, currency = 'EUR') => {
      const num = Number(value) || 0;
      if (currency === 'EUR') {
        if (typeof formatCurrencyEUR === 'function') {
          try {
            return formatCurrencyEUR(num);
          } catch (e) {
          }
        }
        return `€${num.toFixed(2)}`;
      }
      return `${num.toFixed(2)} ${escapeHtml(String(currency || ''))}`;
    };

    const normalizeAddressObject = (raw) => {
      if (!raw) return null;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return null;
        }
      }
      if (typeof raw === 'object') return raw;
      return null;
    };

    const latestOrder = shopOrders[0] || null;
    const latestShippingAddress = normalizeAddressObject(latestOrder?.shipping_address) || null;
    const normalizeCurrency = (value) => String(value || 'EUR').trim().toUpperCase() || 'EUR';
    const toMoneyNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };
    const addMoney = (acc, value, currency = 'EUR') => {
      const amount = toMoneyNumber(value);
      if (!amount) return acc;
      const cur = normalizeCurrency(currency);
      acc[cur] = (acc[cur] || 0) + amount;
      return acc;
    };
    const sumMoneyMaps = (...maps) => {
      const result = {};
      maps.forEach((map) => {
        Object.entries(map || {}).forEach(([cur, value]) => {
          result[cur] = (result[cur] || 0) + toMoneyNumber(value);
        });
      });
      return result;
    };
    const subtractMoneyMaps = (base, minus) => {
      const result = { ...(base || {}) };
      Object.entries(minus || {}).forEach(([cur, value]) => {
        result[cur] = (result[cur] || 0) - toMoneyNumber(value);
      });
      return result;
    };
    const hasMoney = (map) => Object.values(map || {}).some((value) => Math.abs(toMoneyNumber(value)) > 0.0001);
    const formatMoneyMap = (map) => {
      const entries = Object.entries(map || {})
        .map(([cur, value]) => [cur, toMoneyNumber(value)])
        .filter(([, value]) => Math.abs(value) > 0.0001)
        .sort(([a], [b]) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b)));
      if (!entries.length) return '—';
      return entries.map(([cur, value]) => formatMoney(value, cur)).join(' + ');
    };
    const normalizePhone = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const uniquePhones = (...groups) => {
      const out = [];
      groups.flat().forEach((value) => {
        const phone = normalizePhone(value);
        if (!phone || out.includes(phone)) return;
        out.push(phone);
      });
      return out;
    };

    const paidShopStatuses = new Set(['paid', 'partially_refunded', 'refunded']);
    const shopGrossPaidByCurrency = {};
    shopOrders.forEach((order) => {
      if (!paidShopStatuses.has(String(order?.payment_status || '').toLowerCase())) return;
      addMoney(shopGrossPaidByCurrency, order?.total, order?.currency);
    });

    const effectiveRefundStatuses = new Set(['processed', 'completed', 'succeeded', 'refunded', 'approved']);
    const shopRefundByCurrency = {};
    (shopRefunds || []).forEach((refund) => {
      const status = String(refund?.status || '').toLowerCase();
      const processedAt = refund?.processed_at;
      if (!processedAt && !effectiveRefundStatuses.has(status)) return;
      const matchingOrder = shopOrders.find((order) => String(order?.id || '') === String(refund?.order_id || ''));
      addMoney(shopRefundByCurrency, refund?.amount, matchingOrder?.currency || 'EUR');
    });
    const shopNetPaidByCurrency = subtractMoneyMaps(shopGrossPaidByCurrency, shopRefundByCurrency);

    const normalizeBookingKey = (resourceType, bookingId) => {
      const type = String(resourceType || '').trim().toLowerCase();
      const id = String(bookingId || '').trim();
      if (!type || !id) return '';
      return `${type}:${id}`;
    };
    const serviceBookingValueByCurrency = {};
    const serviceBookingValueByKey = new Map();
    carBookings.forEach((booking) => {
      const priceMeta = getCarBookingEffectivePriceMeta(booking);
      addMoney(serviceBookingValueByCurrency, priceMeta.amount, priceMeta.currency || 'EUR');
      const key = normalizeBookingKey('cars', booking?.id);
      if (key) {
        serviceBookingValueByKey.set(key, {
          amount: toMoneyNumber(priceMeta.amount),
          currency: priceMeta.currency || 'EUR',
        });
      }
    });
    tripBookings.forEach((booking) => {
      addMoney(serviceBookingValueByCurrency, booking?.total_price, 'EUR');
      const key = normalizeBookingKey('trips', booking?.id);
      if (key) {
        serviceBookingValueByKey.set(key, {
          amount: toMoneyNumber(booking?.total_price),
          currency: 'EUR',
        });
      }
    });
    hotelBookings.forEach((booking) => {
      addMoney(serviceBookingValueByCurrency, booking?.total_price, 'EUR');
      const key = normalizeBookingKey('hotels', booking?.id);
      if (key) {
        serviceBookingValueByKey.set(key, {
          amount: toMoneyNumber(booking?.total_price),
          currency: 'EUR',
        });
      }
    });

    const serviceDepositsPaidByCurrency = {};
    const servicePaidByDepositRuleByCurrency = {};
    const paidDepositStatuses = new Set(['paid', 'completed']);
    const paidDepositBookingKeys = new Set();
    let paidDepositCount = 0;
    let paidDepositLinkedBookingCount = 0;

    depositRequests.forEach((deposit) => {
      const status = String(deposit?.status || '').toLowerCase();
      const isPaid = Boolean(deposit?.paid_at) || paidDepositStatuses.has(status);
      if (!isPaid) return;

      paidDepositCount += 1;
      addMoney(serviceDepositsPaidByCurrency, deposit?.amount, deposit?.currency || 'EUR');

      const bookingKey = normalizeBookingKey(deposit?.resource_type, deposit?.booking_id);
      if (!bookingKey) {
        addMoney(servicePaidByDepositRuleByCurrency, deposit?.amount, deposit?.currency || 'EUR');
        return;
      }

      if (paidDepositBookingKeys.has(bookingKey)) {
        return;
      }
      paidDepositBookingKeys.add(bookingKey);

      const bookingValue = serviceBookingValueByKey.get(bookingKey);
      if (bookingValue && bookingValue.amount > 0) {
        addMoney(servicePaidByDepositRuleByCurrency, bookingValue.amount, bookingValue.currency || 'EUR');
        paidDepositLinkedBookingCount += 1;
        return;
      }

      // Fallback when booking row is not available in this view: use paid deposit amount.
      addMoney(servicePaidByDepositRuleByCurrency, deposit?.amount, deposit?.currency || 'EUR');
    });

    const totalPaidByCurrency = sumMoneyMaps(shopNetPaidByCurrency, servicePaidByDepositRuleByCurrency);
    const totalPaidLabel = formatMoneyMap(totalPaidByCurrency);
    const shopNetPaidLabel = formatMoneyMap(shopNetPaidByCurrency);
    const shopGrossPaidLabel = formatMoneyMap(shopGrossPaidByCurrency);
    const shopRefundLabel = formatMoneyMap(shopRefundByCurrency);
    const serviceDepositsPaidLabel = formatMoneyMap(serviceDepositsPaidByCurrency);
    const servicePaidByDepositRuleLabel = formatMoneyMap(servicePaidByDepositRuleByCurrency);
    const serviceBookingValueLabel = formatMoneyMap(serviceBookingValueByCurrency);

    const latestOrderPhone = normalizePhone(latestOrder?.customer_phone);
    const latestShippingPhone = normalizePhone(latestShippingAddress?.phone);
    const savedAddressPhones = shopAddresses.map((addr) => addr?.phone);
    const carPhones = carBookings.map((booking) => booking?.phone || booking?.customer_phone);
    const tripPhones = tripBookings.map((booking) => booking?.customer_phone);
    const hotelPhones = hotelBookings.map((booking) => booking?.customer_phone);
    const depositPhones = depositRequests.map((deposit) => deposit?.customer_phone);
    const allPhones = uniquePhones(
      profile?.phone,
      latestOrderPhone,
      latestShippingPhone,
      savedAddressPhones,
      carPhones,
      tripPhones,
      hotelPhones,
      depositPhones,
    );
    const primaryPhone = allPhones[0] || '';
    const primaryPhoneEscaped = escapeHtml(primaryPhone);
    const primaryPhoneHref = primaryPhone ? `tel:${encodeURIComponent(primaryPhone)}` : '';
    const phoneCoverageText = allPhones.length > 1 ? `${allPhones.length} phone numbers captured` : allPhones.length === 1 ? '1 phone number captured' : 'No phone numbers captured';

    const totalOrdersCount = shopOrders.length;
    const totalBookingsCount = carBookings.length + tripBookings.length + hotelBookings.length;

    const renderInlineAddress = (address) => {
      if (!address) {
        return '<p class="user-detail-hint">No shipping address captured.</p>';
      }
      const line1 = escapeHtml(address.line1 || address.address || '');
      const line2 = escapeHtml(address.line2 || '');
      const city = escapeHtml(address.city || '');
      const postal = escapeHtml(address.postal_code || address.postalCode || '');
      const country = escapeHtml(address.country || '');
      const name = escapeHtml(address.name || address.full_name || address.fullName || '');
      const phone = escapeHtml(address.phone || '');
      return `
        <div style="font-size: 13px; line-height: 1.45;">
          ${name ? `<div style="font-weight: 600;">${name}</div>` : ''}
          ${line1 ? `<div>${line1}</div>` : ''}
          ${line2 ? `<div>${line2}</div>` : ''}
          ${(postal || city) ? `<div>${postal} ${city}</div>` : ''}
          ${country ? `<div style="font-weight: 500;">${country}</div>` : ''}
          ${phone ? `<div style="color: var(--admin-text-muted); margin-top: 6px;">${phone}</div>` : ''}
        </div>
      `;
    };

    const shopAddressesHtml = shopAddresses.length
      ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
          ${shopAddresses.map((addr) => {
            const header = `${escapeHtml(addr.first_name || '')} ${escapeHtml(addr.last_name || '')}`.trim() || 'Address';
            const isDefault = addr.is_default_shipping ? '<span class="badge badge-success" style="margin-left: 8px;">Default</span>' : '';
            const line1 = escapeHtml(addr.line1 || '');
            const line2 = escapeHtml(addr.line2 || '');
            const city = escapeHtml(addr.city || '');
            const postal = escapeHtml(addr.postal_code || '');
            const country = escapeHtml(addr.country || '');
            const phone = escapeHtml(addr.phone || '');
            return `
              <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                  <div style="font-weight: 600;">${header}${isDefault}</div>
                </div>
                <div style="font-size: 13px; line-height: 1.45;">
                  ${line1 ? `<div>${line1}</div>` : ''}
                  ${line2 ? `<div>${line2}</div>` : ''}
                  ${(postal || city) ? `<div>${postal} ${city}</div>` : ''}
                  ${country ? `<div style="font-weight: 500;">${country}</div>` : ''}
                  ${phone ? `<div style="color: var(--admin-text-muted); margin-top: 6px;">${phone}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `
      : '<p class="user-detail-hint">No saved shop addresses.</p>';

    const shopOrdersHtml = shopOrders.length
      ? `
        <div class="admin-table-container" style="margin-top: 10px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th style="text-align: right;">Total</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${shopOrders.map((order) => {
                const number = escapeHtml(order.order_number || '');
                const created = order.created_at ? new Date(order.created_at).toLocaleString('pl-PL') : '';
                const status = escapeHtml(order.status || '');
                const payment = escapeHtml(order.payment_status || '');
                const total = formatMoney(order.total, order.currency || 'EUR');
                return `
                  <tr>
                    <td><strong>${number}</strong></td>
                    <td>${escapeHtml(created)}</td>
                    <td>${status}</td>
                    <td>${payment}</td>
                    <td style="text-align: right;"><strong>${total}</strong></td>
                    <td style="text-align: right;">
                      <button class="btn-small btn-secondary" onclick="viewShopOrder('${order.id}')">View</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `
      : '<p class="user-detail-hint">No shop orders found.</p>';

    const formatBookingDate = (value) => {
      if (!value) return '';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
      return escapeHtml(d.toLocaleDateString('pl-PL'));
    };

    const renderServiceBookingsTable = (rows, kind) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        return '<p class="user-detail-hint">No bookings found.</p>';
      }

      if (kind === 'cars') {
        return `
          <div class="admin-table-container" style="margin-top: 10px;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Car</th>
                  <th>Pickup</th>
                  <th>Return</th>
                  <th>Status</th>
                  <th style="text-align:right;">Price</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((b) => {
                  const created = b.created_at ? escapeHtml(formatDate(b.created_at)) : '—';
                  const car = escapeHtml(b.car_model || '');
                  const pickup = formatBookingDate(b.pickup_date);
                  const ret = formatBookingDate(b.return_date);
                  const status = escapeHtml(b.status || '');
                  const priceMeta = getCarBookingEffectivePriceMeta(b);
                  const priceLabel = priceMeta.hasAmount ? escapeHtml(formatMoney(priceMeta.amount, priceMeta.currency || 'EUR')) : '—';
                  const id = escapeHtml(String(b.id || ''));
                  return `
                    <tr>
                      <td>${created}</td>
                      <td>${car}</td>
                      <td>${pickup || '—'}</td>
                      <td>${ret || '—'}</td>
                      <td>${status || '—'}</td>
                      <td style="text-align:right;">${priceLabel}</td>
                      <td style="text-align:right;">
                        <button class="btn-small btn-secondary" onclick="viewCarBookingDetails('${id}')">View</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (kind === 'trips') {
        return `
          <div class="admin-table-container" style="margin-top: 10px;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Trip</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>Status</th>
                  <th style="text-align:right;">Total</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map((b) => {
                  const created = b.created_at ? escapeHtml(formatDate(b.created_at)) : '—';
                  const trip = escapeHtml(b.trip_slug || '');
                  const arrival = formatBookingDate(b.arrival_date);
                  const departure = formatBookingDate(b.departure_date);
                  const status = escapeHtml(b.status || '');
                  const total = b.total_price == null ? '—' : escapeHtml(formatMoney(b.total_price, 'EUR'));
                  const id = escapeHtml(String(b.id || ''));
                  return `
                    <tr>
                      <td>${created}</td>
                      <td>${trip || '—'}</td>
                      <td>${arrival || '—'}</td>
                      <td>${departure || '—'}</td>
                      <td>${status || '—'}</td>
                      <td style="text-align:right;">${total}</td>
                      <td style="text-align:right;">
                        <button class="btn-small btn-secondary" onclick="viewTripBookingDetails('${id}')">View</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      return `
        <div class="admin-table-container" style="margin-top: 10px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Hotel</th>
                <th>Arrival</th>
                <th>Departure</th>
                <th>Status</th>
                <th style="text-align:right;">Total</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((b) => {
                const created = b.created_at ? escapeHtml(formatDate(b.created_at)) : '—';
                const hotel = escapeHtml(b.hotel_slug || '');
                const arrival = formatBookingDate(b.arrival_date);
                const departure = formatBookingDate(b.departure_date);
                const status = escapeHtml(b.status || '');
                const total = b.total_price == null ? '—' : escapeHtml(formatMoney(b.total_price, 'EUR'));
                const id = escapeHtml(String(b.id || ''));
                return `
                  <tr>
                    <td>${created}</td>
                    <td>${hotel || '—'}</td>
                    <td>${arrival || '—'}</td>
                    <td>${departure || '—'}</td>
                    <td>${status || '—'}</td>
                    <td style="text-align:right;">${total}</td>
                    <td style="text-align:right;">
                      <button class="btn-small btn-secondary" onclick="viewHotelBookingDetails('${id}')">View</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    const serviceDepositsHtml = (() => {
      const rows = Array.isArray(depositRequests) ? depositRequests : [];
      if (!rows.length) {
        return '<p class="user-detail-hint">No service deposits found.</p>';
      }

      return `
        <div class="admin-table-container" style="margin-top: 10px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Paid at</th>
                <th>Status</th>
                <th>Type</th>
                <th>Booking</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:right;">Affiliate</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((d) => {
                const created = d.created_at ? escapeHtml(formatDate(d.created_at)) : '—';
                const paidAt = d.paid_at ? escapeHtml(formatDate(d.paid_at)) : '—';
                const status = escapeHtml(d.status || '');
                const type = escapeHtml(d.resource_type || '');
                const bookingId = escapeHtml(String(d.booking_id || ''));
                const amount = escapeHtml(formatMoney(d.amount, d.currency || 'EUR'));

                const evs = commissionEventsByDepositId[String(d.id || '')] || [];
                const totalCommission = evs.reduce((sum, ev) => sum + (Number(ev?.commission_amount) || 0), 0);
                const commissionLabel = evs.length
                  ? `${evs.length} lvl · ${escapeHtml(formatMoney(totalCommission, d.currency || 'EUR'))}`
                  : '—';

                let bookingAction = '<span class="muted">—</span>';
                if (String(d.resource_type) === 'cars') {
                  bookingAction = `<button class="btn-small btn-secondary" onclick="viewCarBookingDetails('${bookingId}')">View</button>`;
                } else if (String(d.resource_type) === 'trips') {
                  bookingAction = `<button class="btn-small btn-secondary" onclick="viewTripBookingDetails('${bookingId}')">View</button>`;
                } else if (String(d.resource_type) === 'hotels') {
                  bookingAction = `<button class="btn-small btn-secondary" onclick="viewHotelBookingDetails('${bookingId}')">View</button>`;
                }

                return `
                  <tr>
                    <td>${created}</td>
                    <td>${paidAt}</td>
                    <td>${status || '—'}</td>
                    <td>${type || '—'}</td>
                    <td><code>${bookingId ? bookingId.slice(0, 8) : ''}</code></td>
                    <td style="text-align:right;">${amount}</td>
                    <td style="text-align:right;">${commissionLabel}</td>
                    <td style="text-align:right;">${bookingAction}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    })();

    content.innerHTML = `
      <div class="user-detail-grid">
        <section class="user-detail-card user-detail-card--full">
          <div class="user-detail-header">
            <div>
              <h4 class="user-detail-title">${usernameEscaped || 'Unknown user'}</h4>
              <p class="user-detail-subtitle">${emailEscaped || 'No email provided'}</p>
            </div>
            <div class="user-detail-status">
              <span class="badge ${statusBadgeClass}">${banLabel}</span>
              ${isCurrentUserAdmin ? '<span class="badge badge-admin">Admin</span>' : ''}
              ${!isCurrentUserAdmin && profile.is_moderator ? '<span class="badge">Moderator</span>' : ''}
            </div>
          </div>
          <dl class="user-detail-meta">
            <div>
              <dt>User ID</dt>
              <dd>${escapeHtml(profile.id || 'N/A')}</dd>
            </div>
            <div>
              <dt>Display name</dt>
              <dd>${nameEscaped || '—'}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>${Number.isFinite(profile.level) ? profile.level : 0}</dd>
            </div>
            <div>
              <dt>Total XP</dt>
              <dd>${Number.isFinite(profile.xp) ? profile.xp : 0}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>${formattedJoined}</dd>
            </div>
            <div>
              <dt>Last sign in</dt>
              <dd>${formattedLastSignIn}</dd>
            </div>
            <div>
              <dt>Email confirmed at</dt>
              <dd>${formattedEmailConfirmedAt}</dd>
            </div>
          </dl>
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Affiliate / Referral</h4>
          <div class="admin-form-grid" style="grid-template-columns: 1fr 240px; gap: 10px; align-items: end;">
            <label class="admin-form-field" style="margin: 0;">
              <span>Referrer (affiliate user)</span>
              <select id="userReferralReferrerSelect" class="form-control"></select>
              <div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Current: <span id="userReferralCurrent">—</span></div>
            </label>
            <div style="display:flex; justify-content:flex-end; gap: 8px;">
              <button class="btn-secondary" id="btnUserReferralClear" type="button">Clear</button>
              <button class="btn btn-primary" id="btnUserReferralApply" type="button">Save</button>
            </div>
          </div>
          <p class="user-detail-hint" style="margin-top: 8px;">This sets <code>profiles.referred_by</code> via admin RPC.</p>
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Customer summary</h4>
          <div class="user-summary-grid">
            <article class="user-summary-item">
              <p class="user-summary-label">Primary phone</p>
              <p class="user-summary-value">
                ${primaryPhone
                  ? `<a class="user-summary-phone" href="${primaryPhoneHref}">${primaryPhoneEscaped}</a>`
                  : '—'}
              </p>
              <p class="user-summary-sub">${escapeHtml(phoneCoverageText)}</p>
            </article>
            <article class="user-summary-item">
              <p class="user-summary-label">Total paid with us</p>
              <p class="user-summary-value">${totalPaidLabel}</p>
              <p class="user-summary-sub">Shop net + service bookings treated as paid after deposit payment</p>
            </article>
            <article class="user-summary-item">
              <p class="user-summary-label">Shop paid (net)</p>
              <p class="user-summary-value">${shopNetPaidLabel}</p>
              <p class="user-summary-sub">
                Gross: ${shopGrossPaidLabel}
                ${hasMoney(shopRefundByCurrency) ? ` · Refunds: ${shopRefundLabel}` : ''}
              </p>
            </article>
            <article class="user-summary-item">
              <p class="user-summary-label">Services counted as paid</p>
              <p class="user-summary-value">${servicePaidByDepositRuleLabel}</p>
              <p class="user-summary-sub">
                ${paidDepositCount} paid deposit${paidDepositCount === 1 ? '' : 's'} ·
                ${paidDepositLinkedBookingCount} booking${paidDepositLinkedBookingCount === 1 ? '' : 's'} counted as fully paid ·
                Deposits collected: ${serviceDepositsPaidLabel}
              </p>
            </article>
            <article class="user-summary-item">
              <p class="user-summary-label">Service booking value</p>
              <p class="user-summary-value">${serviceBookingValueLabel}</p>
              <p class="user-summary-sub">Indicative value of car/trip/hotel bookings</p>
            </article>
            <article class="user-summary-item">
              <p class="user-summary-label">Order volume</p>
              <p class="user-summary-value">${totalOrdersCount + totalBookingsCount}</p>
              <p class="user-summary-sub">${totalOrdersCount} shop orders · ${totalBookingsCount} service bookings</p>
            </article>
          </div>
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Services (bookings & deposits)</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Service deposits</h5>
              ${serviceDepositsHtml}
            </div>
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Car bookings</h5>
              ${renderServiceBookingsTable(carBookings, 'cars')}
            </div>
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Trip bookings</h5>
              ${renderServiceBookingsTable(tripBookings, 'trips')}
            </div>
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Hotel bookings</h5>
              ${renderServiceBookingsTable(hotelBookings, 'hotels')}
            </div>
          </div>
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Shop</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Latest shipping address (from last order)</h5>
              ${renderInlineAddress(latestShippingAddress)}
            </div>
            <div style="padding: 12px; background: var(--admin-bg); border-radius: 8px;">
              <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Saved shop addresses</h5>
              ${shopAddressesHtml}
            </div>
          </div>
          <div style="margin-top: 16px;">
            <h5 style="margin: 0 0 8px; font-size: 13px; color: var(--admin-text-muted);">Orders</h5>
            ${shopOrdersHtml}
          </div>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Edit profile</h4>
          <form id="userProfileForm" class="user-detail-form" onsubmit="handleUserProfileSubmit(event, '${userId}')">
            <div class="user-detail-form-grid">
              <label class="admin-form-field">
                <span>Username</span>
                <input type="text" name="username" value="${usernameEscaped}" maxlength="32" />
              </label>
              <label class="admin-form-field">
                <span>Display name</span>
                <input type="text" name="name" value="${nameEscaped}" maxlength="64" />
              </label>
              <label class="admin-form-field">
                <span>XP</span>
                <input type="number" name="xp" min="0" step="1" value="${Number.isFinite(profile.xp) ? profile.xp : 0}" />
              </label>
              <label class="admin-form-field">
                <span>Level</span>
                <input type="number" name="level" min="0" step="1" value="${Number.isFinite(profile.level) ? profile.level : 0}" />
              </label>
              <label class="admin-form-field">
                <span>Role</span>
                <select name="role" ${isSelf ? 'disabled' : ''}>
                  <option value="user" ${!isCurrentUserAdmin && !profile.is_moderator ? 'selected' : ''}>User</option>
                  <option value="moderator" ${!isCurrentUserAdmin && profile.is_moderator ? 'selected' : ''}>Moderator</option>
                  <option value="admin" ${isCurrentUserAdmin ? 'selected' : ''}>Admin</option>
                </select>
              </label>
            </div>
            ${isSelf ? '<p class="user-detail-hint">You cannot remove admin access from your own account.</p>' : ''}
            <div class="user-detail-actions">
              <button type="submit" class="btn-primary">Save profile changes</button>
            </div>
          </form>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Account controls</h4>
          <form
            id="userAccountForm"
            class="user-detail-form"
            onsubmit="handleUserAccountSubmit(event, '${userId}')"
            data-original-email="${emailEscaped}"
            data-original-password-flag="${profile.require_password_change ? 'true' : 'false'}"
            data-original-email-flag="${profile.require_email_update ? 'true' : 'false'}"
          >
            <label class="admin-form-field">
              <span>Email address</span>
              <input type="email" name="email" value="${emailEscaped}" required />
            </label>
            <div class="user-detail-switches">
              <label class="admin-checkbox">
                <input type="checkbox" name="requirePasswordChange" ${profile.require_password_change ? 'checked' : ''} />
                <span>Require password change on next login</span>
              </label>
              <label class="admin-checkbox">
                <input type="checkbox" name="requireEmailUpdate" ${profile.require_email_update ? 'checked' : ''} />
                <span>Require user to verify or update email</span>
              </label>
            </div>
            <div class="user-detail-actions">
              <button type="submit" class="btn-secondary">Save account settings</button>
            </div>
          </form>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Password & access</span>
            <div class="user-detail-inline-actions">
              <button class="btn-secondary" type="button" onclick="handleSendPasswordReset('${userId}')">Send reset link</button>
              <button class="btn-secondary" type="button" onclick="handleSendMagicLink('${userId}')">Send magic link</button>
              <button class="btn-secondary" type="button" onclick="handleResendVerificationEmail('${userId}')">Resend verification email</button>
              <input class="admin-inline-input" type="text" placeholder="Temporary password" oninput="this.dataset.pwd=this.value" />
              <button class="btn-secondary" type="button" onclick="handleSetTempPassword('${userId}', this.previousElementSibling.dataset.pwd||'')">Set temporary</button>
            </div>
          </div>
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Moderation tools</h4>
          ${!isSelf ? `
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Quick XP adjustments</span>
            <div class="user-detail-inline-actions">
              <button class="btn-primary" type="button" onclick="handleUserXpAdjustment('${userId}', 100)">+100 XP</button>
              <button class="btn-primary" type="button" onclick="handleUserXpAdjustment('${userId}', 500)">+500 XP</button>
              <button class="btn-secondary" type="button" onclick="handleUserXpAdjustment('${userId}', -100)">-100 XP</button>
              <button class="btn-secondary" type="button" onclick="handleUserXpAdjustment('${userId}', -500)">-500 XP</button>
            </div>
          </div>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Set XP / Level</span>
            <div class="user-detail-inline-actions">
              <input class="admin-inline-input" type="number" min="0" step="1" placeholder="XP" oninput="this.dataset.xp=this.value" />
              <input class="admin-inline-input" type="number" min="0" step="1" placeholder="Level" oninput="this.dataset.level=this.value" />
              <button class="btn-primary" type="button" onclick="handleSetXpLevel('${userId}', this.previousElementSibling.dataset.level||'', this.previousElementSibling.previousElementSibling.dataset.xp||'')">Save</button>
            </div>
          </div>
          <div class="user-detail-actions-group">
            <span class="user-detail-actions-label">Account status</span>
            <div class="user-detail-inline-actions">
              ${bannedUntil
                ? `<button type="button" class="btn-primary" onclick="handleUserBanToggle('${userId}', true)">Remove ban</button>`
                : `<button type="button" class="btn-secondary user-detail-danger" onclick="handleUserBanToggle('${userId}', false)">Ban user (30 days)</button>`}
            </div>
          </div>
          ` : '<p class="user-detail-hint">You cannot moderate your own account.</p>'}
        </section>

        <section class="user-detail-card">
          <h4 class="user-detail-section-title">Advanced moderation</h4>
          ${!isSelf ? `
          <form class="user-detail-form" onsubmit="handleUserBanForm(event, '${userId}')">
            <div class="user-detail-form-grid">
              <label class="admin-form-field">
                <span>Ban duration</span>
                <select name="duration">
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="permanent">Permanent</option>
                  <option value="custom">Custom date</option>
                </select>
              </label>
              <label class="admin-form-field">
                <span>Custom until</span>
                <input type="datetime-local" name="until" />
              </label>
              <label class="admin-form-field">
                <span>Reason</span>
                <input type="text" name="reason" maxlength="200" placeholder="Optional reason" />
              </label>
              <label class="admin-checkbox">
                <input type="checkbox" name="block_email" />
                <span>Also block this email</span>
              </label>
            </div>
            <div class="user-detail-inline-actions">
              ${bannedUntil
                ? `<button type="button" class="btn-primary" onclick="handleUserBanToggle('${userId}', true)">Remove ban</button>`
                : '<button type="submit" class="btn-secondary user-detail-danger">Ban user</button>'}
            </div>
          </form>
          ` : '<p class="user-detail-hint">Self-ban is disabled.</p>'}
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Activity statistics</h4>
          <div class="user-detail-stats-grid">
            <div>
              <p class="user-detail-stat-label">Comments</p>
              <p class="user-detail-stat-value">${stats.comments || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Ratings</p>
              <p class="user-detail-stat-value">${stats.ratings || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Visits</p>
              <p class="user-detail-stat-value">${stats.visits || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Completed tasks</p>
              <p class="user-detail-stat-value">${stats.completed_tasks || 0}</p>
            </div>
            <div>
              <p class="user-detail-stat-label">Total XP earned</p>
              <p class="user-detail-stat-value">${stats.total_xp || profile.xp || 0}</p>
            </div>
          </div>
        </section>

        <section class="user-detail-card user-detail-card--full">
          <h4 class="user-detail-section-title">Danger zone</h4>
          ${!isSelf ? `
            <div class="user-detail-danger-zone">
              <p class="user-detail-hint">
                Permanently removes this user from Auth, profile, bookings/orders linked by account or email, referral links, and user storage files.
                This action cannot be undone.
              </p>
              <div class="user-detail-actions">
                <button
                  type="button"
                  class="btn-secondary user-detail-danger"
                  onclick="handleHardDeleteUser('${userId}', '${safeEmailForJs}', '${safeLabelForJs}')"
                >
                  Delete user permanently
                </button>
              </div>
            </div>
          ` : '<p class="user-detail-hint">Self-delete is blocked in admin.</p>'}
        </section>
      </div>
    `;

    const accountForm = content.querySelector('#userAccountForm');
    if (accountForm) {
      accountForm.dataset.originalEmail = authEmail;
      accountForm.dataset.originalPasswordFlag = profile.require_password_change ? 'true' : 'false';
      accountForm.dataset.originalEmailFlag = profile.require_email_update ? 'true' : 'false';
    }

    showElement(modal);

    try {
      await loadUserAffiliateReferralOptions(userId, profile.referred_by);

      const referralSelect = document.getElementById('userReferralReferrerSelect');
      const btnApply = document.getElementById('btnUserReferralApply');
      const btnClear = document.getElementById('btnUserReferralClear');

      if (btnApply) {
        btnApply.onclick = async () => {
          const nextReferrer = String(referralSelect?.value || '').trim() || null;
          const ok = confirm('Set this user\'s referrer (affiliate)?');
          if (!ok) return;
          await setUserReferredBy(userId, nextReferrer);
        };
      }

      if (btnClear) {
        btnClear.onclick = async () => {
          const ok = confirm('Clear this user\'s referrer (affiliate)?');
          if (!ok) return;
          if (referralSelect) referralSelect.value = '';
          await setUserReferredBy(userId, null);
        };
      }
    } catch (_e) {
    }

    await renderUserPartnerAccess(userId);

    try {
      await renderUserPartnerPayoutDetails(userId);
    } catch (_e) {
    }

  } catch (error) {
    console.error('Failed to load user details:', error);
    showToast('Failed to load user details', 'error');
  }
}

async function handleUserProfileSubmit(event, userId) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const client = ensureSupabase();

  if (!client) {
    showToast('Database connection not available', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');

  const username = (formData.get('username') || '').toString().trim();
  const displayName = (formData.get('name') || '').toString().trim();
  const xpRaw = (formData.get('xp') || '').toString().trim();
  const levelRaw = (formData.get('level') || '').toString().trim();
  const role = (formData.get('role') || '').toString();
  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator';

  const xpValue = xpRaw === '' ? null : Number.parseInt(xpRaw, 10);
  const levelValue = levelRaw === '' ? null : Number.parseInt(levelRaw, 10);

  if (xpValue !== null && Number.isNaN(xpValue)) {
    showToast('Invalid XP value provided', 'error');
    return;
  }

  if (levelValue !== null && Number.isNaN(levelValue)) {
    showToast('Invalid level value provided', 'error');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    showToast('Saving profile changes...', 'info');

    const { error } = await client.rpc('admin_update_user_profile', {
      target_user_id: userId,
      new_username: username || null,
      new_name: displayName || null,
      new_xp: xpValue,
      new_level: levelValue,
      new_is_admin: isAdmin,
      new_is_moderator: isModerator,
    });

    if (error) {
      throw error;
    }

    showToast('Profile updated successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    await viewUserDetails(userId);

  } catch (error) {
    console.error('Failed to update profile:', error);
    showToast('Failed to update profile: ' + (error.message || 'Unknown error'), 'error');

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleUserAccountSubmit(event, userId) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const client = ensureSupabase();

  if (!client) {
    showToast('Database connection not available', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');

  const email = (formData.get('email') || '').toString().trim();
  const requirePasswordChange = formData.get('requirePasswordChange') === 'on';
  const requireEmailUpdate = formData.get('requireEmailUpdate') === 'on';

  const originalEmail = (form.dataset.originalEmail || '').trim();
  const originalPasswordFlag = form.dataset.originalPasswordFlag === 'true';
  const originalEmailFlag = form.dataset.originalEmailFlag === 'true';

  const payload = {};
  if (email !== originalEmail) payload.email = email;
  if (requirePasswordChange !== originalPasswordFlag) payload.require_password_change = requirePasswordChange;
  if (requireEmailUpdate !== originalEmailFlag) payload.require_email_update = requireEmailUpdate;

  if (Object.keys(payload).length === 0) {
    showToast('No account changes detected', 'info');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    showToast('Applying account updates...', 'info');
    await apiRequest(`/users/${userId}/account`, { method: 'POST', body: JSON.stringify(payload) });

    if (payload.require_email_update === true && originalEmailFlag === false) {
      try {
        await apiRequest(`/users/${userId}/verification`, {
          method: 'POST',
          body: JSON.stringify({ action: 'resend_signup' }),
        });
        showToast('Verification email resent', 'success');
      } catch (_e) {
      }
    }

    showToast('Account settings updated', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    await viewUserDetails(userId);

  } catch (error) {
    console.error('Failed to update account settings:', error);
    showToast('Failed to update account settings: ' + (error.message || 'Unknown error'), 'error');

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function handleUserXpAdjustment(userId, change) {
  const success = await adjustUserXP(userId, change);
  if (success) {
    await viewUserDetails(userId);
  }
}

async function handleUserBanToggle(userId, isCurrentlyBanned) {
  let success = false;
  if (isCurrentlyBanned) {
    success = await unbanUser(userId);
  } else {
    success = await banUser(userId);
  }

  if (success) {
    await viewUserDetails(userId);
  }
}

async function handleSendPasswordReset(userId) {
  try {
    const result = await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' }),
    });

    if (result && result.link) {
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(result.link);
          showToast('Password reset link generated and copied to clipboard', 'success');
          return;
        }
      } catch (_) {
        // Fallback to normal toast below
      }
      showToast('Password reset link generated. Copy it from the console/network response.', 'success');
    } else {
      showToast('Password reset link generated', 'success');
    }
  } catch (e) {
    showToast('Failed to generate reset link: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleSendMagicLink(userId) {
  try {
    const result = await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'magic_link' }),
    });

    if (result && result.link) {
      try {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(result.link);
          showToast('Magic link generated and copied to clipboard', 'success');
          return;
        }
      } catch (_) {
        // Fallback to normal toast below
      }
      showToast('Magic link generated. Copy it from the console/network response.', 'success');
    } else {
      showToast('Magic link generated', 'success');
    }
  } catch (e) {
    showToast('Failed to generate magic link: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function handleResendVerificationEmail(userId) {
  try {
    await apiRequest(`/users/${userId}/verification`, {
      method: 'POST',
      body: JSON.stringify({ action: 'resend_signup' }),
    });
    showToast('Verification email resent', 'success');
  } catch (e) {
    showToast('Failed to resend verification email: ' + (e.message || 'Unknown error'), 'error');
  }
}
 
async function handleSetTempPassword(userId, tempPwd) {
  const pwd = (tempPwd || '').trim();
  if (pwd.length < 8) {
    showToast('Temporary password must be at least 8 characters', 'error');
    return;
  }
  try {
    await apiRequest(`/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ action: 'set_temporary', temp_password: pwd }),
    });
    showToast('Temporary password set', 'success');
  } catch (e) {
    showToast('Failed to set temporary password: ' + (e.message || 'Unknown error'), 'error');
  }
}

function buildUserDeleteImpactSummary(preview) {
  const counts = preview && typeof preview === 'object' ? (preview.counts || {}) : {};
  const labels = [
    ['profiles', 'profile'],
    ['shop_orders_user', 'shop orders (user_id)'],
    ['shop_orders_email', 'shop orders (email)'],
    ['service_deposit_requests', 'service deposits'],
    ['car_bookings', 'car bookings'],
    ['trip_bookings', 'trip bookings'],
    ['hotel_bookings', 'hotel bookings'],
    ['recommendation_views', 'recommendation views'],
    ['recommendation_clicks', 'recommendation clicks'],
    ['recommendations_created_by', 'recommendations authored'],
    ['recommendations_updated_by', 'recommendations edited'],
    ['poi_comments', 'comments'],
    ['poi_ratings', 'ratings'],
    ['completed_tasks', 'completed tasks'],
    ['referrals_as_referrer', 'referrals as referrer'],
    ['referrals_as_referred', 'referrals as referred'],
  ];
  const rows = labels
    .map(([key, label]) => ({ label, value: Number(counts[key] || 0) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalRecords = Number(preview?.total_records || 0);
  const visibleRows = rows.slice(0, 10);
  const lines = [];
  lines.push(`Linked records found: ${totalRecords}`);
  if (!visibleRows.length) {
    lines.push('No linked records were detected in tracked tables.');
  } else {
    visibleRows.forEach((row) => {
      lines.push(`- ${row.label}: ${row.value}`);
    });
    if (rows.length > visibleRows.length) {
      lines.push(`- +${rows.length - visibleRows.length} more tracked groups`);
    }
  }
  return lines.join('\n');
}

function openHardDeleteConfirmationModal(params) {
  const label = String(params?.label || 'user').trim();
  const impactSummary = String(params?.impactSummary || '').trim() || 'No linked records were detected in tracked tables.';
  const normalizedExpectedEmail = String(params?.expectedEmail || '').trim().toLowerCase();

  return new Promise((resolve) => {
    const existing = document.getElementById('hardDeleteUserModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.id = 'hardDeleteUserModal';
    modal.innerHTML = `
      <div class="admin-modal-overlay" data-action="cancel"></div>
      <div class="admin-modal-content" style="max-width: 560px;">
        <header class="admin-modal-header">
          <h3>Permanently Delete User</h3>
          <button type="button" class="btn-modal-close" data-action="cancel" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>
        <div class="admin-modal-body">
          <p style="margin: 0 0 8px;">
            This will permanently erase <strong>${escapeHtml(label)}</strong> and related records from database/auth.
          </p>
          <pre style="margin: 0 0 16px; padding: 10px; border-radius: 8px; max-height: 220px; overflow: auto; background: var(--admin-bg); color: var(--admin-text-muted); font-size: 12px; line-height: 1.45;">${escapeHtml(impactSummary)}</pre>
          <form id="hardDeleteUserConfirmForm">
            ${normalizedExpectedEmail
              ? `
                <label class="admin-form-field">
                  <span>Type user email to confirm</span>
                  <input type="email" id="hardDeleteUserConfirmEmail" class="form-control" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${escapeHtml(normalizedExpectedEmail)}" required>
                </label>
              `
              : ''}
            <label class="admin-form-field">
              <span>Type <code>DELETE</code> to confirm</span>
              <input type="text" id="hardDeleteUserConfirmToken" class="form-control" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE" required>
            </label>
            <div class="admin-modal-actions" style="margin-top: 16px;">
              <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
              <button type="submit" class="btn btn-danger">Delete permanently</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.hidden = false;

    const cleanup = (result) => {
      if (modal && modal.parentNode) modal.remove();
      resolve(result);
    };

    modal.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
      btn.addEventListener('click', () => cleanup(null));
    });

    const form = modal.querySelector('#hardDeleteUserConfirmForm');
    const emailInput = modal.querySelector('#hardDeleteUserConfirmEmail');
    const tokenInput = modal.querySelector('#hardDeleteUserConfirmToken');

    if (emailInput) {
      emailInput.focus();
    } else if (tokenInput) {
      tokenInput.focus();
    }

    if (!form || !tokenInput) {
      cleanup(null);
      return;
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const typedEmail = String(emailInput?.value || '').trim().toLowerCase();
      if (normalizedExpectedEmail && typedEmail !== normalizedExpectedEmail) {
        showToast('Deletion cancelled (email confirmation mismatch).', 'info');
        if (emailInput) emailInput.focus();
        return;
      }

      const typedDelete = String(tokenInput.value || '').trim();
      if (typedDelete !== 'DELETE') {
        showToast('Deletion cancelled (confirmation token mismatch).', 'info');
        tokenInput.focus();
        return;
      }

      cleanup({
        confirm_text: typedDelete,
        expected_email: normalizedExpectedEmail || null,
      });
    });
  });
}

async function handleHardDeleteUser(userId, targetEmail, targetLabel) {
  const label = String(targetLabel || targetEmail || userId || 'user').trim();

  try {
    showToast('Preparing delete preview...', 'info');
    const preview = await apiRequest(`/users/${userId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ action: 'preview' }),
    });

    const normalizedTargetEmail = String(targetEmail || preview?.email || '').trim().toLowerCase();
    const impactSummary = buildUserDeleteImpactSummary(preview);
    const confirmation = await openHardDeleteConfirmationModal({
      label,
      expectedEmail: normalizedTargetEmail,
      impactSummary,
    });
    if (!confirmation) {
      showToast('Deletion cancelled.', 'info');
      return;
    }

    showToast('Deleting user permanently...', 'info');
    await apiRequest(`/users/${userId}/delete`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'execute',
        confirm_text: confirmation.confirm_text,
        expected_email: confirmation.expected_email,
      }),
    });

    showToast('User deleted permanently', 'success');
    const modal = document.getElementById('userDetailModal');
    if (modal) hideElement(modal);
    if (adminState.currentView === 'users') {
      await loadUsersData(adminState.usersPage);
    }
  } catch (error) {
    console.error('Failed to hard-delete user:', error);
    showToast('Failed to delete user permanently: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Load user shop information (addresses and orders)
async function loadUserShopInfo(userId) {
  const container = document.getElementById('userShopInfo');
  if (!container) return;
  
  const client = ensureSupabase();
  if (!client) {
    container.innerHTML = '<p style="color: #ef4444;">Database connection error</p>';
    return;
  }
  
  try {
    // Load addresses and orders in parallel
    const [addressesRes, ordersRes] = await Promise.all([
      client
        .from('shop_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default_shipping', { ascending: false })
        .order('updated_at', { ascending: false }),
      client.from('shop_orders').select('id, order_number, status, payment_status, total, currency, created_at, items_count, shipping_address').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
    ]);
    
    const addresses = addressesRes.data || [];
    const orders = ordersRes.data || [];
    
    let html = '<div class="user-shop-sections">';
    
    // Addresses section
    html += '<div class="user-shop-section">';
    html += '<h5 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">📍 Saved Addresses</h5>';
    
    if (addresses.length === 0) {
      html += '<p style="color: var(--admin-text-muted); font-size: 13px;">No saved addresses</p>';
    } else {
      html += '<div class="user-addresses-list">';
      for (const addr of addresses) {
        html += `
          <div class="user-address-card" style="background: var(--admin-bg); padding: 12px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <strong>${escapeHtml(addr.first_name || '')} ${escapeHtml(addr.last_name || '')}</strong>
              ${addr.is_default_shipping ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">Default</span>' : ''}
            </div>
            <div style="color: var(--admin-text-muted); line-height: 1.5;">
              ${escapeHtml(addr.line1 || '')}${addr.line2 ? ', ' + escapeHtml(addr.line2) : ''}<br>
              ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.postal_code || '')} ${escapeHtml(addr.country || '')}<br>
              📞 ${escapeHtml(addr.phone || 'N/A')}
            </div>
          </div>
        `;
      }
      html += '</div>';
    }
    html += '</div>';
    
    // Orders section
    html += '<div class="user-shop-section" style="margin-top: 20px;">';
    html += '<h5 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">📦 Recent Orders</h5>';
    
    if (orders.length === 0) {
      html += '<p style="color: var(--admin-text-muted); font-size: 13px;">No orders yet</p>';
    } else {
      html += '<div class="user-orders-list">';
      html += '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">';
      html += '<thead><tr style="border-bottom: 1px solid var(--admin-border);">';
      html += '<th style="text-align: left; padding: 8px 4px;">Order</th>';
      html += '<th style="text-align: left; padding: 8px 4px;">Date</th>';
      html += '<th style="text-align: left; padding: 8px 4px;">Status</th>';
      html += '<th style="text-align: left; padding: 8px 4px;">Payment</th>';
      html += '<th style="text-align: right; padding: 8px 4px;">Total</th>';
      html += '<th style="text-align: center; padding: 8px 4px;">Action</th>';
      html += '</tr></thead><tbody>';
      
      for (const order of orders) {
        const statusColors = {
          pending: '#f59e0b',
          processing: '#3b82f6',
          shipped: '#8b5cf6',
          delivered: '#22c55e',
          cancelled: '#ef4444'
        };
        const paymentColors = {
          pending: '#f59e0b',
          paid: '#22c55e',
          failed: '#ef4444',
          refunded: '#6b7280'
        };
        
        html += `
          <tr style="border-bottom: 1px solid var(--admin-border);">
            <td style="padding: 10px 4px; font-weight: 500;">#${escapeHtml(order.order_number || order.id.slice(0,8).toUpperCase())}</td>
            <td style="padding: 10px 4px; color: var(--admin-text-muted);">${formatDate(order.created_at)}</td>
            <td style="padding: 10px 4px;">
              <span style="background: ${statusColors[order.status] || '#6b7280'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${order.status}</span>
            </td>
            <td style="padding: 10px 4px;">
              <span style="background: ${paymentColors[order.payment_status] || '#6b7280'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${order.payment_status}</span>
            </td>
            <td style="padding: 10px 4px; text-align: right; font-weight: 600;">€${parseFloat(order.total || 0).toFixed(2)}</td>
            <td style="padding: 10px 4px; text-align: center;">
              <button class="btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="viewShopOrder('${order.id}')">View</button>
            </td>
          </tr>
        `;
      }
      
      html += '</tbody></table>';
      html += '</div>';
    }
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Failed to load user shop info:', error);
    container.innerHTML = '<p style="color: #ef4444;">Failed to load shop information</p>';
  }
}

// Make function global for onclick
window.viewUserDetails = viewUserDetails;
window.handleUserProfileSubmit = handleUserProfileSubmit;
window.handleUserAccountSubmit = handleUserAccountSubmit;
window.handleUserXpAdjustment = handleUserXpAdjustment;
window.handleUserBanToggle = handleUserBanToggle;
window.handleUserBanForm = handleUserBanForm;
window.handleSendPasswordReset = handleSendPasswordReset;
window.handleSendMagicLink = handleSendMagicLink;
window.handleResendVerificationEmail = handleResendVerificationEmail;
window.handleSetTempPassword = handleSetTempPassword;
window.handleHardDeleteUser = handleHardDeleteUser;
window.loadUserShopInfo = loadUserShopInfo;
window.handleSetXpLevel = handleSetXpLevel;

async function handleSetXpLevel(userId, levelStr, xpStr) {
  const xp = xpStr === '' ? null : Number.parseInt(xpStr, 10);
  const level = levelStr === '' ? null : Number.parseInt(levelStr, 10);
  if ((xp !== null && Number.isNaN(xp)) || (level !== null && Number.isNaN(level))) {
    showToast('Invalid XP/Level', 'error');
    return;
  }
  const ok = await setUserXpLevel(userId, xp, level);
  if (ok) await viewUserDetails(userId);
}

async function getAdminAccessToken() {
  const client = ensureSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

async function apiRequest(path, options = {}) {
  const token = await getAdminAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/admin/api${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      const pickText = (...values) => values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .find(Boolean) || '';
      const normalizeError = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'object') {
          const fromObject = pickText(
            value.message,
            value.error,
            value.error_description,
            value.details,
            value.hint,
            value.code,
          );
          if (fromObject) return fromObject;
          try {
            return JSON.stringify(value);
          } catch (_e) {
            return '';
          }
        }
        return '';
      };
      const fromBody = pickText(
        body?.message,
        normalizeError(body?.error),
        body?.error_description,
        body?.details,
        body?.hint,
        body?.code,
      );
      if (fromBody) {
        msg = fromBody;
      } else if (res.status >= 500) {
        msg = `Server error (HTTP ${res.status})`;
      }
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

async function setUserXpLevel(userId, xp, level) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    const { error } = await client.rpc('admin_set_user_xp_level', { target_user_id: userId, xp, level });
    if (error) throw error;
    showToast('XP/Level set', 'success');
    return true;
  } catch (e) {
    console.error(e);
    showToast('Failed to set XP/Level: ' + (e.message || 'Unknown error'), 'error');
    return false;
  }
}

async function handleUserBanForm(event, userId) {
  event.preventDefault();
  const form = event.target;
  const duration = (form.duration.value || '').trim();
  const reason = (form.reason.value || '').trim() || 'Violating terms';
  
  let days = 30;
  if (duration === '7d') days = 7;
  else if (duration === '30d') days = 30;
  else if (duration === '90d') days = 90;
  else if (duration === 'perm') days = 36500; // 100 years ~= permanent
  
  try {
    // Call new version of banUser (without confirm since form already has submit)
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const { error } = await client.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_reason: reason,
      ban_duration: `${days} days`
    });
    
    if (error) throw error;
    
    showToast('User banned successfully', 'success');
    await viewUserDetails(userId);
  } catch (e) {
    console.error(e);
    showToast('Failed to ban user: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function loadQuestsData() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const view = $('#viewQuests');
    if (!view) return;
    const { data, error } = await client
      .from('tasks')
      .select('id,xp,is_active,sort_order,category,title,description,title_i18n,description_i18n,verification_type,unlock_code,latitude,longitude,location_radius,location_name_i18n,recommendation_id')
      .eq('category', 'quest')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    adminState.quests = Array.isArray(data) ? data : [];
    const tbody = $('#questsTableBody');
    if (!tbody) return;
    if (adminState.quests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No quests</td></tr>';
      return;
    }
    tbody.innerHTML = adminState.quests.map(q => {
      const verificationBadge = q.verification_type && q.verification_type !== 'none' 
        ? `<span style="font-size: 0.8em; padding: 2px 6px; border-radius: 4px; background: ${q.verification_type === 'code' ? '#10b981' : q.verification_type === 'location' ? '#3b82f6' : '#8b5cf6'}; color: white;">${q.verification_type === 'code' ? '🔑 Code' : q.verification_type === 'location' ? '📍 GPS' : '🔑📍 Both'}</span>`
        : '';
      return `
      <tr>
        <td>${escapeHtml(q.id)} ${verificationBadge}</td>
        <td>${Number(q.xp)||0}</td>
        <td>${q.is_active ? 'Yes' : 'No'}</td>
        <td>${Number(q.sort_order)||0}</td>
        <td>${q.unlock_code ? '✓' : '—'}</td>
        <td>
          <button class="btn-secondary" onclick="handleQuestEdit('${q.id}')">Edit</button>
          <button class="btn-secondary user-detail-danger" onclick="handleQuestDelete('${q.id}')">Delete</button>
        </td>
      </tr>
    `}).join('');
  } catch (e) {
    showToast('Failed to load quests', 'error');
  }
}

async function openQuestForm(mode, quest) {
  adminState.questFormMode = mode;
  adminState.selectedQuest = quest || null;
  const modal = $('#questFormModal');
  const title = $('#questFormTitle');
  const idInput = $('#questId');
  const xpInput = $('#questXp');
  const sortInput = $('#questSort');
  const activeSelect = $('#questActive');
  
  if (!modal || !title || !idInput || !xpInput || !sortInput || !activeSelect) return;
  
  // Set basic fields
  if (mode === 'edit' && quest) {
    title.textContent = 'Edit Quest';
    idInput.value = quest.id;
    idInput.disabled = true;
    xpInput.value = Number(quest.xp)||0;
    sortInput.value = Number(quest.sort_order)||1000;
    activeSelect.value = quest.is_active ? 'true' : 'false';
  } else {
    title.textContent = 'New Quest';
    idInput.value = '';
    idInput.disabled = false;
    xpInput.value = 0;
    sortInput.value = 1000;
    activeSelect.value = 'true';
  }
  
  // Render i18n components for title and description
  if (window.renderI18nInput) {
    const titleContainer = $('#questTitleI18nContainer');
    const descContainer = $('#questDescriptionI18nContainer');
    
    if (titleContainer) {
      const titleData = (mode === 'edit' && quest?.title_i18n) 
        ? quest.title_i18n 
        : (mode === 'edit' && quest?.title) 
          ? { pl: quest.title } 
          : {};
      
      titleContainer.innerHTML = window.renderI18nInput({
        fieldName: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Quest title',
        currentValues: titleData
      });
    }
    
    if (descContainer) {
      const descData = (mode === 'edit' && quest?.description_i18n) 
        ? quest.description_i18n 
        : (mode === 'edit' && quest?.description) 
          ? { pl: quest.description } 
          : {};
      
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        placeholder: 'Quest description (optional)',
        currentValues: descData
      });
    }
  }
  
  // Set verification fields
  const verifyType = $('#questVerificationType');
  const unlockCode = $('#questUnlockCode');
  const latitude = $('#questLatitude');
  const longitude = $('#questLongitude');
  const locationRadius = $('#questLocationRadius');
  const recommendationSelect = $('#questRecommendationId');
  
  if (mode === 'edit' && quest) {
    if (verifyType) verifyType.value = quest.verification_type || 'none';
    if (unlockCode) unlockCode.value = quest.unlock_code || '';
    if (latitude) latitude.value = quest.latitude || '';
    if (longitude) longitude.value = quest.longitude || '';
    if (locationRadius) locationRadius.value = quest.location_radius || 100;
    if (recommendationSelect) recommendationSelect.value = quest.recommendation_id || '';
  } else {
    if (verifyType) verifyType.value = 'none';
    if (unlockCode) unlockCode.value = '';
    if (latitude) latitude.value = '';
    if (longitude) longitude.value = '';
    if (locationRadius) locationRadius.value = 100;
    if (recommendationSelect) recommendationSelect.value = '';
  }
  
  // Render location name i18n
  const locNameContainer = $('#questLocationNameI18nContainer');
  if (locNameContainer && window.renderI18nInput) {
    const locNameData = (mode === 'edit' && quest?.location_name_i18n) ? quest.location_name_i18n : {};
    locNameContainer.innerHTML = window.renderI18nInput({
      fieldName: 'location_name',
      label: 'Location Name',
      type: 'text',
      placeholder: 'e.g., Local Shop, Beach Bar',
      currentValues: locNameData
    });
  }
  
  // Toggle visibility of verification fields
  toggleQuestVerificationFields(verifyType?.value || 'none');
  
  // Load recommendations for dropdown
  await loadRecommendationsForQuestForm();
  if (mode === 'edit' && quest?.recommendation_id) {
    if (recommendationSelect) recommendationSelect.value = quest.recommendation_id;
  }
  
  showElement(modal);
}

function toggleQuestVerificationFields(type) {
  const codeFields = $('#questCodeFields');
  const locationFields = $('#questLocationFields');
  
  if (codeFields) {
    codeFields.style.display = (type === 'code' || type === 'both') ? 'block' : 'none';
  }
  if (locationFields) {
    locationFields.style.display = (type === 'location' || type === 'both') ? 'block' : 'none';
  }
}

async function loadRecommendationsForQuestForm() {
  const select = $('#questRecommendationId');
  if (!select) return;
  
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: recs, error } = await client
      .from('recommendations')
      .select('id, title_pl, title_en, latitude, longitude')
      .eq('active', true)
      .order('title_en', { ascending: true });
    
    if (error) throw error;
    
    // Keep first option and rebuild
    select.innerHTML = '<option value="">-- None --</option>';
    
    if (Array.isArray(recs)) {
      recs.forEach(rec => {
        const title = rec.title_pl || rec.title_en || 'Unnamed';
        const hasLocation = rec.latitude && rec.longitude;
        const option = document.createElement('option');
        option.value = rec.id;
        option.textContent = `${title}${hasLocation ? ' 📍' : ''}`;
        option.dataset.lat = rec.latitude || '';
        option.dataset.lng = rec.longitude || '';
        select.appendChild(option);
      });
    }
  } catch (e) {
    console.error('Failed to load recommendations for quest form:', e);
  }
}

function handleRecommendationSelect(e) {
  const select = e.target;
  const selectedOption = select.options[select.selectedIndex];
  
  if (!selectedOption || !selectedOption.value) return;
  
  const lat = selectedOption.dataset.lat;
  const lng = selectedOption.dataset.lng;
  
  if (lat && lng) {
    const latInput = $('#questLatitude');
    const lngInput = $('#questLongitude');
    
    // Only fill if empty
    if (latInput && !latInput.value) latInput.value = lat;
    if (lngInput && !lngInput.value) lngInput.value = lng;
    
    showToast('Location auto-filled from recommendation', 'info');
  }
}

async function handleQuestDelete(id) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    const { error } = await client.from('tasks').delete().eq('id', id);
    if (error) throw error;
    showToast('Quest deleted', 'success');
    await loadQuestsData();
  } catch (e) {
    showToast('Failed to delete quest', 'error');
  }
}

function handleQuestEdit(id) {
  const q = adminState.quests.find(x => x.id === id);
  openQuestForm('edit', q || null);
}

async function handleQuestFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const client = ensureSupabase();
  if (!client) return;
  
  // Get basic fields
  const id = ($('#questId').value || '').trim();
  const xp = Number($('#questXp').value || '0') || 0;
  const sort_order = Number($('#questSort').value || '1000') || 1000;
  const is_active = $('#questActive').value === 'true';
  
  // Get verification fields
  const verification_type = $('#questVerificationType')?.value || 'none';
  const unlock_code = ($('#questUnlockCode')?.value || '').trim().toUpperCase() || null;
  const latitude = $('#questLatitude')?.value ? parseFloat($('#questLatitude').value) : null;
  const longitude = $('#questLongitude')?.value ? parseFloat($('#questLongitude').value) : null;
  const location_radius = parseInt($('#questLocationRadius')?.value) || 100;
  const recommendation_id = $('#questRecommendationId')?.value || null;
  
  // Validate verification settings
  if (verification_type === 'code' || verification_type === 'both') {
    if (!unlock_code || unlock_code.length < 4) {
      showToast('Unlock code must be at least 4 characters', 'error');
      return;
    }
  }
  
  if (verification_type === 'location' || verification_type === 'both') {
    if (!latitude || !longitude) {
      showToast('Latitude and Longitude are required for location verification', 'error');
      return;
    }
  }
  
  // Extract i18n values
  const fd = new FormData($('#questForm'));
  const titleI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'title') : null;
  const descriptionI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'description') : null;
  const locationNameI18n = window.extractI18nValues ? window.extractI18nValues(fd, 'location_name') : null;
  
  // Validate title (at least one language required)
  if (window.validateI18nField) {
    const titleError = window.validateI18nField(titleI18n, 'Title');
    if (titleError) {
      showToast(titleError, 'error');
      return;
    }
  }
  
  // Build payload
  const payload = { 
    id, 
    xp, 
    sort_order, 
    is_active, 
    category: 'quest',
    verification_type,
    unlock_code: (verification_type === 'code' || verification_type === 'both') ? unlock_code : null,
    latitude: (verification_type === 'location' || verification_type === 'both') ? latitude : null,
    longitude: (verification_type === 'location' || verification_type === 'both') ? longitude : null,
    location_radius: (verification_type === 'location' || verification_type === 'both') ? location_radius : 100,
    recommendation_id: recommendation_id || null
  };
  
  // Add i18n fields
  if (titleI18n) payload.title_i18n = titleI18n;
  if (descriptionI18n) payload.description_i18n = descriptionI18n;
  if (locationNameI18n && (verification_type === 'location' || verification_type === 'both')) {
    payload.location_name_i18n = locationNameI18n;
  }
  
  // Clean legacy fields (for backward compatibility)
  payload.title = null;
  payload.description = null;
  
  try {
    const { error } = await client.from('tasks').upsert(payload);
    if (error) throw error;
    showToast('Quest saved', 'success');
    hideElement($('#questFormModal'));
    await loadQuestsData();
  } catch (e) {
    console.error('Quest save error:', e);
    showToast('Failed to save quest: ' + (e.message || 'Unknown error'), 'error');
  }
}

window.handleQuestDelete = handleQuestDelete;
window.handleQuestEdit = handleQuestEdit;

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = $('#btnAddQuest');
  if (addBtn) addBtn.addEventListener('click', () => openQuestForm('create'));
  const refreshBtn = $('#btnRefreshQuests');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadQuestsData());
  const closeBtn = $('#btnCloseQuestForm');
  if (closeBtn) closeBtn.addEventListener('click', () => hideElement($('#questFormModal')));
  const cancelBtn = $('#questFormCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => hideElement($('#questFormModal')));
  const form = $('#questForm');
  if (form) form.addEventListener('submit', handleQuestFormSubmit);
  
  // Verification type toggle
  const verifyTypeSelect = $('#questVerificationType');
  if (verifyTypeSelect) {
    verifyTypeSelect.addEventListener('change', (e) => toggleQuestVerificationFields(e.target.value));
  }
  
  // Recommendation select - auto-fill location
  const recSelect = $('#questRecommendationId');
  if (recSelect) {
    recSelect.addEventListener('change', handleRecommendationSelect);
  }
});

// =====================================================
// CARS MANAGEMENT
// =====================================================

const CAR_COUPON_ALLOWED_STATUSES = new Set(['draft', 'active', 'paused', 'expired']);
const CAR_COUPON_ALLOWED_DISCOUNT_TYPES = new Set(['percent', 'fixed']);
const CAR_COUPON_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const carsUiState = {
  activeTab: 'bookings',
};

const CARS_LIVE_REFRESH_MS = 45000;
let carsLiveRefreshTimer = null;
let carsLiveRefreshRunning = false;

const carCouponsState = {
  loading: false,
  loaded: false,
  items: [],
  usageByCouponId: {},
  partners: [],
  partnersById: {},
  scopeOptionsLoaded: false,
  offerOptions: [],
  modelOptions: [],
  typeOptions: [],
  filters: {
    search: '',
    status: '',
    activity: '',
    discountType: '',
    partnerId: '',
  },
};

function normalizeCarsTabValue(value) {
  const tab = String(value || '').trim().toLowerCase();
  if (tab === 'coupons') return 'coupons';
  if (tab === 'fleet') return 'fleet';
  return 'bookings';
}

function getActiveCarsTab() {
  const active = document.querySelector('.cars-tab-button.active');
  const tab = normalizeCarsTabValue(active?.dataset?.tab || carsUiState.activeTab || 'bookings');
  carsUiState.activeTab = tab;
  return tab;
}

function isCarsViewActive() {
  const view = document.getElementById('viewCars');
  return Boolean(view && !view.hidden && view.classList.contains('active'));
}

function formatCarsSyncTime(date = new Date()) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function setCarsLiveSyncStatus(message, state = 'idle') {
  const el = document.getElementById('carsLiveSyncStatus');
  if (!el) return;
  el.textContent = String(message || '').trim();
  el.dataset.state = String(state || 'idle').trim();
}

function markCarsLiveSyncUpdated() {
  if (!isCarsViewActive()) return;
  setCarsLiveSyncStatus(`Live sync: updated ${formatCarsSyncTime()}`, 'ok');
}

function markCarsLiveSyncError() {
  if (!isCarsViewActive()) return;
  setCarsLiveSyncStatus(`Live sync: error ${formatCarsSyncTime()}`, 'error');
}

async function refreshCarsActiveTabData(options = {}) {
  const { silent = true, showSuccessToast = false, forcePartnersRefresh = false } = options;
  const activeTab = getActiveCarsTab();

  if (activeTab === 'coupons') {
    await loadCarCouponsData({ silent, showSuccessToast, forcePartnersRefresh });
    return;
  }

  if (activeTab === 'fleet') {
    await loadFleetData({ silent, showSuccessToast });
    return;
  }

  await loadCarsData({ silent, showSuccessToast });
}

function startCarsLiveRefresh() {
  if (carsLiveRefreshTimer) return;
  carsLiveRefreshTimer = window.setInterval(async () => {
    if (!isCarsViewActive() || document.hidden || carsLiveRefreshRunning) return;
    carsLiveRefreshRunning = true;
    try {
      await refreshCarsActiveTabData({ silent: true });
    } finally {
      carsLiveRefreshRunning = false;
    }
  }, CARS_LIVE_REFRESH_MS);
}

function stopCarsLiveRefresh() {
  if (!carsLiveRefreshTimer) return;
  window.clearInterval(carsLiveRefreshTimer);
  carsLiveRefreshTimer = null;
  carsLiveRefreshRunning = false;
}

function normalizeI18nText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return String(value.pl || value.en || value.el || value.he || '').trim();
  }
  return '';
}

function normalizeCouponArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function parseCouponListInput(value) {
  return Array.from(new Set(
    String(value || '')
      .split(/[\n,;]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));
}

function parseCouponOptionalInteger(value, label, minValue = 1) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minValue) {
    throw new Error(`${label} must be an integer >= ${minValue}`);
  }
  return parsed;
}

function parseCouponOptionalNumber(value, label, minValue = 0) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    throw new Error(`${label} must be a number >= ${minValue}`);
  }
  return Number(parsed.toFixed(2));
}

function parseCouponRequiredNumber(value, label, minValue = 0.01) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < minValue) {
    throw new Error(`${label} must be a number >= ${minValue}`);
  }
  return Number(parsed.toFixed(2));
}

function parseCouponDateTimeLocal(value, label) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for ${label}`);
  }
  return date.toISOString();
}

function parseCouponDateStart(value, label) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = `${raw}T00:00:00.000Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new Error(`Invalid date for ${label}`);
  }
  return iso;
}

function parseCouponDateEnd(value, label) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = `${raw}T23:59:59.999Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new Error(`Invalid date for ${label}`);
  }
  return iso;
}

function toDateTimeLocalInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatCouponDateTime(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleString();
}

function formatCouponDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleDateString();
}

function setCarsCouponsViewError(message) {
  const el = $('#carsCouponsError');
  if (!el) return;
  const text = String(message || '').trim();
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.hidden = false;
}

function setCarCouponFormError(message) {
  const el = $('#carCouponFormError');
  if (!el) return;
  const text = String(message || '').trim();
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.hidden = false;
}

function getCarCouponUsage(couponId) {
  if (!couponId) {
    return {
      redemptionCount: 0,
      totalDiscountAmount: 0,
      lastRedeemedAt: null,
    };
  }
  const row = carCouponsState.usageByCouponId[couponId];
  return {
    redemptionCount: Number(row?.redemptionCount || 0),
    totalDiscountAmount: Number(row?.totalDiscountAmount || 0),
    lastRedeemedAt: row?.lastRedeemedAt || null,
  };
}

function getCarCouponPartnerLabel(partnerId) {
  if (!partnerId) return '—';
  const row = carCouponsState.partnersById[partnerId];
  if (row && row.name) return row.name;
  return `${String(partnerId).slice(0, 8)}…`;
}

function formatCouponDiscount(coupon) {
  const type = String(coupon?.discount_type || '').trim();
  const value = Number(coupon?.discount_value || 0);
  if (!Number.isFinite(value)) return '—';
  if (type === 'percent') return `${value.toFixed(2)}%`;
  const currency = String(coupon?.currency || 'EUR').toUpperCase();
  if (currency === 'EUR') return `€${value.toFixed(2)}`;
  return `${value.toFixed(2)} ${currency}`;
}

function formatCouponWindow(coupon) {
  if (!coupon?.starts_at && !coupon?.expires_at) return 'No rental date limit';
  const starts = formatCouponDate(coupon?.starts_at, 'Any');
  const ends = formatCouponDate(coupon?.expires_at, 'Any');
  return `${starts} → ${ends}`;
}

function formatCouponLimits(coupon) {
  if (coupon?.single_use) return 'Single use';
  const parts = [];
  if (Number.isInteger(coupon?.usage_limit_total)) parts.push(`Total: ${coupon.usage_limit_total}`);
  if (Number.isInteger(coupon?.usage_limit_per_user)) parts.push(`Per user: ${coupon.usage_limit_per_user}`);
  if (Number.isInteger(coupon?.min_rental_days)) parts.push(`Min days: ${coupon.min_rental_days}`);
  if (Number.isFinite(Number(coupon?.min_rental_total))) {
    parts.push(`Min total: ${formatCurrencyEUR(coupon.min_rental_total)}`);
  }
  return parts.length ? parts.join(' · ') : 'No limits';
}

function formatCouponScope(coupon) {
  const includes = [];
  const excludes = [];

  const locations = normalizeCouponArray(coupon?.applicable_locations);
  if (locations.length) includes.push(`Locations: ${locations.map((v) => v.toUpperCase()).join(', ')}`);

  const offerIds = normalizeCouponArray(coupon?.applicable_offer_ids);
  if (offerIds.length) includes.push(`Offers: ${offerIds.length}`);

  const carModels = normalizeCouponArray(coupon?.applicable_car_models);
  if (carModels.length) includes.push(`Models: ${carModels.length}`);

  const carTypes = normalizeCouponArray(coupon?.applicable_car_types);
  if (carTypes.length) includes.push(`Types: ${carTypes.length}`);

  const excludedOfferIds = normalizeCouponArray(coupon?.excluded_offer_ids);
  if (excludedOfferIds.length) excludes.push(`Offers: ${excludedOfferIds.length}`);

  const excludedCarModels = normalizeCouponArray(coupon?.excluded_car_models);
  if (excludedCarModels.length) excludes.push(`Models: ${excludedCarModels.length}`);

  const excludedCarTypes = normalizeCouponArray(coupon?.excluded_car_types);
  if (excludedCarTypes.length) excludes.push(`Types: ${excludedCarTypes.length}`);

  const includeText = includes.length ? includes.join(' · ') : 'All cars/offers';
  const excludeText = excludes.length ? `Exclude ${excludes.join(' · ')}` : '';
  return { includeText, excludeText };
}

function normalizeCouponStatusClass(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active') return 'badge-success';
  if (s === 'paused') return 'badge-warning';
  if (s === 'expired') return 'badge-danger';
  if (s === 'draft') return 'badge';
  return 'badge';
}

function getCarBookingEffectivePriceMeta(booking) {
  const rawAmount = booking?.final_price ?? booking?.final_rental_price ?? booking?.quoted_price ?? booking?.total_price;
  const amount = Number(rawAmount);
  const hasAmount = Number.isFinite(amount);
  const source = booking?.final_price != null
    ? 'final_price'
    : booking?.final_rental_price != null
      ? 'final_rental_price'
      : booking?.quoted_price != null
        ? 'quoted_price'
        : booking?.total_price != null
          ? 'total_price'
          : null;
  const baseRaw = booking?.base_rental_price ?? booking?.quoted_price ?? booking?.total_price;
  const baseAmount = Number(baseRaw);
  const discountRaw = booking?.coupon_discount_amount;
  const discountAmount = Number(discountRaw);

  return {
    amount: hasAmount ? amount : 0,
    hasAmount,
    source,
    currency: String(booking?.currency || 'EUR').trim().toUpperCase() || 'EUR',
    couponCode: String(booking?.coupon_code || '').trim().toUpperCase(),
    baseAmount: Number.isFinite(baseAmount) ? baseAmount : null,
    discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
  };
}

async function fetchCarBookingsCount(client, statuses = []) {
  let query = client
    .from('car_bookings')
    .select('id', { count: 'exact', head: true });

  if (Array.isArray(statuses) && statuses.length === 1) {
    query = query.eq('status', statuses[0]);
  } else if (Array.isArray(statuses) && statuses.length > 1) {
    query = query.in('status', statuses);
  }

  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function fetchCarBookingsRevenueTotal(client) {
  const pageSize = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    const { data, error } = await client
      .from('car_bookings')
      .select('final_price, final_rental_price, quoted_price, total_price, coupon_code, coupon_discount_amount, base_rental_price, currency')
      .in('status', ['confirmed', 'completed'])
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) break;

    rows.forEach((row) => {
      const priceMeta = getCarBookingEffectivePriceMeta(row);
      if (priceMeta.hasAmount) {
        total += priceMeta.amount;
      }
    });

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return Number(total.toFixed(2));
}

async function loadCarsData(options = {}) {
  const { silent = false, showSuccessToast = false } = options;
  try {
    const client = ensureSupabase();
    if (!client) {
      if (!silent) {
        showToast('Database connection not available', 'error');
      }
      markCarsLiveSyncError();
      return;
    }

    console.log('Loading car bookings data...');

    // Load car bookings - NO RPC, NO JOIN, just simple select
    const { data: bookings, error } = await client
      .from('car_bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading car bookings:', error);
      throw error;
    }

    console.log('Car bookings loaded:', bookings);
    console.log('Total bookings count:', bookings?.length || 0);

    // Calculate stats from full dataset (not only the visible table page)
    const [totalBookings, activeRentals, pendingBookings, totalRevenue] = await Promise.all([
      fetchCarBookingsCount(client),
      fetchCarBookingsCount(client, ['active']),
      fetchCarBookingsCount(client, ['pending', 'message_sent']),
      fetchCarBookingsRevenueTotal(client),
    ]);

    // Update stats cards
    const statTotalBookings = $('#statTotalBookings');
    const statActiveRentals = $('#statActiveRentals');
    const statPendingBookings = $('#statPendingBookings');
    const statTotalRevenue = $('#statTotalRevenue');

    if (statTotalBookings) {
      statTotalBookings.textContent = totalBookings;
      const changeEl = statTotalBookings.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = `${totalBookings} in database`;
    }
    
    if (statActiveRentals) {
      statActiveRentals.textContent = activeRentals;
      const changeEl = statActiveRentals.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Currently active';
    }
    
    if (statPendingBookings) {
      statPendingBookings.textContent = pendingBookings;
      const changeEl = statPendingBookings.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Awaiting confirmation';
    }
    
    if (statTotalRevenue) {
      statTotalRevenue.textContent = `€${totalRevenue.toFixed(2)}`;
      const changeEl = statTotalRevenue.parentElement.querySelector('.stat-card-change');
      if (changeEl) changeEl.textContent = 'Paid bookings only';
    }

    // Update table
    const tableBody = $('#carsTableBody');
    if (!tableBody) return;

    if (!bookings || bookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-loading">
            No car bookings yet. System is ready to accept bookings!
            <br><small style="margin-top: 8px; display: block;">Car offers are available in Paphos and Larnaca.</small>
          </td>
        </tr>
      `;
      markCarsLiveSyncUpdated();
      if (!silent && showSuccessToast) {
        showToast('Car bookings refreshed', 'success');
      }
      return;
    }

    tableBody.innerHTML = bookings.map(booking => {
      const startDate = booking.pickup_date ? new Date(booking.pickup_date).toLocaleDateString('en-GB') : 'N/A';
      const endDate = booking.return_date ? new Date(booking.return_date).toLocaleDateString('en-GB') : 'N/A';
      
      // Calculate rental days (combine date + time for accurate calculation)
      let rentalDays = 0;
      if (booking.pickup_date && booking.return_date) {
        const pickupDateTime = new Date(booking.pickup_date + 'T' + (booking.pickup_time || '10:00:00'));
        const returnDateTime = new Date(booking.return_date + 'T' + (booking.return_time || '10:00:00'));
        const hours = (returnDateTime - pickupDateTime) / (1000 * 60 * 60);
        rentalDays = Math.ceil(hours / 24);
      } else {
        rentalDays = booking.days_count || 0;
      }
      
      // Status badge colors
      const statusClass = 
        booking.status === 'confirmed' ? 'badge-success' :
        booking.status === 'active' ? 'badge-info' :
        booking.status === 'completed' ? 'badge-success' :
        booking.status === 'pending' ? 'badge-warning' :
        booking.status === 'cancelled' ? 'badge-danger' : 'badge';
      
      // Location badges
      const pickupLoc = booking.pickup_location ? booking.pickup_location.toUpperCase().replace('_', ' ') : '?';
      const returnLoc = booking.return_location ? booking.return_location.toUpperCase().replace('_', ' ') : '?';
      const priceMeta = getCarBookingEffectivePriceMeta(booking);
      const priceLabel = priceMeta.hasAmount ? `€${priceMeta.amount.toFixed(2)}` : '—';
      const couponBadge = priceMeta.couponCode
        ? `<div style="font-size: 10px; color: #2563eb; margin-top: 2px;">Coupon ${escapeHtml(priceMeta.couponCode)}</div>`
        : '';
      
      return `
        <tr>
          <td>
            <div style="font-weight: 600;">#${booking.id.slice(0, 8).toUpperCase()}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
              ${pickupLoc} → ${returnLoc}
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.full_name || booking.customer_name || 'N/A')}</div>
            <div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.email || booking.customer_email || '')}</div>
            ${(booking.phone || booking.customer_phone) ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(booking.phone || booking.customer_phone)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHtml(booking.car_model || booking.car_type || 'N/A')}</div>
            ${booking.location ? `<div style="font-size: 12px; color: var(--admin-text-muted);">${escapeHtml(booking.location.toUpperCase())}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 13px; white-space: nowrap;">
              📅 ${startDate}<br>
              ⬇️ ${endDate}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: var(--admin-primary); margin-top: 4px;">
              🕒 ${rentalDays} day${rentalDays !== 1 ? 's' : ''}
            </div>
          </td>
          <td>
            <span class="badge ${statusClass}" style="display: block; margin-bottom: 4px;">
              ${(booking.status || 'unknown').toUpperCase()}
            </span>
            <span class="badge badge-info" style="font-size: 10px;">
              ${(booking.payment_status || 'unpaid').toUpperCase()}
            </span>
          </td>
          <td style="font-weight: 600; color: var(--admin-success);">
            ${priceLabel}
            ${priceMeta.currency !== 'EUR' ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(priceMeta.currency)}</div>` : ''}
            ${couponBadge}
            ${!priceMeta.hasAmount ? `<div style="font-size: 10px; color: var(--admin-warning);">Not quoted yet</div>` : ''}
          </td>
          <td>
            <button class="btn-secondary" onclick="viewCarBookingDetails('${booking.id}')" title="View details">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
    markCarsLiveSyncUpdated();
    if (!silent && showSuccessToast) {
      showToast('Car bookings refreshed', 'success');
    }

  } catch (error) {
    console.error('Failed to load car bookings:', error);
    markCarsLiveSyncError();
    if (!silent) {
      showToast('Failed to load car bookings: ' + (error.message || 'Unknown error'), 'error');
    }
    
    const tableBody = $('#carsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading data: ${escapeHtml(error.message || 'Unknown error')}
            <br><small style="margin-top: 8px; display: block;">
              Make sure the car_bookings table exists in Supabase. 
              Run the migration: supabase/migrations/001_car_rentals_system.sql
            </small>
          </td>
        </tr>
      `;
    }
  }
}

async function viewCarBookingDetails(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    console.log('Loading booking details:', bookingId);

    // Fetch booking details
    const { data: booking, error } = await client
      .from('car_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking details', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    const deleteBtn = document.getElementById('btnDeleteBooking');
    if (deleteBtn) {
      deleteBtn.hidden = false;
    }

    // Show modal
    const modal = $('#bookingDetailsModal');
    const content = $('#bookingDetailsContent');
    if (!modal || !content) return;
    content.classList.add('booking-details-content');

    // Format dates
    const pickupDate = booking.pickup_date ? new Date(booking.pickup_date).toLocaleDateString('en-GB') : 'N/A';
    const returnDate = booking.return_date ? new Date(booking.return_date).toLocaleDateString('en-GB') : 'N/A';
    const createdAt = booking.created_at ? new Date(booking.created_at).toLocaleString('en-GB') : 'N/A';
    
    // Calculate rental days (combine date + time for accurate calculation)
    let days = 0;
    if (booking.pickup_date && booking.return_date) {
      const pickupDateTime = new Date(booking.pickup_date + 'T' + (booking.pickup_time || '10:00:00'));
      const returnDateTime = new Date(booking.return_date + 'T' + (booking.return_time || '10:00:00'));
      const hours = (returnDateTime - pickupDateTime) / (1000 * 60 * 60);
      days = Math.ceil(hours / 24);
    }

    // Fetch car pricing from car_offers table
    let carPricing = null;
    let calculatedBasePrice = 0;
    let priceBreakdown = '';
    let suggestedQuote = null;
    
    try {
      // Fetch all cars for this location
      const { data: carOffers } = await client
        .from('car_offers')
        .select('*')
        .eq('location', (booking.location || 'larnaca').toLowerCase());
      
      // Find matching car by comparing car_model in any language
      // booking.car_model is a string like "Nissan Note Hybrid (2023)"
      // car.car_model is JSONB like {"pl": "...", "en": "..."}
      const carOffer = carOffers?.find(car => {
        if (typeof car.car_model === 'string') {
          // Legacy: direct string comparison
          return car.car_model === booking.car_model;
        } else if (car.car_model && typeof car.car_model === 'object') {
          // i18n: check all language variants
          return car.car_model.pl === booking.car_model ||
                 car.car_model.en === booking.car_model ||
                 car.car_model.el === booking.car_model ||
                 car.car_model.he === booking.car_model;
        }
        return false;
      });
      
      carPricing = carOffer;
      
      // Calculate suggested quote using the same pricing engine as customer flow.
      if (carPricing) {
        const location = (booking.location || 'larnaca').toLowerCase();
        const pricingMatrix = buildPricingMatrixForOfferRow(carPricing, location);
        suggestedQuote = calculateCarRentalQuote({
          pricingMatrix,
          offer: location,
          carModel: booking.car_model,
          pickupDateStr: booking.pickup_date,
          returnDateStr: booking.return_date,
          pickupTimeStr: booking.pickup_time || '10:00',
          returnTimeStr: booking.return_time || '10:00',
          pickupLocation: booking.pickup_location || '',
          returnLocation: booking.return_location || '',
          fullInsurance: !!booking.full_insurance,
          youngDriver: !!booking.young_driver,
        });

        if (suggestedQuote) {
          calculatedBasePrice = suggestedQuote.basePrice || 0;
          priceBreakdown = suggestedQuote.dailyRate > 0
            ? `${suggestedQuote.days} days × €${suggestedQuote.dailyRate}/day = €${suggestedQuote.basePrice.toFixed(2)}`
            : `${suggestedQuote.days} days × Package rate = €${suggestedQuote.basePrice.toFixed(2)}`;
        }
      }
    } catch (err) {
      console.warn('Could not fetch car pricing:', err);
    }

    const pickupFee = suggestedQuote?.pickupFee || 0;
    const returnFee = suggestedQuote?.returnFee || 0;
    const insuranceCost = suggestedQuote?.insuranceCost || 0;
    const youngDriverCost = suggestedQuote?.youngDriverCost || 0;
    const suggestedTotal = suggestedQuote?.total || 0;
    const bookingPriceMeta = getCarBookingEffectivePriceMeta(booking);
    const couponCodeSnapshot = String(booking?.coupon_code || '').trim().toUpperCase();
    const couponDiscountSnapshot = Number(booking?.coupon_discount_amount || 0);
    const hasCouponSnapshot = Boolean(couponCodeSnapshot || couponDiscountSnapshot > 0);
    const baseRentalSnapshot = Number((booking?.base_rental_price ?? suggestedTotal ?? bookingPriceMeta.amount ?? 0));
    const finalRentalSnapshot = Number((booking?.final_rental_price ?? bookingPriceMeta.amount ?? 0));

    const couponPricingHtml = hasCouponSnapshot
      ? `
        <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.3); padding: 14px; border-radius: 10px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--admin-primary);">Coupon Pricing Snapshot</h4>
          <div style="display:grid; gap:6px; font-size:13px;">
            <div style="display:flex; justify-content:space-between; gap:12px;">
              <span>Coupon code</span>
              <strong>${escapeHtml(couponCodeSnapshot || 'APPLIED')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px;">
              <span>Base rental</span>
              <strong>€${baseRentalSnapshot.toFixed(2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; color:#166534;">
              <span>Discount</span>
              <strong>-€${Math.max(0, couponDiscountSnapshot).toFixed(2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; border-top:1px solid rgba(37, 99, 235, 0.2); padding-top:6px;">
              <span style="font-weight:600;">Final rental total</span>
              <strong>€${finalRentalSnapshot.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      `
      : '';

    // Status badge
    const statusClass = 
      booking.status === 'confirmed' ? 'badge-success' :
      booking.status === 'pending' ? 'badge-warning' :
      booking.status === 'cancelled' ? 'badge-danger' : 'badge';

    let fulfillment = null;
    try {
      const { data: fRows } = await client
        .from('partner_service_fulfillments')
        .select('id, status, contact_revealed_at, rejected_reason, partner_id, created_at')
        .eq('resource_type', 'cars')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(50);
      fulfillment = pickBestServiceFulfillment(fRows || []) || null;
    } catch (_e) {
    }

    const fulfillmentStatus = String(fulfillment?.status || '').trim();
    const fulfillmentPillClass =
      fulfillmentStatus === 'accepted' ? 'badge-success' :
      fulfillmentStatus === 'rejected' ? 'badge-danger' :
      fulfillmentStatus === 'awaiting_payment' ? 'badge-warning' :
      fulfillmentStatus === 'pending_acceptance' ? 'badge-warning' : 'badge';

    const fulfillmentActions = (() => {
      if (!fulfillment || !fulfillment.id) return '';
      if (fulfillmentStatus === 'pending_acceptance') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('cars','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','accept')">Accept</button>
            <button type="button" class="btn-danger" onclick="adminServiceFulfillmentActionForBooking('cars','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','reject')">Reject</button>
          </div>
        `;
      }
      if (fulfillmentStatus === 'awaiting_payment') {
        return `
          <div style="display:flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            <button type="button" class="btn-secondary" onclick="adminServiceFulfillmentActionForBooking('cars','${escapeHtml(booking.id)}','${escapeHtml(fulfillment.id)}','mark_paid')">Mark paid</button>
          </div>
        `;
      }
      return '';
    })();

    const fulfillmentHtml = (() => {
      if (!fulfillment || !fulfillment.id) {
        return `
          <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
            <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
              <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
                <div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">No linked fulfillment found for this booking.</div>
              </div>
            </div>
          </div>
        `;
      }

      const extra = fulfillmentStatus === 'rejected' && fulfillment.rejected_reason
        ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Reason: ${escapeHtml(String(fulfillment.rejected_reason))}</div>`
        : (fulfillmentStatus === 'accepted' && fulfillment.contact_revealed_at
          ? `<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-muted);">Contact revealed</div>`
          : '');

      return `
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display:flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Partner Fulfillment</h4>
              <div style="margin-top: 6px;">
                <span class="badge ${fulfillmentPillClass}">${escapeHtml(fulfillmentStatus || 'unknown')}</span>
              </div>
              ${extra}
            </div>
            ${fulfillmentActions}
          </div>
        </div>
      `;
    })();

    // Build content HTML
    content.innerHTML = `
      <div style="display: grid; gap: 24px;">
        <!-- Header Info -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Booking #${booking.id.slice(0, 8).toUpperCase()}</h4>
              <p style="margin: 4px 0 0; font-size: 12px; color: var(--admin-text-muted);">Created: ${createdAt}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <select id="bookingStatusDropdown" class="admin-form-field" style="padding: 8px 12px; font-size: 14px; font-weight: 600;" onchange="updateBookingStatus('${booking.id}', this.value)">
                <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="message_sent" ${booking.status === 'message_sent' ? 'selected' : ''}>📧 Wiadomość wysłana</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>✅ Potwierdzone</option>
                <option value="active" ${booking.status === 'active' ? 'selected' : ''}>🚗 Active</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>✔️ Completed</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
              <span class="badge ${statusClass}" style="font-size: 14px; padding: 6px 12px;">${(booking.status || 'pending').toUpperCase()}</span>
            </div>
          </div>
        </div>

        ${fulfillmentHtml}

        <!-- Customer Information -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Customer Information</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Name:</span>
              <span>${escapeHtml(booking.full_name || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Email:</span>
              <span><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email || 'N/A')}</a></span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Phone:</span>
              <span><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone || 'N/A')}</a></span>
            </div>
            ${booking.country ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Country:</span>
              <span>${escapeHtml(booking.country)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Rental Details -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Rental Details</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Car Model:</span>
              <span style="font-weight: 600;">${escapeHtml(booking.car_model || 'N/A')}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Location:</span>
              <span>${escapeHtml((booking.location || 'N/A').toUpperCase())}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Pickup:</span>
              <span>📅 ${pickupDate} at ${booking.pickup_time || '10:00'} • 📍 ${escapeHtml((booking.pickup_location || 'N/A').replace('_', ' ').toUpperCase())}</span>
            </div>
            ${booking.pickup_address ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Pickup Address:</span>
              <span>${escapeHtml(booking.pickup_address)}</span>
            </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Return:</span>
              <span>📅 ${returnDate} at ${booking.return_time || '10:00'} • 📍 ${escapeHtml((booking.return_location || 'N/A').replace('_', ' ').toUpperCase())}</span>
            </div>
            ${booking.return_address ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Return Address:</span>
              <span>${escapeHtml(booking.return_address)}</span>
            </div>
            ` : ''}
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Duration:</span>
              <span style="font-weight: 600; color: var(--admin-primary);">${days} day${days !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <!-- Additional Options -->
        <div>
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--admin-text-muted);">Additional Options</h4>
          <div style="display: grid; gap: 8px;">
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Passengers:</span>
              <span>${booking.num_passengers || 1}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Child Seats:</span>
              <span>${booking.child_seats || 0} ${booking.child_seats > 0 ? '(FREE)' : ''}</span>
            </div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Full Insurance:</span>
              <span>${booking.full_insurance ? '✅ Yes (+17€/day)' : '❌ No'}</span>
            </div>
            ${booking.flight_number ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Flight Number:</span>
              <span>${escapeHtml(booking.flight_number)}</span>
            </div>
            ` : ''}
            ${booking.special_requests ? `
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px;">
              <span style="font-weight: 500;">Special Requests:</span>
              <span>${escapeHtml(booking.special_requests)}</span>
            </div>
            ` : ''}
          </div>
        </div>

        ${couponPricingHtml}

        <!-- Automatic Price Calculation -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 20px; border-radius: 12px; color: white;">
          <h4 style="margin: 0 0 16px; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">🧮</span>
            Automatic Price Calculation (${(booking.location || 'Larnaca').toUpperCase()} Rate)
          </h4>
          
          ${suggestedQuote ? `
          <div style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <div style="display: grid; gap: 10px;">
              <!-- Base Price -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
                <div>
                  <div style="font-weight: 600; font-size: 14px;">Base Rental Price</div>
                  <div style="font-size: 12px; opacity: 0.85; margin-top: 2px;">${priceBreakdown}</div>
                </div>
                <div style="font-size: 18px; font-weight: 700;">€${calculatedBasePrice.toFixed(2)}</div>
              </div>

              <!-- Extras -->
              ${pickupFee > 0 || returnFee > 0 || insuranceCost > 0 || youngDriverCost > 0 || booking.child_seats > 0 ? `
              <div style="padding-top: 8px;">
                <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; opacity: 0.9;">Extras:</div>
                ${booking.child_seats > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Child Seats (${booking.child_seats})</span>
                  <span style="color: #86efac;">FREE</span>
                </div>
                ` : ''}
                ${pickupFee > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Pickup location fee</span>
                  <span>+€${pickupFee.toFixed(2)}</span>
                </div>
                ` : ''}
                ${returnFee > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Return location fee</span>
                  <span>+€${returnFee.toFixed(2)}</span>
                </div>
                ` : ''}
                ${insuranceCost > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Full Insurance (${days} days × €17)</span>
                  <span>+€${insuranceCost.toFixed(2)}</span>
                </div>
                ` : ''}
                ${youngDriverCost > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <span>• Young driver (${days} days × €10)</span>
                  <span>+€${youngDriverCost.toFixed(2)}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}

              <!-- Total -->
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 2px solid rgba(255, 255, 255, 0.3); margin-top: 8px;">
                <div style="font-weight: 700; font-size: 16px;">SUGGESTED TOTAL</div>
                <div style="font-size: 24px; font-weight: 700; color: #fbbf24;">€${suggestedTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.15); padding: 12px; border-radius: 6px; font-size: 12px; line-height: 1.5;">
            <strong>ℹ️ Note:</strong> This is an automatic calculation based on the ${(booking.location || 'Larnaca').toUpperCase()} rate card. 
            You can adjust the quoted and final prices below if needed.
          </div>
          ` : `
          <div style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9;">⚠️ Could not compute quote from current booking details.</div>
            <div style="font-size: 12px; opacity: 0.75; margin-top: 8px;">Check dates, locations and offer mapping, then set price manually if needed.</div>
          </div>
          `}
        </div>

        <!-- Manual Pricing Override -->
        <div style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Manual Pricing Override</h4>
          <div style="display: grid; gap: 12px;">
            <!-- Quote Price Input -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label style="font-size: 12px; font-weight: 500; color: var(--admin-text-muted);">Quoted Price (€)</label>
                ${suggestedTotal > 0 ? `
                <button 
                  type="button" 
                  id="btnUseSuggestedPrice"
                  style="font-size: 11px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;"
                  title="Use automatic calculated price"
                >
                  📋 Use €${suggestedTotal.toFixed(2)}
                </button>
                ` : ''}
              </div>
              <input 
                type="number" 
                id="bookingQuotedPrice" 
                value="${booking.quoted_price || ''}" 
                placeholder="0.00" 
                step="0.01"
                min="0"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 14px;"
              />
              <small style="display: block; margin-top: 4px; font-size: 11px; color: var(--admin-text-muted);">Initial price quote for the customer</small>
            </div>

            <!-- Final Price Input -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--admin-text-muted);">Final Price (€)</label>
              <input 
                type="number" 
                id="bookingFinalPrice" 
                value="${booking.final_price || ''}" 
                placeholder="0.00" 
                step="0.01"
                min="0"
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 14px; font-weight: 600;"
              />
              <small style="display: block; margin-top: 4px; font-size: 11px; color: var(--admin-text-muted);">Final agreed price (after any adjustments)</small>
            </div>

            <!-- Admin Notes -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; margin-bottom: 4px; color: var(--admin-text-muted);">Admin Notes</label>
              <textarea 
                id="bookingAdminNotes" 
                rows="3"
                placeholder="Add notes about pricing, special conditions, etc."
                style="width: 100%; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 4px; font-size: 13px; resize: vertical; font-family: inherit;"
              >${escapeHtml(booking.admin_notes || '')}</textarea>
            </div>

            <!-- Save Pricing Button -->
            <button 
              type="button" 
              id="btnSavePricing" 
              class="btn-primary"
              style="width: 100%; padding: 10px; font-size: 14px; font-weight: 600;"
            >
              💾 Save Pricing & Notes
            </button>
          </div>
        </div>
      </div>
    `;

    // Store current booking ID for actions
    modal.dataset.bookingId = bookingId;

    // Show modal
    modal.hidden = false;

    // Attach "Use Suggested Price" button event listener
    const btnUseSuggestedPrice = $('#btnUseSuggestedPrice');
    if (btnUseSuggestedPrice && suggestedTotal > 0) {
      btnUseSuggestedPrice.addEventListener('click', () => {
        const quotedPriceInput = $('#bookingQuotedPrice');
        if (quotedPriceInput) {
          quotedPriceInput.value = suggestedTotal.toFixed(2);
          quotedPriceInput.focus();
          showToast('Suggested price applied!', 'success');
        }
      });
    }

    // Attach Save Pricing event listener
    const btnSavePricing = $('#btnSavePricing');
    if (btnSavePricing) {
      btnSavePricing.addEventListener('click', async () => {
        const quotedPrice = parseFloat($('#bookingQuotedPrice')?.value) || null;
        const finalPrice = parseFloat($('#bookingFinalPrice')?.value) || null;
        const adminNotes = $('#bookingAdminNotes')?.value || null;
        const driftThreshold = 0.01;

        if (suggestedTotal > 0) {
          const consistencyWarnings = [];
          if (typeof quotedPrice === 'number' && Math.abs(quotedPrice - suggestedTotal) > driftThreshold) {
            consistencyWarnings.push(`quoted ${quotedPrice.toFixed(2)} vs suggested ${suggestedTotal.toFixed(2)}`);
          }
          if (typeof finalPrice === 'number' && Math.abs(finalPrice - suggestedTotal) > driftThreshold) {
            consistencyWarnings.push(`final ${finalPrice.toFixed(2)} vs suggested ${suggestedTotal.toFixed(2)}`);
          }
          const pricingTotalPreview = (typeof finalPrice === 'number') ? finalPrice : quotedPrice;
          if (typeof pricingTotalPreview === 'number' && Math.abs(pricingTotalPreview - suggestedTotal) > driftThreshold) {
            consistencyWarnings.push(`saved total ${pricingTotalPreview.toFixed(2)} vs suggested ${suggestedTotal.toFixed(2)}`);
          }

          if (consistencyWarnings.length > 0) {
            console.warn('Car booking pricing consistency warning', {
              bookingId,
              suggestedTotal: Number(suggestedTotal.toFixed(2)),
              quotedPrice,
              finalPrice,
              warnings: consistencyWarnings,
            });
            showToast('Pricing differs from automatic quote. Saving manual override.', 'info');
          }
        }

        try {
          btnSavePricing.disabled = true;
          btnSavePricing.textContent = 'Saving...';

          const client = ensureSupabase();
          if (!client) throw new Error('Database connection not available');

          const pricingTotal = finalPrice ?? quotedPrice;
          const baseUpdate = {
            quoted_price: quotedPrice,
            final_price: finalPrice,
            total_price: typeof pricingTotal === 'number' ? pricingTotal : null,
            admin_notes: adminNotes,
            updated_at: new Date().toISOString(),
          };

          let updateError = null;
          for (let i = 0; i < 4; i += 1) {
            const { error } = await client
              .from('car_bookings')
              .update(baseUpdate)
              .eq('id', bookingId);
            updateError = error;
            if (!updateError) break;

            const msg = String(updateError.message || '');
            const m = msg.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
            if (!m || !m[1]) break;

            const unknownCol = m[1];
            if (!(unknownCol in baseUpdate)) break;
            delete baseUpdate[unknownCol];
          }

          if (updateError) throw updateError;

          showToast('Pricing and notes saved successfully!', 'success');
          await loadCarsData(); // Refresh table

        } catch (e) {
          console.error('Failed to save pricing:', e);
          showToast('Failed to save pricing: ' + e.message, 'error');
        } finally {
          btnSavePricing.disabled = false;
          btnSavePricing.textContent = '💾 Save Pricing & Notes';
        }
      });
    }

  } catch (e) {
    console.error('Failed to load booking details:', e);
    showToast('Failed to load booking details', 'error');
  }
}

// Open edit booking modal
async function openEditBooking(bookingId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    // Fetch booking details
    const { data: booking, error } = await client
      .from('car_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error loading booking:', error);
      showToast('Failed to load booking', 'error');
      return;
    }

    if (!booking) {
      showToast('Booking not found', 'error');
      return;
    }

    // Populate form
    $('#editBookingId').value = booking.id;
    $('#editFullName').value = booking.full_name || '';
    $('#editEmail').value = booking.email || '';
    $('#editPhone').value = booking.phone || '';
    $('#editCountry').value = booking.country || '';
    
    $('#editCarModel').value = booking.car_model || '';
    $('#editLocation').value = booking.location || 'paphos';
    
    $('#editPickupDate').value = booking.pickup_date || '';
    $('#editPickupTime').value = booking.pickup_time || '10:00';
    $('#editPickupLocation').value = booking.pickup_location || 'airport_pfo';
    $('#editPickupAddress').value = booking.pickup_address || '';
    
    $('#editReturnDate').value = booking.return_date || '';
    $('#editReturnTime').value = booking.return_time || '10:00';
    $('#editReturnLocation').value = booking.return_location || 'airport_pfo';
    $('#editReturnAddress').value = booking.return_address || '';
    
    $('#editNumPassengers').value = booking.num_passengers || 2;
    $('#editChildSeats').value = booking.child_seats || 0;
    $('#editFullInsurance').checked = booking.full_insurance || false;
    $('#editFlightNumber').value = booking.flight_number || '';
    $('#editSpecialRequests').value = booking.special_requests || '';
    
    $('#editStatus').value = booking.status || 'pending';

    // Hide details modal, show edit modal
    const detailsModal = $('#bookingDetailsModal');
    if (detailsModal) detailsModal.hidden = true;

    const editModal = $('#editBookingModal');
    if (editModal) editModal.hidden = false;

  } catch (e) {
    console.error('Failed to open edit booking:', e);
    showToast('Failed to open edit form', 'error');
  }
}

// Handle edit booking form submission
async function handleEditBookingSubmit(event) {
  event.preventDefault();

  const submitBtn = $('#editBookingSubmit');
  const errorEl = $('#editBookingError');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    if (errorEl) errorEl.hidden = true;

    const bookingId = $('#editBookingId').value;
    if (!bookingId) throw new Error('Booking ID is missing');

    const updateData = {
      full_name: $('#editFullName').value,
      email: $('#editEmail').value,
      phone: $('#editPhone').value,
      country: $('#editCountry').value || null,
      
      car_model: $('#editCarModel').value,
      location: $('#editLocation').value,
      
      pickup_date: $('#editPickupDate').value,
      pickup_time: $('#editPickupTime').value,
      pickup_location: $('#editPickupLocation').value,
      pickup_address: $('#editPickupAddress').value || null,
      
      return_date: $('#editReturnDate').value,
      return_time: $('#editReturnTime').value,
      return_location: $('#editReturnLocation').value,
      return_address: $('#editReturnAddress').value || null,
      
      num_passengers: parseInt($('#editNumPassengers').value) || 1,
      child_seats: parseInt($('#editChildSeats').value) || 0,
      full_insurance: $('#editFullInsurance').checked,
      flight_number: $('#editFlightNumber').value || null,
      special_requests: $('#editSpecialRequests').value || null,
      
      status: $('#editStatus').value,
      updated_at: new Date().toISOString()
    };

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const { error } = await client
      .from('car_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking updated successfully!', 'success');

    // Close edit modal
    const editModal = $('#editBookingModal');
    if (editModal) editModal.hidden = true;

    // Reload table
    await loadCarsData();

    // Reopen details modal
    await viewCarBookingDetails(bookingId);

  } catch (e) {
    console.error('Failed to update booking:', e);
    
    if (errorEl) {
      errorEl.textContent = e.message || 'Failed to update booking';
      errorEl.hidden = false;
    }
    
    showToast('Failed to update booking', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

// Update booking status from dropdown
async function updateBookingStatus(bookingId, newStatus) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log(`Updating booking ${bookingId} status to: ${newStatus}`);

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Add confirmed timestamp if status is confirmed
    if (newStatus === 'confirmed') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = adminState.user?.id || null;
    }

    const { error } = await client
      .from('car_bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (error) {
      console.error('Failed to update booking status:', error);
      showToast('Błąd aktualizacji statusu: ' + error.message, 'error');
      return;
    }

    showToast(`Status zmieniony na: ${newStatus}`, 'success');

    // Reload data
    await loadCarsData();
    await loadAllOrders({ silent: true });

    // Refresh modal if still open
    const modal = $('#bookingDetailsModal');
    if (modal && !modal.hidden) {
      await viewCarBookingDetails(bookingId);
    }

  } catch (e) {
    console.error('Error updating booking status:', e);
    showToast('Błąd: ' + e.message, 'error');
  }
}

async function deleteCarBooking(bookingId) {
  if (!bookingId) return;

  const confirmed = confirm('Are you sure you want to delete this booking? This action cannot be undone.');
  if (!confirmed) return;

  const typed = prompt('Type DELETE to confirm deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { error: bookingLoadError } = await client
      .from('car_bookings')
      .select('id')
      .eq('id', bookingId)
      .single();
    if (bookingLoadError) throw bookingLoadError;

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'cars')
        .eq('booking_id', bookingId);
    } catch (_e) {
    }

    const { error } = await client
      .from('car_bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    showToast('Booking deleted successfully', 'success');
    const modal = $('#bookingDetailsModal');
    if (modal) modal.hidden = true;
    await loadCarsData();
    await loadAllOrders({ silent: true });
  } catch (e) {
    console.error('Failed to delete booking:', e);
    showToast('Failed to delete booking: ' + (e.message || 'Unknown error'), 'error');
  }
}

// Make functions global for onclick handlers
window.viewCarBookingDetails = viewCarBookingDetails;
window.loadCarsData = loadCarsData;
window.openEditBooking = openEditBooking;
window.updateBookingStatus = updateBookingStatus;
window.deleteCarBooking = deleteCarBooking;

async function ensureCarCouponPartnersLoaded(options = {}) {
  const { force = false } = options;
  if (!force && carCouponsState.partners.length > 0) {
    return carCouponsState.partners;
  }

  const client = ensureSupabase();
  if (!client) return [];

  let data = [];
  let error = null;

  ({ data, error } = await client
    .from('partners')
    .select('id, name, status, can_manage_cars')
    .order('name', { ascending: true })
    .limit(500));

  if (error && isMissingColumnError(error, 'can_manage_cars')) {
    ({ data, error } = await client
      .from('partners')
      .select('id, name, status')
      .order('name', { ascending: true })
      .limit(500));
  }

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  carCouponsState.partners = rows;
  carCouponsState.partnersById = {};
  rows.forEach((row) => {
    if (!row?.id) return;
    carCouponsState.partnersById[row.id] = row;
  });
  return rows;
}

function populateCarCouponPartnerOptions() {
  const options = (carCouponsState.partners || []).map((partner) => {
    const id = String(partner?.id || '').trim();
    if (!id) return '';
    const status = String(partner?.status || '').trim();
    const suffix = status && status !== 'active' ? ` (${status})` : '';
    const label = `${String(partner?.name || id)}${suffix}`;
    return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
  }).join('');

  const filterSelect = $('#carsCouponsPartnerFilter');
  if (filterSelect) {
    const prev = String(filterSelect.value || '');
    filterSelect.innerHTML = '<option value="">All partners</option>' + options;
    const hasPrev = prev && Array.from(filterSelect.options || []).some((option) => String(option.value || '') === prev);
    if (hasPrev) {
      filterSelect.value = prev;
    }
  }

  const partnerSelect = $('#carCouponPartnerId');
  if (partnerSelect) {
    const prev = String(partnerSelect.value || '');
    partnerSelect.innerHTML = '<option value="">No partner</option>' + options;
    const hasPrev = prev && Array.from(partnerSelect.options || []).some((option) => String(option.value || '') === prev);
    if (hasPrev) {
      partnerSelect.value = prev;
    }
  }
}

function getMultiSelectValues(selectId) {
  const element = document.getElementById(selectId);
  if (!element) return [];

  if (String(element.tagName || '').toUpperCase() === 'SELECT') {
    return Array.from(element.selectedOptions || [])
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);
  }

  return Array.from(element.querySelectorAll('input[type="checkbox"][data-coupon-value]'))
    .filter((input) => input.checked)
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);
}

function setMultiSelectValues(selectId, values) {
  const element = document.getElementById(selectId);
  if (!element) return;

  const selected = new Set((Array.isArray(values) ? values : []).map((v) => String(v || '').trim()).filter(Boolean));

  if (String(element.tagName || '').toUpperCase() === 'SELECT') {
    Array.from(element.options || []).forEach((option) => {
      option.selected = selected.has(String(option.value || '').trim());
    });
    return;
  }

  Array.from(element.querySelectorAll('input[type="checkbox"][data-coupon-value]')).forEach((input) => {
    input.checked = selected.has(String(input.value || '').trim());
  });
  updateCarCouponDropdownSummary(selectId);
}

function buildCouponSelectOptionMarkup(baseOptions, selectedValues = []) {
  const opts = Array.isArray(baseOptions) ? baseOptions.slice() : [];
  const selectedSet = new Set((Array.isArray(selectedValues) ? selectedValues : []).map((v) => String(v || '').trim()).filter(Boolean));
  const existing = new Set(opts.map((option) => String(option?.value || '').trim()).filter(Boolean));

  selectedSet.forEach((value) => {
    if (!existing.has(value)) {
      opts.push({ value, label: `${value} (legacy)` });
    }
  });

  return opts
    .map((option) => {
      const value = String(option?.value || '').trim();
      if (!value) return '';
      const label = String(option?.label || value).trim();
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    })
    .join('');
}

function buildCouponCheckboxOptionMarkup(baseOptions, selectedValues = []) {
  const opts = Array.isArray(baseOptions) ? baseOptions.slice() : [];
  const selectedSet = new Set((Array.isArray(selectedValues) ? selectedValues : []).map((v) => String(v || '').trim()).filter(Boolean));
  const existing = new Set(opts.map((option) => String(option?.value || '').trim()).filter(Boolean));

  selectedSet.forEach((value) => {
    if (!existing.has(value)) {
      opts.push({ value, label: `${value} (legacy)` });
    }
  });

  if (!opts.length) {
    return '<div class="cars-coupon-dropdown-empty">No options available yet.</div>';
  }

  return opts
    .map((option) => {
      const value = String(option?.value || '').trim();
      if (!value) return '';
      const label = String(option?.label || value).trim();
      const checked = selectedSet.has(value) ? ' checked' : '';
      return `
        <label class="cars-coupon-dropdown-option">
          <input
            type="checkbox"
            value="${escapeHtml(value)}"
            data-coupon-value="1"
            data-coupon-label="${escapeHtml(label)}"${checked}
          />
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    })
    .join('');
}

function getMultiSelectSelectedLabels(selectId) {
  const element = document.getElementById(selectId);
  if (!element) return [];

  if (String(element.tagName || '').toUpperCase() === 'SELECT') {
    return Array.from(element.selectedOptions || [])
      .map((option) => String(option.textContent || option.value || '').trim())
      .filter(Boolean);
  }

  return Array.from(element.querySelectorAll('input[type="checkbox"][data-coupon-value]:checked'))
    .map((input) => String(input.getAttribute('data-coupon-label') || input.value || '').trim())
    .filter(Boolean);
}

function updateCarCouponDropdownSummary(selectId) {
  const summaryEl = document.querySelector(`[data-coupon-summary-for="${selectId}"]`);
  if (!summaryEl) return;

  const labels = getMultiSelectSelectedLabels(selectId);
  const emptyLabel = String(summaryEl.dataset.emptyLabel || 'All').trim() || 'All';
  if (!labels.length) {
    summaryEl.textContent = emptyLabel;
    return;
  }

  if (labels.length <= 2) {
    summaryEl.textContent = labels.join(', ');
    return;
  }

  summaryEl.textContent = `${labels.length} selected`;
}

function populateCarCouponScopeFieldOptions(fieldId, baseOptions, selectedValues) {
  const element = document.getElementById(fieldId);
  if (!element) return;

  if (String(element.tagName || '').toUpperCase() === 'SELECT') {
    element.innerHTML = buildCouponSelectOptionMarkup(baseOptions, selectedValues);
    setMultiSelectValues(fieldId, selectedValues);
    return;
  }

  element.innerHTML = buildCouponCheckboxOptionMarkup(baseOptions, selectedValues);
  setMultiSelectValues(fieldId, selectedValues);
}

function populateCarCouponScopeSelectOptions(preselected = {}) {
  const applicableOfferIds = normalizeCouponArray(preselected?.applicable_offer_ids);
  const excludedOfferIds = normalizeCouponArray(preselected?.excluded_offer_ids);
  const applicableCarModels = normalizeCouponArray(preselected?.applicable_car_models);
  const excludedCarModels = normalizeCouponArray(preselected?.excluded_car_models);
  const applicableCarTypes = normalizeCouponArray(preselected?.applicable_car_types);
  const excludedCarTypes = normalizeCouponArray(preselected?.excluded_car_types);

  populateCarCouponScopeFieldOptions('carCouponApplicableOfferIdsSelect', carCouponsState.offerOptions, applicableOfferIds);
  populateCarCouponScopeFieldOptions('carCouponExcludedOfferIdsSelect', carCouponsState.offerOptions, excludedOfferIds);
  populateCarCouponScopeFieldOptions('carCouponApplicableCarModelsSelect', carCouponsState.modelOptions, applicableCarModels);
  populateCarCouponScopeFieldOptions('carCouponExcludedCarModelsSelect', carCouponsState.modelOptions, excludedCarModels);
  populateCarCouponScopeFieldOptions('carCouponApplicableCarTypesSelect', carCouponsState.typeOptions, applicableCarTypes);
  populateCarCouponScopeFieldOptions('carCouponExcludedCarTypesSelect', carCouponsState.typeOptions, excludedCarTypes);
}

function handleCarCouponScopeOptionChange(event) {
  const target = event?.target;
  if (!target || String(target.tagName || '').toUpperCase() !== 'INPUT') return;
  if (String(target.type || '').toLowerCase() !== 'checkbox') return;
  if (!target.hasAttribute('data-coupon-value')) return;

  const list = target.closest('.cars-coupon-dropdown-list');
  if (!list || !list.id) return;
  updateCarCouponDropdownSummary(list.id);
}

function handleCarCouponScopeClearClick(event) {
  const button = event?.target?.closest?.('button[data-coupon-dropdown-clear]');
  if (!button) return;
  event.preventDefault();
  const fieldId = String(button.dataset.couponDropdownClear || '').trim();
  if (!fieldId) return;
  setMultiSelectValues(fieldId, []);
}

function closeAllCarCouponScopeDropdowns() {
  document.querySelectorAll('#carCouponForm .cars-coupon-dropdown[open]').forEach((dropdown) => {
    dropdown.open = false;
  });
  document.querySelectorAll('#carCouponForm .cars-coupon-scope-advanced[open]').forEach((section) => {
    section.open = false;
  });
}

function inferCarCouponScopePrimaryMode(coupon = {}) {
  const applicableOfferIds = normalizeCouponArray(coupon?.applicable_offer_ids);
  const applicableCarModels = normalizeCouponArray(coupon?.applicable_car_models);
  const applicableCarTypes = normalizeCouponArray(coupon?.applicable_car_types);

  const hasOffers = applicableOfferIds.length > 0;
  const hasModels = applicableCarModels.length > 0;
  const hasTypes = applicableCarTypes.length > 0;

  if (!hasOffers && !hasModels && !hasTypes) return 'all';
  if (hasOffers && !hasModels && !hasTypes) return 'offers';
  if (!hasOffers && hasModels && !hasTypes) return 'models';
  if (!hasOffers && !hasModels && hasTypes) return 'types';
  return 'custom';
}

function syncCarCouponScopePrimaryModeFields(options = {}) {
  const { preserveValues = false } = options;
  const modeSelect = $('#carCouponScopePrimaryMode');
  const allowedModes = new Set(['all', 'offers', 'models', 'types', 'custom']);
  const mode = allowedModes.has(String(modeSelect?.value || '').trim().toLowerCase())
    ? String(modeSelect.value).trim().toLowerCase()
    : 'all';

  if (modeSelect && modeSelect.value !== mode) {
    modeSelect.value = mode;
  }

  const showOffers = mode === 'offers' || mode === 'custom';
  const showModels = mode === 'models' || mode === 'custom';
  const showTypes = mode === 'types' || mode === 'custom';

  const offersField = document.querySelector('[data-scope-applicable-field="offers"]');
  const modelsField = document.querySelector('[data-scope-applicable-field="models"]');
  const typesField = document.querySelector('[data-scope-applicable-field="types"]');
  if (offersField) offersField.hidden = !showOffers;
  if (modelsField) modelsField.hidden = !showModels;
  if (typesField) typesField.hidden = !showTypes;

  const hintEl = $('#carCouponScopeModeHint');
  if (hintEl) {
    if (mode === 'offers') {
      hintEl.textContent = 'Coupon works only for selected offers.';
    } else if (mode === 'models') {
      hintEl.textContent = 'Coupon works only for selected car models.';
    } else if (mode === 'types') {
      hintEl.textContent = 'Coupon works only for selected car types.';
    } else if (mode === 'custom') {
      hintEl.textContent = 'Advanced mode: combine offers, models and types.';
    } else {
      hintEl.textContent = 'Default: coupon works for all cars and offers in selected cities.';
    }
  }

  if (preserveValues) return;

  if (!showOffers) setMultiSelectValues('carCouponApplicableOfferIdsSelect', []);
  if (!showModels) setMultiSelectValues('carCouponApplicableCarModelsSelect', []);
  if (!showTypes) setMultiSelectValues('carCouponApplicableCarTypesSelect', []);
}

async function ensureCarCouponScopeOptionsLoaded(options = {}) {
  const { force = false } = options;
  if (!force && carCouponsState.scopeOptionsLoaded) {
    return;
  }

  const client = ensureSupabase();
  if (!client) return;

  const { data, error } = await client
    .from('car_offers')
    .select('id, car_model, car_type, location')
    .order('location', { ascending: true })
    .limit(2000);

  if (error) throw error;

  const offers = [];
  const modelMap = new Map();
  const typeMap = new Map();

  (Array.isArray(data) ? data : []).forEach((row) => {
    const id = String(row?.id || '').trim();
    if (id) {
      const modelLabel = normalizeI18nText(row?.car_model) || 'Car model';
      const locationLabel = String(row?.location || '').trim();
      offers.push({
        value: id,
        label: locationLabel ? `${modelLabel} (${locationLabel})` : modelLabel,
      });
    }

    const model = normalizeI18nText(row?.car_model);
    const modelKey = model.toLowerCase();
    if (model && !modelMap.has(modelKey)) {
      modelMap.set(modelKey, model);
    }

    const type = normalizeI18nText(row?.car_type);
    const typeKey = type.toLowerCase();
    if (type && !typeMap.has(typeKey)) {
      typeMap.set(typeKey, type);
    }
  });

  offers.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }));
  const models = Array.from(modelMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const types = Array.from(typeMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  carCouponsState.offerOptions = offers;
  carCouponsState.modelOptions = models.map((value) => ({ value, label: value }));
  carCouponsState.typeOptions = types.map((value) => ({ value, label: value }));
  carCouponsState.scopeOptionsLoaded = true;
}

function getFilteredCarCoupons() {
  const filters = carCouponsState.filters || {};
  const search = String(filters.search || '').trim().toLowerCase();
  const status = String(filters.status || '').trim().toLowerCase();
  const activity = String(filters.activity || '').trim().toLowerCase();
  const discountType = String(filters.discountType || '').trim().toLowerCase();
  const partnerId = String(filters.partnerId || '').trim();

  const list = Array.isArray(carCouponsState.items) ? carCouponsState.items : [];
  return list.filter((coupon) => {
    if (!coupon || !coupon.id) return false;

    if (status && String(coupon.status || '').trim().toLowerCase() !== status) return false;
    if (discountType && String(coupon.discount_type || '').trim().toLowerCase() !== discountType) return false;
    if (partnerId && String(coupon.partner_id || '').trim() !== partnerId) return false;
    if (activity === 'enabled' && !coupon.is_active) return false;
    if (activity === 'disabled' && coupon.is_active) return false;

    if (search) {
      const partnerLabel = getCarCouponPartnerLabel(coupon.partner_id).toLowerCase();
      const haystack = [
        coupon.code,
        coupon.name,
        coupon.description,
        coupon.internal_notes,
        partnerLabel,
      ]
        .map((part) => String(part || '').toLowerCase())
        .join(' ');
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function renderCarCouponStats(coupons) {
  const rows = Array.isArray(coupons) ? coupons : [];
  const visibleCount = rows.length;
  const enabledCount = rows.filter((coupon) => coupon.is_active && String(coupon.status || '').trim().toLowerCase() === 'active').length;
  const redemptionCount = rows.reduce((sum, coupon) => sum + getCarCouponUsage(coupon.id).redemptionCount, 0);
  const discountTotal = rows.reduce((sum, coupon) => sum + getCarCouponUsage(coupon.id).totalDiscountAmount, 0);

  const visibleEl = $('#statCarsCouponsVisible');
  if (visibleEl) visibleEl.textContent = String(visibleCount);

  const enabledEl = $('#statCarsCouponsEnabled');
  if (enabledEl) enabledEl.textContent = String(enabledCount);

  const redemptionsEl = $('#statCarsCouponsRedemptions');
  if (redemptionsEl) redemptionsEl.textContent = String(redemptionCount);

  const discountEl = $('#statCarsCouponsDiscountTotal');
  if (discountEl) discountEl.textContent = formatCurrencyEUR(discountTotal);
}

function renderCarCouponsTable(coupons) {
  const tbody = $('#carsCouponsTableBody');
  if (!tbody) return;

  const rows = Array.isArray(coupons) ? coupons : [];
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="table-loading">No coupons found for current filters.</td>
      </tr>
    `;
    scheduleResponsiveTableHydration();
    return;
  }

  tbody.innerHTML = rows.map((coupon) => {
    const usage = getCarCouponUsage(coupon.id);
    const scope = formatCouponScope(coupon);
    const statusClass = normalizeCouponStatusClass(coupon.status);
    const activeClass = coupon.is_active ? 'badge-success' : 'badge-danger';
    const lastRedeemed = usage.lastRedeemedAt ? formatCouponDateTime(usage.lastRedeemedAt) : 'Never';

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${escapeHtml(String(coupon.code || ''))}</div>
          ${coupon.name ? `<div class="cars-coupon-cell-muted">${escapeHtml(String(coupon.name))}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(formatCouponDiscount(coupon))}</div>
          <div class="cars-coupon-cell-muted">${escapeHtml(String(coupon.discount_type || ''))}</div>
        </td>
        <td style="font-size: 12px;">
          ${escapeHtml(formatCouponWindow(coupon))}
          <div class="cars-coupon-cell-muted">Based on rental start date</div>
        </td>
        <td style="font-size: 12px;">
          ${escapeHtml(formatCouponLimits(coupon))}
        </td>
        <td style="font-size: 12px;">
          <div>${escapeHtml(scope.includeText)}</div>
          ${scope.excludeText ? `<div style="color: var(--admin-text-muted); margin-top: 4px;">${escapeHtml(scope.excludeText)}</div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(getCarCouponPartnerLabel(coupon.partner_id))}</div>
          ${Number.isInteger(coupon.partner_commission_bps_override) ? `<div class="cars-coupon-cell-muted">Override: ${coupon.partner_commission_bps_override} bps</div>` : ''}
        </td>
        <td>
          <span class="badge ${statusClass}" style="display: block; margin-bottom: 4px;">${escapeHtml(String(coupon.status || 'draft').toUpperCase())}</span>
          <span class="badge ${activeClass}" style="font-size: 10px;">${coupon.is_active ? 'ENABLED' : 'DISABLED'}</span>
        </td>
        <td style="font-size: 12px;">
          <div>${usage.redemptionCount} uses</div>
          <div>${formatCurrencyEUR(usage.totalDiscountAmount)}</div>
          <div class="cars-coupon-cell-muted">${escapeHtml(lastRedeemed)}</div>
        </td>
        <td>
          <div class="cars-coupons-table-actions">
            <button type="button" class="btn-small btn-secondary" data-coupon-action="edit" data-coupon-id="${escapeHtml(String(coupon.id))}">Edit</button>
            <button type="button" class="btn-small btn-secondary" data-coupon-action="${coupon.is_active ? 'deactivate' : 'activate'}" data-coupon-id="${escapeHtml(String(coupon.id))}">
              ${coupon.is_active ? 'Disable' : 'Enable'}
            </button>
            <button type="button" class="btn-small btn-secondary" data-coupon-action="delete" data-coupon-id="${escapeHtml(String(coupon.id))}" style="color: var(--admin-danger);">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  scheduleResponsiveTableHydration();
}

function renderCarCouponsData() {
  const filtered = getFilteredCarCoupons();
  renderCarCouponStats(filtered);
  renderCarCouponsTable(filtered);
}

function renderCarCouponsErrorRow(message) {
  const tbody = $('#carsCouponsTableBody');
  if (!tbody) return;
  const text = String(message || 'Unknown error');
  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="table-loading" style="color: var(--admin-danger);">
        Failed to load coupons: ${escapeHtml(text)}
      </td>
    </tr>
  `;
  scheduleResponsiveTableHydration();
}

async function loadCarCouponsData(options = {}) {
  const { silent = false, showSuccessToast = false, forcePartnersRefresh = false } = options;
  if (carCouponsState.loading) return;

  try {
    carCouponsState.loading = true;
    setCarsCouponsViewError('');

    const tbody = $('#carsCouponsTableBody');
    if (tbody && !silent) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Loading coupons...</td></tr>';
      scheduleResponsiveTableHydration();
    }

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    let partnerWarning = '';
    let scopeWarning = '';
    try {
      await ensureCarCouponPartnersLoaded({ force: forcePartnersRefresh });
      populateCarCouponPartnerOptions();
    } catch (partnerError) {
      console.warn('Failed to load partners for coupons:', partnerError);
      carCouponsState.partners = [];
      carCouponsState.partnersById = {};
      populateCarCouponPartnerOptions();
      partnerWarning = `Partner list unavailable: ${partnerError?.message || 'unknown error'}`;
    }

    try {
      await ensureCarCouponScopeOptionsLoaded({ force: forcePartnersRefresh });
      populateCarCouponScopeSelectOptions();
    } catch (scopeError) {
      console.warn('Failed to load car offer scope options:', scopeError);
      carCouponsState.scopeOptionsLoaded = false;
      carCouponsState.offerOptions = [];
      carCouponsState.modelOptions = [];
      carCouponsState.typeOptions = [];
      populateCarCouponScopeSelectOptions();
      scopeWarning = `Scope options unavailable: ${scopeError?.message || 'unknown error'}`;
    }

    const columns = [
      'id',
      'code',
      'name',
      'description',
      'internal_notes',
      'status',
      'is_active',
      'discount_type',
      'discount_value',
      'currency',
      'starts_at',
      'expires_at',
      'single_use',
      'usage_limit_total',
      'usage_limit_per_user',
      'min_rental_days',
      'min_rental_total',
      'applicable_locations',
      'applicable_offer_ids',
      'applicable_car_models',
      'applicable_car_types',
      'excluded_offer_ids',
      'excluded_car_models',
      'excluded_car_types',
      'partner_id',
      'partner_commission_bps_override',
      'created_at',
      'updated_at',
    ].join(', ');

    const { data: coupons, error: couponsError } = await client
      .from('car_coupons')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (couponsError) throw couponsError;

    carCouponsState.items = Array.isArray(coupons) ? coupons : [];

    const usageByCouponId = {};
    if (carCouponsState.items.length > 0) {
      const couponIds = carCouponsState.items
        .map((coupon) => String(coupon?.id || '').trim())
        .filter(Boolean);

      const { data: usageRows, error: usageError } = await client
        .from('car_coupon_usage_stats')
        .select('coupon_id, redemption_count, total_discount_amount, last_redeemed_at')
        .in('coupon_id', couponIds);

      if (usageError) {
        const usageWarning = `Usage stats unavailable: ${usageError.message || 'unknown error'}`;
        const combinedWarning = [partnerWarning, scopeWarning, usageWarning].filter(Boolean).join(' | ');
        setCarsCouponsViewError(combinedWarning);
      } else {
        (usageRows || []).forEach((row) => {
          if (!row?.coupon_id) return;
          usageByCouponId[row.coupon_id] = {
            redemptionCount: Number(row.redemption_count || 0),
            totalDiscountAmount: Number(row.total_discount_amount || 0),
            lastRedeemedAt: row.last_redeemed_at || null,
          };
        });
        const nonUsageWarning = [partnerWarning, scopeWarning].filter(Boolean).join(' | ');
        if (nonUsageWarning) {
          setCarsCouponsViewError(nonUsageWarning);
        }
      }
    } else {
      const nonUsageWarning = [partnerWarning, scopeWarning].filter(Boolean).join(' | ');
      if (nonUsageWarning) {
        setCarsCouponsViewError(nonUsageWarning);
      }
    }

    carCouponsState.usageByCouponId = usageByCouponId;
    carCouponsState.loaded = true;
    renderCarCouponsData();
    markCarsLiveSyncUpdated();

    if (showSuccessToast) {
      showToast('Coupons refreshed', 'success');
    }
  } catch (error) {
    console.error('Failed to load car coupons:', error);
    markCarsLiveSyncError();
    const msg = String(error?.message || 'Unknown error');
    setCarsCouponsViewError(`Failed to load coupons: ${msg}`);
    renderCarCouponsErrorRow(msg);
    if (!silent) {
      showToast(`Failed to load coupons: ${msg}`, 'error');
    }
  } finally {
    carCouponsState.loading = false;
  }
}

function syncCarCouponDiscountTypeFields() {
  const discountType = String($('#carCouponDiscountType')?.value || 'percent').trim();
  const discountValueInput = $('#carCouponDiscountValue');
  if (!discountValueInput) return;

  if (discountType === 'percent') {
    discountValueInput.min = '0.01';
    discountValueInput.max = '100';
    discountValueInput.step = '0.01';
    discountValueInput.placeholder = '10';
  } else {
    discountValueInput.min = '0.01';
    discountValueInput.removeAttribute('max');
    discountValueInput.step = '0.01';
    discountValueInput.placeholder = '25';
  }
}

function syncCarCouponSingleUseFields() {
  const singleUse = Boolean($('#carCouponSingleUse')?.checked);
  const totalInput = $('#carCouponUsageLimitTotal');
  const perUserInput = $('#carCouponUsageLimitPerUser');
  if (!totalInput || !perUserInput) return;

  if (singleUse) {
    totalInput.value = '1';
    perUserInput.value = '1';
    totalInput.disabled = true;
    perUserInput.disabled = true;
    return;
  }

  totalInput.disabled = false;
  perUserInput.disabled = false;
}

function syncCarCouponDateWindowFields(options = {}) {
  const { preserveValues = false } = options;
  const noDateLimit = Boolean($('#carCouponNoDateLimit')?.checked);
  const orderFromInput = $('#carCouponOrderDateFrom');
  const orderToInput = $('#carCouponOrderDateTo');
  if (!orderFromInput || !orderToInput) return;

  orderFromInput.disabled = noDateLimit;
  orderToInput.disabled = noDateLimit;

  if (noDateLimit && !preserveValues) {
    orderFromInput.value = '';
    orderToInput.value = '';
  }
}

function resetCarCouponForm() {
  const form = $('#carCouponForm');
  if (form) form.reset();

  const idInput = $('#carCouponId');
  if (idInput) idInput.value = '';
  const statusInput = $('#carCouponStatus');
  if (statusInput) statusInput.value = 'draft';
  const typeInput = $('#carCouponDiscountType');
  if (typeInput) typeInput.value = 'percent';
  const currencyInput = $('#carCouponCurrency');
  if (currencyInput) currencyInput.value = 'EUR';
  const activeInput = $('#carCouponIsActive');
  if (activeInput) activeInput.checked = true;
  const paphosInput = $('#carCouponLocationPaphos');
  if (paphosInput) paphosInput.checked = false;
  const larnacaInput = $('#carCouponLocationLarnaca');
  if (larnacaInput) larnacaInput.checked = false;
  const orderFromInput = $('#carCouponOrderDateFrom');
  if (orderFromInput) orderFromInput.value = '';
  const orderToInput = $('#carCouponOrderDateTo');
  if (orderToInput) orderToInput.value = '';
  const noDateLimitInput = $('#carCouponNoDateLimit');
  if (noDateLimitInput) noDateLimitInput.checked = true;
  const scopeModeInput = $('#carCouponScopePrimaryMode');
  if (scopeModeInput) scopeModeInput.value = 'all';

  closeAllCarCouponScopeDropdowns();
  populateCarCouponScopeSelectOptions();

  setCarCouponFormError('');
  syncCarCouponDiscountTypeFields();
  syncCarCouponSingleUseFields();
  syncCarCouponDateWindowFields();
  syncCarCouponScopePrimaryModeFields();
}

function validateCouponUuidList(values, label) {
  values.forEach((value) => {
    if (!CAR_COUPON_UUID_PATTERN.test(value)) {
      throw new Error(`${label} contains invalid UUID: ${value}`);
    }
  });
}

function collectCarCouponFormPayload() {
  const code = String($('#carCouponCode')?.value || '').trim().toUpperCase();
  if (!code) throw new Error('Coupon code is required');
  if (/\s/.test(code)) throw new Error('Coupon code cannot contain spaces');

  const status = String($('#carCouponStatus')?.value || 'draft').trim().toLowerCase();
  if (!CAR_COUPON_ALLOWED_STATUSES.has(status)) {
    throw new Error('Invalid coupon status');
  }

  const discountType = String($('#carCouponDiscountType')?.value || 'percent').trim().toLowerCase();
  if (!CAR_COUPON_ALLOWED_DISCOUNT_TYPES.has(discountType)) {
    throw new Error('Invalid discount type');
  }

  const discountValue = parseCouponRequiredNumber($('#carCouponDiscountValue')?.value, 'Discount value', 0.01);
  if (discountType === 'percent' && discountValue > 100) {
    throw new Error('Percent discount cannot exceed 100');
  }

  const currency = String($('#carCouponCurrency')?.value || 'EUR').trim().toUpperCase() || 'EUR';

  const noDateLimit = Boolean($('#carCouponNoDateLimit')?.checked);
  const startsAt = noDateLimit ? null : parseCouponDateStart($('#carCouponOrderDateFrom')?.value, 'rental start from');
  const expiresAt = noDateLimit ? null : parseCouponDateEnd($('#carCouponOrderDateTo')?.value, 'rental start to');
  if (!noDateLimit && startsAt && expiresAt && new Date(expiresAt).getTime() < new Date(startsAt).getTime()) {
    throw new Error('Rental start "to" date cannot be earlier than "from" date');
  }

  const singleUse = Boolean($('#carCouponSingleUse')?.checked);
  let usageLimitTotal = parseCouponOptionalInteger($('#carCouponUsageLimitTotal')?.value, 'Global usage limit', 1);
  let usageLimitPerUser = parseCouponOptionalInteger($('#carCouponUsageLimitPerUser')?.value, 'Per-user usage limit', 1);
  if (singleUse) {
    usageLimitTotal = 1;
    usageLimitPerUser = 1;
  }
  if (usageLimitTotal !== null && usageLimitPerUser !== null && usageLimitPerUser > usageLimitTotal) {
    throw new Error('Per-user usage limit cannot exceed global usage limit');
  }

  const minRentalDays = parseCouponOptionalInteger($('#carCouponMinRentalDays')?.value, 'Minimum rental days', 1);
  const minRentalTotal = parseCouponOptionalNumber($('#carCouponMinRentalTotal')?.value, 'Minimum rental total', 0);

  const scopeMode = String($('#carCouponScopePrimaryMode')?.value || 'all').trim().toLowerCase();
  let applicableOfferIds = getMultiSelectValues('carCouponApplicableOfferIdsSelect');
  let applicableCarModels = getMultiSelectValues('carCouponApplicableCarModelsSelect');
  let applicableCarTypes = getMultiSelectValues('carCouponApplicableCarTypesSelect');
  const excludedOfferIds = getMultiSelectValues('carCouponExcludedOfferIdsSelect');
  validateCouponUuidList(excludedOfferIds, 'Excluded offer IDs');

  if (scopeMode === 'all') {
    applicableOfferIds = [];
    applicableCarModels = [];
    applicableCarTypes = [];
  } else if (scopeMode === 'offers') {
    if (applicableOfferIds.length === 0) {
      throw new Error('Select at least one offer, or choose "All cars and offers"');
    }
    applicableCarModels = [];
    applicableCarTypes = [];
  } else if (scopeMode === 'models') {
    if (applicableCarModels.length === 0) {
      throw new Error('Select at least one car model, or choose "All cars and offers"');
    }
    applicableOfferIds = [];
    applicableCarTypes = [];
  } else if (scopeMode === 'types') {
    if (applicableCarTypes.length === 0) {
      throw new Error('Select at least one car type, or choose "All cars and offers"');
    }
    applicableOfferIds = [];
    applicableCarModels = [];
  } else if (scopeMode === 'custom') {
    const hasAnyApplicable = applicableOfferIds.length > 0 || applicableCarModels.length > 0 || applicableCarTypes.length > 0;
    if (!hasAnyApplicable) {
      throw new Error('In mixed mode select at least one offer/model/type, or switch mode to "All cars and offers"');
    }
  } else {
    throw new Error('Invalid scope mode');
  }

  validateCouponUuidList(applicableOfferIds, 'Applicable offer IDs');

  const partnerId = String($('#carCouponPartnerId')?.value || '').trim() || null;
  if (partnerId && !CAR_COUPON_UUID_PATTERN.test(partnerId)) {
    throw new Error('Invalid partner selected');
  }

  const partnerCommissionBps = parseCouponOptionalInteger(
    $('#carCouponPartnerCommissionBps')?.value,
    'Partner commission override',
    0,
  );
  if (partnerCommissionBps !== null && !partnerId) {
    throw new Error('Partner commission override requires selecting a partner');
  }

  const applicableLocations = [];
  if (Boolean($('#carCouponLocationPaphos')?.checked)) applicableLocations.push('paphos');
  if (Boolean($('#carCouponLocationLarnaca')?.checked)) applicableLocations.push('larnaca');

  return {
    code,
    name: String($('#carCouponName')?.value || '').trim() || null,
    description: String($('#carCouponDescription')?.value || '').trim() || null,
    internal_notes: String($('#carCouponInternalNotes')?.value || '').trim() || null,
    status,
    is_active: Boolean($('#carCouponIsActive')?.checked),
    discount_type: discountType,
    discount_value: discountValue,
    currency,
    starts_at: startsAt,
    expires_at: expiresAt,
    single_use: singleUse,
    usage_limit_total: usageLimitTotal,
    usage_limit_per_user: usageLimitPerUser,
    min_rental_days: minRentalDays,
    min_rental_total: minRentalTotal,
    applicable_locations: applicableLocations,
    applicable_offer_ids: applicableOfferIds,
    applicable_car_models: applicableCarModels,
    applicable_car_types: applicableCarTypes,
    excluded_offer_ids: excludedOfferIds,
    excluded_car_models: getMultiSelectValues('carCouponExcludedCarModelsSelect'),
    excluded_car_types: getMultiSelectValues('carCouponExcludedCarTypesSelect'),
    partner_id: partnerId,
    partner_commission_bps_override: partnerCommissionBps,
  };
}

function closeCarCouponModal() {
  const modal = $('#carCouponModal');
  if (modal) modal.hidden = true;
  closeAllCarCouponScopeDropdowns();
  setCarCouponFormError('');
}

async function openCarCouponModal(couponId = null) {
  const modal = $('#carCouponModal');
  const title = $('#carCouponModalTitle');
  if (!modal || !title) return;

  resetCarCouponForm();

  try {
    await ensureCarCouponPartnersLoaded();
    populateCarCouponPartnerOptions();
  } catch (error) {
    console.warn('Failed to preload partners for coupon modal:', error);
  }

  try {
    await ensureCarCouponScopeOptionsLoaded();
  } catch (error) {
    console.warn('Failed to preload scope options for coupon modal:', error);
  }

  const id = String(couponId || '').trim();
  const coupon = id
    ? (carCouponsState.items || []).find((row) => String(row?.id || '') === id)
    : null;

  if (coupon) {
    title.textContent = `Edit Coupon ${coupon.code || ''}`;
    $('#carCouponId').value = String(coupon.id || '');
    $('#carCouponCode').value = String(coupon.code || '');
    $('#carCouponName').value = String(coupon.name || '');
    $('#carCouponDescription').value = String(coupon.description || '');
    $('#carCouponInternalNotes').value = String(coupon.internal_notes || '');
    $('#carCouponStatus').value = String(coupon.status || 'draft');
    $('#carCouponIsActive').checked = Boolean(coupon.is_active);
    $('#carCouponDiscountType').value = String(coupon.discount_type || 'percent');
    $('#carCouponDiscountValue').value = Number(coupon.discount_value || 0).toString();
    $('#carCouponCurrency').value = String(coupon.currency || 'EUR');
    $('#carCouponOrderDateFrom').value = toDateInputValue(coupon.starts_at);
    $('#carCouponOrderDateTo').value = toDateInputValue(coupon.expires_at);
    $('#carCouponNoDateLimit').checked = !(coupon.starts_at || coupon.expires_at);
    $('#carCouponStartsAt').value = toDateTimeLocalInputValue(coupon.starts_at);
    $('#carCouponExpiresAt').value = toDateTimeLocalInputValue(coupon.expires_at);
    $('#carCouponSingleUse').checked = Boolean(coupon.single_use);
    $('#carCouponUsageLimitTotal').value = coupon.usage_limit_total ?? '';
    $('#carCouponUsageLimitPerUser').value = coupon.usage_limit_per_user ?? '';
    $('#carCouponMinRentalDays').value = coupon.min_rental_days ?? '';
    $('#carCouponMinRentalTotal').value = coupon.min_rental_total ?? '';
    $('#carCouponLocationPaphos').checked = normalizeCouponArray(coupon.applicable_locations).includes('paphos');
    $('#carCouponLocationLarnaca').checked = normalizeCouponArray(coupon.applicable_locations).includes('larnaca');
    $('#carCouponPartnerId').value = String(coupon.partner_id || '');
    $('#carCouponPartnerCommissionBps').value = coupon.partner_commission_bps_override ?? '';
    const scopePreset = {
      applicable_offer_ids: normalizeCouponArray(coupon.applicable_offer_ids),
      excluded_offer_ids: normalizeCouponArray(coupon.excluded_offer_ids),
      applicable_car_models: normalizeCouponArray(coupon.applicable_car_models),
      excluded_car_models: normalizeCouponArray(coupon.excluded_car_models),
      applicable_car_types: normalizeCouponArray(coupon.applicable_car_types),
      excluded_car_types: normalizeCouponArray(coupon.excluded_car_types),
    };
    populateCarCouponScopeSelectOptions(scopePreset);
    const scopeModeInput = $('#carCouponScopePrimaryMode');
    if (scopeModeInput) {
      scopeModeInput.value = inferCarCouponScopePrimaryMode(scopePreset);
    }
  } else {
    title.textContent = 'Create Coupon';
    populateCarCouponScopeSelectOptions();
    const scopeModeInput = $('#carCouponScopePrimaryMode');
    if (scopeModeInput) {
      scopeModeInput.value = 'all';
    }
  }

  syncCarCouponDiscountTypeFields();
  syncCarCouponSingleUseFields();
  syncCarCouponDateWindowFields({ preserveValues: true });
  syncCarCouponScopePrimaryModeFields({ preserveValues: true });
  modal.hidden = false;
}

async function handleCarCouponFormSubmit(event) {
  event.preventDefault();

  const submitBtn = $('#carCouponFormSubmit');
  const couponId = String($('#carCouponId')?.value || '').trim();

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = couponId ? 'Saving...' : 'Creating...';
    }

    setCarCouponFormError('');

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const payload = collectCarCouponFormPayload();
    payload.updated_by = adminState.user?.id || null;

    let error = null;
    if (couponId) {
      ({ error } = await client
        .from('car_coupons')
        .update(payload)
        .eq('id', couponId));
    } else {
      ({ error } = await client
        .from('car_coupons')
        .insert([{ ...payload, created_by: adminState.user?.id || null }]));
    }

    if (error) {
      const msg = String(error?.message || '');
      if (String(error?.code || '') === '23505' || /duplicate/i.test(msg) || /car_coupons_code_unique_idx/i.test(msg)) {
        throw new Error('Coupon code already exists');
      }
      throw error;
    }

    showToast(couponId ? 'Coupon updated successfully' : 'Coupon created successfully', 'success');
    closeCarCouponModal();
    await loadCarCouponsData({ silent: true });
  } catch (error) {
    console.error('Failed to save coupon:', error);
    const msg = String(error?.message || 'Unknown error');
    setCarCouponFormError(msg);
    showToast(`Failed to save coupon: ${msg}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Coupon';
    }
  }
}

async function setCarCouponActiveState(couponId, isActive) {
  const id = String(couponId || '').trim();
  if (!id) return;

  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const { error } = await client
      .from('car_coupons')
      .update({
        is_active: Boolean(isActive),
        updated_by: adminState.user?.id || null,
      })
      .eq('id', id);

    if (error) throw error;

    showToast(Boolean(isActive) ? 'Coupon enabled' : 'Coupon disabled', 'success');
    await loadCarCouponsData({ silent: true });
  } catch (error) {
    console.error('Failed to change coupon activity:', error);
    const msg = String(error?.message || 'Unknown error');
    setCarsCouponsViewError(`Failed to update coupon state: ${msg}`);
    showToast(`Failed to update coupon state: ${msg}`, 'error');
  }
}

async function deleteCarCoupon(couponId) {
  const id = String(couponId || '').trim();
  if (!id) return;

  if (!confirm('Delete this coupon? This action cannot be undone.')) return;
  const typed = prompt('Type DELETE to confirm coupon deletion:');
  if (typed !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    const { error } = await client
      .from('car_coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Coupon deleted', 'success');
    await loadCarCouponsData({ silent: true });
  } catch (error) {
    console.error('Failed to delete coupon:', error);
    const msg = String(error?.message || 'Unknown error');
    setCarsCouponsViewError(`Failed to delete coupon: ${msg}`);
    showToast(`Failed to delete coupon: ${msg}`, 'error');
  }
}

async function handleCarCouponsTableClick(event) {
  const button = event.target?.closest?.('button[data-coupon-action]');
  if (!button) return;

  const couponId = String(button.dataset.couponId || '').trim();
  const action = String(button.dataset.couponAction || '').trim();
  if (!couponId || !action) return;

  if (action === 'edit') {
    await openCarCouponModal(couponId);
    return;
  }
  if (action === 'activate') {
    await setCarCouponActiveState(couponId, true);
    return;
  }
  if (action === 'deactivate') {
    await setCarCouponActiveState(couponId, false);
    return;
  }
  if (action === 'delete') {
    await deleteCarCoupon(couponId);
  }
}

function clearCarCouponFilters() {
  carCouponsState.filters = {
    search: '',
    status: '',
    activity: '',
    discountType: '',
    partnerId: '',
  };

  const searchInput = $('#carsCouponsSearchInput');
  if (searchInput) searchInput.value = '';
  const statusFilter = $('#carsCouponsStatusFilter');
  if (statusFilter) statusFilter.value = '';
  const activityFilter = $('#carsCouponsActivityFilter');
  if (activityFilter) activityFilter.value = '';
  const typeFilter = $('#carsCouponsTypeFilter');
  if (typeFilter) typeFilter.value = '';
  const partnerFilter = $('#carsCouponsPartnerFilter');
  if (partnerFilter) partnerFilter.value = '';

  renderCarCouponsData();
}

async function handleCarsRefreshAction() {
  setCarsLiveSyncStatus('Live sync: updating...', 'syncing');
  await refreshCarsActiveTabData({
    silent: false,
    showSuccessToast: true,
    forcePartnersRefresh: true,
  });
}

async function handleCarsAddAction() {
  const tab = getActiveCarsTab();
  if (tab === 'fleet') {
    openFleetCarModal();
    return;
  }
  if (tab === 'coupons') {
    await openCarCouponModal();
    return;
  }
  showToast('Add new car booking - coming soon', 'info');
}

// =====================================================
// FLEET MANAGEMENT
// =====================================================

let fleetState = {
  cars: [],
  locationFilter: '',
  typeFilter: ''
};

// Setup event delegation for car availability dropdowns
function setupFleetEventListeners() {
  console.log('🔧 Setting up fleet event listeners...');
  
  const tbody = $('#fleetTableBody');
  if (!tbody) {
    console.warn('⚠️ Fleet table body not found');
    return;
  }
  
  // Use event delegation on tbody instead of document
  tbody.removeEventListener('change', handleAvailabilityChange);
  tbody.addEventListener('change', handleAvailabilityChange);
  
  console.log('✅ Event listener attached to fleetTableBody');
}

function handleAvailabilityChange(e) {
  console.log('🎯 Change event detected on:', e.target);
  
  if (e.target && e.target.classList.contains('car-availability-select')) {
    const carId = e.target.dataset.carId;
    const newValue = e.target.value;
    console.log('🔄 Availability dropdown changed:', { carId, newValue, element: e.target });
    
    if (carId && newValue) {
      toggleCarAvailability(carId, newValue);
    } else {
      console.error('❌ Missing carId or newValue:', { carId, newValue });
    }
  }
}

async function loadFleetData(options = {}) {
  const { silent = false, showSuccessToast = false } = options;
  try {
    const client = ensureSupabase();
    if (!client) {
      if (!silent) {
        showToast('Database connection not available', 'error');
      }
      markCarsLiveSyncError();
      return;
    }

    console.log('Loading fleet data...');

    // Build query with filters
    let query = client
      .from('car_offers')
      .select('*')
      .order('location', { ascending: true })
      .order('sort_order', { ascending: true });

    // Apply filters
    if (fleetState.locationFilter) {
      query = query.eq('location', fleetState.locationFilter);
    }
    if (fleetState.typeFilter) {
      query = query.eq('car_type', fleetState.typeFilter);
    }

    const { data: cars, error } = await query;

    if (error) {
      console.error('Error loading fleet:', error);
      throw error;
    }

    fleetState.cars = cars || [];
    // Store ordered list globally for reordering helpers
    window.fleetCarsList = Array.isArray(fleetState.cars) ? fleetState.cars.slice() : [];
    console.log(`Loaded ${window.fleetCarsList.length} cars`);

    // Render fleet table
    const tbody = $('#fleetTableBody');
    if (!tbody) {
      markCarsLiveSyncUpdated();
      if (!silent && showSuccessToast) {
        showToast('Fleet refreshed', 'success');
      }
      return;
    }

    if (!window.fleetCarsList || window.fleetCarsList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="table-loading">No cars found with current filters</td></tr>';
      markCarsLiveSyncUpdated();
      if (!silent && showSuccessToast) {
        showToast('Fleet refreshed', 'success');
      }
      return;
    }

    tbody.innerHTML = window.fleetCarsList.map((car, index) => {
      // Extract i18n values for display (prefer Polish, fallback to English)
      const carModel = car.car_model?.pl || car.car_model?.en || car.car_model || 'Unknown';
      const carType = car.car_type?.pl || car.car_type?.en || car.car_type || '';
      const carDesc = car.description?.pl || car.description?.en || car.description || '';
      
      // Determine price display based on location
      let priceDisplay;
      if (car.location === 'paphos' && car.price_3days) {
        priceDisplay = `<div style="font-weight: 600;">€${car.price_3days}/3d</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">€${car.price_10plus_days}+/day</div>`;
      } else {
        priceDisplay = `<div style="font-weight: 600;">€${car.price_per_day}/day</div>`;
      }

      // Image display
      const imageDisplay = car.image_url 
        ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(carModel)}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">`
        : `<div style="width: 60px; height: 40px; background: var(--admin-border); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🚗</div>`;

      const sortOrder = typeof car.sort_order === 'number' ? car.sort_order : (index + 1);

      return `
        <tr>
          <td>${imageDisplay}</td>
          <td>
            <span class="badge ${car.location === 'larnaca' ? 'badge-info' : 'badge-warning'}">
              ${car.location.toUpperCase()}
            </span>
          </td>
          <td>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--admin-text-muted);">#${index + 1}</span>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <button type="button" title="Move up" onclick="moveFleetCarOrder('${car.id}','up')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▲</button>
                <button type="button" title="Move down" onclick="moveFleetCarOrder('${car.id}','down')" style="border:1px solid var(--admin-border);background:var(--admin-bg-secondary);color:var(--admin-text);border-radius:4px;padding:0 4px;font-size:10px;line-height:14px;">▼</button>
              </div>
              <span style="font-size:10px;color:var(--admin-text-muted);">${sortOrder}</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(carModel)}</div>
            <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(carDesc.substring(0, 40))}${carDesc.length > 40 ? '...' : ''}</div>
          </td>
          <td>${escapeHtml(carType)}</td>
          <td>${priceDisplay}</td>
          <td>
            <span class="badge ${car.transmission === 'automatic' ? 'badge-success' : 'badge-secondary'}">
              ${car.transmission}
            </span>
          </td>
          <td>${escapeHtml(car.fuel_type)}</td>
          <td>${car.max_passengers} seats</td>
          <td>
            <select 
              class="car-availability-select" 
              style="padding: 8px 12px; font-size: 13px; font-weight: 600; border: 2px solid; border-radius: 6px; cursor: pointer; min-width: 140px;
                     background-color: ${car.is_available ? '#d1fae5' : '#fee2e2'};
                     color: ${car.is_available ? '#065f46' : '#991b1b'};
                     border-color: ${car.is_available ? '#10b981' : '#ef4444'};"
              data-car-id="${car.id}"
            >
              <option value="true" ${car.is_available ? 'selected' : ''}>✓ Available</option>
              <option value="false" ${!car.is_available ? 'selected' : ''}>✗ Not Available</option>
            </select>
            ${car.stock_count ? `<div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 4px;">Stock: ${car.stock_count}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-icon" type="button" title="Edit" onclick="editFleetCar('${car.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
              </button>
              <button class="btn-icon" type="button" title="Delete" onclick="deleteFleetCar('${car.id}', '${escapeHtml(carModel)}')" style="color: var(--admin-danger);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Setup event listeners after rendering table
    setupFleetEventListeners();
    markCarsLiveSyncUpdated();
    if (!silent && showSuccessToast) {
      showToast('Fleet refreshed', 'success');
    }

  } catch (e) {
    console.error('Error loading fleet:', e);
    markCarsLiveSyncError();
    if (!silent) {
      showToast('Failed to load fleet: ' + (e.message || 'Unknown error'), 'error');
    }
    const tbody = $('#fleetTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="11" class="table-loading" style="color: var(--admin-danger);">Error: ${escapeHtml(e.message)}</td></tr>`;
    }
  }
}

async function moveFleetCarOrder(carId, direction) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const list = Array.isArray(window.fleetCarsList) ? window.fleetCarsList : [];
    const index = list.findIndex(c => c.id === carId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      showToast('Cannot move further', 'info');
      return;
    }

    const current = list[index];
    const target = list[targetIndex];
    const currentOrder = typeof current.sort_order === 'number' ? current.sort_order : (index + 1);
    const targetOrder = typeof target.sort_order === 'number' ? target.sort_order : (targetIndex + 1);

    const { error: err1 } = await client
      .from('car_offers')
      .update({ sort_order: targetOrder })
      .eq('id', current.id);
    if (err1) throw err1;

    const { error: err2 } = await client
      .from('car_offers')
      .update({ sort_order: currentOrder })
      .eq('id', target.id);
    if (err2) throw err2;

    showToast('Car order updated', 'success');
    await loadFleetData();
  } catch (e) {
    console.error('Failed to update car order:', e);
    showToast('Failed to update order: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function deleteFleetCar(carId, carModel) {
  if (!confirm(`Are you sure you want to delete ${carModel}?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    try {
      await deletePartnerResourcesFor('cars', carId);
    } catch (_e) {
    }

    try {
      await client
        .from('partner_service_fulfillments')
        .delete()
        .eq('resource_type', 'cars')
        .eq('resource_id', carId);
    } catch (_e) {
    }

    const { error } = await client
      .from('car_offers')
      .delete()
      .eq('id', carId);

    if (error) throw error;

    showToast(`${carModel} deleted successfully`, 'success');
    loadFleetData(); // Reload the list

  } catch (e) {
    console.error('Error deleting car:', e);
    showToast('Failed to delete car: ' + (e.message || 'Unknown error'), 'error');
  }
}

async function editFleetCar(carId) {
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Fetch car data
    const { data: car, error } = await client
      .from('car_offers')
      .select('*')
      .eq('id', carId)
      .single();

    if (error) throw error;
    if (!car) throw new Error('Car not found');

    // Open modal in edit mode
    openFleetCarModal(car);

  } catch (e) {
    console.error('Error loading car for edit:', e);
    showToast('Failed to load car: ' + (e.message || 'Unknown error'), 'error');
  }
}

function openFleetCarModal(carData = null) {
  const modal = $('#fleetCarModal');
  const title = $('#fleetCarModalTitle');
  const form = $('#fleetCarForm');
  
  if (!modal || !title || !form) return;

  // Reset form
  form.reset();
  
  const errorDiv = $('#fleetCarFormError');
  if (errorDiv) {
    errorDiv.hidden = true;
    errorDiv.textContent = '';
  }

  // Reset image preview
  resetImagePreview();
  
  // Check if we should use i18n fields
  // All cars use i18n (car_model, car_type, description are JSONB)
  const useI18n = true;
  const i18nContainer = $('#carI18nFields');
  const legacyFields = $('#carLegacyFields');
  
  if (useI18n && i18nContainer && legacyFields && window.renderI18nInput) {
    // Render i18n fields
    const carModelContainer = $('#carModelI18n');
    const carDescContainer = $('#carDescriptionI18n');
    
    if (carModelContainer) {
      carModelContainer.innerHTML = window.renderI18nInput({
        fieldName: 'car_model',
        label: 'Car Model',
        type: 'text',
        placeholder: 'e.g., Toyota Yaris (2023)',
        currentValues: carData?.car_model || {}
      });
    }
    
    if (carDescContainer) {
      carDescContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        placeholder: 'Short description of the car',
        currentValues: carData?.description || {}
      });
    }
    
    // Render features i18n (array input)
    const featuresContainer = $('#featuresI18n');
    if (featuresContainer && window.renderI18nArrayInput) {
      featuresContainer.innerHTML = window.renderI18nArrayInput({
        fieldName: 'features',
        label: 'Features',
        rows: 5,
        placeholder: 'Air Conditioning\nBluetooth\nGPS Navigation',
        currentValues: carData?.features || {}
      });
    }
    
    // Show i18n container, hide legacy fields
    i18nContainer.style.display = 'block';
    legacyFields.style.display = 'none';
  } else if (legacyFields && i18nContainer) {
    // Use legacy fields
    i18nContainer.style.display = 'none';
    legacyFields.style.display = 'block';
  }

  if (carData) {
    // Edit mode
    const modelDisplay = carData.car_model?.pl || carData.car_model?.en || 'this car';
    title.textContent = `Edit ${modelDisplay}`;
    
    // Fill form with existing data
    $('#fleetCarId').value = carData.id;
    $('#fleetCarLocation').value = carData.location || '';
    // Extract English car_type to match dropdown options
    const carTypeValue = carData.car_type?.en || carData.car_type || '';
    $('#fleetCarType').value = carTypeValue;
    
    // Fill legacy fields if not using i18n
    if (!useI18n) {
      const legacyModel = $('#fleetCarModel');
      const legacyDesc = $('#fleetCarDescription');
      if (legacyModel) legacyModel.value = carData.car_model || '';
      if (legacyDesc) legacyDesc.value = carData.description || '';
    }
    
    // Pricing
    if (carData.location === 'larnaca') {
      $('#fleetCarPricePerDay').value = carData.price_per_day || '';
    } else if (carData.location === 'paphos') {
      $('#fleetCarPrice3Days').value = carData.price_3days || '';
      $('#fleetCarPrice4_6Days').value = carData.price_4_6days || '';
      $('#fleetCarPrice7_10Days').value = carData.price_7_10days || '';
      $('#fleetCarPrice10PlusDays').value = carData.price_10plus_days || '';
    }
    
    $('#fleetCarDeposit').value = carData.deposit_amount || 200;
    $('#fleetCarInsurance').value = carData.insurance_per_day || 17;
    
    // Specs
    $('#fleetCarTransmission').value = carData.transmission || 'manual';
    $('#fleetCarFuelType').value = carData.fuel_type || 'petrol';
    $('#fleetCarCurrency').value = carData.currency || 'EUR';
    $('#fleetCarMaxPassengers').value = carData.max_passengers || 5;
    $('#fleetCarMaxLuggage').value = carData.max_luggage || 2;
    $('#fleetCarStockCount').value = carData.stock_count || 1;
    $('#fleetCarSortOrder').value = carData.sort_order || 1000;
    
    // Image and availability
    $('#fleetCarImageUrl').value = carData.image_url || '';
    $('#fleetCarIsAvailable').checked = carData.is_available !== false;
    
    // Show existing image if available
    if (carData.image_url) {
      showImagePreview(carData.image_url);
    }
    
    // Features are now handled by i18n component (renderI18nArrayInput)
    // No need to manually set #fleetCarFeatures as it doesn't exist anymore
    // Features are loaded in the i18n rendering section above (lines 4264-4274)
    
    // Trigger location change to show correct pricing fields
    handleLocationChange(carData.location);
    
  } else {
    // Add mode
    title.textContent = 'Add New Car';
    $('#fleetCarId').value = '';
    
    // Set defaults
    $('#fleetCarCurrency').value = 'EUR';
    $('#fleetCarTransmission').value = 'manual';
    $('#fleetCarFuelType').value = 'petrol';
    $('#fleetCarMaxPassengers').value = 5;
    $('#fleetCarMaxLuggage').value = 2;
    $('#fleetCarStockCount').value = 1;
    $('#fleetCarSortOrder').value = 1000;
    $('#fleetCarDeposit').value = 200;
    $('#fleetCarInsurance').value = 17;
    $('#fleetCarIsAvailable').checked = true;
  }

  // Show modal
  modal.hidden = false;
}

async function toggleCarAvailability(carId, isAvailable) {
  try {
    console.log('toggleCarAvailability called:', { carId, isAvailable });
    
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Convert string to boolean if needed
    const availableBoolean = typeof isAvailable === 'string' ? isAvailable === 'true' : !!isAvailable;
    
    console.log('Updating car availability:', { carId, availableBoolean });

    const { error } = await client
      .from('car_offers')
      .update({ is_available: availableBoolean }, { returning: 'minimal' })
      .eq('id', carId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    showToast(availableBoolean ? '✓ Car is now visible on site' : '✗ Car hidden from site', 'success');

    // Refresh row list to reflect updated dropdown color
    await loadFleetData();
    
  } catch (e) {
    console.error('Failed to update availability:', e);
    showToast('Failed to update availability: ' + (e.message || 'Unknown error'), 'error');
    // Revert UI by reloading list
    await loadFleetData();
  }
}

// Image upload functions
function showImagePreview(imageUrl) {
  const preview = $('#fleetCarImagePreview');
  const previewImg = $('#fleetCarImagePreviewImg');
  
  if (preview && previewImg && imageUrl) {
    previewImg.src = imageUrl;
    preview.hidden = false;
  }
}

function resetImagePreview() {
  const preview = $('#fleetCarImagePreview');
  const previewImg = $('#fleetCarImagePreviewImg');
  const fileInput = $('#fleetCarImageFile');
  const progress = $('#fleetCarImageUploadProgress');
  
  if (preview) preview.hidden = true;
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (progress) progress.hidden = true;
  
  $('#fleetCarImageUrl').value = '';
}

function removeCarImage() {
  resetImagePreview();
  showToast('Image removed. Save the form to apply changes.', 'info');
}

async function uploadCarImage(file) {
  const client = ensureSupabase();
  if (!client) throw new Error('Database connection not available');

  // Validate file
  if (!file) throw new Error('No file selected');
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split('.').pop();
  const filename = `car-${timestamp}-${randomStr}.${ext}`;

  // Show progress
  const progressDiv = $('#fleetCarImageUploadProgress');
  const progressBar = $('#fleetCarImageUploadProgressBar');
  const statusText = $('#fleetCarImageUploadStatus');
  
  if (progressDiv) progressDiv.hidden = false;
  if (statusText) statusText.textContent = 'Uploading...';
  if (progressBar) progressBar.style.width = '30%';

  try {
    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('car-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    if (progressBar) progressBar.style.width = '100%';
    if (statusText) statusText.textContent = 'Upload complete!';

    // Get public URL
    const { data: urlData } = client.storage
      .from('car-images')
      .getPublicUrl(filename);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    console.log('Image uploaded successfully:', urlData.publicUrl);

    // Set the URL in hidden field
    $('#fleetCarImageUrl').value = urlData.publicUrl;
    
    // Show preview
    showImagePreview(urlData.publicUrl);

    // Hide progress after a moment
    setTimeout(() => {
      if (progressDiv) progressDiv.hidden = true;
      if (progressBar) progressBar.style.width = '0%';
    }, 1500);

    showToast('Image uploaded successfully!', 'success');
    
    return urlData.publicUrl;

  } catch (e) {
    if (progressBar) progressBar.style.width = '0%';
    if (statusText) statusText.textContent = 'Upload failed';
    if (progressDiv) {
      setTimeout(() => {
        progressDiv.hidden = true;
      }, 3000);
    }
    throw e;
  }
}

function handleImageFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  uploadCarImage(file).catch(e => {
    console.error('Upload error:', e);
    showToast('Failed to upload image: ' + (e.message || 'Unknown error'), 'error');
    // Reset file input
    event.target.value = '';
  });
}

function handleUseImageUrl() {
  const urlInput = $('#fleetCarImageUrlInput');
  if (!urlInput) return;

  const imageUrl = urlInput.value.trim();
  if (!imageUrl) {
    showToast('Please enter an image URL', 'warning');
    return;
  }

  // Validate URL
  try {
    new URL(imageUrl);
  } catch (e) {
    showToast('Invalid URL format', 'error');
    return;
  }

  // Set URL and show preview
  $('#fleetCarImageUrl').value = imageUrl;
  showImagePreview(imageUrl);
  urlInput.value = '';
  showToast('Image URL set successfully', 'success');
}

// Make functions global
window.removeCarImage = removeCarImage;
window.handleImageFileChange = handleImageFileChange;
window.handleUseImageUrl = handleUseImageUrl;

function closeFleetCarModal() {
  const modal = $('#fleetCarModal');
  if (modal) modal.hidden = true;
}

function handleLocationChange(location) {
  const larnacaPricing = $('#larnacaPricing');
  const paphosPricing = $('#paphosPricing');
  
  if (!larnacaPricing || !paphosPricing) return;

  if (location === 'larnaca') {
    larnacaPricing.hidden = false;
    paphosPricing.hidden = true;
    
    // Make Larnaca field required
    const pricePerDay = $('#fleetCarPricePerDay');
    if (pricePerDay) pricePerDay.required = true;
    
    // Remove Paphos field requirements
    $('#fleetCarPrice3Days').required = false;
    
  } else if (location === 'paphos') {
    larnacaPricing.hidden = true;
    paphosPricing.hidden = false;
    
    // Remove Larnaca field requirement
    const pricePerDay = $('#fleetCarPricePerDay');
    if (pricePerDay) pricePerDay.required = false;
    
    // Make Paphos 3-day price required
    $('#fleetCarPrice3Days').required = true;
    
  } else {
    // No location selected
    larnacaPricing.hidden = true;
    paphosPricing.hidden = true;
  }
}

async function handleFleetCarSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const errorDiv = $('#fleetCarFormError');
  const submitBtn = $('#fleetCarFormSubmit');
  
  try {
    if (submitBtn) submitBtn.disabled = true;
    if (errorDiv) errorDiv.hidden = true;

    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');

    // Get form data
    const carId = $('#fleetCarId').value;
    const location = $('#fleetCarLocation').value;
    
    // Check if using i18n fields
    const usingI18n = $('#carI18nFields')?.style.display !== 'none';
    let carModel, description;
    let carModelI18n, descriptionI18n, featuresI18n;
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      const formData = new FormData(form);
      carModelI18n = window.extractI18nValues(formData, 'car_model');
      descriptionI18n = window.extractI18nValues(formData, 'description');
      
      // Extract features i18n (array values)
      if (window.extractI18nArrayValues) {
        featuresI18n = window.extractI18nArrayValues(formData, 'features');
      }
      
      console.log('🔍 Extracted car i18n values:', { carModelI18n, descriptionI18n, featuresI18n });
      
      // Validate i18n fields
      if (window.validateI18nField) {
        const modelError = window.validateI18nField(carModelI18n, 'Car Model');
        if (modelError) {
          console.error('❌ Validation error:', modelError);
          throw new Error(modelError);
        }
        console.log('✅ Validation passed');
      }
    } else {
      // Use legacy fields
      carModel = ($('#fleetCarModel')?.value || '').trim();
      description = ($('#fleetCarDescription')?.value || '').trim();
      
      if (!carModel) {
        throw new Error('Car Model is required');
      }
    }
    
    // Build car object
    const carData = {
      location: location,
      car_type: $('#fleetCarType').value,
      transmission: $('#fleetCarTransmission').value,
      fuel_type: $('#fleetCarFuelType').value,
      currency: $('#fleetCarCurrency').value,
      max_passengers: parseInt($('#fleetCarMaxPassengers').value) || 5,
      max_luggage: parseInt($('#fleetCarMaxLuggage').value) || 2,
      stock_count: parseInt($('#fleetCarStockCount').value) || 1,
      sort_order: parseInt($('#fleetCarSortOrder').value) || 1000,
      deposit_amount: parseFloat($('#fleetCarDeposit').value) || 0,
      insurance_per_day: parseFloat($('#fleetCarInsurance').value) || 0,
      image_url: $('#fleetCarImageUrl').value || null,
      is_available: $('#fleetCarIsAvailable').checked
    };
    
    // Save i18n fields directly to car_model, description, and features (JSONB columns)
    if (usingI18n && window.extractI18nValues) {
      if (carModelI18n) carData.car_model = carModelI18n;
      if (descriptionI18n) carData.description = descriptionI18n;
      if (featuresI18n) carData.features = featuresI18n;
      
      // Clean up legacy fields
      delete carData.car_model_pl;
      delete carData.car_model_en;
      delete carData.car_model_el;
      delete carData.car_model_he;
      delete carData.description_pl;
      delete carData.description_en;
      delete carData.description_el;
      delete carData.description_he;
    } else {
      // Legacy mode - save as text
      carData.car_model = carModel;
      carData.description = description;
      
      // Parse features from legacy textarea (one per line)
      const featuresText = $('#fleetCarFeatures')?.value?.trim() || '';
      if (featuresText) {
        const featuresArray = featuresText
          .split('\n')
          .map(f => f.trim())
          .filter(f => f.length > 0);
        carData.features = featuresArray;
      } else {
        carData.features = [];
      }
    }
    
    console.log('💾 Car payload:', carData);

    // Location-specific pricing
    if (location === 'larnaca') {
      carData.price_per_day = parseFloat($('#fleetCarPricePerDay').value) || 0;
      carData.price_3days = null;
      carData.price_4_6days = null;
      carData.price_7_10days = null;
      carData.price_10plus_days = null;
    } else if (location === 'paphos') {
      carData.price_per_day = parseFloat($('#fleetCarPrice3Days').value) || 0; // Use 3-day as base
      carData.price_3days = parseFloat($('#fleetCarPrice3Days').value) || 0;
      carData.price_4_6days = parseFloat($('#fleetCarPrice4_6Days').value) || 0;
      carData.price_7_10days = parseFloat($('#fleetCarPrice7_10Days').value) || 0;
      carData.price_10plus_days = parseFloat($('#fleetCarPrice10PlusDays').value) || 0;
    }

    // Insert or Update
    let result;
    if (carId) {
      // Update existing car (no select to avoid 406 when zero rows are returned)
      const { error } = await client
        .from('car_offers')
        .update(carData, { returning: 'minimal' })
        .eq('id', carId);

      if (error) throw error;

      result = { id: carId, ...carData };
      showToast(`${carData.car_model} updated successfully`, 'success');
    } else {
      // Insert new car
      const { data, error } = await client
        .from('car_offers')
        .insert([carData])
        .select()
        .single();
      
      if (error) throw error;
      result = data;
      
      showToast(`${carData.car_model} added successfully`, 'success');
    }

    console.log('Car saved:', result);

    // Close modal and refresh list
    closeFleetCarModal();
    loadFleetData();

  } catch (e) {
    console.error('Error saving car:', e);
    
    if (errorDiv) {
      errorDiv.textContent = 'Failed to save car: ' + (e.message || 'Unknown error');
      errorDiv.hidden = false;
    }
    
    showToast('Failed to save car: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Make functions global
window.openFleetCarModal = openFleetCarModal;
window.closeFleetCarModal = closeFleetCarModal;
window.handleLocationChange = handleLocationChange;
window.moveFleetCarOrder = moveFleetCarOrder;
window.handleFleetCarSubmit = handleFleetCarSubmit;
window.toggleCarAvailability = toggleCarAvailability;

function switchCarsTab(tab) {
  const normalizedTab = normalizeCarsTabValue(tab);
  carsUiState.activeTab = normalizedTab;

  // Update tab buttons
  document.querySelectorAll('.cars-tab-button').forEach(btn => {
    const isActive = normalizeCarsTabValue(btn.dataset.tab) === normalizedTab;
    btn.classList.toggle('active', isActive);
    btn.style.borderBottom = isActive ? '2px solid var(--admin-primary)' : '2px solid transparent';
    btn.style.color = isActive ? 'var(--admin-primary)' : 'var(--admin-text-muted)';
  });

  // Show/hide tab content
  const bookingsTab = $('#carsTabBookings');
  const couponsTab = $('#carsTabCoupons');
  const fleetTab = $('#carsTabFleet');
  const bookingsStats = $('#carsBookingsStats');

  if (bookingsTab) bookingsTab.hidden = (normalizedTab !== 'bookings');
  if (couponsTab) couponsTab.hidden = (normalizedTab !== 'coupons');
  if (fleetTab) fleetTab.hidden = (normalizedTab !== 'fleet');
  if (bookingsStats) bookingsStats.hidden = (normalizedTab !== 'bookings');

  // Update action buttons
  const btnAddCar = $('#btnAddCar');
  const btnRefreshCars = $('#btnRefreshCars');

  if (btnAddCar) btnAddCar.onclick = null;
  if (btnRefreshCars) btnRefreshCars.onclick = null;

  if (isCarsViewActive()) {
    setCarsLiveSyncStatus('Live sync: updating...', 'syncing');
    startCarsLiveRefresh();
  }

  if (normalizedTab === 'bookings') {
    if (btnAddCar) {
      btnAddCar.textContent = 'New Booking';
    }
    loadCarsData({ silent: true });
    return;
  }

  if (normalizedTab === 'coupons') {
    if (btnAddCar) {
      btnAddCar.textContent = 'Add Coupon';
    }
    loadCarCouponsData({ silent: true });
    return;
  }

  if (btnAddCar) {
    btnAddCar.textContent = 'Add New Car';
  }
  loadFleetData({ silent: true });
}

// Make functions global
window.loadFleetData = loadFleetData;
window.deleteFleetCar = deleteFleetCar;
window.editFleetCar = editFleetCar;
window.switchCarsTab = switchCarsTab;
window.openCarCouponModal = openCarCouponModal;
window.closeCarCouponModal = closeCarCouponModal;

// =====================================================
// DIAGNOSTICS
// =====================================================

async function loadDiagnosticsData() {
  try {
    const client = ensureSupabase();
    
    // Check database connection
    const dbStatus = $('#dbStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) throw error;
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Connected</span>';
      }
    } catch (error) {
      if (dbStatus) {
        dbStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check API
    const apiStatus = $('#apiStatus');
    try {
      if (!client) throw new Error('Client not available');
      const { error } = await client.auth.getSession();
      if (error) throw error;
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Operational</span>';
      }
    } catch (error) {
      if (apiStatus) {
        apiStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Error</span>';
      }
    }

    // Check storage
    const storageStatus = $('#storageStatus');
    if (storageStatus) {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        storageStatus.innerHTML = '<span class="status-indicator status-ok"></span><span>Available</span>';
      } catch (error) {
        storageStatus.innerHTML = '<span class="status-indicator status-error"></span><span>Unavailable</span>';
      }
    }

    // Load system metrics
    if (!client) {
      console.error('Cannot load system metrics - client not available');
      return;
    }
    
    const { data: metrics, error } = await client
      .from('admin_system_diagnostics')
      .select('*');

    if (error) throw error;

    const metricsTable = $('#systemMetricsTable');
    if (!metricsTable) return;

    if (!metrics || metrics.length === 0) {
      metricsTable.innerHTML = '<tr><td colspan="3" class="table-loading">No metrics available</td></tr>';
      return;
    }

    metricsTable.innerHTML = metrics.map(metric => `
      <tr>
        <td style="font-weight: 500;">${metric.metric.replace(/_/g, ' ').toUpperCase()}</td>
        <td style="font-size: 18px; font-weight: 600;">${metric.value}</td>
        <td style="color: var(--admin-text-muted);">${metric.description}</td>
      </tr>
    `).join('');

    // Render health checks table
    await renderDiagnosticChecks();

  } catch (error) {
    console.error('Failed to load diagnostics:', error);
    showToast('Failed to load diagnostics', 'error');
  }
}

// -----------------------------------------------------
// Health Checks
// -----------------------------------------------------

const diagnosticsState = {
  statuses: {},
};

// SQL snippets used for guided Auto-Fix
 const SQL_ADD_POI_STATUS = `-- =====================================================
 -- ADD STATUS COLUMN TO POIS TABLE
 -- =====================================================
 -- This adds a status column so POIs can be draft/published/hidden
 -- =====================================================
 
 -- Add status column if it doesn't exist
 DO $$ 
 BEGIN
   IF NOT EXISTS (
     SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'pois' AND column_name = 'status'
   ) THEN
     ALTER TABLE pois ADD COLUMN status TEXT DEFAULT 'published';
     RAISE NOTICE '✅ Added status column to pois table';
   ELSE
     RAISE NOTICE 'ℹ️ Status column already exists';
   END IF;
 END $$;
 
 -- Set default status to 'published' for existing POIs
 UPDATE pois SET status = 'published' WHERE status IS NULL;
 
 -- Create index for faster status queries
 CREATE INDEX IF NOT EXISTS idx_pois_status ON pois(status);
 
 -- Verify the change
 DO $$
 DECLARE
   total_count INTEGER;
   published_count INTEGER;
   draft_count INTEGER;
   hidden_count INTEGER;
 BEGIN
   SELECT 
     COUNT(*),
     COUNT(*) FILTER (WHERE status = 'published'),
     COUNT(*) FILTER (WHERE status = 'draft'),
     COUNT(*) FILTER (WHERE status = 'hidden')
   INTO total_count, published_count, draft_count, hidden_count
   FROM pois;
   
   RAISE NOTICE '✅ Status column setup complete';
   RAISE NOTICE 'Total POIs: %, Published: %, Draft: %, Hidden: %', 
     total_count, published_count, draft_count, hidden_count;
 END $$;`;
 
 const SQL_ADD_GOOGLE_URL_TO_POIS = `-- =====================================================
 -- ADD GOOGLE_URL TO POIS AND UPDATE ADMIN FUNCTIONS
 -- =====================================================
 -- This migration adds an optional google_url column to pois and
 -- updates admin_create_poi/admin_update_poi to read it from poi_data.
 -- Safe to run multiple times.
 -- =====================================================
 
 -- 1) Add column if missing
 DO $$
 BEGIN
   IF NOT EXISTS (
     SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'pois'
       AND column_name = 'google_url'
   ) THEN
     ALTER TABLE pois ADD COLUMN google_url TEXT;
   END IF;
 END $$;
 
 -- 2) Recreate admin_create_poi to set google_url from poi_data
 DROP FUNCTION IF EXISTS admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
 CREATE OR REPLACE FUNCTION admin_create_poi(
   poi_name TEXT,
   poi_description TEXT,
   poi_latitude DOUBLE PRECISION,
   poi_longitude DOUBLE PRECISION,
   poi_category TEXT DEFAULT 'other',
   poi_xp INTEGER DEFAULT 100,
   poi_data JSON DEFAULT '{}'::JSON
 )
 RETURNS JSON
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
   new_poi_id TEXT;
   new_google_url TEXT;
 BEGIN
   IF NOT is_current_user_admin() THEN
     RAISE EXCEPTION 'Access denied: Admin only';
   END IF;
 
   new_poi_id := COALESCE(
     poi_data->>'slug',
     LOWER(REGEXP_REPLACE(poi_name, '[^a-zA-Z0-9]+', '-', 'g'))
   );
 
   new_google_url := NULLIF(TRIM(poi_data->>'google_url'), '');
 
   INSERT INTO pois (
     id,
     name,
     description,
     lat,
     lng,
     xp,
     badge,
     required_level,
     status,
     google_url
   ) VALUES (
     new_poi_id,
     poi_name,
     poi_description,
     poi_latitude,
     poi_longitude,
     COALESCE(poi_xp, 100),
     poi_category,
     1,
     COALESCE((poi_data->>'status')::TEXT, 'published'),
     new_google_url
   );
 
   INSERT INTO admin_actions (
     admin_id,
     action_type,
     target_user_id,
     action_data
   ) VALUES (
     auth.uid(),
     'create_poi',
     NULL,
     json_build_object('poi_id', new_poi_id)
   );
 
   RETURN json_build_object('success', true, 'poi_id', new_poi_id);
 END;
 $$;
 
 -- 3) Recreate admin_update_poi to update google_url when provided
 DROP FUNCTION IF EXISTS admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON);
 CREATE OR REPLACE FUNCTION admin_update_poi(
   poi_id TEXT,
   poi_name TEXT DEFAULT NULL,
   poi_description TEXT DEFAULT NULL,
   poi_latitude DOUBLE PRECISION DEFAULT NULL,
   poi_longitude DOUBLE PRECISION DEFAULT NULL,
   poi_category TEXT DEFAULT NULL,
   poi_xp INTEGER DEFAULT NULL,
   poi_data JSON DEFAULT NULL
 )
 RETURNS JSON
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
   new_google_url TEXT;
 BEGIN
   IF NOT is_current_user_admin() THEN
     RAISE EXCEPTION 'Access denied: Admin only';
   END IF;
 
   new_google_url := NULLIF(TRIM(COALESCE(poi_data->>'google_url', NULL)), '');
 
   UPDATE pois
   SET 
     name = COALESCE(poi_name, name),
     description = COALESCE(poi_description, description),
     lat = COALESCE(poi_latitude, lat),
     lng = COALESCE(poi_longitude, lng),
     badge = COALESCE(poi_category, badge),
     xp = COALESCE(poi_xp, xp),
     status = COALESCE((poi_data->>'status')::TEXT, status),
     google_url = COALESCE(new_google_url, google_url)
   WHERE id = poi_id;
 
   INSERT INTO admin_actions (
     admin_id,
     action_type,
     target_user_id,
     action_data
   ) VALUES (
     auth.uid(),
     'update_poi',
     NULL,
     json_build_object('poi_id', poi_id)
   );
 
   RETURN json_build_object('success', true, 'poi_id', poi_id);
 END;
 $$;
 
 GRANT EXECUTE ON FUNCTION admin_create_poi(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;
 GRANT EXECUTE ON FUNCTION admin_update_poi(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, JSON) TO authenticated;`;
function getDiagnosticChecks() {
  return [
    {
      id: 'check_admin_system_diagnostics_view',
      title: 'Admin view: admin_system_diagnostics',
      description: 'View used for metrics and dashboard stats',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_system_diagnostics').select('*').limit(1);
          if (error) throw error;
          return { status: 'ok', details: (data && data.length ? 'OK (has rows)' : 'OK (no rows)') };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_admin_users_overview_view',
      title: 'Admin view: admin_users_overview',
      description: 'Users overview used in Users tab',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_users_overview').select('id').limit(1);
          if (error) throw error;
          return { status: 'ok', details: (data && data.length ? 'OK (has rows)' : 'OK (no rows)') };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_content_stats',
      title: 'Function: admin_get_content_stats()',
      description: 'Returns JSON with counts and activity',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_content_stats');
          if (error) throw error;
          const keys = data && typeof data === 'object' ? Object.keys(data).length : 0;
          return { status: 'ok', details: `OK (${keys} keys)` };
        } catch (e) {
          return { status: 'error', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_missing_coordinates',
      title: 'POIs: missing/invalid coordinates',
      description: 'Detects POIs without latitude/longitude',
      run: async (client) => {
        try {
          // Detect coordinate column names: prefer lat/lng, fallback to latitude/longitude
          let cols = { lat: 'lat', lng: 'lng' };
          let probe = await client.from('pois').select('id, lat, lng').limit(1);
          if (probe.error) {
            // Try alternate schema
            const probe2 = await client.from('pois').select('id, latitude, longitude').limit(1);
            if (probe2.error) {
              return { status: 'error', details: 'Neither lat/lng nor latitude/longitude columns exist' };
            }
            cols = { lat: 'latitude', lng: 'longitude' };
          }

          const { data, error } = await client
            .from('pois')
            .select(`id, name, ${cols.lat}, ${cols.lng}`)
            .or(`${cols.lat}.is.null,${cols.lng}.is.null`)
            .limit(5);
          if (error) throw error;
          const countText = Array.isArray(data) ? `${data.length} (sample shown)` : '0';
          return { status: (data && data.length ? 'warn' : 'ok'), details: data && data.length ? `Found ${countText}` : 'OK (none found)' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_missing_google_url',
      title: 'POIs: missing Google URL',
      description: 'Detects POIs without google_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('pois')
            .select('id, name, google_url')
            .or('google_url.is.null,google_url.eq.')
            .limit(5);
          if (error) throw error;
          return { status: (data && data.length ? 'warn' : 'ok'), details: data && data.length ? `Found ${data.length} (sample shown)` : 'OK (none found)' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_pois_status_column',
      title: 'POIs: status column present',
      description: 'Verifies optional column pois.status exists (draft/published/hidden)',
      run: async (client) => {
        try {
          const { error } = await client.from('pois').select('status').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'warn', details: 'Missing column pois.status (run ADD_POI_STATUS_COLUMN.sql)' };
        }
      },
      canFix: true,
    },
    {
      id: 'check_pois_google_url_column',
      title: 'POIs: google_url column present',
      description: 'Verifies optional column pois.google_url exists',
      run: async (client) => {
        try {
          const { error } = await client.from('pois').select('google_url').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'warn', details: 'Missing column pois.google_url (run ADD_GOOGLE_URL_TO_POIS.sql)' };
        }
      },
      canFix: true,
    },
    {
      id: 'check_admin_actions_table_access',
      title: 'Admin actions log access',
      description: 'Ensures admin_actions table is accessible for logs',
      run: async (client) => {
        try {
          const { data, error } = await client.from('admin_actions').select('id').limit(1);
          if (error) throw error;
          return { status: 'ok', details: data && data.length ? 'OK (has rows)' : 'OK (no rows yet)' };
        } catch (e) {
          return { status: 'warn', details: 'admin_actions not accessible (check policies and creation)' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_profiles_is_admin_column',
      title: 'Profiles: is_admin column present',
      description: 'Required to gate admin access',
      run: async (client) => {
        try {
          const { error } = await client.from('profiles').select('is_admin').limit(1);
          if (error) throw error;
          return { status: 'ok', details: 'Column exists' };
        } catch (e) {
          return { status: 'error', details: 'Missing column profiles.is_admin (see ADMIN_PANEL_SETUP.sql)' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_activity_log',
      title: 'Function: admin_get_activity_log(limit_count)',
      description: 'Activity used on dashboard',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_activity_log', { limit_count: 1 });
          if (error) throw error;
          return { status: 'ok', details: Array.isArray(data) ? `OK (${data.length} rows sample)` : 'OK' };
        } catch (e) {
          return { status: 'warn', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_rpc_admin_get_action_log',
      title: 'Function: admin_get_action_log(limit_count, action_filter)',
      description: 'Audit log function is callable',
      run: async (client) => {
        try {
          const { data, error } = await client.rpc('admin_get_action_log', { limit_count: 1, action_filter: null });
          if (error) throw error;
          return { status: 'ok', details: Array.isArray(data) ? `OK (${data.length} rows sample)` : 'OK' };
        } catch (e) {
          return { status: 'warn', details: e.message || 'RPC failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_hotels_sort_order',
      title: 'Hotels: sort_order & publication',
      description: 'Detects hotels with missing sort_order or unpublished but ordered items',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('hotels')
            .select('id, slug, sort_order, is_published')
            .order('sort_order', { ascending: true })
            .limit(100);
          if (error) throw error;
          const items = Array.isArray(data) ? data : [];
          const missingOrder = items.filter(h => h.sort_order == null).length;
          const unpublishedWithOrder = items.filter(h => h.is_published === false && h.sort_order != null).length;
          if (!items.length) {
            return { status: 'ok', details: 'No hotels in sample' };
          }
          if (missingOrder || unpublishedWithOrder) {
            return {
              status: 'warn',
              details: `Missing sort_order: ${missingOrder}, unpublished with sort_order: ${unpublishedWithOrder} (sample 100)`,
            };
          }
          return { status: 'ok', details: 'All sampled hotels have sort_order set' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_hotels_cover_image',
      title: 'Hotels: missing cover image',
      description: 'Detects hotels without cover_image_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('hotels')
            .select('id, slug, cover_image_url')
            .or('cover_image_url.is.null,cover_image_url.eq.')
            .limit(5);
          if (error) throw error;
          const missing = Array.isArray(data) ? data.length : 0;
          return {
            status: missing ? 'warn' : 'ok',
            details: missing ? `Found ${missing} hotels without cover image (sample shown)` : 'OK (all have image in sample)',
          };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_cars_sort_order',
      title: 'Cars: sort_order & availability',
      description: 'Detects cars with missing sort_order or unavailable but ordered items',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('car_offers')
            .select('id, car_model, sort_order, is_available')
            .order('sort_order', { ascending: true })
            .limit(100);
          if (error) throw error;
          const items = Array.isArray(data) ? data : [];
          const missingOrder = items.filter(c => c.sort_order == null).length;
          const unavailableWithOrder = items.filter(c => c.is_available === false && c.sort_order != null).length;
          if (!items.length) {
            return { status: 'ok', details: 'No cars in sample' };
          }
          if (missingOrder || unavailableWithOrder) {
            return {
              status: 'warn',
              details: `Missing sort_order: ${missingOrder}, unavailable with sort_order: ${unavailableWithOrder} (sample 100)`,
            };
          }
          return { status: 'ok', details: 'All sampled cars have sort_order set' };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
    {
      id: 'check_cars_image_url',
      title: 'Cars: missing image_url',
      description: 'Detects cars without image_url',
      run: async (client) => {
        try {
          const { data, error } = await client
            .from('car_offers')
            .select('id, car_model, image_url')
            .or('image_url.is.null,image_url.eq.')
            .limit(5);
          if (error) throw error;
          const missing = Array.isArray(data) ? data.length : 0;
          return {
            status: missing ? 'warn' : 'ok',
            details: missing ? `Found ${missing} cars without image (sample shown)` : 'OK (all have image in sample)',
          };
        } catch (e) {
          return { status: 'error', details: e.message || 'Query failed' };
        }
      },
      canFix: false,
    },
  ];
}

async function renderDiagnosticChecks() {
  const tbody = document.getElementById('diagnosticChecksTable');
  const btnRunAll = document.getElementById('btnRunAllChecks');
  if (!tbody) return;

  const client = ensureSupabase();
  const checks = getDiagnosticChecks();

  // Initial render (checking state)
  tbody.innerHTML = checks.map((c) => `
    <tr id="row-${c.id}">
      <td>
        <div class="poi-name">${escapeHtml(c.title)}</div>
        <div class="poi-slug">${escapeHtml(c.description)}</div>
      </td>
      <td id="status-${c.id}"><span class="badge badge-info">Checking...</span></td>
      <td id="details-${c.id}" style="color: var(--admin-text-muted);">—</td>
      <td>
        <div class="poi-table-actions">
          <button class="btn-secondary" data-check-run="${c.id}">Run</button>
          <button class="btn-secondary" data-check-fix="${c.id}" ${c.canFix ? '' : 'disabled'}>Auto-fix</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach handlers
  tbody.querySelectorAll('[data-check-run]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await runSingleCheck(btn.getAttribute('data-check-run'));
    });
  });
  tbody.querySelectorAll('[data-check-fix]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-check-fix');
      if (id === 'check_pois_status_column') {
        openDiagnosticFixModal('Auto-Fix: Add pois.status column', 'Wykonaj poniższy SQL w Supabase, aby dodać kolumnę status i indeks.', SQL_ADD_POI_STATUS);
      } else if (id === 'check_pois_google_url_column') {
        openDiagnosticFixModal('Auto-Fix: Add pois.google_url column + functions', 'Wykonaj poniższy SQL w Supabase, aby dodać kolumnę google_url oraz zaktualizować funkcje admin_create_poi/admin_update_poi.', SQL_ADD_GOOGLE_URL_TO_POIS);
      } else {
        showToast('Auto-fix not available for this check', 'info');
      }
    });
  });

  if (btnRunAll) {
    btnRunAll.addEventListener('click', runAllChecks);
  }

  // Run all once for initial statuses
  await Promise.all(checks.map(c => runSingleCheck(c.id)));
  updateDiagnosticsSummary();
}

async function runSingleCheck(checkId) {
  const client = ensureSupabase();
  const checks = getDiagnosticChecks();
  const check = checks.find(c => c.id === checkId);
  if (!check) return;

  const statusCell = document.getElementById(`status-${check.id}`);
  const detailsCell = document.getElementById(`details-${check.id}`);
  if (statusCell) statusCell.innerHTML = '<span class="badge badge-info">Checking...</span>';
  if (detailsCell) detailsCell.textContent = '—';

  try {
    const result = await check.run(client);
    const status = result.status || 'ok';
    const details = result.details || '';
    diagnosticsState.statuses[check.id] = status;
    if (statusCell) {
      const cls = status === 'ok' ? 'badge-success' : status === 'warn' ? 'badge-warning' : 'badge-danger';
      const label = status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
      statusCell.innerHTML = `<span class="badge ${cls}">${label}</span>`;
    }
    if (detailsCell) detailsCell.textContent = details;
    updateDiagnosticsSummary();
  } catch (e) {
    if (statusCell) statusCell.innerHTML = '<span class="badge badge-danger">Error</span>';
    if (detailsCell) detailsCell.textContent = e.message || 'Unknown error';
  }
}

async function runAllChecks() {
  const checks = getDiagnosticChecks();
  for (const c of checks) {
    // sequential to avoid rate spikes
    // eslint-disable-next-line no-await-in-loop
    await runSingleCheck(c.id);
  }
  updateDiagnosticsSummary();
  showToast('All checks completed', 'success');
}

function updateDiagnosticsSummary() {
  const statuses = diagnosticsState.statuses || {};
  const values = Object.values(statuses);
  const total = values.length;
  const ok = values.filter(s => s === 'ok').length;
  const warn = values.filter(s => s === 'warn').length;
  const error = values.filter(s => s === 'error').length;

  const totalEl = document.getElementById('diagStatTotal');
  const warnEl = document.getElementById('diagStatWarnings');
  const errorEl = document.getElementById('diagStatErrors');
  if (totalEl) totalEl.textContent = total || 0;
  if (warnEl) warnEl.textContent = warn || 0;
  if (errorEl) errorEl.textContent = error || 0;

  const barOk = document.getElementById('diagBarOk');
  const barWarn = document.getElementById('diagBarWarn');
  const barError = document.getElementById('diagBarError');
  const safeTotal = total || 1;
  const okPct = Math.round((ok / safeTotal) * 100);
  const warnPct = Math.round((warn / safeTotal) * 100);
  const errorPct = 100 - okPct - warnPct;
  if (barOk) barOk.style.width = `${okPct}%`;
  if (barWarn) barWarn.style.width = `${warnPct}%`;
  if (barError) barError.style.width = `${errorPct}%`;
}
 
 // -----------------------------------------------------
 // Diagnostics Auto-Fix Modal helpers
 // -----------------------------------------------------
 
 function openDiagnosticFixModal(title, description, sql) {
   const modal = document.getElementById('diagnosticFixModal');
   const titleEl = document.getElementById('diagnosticFixTitle');
   const descEl = document.getElementById('diagnosticFixDescription');
   const sqlEl = document.getElementById('diagnosticFixSql');
   if (!modal || !titleEl || !descEl || !sqlEl) return;
   titleEl.textContent = title || 'Auto-Fix';
   descEl.textContent = description || '';
   sqlEl.value = sql || '';
   showElement(modal);
 }
 
 function closeDiagnosticFixModal() {
   const modal = document.getElementById('diagnosticFixModal');
   if (modal) hideElement(modal);
 }
 
 async function copyDiagnosticSql() {
   try {
     const sqlEl = document.getElementById('diagnosticFixSql');
     if (!sqlEl) return;
     await navigator.clipboard.writeText(sqlEl.value || '');
     showToast('SQL copied to clipboard', 'success');
   } catch {
     showToast('Failed to copy SQL', 'error');
   }
 }

// =====================================================
// LOGIN
// =====================================================

async function handleAdminLogin(email, password) {
  try {
    console.log('handleAdminLogin called with email:', email);
    
    // Ensure Supabase client is available
    if (!sb) {
      sb = getSupabaseClient();
    }
    
    if (!sb) {
      throw new Error('Supabase client not available. Please refresh the page.');
    }
    
    console.log('Attempting sign in...');
    
    // Sign in with Supabase
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Login failed - no user data');
    }

    console.log('Sign in successful! User ID:', data.user.id);
    console.log('Checking admin access...');

    // Check if user has admin access
    const hasAccess = await checkAdminAccess();
    
    if (!hasAccess) {
      console.log('Admin access denied for user:', data.user.id);
      // Access denied screen should already be showing from checkAdminAccess()
      throw new Error('You do not have admin access. Only lilkangoomedia@gmail.com is authorized.');
    }
    
    console.log('Admin access granted! Loading panel...');

  } catch (error) {
    console.error('Login failed:', error);
    
    let errorMessage = 'Login failed. Please check your credentials.';
    if (error.message) {
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (error.message.includes('admin access')) {
        errorMessage = error.message; // Use the admin access error message
      }
    }
    
    throw new Error(errorMessage);
  }
}

// =====================================================
// LOGOUT
// =====================================================

async function handleLogout() {
  try {
    const client = ensureSupabase();
    if (client) {
      await client.auth.signOut();
    }
    
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Force redirect to login
    window.location.href = '/admin/login.html';
    
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/admin/login.html';
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    return 'Invalid date';
  }
}

function formatCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '—';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function slugify(value) {
  if (!value) return '';

  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return value
    .toString()
    .replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
}

function formatCurrencyEUR(value) {
  const num = Number(value);
  return `€${Number.isFinite(num) ? num.toFixed(2) : '0.00'}`;
}

const SHIPPING_COMPONENT_LABELS = {
  base: 'Opłata podstawowa',
  per_weight: 'Dopłata wagowa',
  per_item: 'Dopłata za sztukę',
  insurance: 'Ubezpieczenie przesyłki',
  free_shipping: 'Darmowa wysyłka'
};

function buildShippingComponentsList(details) {
  const quote = details?.quote;
  if (!quote || !Array.isArray(quote.components) || !quote.components.length) {
    return '';
  }

  const items = [];
  quote.components.forEach((component) => {
    if (component.type === 'class' && Array.isArray(component.items)) {
      component.items.forEach((item) => {
        if (!item || typeof item.amount !== 'number' || !item.amount) return;
        const labelBase = item.label || item.className || item.classId;
        const label = labelBase ? `Klasa: ${labelBase}` : 'Dopłata klasowa';
        items.push(`
          <li style="display:flex;justify-content:space-between;gap:12px;">
            <span>${escapeHtml(label)}</span>
            <span>${formatCurrencyEUR(item.amount)}</span>
          </li>
        `);
      });
      return;
    }

    if (typeof component.amount !== 'number') return;
    const label = SHIPPING_COMPONENT_LABELS[component.type] || 'Opłata dodatkowa';
    items.push(`
      <li style="display:flex;justify-content:space-between;gap:12px;">
        <span>${escapeHtml(label)}</span>
        <span>${formatCurrencyEUR(component.amount)}</span>
      </li>
    `);
  });

  if (!items.length) return '';
  return `
    <ul style="margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;">
      ${items.join('')}
    </ul>
  `;
}

function renderOrderShippingInfo(order) {
  if (!order) return '';
  const details = order.shipping_details || null;
  const hasDetails = Boolean(details && (details.quote || details.metrics));
  const shippingCost = Number(order.shipping_cost);
  const hasCost = Number.isFinite(shippingCost) && shippingCost >= 0;
  if (!order.shipping_method_name && !hasDetails && !hasCost) {
    return '';
  }

  const totalWeight = details?.metrics?.totalWeight;
  const weightBlock = typeof totalWeight === 'number'
    ? `<p style="margin:2px 0;color:var(--admin-text-muted);">Waga: ${totalWeight.toFixed(2)} kg</p>`
    : '';
  const breakdownList = hasDetails ? buildShippingComponentsList(details) : '';

  return `
    <div style="padding: 16px; background: var(--admin-bg); border-radius: 8px;">
      <h4 style="margin: 0 0 12px; font-size: 13px; color: var(--admin-text-muted);">🚚 Dostawa</h4>
      <p style="margin:0;font-weight:600;">${escapeHtml(order.shipping_method_name || 'Metoda nieznana')}</p>
      ${hasCost ? `<p style="margin:2px 0 6px;">Koszt: <strong>${formatCurrencyEUR(shippingCost)}</strong></p>` : ''}
      ${weightBlock}
      ${breakdownList}
    </div>
  `;
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function initEventListeners() {
  const sidebar = $('#adminSidebar');
  const menuToggle = $('#adminMenuToggle');
  const sidebarOverlay = $('#adminSidebarOverlay');
  let mobileSidebarOpen = false;

  const updateSidebarState = (isOpen) => {
    if (!sidebar) return;

    mobileSidebarOpen = isOpen;
    sidebar.classList.toggle('is-open', isOpen);

    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('is-active', isOpen);
    }

    if (sidebarOverlay) {
      if (isOpen) {
        sidebarOverlay.hidden = false;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => sidebarOverlay.classList.add('is-active'));
        } else {
          sidebarOverlay.classList.add('is-active');
        }
      } else {
        sidebarOverlay.classList.remove('is-active');
        setTimeout(() => {
          if (!mobileSidebarOpen) {
            sidebarOverlay.hidden = true;
          }
        }, 300);
      }
    }

    document.body.classList.toggle('admin-sidebar-open', isOpen);
  };

  const closeSidebarForMobile = () => {
    if (window.innerWidth <= 1024) {
      updateSidebarState(false);
    }
  };

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      updateSidebarState(!mobileSidebarOpen);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => updateSidebarState(false));
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileSidebarOpen) {
      updateSidebarState(false);
    }
  });

  // Login form
  const loginForm = $('#adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const form = e.target;
      const email = form.email.value;
      const password = form.password.value;
      const submitBtn = $('#btnAdminLogin');
      const errorDiv = $('#adminLoginError');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnSpinner = submitBtn.querySelector('.btn-spinner');
      
      // Disable form
      submitBtn.disabled = true;
      hideElement(btnText);
      showElement(btnSpinner);
      hideElement(errorDiv);
      
      try {
        await handleAdminLogin(email, password);
        // Success - checkAdminAccess will handle showing the panel
      } catch (error) {
        // Show error
        errorDiv.textContent = error.message || 'Login failed';
        showElement(errorDiv);
      } finally {
        // Re-enable form
        submitBtn.disabled = false;
        showElement(btnText);
        hideElement(btnSpinner);
      }
    });
  }

  // Navigation
  $$('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      if (viewName) {
        switchView(viewName);
        closeSidebarForMobile();
      }
    });
  });

  const refreshPartnersBtn = document.getElementById('btnRefreshPartners');
  if (refreshPartnersBtn) refreshPartnersBtn.addEventListener('click', () => loadPartnersData());

  const addPartnerBtn = document.getElementById('btnAddPartner');
  if (addPartnerBtn) addPartnerBtn.addEventListener('click', () => openPartnerForm(null));

  const partnersSearch = document.getElementById('partnersSearch');
  if (partnersSearch) partnersSearch.addEventListener('input', () => renderPartnersTable());

  const partnersStatusFilter = document.getElementById('partnersStatusFilter');
  if (partnersStatusFilter) partnersStatusFilter.addEventListener('change', () => renderPartnersTable());

  document.querySelectorAll('[data-partners-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = String(btn.getAttribute('data-partners-tab') || '').trim();
      if (!tab) return;
      setPartnersActiveTab(tab);
    });
  });

  const btnRefreshAffiliateSettings = document.getElementById('btnRefreshAffiliateSettings');
  if (btnRefreshAffiliateSettings) {
    btnRefreshAffiliateSettings.addEventListener('click', () => loadAffiliateSettings());
  }
  const btnSaveAffiliateSettings = document.getElementById('btnSaveAffiliateSettings');
  if (btnSaveAffiliateSettings) {
    btnSaveAffiliateSettings.addEventListener('click', () => saveAffiliateSettings());
  }
  const btnRefreshAffiliateOverrides = document.getElementById('btnRefreshAffiliateOverrides');
  if (btnRefreshAffiliateOverrides) {
    btnRefreshAffiliateOverrides.addEventListener('click', () => loadAffiliateOverrides());
  }
  const btnClearAffiliateOverride = document.getElementById('btnClearAffiliateOverride');
  if (btnClearAffiliateOverride) {
    btnClearAffiliateOverride.addEventListener('click', () => clearAffiliateOverrideForm());
  }
  const btnSaveAffiliateOverride = document.getElementById('btnSaveAffiliateOverride');
  if (btnSaveAffiliateOverride) {
    btnSaveAffiliateOverride.addEventListener('click', () => saveAffiliateOverride());
  }

  const btnRefreshAffiliatePayoutOverview = document.getElementById('btnRefreshAffiliatePayoutOverview');
  if (btnRefreshAffiliatePayoutOverview) {
    btnRefreshAffiliatePayoutOverview.addEventListener('click', () => refreshAffiliatePayoutOverview({ force: true }));
  }

  const btnRefreshAffiliateAdjustments = document.getElementById('btnRefreshAffiliateAdjustments');
  if (btnRefreshAffiliateAdjustments) {
    btnRefreshAffiliateAdjustments.addEventListener('click', () => loadAffiliateAdjustmentsAdminData(true));
  }

  const btnRefreshAffiliateCashoutRequests = document.getElementById('btnRefreshAffiliateCashoutRequests');
  if (btnRefreshAffiliateCashoutRequests) {
    btnRefreshAffiliateCashoutRequests.addEventListener('click', () => loadAffiliateCashoutRequestsAdminData(true));
  }

  const affiliateAdjustmentsPartnerSelect = document.getElementById('affiliateAdjustmentsPartnerSelect');
  if (affiliateAdjustmentsPartnerSelect) {
    affiliateAdjustmentsPartnerSelect.addEventListener('change', () => refreshAffiliateAdjustmentsPartnerData({ force: true }));
  }

  const btnCreateAffiliateAdjustment = document.getElementById('btnCreateAffiliateAdjustment');
  if (btnCreateAffiliateAdjustment) {
    btnCreateAffiliateAdjustment.addEventListener('click', () => createAffiliateAdjustmentFromForm());
  }

  document.addEventListener('click', (e) => {
    const btn = e.target && typeof e.target.closest === 'function'
      ? e.target.closest('button[data-action]')
      : null;
    if (!btn) return;

    const action = String(btn.getAttribute('data-action') || '').trim();
    if (!action) return;

    if (action === 'affiliate-overview-open') {
      const pid = String(btn.getAttribute('data-partner-id') || '').trim();
      if (pid) selectAffiliatePayoutPartner(pid);
      return;
    }

    if (action === 'affiliate-overview-create-payout') {
      const pid = String(btn.getAttribute('data-partner-id') || '').trim();
      if (pid) createAffiliatePayoutFromOverview(pid);
      return;
    }

    if (action === 'affiliate-adjustment-delete') {
      const aid = String(btn.getAttribute('data-adjustment-id') || '').trim();
      if (aid) deleteAffiliateAdjustmentById(aid);
      return;
    }

    if (action === 'affiliate-cashout-open') {
      const pid = String(btn.getAttribute('data-partner-id') || '').trim();
      if (pid) selectAffiliatePayoutPartner(pid);
      return;
    }

    if (action === 'affiliate-cashout-approve') {
      const rid = String(btn.getAttribute('data-request-id') || '').trim();
      if (rid) updateAffiliateCashoutRequestStatus(rid, 'approved');
      return;
    }

    if (action === 'affiliate-cashout-reject') {
      const rid = String(btn.getAttribute('data-request-id') || '').trim();
      if (rid) updateAffiliateCashoutRequestStatus(rid, 'rejected');
      return;
    }
  });

  const btnRefreshAffiliatePayouts = document.getElementById('btnRefreshAffiliatePayouts');
  if (btnRefreshAffiliatePayouts) {
    btnRefreshAffiliatePayouts.addEventListener('click', () => loadAffiliatePayoutAdminData(true));
  }
  const affiliatePayoutPartnerSelect = document.getElementById('affiliatePayoutPartnerSelect');
  if (affiliatePayoutPartnerSelect) {
    affiliatePayoutPartnerSelect.addEventListener('change', () => refreshAffiliatePayoutPartnerData({ force: true }));
  }
  const btnAffiliateCreatePayout = document.getElementById('btnAffiliateCreatePayout');
  if (btnAffiliateCreatePayout) {
    btnAffiliateCreatePayout.addEventListener('click', () => createAffiliatePayout());
  }

  const btnRefreshAffiliateLedger = document.getElementById('btnRefreshAffiliateLedger');
  if (btnRefreshAffiliateLedger) {
    btnRefreshAffiliateLedger.addEventListener('click', () => loadAffiliateLedgerAdminData(true));
  }
  const affiliateLedgerPartnerSelect = document.getElementById('affiliateLedgerPartnerSelect');
  if (affiliateLedgerPartnerSelect) {
    affiliateLedgerPartnerSelect.addEventListener('change', () => refreshAffiliateLedgerPartnerData({ force: true }));
  }
  const affiliateLedgerReferrerSelect = document.getElementById('affiliateLedgerReferrerSelect');
  if (affiliateLedgerReferrerSelect) {
    affiliateLedgerReferrerSelect.addEventListener('change', () => refreshAffiliateLedgerPartnerData({ force: true }));
  }
  const btnAffiliateLedgerViewBalance = document.getElementById('btnAffiliateLedgerViewBalance');
  if (btnAffiliateLedgerViewBalance) {
    btnAffiliateLedgerViewBalance.addEventListener('click', () => {
      const payoutSelect = document.getElementById('affiliatePayoutPartnerSelect');
      const ledgerSelect = document.getElementById('affiliateLedgerPartnerSelect');
      const ledgerPartnerId = String(ledgerSelect?.value || '').trim();
      if (payoutSelect && ledgerPartnerId) {
        payoutSelect.value = ledgerPartnerId;
      }
      refreshAffiliatePayoutPartnerData({ force: true });
    });
  }

  const btnRefreshAffiliateUnattributed = document.getElementById('btnRefreshAffiliateUnattributed');
  if (btnRefreshAffiliateUnattributed) {
    btnRefreshAffiliateUnattributed.addEventListener('click', () => loadAffiliateUnattributedDepositsAdminData(true));
  }
  const btnClearAffiliateAttribution = document.getElementById('btnClearAffiliateAttribution');
  if (btnClearAffiliateAttribution) {
    btnClearAffiliateAttribution.addEventListener('click', () => clearAffiliateAttributionForm());
  }
  const btnApplyAffiliateAttribution = document.getElementById('btnApplyAffiliateAttribution');
  if (btnApplyAffiliateAttribution) {
    btnApplyAffiliateAttribution.addEventListener('click', () => applyAffiliateAttributionFromForm());
  }

  const btnRefreshDepositSettings = document.getElementById('btnRefreshDepositSettings');
  if (btnRefreshDepositSettings) {
    btnRefreshDepositSettings.addEventListener('click', () => loadDepositSettings());
  }
  const btnSaveDepositSettings = document.getElementById('btnSaveDepositSettings');
  if (btnSaveDepositSettings) {
    btnSaveDepositSettings.addEventListener('click', () => saveDepositSettings());
  }

  const btnSaveDepositRules = document.getElementById('btnSaveDepositRules');
  if (btnSaveDepositRules) {
    btnSaveDepositRules.addEventListener('click', () => saveDefaultDepositRules());
  }

  const btnRefreshDepositOverrides = document.getElementById('btnRefreshDepositOverrides');
  if (btnRefreshDepositOverrides) {
    btnRefreshDepositOverrides.addEventListener('click', () => loadDepositOverrides());
  }

  const depositOverrideType = document.getElementById('depositOverrideType');
  if (depositOverrideType) {
    depositOverrideType.addEventListener('change', () => {
      updateDepositOverrideModeOptions(String(depositOverrideType.value || '').trim());
      scheduleDepositOverrideSearch();
      applySelectedOverrideToForm();
    });

    updateDepositOverrideModeOptions(String(depositOverrideType.value || '').trim());
  }

  const depositOverrideSearch = document.getElementById('depositOverrideSearch');
  if (depositOverrideSearch) {
    depositOverrideSearch.addEventListener('input', () => scheduleDepositOverrideSearch());
  }

  const depositOverrideResourceSelect = document.getElementById('depositOverrideResourceSelect');
  if (depositOverrideResourceSelect) {
    depositOverrideResourceSelect.addEventListener('change', () => applySelectedOverrideToForm());
  }

  const btnSaveDepositOverride = document.getElementById('btnSaveDepositOverride');
  if (btnSaveDepositOverride) {
    btnSaveDepositOverride.addEventListener('click', () => saveDepositOverride());
  }

  const btnRefreshDepositRequests = document.getElementById('btnRefreshDepositRequests');
  if (btnRefreshDepositRequests) {
    btnRefreshDepositRequests.addEventListener('click', () => loadDepositRequests());
  }

  const depositRequestsStatus = document.getElementById('depositRequestsStatus');
  if (depositRequestsStatus) {
    depositRequestsStatus.addEventListener('change', () => renderDepositRequestsTable());
  }

  const depositRequestsSearch = document.getElementById('depositRequestsSearch');
  if (depositRequestsSearch) {
    depositRequestsSearch.addEventListener('input', () => renderDepositRequestsTable());
  }

  const refreshCalendarsBtn = document.getElementById('btnRefreshCalendars');
  if (refreshCalendarsBtn) refreshCalendarsBtn.addEventListener('click', () => loadAdminCalendarsData());

  const calendarsCreateType = document.getElementById('calendarsCreateType');
  if (calendarsCreateType) {
    calendarsCreateType.addEventListener('change', () => {
      loadCalendarsCreateResourceOptions();
    });
  }

  const calendarsCreateForm = document.getElementById('calendarsCreateBlockForm');
  if (calendarsCreateForm) {
    calendarsCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      createAvailabilityBlockFromAdminForm();
    });
  }

  const partnerForm = document.getElementById('partnerForm');
  if (partnerForm) {
    partnerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      savePartnerFromForm();
    });
  }

  const partnerFormClose = document.getElementById('btnClosePartnerForm');
  if (partnerFormClose) partnerFormClose.addEventListener('click', () => closePartnerForm());

  const partnerFormCancel = document.getElementById('btnCancelPartnerForm');
  if (partnerFormCancel) partnerFormCancel.addEventListener('click', () => closePartnerForm());

  const partnerFormOverlay = document.getElementById('partnerFormModalOverlay');
  if (partnerFormOverlay) partnerFormOverlay.addEventListener('click', () => closePartnerForm());

  const partnerVendorSelect = document.getElementById('partnerFormVendor');
  if (partnerVendorSelect) {
    partnerVendorSelect.addEventListener('change', async () => {
      const vendorId = String(partnerVendorSelect.value || '').trim();
      partnerAssignmentsState.partnerVendorId = vendorId || null;
      try {
        await refreshPartnerAssignments();
      } catch (_e) {
      }
    });
  }

  const partnerUsersClose = document.getElementById('btnClosePartnerUsers');
  if (partnerUsersClose) partnerUsersClose.addEventListener('click', () => closePartnerUsersModal());

  const partnerUsersOverlay = document.getElementById('partnerUsersModalOverlay');
  if (partnerUsersOverlay) partnerUsersOverlay.addEventListener('click', () => closePartnerUsersModal());

  const addPartnerUserBtn = document.getElementById('btnAddPartnerUser');
  if (addPartnerUserBtn) addPartnerUserBtn.addEventListener('click', () => addPartnerUserFromModal());

  const calendarsPartnerFilter = document.getElementById('calendarsPartnerFilter');
  if (calendarsPartnerFilter) {
    calendarsPartnerFilter.addEventListener('change', () => {
      syncAdminCalendarsCreateFields();
      renderCalendarsTable();
      loadCalendarsMonthData();
    });
  }

  const calendarsResourceTypeFilter = document.getElementById('calendarsResourceTypeFilter');
  if (calendarsResourceTypeFilter) {
    calendarsResourceTypeFilter.addEventListener('change', () => {
      renderCalendarsTable();
      const select = document.getElementById('calendarsResourceIdFilter');
      if (select) select.value = '';
      renderAdminCalendarsResourceTypePanels();
      if (calendarsState.bulkMode) {
        updateAdminCalendarsSelectionSummary();
        renderAdminCalendarsResourcePanels();
      }
      loadCalendarsResourceOptions().then(() => loadCalendarsMonthData());
    });
  }

  const calendarsResourceIdFilter = document.getElementById('calendarsResourceIdFilter');
  if (calendarsResourceIdFilter) {
    calendarsResourceIdFilter.addEventListener('change', () => {
      if (calendarsState.bulkMode) {
        const type = String(document.getElementById('calendarsResourceTypeFilter')?.value || '').trim();
        const resourceId = String(document.getElementById('calendarsResourceIdFilter')?.value || '').trim();
        if (type && resourceId) {
          ensureCalendarsSelectedSetForType(type).add(resourceId);
        }
        updateAdminCalendarsSelectionSummary();
      }
      renderAdminCalendarsResourcePanels();
      syncAdminCalendarsCreateFields();
      loadCalendarsMonthData();
    });
  }

  const adminCalendarsBulkMode = document.getElementById('adminCalendarsBulkMode');
  if (adminCalendarsBulkMode) {
    adminCalendarsBulkMode.addEventListener('change', () => {
      setAdminCalendarsBulkMode(Boolean(adminCalendarsBulkMode.checked));
    });
  }

  const btnAdminCalendarsSelectAllType = document.getElementById('btnAdminCalendarsSelectAllType');
  if (btnAdminCalendarsSelectAllType) {
    btnAdminCalendarsSelectAllType.addEventListener('click', async () => {
      if (!calendarsState.bulkMode) return;
      await adminCalendarsSelectAllCurrentType();
    });
  }

  const btnAdminCalendarsClearAll = document.getElementById('btnAdminCalendarsClearAll');
  if (btnAdminCalendarsClearAll) {
    btnAdminCalendarsClearAll.addEventListener('click', () => {
      if (!calendarsState.bulkMode) return;
      adminCalendarsClearAllSelections();
    });
  }

  if (adminCalendarsBulkMode) {
    setAdminCalendarsBulkMode(Boolean(adminCalendarsBulkMode.checked));
  }

  const calendarsMonthInput = document.getElementById('calendarsMonthInput');
  if (calendarsMonthInput) {
    calendarsMonthInput.addEventListener('change', () => {
      calendarsState.monthValue = calendarsMonthInput.value;
      loadCalendarsMonthData();
    });
  }

  const calendarsPrevMonthBtn = document.getElementById('btnCalendarsPrevMonth');
  if (calendarsPrevMonthBtn) {
    calendarsPrevMonthBtn.addEventListener('click', () => {
      ensureCalendarsMonthInput();
      setCalendarsMonthInput(addMonths(calendarsState.monthValue || getMonthValue(), -1));
      loadCalendarsMonthData();
    });
  }

  const calendarsNextMonthBtn = document.getElementById('btnCalendarsNextMonth');
  if (calendarsNextMonthBtn) {
    calendarsNextMonthBtn.addEventListener('click', () => {
      ensureCalendarsMonthInput();
      setCalendarsMonthInput(addMonths(calendarsState.monthValue || getMonthValue(), 1));
      loadCalendarsMonthData();
    });
  }

  const adminNotificationForm = document.getElementById('adminNotificationSettingsForm');
  if (adminNotificationForm) {
    adminNotificationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveAdminNotificationSettings();
    });
  }

  const btnEnablePush = document.getElementById('btnAdminEnablePush');
  if (btnEnablePush) {
    btnEnablePush.addEventListener('click', () => {
      enableAdminPushNotifications();
    });
  }

  const btnDisablePush = document.getElementById('btnAdminDisablePush');
  if (btnDisablePush) {
    btnDisablePush.addEventListener('click', () => {
      disableAdminPushNotifications();
    });
  }

  // Users pagination
  const usersPrevBtn = $('#btnUsersPrev');
  const usersNextBtn = $('#btnUsersNext');
  
  if (usersPrevBtn) {
    usersPrevBtn.addEventListener('click', () => {
      if (adminState.usersPage > 1) {
        loadUsersData(adminState.usersPage - 1);
      }
    });
  }

  if (usersNextBtn) {
    usersNextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(adminState.usersTotal / ADMIN_CONFIG.usersPerPage);
      if (adminState.usersPage < totalPages) {
        loadUsersData(adminState.usersPage + 1);
      }
    });
  }

  // User search
  const searchBtn = $('#btnUserSearch');
  const searchInput = $('#userSearch');
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        searchUsers(query);
      } else {
        loadUsersData(1);
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchBtn.click();
      }
    });
  }

  // User detail modal
  const closeModalBtn = $('#btnCloseUserModal');
  const modalOverlay = $('#userDetailModalOverlay');
  const modal = $('#userDetailModal');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', () => {
      hideElement(modal);
    });
  }

  // Comment detail modal
  const btnCloseCommentDetail = $('#btnCloseCommentDetail');
  const commentDetailOverlay = $('#commentDetailModalOverlay');
  const commentDetailModal = $('#commentDetailModal');

  if (btnCloseCommentDetail) {
    btnCloseCommentDetail.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  if (commentDetailOverlay) {
    commentDetailOverlay.addEventListener('click', () => {
      hideElement(commentDetailModal);
    });
  }

  // Comment edit modal
  const btnCloseCommentEdit = $('#btnCloseCommentEdit');
  const commentEditOverlay = $('#commentEditModalOverlay');
  const commentEditModal = $('#commentEditModal');
  const commentEditCancel = $('#commentEditCancel');

  if (btnCloseCommentEdit) {
    btnCloseCommentEdit.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditOverlay) {
    commentEditOverlay.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  if (commentEditCancel) {
    commentEditCancel.addEventListener('click', () => {
      hideElement(commentEditModal);
    });
  }

  // POI filters and actions
  const poiSearchInput = $('#poiSearchInput');
  if (poiSearchInput) {
    poiSearchInput.addEventListener('input', (event) => {
      adminState.poiSearch = event.target.value || '';
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiCategoryFilter = $('#poiCategoryFilter');
  if (poiCategoryFilter) {
    poiCategoryFilter.addEventListener('change', (event) => {
      adminState.poiFilterCategory = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const poiStatusFilter = $('#poiStatusFilter');
  if (poiStatusFilter) {
    poiStatusFilter.addEventListener('change', (event) => {
      adminState.poiFilterStatus = event.target.value;
      renderPoiList();
      updatePoiTableFooter(getFilteredPois().length);
    });
  }

  const addPoiBtn = $('#btnAddPoi');
  if (addPoiBtn) {
    addPoiBtn.addEventListener('click', () => openPoiForm());
  }

  const refreshPoisBtn = $('#btnRefreshPois');
  if (refreshPoisBtn) {
    refreshPoisBtn.addEventListener('click', () => refreshPoiList());
  }

  const poiForm = $('#poiForm');
  if (poiForm) {
    poiForm.addEventListener('submit', handlePoiFormSubmit);
  }

  const poiFormCancel = $('#poiFormCancel');
  if (poiFormCancel) {
    poiFormCancel.addEventListener('click', () => closePoiForm());
  }

  const poiFormClose = $('#btnClosePoiForm');
  if (poiFormClose) {
    poiFormClose.addEventListener('click', () => closePoiForm());
  }

  const poiFormOverlay = $('#poiFormModalOverlay');
  if (poiFormOverlay) {
    poiFormOverlay.addEventListener('click', () => closePoiForm());
  }

  const poiDetailClose = $('#btnClosePoiDetail');
  if (poiDetailClose) {
    poiDetailClose.addEventListener('click', () => closePoiDetail());
  }

  const poiDetailOverlay = $('#poiDetailModalOverlay');
  if (poiDetailOverlay) {
    poiDetailOverlay.addEventListener('click', () => closePoiDetail());
  }

  // Cars tab switchers
  document.querySelectorAll('.cars-tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCarsTab(btn.dataset.tab);
    });
  });

  // Cars coupons filters
  const carsCouponsSearchInput = $('#carsCouponsSearchInput');
  if (carsCouponsSearchInput) {
    carsCouponsSearchInput.addEventListener('input', (event) => {
      carCouponsState.filters.search = String(event.target?.value || '');
      renderCarCouponsData();
    });
  }

  const carsCouponsStatusFilter = $('#carsCouponsStatusFilter');
  if (carsCouponsStatusFilter) {
    carsCouponsStatusFilter.addEventListener('change', (event) => {
      carCouponsState.filters.status = String(event.target?.value || '');
      renderCarCouponsData();
    });
  }

  const carsCouponsActivityFilter = $('#carsCouponsActivityFilter');
  if (carsCouponsActivityFilter) {
    carsCouponsActivityFilter.addEventListener('change', (event) => {
      carCouponsState.filters.activity = String(event.target?.value || '');
      renderCarCouponsData();
    });
  }

  const carsCouponsTypeFilter = $('#carsCouponsTypeFilter');
  if (carsCouponsTypeFilter) {
    carsCouponsTypeFilter.addEventListener('change', (event) => {
      carCouponsState.filters.discountType = String(event.target?.value || '');
      renderCarCouponsData();
    });
  }

  const carsCouponsPartnerFilter = $('#carsCouponsPartnerFilter');
  if (carsCouponsPartnerFilter) {
    carsCouponsPartnerFilter.addEventListener('change', (event) => {
      carCouponsState.filters.partnerId = String(event.target?.value || '');
      renderCarCouponsData();
    });
  }

  const btnCarsCouponsClearFilters = $('#btnCarsCouponsClearFilters');
  if (btnCarsCouponsClearFilters) {
    btnCarsCouponsClearFilters.addEventListener('click', clearCarCouponFilters);
  }

  const carsCouponsTableBody = $('#carsCouponsTableBody');
  if (carsCouponsTableBody) {
    carsCouponsTableBody.addEventListener('click', (event) => {
      handleCarCouponsTableClick(event);
    });
  }

  // Fleet filters
  const fleetLocationFilter = $('#fleetLocationFilter');
  if (fleetLocationFilter) {
    fleetLocationFilter.addEventListener('change', (e) => {
      fleetState.locationFilter = e.target.value;
      loadFleetData();
    });
  }

  const fleetTypeFilter = $('#fleetTypeFilter');
  if (fleetTypeFilter) {
    fleetTypeFilter.addEventListener('change', (e) => {
      fleetState.typeFilter = e.target.value;
      loadFleetData();
    });
  }

  // Add new car to fleet
  const btnAddFleetCar = $('#btnAddFleetCar');
  if (btnAddFleetCar) {
    btnAddFleetCar.addEventListener('click', () => {
      openFleetCarModal(); // Open modal in add mode
    });
  }

  // Fleet car modal controls
  const btnCloseFleetCarModal = $('#btnCloseFleetCarModal');
  if (btnCloseFleetCarModal) {
    btnCloseFleetCarModal.addEventListener('click', closeFleetCarModal);
  }

  const fleetCarModalOverlay = $('#fleetCarModalOverlay');
  if (fleetCarModalOverlay) {
    fleetCarModalOverlay.addEventListener('click', closeFleetCarModal);
  }

  const fleetCarFormCancel = $('#fleetCarFormCancel');
  if (fleetCarFormCancel) {
    fleetCarFormCancel.addEventListener('click', closeFleetCarModal);
  }

  // Cars coupon modal controls
  const btnCloseCarCouponModal = $('#btnCloseCarCouponModal');
  if (btnCloseCarCouponModal) {
    btnCloseCarCouponModal.addEventListener('click', closeCarCouponModal);
  }

  const carCouponModalOverlay = $('#carCouponModalOverlay');
  if (carCouponModalOverlay) {
    carCouponModalOverlay.addEventListener('click', closeCarCouponModal);
  }

  const carCouponFormCancel = $('#carCouponFormCancel');
  if (carCouponFormCancel) {
    carCouponFormCancel.addEventListener('click', closeCarCouponModal);
  }

  const carCouponForm = $('#carCouponForm');
  if (carCouponForm) {
    carCouponForm.addEventListener('submit', handleCarCouponFormSubmit);
    carCouponForm.addEventListener('change', handleCarCouponScopeOptionChange);
    carCouponForm.addEventListener('click', handleCarCouponScopeClearClick);
  }

  const carCouponDiscountType = $('#carCouponDiscountType');
  if (carCouponDiscountType) {
    carCouponDiscountType.addEventListener('change', syncCarCouponDiscountTypeFields);
  }

  const carCouponSingleUse = $('#carCouponSingleUse');
  if (carCouponSingleUse) {
    carCouponSingleUse.addEventListener('change', syncCarCouponSingleUseFields);
  }

  const carCouponNoDateLimit = $('#carCouponNoDateLimit');
  if (carCouponNoDateLimit) {
    carCouponNoDateLimit.addEventListener('change', () => {
      syncCarCouponDateWindowFields();
    });
  }

  const carCouponScopePrimaryMode = $('#carCouponScopePrimaryMode');
  if (carCouponScopePrimaryMode) {
    carCouponScopePrimaryMode.addEventListener('change', () => {
      syncCarCouponScopePrimaryModeFields();
    });
  }

  // Booking details modal controls
  const btnCloseBookingDetails = $('#btnCloseBookingDetails');
  if (btnCloseBookingDetails) {
    btnCloseBookingDetails.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      if (modal) modal.hidden = true;
    });
  }

  const bookingDetailsModalOverlay = $('#bookingDetailsModalOverlay');
  if (bookingDetailsModalOverlay) {
    bookingDetailsModalOverlay.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      if (modal) modal.hidden = true;
    });
  }

  const btnConfirmBooking = $('#btnConfirmBooking');
  if (btnConfirmBooking) {
    btnConfirmBooking.addEventListener('click', async () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;

      try {
        const client = ensureSupabase();
        const { error } = await client
          .from('car_bookings')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', bookingId);

        if (error) throw error;

        showToast('Booking confirmed successfully!', 'success');
        modal.hidden = true;
        await loadCarsData();
      } catch (e) {
        console.error('Failed to confirm booking:', e);
        showToast('Failed to confirm booking', 'error');
      }
    });
  }

  const btnCancelBooking = $('#btnCancelBooking');
  if (btnCancelBooking) {
    btnCancelBooking.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to cancel this booking?')) return;

      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;

      try {
        const client = ensureSupabase();
        const { error } = await client
          .from('car_bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);

        if (error) throw error;

        showToast('Booking cancelled', 'info');
        modal.hidden = true;
        await loadCarsData();
      } catch (e) {
        console.error('Failed to cancel booking:', e);
        showToast('Failed to cancel booking', 'error');
      }
    });
  }

  const btnDeleteBooking = $('#btnDeleteBooking');
  if (btnDeleteBooking) {
    btnDeleteBooking.addEventListener('click', async () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (!bookingId) return;
      await deleteCarBooking(bookingId);
    });
  }

  const btnEditBooking = $('#btnEditBooking');
  if (btnEditBooking) {
    btnEditBooking.addEventListener('click', () => {
      const modal = $('#bookingDetailsModal');
      const bookingId = modal?.dataset?.bookingId;
      if (bookingId) {
        openEditBooking(bookingId);
      }
    });
  }

  // Edit booking modal controls
  const btnCloseEditBooking = $('#btnCloseEditBooking');
  if (btnCloseEditBooking) {
    btnCloseEditBooking.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingModalOverlay = $('#editBookingModalOverlay');
  if (editBookingModalOverlay) {
    editBookingModalOverlay.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingCancel = $('#editBookingCancel');
  if (editBookingCancel) {
    editBookingCancel.addEventListener('click', () => {
      const modal = $('#editBookingModal');
      if (modal) modal.hidden = true;
    });
  }

  const editBookingForm = $('#editBookingForm');
  if (editBookingForm) {
    editBookingForm.addEventListener('submit', handleEditBookingSubmit);
  }

  // Image upload controls
  const fleetCarImageFile = $('#fleetCarImageFile');
  if (fleetCarImageFile) {
    fleetCarImageFile.addEventListener('change', handleImageFileChange);
  }

  const btnRemoveCarImage = $('#btnRemoveCarImage');
  if (btnRemoveCarImage) {
    btnRemoveCarImage.addEventListener('click', removeCarImage);
  }

  const btnUseImageUrl = $('#btnUseImageUrl');
  if (btnUseImageUrl) {
    btnUseImageUrl.addEventListener('click', handleUseImageUrl);
  }

  // Cars actions (will be updated by switchCarsTab)
  const refreshCarsBtn = $('#btnRefreshCars');
  if (refreshCarsBtn) {
    refreshCarsBtn.addEventListener('click', () => {
      handleCarsRefreshAction();
    });
  }

  const addCarBtn = $('#btnAddCar');
  if (addCarBtn) {
    addCarBtn.addEventListener('click', () => {
      handleCarsAddAction();
    });
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !isCarsViewActive() || carsLiveRefreshRunning) return;
    carsLiveRefreshRunning = true;
    try {
      setCarsLiveSyncStatus('Live sync: updating...', 'syncing');
      await refreshCarsActiveTabData({ silent: true });
    } finally {
      carsLiveRefreshRunning = false;
    }
  });

  window.addEventListener('beforeunload', () => {
    stopCarsLiveRefresh();
  });

  // Logout
  const logoutBtn = $('#btnAdminLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  exposeForceRefreshGlobalHandlers();
  bindTapAndClickAction(document.getElementById('btnForceRefreshSite'), handleForceRefreshClick);
  bindTapAndClickAction(document.getElementById('btnForceReloadAppSettings'), handleForceRefreshClick);
  bindTapAndClickAction(document.getElementById('btnForceRefreshCheckNow'), handleForceRefreshCheckNowClick);

  window.addEventListener('ce:force-refresh-status', () => {
    refreshForceRefreshLocalDiagnostics();
  });

  scheduleResponsiveTableHydration();
  if (document.body && !document.body.__responsiveTableObserverBound) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        if (mutation.addedNodes && mutation.addedNodes.length) {
          scheduleResponsiveTableHydration();
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.__responsiveTableObserverBound = true;
    document.body.__responsiveTableObserver = observer;
  }

  // Diagnostics Auto-Fix modal
  const btnCloseDiagnosticFix = $('#btnCloseDiagnosticFix');
  const diagnosticFixOverlay = $('#diagnosticFixModalOverlay');
  const btnCopyDiagnosticSql = $('#btnCopyDiagnosticSql');
  if (btnCloseDiagnosticFix) {
    btnCloseDiagnosticFix.addEventListener('click', () => closeDiagnosticFixModal());
  }
  if (diagnosticFixOverlay) {
    diagnosticFixOverlay.addEventListener('click', () => closeDiagnosticFixModal());
  }
  if (btnCopyDiagnosticSql) {
    btnCopyDiagnosticSql.addEventListener('click', () => copyDiagnosticSql());
  }
}

async function searchUsers(query) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    adminState.usersPage = 1;

    const { data: users, error } = await client
      .from('admin_users_overview')
      .select('*')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(ADMIN_CONFIG.usersPerPage);

    if (error) throw error;

    const tableBody = $('#usersTable');
    if (!tableBody) return;

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No users found</td></tr>';
      return;
    }

    const flagsByUserId = await getUsersPartnerAffiliateFlags(client, users.map((u) => u.id));
    const usersWithFlags = users.map((u) => ({
      ...u,
      ...(flagsByUserId[u.id] || { is_partner: false, is_affiliate: false }),
    }));

    tableBody.innerHTML = usersWithFlags.map(user => `
      <tr>
        <td>
          ${user.username || 'N/A'}
          ${user.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
          ${user.is_partner ? '<span class="badge badge-partner">PARTNER</span>' : ''}
          ${user.is_affiliate ? '<span class="badge badge-affiliate">AFFILIATE</span>' : ''}
          ${!user.is_admin && user.is_moderator ? '<span class="badge">MODERATOR</span>' : ''}
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.level || 0}</td>
        <td>${user.xp || 0}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="badge ${user.banned_until ? 'badge-danger' : 'badge-success'}">
            ${user.banned_until ? 'Banned' : 'Active'}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewUserDetails('${user.id}')">
            View
          </button>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('User search failed:', error);
    showToast('Search failed', 'error');
  }
}

// =====================================================
// ADVANCED ADMIN FUNCTIONS
// =====================================================

// Adjust User XP
async function adjustUserXP(userId, xpChange, reason = 'Admin adjustment') {
  if (!confirm(`Adjust XP by ${xpChange > 0 ? '+' : ''}${xpChange}?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Adjusting XP...', 'info');
    
    const { data, error } = await client.rpc('admin_adjust_user_xp', {
      target_user_id: userId,
      xp_change: xpChange,
      reason: reason
    });
    
    if (error) throw error;
    
    showToast(`XP adjusted: ${data.old_xp} → ${data.new_xp}`, 'success');

    // Reload users if on users view
    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('XP adjustment failed:', error);
    showToast('Failed to adjust XP: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// Ban User
async function banUser(userId, reason = 'Violating terms', days = 30) {
  if (!confirm(`Ban this user for ${days} days?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Banning user...', 'info');
    
    const { data, error } = await client.rpc('admin_ban_user', {
      target_user_id: userId,
      ban_reason: reason,
      ban_duration: `${days} days`
    });
    
    if (error) throw error;
    
    showToast('User banned successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('Ban failed:', error);
    showToast('Failed to ban user: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// Unban User
async function unbanUser(userId) {
  if (!confirm('Remove ban from this user?')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Unbanning user...', 'info');
    
    const { data, error } = await client.rpc('admin_unban_user', {
      target_user_id: userId
    });
    
    if (error) throw error;
    
    showToast('User unbanned successfully', 'success');

    if (adminState.currentView === 'users') {
      loadUsersData(adminState.usersPage);
    }

    return true;

  } catch (error) {
    console.error('Unban failed:', error);
    showToast('Failed to unban user: ' + (error.message || 'Unknown error'), 'error');

    return false;
  }
}

// =====================================================
// POI MANAGEMENT
// =====================================================

const DEFAULT_POI_RADIUS = 150;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function setPoiTableLoading(isLoading) {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (isLoading) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading POIs...</td></tr>';
  }
}

function updatePoiDataSourceBadge() {
  const badge = $('#poiDataSourceBadge');
  if (!badge) return;

  if (!adminState.poisLoaded || adminState.poiLoading) {
    badge.hidden = true;
    return;
  }

  badge.hidden = false;
  badge.textContent = adminState.poiDataSource === 'supabase' ? 'Live database' : 'Static dataset';
}

function safeParsePoiData(value) {
  if (!value) return {};

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse POI data payload:', error);
    }
  }

  return {};
}

function normalizePoi(rawPoi, source = 'supabase') {
  if (!rawPoi) return null;

  const data = safeParsePoiData(rawPoi.data);
  const candidateSlug = data.slug || rawPoi.slug || rawPoi.identifier || rawPoi.poi_id || rawPoi.id;
  const name = rawPoi.name || data.name || 'Unnamed POI';
  const slug = (typeof candidateSlug === 'string' && candidateSlug.trim())
    ? candidateSlug.trim()
    : slugify(name);

  const id = rawPoi.id || data.id || slug;

  const latitude = parseFloat(
    rawPoi.latitude
      ?? rawPoi.lat
      ?? data.latitude
      ?? data.lat
      ?? data.location?.lat
      ?? data.location?.latitude
      ?? rawPoi.location?.lat
      ?? rawPoi.location?.latitude
      ?? NaN
  );

  const longitude = parseFloat(
    rawPoi.longitude
      ?? rawPoi.lon
      ?? rawPoi.lng
      ?? data.longitude
      ?? data.lon
      ?? data.lng
      ?? data.location?.lng
      ?? data.location?.lon
      ?? data.location?.longitude
      ?? rawPoi.location?.lng
      ?? rawPoi.location?.lon
      ?? rawPoi.location?.longitude
      ?? NaN
  );

  const radius = parseInt(
    rawPoi.radius
      ?? rawPoi.geofence_radius
      ?? rawPoi.geofenceRadius
      ?? data.radius
      ?? data.geofence_radius
      ?? data.geofenceRadius
      ?? DEFAULT_POI_RADIUS,
    10
  );

  const xp = parseInt(
    rawPoi.xp
      ?? data.xp
      ?? 100,
    10
  );

  const requiredLevel = parseInt(
    rawPoi.required_level
      ?? rawPoi.requiredLevel
      ?? data.required_level
      ?? data.requiredLevel
      ?? 1,
    10
  );

  const combinedTags = [
    ...(Array.isArray(data.tags) ? data.tags : []),
    ...(Array.isArray(rawPoi.tags) ? rawPoi.tags : []),
  ];

  const tags = combinedTags.length
    ? combinedTags
    : typeof data.tags === 'string'
      ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : typeof rawPoi.tags === 'string'
        ? rawPoi.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

  const derivedStatus = rawPoi.is_hidden
    ? 'hidden'
    : rawPoi.is_draft
      ? 'draft'
      : rawPoi.is_published === false
        ? 'draft'
        : null;

  // Default to 'published' for all sources unless explicitly set otherwise
  const status = (data.status || rawPoi.status || derivedStatus || 'published')
    .toString()
    .toLowerCase();

  const category = (
    rawPoi.category
    || rawPoi.badge
    || data.category
    || data.badge
    || rawPoi.poi_category
    || data.poi_category
    || 'uncategorized'
  ).toString().toLowerCase();

  // Prefer explicit google_url field; otherwise compute a default Google Maps link
  const googleUrl = (
    rawPoi.google_url
    || data.google_url
    || (Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null)
  );

  const mainImageUrl = (
    rawPoi.main_image_url
    || data.main_image_url
    || rawPoi.image_url
    || data.image_url
    || rawPoi.cover_image_url
    || data.cover_image_url
    || null
  );

  let photos = rawPoi.photos ?? data.photos ?? [];
  if (typeof photos === 'string') {
    try {
      photos = JSON.parse(photos);
    } catch (_) {
      photos = [];
    }
  }
  photos = Array.isArray(photos) ? photos.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 10) : [];

  return {
    id,
    uuid: isUuid(id) ? id : (isUuid(rawPoi.uuid) ? rawPoi.uuid : (isUuid(data.id) ? data.id : null)),
    slug,
    name,
    description: rawPoi.description || data.description || '',
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radius: Number.isFinite(radius) ? radius : null,
    xp: Number.isFinite(xp) ? xp : 100,
    requiredLevel: Number.isFinite(requiredLevel) ? requiredLevel : 1,
    category,
    badge: rawPoi.badge || data.badge || category,
    status,
    tags,
    google_url: googleUrl,
    main_image_url: mainImageUrl,
    photos,
    // i18n fields
    name_i18n: rawPoi.name_i18n || null,
    description_i18n: rawPoi.description_i18n || null,
    badge_i18n: rawPoi.badge_i18n || null,
    created_at: rawPoi.created_at || data.created_at || null,
    updated_at: rawPoi.updated_at || data.updated_at || rawPoi.created_at || null,
    source,
    raw: rawPoi,
  };
}

function formatCategoryLabel(category) {
  if (!category) return 'Uncategorized';
  return category
    .toString()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function findPoi(poiId) {
  if (!poiId) return null;
  return adminState.pois.find(poi => poi.id === poiId || poi.slug === poiId) || null;
}

function getFilteredPois() {
  const search = adminState.poiSearch.trim().toLowerCase();
  const filterCategory = adminState.poiFilterCategory;
  const filterStatus = adminState.poiFilterStatus;

  return adminState.pois.filter(poi => {
    const matchesCategory = filterCategory === 'all' || (poi.category || 'uncategorized') === filterCategory;
    const matchesStatus = filterStatus === 'all' || (poi.status || 'published') === filterStatus;
    const matchesSearch =
      !search ||
      (poi.name && poi.name.toLowerCase().includes(search)) ||
      (poi.slug && poi.slug.toLowerCase().includes(search)) ||
      (poi.description && poi.description.toLowerCase().includes(search));
    return matchesCategory && matchesStatus && matchesSearch;
  });
}

function updatePoiFilterOptions() {
  const categorySelect = $('#poiCategoryFilter');
  if (!categorySelect) return;

  const categories = Array.from(
    new Set(adminState.pois.map(poi => poi.category || 'uncategorized'))
  ).sort();

  const currentValue = adminState.poiFilterCategory;
  const options = ['all', ...categories];
  categorySelect.innerHTML = options
    .map(category => `<option value="${category}">${category === 'all' ? 'All categories' : formatCategoryLabel(category)}</option>`)
    .join('');

  if (options.includes(currentValue)) {
    categorySelect.value = currentValue;
  } else {
    categorySelect.value = 'all';
    adminState.poiFilterCategory = 'all';
  }
}

function updatePoiStats() {
  const totalEl = $('#poiStatTotal');
  const publishedEl = $('#poiStatPublished');
  const draftsEl = $('#poiStatDrafts');
  const missingEl = $('#poiStatMissingLocation');
  const statusEl = $('#poiStatLiveStatus');

  const total = adminState.pois.length;
  const published = adminState.pois.filter(poi => poi.status === 'published').length;
  const drafts = adminState.pois.filter(poi => poi.status !== 'published').length;
  const missingLocation = adminState.pois.filter(poi => !Number.isFinite(poi.latitude) || !Number.isFinite(poi.longitude)).length;

  if (totalEl) totalEl.textContent = total;
  if (publishedEl) publishedEl.textContent = published;
  if (draftsEl) draftsEl.textContent = drafts;
  if (missingEl) missingEl.textContent = missingLocation;
  if (statusEl) {
    statusEl.textContent = adminState.poiDataSource === 'supabase'
      ? 'Live Supabase data'
      : 'Static dataset (read-only)';
  }

  updatePoiDataSourceBadge();
}

function updatePoiTableFooter(filteredCount) {
  const footer = $('#poiTableFooter');
  if (!footer) return;

  if (!adminState.poisLoaded) {
    footer.textContent = '';
    return;
  }

  const total = adminState.pois.length;
  const sourceLabel = adminState.poiDataSource === 'supabase' ? 'Supabase (live)' : 'Static JSON fallback';
  footer.innerHTML = `
    <span>Showing <strong>${filteredCount}</strong> of <strong>${total}</strong> POIs.</span>
    <span>Source: ${sourceLabel}</span>
  `;
}

function renderPoiList() {
  const tableBody = $('#poisTableBody');
  if (!tableBody) return;

  if (!adminState.poisLoaded) {
    setPoiTableLoading(true);
    return;
  }

  const filtered = getFilteredPois();

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">No POIs match the current filters.</td></tr>';
    updatePoiTableFooter(0);
    return;
  }

  tableBody.innerHTML = filtered.map(poi => {
    const statusPill = `<span class="poi-pill poi-pill--${poi.status}">${poi.status.toUpperCase()}</span>`;
    const sourcePill = poi.source === 'static' ? '<span class="poi-pill poi-pill--static">STATIC</span>' : '';
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '';

    return `
      <tr>
        <td>
          <div class="poi-name">${escapeHtml(poi.name)}</div>
          <div class="poi-slug">${escapeHtml(poi.slug)}</div>
          <div class="poi-meta">
            ${statusPill}
            ${sourcePill}
            ${tags}
          </div>
        </td>
        <td>${formatCategoryLabel(poi.category)}</td>
        <td>${formatCoordinates(poi.latitude, poi.longitude)}</td>
        <td>${poi.radius ? `${poi.radius} m` : '—'}</td>
        <td>${poi.updated_at ? formatDate(poi.updated_at) : poi.created_at ? formatDate(poi.created_at) : '—'}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewPoiDetails('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit POI" onclick="editPoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete POI" onclick="deletePoi('${poi.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updatePoiTableFooter(filtered.length);
}

async function loadPoisData(forceRefresh = false) {
  if (adminState.poiLoading) {
    return;
  }

  if (!forceRefresh && adminState.poisLoaded) {
    renderPoiList();
    updatePoiStats();
    updatePoiTableFooter(getFilteredPois().length);
    updatePoiFilterOptions();
    return;
  }

  adminState.poiLoading = true;
  setPoiTableLoading(true);

  let loaded = false;
  const client = ensureSupabase();

  if (client) {
    try {
      const { data: pois, error } = await client
        .from('pois')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (Array.isArray(pois)) {
        adminState.pois = pois.map(poi => normalizePoi(poi, 'supabase')).filter(Boolean);
        adminState.poiDataSource = 'supabase';
        loaded = true;
      }
    } catch (error) {
      console.error('Failed to load POIs from Supabase:', error);
      showToast('Live POI data unavailable. Loading static dataset.', 'warning');
    }
  }

  if (!loaded) {
    try {
      const response = await fetch('/assets/pois.json');
      if (!response.ok) {
        throw new Error('Failed to load static POIs');
      }
      const staticPois = await response.json();
      adminState.pois = Array.isArray(staticPois)
        ? staticPois.map(poi => normalizePoi(poi, 'static')).filter(Boolean)
        : [];
      adminState.poiDataSource = 'static';
    } catch (error) {
      console.error('Failed to load fallback POIs:', error);
      adminState.pois = [];
      adminState.poiDataSource = 'static';
      showToast('Unable to load POIs', 'error');
    }
  }

  adminState.poiLoading = false;
  adminState.poisLoaded = true;

  updatePoiFilterOptions();
  updatePoiStats();
  renderPoiList();
}

function viewPoiDetails(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  adminState.selectedPoi = poi;

  const title = $('#poiDetailTitle');
  const content = $('#poiDetailContent');
  const modal = $('#poiDetailModal');

  if (title) {
    title.textContent = poi.name;
  }

  if (content) {
    const tags = poi.tags && poi.tags.length
      ? poi.tags.map(tag => `<span class="badge badge-info">${escapeHtml(tag)}</span>`).join(' ')
      : '<span style="color: var(--admin-text-muted);">No tags</span>';

    const description = poi.description
      ? escapeHtml(poi.description).replace(/\n/g, '<br />')
      : '<span style="color: var(--admin-text-muted);">No description provided.</span>';

    const mapLink = poi.latitude && poi.longitude
      ? `<a class="btn-secondary" href="https://maps.google.com/?q=${poi.latitude},${poi.longitude}" target="_blank" rel="noopener">Open in Google Maps</a>`
      : '';

    content.innerHTML = `
      <div class="poi-detail-grid">
        <div class="poi-detail-section">
          <h4>Overview</h4>
          <div class="poi-detail-list">
            <div><strong>Slug:</strong> ${escapeHtml(poi.slug)}</div>
            <div><strong>Category:</strong> ${formatCategoryLabel(poi.category)}</div>
            <div><strong>Status:</strong> ${poi.status.toUpperCase()}</div>
            <div><strong>Radius:</strong> ${poi.radius ? poi.radius + ' m' : '—'}</div>
            <div><strong>XP Reward:</strong> ${poi.xp ?? 100} XP</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Location</h4>
          <div class="poi-detail-list">
            <div><strong>Latitude:</strong> ${poi.latitude ?? '—'}</div>
            <div><strong>Longitude:</strong> ${poi.longitude ?? '—'}</div>
            <div><strong>Coordinates:</strong> ${formatCoordinates(poi.latitude, poi.longitude)}</div>
          </div>
        </div>
        <div class="poi-detail-section">
          <h4>Metadata</h4>
          <div class="poi-detail-list">
            <div><strong>Source:</strong> ${poi.source === 'supabase' ? 'Supabase' : 'Static dataset'}</div>
            <div><strong>Created:</strong> ${poi.created_at ? formatDate(poi.created_at) : '—'}</div>
            <div><strong>Updated:</strong> ${poi.updated_at ? formatDate(poi.updated_at) : '—'}</div>
          </div>
        </div>
      </div>
      <div class="poi-detail-section">
        <h4>Description</h4>
        <div class="poi-detail-description">${description}</div>
      </div>
      <div class="poi-detail-section">
        <h4>Tags</h4>
        <div class="poi-meta">${tags}</div>
      </div>
      <div class="poi-detail-actions">
        ${mapLink}
        <button type="button" class="btn-primary" onclick="editPoi('${poi.id}')">Edit POI</button>
      </div>
    `;
  }

  if (modal) {
    showElement(modal);
  }
}

function closePoiDetail() {
  const modal = $('#poiDetailModal');
  if (modal) {
    hideElement(modal);
  }
}

function openPoiForm(poiId = null) {
  const form = $('#poiForm');
  const modal = $('#poiFormModal');
  if (!form || !modal) return;

  let poi = null;
  if (poiId) {
    poi = findPoi(poiId);
  }

  adminState.selectedPoi = poi;
  adminState.poiFormMode = poi ? 'edit' : 'create';

  form.reset();

  const title = $('#poiFormTitle');
  if (title) {
    title.textContent = poi ? 'Edit POI' : 'New POI';
  }

  // Check if we should use i18n fields
  // New POIs default to i18n, existing POIs use i18n if they have i18n fields
  const useI18n = poi ? (poi.name_i18n || poi.description_i18n) : true;
  const i18nContainer = $('#poiI18nFieldsContainer');
  const legacyNameDesc = $('#poiLegacyNameDesc');
  
  if (useI18n && i18nContainer && legacyNameDesc && window.renderI18nInput) {
    // Render i18n fields
    const nameContainer = $('#poiNameI18n');
    const descContainer = $('#poiDescriptionI18n');
    const badgeContainer = $('#poiBadgeI18n');
    
    if (nameContainer) {
      nameContainer.innerHTML = window.renderI18nInput({
        fieldName: 'name',
        label: 'Name',
        type: 'text',
        placeholder: 'e.g., Kato Paphos Archaeological Park',
        currentValues: poi?.name_i18n || {}
      });
    }
    
    if (descContainer) {
      descContainer.innerHTML = window.renderI18nInput({
        fieldName: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 4,
        placeholder: 'Detailed description',
        currentValues: poi?.description_i18n || {}
      });
    }
    
    if (badgeContainer) {
      badgeContainer.innerHTML = window.renderI18nInput({
        fieldName: 'badge',
        label: 'Badge',
        type: 'text',
        placeholder: 'e.g., Explorer, Adventurer',
        currentValues: poi?.badge_i18n || {}
      });
    }
    
    // Show i18n container, hide legacy name/description
    i18nContainer.style.display = 'block';
    legacyNameDesc.style.display = 'none';
  } else if (legacyNameDesc && i18nContainer) {
    // Use legacy name/description fields
    i18nContainer.style.display = 'none';
    legacyNameDesc.style.display = 'block';
  }

  const nameInput = $('#poiName');
  const slugInput = $('#poiSlug');
  const categoryInput = $('#poiCategory');
  const statusInput = $('#poiStatus');
  const latitudeInput = $('#poiLatitude');
  const longitudeInput = $('#poiLongitude');
  const radiusInput = $('#poiRadius');
  const xpInput = $('#poiXP');
  const googleUrlInput = $('#poiGoogleUrl');
  const mainImageUrlInput = $('#poiMainImageUrl');
  const tagsInput = $('#poiTags');
  const descriptionInput = $('#poiDescription');

  if (nameInput) nameInput.value = poi?.name || '';
  if (slugInput) {
    slugInput.value = poi?.slug || '';
    slugInput.disabled = Boolean(poi);
  }
  if (categoryInput) categoryInput.value = poi?.category || '';
  if (statusInput) statusInput.value = poi?.status || 'published';
  if (latitudeInput) latitudeInput.value = poi?.latitude ?? '';
  if (longitudeInput) longitudeInput.value = poi?.longitude ?? '';
  if (radiusInput) radiusInput.value = poi?.radius ?? '';
  if (xpInput) xpInput.value = poi?.xp ?? '';
  if (googleUrlInput) googleUrlInput.value = poi?.google_url || '';
  if (mainImageUrlInput) mainImageUrlInput.value = poi?.main_image_url || '';
  if (tagsInput) tagsInput.value = poi?.tags?.join(', ') ?? '';
  if (descriptionInput) descriptionInput.value = poi?.description || '';

  poiPhotosState.photos = Array.isArray(poi?.photos) ? poi.photos.slice() : [];
  poiPhotosState.coverUrl = (poi?.main_image_url || poiPhotosState.photos[0] || '').trim();
  const slugForUploads = String(poi?.slug || poi?.id || `poi-${Date.now()}`);
  setupPoiPhotoManagerBindings(slugForUploads);
  renderPoiPhotoManager();

  const warning = $('#poiFormWarning');
  const warningText = $('#poiFormWarningText');
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  if (errorEl) {
    hideElement(errorEl);
    errorEl.textContent = '';
  }

  if (adminState.poiDataSource !== 'supabase') {
    if (warning && warningText) {
      warningText.textContent = 'Supabase connection required. Static dataset is read-only.';
      showElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Read-only';
    }
  } else {
    if (warning) {
      hideElement(warning);
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = poi ? 'Save Changes' : 'Create POI';
    }
  }

  showElement(modal);
}

function closePoiForm() {
  const modal = $('#poiFormModal');
  if (modal) {
    hideElement(modal);
  }
}

async function handlePoiFormSubmit(event) {
  event.preventDefault();
  
  console.log('POI Form Submit started');

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot save POIs while in static mode.', 'warning');
    return;
  }

  const form = event.target;
  const submitBtn = $('#poiFormSubmit');
  const errorEl = $('#poiFormError');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    if (errorEl) hideElement(errorEl);
    
    const formData = new FormData(form);
    
    // Check if using i18n fields
    const usingI18n = $('#poiI18nFieldsContainer')?.style.display !== 'none';
    console.log('Using i18n:', usingI18n);
    
    let name, description, badge;
    let nameI18n, descriptionI18n, badgeI18n;
    
    if (usingI18n && window.extractI18nValues) {
      // Extract i18n values
      nameI18n = window.extractI18nValues(formData, 'name');
      descriptionI18n = window.extractI18nValues(formData, 'description');
      badgeI18n = window.extractI18nValues(formData, 'badge');
      
      console.log('Extracted i18n values:', { nameI18n, descriptionI18n, badgeI18n });
      
      // DEBUG: Show all FormData entries
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        if (key.includes('name') || key.includes('description') || key.includes('badge')) {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      // Validate i18n fields (PL and EN required)
      if (window.validateI18nField) {
        const nameError = window.validateI18nField(nameI18n, 'Name');
        if (nameError) {
          console.log('Validation error:', nameError);
          if (errorEl) {
            errorEl.textContent = nameError;
            showElement(errorEl);
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
          }
          return;
        }
      } else {
        console.warn('window.validateI18nField not available');
      }
      
      // Use Polish as fallback for backward compatibility
      name = nameI18n?.pl || '';
      description = descriptionI18n?.pl || '';
      badge = badgeI18n?.pl || '';
    } else {
      console.log('Using legacy fields');
      // Use legacy fields
      name = (formData.get('name') || '').toString().trim();
      description = (formData.get('description') || '').toString().trim();
      badge = '';
    }
    
    const slugInput = (formData.get('slug') || '').toString().trim();
    const category = (formData.get('category') || '').toString().trim().toLowerCase() || 'uncategorized';
    const status = (formData.get('status') || 'published').toString().toLowerCase();
    const latitude = parseFloat(formData.get('latitude'));
    const longitude = parseFloat(formData.get('longitude'));
    const radiusValue = formData.get('radius');
    const radius = radiusValue ? parseInt(radiusValue, 10) : null;
    const xpValue = formData.get('xp');
    const xp = xpValue ? parseInt(xpValue, 10) : null;
    const googleUrl = (formData.get('google_url') || '').toString().trim();
    const mainImageUrl = (formData.get('main_image_url') || '').toString().trim();
    const tagsValue = (formData.get('tags') || '').toString().trim();
    const tags = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    const slug = slugInput || slugify(name);

    if (adminState.poiFormMode === 'edit' && adminState.selectedPoi) {
      const currentId = String(adminState.selectedPoi.id || '').trim();
      if (slugInput && currentId && slugInput !== currentId) {
        if (errorEl) {
          errorEl.textContent = 'Slug cannot be changed for existing POIs. Create a new POI instead.';
          showElement(errorEl);
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Changes';
        }
        return;
      }
    }

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      if (errorEl) {
        errorEl.textContent = 'Name, latitude and longitude are required.';
        showElement(errorEl);
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
      }
      return;
    }

    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
      }
      return;
    }

    const payload = {
      slug,
      status,
      radius: radius || DEFAULT_POI_RADIUS,
      xp: xp || 100,
      tags,
      ...(googleUrl ? { google_url: googleUrl } : {}),
      ...(mainImageUrl ? { main_image_url: mainImageUrl } : {}),
    };

    if (adminState.poiFormMode === 'create') {
      // Build insert object - MATCH database schema
      const insertData = {
        id: slug,  // 'id' column, not 'slug'
        name: name,
        description: description || null,
        lat: latitude,
        lng: longitude,
        xp: xp || 100,
        badge: category || badge || 'Explorer',  // badge column
        required_level: 1,  // default level
        status: status,
        radius: radius || DEFAULT_POI_RADIUS,
        google_url: googleUrl || null,
        main_image_url: mainImageUrl || null,
        photos: Array.isArray(poiPhotosState.photos) ? poiPhotosState.photos.slice(0, 10) : [],
      };
      
      // Add i18n fields if available
      console.log('Before adding i18n - usingI18n:', usingI18n);
      console.log('nameI18n:', nameI18n, 'type:', typeof nameI18n);
      console.log('descriptionI18n:', descriptionI18n, 'type:', typeof descriptionI18n);
      console.log('badgeI18n:', badgeI18n, 'type:', typeof badgeI18n);
      
      if (usingI18n) {
        console.log('Adding i18n fields to insertData...');
        if (nameI18n) {
          console.log('Adding name_i18n:', nameI18n);
          insertData.name_i18n = nameI18n;
        }
        if (descriptionI18n) {
          console.log('Adding description_i18n:', descriptionI18n);
          insertData.description_i18n = descriptionI18n;
        }
        if (badgeI18n) {
          console.log('Adding badge_i18n:', badgeI18n);
          insertData.badge_i18n = badgeI18n;
        }
      }
      
      console.log('Creating POI with data:', JSON.stringify(insertData, null, 2));

      const { error } = await client
        .from('pois')
        .insert(insertData);

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      showToast('POI created successfully', 'success');
    } else if (adminState.selectedPoi) {
      const poi = adminState.selectedPoi;
      const poiId = poi.id; // Use poi.id (TEXT) not poi.uuid (UUID)

      // Build update object
      const updateData = {
        name: name,
        description: description || null,
        lat: latitude,
        lng: longitude,
        xp: xp,
        status: status,
        radius: radius || DEFAULT_POI_RADIUS,
        google_url: googleUrl || null,
        main_image_url: mainImageUrl || null,
        photos: Array.isArray(poiPhotosState.photos) ? poiPhotosState.photos.slice(0, 10) : [],
        badge: category || badge || null,
        category: category,
        tags: tags,
      };
      
      // Add i18n fields if available
      if (usingI18n) {
        if (nameI18n) updateData.name_i18n = nameI18n;
        if (descriptionI18n) updateData.description_i18n = descriptionI18n;
        if (badgeI18n) updateData.badge_i18n = badgeI18n;
      }

      let res = await client
        .from('pois')
        .update(updateData)
        .eq('id', poiId)
        .select('id');

      if (res.error && isMissingColumnError(res.error, 'tags')) {
        const fallback = { ...updateData };
        delete fallback.tags;
        res = await client
          .from('pois')
          .update(fallback)
          .eq('id', poiId)
          .select('id');
      }

      if (res.error && isMissingColumnError(res.error, 'photos')) {
        const fallback = { ...updateData };
        delete fallback.photos;
        res = await client
          .from('pois')
          .update(fallback)
          .eq('id', poiId)
          .select('id');
      }

      if (res.error && isMissingColumnError(res.error, 'main_image_url')) {
        const fallback = { ...updateData };
        delete fallback.main_image_url;
        delete fallback.photos;
        res = await client
          .from('pois')
          .update(fallback)
          .eq('id', poiId)
          .select('id');
      }

      if (res.error && isMissingColumnError(res.error, 'category')) {
        const fallback = { ...updateData };
        delete fallback.category;
        delete fallback.tags;
        res = await client
          .from('pois')
          .update(fallback)
          .eq('id', poiId)
          .select('id');
      }

      if (res.error && isMissingColumnError(res.error, 'badge')) {
        const fallback = { ...updateData };
        delete fallback.badge;
        delete fallback.tags;
        res = await client
          .from('pois')
          .update(fallback)
          .eq('id', poiId)
          .select('id');
      }

      if (res.error) throw res.error;

      const updatedRows = Array.isArray(res.data) ? res.data : [];
      if (!updatedRows.length) {
        throw new Error('POI update was not applied (0 rows). Check POIs RLS/policies for admins.');
      }

      showToast('POI updated successfully', 'success');
    }

    // Refresh global PLACES_DATA for main site and community
    if (typeof window.refreshPoisData === 'function') {
      console.log('🔄 Refreshing global PLACES_DATA...');
      await window.refreshPoisData();
    }

    closePoiForm();
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to save POI:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to save POI';
      showElement(errorEl);
    }
    showToast('Failed to save POI: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = adminState.poiFormMode === 'edit' ? 'Save Changes' : 'Create POI';
    }
  }
}

async function deletePoi(poiId) {
  const poi = findPoi(poiId);
  if (!poi) {
    showToast('POI not found', 'error');
    return;
  }

  if (adminState.poiDataSource !== 'supabase') {
    showToast('Cannot delete POIs while in static mode.', 'warning');
    return;
  }

  if (!confirm(`Delete POI "${poi.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Database connection not available');
    }

    const poiIdToDelete = poi.uuid || poi.id;
    const { error } = await client.rpc('admin_delete_poi', {
      poi_id: poiIdToDelete,
      deletion_reason: 'Admin panel removal',
    });

    if (error) throw error;

    // Refresh global PLACES_DATA for main site and community
    if (typeof window.refreshPoisData === 'function') {
      console.log('🔄 Refreshing global PLACES_DATA after delete...');
      await window.refreshPoisData();
    }

    showToast('POI deleted successfully', 'success');
    adminState.poisLoaded = false;
    await loadPoisData(true);
  } catch (error) {
    console.error('Failed to delete POI:', error);
    showToast('Failed to delete POI: ' + (error.message || 'Unknown error'), 'error');
  }
}

function editPoi(poiId) {
  openPoiForm(poiId);
}

function refreshPoiList() {
  loadPoisData(true);
}

// Delete Comment
async function deleteComment(commentId, reason = 'Content policy violation') {
  if (!confirm(`Delete this comment?\nReason: ${reason}`)) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    showToast('Deleting comment...', 'info');
    
    const { data, error } = await client.rpc('admin_delete_comment', {
      comment_id: commentId,
      deletion_reason: reason
    });
    
    if (error) throw error;
    
    showToast('Comment deleted successfully', 'success');
    
    // Reload content if on content view
    if (adminState.currentView === 'content') {
      loadContentData();
    }
    
  } catch (error) {
    console.error('Delete comment failed:', error);
    showToast('Failed to delete comment: ' + (error.message || 'Unknown error'), 'error');
  }
}

// =====================================================
// CONTENT MANAGEMENT - STATE
// =====================================================
let contentState = {
  comments: [],
  currentPage: 1,
  itemsPerPage: 20,
  totalComments: 0,
  searchQuery: '',
  selectedComment: null,
  stats: null
};

// Load Content Management Data
async function loadContentData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      const statsEl = $('#contentStats');
      if (statsEl) {
        statsEl.innerHTML = '<div class="admin-error-message">❌ Database not connected. Check console for details.</div>';
      }
      return;
    }
    
    // Load statistics first
    await loadContentStats();
    
    // Load comments
    await loadComments();
    
  } catch (error) {
    console.error('Failed to load content data:', error);
    showToast('Failed to load content data: ' + error.message, 'error');
    
    // Show helpful error message
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center;">
            <div style="color: var(--admin-danger); margin-bottom: 16px; font-size: 18px;">❌ Error Loading Content</div>
            <div style="color: var(--admin-text-muted); margin-bottom: 16px;">${escapeHtml(error.message)}</div>
            <div style="background: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 8px; text-align: left; max-width: 600px; margin: 0 auto;">
              <p style="margin: 0 0 8px; font-weight: 600;">Possible solutions:</p>
              <ol style="margin: 0; padding-left: 20px; color: var(--admin-text);">
                <li>Run <code>ADMIN_CONTENT_COMPLETE_INSTALL.sql</code> in Supabase SQL Editor</li>
                <li>Check if you have admin permissions (is_admin = true)</li>
                <li>Open browser console (F12) for detailed error</li>
                <li>Verify Supabase connection is working</li>
              </ol>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Load content statistics
async function loadContentStats() {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const { data: stats, error } = await client.rpc('admin_get_detailed_content_stats');
    
    if (error) {
      console.error('Stats error:', error);
      throw new Error(`Stats function failed: ${error.message}. Did you run ADMIN_CONTENT_COMPLETE_INSTALL.sql?`);
    }
    
    if (!stats) {
      throw new Error('No stats data returned');
    }
    
    contentState.stats = stats;
    
    // Update stats display
    const statsEl = $('#contentStats');
    if (statsEl) {
      if (stats && stats.comments && stats.photos && stats.likes && stats.engagement) {
        statsEl.innerHTML = `
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Comments</p>
              <p class="stat-card-value">${stats.comments.total || 0}</p>
              <p class="stat-card-change">+${stats.comments.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Photos</p>
              <p class="stat-card-value">${stats.photos.total || 0}</p>
              <p class="stat-card-change">${stats.comments.with_photos || 0} comments with photos</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Likes</p>
              <p class="stat-card-value">${stats.likes.total || 0}</p>
              <p class="stat-card-change">+${stats.likes.today || 0} today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users (7d)</p>
              <p class="stat-card-value">${stats.engagement.active_commenters_week || 0}</p>
              <p class="stat-card-change">Contributors this week</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to load content stats:', error);
    const statsEl = $('#contentStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="admin-error-message" style="grid-column: 1 / -1;">
          ⚠️ Statistics unavailable: ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

// Load comments with filters
async function loadComments(page = 1) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    const tableBody = $('#contentTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading comments...</td></tr>';
    
    contentState.currentPage = page;
    const offset = (page - 1) * contentState.itemsPerPage;
    
    const { data: comments, error } = await client.rpc('admin_get_all_comments', {
      search_query: contentState.searchQuery || null,
      poi_filter: null,
      user_filter: null,
      date_from: null,
      date_to: null,
      limit_count: contentState.itemsPerPage,
      offset_count: offset
    });
    
    if (error) {
      console.error('Comments RPC error:', error);
      throw new Error(`Failed to load comments: ${error.message}. Make sure ADMIN_CONTENT_COMPLETE_INSTALL.sql is executed.`);
    }
    
    contentState.comments = comments || [];
    
    if (comments.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No comments found</td></tr>';
      updateContentPagination(0);
      return;
    }
    
    tableBody.innerHTML = comments.map(comment => {
      const editedBadge = comment.is_edited ? '<span class="badge badge-info" title="Edited">✎</span>' : '';
      const photoBadge = comment.photo_count > 0 ? `<span class="badge badge-success">📷 ${comment.photo_count}</span>` : '';
      
      return `
      <tr>
        <td>
          <div style="font-weight: 500;">${escapeHtml(comment.username)}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">Level ${comment.user_level}</div>
        </td>
        <td>
          <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(comment.poi_name || 'Unknown POI')}</div>
          <div class="comment-preview" title="${escapeHtml(comment.comment_content)}">
            ${escapeHtml(comment.comment_content.substring(0, 80))}${comment.comment_content.length > 80 ? '...' : ''}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${editedBadge}
            ${photoBadge}
          </div>
        </td>
        <td>❤️ ${comment.like_count}</td>
        <td>${formatDate(comment.created_at)}</td>
        <td>
          <div class="poi-table-actions">
            <button class="btn-icon" type="button" title="View details" onclick="viewCommentDetails('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Edit comment" onclick="editComment('${comment.comment_id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
            </button>
            <button class="btn-icon" type="button" title="Delete comment" onclick="deleteComment('${comment.comment_id}')" style="color: var(--admin-danger);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
    
    // Update pagination
    updateContentPagination(comments.length);
    
  } catch (error) {
    console.error('Failed to load comments:', error);
    showToast('Failed to load comments', 'error');
    const tableBody = $('#contentTable');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Error loading comments</td></tr>';
    }
  }
}

// Update pagination
function updateContentPagination(loadedCount) {
  const paginationEl = $('#contentPagination');
  if (!paginationEl) return;
  
  const hasMore = loadedCount === contentState.itemsPerPage;
  const hasPrev = contentState.currentPage > 1;
  
  paginationEl.innerHTML = `
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage - 1})" 
      ${!hasPrev ? 'disabled' : ''}>
      Previous
    </button>
    <span class="pagination-info">Page ${contentState.currentPage}</span>
    <button 
      class="btn-pagination" 
      onclick="loadComments(${contentState.currentPage + 1})" 
      ${!hasMore ? 'disabled' : ''}>
      Next
    </button>
  `;
}

// View comment details
async function viewCommentDetails(commentId) {
  try {
    const client = ensureSupabase();
    if (!client) return;
    
    showToast('Loading comment details...', 'info');

    const { data, error } = await client.rpc('admin_get_comment_details', {
      comment_id: commentId
    });

    if (error) throw error;

    const comment = data.comment;
    const photos = data.photos || [];
    const likes = data.likes || { count: 0, users: [] };
    
    contentState.selectedComment = { ...data, comment_id: commentId };
    
    // Show modal
    const modal = $('#commentDetailModal');
    const title = $('#commentDetailTitle');
    const content = $('#commentDetailContent');
    
    if (title) {
      title.textContent = `Comment by ${comment.username}`;
    }
    
    if (content) {
      const photosHtml = photos.length > 0 ? `
        <div class="comment-photos-grid">
          ${photos.map(photo => `
            <div class="comment-photo-item">
              <img src="${escapeHtml(photo.photo_url)}" alt="Comment photo" onclick="window.open('${escapeHtml(photo.photo_url)}', '_blank')" style="cursor: pointer;" />
              <button class="btn-delete-photo" onclick="deleteCommentPhoto('${photo.id}')" title="Delete photo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No photos</p>';
      
      const likesHtml = likes.count > 0 ? `
        <div class="likes-list">
          ${likes.users.map(user => `
            <div class="like-item">
              <span>❤️ ${user.username || 'Anonymous'}</span>
              <span style="color: var(--admin-text-muted); font-size: 12px;">${formatDate(user.liked_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--admin-text-muted);">No likes yet</p>';
      
      content.innerHTML = `
        <div style="display: grid; gap: 24px;">
          <!-- Comment Info -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Comment Details</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px;">
              <table style="width: 100%; color: var(--admin-text);">
                <tr>
                  <td style="padding: 8px 0; font-weight: 500; width: 120px;">POI:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.poi_name || 'Unknown')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">User ID:</td>
                  <td style="padding: 8px 0; font-family: monospace; font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(comment.user_id || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Username:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.username || 'Anonymous')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Email:</td>
                  <td style="padding: 8px 0;">${escapeHtml(comment.user_email || 'N/A')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Level & XP:</td>
                  <td style="padding: 8px 0;">Level ${comment.user_level} (${comment.user_xp} XP)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Created:</td>
                  <td style="padding: 8px 0;">${formatDate(comment.created_at)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 500;">Updated:</td>
                  <td style="padding: 8px 0;">${comment.updated_at ? formatDate(comment.updated_at) : 'Never'}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <!-- Comment Content -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Content</h4>
            <div style="background: var(--admin-bg); padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
              ${escapeHtml(comment.content)}
            </div>
          </div>
          
          <!-- Photos -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Photos (${photos.length})</h4>
            ${photosHtml}
          </div>
          
          <!-- Likes -->
          <div>
            <h4 style="margin-bottom: 12px; color: var(--admin-text);">Likes (${likes.count})</h4>
            ${likesHtml}
          </div>
          
          <!-- Actions -->
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn-primary" onclick="editComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Edit Comment
            </button>
            <button class="btn-secondary" style="background: var(--admin-danger); border-color: var(--admin-danger);" onclick="deleteComment('${commentId}'); hideElement($('#commentDetailModal'));">
              Delete Comment
            </button>
          </div>
        </div>
      `;
    }
    
    showElement(modal);
    
  } catch (error) {
    console.error('Failed to load comment details:', error);
    showToast('Failed to load comment details', 'error');
  }
}

// Edit comment
function editComment(commentId) {
  const comment = contentState.comments.find(c => c.comment_id === commentId);
  if (!comment) {
    showToast('Comment not found', 'error');
    return;
  }
  
  contentState.selectedComment = { ...comment, comment_id: commentId };
  
  const modal = $('#commentEditModal');
  const title = $('#commentEditTitle');
  const textarea = $('#commentEditContent');
  const form = $('#commentEditForm');
  
  if (title) {
    title.textContent = `Edit Comment by ${comment.username}`;
  }
  
  if (textarea) {
    textarea.value = comment.comment_content;
  }
  
  showElement(modal);
}

// Handle comment edit form submission
async function handleCommentEditSubmit(event) {
  event.preventDefault();
  
  const commentId = contentState.selectedComment?.comment_id;
  if (!commentId) return;
  
  const textarea = $('#commentEditContent');
  const submitBtn = $('#commentEditSubmit');
  const errorEl = $('#commentEditError');
  
  const newContent = textarea.value.trim();
  
  if (!newContent) {
    if (errorEl) {
      errorEl.textContent = 'Comment content cannot be empty';
      showElement(errorEl);
    }
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }
  
  if (errorEl) hideElement(errorEl);
  
  try {
    const client = ensureSupabase();
    if (!client) throw new Error('Database connection not available');
    
    const { error } = await client.rpc('admin_update_comment', {
      comment_id: commentId,
      new_content: newContent,
      edit_reason: 'Admin edit'
    });
    
    if (error) throw error;
    
    showToast('Comment updated successfully', 'success');
    hideElement($('#commentEditModal'));
    
    // Reload comments
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to update comment:', error);
    if (errorEl) {
      errorEl.textContent = error.message || 'Failed to update comment';
      showElement(errorEl);
    }
    showToast('Failed to update comment', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
}

async function buildOrdersAnalyticsSection(client) {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safe = (v) => String(v ?? '').trim();
  const fmtMoney = (v) => (typeof formatMoney === 'function' ? formatMoney(v, 'EUR') : `€${toNum(v).toFixed(2)}`);
  const serviceGrossValue = (row) => {
    if (safe(row?.resource_type).toLowerCase() !== 'cars') return toNum(row?.total_price);
    const detailsRaw = row?.details;
    const details = (detailsRaw && typeof detailsRaw === 'object')
      ? detailsRaw
      : (() => {
        if (typeof detailsRaw !== 'string') return null;
        try {
          const parsed = JSON.parse(detailsRaw);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_e) {
          return null;
        }
      })();
    const finalRental = Number(details?.final_rental_price);
    if (Number.isFinite(finalRental)) return finalRental;
    return toNum(row?.total_price);
  };

  let service = [];
  try {
    let serviceRes = await client
      .from('partner_service_fulfillments')
      .select('id, partner_id, resource_type, booking_id, status, total_price, currency, created_at, summary, reference, details')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (serviceRes.error && /details/i.test(String(serviceRes.error.message || ''))) {
      serviceRes = await client
        .from('partner_service_fulfillments')
        .select('id, partner_id, resource_type, booking_id, status, total_price, currency, created_at, summary, reference')
        .order('created_at', { ascending: false })
        .limit(2000);
    }
    service = serviceRes.data || [];
  } catch (_e) {
    service = [];
  }

  const serviceCounts = { total: service.length, pending: 0, awaiting: 0, accepted: 0, rejected: 0, expired: 0 };
  const serviceTotals = { gross: 0, deposit: 0, partner: 0 };

  const fids = service.map((r) => r?.id).filter(Boolean);
  const depositByFid = {};

  if (fids.length) {
    const chunks = typeof chunkArray === 'function' ? chunkArray(fids, 200) : [fids];
    for (const ids of chunks) {
      try {
        const { data } = await client
          .from('service_deposit_requests')
          .select('fulfillment_id, amount, status, paid_at')
          .in('fulfillment_id', ids)
          .limit(2000);
        (data || []).forEach((r) => {
          const paid = r?.status === 'paid' || !!r?.paid_at;
          if (r?.fulfillment_id) depositByFid[r.fulfillment_id] = paid ? toNum(r?.amount) : 0;
        });
      } catch (_e) {
      }
    }
  }

  const partnerAgg = {};
  const bumpPartner = (partnerId, delta) => {
    const pid = safe(partnerId);
    if (!pid) return;
    if (!partnerAgg[pid]) partnerAgg[pid] = { orders: 0, gross: 0, our: 0, partner: 0 };
    partnerAgg[pid].orders += delta.orders || 0;
    partnerAgg[pid].gross += delta.gross || 0;
    partnerAgg[pid].our += delta.our || 0;
    partnerAgg[pid].partner += delta.partner || 0;
  };

  const topByType = { cars: {}, trips: {}, hotels: {} };
  const bumpTop = (type, label, gross, deposit, partner) => {
    const t = safe(type);
    if (!topByType[t]) return;
    const key = safe(label) || '—';
    if (!topByType[t][key]) topByType[t][key] = { label: key, count: 0, gross: 0, our: 0, partner: 0 };
    topByType[t][key].count += 1;
    topByType[t][key].gross += gross;
    topByType[t][key].our += deposit;
    topByType[t][key].partner += partner;
  };

  service.forEach((f) => {
    const st = safe(f?.status);
    if (st === 'pending_acceptance') serviceCounts.pending += 1;
    if (st === 'awaiting_payment') serviceCounts.awaiting += 1;
    if (st === 'accepted') serviceCounts.accepted += 1;
    if (st === 'rejected') serviceCounts.rejected += 1;
    if (st === 'expired') serviceCounts.expired += 1;

    if (st !== 'accepted') return;
    const gross = serviceGrossValue(f);
    const deposit = toNum(depositByFid[f?.id] || 0);
    const partner = Math.max(0, gross - deposit);
    serviceTotals.gross += gross;
    serviceTotals.deposit += deposit;
    serviceTotals.partner += partner;
    bumpPartner(f?.partner_id, { orders: 1, gross, our: deposit, partner });
    const label = safe(f?.summary) || safe(f?.reference) || safe(f?.booking_id).slice(0, 8).toUpperCase();
    bumpTop(f?.resource_type, label, gross, deposit, partner);
  });

  let shop = [];
  let shopPaid = new Set();
  try {
    const { data } = await client
      .from('shop_orders')
      .select('id, payment_status, paid_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    (data || []).forEach((o) => {
      if (o?.id && (o?.payment_status === 'paid' || !!o?.paid_at)) shopPaid.add(o.id);
    });
  } catch (_e) {
    shopPaid = new Set();
  }

  try {
    const { data } = await client
      .from('shop_order_fulfillments')
      .select('id, order_id, partner_id, status, subtotal, total_allocated, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    shop = data || [];
  } catch (_e) {
    shop = [];
  }

  const shopCounts = { total: shop.length, pending: 0, awaiting: 0, accepted: 0, rejected: 0, expired: 0 };
  const shopTotals = { gross: 0, margin: 0, partner: 0 };

  shop.forEach((f) => {
    const st = safe(f?.status);
    if (st === 'pending_acceptance') shopCounts.pending += 1;
    if (st === 'awaiting_payment') shopCounts.awaiting += 1;
    if (st === 'accepted') shopCounts.accepted += 1;
    if (st === 'rejected') shopCounts.rejected += 1;
    if (st === 'expired') shopCounts.expired += 1;

    if (st !== 'accepted') return;
    if (f?.order_id && shopPaid.size && !shopPaid.has(f.order_id)) return;
    const gross = toNum(f?.subtotal);
    const partner = toNum(f?.total_allocated);
    const margin = Math.max(0, gross - partner);
    shopTotals.gross += gross;
    shopTotals.partner += partner;
    shopTotals.margin += margin;
    bumpPartner(f?.partner_id, { orders: 1, gross, our: margin, partner });
  });

  let topShop = [];
  try {
    const orderIds = Array.from(shopPaid).filter(Boolean);
    if (orderIds.length) {
      const chunks = typeof chunkArray === 'function' ? chunkArray(orderIds, 200) : [orderIds];
      const grouped = {};
      for (const ids of chunks) {
        const { data } = await client
          .from('shop_order_items')
          .select('product_name, quantity, subtotal')
          .in('order_id', ids)
          .limit(5000);
        (data || []).forEach((it) => {
          const label = safe(it?.product_name) || '—';
          const qty = Math.max(1, Math.floor(toNum(it?.quantity) || 1));
          const gross = toNum(it?.subtotal);
          if (!grouped[label]) grouped[label] = { label, count: 0, gross: 0 };
          grouped[label].count += qty;
          grouped[label].gross += gross;
        });
      }
      topShop = Object.values(grouped)
        .sort((a, b) => (b.gross || 0) - (a.gross || 0))
        .slice(0, 10);
    }
  } catch (_e) {
    topShop = [];
  }

  let partnersById = {};
  try {
    const ids = Object.keys(partnerAgg);
    if (ids.length) {
      const chunks = typeof chunkArray === 'function' ? chunkArray(ids, 200) : [ids];
      for (const chunkIds of chunks) {
        const { data } = await client.from('partners').select('id, name, slug').in('id', chunkIds).limit(1000);
        (data || []).forEach((p) => {
          if (p?.id) partnersById[p.id] = p;
        });
      }
    }
  } catch (_e) {
    partnersById = {};
  }

  const partnerRows = Object.entries(partnerAgg)
    .map(([pid, v]) => {
      const p = partnersById[pid] || {};
      const label = safe(p?.name) || safe(p?.slug) || pid.slice(0, 8).toUpperCase();
      return { partner_id: pid, label, ...v };
    })
    .sort((a, b) => (b.gross || 0) - (a.gross || 0))
    .slice(0, 50);

  const topList = (obj) => Object.values(obj).sort((a, b) => (b.gross || 0) - (a.gross || 0)).slice(0, 10);
  const topCars = topList(topByType.cars || {});
  const topTrips = topList(topByType.trips || {});
  const topHotels = topList(topByType.hotels || {});

  const totalOrders = serviceCounts.total + shopCounts.total;
  const pendingOrders = serviceCounts.pending + shopCounts.pending;
  const awaitingOrders = serviceCounts.awaiting + shopCounts.awaiting;
  const acceptedOrders = serviceCounts.accepted + shopCounts.accepted;
  const grossTotal = serviceTotals.gross + shopTotals.gross;
  const ourTotal = serviceTotals.deposit + shopTotals.margin;
  const partnerTotal = serviceTotals.partner + shopTotals.partner;

  const renderTopTable = (title, rows) => `
    <div class="admin-table-container" style="margin-top: 10px;">
      <table class="admin-table">
        <thead>
          <tr>
            <th>${escapeHtml(title)}</th>
            <th style="text-align:right;">Ilość</th>
            <th style="text-align:right;">Brutto</th>
            <th style="text-align:right;">Nasz zysk</th>
            <th style="text-align:right;">Partner</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.label || '—')}</td>
              <td style="text-align:right;">${r.count || 0}</td>
              <td style="text-align:right;"><strong>${fmtMoney(r.gross || 0)}</strong></td>
              <td style="text-align:right;">${fmtMoney(r.our || 0)}</td>
              <td style="text-align:right;">${fmtMoney(r.partner || 0)}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" class="table-loading">Brak danych</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  const renderShopTopTable = (rows) => `
    <div class="admin-table-container" style="margin-top: 10px;">
      <table class="admin-table">
        <thead>
          <tr>
            <th>${escapeHtml('Produkty (Shop)')}</th>
            <th style="text-align:right;">Ilość</th>
            <th style="text-align:right;">Brutto</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.label || '—')}</td>
              <td style="text-align:right;">${r.count || 0}</td>
              <td style="text-align:right;"><strong>${fmtMoney(r.gross || 0)}</strong></td>
            </tr>
          `).join('') : '<tr><td colspan="3" class="table-loading">Brak danych</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="admin-section" style="margin-bottom: 28px;">
      <h2 style="margin-bottom: 6px;">Zamówienia i zarobki</h2>
      <p class="admin-view-subtitle" style="margin-top: 0;">Nasz zysk = deposit (usługi) + marża (shop). Partner = pełna cena - deposit (usługi) + alokacja (shop).</p>

      <div class="admin-stats-grid" style="margin-bottom:24px;">
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Wszystkie zamówienia</p><p class="stat-card-value">${totalOrders}</p><p class="stat-card-change">Cars/Trips/Hotels + Shop</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Czeka na zatwierdzenie</p><p class="stat-card-value">${pendingOrders}</p><p class="stat-card-change">pending_acceptance</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Czeka na wpłatę</p><p class="stat-card-value">${awaitingOrders}</p><p class="stat-card-change">awaiting_payment</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Zaakceptowane</p><p class="stat-card-value">${acceptedOrders}</p><p class="stat-card-change">accepted</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Sprzedaż (brutto)</p><p class="stat-card-value">${fmtMoney(grossTotal)}</p><p class="stat-card-change">Tylko zaakceptowane</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Nasz zysk</p><p class="stat-card-value">${fmtMoney(ourTotal)}</p><p class="stat-card-change">deposit + marża</p></div></div>
        <div class="admin-stat-card"><div class="stat-card-content"><p class="stat-card-label">Zysk partnerów</p><p class="stat-card-value">${fmtMoney(partnerTotal)}</p><p class="stat-card-change">payout</p></div></div>
      </div>

      <div class="admin-section" style="margin-top: 18px;">
        <h3>Partnerzy: zarobki</h3>
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th style="text-align:right;">Zamówienia (zaakceptowane)</th>
                <th style="text-align:right;">Sprzedaż (brutto)</th>
                <th style="text-align:right;">Nasz zysk</th>
                <th style="text-align:right;">Zysk partnera</th>
              </tr>
            </thead>
            <tbody>
              ${partnerRows.length ? partnerRows.map((p) => `
                <tr>
                  <td>${escapeHtml(p.label)}</td>
                  <td style="text-align:right;">${p.orders || 0}</td>
                  <td style="text-align:right;"><strong>${fmtMoney(p.gross || 0)}</strong></td>
                  <td style="text-align:right;">${fmtMoney(p.our || 0)}</td>
                  <td style="text-align:right;">${fmtMoney(p.partner || 0)}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="table-loading">Brak danych</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-section" style="margin-top: 18px;">
        <h3>Najlepiej sprzedające się (zaakceptowane)</h3>
        ${renderTopTable('Auta', topCars)}
        ${renderTopTable('Wycieczki', topTrips)}
        ${renderTopTable('Hotele', topHotels)}
        ${topShop.length ? renderShopTopTable(topShop) : ''}
      </div>
    </div>
  `;
}

// Get Analytics Data
async function loadAnalytics() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const ordersSectionHtml = await buildOrdersAnalyticsSection(client);

    // Get content stats
    const { data: contentStats, error: statsError } = await client.rpc('admin_get_content_stats');
    
    if (statsError) throw statsError;
    
    // Get top contributors
    const { data: topContributors, error: contribError } = await client.rpc('admin_get_top_contributors', {
      limit_count: 10
    });
    
    if (contribError) throw contribError;
    
    // Update analytics display
    const analyticsEl = $('#analyticsContent');
    if (analyticsEl && contentStats) {
      analyticsEl.innerHTML = `
        ${ordersSectionHtml}
        <!-- Engagement & activity -->
        <div class="admin-stats-grid" style="margin-bottom:24px;">
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments Today</p>
              <p class="stat-card-value">${contentStats.comments_today || 0}</p>
              <p class="stat-card-change">New comments in last 24h</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments This Week</p>
              <p class="stat-card-value">${contentStats.comments_this_week || 0}</p>
              <p class="stat-card-change">Last 7 days</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Comments This Month</p>
              <p class="stat-card-value">${contentStats.comments_this_month || 0}</p>
              <p class="stat-card-change">Last 30 days</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users Today</p>
              <p class="stat-card-value">${contentStats.active_users_today || 0}</p>
              <p class="stat-card-change">Unique users today</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Active Users (7 days)</p>
              <p class="stat-card-value">${contentStats.active_users_week || 0}</p>
              <p class="stat-card-change">Unique users in last 7 days</p>
            </div>
          </div>
        </div>

        <!-- Content totals -->
        <div class="admin-stats-grid">
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total POIs</p>
              <p class="stat-card-value">${contentStats.total_pois || 0}</p>
              <p class="stat-card-change">All attractions in system</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Comments</p>
              <p class="stat-card-value">${contentStats.total_comments || 0}</p>
              <p class="stat-card-change">All user comments</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Ratings</p>
              <p class="stat-card-value">${contentStats.total_ratings || 0}</p>
              <p class="stat-card-change">Number of rating events</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Total Visits</p>
              <p class="stat-card-value">${contentStats.total_visits || 0}</p>
              <p class="stat-card-change">Recorded POI visits</p>
            </div>
          </div>
          <div class="admin-stat-card">
            <div class="stat-card-content">
              <p class="stat-card-label">Average Rating</p>
              <p class="stat-card-value">${contentStats.avg_rating != null ? contentStats.avg_rating : 'N/A'}</p>
              <p class="stat-card-change">Across all rated POIs</p>
            </div>
          </div>
        </div>

        <div class="admin-section" style="margin-top: 32px;">
          <h3>Top Contributors</h3>
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Comments</th>
                  <th>Ratings</th>
                  <th>Visits</th>
                  <th>XP</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                ${topContributors && topContributors.length > 0 ? topContributors.map(user => `
                  <tr>
                    <td>${user.username || 'N/A'}</td>
                    <td>${user.comment_count || 0}</td>
                    <td>${user.rating_count || 0}</td>
                    <td>${user.visit_count || 0}</td>
                    <td>${user.total_xp || 0}</td>
                    <td>${user.level || 0}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6" class="table-loading">No contributors found</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Failed to load analytics:', error);
    showToast('Failed to load analytics', 'error');
  }
}

// Delete comment photo
async function deleteCommentPhoto(photoId) {
  if (!confirm('Delete this photo? This action cannot be undone.')) {
    return;
  }
  
  try {
    const client = ensureSupabase();
    if (!client) {
      throw new Error('Database connection not available');
    }
    
    showToast('Deleting photo...', 'info');
    
    const { error } = await client.rpc('admin_delete_comment_photo', {
      photo_id: photoId,
      deletion_reason: 'Admin action'
    });
    
    if (error) throw error;
    
    showToast('Photo deleted successfully', 'success');
    
    // Close detail modal and reload
    hideElement($('#commentDetailModal'));
    await loadComments(contentState.currentPage);
    
  } catch (error) {
    console.error('Failed to delete photo:', error);
    showToast('Failed to delete photo: ' + (error.message || 'Unknown error'), 'error');
  }
}

// Search comments
function searchComments() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    contentState.searchQuery = searchInput.value.trim();
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// Clear search
function clearContentSearch() {
  const searchInput = $('#contentSearchInput');
  if (searchInput) {
    searchInput.value = '';
    contentState.searchQuery = '';
    contentState.currentPage = 1;
    loadComments(1);
  }
}

// =====================================================
// MODERATION MANAGEMENT
// =====================================================

let moderationState = {
  reports: [],
  currentPage: 1,
  itemsPerPage: 20
};

// Load moderation data
async function loadModerationData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const tableBody = $('#moderationTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading reports...</td></tr>';
    
    // Load reported content
    const { data: reports, error } = await client
      .from('reported_content')
      .select(`
        id,
        report_type,
        reason,
        status,
        created_at,
        reporter_id,
        profiles!reporter_id(username, email),
        comment_id,
        poi_comments!comment_id(content, poi_id, user_id, profiles!user_id(username))
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(moderationState.itemsPerPage);
    
    if (error) {
      console.error('Failed to load reports:', error);
      // Try simpler query if join fails
      const { data: simpleReports, error: simpleError } = await client
        .from('reported_content')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(moderationState.itemsPerPage);
      
      if (simpleError) throw simpleError;
      
      if (!simpleReports || simpleReports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">No pending reports</td></tr>';
        return;
      }
      
      // Render simple version
      tableBody.innerHTML = simpleReports.map(report => `
        <tr>
          <td><span class="badge badge-warning">${escapeHtml(report.report_type || 'unknown')}</span></td>
          <td>Reporter ID: ${escapeHtml(report.reporter_id ? report.reporter_id.substring(0, 8) : 'N/A')}</td>
          <td>POI: ${escapeHtml(report.poi_id || 'N/A')}</td>
          <td>—</td>
          <td>${escapeHtml(report.reason || 'No reason')}</td>
          <td>${formatDate(report.created_at)}</td>
          <td>
            <div class="poi-table-actions">
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'approved')" title="Approve">✓</button>
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'rejected')" title="Reject">✗</button>
            </div>
          </td>
        </tr>
      `).join('');
      return;
    }
    
    moderationState.reports = reports || [];
    
    if (reports.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="table-loading">✅ No pending reports - all clear!</td></tr>';
      return;
    }
    
    // Render full version with joins
    tableBody.innerHTML = reports.map(report => {
      const reporter = report.profiles?.username || 'Anonymous';
      const comment = report.poi_comments;
      const commentUser = comment?.profiles?.username || 'Unknown';
      const commentExcerpt = comment?.content ? comment.content.substring(0, 50) + '...' : 'N/A';
      const poiId = comment?.poi_id || 'N/A';
      
      return `
        <tr>
          <td><span class="badge badge-warning">${escapeHtml(report.report_type || 'comment')}</span></td>
          <td>${escapeHtml(reporter)}</td>
          <td>${escapeHtml(poiId)}</td>
          <td title="${escapeHtml(comment?.content || '')}">${escapeHtml(commentExcerpt)}</td>
          <td>${escapeHtml(report.reason || 'No reason')}</td>
          <td>${formatDate(report.created_at)}</td>
          <td>
            <div class="poi-table-actions">
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'approved')" title="Approve & delete content">✓ Approve</button>
              <button class="btn-secondary" onclick="resolveReport('${report.id}', 'rejected')" title="Reject report">✗ Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load moderation data:', error);
    showToast('Failed to load moderation data: ' + error.message, 'error');
    
    const tableBody = $('#moderationTable');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 32px; text-align: center;">
            <div style="color: var(--admin-danger); margin-bottom: 12px;">❌ Error Loading Reports</div>
            <div style="color: var(--admin-text-muted);">${escapeHtml(error.message)}</div>
            <div style="margin-top: 16px;">
              <small>Make sure reported_content table exists in Supabase</small>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Resolve report
async function resolveReport(reportId, resolution) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }
    
    const action = resolution === 'approved' ? 'approved' : 'rejected';
    
    if (!confirm(`${action === 'approved' ? 'Approve this report and take action?' : 'Reject this report?'}`)) {
      return;
    }
    
    showToast('Processing...', 'info');
    
    // Update report status
    const { error } = await client
      .from('reported_content')
      .update({
        status: action,
        resolved_at: new Date().toISOString(),
        resolved_by: adminState.user?.id
      })
      .eq('id', reportId);
    
    if (error) throw error;
    
    showToast(`Report ${action} successfully`, 'success');
    
    // Reload moderation data
    await loadModerationData();
    
  } catch (error) {
    console.error('Failed to resolve report:', error);
    showToast('Failed to resolve report: ' + error.message, 'error');
  }
}

// Make functions global for onclick handlers
window.adjustUserXP = adjustUserXP;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteComment = deleteComment;
window.viewPoiDetails = viewPoiDetails;
window.editPoi = editPoi;
window.deletePoi = deletePoi;
window.viewCommentDetails = viewCommentDetails;
window.editComment = editComment;
window.handleCommentEditSubmit = handleCommentEditSubmit;
window.deleteCommentPhoto = deleteCommentPhoto;
window.loadComments = loadComments;
window.searchComments = searchComments;
window.clearContentSearch = clearContentSearch;
window.loadModerationData = loadModerationData;
window.resolveReport = resolveReport;

// =====================================================
// INITIALIZATION
// =====================================================

async function initAdminPanel() {
  console.log('Initializing admin panel...');
  console.log('NOTE: Auth already verified by /admin/index.html - skipping auth checks');
  
  // Initialize event listeners
  initEventListeners();
  
  // Wait for Supabase client
  let retries = 0;
  const maxRetries = 10;
  
  while (!sb && retries < maxRetries) {
    sb = getSupabaseClient();
    if (!sb) {
      console.log(`Waiting for Supabase client... (${retries + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
  }
  
  if (!sb) {
    console.error('Failed to load Supabase client after multiple retries');
    setLoading(false);
    return;
  }
  
  console.log('Supabase client loaded successfully');
  
  // Load user session (but don't redirect - index.html already verified)
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      adminState.user = session.user;
      console.log('User session loaded:', session.user.email);
      
      // Load profile
      const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        adminState.profile = profile;
        adminState.isAdmin = profile.is_admin;
        console.log('Profile loaded:', profile.username || profile.email);
      }
      
      // Show admin panel and hide loading
      showAdminPanel();

      initAdminPartnerRealtime();
      initAdminCalendarsRealtime();
      ensurePartnersAutoRefresh();

      initAdminDashboardRealtime();
      ensureDashboardAutoRefresh();
    }
  } catch (error) {
    console.error('Error loading session:', error);
  }

  console.log('Admin panel initialized successfully');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPanel);
} else {
  initAdminPanel();
}

// =====================================================
// TRIPS TABS FUNCTIONALITY
// =====================================================

// Trips tabs switching
document.addEventListener('DOMContentLoaded', function() {
  const tripsTabButtons = document.querySelectorAll('.trips-tab-button');
  
  tripsTabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');
      
      // Update active state
      tripsTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--admin-text-muted)';
      });
      this.classList.add('active');
      this.style.borderBottomColor = 'var(--admin-primary)';
      this.style.color = 'var(--admin-text)';
      
      // Show/hide tab content
      document.getElementById('tripsTabTrips').hidden = (tab !== 'trips');
      document.getElementById('tripsTabBookings').hidden = (tab !== 'bookings');
      
      // Load data for the selected tab
      if (tab === 'bookings') {
        loadTripBookingsData();
      } else {
        loadTripsAdminData();
      }
    });
  });
  
  // Refresh button for trips
  const btnRefreshTrips = document.getElementById('btnRefreshTrips');
  if (btnRefreshTrips) {
    btnRefreshTrips.addEventListener('click', function() {
      const activeTab = document.querySelector('.trips-tab-button.active');
      if (activeTab) {
        const tab = activeTab.getAttribute('data-tab');
        if (tab === 'bookings') {
          loadTripBookingsData();
        } else {
          loadTripsAdminData();
        }
      }
    });
  }
});

// =====================================================
// HOTELS TABS FUNCTIONALITY
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
  const hotelsTabButtons = document.querySelectorAll('.hotels-tab-button');

  hotelsTabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');

      hotelsTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--admin-text-muted)';
      });
      this.classList.add('active');
      this.style.borderBottomColor = 'var(--admin-primary)';
      this.style.color = 'var(--admin-text)';

      document.getElementById('hotelsTabHotels').hidden = (tab !== 'hotels');
      document.getElementById('hotelsTabBookings').hidden = (tab !== 'bookings');

      if (tab === 'bookings') {
        loadHotelBookingsData();
      } else {
        loadHotelsAdminData();
      }
    });
  });

  const btnRefreshHotels = document.getElementById('btnRefreshHotels');
  if (btnRefreshHotels) {
    btnRefreshHotels.addEventListener('click', function() {
      const activeTab = document.querySelector('.hotels-tab-button.active');
      if (activeTab) {
        const tab = activeTab.getAttribute('data-tab');
        if (tab === 'bookings') {
          loadHotelBookingsData();
        } else {
          loadHotelsAdminData();
        }
      }
    });
  }
});

// =====================================================
// ALL ORDERS UNIFIED PANEL
// =====================================================

let allOrdersCache = [];
let filteredOrders = [];

function getAllOrdersNormalizedStatus(order) {
  if (!order) return '';
  const cat = String(order.category || '').trim();
  if (cat === 'cars' || cat === 'trips' || cat === 'hotels') {
    const fs = String(order.fulfillment_status || '').trim();
    if (!fs) return String(order.status || '').trim();
    if (fs === 'pending_acceptance') return 'pending';
    if (fs === 'awaiting_payment') return 'pending';
    if (fs === 'accepted') return 'confirmed';
    if (fs === 'rejected') return 'cancelled';
    if (fs === 'expired') return 'cancelled';
    if (fs === 'closed') return 'pending';
    return fs;
  }
  return String(order.status || '').trim();
}

function compareServiceFulfillmentRows(a, b) {
  const statusRank = (row) => {
    const s = String(row?.status || '').trim();
    if (s === 'accepted') return 50;
    if (s === 'awaiting_payment') return 40;
    if (s === 'pending_acceptance') return 30;
    if (s === 'rejected') return 20;
    if (s === 'expired') return 10;
    if (s === 'closed') return 1;
    if (!s) return 0;
    return 5;
  };

  const ra = statusRank(a);
  const rb = statusRank(b);
  if (ra !== rb) return ra - rb;

  const ta = Date.parse(a?.created_at || '') || 0;
  const tb = Date.parse(b?.created_at || '') || 0;
  if (ta !== tb) return ta - tb;

  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

function pickBestServiceFulfillment(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  let best = null;
  rows.forEach((r) => {
    if (!r) return;
    if (!best) {
      best = r;
      return;
    }
    if (compareServiceFulfillmentRows(r, best) > 0) best = r;
  });
  return best;
}

/**
 * Load all orders from car_bookings, trip_bookings, and hotel_bookings
 */
async function loadAllOrders(opts = {}) {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading all orders from all categories...');

    // Fetch all bookings in parallel
    const [carsResult, tripsResult, hotelsResult, shopResult] = await Promise.all([
      client.from('car_bookings').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('trip_bookings').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('hotel_bookings').select('*').order('created_at', { ascending: false }).limit(200),
      client
        .from('shop_orders')
        .select('id, order_number, created_at, total, currency, status, payment_status, customer_name, customer_email, customer_phone, shipping_address')
        .order('created_at', { ascending: false })
        .limit(200)
    ]);

    const carIds = (carsResult.data || []).map((b) => b && b.id).filter(Boolean);
    const tripIds = (tripsResult.data || []).map((b) => b && b.id).filter(Boolean);
    const hotelIds = (hotelsResult.data || []).map((b) => b && b.id).filter(Boolean);
    const serviceBookingIds = [...carIds, ...tripIds, ...hotelIds];

    const fulfillmentByKey = {};
    if (serviceBookingIds.length) {
      try {
        const { data: fData, error: fErr } = await client
          .from('partner_service_fulfillments')
          .select('id, resource_type, booking_id, status, partner_id, contact_revealed_at, rejected_reason, created_at')
          .in('resource_type', ['cars', 'trips', 'hotels'])
          .in('booking_id', serviceBookingIds)
          .order('created_at', { ascending: false })
          .limit(2000);
        if (!fErr && Array.isArray(fData)) {
          fData.forEach((f) => {
            const rt = String(f.resource_type || '').trim();
            const bid = String(f.booking_id || '').trim();
            if (!rt || !bid) return;
            const k = `${rt}:${bid}`;
            if (!fulfillmentByKey[k]) {
              fulfillmentByKey[k] = f;
              return;
            }
            if (compareServiceFulfillmentRows(f, fulfillmentByKey[k]) > 0) fulfillmentByKey[k] = f;
          });
        }
      } catch (_e) {
      }
    }

    // Process car bookings
    const carBookings = (carsResult.data || []).map(booking => {
      const f = fulfillmentByKey[`cars:${String(booking?.id || '')}`] || null;
      const priceMeta = getCarBookingEffectivePriceMeta(booking);
      return ({
      ...booking,
      category: 'cars',
      categoryLabel: 'Car Rental',
      categoryIcon: '🚗',
      categoryColor: '#3b82f6',
      // Map car booking fields to unified format
      customer_name: booking.full_name || booking.customer_name || 'N/A',
      customer_email: booking.email || booking.customer_email || '',
      customer_phone: booking.phone || booking.customer_phone || '',
      dropoff_date: booking.return_date || booking.dropoff_date,
      displayName: `${booking.car_model || booking.car_type || 'N/A'} - ${booking.pickup_location || 'N/A'}`,
      total_price: priceMeta.amount,
      pricing_source: priceMeta.source,
      coupon_code: priceMeta.couponCode || booking.coupon_code || '',
      viewFunction: 'viewCarBookingDetails',
      fulfillment_id: f ? f.id : null,
      fulfillment_status: f ? f.status : null,
    });
    });

    // Process trip bookings
    const tripBookings = (tripsResult.data || []).map(booking => {
      const f = fulfillmentByKey[`trips:${String(booking?.id || '')}`] || null;
      return ({
      ...booking,
      category: 'trips',
      categoryLabel: 'Trip',
      categoryIcon: '🎯',
      categoryColor: '#10b981',
      displayName: booking.trip_slug || 'N/A',
      viewFunction: 'viewTripBookingDetails',
      fulfillment_id: f ? f.id : null,
      fulfillment_status: f ? f.status : null,
    });
    });

    // Process hotel bookings
    const hotelBookings = (hotelsResult.data || []).map(booking => {
      const f = fulfillmentByKey[`hotels:${String(booking?.id || '')}`] || null;
      return ({
      ...booking,
      category: 'hotels',
      categoryLabel: 'Hotel',
      categoryIcon: '🏨',
      categoryColor: '#8b5cf6',
      displayName: booking.hotel_slug || 'N/A',
      viewFunction: 'viewHotelBookingDetails',
      fulfillment_id: f ? f.id : null,
      fulfillment_status: f ? f.status : null,
    });
    });

    // Process shop orders
    const shopOrders = (shopResult.data || []).map(order => ({
      ...order,
      category: 'shop',
      categoryLabel: 'Shop',
      categoryIcon: '🛍️',
      categoryColor: '#f97316',
      customer_name: order.customer_name || 'N/A',
      customer_email: order.customer_email || '',
      customer_phone: order.customer_phone || '',
      total_price: order.total,
      displayName: order.order_number || 'N/A',
      viewFunction: 'viewShopOrder'
    }));

    // Combine all orders
    allOrdersCache = [...carBookings, ...tripBookings, ...hotelBookings, ...shopOrders];

    // Sort: pending/confirmed first, then by created_at descending
    allOrdersCache.sort((a, b) => {
      const statusPriority = {
        pending: 1,
        confirmed: 2,
        processing: 3,
        shipped: 4,
        delivered: 5,
        completed: 6,
        on_hold: 7,
        refunded: 8,
        cancelled: 9,
        failed: 10
      };
      
      const aStatus = getAllOrdersNormalizedStatus(a);
      const bStatus = getAllOrdersNormalizedStatus(b);
      const aPriority = statusPriority[aStatus] || 99;
      const bPriority = statusPriority[bStatus] || 99;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same status, sort by created_at descending
      return new Date(b.created_at) - new Date(a.created_at);
    });

    console.log('All orders loaded:', allOrdersCache.length);

    // Update stats
    updateAllOrdersStats();

    // Apply filters and render
    applyOrderFilters();

    if (!opts || !opts.silent) {
      showToast(`Loaded ${allOrdersCache.length} orders successfully`, 'success');
    }

  } catch (error) {
    console.error('Failed to load all orders:', error);
    showToast('Failed to load orders: ' + (error.message || 'Unknown error'), 'error');
    
    const tableBody = $('#allOrdersTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="table-loading" style="color: var(--admin-danger);">
            ❌ Error loading orders: ${escapeHtml(error.message || 'Unknown error')}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Update statistics for all orders panel
 */
function updateAllOrdersStats() {
  const isPending = (o) => {
    const s = getAllOrdersNormalizedStatus(o);
    return s === 'pending';
  };
  const carsPending = allOrdersCache.filter(o => o.category === 'cars' && isPending(o)).length;
  const tripsPending = allOrdersCache.filter(o => o.category === 'trips' && isPending(o)).length;
  const hotelsPending = allOrdersCache.filter(o => o.category === 'hotels' && isPending(o)).length;
  const shopPending = allOrdersCache.filter(o => o.category === 'shop' && isPending(o)).length;
  const totalOrders = allOrdersCache.length;

  const statCarsPendingEl = $('#statCarsPending');
  const statTripsPendingEl = $('#statTripsPending');
  const statHotelsPendingEl = $('#statHotelsPending');
  const statShopPendingEl = $('#statShopPending');
  const statTotalOrdersEl = $('#statTotalOrders');

  if (statCarsPendingEl) statCarsPendingEl.textContent = carsPending;
  if (statTripsPendingEl) statTripsPendingEl.textContent = tripsPending;
  if (statHotelsPendingEl) statHotelsPendingEl.textContent = hotelsPending;
  if (statShopPendingEl) statShopPendingEl.textContent = shopPending;
  if (statTotalOrdersEl) statTotalOrdersEl.textContent = totalOrders;
}

/**
 * Apply filters to orders
 */
function applyOrderFilters() {
  const categoryFilter = $('#orderCategoryFilter')?.value || 'all';
  const statusFilter = $('#orderStatusFilter')?.value || 'all';

  filteredOrders = allOrdersCache.filter(order => {
    const matchCategory = categoryFilter === 'all' || order.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || getAllOrdersNormalizedStatus(order) === statusFilter;
    return matchCategory && matchStatus;
  });

  renderAllOrdersTable();
}

/**
 * Render the unified orders table
 */
function renderAllOrdersTable() {
  const tableBody = $('#allOrdersTableBody');
  if (!tableBody) return;

  if (filteredOrders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="table-loading">
          No orders found with current filters.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredOrders.map(order => {
    const effectiveStatus = getAllOrdersNormalizedStatus(order);
    const statusClass = 
      effectiveStatus === 'confirmed' ? 'badge-success' :
      effectiveStatus === 'completed' ? 'badge-success' :
      effectiveStatus === 'pending' ? 'badge-warning' :
      effectiveStatus === 'cancelled' ? 'badge-danger' : 'badge';

    // Format dates based on category
    let dateInfo = '';
    if (order.category === 'cars') {
      const pickup = order.pickup_date ? new Date(order.pickup_date).toLocaleDateString('en-GB') : 'N/A';
      const dropoff = order.dropoff_date ? new Date(order.dropoff_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `${pickup} → ${dropoff}`;
    } else if (order.category === 'trips') {
      const tripDate = order.trip_date ? new Date(order.trip_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `Trip: ${tripDate}`;
    } else if (order.category === 'hotels') {
      const checkin = order.arrival_date ? new Date(order.arrival_date).toLocaleDateString('en-GB') : 'N/A';
      const checkout = order.departure_date ? new Date(order.departure_date).toLocaleDateString('en-GB') : 'N/A';
      dateInfo = `${checkin} → ${checkout}`;
    }

    const createdAt = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : 'N/A';
    const createdTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

    const statusDetail = order.fulfillment_status && String(order.fulfillment_status || '') !== String(order.status || '')
      ? `<div style="font-size: 10px; color: var(--admin-text-muted); margin-top: 3px;">${escapeHtml(String(order.fulfillment_status))}</div>`
      : '';
    const priceMeta = order.category === 'cars'
      ? getCarBookingEffectivePriceMeta(order)
      : {
        amount: Number(order.total_price || order.quoted_price || order.final_price || 0),
        hasAmount: true,
        currency: 'EUR',
      };
    const priceText = Number.isFinite(priceMeta.amount) ? `€${Number(priceMeta.amount).toFixed(2)}` : '—';
    const couponHint = order.category === 'cars' && String(priceMeta.couponCode || '').trim()
      ? `<div style="font-size:10px; color:#2563eb; margin-top:2px;">Coupon ${escapeHtml(String(priceMeta.couponCode || '').trim().toUpperCase())}</div>`
      : '';

    return `
      <tr style="${effectiveStatus === 'completed' || effectiveStatus === 'cancelled' ? 'opacity: 0.6;' : ''}">
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">${order.categoryIcon}</span>
            <span style="font-size: 12px; font-weight: 600; color: ${order.categoryColor};">
              ${order.categoryLabel}
            </span>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; font-size: 13px;">#${order.id.slice(0, 8).toUpperCase()}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">
            ${escapeHtml(order.displayName)}
          </div>
        </td>
        <td>
          <div style="font-weight: 500; font-size: 13px;">${escapeHtml(order.customer_name || 'N/A')}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(order.customer_email || '')}</div>
          ${order.customer_phone ? `<div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(order.customer_phone)}</div>` : ''}
        </td>
        <td>
          <div style="font-size: 12px;">${dateInfo}</div>
          ${order.num_adults ? `<div style="font-size: 11px; color: var(--admin-text-muted); margin-top: 2px;">👥 ${order.num_adults}${order.num_children ? '+' + order.num_children : ''}</div>` : ''}
        </td>
        <td>
          <span class="badge ${statusClass}">
            ${(effectiveStatus || 'unknown').toUpperCase()}
          </span>
          ${statusDetail}
        </td>
        <td style="font-weight: 600; color: var(--admin-success); font-size: 14px;">
          ${priceText}
          ${couponHint}
        </td>
        <td>
          <div style="font-size: 12px;">${createdAt}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${createdTime}</div>
        </td>
        <td>
          <button class="btn-secondary" onclick="${order.viewFunction}('${order.id}')" title="View details" style="font-size: 13px; padding: 6px 12px;">
            View
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Update footer
  const footer = $('#allOrdersFooter');
  if (footer) {
    footer.innerHTML = `
      Showing ${filteredOrders.length} of ${allOrdersCache.length} total orders
    `;
  }
}

// Initialize All Orders Panel
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing All Orders panel...');

  // Load orders when dashboard view becomes active
  const dashboardView = document.getElementById('viewDashboard');
  if (dashboardView && !dashboardView.hidden) {
    // Load immediately if dashboard is already visible
    setTimeout(() => loadAllOrders(), 1000);
  }

  // Refresh button
  const btnRefresh = document.getElementById('btnRefreshAllOrders');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadAllOrders);
  }

  // Category filter
  const categoryFilter = document.getElementById('orderCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyOrderFilters);
  }

  // Status filter
  const statusFilter = document.getElementById('orderStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', applyOrderFilters);
  }
});

// Export functions to window for onclick handlers
window.loadAllOrders = loadAllOrders;

// =====================================================
// RECOMMENDATIONS MODULE
// =====================================================

let recommendationsCache = [];
let recommendationsCategories = [];
let currentRecommendation = null;
let recommendationFormMode = 'create';

// Load Recommendations Data
async function loadRecommendationsData() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    console.log('Loading recommendations data...');

    // Load categories first
    const { data: categories, error: catError } = await client
      .from('recommendation_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (catError) {
      console.error('Error loading categories:', catError);
      showToast('Failed to load categories', 'error');
      return;
    }

    recommendationsCategories = categories || [];
    console.log('Categories loaded:', recommendationsCategories.length);

    // Load recommendations
    const { data: recommendations, error } = await client
      .from('recommendations')
      .select('*, recommendation_categories(name_en, icon, color)')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading recommendations:', error);
      showToast('Failed to load recommendations', 'error');
      return;
    }

    recommendationsCache = recommendations || [];
    console.log('Recommendations loaded:', recommendationsCache.length);

    // Update UI
    updateRecommendationsStats();
    updateRecommendationsTable();
    populateCategoryFilters();

  } catch (error) {
    console.error('Error in loadRecommendationsData:', error);
    showToast('Failed to load recommendations data', 'error');
  }
}

// Update Stats
function updateRecommendationsStats() {
  const total = recommendationsCache.length;
  const active = recommendationsCache.filter(r => r.active).length;
  const totalViews = recommendationsCache.reduce((sum, r) => sum + (r.view_count || 0), 0);
  const totalClicks = recommendationsCache.reduce((sum, r) => sum + (r.click_count || 0), 0);

  $('#statTotalRecommendations').textContent = total;
  $('#statActiveRecommendations').textContent = active;
  $('#statTotalViews').textContent = totalViews.toLocaleString();
  $('#statTotalClicks').textContent = totalClicks.toLocaleString();
}

// Populate Category Filters
function populateCategoryFilters() {
  const select = $('#recommendationCategoryFilter');
  if (!select) return;

  // Clear and rebuild
  select.innerHTML = '<option value="">All Categories</option>';
  
  recommendationsCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = `${cat.name_pl || cat.name_en} / ${cat.name_en}`;
    select.appendChild(option);
  });
}

// Update Table
function updateRecommendationsTable() {
  const tbody = $('#recommendationsTableBody');
  if (!tbody) return;

  const searchTerm = $('#recommendationSearchInput')?.value.toLowerCase() || '';
  const categoryFilter = $('#recommendationCategoryFilter')?.value || '';
  const statusFilter = $('#recommendationStatusFilter')?.value || '';

  let filtered = recommendationsCache.filter(rec => {
    // Search filter
    if (searchTerm && !rec.title_pl?.toLowerCase().includes(searchTerm) && 
        !rec.title_en?.toLowerCase().includes(searchTerm) &&
        !rec.location_name?.toLowerCase().includes(searchTerm)) {
      return false;
    }

    // Category filter
    if (categoryFilter && rec.category_id !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'active' && !rec.active) return false;
    if (statusFilter === 'inactive' && rec.active) return false;
    if (statusFilter === 'featured' && !rec.featured) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No recommendations found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(rec => {
    const category = rec.recommendation_categories || {};
    const statusBadge = rec.active ? 
      '<span class="badge badge-success">Active</span>' : 
      '<span class="badge badge-secondary">Inactive</span>';
    const featuredBadge = rec.featured ? 
      '<span class="badge badge-warning" style="margin-left: 4px;">Featured</span>' : '';

    return `
      <tr>
        <td>
          ${rec.image_url ? 
            `<img src="${rec.image_url}" alt="${rec.title_en}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;">` : 
            '<div style="width: 60px; height: 60px; background: var(--admin-bg-secondary); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📍</div>'
          }
        </td>
        <td style="font-weight: 600;">${rec.display_order}</td>
        <td>
          <div style="font-weight: 600;">${rec.title_pl || rec.title_en || 'Untitled'}</div>
          <div style="font-size: 11px; color: var(--admin-text-secondary); margin-top: 2px;">${rec.title_en || ''}</div>
          <div style="font-size: 12px; color: var(--admin-text-muted); margin-top: 4px;">${rec.description_pl?.substring(0, 60) || rec.description_en?.substring(0, 60) || ''}${(rec.description_pl || rec.description_en)?.length > 60 ? '...' : ''}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">${category.icon || '📍'}</span>
            <div>
              <div>${category.name_pl || category.name_en || 'N/A'}</div>
              <div style="font-size: 11px; color: var(--admin-text-muted);">${category.name_en || ''}</div>
            </div>
          </div>
        </td>
        <td>${rec.location_name || 'N/A'}</td>
        <td>${rec.view_count || 0}</td>
        <td>${rec.click_count || 0}</td>
        <td>${rec.promo_code || '-'}</td>
        <td>${statusBadge}${featuredBadge}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-secondary" onclick="editRecommendation('${rec.id}')" title="Edit" style="font-size: 13px; padding: 4px 8px;">
              Edit
            </button>
            <button class="btn-danger" onclick="deleteRecommendation('${rec.id}')" title="Delete" style="font-size: 13px; padding: 4px 8px;">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Create Modal
async function openCreateRecommendationModal() {
  window.recommendationFormMode = 'create';
  currentRecommendation = null;
  
  console.log('🔵 Opening create modal, categories count:', recommendationsCategories.length);
  console.log('🔵 Categories:', recommendationsCategories);
  
  // Ensure categories are loaded
  if (recommendationsCategories.length === 0) {
    console.log('⚠️ Categories not loaded, loading now...');
    await loadRecommendationsData();
    console.log('✅ Categories loaded:', recommendationsCategories.length);
  }
  
  $('#recommendationFormTitle').textContent = 'New Recommendation';
  
  // Make sure recommendationsCategories is globally accessible for the form
  window.recommendationsCategories = recommendationsCategories;
  
  // Render i18n form
  const formContent = $('#recommendationFormContent');
  formContent.innerHTML = renderRecommendationI18nForm(null);
  
  showElement($('#recommendationFormModal'));
}

// Open Edit Modal
async function editRecommendation(id) {
  const rec = recommendationsCache.find(r => r.id === id);
  if (!rec) {
    showToast('Recommendation not found', 'error');
    return;
  }

  window.recommendationFormMode = 'edit';
  currentRecommendation = rec;
  
  console.log('🔵 Opening edit modal, categories count:', recommendationsCategories.length);
  
  // Ensure categories are loaded
  if (recommendationsCategories.length === 0) {
    console.log('⚠️ Categories not loaded, loading now...');
    await loadRecommendationsData();
    console.log('✅ Categories loaded:', recommendationsCategories.length);
  }
  
  $('#recommendationFormTitle').textContent = 'Edit Recommendation';
  
  // Make sure recommendationsCategories is globally accessible for the form
  window.recommendationsCategories = recommendationsCategories;
  
  // Render i18n form with data
  const formContent = $('#recommendationFormContent');
  formContent.innerHTML = renderRecommendationI18nForm(rec);
  
  showElement($('#recommendationFormModal'));
}

// Delete Recommendation
async function deleteRecommendation(id) {
  if (!confirm('Are you sure you want to delete this recommendation?')) {
    return;
  }

  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database connection not available', 'error');
      return;
    }

    const { error } = await client
      .from('recommendations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Recommendation deleted successfully', 'success');
    await loadRecommendationsData();

  } catch (error) {
    console.error('Error deleting recommendation:', error);
    showToast('Failed to delete recommendation: ' + error.message, 'error');
  }
}

// Initialize Recommendations Module
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing Recommendations module...');

  // Buttons
  const btnAdd = $('#btnAddRecommendation');
  if (btnAdd) {
    btnAdd.addEventListener('click', openCreateRecommendationModal);
  }

  const btnRefresh = $('#btnRefreshRecommendations');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadRecommendationsData);
  }

  const btnClose = $('#btnCloseRecommendationForm');
  if (btnClose) {
    btnClose.addEventListener('click', closeRecI18nForm);
  }

  // Modal overlay
  const overlay = $('#recommendationFormModalOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeRecI18nForm);
  }

  // Filters
  const searchInput = $('#recommendationSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', updateRecommendationsTable);
  }

  const categoryFilter = $('#recommendationCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', updateRecommendationsTable);
  }

  const statusFilter = $('#recommendationStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', updateRecommendationsTable);
  }
});

// Export functions
window.loadRecommendationsData = loadRecommendationsData;
window.editRecommendation = editRecommendation;
window.deleteRecommendation = deleteRecommendation;

// =====================================================
// REFERRAL SYSTEM ADMIN PANEL
// =====================================================

let referralsCache = [];
let referralUsersCache = {};
let referralCurrentPage = 1;
const REFERRALS_PER_PAGE = 20;

/**
 * Load referral XP settings
 */
async function loadReferralSettings() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', 'referral_xp')
      .single();

    if (data?.value?.amount) {
      const input = document.getElementById('referralXpAmount');
      if (input) input.value = data.value.amount;
    }
  } catch (e) {
    console.warn('Could not load referral settings:', e);
  }
}

/**
 * Save referral XP settings
 */
async function saveReferralXpSettings() {
  try {
    const client = ensureSupabase();
    if (!client) {
      showToast('Database not available', 'error');
      return;
    }

    const input = document.getElementById('referralXpAmount');
    const amount = parseInt(input?.value) || 100;

    const { error } = await client
      .from('app_settings')
      .update({ 
        value: { amount, bonus_for_referred: 0, auto_confirm: false },
        updated_at: new Date().toISOString()
      })
      .eq('key', 'referral_xp');

    if (error) throw error;
    showToast('Referral XP settings saved!', 'success');
  } catch (e) {
    console.error('Failed to save referral settings:', e);
    showToast('Failed to save settings: ' + e.message, 'error');
  }
}

/**
 * Load all referrals with user data
 */
async function loadReferralsData() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const tbody = document.getElementById('referralsTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading referrals...</td></tr>';

    // Load referrals
    const { data: referrals, error } = await client
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    referralsCache = referrals || [];

    // Get unique user IDs
    const userIds = new Set();
    referrals?.forEach(r => {
      if (r.referrer_id) userIds.add(r.referrer_id);
      if (r.referred_id) userIds.add(r.referred_id);
    });

    // Load user profiles
    if (userIds.size > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, username, email, name')
        .in('id', Array.from(userIds));

      referralUsersCache = {};
      profiles?.forEach(p => {
        referralUsersCache[p.id] = p;
      });
    }

    renderReferralsTable();
  } catch (e) {
    console.error('Failed to load referrals:', e);
    const tbody = document.getElementById('referralsTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-danger">Error loading referrals</td></tr>';
  }
}

/**
 * Render referrals table with pagination
 */
function renderReferralsTable() {
  const tbody = document.getElementById('referralsTable');
  if (!tbody) return;

  // Apply filters
  const searchTerm = document.getElementById('referralSearch')?.value?.toLowerCase() || '';
  const statusFilter = document.getElementById('referralStatusFilter')?.value || '';

  let filtered = referralsCache.filter(r => {
    const referrer = referralUsersCache[r.referrer_id];
    const referred = referralUsersCache[r.referred_id];
    
    const matchesSearch = !searchTerm || 
      referrer?.username?.toLowerCase().includes(searchTerm) ||
      referrer?.email?.toLowerCase().includes(searchTerm) ||
      referred?.username?.toLowerCase().includes(searchTerm) ||
      referred?.email?.toLowerCase().includes(searchTerm);
    
    const matchesStatus = !statusFilter || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / REFERRALS_PER_PAGE);
  const start = (referralCurrentPage - 1) * REFERRALS_PER_PAGE;
  const pageData = filtered.slice(start, start + REFERRALS_PER_PAGE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center">No referrals found</td></tr>';
  } else {
    tbody.innerHTML = pageData.map(r => {
      const referrer = referralUsersCache[r.referrer_id] || {};
      const referred = referralUsersCache[r.referred_id] || {};
      const statusClass = r.status === 'confirmed' ? 'status-active' : 
                         r.status === 'rejected' ? 'status-inactive' : 'status-pending';
      const statusIcon = r.status === 'confirmed' ? '✅' : 
                        r.status === 'rejected' ? '❌' : '⏳';
      
      return `
        <tr>
          <td>
            <strong>${referrer.username || 'Unknown'}</strong>
            <br><small class="text-muted">${referrer.email || ''}</small>
          </td>
          <td>
            <strong>${referred.username || 'Unknown'}</strong>
            <br><small class="text-muted">${referred.email || ''}</small>
          </td>
          <td>${new Date(r.created_at).toLocaleDateString('pl-PL')}</td>
          <td><span class="status-badge ${statusClass}">${statusIcon} ${r.status}</span></td>
          <td>${r.xp_awarded || 0} XP</td>
          <td>
            ${r.status === 'pending' ? `
              <button class="btn-action btn-success" onclick="confirmReferral('${r.id}')" title="Confirm">✓</button>
              <button class="btn-action btn-danger" onclick="rejectReferral('${r.id}')" title="Reject">✗</button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update pagination info
  const paginationInfo = document.getElementById('referralsPaginationInfo');
  if (paginationInfo) {
    paginationInfo.textContent = `Page ${referralCurrentPage} of ${totalPages || 1} (${filtered.length} total)`;
  }

  // Update pagination buttons
  const btnPrev = document.getElementById('btnReferralsPrev');
  const btnNext = document.getElementById('btnReferralsNext');
  if (btnPrev) btnPrev.disabled = referralCurrentPage <= 1;
  if (btnNext) btnNext.disabled = referralCurrentPage >= totalPages;
}

/**
 * Confirm a referral and award XP
 */
async function confirmReferral(referralId) {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { data, error } = await client.rpc('confirm_referral', { referral_id: referralId });
    
    if (error) throw error;
    
    if (data?.success) {
      showToast(`Referral confirmed! ${data.xp_awarded} XP awarded`, 'success');
    } else {
      showToast(data?.error || 'Failed to confirm', 'error');
    }
    
    await loadReferralsData();
    await loadReferralStats();
  } catch (e) {
    console.error('Failed to confirm referral:', e);
    showToast('Error confirming referral: ' + e.message, 'error');
  }
}
window.confirmReferral = confirmReferral;

/**
 * Reject a referral
 */
async function rejectReferral(referralId) {
  if (!confirm('Are you sure you want to reject this referral?')) return;
  
  try {
    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client
      .from('referrals')
      .update({ status: 'rejected' })
      .eq('id', referralId);
    
    if (error) throw error;
    showToast('Referral rejected', 'success');
    await loadReferralsData();
  } catch (e) {
    console.error('Failed to reject referral:', e);
    showToast('Error rejecting referral: ' + e.message, 'error');
  }
}
window.rejectReferral = rejectReferral;

/**
 * Load referral statistics
 */
async function loadReferralStats() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    // Load stats from view
    const { data: stats } = await client
      .from('referral_stats')
      .select('*')
      .single();

    if (stats) {
      document.getElementById('statTotalReferrals').textContent = stats.total_referrals || 0;
      document.getElementById('statConfirmedReferrals').textContent = stats.confirmed_referrals || 0;
      document.getElementById('statPendingReferrals').textContent = stats.pending_referrals || 0;
      document.getElementById('statTotalXpAwarded').textContent = (stats.total_xp_awarded || 0).toLocaleString();
      document.getElementById('statUniqueReferrers').textContent = stats.unique_referrers || 0;
    }

    // Load top referrers
    const { data: topReferrers } = await client
      .from('top_referrers')
      .select('*')
      .limit(10);

    const topTable = document.getElementById('topReferrersTable');
    if (topTable) {
      if (!topReferrers?.length) {
        topTable.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center">No referrers yet</td></tr>';
      } else {
        topTable.innerHTML = topReferrers.map((r, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>
              <strong>${r.username || r.display_name || 'Unknown'}</strong>
            </td>
            <td>${r.referral_count || 0}</td>
            <td>${(r.total_xp_from_referrals || 0).toLocaleString()} XP</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Failed to load referral stats:', e);
  }
}

/**
 * Build and render referral tree with expand/collapse functionality
 * Uses both profiles and referrals tables for accuracy
 */
let referralTreeData = []; // Store tree data for expand/collapse all

async function loadReferralTree() {
  try {
    const client = ensureSupabase();
    if (!client) return;

    const container = document.getElementById('referralTreeContainer');
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Loading referral tree data...</p>';

    // 1. Get all profiles
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('id, username, name, email, created_at, avatar_url');

    if (profilesError) throw profilesError;

    // 2. Get all referral relationships
    const { data: referrals, error: referralsError } = await client
      .from('referrals')
      .select('referrer_id, referred_id, created_at, status');

    if (referralsError) throw referralsError;

    if (!profiles?.length) {
      container.innerHTML = '<p class="text-muted">No profiles found</p>';
      return;
    }

    // Map profiles by ID for easy lookup
    const profileMap = {};
    profiles.forEach(p => { 
      profileMap[p.id] = { 
        ...p, 
        children: [],
        expanded: false,
        is_referrer: false,
        referral_status: null, // Status of being referred
        referral_date: null    // When they were referred
      }; 
    });

    // Build tree using referrals table
    const referredIds = new Set(); // Track who has been referred

    if (referrals?.length) {
      referrals.forEach(ref => {
        const referrer = profileMap[ref.referrer_id];
        const referred = profileMap[ref.referred_id];

        if (referrer && referred) {
          // Add to parent's children
          referrer.children.push(referred);
          referrer.is_referrer = true;
          
          // Mark child details
          referred.referral_status = ref.status;
          referred.referral_date = ref.created_at;
          
          // Mark as referred so we don't add to root later
          referredIds.add(ref.referred_id);
        }
      });
    }

    // Identify root users (those who have referrals but were not referred themselves)
    // OR anyone who has referrals, even if they were referred (they will appear in tree)
    // BUT for the top level list, we only want those who started the chain OR are isolated
    
    // Correction: We want to show the full forest.
    // Roots are users who are NOT in referredIds.
    // But we only care about roots that have children (referrers) to avoid cluttering with single users?
    // User request: "wyswietlali sie uzytkownicy zaproszeni przez innego uzytkownika".
    // Showing everyone might be too much. Let's show users who have children (referrers) AND are not referred by anyone in the current set.
    // OR just show everyone who is a root of a referral tree.

    let rootUsers = [];
    
    Object.values(profileMap).forEach(p => {
      // If user is not referred by anyone (is a root) AND has children
      if (!referredIds.has(p.id) && p.children.length > 0) {
        rootUsers.push(p);
      }
    });

    // Fallback: If user has children but IS referred, they are shown under their parent.
    // But what if the parent is missing? (shouldn't happen with profileMap)
    
    // If no roots found but we have referrals (circular or broken?), just show top referrers
    if (rootUsers.length === 0 && referrals?.length > 0) {
      // Fallback to sorting by children count
      rootUsers = Object.values(profileMap)
        .filter(p => p.children.length > 0)
        .sort((a, b) => b.children.length - a.children.length);
    } else {
       // Sort roots by children count desc
       rootUsers.sort((a, b) => b.children.length - a.children.length);
    }

    // Store for expand/collapse all
    referralTreeData = rootUsers;

    // Render function
    function renderTree() {
      if (rootUsers.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
            <p class="text-muted mb-2">No referral connections found.</p>
            <small class="text-secondary">Referrals table is empty or no relationships detected.</small>
          </div>`;
        return;
      }
      container.innerHTML = rootUsers.map(r => renderNode(r, 0)).join('');
      attachTreeListeners();
    }

    // Render single node
    function renderNode(node, level = 0) {
      const hasChildren = node.children?.length > 0;
      const childCount = node.children.length;
      
      // Toggle icon
      const toggleIcon = hasChildren 
        ? `<span class="tree-toggle-icon">${node.expanded ? '−' : '+'}</span>` 
        : '';
      
      // Status badge
      const statusBadge = node.referral_status 
        ? `<span class="status-dot status-${node.referral_status}" title="${node.referral_status}"></span>` 
        : '';

      // Format date
      const dateStr = node.referral_date || node.created_at;
      const dateDisplay = dateStr 
        ? new Date(dateStr).toLocaleDateString('pl-PL') 
        : '';
      
      // Avatar or placeholder
      const avatarHtml = node.avatar_url 
        ? `<img src="${node.avatar_url}" class="tree-avatar" alt="av" onerror="this.src='https://ui-avatars.com/api/?name=${node.username}&background=random'"/>`
        : `<div class="tree-avatar-placeholder">${(node.username || '?').charAt(0).toUpperCase()}</div>`;

      let html = `
        <div class="tree-item" data-node-id="${node.id}" data-level="${level}">
          <div class="tree-row ${hasChildren ? 'tree-row-parent' : ''} ${level === 0 ? 'tree-row-root' : ''}" 
               style="padding-left: ${level * 24 + 12}px;">
            
            <div class="tree-connector">
               <span class="tree-toggle ${hasChildren ? 'tree-toggle-active' : ''}" data-toggle-id="${node.id}">
                 ${toggleIcon}
               </span>
            </div>

            <div class="tree-content">
              <div class="tree-user-card">
                ${avatarHtml}
                <div class="tree-user-details">
                  <div class="tree-user-header">
                    <strong class="tree-username">${node.username || node.name || 'Unknown'}</strong>
                    ${statusBadge}
                    ${childCount > 0 ? `<span class="badge-referrals">${childCount} refs</span>` : ''}
                  </div>
                  <div class="tree-user-meta">
                    <span class="tree-email">${node.email || 'No email'}</span>
                    <span class="tree-date">• ${dateDisplay}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tree-children-container" data-children-of="${node.id}" 
               style="display: ${node.expanded ? 'block' : 'none'};">
            ${hasChildren && node.expanded ? node.children.map(child => renderNode(child, level + 1)).join('') : ''}
          </div>
        </div>
      `;
      
      return html;
    }

    // Attach click listeners
    function attachTreeListeners() {
      // Toggle buttons
      container.querySelectorAll('.tree-toggle-active').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
          e.stopPropagation();
          const nodeId = this.getAttribute('data-toggle-id');
          toggleNode(nodeId);
        });
      });
      
      // Row clicks
      container.querySelectorAll('.tree-row-parent').forEach(row => {
        row.addEventListener('click', function(e) {
          if (e.target.closest('.tree-toggle')) return; // Don't double trigger
          const item = this.closest('.tree-item');
          const nodeId = item?.getAttribute('data-node-id');
          if (nodeId) toggleNode(nodeId);
        });
      });
    }

    // Toggle node expand/collapse
    function toggleNode(nodeId) {
      const node = findNode(rootUsers, nodeId);
      if (!node || !node.children?.length) return;
      
      node.expanded = !node.expanded;
      
      // Update DOM
      const childrenContainer = container.querySelector(`[data-children-of="${nodeId}"]`);
      const toggleEl = container.querySelector(`[data-toggle-id="${nodeId}"] .tree-toggle-icon`);
      
      if (childrenContainer) {
        if (node.expanded) {
          // Render children
          childrenContainer.innerHTML = node.children.map(child => {
            const level = parseInt(childrenContainer.closest('.tree-item').getAttribute('data-level')) + 1;
            return renderNode(child, level);
          }).join('');
          childrenContainer.style.display = 'block';
          if (toggleEl) toggleEl.textContent = '−';
          attachTreeListeners(); // Re-attach for new elements
        } else {
          childrenContainer.style.display = 'none';
          if (toggleEl) toggleEl.textContent = '+';
        }
      }
    }

    // Find node helper
    function findNode(nodes, id) {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    // Expand/Collapse All helpers
    window.expandAllTreeNodes = function() {
      const setExpanded = (nodes, state) => {
        nodes.forEach(n => {
          if (n.children.length) {
            n.expanded = state;
            setExpanded(n.children, state);
          }
        });
      };
      setExpanded(rootUsers, true);
      renderTree();
    };

    window.collapseAllTreeNodes = function() {
      const setExpanded = (nodes, state) => {
        nodes.forEach(n => {
          n.expanded = state;
          if (n.children.length) setExpanded(n.children, state);
        });
      };
      setExpanded(rootUsers, false);
      renderTree();
    };
    
    // Search helper
    window.searchInTree = function(query) {
      if (!query?.trim()) {
        renderTree();
        return;
      }
      query = query.toLowerCase().trim();
      
      // Reset all expanded first? No, keep context.
      
      let foundAny = false;
      // Recursive search and expand path
      const searchAndExpand = (nodes) => {
        let hasMatch = false;
        nodes.forEach(node => {
          const match = (node.username || '').toLowerCase().includes(query) || 
                        (node.email || '').toLowerCase().includes(query);
          
          let childMatch = false;
          if (node.children.length) {
            childMatch = searchAndExpand(node.children);
          }
          
          if (match || childMatch) {
            node.expanded = true; // Expand if self matches or child matches
            hasMatch = true;
            foundAny = true;
          }
        });
        return hasMatch;
      };
      
      searchAndExpand(rootUsers);
      renderTree();
      
      // Highlight
      setTimeout(() => {
        container.querySelectorAll('.tree-username').forEach(el => {
          if (el.textContent.toLowerCase().includes(query)) {
             el.closest('.tree-user-card').classList.add('highlight-match');
          }
        });
      }, 50);
    };

    // Initial render
    renderTree();

    // Re-bind buttons
    const btnExpandAll = document.getElementById('btnExpandAll');
    const btnCollapseAll = document.getElementById('btnCollapseAll');
    const treeSearch = document.getElementById('treeSearch');
    
    if (btnExpandAll) btnExpandAll.onclick = () => window.expandAllTreeNodes();
    if (btnCollapseAll) btnCollapseAll.onclick = () => window.collapseAllTreeNodes();
    if (treeSearch) {
      let t;
      treeSearch.oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(() => window.searchInTree(e.target.value), 300);
      };
    }

  } catch (e) {
    console.error('Failed to load referral tree:', e);
    const container = document.getElementById('referralTreeContainer');
    if (container) container.innerHTML = `<p class="text-danger">Error loading tree: ${e.message}</p>`;
  }
}

// Initialize referrals tab handling
document.addEventListener('DOMContentLoaded', () => {
  // Referral tab switching
  const referralTabs = document.querySelectorAll('#referralTabs .admin-tab');
  referralTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      // Update tab buttons
      referralTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Show/hide content
      document.getElementById('tabReferralSettings').hidden = (tabName !== 'referralSettings');
      document.getElementById('tabReferralList').hidden = (tabName !== 'referralList');
      document.getElementById('tabReferralTree').hidden = (tabName !== 'referralTree');
      document.getElementById('tabReferralStats').hidden = (tabName !== 'referralStats');
      
      // Load data for tab
      if (tabName === 'referralList') loadReferralsData();
      if (tabName === 'referralTree') loadReferralTree();
      if (tabName === 'referralStats') loadReferralStats();
      if (tabName === 'referralSettings') loadReferralSettings();
    });
  });

  // Save XP button
  const btnSaveXp = document.getElementById('btnSaveReferralXp');
  if (btnSaveXp) {
    btnSaveXp.addEventListener('click', saveReferralXpSettings);
  }

  // Refresh button
  const btnRefresh = document.getElementById('btnRefreshReferrals');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadReferralsData);
  }

  // Search and filter
  const referralSearch = document.getElementById('referralSearch');
  if (referralSearch) {
    referralSearch.addEventListener('input', () => {
      referralCurrentPage = 1;
      renderReferralsTable();
    });
  }

  const statusFilter = document.getElementById('referralStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      referralCurrentPage = 1;
      renderReferralsTable();
    });
  }

  // Pagination
  const btnPrev = document.getElementById('btnReferralsPrev');
  const btnNext = document.getElementById('btnReferralsNext');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (referralCurrentPage > 1) {
        referralCurrentPage--;
        renderReferralsTable();
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      referralCurrentPage++;
      renderReferralsTable();
    });
  }

  // Tree controls
  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');
  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      document.querySelectorAll('.tree-node').forEach(n => n.style.display = 'flex');
    });
  }
  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      document.querySelectorAll('.tree-node').forEach((n, i) => {
        if (i > 0) n.style.display = 'none';
      });
    });
  }
});

// Load referrals when view becomes active
window.loadReferralsPanel = function() {
  loadReferralSettings();
  loadReferralsData();
  loadReferralStats();
};

// Export
window.loadReferralSettings = loadReferralSettings;
window.loadReferralsData = loadReferralsData;
window.loadReferralStats = loadReferralStats;
window.loadReferralTree = loadReferralTree;

// =====================================================
// XP CONTROL MODULE
// =====================================================

let xpControlState = {
  rules: [],
  config: {},
  historyPage: 0,
  historyLimit: 50,
  historyData: [],
};

// Load all XP Control data
async function loadXpControlData() {
  console.log('📊 Loading XP Control data...');
  
  try {
    // Load in parallel
    await Promise.all([
      loadXpStatistics(),
      loadXpRules(),
      loadXpConfig(),
    ]);
    
    // Setup tab switching
    setupXpTabs();
    
    // Setup event listeners
    setupXpEventListeners();
    
    console.log('✅ XP Control data loaded');
  } catch (error) {
    console.error('❌ Failed to load XP Control data:', error);
    showToast('Failed to load XP Control data', 'error');
  }
}

// Load XP statistics
async function loadXpStatistics() {
  const client = ensureSupabase();
  if (!client) return;
  
  try {
    // Get basic stats from profiles
    const { data: profiles, error } = await client
      .from('profiles')
      .select('xp, level')
      .gt('xp', 0);
    
    if (error) throw error;
    
    const totalXp = profiles?.reduce((sum, p) => sum + (p.xp || 0), 0) || 0;
    const usersWithXp = profiles?.length || 0;
    const avgXp = usersWithXp > 0 ? Math.round(totalXp / usersWithXp) : 0;
    const maxLevel = profiles?.reduce((max, p) => Math.max(max, p.level || 0), 0) || 0;
    
    // Update UI
    const statTotalXp = document.getElementById('statTotalXp');
    const statUsersWithXp = document.getElementById('statUsersWithXp');
    const statAvgXp = document.getElementById('statAvgXp');
    const statMaxLevel = document.getElementById('statMaxLevel');
    
    if (statTotalXp) statTotalXp.textContent = totalXp.toLocaleString();
    if (statUsersWithXp) statUsersWithXp.textContent = usersWithXp.toLocaleString();
    if (statAvgXp) statAvgXp.textContent = avgXp.toLocaleString();
    if (statMaxLevel) statMaxLevel.textContent = maxLevel;
    
  } catch (error) {
    console.error('Failed to load XP statistics:', error);
  }
}

// Load XP rules from xp_rules table
async function loadXpRules() {
  const client = ensureSupabase();
  if (!client) return;
  
  try {
    const { data: rules, error } = await client
      .from('xp_rules')
      .select('*')
      .order('event_key');
    
    if (error) throw error;
    
    xpControlState.rules = rules || [];
    renderXpRulesTable();
    
  } catch (error) {
    console.error('Failed to load XP rules:', error);
    const tbody = document.getElementById('xpRulesTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load rules: ${error.message}</td></tr>`;
    }
  }
}

// Render XP rules table
function renderXpRulesTable() {
  const tbody = document.getElementById('xpRulesTableBody');
  if (!tbody) return;
  
  if (!xpControlState.rules.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--admin-text-muted);">No XP rules found. Add your first rule!</td></tr>`;
    return;
  }
  
  tbody.innerHTML = xpControlState.rules.map(rule => `
    <tr data-event-key="${rule.event_key}">
      <td><code style="background: var(--admin-bg-tertiary); padding: 2px 6px; border-radius: 4px;">${escapeHtml(rule.event_key)}</code></td>
      <td><strong style="color: var(--admin-accent);">+${rule.xp_delta}</strong> XP</td>
      <td><span class="badge badge-${getCategoryColor(rule.category)}">${escapeHtml(rule.category || 'general')}</span></td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(rule.description || '-')}</td>
      <td>${rule.is_active !== false ? '<span style="color: #22c55e;">✓ Active</span>' : '<span style="color: #6b7280;">Inactive</span>'}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn-small btn-secondary" onclick="editXpRule('${escapeHtml(rule.event_key)}')">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteXpRule('${escapeHtml(rule.event_key)}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getCategoryColor(category) {
  const colors = {
    'poi': 'blue',
    'task': 'green',
    'social': 'purple',
    'daily': 'orange',
    'general': 'gray'
  };
  return colors[category] || 'gray';
}

// Load XP config
async function loadXpConfig() {
  const client = ensureSupabase();
  if (!client) return;
  
  try {
    const { data: config, error } = await client
      .from('xp_config')
      .select('*');
    
    if (error) {
      // Table might not exist yet - that's OK
      console.warn('xp_config table not found or empty. Run XP_CONTROL_SETUP.sql first.');
      return;
    }
    
    // Convert to object
    xpControlState.config = {};
    config?.forEach(item => {
      xpControlState.config[item.key] = item.value;
    });
    
    // Update form fields
    updateXpConfigForm();
    updateLevelPreview();
    
  } catch (error) {
    console.error('Failed to load XP config:', error);
  }
}

// Update config form with loaded values
function updateXpConfigForm() {
  const formula = xpControlState.config.level_formula;
  const maxLevel = xpControlState.config.max_level;
  const multiplier = xpControlState.config.xp_multiplier;
  
  if (formula) {
    const formulaType = document.getElementById('xpFormulaType');
    const divisor = document.getElementById('xpDivisor');
    if (formulaType && formula.type) formulaType.value = formula.type;
    if (divisor && formula.divisor) divisor.value = formula.divisor;
  }
  
  if (maxLevel) {
    const maxLevelInput = document.getElementById('xpMaxLevel');
    if (maxLevelInput) maxLevelInput.value = maxLevel;
  }
  
  if (multiplier) {
    const multiplierInput = document.getElementById('xpMultiplier');
    if (multiplierInput) multiplierInput.value = multiplier;
  }
}

// Update level preview grid
function updateLevelPreview() {
  const grid = document.getElementById('levelPreviewGrid');
  if (!grid) return;
  
  const divisor = parseInt(document.getElementById('xpDivisor')?.value) || 1000;
  
  let html = '';
  for (let level = 0; level <= 20; level++) {
    const xpNeeded = level * divisor;
    html += `
      <div style="background: var(--admin-bg-tertiary); padding: 8px 12px; border-radius: 6px; text-align: center;">
        <div style="font-weight: 600; color: var(--admin-accent);">Level ${level}</div>
        <div style="font-size: 12px; color: var(--admin-text-muted);">${xpNeeded.toLocaleString()} XP</div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

// Setup XP tabs
function setupXpTabs() {
  const tabs = document.querySelectorAll('[data-xp-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      const tabName = tab.dataset.xpTab;
      document.querySelectorAll('.admin-tab-content').forEach(content => {
        if (content.id === `xpTab${tabName.charAt(0).toUpperCase()}${tabName.slice(1)}`) {
          content.classList.add('active');
          content.hidden = false;
        } else if (content.id.startsWith('xpTab')) {
          content.classList.remove('active');
          content.hidden = true;
        }
      });
      
      // Load tab-specific data
      if (tabName === 'history') {
        loadXpHistory();
      } else if (tabName === 'config') {
        updateLevelPreview();
      }
    });
  });
}

// Setup event listeners
function setupXpEventListeners() {
  // Add rule button
  const btnAddRule = document.getElementById('btnAddXpRule');
  if (btnAddRule) {
    btnAddRule.addEventListener('click', () => showXpRuleModal());
  }
  
  // Save config button
  const btnSaveConfig = document.getElementById('btnSaveXpConfig');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', saveXpConfig);
  }
  
  // Formula type change - update preview
  const formulaType = document.getElementById('xpFormulaType');
  if (formulaType) {
    formulaType.addEventListener('change', updateLevelPreview);
  }
  
  // Divisor change - update preview
  const divisor = document.getElementById('xpDivisor');
  if (divisor) {
    divisor.addEventListener('input', updateLevelPreview);
  }
  
  // User search
  const btnSearchUser = document.getElementById('btnSearchXpUser');
  const searchInput = document.getElementById('xpUserSearch');
  if (btnSearchUser) {
    btnSearchUser.addEventListener('click', searchXpUsers);
  }
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchXpUsers();
    });
  }
  
  // History refresh
  const btnRefreshHistory = document.getElementById('btnRefreshXpHistory');
  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', () => {
      xpControlState.historyPage = 0;
      loadXpHistory();
    });
  }
  
  // Load more history
  const btnLoadMore = document.getElementById('btnLoadMoreXpHistory');
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      xpControlState.historyPage++;
      loadXpHistory(true);
    });
  }
  
  // History filter
  const historyFilter = document.getElementById('xpHistoryFilter');
  if (historyFilter) {
    historyFilter.addEventListener('change', () => {
      xpControlState.historyPage = 0;
      loadXpHistory();
    });
  }
}

// Show XP rule modal (add/edit)
function showXpRuleModal(eventKey = null) {
  const rule = eventKey ? xpControlState.rules.find(r => r.event_key === eventKey) : null;
  const isEdit = !!rule;
  
  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.id = 'xpRuleModal';
  modal.innerHTML = `
    <div class="admin-modal-overlay" onclick="closeXpRuleModal()"></div>
    <div class="admin-modal-content" style="max-width: 500px;">
      <header class="admin-modal-header">
        <h3>${isEdit ? 'Edit XP Rule' : 'Add XP Rule'}</h3>
        <button class="btn-modal-close" onclick="closeXpRuleModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>
      <div class="admin-modal-body">
        <form id="xpRuleForm">
          <label class="admin-form-field">
            <span>Event Key *</span>
            <input type="text" id="ruleEventKey" class="form-control" value="${escapeHtml(rule?.event_key || '')}" ${isEdit ? 'readonly' : ''} placeholder="e.g. complete_quest, upload_photo" required>
            <small style="color: var(--admin-text-muted);">Unique identifier for this action</small>
          </label>
          
          <label class="admin-form-field">
            <span>XP Amount *</span>
            <input type="number" id="ruleXpDelta" class="form-control" value="${rule?.xp_delta || 10}" min="1" max="10000" required>
          </label>
          
          <label class="admin-form-field">
            <span>Category</span>
            <select id="ruleCategory" class="form-control">
              <option value="general" ${rule?.category === 'general' ? 'selected' : ''}>General</option>
              <option value="poi" ${rule?.category === 'poi' ? 'selected' : ''}>POI</option>
              <option value="task" ${rule?.category === 'task' ? 'selected' : ''}>Task</option>
              <option value="social" ${rule?.category === 'social' ? 'selected' : ''}>Social</option>
              <option value="daily" ${rule?.category === 'daily' ? 'selected' : ''}>Daily</option>
            </select>
          </label>
          
          <label class="admin-form-field">
            <span>Description</span>
            <input type="text" id="ruleDescription" class="form-control" value="${escapeHtml(rule?.description || '')}" placeholder="Brief description of this reward">
          </label>
          
          <label class="admin-form-field" style="flex-direction: row; align-items: center; gap: 8px;">
            <input type="checkbox" id="ruleIsActive" ${rule?.is_active !== false ? 'checked' : ''}>
            <span>Active</span>
          </label>
          
          <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button type="submit" class="btn-primary">${isEdit ? 'Save Changes' : 'Add Rule'}</button>
            <button type="button" class="btn-secondary" onclick="closeXpRuleModal()">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.hidden = false;
  
  // Form submit handler
  document.getElementById('xpRuleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveXpRule();
  });
}

// Close XP rule modal
function closeXpRuleModal() {
  const modal = document.getElementById('xpRuleModal');
  if (modal) modal.remove();
}
window.closeXpRuleModal = closeXpRuleModal;

// Save XP rule
async function saveXpRule() {
  const client = ensureSupabase();
  if (!client) return;
  
  const eventKey = document.getElementById('ruleEventKey').value.trim();
  const xpDelta = parseInt(document.getElementById('ruleXpDelta').value);
  const category = document.getElementById('ruleCategory').value;
  const description = document.getElementById('ruleDescription').value.trim();
  const isActive = document.getElementById('ruleIsActive').checked;
  
  if (!eventKey || !xpDelta) {
    showToast('Please fill in required fields', 'error');
    return;
  }
  
  try {
    // Try to use admin function first
    const { data, error } = await client.rpc('admin_update_xp_rule', {
      p_event_key: eventKey,
      p_xp_delta: xpDelta,
      p_description: description || null,
      p_category: category,
      p_is_active: isActive
    });
    
    if (error) {
      // Fallback to direct upsert
      const { error: upsertError } = await client
        .from('xp_rules')
        .upsert({
          event_key: eventKey,
          xp_delta: xpDelta,
          description: description || null,
          category: category,
          is_active: isActive,
          updated_at: new Date().toISOString()
        }, { onConflict: 'event_key' });
      
      if (upsertError) throw upsertError;
    }
    
    showToast('XP rule saved successfully', 'success');
    closeXpRuleModal();
    await loadXpRules();
    
  } catch (error) {
    console.error('Failed to save XP rule:', error);
    showToast(`Failed to save rule: ${error.message}`, 'error');
  }
}

// Edit XP rule
function editXpRule(eventKey) {
  showXpRuleModal(eventKey);
}
window.editXpRule = editXpRule;

// Delete XP rule
async function deleteXpRule(eventKey) {
  if (!confirm(`Delete XP rule "${eventKey}"? This cannot be undone.`)) return;
  
  const client = ensureSupabase();
  if (!client) return;
  
  try {
    const { error } = await client
      .from('xp_rules')
      .delete()
      .eq('event_key', eventKey);
    
    if (error) throw error;
    
    showToast('XP rule deleted', 'success');
    await loadXpRules();
    
  } catch (error) {
    console.error('Failed to delete XP rule:', error);
    showToast(`Failed to delete rule: ${error.message}`, 'error');
  }
}
window.deleteXpRule = deleteXpRule;

// Save XP config
async function saveXpConfig() {
  const client = ensureSupabase();
  if (!client) return;
  
  const formulaType = document.getElementById('xpFormulaType').value;
  const divisor = parseInt(document.getElementById('xpDivisor').value);
  const maxLevel = parseInt(document.getElementById('xpMaxLevel').value);
  const multiplier = parseFloat(document.getElementById('xpMultiplier').value);
  
  try {
    // Save each config value
    const configs = [
      { key: 'level_formula', value: { type: formulaType, divisor: divisor } },
      { key: 'max_level', value: maxLevel },
      { key: 'xp_multiplier', value: multiplier }
    ];
    
    for (const config of configs) {
      const { error } = await client
        .from('xp_config')
        .upsert({
          key: config.key,
          value: config.value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) throw error;
    }
    
    showToast('XP configuration saved', 'success');
    await loadXpConfig();
    
  } catch (error) {
    console.error('Failed to save XP config:', error);
    showToast(`Failed to save config: ${error.message}. Make sure to run XP_CONTROL_SETUP.sql first.`, 'error');
  }
}

// Search users for XP management
async function searchXpUsers() {
  const client = ensureSupabase();
  if (!client) return;
  
  const searchTerm = document.getElementById('xpUserSearch').value.trim();
  if (!searchTerm) {
    showToast('Enter a search term', 'warning');
    return;
  }
  
  const tbody = document.getElementById('xpUsersTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Searching...</td></tr>';
  
  try {
    const { data: users, error } = await client
      .from('profiles')
      .select('id, name, email, xp, level')
      .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      .limit(50);
    
    if (error) throw error;
    
    if (!users?.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--admin-text-muted);">No users found</td></tr>';
      return;
    }
    
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>${escapeHtml(user.name || 'Unknown')}</td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td><strong>${user.xp || 0}</strong></td>
        <td>${user.level || 0}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-small btn-primary" onclick="showAdjustXpModal('${user.id}', '${escapeHtml(user.name || user.email)}', ${user.xp || 0})">Adjust XP</button>
          </div>
        </td>
      </tr>
    `).join('');
    
  } catch (error) {
    console.error('Failed to search users:', error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

// Show adjust XP modal
function showAdjustXpModal(userId, userName, currentXp) {
  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.id = 'adjustXpModal';
  modal.innerHTML = `
    <div class="admin-modal-overlay" onclick="closeAdjustXpModal()"></div>
    <div class="admin-modal-content" style="max-width: 400px;">
      <header class="admin-modal-header">
        <h3>Adjust XP for ${escapeHtml(userName)}</h3>
        <button class="btn-modal-close" onclick="closeAdjustXpModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </header>
      <div class="admin-modal-body">
        <p style="margin-bottom: 16px;">Current XP: <strong>${currentXp}</strong></p>
        
        <label class="admin-form-field">
          <span>XP Change</span>
          <input type="number" id="adjustXpAmount" class="form-control" placeholder="+100 or -50" required>
          <small style="color: var(--admin-text-muted);">Use positive number to add, negative to subtract</small>
        </label>
        
        <label class="admin-form-field">
          <span>Reason</span>
          <input type="text" id="adjustXpReason" class="form-control" placeholder="e.g. Bug fix, bonus reward" required>
        </label>
        
        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button class="btn-primary" onclick="confirmAdjustXp('${userId}')">Apply Change</button>
          <button class="btn-secondary" onclick="closeAdjustXpModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.hidden = false;
}
window.showAdjustXpModal = showAdjustXpModal;

// Close adjust XP modal
function closeAdjustXpModal() {
  const modal = document.getElementById('adjustXpModal');
  if (modal) modal.remove();
}
window.closeAdjustXpModal = closeAdjustXpModal;

// Confirm XP adjustment
async function confirmAdjustXp(userId) {
  const client = ensureSupabase();
  if (!client) return;
  
  const amount = parseInt(document.getElementById('adjustXpAmount').value);
  const reason = document.getElementById('adjustXpReason').value.trim();
  
  if (!amount || !reason) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  try {
    // Use admin_adjust_user_xp function
    const { data, error } = await client.rpc('admin_adjust_user_xp', {
      target_user_id: userId,
      xp_change: amount,
      reason: reason
    });
    
    if (error) {
      // Try alternative function signature
      const { error: altError } = await client.rpc('admin_adjust_user_xp', {
        target_user_id: userId,
        delta: amount
      });
      
      if (altError) throw altError;
    }
    
    showToast(`XP adjusted by ${amount > 0 ? '+' : ''}${amount}`, 'success');
    closeAdjustXpModal();
    searchXpUsers(); // Refresh search results
    
  } catch (error) {
    console.error('Failed to adjust XP:', error);
    showToast(`Failed to adjust XP: ${error.message}`, 'error');
  }
}
window.confirmAdjustXp = confirmAdjustXp;

// Load XP history
async function loadXpHistory(append = false) {
  const client = ensureSupabase();
  if (!client) return;
  
  const tbody = document.getElementById('xpHistoryTableBody');
  if (!append) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';
  }
  
  const filter = document.getElementById('xpHistoryFilter')?.value || 'all';
  
  try {
    // First, get XP events (without join)
    let query = client
      .from('user_xp_events')
      .select('id, user_id, xp_delta, reason, created_at')
      .order('created_at', { ascending: false })
      .range(
        xpControlState.historyPage * xpControlState.historyLimit,
        (xpControlState.historyPage + 1) * xpControlState.historyLimit - 1
      );
    
    // Apply filter
    if (filter === 'poi') {
      query = query.ilike('reason', '%poi%');
    } else if (filter === 'task') {
      query = query.ilike('reason', '%task%');
    } else if (filter === 'admin') {
      query = query.ilike('reason', '%admin%');
    }
    
    const { data: events, error } = await query;
    
    if (error) throw error;
    
    // Get unique user IDs
    const userIds = [...new Set((events || []).map(e => e.user_id).filter(Boolean))];
    
    // Fetch profiles for those users
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p; });
      }
    }
    
    // Merge profile data into events
    const eventsWithProfiles = (events || []).map(event => ({
      ...event,
      profiles: profilesMap[event.user_id] || null
    }));
    
    if (!append) {
      xpControlState.historyData = eventsWithProfiles;
    } else {
      xpControlState.historyData = [...xpControlState.historyData, ...eventsWithProfiles];
    }
    
    renderXpHistory();
    
  } catch (error) {
    console.error('Failed to load XP history:', error);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

// Render XP history
function renderXpHistory() {
  const tbody = document.getElementById('xpHistoryTableBody');
  if (!tbody) return;
  
  if (!xpControlState.historyData.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--admin-text-muted);">No XP events found</td></tr>';
    return;
  }
  
  tbody.innerHTML = xpControlState.historyData.map(event => {
    const date = new Date(event.created_at).toLocaleString();
    const userName = event.profiles?.name || event.profiles?.email || event.user_id.substring(0, 8);
    const xpClass = event.xp_delta >= 0 ? 'color: #22c55e;' : 'color: #ef4444;';
    
    return `
      <tr>
        <td style="white-space: nowrap;">${date}</td>
        <td>${escapeHtml(userName)}</td>
        <td style="${xpClass} font-weight: 600;">${event.xp_delta >= 0 ? '+' : ''}${event.xp_delta}</td>
        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(event.reason || '-')}</td>
      </tr>
    `;
  }).join('');
}

// Export XP Control functions
window.loadXpControlData = loadXpControlData;

// =====================================================
// SHOP MANAGEMENT
// =====================================================

const shopState = {
  orders: [],
  products: [],
  categories: [],
  vendors: [],
  discounts: [],
  shippingZones: [],
  settings: null,
  currentTab: 'orders'
};

async function loadShopData() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    // Load shop stats
    await loadShopStats();
    
    // Load data for current tab
    await loadShopTabData(shopState.currentTab);
    
    // Setup tab listeners
    setupShopTabs();
    
  } catch (error) {
    console.error('Failed to load shop data:', error);
    showToast('Failed to load shop data', 'error');
  }
}

async function loadShopStats() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    // Total revenue (completed orders)
    const { data: revenueData } = await client
      .from('shop_orders')
      .select('total')
      .in('payment_status', ['paid', 'partially_refunded']);
    
    const totalRevenue = revenueData?.reduce((sum, o) => sum + parseFloat(o.total || 0), 0) || 0;
    const revenueEl = document.getElementById('shopStatRevenue');
    if (revenueEl) revenueEl.textContent = `€${totalRevenue.toFixed(2)}`;

    // Total orders
    const { count: ordersCount } = await client
      .from('shop_orders')
      .select('*', { count: 'exact', head: true });
    
    const ordersEl = document.getElementById('shopStatOrders');
    if (ordersEl) ordersEl.textContent = ordersCount || 0;

    // Active products
    const { count: productsCount } = await client
      .from('shop_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    const productsEl = document.getElementById('shopStatProducts');
    if (productsEl) productsEl.textContent = productsCount || 0;

    // Pending orders
    const { count: pendingCount } = await client
      .from('shop_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed', 'processing']);
    
    const pendingEl = document.getElementById('shopStatPending');
    if (pendingEl) pendingEl.textContent = pendingCount || 0;

  } catch (error) {
    console.error('Failed to load shop stats:', error);
  }
}

function setupShopTabs() {
  const tabs = document.querySelectorAll('[data-shop-tab]');
  tabs.forEach(tab => {
    tab.onclick = () => {
      const tabName = tab.dataset.shopTab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide tab content
      document.querySelectorAll('#viewShop .admin-tab-content').forEach(content => {
        content.hidden = true;
        content.classList.remove('active');
      });
      
      const tabContent = document.getElementById(`shopTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (tabContent) {
        tabContent.hidden = false;
        tabContent.classList.add('active');
      }
      
      shopState.currentTab = tabName;
      loadShopTabData(tabName);
    };
  });

  // Setup other event listeners
  const refreshBtn = document.getElementById('btnRefreshShopOrders');
  if (refreshBtn) refreshBtn.onclick = () => loadShopOrders();

  const orderFilter = document.getElementById('shopOrderStatusFilter');
  if (orderFilter) orderFilter.onchange = () => loadShopOrders();

  const addProductBtn = document.getElementById('btnAddShopProduct');
  if (addProductBtn) addProductBtn.onclick = () => showProductForm();

  const addCategoryBtn = document.getElementById('btnAddShopCategory');
  if (addCategoryBtn) addCategoryBtn.onclick = () => showCategoryForm();

  const addVendorBtn = document.getElementById('btnAddShopVendor');
  if (addVendorBtn) addVendorBtn.onclick = () => showVendorForm();

  const addDiscountBtn = document.getElementById('btnAddShopDiscount');
  if (addDiscountBtn) addDiscountBtn.onclick = () => showDiscountForm();

  const settingsForm = document.getElementById('shopSettingsForm');
  if (settingsForm) settingsForm.onsubmit = (e) => { e.preventDefault(); saveShopSettings(); };
}

async function loadShopTabData(tabName) {
  switch (tabName) {
    case 'orders':
      await loadShopOrders();
      break;
    case 'products':
      await loadShopProducts();
      break;
    case 'categories':
      await loadShopCategories();
      break;
    case 'vendors':
      await loadShopVendors();
      break;
    case 'discounts':
      await loadShopDiscounts();
      break;
    case 'shipping':
      await loadShopShipping();
      break;
    case 'settings':
      await loadShopSettings();
      break;
  }
}

async function loadShopOrders() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('shopOrdersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading...</td></tr>';

  try {
    let query = client
      .from('shop_orders')
      .select(`
        *,
        items:shop_order_items(count)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    const statusFilter = document.getElementById('shopOrderStatusFilter')?.value;
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    shopState.orders = orders || [];

    if (!orders?.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--admin-text-muted);">No orders found</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const statusColors = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        processing: '#8b5cf6',
        shipped: '#06b6d4',
        delivered: '#10b981',
        completed: '#22c55e',
        cancelled: '#6b7280',
        refunded: '#ef4444',
        failed: '#dc2626'
      };
      const paymentColors = {
        unpaid: '#f59e0b',
        pending: '#f59e0b',
        paid: '#22c55e',
        partially_refunded: '#f97316',
        refunded: '#ef4444',
        failed: '#dc2626'
      };

      const partnerStatus = (order.partner_acceptance_status || 'none');
      const partnerLabel = partnerStatus === 'pending'
        ? '⏳ pending'
        : partnerStatus === 'accepted'
          ? '✅ accepted'
          : partnerStatus === 'rejected'
            ? '❌ rejected'
            : '—';
      const partnerColors = {
        none: '#6b7280',
        pending: '#f59e0b',
        accepted: '#22c55e',
        rejected: '#ef4444'
      };

      return `
        <tr>
          <td><strong>${escapeHtml(order.order_number)}</strong></td>
          <td>
            <div>${escapeHtml(order.customer_name)}</div>
            <small style="color: var(--admin-text-muted);">${escapeHtml(order.customer_email)}</small>
          </td>
          <td>${order.items?.[0]?.count || 0}</td>
          <td><strong>€${parseFloat(order.total).toFixed(2)}</strong></td>
          <td><span class="badge" style="background: ${statusColors[order.status] || '#6b7280'};">${order.status}</span></td>
          <td><span class="badge" style="background: ${paymentColors[order.payment_status] || '#6b7280'};">${order.payment_status}</span></td>
          <td><span class="badge" style="background: ${partnerColors[partnerStatus] || '#6b7280'};">${partnerLabel}</span></td>
          <td>${new Date(order.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn-small btn-secondary" onclick="viewShopOrder('${order.id}')">View</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load orders:', error);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function loadShopProducts() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('shopProductsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Loading...</td></tr>';

  try {
    const { data: products, error } = await client
      .from('shop_products')
      .select('*, category:shop_categories(name), vendor:shop_vendors(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    shopState.products = products || [];

    if (!products?.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--admin-text-muted);">No products yet. Add your first product!</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(product => {
      const thumbnail = product.thumbnail_url || product.images?.[0]?.url || '';
      const statusColors = { active: '#22c55e', draft: '#f59e0b', archived: '#6b7280' };

      return `
        <tr>
          <td>
            ${thumbnail ? `<img src="${thumbnail}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 50px; height: 50px; background: var(--admin-border); border-radius: 4px;"></div>'}
          </td>
          <td>
            <strong>${escapeHtml(product.name)}</strong>
            ${product.is_featured ? '<span class="badge" style="background: #f59e0b; margin-left: 8px;">Featured</span>' : ''}
          </td>
          <td>${escapeHtml(product.sku || '-')}</td>
          <td><strong>€${parseFloat(product.price).toFixed(2)}</strong></td>
          <td>${product.track_inventory ? product.stock_quantity : '∞'}</td>
          <td>${escapeHtml(product.category?.name || '-')}</td>
          <td><span class="badge" style="background: ${statusColors[product.status]};">${product.status}</span></td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-small btn-secondary" onclick="editShopProduct('${product.id}')">Edit</button>
              <button class="btn-small" style="background: #ef4444; color: white;" onclick="deleteShopProduct('${product.id}', '${escapeHtml(product.name).replace(/'/g, "\\'")}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load products:', error);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function loadShopCategories() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('shopCategoriesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Ładowanie...</td></tr>';

  try {
    const { data: categories, error } = await client
      .from('shop_categories')
      .select('*, parent:shop_categories!parent_id(name)')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    shopState.categories = categories || [];
    renderShopCategories();

  } catch (error) {
    console.error('Failed to load categories:', error);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444;">Błąd: ${error.message}</td></tr>`;
  }
}

function renderShopCategories() {
  const tbody = document.getElementById('shopCategoriesTableBody');
  if (!tbody) return;

  // Get filter values
  const searchTerm = (document.getElementById('shopCategorySearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('shopCategoryStatusFilter')?.value || 'all';
  const parentFilter = document.getElementById('shopCategoryParentFilter')?.value || 'all';

  let filtered = shopState.categories || [];

  // Apply search filter
  if (searchTerm) {
    filtered = filtered.filter(cat => 
      cat.name?.toLowerCase().includes(searchTerm) ||
      cat.name_en?.toLowerCase().includes(searchTerm) ||
      cat.slug?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply status filter
  if (statusFilter === 'active') {
    filtered = filtered.filter(cat => cat.is_active);
  } else if (statusFilter === 'inactive') {
    filtered = filtered.filter(cat => !cat.is_active);
  }

  // Apply parent filter
  if (parentFilter === 'root') {
    filtered = filtered.filter(cat => !cat.parent_id);
  } else if (parentFilter === 'child') {
    filtered = filtered.filter(cat => cat.parent_id);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--admin-text-muted);">Brak kategorii</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(cat => `
    <tr>
      <td>
        ${cat.image_url 
          ? `<img src="${cat.image_url}" alt="" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px;">` 
          : `<div style="width: 40px; height: 40px; background: var(--admin-bg-tertiary); border-radius: 6px; display: flex; align-items: center; justify-content: center;">📁</div>`}
      </td>
      <td>
        <strong>${escapeHtml(cat.name)}</strong>
        ${cat.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(cat.name_en)}</small>` : ''}
      </td>
      <td><code style="font-size: 11px; background: var(--admin-bg-tertiary); padding: 2px 6px; border-radius: 4px;">${escapeHtml(cat.slug)}</code></td>
      <td>${cat.parent?.name ? `<span style="color: var(--admin-text-muted);">↳</span> ${escapeHtml(cat.parent.name)}` : '<span style="color: var(--admin-text-muted);">—</span>'}</td>
      <td style="text-align: center;">${cat.product_count || 0}</td>
      <td style="text-align: center;">${cat.sort_order || 0}</td>
      <td>
        <span class="badge" style="background: ${cat.is_active ? '#22c55e' : '#6b7280'}; font-size: 11px;">${cat.is_active ? 'Aktywna' : 'Ukryta'}</span>
      </td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn-icon" onclick="editShopCategory('${cat.id}')" title="Edytuj">✏️</button>
          <button class="btn-icon" onclick="deleteShopCategory('${cat.id}', '${escapeHtml(cat.name).replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadShopVendors() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('shopVendorsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Ładowanie...</td></tr>';

  try {
    const { data: vendors, error } = await client
      .from('shop_vendors')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    shopState.vendors = vendors || [];
    renderShopVendors();

  } catch (error) {
    console.error('Failed to load vendors:', error);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444;">Błąd: ${error.message}</td></tr>`;
  }
}

function renderShopVendors() {
  const tbody = document.getElementById('shopVendorsTableBody');
  if (!tbody) return;

  // Get filter values
  const searchTerm = (document.getElementById('shopVendorSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('shopVendorStatusFilter')?.value || 'all';

  let filtered = shopState.vendors || [];

  // Apply search filter
  if (searchTerm) {
    filtered = filtered.filter(vendor => 
      vendor.name?.toLowerCase().includes(searchTerm) ||
      vendor.name_en?.toLowerCase().includes(searchTerm) ||
      vendor.contact_email?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply status filter
  if (statusFilter === 'active') {
    filtered = filtered.filter(vendor => vendor.is_active);
  } else if (statusFilter === 'inactive') {
    filtered = filtered.filter(vendor => !vendor.is_active);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--admin-text-muted);">Brak dostawców</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(vendor => `
    <tr>
      <td>
        ${vendor.logo_url 
          ? `<img src="${vendor.logo_url}" alt="" style="width: 40px; height: 40px; object-fit: contain; border-radius: 6px; background: white;">` 
          : `<div style="width: 40px; height: 40px; background: var(--admin-bg-tertiary); border-radius: 6px; display: flex; align-items: center; justify-content: center;">🏪</div>`}
      </td>
      <td>
        <strong>${escapeHtml(vendor.name)}</strong>
        ${vendor.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(vendor.name_en)}</small>` : ''}
      </td>
      <td>${vendor.contact_email ? `<a href="mailto:${vendor.contact_email}" style="color: var(--admin-primary);">${escapeHtml(vendor.contact_email)}</a>` : '<span style="color: var(--admin-text-muted);">—</span>'}</td>
      <td style="text-align: center;">${vendor.total_products || 0}</td>
      <td style="text-align: center;">${vendor.total_sales || 0}</td>
      <td style="text-align: right;"><strong>€${parseFloat(vendor.total_revenue || 0).toFixed(2)}</strong></td>
      <td style="text-align: center;">${vendor.commission_rate || 0}%</td>
      <td>
        <span class="badge" style="background: ${vendor.is_active ? '#22c55e' : '#6b7280'}; font-size: 11px;">${vendor.is_active ? 'Aktywny' : 'Nieaktywny'}</span>
      </td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn-icon" onclick="editShopVendor('${vendor.id}')" title="Edytuj">✏️</button>
          <button class="btn-icon" onclick="deleteShopVendor('${vendor.id}', '${escapeHtml(vendor.name).replace(/'/g, "\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadShopDiscounts() {
  const client = ensureSupabase();
  if (!client) return;

  const tbody = document.getElementById('shopDiscountsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Ładowanie...</td></tr>';

  try {
    const { data: discounts, error } = await client
      .from('shop_discounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    shopState.discounts = discounts || [];
    renderShopDiscounts();

  } catch (error) {
    console.error('Failed to load discounts:', error);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444;">Błąd: ${error.message}</td></tr>`;
  }
}

function renderShopDiscounts() {
  const tbody = document.getElementById('shopDiscountsTableBody');
  if (!tbody) return;

  // Get filter values
  const searchTerm = (document.getElementById('shopDiscountSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('shopDiscountTypeFilter')?.value || 'all';
  const statusFilter = document.getElementById('shopDiscountStatusFilter')?.value || 'all';

  const now = new Date();
  let filtered = shopState.discounts || [];

  // Apply search filter
  if (searchTerm) {
    filtered = filtered.filter(d => 
      d.code?.toLowerCase().includes(searchTerm) ||
      d.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply type filter
  if (typeFilter !== 'all') {
    filtered = filtered.filter(d => d.discount_type === typeFilter);
  }

  // Apply status filter
  if (statusFilter === 'active') {
    filtered = filtered.filter(d => d.is_active && !(d.expires_at && new Date(d.expires_at) < now));
  } else if (statusFilter === 'inactive') {
    filtered = filtered.filter(d => !d.is_active);
  } else if (statusFilter === 'expired') {
    filtered = filtered.filter(d => d.expires_at && new Date(d.expires_at) < now);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--admin-text-muted);">Brak kodów rabatowych</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(discount => {
    const isExpired = discount.expires_at && new Date(discount.expires_at) < now;
    const isLimitReached = discount.usage_limit && discount.usage_count >= discount.usage_limit;
    
    let valueDisplay, typeLabel;
    switch(discount.discount_type) {
      case 'percentage':
        valueDisplay = `<strong style="color: #22c55e;">${discount.discount_value}%</strong>`;
        typeLabel = 'Procentowy';
        break;
      case 'fixed':
        valueDisplay = `<strong style="color: #22c55e;">€${parseFloat(discount.discount_value).toFixed(2)}</strong>`;
        typeLabel = 'Kwotowy';
        break;
      case 'free_shipping':
        valueDisplay = '<span style="color: #3b82f6;">🚚 Gratis</span>';
        typeLabel = 'Darmowa wysyłka';
        break;
      default:
        valueDisplay = discount.discount_value;
        typeLabel = discount.discount_type;
    }
    
    let statusBadge;
    if (!discount.is_active) {
      statusBadge = '<span class="badge" style="background: #6b7280; font-size: 11px;">Nieaktywny</span>';
    } else if (isExpired) {
      statusBadge = '<span class="badge" style="background: #ef4444; font-size: 11px;">Wygasł</span>';
    } else if (isLimitReached) {
      statusBadge = '<span class="badge" style="background: #f59e0b; font-size: 11px;">Limit</span>';
    } else {
      statusBadge = '<span class="badge" style="background: #22c55e; font-size: 11px;">Aktywny</span>';
    }
    
    const validityDisplay = discount.starts_at || discount.expires_at
      ? `${discount.starts_at ? new Date(discount.starts_at).toLocaleDateString('pl') : '—'} → ${discount.expires_at ? new Date(discount.expires_at).toLocaleDateString('pl') : '∞'}`
      : '<span style="color: var(--admin-text-muted);">Bezterminowy</span>';
    
    return `
      <tr style="${isExpired || isLimitReached ? 'opacity: 0.6;' : ''}">
        <td><code style="font-size: 12px; background: var(--admin-bg-tertiary); padding: 3px 8px; border-radius: 4px; font-weight: bold;">${escapeHtml(discount.code)}</code></td>
        <td>
          ${discount.description ? `<strong>${escapeHtml(discount.description)}</strong>` : '<span style="color: var(--admin-text-muted);">—</span>'}
          ${discount.description_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(discount.description_en)}</small>` : ''}
        </td>
        <td>${typeLabel}</td>
        <td style="text-align: center;">${valueDisplay}</td>
        <td style="text-align: center;">${discount.usage_count || 0}${discount.usage_limit ? `<span style="color: var(--admin-text-muted);">/${discount.usage_limit}</span>` : ''}</td>
        <td style="text-align: right;">${discount.minimum_order_amount ? `€${parseFloat(discount.minimum_order_amount).toFixed(2)}` : '<span style="color: var(--admin-text-muted);">—</span>'}</td>
        <td style="font-size: 11px;">${validityDisplay}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" onclick="editShopDiscount('${discount.id}')" title="Edytuj">✏️</button>
            <button class="btn-icon" onclick="deleteShopDiscount('${discount.id}', '${escapeHtml(discount.code).replace(/'/g, "\\'")}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadShopShipping() {
  const client = ensureSupabase();
  if (!client) return;

  const container = document.getElementById('shopShippingZonesContainer');
  if (!container) return;
  container.innerHTML = '<p style="text-align: center;">Loading...</p>';

  try {
    const { data: zones, error } = await client
      .from('shop_shipping_zones')
      .select('*, methods:shop_shipping_methods(*)')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    shopState.shippingZones = zones || [];

    if (!zones?.length) {
      container.innerHTML = '<p style="text-align: center; color: var(--admin-text-muted);">No shipping zones configured</p>';
      return;
    }

    container.innerHTML = zones.map(zone => `
      <div class="admin-card" style="margin-bottom: 16px;">
        <div class="admin-card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="margin: 0;">${escapeHtml(zone.name)} ${zone.name_en ? `(${escapeHtml(zone.name_en)})` : ''}</h4>
            <p style="color: var(--admin-text-muted); margin: 4px 0 0; font-size: 12px;">Kraje: ${zone.countries?.join(', ') || 'Brak'}</p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="badge" style="background: ${zone.is_active ? '#22c55e' : '#6b7280'};">${zone.is_active ? 'AKTYWNA' : 'NIEAKTYWNA'}</span>
            <button class="btn-icon" onclick="showShippingZoneForm('${zone.id}')" title="Edytuj strefę">✏️</button>
            <button class="btn-icon" onclick="deleteShippingZone('${zone.id}')" title="Usuń strefę">🗑️</button>
          </div>
        </div>
        <div class="admin-card-body">
          ${zone.methods?.length ? `
            <table class="admin-table" style="margin-bottom: 12px;">
              <thead>
                <tr>
                  <th>Metoda</th>
                  <th>Typ</th>
                  <th>Koszt</th>
                  <th>Darmowa od</th>
                  <th>Dostawa</th>
                  <th>Status</th>
                  <th style="width: 100px;">Akcje</th>
                </tr>
              </thead>
              <tbody>
                ${zone.methods.sort((a, b) => a.sort_order - b.sort_order).map(method => `
                  <tr>
                    <td><strong>${escapeHtml(method.name)}</strong>${method.description ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(method.description)}</small>` : ''}</td>
                    <td>${getMethodTypeLabel(method.method_type)}</td>
                    <td>€${parseFloat(method.cost || 0).toFixed(2)}${method.cost_per_kg ? ` + €${method.cost_per_kg}/kg` : ''}${method.cost_per_item ? ` + €${method.cost_per_item}/szt` : ''}</td>
                    <td>${method.free_shipping_threshold ? `€${parseFloat(method.free_shipping_threshold).toFixed(2)}` : '-'}</td>
                    <td>${method.min_delivery_days || '?'}-${method.max_delivery_days || '?'} dni</td>
                    <td>${method.is_active ? '<span style="color: #22c55e;">✅ Aktywna</span>' : '<span style="color: #6b7280;">❌ Nieaktywna</span>'}</td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn-icon" onclick="showShippingMethodForm('${zone.id}', '${method.id}')" title="Edytuj">✏️</button>
                        <button class="btn-icon" onclick="deleteShippingMethod('${method.id}')" title="Usuń">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: var(--admin-text-muted); margin-bottom: 12px;">Brak metod dostawy dla tej strefy</p>'}
          <button class="btn-secondary" onclick="showShippingMethodForm('${zone.id}')" style="margin-top: 8px;">
            ➕ Dodaj metodę dostawy
          </button>
        </div>
      </div>
    `).join('');

    // Also load shipping extras (classes, tax, etc.)
    loadShopShippingExtras();

  } catch (error) {
    console.error('Failed to load shipping:', error);
    container.innerHTML = `<p style="text-align: center; color: #ef4444;">Error: ${error.message}</p>`;
  }
}

function getMethodTypeLabel(type) {
  const labels = {
    'flat_rate': 'Stała stawka',
    'free': 'Darmowa',
    'per_weight': 'Wg wagi',
    'per_item': 'Za produkt'
  };
  return labels[type] || type;
}

// =====================================================
// SHIPPING ZONE CRUD
// =====================================================

async function showShippingZoneForm(zoneId = null) {
  const modal = document.getElementById('shopShippingZoneModal');
  const form = document.getElementById('shopShippingZoneForm');
  const title = document.getElementById('shopShippingZoneModalTitle');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('shippingZoneId').value = '';
  document.getElementById('shippingZoneFormError').hidden = true;

  if (zoneId) {
    title.textContent = 'Edytuj strefę wysyłki';
    await loadShippingZoneData(zoneId);
  } else {
    title.textContent = 'Nowa strefa wysyłki';
    document.getElementById('shippingZoneActive').checked = true;
  }

  modal.hidden = false;
  setupShippingZoneFormListeners();
}
window.showShippingZoneForm = showShippingZoneForm;

async function loadShippingZoneData(zoneId) {
  const client = ensureSupabase();
  if (!client) return;
  try {
    const { data: zone, error } = await client.from('shop_shipping_zones').select('*').eq('id', zoneId).single();
    if (error) throw error;
    document.getElementById('shippingZoneId').value = zone.id;
    document.getElementById('shippingZoneName').value = zone.name || '';
    document.getElementById('shippingZoneNameEn').value = zone.name_en || '';
    document.getElementById('shippingZoneCountries').value = (zone.countries || []).join(', ');
    document.getElementById('shippingZoneSortOrder').value = zone.sort_order || 0;
    document.getElementById('shippingZoneActive').checked = zone.is_active !== false;
  } catch (error) {
    console.error('Failed to load zone:', error);
    showToast('Nie udało się załadować strefy', 'error');
  }
}

function setupShippingZoneFormListeners() {
  const modal = document.getElementById('shopShippingZoneModal');
  const form = document.getElementById('shopShippingZoneForm');
  const closeBtn = document.getElementById('btnCloseShopShippingZoneModal');
  const cancelBtn = document.getElementById('shippingZoneFormCancel');
  const overlay = document.getElementById('shopShippingZoneModalOverlay');
  const closeModal = () => { modal.hidden = true; };
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;
  form.onsubmit = async (e) => { e.preventDefault(); await saveShippingZone(); };
}

async function saveShippingZone() {
  const client = ensureSupabase();
  if (!client) return;
  const errorEl = document.getElementById('shippingZoneFormError');
  errorEl.hidden = true;
  const zoneId = document.getElementById('shippingZoneId').value;
  const name = document.getElementById('shippingZoneName').value.trim();
  const countriesStr = document.getElementById('shippingZoneCountries').value.trim();
  if (!name || !countriesStr) {
    errorEl.textContent = 'Nazwa i kraje są wymagane';
    errorEl.hidden = false;
    return;
  }
  const countries = countriesStr.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const zoneData = {
    name,
    name_en: document.getElementById('shippingZoneNameEn').value.trim() || null,
    countries,
    sort_order: parseInt(document.getElementById('shippingZoneSortOrder').value) || 0,
    is_active: document.getElementById('shippingZoneActive').checked
  };
  try {
    let error;
    if (zoneId) {
      ({ error } = await client.from('shop_shipping_zones').update(zoneData).eq('id', zoneId));
    } else {
      ({ error } = await client.from('shop_shipping_zones').insert(zoneData));
    }
    if (error) throw error;
    showToast(zoneId ? 'Strefa zaktualizowana' : 'Strefa dodana', 'success');
    document.getElementById('shopShippingZoneModal').hidden = true;
    await loadShopShipping();
  } catch (error) {
    console.error('Failed to save zone:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteShippingZone(zoneId) {
  if (!confirm('Czy na pewno chcesz usunąć tę strefę? Wszystkie metody dostawy w tej strefie zostaną usunięte.')) return;
  const client = ensureSupabase();
  if (!client) return;
  try {
    const { error } = await client.from('shop_shipping_zones').delete().eq('id', zoneId);
    if (error) throw error;
    showToast('Strefa usunięta', 'success');
    await loadShopShipping();
  } catch (error) {
    console.error('Failed to delete zone:', error);
    showToast('Nie udało się usunąć strefy: ' + error.message, 'error');
  }
}
window.deleteShippingZone = deleteShippingZone;

// =====================================================
// SHIPPING CLASSES, TAX CLASSES, CUSTOMER GROUPS, ATTRIBUTES
// =====================================================

async function loadShopShippingExtras() {
  await Promise.all([
    loadShippingClasses(),
    loadTaxClasses(),
    loadCustomerGroups(),
    loadAttributes()
  ]);
}

// --- SHIPPING CLASSES ---
async function loadShippingClasses() {
  const client = ensureSupabase();
  if (!client) return;
  const tbody = document.getElementById('shopShippingClassesTableBody');
  if (!tbody) return;
  try {
    const { data: classes, error } = await client.from('shop_shipping_classes').select('*').order('sort_order');
    if (error) throw error;
    if (!classes?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--admin-text-muted);">Brak klas wysyłkowych</td></tr>';
      return;
    }
    tbody.innerHTML = classes.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong>${c.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(c.name_en)}</small>` : ''}</td>
        <td>€${parseFloat(c.extra_cost || 0).toFixed(2)}</td>
        <td>€${parseFloat(c.extra_cost_per_kg || 0).toFixed(2)}</td>
        <td>€${parseFloat(c.handling_fee || 0).toFixed(2)}</td>
        <td>${c.requires_signature ? '✍️' : ''} ${c.requires_insurance ? '🛡️' : ''}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" onclick="showShippingClassForm('${c.id}')" title="Edytuj">✏️</button>
            <button class="btn-icon" onclick="deleteShippingClass('${c.id}')" title="Usuń">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load shipping classes:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function showShippingClassForm(classId = null) {
  const modal = document.getElementById('shopShippingClassModal');
  const form = document.getElementById('shopShippingClassForm');
  const title = document.getElementById('shopShippingClassModalTitle');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('shippingClassId').value = '';
  document.getElementById('shippingClassFormError').hidden = true;
  if (classId) {
    title.textContent = 'Edytuj klasę wysyłkową';
    const client = ensureSupabase();
    const { data } = await client.from('shop_shipping_classes').select('*').eq('id', classId).single();
    if (data) {
      document.getElementById('shippingClassId').value = data.id;
      document.getElementById('shippingClassName').value = data.name || '';
      document.getElementById('shippingClassNameEn').value = data.name_en || '';
      document.getElementById('shippingClassDescription').value = data.description || '';
      document.getElementById('shippingClassExtraCost').value = data.extra_cost || 0;
      document.getElementById('shippingClassCostPerKg').value = data.extra_cost_per_kg || 0;
      document.getElementById('shippingClassHandlingFee').value = data.handling_fee || 0;
      document.getElementById('shippingClassRequiresSignature').checked = data.requires_signature || false;
      document.getElementById('shippingClassRequiresInsurance').checked = data.requires_insurance || false;
    }
  } else {
    title.textContent = 'Nowa klasa wysyłkowa';
  }
  modal.hidden = false;
  setupGenericFormListeners('shopShippingClassModal', 'shopShippingClassForm', 'btnCloseShopShippingClassModal', 'shippingClassFormCancel', 'shopShippingClassModalOverlay', saveShippingClass);
}
window.showShippingClassForm = showShippingClassForm;

async function saveShippingClass() {
  const client = ensureSupabase();
  if (!client) return;
  const errorEl = document.getElementById('shippingClassFormError');
  errorEl.hidden = true;
  const classId = document.getElementById('shippingClassId').value;
  const name = document.getElementById('shippingClassName').value.trim();
  if (!name) { errorEl.textContent = 'Nazwa jest wymagana'; errorEl.hidden = false; return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const data = {
    name,
    name_en: document.getElementById('shippingClassNameEn').value.trim() || null,
    slug,
    description: document.getElementById('shippingClassDescription').value.trim() || null,
    extra_cost: parseFloat(document.getElementById('shippingClassExtraCost').value) || 0,
    extra_cost_per_kg: parseFloat(document.getElementById('shippingClassCostPerKg').value) || 0,
    handling_fee: parseFloat(document.getElementById('shippingClassHandlingFee').value) || 0,
    requires_signature: document.getElementById('shippingClassRequiresSignature').checked,
    requires_insurance: document.getElementById('shippingClassRequiresInsurance').checked
  };
  try {
    let error;
    if (classId) {
      ({ error } = await client.from('shop_shipping_classes').update(data).eq('id', classId));
    } else {
      ({ error } = await client.from('shop_shipping_classes').insert(data));
    }
    if (error) throw error;
    showToast(classId ? 'Klasa zaktualizowana' : 'Klasa dodana', 'success');
    document.getElementById('shopShippingClassModal').hidden = true;
    await loadShippingClasses();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteShippingClass(classId) {
  if (!confirm('Czy na pewno chcesz usunąć tę klasę wysyłkową?')) return;
  const client = ensureSupabase();
  try {
    const { error } = await client.from('shop_shipping_classes').delete().eq('id', classId);
    if (error) throw error;
    showToast('Klasa usunięta', 'success');
    await loadShippingClasses();
  } catch (error) {
    showToast('Błąd: ' + error.message, 'error');
  }
}
window.deleteShippingClass = deleteShippingClass;

// --- TAX CLASSES ---
async function loadTaxClasses() {
  const client = ensureSupabase();
  if (!client) return;
  const tbody = document.getElementById('shopTaxClassesTableBody');
  if (!tbody) return;
  try {
    const { data: classes, error } = await client.from('shop_tax_classes').select('*').order('name');
    if (error) throw error;
    if (!classes?.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--admin-text-muted);">Brak klas podatkowych</td></tr>';
      return;
    }
    tbody.innerHTML = classes.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.name)}</strong>${c.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(c.name_en)}</small>` : ''}</td>
        <td>${escapeHtml(c.description || '-')}</td>
        <td>${c.is_default ? '✅' : ''}</td>
        <td>${c.is_active ? '✅' : '❌'}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" onclick="showTaxClassForm('${c.id}')" title="Edytuj">✏️</button>
            <button class="btn-icon" onclick="deleteTaxClass('${c.id}')" title="Usuń">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load tax classes:', error);
    tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function showTaxClassForm(classId = null) {
  const modal = document.getElementById('shopTaxClassModal');
  const form = document.getElementById('shopTaxClassForm');
  const title = document.getElementById('shopTaxClassModalTitle');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('taxClassId').value = '';
  document.getElementById('taxClassFormError').hidden = true;
  document.getElementById('taxClassActive').checked = true;
  taxRatesData = [];
  
  if (classId) {
    title.textContent = 'Edytuj klasę podatkową';
    const client = ensureSupabase();
    const { data } = await client.from('shop_tax_classes').select('*').eq('id', classId).single();
    if (data) {
      document.getElementById('taxClassId').value = data.id;
      document.getElementById('taxClassName').value = data.name || '';
      document.getElementById('taxClassNameEn').value = data.name_en || '';
      document.getElementById('taxClassDescription').value = data.description || '';
      document.getElementById('taxClassDefault').checked = data.is_default || false;
      document.getElementById('taxClassActive').checked = data.is_active !== false;
    }
    // Load tax rates for this class
    await loadTaxRatesForClass(classId);
  } else {
    title.textContent = 'Nowa klasa podatkowa';
    document.getElementById('taxRatesSection').style.display = 'none';
  }
  modal.hidden = false;
  setupGenericFormListeners('shopTaxClassModal', 'shopTaxClassForm', 'btnCloseShopTaxClassModal', 'taxClassFormCancel', 'shopTaxClassModalOverlay', saveTaxClass);
}
window.showTaxClassForm = showTaxClassForm;

async function saveTaxClass() {
  const client = ensureSupabase();
  if (!client) return;
  const errorEl = document.getElementById('taxClassFormError');
  errorEl.hidden = true;
  let classId = document.getElementById('taxClassId').value;
  const name = document.getElementById('taxClassName').value.trim();
  if (!name) { errorEl.textContent = 'Nazwa jest wymagana'; errorEl.hidden = false; return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const data = {
    name,
    name_en: document.getElementById('taxClassNameEn').value.trim() || null,
    slug,
    description: document.getElementById('taxClassDescription').value.trim() || null,
    is_default: document.getElementById('taxClassDefault').checked,
    is_active: document.getElementById('taxClassActive').checked
  };
  try {
    let error, result;
    if (classId) {
      ({ error } = await client.from('shop_tax_classes').update(data).eq('id', classId));
    } else {
      ({ data: result, error } = await client.from('shop_tax_classes').insert(data).select().single());
      if (result) classId = result.id;
    }
    if (error) throw error;
    
    // Save tax rates if we have a class ID
    if (classId && taxRatesData.length > 0) {
      await saveTaxRates(classId);
    }
    
    showToast(classId ? 'Klasa zaktualizowana' : 'Klasa dodana', 'success');
    document.getElementById('shopTaxClassModal').hidden = true;
    await loadTaxClasses();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteTaxClass(classId) {
  if (!confirm('Czy na pewno chcesz usunąć tę klasę podatkową?')) return;
  const client = ensureSupabase();
  try {
    const { error } = await client.from('shop_tax_classes').delete().eq('id', classId);
    if (error) throw error;
    showToast('Klasa usunięta', 'success');
    await loadTaxClasses();
  } catch (error) {
    showToast('Błąd: ' + error.message, 'error');
  }
}
window.deleteTaxClass = deleteTaxClass;

// Tax Rates Management
let taxRatesData = [];

async function loadTaxRatesForClass(taxClassId) {
  const client = ensureSupabase();
  if (!client) return;
  
  const section = document.getElementById('taxRatesSection');
  const list = document.getElementById('taxRatesList');
  
  if (!taxClassId) {
    section.style.display = 'none';
    taxRatesData = [];
    return;
  }
  
  section.style.display = 'block';
  
  try {
    const { data: rates, error } = await client
      .from('shop_tax_rates')
      .select('*')
      .eq('tax_class_id', taxClassId)
      .order('country');
    
    if (error) throw error;
    taxRatesData = rates || [];
    renderTaxRatesList();
  } catch (error) {
    console.error('Failed to load tax rates:', error);
    list.innerHTML = '<p style="color: #ef4444;">Błąd ładowania stawek</p>';
  }
}

function renderTaxRatesList() {
  const list = document.getElementById('taxRatesList');
  if (!list) return;
  
  if (!taxRatesData.length) {
    list.innerHTML = '<p style="color: var(--admin-text-muted); font-size: 13px; text-align: center;">Brak stawek. Dodaj stawkę VAT dla każdego kraju.</p>';
    return;
  }
  
  list.innerHTML = taxRatesData.map((rate, idx) => {
    const rawRate = Number(rate.rate) || 0;
    const displayRate = rawRate > 1 ? rawRate : (rawRate * 100);
    return `
    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 8px; background: var(--admin-bg-secondary); border-radius: 6px;">
      <input type="text" value="${escapeHtml(rate.country || '')}" placeholder="Kraj (np. CY)" 
        style="width: 60px;" onchange="updateTaxRateField(${idx}, 'country', this.value)">
      <input type="text" value="${escapeHtml(rate.name || '')}" placeholder="Nazwa (np. VAT Cyprus)" 
        style="flex: 1;" onchange="updateTaxRateField(${idx}, 'name', this.value)">
      <input type="number" value="${Number.isFinite(displayRate) ? displayRate : ''}" placeholder="%" step="0.01" 
        style="width: 70px;" onchange="updateTaxRateField(${idx}, 'rate', parseFloat(this.value))">
      <span style="color: var(--admin-text-muted);">%</span>
      <button type="button" class="btn-icon" onclick="removeTaxRate(${idx})" style="color: #ef4444;">🗑️</button>
    </div>
  `;
  }).join('');
}

function addTaxRate() {
  taxRatesData.push({ country: '', name: '', rate: 0, is_new: true });
  renderTaxRatesList();
}
window.addTaxRate = addTaxRate;

function updateTaxRateField(idx, field, value) {
  if (taxRatesData[idx]) {
    taxRatesData[idx][field] = value;
    taxRatesData[idx].is_modified = true;
  }
}
window.updateTaxRateField = updateTaxRateField;

function removeTaxRate(idx) {
  if (taxRatesData[idx]) {
    if (taxRatesData[idx].id) {
      taxRatesData[idx].is_deleted = true;
    } else {
      taxRatesData.splice(idx, 1);
    }
    renderTaxRatesList();
  }
}
window.removeTaxRate = removeTaxRate;

async function saveTaxRates(taxClassId) {
  const client = ensureSupabase();
  if (!client || !taxClassId) return;
  
  for (const rate of taxRatesData) {
    const rawRate = parseFloat(rate.rate) || 0;
    const normalizedRate = rawRate > 1 ? (rawRate / 100) : rawRate;
    if (rate.is_deleted && rate.id) {
      await client.from('shop_tax_rates').delete().eq('id', rate.id);
    } else if (rate.is_new && !rate.is_deleted) {
      await client.from('shop_tax_rates').insert({
        tax_class_id: taxClassId,
        country: rate.country,
        name: rate.name,
        rate: normalizedRate
      });
    } else if (rate.is_modified && rate.id) {
      await client.from('shop_tax_rates').update({
        country: rate.country,
        name: rate.name,
        rate: normalizedRate
      }).eq('id', rate.id);
    }
  }
}

// --- CUSTOMER GROUPS ---
async function loadCustomerGroups() {
  const client = ensureSupabase();
  if (!client) return;
  const tbody = document.getElementById('shopCustomerGroupsTableBody');
  if (!tbody) return;
  try {
    const { data: groups, error } = await client.from('shop_customer_groups').select('*').order('name');
    if (error) throw error;
    if (!groups?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--admin-text-muted);">Brak grup klientów</td></tr>';
      return;
    }
    tbody.innerHTML = groups.map(g => `
      <tr>
        <td><strong>${escapeHtml(g.name)}</strong>${g.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(g.name_en)}</small>` : ''}</td>
        <td>${g.discount_value > 0 ? `${g.discount_value}${g.discount_type === 'percentage' ? '%' : '€'}` : '-'}</td>
        <td>${g.min_orders || '-'}</td>
        <td>${g.is_default ? '✅' : ''}</td>
        <td>${g.is_active ? '✅' : '❌'}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" onclick="showCustomerGroupForm('${g.id}')" title="Edytuj">✏️</button>
            <button class="btn-icon" onclick="deleteCustomerGroup('${g.id}')" title="Usuń">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load customer groups:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function showCustomerGroupForm(groupId = null) {
  const modal = document.getElementById('shopCustomerGroupModal');
  const form = document.getElementById('shopCustomerGroupForm');
  const title = document.getElementById('shopCustomerGroupModalTitle');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('customerGroupId').value = '';
  document.getElementById('customerGroupFormError').hidden = true;
  document.getElementById('customerGroupActive').checked = true;
  if (groupId) {
    title.textContent = 'Edytuj grupę klientów';
    const client = ensureSupabase();
    const { data } = await client.from('shop_customer_groups').select('*').eq('id', groupId).single();
    if (data) {
      document.getElementById('customerGroupId').value = data.id;
      document.getElementById('customerGroupName').value = data.name || '';
      document.getElementById('customerGroupNameEn').value = data.name_en || '';
      document.getElementById('customerGroupDescription').value = data.description || '';
      document.getElementById('customerGroupDiscountType').value = data.discount_type || 'percentage';
      document.getElementById('customerGroupDiscountValue').value = data.discount_value || 0;
      document.getElementById('customerGroupMinOrders').value = data.min_orders || '';
      document.getElementById('customerGroupDefault').checked = data.is_default || false;
      document.getElementById('customerGroupActive').checked = data.is_active !== false;
    }
  } else {
    title.textContent = 'Nowa grupa klientów';
  }
  modal.hidden = false;
  setupGenericFormListeners('shopCustomerGroupModal', 'shopCustomerGroupForm', 'btnCloseShopCustomerGroupModal', 'customerGroupFormCancel', 'shopCustomerGroupModalOverlay', saveCustomerGroup);
}
window.showCustomerGroupForm = showCustomerGroupForm;

async function saveCustomerGroup() {
  const client = ensureSupabase();
  if (!client) return;
  const errorEl = document.getElementById('customerGroupFormError');
  errorEl.hidden = true;
  const groupId = document.getElementById('customerGroupId').value;
  const name = document.getElementById('customerGroupName').value.trim();
  if (!name) { errorEl.textContent = 'Nazwa jest wymagana'; errorEl.hidden = false; return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const data = {
    name,
    name_en: document.getElementById('customerGroupNameEn').value.trim() || null,
    slug,
    description: document.getElementById('customerGroupDescription').value.trim() || null,
    discount_type: document.getElementById('customerGroupDiscountType').value,
    discount_value: parseFloat(document.getElementById('customerGroupDiscountValue').value) || 0,
    min_orders: parseInt(document.getElementById('customerGroupMinOrders').value) || null,
    is_default: document.getElementById('customerGroupDefault').checked,
    is_active: document.getElementById('customerGroupActive').checked
  };
  try {
    let error;
    if (groupId) {
      ({ error } = await client.from('shop_customer_groups').update(data).eq('id', groupId));
    } else {
      ({ error } = await client.from('shop_customer_groups').insert(data));
    }
    if (error) throw error;
    showToast(groupId ? 'Grupa zaktualizowana' : 'Grupa dodana', 'success');
    document.getElementById('shopCustomerGroupModal').hidden = true;
    await loadCustomerGroups();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteCustomerGroup(groupId) {
  if (!confirm('Czy na pewno chcesz usunąć tę grupę klientów?')) return;
  const client = ensureSupabase();
  try {
    const { error } = await client.from('shop_customer_groups').delete().eq('id', groupId);
    if (error) throw error;
    showToast('Grupa usunięta', 'success');
    await loadCustomerGroups();
  } catch (error) {
    showToast('Błąd: ' + error.message, 'error');
  }
}
window.deleteCustomerGroup = deleteCustomerGroup;

// --- ATTRIBUTES ---
async function loadAttributes() {
  const client = ensureSupabase();
  if (!client) return;
  const tbody = document.getElementById('shopAttributesTableBody');
  if (!tbody) return;
  try {
    const { data: attrs, error } = await client.from('shop_attributes').select('*, values:shop_attribute_values(id, value)').order('sort_order');
    if (error) throw error;
    if (!attrs?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--admin-text-muted);">Brak atrybutów</td></tr>';
      return;
    }
    tbody.innerHTML = attrs.map(a => `
      <tr>
        <td><strong>${escapeHtml(a.name)}</strong>${a.name_en ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(a.name_en)}</small>` : ''}</td>
        <td>${a.type || 'select'}</td>
        <td>${a.values?.length || 0} wartości</td>
        <td>${a.is_filterable ? '✅' : '❌'}</td>
        <td>${a.is_variation ? '✅' : '❌'}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-icon" onclick="showAttributeForm('${a.id}')" title="Edytuj">✏️</button>
            <button class="btn-icon" onclick="deleteAttribute('${a.id}')" title="Usuń">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load attributes:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444;">Error: ${error.message}</td></tr>`;
  }
}

async function showAttributeForm(attrId = null) {
  const modal = document.getElementById('shopAttributeModal');
  const form = document.getElementById('shopAttributeForm');
  const title = document.getElementById('shopAttributeModalTitle');
  if (!modal || !form) return;
  form.reset();
  document.getElementById('attributeId').value = '';
  document.getElementById('attributeFormError').hidden = true;
  document.getElementById('attributeFilterable').checked = true;
  document.getElementById('attributeVariation').checked = true;
  document.getElementById('attributeVisible').checked = true;
  if (attrId) {
    title.textContent = 'Edytuj atrybut';
    const client = ensureSupabase();
    const { data } = await client.from('shop_attributes').select('*, values:shop_attribute_values(value)').eq('id', attrId).single();
    if (data) {
      document.getElementById('attributeId').value = data.id;
      document.getElementById('attributeName').value = data.name || '';
      document.getElementById('attributeNameEn').value = data.name_en || '';
      document.getElementById('attributeType').value = data.type || 'select';
      document.getElementById('attributeValues').value = (data.values || []).map(v => v.value).join(', ');
      document.getElementById('attributeFilterable').checked = data.is_filterable !== false;
      document.getElementById('attributeVariation').checked = data.is_variation !== false;
      document.getElementById('attributeVisible').checked = data.is_visible !== false;
    }
  } else {
    title.textContent = 'Nowy atrybut';
  }
  modal.hidden = false;
  setupGenericFormListeners('shopAttributeModal', 'shopAttributeForm', 'btnCloseShopAttributeModal', 'attributeFormCancel', 'shopAttributeModalOverlay', saveAttribute);
}
window.showAttributeForm = showAttributeForm;

async function saveAttribute() {
  const client = ensureSupabase();
  if (!client) return;
  const errorEl = document.getElementById('attributeFormError');
  errorEl.hidden = true;
  const attrId = document.getElementById('attributeId').value;
  const name = document.getElementById('attributeName').value.trim();
  if (!name) { errorEl.textContent = 'Nazwa jest wymagana'; errorEl.hidden = false; return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const valuesStr = document.getElementById('attributeValues').value.trim();
  const values = valuesStr ? valuesStr.split(',').map(v => v.trim()).filter(Boolean) : [];
  const attrData = {
    name,
    name_en: document.getElementById('attributeNameEn').value.trim() || null,
    slug,
    type: document.getElementById('attributeType').value,
    is_filterable: document.getElementById('attributeFilterable').checked,
    is_variation: document.getElementById('attributeVariation').checked,
    is_visible: document.getElementById('attributeVisible').checked
  };
  try {
    let error, attrResult;
    if (attrId) {
      ({ error } = await client.from('shop_attributes').update(attrData).eq('id', attrId));
      attrResult = { id: attrId };
    } else {
      const { data, error: insErr } = await client.from('shop_attributes').insert(attrData).select('id').single();
      error = insErr;
      attrResult = data;
    }
    if (error) throw error;
    // Update values
    if (attrResult?.id) {
      await client.from('shop_attribute_values').delete().eq('attribute_id', attrResult.id);
      if (values.length > 0) {
        const valueRecords = values.map((v, i) => ({
          attribute_id: attrResult.id,
          value: v,
          slug: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          sort_order: i
        }));
        await client.from('shop_attribute_values').insert(valueRecords);
      }
    }
    showToast(attrId ? 'Atrybut zaktualizowany' : 'Atrybut dodany', 'success');
    document.getElementById('shopAttributeModal').hidden = true;
    await loadAttributes();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteAttribute(attrId) {
  if (!confirm('Czy na pewno chcesz usunąć ten atrybut? Wszystkie wartości zostaną usunięte.')) return;
  const client = ensureSupabase();
  try {
    const { error } = await client.from('shop_attributes').delete().eq('id', attrId);
    if (error) throw error;
    showToast('Atrybut usunięty', 'success');
    await loadAttributes();
  } catch (error) {
    showToast('Błąd: ' + error.message, 'error');
  }
}
window.deleteAttribute = deleteAttribute;

// Generic form listener setup
function setupGenericFormListeners(modalId, formId, closeBtnId, cancelBtnId, overlayId, saveFunction) {
  const modal = document.getElementById(modalId);
  const form = document.getElementById(formId);
  const closeBtn = document.getElementById(closeBtnId);
  const cancelBtn = document.getElementById(cancelBtnId);
  const overlay = document.getElementById(overlayId);
  const closeModal = () => { modal.hidden = true; };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (overlay) overlay.onclick = closeModal;
  if (form) form.onsubmit = async (e) => { e.preventDefault(); await saveFunction(); };
}

// =====================================================
// SHIPPING METHOD FORM
// =====================================================

function switchShippingMethodLang(lang) {
  const plDiv = document.getElementById('shippingMethodLangPL');
  const enDiv = document.getElementById('shippingMethodLangEN');
  if (plDiv) plDiv.classList.toggle('active', lang === 'pl');
  if (enDiv) enDiv.classList.toggle('active', lang === 'en');
  document.querySelectorAll('#shopShippingMethodModal .lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === lang);
  });
}
window.switchShippingMethodLang = switchShippingMethodLang;

function updateShippingMethodFields() {
  const methodType = document.getElementById('shippingMethodType').value;
  const weightFields = document.getElementById('shippingWeightFields');
  const perItemFields = document.getElementById('shippingPerItemFields');
  const costField = document.getElementById('shippingMethodCost');

  if (weightFields) weightFields.style.display = methodType === 'per_weight' ? 'block' : 'none';
  if (perItemFields) perItemFields.style.display = methodType === 'per_item' ? 'block' : 'none';
  
  // For free shipping, set cost to 0 and disable
  if (costField) {
    if (methodType === 'free') {
      costField.value = 0;
      costField.disabled = true;
    } else {
      costField.disabled = false;
    }
  }
}
window.updateShippingMethodFields = updateShippingMethodFields;

async function showShippingMethodForm(zoneId, methodId = null) {
  const modal = document.getElementById('shopShippingMethodModal');
  const title = document.getElementById('shopShippingMethodModalTitle');
  const form = document.getElementById('shopShippingMethodForm');
  
  if (!modal || !form) return;
  
  form.reset();
  document.getElementById('shippingMethodId').value = '';
  document.getElementById('shippingMethodZoneId').value = zoneId;
  document.getElementById('shippingMethodFormError').hidden = true;
  
  // Reset to Polish tab
  switchShippingMethodLang('pl');
  updateShippingMethodFields();
  
  // Find zone name for title
  const zone = shopState.shippingZones.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : '';
  
  if (methodId) {
    title.textContent = `Edytuj metodę - ${zoneName}`;
    await loadShippingMethodData(methodId);
  } else {
    title.textContent = `Nowa metoda dostawy - ${zoneName}`;
    document.getElementById('shippingMethodActive').checked = true;
  }
  
  modal.hidden = false;
  setupShippingMethodFormListeners();
}
window.showShippingMethodForm = showShippingMethodForm;

async function loadShippingMethodData(methodId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: method, error } = await client
      .from('shop_shipping_methods')
      .select('*')
      .eq('id', methodId)
      .single();

    if (error) throw error;
    if (!method) return;

    document.getElementById('shippingMethodId').value = method.id;
    document.getElementById('shippingMethodZoneId').value = method.zone_id;
    // Polish fields
    document.getElementById('shippingMethodName').value = method.name || '';
    document.getElementById('shippingMethodDescription').value = method.description || '';
    // English fields
    document.getElementById('shippingMethodNameEn').value = method.name_en || '';
    document.getElementById('shippingMethodDescriptionEn').value = method.description_en || '';
    // Pricing
    document.getElementById('shippingMethodType').value = method.method_type || 'flat_rate';
    document.getElementById('shippingMethodCost').value = method.cost || 0;
    document.getElementById('shippingMethodCostPerKg').value = method.cost_per_kg || 0;
    document.getElementById('shippingMethodMinWeight').value = method.min_weight || '';
    document.getElementById('shippingMethodMaxWeight').value = method.max_weight || '';
    document.getElementById('shippingMethodCostPerItem').value = method.cost_per_item || 0;
    document.getElementById('shippingMethodFreeThreshold').value = method.free_shipping_threshold || '';
    // Delivery time
    document.getElementById('shippingMethodMinDays').value = method.min_delivery_days || 1;
    document.getElementById('shippingMethodMaxDays').value = method.max_delivery_days || 3;
    document.getElementById('shippingMethodProcessingDays').value = method.processing_days || 1;
    // Options
    document.getElementById('shippingMethodRequiresSignature').checked = method.requires_signature || false;
    document.getElementById('shippingMethodIncludesInsurance').checked = method.includes_insurance || false;
    document.getElementById('shippingMethodActive').checked = method.is_active !== false;
    document.getElementById('shippingMethodInsuranceCost').value = method.insurance_cost || 0;
    document.getElementById('shippingMethodSortOrder').value = method.sort_order || 0;
    document.getElementById('shippingMethodTrackingUrl').value = method.tracking_url_template || '';

    updateShippingMethodFields();

  } catch (error) {
    console.error('Failed to load shipping method:', error);
    showToast('Nie udało się załadować metody', 'error');
  }
}

function setupShippingMethodFormListeners() {
  const modal = document.getElementById('shopShippingMethodModal');
  const form = document.getElementById('shopShippingMethodForm');
  const closeBtn = document.getElementById('btnCloseShopShippingMethodModal');
  const cancelBtn = document.getElementById('shippingMethodFormCancel');
  const overlay = document.getElementById('shopShippingMethodModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveShippingMethod();
  };
}

async function saveShippingMethod() {
  const client = ensureSupabase();
  if (!client) return;

  const errorEl = document.getElementById('shippingMethodFormError');
  errorEl.hidden = true;

  const methodId = document.getElementById('shippingMethodId').value;
  const zoneId = document.getElementById('shippingMethodZoneId').value;
  const name = document.getElementById('shippingMethodName').value.trim();

  if (!name || !zoneId) {
    errorEl.textContent = 'Nazwa metody jest wymagana';
    errorEl.hidden = false;
    return;
  }

  const methodData = {
    zone_id: zoneId,
    name,
    name_en: document.getElementById('shippingMethodNameEn').value.trim() || null,
    description: document.getElementById('shippingMethodDescription').value.trim() || null,
    description_en: document.getElementById('shippingMethodDescriptionEn').value.trim() || null,
    method_type: document.getElementById('shippingMethodType').value,
    cost: parseFloat(document.getElementById('shippingMethodCost').value) || 0,
    cost_per_kg: parseFloat(document.getElementById('shippingMethodCostPerKg').value) || 0,
    min_weight: parseFloat(document.getElementById('shippingMethodMinWeight').value) || null,
    max_weight: parseFloat(document.getElementById('shippingMethodMaxWeight').value) || null,
    cost_per_item: parseFloat(document.getElementById('shippingMethodCostPerItem').value) || 0,
    free_shipping_threshold: parseFloat(document.getElementById('shippingMethodFreeThreshold').value) || null,
    min_delivery_days: parseInt(document.getElementById('shippingMethodMinDays').value) || 1,
    max_delivery_days: parseInt(document.getElementById('shippingMethodMaxDays').value) || 3,
    processing_days: parseInt(document.getElementById('shippingMethodProcessingDays').value) || 1,
    requires_signature: document.getElementById('shippingMethodRequiresSignature').checked,
    includes_insurance: document.getElementById('shippingMethodIncludesInsurance').checked,
    insurance_cost: parseFloat(document.getElementById('shippingMethodInsuranceCost').value) || 0,
    is_active: document.getElementById('shippingMethodActive').checked,
    sort_order: parseInt(document.getElementById('shippingMethodSortOrder').value) || 0,
    tracking_url_template: document.getElementById('shippingMethodTrackingUrl').value.trim() || null
  };

  try {
    let error;
    if (methodId) {
      ({ error } = await client.from('shop_shipping_methods').update(methodData).eq('id', methodId));
    } else {
      ({ error } = await client.from('shop_shipping_methods').insert(methodData));
    }

    if (error) throw error;

    showToast(methodId ? 'Metoda zaktualizowana' : 'Metoda dodana', 'success');
    document.getElementById('shopShippingMethodModal').hidden = true;
    await loadShopShipping();

  } catch (error) {
    console.error('Failed to save shipping method:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function deleteShippingMethod(methodId) {
  if (!confirm('Czy na pewno chcesz usunąć tę metodę dostawy?')) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client
      .from('shop_shipping_methods')
      .delete()
      .eq('id', methodId);

    if (error) throw error;

    showToast('Metoda usunięta', 'success');
    await loadShopShipping();

  } catch (error) {
    console.error('Failed to delete shipping method:', error);
    showToast('Nie udało się usunąć metody: ' + error.message, 'error');
  }
}
window.deleteShippingMethod = deleteShippingMethod;

async function loadShopSettings() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: settings, error } = await client
      .from('shop_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    shopState.settings = settings || {};

    // === GENERAL SETTINGS ===
    const nameEl = document.getElementById('shopSettingName');
    if (nameEl) nameEl.value = settings?.shop_name || '';

    const emailEl = document.getElementById('shopSettingEmail');
    if (emailEl) emailEl.value = settings?.admin_notification_email || '';

    const prefixEl = document.getElementById('shopSettingOrderPrefix');
    if (prefixEl) prefixEl.value = settings?.order_number_prefix || 'WC';

    const currencyEl = document.getElementById('shopSettingCurrency');
    if (currencyEl) currencyEl.value = settings?.default_currency || settings?.currency || 'EUR';

    const taxEnabledEl = document.getElementById('shopSettingTaxEnabled');
    if (taxEnabledEl) taxEnabledEl.checked = settings?.tax_enabled === true;

    const taxIncludedEl = document.getElementById('shopSettingTaxIncludedInPrice');
    if (taxIncludedEl) taxIncludedEl.checked = settings?.tax_included_in_price !== false;

    const taxBasedOnEl = document.getElementById('shopSettingTaxBasedOn');
    if (taxBasedOnEl) taxBasedOnEl.value = settings?.tax_based_on || 'shipping';

    // === XP & GAMIFICATION ===
    const xpPerEuroEl = document.getElementById('shopSettingXpPerEuro');
    if (xpPerEuroEl) xpPerEuroEl.value = settings?.xp_per_euro || 1;

    const xpPerReviewEl = document.getElementById('shopSettingXpPerReview');
    if (xpPerReviewEl) xpPerReviewEl.value = settings?.xp_per_review || 50;

    const xpEnabledEl = document.getElementById('shopSettingXpEnabled');
    if (xpEnabledEl) xpEnabledEl.checked = settings?.xp_enabled !== false;

    // === REVIEWS ===
    const reviewsEl = document.getElementById('shopSettingReviewsEnabled');
    if (reviewsEl) reviewsEl.checked = settings?.reviews_enabled !== false;

    const reviewsModerationEl = document.getElementById('shopSettingReviewsModeration');
    if (reviewsModerationEl) reviewsModerationEl.checked = settings?.reviews_moderation === true;

    const reviewsVerifiedEl = document.getElementById('shopSettingReviewsVerifiedOnly');
    if (reviewsVerifiedEl) reviewsVerifiedEl.checked = settings?.reviews_verified_only === true;

    // === NOTIFICATIONS ===
    const abandonedCartEl = document.getElementById('shopSettingAbandonedCart');
    if (abandonedCartEl) abandonedCartEl.checked = settings?.notify_abandoned_cart !== false;

    const orderConfirmEl = document.getElementById('shopSettingOrderConfirmation');
    if (orderConfirmEl) orderConfirmEl.checked = settings?.notify_order_confirmation !== false;

    const shippingNotifyEl = document.getElementById('shopSettingShippingNotification');
    if (shippingNotifyEl) shippingNotifyEl.checked = settings?.notify_shipping !== false;

    const reviewReminderEl = document.getElementById('shopSettingReviewReminder');
    if (reviewReminderEl) reviewReminderEl.checked = settings?.notify_review_reminder === true;

    // === INVENTORY ===
    const lowStockEl = document.getElementById('shopSettingLowStockThreshold');
    if (lowStockEl) lowStockEl.value = settings?.low_stock_threshold_default || settings?.low_stock_threshold || 5;

    const cartReservationEl = document.getElementById('shopSettingCartReservation');
    if (cartReservationEl) cartReservationEl.value = settings?.reserve_stock_minutes || settings?.cart_reservation_minutes || 15;

    const hideOutOfStockEl = document.getElementById('shopSettingHideOutOfStock');
    if (hideOutOfStockEl) hideOutOfStockEl.checked = settings?.hide_out_of_stock === true;

    const backordersEl = document.getElementById('shopSettingBackorders');
    if (backordersEl) backordersEl.checked = settings?.allow_backorders === true;

  } catch (error) {
    console.error('Failed to load shop settings:', error);
    showToast('Błąd ładowania ustawień', 'error');
  }
}

async function saveShopSettings() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const payload = {
      id: 1,
      // === GENERAL ===
      shop_name: document.getElementById('shopSettingName')?.value || '',
      admin_notification_email: document.getElementById('shopSettingEmail')?.value || '',
      order_number_prefix: document.getElementById('shopSettingOrderPrefix')?.value || 'WC',
      default_currency: document.getElementById('shopSettingCurrency')?.value || 'EUR',
      // === TAX ===
      tax_enabled: document.getElementById('shopSettingTaxEnabled')?.checked ?? false,
      tax_included_in_price: document.getElementById('shopSettingTaxIncludedInPrice')?.checked ?? true,
      tax_based_on: document.getElementById('shopSettingTaxBasedOn')?.value || 'shipping',
      // === XP & GAMIFICATION ===
      xp_per_euro: parseInt(document.getElementById('shopSettingXpPerEuro')?.value) || 1,
      xp_enabled: document.getElementById('shopSettingXpEnabled')?.checked ?? true,
      // === REVIEWS ===
      reviews_enabled: document.getElementById('shopSettingReviewsEnabled')?.checked ?? true,
      reviews_require_approval: document.getElementById('shopSettingReviewsModeration')?.checked ?? true,
      reviews_require_purchase: document.getElementById('shopSettingReviewsVerifiedOnly')?.checked ?? false,
      // === NOTIFICATIONS ===
      abandoned_cart_enabled: document.getElementById('shopSettingAbandonedCart')?.checked ?? true,
      // === INVENTORY ===
      low_stock_threshold_default: parseInt(document.getElementById('shopSettingLowStockThreshold')?.value) || 5,
      reserve_stock_minutes: parseInt(document.getElementById('shopSettingCartReservation')?.value) || 15,
      // Meta
      updated_at: new Date().toISOString()
    };

    let { error } = await client
      .from('shop_settings')
      .upsert(payload, { onConflict: 'id' });

    const errorCode = error?.code;
    const errorMessage = error?.message;
    const shouldRetryWithoutNewColumns =
      !!error &&
      (
        errorCode === '42703' ||
        errorCode === 'PGRST204' ||
        (typeof errorMessage === 'string' &&
          (errorMessage.includes('default_currency') ||
            errorMessage.includes('reserve_stock_minutes') ||
            errorMessage.includes('low_stock_threshold_default') ||
            errorMessage.includes('tax_enabled') ||
            errorMessage.includes('tax_included_in_price') ||
            errorMessage.includes('tax_based_on')))
      );

    if (shouldRetryWithoutNewColumns) {
      const fallback = {
        id: 1,
        shop_name: payload.shop_name,
        admin_notification_email: payload.admin_notification_email,
        order_number_prefix: payload.order_number_prefix,
        updated_at: payload.updated_at
      };
      ({ error } = await client
        .from('shop_settings')
        .upsert(fallback, { onConflict: 'id' }));
    }

    if (error) throw error;

    shopState.settings = payload;
    showToast('Ustawienia zapisane', 'success');

  } catch (error) {
    console.error('Failed to save shop settings:', error);
    showToast(`Błąd zapisu: ${error.message}`, 'error');
  }
}

async function loadAdminNotificationSettings() {
  const client = ensureSupabase();
  if (!client) return;

  const emailEl = document.getElementById('adminNotificationEmail');
  if (emailEl) emailEl.value = '';

  try {
    const { data: settings, error } = await client
      .from('shop_settings')
      .select('admin_notification_email')
      .eq('id', 1)
      .single();

    if (error) throw error;

    if (emailEl) emailEl.value = settings?.admin_notification_email || '';
  } catch (error) {
    console.error('Failed to load admin notification settings:', error);
    showToast('Failed to load settings', 'error');
  }
}

async function saveAdminNotificationSettings() {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const emailValue = document.getElementById('adminNotificationEmail')?.value || '';

    const payload = {
      id: 1,
      admin_notification_email: emailValue,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('shop_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;

    showToast('Settings saved', 'success');
  } catch (error) {
    console.error('Failed to save admin notification settings:', error);
    showToast(`Save error: ${error.message}`, 'error');
  }
}

// =====================================================
// SHOP PRODUCT FORM
// =====================================================

// Language tab switchers for shop forms
function switchProductLang(lang) {
  const plDiv = document.getElementById('productLangPL');
  const enDiv = document.getElementById('productLangEN');
  if (plDiv) plDiv.classList.toggle('active', lang === 'pl');
  if (enDiv) enDiv.classList.toggle('active', lang === 'en');
  document.querySelectorAll('#shopProductModal .lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === lang);
  });
}

function switchCategoryLang(lang) {
  const plDiv = document.getElementById('categoryLangPL');
  const enDiv = document.getElementById('categoryLangEN');
  if (plDiv) plDiv.classList.toggle('active', lang === 'pl');
  if (enDiv) enDiv.classList.toggle('active', lang === 'en');
  document.querySelectorAll('#shopCategoryModal .lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === lang);
  });
}

function switchVendorLang(lang) {
  const plDiv = document.getElementById('vendorLangPL');
  const enDiv = document.getElementById('vendorLangEN');
  if (plDiv) plDiv.classList.toggle('active', lang === 'pl');
  if (enDiv) enDiv.classList.toggle('active', lang === 'en');
  document.querySelectorAll('#shopVendorModal .lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === lang);
  });
}

function switchDiscountLang(lang) {
  const plDiv = document.getElementById('discountLangPL');
  const enDiv = document.getElementById('discountLangEN');
  if (plDiv) plDiv.classList.toggle('active', lang === 'pl');
  if (enDiv) enDiv.classList.toggle('active', lang === 'en');
  document.querySelectorAll('#shopDiscountModal .lang-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.lang === lang);
  });
}

// Export language switchers
window.switchProductLang = switchProductLang;
window.switchCategoryLang = switchCategoryLang;
window.switchVendorLang = switchVendorLang;
window.switchDiscountLang = switchDiscountLang;

async function showProductForm(productId = null) {
  const modal = document.getElementById('shopProductModal');
  const title = document.getElementById('shopProductModalTitle');
  const form = document.getElementById('shopProductForm');
  
  if (!modal || !form) return;
  
  // Reset form
  form.reset();
  document.getElementById('shopProductId').value = '';
  document.getElementById('shopProductFormError').hidden = true;
  
  // Reset image previews
  const thumbPreview = document.getElementById('shopProductThumbnailPreview');
  const galleryPreview = document.getElementById('shopProductGalleryPreview');
  if (thumbPreview) thumbPreview.innerHTML = '';
  if (galleryPreview) galleryPreview.innerHTML = '';
  
  // Reset variants and relationships
  productVariantsData = [];
  const variantsList = document.getElementById('shopProductVariantsList');
  if (variantsList) variantsList.innerHTML = '<p style="color: var(--admin-text-muted); text-align: center; font-size: 13px;">Brak wariantów. Kliknij "Dodaj wariant" aby utworzyć.</p>';
  
  // Reset to Polish tab
  switchProductLang('pl');
  
  // Reset form sections to default (simple product)
  updateProductFormSections('simple');
  
  // Load categories and vendors for dropdowns
  await loadProductFormDropdowns();
  
  // Load related products options
  await loadRelatedProductsOptions(productId);
  
  if (productId) {
    title.textContent = 'Edytuj produkt';
    await loadProductData(productId);
    // Load variants and relationships for existing product
    await loadProductVariants(productId);
    await loadProductRelationships(productId);
  } else {
    title.textContent = 'Nowy produkt';
  }
  
  modal.hidden = false;
  setupProductFormListeners();
}

function hasNonDeletedVariants() {
  return (productVariantsData || []).some(v => v && !v.is_deleted);
}

function hasVariantChanges() {
  return (productVariantsData || []).some(v => v && (v.is_new || v.is_modified || v.is_deleted));
}

function enableProductVariantsUI() {
  const typeSelect = document.getElementById('shopProductType');
  if (typeSelect && typeSelect.value !== 'variable') {
    typeSelect.value = 'variable';
  }
  updateProductFormSections('variable');
  const variantsSection = document.getElementById('shopProductVariantsSection');
  if (variantsSection) {
    variantsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
window.enableProductVariantsUI = enableProductVariantsUI;

async function loadProductFormDropdowns() {
  const client = ensureSupabase();
  if (!client) return;

  // Load categories
  const categorySelect = document.getElementById('shopProductCategory');
  if (categorySelect) {
    const { data: categories } = await client.from('shop_categories').select('id, name').eq('is_active', true).order('name');
    categorySelect.innerHTML = '<option value="">No Category</option>' + 
      (categories || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  // Load vendors
  const vendorSelect = document.getElementById('shopProductVendor');
  if (vendorSelect) {
    const { data: vendors } = await client.from('shop_vendors').select('id, name').eq('is_active', true).order('name');
    vendorSelect.innerHTML = '<option value="">No Vendor</option>' + 
      (vendors || []).map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join('');
  }

  // Load tax classes
  const taxSelect = document.getElementById('shopProductTaxClass');
  if (taxSelect) {
    const { data: taxClasses } = await client.from('shop_tax_classes').select('id, name').eq('is_active', true).order('name');
    taxSelect.innerHTML = '<option value="">-- Domyślna --</option>' + 
      (taxClasses || []).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  }

  // Load shipping classes
  const shippingClassSelect = document.getElementById('shopProductShippingClass');
  if (shippingClassSelect) {
    const { data: shippingClasses } = await client.from('shop_shipping_classes').select('id, name').eq('is_active', true).order('name');
    shippingClassSelect.innerHTML = '<option value="">-- Standardowa --</option>' + 
      (shippingClasses || []).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
}

async function loadProductData(productId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: product, error } = await client
      .from('shop_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) throw error;
    if (!product) return;

    document.getElementById('shopProductId').value = product.id;
    // Polish fields
    document.getElementById('shopProductName').value = product.name || '';
    document.getElementById('shopProductDescription').value = product.description || '';
    document.getElementById('shopProductShortDesc').value = product.short_description || '';
    // English fields
    document.getElementById('shopProductNameEn').value = product.name_en || '';
    document.getElementById('shopProductDescriptionEn').value = product.description_en || '';
    document.getElementById('shopProductShortDescEn').value = product.short_description_en || '';
    // Organization
    document.getElementById('shopProductSku').value = product.sku || '';
    document.getElementById('shopProductSlug').value = product.slug || '';
    document.getElementById('shopProductCategory').value = product.category_id || '';
    document.getElementById('shopProductVendor').value = product.vendor_id || '';
    document.getElementById('shopProductStatus').value = product.status || 'draft';
    document.getElementById('shopProductType').value = product.product_type || 'simple';
    // Pricing
    document.getElementById('shopProductPrice').value = product.price || '';
    document.getElementById('shopProductComparePrice').value = product.compare_at_price || '';
    document.getElementById('shopProductCost').value = product.cost_price || '';
    document.getElementById('shopProductSalePrice').value = product.sale_price || '';
    if (product.sale_start_date) {
      document.getElementById('shopProductSaleStart').value = product.sale_start_date.slice(0, 16);
    }
    if (product.sale_end_date) {
      document.getElementById('shopProductSaleEnd').value = product.sale_end_date.slice(0, 16);
    }
    document.getElementById('shopProductTaxClass').value = product.tax_class_id || '';
    if (document.getElementById('shopProductTaxPriceMode')) {
      document.getElementById('shopProductTaxPriceMode').value = product.tax_price_mode || 'inherit';
    }
    // Inventory
    document.getElementById('shopProductTrackInventory').checked = product.track_inventory || false;
    document.getElementById('shopProductAllowBackorder').checked = product.allow_backorder || false;
    document.getElementById('shopProductStock').value = product.stock_quantity || 0;
    document.getElementById('shopProductLowStock').value = product.low_stock_threshold || 5;
    document.getElementById('shopProductMinQty').value = product.min_purchase_quantity || 1;
    document.getElementById('shopProductMaxQty').value = product.max_purchase_quantity || '';
    // Shipping
    document.getElementById('shopProductRequiresShipping').checked = !product.is_virtual;
    document.getElementById('shopProductWeight').value = product.weight || '';
    document.getElementById('shopProductShippingClass').value = product.shipping_class_id || '';
    document.getElementById('shopProductLength').value = product.length || '';
    document.getElementById('shopProductWidth').value = product.width || '';
    document.getElementById('shopProductHeight').value = product.height || '';
    // Flags
    document.getElementById('shopProductFeatured').checked = product.is_featured || false;
    document.getElementById('shopProductBestseller').checked = product.is_bestseller || false;
    document.getElementById('shopProductNew').checked = product.is_new || false;
    document.getElementById('shopProductOnSale').checked = product.is_on_sale || false;
    // Media
    document.getElementById('shopProductThumbnail').value = product.thumbnail_url || '';
    document.getElementById('shopProductImages').value = (product.images || []).join('\n');
    document.getElementById('shopProductVideo').value = product.video_url || '';
    document.getElementById('shopProductTags').value = (product.tags || []).join(', ');
    
    // Digital product fields
    if (document.getElementById('shopProductDigitalUrl')) {
      document.getElementById('shopProductDigitalUrl').value = product.digital_file_url || '';
    }
    if (document.getElementById('shopProductDigitalFileName')) {
      document.getElementById('shopProductDigitalFileName').value = product.digital_file_name || '';
    }
    if (document.getElementById('shopProductDownloadLimit')) {
      document.getElementById('shopProductDownloadLimit').value = product.download_limit || '';
    }
    if (document.getElementById('shopProductDownloadExpiry')) {
      document.getElementById('shopProductDownloadExpiry').value = product.download_expiry_days || '';
    }
    
    // Subscription fields
    if (document.getElementById('shopProductSubInterval')) {
      document.getElementById('shopProductSubInterval').value = product.subscription_interval || 'month';
    }
    if (document.getElementById('shopProductSubIntervalCount')) {
      document.getElementById('shopProductSubIntervalCount').value = product.subscription_interval_count || 1;
    }
    if (document.getElementById('shopProductSubTrialDays')) {
      document.getElementById('shopProductSubTrialDays').value = product.subscription_trial_days || 0;
    }
    if (document.getElementById('shopProductSubSignupFee')) {
      document.getElementById('shopProductSubSignupFee').value = product.subscription_signup_fee || 0;
    }
    
    // Update form sections based on product type
    updateProductFormSections(product.product_type || 'simple');
    
    // Render image previews
    if (product.thumbnail_url) {
      const thumbPreview = document.getElementById('shopProductThumbnailPreview');
      if (thumbPreview) {
        thumbPreview.innerHTML = `<img src="${product.thumbnail_url}" style="max-width: 150px; max-height: 150px; border-radius: 8px; object-fit: cover;">`;
      }
    }
    if (product.images && product.images.length > 0) {
      renderGalleryPreview(product.images);
    }

  } catch (error) {
    console.error('Failed to load product:', error);
    showToast('Failed to load product', 'error');
  }
}

function setupProductFormListeners() {
  const modal = document.getElementById('shopProductModal');
  const form = document.getElementById('shopProductForm');
  const closeBtn = document.getElementById('btnCloseShopProductModal');
  const cancelBtn = document.getElementById('shopProductFormCancel');
  const overlay = document.getElementById('shopProductModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveProduct();
  };

  // Product type change handler
  const typeSelect = document.getElementById('shopProductType');
  if (typeSelect) {
    typeSelect.onchange = () => updateProductFormSections(typeSelect.value);
  }

  // Image upload handlers
  setupProductImageUpload();
}

// Update form sections based on product type
function updateProductFormSections(productType) {
  const digitalSection = document.getElementById('shopProductDigitalSection');
  const subscriptionSection = document.getElementById('shopProductSubscriptionSection');
  const bundleSection = document.getElementById('shopProductBundleSection');
  const variantsSection = document.getElementById('shopProductVariantsSection');
  const relatedSection = document.getElementById('shopProductRelatedSection');
  const inventorySection = document.getElementById('shopProductInventorySection');
  const shippingSection = document.getElementById('shopProductShippingSection');

  // Hide all special sections first
  if (digitalSection) digitalSection.style.display = 'none';
  if (subscriptionSection) subscriptionSection.style.display = 'none';
  if (bundleSection) bundleSection.style.display = 'none';
  if (variantsSection) variantsSection.style.display = 'none';
  
  // Always show related products section
  if (relatedSection) relatedSection.style.display = 'block';

  // Show/hide based on product type
  switch (productType) {
    case 'digital':
      if (digitalSection) digitalSection.style.display = 'block';
      if (shippingSection) shippingSection.style.display = 'none';
      document.getElementById('shopProductRequiresShipping').checked = false;
      break;
    case 'subscription':
      if (subscriptionSection) subscriptionSection.style.display = 'block';
      if (shippingSection) shippingSection.style.display = 'none';
      document.getElementById('shopProductRequiresShipping').checked = false;
      break;
    case 'bundle':
      if (bundleSection) bundleSection.style.display = 'block';
      if (shippingSection) shippingSection.style.display = 'block';
      document.getElementById('shopProductRequiresShipping').checked = true;
      break;
    case 'variable':
      if (variantsSection) variantsSection.style.display = 'block';
      if (shippingSection) shippingSection.style.display = 'block';
      document.getElementById('shopProductRequiresShipping').checked = true;
      break;
    default: // simple, grouped
      if (shippingSection) shippingSection.style.display = 'block';
      document.getElementById('shopProductRequiresShipping').checked = true;
      break;
  }
}
window.updateProductFormSections = updateProductFormSections;

// =====================================================
// PRODUCT VARIANTS MANAGEMENT
// =====================================================

let productVariantsData = [];
let availableAttributes = [];

async function loadProductVariants(productId) {
  const client = ensureSupabase();
  if (!client) return;
  
  const list = document.getElementById('shopProductVariantsList');
  if (!productId) {
    productVariantsData = [];
    if (list) list.innerHTML = '<p style="color: var(--admin-text-muted); text-align: center; font-size: 13px;">Brak wariantów. Kliknij "Dodaj wariant" aby utworzyć.</p>';
    return;
  }
  
  try {
    // Load attributes for dropdown (shop_attributes doesn't have is_active column)
    const { data: attrs } = await client.from('shop_attributes').select('id, name');
    availableAttributes = attrs || [];
    
    // Load existing variants
    const { data: variants, error } = await client
      .from('shop_product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');
    
    if (error) throw error;
    productVariantsData = variants || [];

    if (productVariantsData.length) {
      enableProductVariantsUI();
    }

    renderProductVariantsList();
  } catch (error) {
    console.error('Failed to load variants:', error);
    if (list) list.innerHTML = '<p style="color: #ef4444;">Błąd ładowania wariantów</p>';
  }
}

function renderProductVariantsList() {
  const list = document.getElementById('shopProductVariantsList');
  if (!list) return;
  
  if (!productVariantsData.length) {
    list.innerHTML = '<p style="color: var(--admin-text-muted); text-align: center; font-size: 13px;">Brak wariantów. Kliknij "Dodaj wariant" aby utworzyć.</p>';
    return;
  }
  
  list.innerHTML = productVariantsData.filter(v => !v.is_deleted).map((variant, idx) => `
    <div style="padding: 12px; background: var(--admin-bg-secondary); border-radius: 8px; margin-bottom: 8px;">
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <input type="text" value="${escapeHtml(variant.name || '')}" placeholder="Nazwa wariantu (np. Rozmiar L)" 
          style="flex: 1; font-weight: 500;" onchange="updateVariantField(${idx}, 'name', this.value)">
        <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--admin-text-muted); white-space: nowrap;">
          <input type="radio" name="shopDefaultVariant" ${variant.is_default ? 'checked' : ''} onchange="setDefaultVariant(${idx})">
          Domyślny
        </label>
        <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--admin-text-muted); white-space: nowrap;">
          <input type="checkbox" ${variant.is_active === false ? '' : 'checked'} onchange="updateVariantField(${idx}, 'is_active', this.checked)">
          Aktywny
        </label>
        <button type="button" class="btn-icon" onclick="removeProductVariant(${idx})" style="color: #ef4444;" title="Usuń">🗑️</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">SKU</label>
          <input type="text" value="${escapeHtml(variant.sku || '')}" placeholder="SKU" 
            style="width: 100%;" onchange="updateVariantField(${idx}, 'sku', this.value)">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">Cena (€)</label>
          <input type="number" value="${variant.price !== null && variant.price !== undefined ? variant.price : ''}" placeholder="Cena" step="0.01"
            style="width: 100%;" onchange="updateVariantField(${idx}, 'price', parseNullableNumber(this.value))">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">Było (€)</label>
          <input type="number" value="${variant.compare_at_price !== null && variant.compare_at_price !== undefined ? variant.compare_at_price : ''}" placeholder="Cena porównawcza" step="0.01"
            style="width: 100%;" onchange="updateVariantField(${idx}, 'compare_at_price', parseNullableNumber(this.value))">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">Stan mag.</label>
          <input type="number" value="${variant.stock_quantity !== null && variant.stock_quantity !== undefined ? variant.stock_quantity : 0}" placeholder="Ilość" min="0"
            style="width: 100%;" onchange="updateVariantField(${idx}, 'stock_quantity', parseNullableInt(this.value, 0))">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px;">
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">Waga (kg)</label>
          <input type="number" value="${variant.weight !== null && variant.weight !== undefined ? variant.weight : ''}" placeholder="Waga" step="0.01"
            style="width: 100%;" onchange="updateVariantField(${idx}, 'weight', parseNullableNumber(this.value))">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">Kolejność</label>
          <input type="number" value="${variant.sort_order !== null && variant.sort_order !== undefined ? variant.sort_order : idx}" placeholder="0" step="1" min="0"
            style="width: 100%;" onchange="updateVariantField(${idx}, 'sort_order', parseNullableInt(this.value, idx))">
        </div>
        <div>
          <label style="font-size: 11px; color: var(--admin-text-muted);">URL obrazka</label>
          <input type="url" value="${escapeHtml(variant.image_url || '')}" placeholder="https://..."
            style="width: 100%;" onchange="updateVariantField(${idx}, 'image_url', this.value)">
        </div>
      </div>
      <div style="margin-top: 8px;">
        <label style="font-size: 11px; color: var(--admin-text-muted);">Atrybuty (np. rozmiar=L, kolor=czerwony)</label>
        <input type="text" value="${formatAttributes(variant.attributes)}" placeholder="rozmiar=L, kolor=czerwony" 
          style="width: 100%;" onchange="updateVariantField(${idx}, 'attributes', parseAttributesInput(this.value))">
      </div>
    </div>
  `).join('');
}

function parseNullableNumber(value) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function parseNullableInt(value, fallback = null) {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === '' || v === null || v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function setDefaultVariant(idx) {
  (productVariantsData || []).forEach((v, i) => {
    if (!v || v.is_deleted) return;
    v.is_default = i === idx;
    v.is_modified = true;
  });
  renderProductVariantsList();
}
window.setDefaultVariant = setDefaultVariant;

function formatAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return '';
  return Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join(', ');
}

function parseAttributesInput(str) {
  if (!str) return {};
  const attrs = {};
  str.split(',').forEach(pair => {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value) attrs[key] = value;
  });
  return attrs;
}
window.parseAttributesInput = parseAttributesInput;

function addProductVariant() {
  enableProductVariantsUI();
  productVariantsData.push({ 
    name: '', 
    sku: '', 
    price: null, 
    compare_at_price: null,
    stock_quantity: 0, 
    weight: null,
    image_url: null,
    attributes: {},
    is_active: true,
    is_default: !hasNonDeletedVariants(),
    sort_order: (productVariantsData || []).length,
    is_new: true 
  });
  renderProductVariantsList();
}
window.addProductVariant = addProductVariant;

function updateVariantField(idx, field, value) {
  if (productVariantsData[idx]) {
    productVariantsData[idx][field] = value;
    productVariantsData[idx].is_modified = true;
  }
}
window.updateVariantField = updateVariantField;

function removeProductVariant(idx) {
  if (productVariantsData[idx]) {
    if (productVariantsData[idx].id) {
      productVariantsData[idx].is_deleted = true;
    } else {
      productVariantsData.splice(idx, 1);
    }
    renderProductVariantsList();
  }
}
window.removeProductVariant = removeProductVariant;

async function saveProductVariants(productId) {
  const client = ensureSupabase();
  if (!client || !productId) return;

  const activeNonDeleted = (productVariantsData || []).filter(v => v && !v.is_deleted);
  if (activeNonDeleted.length) {
    const defaults = activeNonDeleted.filter(v => v.is_default);
    if (!defaults.length) {
      activeNonDeleted[0].is_default = true;
      activeNonDeleted[0].is_modified = true;
    } else if (defaults.length > 1) {
      let seen = false;
      activeNonDeleted.forEach(v => {
        if (!v.is_default) return;
        if (!seen) {
          seen = true;
          return;
        }
        v.is_default = false;
        v.is_modified = true;
      });
    }
  }
  
  for (const variant of productVariantsData) {
    if (variant.is_deleted && variant.id) {
      await client.from('shop_product_variants').delete().eq('id', variant.id);
    } else if (variant.is_new && !variant.is_deleted) {
      await client.from('shop_product_variants').insert({
        product_id: productId,
        name: variant.name,
        sku: variant.sku || null,
        price: variant.price !== null && variant.price !== undefined && !Number.isNaN(variant.price) ? variant.price : null,
        compare_at_price: variant.compare_at_price !== null && variant.compare_at_price !== undefined && !Number.isNaN(variant.compare_at_price) ? variant.compare_at_price : null,
        stock_quantity: Number.isFinite(variant.stock_quantity) ? variant.stock_quantity : 0,
        weight: variant.weight !== null && variant.weight !== undefined && !Number.isNaN(variant.weight) ? variant.weight : null,
        image_url: (variant.image_url || '').trim() || null,
        is_default: !!variant.is_default,
        is_active: variant.is_active !== false,
        sort_order: Number.isFinite(variant.sort_order) ? variant.sort_order : 0,
        attributes: variant.attributes || {}
      });
    } else if (variant.is_modified && variant.id) {
      await client.from('shop_product_variants').update({
        name: variant.name,
        sku: variant.sku || null,
        price: variant.price !== null && variant.price !== undefined && !Number.isNaN(variant.price) ? variant.price : null,
        compare_at_price: variant.compare_at_price !== null && variant.compare_at_price !== undefined && !Number.isNaN(variant.compare_at_price) ? variant.compare_at_price : null,
        stock_quantity: Number.isFinite(variant.stock_quantity) ? variant.stock_quantity : 0,
        weight: variant.weight !== null && variant.weight !== undefined && !Number.isNaN(variant.weight) ? variant.weight : null,
        image_url: (variant.image_url || '').trim() || null,
        is_default: !!variant.is_default,
        is_active: variant.is_active !== false,
        sort_order: Number.isFinite(variant.sort_order) ? variant.sort_order : 0,
        attributes: variant.attributes || {}
      }).eq('id', variant.id);
    }
  }
}

// =====================================================
// PRODUCT RELATIONSHIPS (Upsell/Cross-sell)
// Uses arrays on shop_products: upsell_product_ids, cross_sell_product_ids
// =====================================================

async function loadRelatedProductsOptions(excludeId = null) {
  const client = ensureSupabase();
  if (!client) return;
  
  const upsellSelect = document.getElementById('shopProductUpsell');
  const crossSellSelect = document.getElementById('shopProductCrossSell');
  
  if (!upsellSelect || !crossSellSelect) return;
  
  try {
    // For admin, fetch all products regardless of status
    let query = client.from('shop_products').select('id, name, price').order('name');
    if (excludeId) query = query.neq('id', excludeId);
    
    const { data: products } = await query;
    const options = (products || []).map(p => 
      `<option value="${p.id}">${escapeHtml(p.name)} (€${p.price})</option>`
    ).join('');
    
    upsellSelect.innerHTML = options;
    crossSellSelect.innerHTML = options;
  } catch (error) {
    console.error('Failed to load related products:', error);
  }
}

async function loadProductRelationships(productId) {
  const client = ensureSupabase();
  if (!client || !productId) return;
  
  try {
    // Get the product's upsell and cross-sell arrays
    const { data: product } = await client
      .from('shop_products')
      .select('upsell_product_ids, cross_sell_product_ids')
      .eq('id', productId)
      .single();
    
    if (!product) return;
    
    const upsellSelect = document.getElementById('shopProductUpsell');
    const crossSellSelect = document.getElementById('shopProductCrossSell');
    
    const upsellIds = product.upsell_product_ids || [];
    const crossSellIds = product.cross_sell_product_ids || [];
    
    if (upsellSelect) {
      Array.from(upsellSelect.options).forEach(opt => {
        opt.selected = upsellIds.includes(opt.value);
      });
    }
    if (crossSellSelect) {
      Array.from(crossSellSelect.options).forEach(opt => {
        opt.selected = crossSellIds.includes(opt.value);
      });
    }
  } catch (error) {
    console.error('Failed to load relationships:', error);
  }
}

function getSelectedProductRelationships() {
  // Get selected IDs from multi-selects (used in saveProduct)
  const upsellSelect = document.getElementById('shopProductUpsell');
  const crossSellSelect = document.getElementById('shopProductCrossSell');
  
  return {
    upsell_product_ids: upsellSelect ? Array.from(upsellSelect.selectedOptions).map(opt => opt.value) : [],
    cross_sell_product_ids: crossSellSelect ? Array.from(crossSellSelect.selectedOptions).map(opt => opt.value) : []
  };
}

// This function is no longer needed as relationships are saved with product
async function saveProductRelationships(productId) {
  // Relationships are now saved as part of productData in saveProduct()
  // This function is kept for backward compatibility but does nothing
  return;
}

// Product image upload functionality
function setupProductImageUpload() {
  const thumbnailFileInput = document.getElementById('shopProductThumbnailFile');
  const galleryFileInput = document.getElementById('shopProductGalleryFiles');

  if (thumbnailFileInput) {
    thumbnailFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadProductThumbnail(file);
    };
  }

  if (galleryFileInput) {
    galleryFileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      await uploadProductGalleryImages(files);
    };
  }
}

async function uploadProductThumbnail(file) {
  const client = ensureSupabase();
  if (!client) return;

  const preview = document.getElementById('shopProductThumbnailPreview');
  const urlInput = document.getElementById('shopProductThumbnail');

  try {
    preview.innerHTML = '<span style="color: var(--admin-text-muted);">Uploading...</span>';
    
    const compressed = await compressToWebp(file, 800, 800, 0.85);
    const path = `shop/products/${Date.now()}-thumb.webp`;
    
    const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp'
    });
    
    if (error) throw error;
    
    const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
    const url = pub?.publicUrl || '';
    
    urlInput.value = url;
    preview.innerHTML = `<img src="${url}" style="max-width: 150px; max-height: 150px; border-radius: 8px; object-fit: cover;">`;
    showToast('Thumbnail uploaded', 'success');
    
  } catch (err) {
    console.error('Thumbnail upload failed:', err);
    preview.innerHTML = `<span style="color: var(--admin-error);">Upload failed: ${err.message}</span>`;
  }
}

async function uploadProductGalleryImages(files) {
  const client = ensureSupabase();
  if (!client) return;

  const preview = document.getElementById('shopProductGalleryPreview');
  const imagesTextarea = document.getElementById('shopProductImages');
  
  const existingUrls = imagesTextarea.value.split('\n').filter(u => u.trim());
  
  preview.innerHTML = '<span style="color: var(--admin-text-muted);">Uploading images...</span>';

  const uploadedUrls = [];
  
  for (const file of files) {
    try {
      const compressed = await compressToWebp(file, 1200, 1200, 0.82);
      const path = `shop/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      
      const { error } = await client.storage.from('poi-photos').upload(path, compressed, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp'
      });
      
      if (error) {
        console.error('Gallery image upload failed:', error);
        continue;
      }
      
      const { data: pub } = client.storage.from('poi-photos').getPublicUrl(path);
      if (pub?.publicUrl) {
        uploadedUrls.push(pub.publicUrl);
      }
    } catch (err) {
      console.error('Gallery image upload failed:', err);
    }
  }

  // Update textarea with all URLs
  const allUrls = [...existingUrls, ...uploadedUrls];
  imagesTextarea.value = allUrls.join('\n');
  
  // Update preview
  renderGalleryPreview(allUrls);
  
  if (uploadedUrls.length > 0) {
    showToast(`${uploadedUrls.length} image(s) uploaded`, 'success');
  }
}

function renderGalleryPreview(urls) {
  const preview = document.getElementById('shopProductGalleryPreview');
  if (!preview) return;
  
  if (!urls || urls.length === 0) {
    preview.innerHTML = '';
    return;
  }
  
  preview.innerHTML = urls.map((url, i) => `
    <div style="position: relative; display: inline-block;">
      <img src="${url}" style="width: 80px; height: 80px; border-radius: 4px; object-fit: cover;">
      <button type="button" onclick="removeGalleryImage(${i})" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--admin-error); color: white; border: none; cursor: pointer; font-size: 12px;">×</button>
    </div>
  `).join('');
}

function removeGalleryImage(index) {
  const textarea = document.getElementById('shopProductImages');
  const urls = textarea.value.split('\n').filter(u => u.trim());
  urls.splice(index, 1);
  textarea.value = urls.join('\n');
  renderGalleryPreview(urls);
}
window.removeGalleryImage = removeGalleryImage;

async function saveProduct() {
  const client = ensureSupabase();
  if (!client) return;

  const errorEl = document.getElementById('shopProductFormError');
  errorEl.hidden = true;

  const productId = document.getElementById('shopProductId').value;
  const name = document.getElementById('shopProductName').value.trim();
  const price = parseFloat(document.getElementById('shopProductPrice').value);

  if (!name || isNaN(price)) {
    errorEl.textContent = 'Name and price are required';
    errorEl.hidden = false;
    return;
  }

  const tagsInput = document.getElementById('shopProductTags').value;
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Generate slug if not provided
  const slugInput = document.getElementById('shopProductSlug').value.trim();
  const slug = slugInput || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const productData = {
    name,
    name_en: document.getElementById('shopProductNameEn').value.trim() || null,
    slug,
    description: document.getElementById('shopProductDescription').value.trim() || null,
    description_en: document.getElementById('shopProductDescriptionEn').value.trim() || null,
    short_description: document.getElementById('shopProductShortDesc').value.trim() || null,
    short_description_en: document.getElementById('shopProductShortDescEn').value.trim() || null,
    // Organization
    sku: document.getElementById('shopProductSku').value.trim() || null,
    category_id: document.getElementById('shopProductCategory').value || null,
    vendor_id: document.getElementById('shopProductVendor').value || null,
    status: document.getElementById('shopProductStatus').value,
    product_type: document.getElementById('shopProductType').value,
    // Pricing
    price,
    compare_at_price: parseFloat(document.getElementById('shopProductComparePrice').value) || null,
    cost_price: parseFloat(document.getElementById('shopProductCost').value) || null,
    sale_price: parseFloat(document.getElementById('shopProductSalePrice').value) || null,
    sale_start_date: document.getElementById('shopProductSaleStart').value || null,
    sale_end_date: document.getElementById('shopProductSaleEnd').value || null,
    tax_class_id: document.getElementById('shopProductTaxClass').value || null,
    tax_price_mode: document.getElementById('shopProductTaxPriceMode')?.value || 'inherit',
    // Inventory
    track_inventory: document.getElementById('shopProductTrackInventory').checked,
    allow_backorder: document.getElementById('shopProductAllowBackorder').checked,
    stock_quantity: parseInt(document.getElementById('shopProductStock').value) || 0,
    low_stock_threshold: parseInt(document.getElementById('shopProductLowStock').value) || 5,
    min_purchase_quantity: parseInt(document.getElementById('shopProductMinQty').value) || 1,
    max_purchase_quantity: parseInt(document.getElementById('shopProductMaxQty').value) || null,
    // Shipping
    is_virtual: !document.getElementById('shopProductRequiresShipping').checked,
    weight: parseFloat(document.getElementById('shopProductWeight').value) || null,
    shipping_class_id: document.getElementById('shopProductShippingClass').value || null,
    length: parseFloat(document.getElementById('shopProductLength').value) || null,
    width: parseFloat(document.getElementById('shopProductWidth').value) || null,
    height: parseFloat(document.getElementById('shopProductHeight').value) || null,
    // Flags
    is_featured: document.getElementById('shopProductFeatured').checked,
    is_bestseller: document.getElementById('shopProductBestseller').checked,
    is_new: document.getElementById('shopProductNew').checked,
    is_on_sale: document.getElementById('shopProductOnSale').checked,
    // Media
    thumbnail_url: document.getElementById('shopProductThumbnail').value.trim() || null,
    images: parseImageUrls(document.getElementById('shopProductImages').value),
    video_url: document.getElementById('shopProductVideo').value.trim() || null,
    tags,
    // Digital product fields
    digital_file_url: document.getElementById('shopProductDigitalUrl')?.value.trim() || null,
    digital_file_name: document.getElementById('shopProductDigitalFileName')?.value.trim() || null,
    download_limit: parseInt(document.getElementById('shopProductDownloadLimit')?.value) || null,
    download_expiry_days: parseInt(document.getElementById('shopProductDownloadExpiry')?.value) || null,
    // Subscription fields
    subscription_interval: document.getElementById('shopProductSubInterval')?.value || null,
    subscription_interval_count: parseInt(document.getElementById('shopProductSubIntervalCount')?.value) || 1,
    subscription_trial_days: parseInt(document.getElementById('shopProductSubTrialDays')?.value) || 0,
    subscription_signup_fee: parseFloat(document.getElementById('shopProductSubSignupFee')?.value) || 0,
    // Related products (upsell/cross-sell) - stored as arrays
    ...getSelectedProductRelationships()
  };

  if (hasNonDeletedVariants() && productData.product_type !== 'variable') {
    productData.product_type = 'variable';
    const typeSelect = document.getElementById('shopProductType');
    if (typeSelect) typeSelect.value = 'variable';
    updateProductFormSections('variable');
  }

  // Helper function to parse image URLs from textarea
  function parseImageUrls(text) {
    if (!text) return [];
    return text.split('\n').map(url => url.trim()).filter(Boolean);
  }

  try {
    let error, savedProductId = productId, result;
    if (productId) {
      ({ error } = await client.from('shop_products').update(productData).eq('id', productId));
    } else {
      ({ data: result, error } = await client.from('shop_products').insert(productData).select().single());
      if (result) savedProductId = result.id;
    }

    if (error) throw error;

    // Save variants if any changes exist (also covers create flow before product has an id)
    if (savedProductId && (productData.product_type === 'variable' || hasVariantChanges())) {
      await saveProductVariants(savedProductId);
    }
    // Note: upsell/cross-sell are now saved as arrays directly in productData

    showToast(productId ? 'Produkt zaktualizowany' : 'Produkt utworzony', 'success');
    document.getElementById('shopProductModal').hidden = true;
    await loadShopProducts();
    await loadShopStats();

  } catch (error) {
    console.error('Failed to save product:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

// =====================================================
// SHOP CATEGORY FORM
// =====================================================

async function showCategoryForm(categoryId = null) {
  const modal = document.getElementById('shopCategoryModal');
  const title = document.getElementById('shopCategoryModalTitle');
  const form = document.getElementById('shopCategoryForm');
  
  if (!modal || !form) return;
  
  form.reset();
  document.getElementById('shopCategoryId').value = '';
  document.getElementById('shopCategoryFormError').hidden = true;
  
  await loadCategoryParentDropdown(categoryId);
  
  // Reset to Polish tab
  switchCategoryLang('pl');
  
  if (categoryId) {
    title.textContent = 'Edytuj kategorię';
    await loadCategoryData(categoryId);
  } else {
    title.textContent = 'Nowa kategoria';
  }
  
  modal.hidden = false;
  setupCategoryFormListeners();
}

async function loadCategoryParentDropdown(excludeId = null) {
  const client = ensureSupabase();
  if (!client) return;

  const select = document.getElementById('shopCategoryParent');
  if (!select) return;

  let query = client.from('shop_categories').select('id, name').order('name');
  if (excludeId) query = query.neq('id', excludeId);

  const { data: categories } = await query;
  select.innerHTML = '<option value="">None (Top Level)</option>' + 
    (categories || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

async function loadCategoryData(categoryId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: category, error } = await client
      .from('shop_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error) throw error;
    if (!category) return;

    document.getElementById('shopCategoryId').value = category.id;
    // Polish fields
    document.getElementById('shopCategoryName').value = category.name || '';
    document.getElementById('shopCategoryDescription').value = category.description || '';
    // English fields
    document.getElementById('shopCategoryNameEn').value = category.name_en || '';
    document.getElementById('shopCategoryDescriptionEn').value = category.description_en || '';
    // Common fields
    document.getElementById('shopCategorySlug').value = category.slug || '';
    document.getElementById('shopCategoryParent').value = category.parent_id || '';
    document.getElementById('shopCategorySortOrder').value = category.sort_order || 0;
    // Image
    document.getElementById('shopCategoryImage').value = category.image_url || '';
    updateCategoryImagePreview(category.image_url);
    // Icon & visibility
    document.getElementById('shopCategoryIcon').value = category.icon || '';
    document.getElementById('shopCategoryActive').checked = category.is_active !== false;
    document.getElementById('shopCategoryFeatured').checked = category.is_featured === true;
    document.getElementById('shopCategoryShowInMenu').checked = category.show_in_menu !== false;
    // SEO
    document.getElementById('shopCategoryMetaTitle').value = category.meta_title || '';
    document.getElementById('shopCategoryMetaDesc').value = category.meta_description || '';

  } catch (error) {
    console.error('Failed to load category:', error);
  }
}

function updateCategoryImagePreview(url) {
  const preview = document.getElementById('shopCategoryImagePreview');
  if (!preview) return;
  
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 120px; max-height: 80px; border-radius: 6px; object-fit: cover;">`;
  } else {
    preview.innerHTML = '';
  }
}

function clearCategoryImage() {
  document.getElementById('shopCategoryImage').value = '';
  document.getElementById('shopCategoryImageFile').value = '';
  updateCategoryImagePreview('');
}
window.clearCategoryImage = clearCategoryImage;

function setupCategoryFormListeners() {
  const modal = document.getElementById('shopCategoryModal');
  const form = document.getElementById('shopCategoryForm');
  const closeBtn = document.getElementById('btnCloseShopCategoryModal');
  const cancelBtn = document.getElementById('shopCategoryFormCancel');
  const overlay = document.getElementById('shopCategoryModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  // Image URL input - update preview on change
  const imageUrlInput = document.getElementById('shopCategoryImage');
  if (imageUrlInput) {
    imageUrlInput.oninput = () => updateCategoryImagePreview(imageUrlInput.value);
  }

  // Image file upload handler
  const imageFileInput = document.getElementById('shopCategoryImageFile');
  if (imageFileInput) {
    imageFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Upload to Supabase Storage
      const client = ensureSupabase();
      if (!client) return;
      
      const fileName = `category-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await client.storage
        .from('shop-images')
        .upload(`categories/${fileName}`, file);
      
      if (error) {
        showToast(`Błąd uploadu: ${error.message}`, 'error');
        return;
      }
      
      // Get public URL
      const { data: urlData } = client.storage.from('shop-images').getPublicUrl(`categories/${fileName}`);
      const publicUrl = urlData.publicUrl;
      
      document.getElementById('shopCategoryImage').value = publicUrl;
      updateCategoryImagePreview(publicUrl);
      showToast('Obraz przesłany', 'success');
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveCategory();
  };
}

async function saveCategory() {
  const client = ensureSupabase();
  if (!client) return;

  const errorEl = document.getElementById('shopCategoryFormError');
  errorEl.hidden = true;

  const categoryId = document.getElementById('shopCategoryId').value;
  const name = document.getElementById('shopCategoryName').value.trim();

  if (!name) {
    errorEl.textContent = 'Nazwa kategorii jest wymagana';
    errorEl.hidden = false;
    return;
  }

  const slug = document.getElementById('shopCategorySlug').value.trim() || 
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const categoryData = {
    name,
    name_en: document.getElementById('shopCategoryNameEn').value.trim() || null,
    slug,
    description: document.getElementById('shopCategoryDescription').value.trim() || null,
    description_en: document.getElementById('shopCategoryDescriptionEn').value.trim() || null,
    parent_id: document.getElementById('shopCategoryParent').value || null,
    sort_order: parseInt(document.getElementById('shopCategorySortOrder').value) || 0,
    image_url: document.getElementById('shopCategoryImage').value.trim() || null,
    icon: document.getElementById('shopCategoryIcon').value.trim() || null,
    is_active: document.getElementById('shopCategoryActive').checked,
    is_featured: document.getElementById('shopCategoryFeatured').checked,
    show_in_menu: document.getElementById('shopCategoryShowInMenu').checked,
    meta_title: document.getElementById('shopCategoryMetaTitle').value.trim() || null,
    meta_description: document.getElementById('shopCategoryMetaDesc').value.trim() || null
  };

  try {
    let error;
    if (categoryId) {
      ({ error } = await client.from('shop_categories').update(categoryData).eq('id', categoryId));
    } else {
      ({ error } = await client.from('shop_categories').insert(categoryData));
    }

    if (error) throw error;

    showToast(categoryId ? 'Kategoria zaktualizowana' : 'Kategoria utworzona', 'success');
    document.getElementById('shopCategoryModal').hidden = true;
    await loadShopCategories();

  } catch (error) {
    console.error('Failed to save category:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

// =====================================================
// SHOP VENDOR FORM
// =====================================================

async function showVendorForm(vendorId = null) {
  const modal = document.getElementById('shopVendorModal');
  const title = document.getElementById('shopVendorModalTitle');
  const form = document.getElementById('shopVendorForm');
  
  if (!modal || !form) return;
  
  form.reset();
  document.getElementById('shopVendorId').value = '';
  document.getElementById('shopVendorFormError').hidden = true;
  
  // Reset to Polish tab
  switchVendorLang('pl');
  
  if (vendorId) {
    title.textContent = 'Edytuj vendora';
    await loadVendorData(vendorId);
  } else {
    title.textContent = 'Nowy vendor';
  }
  
  modal.hidden = false;
  setupVendorFormListeners();
}

async function loadVendorData(vendorId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: vendor, error } = await client
      .from('shop_vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) throw error;
    if (!vendor) return;

    document.getElementById('shopVendorId').value = vendor.id;
    // Polish fields
    document.getElementById('shopVendorName').value = vendor.name || '';
    document.getElementById('shopVendorDescription').value = vendor.description || '';
    // English fields
    document.getElementById('shopVendorNameEn').value = vendor.name_en || '';
    document.getElementById('shopVendorDescriptionEn').value = vendor.description_en || '';
    // Common fields
    document.getElementById('shopVendorSlug').value = vendor.slug || '';
    document.getElementById('shopVendorEmail').value = vendor.contact_email || '';
    document.getElementById('shopVendorPhone').value = vendor.contact_phone || '';
    document.getElementById('shopVendorCommission').value = vendor.commission_rate || 0;
    document.getElementById('shopVendorWebsite').value = vendor.website_url || '';
    // Logo & Banner
    document.getElementById('shopVendorLogo').value = vendor.logo_url || '';
    updateVendorLogoPreview(vendor.logo_url);
    document.getElementById('shopVendorBanner').value = vendor.banner_url || '';
    updateVendorBannerPreview(vendor.banner_url);
    // Address
    document.getElementById('shopVendorContactName').value = vendor.contact_name || '';
    document.getElementById('shopVendorCity').value = vendor.city || '';
    document.getElementById('shopVendorAddress').value = vendor.address || '';
    // Bank info
    document.getElementById('shopVendorBankName').value = vendor.bank_name || '';
    document.getElementById('shopVendorIban').value = vendor.bank_iban || '';
    document.getElementById('shopVendorSwift').value = vendor.bank_swift || '';
    // Status
    document.getElementById('shopVendorActive').checked = vendor.is_active !== false;
    document.getElementById('shopVendorFeatured').checked = vendor.is_featured === true;

  } catch (error) {
    console.error('Failed to load vendor:', error);
  }
}

function updateVendorLogoPreview(url) {
  const preview = document.getElementById('shopVendorLogoPreview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="Logo" style="max-width: 80px; max-height: 80px; border-radius: 6px; object-fit: contain; background: white; padding: 4px;">`;
  } else {
    preview.innerHTML = '';
  }
}

function updateVendorBannerPreview(url) {
  const preview = document.getElementById('shopVendorBannerPreview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="Banner" style="max-width: 200px; max-height: 60px; border-radius: 6px; object-fit: cover;">`;
  } else {
    preview.innerHTML = '';
  }
}

function clearVendorLogo() {
  document.getElementById('shopVendorLogo').value = '';
  document.getElementById('shopVendorLogoFile').value = '';
  updateVendorLogoPreview('');
}
window.clearVendorLogo = clearVendorLogo;

function clearVendorBanner() {
  document.getElementById('shopVendorBanner').value = '';
  document.getElementById('shopVendorBannerFile').value = '';
  updateVendorBannerPreview('');
}
window.clearVendorBanner = clearVendorBanner;

function setupVendorFormListeners() {
  const modal = document.getElementById('shopVendorModal');
  const form = document.getElementById('shopVendorForm');
  const closeBtn = document.getElementById('btnCloseShopVendorModal');
  const cancelBtn = document.getElementById('shopVendorFormCancel');
  const overlay = document.getElementById('shopVendorModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  // Logo URL input - update preview on change
  const logoUrlInput = document.getElementById('shopVendorLogo');
  if (logoUrlInput) {
    logoUrlInput.oninput = () => updateVendorLogoPreview(logoUrlInput.value);
  }

  // Banner URL input - update preview on change
  const bannerUrlInput = document.getElementById('shopVendorBanner');
  if (bannerUrlInput) {
    bannerUrlInput.oninput = () => updateVendorBannerPreview(bannerUrlInput.value);
  }

  // Logo file upload handler
  const logoFileInput = document.getElementById('shopVendorLogoFile');
  if (logoFileInput) {
    logoFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const client = ensureSupabase();
      if (!client) return;
      
      const fileName = `vendor-logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await client.storage
        .from('shop-images')
        .upload(`vendors/${fileName}`, file);
      
      if (error) {
        showToast(`Błąd uploadu: ${error.message}`, 'error');
        return;
      }
      
      const { data: urlData } = client.storage.from('shop-images').getPublicUrl(`vendors/${fileName}`);
      document.getElementById('shopVendorLogo').value = urlData.publicUrl;
      updateVendorLogoPreview(urlData.publicUrl);
      showToast('Logo przesłane', 'success');
    };
  }

  // Banner file upload handler
  const bannerFileInput = document.getElementById('shopVendorBannerFile');
  if (bannerFileInput) {
    bannerFileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const client = ensureSupabase();
      if (!client) return;
      
      const fileName = `vendor-banner-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await client.storage
        .from('shop-images')
        .upload(`vendors/${fileName}`, file);
      
      if (error) {
        showToast(`Błąd uploadu: ${error.message}`, 'error');
        return;
      }
      
      const { data: urlData } = client.storage.from('shop-images').getPublicUrl(`vendors/${fileName}`);
      document.getElementById('shopVendorBanner').value = urlData.publicUrl;
      updateVendorBannerPreview(urlData.publicUrl);
      showToast('Banner przesłany', 'success');
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveVendor();
  };
}

async function saveVendor() {
  const client = ensureSupabase();
  if (!client) return;

  const errorEl = document.getElementById('shopVendorFormError');
  errorEl.hidden = true;

  const vendorId = document.getElementById('shopVendorId').value;
  const name = document.getElementById('shopVendorName').value.trim();

  if (!name) {
    errorEl.textContent = 'Nazwa dostawcy jest wymagana';
    errorEl.hidden = false;
    return;
  }

  const slug = document.getElementById('shopVendorSlug').value.trim() || 
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const vendorData = {
    name,
    name_en: document.getElementById('shopVendorNameEn').value.trim() || null,
    slug,
    description: document.getElementById('shopVendorDescription').value.trim() || null,
    description_en: document.getElementById('shopVendorDescriptionEn').value.trim() || null,
    contact_email: document.getElementById('shopVendorEmail').value.trim() || null,
    contact_phone: document.getElementById('shopVendorPhone').value.trim() || null,
    website_url: document.getElementById('shopVendorWebsite').value.trim() || null,
    commission_rate: parseFloat(document.getElementById('shopVendorCommission').value) || 0,
    // Images
    logo_url: document.getElementById('shopVendorLogo').value.trim() || null,
    banner_url: document.getElementById('shopVendorBanner').value.trim() || null,
    // Address
    contact_name: document.getElementById('shopVendorContactName').value.trim() || null,
    city: document.getElementById('shopVendorCity').value.trim() || null,
    address: document.getElementById('shopVendorAddress').value.trim() || null,
    // Bank info
    bank_name: document.getElementById('shopVendorBankName').value.trim() || null,
    bank_iban: document.getElementById('shopVendorIban').value.trim() || null,
    bank_swift: document.getElementById('shopVendorSwift').value.trim() || null,
    // Status
    is_active: document.getElementById('shopVendorActive').checked,
    is_featured: document.getElementById('shopVendorFeatured').checked
  };

  try {
    let error;
    if (vendorId) {
      ({ error } = await client.from('shop_vendors').update(vendorData).eq('id', vendorId));
    } else {
      ({ error } = await client.from('shop_vendors').insert(vendorData));
    }

    if (error) throw error;

    showToast(vendorId ? 'Dostawca zaktualizowany' : 'Dostawca utworzony', 'success');
    document.getElementById('shopVendorModal').hidden = true;
    await loadShopVendors();

  } catch (error) {
    console.error('Failed to save vendor:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

// =====================================================
// SHOP DISCOUNT FORM
// =====================================================

async function showDiscountForm(discountId = null) {
  const modal = document.getElementById('shopDiscountModal');
  const title = document.getElementById('shopDiscountModalTitle');
  const form = document.getElementById('shopDiscountForm');
  
  if (!modal || !form) return;
  
  form.reset();
  document.getElementById('shopDiscountId').value = '';
  document.getElementById('shopDiscountFormError').hidden = true;
  
  // Reset to Polish tab
  switchDiscountLang('pl');
  
  if (discountId) {
    title.textContent = 'Edytuj rabat';
    await loadDiscountData(discountId);
  } else {
    title.textContent = 'Nowy rabat';
  }
  
  modal.hidden = false;
  setupDiscountFormListeners();
}

async function loadDiscountData(discountId) {
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: discount, error } = await client
      .from('shop_discounts')
      .select('*')
      .eq('id', discountId)
      .single();

    if (error) throw error;
    if (!discount) return;

    document.getElementById('shopDiscountId').value = discount.id;
    document.getElementById('shopDiscountCode').value = discount.code || '';
    // Polish fields
    document.getElementById('shopDiscountDescription').value = discount.description || '';
    // English fields
    document.getElementById('shopDiscountDescriptionEn').value = discount.description_en || '';
    document.getElementById('shopDiscountType').value = discount.discount_type || 'percentage';
    document.getElementById('shopDiscountValue').value = discount.discount_value || '';
    document.getElementById('shopDiscountMinOrder').value = discount.minimum_order_amount || '';
    document.getElementById('shopDiscountMaxDiscount').value = discount.maximum_discount_amount || '';
    document.getElementById('shopDiscountUsageLimit').value = discount.usage_limit || '';
    document.getElementById('shopDiscountPerUserLimit').value = discount.usage_limit_per_user || 1;
    // Advanced options
    document.getElementById('shopDiscountAppliesTo').value = discount.applies_to || 'all';
    document.getElementById('shopDiscountInternalNote').value = discount.description_internal || '';
    document.getElementById('shopDiscountActive').checked = discount.is_active !== false;
    document.getElementById('shopDiscountFirstPurchase').checked = discount.first_purchase_only === true;
    document.getElementById('shopDiscountExcludeSale').checked = discount.exclude_sale_items === true;
    document.getElementById('shopDiscountStackable').checked = discount.is_stackable === true;
    document.getElementById('shopDiscountAutoApply').checked = discount.is_auto_apply === true;

    if (discount.starts_at) {
      document.getElementById('shopDiscountStartDate').value = discount.starts_at.slice(0, 16);
    }
    if (discount.expires_at) {
      document.getElementById('shopDiscountExpiryDate').value = discount.expires_at.slice(0, 16);
    }

  } catch (error) {
    console.error('Failed to load discount:', error);
  }
}

function setupDiscountFormListeners() {
  const modal = document.getElementById('shopDiscountModal');
  const form = document.getElementById('shopDiscountForm');
  const closeBtn = document.getElementById('btnCloseShopDiscountModal');
  const cancelBtn = document.getElementById('shopDiscountFormCancel');
  const overlay = document.getElementById('shopDiscountModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
  overlay.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveDiscount();
  };
}

async function saveDiscount() {
  const client = ensureSupabase();
  if (!client) return;

  const errorEl = document.getElementById('shopDiscountFormError');
  errorEl.hidden = true;

  const discountId = document.getElementById('shopDiscountId').value;
  const code = document.getElementById('shopDiscountCode').value.trim().toUpperCase();

  if (!code) {
    errorEl.textContent = 'Discount code is required';
    errorEl.hidden = false;
    return;
  }

  const startDate = document.getElementById('shopDiscountStartDate').value;
  const expiryDate = document.getElementById('shopDiscountExpiryDate').value;

  const discountData = {
    code,
    description: document.getElementById('shopDiscountDescription').value.trim() || null,
    description_en: document.getElementById('shopDiscountDescriptionEn').value.trim() || null,
    discount_type: document.getElementById('shopDiscountType').value,
    discount_value: parseFloat(document.getElementById('shopDiscountValue').value) || 0,
    minimum_order_amount: parseFloat(document.getElementById('shopDiscountMinOrder').value) || null,
    maximum_discount_amount: parseFloat(document.getElementById('shopDiscountMaxDiscount').value) || null,
    usage_limit: parseInt(document.getElementById('shopDiscountUsageLimit').value) || null,
    usage_limit_per_user: parseInt(document.getElementById('shopDiscountPerUserLimit').value) || 1,
    starts_at: startDate ? new Date(startDate).toISOString() : null,
    expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
    // Advanced options
    applies_to: document.getElementById('shopDiscountAppliesTo').value || 'all',
    description_internal: document.getElementById('shopDiscountInternalNote').value.trim() || null,
    is_active: document.getElementById('shopDiscountActive').checked,
    first_purchase_only: document.getElementById('shopDiscountFirstPurchase').checked,
    exclude_sale_items: document.getElementById('shopDiscountExcludeSale').checked,
    is_stackable: document.getElementById('shopDiscountStackable').checked,
    is_auto_apply: document.getElementById('shopDiscountAutoApply').checked
  };

  try {
    let error;
    if (discountId) {
      ({ error } = await client.from('shop_discounts').update(discountData).eq('id', discountId));
    } else {
      ({ error } = await client.from('shop_discounts').insert(discountData));
    }

    if (error) throw error;

    showToast(discountId ? 'Rabat zaktualizowany' : 'Rabat utworzony', 'success');
    document.getElementById('shopDiscountModal').hidden = true;
    await loadShopDiscounts();

  } catch (error) {
    console.error('Failed to save discount:', error);
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

// =====================================================
// SHOP ORDER DETAILS
// =====================================================

async function viewShopOrder(orderId) {
  const modal = document.getElementById('shopOrderModal');
  const title = document.getElementById('shopOrderModalTitle');
  const content = document.getElementById('shopOrderModalContent');
  
  if (!modal) return;
  
  content.innerHTML = '<p style="text-align: center;">Ładowanie zamówienia...</p>';
  modal.hidden = false;
  
  setupOrderModalListeners();
  
  const client = ensureSupabase();
  if (!client) return;

  try {
    const { data: order, error } = await client
      .from('shop_orders')
      .select(`
        *,
        items:shop_order_items(
          *,
          product:shop_products(name, thumbnail_url)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    if (!order) throw new Error('Zamówienie nie znalezione');

    let fulfillments = [];
    try {
      const { data: fData, error: fError } = await client
        .from('shop_order_fulfillments')
        .select('id, status, partner_id, vendor_id, sla_deadline_at, accepted_at, rejected_at, rejected_reason, contact_revealed_at, partner:partners(name), vendor:shop_vendors(name)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (!fError) {
        fulfillments = fData || [];
      }
    } catch (_e) {
      fulfillments = [];
    }

    const partnerAcceptanceStatus = (order.partner_acceptance_status || 'none');
    const partnerAcceptanceLabel = partnerAcceptanceStatus === 'pending'
      ? '⏳ pending'
      : partnerAcceptanceStatus === 'accepted'
        ? '✅ accepted'
        : partnerAcceptanceStatus === 'rejected'
          ? '❌ rejected'
          : '—';
    const partnerAcceptanceColors = {
      none: '#6b7280',
      pending: '#f59e0b',
      accepted: '#22c55e',
      rejected: '#ef4444'
    };

    const fulfillmentsHtml = (() => {
      if (!Array.isArray(fulfillments) || !fulfillments.length) {
        return '<p style="color: var(--admin-text-muted); margin: 0;">No partner fulfillments for this order.</p>';
      }

      const rows = fulfillments.map(f => {
        const status = String(f.status || '');
        const badgeColor = status === 'pending_acceptance'
          ? '#f59e0b'
          : status === 'accepted'
            ? '#22c55e'
            : status === 'rejected'
              ? '#ef4444'
              : '#6b7280';
        const partnerName = (f.partner && f.partner.name) ? f.partner.name : (f.vendor && f.vendor.name) ? f.vendor.name : (f.partner_id ? String(f.partner_id).slice(0, 8) : '—');
        const deadline = f.sla_deadline_at ? new Date(f.sla_deadline_at).toLocaleString('pl-PL') : '—';
        const acceptedAt = f.accepted_at ? new Date(f.accepted_at).toLocaleString('pl-PL') : '—';
        const rejectedAt = f.rejected_at ? new Date(f.rejected_at).toLocaleString('pl-PL') : '—';

        return `
          <tr>
            <td>${escapeHtml(partnerName)}</td>
            <td><span class="badge" style="background: ${badgeColor};">${escapeHtml(status)}</span></td>
            <td style="white-space: nowrap;">${escapeHtml(deadline)}</td>
            <td style="white-space: nowrap;">${escapeHtml(acceptedAt)}</td>
            <td style="white-space: nowrap;">${escapeHtml(rejectedAt)}</td>
            <td>${escapeHtml(f.rejected_reason || '')}</td>
          </tr>
        `;
      }).join('');

      return `
        <table class="admin-table" style="margin-top: 12px;">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Status</th>
              <th>SLA deadline</th>
              <th>Accepted at</th>
              <th>Rejected at</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    })();

    title.textContent = `Zamówienie ${order.order_number}`;

    const statusLabels = {
      pending: '⏳ Oczekujące',
      confirmed: '✅ Potwierdzone', 
      processing: '🔄 W realizacji',
      shipped: '📦 Wysłane',
      delivered: '✅ Dostarczone',
      completed: '🎉 Zakończone',
      cancelled: '❌ Anulowane'
    };
    const paymentLabels = {
      unpaid: '💳 Nieopłacone',
      pending: '⏳ Oczekuje',
      paid: '✅ Opłacone',
      partially_refunded: '↩️ Częściowy zwrot',
      refunded: '↩️ Zwrócone',
      failed: '❌ Błąd płatności'
    };
    const statusOptions = Object.keys(statusLabels);
    const paymentStatusOptions = Object.keys(paymentLabels);

    content.innerHTML = `
      <!-- Quick Actions Bar -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--admin-border);">
        <button class="btn-secondary" onclick="printOrder('${order.id}')" style="font-size: 13px;">🖨️ Drukuj</button>
        <button class="btn-secondary" onclick="sendOrderEmail('${order.id}')" style="font-size: 13px;">📧 Wyślij email</button>
        ${order.status === 'shipped' || order.status === 'processing' ? `
          <button class="btn-secondary" onclick="addTrackingInfo('${order.id}')" style="font-size: 13px;">📍 Dodaj tracking</button>
        ` : ''}
        ${order.payment_status === 'paid' ? `
          <button class="btn-secondary" onclick="initiateRefund('${order.id}')" style="font-size: 13px; color: #ef4444;">↩️ Zwrot</button>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;">
        <div style="padding: 16px; background: var(--admin-bg); border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 13px; color: var(--admin-text-muted);">👤 Klient</h4>
          <p style="margin: 0; font-weight: 600;">${escapeHtml(order.customer_name || 'Gość')}</p>
          <p style="margin: 4px 0;">${escapeHtml(order.customer_email || '-')}</p>
          ${order.customer_phone ? `<p style="margin: 0;">📞 ${escapeHtml(order.customer_phone)}</p>` : ''}
        </div>
        <div style="padding: 16px; background: var(--admin-bg); border-radius: 8px;">
          <h4 style="margin: 0 0 12px; font-size: 13px; color: var(--admin-text-muted);">📍 Adres dostawy</h4>
          ${order.shipping_address ? `
            <p style="margin: 0;">${escapeHtml(order.shipping_address.line1 || '')}</p>
            ${order.shipping_address.line2 ? `<p style="margin: 2px 0;">${escapeHtml(order.shipping_address.line2)}</p>` : ''}
            <p style="margin: 2px 0;">${escapeHtml(order.shipping_address.postal_code || '')} ${escapeHtml(order.shipping_address.city || '')}</p>
            <p style="margin: 0; font-weight: 500;">${escapeHtml(order.shipping_address.country || '')}</p>
          ` : '<p style="color: var(--admin-text-muted); margin: 0;">Brak adresu</p>'}
        </div>
        ${renderOrderShippingInfo(order)}
      </div>

      <!-- Tracking Info -->
      ${order.tracking_number ? `
        <div style="margin: 16px 0; padding: 12px 16px; background: #dbeafe; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">📦</span>
          <div>
            <p style="margin: 0; font-size: 12px; color: #1e40af;">Numer przesyłki</p>
            <p style="margin: 0; font-weight: 600; color: #1e40af;">${escapeHtml(order.tracking_number)}</p>
          </div>
          ${order.tracking_url ? `<a href="${order.tracking_url}" target="_blank" style="margin-left: auto; color: #1e40af;">Śledź →</a>` : ''}
        </div>
      ` : ''}

      <div style="margin: 20px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <label class="admin-form-field">
            <span>Status zamówienia</span>
            <select id="orderStatusSelect" class="form-control">
              ${statusOptions.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
            </select>
          </label>
        </div>
        <div>
          <label class="admin-form-field">
            <span>Status płatności</span>
            <select id="orderPaymentStatusSelect" class="form-control">
              ${paymentStatusOptions.map(s => `<option value="${s}" ${order.payment_status === s ? 'selected' : ''}>${paymentLabels[s]}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <div style="margin: 12px 0 20px; padding: 16px; background: var(--admin-bg); border-radius: 8px;">
        <h4 style="margin: 0 0 10px; font-size: 13px; color: var(--admin-text-muted);">🤝 Partner acceptance</h4>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="badge" style="background: ${partnerAcceptanceColors[partnerAcceptanceStatus] || '#6b7280'};">${escapeHtml(partnerAcceptanceLabel)}</span>
          <small style="color: var(--admin-text-muted);">
            ${order.partner_acceptance_updated_at ? `updated: ${new Date(order.partner_acceptance_updated_at).toLocaleString('pl-PL')}` : ''}
          </small>
        </div>
        <div style="margin-top: 12px;">
          ${fulfillmentsHtml}
        </div>
      </div>

      <!-- Order Notes -->
      <div style="margin-bottom: 20px;">
        <label class="admin-form-field">
          <span>Notatki do zamówienia</span>
          <textarea id="orderNotes" rows="2" placeholder="Wewnętrzne notatki...">${escapeHtml(order.admin_notes || '')}</textarea>
        </label>
      </div>

      <h4 style="margin: 16px 0 12px; font-size: 14px;">📦 Produkty</h4>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Produkt</th>
            <th style="text-align: center;">Ilość</th>
            <th style="text-align: right;">Cena</th>
            <th style="text-align: right;">Razem</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || []).map(item => {
            const unitPrice = Number(item.unit_price) || 0;
            const quantity = Number(item.quantity) || 0;
            const rowTotal = Number(
              item.subtotal ??
              (Number(item.unit_price) || 0) * quantity
            ) || 0;
            return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                  ${item.product?.thumbnail_url ? `<img src="${item.product.thumbnail_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : '<div style="width: 40px; height: 40px; background: var(--admin-bg); border-radius: 4px;"></div>'}
                  <div>
                    <span style="font-weight: 500;">${escapeHtml(item.product?.name || item.product_name || 'Nieznany')}</span>
                    ${item.variant_name ? `<br><small style="color: var(--admin-text-muted);">${escapeHtml(item.variant_name)}</small>` : ''}
                  </div>
                </div>
              </td>
              <td style="text-align: center;">${quantity}</td>
              <td style="text-align: right;">${formatCurrencyEUR(unitPrice)}</td>
              <td style="text-align: right; font-weight: 500;">${formatCurrencyEUR(rowTotal)}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; padding: 16px; background: var(--admin-bg); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Produkty:</span>
          <span>${formatCurrencyEUR(order.subtotal)}</span>
        </div>
        ${order.discount_amount ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #22c55e;">
            <span>Rabat${order.discount_code ? ` (${order.discount_code})` : ''}:</span>
            <span>-${formatCurrencyEUR(order.discount_amount)}</span>
          </div>
        ` : ''}
        ${order.shipping_cost ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Dostawa:</span>
            <span>${formatCurrencyEUR(order.shipping_cost)}</span>
          </div>
        ` : ''}
        ${order.tax_amount ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>VAT:</span>
            <span>${formatCurrencyEUR(order.tax_amount)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-between; padding-top: 12px; border-top: 1px solid var(--admin-border); font-size: 18px; font-weight: 600;">
          <span>Razem:</span>
          <span>${formatCurrencyEUR(order.total)}</span>
        </div>
      </div>

      <!-- Timeline -->
      <div style="margin-top: 20px; padding: 16px; background: var(--admin-bg); border-radius: 8px;">
        <h4 style="margin: 0 0 12px; font-size: 13px; color: var(--admin-text-muted);">📅 Historia</h4>
        <div style="font-size: 13px;">
          <p style="margin: 0 0 4px;"><strong>Utworzone:</strong> ${new Date(order.created_at).toLocaleString('pl-PL')}</p>
          ${order.updated_at !== order.created_at ? `<p style="margin: 0;"><strong>Ostatnia aktualizacja:</strong> ${new Date(order.updated_at).toLocaleString('pl-PL')}</p>` : ''}
        </div>
      </div>

      <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
        ${String(order.order_source || '') === 'admin' ? `<button class="btn-secondary" onclick="deleteShopOrder('${order.id}', '${escapeHtml(order.order_number).replace(/'/g, "\\'")}', '${escapeHtml(order.payment_status || '').replace(/'/g, "\\'")}')" style="background: #ef4444; color: white;">🗑️ Usuń</button>` : ''}
        <button class="btn-primary" onclick="updateOrderStatus('${order.id}')">💾 Zapisz zmiany</button>
        <button class="btn-secondary" onclick="document.getElementById('shopOrderModal').hidden = true">Zamknij</button>
      </div>
    `;

  } catch (error) {
    console.error('Failed to load order:', error);
    content.innerHTML = `<p style="color: #ef4444; text-align: center;">Błąd: ${error.message}</p>`;
  }
}

// Order quick actions
function printOrder(orderId) {
  window.print();
  showToast('Przygotowuję do druku...', 'info');
}
window.printOrder = printOrder;

function sendOrderEmail(orderId) {
  showToast('Wysyłanie emaila do klienta...', 'info');
  // TODO: Implement email sending via edge function
}
window.sendOrderEmail = sendOrderEmail;

async function addTrackingInfo(orderId) {
  const trackingNumber = prompt('Podaj numer przesyłki:');
  if (!trackingNumber) return;
  
  const trackingUrl = prompt('Podaj URL do śledzenia (opcjonalnie):');
  
  const client = ensureSupabase();
  if (!client) return;
  
  try {
    await client.from('shop_orders').update({
      tracking_number: trackingNumber,
      tracking_url: trackingUrl || null
    }).eq('id', orderId);
    
    showToast('Tracking dodany', 'success');
    viewShopOrder(orderId); // Refresh
  } catch (error) {
    showToast('Błąd: ' + error.message, 'error');
  }
}
window.addTrackingInfo = addTrackingInfo;

function initiateRefund(orderId) {
  if (!confirm('Czy na pewno chcesz zainicjować zwrot dla tego zamówienia?')) return;
  showToast('Funkcja zwrotu wymaga integracji z bramką płatności', 'info');
  // TODO: Implement refund via payment gateway
}
window.initiateRefund = initiateRefund;

function setupOrderModalListeners() {
  const modal = document.getElementById('shopOrderModal');
  const closeBtn = document.getElementById('btnCloseShopOrderModal');
  const overlay = document.getElementById('shopOrderModalOverlay');

  const closeModal = () => { modal.hidden = true; };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (overlay) overlay.onclick = closeModal;
}

async function updateOrderStatus(orderId) {
  const client = ensureSupabase();
  if (!client) return;

  const status = document.getElementById('orderStatusSelect')?.value;
  const paymentStatus = document.getElementById('orderPaymentStatusSelect')?.value;
  const adminNotes = document.getElementById('orderNotes')?.value || '';

  try {
    const { error } = await client
      .from('shop_orders')
      .update({ 
        status, 
        payment_status: paymentStatus,
        admin_notes: adminNotes || null
      })
      .eq('id', orderId);

    if (error) throw error;

    showToast('Zamówienie zaktualizowane', 'success');
    document.getElementById('shopOrderModal').hidden = true;
    await loadShopOrders();

  } catch (error) {
    console.error('Failed to update order:', error);
    showToast('Błąd aktualizacji zamówienia', 'error');
  }
}

function editShopProduct(productId) {
  showProductForm(productId);
}

function editShopCategory(categoryId) {
  showCategoryForm(categoryId);
}

function editShopVendor(vendorId) {
  showVendorForm(vendorId);
}

function editShopDiscount(discountId) {
  showDiscountForm(discountId);
}

// Delete functions
async function deleteShopProduct(productId, productName) {
  if (!confirm(`Czy na pewno chcesz usunąć produkt "${productName}"?\n\nTa operacja jest nieodwracalna.`)) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    await deletePartnerResourcesFor('shop', productId);
    const { error } = await client.from('shop_products').delete().eq('id', productId);
    if (error) throw error;
    showToast('Produkt usunięty', 'success');
    await loadShopProducts();
    await loadShopStats();
  } catch (error) {
    console.error('Failed to delete product:', error);
    showToast('Nie udało się usunąć produktu: ' + error.message, 'error');
  }
}

async function deleteShopCategory(categoryId, categoryName) {
  if (!confirm(`Czy na pewno chcesz usunąć kategorię "${categoryName}"?\n\nProdukty w tej kategorii stracą przypisanie.`)) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('shop_categories').delete().eq('id', categoryId);
    if (error) throw error;
    showToast('Kategoria usunięta', 'success');
    await loadShopCategories();
    await loadShopStats();
  } catch (error) {
    console.error('Failed to delete category:', error);
    showToast('Nie udało się usunąć kategorii: ' + error.message, 'error');
  }
}

async function deleteShopVendor(vendorId, vendorName) {
  if (!confirm(`Czy na pewno chcesz usunąć vendora "${vendorName}"?\n\nProdukty tego vendora stracą przypisanie.`)) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('shop_vendors').delete().eq('id', vendorId);
    if (error) throw error;
    showToast('Vendor usunięty', 'success');
    await loadShopVendors();
    await loadShopStats();
  } catch (error) {
    console.error('Failed to delete vendor:', error);
    showToast('Nie udało się usunąć vendora: ' + error.message, 'error');
  }
}

async function deleteShopDiscount(discountId, discountCode) {
  if (!confirm(`Czy na pewno chcesz usunąć kod rabatowy "${discountCode}"?`)) return;

  const client = ensureSupabase();
  if (!client) return;

  try {
    const { error } = await client.from('shop_discounts').delete().eq('id', discountId);
    if (error) throw error;
    showToast('Kod rabatowy usunięty', 'success');
    await loadShopDiscounts();
    await loadShopStats();
  } catch (error) {
    console.error('Failed to delete discount:', error);
    showToast('Nie udało się usunąć kodu: ' + error.message, 'error');
  }
}

// Export shop functions
window.loadShopData = loadShopData;
window.viewShopOrder = viewShopOrder;
window.editShopProduct = editShopProduct;
window.editShopCategory = editShopCategory;
window.editShopVendor = editShopVendor;
window.editShopDiscount = editShopDiscount;
window.deleteShopProduct = deleteShopProduct;
window.deleteShopCategory = deleteShopCategory;
window.deleteShopVendor = deleteShopVendor;
window.deleteShopDiscount = deleteShopDiscount;
window.updateOrderStatus = updateOrderStatus;
window.deleteShopOrder = deleteShopOrder;
window.showProductForm = showProductForm;
window.showCategoryForm = showCategoryForm;
window.showVendorForm = showVendorForm;
window.showDiscountForm = showDiscountForm;
