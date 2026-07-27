(function registerTransportRouteWizard(root) {
  'use strict';

  const TOTAL_STEPS = 5;
  const STEP_ISSUES = Object.freeze({
    1: new Set(['route']),
    2: new Set(['direction']),
    3: new Set(['price', 'pricing']),
    4: new Set(['capacity', 'pricing']),
    5: new Set(['route', 'direction', 'price', 'capacity', 'pricing']),
  });

  function createDefaultDraft() {
    return {
      route: {
        originLocationId: '',
        destinationLocationId: '',
        isActive: true,
        sortOrder: 0,
      },
      direction: {
        mode: 'outbound_only',
        existingReverseAction: 'reuse',
        reverseSettings: 'shared_settings',
      },
      price: {
        dayPrice: '',
        nightPrice: '',
        currency: 'EUR',
        reverseDayPrice: '',
        reverseNightPrice: '',
      },
      capacity: {
        includedPassengers: 2,
        includedBags: 2,
        includedLargeBags: 0,
        maxPassengers: 8,
        maxBags: 8,
      },
      legacy: {
        allowsRoundTrip: false,
        roundTripMultiplier: 2,
      },
      pricing: {
        enabled: false,
        nightStart: '22:00',
        nightEnd: '06:00',
        validFrom: '',
        validTo: '',
        priority: 0,
        isActive: true,
        extraPassengerFee: 0,
        extraBagFee: 0,
        oversizeBagFee: 0,
        childSeatFee: 0,
        boosterSeatFee: 0,
        waitingIncludedMinutes: 0,
        waitingFeePerHour: 0,
        applyToReverse: true,
        deposit: {
          enabled: false,
          mode: 'percent_total',
          value: 0,
        },
      },
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function serialize(value) {
    return JSON.stringify(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getPath(object, path) {
    return String(path || '').split('.').reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = String(path || '').split('.').filter(Boolean);
    if (!keys.length) return;
    let target = object;
    keys.slice(0, -1).forEach((key) => {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
  }

  function locationLabel(location) {
    if (!location || typeof location !== 'object') return 'Unknown location';
    const name = String(location.name || location.name_local || location.name_he || '').trim() || 'Unknown location';
    const code = String(location.code || '').trim();
    return code ? `${name} (${code})` : name;
  }

  function buildCoreDraft(draft) {
    const source = draft && typeof draft === 'object' ? draft : createDefaultDraft();
    const result = {
      route: clone(source.route || {}),
      direction: clone(source.direction || {}),
      price: clone(source.price || {}),
      capacity: clone(source.capacity || {}),
      legacy: clone(source.legacy || {}),
    };
    if (source.pricing?.enabled === true) {
      result.pricing = {
        ...clone(source.pricing),
        routeId: '$route_outbound.id',
        depositEnabled: Boolean(source.pricing.deposit?.enabled),
        depositMode: source.pricing.deposit?.mode,
        depositValue: source.pricing.deposit?.value,
      };
    }
    return result;
  }

  function create(options = {}) {
    const documentRef = options.document || root.document || null;
    const core = options.core || root.TransportAdminCore || null;
    let initialized = false;
    let returnFocus = null;
    let executionPromise = null;
    let executionController = null;
    let state = {
      isOpen: false,
      step: 1,
      dirty: false,
      submitting: false,
      partial: false,
      completed: false,
      draft: createDefaultDraft(),
      initialSerialized: '',
      existingOutbound: null,
      existingReverse: null,
      plan: null,
      receipt: null,
      executionMessage: '',
    };

    const byId = (id) => documentRef?.getElementById?.(id) || null;

    function getLocations() {
      const rows = options.getLocations?.();
      return Array.isArray(rows) ? rows : [];
    }

    function getRoutes() {
      const rows = options.getRoutes?.();
      return Array.isArray(rows) ? rows : [];
    }

    function getLocationMap() {
      return getLocations().reduce((result, row) => {
        const id = String(row?.id || '').trim();
        if (id) result[id] = row;
        return result;
      }, {});
    }

    function findRoute(originId, destinationId) {
      const origin = String(originId || '').trim();
      const destination = String(destinationId || '').trim();
      if (!origin || !destination) return null;
      return getRoutes().find((route) => (
        String(route?.origin_location_id || '').trim() === origin
          && String(route?.destination_location_id || '').trim() === destination
      )) || null;
    }

    function refreshExistingRoutes() {
      const origin = state.draft.route.originLocationId;
      const destination = state.draft.route.destinationLocationId;
      state.existingOutbound = findRoute(origin, destination);
      state.existingReverse = findRoute(destination, origin);
    }

    function buildContext() {
      refreshExistingRoutes();
      return {
        locations: getLocations(),
        locationById: getLocationMap(),
        existingOutbound: state.existingOutbound,
        existingReverse: state.existingReverse,
        depositBaseFloor: Number(options.getDepositBaseFloor?.() || 0),
      };
    }

    function getRouteDisplay(route) {
      if (!route) return '';
      const map = getLocationMap();
      const origin = locationLabel(map[String(route.origin_location_id || '').trim()]);
      const destination = locationLabel(map[String(route.destination_location_id || '').trim()]);
      return `${origin} -> ${destination}`;
    }

    function populateLocationSelects() {
      const activeLocations = getLocations()
        .filter((row) => row?.is_active !== false)
        .slice()
        .sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)));
      const optionsHtml = activeLocations.map((row) => (
        `<option value="${escapeHtml(String(row.id || ''))}">${escapeHtml(locationLabel(row))}</option>`
      )).join('');
      [
        ['transportRouteWizardOrigin', 'Select origin'],
        ['transportRouteWizardDestination', 'Select destination'],
      ].forEach(([id, placeholder]) => {
        const select = byId(id);
        if (!select) return;
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${optionsHtml}`;
      });
    }

    function syncInputsFromDraft() {
      documentRef?.querySelectorAll?.('[data-transport-route-wizard-path]').forEach((control) => {
        const path = control.getAttribute('data-transport-route-wizard-path');
        const value = getPath(state.draft, path);
        if (control instanceof root.HTMLInputElement && control.type === 'checkbox') {
          control.checked = Boolean(value);
        } else if (control instanceof root.HTMLInputElement && control.type === 'radio') {
          control.checked = String(control.value) === String(value);
        } else {
          control.value = value == null ? '' : String(value);
        }
      });
    }

    function clearErrors() {
      const errors = byId('transportRouteWizardErrors');
      if (errors) {
        errors.hidden = true;
        errors.innerHTML = '';
      }
      documentRef?.querySelectorAll?.('[data-transport-route-wizard-path][aria-invalid="true"]').forEach((control) => {
        control.removeAttribute('aria-invalid');
      });
    }

    function fieldIdForIssue(issue) {
      const map = {
        originLocationId: 'transportRouteWizardOrigin',
        destinationLocationId: 'transportRouteWizardDestination',
        price: 'transportRouteWizardDayPrice',
        reversePrice: 'transportRouteWizardReverseDayPrice',
        includedPassengers: 'transportRouteWizardIncludedPassengers',
        includedBags: 'transportRouteWizardIncludedBags',
        includedLargeBags: 'transportRouteWizardIncludedLargeBags',
        maxPassengers: 'transportRouteWizardMaxPassengers',
        maxBags: 'transportRouteWizardMaxBags',
        roundTripMultiplier: 'transportRouteWizardRoundTripMultiplier',
        extraPassengerFee: 'transportRouteWizardExtraPassenger',
        extraBagFee: 'transportRouteWizardExtraBag',
        oversizeBagFee: 'transportRouteWizardOversizeBag',
        childSeatFee: 'transportRouteWizardChildSeat',
        boosterSeatFee: 'transportRouteWizardBoosterSeat',
        waitingIncludedMinutes: 'transportRouteWizardWaitingIncluded',
        waitingFeePerHour: 'transportRouteWizardWaitingPerHour',
        depositValue: 'transportRouteWizardDepositValue',
        depositMode: 'transportRouteWizardDepositMode',
        validTo: 'transportRouteWizardValidTo',
        priority: 'transportRouteWizardPriority',
      };
      if (issue?.field === 'route') {
        return state.draft.route.originLocationId
          ? 'transportRouteWizardDestination'
          : 'transportRouteWizardOrigin';
      }
      return map[String(issue?.field || '')] || '';
    }

    function showErrors(issues) {
      const unique = [];
      const seen = new Set();
      (issues || []).forEach((issue) => {
        const key = `${issue?.code || ''}:${issue?.field || ''}:${issue?.message || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(issue);
      });
      if (!unique.length) return;
      const errors = byId('transportRouteWizardErrors');
      if (errors) {
        errors.innerHTML = `<strong>Check the highlighted fields</strong><ul>${unique.map((issue) => (
          `<li>${escapeHtml(issue?.message || 'Invalid value')}</li>`
        )).join('')}</ul>`;
        errors.hidden = false;
      }
      unique.forEach((issue) => {
        const field = byId(fieldIdForIssue(issue));
        if (field) field.setAttribute('aria-invalid', 'true');
      });
      const firstField = byId(fieldIdForIssue(unique[0]));
      firstField?.focus?.();
    }

    function validationForStep(step) {
      const context = buildContext();
      const coreDraft = buildCoreDraft(state.draft);
      const validation = core.validateTransportRouteDraft(coreDraft, context, { profile: 'wizard' });
      const allowedSteps = STEP_ISSUES[step] || STEP_ISSUES[5];
      const issues = validation.errors.filter((issue) => allowedSteps.has(issue.step));

      if (step === 1 || step === 5) {
        const existingIssue = validation.warnings.find((issue) => issue.code === 'outbound_route_exists');
        if (existingIssue) issues.push(existingIssue);
      }

      const needsReversePrices = state.draft.direction.mode === 'bidirectional'
        && state.draft.direction.reverseSettings === 'separate_prices'
        && !(state.existingReverse && state.draft.direction.existingReverseAction === 'reuse');
      if ((step === 3 || step === 5) && needsReversePrices) {
        const reverseValidation = core.validateTransportRouteDraft({
          route: {
            originLocationId: state.draft.route.destinationLocationId,
            destinationLocationId: state.draft.route.originLocationId,
            isActive: state.draft.route.isActive,
            sortOrder: state.draft.route.sortOrder,
          },
          price: {
            dayPrice: state.draft.price.reverseDayPrice,
            nightPrice: state.draft.price.reverseNightPrice,
            currency: state.draft.price.currency,
          },
          capacity: clone(state.draft.capacity),
          legacy: clone(state.draft.legacy),
        }, context, { profile: 'wizard' });
        reverseValidation.errors
          .filter((issue) => issue.step === 'price')
          .forEach((issue) => issues.push({
            ...issue,
            code: `reverse_${issue.code}`,
            field: issue.field === 'price' ? 'reversePrice' : issue.field,
            message: `Reverse route: ${issue.message}`,
          }));
      }

      return { valid: issues.length === 0, issues, validation, context, coreDraft };
    }

    function renderConditionalFields() {
      refreshExistingRoutes();
      const hasOutbound = Boolean(state.existingOutbound);
      const hasReverse = Boolean(state.existingReverse);
      const bidirectional = state.draft.direction.mode === 'bidirectional';
      const reverseReuse = hasReverse && state.draft.direction.existingReverseAction === 'reuse';

      const outboundPanel = byId('transportRouteWizardExistingOutbound');
      if (outboundPanel) outboundPanel.hidden = !hasOutbound;
      const outboundLabel = byId('transportRouteWizardExistingOutboundLabel');
      if (outboundLabel) outboundLabel.textContent = hasOutbound ? getRouteDisplay(state.existingOutbound) : '';

      const directionOptions = byId('transportRouteWizardDirectionOptions');
      if (directionOptions) directionOptions.hidden = !bidirectional;
      const reverseOptions = byId('transportRouteWizardExistingReverseOptions');
      if (reverseOptions) reverseOptions.hidden = !bidirectional || !hasReverse;
      const reverseLabel = byId('transportRouteWizardExistingReverseLabel');
      if (reverseLabel) reverseLabel.textContent = hasReverse ? getRouteDisplay(state.existingReverse) : '';
      const reverseSettings = byId('transportRouteWizardReverseSettings');
      if (reverseSettings) reverseSettings.hidden = !bidirectional || reverseReuse;

      const reversePrices = byId('transportRouteWizardReversePrices');
      if (reversePrices) {
        reversePrices.hidden = !bidirectional
          || state.draft.direction.reverseSettings !== 'separate_prices'
          || reverseReuse;
      }

      const multiplier = byId('transportRouteWizardRoundTripMultiplierField');
      if (multiplier) multiplier.hidden = !state.draft.legacy.allowsRoundTrip;
      const pricingFields = byId('transportRouteWizardPricingFields');
      if (pricingFields) pricingFields.hidden = !state.draft.pricing.enabled;
      const depositFields = byId('transportRouteWizardDepositFields');
      if (depositFields) depositFields.hidden = !state.draft.pricing.deposit.enabled;
      const depositSummary = byId('transportRouteWizardDepositSummary');
      if (depositSummary) {
        depositSummary.textContent = state.draft.pricing.deposit.enabled
          ? `Deposit: ${state.draft.pricing.deposit.mode}, ${state.draft.pricing.deposit.value || 0}`
          : 'Deposit disabled';
      }
    }

    function previewPlan() {
      const context = buildContext();
      return core.buildTransportSavePlan(buildCoreDraft(state.draft), context, {
        runId: 'wizard_preview',
      });
    }

    function statusLabel(status) {
      const labels = {
        pending: 'Pending',
        running: 'Running',
        success: 'Success',
        error: 'Error',
        skipped: 'Skipped',
      };
      return labels[String(status || '')] || 'Pending';
    }

    function stepStatusMarkup(step) {
      const status = String(step?.status || 'pending');
      const detail = step?.reconciled
        ? '<span class="transport-route-wizard__step-note">Matched to an existing saved record</span>'
        : (step?.error?.message
          ? `<span class="transport-route-wizard__step-note transport-route-wizard__step-note--error">${escapeHtml(step.error.message)}</span>`
          : '');
      return `
        <span class="transport-route-wizard__step-status transport-route-wizard__step-status--${escapeHtml(status)}" data-transport-route-wizard-status="${escapeHtml(status)}">
          ${escapeHtml(statusLabel(status))}
        </span>
        ${detail}
      `;
    }

    function renderReview() {
      const review = byId('transportRouteWizardReview');
      if (!review) return;
      const context = buildContext();
      if (!state.plan) state.plan = previewPlan();
      const plan = state.plan;
      const map = context.locationById;
      const routeSteps = plan.steps.filter((step) => step.type === 'transport_route');
      const pricingSteps = plan.steps.filter((step) => step.type === 'pricing_rule');
      const depositSteps = plan.steps.filter((step) => step.type === 'deposit_override');

      const directionForStep = (step) => {
        const payload = step.payload || (step.key === 'route_reverse' ? context.existingReverse : context.existingOutbound) || {};
        const origin = locationLabel(map[String(payload.origin_location_id || '').trim()]);
        const destination = locationLabel(map[String(payload.destination_location_id || '').trim()]);
        return `${origin} -> ${destination}`;
      };

      review.innerHTML = `
        <div class="transport-route-wizard__review-counts">
          <div><strong>${routeSteps.length}</strong> <span>route row${routeSteps.length === 1 ? '' : 's'}</span></div>
          <div><strong>${pricingSteps.length}</strong> <span>pricing row${pricingSteps.length === 1 ? '' : 's'}</span></div>
          <div><strong>${depositSteps.length}</strong> <span>deposit override${depositSteps.length === 1 ? '' : 's'}</span></div>
          <div><strong>0</strong> <span>global changes</span></div>
        </div>
        <section class="transport-route-wizard__review-section">
          <h5>Routes</h5>
          <div class="transport-route-wizard__review-list">
            ${routeSteps.map((step) => {
              const payload = step.payload || {};
              const currency = String(payload.currency || state.draft.price.currency || 'EUR').toUpperCase();
              return `
                <article data-transport-route-wizard-plan-step="${escapeHtml(step.key)}" data-step-status="${escapeHtml(step.status || 'pending')}">
                  <div><strong>${escapeHtml(directionForStep(step))}</strong><span class="transport-route-wizard__action-badge">${escapeHtml(step.action)}</span></div>
                  ${step.action === 'reuse' ? '<span>Existing reverse remains unchanged</span>' : `
                    <span>Day ${escapeHtml(payload.day_price)} ${escapeHtml(currency)} / Night ${escapeHtml(payload.night_price)} ${escapeHtml(currency)}</span>
                    <span>${escapeHtml(payload.included_passengers)} included passengers / ${escapeHtml(payload.max_passengers)} max</span>
                    <span>${escapeHtml(payload.included_bags)} small + ${escapeHtml(payload.included_large_bags)} large bags / ${escapeHtml(payload.max_bags)} max</span>
                  `}
                  <div class="transport-route-wizard__step-result">${stepStatusMarkup(step)}</div>
                </article>
              `;
            }).join('')}
          </div>
        </section>
        ${pricingSteps.length ? `
          <section class="transport-route-wizard__review-section">
            <h5>Pricing rules</h5>
            <div class="transport-route-wizard__review-list">
              ${pricingSteps.map((step) => `
                <article data-transport-route-wizard-plan-step="${escapeHtml(step.key)}" data-step-status="${escapeHtml(step.status || 'pending')}">
                  <div><strong>${escapeHtml(step.key === 'pricing_reverse' ? 'Reverse pricing' : 'Outbound pricing')}</strong><span class="transport-route-wizard__action-badge">${escapeHtml(step.action)}</span></div>
                  <span>Night ${escapeHtml(step.payload?.night_start)}-${escapeHtml(step.payload?.night_end)} / priority ${escapeHtml(step.payload?.priority)}</span>
                  <span>Extra passenger ${escapeHtml(step.payload?.extra_passenger_fee)} / bag ${escapeHtml(step.payload?.extra_bag_fee)} / oversize ${escapeHtml(step.payload?.oversize_bag_fee)}</span>
                  <span>Waiting ${escapeHtml(step.payload?.waiting_included_minutes)} min included / ${escapeHtml(step.payload?.waiting_fee_per_hour)} per hour</span>
                  <div class="transport-route-wizard__step-result">${stepStatusMarkup(step)}</div>
                </article>
              `).join('')}
            </div>
          </section>
        ` : ''}
        ${depositSteps.length ? `
          <section class="transport-route-wizard__review-section">
            <h5>Deposit overrides</h5>
            <div class="transport-route-wizard__review-list">
              ${depositSteps.map((step) => `
                <article data-transport-route-wizard-plan-step="${escapeHtml(step.key)}" data-step-status="${escapeHtml(step.status || 'pending')}">
                  <div><strong>${escapeHtml(step.payload?.mode)}</strong><span class="transport-route-wizard__action-badge">${escapeHtml(step.action)}</span></div>
                  <span>${escapeHtml(step.payload?.amount)} ${escapeHtml(step.payload?.currency)}</span>
                  <div class="transport-route-wizard__step-result">${stepStatusMarkup(step)}</div>
                </article>
              `).join('')}
            </div>
          </section>
        ` : ''}
        <div class="transport-route-wizard__scope-note"><strong>Scope:</strong> only the routes and optional pricing shown above. No global settings will change.</div>
      `;
    }

    function renderExecutionStatus() {
      const status = byId('transportRouteWizardSaveStatus');
      if (!status) return;
      const plan = state.plan;
      if (!plan || plan.id === 'wizard_preview') {
        status.hidden = true;
        status.textContent = '';
        return;
      }
      const succeeded = plan.steps.filter((step) => step.status === 'success').length;
      const failed = plan.steps.filter((step) => step.status === 'error').length;
      const skipped = plan.steps.filter((step) => step.status === 'skipped').length;
      const running = plan.steps.find((step) => step.status === 'running');
      status.hidden = false;
      status.className = 'transport-route-wizard__save-status';
      if (state.submitting) {
        status.textContent = running
          ? `Saving ${running.key.replace(/_/g, ' ')}... ${succeeded} of ${plan.steps.length} complete.`
          : `Preparing save... ${succeeded} of ${plan.steps.length} complete.`;
        return;
      }
      if (plan.status === 'success') {
        status.classList.add('transport-route-wizard__save-status--success');
        status.textContent = plan.refreshError?.message
          ? `Save complete. ${succeeded} step${succeeded === 1 ? '' : 's'} succeeded. Refresh the Routes list before continuing.`
          : `Save complete. ${succeeded} step${succeeded === 1 ? '' : 's'} succeeded.`;
        return;
      }
      if (plan.status === 'partial' || plan.status === 'error') {
        status.classList.add('transport-route-wizard__save-status--error');
        status.textContent = `${succeeded} succeeded, ${failed} failed, ${skipped} skipped. Successful steps will not run again.`;
        return;
      }
      if (plan.status === 'cancelled') {
        status.classList.add('transport-route-wizard__save-status--error');
        status.textContent = `Save cancelled. ${succeeded} step${succeeded === 1 ? '' : 's'} completed before cancellation.`;
        return;
      }
      if (state.executionMessage) {
        status.classList.add('transport-route-wizard__save-status--error');
        status.textContent = state.executionMessage;
      }
    }

    function renderReceipt() {
      const receipt = byId('transportRouteWizardReceipt');
      const summary = byId('transportRouteWizardReceiptSummary');
      if (!receipt || !summary) return;
      const plan = state.plan;
      const visible = state.completed && plan?.status === 'success';
      receipt.hidden = !visible;
      if (!visible) {
        summary.innerHTML = '';
        return;
      }
      const successful = plan.steps.filter((step) => step.status === 'success');
      const createdRoutes = successful.filter((step) => step.type === 'transport_route' && step.action === 'insert');
      const routeIds = successful.filter((step) => step.type === 'transport_route').map((step) => step.result?.id).filter(Boolean);
      const pricingIds = successful.filter((step) => step.type === 'pricing_rule').map((step) => step.result?.id).filter(Boolean);
      const depositIds = successful.filter((step) => step.type === 'deposit_override').map((step) => step.result?.id).filter(Boolean);
      const formatIds = (ids) => ids.length ? ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(' ') : '<span>None</span>';
      summary.innerHTML = `
        <dl>
          <div><dt>Created routes</dt><dd>${createdRoutes.length}</dd></div>
          <div><dt>Route IDs</dt><dd>${formatIds(routeIds)}</dd></div>
          <div><dt>Pricing IDs</dt><dd>${formatIds(pricingIds)}</dd></div>
          <div><dt>Deposit IDs</dt><dd>${formatIds(depositIds)}</dd></div>
          <div><dt>Execution time</dt><dd>${escapeHtml(plan.execution?.durationMs || 0)} ms</dd></div>
        </dl>
      `;
      state.receipt = {
        createdRoutes: createdRoutes.length,
        routeIds,
        pricingIds,
        depositIds,
        durationMs: Number(plan.execution?.durationMs || 0),
      };
    }

    function renderStep() {
      documentRef?.querySelectorAll?.('[data-transport-route-wizard-step]').forEach((panel) => {
        panel.hidden = Number(panel.getAttribute('data-transport-route-wizard-step')) !== state.step;
      });
      documentRef?.querySelectorAll?.('[data-transport-route-wizard-progress]').forEach((item) => {
        const step = Number(item.getAttribute('data-transport-route-wizard-progress'));
        item.classList.toggle('is-active', step === state.step && !state.completed);
        item.classList.toggle('is-complete', state.completed || step < state.step);
        if (step === state.step) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      });
      const back = byId('btnTransportRouteWizardBack');
      const next = byId('btnTransportRouteWizardNext');
      const save = byId('btnTransportRouteWizardSave');
      const retry = byId('btnTransportRouteWizardRetry');
      const cancel = byId('btnTransportRouteWizardCancel');
      const close = byId('btnTransportRouteWizardClose');
      const retryable = state.plan?.execution?.retryable?.length > 0;
      const executionStarted = Boolean(state.plan && state.plan.id !== 'wizard_preview' && state.plan.attempts > 0);
      if (back) {
        back.hidden = state.step === 1 || state.completed || executionStarted;
        back.disabled = state.submitting;
      }
      if (next) {
        next.hidden = state.step === TOTAL_STEPS || state.completed;
        next.disabled = state.submitting || (state.step === 1 && Boolean(state.existingOutbound));
      }
      if (save) {
        save.hidden = state.step !== TOTAL_STEPS || state.completed || state.partial;
        save.disabled = state.submitting;
        save.textContent = state.submitting ? 'Saving...' : 'Save';
      }
      if (retry) {
        retry.hidden = state.step !== TOTAL_STEPS || state.completed || !state.partial || !retryable;
        retry.disabled = state.submitting;
        retry.textContent = state.submitting ? 'Retrying...' : 'Retry failed steps';
      }
      if (cancel) {
        cancel.hidden = state.completed;
        cancel.disabled = state.submitting;
      }
      if (close) close.disabled = state.submitting;
      if (state.step === TOTAL_STEPS) {
        renderReview();
        renderExecutionStatus();
        renderReceipt();
      }
      renderConditionalFields();
    }

    function updateDirtyState() {
      state.dirty = serialize(state.draft) !== state.initialSerialized;
    }

    function handleDraftInput(event) {
      const control = event.target;
      if (!control?.getAttribute) return;
      const path = control.getAttribute('data-transport-route-wizard-path');
      if (!path) return;
      if (control instanceof root.HTMLInputElement && control.type === 'radio' && !control.checked) return;
      let value = control.value;
      if (control instanceof root.HTMLInputElement && control.type === 'checkbox') value = control.checked;
      if (control instanceof root.HTMLInputElement && control.type === 'number') {
        value = control.value === '' ? '' : Number(control.value);
      }
      setPath(state.draft, path, value);
      state.plan = null;
      state.receipt = null;
      state.partial = false;
      state.completed = false;
      state.executionMessage = '';
      updateDirtyState();
      clearErrors();
      renderConditionalFields();
      const next = byId('btnTransportRouteWizardNext');
      if (next && state.step === 1) next.disabled = Boolean(state.existingOutbound);
    }

    function goNext() {
      if (state.submitting || state.step >= TOTAL_STEPS) return;
      clearErrors();
      const result = validationForStep(state.step);
      if (!result.valid) {
        showErrors(result.issues);
        return;
      }
      state.step += 1;
      renderStep();
      byId(`transportRouteWizardStep${state.step}Title`)?.focus?.();
    }

    function goBack() {
      if (state.submitting || state.step <= 1) return;
      clearErrors();
      state.step -= 1;
      renderStep();
    }

    function closeImmediately() {
      if (state.submitting) return false;
      const modal = byId('transportRouteWizardModal');
      if (modal) modal.hidden = true;
      const discard = byId('transportRouteWizardDiscardDialog');
      if (discard) discard.hidden = true;
      documentRef?.body?.classList?.remove('transport-route-wizard-open');
      state.isOpen = false;
      returnFocus?.focus?.();
      returnFocus = null;
      return true;
    }

    function requestClose() {
      if (state.submitting) return;
      if (state.completed || !state.dirty) {
        closeImmediately();
        return;
      }
      const discard = byId('transportRouteWizardDiscardDialog');
      if (discard) discard.hidden = false;
      byId('btnTransportRouteWizardStay')?.focus?.();
    }

    function openExistingRoute() {
      const routeId = String(state.existingOutbound?.id || '').trim();
      if (!routeId) return;
      closeImmediately();
      options.onOpenExistingRoute?.(routeId);
    }

    function newRunId() {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') {
        return `transport_wizard_${root.crypto.randomUUID()}`;
      }
      return `transport_wizard_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function resetOpenDraft() {
      state = {
        isOpen: true,
        step: 1,
        dirty: false,
        submitting: false,
        partial: false,
        completed: false,
        draft: createDefaultDraft(),
        initialSerialized: '',
        existingOutbound: null,
        existingReverse: null,
        plan: null,
        receipt: null,
        executionMessage: '',
      };
      state.initialSerialized = serialize(state.draft);
      populateLocationSelects();
      syncInputsFromDraft();
      refreshExistingRoutes();
      clearErrors();
      const status = byId('transportRouteWizardSaveStatus');
      if (status) {
        status.hidden = true;
        status.textContent = '';
      }
      const receipt = byId('transportRouteWizardReceipt');
      if (receipt) receipt.hidden = true;
      const discard = byId('transportRouteWizardDiscardDialog');
      if (discard) discard.hidden = true;
      ['transportRouteWizardLegacySettings', 'transportRouteWizardPricingAdvanced'].forEach((id) => {
        const details = byId(id);
        if (details) details.open = false;
      });
    }

    function createAnother() {
      if (state.submitting || !state.completed) return;
      resetOpenDraft();
      renderStep();
      byId('transportRouteWizardOrigin')?.focus?.();
    }

    function openCreatedRoute() {
      if (state.submitting || !state.completed) return;
      const routeId = String(
        state.plan?.steps?.find((step) => step.key === 'route_outbound')?.result?.id || '',
      ).trim();
      if (!routeId) return;
      closeImmediately();
      options.onOpenExistingRoute?.(routeId);
    }

    async function save(retry = false) {
      if (executionPromise) return executionPromise;
      if (state.submitting || state.completed || state.step !== TOTAL_STEPS) return null;

      let check = null;
      if (!retry) {
        clearErrors();
        check = validationForStep(5);
        if (!check.valid) {
          showErrors(check.issues);
          return null;
        }
        state.plan = core.buildTransportSavePlan(check.coreDraft, check.context, {
          runId: newRunId(),
          createdAt: new Date().toISOString(),
        });
      } else if (!state.plan?.execution?.retryable?.length) {
        return state.plan;
      }

      state.submitting = true;
      state.partial = false;
      state.executionMessage = '';
      executionController = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      renderStep();

      executionPromise = (async () => {
        try {
          if (typeof options.onExecute !== 'function') throw new Error('Save execution is unavailable');
          const result = await options.onExecute(clone(state.plan), {
            retry,
            signal: executionController?.signal || null,
            onProgress: (nextPlan) => {
              state.plan = clone(nextPlan);
              renderStep();
            },
          });
          state.plan = clone(result);
          if (state.plan.status === 'success') {
            state.completed = true;
            state.partial = false;
            state.dirty = false;
            state.initialSerialized = serialize(state.draft);
            await options.onSaved?.(state.plan);
          } else {
            state.partial = ['partial', 'error', 'cancelled'].includes(state.plan.status);
          }
          return state.plan;
        } catch (error) {
          state.partial = true;
          state.executionMessage = String(error?.message || 'Route could not be saved.');
          return state.plan;
        } finally {
          state.submitting = false;
          executionController = null;
          renderStep();
        }
      })();

      try {
        return await executionPromise;
      } finally {
        executionPromise = null;
      }
    }

    function handleKeydown(event) {
      if (!state.isOpen) return;
      const discard = byId('transportRouteWizardDiscardDialog');
      if (event.key === 'Escape') {
        event.preventDefault();
        if (discard && !discard.hidden) {
          discard.hidden = true;
          byId('btnTransportRouteWizardCancel')?.focus?.();
        } else {
          requestClose();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const modal = byId('transportRouteWizardModal');
      const focusable = [...(modal?.querySelectorAll?.('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary') || [])]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      if (!initialized) initialize();
      const modal = byId('transportRouteWizardModal');
      if (!modal || !core) return false;
      returnFocus = documentRef.activeElement;
      resetOpenDraft();
      modal.hidden = false;
      documentRef?.body?.classList?.add('transport-route-wizard-open');
      renderStep();
      root.requestAnimationFrame?.(() => byId('transportRouteWizardOrigin')?.focus?.());
      return true;
    }

    function initialize() {
      if (initialized) return api;
      const modal = byId('transportRouteWizardModal');
      if (modal && documentRef?.body && modal.parentElement !== documentRef.body) {
        documentRef.body.append(modal);
      }
      const form = byId('transportRouteWizardForm');
      form?.addEventListener?.('input', handleDraftInput);
      form?.addEventListener?.('submit', (event) => event.preventDefault());
      byId('btnTransportRouteWizardNext')?.addEventListener?.('click', goNext);
      byId('btnTransportRouteWizardBack')?.addEventListener?.('click', goBack);
      byId('btnTransportRouteWizardSave')?.addEventListener?.('click', () => void save());
      byId('btnTransportRouteWizardRetry')?.addEventListener?.('click', () => void save(true));
      byId('btnTransportRouteWizardCancel')?.addEventListener?.('click', requestClose);
      byId('btnTransportRouteWizardClose')?.addEventListener?.('click', requestClose);
      byId('transportRouteWizardBackdrop')?.addEventListener?.('click', requestClose);
      byId('btnTransportRouteWizardOpenExisting')?.addEventListener?.('click', openExistingRoute);
      byId('btnTransportRouteWizardStay')?.addEventListener?.('click', () => {
        const discard = byId('transportRouteWizardDiscardDialog');
        if (discard) discard.hidden = true;
      });
      byId('btnTransportRouteWizardLeave')?.addEventListener?.('click', closeImmediately);
      byId('btnTransportRouteWizardCreateAnother')?.addEventListener?.('click', createAnother);
      byId('btnTransportRouteWizardOpenCreated')?.addEventListener?.('click', openCreatedRoute);
      byId('btnTransportRouteWizardReceiptClose')?.addEventListener?.('click', closeImmediately);
      documentRef?.addEventListener?.('keydown', handleKeydown);
      initialized = true;
      return api;
    }

    function getState() {
      return clone({
        ...state,
        existingOutbound: state.existingOutbound,
        existingReverse: state.existingReverse,
      });
    }

    function cancelExecution(reason = 'Save cancelled') {
      if (!state.submitting || !executionController) return false;
      executionController.abort(reason);
      return true;
    }

    const api = Object.freeze({ cancelExecution, close: closeImmediately, getState, initialize, open });
    return api;
  }

  let singleton = null;

  function initialize(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton.initialize();
  }

  function open() {
    return singleton?.open?.() || false;
  }

  function close() {
    singleton?.close?.();
  }

  function cancelExecution(reason) {
    return singleton?.cancelExecution?.(reason) || false;
  }

  function getState() {
    return singleton?.getState?.() || null;
  }

  const api = Object.freeze({
    buildCoreDraft,
    cancelExecution,
    close,
    create,
    createDefaultDraft,
    getState,
    initialize,
    open,
  });

  Object.defineProperty(root, 'TransportRouteWizard', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
