(function registerCarRentalMulticityAdmin(root) {
  'use strict';

  let singleton = null;

  function create(options = {}) {
    const documentRef = options.document || root.document;
    const core = options.core || root.CarRentalMulticityCore;
    const repository = options.repository;
    if (!documentRef || !core || !repository) throw new Error('Car multi-city Admin dependencies are required');

    const state = {
      initialized: false,
      open: false,
      mode: null,
      screen: 'edit',
      context: null,
      draft: null,
      plan: null,
      outcome: null,
      loading: false,
      executing: false,
      executionPromise: null,
      returnFocus: null,
      confirmationOpen: false,
      pendingConfirmation: null,
      catalogOpen: false,
      catalog: null,
      catalogTab: 'cities',
      catalogSearch: '',
      cityEditor: null,
      uploadProgress: 0,
    };
    let pendingImageFile = null;
    let pendingImagePreviewUrl = '';

    const byId = (id) => documentRef.getElementById(id);
    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const adminLanguage = () => core.normalizeCode(documentRef.documentElement?.lang || 'en') || 'en';
    const labelI18n = (value) => core.resolveI18nText(value, adminLanguage());
    const money = (value) => value === null || value === undefined || value === '' ? '—' : `€${Number(value).toFixed(2)}`;

    function announce(message, kind = 'status') {
      const element = byId('carMulticityModalStatus');
      if (element) {
        element.dataset.kind = kind;
        element.textContent = String(message || '');
      }
    }

    function toast(message, kind = 'info') {
      if (typeof options.showToast === 'function') options.showToast(String(message || ''), kind);
    }

    function focusElement(element) {
      root.requestAnimationFrame?.(() => element?.focus?.());
      if (!root.requestAnimationFrame) element?.focus?.();
    }

    function focusables(container) {
      return Array.from(container?.querySelectorAll?.(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || []).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    }

    function trapFocus(event, container) {
      if (event.key !== 'Tab') return;
      const items = focusables(container);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function setBusy(isBusy) {
      state.executing = isBusy;
      const modal = byId('carMulticityModal');
      modal?.querySelectorAll?.('button,input,select,textarea').forEach((element) => {
        if (element.closest('#carMulticityConfirmDialog')) return;
        element.disabled = isBusy;
        element.setAttribute('aria-disabled', isBusy ? 'true' : 'false');
      });
      const save = byId('carMulticitySave');
      if (save) {
        const canSave = !isBusy && state.screen === 'review' && core.isReviewCurrent(state.draft, state.plan) && state.plan?.steps?.length > 0;
        save.disabled = !canSave;
        save.setAttribute('aria-disabled', canSave ? 'false' : 'true');
      }
    }

    function clearPendingImageFile() {
      if (pendingImagePreviewUrl) root.URL?.revokeObjectURL?.(pendingImagePreviewUrl);
      pendingImageFile = null;
      pendingImagePreviewUrl = '';
      state.uploadProgress = 0;
    }

    function resetState() {
      clearPendingImageFile();
      state.open = false;
      state.mode = null;
      state.screen = 'edit';
      state.context = null;
      state.draft = null;
      state.plan = null;
      state.outcome = null;
      state.loading = false;
      state.executing = false;
      state.executionPromise = null;
      state.confirmationOpen = false;
      state.pendingConfirmation = null;
    }

    function closeImmediately() {
      if (state.executing) return false;
      closeConfirmation();
      const modal = byId('carMulticityModal');
      if (modal) modal.hidden = true;
      documentRef.body?.classList?.remove('car-multicity-modal-open');
      const returnTarget = state.returnFocus;
      resetState();
      state.returnFocus = null;
      focusElement(returnTarget);
      return true;
    }

    function closeCatalog() {
      if (state.executing) return false;
      const modal = byId('carMulticityCatalogModal');
      if (modal) modal.hidden = true;
      state.catalogOpen = false;
      state.catalog = null;
      state.catalogSearch = '';
      state.cityEditor = null;
      focusElement(state.returnFocus);
      state.returnFocus = null;
      return true;
    }

    function handleKeydown(event) {
      if (state.confirmationOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeConfirmation();
          return;
        }
        trapFocus(event, byId('carMulticityConfirmDialog'));
        return;
      }
      if (state.catalogOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCatalog();
          return;
        }
        trapFocus(event, byId('carMulticityCatalogModal'));
        return;
      }
      if (!state.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeImmediately();
        return;
      }
      trapFocus(event, byId('carMulticityModal'));
    }

    function profileSummary(profile) {
      if (!profile) return '<p class="car-multicity-warning">No exact pricing profile selected.</p>';
      const columns = core.PROFILE_PRICE_COLUMNS[core.normalizeCode(profile.code)] || [];
      return `
        <dl class="car-multicity-summary-grid">
          <div><dt>Profile code</dt><dd>${escapeHtml(profile.code)}</dd></div>
          <div><dt>Calculator key</dt><dd>${escapeHtml(profile.calculator_key)}</dd></div>
          <div><dt>Legacy booking location</dt><dd>${escapeHtml(profile.legacy_booking_location)}</dd></div>
          <div><dt>Existing price fields used</dt><dd>${columns.map(escapeHtml).join(', ') || '—'}</dd></div>
        </dl>
        <p class="car-multicity-note">Changing the profile preserves every existing price column. No values are copied, reset, or defaulted.</p>
      `;
    }

    function renderHeader() {
      const title = byId('carMulticityModalTitle');
      if (!title) return;
      const labels = {
        vehicle: 'Edit vehicle',
        availability: 'Pickup and return availability',
        pricing: 'Pricing and profile',
        partner: 'Partner assignment',
        create: 'Add new vehicle',
      };
      title.textContent = labels[state.mode] || 'Car rental configuration';
      const exact = byId('carMulticityExactOfferId');
      if (exact) exact.textContent = state.draft?.offerId || 'Assigned by database after create';
    }

    function i18nInput(prefix, label, value, textarea = false) {
      const values = value && typeof value === 'object' ? value : { en: value || '' };
      const fields = ['pl', 'en', 'he'].map((language) => {
        const id = `${String(prefix).replace(/\./g, '-')}-${language}`;
        const control = textarea
          ? `<textarea id="${id}" data-i18n-field="${escapeHtml(prefix)}" data-language="${language}" rows="3">${escapeHtml(values[language] || '')}</textarea>`
          : `<input id="${id}" data-i18n-field="${escapeHtml(prefix)}" data-language="${language}" value="${escapeHtml(values[language] || '')}">`;
        return `<label class="admin-form-field"><span>${escapeHtml(label)} (${language.toUpperCase()})</span>${control}</label>`;
      }).join('');
      return `<div class="car-multicity-i18n-grid">${fields}</div>`;
    }

    function renderVehicleMedia() {
      const media = state.draft.media || { action: 'unchanged', currentUrl: '', pendingFile: null };
      const currentUrl = String(media.currentUrl || '');
      const hasCurrent = Boolean(currentUrl);
      const hasPending = ['added', 'replaced'].includes(media.action) && Boolean(media.pendingFile);
      return `
        <section class="car-multicity-media-card" aria-labelledby="carMulticityMediaHeading">
          <div class="car-multicity-section-heading">
            <div><h5 id="carMulticityMediaHeading">Vehicle photo</h5><p>JPG, JPEG, PNG or WEBP · maximum 5 MB · stored in the existing <code>${escapeHtml(core.VEHICLE_IMAGE_BUCKET)}</code> bucket.</p></div>
            <span class="car-multicity-image-action is-${escapeHtml(media.action)}">${escapeHtml(media.action)}</span>
          </div>
          <div class="car-multicity-media-grid">
            <figure class="car-multicity-image-preview">
              <figcaption>Current image</figcaption>
              ${hasCurrent ? `<img src="${escapeHtml(currentUrl)}" alt="Current vehicle">` : '<div class="car-multicity-image-placeholder" aria-label="No current vehicle image">No image</div>'}
              ${media.action === 'removed' ? '<strong class="car-multicity-image-removed">Will be removed from this offer</strong>' : ''}
            </figure>
            <div class="car-multicity-image-dropzone" data-image-dropzone="true" role="group" aria-describedby="carMulticityImageHelp">
              <input id="carMulticityImageFile" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden>
              <div class="car-multicity-dropzone-copy">
                <strong>${hasPending ? 'New image selected' : 'Drop image here'}</strong>
                <span id="carMulticityImageHelp">or choose a file from this device</span>
                ${media.pendingFile ? `<small>${escapeHtml(media.pendingFile.name)} · ${escapeHtml((Number(media.pendingFile.size) / 1024 / 1024).toFixed(2))} MB</small>` : ''}
              </div>
              <button type="button" class="btn-secondary" data-media-action="select">${hasCurrent || hasPending ? 'Replace image' : 'Select image'}</button>
            </div>
            ${hasPending ? `<figure class="car-multicity-image-preview"><figcaption>New image before Save</figcaption><img src="${escapeHtml(pendingImagePreviewUrl)}" alt="New vehicle preview"></figure>` : ''}
          </div>
          <div class="car-multicity-media-actions">
            ${hasCurrent && media.action !== 'removed' ? '<button type="button" class="btn-secondary" data-media-action="remove">Remove image</button>' : ''}
            ${media.action !== 'unchanged' ? '<button type="button" class="btn-secondary" data-media-action="undo">Undo image change</button>' : ''}
          </div>
          <div class="car-multicity-upload-progress" id="carMulticityImageUploadProgress" ${state.uploadProgress > 0 ? '' : 'hidden'}>
            <div role="progressbar" aria-label="Vehicle image upload" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeHtml(state.uploadProgress)}"><span id="carMulticityImageUploadBar" style="width:${escapeHtml(state.uploadProgress)}%"></span></div>
            <span id="carMulticityImageUploadStatus">${state.uploadProgress >= 100 ? 'Upload complete' : 'Waiting to upload on Save'}</span>
          </div>
        </section>
      `;
    }

    function depositModeLabel(mode) {
      const labels = {
        per_day: 'Per day',
        per_person: 'Per person',
        flat: 'Fixed amount',
        percent_total: 'Percent of total',
        per_hour: 'Per hour',
      };
      return labels[core.normalizeCode(mode)] || String(mode || 'Not configured');
    }

    function renderDepositSummary() {
      const defaultRule = state.context?.depositRule || null;
      const override = state.draft?.offerId ? state.context?.depositOverride || null : null;
      const effective = override || defaultRule;
      const source = override ? 'Exact offer override' : defaultRule ? 'Cars default rule' : 'No Cars rule found';
      return `
        <section class="car-multicity-deposit-card" aria-labelledby="carMulticityDepositHeading">
          <div class="car-multicity-section-heading">
            <div><h5 id="carMulticityDepositHeading">Payment due at booking</h5><p>Read-only preview from Deposit settings. <code>car_offers.deposit_amount</code> is not used as the operational source here.</p></div>
            <span class="car-multicity-readonly-badge">Read only</span>
          </div>
          <dl class="car-multicity-summary-grid">
            <div><dt>Effective source</dt><dd>${escapeHtml(source)}</dd></div>
            <div><dt>Mode</dt><dd>${escapeHtml(depositModeLabel(effective?.mode))}</dd></div>
            <div><dt>Value</dt><dd>${effective ? `${escapeHtml(effective.amount)} ${escapeHtml(effective.currency || 'EUR')}` : '—'}</dd></div>
            <div><dt>Enabled</dt><dd>${effective ? (effective.enabled ? 'Yes' : 'No') : '—'}</dd></div>
            <div><dt>Exact override</dt><dd>${override ? `<code>${escapeHtml(override.id)}</code>` : state.draft?.offerId ? 'None' : 'Available after exact offer ID is created'}</dd></div>
            <div><dt>Include children</dt><dd>${effective ? (effective.include_children ? 'Yes' : 'No') : '—'}</dd></div>
          </dl>
          ${core.normalizeCode(effective?.mode) === 'per_day' ? '<p class="car-multicity-note">The final payment due at booking depends on the reservation length.</p>' : ''}
          <button type="button" class="btn-secondary" data-media-action="manage-deposit">Manage deposit settings</button>
        </section>
      `;
    }

    function renderVehicleFields(includeContent = true) {
      const kinds = state.context?.vehicleKinds || [];
      const vehicle = state.draft.vehicle;
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityVehicleHeading">
          <h4 id="carMulticityVehicleHeading">Vehicle</h4>
          <p class="car-multicity-exact-id"><strong>Exact car_offers.id:</strong> ${escapeHtml(state.draft.offerId || 'created on Save')}</p>
          <div class="car-multicity-form-grid">
            <label class="admin-form-field"><span>Vehicle kind</span>
              <select data-draft-field="vehicle.vehicleKindId" id="carMulticityVehicleKind">
                ${kinds.map((kind) => `<option value="${escapeHtml(kind.id)}" ${core.normalizeId(kind.id) === core.normalizeId(vehicle.vehicleKindId) ? 'selected' : ''} ${kind.is_active !== true ? 'disabled' : ''}>${escapeHtml(labelI18n(kind.name_i18n) || kind.code)} (${escapeHtml(kind.code)})</option>`).join('')}
              </select>
            </label>
            <label class="admin-form-field"><span>Transmission</span><select data-draft-field="vehicle.transmission"><option value="manual" ${vehicle.transmission === 'manual' ? 'selected' : ''}>Manual</option><option value="automatic" ${vehicle.transmission === 'automatic' ? 'selected' : ''}>Automatic</option></select></label>
            <label class="admin-form-field"><span>Fuel</span><select data-draft-field="vehicle.fuelType"><option value="petrol" ${vehicle.fuelType === 'petrol' ? 'selected' : ''}>Petrol</option><option value="diesel" ${vehicle.fuelType === 'diesel' ? 'selected' : ''}>Diesel</option><option value="hybrid" ${vehicle.fuelType === 'hybrid' ? 'selected' : ''}>Hybrid</option><option value="electric" ${vehicle.fuelType === 'electric' ? 'selected' : ''}>Electric</option></select></label>
            <label class="admin-form-field"><span>Passengers</span><input type="number" min="1" data-number="integer" data-draft-field="vehicle.maxPassengers" id="carMulticityMaxPassengers" value="${escapeHtml(vehicle.maxPassengers)}"></label>
            <label class="admin-form-field"><span>Luggage</span><input type="number" min="0" data-number="integer" data-draft-field="vehicle.maxLuggage" value="${escapeHtml(vehicle.maxLuggage)}"></label>
            <label class="admin-form-field"><span>Stock</span><input type="number" min="0" data-number="integer" data-draft-field="vehicle.stockCount" value="${escapeHtml(vehicle.stockCount)}"></label>
            <label class="admin-form-field"><span>Sort order</span><input type="number" min="0" data-number="integer" data-draft-field="vehicle.sortOrder" value="${escapeHtml(vehicle.sortOrder)}"></label>
            <label class="car-multicity-check"><input type="checkbox" data-boolean="true" data-draft-field="vehicle.isAvailable" ${vehicle.isAvailable ? 'checked' : ''}> Available</label>
            <label class="car-multicity-check"><input type="checkbox" data-boolean="true" data-draft-field="vehicle.northAllowed" ${vehicle.northAllowed ? 'checked' : ''}> North allowed</label>
          </div>
          ${i18nInput('vehicle.carType', 'Commercial car type', vehicle.carType)}
          ${i18nInput('vehicle.carModel', 'Car model', vehicle.carModel)}
        </section>
        ${includeContent ? `${renderContentFields()}${renderDepositSummary()}` : ''}
      `;
    }

    function renderContentFields() {
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityContentHeading">
          <h4 id="carMulticityContentHeading">Content and media</h4>
          ${i18nInput('content.description', 'Description', state.draft.content.description, true)}
          ${renderVehicleMedia()}
          <p class="car-multicity-note">Features remain unchanged in this simplified editor. Use Legacy editor for translated feature-list maintenance.</p>
        </section>
      `;
    }

    function renderPricingFields(isCreate = false) {
      const profiles = state.context?.profiles || [];
      const selected = core.profileById(state.context, state.draft.pricing.profileId);
      const offer = state.context?.offer || {};
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityPricingHeading">
          <h4 id="carMulticityPricingHeading">Pricing and profile</h4>
          <label class="admin-form-field"><span>Pricing profile</span>
            <select id="carMulticityPricingProfile" data-profile-selector="true">
              <option value="">Select exact profile</option>
              ${profiles.map((profile) => `<option value="${escapeHtml(profile.id)}" ${core.normalizeId(profile.id) === core.normalizeId(state.draft.pricing.profileId) ? 'selected' : ''} ${profile.is_active !== true ? 'disabled' : ''}>${escapeHtml(profile.name)} — ${escapeHtml(profile.code)}</option>`).join('')}
            </select>
          </label>
          ${profileSummary(selected)}
          <dl class="car-multicity-summary-grid">
            <div><dt>Current compatibility key</dt><dd>${escapeHtml(offer.location || 'new')}</dd></div>
            <div><dt>Resulting compatibility key</dt><dd>${escapeHtml(state.draft.pricing.location || '—')}</dd></div>
          </dl>
          ${isCreate ? renderCreatePricingValues(selected) : renderExistingPriceValues(offer, selected)}
          ${renderDepositSummary()}
        </section>
      `;
    }

    function renderExistingPriceValues(offer, profile) {
      const activeColumns = new Set(core.PROFILE_PRICE_COLUMNS[core.normalizeCode(profile?.code)] || []);
      const draftFields = {
        price_per_day: 'pricePerDay',
        price_3days: 'price3Days',
        price_4_6days: 'price4To6Days',
        price_7_10days: 'price7To10Days',
        price_10plus_days: 'price10PlusDays',
      };
      return `
        <div class="car-multicity-pricing-toolbar">
          <label class="admin-form-field"><span>Currency</span><input data-draft-field="pricing.currency" value="${escapeHtml(state.draft.pricing.currency)}" maxlength="3" aria-describedby="carMulticityCurrencyHelp"></label>
          <p id="carMulticityCurrencyHelp">Cars pricing remains EUR. Only fields used by the selected profile are editable.</p>
        </div>
        <div class="car-multicity-price-card-grid" aria-label="Current and new pricing values">
          ${core.PRICE_COLUMNS.map((column) => {
            const field = draftFields[column];
            const editable = activeColumns.has(column);
            return `<article class="car-multicity-price-card ${editable ? 'is-active' : 'is-preserved'}">
              <div><span>${escapeHtml(column)}</span><small>${editable ? 'Used by active profile' : 'Preserved, not edited'}</small></div>
              <p>Current <strong>${escapeHtml(money(offer?.[column]))}</strong></p>
              ${editable
                ? `<label class="admin-form-field"><span>New value</span><input type="number" min="0.01" step="0.01" data-number="money" data-draft-field="pricing.${escapeHtml(field)}" id="carMulticity${escapeHtml(field.charAt(0).toUpperCase() + field.slice(1))}" value="${escapeHtml(state.draft.pricing[field] ?? '')}"></label>`
                : `<div class="car-multicity-preserved-value">Will remain ${escapeHtml(money(offer?.[column]))}</div>`}
            </article>`;
          }).join('')}
        </div>
        <p class="car-multicity-note">No inactive pricing column is copied, reset, or defaulted.</p>
      `;
    }

    function renderCreatePricingValues(profile) {
      const pricing = state.draft.pricing;
      const code = core.normalizeCode(profile?.code);
      const larnaca = code === 'larnaca';
      const paphos = code === 'paphos';
      return `
        <div class="car-multicity-form-grid">
          <label class="admin-form-field"><span>Currency</span><input data-draft-field="pricing.currency" value="${escapeHtml(pricing.currency)}" maxlength="3"></label>
          ${larnaca ? `<label class="admin-form-field"><span>Price per day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.pricePerDay" value="${escapeHtml(pricing.pricePerDay ?? '')}"></label>` : ''}
          ${paphos ? `
            <label class="admin-form-field"><span>3 days</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.price3Days" value="${escapeHtml(pricing.price3Days ?? '')}"></label>
            <label class="admin-form-field"><span>4–6 days / day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.price4To6Days" value="${escapeHtml(pricing.price4To6Days ?? '')}"></label>
            <label class="admin-form-field"><span>7–10 days / day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.price7To10Days" value="${escapeHtml(pricing.price7To10Days ?? '')}"></label>
            <label class="admin-form-field"><span>10+ days / day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.price10PlusDays" value="${escapeHtml(pricing.price10PlusDays ?? '')}"></label>
          ` : ''}
          <label class="admin-form-field"><span>Insurance / day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.insurancePerDay" value="${escapeHtml(pricing.insurancePerDay)}"></label>
          <label class="car-multicity-check"><input type="checkbox" data-boolean="true" data-draft-field="pricing.youngDriverFee" ${pricing.youngDriverFee ? 'checked' : ''} ${paphos ? 'disabled' : ''}> Young driver allowed</label>
          <label class="admin-form-field"><span>Young driver / day</span><input type="number" min="0" step="0.01" data-number="money" data-draft-field="pricing.youngDriverCost" value="${escapeHtml(pricing.youngDriverCost)}" ${paphos ? 'disabled' : ''}></label>
        </div>
      `;
    }

    function availabilityRow(city) {
      const profile = core.profileById(state.context, state.draft.pricing.profileId);
      const mapping = core.mappingFor(state.context, profile?.id, city.id);
      const row = state.draft.availability.find((entry) => core.normalizeId(entry.city_id) === core.normalizeId(city.id)) || {
        city_id: city.id,
        offer_id: state.draft.offerId,
        pickup_enabled: false,
        return_enabled: false,
        is_active: false,
        updated_at: null,
      };
      const key = core.normalizeCode(mapping?.legacy_pricing_city_key);
      const supported = Boolean(mapping && mapping.is_active && city.is_active && key);
      const paphosBlocked = core.normalizeCode(profile?.code) === 'paphos' && key !== 'paphos';
      const pairedSupported = mapping?.pickup_supported === true && mapping?.return_supported === true;
      const disabled = !supported || !pairedSupported || paphosBlocked;
      const paired = core.pairedAvailabilityState(row);
      const fee = core.getAvailabilityFeeState(row, profile, mapping);
      const standardLabel = fee.inherited
        ? fee.standardAmount === null
          ? 'Existing Paphos place-type rule'
          : `${money(fee.standardAmount)} per direction`
        : 'Not available — custom fee required';
      const resultLabel = fee.valid
        ? fee.mode === 'override'
          ? `${money(fee.amount)} pickup · ${money(fee.amount)} return`
          : fee.standardAmount === null
            ? 'Calculated by existing Paphos place-type rule'
            : `${money(fee.standardAmount)} pickup · ${money(fee.standardAmount)} return`
        : 'Fee required for this city';
      return `
        <article class="car-multicity-availability-card ${paired.checked ? 'is-selected' : ''}" data-city-id="${escapeHtml(city.id)}">
          <header><div><strong>${escapeHtml(labelI18n(city.name_i18n) || city.code)}</strong><code>${escapeHtml(city.code)}</code></div><span class="car-multicity-status-badge ${city.is_active ? 'is-active' : 'is-inactive'}">${city.is_active ? 'Active' : 'Inactive'}</span></header>
          <label class="car-multicity-city-toggle"><input type="checkbox" data-availability-field="paired" ${paired.checked ? 'checked' : ''} ${paired.mismatched ? 'data-mixed="true" aria-checked="mixed"' : ''} ${disabled ? 'disabled' : ''}> Available for pickup and return</label>
          ${paired.mismatched ? '<span class="car-multicity-row-warning" role="alert">Pickup and return settings differ. Review required.</span>' : ''}
          <div class="car-multicity-fee-controls">
            <label class="admin-form-field"><span>Fee mode</span><select data-availability-field="fee_mode" ${disabled ? 'disabled' : ''}><option value="inherit" ${fee.mode === 'inherit' ? 'selected' : ''}>Use standard fee</option><option value="override" ${fee.mode === 'override' ? 'selected' : ''}>Custom fee</option></select></label>
            <label class="admin-form-field"><span>Custom fee per direction</span><input type="number" min="0" step="0.01" data-availability-field="fee_per_direction" value="${escapeHtml(fee.mode === 'override' && row.fee_per_direction != null ? row.fee_per_direction : '')}" ${fee.mode !== 'override' || disabled ? 'disabled' : ''}></label>
          </div>
          <dl><div><dt>Standard fee</dt><dd>${escapeHtml(standardLabel)}</dd></div><div><dt>Result</dt><dd class="${fee.valid ? '' : 'is-required'}">${escapeHtml(resultLabel)}</dd></div><div><dt>Profile support</dt><dd>${supported && pairedSupported && !paphosBlocked ? 'Supported' : mapping && mapping.pickup_supported !== mapping.return_supported ? 'Support differs — review required' : 'Unavailable'}</dd></div></dl>
        </article>
      `;
    }

    function renderAvailabilityFields() {
      const readiness = core.getMappedReadiness(state.draft, state.context);
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityAvailabilityHeading">
          <h4 id="carMulticityAvailabilityHeading">Availability configuration</h4>
          <div class="car-multicity-mode-strip">
            <div><span>Current public mode</span><strong>Legacy</strong></div>
            <div><span>Mapped configuration</span><strong>${readiness.ready ? 'Ready' : state.draft.availability.length ? 'Incomplete' : 'Not configured'}</strong></div>
          </div>
          <p class="car-multicity-note">The global mapped flag remains OFF. Saving this screen does not activate mapped availability.</p>
          <div class="car-multicity-availability-grid">${(state.context?.cities || []).map(availabilityRow).join('')}</div>
          <div class="${readiness.ready ? 'car-multicity-ready' : 'car-multicity-warning'}">
            <strong>${readiness.ready ? 'Ready for future mapped activation' : 'Not ready for mapped activation'}</strong>
            ${readiness.reasons.length ? `<ul>${readiness.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
          </div>
        </section>
      `;
    }

    function renderPartnerFields() {
      const partners = state.context?.partners || [];
      const resources = state.context?.partnerResources || [];
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityPartnerHeading">
          <h4 id="carMulticityPartnerHeading">Partner</h4>
          <p class="car-multicity-note">Partner assignment is independent from cities, pricing profile, and legacy location. No notification is sent. Existing partner_resources rows are read-only here: clearing owner_partner_id leaves that assignment as the fulfillment fallback, while a conflicting owner is blocked.</p>
          <label class="admin-form-field"><span>Owner partner</span>
            <select data-draft-field="partner.ownerPartnerId" id="carMulticityOwnerPartner">
              <option value="">No owner partner</option>
              ${partners.map((partner) => `<option value="${escapeHtml(partner.id)}" ${core.normalizeId(partner.id) === core.normalizeId(state.draft.partner.ownerPartnerId) ? 'selected' : ''} ${partner.status !== 'active' || partner.can_manage_cars !== true ? 'disabled' : ''}>${escapeHtml(partner.name)} — ${escapeHtml(partner.status)} — Cars: ${partner.can_manage_cars ? 'yes' : 'no'}</option>`).join('')}
            </select>
          </label>
          <dl class="car-multicity-summary-grid">
            <div><dt>owner_partner_id</dt><dd>${escapeHtml(state.context?.offer?.owner_partner_id || 'NULL')}</dd></div>
            <div><dt>partner_resources assignments</dt><dd>${escapeHtml(resources.length)}</dd></div>
            <div><dt>Assigned exact partner IDs</dt><dd>${resources.map((row) => escapeHtml(row.partner_id)).join(', ') || 'None'}</dd></div>
            <div><dt>Exact partner_resources IDs</dt><dd>${resources.map((row) => escapeHtml(row.id)).join(', ') || 'None'}</dd></div>
            <div><dt>Legacy cars_locations</dt><dd>${escapeHtml((partners.find((row) => core.normalizeId(row.id) === core.normalizeId(state.draft.partner.ownerPartnerId))?.cars_locations || []).join(', ') || 'None')}</dd></div>
          </dl>
        </section>
      `;
    }

    function renderCreateStep() {
      const steps = [
        () => renderVehicleFields(false),
        () => renderPricingFields(true),
        () => renderAvailabilityFields(),
        () => renderPartnerFields(),
        () => renderContentFields(),
      ];
      return `
        <nav class="car-multicity-wizard-steps" aria-label="Add vehicle steps">
          ${['Vehicle', 'Pricing profile and values', 'Availability', 'Partner', 'Content and media', 'Review'].map((label, index) => `<span class="${index === state.draft.step ? 'is-current' : index < state.draft.step ? 'is-complete' : ''}">${index + 1}. ${escapeHtml(label)}</span>`).join('')}
        </nav>
        ${steps[state.draft.step]?.() || ''}
      `;
    }

    function allChanges(plan) {
      return (plan?.steps || []).flatMap((step) => step.changes || []);
    }

    function changeGroup(title, changes) {
      return `
        <section class="car-multicity-review-group">
          <h4>${escapeHtml(title)}</h4>
          ${changes.length ? `<table class="admin-table"><thead><tr><th>Entity</th><th>Exact ID</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${changes.map((change) => `<tr><td>${escapeHtml(change.entityType)}</td><td><code>${escapeHtml(change.entityId || 'new')}</code></td><td><code>${escapeHtml(change.field)}</code></td><td>${escapeHtml(renderValue(change.before))}</td><td>${escapeHtml(renderValue(change.after))}</td></tr>`).join('')}</tbody></table>` : '<p>UNCHANGED</p>'}
        </section>
      `;
    }

    function renderAvailableCitiesReview(plan) {
      const entries = plan?.availableCities || [];
      return `
        <section class="car-multicity-review-group">
          <h4>Available cities</h4>
          ${entries.length ? `<ul class="car-multicity-city-review-list">${entries.map((entry) => {
            const city = (state.context?.cities || []).find((candidate) => core.normalizeId(candidate.id) === core.normalizeId(entry.exactCityId));
            const label = labelI18n(city?.name_i18n) || city?.code || entry.exactCityId;
            const before = entry.beforeMismatch ? 'Pickup/return differ' : entry.beforeAvailable ? 'Available' : 'Not available';
            const after = entry.afterMismatch ? 'Pickup/return differ' : entry.afterAvailable ? 'Available' : 'Not available';
            const beforeFee = entry.beforeFeeMode === 'override'
              ? `Custom ${money(entry.beforeFeePerDirection)} per direction`
              : 'Use standard fee';
            const afterFee = entry.afterFeeMode === 'override'
              ? `Custom ${money(entry.afterFeePerDirection)} per direction`
              : entry.afterFeeMode === null ? 'Removed' : 'Use standard fee';
            return `<li><strong>${escapeHtml(label)}</strong><code>${escapeHtml(entry.exactCityId)}</code><span>${escapeHtml(before)} → ${escapeHtml(after)}</span><span>${escapeHtml(beforeFee)} → ${escapeHtml(afterFee)}</span><small>${escapeHtml(entry.action)}</small></li>`;
          }).join('')}</ul>` : '<p>UNCHANGED</p>'}
        </section>
      `;
    }

    function renderImageReview() {
      const media = state.draft?.media || { action: 'unchanged', currentUrl: '', pendingFile: null };
      const newImage = ['added', 'replaced'].includes(media.action)
        ? media.pendingFile?.name || 'Pending upload'
        : media.action === 'removed' ? 'No image' : media.currentUrl || 'No image';
      return `
        <section class="car-multicity-review-group car-multicity-image-review">
          <h4>Vehicle image</h4>
          <dl class="car-multicity-summary-grid">
            <div><dt>Image action</dt><dd><strong>${escapeHtml(media.action)}</strong></dd></div>
            <div><dt>Current image</dt><dd>${media.currentUrl ? `<a href="${escapeHtml(media.currentUrl)}" target="_blank" rel="noopener">Current URL</a>` : 'No image'}</dd></div>
            <div><dt>New image</dt><dd>${escapeHtml(newImage)}</dd></div>
          </dl>
        </section>
      `;
    }

    function renderValue(value) {
      if (value === null || value === undefined || value === '') return 'NULL';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }

    function renderReview() {
      const plan = state.plan;
      const changes = allChanges(plan);
      const vehicleChanges = changes.filter((change) => change.entityType === 'car_offer' && core.VEHICLE_COLUMNS.includes(change.field) && !['description', 'features', 'image_url'].includes(change.field));
      const profileChanges = changes.filter((change) => core.PROFILE_COLUMNS.includes(change.field));
      const priceChanges = changes.filter((change) => core.PRICE_COLUMNS.includes(change.field));
      const partnerChanges = changes.filter((change) => change.field === 'owner_partner_id');
      const contentChanges = changes.filter((change) => ['description', 'features', 'image_url'].includes(change.field));
      return `
        <section class="car-multicity-section car-multicity-review" aria-labelledby="carMulticityReviewHeading">
          <h4 id="carMulticityReviewHeading" tabindex="-1">Review</h4>
          <dl class="car-multicity-summary-grid">
            <div><dt>Exact offer ID</dt><dd><code>${escapeHtml(plan.exactOfferId || 'created on Save')}</code></dd></div>
            <div><dt>Plan ID</dt><dd><code>${escapeHtml(plan.id)}</code></dd></div>
            <div><dt>Global mapped flag changes</dt><dd><strong>0</strong></dd></div>
            <div><dt>Booking changes</dt><dd><strong>0</strong></dd></div>
            <div><dt>Price calculation changes</dt><dd><strong>0</strong></dd></div>
            <div><dt>Deposit rule changes</dt><dd><strong>0</strong></dd></div>
            <div><dt>Existing price column changes</dt><dd><strong>${escapeHtml(plan.existingPriceColumnChanges)}</strong></dd></div>
          </dl>
          ${changeGroup('Vehicle changes', vehicleChanges)}
          ${changeGroup('Pricing profile changes', profileChanges)}
          ${changeGroup('Pricing values changes', priceChanges)}
          ${renderAvailableCitiesReview(plan)}
          ${changeGroup('Partner changes', partnerChanges)}
          ${changeGroup('Content changes', contentChanges)}
          ${renderImageReview()}
          <div class="car-multicity-safety">
            <strong>Safety assertions</strong>
            <ul><li>Global mapped flag changes: 0</li><li>Booking changes: 0</li><li>Price calculation changes: 0</li><li>Deposit rule changes: 0</li><li>Public mode remains Legacy</li><li>No emails or notifications</li></ul>
          </div>
        </section>
      `;
    }

    function renderReceipt() {
      const outcome = state.outcome;
      return `
        <section class="car-multicity-section" aria-labelledby="carMulticityReceiptHeading">
          <h4 id="carMulticityReceiptHeading" tabindex="-1">${outcome.status === 'success' ? 'Saved' : 'Partial save receipt'}</h4>
          <p>${outcome.status === 'success' ? 'All planned steps completed.' : 'Some steps did not complete. No automatic rollback was performed.'}</p>
          <ul class="car-multicity-step-list">
            ${(outcome.steps || []).map((step) => `<li class="is-${escapeHtml(step.status)}"><strong>${escapeHtml(step.key)}</strong> — ${escapeHtml(step.status)} — exact ID <code>${escapeHtml(step.result?.id || step.entityId || outcome.exactOfferId || 'new')}</code> — attempts ${escapeHtml(step.attempts)}${step.error ? ` — ${escapeHtml(step.error.message)}` : ''}</li>`).join('')}
          </ul>
          <p><strong>Global mapped flag changes: 0. Booking changes: 0. Deposit rule changes: 0. No notifications sent.</strong></p>
        </section>
      `;
    }

    function renderErrors(validation) {
      const element = byId('carMulticityModalError');
      if (!element) return;
      byId('carMulticityModalContent')?.querySelectorAll?.('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
      byId('carMulticityModalContent')?.querySelectorAll?.('[data-inline-error]').forEach((message) => message.remove());
      const errors = validation?.errors || [];
      if (!errors.length) {
        element.hidden = true;
        element.innerHTML = '';
        return;
      }
      element.hidden = false;
      element.innerHTML = `<strong>Review is blocked:</strong><ul>${errors.map((entry) => `<li>${escapeHtml(entry.message)}</li>`).join('')}</ul>`;
      const selectorFor = (field) => {
        if (field === 'carType') return '[data-i18n-field="vehicle.carType"]';
        if (field === 'carModel') return '[data-i18n-field="vehicle.carModel"]';
        if (field === 'vehicleImage') return '#carMulticityImageFile';
        if (field === 'pricingProfileId') return '#carMulticityPricingProfile';
        if (field === 'vehicleKindId') return '#carMulticityVehicleKind';
        if (field === 'ownerPartnerId') return '#carMulticityOwnerPartner';
        if (String(field).startsWith('fee-')) return `[data-city-id="${String(field).replace('fee-', '')}"] [data-availability-field="fee_per_direction"]`;
        if (String(field).startsWith('availability-')) return `[data-city-id="${String(field).replace('availability-', '')}"] [data-availability-field="paired"]`;
        return `[data-draft-field$=".${String(field)}"], [data-draft-field="${String(field)}"]`;
      };
      errors.forEach((entry, index) => {
        const field = byId('carMulticityModalContent')?.querySelector?.(selectorFor(entry.field));
        if (!field) return;
        field.setAttribute('aria-invalid', 'true');
        const message = documentRef.createElement('span');
        message.className = 'car-multicity-inline-error';
        message.dataset.inlineError = 'true';
        message.textContent = entry.message;
        (field.closest('.admin-form-field, .car-multicity-image-dropzone, td') || field.parentElement)?.appendChild(message);
        if (index === 0) focusElement(field.hidden ? field.closest('.car-multicity-image-dropzone') : field);
      });
    }

    function syncMixedCheckboxes(container) {
      container?.querySelectorAll?.('input[type="checkbox"][data-mixed="true"]').forEach((input) => {
        input.indeterminate = true;
        input.setAttribute('aria-checked', 'mixed');
      });
    }

    function render() {
      if (!state.draft) return;
      renderHeader();
      const content = byId('carMulticityModalContent');
      if (!content) return;
      if (state.outcome) content.innerHTML = renderReceipt();
      else if (state.screen === 'review') content.innerHTML = renderReview();
      else if (state.mode === 'vehicle') content.innerHTML = renderVehicleFields(true);
      else if (state.mode === 'pricing') content.innerHTML = renderPricingFields(false);
      else if (state.mode === 'availability') content.innerHTML = renderAvailabilityFields();
      else if (state.mode === 'partner') content.innerHTML = renderPartnerFields();
      else if (state.mode === 'create') content.innerHTML = renderCreateStep();
      syncMixedCheckboxes(content);
      const back = byId('carMulticityBack');
      const next = byId('carMulticityNext');
      const review = byId('carMulticityReview');
      const save = byId('carMulticitySave');
      const close = byId('carMulticityCloseFooter');
      if (back) back.hidden = state.outcome || (state.screen === 'edit' && !(state.mode === 'create' && state.draft.step > 0));
      if (next) next.hidden = state.outcome || state.screen !== 'edit' || state.mode !== 'create' || state.draft.step >= 4;
      if (review) {
        review.hidden = state.outcome || state.screen !== 'edit' || (state.mode === 'create' && state.draft.step < 4);
        review.textContent = state.mode === 'pricing' ? 'Review price changes' : 'Review changes';
      }
      if (save) {
        save.hidden = state.outcome || state.screen !== 'review';
        save.disabled = !core.isReviewCurrent(state.draft, state.plan) || !state.plan?.steps?.length;
        save.setAttribute('aria-disabled', save.disabled ? 'true' : 'false');
        save.textContent = state.mode === 'pricing' ? 'Save pricing values' : 'Save changes';
      }
      if (close) close.hidden = !state.outcome;
      if (state.screen === 'review') focusElement(byId('carMulticityReviewHeading'));
      if (state.outcome) focusElement(byId('carMulticityReceiptHeading'));
    }

    function setPath(object, path, value) {
      const parts = String(path || '').split('.');
      let target = object;
      parts.slice(0, -1).forEach((part) => {
        if (!target[part] || typeof target[part] !== 'object') target[part] = {};
        target = target[part];
      });
      target[parts[parts.length - 1]] = value;
    }

    function updateUploadProgress(progress = {}) {
      const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
      state.uploadProgress = percent;
      const wrapper = byId('carMulticityImageUploadProgress');
      const bar = byId('carMulticityImageUploadBar');
      const status = byId('carMulticityImageUploadStatus');
      const progressbar = wrapper?.querySelector?.('[role="progressbar"]');
      if (wrapper) wrapper.hidden = false;
      if (bar) bar.style.width = `${percent}%`;
      if (progressbar) progressbar.setAttribute('aria-valuenow', String(percent));
      if (status) {
        const labels = { validated: 'Image validated', uploaded: 'Image uploaded; resolving public URL', complete: 'Upload complete' };
        status.textContent = labels[progress.status] || 'Uploading image';
      }
    }

    function selectVehicleImage(file) {
      const validation = core.validateVehicleImageFile(file);
      if (!validation.valid) {
        renderErrors(validation);
        announce(validation.errors[0]?.message || 'Invalid image.', 'error');
        return false;
      }
      clearPendingImageFile();
      pendingImageFile = file;
      pendingImagePreviewUrl = root.URL?.createObjectURL?.(file) || '';
      const action = state.draft.media?.currentUrl ? 'replaced' : 'added';
      core.setVehicleImageAction(state.draft, action, validation.metadata);
      state.plan = null;
      renderErrors({ errors: [] });
      announce('Image selected. It will upload only after Review and confirmation.', 'status');
      render();
      return true;
    }

    function handleMediaClick(event) {
      const action = event.target?.closest?.('[data-media-action]')?.dataset?.mediaAction;
      if (!action || state.executing) return;
      if (action === 'select') {
        byId('carMulticityImageFile')?.click();
        return;
      }
      if (action === 'remove') {
        clearPendingImageFile();
        core.setVehicleImageAction(state.draft, state.draft.media?.currentUrl ? 'removed' : 'unchanged');
        state.plan = null;
        render();
        announce('The current image will be removed from this offer after Save.', 'status');
        return;
      }
      if (action === 'undo') {
        clearPendingImageFile();
        core.setVehicleImageAction(state.draft, 'unchanged');
        state.plan = null;
        render();
        announce('Image change cancelled. The current image will be preserved.', 'status');
        return;
      }
      if (action === 'manage-deposit') {
        closeImmediately();
        options.openDepositSettings?.();
      }
    }

    function handleMediaDrop(event) {
      const dropzone = event.target?.closest?.('[data-image-dropzone]');
      if (!dropzone || state.executing) return;
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
      const file = event.dataTransfer?.files?.[0];
      if (file) selectVehicleImage(file);
    }

    function handleMediaDrag(event) {
      const dropzone = event.target?.closest?.('[data-image-dropzone]');
      if (!dropzone || state.executing) return;
      event.preventDefault();
      dropzone.classList.toggle('is-dragging', event.type === 'dragover' || event.type === 'dragenter');
    }

    function handleDraftInput(event) {
      if (!state.draft || state.executing) return;
      const target = event.target;
      const i18nField = target?.dataset?.i18nField;
      if (i18nField) {
        setPath(state.draft, `${i18nField}.${target.dataset.language}`, target.value);
        core.invalidateReview(state.draft);
        state.plan = null;
        return;
      }
      const path = target?.dataset?.draftField;
      const availabilityField = target?.dataset?.availabilityField;
      const cityRow = target?.closest?.('[data-city-id]');
      if (availabilityField === 'fee_per_direction' && cityRow) {
        const cityId = cityRow.dataset.cityId;
        const row = state.draft.availability.find((entry) => core.normalizeId(entry.city_id) === core.normalizeId(cityId));
        if (!row) return;
        row.fee_per_direction = target.value === '' ? null : Number(target.value);
        core.invalidateReview(state.draft);
        state.plan = null;
        return;
      }
      if (!path) return;
      let value = target.value;
      if (target.dataset.boolean === 'true') value = target.checked;
      if (target.dataset.number === 'integer') value = value === '' ? null : Number.parseInt(value, 10);
      if (target.dataset.number === 'money') value = value === '' ? null : Number(value);
      setPath(state.draft, path, value);
      core.invalidateReview(state.draft);
      state.plan = null;
    }

    function handleContentChange(event) {
      if (!state.draft || state.executing) return;
      const target = event.target;
      if (target?.id === 'carMulticityImageFile' && target.files?.[0]) {
        selectVehicleImage(target.files[0]);
        return;
      }
      if (target?.dataset?.profileSelector === 'true') {
        try {
          core.setDraftProfile(state.draft, state.context, target.value, { resetAvailability: state.mode === 'create' });
          if (core.normalizeCode(core.profileById(state.context, target.value)?.code) === 'paphos') {
            state.draft.pricing.youngDriverFee = false;
            state.draft.pricing.youngDriverCost = 0;
          }
          state.plan = null;
          render();
        } catch (error) {
          renderErrors({ errors: [{ message: error.message }] });
        }
        return;
      }
      const availabilityField = target?.dataset?.availabilityField;
      const cityRow = target?.closest?.('[data-city-id]');
      if (availabilityField && cityRow) {
        const cityId = cityRow.dataset.cityId;
        if (availabilityField === 'paired') {
          core.setPairedAvailability(state.draft, cityId, target.checked);
        } else if (availabilityField === 'fee_mode') {
          const current = state.draft.availability.find((entry) => core.normalizeId(entry.city_id) === core.normalizeId(cityId));
          core.setAvailabilityFee(
            state.draft,
            cityId,
            target.value,
            target.value === 'override' ? current?.fee_per_direction : null,
            current?.fee_note,
          );
        } else if (availabilityField === 'fee_per_direction') {
          const current = state.draft.availability.find((entry) => core.normalizeId(entry.city_id) === core.normalizeId(cityId));
          core.setAvailabilityFee(state.draft, cityId, 'override', target.value, current?.fee_note);
        } else {
          return;
        }
        state.plan = null;
        render();
        return;
      }
      handleDraftInput(event);
    }

    function nextCreateStep() {
      if (state.mode !== 'create' || state.draft.step >= 4) return;
      state.draft.step += 1;
      render();
      focusElement(byId('carMulticityModalContent')?.querySelector('h4'));
    }

    function back() {
      if (state.outcome || state.executing) return;
      if (state.screen === 'review') {
        state.screen = 'edit';
        render();
        focusElement(byId('carMulticityReview'));
        return;
      }
      if (state.mode === 'create' && state.draft.step > 0) {
        state.draft.step -= 1;
        render();
      }
    }

    function review() {
      if (state.executing) return;
      try {
        state.plan = core.buildReviewPlan(state.draft, state.context, state.mode);
        state.screen = 'review';
        renderErrors({ errors: [] });
        render();
        if (!state.plan.steps.length) announce('No changed records to save.', 'info');
        else announce(`Review contains ${state.plan.steps.length} exact operation(s).`, 'status');
      } catch (error) {
        const validation = error.details || core.validateDraft(state.draft, state.context);
        renderErrors(validation);
        announce('Validation failed. Review the highlighted messages.', 'error');
        const firstField = validation.errors?.[0]?.field;
        if (firstField) focusElement(byId(`carMulticity${firstField.charAt(0).toUpperCase()}${firstField.slice(1)}`));
      }
    }

    function openConfirmation(config) {
      state.confirmationOpen = true;
      state.pendingConfirmation = config;
      const dialog = byId('carMulticityConfirmDialog');
      const title = byId('carMulticityConfirmTitle');
      const body = byId('carMulticityConfirmBody');
      if (title) title.textContent = config.title || 'Confirm changes';
      if (body) body.innerHTML = config.body || '';
      if (dialog) dialog.hidden = false;
      focusElement(byId('carMulticityConfirmCancel'));
    }

    function closeConfirmation() {
      const dialog = byId('carMulticityConfirmDialog');
      if (dialog) dialog.hidden = true;
      const shouldReturn = state.confirmationOpen;
      state.confirmationOpen = false;
      state.pendingConfirmation = null;
      if (shouldReturn) focusElement(byId('carMulticitySave'));
    }

    function requestSave() {
      if (state.executing || !core.isReviewCurrent(state.draft, state.plan) || !state.plan?.steps?.length) return;
      openConfirmation({
        title: 'Confirm exact-ID save',
        body: `<p>Save ${escapeHtml(state.plan.steps.length)} exact operation(s)?</p><ul><li>Exact offer: <code>${escapeHtml(state.plan.exactOfferId || 'new')}</code></li><li>Image action: <strong>${escapeHtml(state.draft.media?.action || 'unchanged')}</strong></li><li>Global mapped flag changes: 0</li><li>Booking changes: 0</li><li>Price calculation changes: 0</li><li>Deposit rule changes: 0</li></ul>`,
        action: () => executeSave(),
      });
    }

    async function cleanupUnusedImageUpload(uploadedImage, outcome = null) {
      if (!uploadedImage?.path) return { removed: false, used: false };
      const offerStep = outcome?.steps?.find((step) => step.type === 'car_offer');
      let used = offerStep?.status === 'success' && offerStep?.result?.image_url === uploadedImage.publicUrl;
      const exactId = outcome?.exactOfferId || state.draft?.offerId;
      if (!used && exactId) {
        try {
          const freshOffer = await repository.getOfferById(exactId);
          used = freshOffer?.image_url === uploadedImage.publicUrl;
        } catch (_error) {
          announce('Image cleanup paused because exact read-back was unavailable. The uploaded path is shown in the technical receipt.', 'error');
          return { removed: false, used: false, uncertain: true };
        }
      }
      if (used) return { removed: false, used: true };
      await repository.removeVehicleImage(uploadedImage.path);
      return { removed: true, used: false };
    }

    async function executeSave() {
      if (state.executionPromise) return state.executionPromise;
      closeConfirmation();
      state.executing = true;
      setBusy(true);
      state.executionPromise = (async () => {
        let uploadedImage = null;
        try {
          announce('Running fresh preflight before the first mutation.', 'status');
          const freshContext = state.mode === 'create'
            ? await repository.getCreateContext()
            : await repository.getOfferContext(state.draft.offerId);
          const preflight = core.validateFreshContext(state.plan, freshContext);
          if (!preflight.valid || !core.isReviewCurrent(state.draft, state.plan)) {
            const error = new Error('Data changed since Review. Refresh and review again.');
            error.code = 'car_multicity_stale_conflict';
            error.details = preflight;
            throw error;
          }
          const freshValidation = core.validateDraft(state.draft, freshContext);
          if (!freshValidation.valid) {
            const error = new Error('Data changed since Review. Refresh and review again.');
            error.code = 'car_multicity_stale_conflict';
            error.details = freshValidation;
            throw error;
          }
          if (['added', 'replaced'].includes(state.draft.media?.action)) {
            if (!pendingImageFile) throw new Error('The reviewed image file is no longer available. Select it again.');
            announce('Uploading the reviewed image to the existing car-images bucket.', 'status');
            uploadedImage = await repository.uploadVehicleImage({
              file: pendingImageFile,
              offerId: state.draft.offerId,
              temporaryId: state.plan.id,
              onProgress: updateUploadProgress,
            });
          }
          announce('Preflight passed. Executing exact-ID plan.', 'status');
          state.outcome = await repository.executePlan(state.plan, {
            uploadedImageUrl: uploadedImage?.publicUrl || null,
            onProgress: (working) => announce(`Save status: ${working.status}.`, 'status'),
          });
          state.plan = state.outcome;
          if (state.outcome.status === 'success') {
            const exactId = state.outcome.exactOfferId || state.draft.offerId;
            const readBack = await repository.getOfferContext(exactId);
            state.context = readBack;
            announce('Save complete. Fresh read-back succeeded.', 'success');
            toast('Car rental configuration saved', 'success');
            options.onFleetRefresh?.();
          } else {
            if (uploadedImage) await cleanupUnusedImageUpload(uploadedImage, state.outcome);
            announce('Partial save. No rollback was performed.', 'error');
            toast('Some car configuration steps failed', 'error');
          }
          render();
        } catch (error) {
          if (uploadedImage) {
            try {
              await cleanupUnusedImageUpload(uploadedImage, state.outcome);
            } catch (cleanupError) {
              error.cleanupError = String(cleanupError?.message || cleanupError);
            }
          }
          const stale = error?.code === 'car_multicity_stale_conflict';
          announce(stale ? 'Data changed since Review. Refresh and review again.' : String(error?.message || 'Save failed.'), 'error');
          renderErrors({ errors: [{ message: stale ? 'Data changed since Review. Refresh and review again.' : String(error?.message || error) }] });
        } finally {
          state.executing = false;
          state.executionPromise = null;
          setBusy(false);
        }
      })();
      return state.executionPromise;
    }

    async function open(mode, offerId, openOptions = {}) {
      if (state.executing) return false;
      if (!state.initialized) initialize();
      clearPendingImageFile();
      state.returnFocus = openOptions.returnFocus || documentRef.activeElement;
      state.open = true;
      state.mode = mode;
      state.screen = 'edit';
      state.context = null;
      state.draft = null;
      state.plan = null;
      state.outcome = null;
      state.loading = true;
      const modal = byId('carMulticityModal');
      if (!modal) return false;
      modal.hidden = false;
      documentRef.body?.classList?.add('car-multicity-modal-open');
      const loadingContent = byId('carMulticityModalContent');
      if (loadingContent) loadingContent.innerHTML = `<div class="car-multicity-skeleton" aria-label="Loading vehicle configuration"><span></span><span></span><span></span><span></span><span></span></div>`;
      announce(mode === 'create' ? 'Loading fresh Admin catalog.' : `Loading exact offer ${offerId}.`, 'status');
      focusElement(byId('carMulticityModalClose'));
      try {
        state.context = mode === 'create'
          ? await repository.getCreateContext()
          : await repository.getOfferContext(offerId);
        if (state.context?.siteSetting?.car_multi_city_mapped_enabled !== false) {
          throw new Error('Stage 2C safety stop: global mapped flag is not false.');
        }
        state.draft = core.createDraft(state.context, { mode });
        state.loading = false;
        announce(`Fresh context loaded at ${state.context.loadedAt}. Public mode remains Legacy.`, 'success');
        renderErrors({ errors: [] });
        render();
        return true;
      } catch (error) {
        state.loading = false;
        announce(String(error?.message || 'Failed to load car configuration.'), 'error');
        const content = byId('carMulticityModalContent');
        if (content) content.innerHTML = `<div class="car-multicity-error" tabindex="-1"><strong>Failed read</strong><p>${escapeHtml(error?.message || error)}</p></div>`;
        return false;
      }
    }

    async function refreshCurrent() {
      if (state.executing || !state.open) return;
      const mode = state.mode;
      const offerId = state.draft?.offerId;
      await open(mode, offerId, { returnFocus: state.returnFocus });
    }

    function renderCatalogCities() {
      const catalog = state.catalog;
      const search = core.normalizeText(state.catalogSearch).toLowerCase();
      const cities = (catalog.cities || []).filter((city) => {
        if (!search) return true;
        const names = ['pl', 'en', 'he'].map((language) => core.normalizeText(city.name_i18n?.[language])).join(' ');
        return `${city.code} ${names}`.toLowerCase().includes(search);
      });
      return `
        <section class="car-multicity-section car-multicity-city-catalog">
          <div class="car-multicity-catalog-toolbar">
            <div><h4>Car rental cities</h4><p>New cities are inactive and never mapped or assigned automatically.</p></div>
            <div class="car-multicity-catalog-actions"><label class="admin-form-field"><span>Search cities</span><input id="carMulticityCitySearch" type="search" value="${escapeHtml(state.catalogSearch)}" placeholder="Code or translated name"></label><button type="button" class="btn-primary" data-catalog-action="add-city">Add city</button></div>
          </div>
          <div class="car-multicity-city-card-grid">
            ${cities.map((city) => {
              const mappings = (catalog.profileCities || []).filter((mapping) => core.normalizeId(mapping.city_id) === core.normalizeId(city.id));
              return `<article class="car-multicity-city-card" data-catalog-city-id="${escapeHtml(city.id)}">
                <header><div><strong>${escapeHtml(labelI18n(city.name_i18n) || city.code)}</strong><code>${escapeHtml(city.code)}</code></div><span class="car-multicity-status-badge ${city.is_active ? 'is-active' : 'is-inactive'}">${city.is_active ? 'Active' : 'Inactive'}</span></header>
                <dl><div><dt>PL</dt><dd>${escapeHtml(city.name_i18n?.pl || '—')}</dd></div><div><dt>EN</dt><dd>${escapeHtml(city.name_i18n?.en || '—')}</dd></div><div><dt>HE</dt><dd dir="rtl">${escapeHtml(city.name_i18n?.he || '—')}</dd></div><div><dt>Place types</dt><dd>${escapeHtml((city.place_types || ['city']).join(', '))}</dd></div><div><dt>Profile support rows</dt><dd>${escapeHtml(mappings.length)}</dd></div><div><dt>Sort order</dt><dd>${escapeHtml(city.sort_order)}</dd></div></dl>
                <footer><code>${escapeHtml(city.id)}</code><button type="button" class="btn-secondary" data-catalog-action="edit-city" data-city-id="${escapeHtml(city.id)}">Edit city</button></footer>
              </article>`;
            }).join('') || '<p class="car-multicity-empty">No cities match this search.</p>'}
          </div>
          ${renderCityEditor()}
        </section>
      `;
    }

    function renderCityEditor() {
      const editor = state.cityEditor;
      if (!editor) return '';
      const draft = editor.draft;
      const step = editor.step;
      const title = editor.mode === 'create' ? 'Add city' : `Edit ${labelI18n(draft.name_i18n) || draft.code}`;
      const mappingRows = (state.catalog?.profileCities || []).filter((row) => core.normalizeId(row.city_id) === core.normalizeId(draft.id));
      const steps = ['Basic details', 'Place type', 'Pricing profile support', 'Default information', 'Review'];
      let body = '';
      if (step === 0) {
        body = `<div class="car-multicity-form-grid">
          <label class="admin-form-field"><span>City code</span><input data-city-editor-field="code" value="${escapeHtml(draft.code)}" placeholder="city-code" ${editor.mode === 'edit' && mappingRows.length ? 'readonly aria-describedby="carMulticityCityCodeLock"' : ''}></label>
          <label class="admin-form-field"><span>Sort order</span><input type="number" min="0" data-city-editor-field="sort_order" value="${escapeHtml(draft.sort_order)}"></label>
          <label class="admin-form-field"><span>Name (PL)</span><input data-city-editor-field="name_pl" value="${escapeHtml(draft.name_i18n?.pl || '')}"></label>
          <label class="admin-form-field"><span>Name (EN)</span><input data-city-editor-field="name_en" value="${escapeHtml(draft.name_i18n?.en || '')}"></label>
          <label class="admin-form-field"><span>Name (HE)</span><input dir="rtl" data-city-editor-field="name_he" value="${escapeHtml(draft.name_i18n?.he || '')}"></label>
          ${editor.mode === 'edit' && mappingRows.length ? '<p id="carMulticityCityCodeLock" class="car-multicity-note">The code is locked while exact profile mappings exist.</p>' : ''}
        </div>`;
      } else if (step === 1) {
        body = `<fieldset class="car-multicity-place-types"><legend>Supported place types</legend>${core.PLACE_TYPES.map((placeType) => `<label class="car-multicity-check"><input type="checkbox" data-city-editor-place-type="${escapeHtml(placeType)}" ${(draft.place_types || []).includes(placeType) ? 'checked' : ''}> ${escapeHtml(placeType)}</label>`).join('')}</fieldset>`;
      } else if (step === 2) {
        body = `<div class="car-multicity-information-card"><strong>Pricing profile support is a separate decision.</strong><p>Creating or editing this city does not add a profile mapping, does not assign it to a vehicle, and does not create a fee.</p>${mappingRows.length ? `<ul>${mappingRows.map((mapping) => `<li>Profile <code>${escapeHtml(mapping.pricing_profile_id)}</code> — key <code>${escapeHtml(mapping.legacy_pricing_city_key)}</code> — ${mapping.is_active ? 'active' : 'inactive'}</li>`).join('')}</ul>` : '<p>No profile-city mappings exist.</p>'}<p>Use the Pricing profile city support tab after saving this city.</p></div>`;
      } else if (step === 3) {
        body = `<div class="car-multicity-information-card"><strong>Safe defaults</strong><ul><li>New city status: Inactive</li><li>Offer assignments: 0</li><li>Automatic standard fee: none</li><li>Public mapped activation: no</li></ul>${editor.mode === 'edit' ? `<label class="car-multicity-city-toggle"><input type="checkbox" data-city-editor-field="is_active" ${draft.is_active ? 'checked' : ''}> City active</label>` : '<p>The first save always creates this city as inactive.</p>'}</div>`;
      } else {
        body = `<dl class="car-multicity-summary-grid"><div><dt>Exact ID</dt><dd><code>${escapeHtml(draft.id || 'created by database')}</code></dd></div><div><dt>Code</dt><dd>${escapeHtml(draft.code)}</dd></div><div><dt>Names</dt><dd>PL ${escapeHtml(draft.name_i18n?.pl)} · EN ${escapeHtml(draft.name_i18n?.en)} · HE ${escapeHtml(draft.name_i18n?.he)}</dd></div><div><dt>Place types</dt><dd>${escapeHtml((draft.place_types || []).join(', '))}</dd></div><div><dt>Status</dt><dd>${draft.is_active ? 'Active' : 'Inactive'}</dd></div><div><dt>Profile mappings created</dt><dd>0</dd></div><div><dt>Offer assignments created</dt><dd>0</dd></div><div><dt>Public activation</dt><dd>No</dd></div></dl>`;
      }
      return `<aside class="car-multicity-city-editor" role="dialog" aria-modal="false" aria-labelledby="carMulticityCityEditorTitle">
        <header><div><span class="car-multicity-kicker">City configuration</span><h4 id="carMulticityCityEditorTitle" tabindex="-1">${escapeHtml(title)}</h4></div><button type="button" class="btn-modal-close" data-catalog-action="close-city-editor" aria-label="Close city editor">×</button></header>
        <nav class="car-multicity-wizard-steps" aria-label="City steps">${steps.map((label, index) => `<span class="${index === step ? 'is-current' : index < step ? 'is-complete' : ''}">${index + 1}. ${escapeHtml(label)}</span>`).join('')}</nav>
        <div class="car-multicity-city-editor__body">${body}</div>
        <footer><button type="button" class="btn-secondary" data-catalog-action="close-city-editor">Cancel</button><span></span>${step > 0 ? '<button type="button" class="btn-secondary" data-catalog-action="city-editor-back">Back</button>' : ''}${step < 4 ? '<button type="button" class="btn-primary" data-catalog-action="city-editor-next">Next</button>' : '<button type="button" class="btn-primary" data-catalog-action="save-city-editor">Save city</button>'}</footer>
      </aside>`;
    }

    function renderCatalogMappings() {
      const catalog = state.catalog;
      const mappingMap = new Map((catalog.profileCities || []).map((row) => [`${row.pricing_profile_id}:${row.city_id}`, row]));
      return `
        <section class="car-multicity-section">
          <h4>Pricing profile city support</h4>
          <p>The exact normalized city code is the pricing key. Existing six-city keys inherit legacy fees; a new Larnaca-profile city requires an offer-level custom fee. Paphos remains hard-limited to Paphos.</p>
          <div class="admin-table-container"><table class="admin-table"><thead><tr><th>Profile</th><th>City</th><th>Pickup and return support</th><th>Legacy pricing key</th><th>Active</th><th>Impact / action</th></tr></thead><tbody>
            ${(catalog.profiles || []).flatMap((profile) => (catalog.cities || []).map((city) => {
              const mapping = mappingMap.get(`${profile.id}:${city.id}`) || null;
              const paphosBlocked = core.normalizeCode(profile.code) === 'paphos' && core.normalizeCode(city.code) !== 'paphos';
              const mixed = Boolean(mapping && mapping.pickup_supported !== mapping.return_supported);
              return `<tr data-mapping-profile-id="${escapeHtml(profile.id)}" data-mapping-city-id="${escapeHtml(city.id)}" data-mapping-updated-at="${escapeHtml(mapping?.updated_at || '')}"><td>${escapeHtml(profile.code)}<br><code>${escapeHtml(profile.id)}</code></td><td>${escapeHtml(city.code)}<br><code>${escapeHtml(city.id)}</code></td><td><label class="car-multicity-city-toggle"><input type="checkbox" data-mapping-field="paired_supported" ${mapping?.pickup_supported && mapping?.return_supported ? 'checked' : ''} ${mixed ? 'data-mixed="true" aria-checked="mixed"' : ''} ${paphosBlocked ? 'disabled' : ''}> Pickup and return supported</label>${mixed ? '<span class="car-multicity-row-warning" role="alert">Pickup and return settings differ. Review required.</span>' : ''}</td><td><input data-mapping-field="legacy_pricing_city_key" value="${escapeHtml(mapping?.legacy_pricing_city_key || city.code)}" readonly ${paphosBlocked ? 'disabled' : ''}></td><td><input type="checkbox" data-mapping-field="is_active" ${mapping?.is_active ? 'checked' : ''} ${paphosBlocked || !city.is_active ? 'disabled' : ''}></td><td>${paphosBlocked ? 'Blocked by Paphos contract' : `<button type="button" class="btn-secondary" data-catalog-action="save-mapping">Review impact</button>`}</td></tr>`;
            })).join('')}
          </tbody></table></div>
        </section>
      `;
    }

    function renderCatalog() {
      const content = byId('carMulticityCatalogContent');
      if (!content || !state.catalog) return;
      content.innerHTML = state.catalogTab === 'cities' ? renderCatalogCities() : renderCatalogMappings();
      syncMixedCheckboxes(content);
      byId('carMulticityCatalogCitiesTab')?.classList.toggle('active', state.catalogTab === 'cities');
      byId('carMulticityCatalogMappingsTab')?.classList.toggle('active', state.catalogTab === 'mappings');
    }

    async function openCatalog(returnFocus = null) {
      if (state.executing) return;
      state.returnFocus = returnFocus || documentRef.activeElement;
      state.catalogOpen = true;
      state.catalogTab = 'cities';
      const modal = byId('carMulticityCatalogModal');
      if (modal) modal.hidden = false;
      const status = byId('carMulticityCatalogStatus');
      if (status) status.textContent = 'Loading fresh city and pricing-profile catalog.';
      focusElement(byId('carMulticityCatalogClose'));
      try {
        state.catalog = await repository.getCatalog();
        if (state.catalog.siteSetting?.car_multi_city_mapped_enabled !== false) throw new Error('Mapped feature flag must remain false.');
        if (status) status.textContent = 'Fresh catalog loaded. Global mapped flag: OFF.';
        renderCatalog();
      } catch (error) {
        if (status) status.textContent = String(error?.message || error);
      }
    }

    function openCityEditor(city = null) {
      state.cityEditor = {
        mode: city ? 'edit' : 'create',
        step: 0,
        draft: core.createCityDraft(city || {
          code: '',
          name_i18n: { pl: '', en: '', he: '' },
          place_types: ['city'],
          sort_order: 1000,
        }),
      };
      renderCatalog();
      focusElement(byId('carMulticityCityEditorTitle'));
    }

    function closeCityEditor() {
      state.cityEditor = null;
      renderCatalog();
      focusElement(byId('carMulticityCitySearch'));
    }

    function cityCanBeActivated(draft) {
      return (state.catalog?.profileCities || []).some((mapping) => (
        core.normalizeId(mapping.city_id) === core.normalizeId(draft.id)
        && core.normalizeCode(mapping.legacy_pricing_city_key) === core.normalizeCode(draft.code)
        && state.catalog.profiles.some((profile) => core.normalizeId(profile.id) === core.normalizeId(mapping.pricing_profile_id) && profile.is_active === true)
      ));
    }

    function handleCatalogInput(event) {
      if (event.target?.id === 'carMulticityCitySearch') {
        state.catalogSearch = event.target.value;
        renderCatalog();
        focusElement(byId('carMulticityCitySearch'));
        const search = byId('carMulticityCitySearch');
        search?.setSelectionRange?.(search.value.length, search.value.length);
        return;
      }
      const editor = state.cityEditor;
      if (!editor) return;
      const field = event.target?.dataset?.cityEditorField;
      if (field) {
        if (field === 'is_active') editor.draft.is_active = event.target.checked === true;
        else if (field === 'sort_order') editor.draft.sort_order = event.target.value === '' ? null : Number(event.target.value);
        else if (field === 'name_pl') editor.draft.name_i18n.pl = event.target.value;
        else if (field === 'name_en') editor.draft.name_i18n.en = event.target.value;
        else if (field === 'name_he') editor.draft.name_i18n.he = event.target.value;
        else editor.draft[field] = event.target.value;
        return;
      }
      const placeType = event.target?.dataset?.cityEditorPlaceType;
      if (placeType) {
        const selected = new Set(editor.draft.place_types || []);
        if (event.target.checked) selected.add(placeType);
        else selected.delete(placeType);
        editor.draft.place_types = Array.from(selected);
      }
    }

    async function handleCatalogClick(event) {
      const button = event.target?.closest?.('[data-catalog-action]');
      if (!button || state.executing) return;
      const action = button.dataset.catalogAction;
      if (action === 'add-city') {
        openCityEditor();
        return;
      }
      if (action === 'edit-city') {
        const city = state.catalog.cities.find((row) => core.normalizeId(row.id) === core.normalizeId(button.dataset.cityId));
        if (city) openCityEditor(city);
        return;
      }
      if (action === 'close-city-editor') {
        closeCityEditor();
        return;
      }
      if (action === 'city-editor-back') {
        if (state.cityEditor?.step > 0) state.cityEditor.step -= 1;
        renderCatalog();
        focusElement(byId('carMulticityCityEditorTitle'));
        return;
      }
      if (action === 'city-editor-next') {
        if (!state.cityEditor) return;
        if (state.cityEditor.step === 0) {
          const basic = core.validateCityDraft({ ...state.cityEditor.draft, place_types: state.cityEditor.draft.place_types?.length ? state.cityEditor.draft.place_types : ['city'] }, state.catalog.cities);
          const basicErrors = basic.errors.filter((entry) => ['cityCode', 'cityName'].includes(entry.field));
          if (basicErrors.length) {
            byId('carMulticityCatalogStatus').textContent = basicErrors.map((entry) => entry.message).join(' ');
            return;
          }
        }
        if (state.cityEditor.step === 1 && !(state.cityEditor.draft.place_types || []).length) {
          byId('carMulticityCatalogStatus').textContent = 'Select at least one place type.';
          return;
        }
        state.cityEditor.step = Math.min(4, state.cityEditor.step + 1);
        renderCatalog();
        focusElement(byId('carMulticityCityEditorTitle'));
        return;
      }
      if (action === 'save-city-editor') {
        if (!state.cityEditor) return;
        const draft = state.cityEditor.draft;
        const validation = core.validateCityDraft(draft, state.catalog.cities);
        if (!validation.valid) {
          byId('carMulticityCatalogStatus').textContent = validation.errors.map((entry) => entry.message).join(' ');
          return;
        }
        if (draft.is_active && !cityCanBeActivated(draft)) {
          byId('carMulticityCatalogStatus').textContent = 'A city cannot be activated until it has an exact profile-city mapping.';
          return;
        }
        openConfirmation({
          title: state.cityEditor.mode === 'create' ? 'Review new inactive city' : 'Review city change',
          body: `<p>${state.cityEditor.mode === 'create' ? 'Create a new inactive city' : `Update exact city <code>${escapeHtml(draft.id)}</code>`}?</p><ul><li>Profile mappings created: 0</li><li>Offer assignments created: 0</li><li>Public activation: no</li></ul>`,
          action: async () => {
            closeConfirmation();
            try {
              if (state.cityEditor.mode === 'create') await repository.createCity(draft);
              else await repository.updateCity(draft);
              state.catalog = await repository.getCatalog();
              state.cityEditor = null;
              renderCatalog();
              byId('carMulticityCatalogStatus').textContent = draft.id
                ? 'City updated by exact ID.'
                : 'Inactive city created. No mappings or assignments were created.';
            } catch (error) {
              byId('carMulticityCatalogStatus').textContent = String(error?.message || error);
            }
          },
        });
        return;
      }
      if (action === 'save-mapping') {
        const row = button.closest('[data-mapping-profile-id]');
        const pairedSupported = row.querySelector('[data-mapping-field="paired_supported"]')?.checked === true;
        const draft = {
          pricing_profile_id: row.dataset.mappingProfileId,
          city_id: row.dataset.mappingCityId,
          pickup_supported: pairedSupported,
          return_supported: pairedSupported,
          legacy_pricing_city_key: row.querySelector('[data-mapping-field="legacy_pricing_city_key"]')?.value,
          is_active: row.querySelector('[data-mapping-field="is_active"]')?.checked === true,
          expectedUpdatedAt: row.dataset.mappingUpdatedAt || null,
        };
        const validation = core.validateProfileCityDraft(draft, state.catalog);
        if (!validation.valid) {
          byId('carMulticityCatalogStatus').textContent = validation.errors.map((entry) => entry.message).join(' ');
          return;
        }
        const impact = await repository.listMappingImpact(draft.pricing_profile_id, draft.city_id, draft);
        openConfirmation({
          title: 'Review profile-city mapping',
          body: `<p>Exact profile <code>${escapeHtml(draft.pricing_profile_id)}</code><br>Exact city <code>${escapeHtml(draft.city_id)}</code></p><p>Configured offers affected: <strong>${escapeHtml(impact.count)}</strong></p><p>Ready configurations before: <strong>${escapeHtml(impact.readyOfferIds.length)}</strong><br>Ready configurations after: <strong>${escapeHtml(impact.readyAfterOfferIds.length)}</strong><br>Readiness invalidated: <strong>${escapeHtml(impact.readinessInvalidatedOfferIds.length)}</strong></p><details><summary>Exact offer IDs</summary><pre>${escapeHtml(impact.offerIds.join('\n') || 'None')}</pre></details><details><summary>Exact IDs losing readiness</summary><pre>${escapeHtml(impact.readinessInvalidatedOfferIds.join('\n') || 'None')}</pre></details><p>Global mapped flag changes: 0.</p>`,
          action: async () => {
            closeConfirmation();
            try {
              await repository.saveProfileCityMapping(draft);
              state.catalog = await repository.getCatalog();
              renderCatalog();
              byId('carMulticityCatalogStatus').textContent = 'Profile-city mapping saved after impact review.';
            } catch (error) {
              byId('carMulticityCatalogStatus').textContent = String(error?.message || error);
            }
          },
        });
      }
    }

    function handleFleetAction(event) {
      const button = event.target?.closest?.('[data-car-multicity-action]');
      if (!button) return;
      const action = button.dataset.carMulticityAction;
      const offerId = button.dataset.offerId;
      if (action === 'legacy') {
        options.openLegacyEditor?.(offerId);
        return;
      }
      if (['vehicle', 'availability', 'pricing', 'partner'].includes(action)) {
        void open(action, offerId, { returnFocus: button });
      }
    }

    function initialize() {
      if (state.initialized) return api;
      byId('carMulticityModalClose')?.addEventListener('click', closeImmediately);
      byId('carMulticityCloseFooter')?.addEventListener('click', closeImmediately);
      byId('carMulticityModalOverlay')?.addEventListener('click', closeImmediately);
      byId('carMulticityRefresh')?.addEventListener('click', () => void refreshCurrent());
      byId('carMulticityBack')?.addEventListener('click', back);
      byId('carMulticityNext')?.addEventListener('click', nextCreateStep);
      byId('carMulticityReview')?.addEventListener('click', review);
      byId('carMulticitySave')?.addEventListener('click', requestSave);
      byId('carMulticityModalContent')?.addEventListener('click', handleMediaClick);
      byId('carMulticityModalContent')?.addEventListener('input', handleDraftInput);
      byId('carMulticityModalContent')?.addEventListener('change', handleContentChange);
      byId('carMulticityModalContent')?.addEventListener('dragenter', handleMediaDrag);
      byId('carMulticityModalContent')?.addEventListener('dragover', handleMediaDrag);
      byId('carMulticityModalContent')?.addEventListener('dragleave', handleMediaDrag);
      byId('carMulticityModalContent')?.addEventListener('drop', handleMediaDrop);
      byId('carMulticityConfirmCancel')?.addEventListener('click', closeConfirmation);
      byId('carMulticityConfirmAccept')?.addEventListener('click', () => {
        const action = state.pendingConfirmation?.action;
        if (typeof action === 'function') void action();
      });
      byId('btnAddFleetCar')?.addEventListener('click', (event) => void open('create', null, { returnFocus: event.currentTarget }));
      byId('btnManageCarMulticity')?.addEventListener('click', (event) => void openCatalog(event.currentTarget));
      byId('fleetTableBody')?.addEventListener('click', handleFleetAction);
      byId('carMulticityCatalogClose')?.addEventListener('click', closeCatalog);
      byId('carMulticityCatalogOverlay')?.addEventListener('click', closeCatalog);
      byId('carMulticityCatalogCitiesTab')?.addEventListener('click', () => { state.catalogTab = 'cities'; renderCatalog(); });
      byId('carMulticityCatalogMappingsTab')?.addEventListener('click', () => { state.catalogTab = 'mappings'; renderCatalog(); });
      byId('carMulticityCatalogContent')?.addEventListener('click', (event) => void handleCatalogClick(event));
      byId('carMulticityCatalogContent')?.addEventListener('input', handleCatalogInput);
      byId('carMulticityCatalogContent')?.addEventListener('change', handleCatalogInput);
      documentRef.addEventListener('keydown', handleKeydown);
      state.initialized = true;
      return api;
    }

    function getState() {
      return core.clone(state);
    }

    const api = Object.freeze({ close: closeImmediately, getState, initialize, open, openCatalog });
    return api;
  }

  const api = Object.freeze({
    create,
    initialize(options = {}) {
      if (!singleton) singleton = create(options);
      return singleton.initialize();
    },
    open(mode, offerId, options = {}) {
      return singleton?.open?.(mode, offerId, options) || Promise.resolve(false);
    },
    close() {
      return singleton?.close?.() || false;
    },
    getState() {
      return singleton?.getState?.() || null;
    },
  });

  Object.defineProperty(root, 'CarRentalMulticityAdmin', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
