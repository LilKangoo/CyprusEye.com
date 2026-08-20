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
    contentControl: null,
    contentControlError: null,
    h3Configuration: null,
    h3ConfigurationError: null,
    pricingPromotionPreview: null,
    pricingPromotionError: null,
    partnerPermissions: null,
    partnerPermissionsError: null,
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
    ['booking_setup', 'Booking setup'],
    ['bookings', 'Bookings'],
    ['payments', 'Payments'],
    ['content', 'Content & Media'],
    ['partner', 'Partner & Access'],
    ['distribution', 'Distribution & Sync'],
    ['activity', 'Activity'],
  ]);

  const PARTNER_CAPABILITY_DETAILS = Object.freeze({
    edit_property_content: ['Property content', 'Edit property names, descriptions and structured content.'],
    edit_property_photos: ['Property photos', 'Manage the property gallery without changing publication.'],
    edit_room_content: ['Room content', 'Edit assigned Hotel room names and descriptions.'],
    edit_room_photos: ['Room photos', 'Manage Room Type galleries.'],
    create_rooms: ['Create rooms', 'Create new Room Types inside this exact property.'],
    edit_room_structure: ['Room structure', 'Change room capacity, inventory model and structural fields.'],
    manage_prices: ['Prices and rate rules', 'Manage reviewed Room Rate pricing and restrictions.'],
    manage_availability: ['Availability', 'Manage exact Room Type calendar availability.'],
    process_bookings: ['Process booking requests', 'Accept or reject exact assigned Hotel requests only after a later reviewed booking stage enables that workflow.'],
    request_booking_changes: ['Request booking changes', 'Request reviewed changes to an assigned Hotel booking.'],
    view_payment_status: ['View payment status', 'See status only; no payment details or payout settings are exposed by this capability.'],
    initiate_stripe_onboarding: ['Start Stripe onboarding', 'Future capability only. Stripe Connect remains disabled.'],
  });

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
    if (state.modal) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(state.modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key !== 'Escape') return;
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
      state.h3Configuration = null;
      state.h3ConfigurationError = null;
      state.contentControl = null;
      state.contentControlError = null;
      state.pricingPromotionPreview = null;
      state.pricingPromotionError = null;
      state.partnerPermissions = null;
      state.partnerPermissionsError = null;
      try {
        state.h3Configuration = await Repository.getH3Configuration(id);
      } catch (error) {
        state.h3ConfigurationError = error;
      }
      try {
        state.contentControl = await Repository.getContentControl(id);
      } catch (error) {
        state.contentControlError = error;
      }
      if (id === Core.SEVEN_ARCHES_PROPERTY_ID) {
        try {
          state.pricingPromotionPreview = await Repository.getLegacyPricingPromotionPreview(id);
        } catch (error) {
          state.pricingPromotionError = error;
        }
      }
      try {
        state.partnerPermissions = await Repository.getPartnerHotelPermissions(id);
      } catch (error) {
        state.partnerPermissionsError = error;
      }
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
    state.h3Configuration = null;
    state.h3ConfigurationError = null;
    state.contentControl = null;
    state.contentControlError = null;
    state.pricingPromotionPreview = null;
    state.pricingPromotionError = null;
    state.partnerPermissions = null;
    state.partnerPermissionsError = null;
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
          <button type="button" role="tab" id="hotelWorkspaceTab-${key}" data-hotel-workspace-tab="${key}" aria-controls="hotelWorkspaceActivePanel" aria-selected="${state.activeTab === key}" tabindex="${state.activeTab === key ? '0' : '-1'}" class="${state.activeTab === key ? 'is-active' : ''}">${escapeHtml(label)}</button>
        `).join('')}
      </nav>
      <div class="hotel-workspace-panel" id="hotelWorkspaceActivePanel" role="tabpanel" aria-labelledby="hotelWorkspaceTab-${escapeAttr(state.activeTab)}" tabindex="0"></div>`;
    container.querySelector('[data-hotel-workspace-back]')?.addEventListener('click', closeWorkspace);
    const activateTab = (key, options = {}) => {
      state.activeTab = key;
      renderWorkspace();
      if (options.focus === true) {
        byId(`hotelWorkspaceTab-${key}`)?.focus();
      }
    };
    container.querySelectorAll('[data-hotel-workspace-tab]').forEach((button) => {
      button.addEventListener('click', () => activateTab(button.dataset.hotelWorkspaceTab));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const keys = WORKSPACE_TABS.map(([key]) => key);
        const currentIndex = keys.indexOf(button.dataset.hotelWorkspaceTab);
        const rtl = document.documentElement?.dir === 'rtl' || button.closest('[dir="rtl"]');
        let nextIndex = currentIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = keys.length - 1;
        else {
          const visualStep = event.key === 'ArrowRight' ? 1 : -1;
          const step = rtl ? -visualStep : visualStep;
          nextIndex = (currentIndex + step + keys.length) % keys.length;
        }
        event.preventDefault();
        activateTab(keys[nextIndex], { focus: true });
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
      booking_setup: renderBookingSetupPanel,
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

  function i18nFields(prefix, label, values, type = 'input', maxLength = null) {
    const normalized = Core.normalizeI18n(values);
    const maxLengthAttribute = Number.isInteger(Number(maxLength)) && Number(maxLength) > 0
      ? ` maxlength="${Number(maxLength)}"`
      : '';
    return `<fieldset class="hotel-workspace-i18n"><legend>${escapeHtml(label)}</legend><div class="hotel-workspace-i18n-grid">
      ${Core.LANGUAGES.map((language) => `<label class="admin-form-field"><span>${escapeHtml(language.toUpperCase())}</span>${type === 'textarea'
        ? `<textarea name="${escapeAttr(prefix)}_${language}" rows="3" dir="${language === 'he' ? 'rtl' : 'ltr'}"${maxLengthAttribute}>${escapeHtml(normalized[language] || '')}</textarea>`
        : `<input name="${escapeAttr(prefix)}_${language}" type="text" value="${escapeAttr(normalized[language] || '')}" dir="${language === 'he' ? 'rtl' : 'ltr'}"${maxLengthAttribute} />`}</label>`).join('')}
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
        <div class="hotel-workspace-locked-fields"><div><span>Property default</span><strong>${escapeHtml(childPolicyText(state.workspace.property.children_policy, state.workspace.property.minimum_child_age))}</strong></div></div>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(room.id)}</code></details>
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
            contextMessage: `${Core.i18nText(room.name_i18n, 'en', room.code)} receives this exact override. It does not alter pricing, inventory, publication or the property default.`,
            diagnostics: [{ label: 'Room Type ID', value: room.id }],
            successMessage: 'Room Type children-policy override saved.',
          });
        });
      },
    });
  }

  function propertyControlViewFor(workspace, contentControl) {
    const property = Core.clone(workspace?.property || {});
    const profile = Core.asObject(contentControl?.operational_profile);
    if (!contentControl || !Object.keys(profile).length) return property;
    return {
      ...property,
      maximum_stay_nights: profile.maximum_stay_nights == null ? null : Number(profile.maximum_stay_nights),
      guest_instructions_i18n: Core.normalizeI18n(profile.guest_instructions_i18n),
      check_in_instructions_i18n: Core.normalizeI18n(profile.check_in_instructions_i18n),
      check_out_instructions_i18n: Core.normalizeI18n(profile.check_out_instructions_i18n),
      internal_operational_notes: Core.asNullableText(profile.internal_operational_notes),
      operational_profile_version: Number(profile.version || 0),
    };
  }

  function propertyControlView() {
    return propertyControlViewFor(state.workspace, state.contentControl);
  }

  function propertyControlReviewOptions(currentWorkspace, currentContentControl, requestedProperty, options = {}) {
    const currentProperty = propertyControlViewFor(currentWorkspace, currentContentControl);
    const requestedState = Core.propertyControlBusinessState(requestedProperty);
    const validated = { ...Core.clone(currentProperty), ...requestedState };
    const profileVersion = Number(currentContentControl?.operational_profile?.version);
    const buildPlan = () => Core.buildPropertyControlPlan(currentWorkspace, validated, {
      currentProperty,
      expectedOperationalProfileVersion: profileVersion,
    });
    const correlationId = Core.newUuid();
    const reviewedPropertyFields = Core.PROPERTY_CONTROL_BUSINESS_FIELDS.filter((field) => (
      JSON.stringify(Core.propertyControlBusinessState(currentProperty)[field])
        !== JSON.stringify(Core.propertyControlBusinessState(validated)[field])
    ));
    const reconcileFreshProperty = async ({ acceptMatchingTarget = false } = {}) => {
      const propertyId = currentWorkspace.property.id;
      const [freshWorkspace, freshContentControl] = await Promise.all([
        Repository.getWorkspace(propertyId),
        Repository.getContentControl(propertyId),
      ]);
      const freshProperty = propertyControlViewFor(freshWorkspace, freshContentControl);
      state.workspace = freshWorkspace;
      state.contentControl = freshContentControl;
      state.contentControlError = null;
      const freshBusinessState = Core.propertyControlBusinessState(freshProperty);
      const targetBusinessState = Core.propertyControlBusinessState(validated);
      if (acceptMatchingTarget && reviewedPropertyFields.every((field) => (
        JSON.stringify(freshBusinessState[field]) === JSON.stringify(targetBusinessState[field])
      ))) {
        return {
          matched: true,
          workspace: freshWorkspace,
          content_control: freshContentControl,
          message: 'The database now matches the reviewed property changes. The interrupted response was reconciled without retrying the mutation.',
        };
      }
      const reconciliation = Core.reconcilePropertyControl(currentProperty, freshProperty, validated);
      if (!reconciliation.safe) {
        const conflict = new Error(`Property fields changed concurrently: ${reconciliation.conflicts.map((item) => reviewFieldLabel(item.field)).join(', ')}.`);
        conflict.userMessage = 'A genuine property conflict was stopped. Compare the original, current and requested values; nothing was saved or retried.';
        conflict.closeReviewAfterStale = true;
        conflict.openPropertyControlConflict = {
          freshWorkspace,
          freshContentControl,
          currentProperty: freshProperty,
          requestedProperty: validated,
          originalProperty: currentProperty,
          reconciliation,
          onCancel: options.onCancel || null,
          onApplyError: options.onApplyError || null,
          closeOnApplyError: options.closeOnApplyError === true,
          successMessage: options.successMessage || 'Property controls updated.',
        };
        throw conflict;
      }
      return {
        review: propertyControlReviewOptions(freshWorkspace, freshContentControl, reconciliation.merged, {
          ...options,
          afterStale: true,
        }),
      };
    };
    return {
      title: options.afterStale ? 'Review fresh property changes' : (options.title || 'Review property changes'),
      entity: 'property',
      before: currentProperty,
      after: validated,
      operation: Core.operationForEntity('property', validated, currentProperty),
      onCancel: options.onCancel || null,
      onApplyError: options.onApplyError || null,
      onAmbiguousReview: () => reconcileFreshProperty({ acceptMatchingTarget: true }),
      closeOnApplyError: options.closeOnApplyError === true,
      contextMessage: options.afterStale
        ? 'The previous save was stopped. This fresh explicit Review combines the current public property timestamp and private operational-profile version. Nothing was retried automatically.'
        : (options.contextMessage || 'Taxes and cleaning remain Rate Plan inclusions. Operational assignment and historical fulfillment routing are not changed by this property-content save.'),
      reReviewMessage: 'A stale property save was stopped. Non-overlapping values were rebased onto the fresh public and private property snapshots; inspect this Review and explicitly Save again.',
      successMessage: options.successMessage || 'Property controls updated.',
      async onConfirm() {
        const result = await Repository.applyPropertyControlPlan(buildPlan(), correlationId);
        state.workspace = result.workspace;
        state.contentControl = result.content_control;
        state.contentControlError = null;
        return result;
      },
      async onStaleReview() { return (await reconcileFreshProperty()).review; },
    };
  }

  function openPropertyControlConflict(conflictState) {
    const {
      freshWorkspace, freshContentControl, currentProperty, requestedProperty, originalProperty,
      reconciliation, onCancel, onApplyError, closeOnApplyError, successMessage,
    } = conflictState;
    state.workspace = freshWorkspace;
    state.contentControl = freshContentControl;
    state.contentControlError = null;
    const rows = reconciliation.conflicts.map((conflict) => `<article class="hotel-room-control-conflict">
      <header><strong>${escapeHtml(reviewFieldLabel(conflict.field))}</strong><span>Concurrent edit</span></header>
      <div><section><small>Originally reviewed</small>${reviewValueMarkup(conflict.original, conflict.field)}</section><section><small>Current database value</small>${reviewValueMarkup(conflict.current, conflict.field)}</section><section><small>Your reviewed value</small>${reviewValueMarkup(conflict.requested, conflict.field)}</section></div>
    </article>`).join('');
    openModal({
      title: 'Resolve property conflict',
      className: 'hotel-workspace-modal--wide hotel-workspace-modal--review',
      body: `<section class="hotel-room-control-conflicts"><div class="hotel-review-summary"><p>A real overlapping property edit occurred after Review. No mutation was retried.</p><dl><div><dt>Property</dt><dd>${escapeHtml(propertyTitle(currentProperty))}</dd></div><div><dt>Conflicting fields</dt><dd>${reconciliation.conflicts.length}</dd></div></dl></div>${rows}<p class="hotel-workspace-safety-note">Keep current discards this pending edit. “Use my reviewed values” only builds another Review against the fresh public and private versions; it does not save automatically.</p></section>`,
      footer: '<button class="btn-secondary" type="button" data-property-conflict-keep>Keep current</button><button class="btn-primary" type="button" data-property-conflict-use-reviewed>Use my reviewed values</button>',
      onClose: onCancel,
      onReady(overlay) {
        overlay.querySelector('[data-property-conflict-keep]')?.addEventListener('click', async () => {
          try { await onCancel?.(); } catch (error) { console.error('Failed to clean pending property media:', error); }
          closeModal({ skipCleanup: true, force: true });
          renderWorkspace();
          toast('Current property values kept. The pending edit was not saved.', 'info');
        });
        overlay.querySelector('[data-property-conflict-use-reviewed]')?.addEventListener('click', async () => {
          const requestedState = Core.propertyControlBusinessState(requestedProperty);
          const originalState = Core.propertyControlBusinessState(originalProperty);
          const resolved = { ...Core.clone(currentProperty) };
          Core.PROPERTY_CONTROL_BUSINESS_FIELDS.forEach((field) => {
            if (JSON.stringify(requestedState[field]) !== JSON.stringify(originalState[field])) {
              resolved[field] = Core.clone(requestedState[field]);
            }
          });
          closeModal({ restoreFocus: false, skipCleanup: true, force: true });
          await openReview(propertyControlReviewOptions(freshWorkspace, freshContentControl, resolved, {
            afterStale: true,
            onCancel,
            onApplyError,
            closeOnApplyError,
            successMessage,
          }));
        });
      },
    });
  }

  function renderOverviewPanel(panel) {
    const property = propertyControlView();
    const hasContentControl = Boolean(state.contentControl?.operational_profile);
    const readiness = Core.deriveWorkspaceReadiness(state.workspace);
    const preview = Core.migrationPreview(state.workspace);
    const legacySummary = property.architecture_version === 'legacy' ? legacyPricingSummary(property) : null;
    const normalizedH3 = state.h3Configuration ? Core.normalizeH3Configuration(state.h3Configuration) : null;
    const ratePlansWithInclusions = normalizedH3?.rate_plans || [];
    const taxesIncluded = ratePlansWithInclusions.length > 0 && ratePlansWithInclusions.every((plan) => plan.price_inclusions.includes('taxes'));
    const cleaningIncluded = ratePlansWithInclusions.length > 0 && ratePlansWithInclusions.every((plan) => plan.price_inclusions.includes('cleaning'));
    const eligibleOwnerPartners = state.workspace.partners.filter((partner) => (
      String(partner.status || '').toLowerCase() === 'active' && partner.can_manage_hotels === true
    ));
    const currentOwner = Core.asObject(property.owner_partner);
    const grandfatheredOwnerOption = property.owner_partner_id
      && !eligibleOwnerPartners.some((partner) => partner.id === property.owner_partner_id)
      ? `<option value="${escapeAttr(property.owner_partner_id)}" selected disabled>${escapeHtml(currentOwner.name || property.owner_partner_id)} · current ineligible owner (retain only)</option>`
      : '';
    const partnerOptions = eligibleOwnerPartners.map((partner) => `
      <option value="${escapeAttr(partner.id)}" ${partner.id === property.owner_partner_id ? 'selected' : ''}>${escapeHtml(partner.name || partner.company_name || partner.id)}</option>
    `).join('');
    panel.innerHTML = `
      ${workspacePanelHeader('Overview', 'Property identity, location and operating configuration. Rooms and prices remain independent.', '<button class="btn-primary" type="submit" form="hotelWorkspaceOverviewForm">Review changes</button>')}
      <div class="hotel-workspace-overview-grid">
        <form id="hotelWorkspaceOverviewForm" class="hotel-workspace-card hotel-workspace-form">
          <input type="hidden" name="property_id" value="${escapeAttr(property.id)}" />
          ${i18nFields('title', 'Property name', property.title_i18n || property.title, 'input', 240)}
          ${i18nFields('description', 'Property description', property.description_i18n || property.description, 'textarea', 12000)}
          <div class="hotel-workspace-form-grid">
            <label class="admin-form-field"><span>Address</span><input name="address_line" maxlength="500" value="${escapeAttr(property.address_line || '')}" /></label>
            <label class="admin-form-field"><span>City</span><input name="city" maxlength="200" value="${escapeAttr(property.city || '')}" required /></label>
            <label class="admin-form-field"><span>District / area</span><input name="district" maxlength="200" value="${escapeAttr(property.district || '')}" /></label>
            <label class="admin-form-field"><span>Postcode</span><input name="postal_code" maxlength="40" value="${escapeAttr(property.postal_code || '')}" /></label>
            <label class="admin-form-field"><span>Country</span><input name="country" maxlength="100" value="${escapeAttr(property.country || '')}" placeholder="Enter reviewed country" /></label>
            <label class="admin-form-field"><span>Latitude</span><input name="latitude" type="number" step="any" value="${escapeAttr(property.latitude ?? '')}" /></label>
            <label class="admin-form-field"><span>Longitude</span><input name="longitude" type="number" step="any" value="${escapeAttr(property.longitude ?? '')}" /></label>
            <label class="admin-form-field"><span>Google Maps URL</span><input name="google_maps_url" type="url" maxlength="2048" value="${escapeAttr(property.google_maps_url || '')}" /></label>
            <label class="admin-form-field"><span>Check-in from</span><input name="check_in_from" type="time" value="${escapeAttr(String(property.check_in_from || '').slice(0, 5))}" /></label>
            <label class="admin-form-field"><span>Check-out until</span><input name="check_out_until" type="time" value="${escapeAttr(String(property.check_out_until || '').slice(0, 5))}" /></label>
            <label class="admin-form-field"><span>Minimum stay (nights)</span><input name="minimum_stay_nights" type="number" min="1" max="365" step="1" value="${escapeAttr(property.minimum_stay_nights ?? '')}" /></label>
            <label class="admin-form-field"><span>Maximum stay (nights)</span><input name="maximum_stay_nights" type="number" min="1" max="365" step="1" value="${escapeAttr(property.maximum_stay_nights ?? '')}" ${hasContentControl ? '' : 'disabled'} /><small>${hasContentControl ? 'Leave empty when there is no property-wide maximum.' : 'Apply the reviewed ADMIN-B content-control foundation to configure this private field.'}</small></label>
            <label class="admin-form-field"><span>Timezone</span><input name="timezone" maxlength="100" value="${escapeAttr(property.timezone || '')}" placeholder="Europe/Nicosia" /></label>
            <label class="admin-form-field"><span>Currency</span><input name="currency" maxlength="3" value="${escapeAttr(property.currency || '')}" placeholder="EUR" required /></label>
            <label class="admin-form-field"><span>Booking mode</span><select name="booking_mode">
              <option value="" ${property.booking_mode ? '' : 'selected'}>Choose reviewed booking mode</option>${Core.BOOKING_MODES.map((mode) => `<option value="${mode}" ${property.booking_mode === mode ? 'selected' : ''}>${escapeHtml(bookingModeLabel(mode))}</option>`).join('')}
            </select></label>
            <label class="admin-form-field"><span>Commercial owner</span><select name="owner_partner_id"><option value="">Not assigned</option>${grandfatheredOwnerOption}${partnerOptions}</select><small>Only active Partners allowed to manage Hotels may be selected. The current ineligible owner can be retained but not reselected.</small></label>
          </div>
          ${hasContentControl ? `${i18nFields('guest_instructions', 'Guest information', property.guest_instructions_i18n, 'textarea', 8000)}
          ${i18nFields('check_in_instructions', 'Check-in instructions', property.check_in_instructions_i18n, 'textarea', 8000)}
          ${i18nFields('check_out_instructions', 'Check-out instructions', property.check_out_instructions_i18n, 'textarea', 8000)}
          <label class="admin-form-field"><span>Internal operational notes</span><textarea name="internal_operational_notes" rows="4" maxlength="5000">${escapeHtml(property.internal_operational_notes || '')}</textarea><small>Admin-only operational context. Never shown on the public Hotel page or returned by Partner/customer APIs.</small></label>` : `<section class="hotel-workspace-card hotel-property-empty--error"><strong>Private content control unavailable</strong><p>${escapeHtml(state.contentControlError?.message || 'The reviewed ADMIN-B SQL foundation is required before instructions or internal notes can be edited.')}</p></section>`}
          <fieldset><legend>Property amenities</legend>${amenitiesMarkup(property.amenities, 'property_amenity')}</fieldset>
          <div class="hotel-workspace-locked-fields">
            <div><span>Architecture</span><strong>${escapeHtml(architectureLabel(property.architecture_version))}</strong><small>Changes only through a future reviewed activation.</small></div>
            <div><span>Public state</span><strong>${property.is_published ? 'Published legacy page' : 'Not published'}</strong><small>Rooms V2 publishing is disabled in H2A.</small></div>
          </div>
          <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(property.id)}</code></details>
        </form>
        <aside class="hotel-workspace-side-stack">
          ${renderPropertyGuestPolicyCard(property)}
          <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Price inclusions · per Rate Plan</span><h4>${ratePlansWithInclusions.length ? `${ratePlansWithInclusions.length} reviewed Rate Plan${ratePlansWithInclusions.length === 1 ? '' : 's'}` : 'Not reviewed'}</h4><dl><div><dt>Taxes included</dt><dd>${taxesIncluded ? 'Yes' : 'No / mixed'}</dd></div><div><dt>Cleaning included</dt><dd>${cleaningIncluded ? 'Yes' : 'No / mixed'}</dd></div></dl><p>These commercial inclusions belong to each normalized Rate Plan and are not duplicated as property booleans.</p><button class="btn-secondary" type="button" data-open-rate-inclusions>Configure Rate Plan inclusions</button></section>
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
    panel.querySelector('[data-open-rate-inclusions]')?.addEventListener('click', () => { state.activeTab = 'booking_setup'; renderWorkspace(); });
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
    const before = propertyControlView();
    const hasContentControl = Boolean(state.contentControl?.operational_profile);
    if (!hasContentControl) return toast('Secure ADMIN-B content control is unavailable. Nothing was prepared for save.', 'error');
    const after = {
      ...before,
      title_i18n: readI18n(fd, 'title'),
      description_i18n: readI18n(fd, 'description'),
      address_line: Core.asNullableText ? Core.asNullableText(fd.get('address_line')) : String(fd.get('address_line') || '').trim() || null,
      city: String(fd.get('city') || '').trim(),
      district: String(fd.get('district') || '').trim() || null,
      postal_code: String(fd.get('postal_code') || '').trim() || null,
      country: String(fd.get('country') || '').trim() || null,
      latitude: Core.asNumber(fd.get('latitude'), null),
      longitude: Core.asNumber(fd.get('longitude'), null),
      google_maps_url: String(fd.get('google_maps_url') || '').trim() || null,
      check_in_from: String(fd.get('check_in_from') || '').trim() || null,
      check_out_until: String(fd.get('check_out_until') || '').trim() || null,
      minimum_stay_nights: fd.get('minimum_stay_nights') === '' ? null : Number(fd.get('minimum_stay_nights')),
      ...(hasContentControl ? {
        maximum_stay_nights: fd.get('maximum_stay_nights') === '' ? null : Number(fd.get('maximum_stay_nights')),
      } : {}),
      timezone: String(fd.get('timezone') || '').trim(),
      currency: String(fd.get('currency') || '').trim().toUpperCase(),
      booking_mode: String(fd.get('booking_mode') || '').trim(),
      owner_partner_id: Core.normalizeUuid(form.elements.owner_partner_id?.value) || null,
      ...(hasContentControl ? {
        guest_instructions_i18n: readI18n(fd, 'guest_instructions'),
        check_in_instructions_i18n: readI18n(fd, 'check_in_instructions'),
        check_out_instructions_i18n: readI18n(fd, 'check_out_instructions'),
        internal_operational_notes: String(fd.get('internal_operational_notes') || '').trim() || null,
      } : {}),
      amenities: fd.getAll('property_amenity'),
    };
    if (!Core.i18nText(after.title_i18n, 'en')) return toast('English property name is required.', 'error');
    if (!after.city) return toast('City is required.', 'error');
    if (after.country !== before.country && !after.country) return toast('Country cannot be cleared without a reviewed replacement.', 'error');
    if (!/^[A-Z]{3}$/.test(after.currency)) return toast('Currency must be a three-letter code.', 'error');
    if (!Core.BOOKING_MODES.includes(after.booking_mode)) return toast('Booking mode is invalid.', 'error');
    if (after.latitude != null && (after.latitude < -90 || after.latitude > 90)) return toast('Latitude must be between -90 and 90.', 'error');
    if (after.longitude != null && (after.longitude < -180 || after.longitude > 180)) return toast('Longitude must be between -180 and 180.', 'error');
    if (after.google_maps_url && after.google_maps_url !== before.google_maps_url) {
      try {
        const mapsUrl = new URL(after.google_maps_url);
        const host = mapsUrl.hostname.toLowerCase().replace(/^www\./, '');
        const googleHost = host.replace(/^maps\./, '');
        const supported = mapsUrl.protocol === 'https:' && !mapsUrl.username && !mapsUrl.password && !mapsUrl.port && (
          (host === 'maps.app.goo.gl' && mapsUrl.pathname !== '/')
          || (host === 'goo.gl' && /^\/maps(?:\/|$)/.test(mapsUrl.pathname))
          || (/^google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(googleHost)
            && (host.startsWith('maps.google.') || /^\/maps(?:\/|$)/.test(mapsUrl.pathname)))
        );
        if (!supported) throw new Error('Unsupported Google Maps host');
      } catch (_error) { return toast('Google Maps URL must use a supported Google Maps domain.', 'error'); }
    }
    if (after.timezone !== before.timezone) {
      if (!after.timezone) return toast('Timezone cannot be cleared without a reviewed replacement.', 'error');
      try { new Intl.DateTimeFormat('en', { timeZone: after.timezone }).format(); }
      catch (_error) { return toast('Timezone must be a valid IANA timezone such as Europe/Nicosia.', 'error'); }
    }
    if (after.minimum_stay_nights != null && (!Number.isInteger(after.minimum_stay_nights) || after.minimum_stay_nights < 1 || after.minimum_stay_nights > 365)) return toast('Minimum stay must be a whole number from 1 to 365.', 'error');
    if (after.maximum_stay_nights != null && (!Number.isInteger(after.maximum_stay_nights) || after.maximum_stay_nights < 1 || after.maximum_stay_nights > 365)) return toast('Maximum stay must be a whole number from 1 to 365.', 'error');
    if (after.minimum_stay_nights != null && after.maximum_stay_nights != null && after.maximum_stay_nights < after.minimum_stay_nights) return toast('Maximum stay cannot be shorter than minimum stay.', 'error');
    try {
      await openReview(propertyControlReviewOptions(state.workspace, state.contentControl, after));
    } catch (error) {
      toast(error?.userMessage || error?.message || 'Property changes could not be prepared for Review.', 'error');
    }
  }

  function pricingPromotionRoomLabel(preview, roomTypeId) {
    const room = Core.asArray(preview?.target?.rooms).find((entry) => (
      Core.normalizeUuid(entry?.id || entry?.room_type_id) === Core.normalizeUuid(roomTypeId)
    ));
    if (room) return Core.i18nText(room.name_i18n || room.name, 'en', room.code || roomTypeId);
    const workspaceRoom = state.workspace?.room_types?.find((entry) => entry.id === Core.normalizeUuid(roomTypeId));
    return Core.i18nText(workspaceRoom?.name_i18n, 'en', workspaceRoom?.code || roomTypeId);
  }

  function pricingPromotionFingerprint(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value || 'Missing')}</code></dd></div>`;
  }

  function pricingPromotionTierRows(tiers, currency) {
    return Core.asArray(tiers).map((tier) => `<tr>
      <td>${Number(tier.guest_count)}</td><td>${Number(tier.threshold_nights)}</td>
      <td>${escapeHtml(formatMoney(tier.nightly_rate, currency))}</td>
    </tr>`).join('');
  }

  function pricingPromotionAllocationRows(preview) {
    return preview.allocation_previews.flatMap((entry) => entry.options.map((option, optionIndex) => {
      const resolved = option.nightly_comparisons[0] || {};
      const allocation = option.allocation.map((item) => {
        const room = pricingPromotionRoomLabel(preview, item.room_type_id);
        const physical = item.allocated_guest_count == null ? resolved.requested_guest_count : item.allocated_guest_count;
        const pricing = item.pricing_guest_count == null ? resolved.priced_occupancy : item.pricing_guest_count;
        return `${room}: ${physical} physical → ${pricing} pricing`;
      }).join(' + ');
      return `<tr><td>${entry.guest_count}</td><td>${escapeHtml(entry.allocation_mode === 'customer_choice' ? `Customer choice ${optionIndex + 1}` : 'Required bundle')}</td><td>${escapeHtml(allocation)}</td></tr>`;
    })).join('');
  }

  function pricingPromotionComparisonRows(preview) {
    return preview.allocation_previews.flatMap((entry) => entry.options.flatMap((option, optionIndex) => (
      option.nightly_comparisons.map((comparison) => {
        const roomRates = comparison.room_nightly_rates.map((rate) => formatMoney(
          rate && typeof rate === 'object' ? rate.nightly_rate : rate,
          comparison.currency,
        )).join(' + ');
        const delta = Number(comparison.room_rate_sum) - Number(comparison.legacy_nightly_rate);
        return `<tr><td>${entry.guest_count}</td><td>${entry.allocation_mode === 'customer_choice' ? optionIndex + 1 : 'Bundle'}</td><td>${comparison.nights}</td><td>${escapeHtml(roomRates)}</td><td>${escapeHtml(formatMoney(comparison.room_rate_sum, comparison.currency))}</td><td>${escapeHtml(formatMoney(comparison.legacy_nightly_rate, comparison.currency))}</td><td class="${Math.abs(delta) < 0.000001 ? 'is-zero' : 'is-mismatch'}">${escapeHtml(formatMoney(delta, comparison.currency))}</td></tr>`;
      })
    ))).join('');
  }

  function pricingPromotionTargetSummary(preview) {
    const plan = Core.asObject(preview.target.rate_plan);
    const schedule = preview.target.room_schedule;
    const planName = Core.i18nText(plan.name_i18n || plan.name, 'en', plan.code || 'Standard');
    return `<div class="hotel-pricing-promotion-target">
      <section><span>Rate Plan</span><strong>${escapeHtml(planName)}</strong><small>${plan.is_active === true ? 'ACTIVE — unsafe for this checkpoint' : 'Inactive shadow product'}</small></section>
      ${preview.target.room_rates.map((rate) => `<section><span>Room Rate</span><strong>${escapeHtml(pricingPromotionRoomLabel(preview, rate.room_type_id))} · ${escapeHtml(planName)}</strong><small>${rate.is_active === true ? 'ACTIVE — unsafe for this checkpoint' : 'Inactive shadow product'}</small></section>`).join('')}
      <section><span>Shared Room schedule</span><strong>${schedule.tier_count} occupancy × LOS tiers</strong><small>${escapeHtml(schedule.review_status)} · ${schedule.is_active ? 'active' : 'inactive'}</small></section>
    </div><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(plan.id || '')}</code>${preview.target.room_rates.map((rate) => `<code>${escapeHtml(rate.id || '')}</code>`).join('')}<code>${escapeHtml(schedule.id || '')}</code></details>`;
  }

  function pricingPromotionDetailsMarkup(preview, options = {}) {
    const schedule = preview.target.room_schedule;
    const flags = ['hotel_rooms_v2_enabled', 'hotel_external_sync_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    const statusBefore = Core.asText(schedule.review_status) || 'requires_review';
    const notice = options.notice
      ? `<p class="hotel-pricing-promotion-notice" role="status">${escapeHtml(options.notice)}</p>`
      : '';
    return `<div class="hotel-pricing-promotion-review" data-legacy-pricing-promotion-preview>
      ${notice}
      <section class="hotel-review-summary hotel-pricing-promotion-summary">
        <p>This Admin-only preparation reviews the exact legacy source and its inert normalized pricing representation. It does not copy browser-supplied prices or change public Hotel behavior.</p>
        <dl><div><dt>Property</dt><dd>Exact reviewed Hotel</dd></div><div><dt>Legacy rules</dt><dd data-pricing-source-rule-count="${preview.source.rule_count}">${preview.source.rule_count}</dd></div><div><dt>Room tiers</dt><dd data-pricing-target-tier-count="${schedule.tier_count}">${schedule.tier_count}</dd></div><div><dt>Parity cases</dt><dd>${preview.parity.total_case_count}</dd></div><div><dt>Parity mismatches</dt><dd data-pricing-parity-mismatch-count="${preview.parity.total_mismatch_count}">${preview.parity.total_mismatch_count}</dd></div><div><dt>Public change</dt><dd>${preview.public_change ? 'YES — BLOCKED' : 'No'}</dd></div></dl><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(preview.hotel_id)}</code></details>
      </section>
      <section class="hotel-pricing-promotion-section"><header><div><span class="hotel-workspace-eyebrow">Current authoritative source</span><h4>Legacy property pricing · ${preview.source.rule_count} rules</h4></div><span class="hotel-workspace-status hotel-workspace-status--warning">UNCHANGED</span></header>
        <p>Pricing model: <strong>${escapeHtml(preview.source.pricing_model || 'legacy tiers')}</strong> · currency ${escapeHtml(preview.source.currency)}. The source remains authoritative while architecture is legacy.</p>
        <dl class="hotel-pricing-promotion-fingerprints">${pricingPromotionFingerprint('Legacy pricing fingerprint', preview.source.pricing_fingerprint)}${pricingPromotionFingerprint('Legacy tier fingerprint', preview.source.tier_fingerprint)}${pricingPromotionFingerprint('63-tier property-party preview', preview.source.property_party_preview.tier_fingerprint)}</dl>
        <details><summary>Inspect all ${preview.source.rule_count} legacy rules</summary><div class="hotel-pricing-promotion-table-wrap"><table><thead><tr><th>Guests</th><th>From nights</th><th>Nightly rate</th></tr></thead><tbody>${pricingPromotionTierRows(preview.source.tiers, preview.source.currency)}</tbody></table></div></details>
      </section>
      <section class="hotel-pricing-promotion-section"><header><div><span class="hotel-workspace-eyebrow">Prepared normalized target</span><h4>Standard plan · two Room Rates · ${schedule.tier_count} shared tiers</h4></div><span class="hotel-workspace-status hotel-workspace-status--warning">INACTIVE</span></header>
        ${pricingPromotionTargetSummary(preview)}
        <dl class="hotel-pricing-promotion-fingerprints">${pricingPromotionFingerprint('Room tier fingerprint', schedule.tier_fingerprint)}${pricingPromotionFingerprint('Allocation fingerprint', preview.target.allocation_fingerprint)}${pricingPromotionFingerprint('Pricing occupancy mapping', preview.pricing_occupancy_mapping_fingerprint)}${pricingPromotionFingerprint('70-case parity replay', preview.parity.fingerprint)}${pricingPromotionFingerprint('Target fingerprint', preview.target.target_fingerprint)}</dl>
        <details><summary>Inspect all ${schedule.tier_count} shared Room tiers</summary><div class="hotel-pricing-promotion-table-wrap"><table><thead><tr><th>Pricing occupancy</th><th>From nights</th><th>Nightly rate</th></tr></thead><tbody>${pricingPromotionTierRows(schedule.tiers, schedule.currency)}</tbody></table></div></details>
      </section>
      <section class="hotel-pricing-promotion-section" data-pricing-allocation-preview><header><div><span class="hotel-workspace-eyebrow">Physical allocation ≠ pricing occupancy</span><h4>Reviewed guest mapping</h4></div><span class="hotel-workspace-status hotel-workspace-status--success">ZERO MISMATCH</span></header>
        <p>Physical guests describe who sleeps in each apartment. Pricing occupancy selects an existing 2–4 guest Room tier. One guest uses the real two-guest tier; no one-person price is fabricated.</p>
        <div class="hotel-pricing-promotion-table-wrap"><table><thead><tr><th>Party</th><th>Allocation</th><th>Exact reviewed mapping</th></tr></thead><tbody>${pricingPromotionAllocationRows(preview)}</tbody></table></div>
        <details><summary>Inspect authoritative nightly replay</summary><div class="hotel-pricing-promotion-table-wrap"><table><thead><tr><th>Party</th><th>Option</th><th>Nights</th><th>Room rates</th><th>Room sum</th><th>Legacy</th><th>Delta</th></tr></thead><tbody>${pricingPromotionComparisonRows(preview)}</tbody></table></div></details>
      </section>
      <section class="hotel-pricing-promotion-section"><header><div><span class="hotel-workspace-eyebrow">Before → after</span><h4>Reviewed normalized fields only</h4></div></header><div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>
        <tr><th>5 guests · physical 3+2</th><td>Pricing occupancy: NULL / current exact snapshot</td><td>Pricing occupancy: 2+2</td></tr><tr><th>6 guests · physical 3+3</th><td>Pricing occupancy: NULL / current exact snapshot</td><td>Pricing occupancy: 3+3</td></tr><tr><th>7 guests · physical 4+3</th><td>Pricing occupancy: NULL / current exact snapshot</td><td>Pricing occupancy: 4+4</td></tr><tr><th>8 guests · physical 4+4</th><td>Pricing occupancy: NULL / current exact snapshot</td><td>Pricing occupancy: 4+4</td></tr><tr><th>Physical guest allocation</th><td>5: 3+2 · 6: 3+3 · 7: 4+3 · 8: 4+4</td><td>Unchanged</td></tr><tr><th>Room schedule review status</th><td>${escapeHtml(statusBefore)}</td><td>reviewed</td></tr><tr><th>Room schedule active</th><td>${schedule.is_active ? 'Yes' : 'No'}</td><td>${schedule.is_active ? 'Yes' : 'No'} · unchanged</td></tr><tr><th>Rate Plan active</th><td>No</td><td>No · unchanged</td></tr><tr><th>Two Room Rates active</th><td>No</td><td>No · unchanged</td></tr><tr><th>Legacy pricing</th><td>Authoritative</td><td>Authoritative · unchanged</td></tr><tr><th>Architecture</th><td>${escapeHtml(preview.property.architecture_version)}</td><td>${escapeHtml(preview.property.architecture_version)} · unchanged</td></tr><tr><th>Public change</th><td>No</td><td>No</td></tr>
      </tbody></table></div></section>
      <section class="hotel-pricing-promotion-section hotel-pricing-promotion-safety"><header><div><span class="hotel-workspace-eyebrow">Safety guard</span><h4>Public runtime remains inert</h4></div></header><ul>${flags.map((flag) => `<li><span>${escapeHtml(flag)}</span><strong>${preview.flags[flag] === false ? 'OFF' : 'NOT OFF — BLOCKED'}</strong></li>`).join('')}</ul><p>Legacy pricing, public pages, booking payloads, bookings and fulfillments are not mutation targets.</p></section>
    </div>`;
  }

  async function refreshLegacyPricingPromotionPreview() {
    const preview = await Repository.getLegacyPricingPromotionPreview(state.workspace.property.id);
    state.pricingPromotionPreview = preview;
    state.pricingPromotionError = null;
    return preview;
  }

  function pricingPromotionConflictMessage(conflicts) {
    const labels = Core.asArray(conflicts).map((field) => String(field).replaceAll('_', ' '));
    return `The exact legacy source or prepared pricing mapping changed after this review opened: ${labels.join(', ')}. Fresh values are shown; acknowledge and review them again.`;
  }

  async function openLegacyPricingPromotionPreparation(options = {}) {
    if (state.workspace?.property?.id !== Core.SEVEN_ARCHES_PROPERTY_ID) {
      toast('This reviewed pricing preparation is restricted to the exact 7 Kamares property.', 'error');
      return;
    }
    let preview;
    try {
      preview = options.preview
        ? Core.validateLegacyPricingPromotionPreview(options.preview)
        : await refreshLegacyPricingPromotionPreview();
    } catch (error) {
      state.pricingPromotionError = error;
      toast(error?.userMessage || error?.message || 'Legacy pricing preparation could not be loaded.', 'error');
      return;
    }
    const alreadyReviewed = preview.target.room_schedule.review_status === 'reviewed';
    openModal({
      title: alreadyReviewed ? 'Reviewed legacy → H3 pricing mapping' : 'Prepare legacy → H3 pricing Review',
      className: 'hotel-workspace-modal--wide hotel-pricing-promotion-modal',
      body: `${pricingPromotionDetailsMarkup(preview, { notice: options.notice })}${alreadyReviewed ? '' : `<label class="hotel-pricing-promotion-ack"><input type="checkbox" data-pricing-occupancy-ack /><span><strong>I reviewed the physical allocation and Pricing occupancy mapping.</strong><small>I understand that pricing occupancy can differ from physical guests only to select existing tiers and preserve the accepted legacy total.</small></span></label>`}`,
      footer: alreadyReviewed
        ? '<button class="btn-secondary" type="button" data-hotel-modal-close>Close</button>'
        : '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="button" data-pricing-promotion-review disabled>Build final Review</button>',
      onReady(overlay) {
        if (alreadyReviewed) return;
        const acknowledge = overlay.querySelector('[data-pricing-occupancy-ack]');
        const reviewButton = overlay.querySelector('[data-pricing-promotion-review]');
        acknowledge?.addEventListener('change', () => { reviewButton.disabled = !acknowledge.checked; });
        reviewButton?.addEventListener('click', async () => {
          if (!acknowledge.checked) return;
          reviewButton.disabled = true;
          reviewButton.textContent = 'Refreshing exact fingerprints…';
          try {
            const fresh = await refreshLegacyPricingPromotionPreview();
            const reconciliation = Core.reconcileLegacyPricingPromotion(preview, fresh);
            closeModal({ restoreFocus: false, skipCleanup: true });
            if (!reconciliation.safe) {
              await openLegacyPricingPromotionPreparation({
                preview: fresh,
                notice: pricingPromotionConflictMessage(reconciliation.conflicts),
              });
              return;
            }
            openLegacyPricingPromotionFinalReview(fresh, { acknowledged: true });
          } catch (error) {
            reviewButton.disabled = false;
            reviewButton.textContent = 'Build final Review';
            toast(error?.userMessage || error?.message || 'Fresh pricing Review could not be prepared.', 'error');
          }
        });
      },
    });
  }

  function openLegacyPricingPromotionFinalReview(previewValue, options = {}) {
    const preview = Core.validateLegacyPricingPromotionPreview(previewValue);
    if (preview.target.room_schedule.review_status === 'reviewed') {
      void openLegacyPricingPromotionPreparation({ preview, notice: options.notice });
      return;
    }
    const plan = Core.buildLegacyPricingPromotionPlan(preview, options.acknowledged === true);
    openModal({
      title: options.notice ? 'Review fresh 7 Kamares pricing values' : 'Final Review · legacy → H3 pricing',
      className: 'hotel-workspace-modal--wide hotel-pricing-promotion-modal',
      body: `${pricingPromotionDetailsMarkup(preview, { notice: options.notice })}<label class="hotel-pricing-promotion-ack"><input type="checkbox" data-pricing-occupancy-ack ${options.acknowledged ? 'checked' : ''} /><span><strong>I confirm this exact physical-allocation and Pricing occupancy mapping.</strong><small>Save stores the reviewed bundle pricing occupancies and marks the inactive Room schedule reviewed. No mutation is retried automatically after a stale response.</small></span></label>`,
      footer: '<button class="btn-secondary" type="button" data-pricing-promotion-back>Back</button><button class="btn-primary" type="button" data-pricing-promotion-save>Save reviewed pricing preparation</button>',
      onReady(overlay) {
        const acknowledge = overlay.querySelector('[data-pricing-occupancy-ack]');
        const saveButton = overlay.querySelector('[data-pricing-promotion-save]');
        saveButton.disabled = !acknowledge.checked;
        acknowledge.addEventListener('change', () => { saveButton.disabled = !acknowledge.checked; });
        overlay.querySelector('[data-pricing-promotion-back]')?.addEventListener('click', () => {
          closeModal({ restoreFocus: false, skipCleanup: true });
          void openLegacyPricingPromotionPreparation({ preview });
        });
        saveButton.addEventListener('click', async () => {
          if (!acknowledge.checked) return;
          saveButton.disabled = true;
          saveButton.textContent = 'Saving reviewed preparation…';
          setModalSaving(overlay, true);
          try {
            await Repository.applyLegacyPricingPromotion(plan);
            const [workspace, configuration, savedPreview] = await Promise.all([
              Repository.getWorkspace(preview.hotel_id),
              Repository.getH3Configuration(preview.hotel_id),
              Repository.getLegacyPricingPromotionPreview(preview.hotel_id),
            ]);
            state.workspace = workspace;
            state.h3Configuration = configuration;
            state.h3ConfigurationError = null;
            state.pricingPromotionPreview = savedPreview;
            state.pricingPromotionError = null;
            closeModal({ restoreFocus: false, skipCleanup: true, force: true });
            renderWorkspace();
            toast('Legacy pricing preparation reviewed. All pricing products remain inactive and public behavior is unchanged.', 'success');
          } catch (error) {
            if (error?.isStale) {
              try {
                const fresh = await refreshLegacyPricingPromotionPreview();
                const reconciliation = Core.reconcileLegacyPricingPromotion(preview, fresh);
                setModalSaving(overlay, false);
                closeModal({ restoreFocus: false, skipCleanup: true, force: true });
                if (reconciliation.safe) {
                  openLegacyPricingPromotionFinalReview(fresh, {
                    acknowledged: true,
                    notice: 'The stale Save was stopped. Fresh exact versions and fingerprints are shown. Nothing was retried; inspect this Review and click Save explicitly again.',
                  });
                } else {
                  void openLegacyPricingPromotionPreparation({
                    preview: fresh,
                    notice: pricingPromotionConflictMessage(reconciliation.conflicts),
                  });
                }
                toast('Stale pricing Save stopped safely. Fresh values require an explicit new Review and Save.', 'warning');
                return;
              } catch (refreshError) {
                error = refreshError;
              }
            }
            setModalSaving(overlay, false);
            saveButton.disabled = false;
            saveButton.textContent = 'Save reviewed pricing preparation';
            toast(error?.userMessage || error?.message || 'Reviewed pricing preparation was rejected. No partial save was kept.', error?.isAmbiguousOutcome ? 'warning' : 'error');
          }
        });
      },
    });
  }

  function pricingPromotionWorkspaceState() {
    if (state.workspace?.property?.id !== Core.SEVEN_ARCHES_PROPERTY_ID) return null;
    if (!state.pricingPromotionPreview) return {
      available: false,
      error: state.pricingPromotionError,
      schedule: null,
      reviewStatus: 'unavailable',
      reviewed: false,
      tierCount: 0,
    };
    const previewSchedule = state.pricingPromotionPreview.target.room_schedule;
    const schedule = state.workspace.pricing_schedules.find((entry) => (
      Core.normalizeUuid(entry?.id) === Core.SEVEN_ARCHES_SHADOW_IDS.pricing_schedule
    ));
    const reviewStatus = Core.asText(previewSchedule?.review_status || schedule?.review_status) || 'requires_review';
    return {
      available: true,
      schedule,
      reviewStatus,
      reviewed: reviewStatus === 'reviewed',
      tierCount: Number(previewSchedule?.tier_count || 0),
    };
  }

  function pricingPromotionCardMarkup() {
    const pricingState = pricingPromotionWorkspaceState();
    if (!pricingState) return '';
    if (!pricingState.available) {
      return `<section class="hotel-workspace-card hotel-pricing-promotion-card" data-seven-kamares-pricing-promotion-card>
        <header><div><span class="hotel-workspace-eyebrow">H3.1 pricing preparation</span><h4>Legacy pricing Review unavailable</h4></div><span class="hotel-workspace-status hotel-workspace-status--warning">FAIL CLOSED</span></header>
        <p>${escapeHtml(pricingState.error?.isFoundationMissing ? 'Apply and verify the approved pricing-promotion database contract before exposing this Admin action.' : (pricingState.error?.userMessage || pricingState.error?.message || 'The exact server preview could not be validated.'))}</p>
      </section>`;
    }
    const status = pricingState.reviewed ? 'REVIEWED' : 'REVIEW REQUIRED';
    const tone = pricingState.reviewed ? 'success' : 'warning';
    const action = pricingState.reviewed ? 'View pricing mapping' : 'Review legacy → H3 pricing';
    return `<section class="hotel-workspace-card hotel-pricing-promotion-card" data-seven-kamares-pricing-promotion-card>
      <header><div><span class="hotel-workspace-eyebrow">Legacy → H3 pricing preparation</span><h4>63 legacy rules → 27 shared Room tiers</h4></div><span class="hotel-workspace-status hotel-workspace-status--${tone}">${status}</span></header>
      <p>Review the exact Standard plan, two inactive Room Rates, physical room allocation and separate pricing occupancy used to preserve all accepted 7 Kamares totals.</p>
      <dl><div><dt>Legacy source</dt><dd>63 rules · authoritative</dd></div><div><dt>Room schedule</dt><dd>${pricingState.tierCount || 27} tiers · inactive</dd></div><div><dt>Public change</dt><dd>No</dd></div></dl>
      <button class="${pricingState.reviewed ? 'btn-secondary' : 'btn-primary'}" type="button" data-review-seven-kamares-pricing>${action}</button>
    </section>`;
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
      ${pricingPromotionCardMarkup()}
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
    panel.querySelector('[data-review-seven-kamares-pricing]')?.addEventListener('click', openLegacyPricingPromotionPreparation);
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
    const floorLabel = Core.i18nText(room.floor_label_i18n, 'en', 'Floor not specified');
    const outdoorLabels = [
      room.amenities.includes('balcony') ? 'Balcony' : '',
      room.amenities.includes('terrace') ? 'Terrace' : '',
    ].filter(Boolean);
    let childPolicy;
    try {
      const resolved = Core.resolveChildrenPolicy(state.workspace.property, room);
      childPolicy = `${childPolicyText(resolved.policy, resolved.minimum_age)} · ${resolved.source === 'property' ? 'property default' : 'room override'}`;
    } catch (_error) {
      childPolicy = 'Children policy not reviewed';
    }
    return `<article class="hotel-room-card" data-room-id="${escapeAttr(room.id)}">
      <header><div><span class="hotel-workspace-eyebrow">${escapeHtml(room.code)}</span><h4>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</h4><p>${escapeHtml(capacityLabel)} · ${escapeHtml(inventoryLabel)}</p></div><span class="hotel-workspace-status hotel-workspace-status--${statusTone(room.status === 'active' ? 'READY' : room.status === 'disabled' ? 'BLOCKED' : 'DRAFT')}">${escapeHtml(room.status.toUpperCase())}</span></header>
      <div class="hotel-room-card__details"><span>${escapeHtml(Core.formatBedConfiguration(room.bed_configuration))}</span><span>${room.bathrooms == null ? 'Bathrooms not specified' : `${room.bathrooms} bathroom(s)`}</span><span>${room.size_sqm == null ? 'Size not specified' : `${room.size_sqm} m²`}</span><span>${escapeHtml(floorLabel)}</span><span>${escapeHtml(outdoorLabels.join(' · ') || 'No balcony/terrace configured')}</span><span>${room.gallery.length} photo${room.gallery.length === 1 ? '' : 's'}</span></div>
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

  function reviewFieldLabel(value) {
    return String(value || 'value').replaceAll('_', ' ').replace(/\bi18n\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  function reviewValueMarkup(value, field = '', depth = 0) {
    if (value == null || value === '') return '<span class="hotel-review-empty">Not specified</span>';
    if (typeof value === 'boolean') return `<span>${value ? 'Yes' : 'No'}</span>`;
    if (typeof value === 'number') return `<span>${escapeHtml(value)}</span>`;
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value) && /(gallery|photo|image|cover)/i.test(field)) {
        return `<span class="hotel-review-media-value"><img src="${escapeAttr(value)}" alt="" loading="lazy" /><span>${escapeHtml(mediaFileLabel(value))}</span></span>`;
      }
      return `<span dir="auto">${escapeHtml(value)}</span>`;
    }
    if (Array.isArray(value)) {
      if (!value.length) return '<span class="hotel-review-empty">None</span>';
      if (value.every((entry) => typeof entry === 'string' && /^https?:\/\//i.test(entry))) {
        return `<div class="hotel-review-media-list">${value.map((url, index) => `<figure><img src="${escapeAttr(url)}" alt="Reviewed image ${index + 1}" loading="lazy" /><figcaption>${index + 1}. ${escapeHtml(mediaFileLabel(url))}</figcaption></figure>`).join('')}</div>`;
      }
      return `<ol class="hotel-review-value-list">${value.map((entry) => `<li>${reviewValueMarkup(entry, field, depth + 1)}</li>`).join('')}</ol>`;
    }
    const entries = Object.entries(Core.asObject(value)).filter(([key]) => !['created_at', 'updated_at', 'version'].includes(key));
    if (!entries.length) return '<span class="hotel-review-empty">None</span>';
    return `<dl class="hotel-review-value-map">${entries.map(([key, item]) => `<div><dt>${escapeHtml(reviewFieldLabel(key).toUpperCase())}</dt><dd>${reviewValueMarkup(item, `${field}.${key}`, depth + 1)}</dd></div>`).join('')}</dl>`;
  }

  function reviewDiagnosticsMarkup(entries) {
    return Core.asArray(entries).map((entry) => {
      const raw = entry?.values ?? entry?.value;
      const values = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
      return `<div><span>${escapeHtml(entry?.label || 'Value')}</span>${values.map((value) => `<code>${escapeHtml(value)}</code>`).join('') || '<code>None</code>'}</div>`;
    }).join('');
  }

  async function applyReviewedOperations(operations, options = {}) {
    const reviewedOperations = Core.asArray(operations);
    const isExactRoomTypeSave = reviewedOperations.length === 1 && reviewedOperations[0]?.entity === 'room_type';
    const isPropertyControlSave = reviewedOperations.length === 1 && reviewedOperations[0]?.entity === 'property';
    const plan = isExactRoomTypeSave
      ? Core.buildRoomTypePlan(state.workspace, reviewedOperations[0])
      : isPropertyControlSave
        ? Core.buildPropertyControlPlan(state.workspace, {
          ...propertyControlView(),
          ...Core.asObject(reviewedOperations[0]?.payload),
        }, {
          currentProperty: propertyControlView(),
          expectedOperationalProfileVersion: Number(state.contentControl?.operational_profile?.version),
        })
        : Core.buildWorkspacePlan(state.workspace, reviewedOperations);
    const result = isExactRoomTypeSave
      ? await Repository.applyRoomControlPlan(plan)
      : isPropertyControlSave
        ? await Repository.applyPropertyControlPlan(plan)
        : await Repository.applyWorkspacePlan(plan);
    state.workspace = result.workspace;
    if (isPropertyControlSave) {
      state.contentControl = result.content_control;
      state.contentControlError = null;
    }
    closeModal({ restoreFocus: false, skipCleanup: true, force: true });
    renderWorkspace();
    void loadPropertyList().catch(() => {});
    toast(options.successMessage || 'Reviewed Property Workspace changes saved.', 'success');
    return result;
  }

  async function openReview({ title, entity, before, after, operation, operations, onConfirm, onCancel, onApplyError, onStaleReview, onAmbiguousReview, closeOnApplyError = false, successMessage, contextMessage = '', diagnostics = [] }) {
    const reviewedOperations = Array.isArray(operations) ? operations : [operation];
    const rows = Core.buildReviewRows(entity, before, after);
    if (!rows.length) {
      toast('There are no changes to review.', 'info');
      return false;
    }
    state.pendingReview = { reviewedOperations };
    openModal({
      title,
      className: 'hotel-workspace-modal--review',
      body: `<div class="hotel-review-summary"><p>One atomic exact-property operation will be applied only after all version and relationship checks pass.</p><dl><div><dt>Property</dt><dd>${escapeHtml(propertyTitle(state.workspace.property))}</dd></div><div><dt>Entity</dt><dd>${escapeHtml(entity.replaceAll('_', ' '))}</dd></div><div><dt>Changes</dt><dd>${rows.length}</dd></div></dl><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(state.workspace.property.id)}</code>${reviewDiagnosticsMarkup(diagnostics)}</details></div>
        ${contextMessage ? `<p class="hotel-workspace-safety-note">${escapeHtml(contextMessage)}</p>` : ''}
        <div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(reviewFieldLabel(row.field))}</th><td>${reviewValueMarkup(row.before, row.field)}</td><td>${reviewValueMarkup(row.after, row.field)}</td></tr>`).join('') || '<tr><td colspan="3">The exact reviewed operation has no semantic field diff.</td></tr>'}</tbody></table></div>
        <p class="hotel-workspace-safety-note">Public Hotels V2 remains disabled. This save does not publish, convert, book or alter historical rows.</p>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Back</button><button class="btn-primary" type="button" data-hotel-review-confirm>Save reviewed changes</button>',
      onClose: onCancel,
      onReady(overlay) {
        let ambiguousPending = false;
        const reconcileAmbiguousOutcome = async (button) => {
          if (typeof onAmbiguousReview !== 'function') return false;
          try {
            const resolution = await onAmbiguousReview();
            if (resolution?.matched) {
              if (resolution.workspace) state.workspace = resolution.workspace;
              if (resolution.content_control) {
                state.contentControl = resolution.content_control;
                state.contentControlError = null;
              }
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              renderWorkspace();
              void loadPropertyList().catch(() => {});
              toast(resolution.message || 'The current database state matches the reviewed changes. No mutation was retried.', 'success');
              return true;
            }
            if (resolution?.review) {
              closeModal({ restoreFocus: false, skipCleanup: true, force: true });
              await openReview(resolution.review);
              toast('The interrupted save did not reach the reviewed target. Fresh values are ready for one explicit Save; nothing was retried automatically.', 'warning');
              return true;
            }
          } catch (recoveryError) {
            if (recoveryError?.closeReviewAfterStale === true) throw recoveryError;
            ambiguousPending = true;
            overlay.hotelWorkspaceOnClose = null;
            // The original write outcome is still unknown. Keep the Review
            // non-dismissible so its closure remains the only recoverable
            // reference to newly uploaded objects. The sole enabled action is
            // a read-only reconciliation check; it never resends the plan.
            setModalSaving(overlay, true);
            button.disabled = false;
            button.textContent = 'Check current state';
            toast('The save result and current database state could not yet be confirmed. Uploaded media remains preserved. Use “Check current state”; no mutation will be retried.', 'warning');
            return true;
          }
          return false;
        };
        overlay.querySelector('[data-hotel-review-confirm]')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = ambiguousPending ? 'Checking…' : 'Saving…';
          setModalSaving(overlay, true);
          try {
            if (ambiguousPending) {
              await reconcileAmbiguousOutcome(button);
              return;
            }
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
            if (failure?.isAmbiguousOutcome && typeof onAmbiguousReview === 'function') {
              try {
                if (await reconcileAmbiguousOutcome(button)) return;
              } catch (recoveryConflict) {
                failure = recoveryConflict;
              }
            }
            // A controlled Room conflict hands the same reviewed media draft
            // to an explicit conflict-resolution screen. Cleanup happens only
            // if Admin keeps current/cancels or a later terminal save rejects;
            // deleting now would leave the fresh Review pointing at removed
            // objects.
            if (!failure?.isAmbiguousOutcome && !failure?.openRoomControlConflict && !failure?.openPropertyControlConflict) {
              try { await onApplyError?.(failure); } catch (cleanupError) { console.error('Failed to clean up reviewed Hotel media upload:', cleanupError); }
            }
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
              } else if (failure.openRoomControlConflict) {
                openRoomControlConflict(failure.openRoomControlConflict);
              } else if (failure.openPropertyControlConflict) {
                openPropertyControlConflict(failure.openPropertyControlConflict);
              } else if (failure.openOperationalAssignmentConflict) {
                operationalAssignmentConflict(failure.openOperationalAssignmentConflict);
              } else if (failure.reopenSevenArchesPreparation) {
                openSevenArchesPreparation(failure.reopenSevenArchesPreparation);
              }
              toast(failure.userMessage || failure.message, failure.openSevenArchesConflictReview ? 'warning' : 'error');
              return;
            }
            setModalSaving(overlay, false);
            if (closeOnApplyError && !failure?.isAmbiguousOutcome) closeModal({ restoreFocus: false, skipCleanup: true, force: true });
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
    return true;
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
          <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal slug</span><input name="slug" pattern="[a-z0-9](?:[a-z0-9]|-)*" required /></label></div>
          <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(exactId)}</code></details>
          ${i18nFields('title', 'Property name', {}, 'input', 240)}
          ${i18nFields('description', 'Property description', {}, 'textarea', 12000)}
          <div class="hotel-workspace-form-grid">
            <label class="admin-form-field"><span>City</span><input name="city" maxlength="200" required /></label>
            <label class="admin-form-field"><span>Country</span><input name="country" maxlength="100" placeholder="Enter reviewed country" required /></label>
            <label class="admin-form-field"><span>Address</span><input name="address_line" maxlength="500" /></label>
            <label class="admin-form-field"><span>Timezone</span><input name="timezone" maxlength="100" placeholder="IANA timezone, for example Europe/Nicosia" required /></label>
            <label class="admin-form-field"><span>Currency</span><input name="currency" maxlength="3" placeholder="ISO code, for example EUR" required /></label>
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
            country: String(fd.get('country') || '').trim(),
            address_line: String(fd.get('address_line') || '').trim() || null,
            timezone: String(fd.get('timezone') || '').trim(),
            currency: String(fd.get('currency') || '').trim().toUpperCase(),
          };
          let timezoneValid = false;
          try { new Intl.DateTimeFormat('en', { timeZone: payload.timezone }).format(); timezoneValid = true; } catch (_error) {}
          if (!payload.slug || !Core.i18nText(payload.title_i18n, 'en') || !payload.city || !payload.country
              || !timezoneValid || !/^[A-Z]{3}$/.test(payload.currency)) {
            toast('Slug, English name, city, country, valid IANA timezone and currency are required.', 'error');
            return;
          }
          closeModal({ restoreFocus: false });
          const before = { id: exactId, architecture_version: null, is_published: null };
          const after = { id: exactId, ...payload, architecture_version: 'rooms_v2', booking_mode: 'request_confirmation', is_published: false, status: 'draft' };
          const rows = Core.buildReviewRows('property', before, after);
          openModal({
            title: 'Review new property draft',
            body: `<div class="hotel-review-summary"><p>The property will be created as an inert Rooms V2 draft. No feature flag or public page is enabled.</p><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(exactId)}</code></details></div><div class="hotel-review-table-wrap"><table class="hotel-review-table"><tbody>${rows.map((row) => `<tr><th>${escapeHtml(reviewFieldLabel(row.field))}</th><td>${reviewValueMarkup(row.after, row.field)}</td></tr>`).join('')}</tbody></table></div>`,
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
      <label class="admin-form-field hotel-bed-other" ${type === 'other' ? '' : 'hidden'}><span>Other bed label (EN)</span><input data-bed-label value="${escapeAttr(Core.i18nText(bed.label, 'en'))}" ${type === 'other' ? '' : 'disabled'} /></label>
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

  const HOTEL_ADMIN_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
  const HOTEL_ADMIN_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

  function mediaFileLabel(url, fallback = 'Hotel image') {
    try {
      const pathname = decodeURIComponent(new URL(String(url || '')).pathname);
      return pathname.split('/').filter(Boolean).pop() || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function validateSelectedImages(files, options = {}) {
    const rows = Array.from(files || []);
    const maximum = Number(options.maximum || 30);
    if (rows.length > maximum) throw new Error(`Select no more than ${maximum} images in one reviewed save.`);
    rows.forEach((file) => {
      if (!HOTEL_ADMIN_IMAGE_TYPES.includes(String(file?.type || '').toLowerCase())) {
        throw new Error(`${file?.name || 'A selected file'} is not a supported JPEG, PNG, WebP or AVIF image.`);
      }
      if (!Number.isFinite(Number(file?.size)) || Number(file.size) <= 0 || Number(file.size) > HOTEL_ADMIN_IMAGE_MAX_BYTES) {
        throw new Error(`${file?.name || 'A selected file'} must be a non-empty image no larger than 20 MB.`);
      }
    });
    return rows;
  }

  function galleryItemMarkup(url, inputName, index) {
    return `<article class="hotel-gallery-editor__item" data-gallery-item data-gallery-url="${escapeAttr(url)}">
      <img src="${escapeAttr(url)}" alt="${escapeAttr(mediaFileLabel(url, `Hotel image ${index + 1}`))}" loading="lazy" />
      <input type="hidden" name="${escapeAttr(inputName)}" value="${escapeAttr(url)}" />
      <div class="hotel-gallery-editor__meta"><strong data-gallery-position>Image ${index + 1}</strong><small>${escapeHtml(mediaFileLabel(url))}</small></div>
      <div class="hotel-gallery-editor__actions">
        <button class="btn-secondary" type="button" data-gallery-move="-1" aria-label="Move image ${index + 1} earlier">↑</button>
        <button class="btn-secondary" type="button" data-gallery-move="1" aria-label="Move image ${index + 1} later">↓</button>
        <button class="btn-secondary hotel-danger-action" type="button" data-gallery-remove aria-pressed="false">Remove</button>
      </div>
    </article>`;
  }

  function orderedGalleryMarkup(galleryValue, inputName) {
    const gallery = Core.normalizeGallery(galleryValue);
    return `<div class="hotel-gallery-editor__ordered" data-gallery-editor>
      <div class="hotel-gallery-editor__grid" data-gallery-list>${gallery.map((url, index) => galleryItemMarkup(url, inputName, index)).join('')}</div>
      <p class="hotel-gallery-editor__empty" data-gallery-empty ${gallery.length ? 'hidden' : ''}>No images are currently attached.</p>
      <p class="hotel-gallery-editor__status" data-gallery-status role="status" aria-live="polite"></p>
    </div>`;
  }

  function bindOrderedGalleryEditor(form) {
    form.querySelectorAll('[data-gallery-editor]').forEach((editor) => {
      const list = editor.querySelector('[data-gallery-list]');
      const empty = editor.querySelector('[data-gallery-empty]');
      const status = editor.querySelector('[data-gallery-status]');
      const refresh = (message = '') => {
        const items = Array.from(list.querySelectorAll('[data-gallery-item]'));
        const retained = items.filter((item) => item.dataset.removed !== 'true');
        items.forEach((item) => {
          const retainedIndex = retained.indexOf(item);
          const removed = item.dataset.removed === 'true';
          const position = item.querySelector('[data-gallery-position]');
          if (position) position.textContent = removed ? 'Removed in this Review' : `Image ${retainedIndex + 1}`;
          item.querySelectorAll('[data-gallery-move]').forEach((button) => { button.disabled = removed; });
        });
        empty.hidden = retained.length > 0;
        status.textContent = message;
      };
      list.addEventListener('click', (event) => {
        const item = event.target.closest('[data-gallery-item]');
        if (!item) return;
        const remove = event.target.closest('[data-gallery-remove]');
        if (remove) {
          const removed = item.dataset.removed !== 'true';
          item.dataset.removed = removed ? 'true' : 'false';
          item.classList.toggle('is-removed', removed);
          item.querySelector('input[type="hidden"]').disabled = removed;
          remove.textContent = removed ? 'Restore' : 'Remove';
          remove.setAttribute('aria-pressed', removed ? 'true' : 'false');
          refresh(removed ? 'Image removed from the reviewed gallery. You can restore it before Review.' : 'Image restored.');
          return;
        }
        const move = event.target.closest('[data-gallery-move]');
        if (!move || item.dataset.removed === 'true') return;
        const direction = Number(move.dataset.galleryMove);
        const retained = Array.from(list.querySelectorAll('[data-gallery-item]')).filter((candidate) => candidate.dataset.removed !== 'true');
        const currentIndex = retained.indexOf(item);
        const target = retained[currentIndex + direction];
        if (!target) return;
        if (direction < 0) list.insertBefore(item, target);
        else list.insertBefore(target, item);
        refresh(`Image moved to position ${currentIndex + direction + 1}.`);
      });
      refresh();
    });
  }

  function bindImagePreview(form, inputName) {
    const input = form.elements[inputName];
    const preview = form.querySelector(`[data-file-preview="${inputName}"]`);
    if (!input || !preview) return () => {};
    let objectUrls = [];
    const clear = () => {
      objectUrls.forEach((url) => URL.revokeObjectURL?.(url));
      objectUrls = [];
      preview.innerHTML = '';
    };
    input.addEventListener('change', () => {
      clear();
      try {
        const files = validateSelectedImages(input.files);
        preview.innerHTML = files.map((file, index) => {
          const objectUrl = URL.createObjectURL(file);
          objectUrls.push(objectUrl);
          return `<figure><img src="${escapeAttr(objectUrl)}" alt="Preview of ${escapeAttr(file.name)}" /><figcaption>${escapeHtml(file.name)} · ${Math.ceil(file.size / 1024)} KB</figcaption></figure>`;
        }).join('');
      } catch (error) {
        input.value = '';
        toast(error.message, 'error');
      }
    });
    return clear;
  }

  function roomPropertyPhotoPicker(room) {
    const roomGallery = new Set(Core.normalizeGallery(room.gallery));
    const photos = Core.normalizeGallery(state.workspace?.property?.photos);
    if (!photos.length) return '<p class="hotel-gallery-editor__empty">This property has no shared photos to select.</p>';
    return `<details class="hotel-property-photo-picker"><summary>Select existing property photos</summary>
      <p>Only select a shared property image when it genuinely shows this exact Room Type. The property gallery remains unchanged.</p>
      <div class="hotel-legacy-photo-picker__grid">${photos.map((url, index) => `<label class="${roomGallery.has(url) ? 'is-selected' : ''}"><img src="${escapeAttr(url)}" alt="Property image ${index + 1}" loading="lazy" /><span><input type="checkbox" name="property_gallery_photo" value="${escapeAttr(url)}" ${roomGallery.has(url) ? 'checked disabled' : ''} /> ${roomGallery.has(url) ? 'Already in room gallery' : 'Add to room gallery'}</span></label>`).join('')}</div>
    </details>`;
  }

  function galleryEditorMarkup(room) {
    return `<fieldset class="hotel-gallery-editor"><legend>Room gallery</legend>
      <p>Reorder or detach exact Room Type media here. Nothing changes until the reviewed save succeeds.</p>
      ${orderedGalleryMarkup(room.gallery, 'room_gallery_url')}
      ${roomPropertyPhotoPicker(room)}
      <label class="admin-form-field"><span>Add room photos</span><input type="file" name="room_gallery_files" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" multiple ${room.created_at ? '' : 'disabled'} /></label>
      <div class="hotel-gallery-file-preview" data-file-preview="room_gallery_files"></div>
      <small>${room.created_at ? 'JPEG, PNG, WebP or AVIF · 20 MB maximum each. Images are optimized to WebP and stored under this exact Room Type ID.' : 'Create the Room Type first, then edit it to upload files to its exact ID.'}</small>
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
      <header><div><span class="hotel-workspace-eyebrow">Room ${index + 1} · exact shadow Room Type</span><h4>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</h4></div></header>
      <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(room.id)}</code></details>
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

  function roomControlReviewOptions(currentRoom, requestedRoom, options = {}) {
    const validated = Core.validateRoomType(requestedRoom, state.workspace);
    const operation = Core.operationForEntity('room_type', validated, currentRoom, options.operationType || null);
    const reviewWorkspace = Core.clone(state.workspace);
    const buildPlan = () => Core.buildRoomTypePlan(reviewWorkspace, operation);
    const correlationId = Core.newUuid();
    const reviewedRoomFields = Core.ROOM_CONTROL_BUSINESS_FIELDS.filter((field) => (
      JSON.stringify(Core.roomControlBusinessState(currentRoom)[field])
        !== JSON.stringify(Core.roomControlBusinessState(validated)[field])
    ));
    const reconcileFreshRoom = async ({ acceptMatchingTarget = false } = {}) => {
      const freshWorkspace = await Repository.getWorkspace(reviewWorkspace.property.id);
      const freshRoom = freshWorkspace.room_types.find((room) => room.id === currentRoom.id);
      state.workspace = freshWorkspace;
      if (!freshRoom) {
        const missing = new Error('The exact Room Type no longer exists in this property.');
        missing.closeReviewAfterStale = true;
        missing.isDefinitiveFailure = true;
        throw missing;
      }
      const freshBusinessState = Core.roomControlBusinessState(freshRoom);
      const targetBusinessState = Core.roomControlBusinessState(validated);
      if (acceptMatchingTarget && reviewedRoomFields.every((field) => (
        JSON.stringify(freshBusinessState[field]) === JSON.stringify(targetBusinessState[field])
      ))) {
        return {
          matched: true,
          workspace: freshWorkspace,
          message: 'The database now matches the reviewed Room Type changes. The interrupted response was reconciled without retrying the mutation.',
        };
      }
      const reconciliation = Core.reconcileRoomControl(currentRoom, freshRoom, validated);
      if (!reconciliation.safe) {
        const conflict = new Error(`Room Type fields changed concurrently: ${reconciliation.conflicts.map((item) => reviewFieldLabel(item.field)).join(', ')}.`);
        conflict.userMessage = 'A genuine Room Type conflict was stopped. Compare the original, current and requested values; nothing was saved or retried.';
        conflict.closeReviewAfterStale = true;
        conflict.openRoomControlConflict = {
          freshWorkspace,
          currentRoom: freshRoom,
          requestedRoom: validated,
          originalRoom: currentRoom,
          reconciliation,
          onCancel: options.onCancel || null,
          onApplyError: options.onApplyError || null,
          reviewOptions: {
            operationType: options.operationType || null,
            contextMessage: options.contextMessage || '',
            successMessage: options.successMessage || '',
          },
        };
        throw conflict;
      }
      return {
        review: roomControlReviewOptions(freshRoom, reconciliation.merged, {
          ...options,
          afterStale: true,
        }),
      };
    };
    return {
      title: options.afterStale ? 'Review fresh Room Type changes' : 'Review Room Type changes',
      entity: 'room_type',
      before: currentRoom,
      after: validated,
      operation,
      onCancel: options.onCancel || null,
      onApplyError: options.onApplyError || null,
      onAmbiguousReview: () => reconcileFreshRoom({ acceptMatchingTarget: true }),
      closeOnApplyError: options.closeOnApplyError === true,
      contextMessage: options.afterStale
        ? 'The previous save was stopped. This is a fresh explicit Review built from the current property and Room Type versions. Nothing was retried automatically.'
        : (options.contextMessage || 'This exact normalized Room Type changes independently from the legacy preparation wizard and public Hotel data.'),
      reReviewMessage: 'A stale Room Type save was stopped. Non-overlapping values were rebased onto the fresh exact Room Type; inspect this Review and explicitly Save again.',
      successMessage: options.successMessage || 'Room Type updated.',
      async onConfirm() {
        const result = await Repository.applyRoomControlPlan(buildPlan(), correlationId);
        state.workspace = result.workspace;
        return result;
      },
      onStaleReview: async () => (await reconcileFreshRoom()).review,
    };
  }

  function openRoomControlConflict(conflictState) {
    const {
      freshWorkspace, currentRoom, requestedRoom, originalRoom, reconciliation, onCancel, onApplyError, reviewOptions,
    } = conflictState;
    state.workspace = freshWorkspace;
    const rows = reconciliation.conflicts.map((conflict) => `<article class="hotel-room-control-conflict">
      <header><strong>${escapeHtml(reviewFieldLabel(conflict.field))}</strong><span>Concurrent edit</span></header>
      <div><section><small>Originally reviewed</small>${reviewValueMarkup(conflict.original, conflict.field)}</section><section><small>Current database value</small>${reviewValueMarkup(conflict.current, conflict.field)}</section><section><small>Your reviewed value</small>${reviewValueMarkup(conflict.requested, conflict.field)}</section></div>
    </article>`).join('');
    openModal({
      title: 'Resolve Room Type conflict',
      className: 'hotel-workspace-modal--wide hotel-workspace-modal--review',
      body: `<section class="hotel-room-control-conflicts"><div class="hotel-review-summary"><p>A real overlapping Room Type edit occurred after Review. No mutation was retried.</p><dl><div><dt>Room Type</dt><dd>${escapeHtml(Core.i18nText(currentRoom.name_i18n, 'en', currentRoom.code))}</dd></div><div><dt>Conflicting fields</dt><dd>${reconciliation.conflicts.length}</dd></div></dl></div>${rows}<p class="hotel-workspace-safety-note">Keep current discards this pending edit. “Use my reviewed values” only builds another Review against the fresh version; it does not save automatically.</p></section>`,
      footer: '<button class="btn-secondary" type="button" data-room-conflict-keep>Keep current</button><button class="btn-primary" type="button" data-room-conflict-use-reviewed>Use my reviewed values</button>',
      onClose: onCancel,
      onReady(overlay) {
        overlay.querySelector('[data-room-conflict-keep]')?.addEventListener('click', async () => {
          try { await onCancel?.(); } catch (error) { console.error('Failed to clean pending Room Type media:', error); }
          closeModal({ skipCleanup: true, force: true });
          renderWorkspace();
          toast('Current Room Type values kept. The pending edit was not saved.', 'info');
        });
        overlay.querySelector('[data-room-conflict-use-reviewed]')?.addEventListener('click', async () => {
          const requestedState = Core.roomControlBusinessState(requestedRoom);
          const originalState = Core.roomControlBusinessState(originalRoom);
          const resolved = { ...Core.clone(currentRoom) };
          Core.ROOM_CONTROL_BUSINESS_FIELDS.forEach((field) => {
            if (JSON.stringify(requestedState[field]) !== JSON.stringify(originalState[field])) {
              resolved[field] = Core.clone(requestedState[field]);
            }
          });
          closeModal({ restoreFocus: false, skipCleanup: true, force: true });
          await openReview(roomControlReviewOptions(currentRoom, resolved, {
            afterStale: true,
            onCancel,
            onApplyError,
            closeOnApplyError: Boolean(onApplyError),
            ...Core.asObject(reviewOptions),
          }));
        });
      },
    });
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
      floor_label_i18n: {},
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
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal code</span><input name="code" maxlength="80" value="${escapeAttr(room.code)}" required pattern="[a-z0-9](?:[a-z0-9_]|-)*" /></label></div>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(room.id)}</code></details>
        ${i18nFields('name', 'Room name', room.name_i18n, 'input', 240)}
        ${i18nFields('description', 'Room description', room.description_i18n, 'textarea', 12000)}
        ${i18nFields('floor_label', 'Floor / location label', room.floor_label_i18n, 'input', 160)}
        <fieldset><legend>Capacity & inventory</legend><div class="hotel-workspace-form-grid">
          <label class="admin-form-field"><span>Capacity detail</span><select name="capacity_contract"><option value="split" ${capacityContract === 'split' ? 'selected' : ''}>Adults and children confirmed</option><option value="total_only" ${capacityContract === 'total_only' ? 'selected' : ''}>Maximum total only · split not confirmed</option></select></label>
          <label class="admin-form-field" data-capacity-split><span>Adults</span><input name="capacity_adults" type="number" min="1" max="50" step="1" value="${adultsValue}" /></label>
          <label class="admin-form-field" data-capacity-split><span>Children</span><input name="capacity_children" type="number" min="0" max="50" step="1" value="${childrenValue}" /></label>
          <label class="admin-form-field" data-capacity-total><span>Maximum total guests</span><input name="max_occupancy" type="number" min="1" max="50" step="1" value="${totalValue}" /><small>Use only when the adult/child split is genuinely not confirmed.</small></label>
          <label class="admin-form-field"><span>Inventory model</span><select name="inventory_mode" required>${isLegacyPreparation ? '<option value="" selected disabled>Select after confirmation</option>' : ''}<option value="pooled" ${!isLegacyPreparation && room.inventory_mode === 'pooled' ? 'selected' : ''}>Pooled inventory</option><option value="unitized" ${!isLegacyPreparation && room.inventory_mode === 'unitized' ? 'selected' : ''}>Individual units</option></select></label>
          <label class="admin-form-field"><span>Base inventory count</span><input name="base_inventory_count" type="number" min="${isLegacyPreparation ? '1' : '0'}" max="10000" step="1" value="${inventoryValue}" ${isLegacyPreparation ? 'required' : ''} /></label>
          <label class="admin-form-field"><span>Bathrooms</span><input name="bathrooms" type="number" min="0" max="100" step="0.5" value="${escapeAttr(room.bathrooms ?? '')}" /></label>
          <label class="admin-form-field"><span>Size m²</span><input name="size_sqm" type="number" min="0.01" max="100000" step="0.01" value="${escapeAttr(room.size_sqm ?? '')}" /></label>
          ${!existing
            ? '<label class="admin-form-field"><span>Status</span><input name="status" value="draft" readonly /><small>Shadow preparation is always inert.</small></label>'
            : `<label class="admin-form-field"><span>Status</span><select name="status" required>${room.status === 'disabled' ? '<option value="" selected disabled>Disabled · choose a reviewed reactivation state</option>' : ''}${Core.ROOM_STATUSES.filter((status) => status !== 'disabled').map((status) => `<option value="${status}" ${status === room.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select><small>${room.status === 'disabled' ? 'Choose draft or active explicitly. Keeping disabled while editing is blocked; disabling always uses the dependency-aware action.' : 'Use the separate Disable action for dependency-aware removal from operation.'}</small></label>`}
          <label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" max="1000000" step="1" value="${room.sort_order}" /></label>
        </div><p class="hotel-inventory-mode-note" data-inventory-note></p></fieldset>
        <fieldset><legend>Bed configuration</legend><div data-bed-rows>${room.bed_configuration.map(bedRowMarkup).join('')}</div><button class="btn-secondary" type="button" data-add-bed>+ Add bed</button></fieldset>
        <fieldset><legend>Room amenities</legend>${isLegacyPreparation ? '<p>Property amenities are not copied. Select only amenities confirmed for this exact accommodation.</p>' : ''}<p>Balcony and terrace are exact Room amenity capabilities; they are not inferred from photos or duplicated as separate flags.</p>${amenitiesMarkup(room.amenities)}</fieldset>
        ${galleryEditorMarkup(room)}
        ${isLegacyPreparation ? legacyPropertyPhotoSelectionMarkup(legacyPreparation) : ''}
        ${isLegacyPreparation ? '<p class="hotel-workspace-safety-note">This operation creates one draft Room Type only. It does not create a Rate Plan, Room Rate, Calendar row, booking, or pricing conversion.</p>' : ''}
      </form>`,
      footer: `<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelRoomEditorForm">Review ${existing ? 'changes' : isLegacyPreparation ? 'shadow Room Type' : 'new Room Type'}</button>`,
      onReady(overlay) {
        const form = overlay.querySelector('#hotelRoomEditorForm');
        bindOrderedGalleryEditor(form);
        const clearRoomFilePreview = bindImagePreview(form, 'room_gallery_files');
        const previousRoomEditorClose = overlay.hotelWorkspaceOnClose;
        overlay.hotelWorkspaceOnClose = async () => {
          clearRoomFilePreview();
          await previousRoomEditorClose?.();
        };
        const beds = form.querySelector('[data-bed-rows]');
        const syncBedRows = () => beds.querySelectorAll('.hotel-bed-row').forEach((row) => {
          const isOther = row.querySelector('[data-bed-type]')?.value === 'other';
          const label = row.querySelector('.hotel-bed-other');
          const input = row.querySelector('[data-bed-label]');
          row.classList.toggle('is-other', isOther);
          if (label) label.hidden = !isOther;
          if (input) input.disabled = !isOther;
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
            floor_label_i18n: readI18n(fd, 'floor_label'),
            capacity_adults: fd.get('capacity_contract') === 'total_only' ? null : Number(fd.get('capacity_adults')),
            capacity_children: fd.get('capacity_contract') === 'total_only' ? null : Number(fd.get('capacity_children')),
            max_occupancy: fd.get('capacity_contract') === 'total_only' ? Number(fd.get('max_occupancy')) : null,
            inventory_mode: String(fd.get('inventory_mode')),
            base_inventory_count: fd.get('inventory_mode') === 'unitized' ? 0 : Number(fd.get('base_inventory_count')),
            bathrooms: fd.get('bathrooms') === '' ? null : Number(fd.get('bathrooms')),
            size_sqm: fd.get('size_sqm') === '' ? null : Number(fd.get('size_sqm')),
            status: existing ? String(fd.get('status')) : 'draft',
            sort_order: Number(fd.get('sort_order')),
            bed_configuration: bedConfiguration,
            amenities: fd.getAll('room_amenity'),
            gallery: Core.normalizeGallery([
              ...fd.getAll('room_gallery_url'),
              ...fd.getAll('property_gallery_photo'),
              ...(isLegacyPreparation ? fd.getAll('legacy_property_photo') : []),
            ]),
          };
          let validated;
          try { validated = Core.validateRoomType(candidate, state.workspace); }
          catch (error) { toast(error.message, 'error'); return; }
          let files;
          try { files = validateSelectedImages(form.elements.room_gallery_files?.files || []); }
          catch (error) { toast(error.message, 'error'); return; }
          const roomUploader = window.HotelsV2AdminMedia?.uploadRoomGallery;
          if (files.length && typeof roomUploader !== 'function') {
            toast('Optimized room-image uploader is unavailable. Your editor values remain open.', 'error');
            return;
          }
          const allowedPropertyPhotos = new Set(Core.normalizeGallery(state.workspace.property.photos));
          if (fd.getAll('property_gallery_photo').some((url) => !allowedPropertyPhotos.has(String(url)))) {
            toast('A selected shared photo is no longer in this exact property gallery. Refresh before Review.', 'error');
            return;
          }
          const propertySlug = state.workspace.property.slug;
          const roomSubmit = overlay.querySelector('button[form="hotelRoomEditorForm"]');
          let uploadedUrls = [];
          if (files.length) {
            roomSubmit.disabled = true;
            roomSubmit.textContent = 'Optimizing photos…';
            setModalSaving(overlay, true);
            try {
              uploadedUrls = await roomUploader(propertySlug, validated.id, files);
              validated = {
                ...validated,
                gallery: Core.normalizeGallery([...validated.gallery, ...uploadedUrls]),
              };
            } catch (error) {
              setModalSaving(overlay, false);
              roomSubmit.disabled = false;
              roomSubmit.textContent = `Review ${existing ? 'changes' : isLegacyPreparation ? 'shadow Room Type' : 'new Room Type'}`;
              toast(error?.message || 'Room gallery upload failed before Review.', 'error');
              return;
            }
          }
          clearRoomFilePreview();
          setModalSaving(overlay, false);
          closeModal({ restoreFocus: false });
          const cleanupUploaded = async () => {
            if (!uploadedUrls.length) return;
            await window.HotelsV2AdminMedia?.removeRoomGalleryUploads?.(propertySlug, validated.id, uploadedUrls);
            uploadedUrls = [];
          };
          const cleanupRejectedUpload = async (error) => {
            if (error?.isDefinitiveFailure) await cleanupUploaded();
          };
          try {
            const reviewOpened = existing
              ? await openReview(roomControlReviewOptions(existing, validated, {
                onCancel: files.length ? cleanupUploaded : null,
                onApplyError: files.length ? cleanupRejectedUpload : null,
                closeOnApplyError: files.length > 0,
              }))
              : await openReview({
                title: isLegacyPreparation ? 'Review legacy → shadow Room Type' : 'Review new Room Type',
                entity: 'room_type', before: existing, after: validated,
                operation: Core.operationForEntity('room_type', validated, existing),
                onCancel: files.length ? cleanupUploaded : null,
                onApplyError: files.length ? cleanupRejectedUpload : null,
                closeOnApplyError: files.length > 0,
                contextMessage: isLegacyPreparation
                  ? 'The exact legacy property remains live and unchanged. This reviewed operation creates one draft Room Type only; pricing migration stays separate.'
                  : 'A new Room Type is always created as draft unless an Admin explicitly reviewed another inert configuration status.',
                successMessage: isLegacyPreparation ? 'Existing accommodation prepared as one inert draft Room Type.' : 'Room Type created as an inert configuration.',
              });
            if (reviewOpened === false) await cleanupUploaded();
          } catch (error) {
            try { await cleanupUploaded(); } catch (cleanupError) { console.error('Failed to clean Room media after Review preparation was rejected:', cleanupError); }
            toast(error?.userMessage || error?.message || 'Room changes could not be prepared for Review. Pending uploads were removed.', 'error');
          }
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
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Unit code</span><input name="code" value="${escapeAttr(unit.code)}" required pattern="[a-z0-9](?:[a-z0-9_]|-)*" /></label><label class="admin-form-field"><span>Status</span><select name="status">${Core.UNIT_STATUSES.map((status) => `<option value="${status}" ${unit.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label></div>
        ${i18nFields('name', 'Optional display name', unit.name_i18n)}
        <div class="hotel-workspace-locked-fields"><div><span>Room Type</span><strong>${escapeHtml(Core.i18nText(room.name_i18n, 'en', room.code))}</strong></div></div>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(unit.id)}</code></details>
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
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Internal code</span><input name="code" value="${escapeAttr(plan.code)}" required pattern="[a-z0-9](?:[a-z0-9_]|-)*" /></label><label class="admin-form-field"><span>Meal plan code</span><input name="meal_plan_code" value="${escapeAttr(plan.meal_plan_code || '')}" placeholder="room_only, breakfast…" /></label></div>
        ${i18nFields('name', 'Rate Plan name', plan.name_i18n)}
        ${i18nFields('description', 'Rate Plan description', plan.description_i18n, 'textarea')}
        ${cancellationFields(plan.cancellation_policy)}
        <div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Booking-mode override</span><select name="booking_mode_override"><option value="">Use property booking mode</option>${Core.BOOKING_MODES.map((mode) => `<option value="${mode}" ${plan.booking_mode_override === mode ? 'selected' : ''}>${escapeHtml(bookingModeLabel(mode))}</option>`).join('')}</select></label><label class="admin-form-field"><span>Admin sort order</span><input name="sort_order" type="number" min="0" step="1" value="${plan.sort_order}" /></label><label class="admin-checkbox-field"><input name="is_active" type="checkbox" ${plan.is_active ? 'checked' : ''} /><span>Active configuration</span></label></div>
        <div class="hotel-workspace-locked-fields"><div><span>Scope</span><strong>This property only</strong></div></div>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(plan.id)}</code></details>
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
          <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(existing.id)}</code><code>${escapeHtml(existing.pricing_schedule_id)}</code></details>
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
      </div><div class="hotel-workspace-locked-fields"><div><span>Public effect</span><strong>None while V2 flags are off</strong></div></div><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(rate.id)}</code></details></form>`,
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
      contextMessage: 'The duplicate is always an inert draft with pooled inventory set to 0. Exact source-Room uploads, units, daily inventory, bookings and Room Rate products are not copied; only photos also present in this exact property gallery may be retained.',
      successMessage: 'Room Type duplicated as an inert draft. Exact Room media, inventory, units, bookings and Rate products were not copied.',
    });
  }

  async function disableRoom(roomId) {
    const room = state.workspace.room_types.find((candidate) => candidate.id === roomId);
    if (!room) return;
    const linkedRates = state.workspace.room_rates.filter((rate) => rate.room_type_id === room.id);
    const activeRates = linkedRates.filter((rate) => rate.is_active === true);
    const activeUnits = state.workspace.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active');
    const allocationRules = Core.asArray(state.h3Configuration?.allocation_rules).filter((rule) => (
      (rule.is_active === true || String(rule.review_status || '').toLowerCase() === 'reviewed')
      && Core.asArray(rule.items).some((item) => Core.normalizeUuid(item.room_type_id) === room.id)
    ));
    const exactInventoryRows = Math.max(0, Number(state.workspace.counts?.daily_inventory_by_room?.[room.id] || 0));
    const blockers = [
      ...(activeRates.length ? [`${activeRates.length} active linked Room Rate product${activeRates.length === 1 ? '' : 's'}`] : []),
      ...(activeUnits.length ? [`${activeUnits.length} active physical unit${activeUnits.length === 1 ? '' : 's'}`] : []),
      ...(allocationRules.length ? [`${allocationRules.length} active/reviewed allocation rule${allocationRules.length === 1 ? '' : 's'}`] : []),
      ...(exactInventoryRows ? [`${exactInventoryRows} exact-date inventory row${exactInventoryRows === 1 ? '' : 's'}`] : []),
    ];
    if (blockers.length) {
      openModal({
        title: 'Room Type cannot be disabled yet',
        body: `<section class="hotel-workspace-card hotel-property-empty--error"><span class="hotel-workspace-eyebrow">Dependency-safe lifecycle</span><h4>Resolve linked operational state first</h4><ul class="hotel-readiness-list hotel-readiness-list--blockers">${blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>Disable or detach these exact dependencies through their own reviewed workflows, then reopen this Room Type. Nothing was changed.</p><details class="hotel-review-diagnostics"><summary>Exact Room diagnostics</summary><code>${escapeHtml(room.id)}</code>${linkedRates.map((rate) => `<code>${escapeHtml(rate.id)}</code>`).join('')}</details></section>`,
      });
      return;
    }
    const after = { ...room, status: 'disabled' };
    await openReview(roomControlReviewOptions(room, after, {
      operationType: 'disable',
      contextMessage: `${linkedRates.length} inactive linked Room Rate product${linkedRates.length === 1 ? '' : 's'} will remain unchanged and inert. The server will recheck exact allocations, units, inventory, calendars and future booking dependencies before disabling; no row is deleted or cascaded.`,
      successMessage: 'Room Type disabled. No linked rows were deleted or changed.',
    }));
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
    return Core.asArray(rows).map((row) => `<tr><th>${escapeHtml(reviewFieldLabel(row.field))}</th><td>${reviewValueMarkup(row.before, row.field)}</td><td>${reviewValueMarkup(row.after, row.field)}</td></tr>`).join('');
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
      body: `<div class="hotel-review-summary"><p>One exact-property Calendar transaction will apply only if every reviewed version still matches.</p><dl><div><dt>Property</dt><dd>${escapeHtml(propertyTitle(state.workspace.property))}</dd></div><div><dt>Operations</dt><dd>${plan.operations.length}</dd></div><div><dt>Range</dt><dd>${escapeHtml(plan.from)} → ${escapeHtml(plan.to)}</dd></div><div><dt>Concurrency</dt><dd>Exact row versions</dd></div></dl><details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(plan.hotel_id)}</code></details></div>
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

  function h3ExactId(existing) {
    return Core.normalizeUuid(existing?.id) || Core.newUuid();
  }

  function h3RoomName(room) {
    return Core.i18nText(room?.name_i18n, 'en', room?.code || 'Room Type');
  }

  function h3CommissionLabel(policy) {
    if (!policy) return 'Not configured';
    if (policy.commission_mode === 'percent_booking_total') return `${Number(policy.amount || 0)}% of booking total`;
    return `${formatMoney(policy.amount, policy.currency)} / allocated room / night`;
  }

  function sevenKamaresAllocationRule(configuration, code, minGuests, maxGuests, mode, allocations, sortOrder) {
    const existing = configuration.allocation_rules.find((rule) => rule.code === code);
    const existingItems = new Map(Core.asArray(existing?.items).map((item) => [item.room_type_id, item]));
    return {
      ...(existing || {}), id: h3ExactId(existing), hotel_id: configuration.hotel_id, code,
      min_guest_count: minGuests, max_guest_count: maxGuests, allocation_mode: mode,
      is_active: true, review_status: 'reviewed', sort_order: sortOrder,
      version: existing?.version || 1, items_fingerprint: existing?.items_fingerprint || null,
      items: allocations.map((allocation, index) => {
        const current = existingItems.get(allocation.room_type_id);
        return {
          ...(current || {}), id: h3ExactId(current), room_type_id: allocation.room_type_id,
          units_required: allocation.units_required || 1,
          allocated_guest_count: allocation.allocated_guest_count ?? null,
          pricing_guest_count: allocation.pricing_guest_count ?? null,
          sort_order: (index + 1) * 100,
        };
      }),
    };
  }

  function sevenKamaresH3Template(configuration, options = {}) {
    const base = Core.normalizeH3Configuration(configuration);
    const pricingPromotionReviewed = options.pricingPromotionReviewed === true;
    const upperId = Core.SEVEN_ARCHES_SHADOW_IDS.upper_room_type;
    const groundId = Core.SEVEN_ARCHES_SHADOW_IDS.ground_room_type;
    const choiceRooms = [
      { room_type_id: upperId, units_required: 1, allocated_guest_count: null, pricing_guest_count: null },
      { room_type_id: groundId, units_required: 1, allocated_guest_count: null, pricing_guest_count: null },
    ];
    const split = (upperGuests, groundGuests, upperPricingGuests, groundPricingGuests) => [
      { room_type_id: upperId, units_required: 1, allocated_guest_count: upperGuests, pricing_guest_count: pricingPromotionReviewed ? upperPricingGuests : null },
      { room_type_id: groundId, units_required: 1, allocated_guest_count: groundGuests, pricing_guest_count: pricingPromotionReviewed ? groundPricingGuests : null },
    ];
    const paymentCode = 'seven-kamares-request-confirmation';
    const payment = base.payment_policies.find((entry) => entry.code === paymentCode);
    const currentTerms = new Map(Core.asArray(payment?.terms).map((term) => [term.sequence, term]));
    const commissionCode = 'seven-kamares-platform-commission';
    const commission = base.commission_policies.find((entry) => entry.code === commissionCode);
    const manual = base.calendar_sources.find((entry) => entry.source_type === 'manual');
    return Core.normalizeH3Configuration({
      ...base,
      property: { ...base.property, minimum_stay_nights: 2 },
      pricing_schedules: base.pricing_schedules.map((entry) => ({ ...entry, minimum_billable_occupancy: 2 })),
      rate_plans: base.rate_plans.map((entry) => ({
        ...entry,
        price_inclusions: Core.normalizeStringSet([...entry.price_inclusions, 'cleaning', 'taxes']),
      })),
      allocation_rules: [
        sevenKamaresAllocationRule(base, 'guests-1-4-choice', 1, 4, 'customer_choice', choiceRooms, 100),
        sevenKamaresAllocationRule(base, 'guests-5-bundle', 5, 5, 'required_bundle', split(3, 2, 2, 2), 200),
        sevenKamaresAllocationRule(base, 'guests-6-bundle', 6, 6, 'required_bundle', split(3, 3, 3, 3), 300),
        sevenKamaresAllocationRule(base, 'guests-7-bundle', 7, 7, 'required_bundle', split(4, 3, 4, 4), 400),
        sevenKamaresAllocationRule(base, 'guests-8-bundle', 8, 8, 'required_bundle', split(4, 4, 4, 4), 500),
      ],
      payment_policies: [{
        ...(payment || {}), id: h3ExactId(payment), hotel_id: base.hotel_id, code: paymentCode,
        name_i18n: { pl: 'Płatność po akceptacji partnera', en: 'Payment after partner acceptance', he: 'תשלום לאחר אישור השותף' },
        currency: base.property.currency || state.workspace.property.currency || 'EUR',
        is_active: true, review_status: 'reviewed', version: payment?.version || 1,
        terms_fingerprint: payment?.terms_fingerprint || null,
        terms: [
          {
            ...(currentTerms.get(1) || {}), id: h3ExactId(currentTerms.get(1)), sequence: 1,
            due_event: 'after_partner_acceptance', amount_mode: 'percent_total', amount_value: 50,
            recipient: 'partner', payment_methods: ['bank_transfer'], instructions_i18n: {},
          },
          {
            ...(currentTerms.get(2) || {}), id: h3ExactId(currentTerms.get(2)), sequence: 2,
            due_event: 'on_arrival', amount_mode: 'remaining_balance', amount_value: null,
            recipient: 'partner', payment_methods: ['card', 'cash'], instructions_i18n: {},
          },
        ],
      }],
      commission_policies: [{
        ...(commission || {}), id: h3ExactId(commission), hotel_id: base.hotel_id, code: commissionCode,
        commission_mode: 'per_allocated_room_per_night', amount: 10,
        currency: base.property.currency || state.workspace.property.currency || 'EUR',
        is_active: true, review_status: 'reviewed', version: commission?.version || 1,
      }],
      calendar_sources: [{
        ...(manual || {}), id: h3ExactId(manual), hotel_id: base.hotel_id, code: manual?.code || 'manual-primary',
        source_type: 'manual', room_type_id: null, external_reference: null,
        is_enabled: true, review_status: 'reviewed', priority: manual?.priority || 100,
        configuration: Core.asObject(manual?.configuration), version: manual?.version || 1,
      }, ...base.calendar_sources.filter((entry) => entry.source_type !== 'manual').map((entry) => ({ ...entry, is_enabled: false }))],
    });
  }

  function h3ConfigurationHasReviewedRows(configuration) {
    const normalized = Core.normalizeH3Configuration(configuration);
    return normalized.allocation_rules.length > 0 || normalized.payment_policies.length > 0
      || normalized.commission_policies.length > 0 || normalized.calendar_sources.length > 0;
  }

  function h3WorkingConfiguration(configuration, options = {}) {
    const normalized = Core.normalizeH3Configuration(configuration);
    const useTemplate = state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID
      && (options.forceTemplate === true || !h3ConfigurationHasReviewedRows(normalized));
    const pricingPromotionReviewed = state.pricingPromotionPreview?.promotion?.status === 'reviewed';
    return useTemplate ? sevenKamaresH3Template(normalized, { pricingPromotionReviewed }) : normalized;
  }

  function h3AllocationRuleEditorMarkup(rule) {
    const rooms = state.workspace.room_types.filter((room) => room.status !== 'disabled');
    const itemMap = new Map(rule.items.map((item) => [item.room_type_id, item]));
    const pricingLocked = state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID;
    const pricingReviewed = state.pricingPromotionPreview?.promotion?.status === 'reviewed';
    return `<section class="hotel-h3-allocation-rule" data-h3-allocation-rule data-rule-id="${escapeAttr(rule.id)}" data-rule-code="${escapeAttr(rule.code)}">
      <header><div><span class="hotel-workspace-eyebrow">Guest allocation</span><strong>${escapeHtml(rule.code)}</strong></div><button class="btn-secondary hotel-danger-action" type="button" data-remove-h3-rule>${rule.created_at ? 'Disable rule' : 'Remove draft'}</button></header>
      <div class="hotel-workspace-form-grid">
        <label class="admin-form-field"><span>From guests</span><input data-h3-rule-min type="number" min="1" max="50" step="1" value="${rule.min_guest_count}" required /></label>
        <label class="admin-form-field"><span>To guests</span><input data-h3-rule-max type="number" min="1" max="50" step="1" value="${rule.max_guest_count}" required /></label>
        <label class="admin-form-field"><span>Allocation behavior</span><select data-h3-rule-mode><option value="customer_choice" ${rule.allocation_mode === 'customer_choice' ? 'selected' : ''}>Customer chooses one room</option><option value="required_bundle" ${rule.allocation_mode === 'required_bundle' ? 'selected' : ''}>Required bundle · exact rooms</option></select></label>
        <label class="admin-checkbox-field"><input data-h3-rule-active type="checkbox" ${rule.is_active ? 'checked' : ''} /><span>Enabled in shadow configuration</span></label>
      </div>
      <div class="hotel-h3-room-allocation-list">${rooms.map((room) => {
        const item = itemMap.get(room.id);
        return `<div class="hotel-h3-room-allocation" data-h3-room-allocation data-room-id="${escapeAttr(room.id)}" data-item-id="${escapeAttr(item?.id || Core.newUuid())}">
          <label class="admin-checkbox-field"><input data-h3-room-selected type="checkbox" ${item ? 'checked' : ''} /><span>${escapeHtml(h3RoomName(room))}</span></label>
          <label class="admin-form-field"><span>Units</span><input data-h3-room-units type="number" min="1" max="${Math.max(1, room.base_inventory_count)}" step="1" value="${item?.units_required || 1}" /></label>
          <label class="admin-form-field" data-h3-allocated-guests-field><span>Physical guests</span><input data-h3-room-guests type="number" min="1" max="${Math.max(1, room.effective_max_occupancy)}" step="1" value="${item?.allocated_guest_count ?? ''}" /></label>
          <label class="admin-form-field" data-h3-pricing-guests-field><span>Pricing occupancy</span><input data-h3-room-pricing-guests ${pricingLocked ? 'data-h3-pricing-locked="1" readonly aria-readonly="true"' : ''} type="number" min="1" max="${Math.max(1, room.effective_max_occupancy)}" step="1" value="${item?.pricing_guest_count ?? ''}" placeholder="${pricingLocked && !pricingReviewed ? 'Dedicated Review pending' : ''}" /><small>${pricingLocked ? (pricingReviewed ? 'Preserved from the dedicated 70-case pricing Review.' : 'Set only by the dedicated legacy pricing Review; Booking setup cannot promote it.') : 'May differ from the physical split only when explicitly reviewed for legacy parity.'}</small></label>
          <small>Capacity ${room.effective_max_occupancy} · inventory ${room.base_inventory_count}</small>
        </div>`;
      }).join('')}</div>
    </section>`;
  }

  function h3PaymentTermMarkup(term) {
    const dueLabels = { at_booking: 'At booking', after_partner_acceptance: 'After partner acceptance', before_arrival: 'Before arrival', on_arrival: 'On arrival' };
    const amountLabels = { percent_total: 'Percent of total', flat: 'Flat amount', remaining_balance: 'Remaining balance' };
    return `<section class="hotel-h3-payment-term" data-h3-payment-term data-term-id="${escapeAttr(term.id)}">
      <header><strong>Payment step <span data-h3-term-number>${term.sequence}</span></strong><button class="btn-secondary hotel-danger-action" type="button" data-remove-h3-term>Remove</button></header>
      <div class="hotel-workspace-form-grid">
        <label class="admin-form-field"><span>When due</span><select data-h3-term-due>${Core.HOTEL_PAYMENT_DUE_EVENTS.map((value) => `<option value="${value}" ${term.due_event === value ? 'selected' : ''}>${escapeHtml(dueLabels[value])}</option>`).join('')}</select></label>
        <label class="admin-form-field"><span>Amount</span><select data-h3-term-mode>${Core.HOTEL_PAYMENT_AMOUNT_MODES.map((value) => `<option value="${value}" ${term.amount_mode === value ? 'selected' : ''}>${escapeHtml(amountLabels[value])}</option>`).join('')}</select></label>
        <label class="admin-form-field" data-h3-term-amount-field><span>Value</span><input data-h3-term-amount type="number" min="0" step="0.01" value="${escapeAttr(term.amount_value ?? '')}" /></label>
        <label class="admin-form-field"><span>Paid to</span><select data-h3-term-recipient>${Core.HOTEL_PAYMENT_RECIPIENTS.map((value) => `<option value="${value}" ${term.recipient === value ? 'selected' : ''}>${value === 'partner' ? 'Partner' : 'CyprusEye platform'}</option>`).join('')}</select></label>
      </div>
      <fieldset><legend>Accepted methods</legend><div class="hotel-h3-method-grid">${Core.HOTEL_PAYMENT_METHODS.map((method) => `<label class="admin-checkbox-field"><input data-h3-term-method type="checkbox" value="${method}" ${term.payment_methods.includes(method) ? 'checked' : ''} /><span>${escapeHtml(method.replaceAll('_', ' '))}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Customer instructions</legend><div class="hotel-workspace-i18n-grid">${Core.LANGUAGES.map((language) => `<label class="admin-form-field"><span>${language.toUpperCase()}</span><textarea data-h3-term-instruction="${language}" rows="2" dir="${language === 'he' ? 'rtl' : 'ltr'}">${escapeHtml(Core.asObject(term.instructions_i18n)[language] || '')}</textarea></label>`).join('')}</div></fieldset>
    </section>`;
  }

  function bindH3DynamicEditor(form) {
    const renumberTerms = () => form.querySelectorAll('[data-h3-payment-term]').forEach((term, index) => {
      const label = term.querySelector('[data-h3-term-number]'); if (label) label.textContent = String(index + 1);
    });
    const updateRuleMode = (ruleElement) => {
      const bundle = ruleElement.querySelector('[data-h3-rule-mode]')?.value === 'required_bundle';
      ruleElement.querySelectorAll('[data-h3-allocated-guests-field]').forEach((field) => { field.hidden = !bundle; });
      ruleElement.querySelectorAll('[data-h3-pricing-guests-field]').forEach((field) => { field.hidden = !bundle; });
    };
    form.querySelectorAll('[data-h3-allocation-rule]').forEach((rule) => {
      if (rule.dataset.h3Bound === '1') return;
      rule.dataset.h3Bound = '1'; updateRuleMode(rule);
      rule.querySelector('[data-h3-rule-mode]')?.addEventListener('change', () => updateRuleMode(rule));
      rule.querySelector('[data-remove-h3-rule]')?.addEventListener('click', () => rule.remove());
    });
    const updateTermMode = (term) => {
      const remaining = term.querySelector('[data-h3-term-mode]')?.value === 'remaining_balance';
      const field = term.querySelector('[data-h3-term-amount-field]');
      if (field) field.hidden = remaining;
    };
    form.querySelectorAll('[data-h3-payment-term]').forEach((term) => {
      if (term.dataset.h3Bound === '1') return;
      term.dataset.h3Bound = '1'; updateTermMode(term);
      term.querySelector('[data-h3-term-mode]')?.addEventListener('change', () => updateTermMode(term));
      term.querySelector('[data-remove-h3-term]')?.addEventListener('click', () => { term.remove(); renumberTerms(); });
    });
    renumberTerms();
  }

  function readH3ConfigurationForm(form, draft) {
    const next = Core.clone(draft);
    const persisted = Core.normalizeH3Configuration(state.h3Configuration);
    const minimumStayValue = String(form.elements.minimum_stay_nights.value || '').trim();
    next.property.minimum_stay_nights = minimumStayValue ? Number(minimumStayValue) : null;
    next.pricing_schedules = next.pricing_schedules.map((schedule) => ({
      ...schedule,
      minimum_billable_occupancy: Number(form.querySelector(`[data-h3-schedule-id="${schedule.id}"]`)?.value),
    }));
    next.rate_plans = next.rate_plans.map((plan) => ({
      ...plan,
      price_inclusions: Core.normalizeStringSet([
        ...plan.price_inclusions.filter((value) => !Core.HOTEL_PRICE_INCLUSIONS.includes(value)),
        ...Array.from(form.querySelectorAll(`[data-h3-inclusion-plan="${plan.id}"]:checked`)).map((input) => input.value),
      ]),
    }));
    const editedAllocationRules = Array.from(form.querySelectorAll('[data-h3-allocation-rule]')).map((rule, index) => {
      const mode = rule.querySelector('[data-h3-rule-mode]').value;
      const existing = next.allocation_rules.find((candidate) => candidate.id === rule.dataset.ruleId);
      const persistedRule = persisted.allocation_rules.find((candidate) => candidate.id === rule.dataset.ruleId);
      const items = Array.from(rule.querySelectorAll('[data-h3-room-allocation]'))
        .filter((row) => row.querySelector('[data-h3-room-selected]').checked)
        .map((row, itemIndex) => {
          const roomTypeId = Core.normalizeUuid(row.dataset.roomId);
          const pricingInput = row.querySelector('[data-h3-room-pricing-guests]');
          const existingItem = existing?.items.find((item) => item.room_type_id === roomTypeId);
          return {
            id: Core.normalizeUuid(row.dataset.itemId) || Core.newUuid(),
            room_type_id: roomTypeId,
            units_required: Number(row.querySelector('[data-h3-room-units]').value),
            allocated_guest_count: mode === 'required_bundle' ? Number(row.querySelector('[data-h3-room-guests]').value) : null,
            pricing_guest_count: mode !== 'required_bundle'
              ? null
              : pricingInput?.dataset.h3PricingLocked === '1'
                ? existingItem?.pricing_guest_count ?? null
                : Number(pricingInput?.value),
            sort_order: (itemIndex + 1) * 100,
          };
        });
      const isActive = rule.querySelector('[data-h3-rule-active]').checked;
      return {
        ...(existing || {}), id: Core.normalizeUuid(rule.dataset.ruleId) || Core.newUuid(), hotel_id: next.hotel_id,
        code: rule.dataset.ruleCode || `guest-allocation-${index + 1}`,
        min_guest_count: Number(rule.querySelector('[data-h3-rule-min]').value),
        max_guest_count: Number(rule.querySelector('[data-h3-rule-max]').value),
        allocation_mode: mode, is_active: isActive,
        review_status: isActive || persistedRule?.review_status === 'reviewed' ? 'reviewed' : 'requires_review',
        sort_order: (index + 1) * 100, items,
      };
    });
    next.allocation_rules = [
      ...editedAllocationRules,
      ...next.allocation_rules.filter((rule) => rule.review_status === 'disabled'),
    ];
    const policyElement = form.querySelector('[data-h3-payment-policy]');
    const currentPolicy = next.payment_policies.find((entry) => entry.id === policyElement.dataset.policyId);
    const persistedPolicy = persisted.payment_policies.find((entry) => entry.id === policyElement.dataset.policyId);
    const terms = Array.from(policyElement.querySelectorAll('[data-h3-payment-term]')).map((term, index) => {
      const mode = term.querySelector('[data-h3-term-mode]').value;
      return {
        id: Core.normalizeUuid(term.dataset.termId) || Core.newUuid(), sequence: index + 1,
        due_event: term.querySelector('[data-h3-term-due]').value, amount_mode: mode,
        amount_value: mode === 'remaining_balance' ? null : Number(term.querySelector('[data-h3-term-amount]').value),
        recipient: term.querySelector('[data-h3-term-recipient]').value,
        payment_methods: Array.from(term.querySelectorAll('[data-h3-term-method]:checked')).map((input) => input.value),
        instructions_i18n: Core.normalizeI18n(Object.fromEntries(Core.LANGUAGES.map((language) => [language, term.querySelector(`[data-h3-term-instruction="${language}"]`)?.value]))),
      };
    });
    const reviewedPayment = {
      ...(currentPolicy || {}), id: Core.normalizeUuid(policyElement.dataset.policyId) || Core.newUuid(), hotel_id: next.hotel_id,
      code: policyElement.dataset.policyCode || 'request-confirmation-payment',
      name_i18n: readI18n(new FormData(form), 'h3_payment_policy_name'),
      currency: state.workspace.property.currency || 'EUR', is_active: form.elements.payment_policy_active.checked,
      review_status: form.elements.payment_policy_active.checked || persistedPolicy?.review_status === 'reviewed'
        ? 'reviewed' : 'requires_review', terms,
    };
    next.payment_policies = [reviewedPayment, ...next.payment_policies.filter((entry) => entry.id !== reviewedPayment.id)];
    const currentCommission = next.commission_policies.find((entry) => entry.is_active) || next.commission_policies[0];
    const persistedCommission = persisted.commission_policies.find((entry) => entry.id === currentCommission?.id);
    const reviewedCommission = {
      ...(currentCommission || {}), id: h3ExactId(currentCommission), hotel_id: next.hotel_id,
      code: currentCommission?.code || 'platform-commission', commission_mode: form.elements.commission_mode.value,
      amount: Number(form.elements.commission_amount.value), currency: state.workspace.property.currency || 'EUR',
      is_active: form.elements.commission_active.checked,
      review_status: form.elements.commission_active.checked || persistedCommission?.review_status === 'reviewed'
        ? 'reviewed' : 'requires_review',
    };
    next.commission_policies = [reviewedCommission, ...next.commission_policies.filter((entry) => entry.id !== reviewedCommission.id)];
    const manual = next.calendar_sources.find((entry) => entry.source_type === 'manual');
    next.calendar_sources = [{
      ...(manual || {}), id: h3ExactId(manual), hotel_id: next.hotel_id, code: manual?.code || 'manual-primary',
      source_type: 'manual', room_type_id: null, external_reference: null, is_enabled: true,
      review_status: 'reviewed', priority: manual?.priority || 100, configuration: Core.asObject(manual?.configuration),
    }, ...next.calendar_sources.filter((entry) => entry.source_type !== 'manual').map((entry) => ({ ...entry, is_enabled: false }))];
    return Core.normalizeH3Configuration(next);
  }

  async function refreshH3Configuration() {
    const hotelId = state.workspace.property.id;
    const [workspace, configuration] = await Promise.all([
      Repository.getWorkspace(hotelId), Repository.getH3Configuration(hotelId),
    ]);
    state.workspace = workspace; state.h3Configuration = configuration; state.h3ConfigurationError = null;
    return { workspace, configuration };
  }

  function h3ConflictError(conflicts) {
    const fields = conflicts.map((item) => item.field.replaceAll('_', ' ')).join(', ');
    const error = new Error(`The following booking setup changed after the editor opened: ${fields}.`);
    error.userMessage = `${error.message} Fresh values are shown; review them before preparing a new save.`;
    return error;
  }

  async function buildFreshH3Review(original, target) {
    const { workspace, configuration: fresh } = await refreshH3Configuration();
    const reconciliation = Core.reconcileH3Configuration(original, fresh, target);
    if (!reconciliation.safe) throw h3ConflictError(reconciliation.conflicts);
    const plan = Core.buildH3ConfigurationPlan(fresh, target, workspace);
    const sevenKamaresPrerequisite = workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID
      ? ` Future customer pricing will sum the exact allocated Room Rates using the room_occupancy schedule; the inactive property_booking_party schedule is legacy preview only and never customer pricing. This generic plan cannot promote or change the legacy pricing-occupancy mapping; only the dedicated 70-case pricing Review may do that. Separately review ${Core.SEVEN_ARCHES_CHECK_IN_FROM} check-in and ${Core.SEVEN_ARCHES_CHECK_OUT_UNTIL} check-out in Overview; add real partner bank-transfer instructions before operational readiness. Those prerequisites are not part of this plan.`
      : '';
    return {
      title: 'Review Hotel booking setup', entity: 'h3_booking_configuration',
      before: Core.h3BusinessState(fresh), after: Core.h3BusinessState(target),
      contextMessage: `One atomic, version-checked plan updates only this exact property's H3.1 Admin configuration. Architecture remains ${workspace.property.architecture_version}; all Hotels V2 flags and current public booking remain unchanged.${sevenKamaresPrerequisite}`,
      diagnostics: [{ label: 'Property ID', value: workspace.property.id }],
      onConfirm: async () => {
        await Repository.applyH3ConfigurationPlan(plan);
        const saved = await refreshH3Configuration();
        return { workspace: saved.workspace, configuration: saved.configuration };
      },
      onStaleReview: async () => ({
        ...(await buildFreshH3Review(fresh, target)),
        reReviewMessage: 'The stale booking setup save was stopped. Fresh exact versions are ready for explicit Review; nothing was retried automatically.',
      }),
      successMessage: 'Reviewed Hotel booking setup saved in shadow mode.',
    };
  }

  function openH3ConfigurationEditor(options = {}) {
    const original = Core.normalizeH3Configuration(state.h3Configuration);
    const draft = h3WorkingConfiguration(original, options);
    const proposedTemplate = state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID
      && (options.forceTemplate === true || !h3ConfigurationHasReviewedRows(original));
    const isSevenKamares = state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID;
    const pricingPromotionReviewed = state.pricingPromotionPreview?.promotion?.status === 'reviewed';
    const currentCheckIn = String(state.workspace.property.check_in_from || 'Not configured').slice(0, 5);
    const currentCheckOut = String(state.workspace.property.check_out_until || 'Not configured').slice(0, 5);
    const payment = draft.payment_policies.find((entry) => entry.is_active) || draft.payment_policies[0] || {
      id: Core.newUuid(), code: 'request-confirmation-payment', name_i18n: { en: 'Reviewed payment terms' },
      is_active: false, terms: [{
        id: Core.newUuid(), sequence: 1, due_event: 'after_partner_acceptance', amount_mode: 'percent_total',
        amount_value: 50, recipient: 'partner', payment_methods: ['bank_transfer'], instructions_i18n: {},
      }],
    };
    const commission = draft.commission_policies.find((entry) => entry.is_active) || draft.commission_policies[0] || { amount: 0, is_active: false };
    openModal({
      title: 'Configure booking setup',
      className: 'hotel-workspace-modal--wide hotel-h3-configuration-modal',
      body: `<form id="hotelH3ConfigurationForm" class="hotel-workspace-form">
        ${proposedTemplate ? `<section class="hotel-h3-template-banner"><span class="hotel-workspace-eyebrow">Reviewed 7 Kamares template</span><h4>Proposed only · no automatic write</h4><p>2-night minimum; one guest billed at the 2-person tier; choice for 1–4 guests; exact apartment bundles for 5–8; taxes and cleaning included; 50% after acceptance; balance on arrival; €10 commission per allocated apartment per night; manual Calendar.</p><p><strong>Pricing occupancy:</strong> ${pricingPromotionReviewed ? 'the exact reviewed mapping is preserved.' : 'left pending here. Only the dedicated 70-case legacy pricing Review may write it.'}</p><p><strong>Separate readiness step:</strong> Review ${Core.SEVEN_ARCHES_CHECK_IN_FROM} check-in and ${Core.SEVEN_ARCHES_CHECK_OUT_UNTIL} check-out in Overview. Add confirmed partner bank-transfer instructions below; the template does not invent account details.</p></section>` : ''}
        <section class="hotel-h3-editor-section"><header><div><span class="hotel-workspace-eyebrow">Stay rules</span><h4>Minimums and inclusions</h4></div></header>
          ${isSevenKamares ? '<p class="hotel-workspace-safety-note"><strong>Pricing provenance:</strong> Future customer pricing is the sum of exact allocated Room Rates using the room_occupancy schedule. The inactive 63-tier property_booking_party schedule remains a legacy parity preview only and is never customer pricing.</p>' : ''}
          <div class="hotel-workspace-form-grid">
            <label class="admin-form-field"><span>Minimum stay (nights)</span><input name="minimum_stay_nights" type="number" min="1" max="365" step="1" value="${draft.property.minimum_stay_nights ?? ''}" placeholder="Not reviewed" /><small>Leave blank while preparing another draft section; readiness stays blocked.</small></label>
            <div class="hotel-h3-overview-link"><span>${isSevenKamares ? '7 Kamares arrival and departure' : 'Arrival and departure'}</span><strong>Current: ${escapeHtml(currentCheckIn)} → ${escapeHtml(currentCheckOut)}</strong>${isSevenKamares ? `<small>Required for H3 readiness: check-in ${Core.SEVEN_ARCHES_CHECK_IN_FROM} · check-out ${Core.SEVEN_ARCHES_CHECK_OUT_UNTIL}. Saved separately with Review in Overview.</small>` : ''}<button class="btn-secondary" type="button" data-h3-open-overview>${isSevenKamares ? 'Review times in Overview' : 'Manage in Overview'}</button></div>
          </div>
          <div class="hotel-h3-config-list">${draft.pricing_schedules.map((schedule) => `<label class="admin-form-field"><span>Minimum billable occupancy · ${escapeHtml(schedule.name || schedule.code || schedule.id)}</span><input data-h3-schedule-id="${schedule.id}" type="number" min="1" max="${Math.max(1, Number(schedule.maximum_party_size || 64))}" step="1" value="${schedule.minimum_billable_occupancy ?? 1}" required /><small>${schedule.application_scope === 'property_booking_party' ? 'Legacy property-party parity preview only; never customer pricing.' : 'Room occupancy schedule used by exact allocated Room Rates; a one-guest stay may use this reviewed minimum occupancy price.'}</small></label>`).join('') || '<p class="hotel-property-card__blocker">No pricing schedule is available. Configure Rooms & Rates before saving H3.1.</p>'}</div>
          <div class="hotel-h3-config-list">${draft.rate_plans.map((plan) => {
            const preserved = plan.price_inclusions.filter((value) => !Core.HOTEL_PRICE_INCLUSIONS.includes(value));
            return `<fieldset><legend>${escapeHtml(Core.i18nText(plan.name_i18n, 'en', plan.code || 'Rate Plan'))} inclusions</legend><div class="hotel-h3-method-grid">${Core.HOTEL_PRICE_INCLUSIONS.map((value) => `<label class="admin-checkbox-field"><input data-h3-inclusion-plan="${plan.id}" type="checkbox" value="${value}" ${plan.price_inclusions.includes(value) ? 'checked' : ''} /><span>${value === 'taxes' ? 'Taxes included' : 'Cleaning included'}</span></label>`).join('')}</div>${preserved.length ? `<small>Preserved custom inclusions: ${escapeHtml(preserved.join(', '))}</small>` : ''}</fieldset>`;
          }).join('')}</div>
        </section>
        <section class="hotel-h3-editor-section"><header><div><span class="hotel-workspace-eyebrow">Guest → Room Type</span><h4>Allocation rules</h4></div><button class="btn-secondary" type="button" data-add-h3-rule>+ Allocation rule</button></header><p>Choice rules let the customer select one exact Room Type. Bundle rules allocate exact rooms and an exact guest split. Persisted rules are disabled, not deleted.</p>${isSevenKamares ? `<p class="hotel-workspace-safety-note"><strong>Pricing occupancy is ${pricingPromotionReviewed ? 'reviewed and locked' : 'pending and locked'}.</strong> This generic setup preserves it; only the dedicated legacy pricing Review can promote the mapping.</p>` : ''}<div data-h3-allocation-rules>${draft.allocation_rules.filter((rule) => rule.review_status !== 'disabled').map(h3AllocationRuleEditorMarkup).join('')}</div></section>
        <section class="hotel-h3-editor-section" data-h3-payment-policy data-policy-id="${escapeAttr(payment.id)}" data-policy-code="${escapeAttr(payment.code)}"><header><div><span class="hotel-workspace-eyebrow">Customer payment</span><h4>Reviewed payment terms</h4></div><button class="btn-secondary" type="button" data-add-h3-term>+ Payment step</button></header>
          ${i18nFields('h3_payment_policy_name', 'Policy label', payment.name_i18n)}<label class="admin-checkbox-field"><input name="payment_policy_active" type="checkbox" ${payment.is_active ? 'checked' : ''} /><span>Use these terms in future shadow quotes</span></label><div data-h3-payment-terms>${payment.terms.map(h3PaymentTermMarkup).join('')}</div>
          <p class="hotel-workspace-safety-note">These terms do not collect money, accept a booking, change central Deposit Settings or create a payout.</p>
        </section>
        <section class="hotel-h3-editor-section"><header><div><span class="hotel-workspace-eyebrow">CyprusEye commission</span><h4>Separate commercial rule</h4></div></header><div class="hotel-workspace-form-grid"><label class="admin-form-field"><span>Calculation</span><select name="commission_mode"><option value="per_allocated_room_per_night" ${commission.commission_mode !== 'percent_booking_total' ? 'selected' : ''}>Amount per allocated room / night</option><option value="percent_booking_total" ${commission.commission_mode === 'percent_booking_total' ? 'selected' : ''}>Percent of booking total</option></select></label><label class="admin-form-field"><span>Amount or percent</span><input name="commission_amount" type="number" min="0" step="0.01" value="${escapeAttr(commission.amount ?? 0)}" required /></label><label class="admin-checkbox-field"><input name="commission_active" type="checkbox" ${commission.is_active ? 'checked' : ''} /><span>Commission reviewed for shadow calculations</span></label></div><p>Commission remains separate from the customer total, payment due and partner payout.</p></section>
        <section class="hotel-h3-editor-section"><header><div><span class="hotel-workspace-eyebrow">Availability adapter</span><h4>Manual Calendar source</h4></div><span class="hotel-workspace-status hotel-workspace-status--success">MANUAL</span></header><div class="hotel-h3-provider-grid">${Core.HOTEL_CALENDAR_SOURCES.map((source) => `<div class="${source === 'manual' ? 'is-enabled' : ''}"><strong>${escapeHtml(source.replaceAll('_', ' '))}</strong><small>${source === 'manual' ? 'Enabled for H3.1 shadow configuration' : 'Future provider · disabled'}</small></div>`).join('')}</div></section>
        <div class="hotel-workspace-locked-fields"><div><span>Architecture</span><strong>${escapeHtml(state.workspace.property.architecture_version)}</strong><small>Not included in this save.</small></div><div><span>Public: no change</span><strong>Legacy stays authoritative</strong><small>No public runtime reads this plan.</small></div><div><span>Hotels V2 flags</span><strong>OFF required</strong><small>Not included in this save.</small></div></div>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelH3ConfigurationForm">Review booking setup</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelH3ConfigurationForm');
        bindH3DynamicEditor(form);
        const commissionMode = form.elements.commission_mode;
        const commissionAmount = form.elements.commission_amount;
        const updateCommissionAmount = () => {
          if (commissionMode.value === 'percent_booking_total') commissionAmount.setAttribute('max', '100');
          else commissionAmount.removeAttribute('max');
        };
        commissionMode.addEventListener('change', updateCommissionAmount);
        updateCommissionAmount();
        form.querySelector('[data-h3-open-overview]')?.addEventListener('click', () => {
          closeModal({ restoreFocus: false }); state.activeTab = 'overview'; renderWorkspace();
        });
        form.querySelector('[data-add-h3-rule]')?.addEventListener('click', () => {
          const index = form.querySelectorAll('[data-h3-allocation-rule]').length + 1;
          const rule = { id: Core.newUuid(), code: `guest-allocation-${Core.newUuid().slice(0, 8)}`, min_guest_count: 1, max_guest_count: 1, allocation_mode: 'customer_choice', is_active: true, items: [], sort_order: index * 100 };
          const holder = document.createElement('div'); holder.innerHTML = h3AllocationRuleEditorMarkup(rule);
          form.querySelector('[data-h3-allocation-rules]').append(holder.firstElementChild); bindH3DynamicEditor(form);
        });
        form.querySelector('[data-add-h3-term]')?.addEventListener('click', () => {
          const sequence = form.querySelectorAll('[data-h3-payment-term]').length + 1;
          const holder = document.createElement('div'); holder.innerHTML = h3PaymentTermMarkup({ id: Core.newUuid(), sequence, due_event: 'after_partner_acceptance', amount_mode: 'percent_total', amount_value: 50, recipient: 'partner', payment_methods: ['bank_transfer'], instructions_i18n: {} });
          form.querySelector('[data-h3-payment-terms]').append(holder.firstElementChild); bindH3DynamicEditor(form);
        });
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const submit = overlay.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Refreshing exact values…';
          try {
            const target = readH3ConfigurationForm(form, draft);
            Core.validateH3Configuration(target, state.workspace);
            closeModal({ restoreFocus: false });
            await openReview(await buildFreshH3Review(original, target));
          } catch (error) {
            submit.disabled = false; submit.textContent = 'Review booking setup';
            toast(error?.userMessage || error?.message || 'Booking setup could not be prepared for Review.', 'error');
          }
        });
      },
    });
  }

  function renderH3Readiness(readiness) {
    return `<section class="hotel-workspace-card hotel-h3-readiness"><div class="hotel-readiness-card__header"><div><span class="hotel-workspace-eyebrow">H3 shadow readiness</span><h4>${escapeHtml(readiness.state.replaceAll('_', ' '))}</h4></div><span class="hotel-workspace-status hotel-workspace-status--${readiness.blockers.length ? 'danger' : 'success'}">${readiness.blockers.length ? `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'}` : 'STRUCTURALLY READY'}</span></div>${readiness.blockers.length ? `<ul class="hotel-readiness-list hotel-readiness-list--blockers">${readiness.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="hotel-readiness-success">Structurally ready for shadow quote/booking implementation.</p>'}${readiness.warnings.length ? `<ul class="hotel-readiness-list">${readiness.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}<small>Readiness never activates Rooms V2 or accepts a partner booking.</small></section>`;
  }

  function renderBookingSetupPanel(panel) {
    if (!state.h3Configuration) {
      const error = state.h3ConfigurationError;
      panel.innerHTML = `${workspacePanelHeader('Booking setup', 'Stay, allocation, payment and commission configuration for future shadow request-confirmation flows.')}<section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">H3.1 foundation unavailable</span><h4>Booking setup is fail-closed</h4><p>${escapeHtml(error?.isFoundationMissing ? 'Apply the approved H3.1 SQL foundation before enabling this editor.' : (error?.message || 'Configuration could not be loaded.'))}</p><button class="btn-secondary" type="button" data-retry-h3-config>Retry secure configuration load</button></section>`;
      panel.querySelector('[data-retry-h3-config]')?.addEventListener('click', async () => { try { await refreshH3Configuration(); renderWorkspace(); } catch (loadError) { toast(loadError.message, 'error'); } });
      return;
    }
    const configuration = Core.normalizeH3Configuration(state.h3Configuration);
    const readiness = Core.deriveH3Readiness(configuration, state.workspace);
    const activeRules = configuration.allocation_rules.filter((rule) => rule.is_active);
    const payment = configuration.payment_policies.find((entry) => entry.is_active);
    const commission = configuration.commission_policies.find((entry) => entry.is_active);
    const manual = configuration.calendar_sources.find((entry) => entry.source_type === 'manual' && entry.is_enabled);
    const templateReady = state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID && !h3ConfigurationHasReviewedRows(configuration);
    const setupActions = `<div class="hotel-workspace-panel-actions">${state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID ? '<button class="btn-secondary" type="button" data-apply-seven-kamares-h3-template>Review 7 Kamares template</button>' : ''}<button class="btn-primary" type="button" data-edit-h3-configuration>Configure & Review</button></div>`;
    panel.innerHTML = `${workspacePanelHeader('Booking setup', 'Review exact stay rules, room allocation, customer payment terms, commission and availability source.', setupActions)}
      ${pricingPromotionCardMarkup()}
      ${templateReady ? `<section class="hotel-h3-template-banner"><span class="hotel-workspace-eyebrow">7 Kamares reviewed business template</span><h4>Ready to prepare — not saved</h4><p>The editor prefills the approved 1–8 guest allocation, 2-night stay, minimum 2-person billing, inclusions, payment, commission and manual Calendar. Admin must inspect Review and explicitly Save.</p><p>Operational readiness also requires separately reviewed ${Core.SEVEN_ARCHES_CHECK_IN_FROM} check-in, ${Core.SEVEN_ARCHES_CHECK_OUT_UNTIL} check-out and confirmed partner bank-transfer instructions.</p></section>` : ''}
      <div class="hotel-h3-dashboard">
        <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Stay & price basis</span><h4>${configuration.property.minimum_stay_nights || '—'} night minimum</h4><dl><div><dt>Pricing schedules</dt><dd>${configuration.pricing_schedules.length}</dd></div><div><dt>Minimum billable guests</dt><dd>${configuration.pricing_schedules.map((entry) => entry.minimum_billable_occupancy || '—').join(', ') || 'Not configured'}</dd></div><div><dt>Rate inclusions</dt><dd>${Array.from(new Set(configuration.rate_plans.flatMap((entry) => entry.price_inclusions))).join(', ') || 'Not reviewed'}</dd></div></dl>${state.workspace.property.id === Core.SEVEN_ARCHES_PROPERTY_ID ? '<p><strong>Future price:</strong> sum of exact allocated Room Rates · room_occupancy schedule. The 63-tier property_booking_party schedule remains legacy preview only.</p>' : ''}</section>
        <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Guest allocation</span><h4>${activeRules.length} active rule${activeRules.length === 1 ? '' : 's'}</h4>${activeRules.length ? `<ul class="hotel-simple-list">${activeRules.map((rule) => `<li><span>${rule.min_guest_count}${rule.max_guest_count === rule.min_guest_count ? '' : `–${rule.max_guest_count}`} guests</span><strong>${rule.allocation_mode === 'customer_choice' ? 'Customer choice' : 'Exact bundle'}</strong></li>`).join('')}</ul>` : '<p>No reviewed allocation rules.</p>'}</section>
        <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Payment terms</span><h4>${payment ? `${payment.terms.length} reviewed step${payment.terms.length === 1 ? '' : 's'}` : 'Not configured'}</h4>${payment ? `<ul class="hotel-simple-list">${payment.terms.map((term) => `<li><span>${escapeHtml(term.due_event.replaceAll('_', ' '))}</span><strong>${term.amount_mode === 'remaining_balance' ? 'Remaining balance' : term.amount_mode === 'percent_total' ? `${term.amount_value}%` : formatMoney(term.amount_value, payment.currency)}</strong></li>`).join('')}</ul>` : '<p>Customer payment and partner settlement remain separate.</p>'}</section>
        <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Platform commission</span><h4>${escapeHtml(h3CommissionLabel(commission))}</h4><p>Calculated separately from customer payment due and partner payout.</p></section>
        <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Availability source</span><h4>${manual ? 'Manual Calendar' : 'Not configured'}</h4><p>Booking.com, Airbnb and iCal remain disabled future capabilities.</p></section>
        ${renderH3Readiness(readiness)}
      </div>
      <section class="hotel-workspace-card hotel-workspace-safety-note"><strong>Shadow/request-confirmation only</strong><p>Architecture is ${escapeHtml(state.workspace.property.architecture_version)}. Public Hotels V2 flags stay OFF. This cannot publish, change legacy prices, create a booking, collect payment or accept for a partner.</p></section>`;
    panel.querySelector('[data-edit-h3-configuration]')?.addEventListener('click', () => openH3ConfigurationEditor());
    panel.querySelector('[data-apply-seven-kamares-h3-template]')?.addEventListener('click', () => openH3ConfigurationEditor({ forceTemplate: true }));
    panel.querySelector('[data-review-seven-kamares-pricing]')?.addEventListener('click', openLegacyPricingPromotionPreparation);
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
    const h3 = state.h3Configuration ? Core.normalizeH3Configuration(state.h3Configuration) : null;
    const h3Payment = h3?.payment_policies.find((entry) => entry.is_active);
    const h3Commission = h3?.commission_policies.find((entry) => entry.is_active);
    panel.innerHTML = `${workspacePanelHeader('Payments', 'Current central deposit behavior and future reviewed H3 request-confirmation terms remain separate.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Current legacy payment due</span><h4>${escapeHtml(depositRuleLabel(effective))}</h4><p>${Object.keys(exact).length ? 'Exact property override' : 'Hotels default rule'} from the existing central Deposit Settings tables.</p><button class="btn-primary" type="button" data-open-hotel-deposit>Manage in Deposit Settings</button></section>
      <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">H3 shadow payment terms</span><h4>${h3Payment ? `${h3Payment.terms.length} reviewed step${h3Payment.terms.length === 1 ? '' : 's'}` : 'Not configured'}</h4><p>These request-confirmation terms are inert and do not replace the current central deposit rule.</p><button class="btn-secondary" type="button" data-open-h3-payment-setup>Open Booking setup</button></section>
      <section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Platform commission</span><h4>${escapeHtml(h3CommissionLabel(h3Commission))}</h4><p>Commission is a separate commercial calculation; it is never treated as customer prepayment or partner payout.</p></section>
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Partner payout / Stripe Connect</span><h4>Capability disabled</h4><p>No connected-account or payout behavior is exposed in this stage.</p></section></div>`;
    panel.querySelector('[data-open-hotel-deposit]')?.addEventListener('click', openCentralHotelDepositSettings);
    panel.querySelector('[data-open-h3-payment-setup]')?.addEventListener('click', () => { state.activeTab = 'booking_setup'; renderWorkspace(); });
  }

  function openPropertyMediaEditor() {
    const property = propertyControlView();
    if (!state.contentControl?.operational_profile) {
      toast('Secure ADMIN-B content control is unavailable. Property media cannot be reviewed safely.', 'error');
      return;
    }
    const photos = Core.normalizeGallery(property.photos);
    openModal({
      title: 'Edit property gallery',
      className: 'hotel-workspace-modal--wide',
      body: `<form id="hotelPropertyMediaForm" class="hotel-workspace-form">
        <p class="hotel-workspace-intro">Reorder or detach shared property photos here. Existing Room Type references are not silently removed. Room-specific photos stay in each exact Room editor.</p>
        ${orderedGalleryMarkup(photos, 'property_gallery_url')}
        ${photos.length ? `<fieldset><legend>Cover image</legend><div class="hotel-property-cover-options">${photos.map((url, index) => `<label><img src="${escapeAttr(url)}" alt="Property image ${index + 1}" loading="lazy" /><span><input type="radio" name="property_cover_url" value="${escapeAttr(url)}" ${url === property.cover_image_url ? 'checked' : ''} /> Use as cover</span></label>`).join('')}</div>${property.cover_image_url && !photos.includes(property.cover_image_url) ? `<p class="hotel-workspace-safety-note">The current grandfathered legacy cover is outside the structured gallery. It will be preserved unless you explicitly select a gallery image. Its technical URL is available in diagnostics only.</p><details class="hotel-review-diagnostics"><summary>Current legacy cover diagnostics</summary><code>${escapeHtml(property.cover_image_url)}</code></details>` : ''}</fieldset>` : ''}
        <label class="admin-form-field"><span>Add property photos</span><input type="file" name="property_gallery_files" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" multiple /></label>
        <div class="hotel-gallery-file-preview" data-file-preview="property_gallery_files"></div>
        <small>JPEG, PNG, WebP or AVIF · 20 MB maximum each. New files are optimized before the final Review.</small>
      </form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelPropertyMediaForm">Review media changes</button>',
      onReady(overlay) {
        const form = overlay.querySelector('#hotelPropertyMediaForm');
        bindOrderedGalleryEditor(form);
        const clearPropertyFilePreview = bindImagePreview(form, 'property_gallery_files');
        const previousPropertyMediaClose = overlay.hotelWorkspaceOnClose;
        overlay.hotelWorkspaceOnClose = async () => {
          clearPropertyFilePreview();
          await previousPropertyMediaClose?.();
        };
        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const fd = new FormData(form);
          const retained = fd.getAll('property_gallery_url').map(String);
          const removed = photos.filter((url) => !retained.includes(url));
          let files;
          try { files = validateSelectedImages(form.elements.property_gallery_files?.files || []); }
          catch (error) { toast(error.message, 'error'); return; }
          const propertyUploader = window.HotelsV2AdminMedia?.uploadPropertyGallery;
          if (files.length && typeof propertyUploader !== 'function') {
            toast('Optimized property-image uploader is unavailable. Your editor values remain open.', 'error');
            return;
          }
          const propertySlug = property.slug;
          const propertySubmit = overlay.querySelector('button[form="hotelPropertyMediaForm"]');
          let uploadedUrls = [];
          if (files.length) {
            propertySubmit.disabled = true;
            propertySubmit.textContent = 'Optimizing photos…';
            setModalSaving(overlay, true);
            try {
              uploadedUrls = await propertyUploader(propertySlug, files);
            } catch (error) {
              setModalSaving(overlay, false);
              propertySubmit.disabled = false;
              propertySubmit.textContent = 'Review media changes';
              toast(error?.message || 'Property gallery upload failed before Review.', 'error');
              return;
            }
          }
          clearPropertyFilePreview();
          setModalSaving(overlay, false);
          closeModal({ restoreFocus: false });
          const nextPhotos = Core.normalizeGallery([...retained, ...uploadedUrls]);
          let coverImageUrl = String(fd.get('property_cover_url') || '').trim() || property.cover_image_url || null;
          if (coverImageUrl && removed.includes(coverImageUrl)) coverImageUrl = nextPhotos[0] || null;
          if (!coverImageUrl && nextPhotos.length) coverImageUrl = nextPhotos[0];
          const next = { ...property, photos: nextPhotos, cover_image_url: coverImageUrl };
          const cleanupUploaded = async () => {
            if (!uploadedUrls.length) return;
            await window.HotelsV2AdminMedia?.removePropertyGalleryUploads?.(propertySlug, uploadedUrls);
            uploadedUrls = [];
          };
          const cleanupRejectedUpload = async (error) => {
            if (error?.isDefinitiveFailure) await cleanupUploaded();
          };
          try {
            const reviewOpened = await openReview(propertyControlReviewOptions(state.workspace, state.contentControl, next, {
              title: 'Review property media changes',
              onCancel: files.length ? cleanupUploaded : null,
              onApplyError: files.length ? cleanupRejectedUpload : null,
              closeOnApplyError: files.length > 0,
              successMessage: 'Property gallery updated without changing publication.',
            }));
            if (reviewOpened === false) await cleanupUploaded();
          } catch (error) {
            try { await cleanupUploaded(); } catch (cleanupError) { console.error('Failed to clean property media after Review preparation was rejected:', cleanupError); }
            toast(error?.userMessage || error?.message || 'Property media could not be prepared for Review. Pending uploads were removed.', 'error');
          }
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

  function partnerCapabilityLabel(key) {
    return PARTNER_CAPABILITY_DETAILS[key]?.[0] || String(key || '').replaceAll('_', ' ');
  }

  function enabledPartnerCapabilities(capabilities) {
    const normalized = Core.normalizeHotelPartnerCapabilities(capabilities);
    return Core.HOTEL_PARTNER_CAPABILITIES.filter((key) => normalized[key]);
  }

  function partnerPermissionReviewState(assignment, capabilities = null) {
    const selected = Core.normalizeHotelPartnerCapabilities(capabilities || assignment?.permission?.capabilities);
    return {
      exact_assignment_id: assignment?.assignment_id || null,
      exact_partner_id: assignment?.partner_id || null,
      partner: assignment?.partner?.name || 'Unnamed partner',
      permission_version: assignment?.permission?.version || 0,
      enabled_capabilities: enabledPartnerCapabilities(selected).map(partnerCapabilityLabel),
      capabilities: selected,
    };
  }

  async function refreshPartnerPermissions(options = {}) {
    const hotelId = state.workspace?.property?.id;
    if (!hotelId) return null;
    try {
      state.partnerPermissions = await Repository.getPartnerHotelPermissions(hotelId);
      state.partnerPermissionsError = null;
      if (options.render !== false && state.activeTab === 'partner') renderWorkspace();
      return state.partnerPermissions;
    } catch (error) {
      state.partnerPermissions = null;
      state.partnerPermissionsError = error;
      if (options.render !== false && state.activeTab === 'partner') renderWorkspace();
      throw error;
    }
  }

  function showPartnerPermissionConflict(assignment, target, conflicts) {
    const rows = Core.asArray(conflicts);
    openModal({
      title: 'Partner access changed before Review',
      body: `<p class="hotel-workspace-safety-note">This exact assignment changed in a different way after the editor opened. Nothing was saved. Compare the fresh values and reopen the editor before preparing another Review.</p>
        <dl class="hotel-workspace-key-values"><div><dt>Partner</dt><dd>${escapeHtml(assignment?.partner?.name || 'Assigned partner')}</dd></div><div><dt>Status</dt><dd>${escapeHtml(assignment?.partner?.status || 'unknown')}</dd></div></dl>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(assignment?.assignment_id || '')}</code><code>${escapeHtml(assignment?.partner_id || '')}</code></details>
        <div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Field</th><th>Originally loaded</th><th>Current</th><th>Requested</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(reviewFieldLabel(row.field))}</th><td>${reviewValueMarkup(row.original, row.field)}</td><td>${reviewValueMarkup(row.current, row.field)}</td><td>${reviewValueMarkup(row.target, row.field)}</td></tr>`).join('')}</tbody></table></div>`,
      footer: '<button class="btn-primary" type="button" data-hotel-modal-close>Close and use fresh values</button>',
    });
  }

  function partnerPermissionReviewOptions(snapshot, assignmentId, targetCapabilities) {
    const assignment = snapshot.assignments.find((entry) => entry.assignment_id === assignmentId);
    if (!assignment) throw new Error('The exact operational assignment no longer exists.');
    const target = Core.normalizeHotelPartnerCapabilities(targetCapabilities);
    const plan = Core.buildPartnerHotelPermissionsPlan(snapshot, assignmentId, target, {
      hotelId: state.workspace.property.id,
    });
    const correlationId = Core.newUuid();
    const idempotencyKey = Core.newUuid();
    return {
      title: 'Review exact Partner & Access permissions',
      entity: 'partner_assignment_permission',
      before: partnerPermissionReviewState(assignment),
      after: partnerPermissionReviewState(assignment, target),
      operation: { entity: 'partner_assignment_permission', type: 'review', id: assignmentId },
      contextMessage: 'Only the permission row for this exact existing Hotel assignment changes. Commercial owner, operational routing, public behavior, feature flags, bookings, prices and payment rules remain unchanged.',
      successMessage: 'Reviewed exact-assignment Partner permissions saved.',
      async onConfirm() {
        const result = await Repository.applyPartnerHotelPermissionsPlan(plan, correlationId, idempotencyKey);
        state.partnerPermissions = result.snapshot;
        state.partnerPermissionsError = null;
        return result;
      },
      async onStaleReview() {
        const fresh = await Repository.getPartnerHotelPermissions(state.workspace.property.id);
        const current = fresh.assignments.find((entry) => entry.assignment_id === assignmentId);
        state.partnerPermissions = fresh;
        state.partnerPermissionsError = null;
        if (!current) {
          const error = new Error('The exact operational assignment was removed after Review. Nothing was saved.');
          error.userMessage = error.message;
          throw error;
        }
        const reconciliation = Core.reconcilePartnerHotelPermission(assignment, current, target);
        if (!reconciliation.safe) {
          const fields = reconciliation.conflicts.map((entry) => entry.field).join(', ');
          const error = new Error(`The fresh assignment differs in reviewed fields: ${fields}.`);
          error.userMessage = `The stale save was stopped. Fresh Partner & Access values differ in ${fields}; reopen the permission editor and review the exact current values.`;
          throw error;
        }
        return {
          ...partnerPermissionReviewOptions(fresh, assignmentId, target),
          reReviewMessage: 'The stale save was stopped. Fresh exact assignment values are shown; review them and click Save again. Nothing was retried automatically.',
        };
      },
    };
  }

  function openPartnerPermissionEditor(assignmentId) {
    const snapshot = state.partnerPermissions;
    const assignment = snapshot?.assignments?.find((entry) => entry.assignment_id === assignmentId);
    if (!assignment) {
      toast('Refresh Partner & Access before editing this exact assignment.', 'error');
      return;
    }
    const current = Core.normalizeHotelPartnerCapabilities(assignment.permission.capabilities);
    const otherWriter = snapshot.assignments.find((entry) => (
      entry.assignment_id !== assignmentId && entry.permission.has_mutation_capability
    ));
    const assignmentCannotReceiveCapability = assignment.assignment_active !== true
      || assignment.partner.can_manage_hotels !== true
      || String(assignment.partner.status || '').toLowerCase() !== 'active';
    openModal({
      title: `Access for ${assignment.partner.name || 'Hotel partner'}`,
      className: 'hotel-workspace-modal--wide',
      body: `<p class="hotel-workspace-intro">Choose explicit capabilities for this exact existing operational assignment. A missing permission row starts with every capability OFF.</p>
        <dl class="hotel-workspace-key-values"><div><dt>Current version</dt><dd>${assignment.permission.version}</dd></div></dl>
        <details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(assignment.assignment_id)}</code><code>${escapeHtml(assignment.partner_id)}</code></details>
        ${otherWriter ? `<p class="hotel-workspace-safety-note">${escapeHtml(otherWriter.partner.name || 'Another assignment')} currently holds mutation access. This assignment may keep status-only access, but mutation access must first be disabled through a separate reviewed save.</p>` : ''}
        ${assignmentCannotReceiveCapability ? '<p class="hotel-workspace-safety-note">This assignment or partner is inactive, suspended, or no longer allowed to manage Hotels. Existing capabilities may be removed, but no capability can be granted or restored.</p>' : ''}
        <form id="hotelPartnerPermissionForm" class="hotel-workspace-form">
          <div class="hotel-partner-capability-grid">${Core.HOTEL_PARTNER_CAPABILITIES.map((key) => {
            const detail = PARTNER_CAPABILITY_DETAILS[key] || [key, ''];
            const isMutation = Core.HOTEL_PARTNER_MUTATION_CAPABILITIES.includes(key);
            const grantBlocked = assignmentCannotReceiveCapability || (Boolean(otherWriter) && isMutation);
            return `<label class="hotel-partner-capability"><input type="checkbox" name="${escapeAttr(key)}" ${current[key] ? 'checked' : ''} ${grantBlocked ? 'data-capability-grant-blocked="true"' : ''}/><span><strong>${escapeHtml(detail[0])}</strong><small>${escapeHtml(detail[1])}</small>${!isMutation ? '<em>Status-only access</em>' : ''}</span></label>`;
          }).join('')}</div>
        </form>
        <p class="hotel-workspace-safety-note">Foundation only: granting a capability does not enable a feature, publish Rooms V2, reveal booking PII or create a Partner workspace. All Hotels V2 flags remain OFF.</p>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelPartnerPermissionForm">Review access</button>',
      onReady(overlay) {
        overlay.querySelectorAll('[data-capability-grant-blocked="true"]').forEach((checkbox) => {
          checkbox.addEventListener('change', () => {
            if (!checkbox.checked) {
              checkbox.dataset.revocationSelected = 'true';
              return;
            }
            if (!current[checkbox.name] || checkbox.dataset.revocationSelected === 'true') {
              checkbox.checked = false;
              toast('This capability cannot be granted to the assignment. Existing access may only be removed.', 'warning');
            }
          });
        });
        overlay.querySelector('#hotelPartnerPermissionForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const target = Object.fromEntries(Core.HOTEL_PARTNER_CAPABILITIES.map((key) => [key, form.elements[key]?.checked === true]));
          const submit = overlay.querySelector('[type="submit"]');
          submit.disabled = true;
          submit.textContent = 'Refreshing…';
          try {
            const fresh = await Repository.getPartnerHotelPermissions(state.workspace.property.id);
            const freshAssignment = fresh.assignments.find((entry) => entry.assignment_id === assignmentId);
            if (!freshAssignment) throw new Error('The exact operational assignment no longer exists.');
            const reconciliation = Core.reconcilePartnerHotelPermission(assignment, freshAssignment, target);
            state.partnerPermissions = fresh;
            state.partnerPermissionsError = null;
            if (!reconciliation.safe) {
              showPartnerPermissionConflict(freshAssignment, target, reconciliation.conflicts);
              return;
            }
            if (JSON.stringify(freshAssignment.permission.capabilities) === JSON.stringify(Core.normalizeHotelPartnerCapabilities(target))) {
              toast('No Partner & Access changes were selected.', 'info');
              submit.disabled = false;
              submit.textContent = 'Review access';
              return;
            }
            await openReview(partnerPermissionReviewOptions(fresh, assignmentId, target));
          } catch (error) {
            toast(error?.userMessage || error?.message || 'Could not prepare fresh Partner & Access Review.', 'error');
            if (state.modal === overlay) {
              submit.disabled = false;
              submit.textContent = 'Review access';
            }
          }
        });
      },
    });
  }

  function operationalAssignmentPartner(partnerId, assignment = null) {
    const exactId = Core.normalizeUuid(partnerId);
    const workspacePartner = state.workspace.partners.find((partner) => Core.normalizeUuid(partner.id) === exactId);
    const embedded = Core.asObject(assignment?.partner);
    return {
      id: exactId,
      name: workspacePartner?.name || workspacePartner?.company_name || embedded.name
        || assignment?.partner_name || assignment?.name || exactId,
      status: workspacePartner?.status || embedded.status || assignment?.partner_status || assignment?.status || 'unknown',
      can_manage_hotels: workspacePartner?.can_manage_hotels ?? embedded.can_manage_hotels
        ?? assignment?.can_manage_hotels ?? false,
    };
  }

  function operationalAssignmentReviewState(type, assignmentId, partner, staffScopeCount = 0, permissionExists = false, capabilities = {}) {
    const enabledCapabilities = enabledPartnerCapabilities(capabilities).map(partnerCapabilityLabel);
    return {
      action: type === 'assign' ? 'Assign operational Partner' : 'Remove operational Partner',
      partner: partner.name,
      assignment_status: type === 'assign' ? 'Will be assigned' : 'Will be removed',
      staff_hotel_scopes: type === 'assign' ? 'No scope granted automatically' : `${staffScopeCount} exact Hotel staff scope${staffScopeCount === 1 ? '' : 's'} will be revoked`,
      capability_permission: type === 'assign'
        ? 'No capability row or capability is granted automatically'
        : (permissionExists
          ? `The exact H3.2A permission row will be removed · ${enabledCapabilities.length ? enabledCapabilities.join(', ') : 'all capabilities currently OFF'}`
          : 'No H3.2A permission row exists'),
      historical_fulfillment_routing: 'Unchanged',
      exact_assignment_id: assignmentId,
      exact_partner_id: partner.id,
    };
  }

  function operationalAssignmentConflict(errorState) {
    const { type, operation, current, partner, freshContentControl, reviewedCapabilities } = errorState;
    state.contentControl = freshContentControl;
    state.contentControlError = null;
    const canReviewFreshRemoval = type === 'remove' && current?.partner_id === operation.partner_id;
    openModal({
      title: 'Operational assignment changed before Save',
      className: 'hotel-workspace-modal--wide hotel-workspace-modal--review',
      body: `<div class="hotel-review-summary"><p>A real assignment or cascade-scope change occurred after Review. Nothing was removed, assigned or retried.</p><dl><div><dt>Partner</dt><dd>${escapeHtml(partner.name)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(partner.status || 'unknown')}</dd></div></dl></div>
        <div class="hotel-review-table-wrap"><table class="hotel-review-table"><thead><tr><th>Field</th><th>Originally reviewed</th><th>Current</th></tr></thead><tbody>
          <tr><th>Staff Hotel scopes</th><td>${Number(operation.expected_staff_scope_count)}</td><td>${current ? Number(current.staff_scope_count || 0) : 'Assignment removed'}</td></tr>
          <tr><th>H3.2A permission row</th><td>${operation.expected_permission_exists ? 'Present · removal reviewed' : 'Absent'}</td><td>${current ? (current.permission_exists ? 'Present' : 'Absent') : 'Assignment removed'}</td></tr>
          <tr><th>Enabled capabilities</th><td>${enabledPartnerCapabilities(reviewedCapabilities).map(partnerCapabilityLabel).map(escapeHtml).join(', ') || 'None'}</td><td>${current ? (enabledPartnerCapabilities(current.permission?.capabilities).map(partnerCapabilityLabel).map(escapeHtml).join(', ') || 'None') : 'Assignment removed'}</td></tr>
        </tbody></table></div><details class="hotel-review-diagnostics"><summary>Exact cascade diagnostics</summary><div><span>Assignment and Partner IDs</span><code>${escapeHtml(operation.assignment_id)}</code><code>${escapeHtml(operation.partner_id)}</code></div><div><span>Originally reviewed staff scope IDs</span>${Core.asArray(operation.expected_staff_scope_ids).map((id) => `<code>${escapeHtml(id)}</code>`).join('') || '<code>None</code>'}</div><div><span>Current staff scope IDs</span>${Core.asArray(current?.staff_scope_ids).map((id) => `<code>${escapeHtml(id)}</code>`).join('') || '<code>None</code>'}</div></details>
        <p class="hotel-workspace-safety-note">Historical fulfillment routing is not rewritten. ${canReviewFreshRemoval ? 'Review current cascade builds a new explicit Review with the fresh staff-scope count; it does not save automatically.' : 'Close and use the fresh Partner & Access state.'}</p>`,
      footer: `<button class="btn-secondary" type="button" data-assignment-conflict-keep>Keep current</button>${canReviewFreshRemoval ? '<button class="btn-primary" type="button" data-assignment-conflict-review>Review current cascade</button>' : ''}`,
      onReady(overlay) {
        overlay.querySelector('[data-assignment-conflict-keep]')?.addEventListener('click', () => {
          closeModal({ force: true });
          renderWorkspace();
        });
        overlay.querySelector('[data-assignment-conflict-review]')?.addEventListener('click', async () => {
          closeModal({ restoreFocus: false, skipCleanup: true, force: true });
          await openReview(operationalAssignmentReviewOptions(freshContentControl, {
            type: 'remove',
            assignment_id: current.assignment_id,
            partner_id: current.partner_id,
          }, { afterStale: true }));
        });
      },
    });
  }

  function operationalAssignmentReviewOptions(contentControl, operationValue, options = {}) {
    const snapshot = Core.normalizeOperationalAssignmentSnapshot(contentControl, state.workspace.property.id);
    const operation = {
      type: String(operationValue.type || ''),
      assignment_id: Core.normalizeUuid(operationValue.assignment_id),
      partner_id: Core.normalizeUuid(operationValue.partner_id),
    };
    const current = snapshot.assignments.find((assignment) => assignment.assignment_id === operation.assignment_id);
    const partner = operationalAssignmentPartner(operation.partner_id, current);
    const plan = Core.buildOperationalAssignmentPlan(contentControl, operation, {
      hotelId: state.workspace.property.id,
    });
    const correlationId = Core.newUuid();
    const staffScopeCount = Number(plan.operation.expected_staff_scope_count || 0);
    const permissionExists = plan.operation.expected_permission_exists === true;
    const capabilities = current?.permission?.capabilities || {};
    const enabledCapabilities = enabledPartnerCapabilities(capabilities).map(partnerCapabilityLabel);
    const neutral = operationalAssignmentReviewState(operation.type, operation.assignment_id, partner, 0, false);
    const changed = operationalAssignmentReviewState(operation.type, operation.assignment_id, partner, staffScopeCount, permissionExists, capabilities);
    const beforeState = operation.type === 'assign'
      ? {
        ...neutral,
        assignment_status: 'Not assigned',
        staff_hotel_scopes: 'No operational assignment',
        capability_permission: 'No operational assignment',
      }
      : {
        ...changed,
        assignment_status: 'Currently assigned',
        staff_hotel_scopes: `${staffScopeCount} exact Hotel staff scope${staffScopeCount === 1 ? '' : 's'} currently attached`,
        capability_permission: permissionExists
          ? `Current enabled capabilities: ${enabledCapabilities.length ? enabledCapabilities.join(', ') : 'None (row exists with all capabilities OFF)'}`
          : 'No H3.2A permission row exists',
      };
    return {
      title: options.afterStale ? 'Review fresh operational assignment' : 'Review operational Partner assignment',
      entity: 'operational_assignment',
      before: beforeState,
      after: changed,
      operation: { entity: 'operational_assignment', type: 'review', id: operation.assignment_id },
      contextMessage: operation.type === 'remove'
        ? `Removal revokes exactly ${staffScopeCount} staff Hotel scope${staffScopeCount === 1 ? '' : 's'}${permissionExists ? ` and the assignment capability row (${enabledCapabilities.length ? enabledCapabilities.join(', ') : 'all capabilities OFF'})` : ''}. Historical bookings and fulfillment routing are never rewritten.`
        : 'This creates only the exact operational assignment. Staff scope remains deny-by-default and every H3.2A capability remains OFF until separately reviewed.',
      diagnostics: [
        { label: 'Exact assignment ID', value: operation.assignment_id },
        { label: 'Exact Partner ID', value: operation.partner_id },
        { label: 'Exact staff scope IDs', values: plan.operation.expected_staff_scope_ids },
        ...(current?.permission?.version ? [{ label: 'Capability permission version', value: current.permission.version }] : []),
      ],
      reReviewMessage: 'The stale assignment save was stopped. Fresh assignment scope is shown; inspect it and explicitly Save again. Nothing was retried automatically.',
      successMessage: operation.type === 'assign' ? 'Operational Partner assigned with zero automatic capabilities.' : 'Operational Partner assignment removed without rewriting historical fulfillment routing.',
      async onConfirm() {
        const result = await Repository.applyOperationalAssignmentPlan(plan, correlationId);
        state.contentControl = result.content_control;
        state.contentControlError = null;
        state.partnerPermissions = null;
        state.partnerPermissionsError = null;
        const refreshed = await Promise.allSettled([
          Repository.getWorkspace(state.workspace.property.id),
          Repository.getPartnerHotelPermissions(state.workspace.property.id),
        ]);
        if (refreshed[0].status === 'fulfilled') state.workspace = refreshed[0].value;
        else console.warn('Operational assignment saved; Property Workspace refresh will be retried when reopened.', refreshed[0].reason);
        if (refreshed[1].status === 'fulfilled') state.partnerPermissions = refreshed[1].value;
        else {
          state.partnerPermissionsError = refreshed[1].reason;
          console.warn('Operational assignment saved; Partner permission snapshot refresh will be retried.', refreshed[1].reason);
        }
        return result;
      },
      async onStaleReview() {
        const fresh = await Repository.getContentControl(state.workspace.property.id);
        state.contentControl = fresh;
        state.contentControlError = null;
        const freshSnapshot = Core.normalizeOperationalAssignmentSnapshot(fresh, state.workspace.property.id);
        const freshAssignment = freshSnapshot.assignments.find((assignment) => assignment.assignment_id === operation.assignment_id);
        if (operation.type === 'assign') {
          const partnerAssignment = freshSnapshot.assignments.find((assignment) => assignment.partner_id === operation.partner_id);
          if (freshAssignment || partnerAssignment) {
            const conflict = new Error('The selected Partner was assigned after Review.');
            conflict.userMessage = 'A genuine operational-assignment conflict was stopped. Fresh assignments are shown; nothing was saved or retried.';
            conflict.closeReviewAfterStale = true;
            conflict.openOperationalAssignmentConflict = {
              type: operation.type, operation: plan.operation, current: freshAssignment || partnerAssignment,
              partner, freshContentControl: fresh, reviewedCapabilities: current?.permission?.capabilities || {},
            };
            throw conflict;
          }
        } else {
          if (!freshAssignment) {
            const removed = new Error('The exact operational assignment was already removed after Review. No retry was attempted.');
            removed.userMessage = removed.message;
            removed.closeReviewAfterStale = true;
            throw removed;
          }
          const expectedScopeIds = Core.asArray(plan.operation.expected_staff_scope_ids).slice().sort();
          const freshScopeIds = Core.asArray(freshAssignment.staff_scope_ids).slice().sort();
          const originalCapabilities = Core.normalizeHotelPartnerCapabilities(current?.permission?.capabilities);
          const freshCapabilities = Core.normalizeHotelPartnerCapabilities(freshAssignment.permission?.capabilities);
          if (freshAssignment.partner_id !== operation.partner_id
              || Number(freshAssignment.staff_scope_count || 0) !== staffScopeCount
              || JSON.stringify(freshScopeIds) !== JSON.stringify(expectedScopeIds)
              || (freshAssignment.permission_exists === true) !== permissionExists
              || JSON.stringify(freshCapabilities) !== JSON.stringify(originalCapabilities)) {
            const conflict = new Error('The exact assignment cascade changed after Review.');
            conflict.userMessage = 'A genuine operational-assignment cascade conflict was stopped. Compare the fresh staff scopes and capability row before preparing another Save.';
            conflict.closeReviewAfterStale = true;
            conflict.openOperationalAssignmentConflict = {
              type: operation.type, operation: plan.operation, current: freshAssignment,
              partner: operationalAssignmentPartner(operation.partner_id, freshAssignment), freshContentControl: fresh,
              reviewedCapabilities: current?.permission?.capabilities || {},
            };
            throw conflict;
          }
        }
        return operationalAssignmentReviewOptions(fresh, operation, { afterStale: true });
      },
    };
  }

  function openOperationalAssignmentEditor() {
    if (!state.contentControl?.assignment_snapshot) {
      toast('Secure operational-assignment snapshot is unavailable.', 'error');
      return;
    }
    const snapshot = Core.normalizeOperationalAssignmentSnapshot(state.contentControl, state.workspace.property.id);
    const assignedPartners = new Set(snapshot.assignments.map((assignment) => assignment.partner_id));
    const candidates = state.workspace.partners.filter((partner) => (
      !assignedPartners.has(Core.normalizeUuid(partner.id))
      && String(partner.status || '').toLowerCase() === 'active'
      && partner.can_manage_hotels === true
    ));
    if (!candidates.length) {
      toast('Every eligible Hotel Partner is already assigned, or no active Hotel Partner is available.', 'info');
      return;
    }
    openModal({
      title: 'Assign operational Partner',
      body: `<form id="hotelOperationalAssignmentForm" class="hotel-workspace-form"><p class="hotel-workspace-intro">Choose one exact active Hotel Partner. Commercial ownership stays unchanged. No staff scope or capability is granted automatically.</p><label class="admin-form-field"><span>Operational Partner</span><select name="partner_id" required><option value="">Choose Partner</option>${candidates.map((partner) => `<option value="${escapeAttr(partner.id)}">${escapeHtml(partner.name || partner.company_name || partner.id)}</option>`).join('')}</select></label></form>`,
      footer: '<button class="btn-secondary" type="button" data-hotel-modal-close>Cancel</button><button class="btn-primary" type="submit" form="hotelOperationalAssignmentForm">Review assignment</button>',
      onReady(overlay) {
        overlay.querySelector('#hotelOperationalAssignmentForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const partnerId = Core.normalizeUuid(new FormData(event.currentTarget).get('partner_id'));
          if (!partnerId) return toast('Choose an exact operational Partner.', 'error');
          closeModal({ restoreFocus: false });
          try {
            await openReview(operationalAssignmentReviewOptions(state.contentControl, {
              type: 'assign', assignment_id: Core.newUuid(), partner_id: partnerId,
            }));
          } catch (error) {
            toast(error?.userMessage || error?.message || 'Operational assignment could not be prepared for Review.', 'error');
          }
        });
      },
    });
  }

  async function reviewOperationalAssignmentRemoval(assignmentId) {
    try {
      const fresh = await Repository.getContentControl(state.workspace.property.id);
      state.contentControl = fresh;
      state.contentControlError = null;
      const snapshot = Core.normalizeOperationalAssignmentSnapshot(fresh, state.workspace.property.id);
      const assignment = snapshot.assignments.find((entry) => entry.assignment_id === Core.normalizeUuid(assignmentId));
      if (!assignment) throw new Error('The exact operational assignment no longer exists.');
      await openReview(operationalAssignmentReviewOptions(fresh, {
        type: 'remove', assignment_id: assignment.assignment_id, partner_id: assignment.partner_id,
      }));
    } catch (error) {
      toast(error?.userMessage || error?.message || 'Operational assignment could not be prepared for Review.', 'error');
    }
  }

  function renderPartnerPanel(panel) {
    const property = state.workspace.property;
    const owner = Core.asObject(property.owner_partner);
    let assignmentControl = null;
    try {
      assignmentControl = state.contentControl
        ? Core.normalizeOperationalAssignmentSnapshot(state.contentControl, property.id)
        : null;
    } catch (error) {
      state.contentControlError = error;
    }
    const assignments = assignmentControl?.assignments || [];
    const permissionSnapshot = state.partnerPermissions;
    const permissionsError = state.partnerPermissionsError;
    const permissionSection = permissionsError
      ? `<section class="hotel-workspace-card hotel-placeholder-card hotel-property-empty--error"><span class="hotel-workspace-eyebrow">Partner capabilities</span><h4>Secure permission snapshot unavailable</h4><p>${escapeHtml(permissionsError.userMessage || permissionsError.message || 'Partner permissions could not be loaded.')}</p><button class="btn-secondary" type="button" data-retry-partner-permissions>Retry secure load</button></section>`
      : permissionSnapshot
        ? `<section class="hotel-workspace-card hotel-workspace-card--wide"><span class="hotel-workspace-eyebrow">Reviewed exact-assignment capabilities</span><h4>${permissionSnapshot.assignments.length} exact assignment${permissionSnapshot.assignments.length === 1 ? '' : 's'}</h4><p>Capabilities are denied by default and attach only to the selected existing assignment. They never create or reroute an assignment.</p>${permissionSnapshot.assignments.length ? `<div class="hotel-partner-permission-list">${permissionSnapshot.assignments.map((assignment) => {
          const enabled = enabledPartnerCapabilities(assignment.permission.capabilities);
          return `<article class="hotel-partner-permission-card"><div><strong>${escapeHtml(assignment.partner.name || 'Assigned partner')}</strong><small>${escapeHtml(assignment.partner.status)} · ${assignment.assignment_active ? 'Active assignment' : 'Inactive assignment'} · Permission v${assignment.permission.version}</small></div><div class="hotel-partner-capability-chips">${enabled.length ? enabled.map((key) => `<span>${escapeHtml(partnerCapabilityLabel(key))}</span>`).join('') : '<span class="is-empty">All capabilities OFF</span>'}</div><button class="btn-secondary" type="button" data-edit-partner-permission="${escapeAttr(assignment.assignment_id)}">Review access</button><details class="hotel-review-diagnostics"><summary>Assignment diagnostics</summary><code>${escapeHtml(assignment.assignment_id)}</code><code>${escapeHtml(assignment.partner_id)}</code></details></article>`;
        }).join('')}</div>` : '<div class="hotel-property-empty"><p>No active exact Hotel assignment is available for capability review.</p></div>'}<p class="hotel-workspace-safety-note">Partner access remains foundation-only. Public Hotels V2 and all four capability flags remain OFF.</p></section>`
        : '<section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Partner capabilities</span><h4>Loading secure snapshot…</h4><p>No capability editor is available until the exact assignment snapshot is verified.</p></section>';
    panel.innerHTML = `${workspacePanelHeader('Partner & Access', 'Commercial ownership, operational routing and reviewed exact-assignment capabilities remain separate.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Commercial owner</span><h4>${escapeHtml(owner.name || 'Not assigned')}</h4><p>${owner.id ? `Status: ${escapeHtml(owner.status || 'unknown')}` : 'Assign an active commercial owner from Overview if required.'}</p>${owner.id ? `<details class="hotel-review-diagnostics"><summary>Technical diagnostics</summary><code>${escapeHtml(owner.id)}</code></details>` : ''}</section>
      <section class="hotel-workspace-card hotel-workspace-card--wide"><div class="hotel-workspace-card-heading"><div><span class="hotel-workspace-eyebrow">Operational assignments</span><h4>${assignmentControl ? `${assignments.length} assignment${assignments.length === 1 ? '' : 's'}` : 'Secure snapshot unavailable'}</h4></div>${assignmentControl ? '<button class="btn-primary" type="button" data-add-operational-assignment>Assign Partner</button>' : ''}</div>${assignmentControl ? (assignments.length ? `<div class="hotel-operational-assignment-list">${assignments.map((entry) => {
        const partner = operationalAssignmentPartner(entry.partner_id, entry);
        return `<article><div><strong>${escapeHtml(partner.name)}</strong><small>${escapeHtml(partner.status)} · ${Number(entry.staff_scope_count || 0)} staff Hotel scope${Number(entry.staff_scope_count || 0) === 1 ? '' : 's'} · ${entry.permission_exists ? 'Capability row present' : 'All capabilities default OFF'}</small></div><button class="btn-secondary" type="button" data-remove-operational-assignment="${escapeAttr(entry.assignment_id)}">Review removal</button><details class="hotel-review-diagnostics"><summary>Assignment diagnostics</summary><code>${escapeHtml(entry.assignment_id)}</code><code>${escapeHtml(entry.partner_id)}</code></details></article>`;
      }).join('')}</div>` : '<div class="hotel-property-empty"><p>No operational Partner assignment.</p></div>') : `<p class="hotel-workspace-safety-note">${escapeHtml(state.contentControlError?.message || 'Apply the reviewed ADMIN-B content-control foundation before assignments can be managed.')}</p>`}<small>Commercial ownership is separate. Assignment saves are future-routing only and never rewrite historical fulfillment rows.</small></section>
      ${permissionSection}</div>`;
    panel.querySelector('[data-retry-partner-permissions]')?.addEventListener('click', () => {
      void refreshPartnerPermissions().catch((error) => toast(error?.userMessage || error?.message, 'error'));
    });
    panel.querySelectorAll('[data-edit-partner-permission]').forEach((button) => {
      button.addEventListener('click', () => openPartnerPermissionEditor(button.dataset.editPartnerPermission));
    });
    panel.querySelector('[data-add-operational-assignment]')?.addEventListener('click', openOperationalAssignmentEditor);
    panel.querySelectorAll('[data-remove-operational-assignment]').forEach((button) => {
      button.addEventListener('click', () => void reviewOperationalAssignmentRemoval(button.dataset.removeOperationalAssignment));
    });
  }

  function renderDistributionPanel(panel) {
    const flags = state.workspace.flags;
    const flagRows = ['hotel_rooms_v2_enabled', 'hotel_external_sync_enabled', 'hotel_instant_booking_enabled', 'hotel_stripe_connect_enabled'];
    const h3 = state.h3Configuration ? Core.normalizeH3Configuration(state.h3Configuration) : null;
    const manual = h3?.calendar_sources.find((entry) => entry.source_type === 'manual' && entry.is_enabled);
    panel.innerHTML = `${workspacePanelHeader('Distribution & Sync', 'A manual availability adapter is reviewable in H3.1; external providers remain inert.')}
      <div class="hotel-workspace-summary-grid"><section class="hotel-workspace-card"><span class="hotel-workspace-eyebrow">Availability source</span><h4>${manual ? 'Manual Calendar configured' : 'Manual source not configured'}</h4><p>Future server availability will read through an adapter seam. H3.1 creates no Booking.com, Airbnb or iCal network behavior.</p><button class="btn-secondary" type="button" data-open-h3-distribution-setup>Open Booking setup</button></section>
      <section class="hotel-workspace-card hotel-placeholder-card"><span class="hotel-workspace-eyebrow">Capability status</span><h4>All Hotels V2 capabilities must remain off</h4><ul class="hotel-simple-list">${flagRows.map((key) => `<li><span>${escapeHtml(key.replaceAll('_', ' '))}</span><strong>${flags[key] === true ? 'ON — unexpected' : 'OFF'}</strong></li>`).join('')}</ul><p>External sync, instant booking and Stripe Connect remain disabled.</p></section></div>`;
    panel.querySelector('[data-open-h3-distribution-setup]')?.addEventListener('click', () => { state.activeTab = 'booking_setup'; renderWorkspace(); });
  }

  function renderActivityPanel(panel) {
    const activity = state.workspace.activity;
    panel.innerHTML = `${workspacePanelHeader('Activity', 'Immutable reviewed changes written through the Hotel Admin control plane.')}
      <section class="hotel-workspace-card">${activity.length ? `<ol class="hotel-activity-list">${activity.map((entry) => `<li><span><strong>${escapeHtml(String(entry.action || '').replaceAll('_', ' '))}</strong><small>${escapeHtml(entry.entity_type || 'entity')} · ${escapeHtml(entry.source || 'admin')}</small></span><time datetime="${escapeAttr(entry.created_at)}">${escapeHtml(new Date(entry.created_at).toLocaleString())}</time></li>`).join('')}</ol>` : renderEmptyState('No reviewed Hotel activity yet', 'Reviewed normalized saves will appear here.')}</section>`;
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
