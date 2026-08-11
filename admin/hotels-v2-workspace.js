(function attachHotelsV2Workspace(root, factory) {
  const api = factory(root.HotelsV2WorkspaceCore, root.HotelsV2WorkspaceRepository);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2Workspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2Workspace(Core, Repository) {
  'use strict';

  if (!Core || !Repository) throw new Error('Hotels V2 Workspace dependencies are missing.');

  const state = {
    initialized: false,
    loading: false,
    properties: [],
    workspace: null,
    activeTab: 'overview',
    modal: null,
    pendingReview: null,
    lastFocused: null,
  };

  const WORKSPACE_TABS = Object.freeze([
    ['overview', 'Overview'],
    ['rooms', 'Rooms & Rates'],
    ['calendar', 'Calendar'],
    ['bookings', 'Bookings'],
    ['payments', 'Payments'],
    ['content', 'Content & Media'],
    ['partner', 'Partner & Access'],
    ['distribution', 'Distribution & Sync'],
    ['activity', 'Activity'],
  ]);

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(String(message || ''), type);
    else if (type === 'error') console.error(message);
  }

  function formatMoney(value, currency = 'EUR') {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'Not configured';
    try {
      return new Intl.NumberFormat('en-IE', { style: 'currency', currency: String(currency || 'EUR') }).format(amount);
    } catch (_error) {
      return `${String(currency || 'EUR')} ${amount.toFixed(2)}`;
    }
  }

  function propertyTitle(property) {
    return Core.i18nText(property?.name_i18n || property?.title_i18n || property?.title, 'en', property?.slug || 'Untitled property');
  }

  function statusTone(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized.includes('READY')) return 'success';
    if (normalized === 'BLOCKED') return 'danger';
    if (normalized === 'LEGACY') return 'neutral';
    return 'warning';
  }

  function architectureLabel(value) {
    return value === 'rooms_v2' ? 'Rooms V2' : 'Legacy';
  }

  function bookingModeLabel(value) {
    const labels = {
      request_confirmation: 'Request confirmation',
      instant_booking: 'Instant booking',
      external_redirect: 'External redirect',
    };
    return labels[value] || 'Request confirmation';
  }

  function legacyPricingModelLabel(value) {
    const labels = {
      per_person_per_night: 'Per-person legacy pricing',
      category_per_night: 'Category-based legacy pricing',
      tiered_by_nights: 'Tiered legacy pricing',
      flat_per_night: 'Flat legacy nightly pricing',
    };
    return labels[String(value || '').trim()] || 'Legacy pricing';
  }

  function legacyConfiguration(value) {
    const source = Core.asObject(value);
    const embedded = Core.asObject(source.legacy_configuration);
    return Object.keys(embedded).length ? embedded : source;
  }

  function legacyPricingSummary(value) {
    const source = legacyConfiguration(value);
    const pricingEngine = window.CE_HOTEL_PRICING;
    const rawRooms = Core.asArray(source.room_types);
    const normalizedRooms = typeof pricingEngine?.normalizeHotelRoomTypes === 'function'
      ? pricingEngine.normalizeHotelRoomTypes(rawRooms, source)
      : rawRooms;
    const propertyRuleCount = Core.asArray(Core.asObject(source.pricing_tiers).rules).length;
    const roomRuleCount = normalizedRooms.reduce((count, room) => (
      count + Core.asArray(Core.asObject(room?.pricing_tiers).rules).length
    ), 0);
    let minNightlyRate = null;
    if (typeof pricingEngine?.getHotelMinPricePerNight === 'function') {
      try {
        const calculated = pricingEngine.getHotelMinPricePerNight(source, { preferredPersons: 2 });
        if (calculated != null && Number.isFinite(Number(calculated))) minNightlyRate = Number(calculated);
      } catch (_error) {
        minNightlyRate = null;
      }
    }
    return {
      source,
      pricing_model: String(source.pricing_model || '').trim(),
      pricing_model_label: legacyPricingModelLabel(source.pricing_model),
      property_rule_count: propertyRuleCount,
      room_rule_count: roomRuleCount,
      pricing_rule_count: propertyRuleCount + roomRuleCount,
      room_count: normalizedRooms.length,
      rooms: normalizedRooms,
      min_nightly_rate: minNightlyRate,
      currency: String(source.currency || Core.asObject(source.pricing_tiers).currency || 'EUR').toUpperCase(),
    };
  }

  function legacyPublicPriceMarkup(summary, options = {}) {
    if (summary.min_nightly_rate != null) {
      return `${options.compact ? '' : 'From '}${escapeHtml(formatMoney(summary.min_nightly_rate, summary.currency))}${options.compact ? '/night' : ' / night'}`;
    }
    return escapeHtml(summary.pricing_model_label);
  }

  function renderLegacyRoomSummary(summary) {
    if (!summary.rooms.length) {
      return '<p class="hotel-legacy-live__empty">Property-level legacy pricing is active. No structured legacy room rows are configured.</p>';
    }
    return `<div class="hotel-legacy-room-summary"><span class="hotel-workspace-eyebrow">Current legacy rooms / pricing</span><ul>${summary.rooms.map((room) => {
      const roomId = String(room.id || '').trim();
      let roomPrice = null;
      if (roomId && typeof window.CE_HOTEL_PRICING?.getHotelMinPricePerNight === 'function') {
        try {
          roomPrice = window.CE_HOTEL_PRICING.getHotelMinPricePerNight(summary.source, {
            preferredPersons: 2,
            selectedRoomTypeId: roomId,
          });
        } catch (_error) {
          roomPrice = null;
        }
      }
      const label = Core.i18nText(room.name, 'en', room.id || 'Legacy room');
      const capacity = Number(room.max_persons) > 0 ? `${Number(room.max_persons)} guests` : 'Capacity not specified';
      const inventory = Number(room.inventory_units) > 0 ? `${Number(room.inventory_units)} units` : 'Inventory not specified';
      const plans = Core.asArray(room.rate_plans).length;
      return `<li><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(capacity)} · ${escapeHtml(inventory)} · ${plans} rate plan${plans === 1 ? '' : 's'}</small></span><b>${roomPrice == null ? 'Pricing inherited' : legacyPublicPriceMarkup({ ...summary, min_nightly_rate: Number(roomPrice) }, { compact: true })}</b></li>`;
    }).join('')}</ul></div>`;
  }

  function getPropertyReadiness(row) {
    const source = Core.asObject(row?.readiness);
    if (source.state) return source;
    return {
      state: row?.architecture_version === 'legacy' ? 'LEGACY' : (row?.readiness_state || 'DRAFT'),
      preparation_state: row?.preparation_state || row?.readiness_state || 'DRAFT',
      blockers: Core.asArray(row?.readiness_blockers),
      warnings: Core.asArray(row?.readiness_warnings),
    };
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    byId('hotelPropertySearch')?.addEventListener('input', renderPropertyList);
    byId('hotelPropertyArchitectureFilter')?.addEventListener('change', renderPropertyList);
    byId('hotelPropertyReadinessFilter')?.addEventListener('change', renderPropertyList);
    byId('btnAddHotel')?.addEventListener('click', openNewPropertyDialog);
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  function handleGlobalKeydown(event) {
    if (event.key !== 'Escape') return;
    if (state.modal) {
      closeModal();
      return;
    }
    if (state.workspace) closeWorkspace();
  }

  async function loadPropertyList() {
    init();
    if (state.loading) return;
    state.loading = true;
    const list = byId('hotelPropertyList');
    if (list) list.innerHTML = '<div class="hotel-property-empty"><span class="hotel-workspace-spinner" aria-hidden="true"></span> Loading properties…</div>';
    try {
      state.properties = await Repository.listProperties();
      renderPropertyList();
      updateDirectoryStats();
    } catch (error) {
      const message = error?.isFoundationMissing
        ? 'Hotels H2A Admin foundation is not deployed. Run the approved H2A SQL before deploying this UI.'
        : (error?.message || 'Failed to load properties.');
      if (list) list.innerHTML = `<div class="hotel-property-empty hotel-property-empty--error">${escapeHtml(message)}</div>`;
      toast(message, 'error');
      throw error;
    } finally {
      state.loading = false;
    }
  }

  function updateDirectoryStats() {
    const total = state.properties.length;
    const published = state.properties.filter((property) => property.is_published === true).length;
    if (byId('hotelsStatTotal')) byId('hotelsStatTotal').textContent = String(total);
    if (byId('hotelsStatPublished')) byId('hotelsStatPublished').textContent = String(published);
    if (byId('hotelsStatSubtitle')) {
      const v2 = state.properties.filter((property) => property.architecture_version === 'rooms_v2').length;
      byId('hotelsStatSubtitle').textContent = `${total - v2} legacy · ${v2} Rooms V2`;
    }
  }

  function filteredProperties() {
    const search = String(byId('hotelPropertySearch')?.value || '').trim().toLowerCase();
    const architecture = String(byId('hotelPropertyArchitectureFilter')?.value || 'all');
    const readiness = String(byId('hotelPropertyReadinessFilter')?.value || 'all');
    return state.properties.filter((property) => {
      const ready = getPropertyReadiness(property);
      const haystack = [
        propertyTitle(property),
        property.city,
        property.owner_partner_name || property.owner_partner?.name,
        property.slug,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      if (search && !haystack.includes(search)) return false;
      if (architecture !== 'all' && property.architecture_version !== architecture) return false;
      const effectiveReady = property.architecture_version === 'legacy' && readiness === 'LEGACY'
        ? 'LEGACY'
        : (ready.preparation_state || ready.state);
      if (readiness !== 'all' && effectiveReady !== readiness && ready.state !== readiness) return false;
      return true;
    });
  }

  function renderPropertyList() {
    const container = byId('hotelPropertyList');
    if (!container) return;
    const rows = filteredProperties();
    if (!rows.length) {
      container.innerHTML = '<div class="hotel-property-empty">No properties match the current filters.</div>';
      return;
    }
    container.innerHTML = rows.map(renderPropertyCard).join('');
    container.querySelectorAll('[data-hotel-open-workspace]').forEach((button) => {
      button.addEventListener('click', () => void openWorkspace(button.dataset.hotelOpenWorkspace));
    });
    container.querySelectorAll('[data-hotel-edit-basic]').forEach((button) => {
      button.addEventListener('click', () => void openWorkspace(button.dataset.hotelEditBasic, { tab: 'overview' }));
    });
    container.querySelectorAll('[data-hotel-advanced]').forEach((button) => {
      button.addEventListener('click', () => window.editHotel?.(button.dataset.hotelAdvanced));
    });
    container.querySelectorAll('[data-hotel-toggle-legacy-publication]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = state.properties.find((property) => property.id === button.dataset.hotelToggleLegacyPublication);
        if (!row || row.architecture_version !== 'legacy') return;
        window.toggleHotelPublish?.(row.id, row.is_published !== true);
      });
    });
  }

  function renderPropertyCard(property) {
    const readiness = getPropertyReadiness(property);
    const preparation = readiness.preparation_state || readiness.state || 'DRAFT';
    const roomCount = Number(property.room_type_count || 0);
    const inventory = Number(property.total_inventory ?? property.configured_inventory ?? 0);
    const ratePlans = Number(property.rate_plan_count || 0);
    const hasPreparation = roomCount > 0 || ratePlans > 0 || Number(property.room_rate_count || readiness.room_rate_count || 0) > 0;
    const upcoming = Number(property.upcoming_booking_count || 0);
    const price = property.price_from == null ? null : Number(property.price_from);
    const title = propertyTitle(property);
    const image = String(property.cover_image_url || Core.asArray(property.photos)[0] || '').trim();
    const architecture = property.architecture_version || 'legacy';
    const legacySummary = architecture === 'legacy' ? legacyPricingSummary(property) : null;
    const owner = property.owner_partner_name || property.owner_partner?.name || 'Not assigned';
    const publicLabel = property.is_published ? 'Published legacy page' : 'Not published';
    const readinessLabel = architecture === 'legacy' && !hasPreparation
      ? 'LEGACY'
      : preparation.replaceAll('_', ' ');
    return `
      <article class="hotel-property-card" data-property-id="${escapeAttr(property.id)}">
        <div class="hotel-property-card__media">
          ${image
            ? `<img src="${escapeAttr(image)}" alt="" loading="lazy" />`
            : '<div class="hotel-property-card__placeholder" aria-hidden="true">⌂</div>'}
        </div>
        <div class="hotel-property-card__body">
          <div class="hotel-property-card__heading">
            <div>
              <span class="hotel-workspace-eyebrow">${escapeHtml(architectureLabel(architecture))}</span>
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(property.city || 'Location not specified')} · ${escapeHtml(owner)}</p>
            </div>
            <span class="hotel-workspace-status hotel-workspace-status--${statusTone(readinessLabel)}">${escapeHtml(readinessLabel)}</span>
          </div>
          ${architecture === 'legacy' ? `
            <div class="hotel-property-card__configuration-split">
              <section class="hotel-property-card__legacy-pricing">
                <span class="hotel-workspace-eyebrow">Current public pricing</span>
                <strong>${legacyPublicPriceMarkup(legacySummary)}</strong>
                <small>${escapeHtml(legacySummary.pricing_model_label)} · ${legacySummary.pricing_rule_count} legacy pricing rule${legacySummary.pricing_rule_count === 1 ? '' : 's'}</small>
              </section>
              <section class="hotel-property-card__v2-preparation">
                <span class="hotel-workspace-eyebrow">Rooms V2 preparation</span>
                <div class="hotel-property-card__metrics hotel-property-card__metrics--preparation">
                  <span><strong>${roomCount}</strong> room types</span>
                  <span><strong>${inventory}</strong> inventory</span>
                  <span><strong>${ratePlans}</strong> rate plans</span>
                  <span><strong>${price == null ? 'Not configured' : escapeHtml(formatMoney(price, property.currency))}</strong>${price == null ? 'shadow setup' : 'configured from'}</span>
                </div>
              </section>
            </div>` : `
            <div class="hotel-property-card__metrics">
              <span><strong>${roomCount}</strong> room types</span>
              <span><strong>${inventory}</strong> inventory</span>
              <span><strong>${ratePlans}</strong> rate plans</span>
              <span><strong>${price == null ? 'Not configured' : escapeHtml(formatMoney(price, property.currency))}</strong> configured from</span>
              <span><strong>${upcoming}</strong> upcoming</span>
            </div>`}
          <div class="hotel-property-card__meta">
            <span>${escapeHtml(publicLabel)}</span>
            <span>${escapeHtml(bookingModeLabel(property.booking_mode))}</span>
            ${architecture === 'legacy' ? `<span>${upcoming} upcoming</span>` : ''}
            ${Core.asArray(readiness.blockers).length ? `<span class="hotel-property-card__blocker">${escapeHtml(Core.asArray(readiness.blockers)[0])}</span>` : ''}
          </div>
          <div class="hotel-property-card__actions">
            <button class="btn-primary" type="button" data-hotel-open-workspace="${escapeAttr(property.id)}">Open workspace</button>
            <button class="btn-secondary" type="button" data-hotel-edit-basic="${escapeAttr(property.id)}">Edit basic property</button>
            <button class="btn-secondary" type="button" disabled title="Property duplication is deferred until rooms, rates and media copy semantics are reviewed">Duplicate</button>
            ${architecture === 'legacy'
              ? `<button class="btn-secondary" type="button" data-hotel-toggle-legacy-publication="${escapeAttr(property.id)}">${property.is_published ? 'Unpublish' : 'Publish'}</button>`
              : '<button class="btn-secondary" type="button" disabled title="Rooms V2 publication is not available in H2A">Publish unavailable</button>'}
            ${architecture === 'legacy'
              ? `<button class="btn-secondary" type="button" data-hotel-advanced="${escapeAttr(property.id)}">Advanced / legacy</button>`
              : '<button class="btn-secondary" type="button" disabled title="Legacy JSON pricing and publication controls do not apply to Rooms V2 drafts">Legacy editor unavailable</button>'}
          </div>
        </div>
      </article>`;
  }

  async function openWorkspace(hotelId, options = {}) {
    init();
    const id = Core.normalizeUuid(hotelId);
    if (!id) return;
    const directory = byId('hotelPropertyDirectory');
    const workspaceElement = byId('hotelPropertyWorkspace');
    if (!workspaceElement) return;
    state.lastFocused = document.activeElement;
    if (directory) directory.hidden = true;
    workspaceElement.hidden = false;
    workspaceElement.innerHTML = '<div class="hotel-property-empty"><span class="hotel-workspace-spinner" aria-hidden="true"></span> Loading Property Workspace…</div>';
    try {
      state.workspace = await Repository.getWorkspace(id);
      state.activeTab = options.tab || 'overview';
      renderWorkspace();
      workspaceElement.scrollIntoView({ block: 'start' });
    } catch (error) {
      workspaceElement.innerHTML = `
        <div class="hotel-property-empty hotel-property-empty--error">
          <p>${escapeHtml(error?.message || 'Failed to load Property Workspace.')}</p>
          <button class="btn-secondary" type="button" data-hotel-workspace-back>Back to properties</button>
        </div>`;
      workspaceElement.querySelector('[data-hotel-workspace-back]')?.addEventListener('click', closeWorkspace);
      toast(error?.message || 'Failed to load Property Workspace.', 'error');
    }
  }

  function closeWorkspace() {
    const directory = byId('hotelPropertyDirectory');
    const workspaceElement = byId('hotelPropertyWorkspace');
    state.workspace = null;
    if (workspaceElement) {
      workspaceElement.hidden = true;
      workspaceElement.innerHTML = '';
    }
    if (directory) directory.hidden = false;
    state.lastFocused?.focus?.();
  }

  function renderWorkspace() {
    const container = byId('hotelPropertyWorkspace');
    if (!container || !state.workspace) return;
    const property = state.workspace.property;
    const readiness = Core.deriveWorkspaceReadiness(state.workspace);
    const preparationLabel = readiness.preparation_label || readiness.preparation_state;
    container.innerHTML = `
      <header class="hotel-workspace-header">
        <button class="hotel-workspace-back" type="button" data-hotel-workspace-back aria-label="Back to property list">←</button>
        <div class="hotel-workspace-header__title">
          <span class="hotel-workspace-eyebrow">Property Workspace · ${escapeHtml(architectureLabel(property.architecture_version))}</span>
          <h2>${escapeHtml(propertyTitle(property))}</h2>
          <p>${escapeHtml(property.city || 'Location not specified')} · ${escapeHtml(bookingModeLabel(property.booking_mode))}</p>
        </div>
        <div class="hotel-workspace-header__status">
          <span class="hotel-workspace-status hotel-workspace-status--${statusTone(property.architecture_version === 'legacy' ? 'LEGACY' : preparationLabel)}">
            ${escapeHtml(property.architecture_version === 'legacy' ? 'LEGACY PROPERTY' : preparationLabel.replaceAll('_', ' '))}
          </span>
          ${property.architecture_version === 'legacy' && readiness.has_configuration
            ? `<span class="hotel-workspace-status hotel-workspace-status--${statusTone(preparationLabel)}">V2 ${escapeHtml(preparationLabel.replaceAll('_', ' '))}</span>`
            : ''}
        </div>
      </header>
      <nav class="hotel-workspace-tabs" role="tablist" aria-label="Property Workspace sections">
        ${WORKSPACE_TABS.map(([key, label]) => `
          <button type="button" role="tab" data-hotel-workspace-tab="${key}" aria-selected="${state.activeTab === key}" class="${state.activeTab === key ? 'is-active' : ''}">${escapeHtml(label)}</button>
        `).join('')}
      </nav>
      <div class="hotel-workspace-panel" id="hotelWorkspaceActivePanel" role="tabpanel"></div>`;
    container.querySelector('[data-hotel-workspace-back]')?.addEventListener('click', closeWorkspace);
    container.querySelectorAll('[data-hotel-workspace-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.hotelWorkspaceTab;
        renderWorkspace();
      });
    });
    renderActivePanel();
  }

  function renderActivePanel() {
    const panel = byId('hotelWorkspaceActivePanel');
    if (!panel || !state.workspace) return;
    const renderers = {
      overview: renderOverviewPanel,
      rooms: renderRoomsPanel,
      calendar: renderCalendarPanel,
      bookings: renderBookingsPanel,
      payments: renderPaymentsPanel,
      content: renderContentPanel,
      partner: renderPartnerPanel,
      distribution: renderDistributionPanel,
      activity: renderActivityPanel,
    };
    (renderers[state.activeTab] || renderOverviewPanel)(panel);
  }

  function workspacePanelHeader(title, description, actions = '') {
    return `<header class="hotel-workspace-panel-header"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>${actions}</header>`;
  }

  function i18nFields(prefix, label, values, type = 'input') {
    const normalized = Core.normalizeI18n(values);
    return `<fieldset class="hotel-workspace-i18n"><legend>${escapeHtml(label)}</legend><div class="hotel-workspace-i18n-grid">
      ${Core.LANGUAGES.map((language) => `<label class="admin-form-field"><span>${escapeHtml(language.toUpperCase())}</span>${type === 'textarea'
        ? `<textarea name="${escapeAttr(prefix)}_${language}" rows="3" dir="${language === 'he' ? 'rtl' : 'ltr'}">${escapeHtml(normalized[language] || '')}</textarea>`
        : `<input name="${escapeAttr(prefix)}_${language}" type="text" value="${escapeAttr(normalized[language] || '')}" dir="${language === 'he' ? 'rtl' : 'ltr'}" />`}</label>`).join('')}
    </div></fieldset>`;
  }

  function readI18n(formData, prefix) {
    return Core.normalizeI18n(Object.fromEntries(Core.LANGUAGES.map((language) => [language, formData.get(`${prefix}_${language}`)])));
  }

  function renderOverviewPanel(panel) {
    const property = state.workspace.property;
    const readiness = Core.deriveWorkspaceReadiness(state.workspace);
    const preview = Core.migrationPreview(state.workspace);
    const legacySummary = property.architecture_version === 'legacy' ? legacyPricingSummary(property) : null;
    const partnerOptions = state.workspace.partners.map((partner) => `
      <option value="${escapeAttr(partner.id)}" ${partner.id === property.owner_partner_id ? 'selected' : ''}>${escapeHtml(partner.name || partner.company_name || partner.id)}</option>
    `).join('');
    panel.innerHTML = `
      ${workspacePanelHeader('Overview', 'Property identity, location and operating configuration. Rooms and prices remain independent.', '<button class="btn-primary" type="submit" form="hotelWorkspaceOverviewForm">Review changes</button>')}
      <div class="hotel-workspace-overview-grid">
        <form id="hotelWorkspaceOverviewForm" class="hotel-workspace-card hotel-workspace-form">
          <input type="hidden" name="property_id" value="${escapeAttr(property.id)}" />
          ${i18nFields('title', 'Property name', property.title_i18n || property.title)}
          ${i18nFields('description', 'Property description', property.description_i18n || property.description, 'textarea')}
          <div class="hotel-workspace-form-grid">
            <label class="admin-form-field"><span>Address</span><input name="address_line" value="${escapeAttr(property.address_line || '')}" /></label>
            <label class="admin-form-field"><span>City</span><input name="city" value="${escapeAttr(property.city || '')}" required /></label>
            <label class="admin-form-field"><span>District / area</span><input name="district" value="${escapeAttr(property.district || '')}" /></label>
            <label class="admin-form-field"><span>Postcode</span><input name="postal_code" value="${escapeAttr(property.postal_code || '')}" /></label>
            <label class="admin-form-field"><span>Country</span><input name="country" value="${escapeAttr(property.country || 'Cyprus')}" /></label>
            <label class="admin-form-field"><span>Latitude</span><input name="latitude" type="number" step="any" value="${escapeAttr(property.latitude ?? '')}" /></label>
            <label class="admin-form-field"><span>Longitude</span><input name="longitude" type="number" step="any" value="${escapeAttr(property.longitude ?? '')}" /></label>
            <label class="admin-form-field"><span>Google Maps URL</span><input name="google_maps_url" type="url" value="${escapeAttr(property.google_maps_url || '')}" /></label>
            <label class="admin-form-field"><span>Check-in from</span><input name="check_in_from" type="time" value="${escapeAttr(String(property.check_in_from || '').slice(0, 5))}" /></label>
            <label class="admin-form-field"><span>Check-out until</span><input name="check_out_until" type="time" value="${escapeAttr(String(property.check_out_until || '').slice(0, 5))}" /></label>
            <label class="admin-form-field"><span>Timezone</span><input name="timezone" value="${escapeAttr(property.timezone || 'Europe/Nicosia')}" required /></label>
            <label class="admin-form-field"><span>Currency</span><input name="currency" maxlength="3" value="${escapeAttr(property.currency || 'EUR')}" required /></label>
            <label class="admin-form-field"><span>Booking mode</span><select name="booking_mode">
              ${Core.BOOKING_MODES.map((mode) => `<option value="${mode}" ${property.booking_mode === mode ? 'selected' : ''}>${escapeHtml(bookingModeLabel(mode))}</option>`).join('')}
            </select></label>
            <label class="admin-form-field"><span>Commercial owner</span><select name="owner_partner_id"><option value="">Not assigned</option>${partnerOptions}</select></label>
          </div>
          <fieldset><legend>Property amenities</legend>${amenitiesMarkup(property.amenities, 'property_amenity')}</fieldset>
          <div class="hotel-workspace-locked-fields">
            <div><span>Architecture</span><strong>${escapeHtml(architectureLabel(property.architecture_version))}</strong><small>Changes only through a future reviewed activation.</small></div>
            <div><span>Public state</span><strong>${property.is_published ? 'Published legacy page' : 'Not published'}</strong><small>Rooms V2 publishing is disabled in H2A.</small></div>
            <div><span>Exact property ID</span><code>${escapeHtml(property.id)}</code></div>
          </div>
        </form>
        <aside class="hotel-workspace-side-stack">
          ${legacySummary ? `<section class="hotel-workspace-card hotel-legacy-live">
            <span class="hotel-workspace-eyebrow">Current live legacy configuration</span>
            <h4>${legacyPublicPriceMarkup(legacySummary)}</h4>
            <dl>
              <div><dt>Pricing model</dt><dd>${escapeHtml(legacySummary.pricing_model_label)}</dd></div>
              <div><dt>Existing public price</dt><dd>${legacyPublicPriceMarkup(legacySummary)}</dd></div>
              <div><dt>Legacy pricing rules</dt><dd>${legacySummary.pricing_rule_count}</dd></div>
              <div><dt>Legacy room rows</dt><dd>${legacySummary.room_count}</dd></div>
              <div><dt>Publication</dt><dd>${property.is_published ? 'Published' : 'Not published'}</dd></div>
              <div><dt>Booking mode</dt><dd>${escapeHtml(bookingModeLabel(property.booking_mode))}</dd></div>
            </dl>
            ${renderLegacyRoomSummary(legacySummary)}
            <p class="hotel-workspace-safety-note">This is the current legacy configuration. Rooms V2 preparation below is separate and cannot overwrite it.</p>
          </section>` : ''}
          ${renderReadinessCard(readiness)}
          <section class="hotel-workspace-card hotel-migration-preview">
            <span class="hotel-workspace-eyebrow">Migration preview · read only</span>
            <h4>${escapeHtml(preview.property_name)}</h4>
            <dl><div><dt>Legacy room rows</dt><dd>${preview.legacy_room_count}</dd></div><div><dt>Legacy pricing rules</dt><dd>${preview.legacy_pricing_rule_count}</dd></div><div><dt>Status</dt><dd>Not migrated</dd></div></dl>
            <p>${escapeHtml(preview.messages[0])}</p>
            ${preview.suggestions.length ? `<ul>${preview.suggestions.map((item) => `<li>${escapeHtml(Core.i18nText(item.proposed_name, 'en', item.proposed_code))} → draft Room Type</li>`).join('')}</ul>` : ''}
          </section>
        </aside>
      </div>`;
    const overviewForm = byId('hotelWorkspaceOverviewForm');
    overviewForm?.addEventListener('submit', handleOverviewReview);
    overviewForm?.querySelector('[data-amenity-search]')?.addEventListener('input', (event) => {
      const term = event.currentTarget.value.trim().toLowerCase();
      overviewForm.querySelectorAll('.hotel-amenity-group').forEach((group) => { group.hidden = term && !group.textContent.toLowerCase().includes(term); });
    });
  }

  function renderReadinessCard(readiness) {
    const preparation = readiness.preparation_label || readiness.preparation_state;
    return `<section class="hotel-workspace-card hotel-readiness-card">
      <div class="hotel-readiness-card__header"><div><span class="hotel-workspace-eyebrow">Rooms V2 preparation</span><h4>${escapeHtml(preparation.replaceAll('_', ' '))}</h4></div><span class="hotel-workspace-status hotel-workspace-status--${statusTone(preparation)}">${escapeHtml(preparation.replaceAll('_', ' '))}</span></div>
      <div class="hotel-readiness-progress"><span style="width:${readiness.ready_for_calendar ? '100' : readiness.has_configuration ? '55' : '12'}%"></span></div>
      ${readiness.blockers.length
        ? `<ul class="hotel-readiness-list hotel-readiness-list--blockers">${readiness.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '<p class="hotel-readiness-success">Configuration is structurally ready for the future Calendar stage.</p>'}
      ${readiness.warnings.length ? `<ul class="hotel-readiness-list">${readiness.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <small>This is Admin readiness only. It never means the property is publicly live.</small>
    </section>`;
  }

  async function handleOverviewReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const before = Core.clone(state.workspace.property);
    const after = {
      ...before,
      title_i18n: readI18n(fd, 'title'),
      description_i18n: readI18n(fd, 'description'),
      address_line: Core.asNullableText ? Core.asNullableText(fd.get('address_line')) : String(fd.get('address_line') || '').trim() || null,
      city: String(fd.get('city') || '').trim(),
      district: String(fd.get('district') || '').trim() || null,
      postal_code: String(fd.get('postal_code') || '').trim() || null,
      country: String(fd.get('country') || '').trim() || 'Cyprus',
      latitude: Core.asNumber(fd.get('latitude'), null),
      longitude: Core.asNumber(fd.get('longitude'), null),
      google_maps_url: String(fd.get('google_maps_url') || '').trim() || null,
      check_in_from: String(fd.get('check_in_from') || '').trim() || null,
      check_out_until: String(fd.get('check_out_until') || '').trim() || null,
      timezone: String(fd.get('timezone') || '').trim(),
      currency: String(fd.get('currency') || '').trim().toUpperCase(),
      booking_mode: String(fd.get('booking_mode') || '').trim(),
      owner_partner_id: Core.normalizeUuid(fd.get('owner_partner_id')) || null,
      amenities: fd.getAll('property_amenity'),
    };
    if (!Core.i18nText(after.title_i18n, 'en')) return toast('English property name is required.', 'error');
    if (!after.city) return toast('City is required.', 'error');
    if (!/^[A-Z]{3}$/.test(after.currency)) return toast('Currency must be a three-letter code.', 'error');
    if (!Core.BOOKING_MODES.includes(after.booking_mode)) return toast('Booking mode is invalid.', 'error');
    await openReview({
      title: 'Review property changes',
      entity: 'property',
      before,
      after,
      operation: Core.operationForEntity('property', after, before),
    });
  }

  function renderRoomsPanel(panel) {
    const workspace = state.workspace;
    const rooms = workspace.room_types.slice().sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    const plans = workspace.rate_plans.slice().sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    panel.innerHTML = `
      ${workspacePanelHeader('Rooms & Rates', 'Manage Room Types, optional physical units, reusable Rate Plans and their sellable products.', `
        <div class="hotel-workspace-panel-actions"><button class="btn-secondary" type="button" data-add-rate-plan>+ Rate Plan</button><button class="btn-primary" type="button" data-add-room>+ Room Type</button></div>`)}
      <div class="hotel-rooms-layout">
        <section>
          <div class="hotel-workspace-section-title"><div><h4>Room Types</h4><p>One Room Type may use several Rate Plans.</p></div><span>${rooms.length}</span></div>
          <div class="hotel-room-grid">${rooms.length ? rooms.map(renderRoomCard).join('') : renderEmptyState('No Room Types yet', 'Create the first draft room without changing the current public Hotel.')}</div>
        </section>
        <section>
          <div class="hotel-workspace-section-title"><div><h4>Property Rate Plans</h4><p>Create once and connect to one or many Room Types.</p></div><span>${plans.length}</span></div>
          <div class="hotel-rate-plan-list">${plans.length ? plans.map(renderRatePlanCard).join('') : renderEmptyState('No Rate Plans yet', 'Add Flexible, Non-refundable or another property-level plan.')}</div>
        </section>
      </div>`;
    panel.querySelector('[data-add-room]')?.addEventListener('click', () => openRoomEditor());
    panel.querySelector('[data-add-rate-plan]')?.addEventListener('click', () => openRatePlanEditor());
    bindRoomPanelActions(panel);
  }

  function renderEmptyState(title, message) {
    return `<div class="hotel-workspace-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
  }

  function renderRoomCard(room) {
    const units = state.workspace.units.filter((unit) => unit.room_type_id === room.id);
    const activeUnits = units.filter((unit) => unit.status === 'active').length;
    const roomRates = state.workspace.room_rates.filter((rate) => rate.room_type_id === room.id);
    const inventoryLabel = room.inventory_mode === 'pooled'
      ? `${room.base_inventory_count} pooled units`
      : `${activeUnits} active physical units`;
    return `<article class="hotel-room-card" data-room-id="${escapeAttr(room.id)}">
      <header><div><span class="hotel-workspace-eyebrow">${escapeHtml(room.code)}</span><h4>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</h4><p>${room.capacity_adults} adults · ${room.capacity_children} children · ${escapeHtml(inventoryLabel)}</p></div><span class="hotel-workspace-status hotel-workspace-status--${statusTone(room.status === 'active' ? 'READY' : room.status === 'disabled' ? 'BLOCKED' : 'DRAFT')}">${escapeHtml(room.status.toUpperCase())}</span></header>
      <div class="hotel-room-card__details"><span>${escapeHtml(Core.formatBedConfiguration(room.bed_configuration))}</span><span>${room.bathrooms == null ? 'Bathrooms not specified' : `${room.bathrooms} bathroom(s)`}</span><span>${room.size_sqm == null ? 'Size not specified' : `${room.size_sqm} m²`}</span></div>
      <div class="hotel-room-card__rates">${roomRates.length ? roomRates.map(renderRoomRateLine).join('') : '<p>No Rate Plans connected.</p>'}</div>
      ${room.inventory_mode === 'unitized' ? `<details class="hotel-room-card__units"><summary>${units.length} physical units</summary>${units.length ? units.map(renderUnitLine).join('') : '<p>No units configured.</p>'}<button class="btn-secondary" type="button" data-add-unit="${escapeAttr(room.id)}">Add unit</button></details>` : ''}
      <footer><button class="btn-secondary" type="button" data-edit-room="${escapeAttr(room.id)}">Edit</button><button class="btn-secondary" type="button" data-connect-room-rate="${escapeAttr(room.id)}">Rates</button><button class="btn-secondary" type="button" data-duplicate-room="${escapeAttr(room.id)}">Duplicate</button>${room.status !== 'disabled' ? `<button class="btn-secondary hotel-danger-action" type="button" data-disable-room="${escapeAttr(room.id)}">Disable</button>` : ''}</footer>
    </article>`;
  }

  function renderRoomRateLine(rate) {
    const plan = state.workspace.rate_plans.find((candidate) => candidate.id === rate.rate_plan_id);
    return `<button type="button" class="hotel-room-rate-line" data-edit-room-rate="${escapeAttr(rate.id)}"><span><strong>${escapeHtml(Core.i18nText(plan?.name_i18n, 'en', 'Rate Plan'))}</strong><small>${rate.is_active ? 'Active product' : 'Inactive product'}</small></span><b>${escapeHtml(formatMoney(rate.base_nightly_rate, rate.currency))}</b></button>`;
  }

  function renderUnitLine(unit) {
    return `<button type="button" class="hotel-unit-line" data-edit-unit="${escapeAttr(unit.id)}"><span>${escapeHtml(Core.i18nText(unit.name_i18n, 'en', unit.code))}</span><small>${escapeHtml(unit.status)}</small></button>`;
  }

  function renderRatePlanCard(plan) {
    const productCount = state.workspace.room_rates.filter((rate) => rate.rate_plan_id === plan.id).length;
    return `<article class="hotel-rate-plan-card"><div><span class="hotel-workspace-eyebrow">${escapeHtml(plan.code)}</span><h5>${escapeHtml(Core.i18nText(plan.name_i18n, 'en', plan.code))}</h5><p>${escapeHtml(Core.cancellationPolicyLabel(plan.cancellation_policy))} · ${productCount} room products</p></div><div><span class="hotel-workspace-status hotel-workspace-status--${statusTone(plan.is_active ? 'READY' : 'DRAFT')}">${plan.is_active ? 'ACTIVE' : 'INACTIVE'}</span><button class="btn-secondary" type="button" data-edit-rate-plan="${escapeAttr(plan.id)}">Edit</button></div></article>`;
  }

  function bindRoomPanelActions(panel) {
    panel.querySelectorAll('[data-edit-room]').forEach((button) => button.addEventListener('click', () => openRoomEditor(button.dataset.editRoom)));
    panel.querySelectorAll('[data-duplicate-room]').forEach((button) => button.addEventListener('click', () => duplicateRoom(button.dataset.duplicateRoom)));
    panel.querySelectorAll('[data-disable-room]').forEach((button) => button.addEventListener('click', () => disableRoom(button.dataset.disableRoom)));
    panel.querySelectorAll('[data-add-unit]').forEach((button) => button.addEventListener('click', () => openUnitEditor(null, button.dataset.addUnit)));
    panel.querySelectorAll('[data-edit-unit]').forEach((button) => button.addEventListener('click', () => openUnitEditor(button.dataset.editUnit)));
    panel.querySelectorAll('[data-edit-rate-plan]').forEach((button) => button.addEventListener('click', () => openRatePlanEditor(button.dataset.editRatePlan)));
    panel.querySelectorAll('[data-connect-room-rate]').forEach((button) => button.addEventListener('click', () => openRoomRateEditor(null, button.dataset.connectRoomRate)));
    panel.querySelectorAll('[data-edit-room-rate]').forEach((button) => button.addEventListener('click', () => openRoomRateEditor(button.dataset.editRoomRate)));
  }

  function modalMarkup(title, body, footer = '') {
    return `<div class="hotel-workspace-modal__backdrop" data-hotel-modal-close></div>
      <section class="hotel-workspace-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="hotelWorkspaceModalTitle">
        <header><div><span class="hotel-workspace-eyebrow">Hotels 2.0 Admin</span><h3 id="hotelWorkspaceModalTitle">${escapeHtml(title)}</h3></div><button type="button" class="hotel-workspace-modal__close" data-hotel-modal-close aria-label="Close">×</button></header>
        <div class="hotel-workspace-modal__body">${body}</div>
        <footer>${footer || '<button class="btn-secondary" type="button" data-hotel-modal-close>Close</button>'}</footer>
      </section>`;
  }

  function openModal({ title, body, footer = '', onReady = null, onClose = null, className = '' }) {
    closeModal({ restoreFocus: false });
    state.lastFocused = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = `hotel-workspace-modal ${className}`.trim();
    overlay.innerHTML = modalMarkup(title, body, footer);
    document.body.appendChild(overlay);
    overlay.hotelWorkspaceOnClose = typeof onClose === 'function' ? onClose : null;
    document.body.classList.add('hotel-workspace-modal-open');
    state.modal = overlay;
    overlay.querySelectorAll('[data-hotel-modal-close]').forEach((button) => button.addEventListener('click', (event) => {
      if (event.currentTarget.classList.contains('hotel-workspace-modal__backdrop') && event.target !== event.currentTarget) return;
      closeModal();
    }));
    onReady?.(overlay);
    requestAnimationFrame(() => {
      const focusTarget = overlay.querySelector('[autofocus], input:not([type="hidden"]), select, textarea, button');
      focusTarget?.focus?.();
    });
    return overlay;
  }

  function setModalSaving(overlay, saving) {
    if (!overlay) return;
    overlay.dataset.saving = saving ? 'true' : 'false';
    overlay.querySelectorAll('[data-hotel-modal-close]').forEach((control) => {
      control.setAttribute('aria-disabled', saving ? 'true' : 'false');
      if ('disabled' in control) control.disabled = Boolean(saving);
    });
  }

  function closeModal(options = {}) {
    const overlay = state.modal;
    if (!overlay) return;
    if (overlay.dataset.saving === 'true' && options.force !== true) return;
    const onClose = overlay.hotelWorkspaceOnClose;
    overlay.remove();
    state.modal = null;
    state.pendingReview = null;
    document.body.classList.remove('hotel-workspace-modal-open');
    if (!options.skipCleanup && typeof onClose === 'function') {
      Promise.resolve(onClose()).catch((error) => console.error('Failed to clean pending Hotel workspace media:', error));
    }
    if (options.restoreFocus !== false) state.lastFocused?.focus?.();
  }

  function displayReviewValue(value) {
    if (value == null || value === '') return 'Not specified';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  async function applyReviewedOperations(operations, options = {}) {
    const plan = Core.buildWorkspacePlan(state.workspace, operations);
    const result = await Repository.applyWorkspacePlan(plan);
    state.workspace = result.workspace;
    closeModal({ restoreFocus: false, skipCleanup: true, force: true });
    renderWorkspace();
    void loadPropertyList().catch(() => {});
    toast(options.successMessage || 'Reviewed Property Workspace changes saved.', 'success');
    return result;
  }

  async function openReview({ title, entity, before, after, operation, operations, onCancel, onApplyError, closeOnApplyError = false, successMessage }) {
    const reviewedOperations = Array.isArray(operations) ? operations : [operation];
    const rows = Core.buildReviewRows(entity, before, after);
    if (!rows.length) {
      toast('There are no changes to review.', 'info');
      return;
    }
    state.pendingReview = { reviewedOperations };
    openModal({
      title,
      className: 'hotel-workspace-modal--review',
      body: `<div class="hotel-review-summary"><p>One atomic exact-property operation will be applied only after all version and relationship checks pass.</p><dl><div><dt>Property ID</dt><dd><code>${escapeHtml(state.workspace.property.id)}</code></dd></div><div><dt>Entity</dt><dd>${escapeHtml(entity.replaceAll('_', ' '))}</dd></div><div><dt>Changes</dt><dd>${rows.length}</dd></div></dl></div>
        <div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.field)}</th><td><pre>${escapeHtml(displayReviewValue(row.before))}</pre></td><td><pre>${escapeHtml(displayReviewValue(row.after))}</pre></td></tr>`).join('') || '<tr><td colspan="3">The exact reviewed operation has no scalar field diff.</td></tr>'}</tbody></table></div>
        <p class="hotel-workspace-safety-note">Public Hotels V2 remains disabled. This save does not publish, convert, book or alter historical rows.</p>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Back</button><button class="btn-primary" type="button" data-hotel-review-confirm>Save reviewed changes</button>',
      onClose: onCancel,
      onReady(overlay) {
        overlay.querySelector('[data-hotel-review-confirm]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = 'Saving…';
          setModalSaving(overlay, true);
          try {
            await applyReviewedOperations(reviewedOperations, { successMessage });
          } catch (error) {
            try { await onApplyError?.(error); } catch (cleanupError) { console.error('Failed to clean up reviewed Hotel media upload:', cleanupError); }
            setModalSaving(overlay, false);
            if (closeOnApplyError) closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            button.disabled = false;
            button.textContent = 'Save reviewed changes';
            const message = error?.isStale
              ? 'Save stopped: this configuration changed after Review. Refresh and review the fresh values.'
              : error?.isAmbiguousOutcome
                ? 'The save result could not be confirmed because the connection was interrupted. Uploaded media was preserved. Refresh Property Workspace before retrying; do not upload the same files again.'
                : (error?.message || 'Reviewed save failed. No database changes were kept.');
            toast(message, error?.isAmbiguousOutcome ? 'warning' : 'error');
          }
        });
      },
    });
  }

  function slugify(value) {
    return String(value || '').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  }

  function openNewPropertyDialog() {
    const exactId = Core.newUuid();
    openModal({
      title: 'Create Rooms V2 property draft',
      body: `<p class="hotel-workspace-intro">Create one unpublished top-level property. Rooms, rates and calendar are configured inside its workspace.</p>
        <form id="hotelNewPropertyForm" class="hotel-workspace-form">
          <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Exact property ID</span><input value="${escapeAttr(exactId)}" readonly /></label><label class="admin-form-field"><span>Internal slug</span><input name="slug" pattern="[a-z0-9][a-z0-9-]*" required /></label></div>
          ${i18nFields('title', 'Property name', {})}
          ${i18nFields('description', 'Property description', {}, 'textarea')}
          <div class="hotel-workspace-form-grid">
            <label class="admin-form-field"><span>City</span><input name="city" required /></label>
            <label class="admin-form-field"><span>Address</span><input name="address_line" /></label>
            <label class="admin-form-field"><span>Timezone</span><input name="timezone" value="Europe/Nicosia" required /></label>
            <label class="admin-form-field"><span>Currency</span><input name="currency" value="EUR" maxlength="3" required /></label>
          </div>
          <div class="hotel-workspace-locked-fields"><div><span>Architecture</span><strong>Rooms V2 draft</strong></div><div><span>Booking mode</span><strong>Request confirmation</strong></div><div><span>Public state</span><strong>Unpublished</strong></div></div>
        </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelNewPropertyForm">Review draft</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelNewPropertyForm');
        const englishName = form?.elements?.title_en;
        const slugInput = form?.elements?.slug;
        englishName?.addEventListener('input', () => {
          if (!slugInput.dataset.edited) slugInput.value = slugify(englishName.value);
        });
        slugInput?.addEventListener('input', () => { slugInput.dataset.edited = 'true'; });
        form?.addEventListener('submit', (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const payload = {
            slug: slugify(fd.get('slug')),
            title_i18n: readI18n(fd, 'title'),
            description_i18n: readI18n(fd, 'description'),
            city: String(fd.get('city') || '').trim(),
            address_line: String(fd.get('address_line') || '').trim() || null,
            timezone: String(fd.get('timezone') || '').trim() || 'Europe/Nicosia',
            currency: String(fd.get('currency') || 'EUR').trim().toUpperCase(),
          };
          if (!payload.slug || !Core.i18nText(payload.title_i18n, 'en') || !payload.city || !/^[A-Z]{3}$/.test(payload.currency)) {
            toast('Slug, English name, city and valid currency are required.', 'error');
            return;
          }
          closeModal({ restoreFocus: false });
          const before = { id: exactId, architecture_version: null, is_published: null };
          const after = { id: exactId, ...payload, architecture_version: 'rooms_v2', booking_mode: 'request_confirmation', is_published: false, status: 'draft' };
          const rows = Core.buildReviewRows('property', before, after);
          openModal({
            title: 'Review new property draft',
            body: `<div class="hotel-review-summary"><p>The property will be created as an inert Rooms V2 draft. No feature flag or public page is enabled.</p><code>${escapeHtml(exactId)}</code></div><div class="hotel-review-table-wrap"><table class="hotel-review-table"><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.field)}</th><td><pre>${escapeHtml(displayReviewValue(row.after))}</pre></td></tr>`).join('')}</tbody></table></div>`,
            footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="button" data-create-property-confirm>Create draft</button>',
            onReady(reviewOverlay) {
              reviewOverlay.querySelector('[data-create-property-confirm]')?.addEventListener('click', async (confirmEvent) => {
                const button = confirmEvent.currentTarget;
                button.disabled = true;
                button.textContent = 'Creating…';
                setModalSaving(reviewOverlay, true);
                let result;
                try {
                  result = await Repository.createPropertyDraft(exactId, payload);
                } catch (error) {
                  setModalSaving(reviewOverlay, false);
                  button.disabled = false;
                  button.textContent = 'Create draft';
                  toast(error?.message || 'Property draft creation failed.', 'error');
                  return;
                }

                state.workspace = result.workspace;
                closeModal({ restoreFocus: false, skipCleanup: true, force: true });
                toast('Rooms V2 property draft created. Public behavior remains disabled.', 'success');
                try {
                  await loadPropertyList();
                  await openWorkspace(exactId, { tab: 'overview' });
                } catch (error) {
                  toast('Property draft was created, but the workspace refresh failed. Reload Hotels to continue.', 'error');
                }
              });
            },
          });
        });
      },
    });
  }

  function bedRowMarkup(bed = {}) {
    const type = Core.BED_TYPES.includes(bed.type) ? bed.type : 'double';
    return `<div class="hotel-bed-row">
      <label class="admin-form-field"><span>Bed type</span><select data-bed-type>${Core.BED_TYPES.map((candidate) => `<option value="${candidate}" ${candidate === type ? 'selected' : ''}>${escapeHtml(Core.BED_LABELS[candidate])}</option>`).join('')}</select></label>
      <label class="admin-form-field"><span>Quantity</span><input data-bed-quantity type="number" min="1" max="20" step="1" value="${escapeAttr(bed.quantity || 1)}" /></label>
      <label class="admin-form-field hotel-bed-other"><span>Other bed label (EN)</span><input data-bed-label value="${escapeAttr(Core.i18nText(bed.label, 'en'))}" /></label>
      <button class="btn-secondary" type="button" data-remove-bed aria-label="Remove bed row">Remove</button>
    </div>`;
  }

  function amenitiesMarkup(selectedValues, inputName = 'room_amenity') {
    const selected = new Set(Core.normalizeAmenities(selectedValues));
    const catalog = state.workspace.amenities_catalog;
    const known = new Set(catalog.map((amenity) => String(amenity.code || '').trim()).filter(Boolean));
    const groups = new Map();
    catalog.forEach((amenity) => {
      const category = String(amenity.category || 'Other');
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(amenity);
    });
    const groupHtml = Array.from(groups.entries()).map(([category, amenities]) => `<section class="hotel-amenity-group" data-amenity-category="${escapeAttr(category.toLowerCase())}"><h5>${escapeHtml(category)}</h5><div>${amenities.map((amenity) => {
      const code = String(amenity.code || '').trim();
      const label = amenity.name_en || amenity.name_pl || code;
      return `<label><input type="checkbox" name="${escapeAttr(inputName)}" value="${escapeAttr(code)}" ${selected.has(code) ? 'checked' : ''} /><span>${escapeHtml(label)}</span></label>`;
    }).join('')}</div></section>`).join('');
    const custom = Array.from(selected).filter((code) => !known.has(code));
    return `<div class="hotel-amenity-picker"><label class="admin-form-field"><span>Search amenities</span><input type="search" data-amenity-search placeholder="Search by name or category" /></label><div class="hotel-amenity-groups">${groupHtml || '<p>No active amenity catalogue entries.</p>'}</div>${custom.length ? `<section class="hotel-amenity-group"><h5>Preserved custom values</h5><div>${custom.map((code) => `<label><input type="checkbox" name="${escapeAttr(inputName)}" value="${escapeAttr(code)}" checked /><span>${escapeHtml(code)}</span></label>`).join('')}</div></section>` : ''}</div>`;
  }

  function galleryEditorMarkup(room) {
    const gallery = Core.normalizeGallery(room.gallery);
    return `<fieldset class="hotel-gallery-editor"><legend>Room gallery</legend>
      ${gallery.length ? `<div class="hotel-gallery-editor__grid">${gallery.map((url) => `<label><img src="${escapeAttr(url)}" alt="" loading="lazy" /><span><input type="checkbox" name="remove_gallery_url" value="${escapeAttr(url)}" /> Remove</span></label>`).join('')}</div>` : '<p>No room-specific images yet.</p>'}
      <label class="admin-form-field"><span>Add room photos</span><input type="file" name="room_gallery_files" accept="image/*" multiple ${room.created_at ? '' : 'disabled'} /></label>
      <small>${room.created_at ? 'Images are optimized to WebP and stored under this exact Room Type ID.' : 'Create the Room Type first, then edit it to upload files to its exact ID.'}</small>
    </fieldset>`;
  }

  function openRoomEditor(roomId = null) {
    const existing = roomId ? state.workspace.room_types.find((room) => room.id === roomId) : null;
    const room = existing || Core.normalizeRoomType({
      id: Core.newUuid(), hotel_id: state.workspace.property.id, code: '', name_i18n: {}, description_i18n: {},
      gallery: [], capacity_adults: 2, capacity_children: 0, bed_configuration: [], amenities: [],
      inventory_mode: 'pooled', base_inventory_count: 1, status: 'draft', sort_order: 1000, version: 1,
    });
    openModal({
      title: existing ? 'Edit Room Type' : 'Add Room Type',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelRoomEditorForm" class="hotel-workspace-form">
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal code</span><input name="code" value="${escapeAttr(room.code)}" required pattern="[a-z0-9][a-z0-9_-]*" /></label><label class="admin-form-field"><span>Exact Room Type ID</span><input value="${escapeAttr(room.id)}" readonly /></label></div>
        ${i18nFields('name', 'Room name', room.name_i18n)}
        ${i18nFields('description', 'Room description', room.description_i18n, 'textarea')}
        <fieldset><legend>Capacity & inventory</legend><div class="hotel-workspace-form-grid">
          <label class="admin-form-field"><span>Adults</span><input name="capacity_adults" type="number" min="1" max="50" step="1" value="${room.capacity_adults}" required /></label>
          <label class="admin-form-field"><span>Children</span><input name="capacity_children" type="number" min="0" max="50" step="1" value="${room.capacity_children}" required /></label>
          <label class="admin-form-field"><span>Inventory model</span><select name="inventory_mode"><option value="pooled" ${room.inventory_mode === 'pooled' ? 'selected' : ''}>Pooled inventory</option><option value="unitized" ${room.inventory_mode === 'unitized' ? 'selected' : ''}>Individual units</option></select></label>
          <label class="admin-form-field"><span>Base inventory count</span><input name="base_inventory_count" type="number" min="0" step="1" value="${room.base_inventory_count}" /></label>
          <label class="admin-form-field"><span>Bathrooms</span><input name="bathrooms" type="number" min="0" step="0.5" value="${escapeAttr(room.bathrooms ?? '')}" /></label>
          <label class="admin-form-field"><span>Size m²</span><input name="size_sqm" type="number" min="0.01" step="0.01" value="${escapeAttr(room.size_sqm ?? '')}" /></label>
          <label class="admin-form-field"><span>Status</span><select name="status">${Core.ROOM_STATUSES.map((status) => `<option value="${status}" ${status === room.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>
          <label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" step="1" value="${room.sort_order}" /></label>
        </div><p class="hotel-inventory-mode-note" data-inventory-note></p></fieldset>
        <fieldset><legend>Bed configuration</legend><div data-bed-rows>${room.bed_configuration.map(bedRowMarkup).join('')}</div><button class="btn-secondary" type="button" data-add-bed>+ Add bed</button></fieldset>
        <fieldset><legend>Room amenities</legend>${amenitiesMarkup(room.amenities)}</fieldset>
        ${galleryEditorMarkup(room)}
      </form>`,
      footer: `<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRoomEditorForm">Review ${existing ? 'changes' : 'new Room Type'}</button>`,
      onReady(overlay) {
        const form = overlay.querySelector('#hotelRoomEditorForm');
        const beds = form.querySelector('[data-bed-rows]');
        const syncBedRows = () => beds.querySelectorAll('.hotel-bed-row').forEach((row) => {
          row.classList.toggle('is-other', row.querySelector('[data-bed-type]')?.value === 'other');
        });
        beds.addEventListener('change', syncBedRows);
        beds.addEventListener('click', (event) => {
          const remove = event.target.closest('[data-remove-bed]');
          if (remove) remove.closest('.hotel-bed-row')?.remove();
        });
        form.querySelector('[data-add-bed]')?.addEventListener('click', () => {
          beds.insertAdjacentHTML('beforeend', bedRowMarkup({ type: 'double', quantity: 1 }));
          syncBedRows();
        });
        const inventoryMode = form.elements.inventory_mode;
        const inventoryCount = form.elements.base_inventory_count;
        const inventoryNote = form.querySelector('[data-inventory-note]');
        const syncInventory = () => {
          const unitized = inventoryMode.value === 'unitized';
          inventoryCount.disabled = unitized;
          inventoryNote.textContent = unitized
            ? 'Inventory is derived from active physical units. This switch never creates or deletes units.'
            : 'Pooled inventory uses the configured base count; physical units are optional and not required.';
        };
        inventoryMode.addEventListener('change', syncInventory);
        syncInventory();
        const search = form.querySelector('[data-amenity-search]');
        search?.addEventListener('input', () => {
          const term = search.value.trim().toLowerCase();
          form.querySelectorAll('.hotel-amenity-group').forEach((group) => {
            group.hidden = term && !group.textContent.toLowerCase().includes(term);
          });
        });
        syncBedRows();
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const bedConfiguration = Array.from(form.querySelectorAll('.hotel-bed-row')).map((row) => {
            const type = row.querySelector('[data-bed-type]').value;
            const quantity = Number(row.querySelector('[data-bed-quantity]').value);
            const label = row.querySelector('[data-bed-label]').value.trim();
            return { type, quantity, ...(type === 'other' && label ? { label: { en: label } } : {}) };
          });
          const candidate = {
            ...room,
            code: String(fd.get('code') || '').trim().toLowerCase(),
            name_i18n: readI18n(fd, 'name'),
            description_i18n: readI18n(fd, 'description'),
            capacity_adults: Number(fd.get('capacity_adults')),
            capacity_children: Number(fd.get('capacity_children')),
            inventory_mode: String(fd.get('inventory_mode')),
            base_inventory_count: fd.get('inventory_mode') === 'unitized' ? 0 : Number(fd.get('base_inventory_count')),
            bathrooms: fd.get('bathrooms') === '' ? null : Number(fd.get('bathrooms')),
            size_sqm: fd.get('size_sqm') === '' ? null : Number(fd.get('size_sqm')),
            status: String(fd.get('status')),
            sort_order: Number(fd.get('sort_order')),
            bed_configuration: bedConfiguration,
            amenities: fd.getAll('room_amenity'),
            gallery: room.gallery.filter((url) => !fd.getAll('remove_gallery_url').includes(url)),
          };
          let validated;
          try { validated = Core.validateRoomType(candidate, state.workspace); }
          catch (error) { toast(error.message, 'error'); return; }
          const files = Array.from(form.elements.room_gallery_files?.files || []);
          closeModal({ restoreFocus: false });
          let uploadedUrls = [];
          if (files.length) {
            const uploader = window.HotelsV2AdminMedia?.uploadRoomGallery;
            if (typeof uploader !== 'function') {
              toast('Optimized room-image uploader is unavailable.', 'error');
              return;
            }
            try {
              uploadedUrls = await uploader(state.workspace.property.slug, validated.id, files);
              validated = {
                ...validated,
                gallery: Core.normalizeGallery([...validated.gallery, ...uploadedUrls]),
              };
            } catch (error) {
              toast(error?.message || 'Room gallery upload failed before Review.', 'error');
              return;
            }
          }
          const cleanupUploaded = async () => {
            if (!uploadedUrls.length) return;
            await window.HotelsV2AdminMedia?.removeRoomGalleryUploads?.(uploadedUrls);
            uploadedUrls = [];
          };
          const cleanupRejectedUpload = async (error) => {
            if (error?.isDefinitiveFailure) await cleanupUploaded();
          };
          await openReview({
            title: existing ? 'Review Room Type changes' : 'Review new Room Type',
            entity: 'room_type',
            before: existing,
            after: validated,
            operation: Core.operationForEntity('room_type', validated, existing),
            onCancel: files.length ? cleanupUploaded : null,
            onApplyError: files.length ? cleanupRejectedUpload : null,
            closeOnApplyError: files.length > 0,
            successMessage: existing ? 'Room Type updated.' : 'Room Type created as an inert configuration.',
          });
        });
      },
    });
  }

  function openUnitEditor(unitId = null, roomTypeId = null) {
    const existing = unitId ? state.workspace.units.find((unit) => unit.id === unitId) : null;
    const parentId = existing?.room_type_id || Core.normalizeUuid(roomTypeId);
    const room = state.workspace.room_types.find((candidate) => candidate.id === parentId);
    if (!room || room.inventory_mode !== 'unitized') {
      toast('Physical units can be managed only for a unitized Room Type.', 'error');
      return;
    }
    const unit = existing || Core.normalizeUnit({ id: Core.newUuid(), room_type_id: room.id, code: '', name_i18n: {}, status: 'active', version: 1 });
    openModal({
      title: existing ? 'Edit physical unit' : `Add unit to ${Core.i18nText(room.name_i18n, 'en', room.code)}`,
      body: `<form id="hotelUnitEditorForm" class="hotel-workspace-form">
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Unit code</span><input name="code" value="${escapeAttr(unit.code)}" required pattern="[a-z0-9][a-z0-9_-]*" /></label><label class="admin-form-field"><span>Status</span><select name="status">${Core.UNIT_STATUSES.map((status) => `<option value="${status}" ${unit.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label></div>
        ${i18nFields('name', 'Optional display name', unit.name_i18n)}
        <div class="hotel-workspace-locked-fields"><div><span>Room Type</span><strong>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</strong></div><div><span>Exact unit ID</span><code>${escapeHtml(unit.id)}</code></div></div>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelUnitEditorForm">Review unit</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelUnitEditorForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          let validated;
          try {
            validated = Core.validateUnit({
              ...unit,
              code: String(fd.get('code') || '').trim().toLowerCase(),
              name_i18n: readI18n(fd, 'name'),
              status: String(fd.get('status')),
            }, state.workspace);
          } catch (error) { toast(error.message, 'error'); return; }
          closeModal({ restoreFocus: false });
          await openReview({
            title: existing ? 'Review unit changes' : 'Review new physical unit',
            entity: 'unit', before: existing, after: validated,
            operation: Core.operationForEntity('unit', validated, existing),
            successMessage: existing ? 'Physical unit updated.' : 'Physical unit created.',
          });
        });
      },
    });
  }

  function cancellationFields(policy) {
    const normalized = Core.normalizeCancellationPolicy(policy);
    return `<fieldset><legend>Cancellation policy</legend><div class="hotel-workspace-form-grid">
      <label class="admin-form-field"><span>Policy</span><select name="cancellation_type"><option value="flexible" ${normalized.type === 'flexible' ? 'selected' : ''}>Flexible</option><option value="non_refundable" ${normalized.type === 'non_refundable' ? 'selected' : ''}>Non-refundable</option><option value="custom" ${normalized.type === 'custom' ? 'selected' : ''}>Custom</option></select></label>
      <label class="admin-form-field" data-custom-cancellation><span>Deadline before arrival (hours)</span><input name="deadline_hours" type="number" min="0" step="1" value="${normalized.deadline_hours ?? 48}" /></label>
      <label class="admin-form-field" data-custom-cancellation><span>Penalty</span><select name="penalty_mode"><option value="none" ${normalized.penalty_mode === 'none' ? 'selected' : ''}>No configured penalty</option><option value="flat" ${normalized.penalty_mode === 'flat' ? 'selected' : ''}>Fixed amount</option><option value="percent" ${normalized.penalty_mode === 'percent' ? 'selected' : ''}>Percent of total</option></select></label>
      <label class="admin-form-field" data-custom-cancellation data-penalty-value><span>Penalty value</span><input name="penalty_value" type="number" min="0" step="0.01" value="${escapeAttr(normalized.penalty_value ?? '')}" /></label>
    </div><small>This stores a safe policy description only. H2A does not change booking or refund calculations.</small></fieldset>`;
  }

  function readCancellationPolicy(form) {
    const type = String(form.elements.cancellation_type.value || 'flexible');
    if (type !== 'custom') return Core.normalizeCancellationPolicy({ type });
    const mode = String(form.elements.penalty_mode.value || 'none');
    return Core.normalizeCancellationPolicy({
      type,
      deadline_hours: Number(form.elements.deadline_hours.value || 0),
      penalty_mode: mode,
      ...(mode === 'none' ? {} : { penalty_value: Number(form.elements.penalty_value.value) }),
    });
  }

  function openRatePlanEditor(planId = null) {
    const existing = planId ? state.workspace.rate_plans.find((plan) => plan.id === planId) : null;
    const plan = existing || Core.normalizeRatePlan({
      id: Core.newUuid(), hotel_id: state.workspace.property.id, code: '', name_i18n: {}, description_i18n: {},
      cancellation_policy: { type: 'flexible' }, booking_mode_override: null, meal_plan_code: null,
      is_active: false, sort_order: 1000, version: 1,
    });
    openModal({
      title: existing ? 'Edit Rate Plan' : 'Add Rate Plan',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelRatePlanEditorForm" class="hotel-workspace-form">
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal code</span><input name="code" value="${escapeAttr(plan.code)}" required pattern="[a-z0-9][a-z0-9_-]*" /></label><label class="admin-form-field"><span>Meal plan code</span><input name="meal_plan_code" value="${escapeAttr(plan.meal_plan_code || '')}" placeholder="room_only, breakfast…" /></label></div>
        ${i18nFields('name', 'Rate Plan name', plan.name_i18n)}
        ${i18nFields('description', 'Rate Plan description', plan.description_i18n, 'textarea')}
        ${cancellationFields(plan.cancellation_policy)}
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Booking-mode override</span><select name="booking_mode_override"><option value="">Use property booking mode</option>${Core.BOOKING_MODES.map((mode) => `<option value="${mode}" ${plan.booking_mode_override === mode ? 'selected' : ''}>${escapeHtml(bookingModeLabel(mode))}</option>`).join('')}</select></label><label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" step="1" value="${plan.sort_order}" /></label><label class="admin-checkbox-field"><input name="is_active" type="checkbox" ${plan.is_active ? 'checked' : ''} /><span>Active configuration</span></label></div>
        <div class="hotel-workspace-locked-fields"><div><span>Exact Rate Plan ID</span><code>${escapeHtml(plan.id)}</code></div><div><span>Scope</span><strong>This property only</strong></div></div>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRatePlanEditorForm">Review Rate Plan</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelRatePlanEditorForm');
        const syncCancellation = () => {
          const custom = form.elements.cancellation_type.value === 'custom';
          form.querySelectorAll('[data-custom-cancellation]').forEach((element) => { element.hidden = !custom; });
          const needsValue = custom && form.elements.penalty_mode.value !== 'none';
          form.querySelector('[data-penalty-value]').hidden = !needsValue;
        };
        form.elements.cancellation_type.addEventListener('change', syncCancellation);
        form.elements.penalty_mode.addEventListener('change', syncCancellation);
        syncCancellation();
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          let validated;
          try {
            validated = Core.validateRatePlan({
              ...plan,
              code: String(fd.get('code') || '').trim().toLowerCase(),
              name_i18n: readI18n(fd, 'name'),
              description_i18n: readI18n(fd, 'description'),
              meal_plan_code: String(fd.get('meal_plan_code') || '').trim().toLowerCase() || null,
              cancellation_policy: readCancellationPolicy(form),
              booking_mode_override: String(fd.get('booking_mode_override') || '') || null,
              is_active: fd.get('is_active') === 'on',
              sort_order: Number(fd.get('sort_order')),
            }, state.workspace);
          } catch (error) { toast(error.message, 'error'); return; }
          closeModal({ restoreFocus: false });
          await openReview({
            title: existing ? 'Review Rate Plan changes' : 'Review new Rate Plan',
            entity: 'rate_plan', before: existing, after: validated,
            operation: Core.operationForEntity('rate_plan', validated, existing),
            successMessage: existing ? 'Rate Plan updated.' : 'Rate Plan created.',
          });
        });
      },
    });
  }

  function openRoomRateEditor(rateId = null, preferredRoomId = null) {
    const existing = rateId ? state.workspace.room_rates.find((rate) => rate.id === rateId) : null;
    const rate = existing || Core.normalizeRoomRate({
      id: Core.newUuid(), hotel_id: state.workspace.property.id,
      room_type_id: Core.normalizeUuid(preferredRoomId) || state.workspace.room_types[0]?.id,
      rate_plan_id: state.workspace.rate_plans[0]?.id,
      base_nightly_rate: null, currency: state.workspace.property.currency || 'EUR', is_active: false, sort_order: 1000, version: 1,
    });
    if (!state.workspace.room_types.length || !state.workspace.rate_plans.length) {
      toast('Create at least one Room Type and one Rate Plan before connecting them.', 'error');
      return;
    }
    openModal({
      title: existing ? 'Edit Room Rate product' : 'Connect Room Type + Rate Plan',
      body: `<form id="hotelRoomRateEditorForm" class="hotel-workspace-form"><div class="hotel-workspace-form-grid">
        <label class="admin-form-field"><span>Room Type</span><select name="room_type_id" ${existing ? 'disabled' : ''}>${state.workspace.room_types.map((room) => `<option value="${room.id}" ${rate.room_type_id === room.id ? 'selected' : ''}>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</option>`).join('')}</select></label>
        <label class="admin-form-field"><span>Rate Plan</span><select name="rate_plan_id" ${existing ? 'disabled' : ''}>${state.workspace.rate_plans.map((plan) => `<option value="${plan.id}" ${rate.rate_plan_id === plan.id ? 'selected' : ''}>${escapeHtml(Core.i18nText(plan.name_i18n, 'en', plan.code))}</option>`).join('')}</select></label>
        <label class="admin-form-field"><span>Base nightly rate</span><input name="base_nightly_rate" type="number" min="0" step="0.01" value="${escapeAttr(rate.base_nightly_rate ?? '')}" required /></label>
        <label class="admin-form-field"><span>Currency</span><input name="currency" maxlength="3" value="${escapeAttr(rate.currency)}" required /></label>
        <label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" step="1" value="${rate.sort_order}" /></label>
        <label class="admin-checkbox-field"><input name="is_active" type="checkbox" ${rate.is_active ? 'checked' : ''} /><span>Active sellable configuration</span></label>
      </div><div class="hotel-workspace-locked-fields"><div><span>Exact product ID</span><code>${escapeHtml(rate.id)}</code></div><div><span>Public effect</span><strong>None while V2 flags are off</strong></div></div></form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRoomRateEditorForm">Review product</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelRoomRateEditorForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fd = new FormData(form);
          let validated;
          try {
            validated = Core.validateRoomRate({
              ...rate,
              room_type_id: existing ? rate.room_type_id : String(fd.get('room_type_id')),
              rate_plan_id: existing ? rate.rate_plan_id : String(fd.get('rate_plan_id')),
              base_nightly_rate: Number(fd.get('base_nightly_rate')),
              currency: String(fd.get('currency') || '').trim().toUpperCase(),
              is_active: fd.get('is_active') === 'on',
              sort_order: Number(fd.get('sort_order')),
            }, state.workspace);
          } catch (error) { toast(error.message, 'error'); return; }
          closeModal({ restoreFocus: false });
          await openReview({
            title: existing ? 'Review Room Rate changes' : 'Review Room + Rate Plan product',
            entity: 'room_rate', before: existing, after: validated,
            operation: Core.operationForEntity('room_rate', validated, existing),
            successMessage: existing ? 'Room Rate product updated.' : 'Room Rate product created.',
          });
        });
      },
    });
  }

  async function duplicateRoom(roomId) {
    const source = state.workspace.room_types.find((room) => room.id === roomId);
    if (!source) return;
    const duplicate = Core.buildDuplicateRoom(source, state.workspace);
    const operation = Core.operationForEntity('room_type', { ...duplicate, source_id: source.id }, source, 'duplicate');
    operation.id = duplicate.id;
    operation.expected_version = source.version;
    closeModal({ restoreFocus: false });
    await openReview({
      title: 'Review Room Type duplicate', entity: 'room_type', before: source, after: duplicate, operation,
      successMessage: 'Room Type duplicated as a draft. Units and Rate products were not copied.',
    });
  }

  async function disableRoom(roomId) {
    const room = state.workspace.room_types.find((candidate) => candidate.id === roomId);
    if (!room) return;
    const after = { ...room, status: 'disabled' };
    await openReview({
      title: 'Review Room Type disable', entity: 'room_type', before: room, after,
      operation: Core.operationForEntity('room_type', after, room, 'disable'),
      successMessage: 'Room Type disabled. No rows were deleted.',
    });
  }

  function renderCalendarPanel(panel) {
    panel.innerHTML = `${workspacePanelHeader('Calendar', 'The full inventory and rate calendar is intentionally scheduled for H2B.')}
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Read-only design contract</span><h4>Deterministic manual precedence</h4><ol class="hotel-calendar-precedence">${Core.CALENDAR_PRECEDENCE.map((rule) => `<li><b>${rule.rank}</b><span>${escapeHtml(rule.label)}</span></li>`).join('')}</ol><p>Equal-priority ambiguity will fail closed. H2A creates no calendar rows and no public rates.</p><button class="btn-secondary" type="button" disabled>Calendar editor arrives in H2B</button></section>`;
  }

  function renderBookingsPanel(panel) {
    const upcoming = Number(state.workspace.counts?.upcoming_bookings || 0);
    panel.innerHTML = `${workspacePanelHeader('Bookings', 'Existing Hotel booking and partner-confirmation behavior remains unchanged.')}
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Current legacy booking system</span><h4>${upcoming} upcoming booking${upcoming === 1 ? '' : 's'}</h4><p>H2A does not introduce a V2 booking engine. Open the existing Hotels Bookings view to manage current request-confirmation bookings.</p><button class="btn-primary" type="button" data-open-current-hotel-bookings>Open current Hotel bookings</button></section>`;
    panel.querySelector('[data-open-current-hotel-bookings]')?.addEventListener('click', () => {
      closeWorkspace();
      document.querySelector('.hotels-tab-button[data-tab="bookings"]')?.click?.();
    });
  }

  function depositRuleLabel(rule) {
    const source = Core.asObject(rule);
    if (!source.enabled) return 'No online payment required by this rule';
    const amount = Number(source.amount || 0);
    const currency = String(source.currency || state.workspace.property.currency || 'EUR');
    const labels = {
      percent_total: `${amount}% of booking total`,
      per_day: `${formatMoney(amount, currency)} per day`,
      per_hour: `${formatMoney(amount, currency)} per hour`,
      per_person: `${formatMoney(amount, currency)} per person`,
      flat: `${formatMoney(amount, currency)} flat`,
    };
    return labels[source.mode] || 'Configured central payment rule';
  }

  function openCentralHotelDepositSettings() {
    const propertyId = state.workspace?.property?.id;
    closeWorkspace();
    if (typeof window.openHotelDepositSettings === 'function') {
      window.openHotelDepositSettings(propertyId);
      return;
    }
    toast('Deposit Settings handoff is unavailable. Reload Admin and try again.', 'error');
  }

  function renderPaymentsPanel(panel) {
    const payment = Core.asObject(state.workspace.payment_due);
    const exact = Core.asObject(payment.exact_override);
    const fallback = Core.asObject(payment.default_rule);
    const effective = Object.keys(exact).length ? exact : fallback;
    panel.innerHTML = `${workspacePanelHeader('Payments', 'A read-only summary of the existing central Hotel payment-due-at-booking system.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Payment due at booking</span><h4>${escapeHtml(depositRuleLabel(effective))}</h4><p>${Object.keys(exact).length ? 'Exact property override' : 'Hotels default rule'} from the existing central Deposit Settings tables.</p><button class="btn-primary" type="button" data-open-hotel-deposit>Manage in Deposit Settings</button></section>
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Platform commission</span><h4>Not configured in H2A</h4><p>Commission is distinct from customer prepayment and remains future work.</p></section>
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Partner payout / Stripe Connect</span><h4>Capability disabled</h4><p>No connected-account or payout behavior is exposed in this stage.</p></section></div>`;
    panel.querySelector('[data-open-hotel-deposit]')?.addEventListener('click', openCentralHotelDepositSettings);
  }

  function openPropertyMediaEditor() {
    const property = state.workspace.property;
    const photos = Core.normalizeGallery(property.photos);
    openModal({
      title: 'Edit property gallery',
      body: `<form id="hotelPropertyMediaForm" class="hotel-workspace-form">
        <p class="hotel-workspace-intro">Property photos stay shared at property level. Room-specific photos belong in each Room Type.</p>
        ${photos.length ? `<div class="hotel-gallery-editor__grid">${photos.map((url) => `<label><img src="${escapeAttr(url)}" alt="" loading="lazy" /><span><input type="checkbox" name="remove_property_gallery_url" value="${escapeAttr(url)}" /> Remove</span><span><input type="radio" name="property_cover_url" value="${escapeAttr(url)}" ${url === property.cover_image_url ? 'checked' : ''} /> Cover</span></label>`).join('')}</div>` : '<p>No property gallery images yet.</p>'}
        <label class="admin-form-field"><span>Add property photos</span><input type="file" name="property_gallery_files" accept="image/*" multiple /></label>
        <label class="admin-form-field"><span>Cover image URL</span><input name="cover_image_url" type="url" value="${escapeAttr(property.cover_image_url || '')}" placeholder="Selected gallery photo or existing trusted URL" /></label>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelPropertyMediaForm">Review media changes</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelPropertyMediaForm');
        form?.querySelectorAll('[name="property_cover_url"]').forEach((radio) => radio.addEventListener('change', () => {
          form.elements.cover_image_url.value = radio.value;
        }));
        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const removed = fd.getAll('remove_property_gallery_url').map(String);
          const retained = photos.filter((url) => !removed.includes(url));
          const files = Array.from(form.elements.property_gallery_files?.files || []);
          let uploadedUrls = [];
          closeModal({ restoreFocus: false });
          if (files.length) {
            const uploader = window.HotelsV2AdminMedia?.uploadPropertyGallery;
            if (typeof uploader !== 'function') {
              toast('Optimized property-image uploader is unavailable.', 'error');
              return;
            }
            try {
              uploadedUrls = await uploader(property.slug, files);
            } catch (error) {
              toast(error?.message || 'Property gallery upload failed before Review.', 'error');
              return;
            }
          }
          const nextPhotos = Core.normalizeGallery([...retained, ...uploadedUrls]);
          let coverImageUrl = String(fd.get('cover_image_url') || '').trim() || null;
          if (coverImageUrl && removed.includes(coverImageUrl)) coverImageUrl = nextPhotos[0] || null;
          if (!coverImageUrl && nextPhotos.length) coverImageUrl = nextPhotos[0];
          const next = { ...property, photos: nextPhotos, cover_image_url: coverImageUrl };
          const cleanupUploaded = async () => {
            if (!uploadedUrls.length) return;
            await window.HotelsV2AdminMedia?.removePropertyGalleryUploads?.(uploadedUrls);
            uploadedUrls = [];
          };
          const cleanupRejectedUpload = async (error) => {
            if (error?.isDefinitiveFailure) await cleanupUploaded();
          };
          await openReview({
            title: 'Review property media changes',
            entity: 'property',
            before: property,
            after: next,
            operation: Core.operationForEntity('property', next, property),
            onCancel: files.length ? cleanupUploaded : null,
            onApplyError: files.length ? cleanupRejectedUpload : null,
            closeOnApplyError: files.length > 0,
            successMessage: 'Property gallery updated without changing publication.',
          });
        });
      },
    });
  }

  function renderContentPanel(panel) {
    const property = state.workspace.property;
    const photos = Core.normalizeGallery(property.photos);
    const roomPhotoCount = state.workspace.room_types.reduce((count, room) => count + room.gallery.length, 0);
    panel.innerHTML = `${workspacePanelHeader('Content & Media', 'Property media stays shared; Room Type galleries contain only room-specific images.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Property gallery</span><h4>${photos.length} image${photos.length === 1 ? '' : 's'}</h4>${photos.length ? `<div class="hotel-content-preview">${photos.slice(0, 6).map((url) => `<img src="${escapeAttr(url)}" alt="" loading="lazy" />`).join('')}</div>` : '<p>No property gallery images.</p>'}<button class="btn-primary" type="button" data-edit-property-media>Edit property gallery</button></section>
      <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Room galleries</span><h4>${roomPhotoCount} room image${roomPhotoCount === 1 ? '' : 's'}</h4><p>Edit a Room Type to upload images to its exact normalized gallery. Property photos are not duplicated automatically.</p><button class="btn-secondary" type="button" data-open-rooms-media>Open Rooms & Rates</button></section></div>
      ${property.architecture_version === 'legacy' ? `<section class="hotel-workspace-card hotel-legacy-advanced"><details><summary>Advanced / legacy content</summary><p>The current editor remains available for legacy JSON room information and public-page compatibility. It never writes normalized Room Types.</p><button class="btn-secondary" type="button" data-edit-legacy-content>Open legacy editor</button><code>${escapeHtml(property.id)}</code></details></section>` : ''}`;
    panel.querySelector('[data-edit-property-media]')?.addEventListener('click', openPropertyMediaEditor);
    panel.querySelector('[data-edit-legacy-content]')?.addEventListener('click', () => window.editHotel?.(property.id));
    panel.querySelector('[data-open-rooms-media]')?.addEventListener('click', () => { state.activeTab = 'rooms'; renderWorkspace(); });
  }

  function renderPartnerPanel(panel) {
    const property = state.workspace.property;
    const owner = Core.asObject(property.owner_partner);
    const assignments = state.workspace.operational_partners;
    panel.innerHTML = `${workspacePanelHeader('Partner & Access', 'Commercial ownership and existing operational partner routing are shown separately.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Commercial owner</span><h4>${escapeHtml(owner.name || 'Not assigned')}</h4><p>${owner.id ? `Status: ${escapeHtml(owner.status || 'unknown')}` : 'Assign an active commercial owner from Overview if required.'}</p>${owner.id ? `<code>${escapeHtml(owner.id)}</code>` : ''}</section>
      <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Operational assignments</span><h4>${assignments.length} assignment${assignments.length === 1 ? '' : 's'}</h4>${assignments.length ? `<ul class="hotel-simple-list">${assignments.map((entry) => `<li><span>${escapeHtml(entry.name || entry.partner_id)}</span><small>${entry.is_active ? 'Active' : 'Inactive'}</small></li>`).join('')}</ul>` : '<p>No operational partner assignment.</p>'}<small>H2A is read-only for operational assignments so it cannot backfill or reroute historical fulfillments.</small></section>
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Partner permissions</span><h4>Not broadened</h4><p>Partners retain the exact H1A booking/fulfillment access contract. Raw normalized tables remain unavailable.</p></section></div>`;
  }

  function renderDistributionPanel(panel) {
    const flags = state.workspace.flags;
    const flagRows = ['hotel_rooms_v2_enabled', 'hotel_external_sync_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    panel.innerHTML = `${workspacePanelHeader('Distribution & Sync', 'External sources and distribution adapters are intentionally deferred.')}
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Capability status</span><h4>All Hotels V2 capabilities must remain off</h4><ul class="hotel-simple-list">${flagRows.map((key) => `<li><span>${escapeHtml(key.replaceAll('_', ' '))}</span><strong>${flags[key] === true ? 'ON — unexpected' : 'OFF'}</strong></li>`).join('')}</ul><p>No Booking.com, iCal, external API, instant-booking or Stripe Connect behavior is implemented here.</p></section>`;
  }

  function renderActivityPanel(panel) {
    const activity = state.workspace.activity;
    panel.innerHTML = `${workspacePanelHeader('Activity', 'Immutable reviewed changes written through the H2A Admin transaction.')}
      <section class="hotel-workspace-card">${activity.length ? `<ol class="hotel-activity-list">${activity.map((entry) => `<li><span><strong>${escapeHtml(String(entry.action || '').replaceAll('_', ' '))}</strong><small>${escapeHtml(entry.entity_type || 'entity')} · ${escapeHtml(entry.source || 'admin')}</small></span><time datetime="${escapeAttr(entry.created_at)}">${escapeHtml(new Date(entry.created_at).toLocaleString())}</time></li>`).join('')}</ol>` : renderEmptyState('No H2A activity yet', 'Reviewed normalized saves will appear here.')}</section>`;
  }

  return Object.freeze({
    state,
    init,
    loadPropertyList,
    renderPropertyList,
    openWorkspace,
    closeWorkspace,
    renderWorkspace,
  });
});
