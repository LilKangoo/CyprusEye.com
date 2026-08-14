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
    calendar: {
      loading: false,
      error: null,
      anchor_date: null,
      view: 'month',
      data: null,
      selected_product_ids: [],
      mobile_product_id: null,
      selection_start: null,
      selection_end: null,
      selection_anchor: null,
      drag_active: false,
    },
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

  function isoDateFromUtc(date) {
    return new Date(date).toISOString().slice(0, 10);
  }

  function parseIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function todayIsoDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: state.workspace?.property?.timezone || 'Europe/Nicosia',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function addCalendarDays(value, days) {
    const date = parseIsoDate(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return isoDateFromUtc(date);
  }

  function calendarMonthRange(anchor) {
    const date = parseIsoDate(anchor) || parseIsoDate(todayIsoDate());
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { start: isoDateFromUtc(first), end: isoDateFromUtc(last) };
  }

  function calendarWeekRange(anchor) {
    const date = parseIsoDate(anchor) || parseIsoDate(todayIsoDate());
    const isoWeekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - (isoWeekday - 1));
    const start = isoDateFromUtc(date);
    return { start, end: addCalendarDays(start, 6) };
  }

  function calendarTwoMonthRange(anchor) {
    const date = parseIsoDate(anchor) || parseIsoDate(todayIsoDate());
    const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0));
    return { start: isoDateFromUtc(first), end: isoDateFromUtc(last) };
  }

  function activeCalendarRange() {
    const anchor = state.calendar.anchor_date || todayIsoDate();
    if (state.calendar.view === 'week') return calendarWeekRange(anchor);
    if (state.calendar.view === 'two_months') return calendarTwoMonthRange(anchor);
    return calendarMonthRange(anchor);
  }

  function enumerateCalendarDates(start, end) {
    const dates = [];
    for (let value = start; value && value <= end; value = addCalendarDays(value, 1)) dates.push(value);
    return dates;
  }

  function calendarDateLabel(value, options = {}) {
    const date = parseIsoDate(value);
    if (!date) return value;
    return new Intl.DateTimeFormat('en-GB', options.long
      ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
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
    const propertyPhotos = Core.normalizeGallery(source.photos);
    const propertyLevelProduct = normalizedRooms.length === 0 && propertyRuleCount > 0;
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
      configured_product_count: normalizedRooms.length || (propertyLevelProduct ? 1 : 0),
      product_kind: propertyLevelProduct ? 'property_level_accommodation' : 'structured_legacy_rooms',
      property_gallery_count: propertyPhotos.length,
      max_persons: Number(source.max_persons) > 0 ? Number(source.max_persons) : null,
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

  function migrationClassificationLabel(value) {
    return String(value || '').replaceAll('_', ' ');
  }

  function renderMigrationFieldClassifications(preview) {
    const fields = Core.asArray(preview?.legacy_product?.field_classifications);
    if (!fields.length) return '';
    return `<div class="hotel-legacy-migration-fields">
      <span class="hotel-workspace-eyebrow">Source → proposed Room Type</span>
      <ul>${fields.map((item) => {
        const classification = String(item.classification || 'UNKNOWN');
        return `<li>
          <div><strong>${escapeHtml(item.field)}</strong><small>${escapeHtml(item.source_summary || 'Not specified')}</small></div>
          <span class="hotel-migration-classification hotel-migration-classification--${escapeAttr(classification.toLowerCase().replaceAll('_', '-'))}">${escapeHtml(migrationClassificationLabel(classification))}</span>
          <p>${escapeHtml(item.note || '')}</p>
        </li>`;
      }).join('')}</ul>
    </div>`;
  }

  function renderLegacyProductPreview(preview, legacySummary) {
    const product = Core.asObject(preview?.legacy_product);
    const pricingPreview = Core.asObject(preview?.pricing_preview);
    if (!Object.keys(product).length) return '';
    const sevenArches = preview.property_id === Core.SEVEN_ARCHES_PROPERTY_ID
      ? Core.sevenArchesShadowPreparation(state.workspace)
      : null;
    return `<div class="hotel-legacy-product-preview">
      <div class="hotel-legacy-product-preview__columns">
        <section>
          <span class="hotel-workspace-eyebrow">Current live product</span>
          <h5>${escapeHtml(product.label || 'Legacy property-level accommodation')}</h5>
          <p><strong>${preview.legacy_live_product_count}</strong> configured accommodation product${preview.legacy_live_product_count === 1 ? '' : 's'}</p>
          <ul>
            <li>${legacyPublicPriceMarkup(legacySummary)}</li>
            <li>${preview.legacy_pricing_rule_count} legacy pricing rule${preview.legacy_pricing_rule_count === 1 ? '' : 's'}</li>
            <li>${preview.property_gallery_count} property gallery photo${preview.property_gallery_count === 1 ? '' : 's'}</li>
          </ul>
        </section>
        <section>
          <span class="hotel-workspace-eyebrow">Proposed V2 shadow</span>
          ${sevenArches ? `<h5>2 confirmed apartments</h5><p><strong>${sevenArches.eligible ? 'Ready for photo selection and Review' : 'Preparation blocked'}</strong></p><small>Upper Floor Apartment · Ground Floor Apartment</small>` : '<h5>Room Type #1</h5><p><strong>Awaiting Admin confirmation</strong></p><small>No Room Type, Rate Plan, Room Rate or Calendar row has been created.</small>'}
        </section>
      </div>
      ${renderMigrationFieldClassifications(preview)}
      ${pricingPreview.requires_occupancy_los_model ? `<div class="hotel-legacy-pricing-blocker">
        <strong>Pricing activation remains separate</strong>
        <p>${pricingPreview.rule_count} rules combine ${Core.asArray(pricingPreview.guest_counts).length} guest counts with ${Core.asArray(pricingPreview.stay_thresholds).length} stay thresholds. H2B can preserve the matrix in shadow, but the shared Standard plan remains inactive until cancellation/payment conditions and the complete oracle are reviewed.</p>
        <code>${escapeHtml(pricingPreview.oracle)}</code>
      </div>` : ''}
      ${sevenArches?.eligible
        ? '<button class="btn-primary" type="button" data-prepare-seven-arches-apartments>Prepare 2 existing apartments</button>'
        : preview.can_prepare_existing_accommodation && !sevenArches
          ? '<button class="btn-primary" type="button" data-prepare-legacy-accommodation>Prepare existing accommodation as Room Type</button>'
        : ''}
      ${sevenArches && !sevenArches.eligible ? `<p class="hotel-property-card__blocker">${escapeHtml(sevenArches.blocker)}</p>` : ''}
      <p class="hotel-workspace-safety-note">Pricing migration is separate and remains blocked until the full legacy price oracle can be reproduced.</p>
    </div>`;
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
                <small>${legacySummary.configured_product_count} configured accommodation product${legacySummary.configured_product_count === 1 ? '' : 's'} · ${legacySummary.product_kind === 'property_level_accommodation' ? 'property-level legacy product' : 'structured legacy rooms'}</small>
              </section>
              <section class="hotel-property-card__v2-preparation">
                <span class="hotel-workspace-eyebrow">Rooms V2 preparation</span>
                <div class="hotel-property-card__metrics hotel-property-card__metrics--preparation">
                  <span><strong>${roomCount}</strong> normalized room types</span>
                  <span><strong>${inventory}</strong> inventory</span>
                  <span><strong>${ratePlans}</strong> rate plans</span>
                  <span><strong>${price == null ? 'Not configured' : escapeHtml(formatMoney(price, property.currency))}</strong> ${price == null ? 'shadow setup' : 'configured from'}</span>
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
      state.calendar = {
        loading: false,
        error: null,
        anchor_date: todayIsoDate(),
        view: 'month',
        data: null,
        selected_product_ids: [],
        mobile_product_id: null,
        selection_start: null,
        selection_end: null,
        selection_anchor: null,
        drag_active: false,
      };
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
    state.calendar.data = null;
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

  function childPolicyText(policy, minimumAge, options = {}) {
    if (!policy) return options.inherit ? 'Use property policy' : 'Not reviewed';
    try { return Core.childrenPolicyLabel(policy, minimumAge); }
    catch (_error) { return 'Invalid policy'; }
  }

  function childPolicyOptions(policy, options = {}) {
    const current = String(policy || '');
    return `${options.allowInherit ? `<option value="" ${!current ? 'selected' : ''}>Use property policy</option>` : `<option value="" ${!current ? 'selected' : ''} disabled>Choose policy</option>`}
      <option value="allowed" ${current === 'allowed' ? 'selected' : ''}>Children allowed</option>
      <option value="not_allowed" ${current === 'not_allowed' ? 'selected' : ''}>Adults only / No children</option>
      <option value="minimum_age" ${current === 'minimum_age' ? 'selected' : ''}>Children allowed from minimum age</option>`;
  }

  function bindChildPolicyAge(form, policyName, ageName) {
    const policy = form.elements[policyName];
    const age = form.elements[ageName];
    const sync = () => {
      const enabled = policy.value === 'minimum_age';
      age.closest('label').hidden = !enabled;
      age.disabled = !enabled;
      age.required = enabled;
      if (!enabled) age.value = '';
    };
    policy.addEventListener('change', sync);
    sync();
  }

  function renderPropertyGuestPolicyCard(property) {
    const reviewed = Boolean(property.children_policy);
    return `<section class="hotel-workspace-card hotel-guest-policy-card${reviewed ? '' : ' is-unreviewed'}">
      <span class="hotel-workspace-eyebrow">Guest policy · Rooms V2 metadata</span>
      <h4>${escapeHtml(childPolicyText(property.children_policy, property.minimum_child_age))}</h4>
      <p>${property.architecture_version === 'legacy'
        ? 'Shadow metadata only. Current legacy public booking remains unchanged until an exact future migration.'
        : 'This policy will become authoritative only when the future Rooms V2 public booking contract is activated.'}</p>
      <button class="btn-secondary" type="button" data-edit-property-child-policy>${reviewed ? 'Edit children policy' : 'Review children policy'}</button>
    </section>`;
  }

  function openPropertyChildrenPolicyEditor() {
    const property = state.workspace.property;
    const overriddenRooms = state.workspace.room_types.filter((room) => (
      Boolean(room.children_policy_override) || room.minimum_child_age_override != null
    ));
    openModal({
      title: 'Children policy',
      body: `<form id="hotelPropertyChildPolicyForm" class="hotel-workspace-form">
        <p class="hotel-workspace-intro">Choose how this property accepts guests classified as children. This does not define a legal age category.</p>
        <div class="hotel-child-policy-options" role="group" aria-label="Children policy">
          <label class="admin-form-field"><span>Children</span><select name="children_policy" required>${childPolicyOptions(property.children_policy)}</select></label>
          <label class="admin-form-field"><span>Minimum child age</span><input name="minimum_child_age" type="number" min="${Core.CHILD_AGE_MIN}" max="${Core.CHILD_AGE_MAX}" step="1" value="${escapeAttr(property.minimum_child_age ?? '')}" /></label>
        </div>
        <label class="hotel-workspace-card hotel-guest-policy-inheritance">
          <input type="checkbox" name="clear_room_policy_overrides" value="true" ${overriddenRooms.length ? '' : 'disabled'} />
          <span><strong>Use this property policy for every Room Type</strong><small>${overriddenRooms.length
            ? `Clear ${overriddenRooms.length} exact Room Type override${overriddenRooms.length === 1 ? '' : 's'} in the same atomic reviewed save.`
            : 'Every Room Type already uses the property policy.'}</small></span>
        </label>
        <p class="hotel-workspace-safety-note">For a legacy property this remains Rooms V2 Admin/shadow metadata. The current public guest selection is unchanged.</p>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelPropertyChildPolicyForm">Review policy</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelPropertyChildPolicyForm');
        bindChildPolicyAge(form, 'children_policy', 'minimum_child_age');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          let policy;
          try { policy = Core.normalizeChildrenPolicy(fd.get('children_policy'), fd.get('minimum_child_age')); }
          catch (error) { toast(error.message, 'error'); return; }
          const policyPayload = { children_policy: policy.policy, minimum_child_age: policy.minimum_age };
          const clearRoomOverrides = fd.get('clear_room_policy_overrides') === 'true';
          const submitButton = overlay.querySelector('button[form="hotelPropertyChildPolicyForm"]');
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Loading fresh values…';
          }
          setModalSaving(overlay, true);
          try {
            const freshWorkspace = await Repository.getWorkspace(property.id);
            state.workspace = freshWorkspace;
            const freshProperty = freshWorkspace.property;
            const exactOverrides = clearRoomOverrides
              ? freshWorkspace.room_types.filter((room) => (
                Boolean(room.children_policy_override) || room.minimum_child_age_override != null
              ))
              : [];
            if (exactOverrides.length > 100) {
              throw new Error('More than 100 Room Type overrides need review. Narrow the property configuration before applying one atomic policy change.');
            }
            const roomPolicies = exactOverrides.map((room) => ({
              room_type_id: room.id,
              expected_version: room.version,
              // Explicit JSON null means clear. Omitting either field would
              // preserve the existing exact-room value in the Admin RPC.
              children_policy_override: null,
              minimum_child_age_override: null,
            }));
            const roomBefore = exactOverrides.map((room) => ({
              id: room.id,
              room: Core.i18nText(room.name_i18n, 'en', room.code),
              version: room.version,
              children_policy_override: room.children_policy_override,
              minimum_child_age_override: room.minimum_child_age_override,
            }));
            const roomAfter = exactOverrides.map((room) => ({
              id: room.id,
              room: Core.i18nText(room.name_i18n, 'en', room.code),
              children_policy_override: null,
              minimum_child_age_override: null,
              effective_policy: childPolicyText(policyPayload.children_policy, policyPayload.minimum_child_age),
              effective_source: 'Property policy',
            }));
            const before = {
              id: freshProperty.id,
              children_policy: freshProperty.children_policy,
              minimum_child_age: freshProperty.minimum_child_age,
              ...(clearRoomOverrides ? { room_type_overrides: roomBefore } : {}),
            };
            const after = {
              id: freshProperty.id,
              ...policyPayload,
              ...(clearRoomOverrides ? { room_type_overrides: roomAfter } : {}),
            };
            const plan = {
              hotel_id: freshProperty.id,
              expected_property_updated_at: freshProperty.updated_at || null,
              reviewed_at: new Date().toISOString(),
              property_policy: policyPayload,
              room_policies: roomPolicies,
            };
            closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            await openReview({
              title: clearRoomOverrides
                ? 'Review property policy and Room Type inheritance'
                : 'Review property children policy',
              entity: 'children_policy',
              before,
              after,
              onConfirm: () => Repository.applyGuestPolicyPlan(plan),
              contextMessage: clearRoomOverrides
                ? `${roomPolicies.length} exact Room Type override${roomPolicies.length === 1 ? '' : 's'} will be cleared. The property policy becomes effective for those rooms in one atomic, version-checked operation. No public booking form, legacy price, property architecture, feature flag or historical row is changed.`
                : 'No public booking form, legacy price, property architecture, feature flag or historical row is changed.',
              successMessage: clearRoomOverrides
                ? 'Property children policy saved and exact Room Types now inherit it.'
                : 'Property children policy saved as Rooms V2 Admin metadata.',
            });
          } catch (error) {
            setModalSaving(overlay, false);
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = 'Review policy';
            }
            toast(error?.userMessage || error?.message || 'Fresh children-policy values could not be loaded.', 'error');
          }
        });
      },
    });
  }

  function openRoomChildrenPolicyEditor(roomId) {
    const room = state.workspace.room_types.find((candidate) => candidate.id === roomId);
    if (!room) return;
    openModal({
      title: `Children policy · ${Core.i18nText(room.name_i18n, 'en', room.code)}`,
      body: `<form id="hotelRoomChildPolicyForm" class="hotel-workspace-form">
        <p class="hotel-workspace-intro">Use the property policy by default, or configure an exact Room Type override.</p>
        <div class="hotel-child-policy-options">
          <label class="admin-form-field"><span>Room policy</span><select name="children_policy_override">${childPolicyOptions(room.children_policy_override, { allowInherit: true })}</select></label>
          <label class="admin-form-field"><span>Minimum child age</span><input name="minimum_child_age_override" type="number" min="${Core.CHILD_AGE_MIN}" max="${Core.CHILD_AGE_MAX}" step="1" value="${escapeAttr(room.minimum_child_age_override ?? '')}" /></label>
        </div>
        <div class="hotel-workspace-locked-fields"><div><span>Property default</span><strong>${escapeHtml(childPolicyText(state.workspace.property.children_policy, state.workspace.property.minimum_child_age))}</strong></div><div><span>Exact Room Type</span><code>${escapeHtml(room.id)}</code></div></div>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRoomChildPolicyForm">Review override</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelRoomChildPolicyForm');
        bindChildPolicyAge(form, 'children_policy_override', 'minimum_child_age_override');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          let policy;
          try { policy = Core.normalizeChildrenPolicy(fd.get('children_policy_override'), fd.get('minimum_child_age_override'), { allowInherit: true }); }
          catch (error) { toast(error.message, 'error'); return; }
          const before = { id: room.id, children_policy_override: room.children_policy_override, minimum_child_age_override: room.minimum_child_age_override };
          const after = { id: room.id, children_policy_override: policy.policy, minimum_child_age_override: policy.minimum_age };
          const plan = {
            hotel_id: state.workspace.property.id,
            expected_property_updated_at: state.workspace.property.updated_at || null,
            reviewed_at: new Date().toISOString(),
            room_policies: [{ room_type_id: room.id, expected_version: room.version, children_policy_override: policy.policy, minimum_child_age_override: policy.minimum_age }],
          };
          closeModal({ restoreFocus: false });
          await openReview({
            title: 'Review Room Type children policy', entity: 'room_children_policy', before, after,
            onConfirm: () => Repository.applyGuestPolicyPlan(plan),
            contextMessage: `Exact Room Type ${room.id}. This override does not alter pricing, inventory, publication or the property default.`,
            successMessage: 'Room Type children-policy override saved.',
          });
        });
      },
    });
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
          ${renderPropertyGuestPolicyCard(property)}
          ${legacySummary ? `<section class="hotel-workspace-card hotel-legacy-live">
            <span class="hotel-workspace-eyebrow">Current live legacy product</span>
            <h4>${legacyPublicPriceMarkup(legacySummary)}</h4>
            <dl>
              <div><dt>Pricing model</dt><dd>${escapeHtml(legacySummary.pricing_model_label)}</dd></div>
              <div><dt>Existing public price</dt><dd>${legacyPublicPriceMarkup(legacySummary)}</dd></div>
              <div><dt>Legacy pricing rules</dt><dd>${legacySummary.pricing_rule_count}</dd></div>
              <div><dt>Configured accommodation products</dt><dd>${legacySummary.configured_product_count}</dd></div>
              <div><dt>Normalized room types</dt><dd>${state.workspace.room_types.length}</dd></div>
              <div><dt>Legacy room rows</dt><dd>${legacySummary.room_count}</dd></div>
              <div><dt>Existing property gallery</dt><dd>${legacySummary.property_gallery_count} photo${legacySummary.property_gallery_count === 1 ? '' : 's'}</dd></div>
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
            <dl><div><dt>Live accommodation products</dt><dd>${preview.legacy_live_product_count}</dd></div><div><dt>Legacy room rows</dt><dd>${preview.legacy_room_count}</dd></div><div><dt>Legacy pricing rules</dt><dd>${preview.legacy_pricing_rule_count}</dd></div><div><dt>Status</dt><dd>Not migrated</dd></div></dl>
            <p>${escapeHtml(preview.messages[0])}</p>
            ${preview.suggestions.length ? `<ul>${preview.suggestions.map((item) => `<li>${escapeHtml(Core.i18nText(item.proposed_name, 'en', item.proposed_code))} → draft Room Type</li>`).join('')}</ul>` : ''}
            ${legacySummary ? renderLegacyProductPreview(preview, legacySummary) : ''}
          </section>
        </aside>
      </div>`;
    const overviewForm = byId('hotelWorkspaceOverviewForm');
    overviewForm?.addEventListener('submit', handleOverviewReview);
    overviewForm?.querySelector('[data-amenity-search]')?.addEventListener('input', (event) => {
      const term = event.currentTarget.value.trim().toLowerCase();
      overviewForm.querySelectorAll('.hotel-amenity-group').forEach((group) => { group.hidden = term && !group.textContent.toLowerCase().includes(term); });
    });
    panel.querySelector('[data-prepare-legacy-accommodation]')?.addEventListener('click', () => openLegacyAccommodationPreparation(preview));
    panel.querySelector('[data-prepare-seven-arches-apartments]')?.addEventListener('click', openSevenArchesPreparation);
    panel.querySelector('[data-edit-property-child-policy]')?.addEventListener('click', openPropertyChildrenPolicyEditor);
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
    const migration = Core.migrationPreview(workspace);
    const sevenArches = workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID
      ? Core.sevenArchesShadowPreparation(workspace)
      : null;
    const rooms = workspace.room_types.slice().sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    const plans = workspace.rate_plans.slice().sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
    panel.innerHTML = `
      ${workspacePanelHeader('Rooms & Rates', 'Manage Room Types, optional physical units, reusable Rate Plans and their sellable products.', `
        <div class="hotel-workspace-panel-actions"><button class="btn-secondary" type="button" data-add-rate-plan>+ Rate Plan</button><button class="btn-primary" type="button" data-add-room>${rooms.length ? '+ Another Room Type' : '+ Room Type'}</button></div>`)}
      ${migration.legacy_product ? `<section class="hotel-workspace-card hotel-legacy-product-banner">
        <div><span class="hotel-workspace-eyebrow">Current live legacy product</span><h4>${migration.legacy_live_product_count} configured accommodation product${migration.legacy_live_product_count === 1 ? '' : 's'}</h4><p>${migration.legacy_pricing_rule_count} legacy pricing rules remain live. Below are ${rooms.length} normalized Room Types in inert V2 preparation.</p></div>
        ${sevenArches?.eligible
          ? '<button class="btn-primary" type="button" data-prepare-seven-arches-apartments>Prepare 2 existing apartments</button>'
          : migration.can_prepare_existing_accommodation && !sevenArches
            ? '<button class="btn-primary" type="button" data-prepare-legacy-accommodation>Prepare existing accommodation as Room Type</button>'
            : '<span class="hotel-workspace-status hotel-workspace-status--warning">Not migrated</span>'}
      </section>` : ''}
      <div class="hotel-rooms-layout">
        <section>
          <div class="hotel-workspace-section-title"><div><h4>Normalized Room Types</h4><p>One Room Type may use several Rate Plans.</p></div><span>${rooms.length}</span></div>
          <div class="hotel-room-grid">${rooms.length ? rooms.map(renderRoomCard).join('') : renderEmptyState('No Room Types yet', 'Create the first draft room without changing the current public Hotel.')}</div>
        </section>
        <section>
          <div class="hotel-workspace-section-title"><div><h4>Property Rate Plans</h4><p>Create once and connect to one or many Room Types.</p></div><span>${plans.length}</span></div>
          <div class="hotel-rate-plan-list">${plans.length ? plans.map(renderRatePlanCard).join('') : renderEmptyState('No Rate Plans yet', 'Add Flexible, Non-refundable or another property-level plan.')}</div>
        </section>
      </div>`;
    panel.querySelector('[data-add-room]')?.addEventListener('click', () => openRoomEditor());
    panel.querySelector('[data-add-rate-plan]')?.addEventListener('click', () => openRatePlanEditor());
    panel.querySelector('[data-prepare-legacy-accommodation]')?.addEventListener('click', () => openLegacyAccommodationPreparation(migration));
    panel.querySelector('[data-prepare-seven-arches-apartments]')?.addEventListener('click', openSevenArchesPreparation);
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
    const capacityLabel = room.max_occupancy != null
      ? `Max ${room.max_occupancy} guests · adult/child split not confirmed`
      : `${room.capacity_adults} adults · ${room.capacity_children} children`;
    let childPolicy;
    try {
      const resolved = Core.resolveChildrenPolicy(state.workspace.property, room);
      childPolicy = `${childPolicyText(resolved.policy, resolved.minimum_age)} · ${resolved.source === 'property' ? 'property default' : 'room override'}`;
    } catch (_error) {
      childPolicy = 'Children policy not reviewed';
    }
    return `<article class="hotel-room-card" data-room-id="${escapeAttr(room.id)}">
      <header><div><span class="hotel-workspace-eyebrow">${escapeHtml(room.code)}</span><h4>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</h4><p>${escapeHtml(capacityLabel)} · ${escapeHtml(inventoryLabel)}</p></div><span class="hotel-workspace-status hotel-workspace-status--${statusTone(room.status === 'active' ? 'READY' : room.status === 'disabled' ? 'BLOCKED' : 'DRAFT')}">${escapeHtml(room.status.toUpperCase())}</span></header>
      <div class="hotel-room-card__details"><span>${escapeHtml(Core.formatBedConfiguration(room.bed_configuration))}</span><span>${room.bathrooms == null ? 'Bathrooms not specified' : `${room.bathrooms} bathroom(s)`}</span><span>${room.size_sqm == null ? 'Size not specified' : `${room.size_sqm} m²`}</span></div>
      <div class="hotel-room-card__guest-policy"><span>Children</span><strong>${escapeHtml(childPolicy)}</strong><button class="btn-secondary" type="button" data-edit-room-child-policy="${escapeAttr(room.id)}">Edit</button></div>
      <div class="hotel-room-card__rates">${roomRates.length ? roomRates.map(renderRoomRateLine).join('') : '<p>No Rate Plans connected.</p>'}</div>
      ${room.inventory_mode === 'unitized' ? `<details class="hotel-room-card__units"><summary>${units.length} physical units</summary>${units.length ? units.map(renderUnitLine).join('') : '<p>No units configured.</p>'}<button class="btn-secondary" type="button" data-add-unit="${escapeAttr(room.id)}">Add unit</button></details>` : ''}
      <footer><button class="btn-secondary" type="button" data-edit-room="${escapeAttr(room.id)}">Edit</button><button class="btn-secondary" type="button" data-connect-room-rate="${escapeAttr(room.id)}">Rates</button><button class="btn-secondary" type="button" data-duplicate-room="${escapeAttr(room.id)}">Duplicate</button>${room.status !== 'disabled' ? `<button class="btn-secondary hotel-danger-action" type="button" data-disable-room="${escapeAttr(room.id)}">Disable</button>` : ''}</footer>
    </article>`;
  }

  function renderRoomRateLine(rate) {
    const plan = state.workspace.rate_plans.find((candidate) => candidate.id === rate.rate_plan_id);
    const schedule = rate.pricing_schedule_id
      ? state.workspace.pricing_schedules.find((candidate) => candidate.id === rate.pricing_schedule_id)
      : null;
    const tierCount = schedule
      ? state.workspace.pricing_schedule_tiers.filter((tier) => tier.schedule_id === schedule.id && tier.is_active !== false).length
      : 0;
    const detail = schedule
      ? `Inactive shared schedule · ${tierCount} tiers · H3 allocation review required`
      : (rate.is_active ? 'Active product' : 'Inactive product');
    const price = schedule ? 'Shared schedule' : formatMoney(rate.base_nightly_rate, rate.currency);
    return `<button type="button" class="hotel-room-rate-line" data-edit-room-rate="${escapeAttr(rate.id)}"><span><strong>${escapeHtml(Core.i18nText(plan?.name_i18n, 'en', 'Rate Plan'))}</strong><small>${escapeHtml(detail)}</small></span><b>${escapeHtml(price)}</b></button>`;
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
    panel.querySelectorAll('[data-edit-room-child-policy]').forEach((button) => button.addEventListener('click', () => openRoomChildrenPolicyEditor(button.dataset.editRoomChildPolicy)));
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
    const reviewedOperations = Core.asArray(operations);
    const isExactRoomTypeSave = reviewedOperations.length === 1 && reviewedOperations[0]?.entity === 'room_type';
    const plan = isExactRoomTypeSave
      ? Core.buildRoomTypePlan(state.workspace, reviewedOperations[0])
      : Core.buildWorkspacePlan(state.workspace, reviewedOperations);
    const result = isExactRoomTypeSave
      ? await Repository.applyRoomTypePlan(plan)
      : await Repository.applyWorkspacePlan(plan);
    state.workspace = result.workspace;
    closeModal({ restoreFocus: false, skipCleanup: true, force: true });
    renderWorkspace();
    void loadPropertyList().catch(() => {});
    toast(options.successMessage || 'Reviewed Property Workspace changes saved.', 'success');
    return result;
  }

  async function openReview({ title, entity, before, after, operation, operations, onConfirm, onCancel, onApplyError, onStaleReview, closeOnApplyError = false, successMessage, contextMessage = '' }) {
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
        ${contextMessage ? `<p class="hotel-workspace-safety-note">${escapeHtml(contextMessage)}</p>` : ''}
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
            if (typeof onConfirm === 'function') {
              const result = await onConfirm();
              if (result?.workspace) state.workspace = result.workspace;
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              renderWorkspace();
              void loadPropertyList().catch(() => {});
              toast(successMessage || 'Reviewed Property Workspace changes saved.', 'success');
            } else {
              await applyReviewedOperations(reviewedOperations, { successMessage });
            }
          } catch (error) {
            let failure = error;
            if (error?.isStale && typeof onStaleReview === 'function') {
              try {
                const freshReview = await onStaleReview(error);
                if (freshReview) {
                  setModalSaving(overlay, false);
                  closeModal({ restoreFocus: false, skipCleanup: true, force: true });
                  await openReview(freshReview);
                  toast(freshReview.reReviewMessage
                    || 'Save stopped because this workspace changed. Fresh values are ready for review; nothing was retried automatically.', 'warning');
                  return;
                }
              } catch (refreshError) {
                failure = refreshError;
                if (!failure.userMessage) {
                  failure.userMessage = 'The stale save was stopped safely, but fresh values could not be prepared for review. Refresh the workspace and try again.';
                }
              }
            }
            try { await onApplyError?.(failure); } catch (cleanupError) { console.error('Failed to clean up reviewed Hotel media upload:', cleanupError); }
            if (failure?.diagnosticContext) {
              console.error('Reviewed Hotel save rejected.', {
                code: failure.code || null,
                reason: failure.diagnosticReason || null,
                diagnosticContext: failure.diagnosticContext,
              });
            }
            if (failure?.closeReviewAfterStale === true) {
              setModalSaving(overlay, false);
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              renderWorkspace();
              if (failure.openSevenArchesConflictReview) {
                openSevenArchesConflictReview(failure.openSevenArchesConflictReview);
              } else if (failure.reopenSevenArchesPreparation) {
                openSevenArchesPreparation(failure.reopenSevenArchesPreparation);
              }
              toast(failure.userMessage || failure.message, failure.openSevenArchesConflictReview ? 'warning' : 'error');
              return;
            }
            setModalSaving(overlay, false);
            if (closeOnApplyError) closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            button.disabled = false;
            button.textContent = 'Save reviewed changes';
            const message = failure?.userMessage
              || (failure?.isStale
                ? 'Save stopped: this configuration changed after Review. Refresh and review the fresh values.'
              : failure?.isAmbiguousOutcome
                ? 'The save result could not be confirmed because the connection was interrupted. Uploaded media was preserved. Refresh Property Workspace before retrying; do not upload the same files again.'
                : failure?.isDefinitiveFailure
                  ? 'The reviewed save was rejected safely. Refresh the workspace and review the current configuration; no partial save was kept.'
                  : (failure?.message || 'Reviewed save failed. No database changes were kept.'));
            toast(message, failure?.isAmbiguousOutcome ? 'warning' : 'error');
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

  function legacyPropertyPhotoSelectionMarkup(preview) {
    const photos = Core.normalizeGallery(state.workspace?.property?.photos);
    if (!photos.length) {
      return '<fieldset class="hotel-legacy-photo-picker"><legend>Property photos requiring review</legend><p>No property gallery photos are available. No Room Type photo will be copied.</p></fieldset>';
    }
    return `<fieldset class="hotel-legacy-photo-picker"><legend>Property photos requiring review</legend>
      <p>These remain property-level media. Select a photo only after confirming that it belongs to this exact accommodation. Nothing is selected automatically.</p>
      <div class="hotel-legacy-photo-picker__grid">${photos.map((url, index) => `<label><img src="${escapeAttr(url)}" alt="Property photo candidate ${index + 1}" loading="lazy" /><span><input type="checkbox" name="legacy_property_photo" value="${escapeAttr(url)}" /> Use for this Room Type</span><small>REQUIRES REVIEW</small></label>`).join('')}</div>
      <small>${preview.property_gallery_count} source photo${preview.property_gallery_count === 1 ? '' : 's'} · the property gallery is not moved or changed.</small>
    </fieldset>`;
  }

  function sevenArchesPhotoChecklist(room, index, propertyPhotos) {
    const selected = new Set(Core.normalizeGallery(room.gallery));
    const inputName = `seven_arches_room_${index}_photo`;
    return `<fieldset class="hotel-seven-arches-photos"><legend>Select room photos · required</legend>
      <p>Every source image remains in the Property gallery. Checking an image adds a safe reference to this exact Room Type.</p>
      <div class="hotel-legacy-photo-picker__grid">${propertyPhotos.map((url, photoIndex) => `<label>
        <img src="${escapeAttr(url)}" alt="7 Arches property photo ${photoIndex + 1}" loading="lazy" />
        <span><input type="checkbox" name="${inputName}" value="${escapeAttr(url)}" ${selected.has(url) ? 'checked' : ''} /> Use for ${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</span>
      </label>`).join('')}</div>
      <small>No photo is selected automatically. Shared photos may be selected for both apartments only when they genuinely apply to both.</small>
    </fieldset>`;
  }

  function retainedSevenArchesRoomReviews(roomReviews, workspace) {
    const allowedPhotos = new Set(Core.normalizeGallery(workspace?.property?.photos));
    let removedPhotoCount = 0;
    const reviews = Core.asArray(roomReviews).map((review) => {
      const gallery = Core.normalizeGallery(review?.gallery);
      const retainedGallery = gallery.filter((url) => allowedPhotos.has(url));
      removedPhotoCount += gallery.length - retainedGallery.length;
      return { ...Core.clone(review), gallery: retainedGallery };
    });
    return { reviews, removedPhotoCount };
  }

  function sevenArchesConflictValue(value) {
    if (value == null) return 'Not specified';
    if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function openSevenArchesConflictReview({ workspace, roomReviews, reconciliation }) {
    const conflicts = Core.asArray(reconciliation?.conflicts);
    const immutableConflict = conflicts.some((conflict) => (
      conflict?.identity_conflict === true
      || conflict?.field === 'legacy_pricing_fingerprint'
      || conflict?.field === 'room_type'
    ));
    const conflictRows = conflicts.map((conflict) => `<article class="hotel-seven-arches-conflict">
      <header><strong>${escapeHtml(conflict.scope || '7 Arches')}</strong><span>${escapeHtml(conflict.label || conflict.field || 'Reviewed field')}</span></header>
      <div><section><small>Originally reviewed</small><pre>${escapeHtml(sevenArchesConflictValue(conflict.original))}</pre></section><section><small>Current</small><pre>${escapeHtml(sevenArchesConflictValue(conflict.current))}</pre></section><section><small>Requested</small><pre>${escapeHtml(sevenArchesConflictValue(conflict.target))}</pre></section></div>
    </article>`).join('');
    const returnToPreparation = (notice) => {
      closeModal({ restoreFocus: false, skipCleanup: true, force: true });
      state.workspace = workspace;
      openSevenArchesPreparation({ draftReviews: roomReviews, notice });
    };

    openModal({
      title: 'Review changed 7 Arches values',
      className: 'hotel-workspace-modal--wide hotel-workspace-modal--review',
      body: `<section>
        <div class="hotel-review-summary"><p>This configuration changed after the apartment preparation was opened. No database change has been submitted.</p></div>
        <p class="hotel-workspace-safety-note">Compare the original, current and requested values. Keeping the current value leaves this shadow package unsaved. Using the reviewed value creates a new Review with the fresh exact versions; it never submits automatically.</p>
        <div class="hotel-seven-arches-conflict-list">${conflictRows}</div>
        ${immutableConflict ? '<p class="hotel-workspace-card hotel-property-empty--error">An identity, existence or legacy-pricing conflict cannot be replaced by this preparation. Keep the current value or cancel and investigate it separately.</p>' : ''}
      </section>`,
      footer: `<button class="btn-secondary" type="button" data-seven-arches-conflict-cancel>Cancel</button><button class="btn-secondary" type="button" data-seven-arches-keep-current>Keep current</button>${immutableConflict ? '' : '<button class="btn-primary" type="button" data-seven-arches-use-reviewed>Use reviewed value</button>'}`,
      onReady(overlay) {
        overlay.setAttribute('data-seven-arches-conflict-review', '');
        overlay.querySelector('[data-seven-arches-conflict-cancel]')?.addEventListener('click', () => {
          returnToPreparation('Conflict review cancelled. Your selected room photos were preserved; nothing was saved.');
        });
        overlay.querySelector('[data-seven-arches-keep-current]')?.addEventListener('click', () => {
          returnToPreparation('Current structural values were kept. Your selected room photos were preserved, but the canonical two-apartment shadow package remains unsaved.');
        });
        overlay.querySelector('[data-seven-arches-use-reviewed]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = 'Preparing fresh Review…';
          try {
            // Explicit resolution only: the current snapshot becomes the
            // reviewed original. Saving still uses exact versions and the
            // expected_original snapshot; this action never submits itself.
            const review = sevenArchesReviewConfiguration(workspace, roomReviews, {
              originalWorkspace: workspace,
              afterStaleConflict: true,
            });
            closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            await openReview(review);
          } catch (error) {
            button.disabled = false;
            button.textContent = 'Use reviewed value';
            toast(error?.userMessage || error?.message || 'The fresh conflict Review could not be prepared.', 'error');
          }
        });
      },
    });
  }

  function sevenArchesReviewConfiguration(workspace, roomReviews, options = {}) {
    const preparation = Core.sevenArchesShadowPreparation(workspace);
    const retained = retainedSevenArchesRoomReviews(roomReviews, workspace);
    if (retained.removedPhotoCount) {
      const error = new Error('The property gallery changed while this preparation was open.');
      error.userMessage = `${retained.removedPhotoCount} selected room photo reference${retained.removedPhotoCount === 1 ? ' is' : 's are'} no longer present in the property gallery. Remaining selections were preserved; review the current gallery and select replacements before continuing.`;
      error.closeReviewAfterStale = true;
      error.reopenSevenArchesPreparation = {
        draftReviews: retained.reviews,
        notice: error.userMessage,
      };
      throw error;
    }
    const reconciliation = Core.sevenArchesShadowReconciliation(options.originalWorkspace || workspace, workspace, {
      roomReviews: retained.reviews,
    });
    if (!reconciliation.eligible) {
      const error = new Error(reconciliation.blockers.join(' '));
      error.userMessage = preparation.eligible && reconciliation.conflicts?.length
        ? 'This preparation has a real concurrent value conflict. Compare the current and requested values before deciding; nothing was saved.'
        : `Fresh workspace values cannot be safely applied: ${reconciliation.blockers.join(' ')} The old review was closed because this property is no longer eligible for the two-apartment preparation.`;
      error.closeReviewAfterStale = true;
      if (preparation.eligible && reconciliation.conflicts?.length) {
        error.openSevenArchesConflictReview = {
          workspace,
          roomReviews: retained.reviews,
          reconciliation,
        };
      } else if (preparation.eligible) {
        error.reopenSevenArchesPreparation = {
          draftReviews: retained.reviews,
          notice: error.userMessage,
        };
      }
      throw error;
    }
    const reviewedBusinessValues = Core.clone(retained.reviews);
    const plan = Core.buildSevenArchesShadowPlan(workspace, reviewedBusinessValues);
    const normalizedWorkspace = Core.normalizeWorkspace(workspace);
    const before = {
      id: preparation.hotel_id,
      architecture_version: workspace.property.architecture_version,
      property_children_policy: workspace.property.children_policy,
      property_minimum_child_age: workspace.property.minimum_child_age,
      room_types: preparation.rooms.map((preparedRoom) => {
        const room = normalizedWorkspace.room_types.find((candidate) => candidate.id === preparedRoom.id);
        if (!room) return { id: preparedRoom.id, status: 'Not created' };
        return {
          id: room.id,
          version: room.version,
          code: room.code,
          name_i18n: room.name_i18n,
          gallery: room.gallery,
          status: room.status,
          max_occupancy: room.max_occupancy,
          capacity_adults: room.capacity_adults,
          capacity_children: room.capacity_children,
          inventory_mode: room.inventory_mode,
          base_inventory_count: room.base_inventory_count,
          amenities: room.amenities,
        };
      }),
      pricing: 'Legacy 63-rule matrix remains authoritative',
      ...(reconciliation.changes.length
        ? { business_values_changed_since_preparation: 'None in the original preparation snapshot' }
        : {}),
    };
    const after = {
      id: preparation.hotel_id,
      architecture_version: 'legacy (unchanged)',
      property_children_policy: preparation.property_policy.children_policy,
      property_minimum_child_age: preparation.property_policy.minimum_child_age,
      rooms: plan.rooms.map((room) => ({
        id: room.id,
        source_key: room.source_key,
        name_i18n: room.name_i18n,
        max_occupancy: room.max_occupancy,
        inventory: 'pooled · 1',
        amenities: room.amenities,
        selected_photo_count: room.gallery.length,
        status: preparation.rooms.find((candidate) => candidate.id === room.id)?.status || 'draft',
      })),
      pricing: 'Dormant shared Standard schedule preview; cancellation/payment blocked',
      public_change: false,
      ...(reconciliation.changes.length
        ? { business_values_changed_since_preparation: reconciliation.changes }
        : {}),
      ...(reconciliation.safe_rebases?.length
        ? { safe_three_way_rebases: reconciliation.safe_rebases }
        : {}),
    };
    const isConflictReview = options.afterStaleConflict === true;
    return {
      title: isConflictReview
        ? 'Review fresh 7 Arches two-apartment values'
        : 'Review 7 Arches two-apartment shadow package',
      entity: 'seven_arches_shadow_package',
      before,
      after,
      onConfirm: () => Repository.prepareLegacyShadowRooms(plan),
      onStaleReview: async () => {
        const freshWorkspace = await Repository.getWorkspace(plan.hotel_id);
        state.workspace = freshWorkspace;
        try {
          return sevenArchesReviewConfiguration(freshWorkspace, reviewedBusinessValues, {
            afterStaleConflict: true,
            originalWorkspace: workspace,
          });
        } catch (error) {
          error.closeReviewAfterStale = true;
          throw error;
        }
      },
      contextMessage: isConflictReview
        ? 'The stale save was stopped. Fresh workspace values are shown with your reviewed names and photo selections preserved. Nothing was retried automatically; review these values and click Save reviewed changes again to submit.'
        : 'Fresh workspace values were loaded immediately before this Review. One atomic exact-property RPC creates or updates only the deterministic shadow IDs. The separately reviewed property children policy, legacy pricing, property gallery, public state, architecture, bookings and feature flags remain unchanged.',
      reReviewMessage: 'This room was updated after this review was prepared. Current data has been refreshed and your selected photos were preserved. Please review the changes again before saving; nothing was retried automatically.',
      successMessage: 'Two reviewed 7 Arches apartments prepared in Rooms V2 shadow configuration.',
    };
  }

  function openSevenArchesPreparation(options = {}) {
    const preparationWorkspace = Core.clone(state.workspace);
    const preparation = Core.sevenArchesShadowPreparation(preparationWorkspace);
    if (!preparation.eligible) {
      toast(preparation.blocker || 'The two-apartment preparation is not available.', 'error');
      return;
    }
    const draftByRoom = new Map(Core.asArray(options.draftReviews).map((review) => [Core.normalizeUuid(review?.id), review]));
    const currentPropertyPhotos = new Set(preparation.property_gallery);
    const preparedRooms = preparation.rooms.map((room) => {
      const draft = draftByRoom.get(room.id);
      if (!draft) return room;
      return {
        ...room,
        name_i18n: Core.normalizeI18n(draft.name_i18n || room.name_i18n),
        gallery: Core.normalizeGallery(draft.gallery).filter((url) => currentPropertyPhotos.has(url)),
      };
    });
    const [upper, ground] = preparedRooms;
    const roomMarkup = (room, index, locationFacts) => `<section class="hotel-seven-arches-room" data-seven-arches-room="${escapeAttr(room.id)}">
      <header><div><span class="hotel-workspace-eyebrow">Room ${index + 1} · exact shadow Room Type</span><h4>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</h4></div><code>${escapeHtml(room.id)}</code></header>
      ${i18nFields(`seven_room_${index}_name`, 'Editable room name', room.name_i18n)}
      <div class="hotel-seven-arches-facts">
        <div><span>Floor</span><strong>${escapeHtml(locationFacts.floor)}</strong></div>
        <div><span>Terrace</span><strong>Yes</strong></div>
        <div><span>Balcony</span><strong>${locationFacts.balcony ? 'Yes' : 'No'}</strong></div>
        <div><span>Capacity</span><strong>Max 4 guests</strong><small>Adult/child split not confirmed</small></div>
        <div><span>Inventory</span><strong>1 pooled apartment</strong></div>
        <div><span>Beds · bathrooms · size</span><strong>Not confirmed</strong></div>
      </div>
      <div class="hotel-seven-arches-amenities"><span>Confirmed room amenities</span>${room.amenities.map((code) => `<b>${escapeHtml(code.replaceAll('_', ' '))}</b>`).join('')}</div>
      ${sevenArchesPhotoChecklist(room, index, preparation.property_gallery)}
    </section>`;
    openModal({
      title: 'Prepare 2 existing apartments',
      className: 'hotel-workspace-modal--wide hotel-workspace-modal--seven-arches',
      body: `<form id="hotelSevenArchesPreparationForm" class="hotel-workspace-form">
        ${options.notice ? `<section class="hotel-workspace-card hotel-property-empty--error"><strong>Fresh review required</strong><p>${escapeHtml(options.notice)}</p></section>` : ''}
        <section class="hotel-legacy-source-review">
          <span class="hotel-workspace-eyebrow">7 Arches · reviewed source contract</span>
          <h4>Two real accommodation units</h4>
          <div><span>Legacy pricing remains live</span><span>Property gallery: ${preparation.property_gallery.length} photos</span><span>Public: no change</span></div>
          <p>The two normalized Room Types and dormant shared Standard pricing structure remain Rooms V2 shadow configuration. The separately reviewed age policy is preserved. No architecture or feature flag is changed.</p>
        </section>
        <section class="hotel-workspace-card hotel-guest-policy-card"><span class="hotel-workspace-eyebrow">Children policy · separately reviewed</span><h4>${escapeHtml(childPolicyText(preparation.property_policy.children_policy, preparation.property_policy.minimum_child_age))}</h4><p>Preserved unchanged by this room/photo preparation. The current legacy booking form remains unchanged.</p></section>
        <div class="hotel-seven-arches-room-grid">
          ${roomMarkup(upper, 0, { floor: 'Upper floor', balcony: true })}
          ${roomMarkup(ground, 1, { floor: 'Ground floor', balcony: false })}
        </div>
        <section class="hotel-workspace-card hotel-legacy-pricing-blocker">
          <strong>Shared pricing preparation · inactive</strong>
          <p>One reusable Standard Rate Plan structure is prepared for both apartments. The server copies the 27 confirmed 2–4 guest tiers into their dormant shared room schedule and preserves the complete 63-rule matrix as a separate inactive property-party preview for future multi-room allocation. Cancellation and payment terms remain BLOCKED for Review.</p>
          <small>No public price, legacy pricing JSON, booking, deposit or coupon is changed.</small>
        </section>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelSevenArchesPreparationForm">Review 2 apartments</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelSevenArchesPreparationForm');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const submitButton = overlay.querySelector('button[form="hotelSevenArchesPreparationForm"]');
          const fd = new FormData(form);
          const reviews = preparedRooms.map((room, index) => ({
            id: room.id,
            name_i18n: readI18n(fd, `seven_room_${index}_name`),
            gallery: fd.getAll(`seven_arches_room_${index}_photo`),
          }));
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Loading fresh values…';
          }
          setModalSaving(overlay, true);
          try {
            const freshWorkspace = await Repository.getWorkspace(preparation.hotel_id);
            // Make recovery paths use the same fresh snapshot being reconciled.
            // Otherwise a removed photo or structural blocker would reopen the
            // preparation against the cached gallery that caused the conflict.
            state.workspace = freshWorkspace;
            const review = sevenArchesReviewConfiguration(freshWorkspace, reviews, { originalWorkspace: preparationWorkspace });
            closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            await openReview(review);
          } catch (error) {
            setModalSaving(overlay, false);
            if (error?.openSevenArchesConflictReview) {
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              openSevenArchesConflictReview(error.openSevenArchesConflictReview);
              toast(error.userMessage || error.message, 'warning');
              return;
            }
            if (error?.reopenSevenArchesPreparation) {
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              openSevenArchesPreparation(error.reopenSevenArchesPreparation);
              toast(error.userMessage || error.message, 'error');
              return;
            }
            if (error?.closeReviewAfterStale === true) {
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              renderWorkspace();
              toast(error.userMessage || error.message, 'error');
              return;
            }
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = 'Review 2 apartments';
            }
            toast(error?.userMessage || error?.message || 'Fresh workspace values could not be prepared for review.', 'error');
          }
        });
      },
    });
  }

  function openLegacyAccommodationPreparation(preview = null) {
    const freshPreview = Core.migrationPreview(state.workspace);
    if (!freshPreview.can_prepare_existing_accommodation || !freshPreview.legacy_product) {
      toast('The current legacy product is no longer eligible for one-room shadow preparation. Refresh and review the latest workspace.', 'error');
      return;
    }
    if (preview?.property_id && preview.property_id !== freshPreview.property_id) {
      toast('The reviewed legacy source no longer matches this property.', 'error');
      return;
    }
    openRoomEditor(null, { legacyPreparation: freshPreview });
  }

  function openRoomEditor(roomId = null, options = {}) {
    const existing = roomId ? state.workspace.room_types.find((room) => room.id === roomId) : null;
    const legacyPreparation = !existing ? Core.asObject(options.legacyPreparation) : {};
    const isLegacyPreparation = legacyPreparation.legacy_product?.kind === 'property_level_accommodation';
    const room = existing || (isLegacyPreparation
      ? Core.buildLegacyShadowRoomSeed(state.workspace, Core.newUuid())
      : Core.normalizeRoomType({
      id: Core.newUuid(), hotel_id: state.workspace.property.id, code: '', name_i18n: {}, description_i18n: {},
      gallery: [], capacity_adults: 2, capacity_children: 0, max_occupancy: null, bed_configuration: [], amenities: [],
      inventory_mode: 'pooled', base_inventory_count: 1, status: 'draft', sort_order: 1000, version: 1,
    }));
    const adultsValue = isLegacyPreparation ? '' : (room.capacity_adults ?? '');
    const childrenValue = isLegacyPreparation ? '' : (room.capacity_children ?? '');
    const totalValue = isLegacyPreparation ? '' : (room.max_occupancy ?? '');
    const capacityContract = room.max_occupancy != null ? 'total_only' : 'split';
    const inventoryValue = isLegacyPreparation ? '' : room.base_inventory_count;
    openModal({
      title: existing ? 'Edit Room Type' : isLegacyPreparation ? 'Prepare existing accommodation as Room Type' : 'Add Room Type',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelRoomEditorForm" class="hotel-workspace-form">
        ${isLegacyPreparation ? `<section class="hotel-legacy-source-review">
          <span class="hotel-workspace-eyebrow">Legacy source · read only</span>
          <h4>${escapeHtml(legacyPreparation.legacy_product.label)}</h4>
          <div><span>${legacyPreparation.legacy_pricing_rule_count} legacy pricing rules</span><span>Legacy booking maximum ${legacyPreparation.legacy_product.max_persons || 'not specified'}</span><span>${legacyPreparation.property_gallery_count} property photos</span></div>
          <p>The source is a property-level accommodation product, not a normalized Room Type. Enter and confirm every room-specific value below. Pricing is not copied in this operation.</p>
        </section>` : ''}
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal code</span><input name="code" value="${escapeAttr(room.code)}" required pattern="[a-z0-9][a-z0-9_-]*" /></label><label class="admin-form-field"><span>Exact Room Type ID</span><input value="${escapeAttr(room.id)}" readonly /></label></div>
        ${i18nFields('name', 'Room name', room.name_i18n)}
        ${i18nFields('description', 'Room description', room.description_i18n, 'textarea')}
        <fieldset><legend>Capacity & inventory</legend><div class="hotel-workspace-form-grid">
          <label class="admin-form-field"><span>Capacity detail</span><select name="capacity_contract"><option value="split" ${capacityContract === 'split' ? 'selected' : ''}>Adults and children confirmed</option><option value="total_only" ${capacityContract === 'total_only' ? 'selected' : ''}>Maximum total only · split not confirmed</option></select></label>
          <label class="admin-form-field" data-capacity-split><span>Adults</span><input name="capacity_adults" type="number" min="1" max="50" step="1" value="${adultsValue}" /></label>
          <label class="admin-form-field" data-capacity-split><span>Children</span><input name="capacity_children" type="number" min="0" max="50" step="1" value="${childrenValue}" /></label>
          <label class="admin-form-field" data-capacity-total><span>Maximum total guests</span><input name="max_occupancy" type="number" min="1" max="50" step="1" value="${totalValue}" /><small>Use only when the adult/child split is genuinely not confirmed.</small></label>
          <label class="admin-form-field"><span>Inventory model</span><select name="inventory_mode" required>${isLegacyPreparation ? '<option value="" selected disabled>Select after confirmation</option>' : ''}<option value="pooled" ${!isLegacyPreparation && room.inventory_mode === 'pooled' ? 'selected' : ''}>Pooled inventory</option><option value="unitized" ${!isLegacyPreparation && room.inventory_mode === 'unitized' ? 'selected' : ''}>Individual units</option></select></label>
          <label class="admin-form-field"><span>Base inventory count</span><input name="base_inventory_count" type="number" min="${isLegacyPreparation ? '1' : '0'}" step="1" value="${inventoryValue}" ${isLegacyPreparation ? 'required' : ''} /></label>
          <label class="admin-form-field"><span>Bathrooms</span><input name="bathrooms" type="number" min="0" step="0.5" value="${escapeAttr(room.bathrooms ?? '')}" /></label>
          <label class="admin-form-field"><span>Size m²</span><input name="size_sqm" type="number" min="0.01" step="0.01" value="${escapeAttr(room.size_sqm ?? '')}" /></label>
          ${isLegacyPreparation
            ? '<label class="admin-form-field"><span>Status</span><input name="status" value="draft" readonly /><small>Shadow preparation is always inert.</small></label>'
            : `<label class="admin-form-field"><span>Status</span><select name="status">${Core.ROOM_STATUSES.map((status) => `<option value="${status}" ${status === room.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>`}
          <label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" step="1" value="${room.sort_order}" /></label>
        </div><p class="hotel-inventory-mode-note" data-inventory-note></p></fieldset>
        <fieldset><legend>Bed configuration</legend><div data-bed-rows>${room.bed_configuration.map(bedRowMarkup).join('')}</div><button class="btn-secondary" type="button" data-add-bed>+ Add bed</button></fieldset>
        <fieldset><legend>Room amenities</legend>${isLegacyPreparation ? '<p>Property amenities are not copied. Select only amenities confirmed for this exact accommodation.</p>' : ''}${amenitiesMarkup(room.amenities)}</fieldset>
        ${galleryEditorMarkup(room)}
        ${isLegacyPreparation ? legacyPropertyPhotoSelectionMarkup(legacyPreparation) : ''}
        ${isLegacyPreparation ? '<p class="hotel-workspace-safety-note">This operation creates one draft Room Type only. It does not create a Rate Plan, Room Rate, Calendar row, booking, or pricing conversion.</p>' : ''}
      </form>`,
      footer: `<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRoomEditorForm">Review ${existing ? 'changes' : isLegacyPreparation ? 'shadow Room Type' : 'new Room Type'}</button>`,
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
          if (!inventoryMode.value) {
            inventoryCount.disabled = false;
            inventoryNote.textContent = 'Select and confirm the inventory model. No legacy inventory value is assumed.';
            return;
          }
          const unitized = inventoryMode.value === 'unitized';
          inventoryCount.disabled = unitized;
          inventoryNote.textContent = unitized
            ? 'Inventory is derived from active physical units. This switch never creates or deletes units.'
            : 'Pooled inventory uses the configured base count; physical units are optional and not required.';
        };
        inventoryMode.addEventListener('change', syncInventory);
        syncInventory();
        const capacityContractInput = form.elements.capacity_contract;
        const syncCapacityContract = () => {
          const totalOnly = capacityContractInput.value === 'total_only';
          form.querySelectorAll('[data-capacity-split]').forEach((label) => { label.hidden = totalOnly; });
          form.querySelector('[data-capacity-total]').hidden = !totalOnly;
          form.elements.capacity_adults.disabled = totalOnly;
          form.elements.capacity_children.disabled = totalOnly;
          form.elements.max_occupancy.disabled = !totalOnly;
          form.elements.capacity_adults.required = !totalOnly;
          form.elements.capacity_children.required = !totalOnly;
          form.elements.max_occupancy.required = totalOnly;
        };
        capacityContractInput.addEventListener('change', syncCapacityContract);
        syncCapacityContract();
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
            capacity_adults: fd.get('capacity_contract') === 'total_only' ? null : Number(fd.get('capacity_adults')),
            capacity_children: fd.get('capacity_contract') === 'total_only' ? null : Number(fd.get('capacity_children')),
            max_occupancy: fd.get('capacity_contract') === 'total_only' ? Number(fd.get('max_occupancy')) : null,
            inventory_mode: String(fd.get('inventory_mode')),
            base_inventory_count: fd.get('inventory_mode') === 'unitized' ? 0 : Number(fd.get('base_inventory_count')),
            bathrooms: fd.get('bathrooms') === '' ? null : Number(fd.get('bathrooms')),
            size_sqm: fd.get('size_sqm') === '' ? null : Number(fd.get('size_sqm')),
            status: isLegacyPreparation ? 'draft' : String(fd.get('status')),
            sort_order: Number(fd.get('sort_order')),
            bed_configuration: bedConfiguration,
            amenities: fd.getAll('room_amenity'),
            gallery: Core.normalizeGallery([
              ...room.gallery.filter((url) => !fd.getAll('remove_gallery_url').includes(url)),
              ...(isLegacyPreparation ? fd.getAll('legacy_property_photo') : []),
            ]),
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
            title: existing ? 'Review Room Type changes' : isLegacyPreparation ? 'Review legacy → shadow Room Type' : 'Review new Room Type',
            entity: 'room_type',
            before: existing,
            after: validated,
            operation: Core.operationForEntity('room_type', validated, existing),
            onCancel: files.length ? cleanupUploaded : null,
            onApplyError: files.length ? cleanupRejectedUpload : null,
            closeOnApplyError: files.length > 0,
            contextMessage: isLegacyPreparation
              ? 'The exact legacy property remains live and unchanged. This reviewed operation creates one draft Room Type only; pricing migration stays separate.'
              : '',
            successMessage: existing ? 'Room Type updated.' : isLegacyPreparation ? 'Existing accommodation prepared as one inert draft Room Type.' : 'Room Type created as an inert configuration.',
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
      <label class="admin-form-field"><span>Policy</span><select name="cancellation_type">${normalized.type === 'requires_review' ? '<option value="requires_review" selected disabled>Requires confirmation</option>' : ''}<option value="flexible" ${normalized.type === 'flexible' ? 'selected' : ''}>Flexible</option><option value="non_refundable" ${normalized.type === 'non_refundable' ? 'selected' : ''}>Non-refundable</option><option value="custom" ${normalized.type === 'custom' ? 'selected' : ''}>Custom</option></select></label>
      <label class="admin-form-field" data-custom-cancellation><span>Deadline before arrival (hours)</span><input name="deadline_hours" type="number" min="0" step="1" value="${normalized.deadline_hours ?? 48}" /></label>
      <label class="admin-form-field" data-custom-cancellation><span>Penalty</span><select name="penalty_mode"><option value="none" ${normalized.penalty_mode === 'none' ? 'selected' : ''}>No configured penalty</option><option value="flat" ${normalized.penalty_mode === 'flat' ? 'selected' : ''}>Fixed amount</option><option value="percent" ${normalized.penalty_mode === 'percent' ? 'selected' : ''}>Percent of total</option></select></label>
      <label class="admin-form-field" data-custom-cancellation data-penalty-value><span>Penalty value</span><input name="penalty_value" type="number" min="0" step="0.01" value="${escapeAttr(normalized.penalty_value ?? '')}" /></label>
    </div>${normalized.type === 'requires_review' ? '<p class="hotel-workspace-safety-note">Cancellation terms are unresolved. This Rate Plan must remain inactive until an Admin selects and reviews a confirmed policy.</p>' : ''}<small>This stores a safe policy description only. H2A does not change booking or refund calculations.</small></fieldset>`;
  }

  function readCancellationPolicy(form, currentPolicy = null) {
    const type = String(form.elements.cancellation_type.value || 'flexible');
    if (type === 'requires_review') return Core.normalizeCancellationPolicy(currentPolicy);
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
              cancellation_policy: readCancellationPolicy(form, plan.cancellation_policy),
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
    if (existing?.pricing_schedule_id) {
      const schedule = state.workspace.pricing_schedules.find((candidate) => candidate.id === existing.pricing_schedule_id);
      const tierCount = state.workspace.pricing_schedule_tiers.filter((tier) => tier.schedule_id === existing.pricing_schedule_id && tier.is_active !== false).length;
      openModal({
        title: 'Shared Room Rate schedule',
        body: `<section class="hotel-workspace-card hotel-legacy-pricing-blocker">
          <span class="hotel-workspace-eyebrow">Dormant Rooms V2 shadow pricing</span>
          <h4>${escapeHtml(Core.i18nText(schedule?.name_i18n, 'en', 'Shared apartment pricing'))}</h4>
          <p>This exact product uses a reusable ${tierCount}-tier occupancy × length-of-stay schedule. Its base rate is not an executable €0 price.</p>
          <p>Generic Room Rate editing is locked until H3 adds allocation-aware detach/clone and authoritative public resolution.</p>
          <div class="hotel-workspace-locked-fields"><div><span>Exact product ID</span><code>${escapeHtml(existing.id)}</code></div><div><span>Schedule ID</span><code>${escapeHtml(existing.pricing_schedule_id)}</code></div></div>
        </section>`,
      });
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

  function calendarProducts(calendar = state.calendar.data) {
    const data = Core.asObject(calendar);
    const roomById = new Map(state.workspace.room_types.map((room) => [room.id, room]));
    const planById = new Map(state.workspace.rate_plans.map((plan) => [plan.id, plan]));
    return Core.asArray(data.room_rates).map((raw) => {
      const rate = Core.asObject(raw);
      const room = roomById.get(rate.room_type_id) || Core.asObject(rate.room_type);
      const plan = planById.get(rate.rate_plan_id) || Core.asObject(rate.rate_plan);
      const schedule = rate.pricing_schedule_id
        ? state.workspace.pricing_schedules.find((candidate) => candidate.id === rate.pricing_schedule_id)
        : null;
      const scheduleTierCount = schedule
        ? state.workspace.pricing_schedule_tiers.filter((tier) => tier.schedule_id === schedule.id && tier.is_active !== false).length
        : 0;
      return {
        ...rate,
        id: Core.normalizeUuid(rate.id),
        room_type_id: Core.normalizeUuid(rate.room_type_id || room.id),
        room_name: Core.i18nText(rate.room_name_i18n || room.name_i18n, 'en', room.code || 'Room Type'),
        room_code: String(room.code || rate.room_code || '').trim(),
        room_version: Number(room.version || rate.room_version || 0) || null,
        base_inventory_count: Number(room.base_inventory_count ?? rate.base_inventory_count ?? 0),
        rate_plan_name: Core.i18nText(rate.rate_plan_name_i18n || plan.name_i18n, 'en', plan.code || 'Rate Plan'),
        rate_plan_code: String(plan.code || rate.rate_plan_code || '').trim(),
        currency: String(rate.currency || state.workspace.property.currency || 'EUR'),
        pricing_label: schedule
          ? `Shared ${scheduleTierCount}-tier shadow schedule`
          : `${formatMoney(rate.base_nightly_rate, rate.currency || state.workspace.property.currency || 'EUR')} base`,
      };
    }).filter((rate) => rate.id && rate.room_type_id);
  }

  function calendarRecordMaps(calendar = state.calendar.data) {
    const data = Core.asObject(calendar);
    const dailyRates = new Map();
    const inventory = new Map();
    const overrides = new Map();
    const effective = new Map();
    Core.asArray(data.daily_rates).forEach((row) => dailyRates.set(`${row.room_rate_id}:${row.stay_date}`, row));
    Core.asArray(data.daily_inventory).forEach((row) => inventory.set(`${row.room_type_id}:${row.stay_date}`, row));
    Core.asArray(data.calendar_overrides).forEach((row) => overrides.set(`${row.room_rate_id}:${row.stay_date}`, row));
    Core.asArray(data.effective_cells).forEach((row) => {
      const productId = row.room_rate_id || row.product_id;
      const date = row.stay_date || row.date;
      if (productId && date) effective.set(`${productId}:${date}`, row);
    });
    return { dailyRates, inventory, overrides, effective };
  }

  function calendarCell(product, date, maps) {
    const rateRow = maps.dailyRates.get(`${product.id}:${date}`) || null;
    const inventoryRow = maps.inventory.get(`${product.room_type_id}:${date}`) || null;
    const overrideRow = maps.overrides.get(`${product.id}:${date}`) || null;
    const serverCell = maps.effective.get(`${product.id}:${date}`) || null;
    const sharedSchedule = Core.sharedScheduleCalendarDisplayState(product, date, overrideRow, inventoryRow);
    if (sharedSchedule) {
      return {
        rate: null,
        inventory: sharedSchedule.configured_inventory,
        closed: sharedSchedule.explicitly_closed,
        minimumStay: sharedSchedule.minimum_stay.mode === 'set' ? sharedSchedule.minimum_stay.value : null,
        maximumStay: sharedSchedule.maximum_stay.mode === 'set' ? sharedSchedule.maximum_stay.value : null,
        cta: sharedSchedule.closed_to_arrival.mode === 'set' && sharedSchedule.closed_to_arrival.value === true,
        ctd: sharedSchedule.closed_to_departure.mode === 'set' && sharedSchedule.closed_to_departure.value === true,
        source: 'Shadow only · H3 occupancy/allocation pending',
        requestable: false,
        blockingReasons: [sharedSchedule.blocker],
        rateRow,
        inventoryRow,
        overrideRow,
        serverCell,
        unresolved: true,
        sharedSchedule,
      };
    }
    if (!serverCell) {
      return {
        rate: null,
        inventory: null,
        closed: true,
        minimumStay: null,
        maximumStay: null,
        cta: false,
        ctd: false,
        source: 'Unresolved — reload required',
        requestable: null,
        blockingReasons: [],
        rateRow,
        inventoryRow,
        overrideRow,
        serverCell: null,
        unresolved: true,
      };
    }
    const resolved = Core.asObject(serverCell?.resolved);
    const resolvedNight = Core.asObject(Core.asArray(resolved.nightly_breakdown)[0]);
    const rate = resolvedNight.nightly_rate ?? serverCell.nightly_rate ?? serverCell.effective_nightly_rate ?? null;
    const inventory = resolvedNight.sellable_units ?? serverCell.sellable_units ?? serverCell.effective_sellable_units ?? null;
    const closed = Boolean(resolvedNight.closed ?? serverCell.closed ?? serverCell.effective_closed ?? true);
    const minimumStay = resolvedNight.minimum_stay ?? serverCell.minimum_stay ?? null;
    const maximumStay = resolvedNight.maximum_stay ?? serverCell.maximum_stay ?? null;
    const cta = Boolean(resolvedNight.closed_to_arrival ?? serverCell.closed_to_arrival ?? false);
    const ctd = Boolean(resolvedNight.closed_to_departure ?? serverCell.closed_to_departure ?? false);
    const provenance = Core.asObject(resolvedNight.provenance || serverCell.provenance);
    const blockingReasons = Core.asArray(serverCell.blocking_reasons || resolved.blocking_reasons);
    const requestableValue = serverCell.requestable ?? resolved.requestable ?? resolved.bookable;
    const requestable = typeof requestableValue === 'boolean'
      ? requestableValue
      : (blockingReasons.length ? false : null);
    const source = String(resolvedNight.source || serverCell.source_label || serverCell.source || provenance.source
      || blockingReasons[0]?.code || blockingReasons[0] || 'Resolved');
    return {
      rate,
      inventory,
      closed,
      minimumStay,
      maximumStay,
      cta,
      ctd,
      source,
      requestable,
      blockingReasons,
      rateRow,
      inventoryRow,
      overrideRow,
      serverCell,
      unresolved: rate == null || inventory == null,
    };
  }

  function calendarBlockingReasonLabel(reason) {
    const source = typeof reason === 'string' ? { code: reason } : Core.asObject(reason);
    const code = String(source.code || source.reason || 'not_requestable').trim();
    const labels = {
      closed_to_departure: source.stay_date
        ? `Checkout ${source.stay_date}: closed to departure`
        : 'Closed to departure on checkout date',
      closed_to_arrival: 'Closed to arrival',
      insufficient_or_closed_inventory: 'Inventory unavailable or closed',
      missing_occupancy_los_tier: 'No matching occupancy / stay tier',
      ambiguous_range_rules: 'Ambiguous seasonal rules',
      ambiguous_weekday_rules: 'Ambiguous weekday rules',
      invalid_resolved_stay_restriction: 'Invalid stay restriction',
      shared_room_pricing_schedule_requires_h3_resolution: 'H3 occupancy/allocation resolution required',
    };
    return labels[code] || code.replaceAll('_', ' ');
  }

  function isCalendarDateSelected(date) {
    return Boolean(state.calendar.selection_start && state.calendar.selection_end
      && date >= state.calendar.selection_start && date <= state.calendar.selection_end);
  }

  function calendarCellMarkup(product, date, maps) {
    const cell = calendarCell(product, date, maps);
    const restrictions = [
      cell.minimumStay ? `Min ${cell.minimumStay}` : '',
      cell.maximumStay ? `Max ${cell.maximumStay}` : '',
      cell.cta ? 'CTA' : '',
      cell.ctd ? 'CTD' : '',
    ].filter(Boolean);
    const selected = isCalendarDateSelected(date) && state.calendar.selected_product_ids.includes(product.id);
    if (cell.sharedSchedule) {
      const shadow = cell.sharedSchedule;
      const nightlyRate = shadow.nightly_rate.mode === 'set'
        ? `Exact date draft rate: ${formatMoney(shadow.nightly_rate.value, product.currency)}`
        : shadow.nightly_rate.mode === 'clear'
          ? 'Exact date rate cleared · shared schedule inherited'
          : 'No exact date price override';
      const inventory = shadow.inventory_source === 'exact_room_date'
        ? `Exact room inventory: ${shadow.configured_inventory} room${Number(shadow.configured_inventory) === 1 ? '' : 's'}`
        : `${shadow.sellable_units.mode === 'clear' ? 'Daily inventory cleared · ' : ''}Base room inventory: ${shadow.configured_inventory}`;
      const shadowRestrictions = [
        shadow.explicitly_closed ? 'Closed' : '',
        ...restrictions,
      ].filter(Boolean);
      return `<button type="button" class="hotel-calendar-cell is-shadow-schedule${selected ? ' is-selected' : ''}${shadow.explicitly_closed ? ' is-closed' : ''} is-not-requestable" data-calendar-cell data-product-id="${escapeAttr(product.id)}" data-date="${escapeAttr(date)}" aria-pressed="${selected}" title="${escapeAttr(`${product.room_name} · ${product.rate_plan_name} · ${date}`)}">
        <strong>Shared schedule · H3 pending</strong>
        <span>${escapeHtml(nightlyRate)}</span>
        <span>${escapeHtml(inventory)}</span>
        <small>${shadowRestrictions.length ? escapeHtml(shadowRestrictions.join(' · ')) : 'No exact restrictions'}</small>
        <em class="hotel-calendar-cell__blocker">Shadow only · not requestable until occupancy/allocation is resolved</em>
        <i>Exact room configuration</i>
      </button>`;
    }
    const blockerLabels = cell.blockingReasons.map(calendarBlockingReasonLabel);
    const requestability = !cell.unresolved && cell.requestable === false
      ? `<em class="hotel-calendar-cell__blocker">Not requestable${blockerLabels.length ? ` · ${escapeHtml(blockerLabels.join(' · '))}` : ''}</em>`
      : '';
    return `<button type="button" class="hotel-calendar-cell${selected ? ' is-selected' : ''}${cell.closed ? ' is-closed' : ''}${cell.requestable === false ? ' is-not-requestable' : ''}" data-calendar-cell data-product-id="${escapeAttr(product.id)}" data-date="${escapeAttr(date)}" aria-pressed="${selected}" title="${escapeAttr(`${product.room_name} · ${product.rate_plan_name} · ${date}`)}">
      <strong>${cell.unresolved ? 'Not resolved' : cell.closed ? 'Closed' : escapeHtml(formatMoney(cell.rate, product.currency))}</strong>
      <span>${cell.inventory == null ? 'Inventory unavailable' : `${cell.inventory} room${Number(cell.inventory) === 1 ? '' : 's'}`}</span>
      ${restrictions.length ? `<small>${escapeHtml(restrictions.join(' · '))}</small>` : '<small>No restrictions</small>'}
      ${requestability}
      <i>${escapeHtml(cell.source)}</i>
    </button>`;
  }

  function calendarMonthTitle(range) {
    const start = parseIsoDate(range.start);
    const end = parseIsoDate(range.end);
    if (!start || !end) return `${range.start} – ${range.end}`;
    if (state.calendar.view === 'week') {
      return `${calendarDateLabel(range.start, { long: true })} – ${calendarDateLabel(range.end, { long: true })}`;
    }
    if (state.calendar.view === 'two_months') {
      const format = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return `${format.format(start)} – ${format.format(end)}`;
    }
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
  }

  function renderCalendarDesktop(products, dates, maps) {
    return `<div class="hotel-calendar-grid-shell" tabindex="0" aria-label="Monthly room rate and inventory calendar">
      <table class="hotel-calendar-grid">
        <thead><tr><th class="hotel-calendar-grid__product"><span>Room × Rate Plan</span><small>Choose products to edit</small></th>${dates.map((date) => `<th class="${date === todayIsoDate() ? 'is-today' : ''}"><span>${escapeHtml(calendarDateLabel(date))}</span><small>${escapeHtml(date.slice(5))}</small></th>`).join('')}</tr></thead>
        <tbody>${products.map((product) => `<tr data-calendar-product-row="${escapeAttr(product.id)}"><th class="hotel-calendar-grid__product"><label><input type="checkbox" data-calendar-product-check value="${escapeAttr(product.id)}" ${state.calendar.selected_product_ids.includes(product.id) ? 'checked' : ''} /><span><strong>${escapeHtml(product.room_name)}</strong><small>${escapeHtml(product.rate_plan_name)} · ${escapeHtml(product.pricing_label)}</small></span></label></th>${dates.map((date) => `<td>${calendarCellMarkup(product, date, maps)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  function renderCalendarMobile(products, dates, maps) {
    const selectedProduct = products.find((product) => product.id === state.calendar.mobile_product_id) || products[0];
    if (!selectedProduct) return '';
    return `<div class="hotel-calendar-mobile">
      <label class="admin-form-field"><span>Room and Rate Plan</span><select data-calendar-mobile-product>${products.map((product) => `<option value="${escapeAttr(product.id)}" ${product.id === selectedProduct.id ? 'selected' : ''}>${escapeHtml(product.room_name)} · ${escapeHtml(product.rate_plan_name)}</option>`).join('')}</select></label>
      <label class="hotel-calendar-mobile__select"><input type="checkbox" data-calendar-product-check value="${escapeAttr(selectedProduct.id)}" ${state.calendar.selected_product_ids.includes(selectedProduct.id) ? 'checked' : ''} /> Include this product in the next edit</label>
      <div class="hotel-calendar-mobile__days">${dates.map((date) => `<article class="${date === todayIsoDate() ? 'is-today' : ''}"><header><strong>${escapeHtml(calendarDateLabel(date, { long: true }))}</strong><small>${escapeHtml(date)}</small></header>${calendarCellMarkup(selectedProduct, date, maps)}</article>`).join('')}</div>
    </div>`;
  }

  function renderCalendarRuleLists(products) {
    const selected = new Set(state.calendar.selected_product_ids);
    const rules = Core.asArray(state.calendar.data?.rate_rules).filter((rule) => !selected.size || selected.has(rule.room_rate_id));
    const tiers = Core.asArray(state.calendar.data?.occupancy_tiers).filter((tier) => !selected.size || selected.has(tier.room_rate_id));
    const productById = new Map(products.map((product) => [product.id, product]));
    return `<aside class="hotel-calendar-rules">
      <section class="hotel-workspace-card">
        <div class="hotel-calendar-rules__heading"><div><span class="hotel-workspace-eyebrow">Seasonal & weekday rules</span><h4>${rules.length} rule${rules.length === 1 ? '' : 's'}</h4></div><button class="btn-secondary" type="button" data-add-calendar-rule ${selected.size ? '' : 'disabled'}>+ Rule</button></div>
        ${rules.length ? `<ul>${rules.slice(0, 20).map((rule) => { const product = productById.get(rule.room_rate_id); return `<li><button type="button" data-edit-calendar-rule="${escapeAttr(rule.id)}"><strong>${escapeHtml(product?.room_name || 'Rate product')} · ${escapeHtml(formatMoney(rule.nightly_rate, product?.currency))}</strong><small>${escapeHtml(rule.valid_from)} → ${escapeHtml(rule.valid_to)} · priority ${Number(rule.priority || 0)}${rule.is_active === false ? ' · inactive' : ''}</small></button></li>`; }).join('')}</ul>` : '<p>Select a product, then create a reviewed seasonal or weekday rule.</p>'}
      </section>
      <section class="hotel-workspace-card">
        <div class="hotel-calendar-rules__heading"><div><span class="hotel-workspace-eyebrow">Occupancy / LOS tiers</span><h4>${tiers.length} tier${tiers.length === 1 ? '' : 's'}</h4></div><button class="btn-secondary" type="button" data-add-occupancy-tier ${selected.size ? '' : 'disabled'}>+ Tier</button></div>
        ${tiers.length ? `<ul>${tiers.slice(0, 30).map((tier) => { const product = productById.get(tier.room_rate_id); return `<li><button type="button" data-edit-occupancy-tier="${escapeAttr(tier.id)}"><strong>${Number(tier.guest_count)} guests · ${Number(tier.threshold_nights)}+ nights</strong><small>${escapeHtml(product?.room_name || 'Rate product')} · ${escapeHtml(formatMoney(tier.nightly_rate, product?.currency))}${tier.is_active === false ? ' · inactive' : ''}</small></button></li>`; }).join('')}</ul>` : '<p>Optional tiers let one product reproduce reviewed guest-count and length-of-stay pricing without duplicating rooms.</p>'}
        <button class="btn-secondary" type="button" data-preview-authoritative-rate ${selected.size === 1 ? '' : 'disabled'}>Preview authoritative stay</button>
      </section>
    </aside>`;
  }

  function renderCalendarLoaded(panel, range, data) {
    const products = calendarProducts(data);
    const dates = enumerateCalendarDates(range.start, range.end);
    const maps = calendarRecordMaps(data);
    const selectedCount = state.calendar.selected_product_ids.length;
    const selectionLabel = state.calendar.selection_start
      ? `${state.calendar.selection_start}${state.calendar.selection_end !== state.calendar.selection_start ? ` → ${state.calendar.selection_end}` : ''}`
      : 'Select one date or a range';
    if (!products.length) {
      panel.innerHTML = `${workspacePanelHeader('Calendar & Rates', 'Manual prices, inventory and restrictions for normalized Room × Rate Plan products.')}
        <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Rooms V2 shadow</span><h4>No Room Rate products to calendar yet</h4><p>The current legacy property and its public prices remain unchanged. Prepare a normalized Room Type, Rate Plan and Room Rate product first.</p><button class="btn-primary" type="button" data-calendar-open-rooms>Open Rooms & Rates</button></section>`;
      panel.querySelector('[data-calendar-open-rooms]')?.addEventListener('click', () => { state.activeTab = 'rooms'; renderWorkspace(); });
      return;
    }
    if (!state.calendar.mobile_product_id || !products.some((product) => product.id === state.calendar.mobile_product_id)) {
      state.calendar.mobile_product_id = products[0].id;
    }
    panel.innerHTML = `${workspacePanelHeader('Calendar & Rates', 'Select exact products and dates, then Review one transactional manual update.')}
      <section class="hotel-calendar-toolbar hotel-workspace-card">
        <div class="hotel-calendar-toolbar__navigation"><button class="btn-secondary" type="button" data-calendar-shift="-1" aria-label="Previous ${state.calendar.view}">←</button><button class="btn-secondary" type="button" data-calendar-today>Today</button><button class="btn-secondary" type="button" data-calendar-shift="1" aria-label="Next ${state.calendar.view}">→</button><strong>${escapeHtml(calendarMonthTitle(range))}</strong></div>
        <div class="hotel-calendar-toolbar__actions"><label><span>View</span><select data-calendar-view><option value="month" ${state.calendar.view === 'month' ? 'selected' : ''}>Month</option><option value="two_months" ${state.calendar.view === 'two_months' ? 'selected' : ''}>2 months</option><option value="week" ${state.calendar.view === 'week' ? 'selected' : ''}>Week</option></select></label><button class="btn-secondary" type="button" data-calendar-select-all>${selectedCount === products.length ? 'Clear products' : 'Select all products'}</button><button class="btn-primary" type="button" data-calendar-edit-range ${selectedCount && state.calendar.selection_start ? '' : 'disabled'}>Edit selected range</button></div>
        <div class="hotel-calendar-selection" aria-live="polite"><strong>${selectedCount} product${selectedCount === 1 ? '' : 's'} selected</strong><span>${escapeHtml(selectionLabel)}</span><button type="button" data-calendar-clear-selection ${state.calendar.selection_start ? '' : 'disabled'}>Clear dates</button></div>
      </section>
      <div class="hotel-calendar-layout"><section class="hotel-calendar-board">${renderCalendarDesktop(products, dates, maps)}${renderCalendarMobile(products, dates, maps)}</section>${renderCalendarRuleLists(products)}</div>
      <section class="hotel-calendar-legend"><span><i class="is-base"></i> Base</span><span><i class="is-manual"></i> Manual / resolved override</span><span><i class="is-closed"></i> Closed</span><small>Displayed cells use server-resolved effective values and provenance whenever supplied. Raw rows remain in the reviewed concurrency snapshot.</small></section>`;
    bindCalendarPanel(panel, products, range);
  }

  async function loadCalendarRange() {
    if (!state.workspace || state.calendar.loading) return;
    const propertyId = state.workspace.property.id;
    const range = activeCalendarRange();
    state.calendar.loading = true;
    state.calendar.error = null;
    renderActivePanel();
    try {
      const data = await Repository.getCalendar(propertyId, range.start, range.end);
      if (!state.workspace || state.workspace.property.id !== propertyId) return;
      state.calendar.data = data;
      state.calendar.selected_product_ids = state.calendar.selected_product_ids.filter((id) => data.room_rates.some((rate) => rate.id === id));
    } catch (error) {
      state.calendar.error = error;
    } finally {
      state.calendar.loading = false;
      if (state.workspace?.property.id === propertyId && state.activeTab === 'calendar') renderActivePanel();
    }
  }

  function shiftCalendar(periods) {
    const anchor = parseIsoDate(state.calendar.anchor_date || todayIsoDate());
    if (!anchor) return;
    if (state.calendar.view === 'week') anchor.setUTCDate(anchor.getUTCDate() + Number(periods) * 7);
    else anchor.setUTCMonth(anchor.getUTCMonth() + Number(periods) * (state.calendar.view === 'two_months' ? 2 : 1), 1);
    state.calendar.anchor_date = isoDateFromUtc(anchor);
    state.calendar.data = null;
    state.calendar.error = null;
    state.calendar.selection_start = null;
    state.calendar.selection_end = null;
    state.calendar.selection_anchor = null;
    renderActivePanel();
  }

  function chooseCalendarDate(productId, date, extend = false) {
    if (!state.calendar.selected_product_ids.includes(productId)) state.calendar.selected_product_ids.push(productId);
    const existingAnchor = state.calendar.selection_anchor || (extend ? state.calendar.selection_start : null);
    if (existingAnchor) {
      state.calendar.selection_start = existingAnchor < date ? existingAnchor : date;
      state.calendar.selection_end = existingAnchor > date ? existingAnchor : date;
      state.calendar.selection_anchor = null;
    } else {
      state.calendar.selection_start = date;
      state.calendar.selection_end = date;
      state.calendar.selection_anchor = date;
    }
    renderActivePanel();
  }

  function bindCalendarPanel(panel, products, range) {
    panel.querySelectorAll('[data-calendar-cell]').forEach((button) => button.addEventListener('click', (event) => {
      chooseCalendarDate(button.dataset.productId, button.dataset.date, event.shiftKey);
    }));
    panel.querySelectorAll('[data-calendar-product-check]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const id = checkbox.value;
      state.calendar.selected_product_ids = checkbox.checked
        ? Array.from(new Set([...state.calendar.selected_product_ids, id]))
        : state.calendar.selected_product_ids.filter((value) => value !== id);
      renderActivePanel();
    }));
    panel.querySelector('[data-calendar-mobile-product]')?.addEventListener('change', (event) => {
      state.calendar.mobile_product_id = event.currentTarget.value;
      renderActivePanel();
    });
    panel.querySelectorAll('[data-calendar-shift]').forEach((button) => button.addEventListener('click', () => shiftCalendar(Number(button.dataset.calendarShift))));
    panel.querySelector('[data-calendar-today]')?.addEventListener('click', () => {
      state.calendar.anchor_date = todayIsoDate(); state.calendar.data = null; state.calendar.error = null; renderActivePanel();
    });
    panel.querySelector('[data-calendar-view]')?.addEventListener('change', (event) => {
      state.calendar.view = ['week', 'two_months'].includes(event.currentTarget.value) ? event.currentTarget.value : 'month';
      state.calendar.data = null; state.calendar.error = null; renderActivePanel();
    });
    panel.querySelector('[data-calendar-select-all]')?.addEventListener('click', () => {
      state.calendar.selected_product_ids = state.calendar.selected_product_ids.length === products.length ? [] : products.map((product) => product.id);
      renderActivePanel();
    });
    panel.querySelector('[data-calendar-clear-selection]')?.addEventListener('click', () => {
      state.calendar.selection_start = null; state.calendar.selection_end = null; state.calendar.selection_anchor = null; renderActivePanel();
    });
    panel.querySelector('[data-calendar-edit-range]')?.addEventListener('click', openCalendarRangeEditor);
    panel.querySelector('[data-add-calendar-rule]')?.addEventListener('click', () => openCalendarRuleEditor());
    panel.querySelectorAll('[data-edit-calendar-rule]').forEach((button) => button.addEventListener('click', () => openCalendarRuleEditor(button.dataset.editCalendarRule)));
    panel.querySelector('[data-add-occupancy-tier]')?.addEventListener('click', () => openOccupancyTierEditor());
    panel.querySelectorAll('[data-edit-occupancy-tier]').forEach((button) => button.addEventListener('click', () => openOccupancyTierEditor(button.dataset.editOccupancyTier)));
    panel.querySelector('[data-preview-authoritative-rate]')?.addEventListener('click', openAuthoritativeRatePreview);
    void range;
  }

  function renderCalendarPanel(panel) {
    const range = activeCalendarRange();
    const data = state.calendar.data;
    const rangeMatches = data?.hotel_id === state.workspace.property.id
      && data?.start_date === range.start && data?.end_date === range.end;
    if (state.calendar.loading) {
      panel.innerHTML = `${workspacePanelHeader('Calendar & Rates', 'Loading authoritative room rates, inventory and restrictions…')}<div class="hotel-property-empty"><span class="hotel-workspace-spinner" aria-hidden="true"></span> Loading ${escapeHtml(calendarMonthTitle(range))}…</div>`;
      return;
    }
    if (state.calendar.error) {
      panel.innerHTML = `${workspacePanelHeader('Calendar & Rates', 'The calendar failed closed; no raw-table fallback is used.')}<div class="hotel-property-empty hotel-property-empty--error"><p>${escapeHtml(state.calendar.error.message || 'Calendar could not be loaded.')}</p><button class="btn-secondary" type="button" data-calendar-retry>Retry exact range</button></div>`;
      panel.querySelector('[data-calendar-retry]')?.addEventListener('click', () => { state.calendar.error = null; void loadCalendarRange(); });
      return;
    }
    if (!rangeMatches) {
      panel.innerHTML = `${workspacePanelHeader('Calendar & Rates', 'Loading authoritative room rates, inventory and restrictions…')}<div class="hotel-property-empty"><span class="hotel-workspace-spinner" aria-hidden="true"></span> Loading ${escapeHtml(calendarMonthTitle(range))}…</div>`;
      void loadCalendarRange();
      return;
    }
    renderCalendarLoaded(panel, range, data);
  }

  function selectedCalendarProducts() {
    const selected = new Set(state.calendar.selected_product_ids);
    return calendarProducts().filter((product) => selected.has(product.id));
  }

  function buildCalendarPlan(operations) {
    const range = activeCalendarRange();
    const snapshotStart = state.calendar.data?.start_date;
    const snapshotEnd = state.calendar.data?.end_date;
    const plan = {
      hotel_id: state.workspace.property.id,
      // The concurrency token is bound to the complete loaded window. Exact
      // selected dates remain in operation payloads and in the Review rows.
      from: snapshotStart || range.start,
      to: snapshotEnd || range.end,
      reviewed_at: new Date().toISOString(),
      operations: Core.clone(operations),
    };
    if (state.calendar.data?.snapshot_token) plan.snapshot_token = state.calendar.data.snapshot_token;
    return plan;
  }

  function calendarReviewRows(rows) {
    return Core.asArray(rows).map((row) => `<tr><th>${escapeHtml(row.field)}</th><td><pre>${escapeHtml(displayReviewValue(row.before))}</pre></td><td><pre>${escapeHtml(displayReviewValue(row.after))}</pre></td></tr>`).join('');
  }

  function calendarReviewState(entity, row) {
    const source = Core.asObject(row);
    if (entity === 'daily_inventory') return {
      sellable_units: source.sellable_units ?? null,
      sellable_units_mode: source.sellable_units_mode ?? null,
      closed: source.closed ?? null,
      closed_mode: source.closed_mode ?? null,
      expires_at: source.expires_at ?? null,
    };
    return {
      nightly_rate: source.nightly_rate ?? null,
      nightly_rate_mode: source.nightly_rate_mode ?? null,
      minimum_stay: source.minimum_stay ?? null,
      minimum_stay_mode: source.minimum_stay_mode ?? null,
      maximum_stay: source.maximum_stay ?? null,
      maximum_stay_mode: source.maximum_stay_mode ?? null,
      closed_to_arrival: source.closed_to_arrival ?? null,
      closed_to_arrival_mode: source.closed_to_arrival_mode ?? null,
      closed_to_departure: source.closed_to_departure ?? null,
      closed_to_departure_mode: source.closed_to_departure_mode ?? null,
      expires_at: source.expires_at ?? null,
    };
  }

  function calendarExactReviewRows(operations) {
    const overrideById = new Map(Core.asArray(state.calendar.data?.calendar_overrides).map((row) => [row.id, row]));
    const inventoryByKey = new Map(Core.asArray(state.calendar.data?.daily_inventory).map((row) => [`${row.room_type_id}:${row.stay_date}`, row]));
    const productById = new Map(calendarProducts().map((product) => [product.id, product]));
    const roomById = new Map(state.workspace.room_types.map((room) => [room.id, room]));
    const rows = operations.slice(0, 200).map((operation) => {
      const payload = Core.asObject(operation.payload);
      const existing = operation.entity === 'daily_inventory'
        ? inventoryByKey.get(`${payload.room_type_id}:${payload.stay_date}`)
        : overrideById.get(operation.id);
      const after = operation.type === 'delete' ? null : { ...Core.asObject(existing), ...payload };
      const product = productById.get(payload.room_rate_id || existing?.room_rate_id);
      const room = roomById.get(payload.room_type_id || existing?.room_type_id || product?.room_type_id);
      const label = operation.entity === 'daily_inventory'
        ? `${Core.i18nText(room?.name_i18n, 'en', room?.code || 'Room Type')} inventory · ${payload.stay_date}`
        : `${product?.room_name || 'Rate product'} · ${product?.rate_plan_name || ''} · ${payload.stay_date || existing?.stay_date}`;
      return {
        field: label,
        before: existing ? calendarReviewState(operation.entity, existing) : 'Inherited / base value',
        after: after ? calendarReviewState(operation.entity, after) : 'Inherited / base value',
      };
    });
    if (operations.length > rows.length) rows.push({ field: 'Additional exact rows', before: 0, after: operations.length - rows.length });
    return rows;
  }

  async function openCalendarReview({ title, plan, rows, successMessage }) {
    if (!plan?.operations?.length) {
      toast('There are no Calendar changes to review.', 'info');
      return;
    }
    state.pendingReview = { calendarPlan: Core.clone(plan) };
    openModal({
      title,
      className: 'hotel-workspace-modal--review hotel-workspace-modal--wide',
      body: `<div class="hotel-review-summary"><p>One exact-property Calendar transaction will apply only if every reviewed version still matches.</p><dl><div><dt>Property ID</dt><dd><code>${escapeHtml(plan.hotel_id)}</code></dd></div><div><dt>Operations</dt><dd>${plan.operations.length}</dd></div><div><dt>Range</dt><dd>${escapeHtml(plan.from)} → ${escapeHtml(plan.to)}</dd></div><div><dt>Concurrency</dt><dd>Exact row versions</dd></div></dl></div>
        <div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Change</th><th>Before</th><th>After</th></tr></thead><tbody>${calendarReviewRows(rows)}</tbody></table></div>
        <p class="hotel-workspace-safety-note">This remains inert V2 configuration. It does not publish the property, alter legacy prices, migrate bookings or enable a Hotels feature flag.</p>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Back</button><button class="btn-primary" type="button" data-calendar-review-confirm>Save reviewed Calendar changes</button>',
      onReady(overlay) {
        overlay.querySelector('[data-calendar-review-confirm]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = 'Saving…';
          setModalSaving(overlay, true);
          try {
            const result = await Repository.applyCalendarPlan(plan);
            closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            const activeRange = activeCalendarRange();
            if (result.calendar?.hotel_id === state.workspace.property.id
                && result.calendar.start_date === activeRange.start && result.calendar.end_date === activeRange.end) {
              state.calendar.data = result.calendar;
              if (Array.isArray(result.calendar.activity)) {
                state.workspace.activity = Core.clone(result.calendar.activity);
              }
              renderActivePanel();
            } else {
              state.calendar.data = null;
              await loadCalendarRange();
            }
            toast(successMessage || 'Reviewed Calendar changes saved.', 'success');
          } catch (error) {
            setModalSaving(overlay, false);
            button.disabled = false;
            button.textContent = 'Save reviewed Calendar changes';
            const message = error?.isStale
              ? 'Save stopped: Calendar data changed after Review. Reload the exact range and review again.'
              : error?.isAmbiguousOutcome
                ? 'The Calendar save result could not be confirmed. Reload before retrying; never submit the reviewed plan blindly.'
                : (error?.message || 'Calendar save failed. No partial change was kept.');
            toast(message, error?.isAmbiguousOutcome ? 'warning' : 'error');
          }
        });
      },
    });
  }

  function calendarPatchField(fd, field, options = {}) {
    const mode = String(fd.get(`${field}_mode`) || 'no_change');
    if (mode === 'no_change') return null;
    if (mode === 'clear') return { mode: 'clear' };
    if (options.boolean) return { mode: 'set', value: mode === 'true' };
    const raw = fd.get(field);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (options.integer && !Number.isInteger(value)) || (options.positive && value <= 0)) {
      throw new Error(`${options.label || field} is invalid.`);
    }
    return { mode: 'set', value };
  }

  function rangePatchControl(name, label, type, options = {}) {
    const setLabel = options.setLabel || 'Set value';
    const clearLabel = options.clearLabel || 'Clear override';
    return `<label class="admin-form-field hotel-calendar-patch-field"><span>${escapeHtml(label)}</span><select name="${escapeAttr(name)}_mode" data-calendar-patch-mode><option value="no_change">No change</option><option value="set">${escapeHtml(setLabel)}</option><option value="clear">${escapeHtml(clearLabel)}</option></select><input name="${escapeAttr(name)}" type="${type}" min="${options.min ?? 0}" step="${options.step || 1}" placeholder="${escapeAttr(options.placeholder || '')}" disabled /></label>`;
  }

  function applyCalendarFieldPatch(source, patch) {
    const next = { ...source };
    Object.entries(patch).forEach(([field, change]) => {
      next[`${field}_mode`] = change.mode;
      if (change.mode === 'set') next[field] = change.value;
      else if (change.mode === 'clear') next[field] = null;
    });
    return next;
  }

  function calendarOverrideOperations(products, dates, patch, provenance) {
    if (!Object.keys(patch).length) return [];
    const existingByKey = new Map(Core.asArray(state.calendar.data?.calendar_overrides)
      .map((row) => [`${row.room_rate_id}:${row.stay_date}`, row]));
    const valueFields = ['nightly_rate', 'minimum_stay', 'maximum_stay', 'closed', 'closed_to_arrival', 'closed_to_departure'];
    const operations = [];
    products.forEach((product) => dates.forEach((stayDate) => {
      const existing = existingByKey.get(`${product.id}:${stayDate}`) || null;
      const next = applyCalendarFieldPatch(existing || {}, patch);
      const hasValue = valueFields.some((field) => next[`${field}_mode`] != null);
      if (!hasValue) return;
      const payload = {};
      Object.entries(patch).forEach(([field, change]) => {
        payload[field] = change.mode === 'clear' ? null : change.value;
        payload[`${field}_mode`] = change.mode;
      });
      payload.provenance = { ...Core.asObject(existing?.provenance), ...provenance, source: 'manual' };
      payload.reason = provenance.reason;
      payload.expires_at = provenance.expires_at;
      payload.source = 'manual';
      payload.is_active = true;
      if (!existing) {
        payload.room_rate_id = product.id;
        payload.stay_date = stayDate;
      }
      operations.push({
        entity: 'calendar_override', type: existing ? 'update' : 'create',
        id: existing?.id || Core.newUuid(), expected_version: existing ? Number(existing.version) : 0, payload,
      });
    }));
    return operations;
  }

  function dailyInventoryOperations(products, dates, patch, provenance) {
    if (!Object.keys(patch).length) return [];
    const roomById = new Map();
    products.forEach((product) => { if (!roomById.has(product.room_type_id)) roomById.set(product.room_type_id, product); });
    const existingByKey = new Map(Core.asArray(state.calendar.data?.daily_inventory)
      .map((row) => [`${row.room_type_id}:${row.stay_date}`, row]));
    const operations = [];
    roomById.forEach((product, roomTypeId) => dates.forEach((stayDate) => {
      const existing = existingByKey.get(`${roomTypeId}:${stayDate}`) || null;
      const next = applyCalendarFieldPatch(existing || {}, patch);
      const sellableMode = next.sellable_units_mode ?? null;
      const closedMode = next.closed_mode ?? null;
      const noRemainingOverride = (!sellableMode || sellableMode === 'clear') && (!closedMode || closedMode === 'clear');
      if (existing && noRemainingOverride) {
        operations.push({ entity: 'daily_inventory', type: 'delete', expected_version: Number(existing.version), payload: { room_type_id: roomTypeId, stay_date: stayDate } });
        return;
      }
      if (!existing && noRemainingOverride) return;
      const payload = {
        room_type_id: roomTypeId,
        stay_date: stayDate,
        source: 'manual',
        reason: provenance.reason,
        expires_at: provenance.expires_at,
        provenance: { ...Core.asObject(existing?.provenance), ...provenance, source: 'manual' },
      };
      Object.entries(patch).forEach(([field, change]) => {
        payload[field] = change.mode === 'clear' ? null : change.value;
        payload[`${field}_mode`] = change.mode;
      });
      // The physical storage columns are NOT NULL, while the companion modes
      // decide whether a value is authoritative or inherited. New rows still
      // need harmless storage values for the direction the Admin did not edit.
      if (!existing && !Object.hasOwn(payload, 'sellable_units')) {
        payload.sellable_units = Number(product.base_inventory_count ?? 0);
        payload.sellable_units_mode = 'clear';
      }
      if (!existing && !Object.hasOwn(payload, 'closed')) {
        payload.closed = false;
        payload.closed_mode = 'clear';
      }
      operations.push({ entity: 'daily_inventory', type: 'upsert', expected_version: existing ? Number(existing.version) : 0, payload });
    }));
    return operations;
  }

  function openCalendarRangeEditor() {
    const products = selectedCalendarProducts();
    const startDate = state.calendar.selection_start;
    const endDate = state.calendar.selection_end;
    if (!products.length || !startDate || !endDate) {
      toast('Select at least one Room × Rate Plan product and a date range.', 'error');
      return;
    }
    openModal({
      title: 'Edit selected Calendar range',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelCalendarRangeForm" class="hotel-workspace-form">
        <div class="hotel-calendar-edit-context"><div><span>Products</span><strong>${products.length}</strong><small>${products.map((product) => `${product.room_name} · ${product.rate_plan_name}`).join(', ')}</small></div><div><span>Date range</span><strong>${escapeHtml(startDate)} → ${escapeHtml(endDate)}</strong><small>${enumerateCalendarDates(startDate, endDate).length} calendar days</small></div></div>
        <fieldset><legend>Apply on weekdays</legend><div class="hotel-calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, index) => `<label><input type="checkbox" name="weekday" value="${index + 1}" checked /> ${label}</label>`).join('')}</div></fieldset>
        <fieldset><legend>Rates & inventory</legend><div class="hotel-workspace-form-grid">${rangePatchControl('nightly_rate', 'Nightly rate', 'number', { step: '0.01', placeholder: 'EUR', clearLabel: 'Use lower-precedence price' })}${rangePatchControl('sellable_units', 'Sellable rooms', 'number', { integer: true, clearLabel: 'Use base inventory' })}</div></fieldset>
        <fieldset><legend>Availability & restrictions</legend><div class="hotel-workspace-form-grid">
          <label class="admin-form-field"><span>Room safety closure</span><select name="closed_mode"><option value="no_change">No change</option><option value="false">Set open</option><option value="true">Set closed</option><option value="clear">Clear override / inherit</option></select></label>
          ${rangePatchControl('minimum_stay', 'Minimum stay', 'number', { min: 1, positive: true, clearLabel: 'No minimum override' })}
          ${rangePatchControl('maximum_stay', 'Maximum stay', 'number', { min: 1, positive: true, clearLabel: 'No maximum override' })}
          <label class="admin-form-field"><span>Arrival</span><select name="closed_to_arrival_mode"><option value="no_change">No change</option><option value="false">Allow arrival</option><option value="true">Close to arrival</option><option value="clear">Clear override / inherit</option></select></label>
          <label class="admin-form-field"><span>Departure</span><select name="closed_to_departure_mode"><option value="no_change">No change</option><option value="false">Allow departure</option><option value="true">Close to departure</option><option value="clear">Clear override / inherit</option></select></label>
        </div></fieldset>
        <fieldset><legend>Audit context</legend><div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Reason</span><input name="reason" maxlength="500" required placeholder="Why is this override needed?" /></label><label class="admin-form-field"><span>Temporary override expires</span><input name="expires_at" type="datetime-local" /><small>Optional. Leave empty for a reviewed persistent override.</small></label></div></fieldset>
        <p class="hotel-workspace-safety-note">No change preserves every selected product's current value. Clear removes only the selected override field and reveals the next lower precedence.</p>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelCalendarRangeForm">Review range changes</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelCalendarRangeForm');
        form.querySelectorAll('[data-calendar-patch-mode]').forEach((select) => select.addEventListener('change', () => {
          const input = select.parentElement.querySelector('input');
          input.disabled = select.value !== 'set';
          if (!input.disabled) input.focus();
        }));
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          let ratePatch;
          let inventoryPatch;
          try {
            ratePatch = {
              nightly_rate: calendarPatchField(fd, 'nightly_rate', { label: 'Nightly rate' }),
              minimum_stay: calendarPatchField(fd, 'minimum_stay', { label: 'Minimum stay', integer: true, positive: true }),
              maximum_stay: calendarPatchField(fd, 'maximum_stay', { label: 'Maximum stay', integer: true, positive: true }),
              closed_to_arrival: calendarPatchField(fd, 'closed_to_arrival', { boolean: true }),
              closed_to_departure: calendarPatchField(fd, 'closed_to_departure', { boolean: true }),
            };
            inventoryPatch = {
              sellable_units: calendarPatchField(fd, 'sellable_units', { label: 'Sellable rooms', integer: true }),
              closed: calendarPatchField(fd, 'closed', { boolean: true }),
            };
          } catch (error) {
            toast(error.message, 'error');
            return;
          }
          ratePatch = Object.fromEntries(Object.entries(ratePatch).filter(([_key, value]) => value));
          inventoryPatch = Object.fromEntries(Object.entries(inventoryPatch).filter(([_key, value]) => value));
          if (!Object.keys(ratePatch).length && !Object.keys(inventoryPatch).length) {
            toast('Choose at least one explicit Calendar change.', 'error');
            return;
          }
          const weekdays = fd.getAll('weekday').map(Number).sort((a, b) => a - b);
          if (!weekdays.length) { toast('Select at least one weekday.', 'error'); return; }
          const reason = String(fd.get('reason') || '').trim();
          const expiresAtRaw = String(fd.get('expires_at') || '').trim();
          const expiresDate = expiresAtRaw ? new Date(expiresAtRaw) : null;
          const expiresAt = expiresDate && !Number.isNaN(expiresDate.getTime()) ? expiresDate.toISOString() : null;
          if (!reason) { toast('A concise audit reason is required.', 'error'); return; }
          if (expiresAtRaw && !expiresAt) { toast('Temporary override expiry is invalid.', 'error'); return; }
          const dates = enumerateCalendarDates(startDate, endDate).filter((date) => weekdays.includes((parseIsoDate(date).getUTCDay() || 7)));
          const provenance = { reason, expires_at: expiresAt, reviewed_range: { from: startDate, to: endDate, weekdays } };
          const operations = [
            ...calendarOverrideOperations(products, dates, ratePatch, provenance),
            ...dailyInventoryOperations(products, dates, inventoryPatch, provenance),
          ];
          if (!operations.length) { toast('The reviewed range produces no database changes.', 'info'); return; }
          const plan = buildCalendarPlan(operations, { start_date: startDate, end_date: endDate, product_ids: products.map((product) => product.id), reason, expires_at: expiresAt });
          closeModal({ restoreFocus: false });
          void openCalendarReview({
            title: 'Review Calendar range update', plan,
            rows: [
              { field: 'Room × Rate Plan products', before: 'No change', after: products.map((product) => `${product.room_name} · ${product.rate_plan_name}`) },
              { field: 'Dates / weekdays', before: 'Current exact rows', after: { start_date: startDate, end_date: endDate, weekdays } },
              { field: 'Audit context', before: 'Not supplied', after: { reason, expires_at: expiresAt } },
              ...calendarExactReviewRows(operations),
            ],
            successMessage: 'Calendar range updated atomically.',
          });
        });
      },
    });
  }

  function openCalendarRuleEditor(ruleId = null) {
    const existing = ruleId ? Core.asArray(state.calendar.data?.rate_rules).find((rule) => rule.id === ruleId) : null;
    const products = existing ? calendarProducts().filter((product) => product.id === existing.room_rate_id) : selectedCalendarProducts();
    if (!products.length) { toast('Select at least one Room × Rate Plan product.', 'error'); return; }
    const range = activeCalendarRange();
    openModal({
      title: existing ? 'Edit seasonal / weekday rule' : 'Add seasonal / weekday rule',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelCalendarRuleForm" class="hotel-workspace-form">
        <p>${existing ? 'This edits one exact reviewed rule.' : `One draft rule will be created for each of ${products.length} selected products.`}</p>
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Valid from</span><input type="date" name="valid_from" value="${escapeAttr(existing?.valid_from || range.start)}" required /></label><label class="admin-form-field"><span>Valid to</span><input type="date" name="valid_to" value="${escapeAttr(existing?.valid_to || range.end)}" required /></label><label class="admin-form-field"><span>Nightly rate</span><input type="number" name="nightly_rate" min="0" step="0.01" value="${escapeAttr(existing?.nightly_rate ?? '')}" required /></label><label class="admin-form-field"><span>Priority</span><input type="number" name="priority" min="-32768" max="32767" step="1" value="${escapeAttr(existing?.priority ?? 0)}" required /></label><label class="admin-form-field"><span>Minimum stay</span><input type="number" name="minimum_stay" min="1" step="1" value="${escapeAttr(existing?.minimum_stay ?? '')}" /></label><label class="admin-form-field"><span>Maximum stay</span><input type="number" name="maximum_stay" min="1" step="1" value="${escapeAttr(existing?.maximum_stay ?? '')}" /></label></div>
        <fieldset><legend>Weekdays</legend><div class="hotel-calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, index) => `<label><input type="checkbox" name="weekday" value="${index + 1}" ${!existing || Core.asArray(existing.weekdays).includes(index + 1) ? 'checked' : ''} /> ${label}</label>`).join('')}</div></fieldset>
        <div class="hotel-workspace-form-grid"><label class="admin-checkbox-field"><input type="checkbox" name="closed_to_arrival" ${existing?.closed_to_arrival ? 'checked' : ''} /> Closed to arrival</label><label class="admin-checkbox-field"><input type="checkbox" name="closed_to_departure" ${existing?.closed_to_departure ? 'checked' : ''} /> Closed to departure</label><label class="admin-checkbox-field"><input type="checkbox" name="is_active" ${existing?.is_active === false ? '' : 'checked'} /> Active</label></div>
        <p class="hotel-workspace-safety-note">Equal-priority overlapping rules are rejected by the server. Use exact priorities deliberately.</p>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelCalendarRuleForm">Review rule</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelCalendarRuleForm')?.addEventListener('submit', (event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const payload = {
            valid_from: String(fd.get('valid_from')), valid_to: String(fd.get('valid_to')),
            weekdays: fd.getAll('weekday').map(Number).sort((a, b) => a - b),
            nightly_rate: Number(fd.get('nightly_rate')),
            minimum_stay: fd.get('minimum_stay') === '' ? null : Number(fd.get('minimum_stay')),
            maximum_stay: fd.get('maximum_stay') === '' ? null : Number(fd.get('maximum_stay')),
            closed_to_arrival: fd.has('closed_to_arrival'), closed_to_departure: fd.has('closed_to_departure'),
            priority: Number(fd.get('priority')), is_active: fd.has('is_active'),
          };
          if (!payload.valid_from || !payload.valid_to || payload.valid_to < payload.valid_from || !payload.weekdays.length
              || !Number.isFinite(payload.nightly_rate) || payload.nightly_rate < 0
              || (payload.minimum_stay && payload.maximum_stay && payload.maximum_stay < payload.minimum_stay)) {
            toast('Review dates, weekdays, rate and stay limits.', 'error'); return;
          }
          const operations = products.map((product) => ({
            entity: 'rate_rule', type: existing ? 'update' : 'create',
            id: existing?.id || Core.newUuid(),
            expected_version: existing ? Number(existing.version) : 0,
            payload: { ...payload, room_rate_id: product.id },
          }));
          const plan = buildCalendarPlan(operations, { product_ids: products.map((product) => product.id) });
          closeModal({ restoreFocus: false });
          void openCalendarReview({ title: 'Review seasonal / weekday rule', plan, rows: [
            { field: 'Products', before: existing ? existing.room_rate_id : 'No rules', after: products.map((product) => `${product.room_name} · ${product.rate_plan_name}`) },
            { field: 'Rule', before: existing || 'Not configured', after: payload },
          ], successMessage: existing ? 'Rate rule updated.' : 'Rate rules created atomically.' });
        });
      },
    });
  }

  function openOccupancyTierEditor(tierId = null) {
    const existing = tierId ? Core.asArray(state.calendar.data?.occupancy_tiers).find((tier) => tier.id === tierId) : null;
    const products = existing ? calendarProducts().filter((product) => product.id === existing.room_rate_id) : selectedCalendarProducts();
    if (!products.length) { toast('Select at least one Room × Rate Plan product.', 'error'); return; }
    openModal({
      title: existing ? 'Edit occupancy / stay tier' : 'Add occupancy / stay tier',
      body: `<form id="hotelOccupancyTierForm" class="hotel-workspace-form"><p>${existing ? 'Edit this exact tier.' : `Create one reviewed tier for each of ${products.length} selected products.`}</p><div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Guest count</span><input name="guest_count" type="number" min="1" step="1" value="${escapeAttr(existing?.guest_count ?? '')}" required /></label><label class="admin-form-field"><span>From stay length</span><input name="threshold_nights" type="number" min="1" step="1" value="${escapeAttr(existing?.threshold_nights ?? '')}" required /><small>Selected nightly rate applies to the complete stay.</small></label><label class="admin-form-field"><span>Nightly rate</span><input name="nightly_rate" type="number" min="0" step="0.01" value="${escapeAttr(existing?.nightly_rate ?? '')}" required /></label><label class="admin-checkbox-field"><input name="is_active" type="checkbox" ${existing?.is_active === false ? '' : 'checked'} /> Active</label></div><p class="hotel-workspace-safety-note">A duplicate exact product + guest count + threshold is rejected. Pricing conversion remains shadow-only until its complete legacy oracle passes.</p></form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelOccupancyTierForm">Review tier</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelOccupancyTierForm')?.addEventListener('submit', (event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const payload = { guest_count: Number(fd.get('guest_count')), threshold_nights: Number(fd.get('threshold_nights')), nightly_rate: Number(fd.get('nightly_rate')), is_active: fd.has('is_active') };
          if (!Number.isInteger(payload.guest_count) || payload.guest_count <= 0 || !Number.isInteger(payload.threshold_nights) || payload.threshold_nights <= 0 || !Number.isFinite(payload.nightly_rate) || payload.nightly_rate < 0) {
            toast('Guest count, stay threshold and nightly rate are required.', 'error'); return;
          }
          const operations = products.map((product) => ({ entity: 'occupancy_tier', type: existing ? 'update' : 'create', id: existing?.id || Core.newUuid(), expected_version: existing ? Number(existing.version) : 0, payload: { ...payload, room_rate_id: product.id } }));
          const plan = buildCalendarPlan(operations, { product_ids: products.map((product) => product.id) });
          closeModal({ restoreFocus: false });
          void openCalendarReview({ title: 'Review occupancy / stay tier', plan, rows: [
            { field: 'Products', before: existing ? existing.room_rate_id : 'No tiers', after: products.map((product) => `${product.room_name} · ${product.rate_plan_name}`) },
            { field: 'Tier', before: existing || 'Not configured', after: payload },
          ], successMessage: existing ? 'Occupancy tier updated.' : 'Occupancy tiers created atomically.' });
        });
      },
    });
  }

  function openAuthoritativeRatePreview() {
    const [product] = selectedCalendarProducts();
    if (!product || state.calendar.selected_product_ids.length !== 1) { toast('Select exactly one product to preview.', 'error'); return; }
    const range = activeCalendarRange();
    const arrival = state.calendar.selection_start || range.start;
    const departure = addCalendarDays(state.calendar.selection_end || arrival, 1);
    openModal({
      title: 'Preview authoritative stay rate',
      body: `<form id="hotelRatePreviewForm" class="hotel-workspace-form"><p><strong>${escapeHtml(product.room_name)} · ${escapeHtml(product.rate_plan_name)}</strong></p><div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Check-in</span><input name="check_in" type="date" value="${escapeAttr(arrival)}" required /></label><label class="admin-form-field"><span>Check-out</span><input name="check_out" type="date" value="${escapeAttr(departure)}" required /></label><label class="admin-form-field"><span>Guests</span><input name="guest_count" type="number" min="1" step="1" value="2" required /></label></div><div data-rate-preview-result aria-live="polite"></div></form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Close</button><button class="btn-primary" type="submit" form="hotelRatePreviewForm">Resolve preview</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelRatePreviewForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fd = new FormData(form);
          const resultBox = form.querySelector('[data-rate-preview-result]');
          resultBox.innerHTML = '<span class="hotel-workspace-spinner" aria-hidden="true"></span> Resolving on server…';
          try {
            const result = await Repository.resolveRate(product.id, fd.get('check_in'), fd.get('check_out'), Number(fd.get('guest_count')));
            const total = result.total ?? result.total_price ?? result.quote_total;
            const nights = result.nights ?? Core.asArray(result.nightly_rates).length;
            resultBox.innerHTML = `<section class="hotel-rate-preview-result"><span class="hotel-workspace-eyebrow">Authoritative read-only preview</span><h4>${total == null ? 'See nightly breakdown' : escapeHtml(formatMoney(total, product.currency))}</h4><p>${Number(nights || 0)} night${Number(nights) === 1 ? '' : 's'} · ${escapeHtml(result.status || (result.ok === false ? 'Blocked' : 'Resolved'))}</p><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></section>`;
          } catch (error) {
            resultBox.innerHTML = `<p class="hotel-property-card__blocker">${escapeHtml(error.message || 'Authoritative preview failed closed.')}</p>`;
          }
        });
      },
    });
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
