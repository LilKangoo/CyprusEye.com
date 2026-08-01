(function registerTransportPairPricingModal(root) {
  'use strict';

  const TABLES = Object.freeze({
    routes: 'transport_routes',
    pricingRules: 'transport_pricing_rules',
    depositOverrides: 'service_deposit_overrides',
    depositDefaults: 'service_deposit_rules',
  });

  const ROUTE_PRICE_FIELDS = Object.freeze([
    'day_price',
    'night_price',
    'currency',
  ]);
  const ROUTE_CAPACITY_FIELDS = Object.freeze([
    'included_passengers',
    'included_bags',
    'included_large_bags',
    'max_passengers',
    'max_bags',
  ]);
  const PRICING_FEE_FIELDS = Object.freeze([
    'extra_passenger_fee',
    'extra_bag_fee',
    'oversize_bag_fee',
    'child_seat_fee',
    'booster_seat_fee',
    'waiting_included_minutes',
    'waiting_fee_per_hour',
  ]);
  const PRICING_DEPOSIT_FIELDS = Object.freeze([
    'night_start',
    'night_end',
    'deposit_enabled',
    'deposit_mode',
    'deposit_value',
  ]);

  const SHARED_FIELD_COLUMNS = Object.freeze({
    dayPrice: 'day_price',
    nightPrice: 'night_price',
    currency: 'currency',
    includedPassengers: 'included_passengers',
    includedBags: 'included_bags',
    includedLargeBags: 'included_large_bags',
    maxPassengers: 'max_passengers',
    maxBags: 'max_bags',
    extraPassengerFee: 'extra_passenger_fee',
    extraBagFee: 'extra_bag_fee',
    oversizeBagFee: 'oversize_bag_fee',
    childSeatFee: 'child_seat_fee',
    boosterSeatFee: 'booster_seat_fee',
    waitingIncludedMinutes: 'waiting_included_minutes',
    waitingFeePerHour: 'waiting_fee_per_hour',
    nightStart: 'night_start',
    nightEnd: 'night_end',
    depositEnabled: 'deposit_enabled',
    depositMode: 'deposit_mode',
    depositValue: 'deposit_value',
  });

  const SHARED_FIELD_INPUT_IDS = Object.freeze(Object.keys(SHARED_FIELD_COLUMNS).reduce((result, field) => {
    result[field] = `transportPairPricing${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    return result;
  }, {}));

  let singleton = null;

  function clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value || '').trim();
  }

  function normalizeCurrency(value) {
    return String(value || '').trim().toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function findReverseRouteInRows(routes, outboundOrOriginId, destinationIdRaw) {
    const rows = Array.isArray(routes) ? routes : [];
    const outbound = outboundOrOriginId && typeof outboundOrOriginId === 'object'
      ? outboundOrOriginId
      : null;
    const outboundId = normalizeId(outbound?.id);
    const originId = normalizeId(outbound?.origin_location_id || outboundOrOriginId);
    const destinationId = normalizeId(outbound?.destination_location_id || destinationIdRaw);
    if (!originId || !destinationId) return null;
    return rows.find((row) => (
      normalizeId(row?.id) !== outboundId
        && normalizeId(row?.origin_location_id) === destinationId
        && normalizeId(row?.destination_location_id) === originId
    )) || null;
  }

  function sortPricingRules(rules) {
    return (Array.isArray(rules) ? rules : []).slice().sort((a, b) => {
      const priorityDifference = Number(a?.priority || 0) - Number(b?.priority || 0);
      if (priorityDifference !== 0) return priorityDifference;
      const leftTime = new Date(a?.updated_at || a?.created_at || 0).getTime() || 0;
      const rightTime = new Date(b?.updated_at || b?.created_at || 0).getTime() || 0;
      return rightTime - leftTime;
    });
  }

  function selectInitialPricingRuleId(rules) {
    const rows = Array.isArray(rules) ? rules : [];
    if (rows.length !== 1 || rows[0]?.is_active !== true) return '';
    return normalizeId(rows[0]?.id);
  }

  function comparableValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    const text = String(value).trim();
    if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) return text.slice(0, 5);
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    return text;
  }

  function valuesDiffer(left, right) {
    return comparableValue(left) !== comparableValue(right);
  }

  function comparePairValues(outbound, reverse, fields) {
    const keys = Array.isArray(fields) ? fields : [];
    const available = Boolean(outbound && reverse);
    const differences = keys.filter((field) => (
      available && valuesDiffer(outbound?.[field], reverse?.[field])
    ));
    return {
      available,
      different: differences.length > 0,
      differences,
    };
  }

  function hasCurrencyConflict(outbound, reverse) {
    if (!outbound || !reverse) return false;
    const outboundCurrency = normalizeCurrency(outbound.currency);
    const reverseCurrency = normalizeCurrency(reverse.currency);
    return Boolean(outboundCurrency && reverseCurrency && outboundCurrency !== reverseCurrency);
  }

  function createReadRepository(options = {}) {
    const runRead = options.runRead;
    if (typeof runRead !== 'function') throw new Error('runRead dependency is required');

    async function read(operation) {
      const result = await runRead(operation);
      if (result?.error) throw result.error;
      return result?.data ?? null;
    }

    async function getRouteById(routeId) {
      const id = normalizeId(routeId);
      if (!id) return null;
      const data = await read((client) => client
        .from(TABLES.routes)
        .select('*')
        .eq('id', id)
        .limit(2));
      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (rows.length > 1) {
        const error = new Error(`Multiple transport routes found for ID ${id}`);
        error.code = 'transport_pair_route_read_ambiguous';
        throw error;
      }
      return rows[0] || null;
    }

    async function findReverseRoute(originIdRaw, destinationIdRaw) {
      const originId = normalizeId(originIdRaw);
      const destinationId = normalizeId(destinationIdRaw);
      if (!originId || !destinationId) return null;
      const data = await read((client) => client
        .from(TABLES.routes)
        .select('*')
        .eq('origin_location_id', destinationId)
        .eq('destination_location_id', originId)
        .limit(2));
      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (rows.length > 1) {
        const error = new Error('Multiple reverse transport routes found for the same location pair');
        error.code = 'transport_pair_reverse_read_ambiguous';
        throw error;
      }
      return rows[0] || null;
    }

    async function listPricingRulesByRouteIds(routeIds) {
      const ids = Array.from(new Set((Array.isArray(routeIds) ? routeIds : [])
        .map(normalizeId)
        .filter(Boolean)));
      if (!ids.length) return [];
      const data = await read((client) => client
        .from(TABLES.pricingRules)
        .select('*')
        .in('route_id', ids)
        .limit(2000));
      return sortPricingRules(Array.isArray(data) ? data : []);
    }

    async function listDepositOverridesByRouteIds(routeIds) {
      const ids = Array.from(new Set((Array.isArray(routeIds) ? routeIds : [])
        .map(normalizeId)
        .filter(Boolean)));
      if (!ids.length) return [];
      const data = await read((client) => client
        .from(TABLES.depositOverrides)
        .select('*')
        .eq('resource_type', 'transport')
        .in('resource_id', ids)
        .limit(2000));
      return Array.isArray(data) ? data : [];
    }

    async function getTransportDepositDefault() {
      const data = await read((client) => client
        .from(TABLES.depositDefaults)
        .select('*')
        .eq('resource_type', 'transport')
        .limit(2));
      const rows = Array.isArray(data) ? data : (data ? [data] : []);
      if (rows.length > 1) {
        const error = new Error('Multiple global transport deposit rules found');
        error.code = 'transport_pair_deposit_default_read_ambiguous';
        throw error;
      }
      return rows[0] || null;
    }

    return Object.freeze({
      findReverseRoute,
      getRouteById,
      getTransportDepositDefault,
      listDepositOverridesByRouteIds,
      listPricingRulesByRouteIds,
    });
  }

  function create(options = {}) {
    const documentRef = options.document || root.document || null;
    const repository = options.repository || null;
    const draftCore = options.core || root.TransportPairPricingCore || null;
    const saveCore = options.saveCore || root.TransportAdminCore || null;
    const saveRepository = options.saveRepository || null;
    let initialized = false;
    let returnFocus = null;
    let readGeneration = 0;
    let executionPromise = null;
    let state = {
      isOpen: false,
      loading: false,
      routeId: '',
      outbound: null,
      reverse: null,
      pricingRules: [],
      depositOverrides: [],
      depositDefault: null,
      selectedRuleIds: { outbound: '', reverse: '' },
      advancedDirection: 'outbound',
      fetchedAt: '',
      error: null,
      view: 'edit',
      draft: null,
      confirmationOpen: false,
      recoveryDialogOpen: false,
      recoveryDialogMode: null,
      recoveryHistory: [],
      isExecuting: false,
      preflight: null,
      retryPrecheck: null,
      savePlan: null,
      saveOutcome: null,
      receipt: null,
      saveError: null,
      executionAnnouncement: '',
    };

    const byId = (id) => documentRef?.getElementById?.(id) || null;

    function setControlDisabled(control, disabled) {
      if (!control) return;
      const next = Boolean(disabled);
      control.disabled = next;
      control.setAttribute?.('aria-disabled', next ? 'true' : 'false');
    }

    function getLocation(locationId) {
      const row = options.getLocationById?.(normalizeId(locationId));
      return row && typeof row === 'object' ? row : null;
    }

    function locationName(locationId) {
      const location = getLocation(locationId);
      return String(location?.name || location?.name_en || location?.name_local || locationId || 'Unknown location').trim();
    }

    function locationCode(locationId) {
      const location = getLocation(locationId);
      return String(location?.code || '').trim().toUpperCase();
    }

    function locationDisplay(locationId) {
      const name = locationName(locationId);
      const code = locationCode(locationId);
      return code ? `${name} (${code})` : name;
    }

    function routeDirection(route) {
      if (!route) return 'Unavailable direction';
      return `${locationDisplay(route.origin_location_id)} → ${locationDisplay(route.destination_location_id)}`;
    }

    function rulesForRoute(route) {
      const routeId = normalizeId(route?.id);
      if (!routeId) return [];
      return sortPricingRules(state.pricingRules.filter((rule) => normalizeId(rule?.route_id) === routeId));
    }

    function selectedRule(direction) {
      const id = normalizeId(state.selectedRuleIds?.[direction]);
      if (!id) return null;
      const route = direction === 'reverse' ? state.reverse : state.outbound;
      return state.pricingRules.find((rule) => (
        normalizeId(rule?.id) === id && normalizeId(rule?.route_id) === normalizeId(route?.id)
      )) || null;
    }

    function overrideForRoute(route) {
      const routeId = normalizeId(route?.id);
      if (!routeId) return null;
      return state.depositOverrides.find((row) => (
        String(row?.resource_type || '').trim() === 'transport'
          && normalizeId(row?.resource_id) === routeId
      )) || null;
    }

    function formatDate(value, emptyLabel) {
      const text = String(value || '').trim();
      return text || emptyLabel;
    }

    function formatDateTime(value) {
      const text = String(value || '').trim();
      if (!text) return 'Unknown';
      const timestamp = new Date(text);
      if (Number.isNaN(timestamp.getTime())) return text;
      return timestamp.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    function pricingSummary(rule) {
      if (!rule) return '';
      return [
        `pax ${Number(rule.extra_passenger_fee || 0)}`,
        `small ${Number(rule.extra_bag_fee || 0)}`,
        `large ${Number(rule.oversize_bag_fee || 0)}`,
        `wait ${Number(rule.waiting_fee_per_hour || 0)}/h`,
      ].join(' · ');
    }

    function pricingOptionLabel(rule) {
      const id = normalizeId(rule?.id);
      const status = rule?.is_active === false ? 'INACTIVE' : 'ACTIVE';
      const priority = Number(rule?.priority || 0);
      const validity = `${formatDate(rule?.valid_from, 'Always')} → ${formatDate(rule?.valid_to, 'No end')}`;
      return `${id} · ${status} · priority ${priority} · ${validity} · updated ${formatDateTime(rule?.updated_at || rule?.created_at)} · ${pricingSummary(rule)}`;
    }

    function selectorMessage(rules) {
      if (!rules.length) return 'No pricing rule. Creation will be available in a later stage.';
      if (rules.length > 1) return 'Multiple pricing rules found. Select the exact rule ID consciously.';
      if (rules[0]?.is_active === false) return 'The only pricing rule is inactive and was not selected automatically.';
      return 'The only active pricing rule was selected automatically.';
    }

    function renderRuleSelector(direction, route) {
      const isReverse = direction === 'reverse';
      const label = isReverse ? 'Reverse pricing rule' : 'Outbound pricing rule';
      const selectId = isReverse
        ? 'transportPairPricingReverseRule'
        : 'transportPairPricingOutboundRule';
      if (!route) {
        return `
          <section class="transport-pair-pricing-modal__rule-card transport-pair-pricing-modal__rule-card--missing">
            <h4>${escapeHtml(label)}</h4>
            <p>Reverse route missing. No pricing rule can be selected.</p>
          </section>
        `;
      }

      const rules = rulesForRoute(route);
      const selectedId = normalizeId(state.selectedRuleIds?.[direction]);
      const optionsMarkup = rules.map((rule) => `
        <option value="${escapeHtml(normalizeId(rule?.id))}" ${normalizeId(rule?.id) === selectedId ? 'selected' : ''}>
          ${escapeHtml(pricingOptionLabel(rule))}
        </option>
      `).join('');
      return `
        <section class="transport-pair-pricing-modal__rule-card" data-rule-direction="${escapeHtml(direction)}">
          <div class="transport-pair-pricing-modal__rule-card-heading">
            <div>
              <h4>${escapeHtml(label)}</h4>
              <span>${escapeHtml(routeDirection(route))}</span>
            </div>
            <span class="transport-pair-pricing-modal__count">${rules.length} rule${rules.length === 1 ? '' : 's'}</span>
          </div>
          ${rules.length ? `
            <label class="admin-form-field">
              <span>Exact pricing rule ID</span>
              <select id="${escapeHtml(selectId)}" class="form-control" data-transport-pair-rule-selector="${escapeHtml(direction)}">
                <option value="">Select exact pricing rule</option>
                ${optionsMarkup}
              </select>
            </label>
          ` : `
            <button class="btn-secondary" type="button" disabled>Create new rule (future stage)</button>
          `}
          <p class="transport-pair-pricing-modal__selector-note">${escapeHtml(selectorMessage(rules))}</p>
        </section>
      `;
    }

    function formatFieldValue(value, type) {
      if (value === null || value === undefined || value === '') return '—';
      if (type === 'boolean') return value ? 'Enabled' : 'Disabled';
      if (type === 'time') return String(value).slice(0, 5) || '—';
      if (type === 'currency') return normalizeCurrency(value) || '—';
      return String(value);
    }

    function comparisonRow(config) {
      const bothAvailable = Boolean(config.leftAvailable && config.rightAvailable);
      const different = bothAvailable && valuesDiffer(config.leftValue, config.rightValue);
      const leftValue = config.leftAvailable
        ? formatFieldValue(config.leftValue, config.type)
        : config.leftMissingLabel;
      const rightValue = config.rightAvailable
        ? formatFieldValue(config.rightValue, config.type)
        : config.rightMissingLabel;
      return {
        different,
        markup: `
          <div class="transport-pair-pricing-modal__comparison-row" data-transport-pair-field="${escapeHtml(config.field)}" data-different="${different ? 'true' : 'false'}">
            <span class="transport-pair-pricing-modal__field-label">${escapeHtml(config.label)}</span>
            <span>${escapeHtml(leftValue || '—')}</span>
            <span>${escapeHtml(rightValue || '—')}</span>
          </div>
        `,
      };
    }

    function comparisonSection(title, rows) {
      const different = rows.some((row) => row.different);
      return `
        <section class="transport-pair-pricing-modal__section" data-section-different="${different ? 'true' : 'false'}">
          <header>
            <h3>${escapeHtml(title)}</h3>
            ${different ? '<span class="transport-pair-pricing-modal__different-badge">Different values</span>' : ''}
          </header>
          <div class="transport-pair-pricing-modal__comparison-head" aria-hidden="true">
            <span>Field</span>
            <span>A → B</span>
            <span>B → A</span>
          </div>
          ${rows.map((row) => row.markup).join('')}
        </section>
      `;
    }

    function routeRows(fields) {
      const labels = {
        day_price: 'Day price',
        night_price: 'Night price',
        currency: 'Currency',
        included_passengers: 'Included passengers',
        included_bags: 'Included small backpacks',
        included_large_bags: 'Included large bags',
        max_passengers: 'Max passengers',
        max_bags: 'Max total luggage',
      };
      return fields.map((field) => comparisonRow({
        field,
        label: labels[field] || field,
        leftValue: state.outbound?.[field],
        rightValue: state.reverse?.[field],
        leftAvailable: Boolean(state.outbound),
        rightAvailable: Boolean(state.reverse),
        leftMissingLabel: 'Outbound unavailable',
        rightMissingLabel: 'Reverse missing',
        type: field === 'currency' ? 'currency' : '',
      }));
    }

    function pricingRows(fields) {
      const outboundRule = selectedRule('outbound');
      const reverseRule = selectedRule('reverse');
      const labels = {
        extra_passenger_fee: 'Extra passenger fee',
        extra_bag_fee: 'Extra small backpack fee',
        oversize_bag_fee: 'Extra large bag fee',
        child_seat_fee: 'Child seat',
        booster_seat_fee: 'Booster seat',
        waiting_included_minutes: 'Waiting included minutes',
        waiting_fee_per_hour: 'Waiting fee per hour',
        night_start: 'Night start',
        night_end: 'Night end',
        deposit_enabled: 'Deposit enabled',
        deposit_mode: 'Deposit mode',
        deposit_value: 'Deposit value',
      };
      return fields.map((field) => comparisonRow({
        field,
        label: labels[field] || field,
        leftValue: outboundRule?.[field],
        rightValue: reverseRule?.[field],
        leftAvailable: Boolean(outboundRule),
        rightAvailable: Boolean(reverseRule),
        leftMissingLabel: rulesForRoute(state.outbound).length ? 'Select pricing rule' : 'No pricing rule',
        rightMissingLabel: state.reverse
          ? (rulesForRoute(state.reverse).length ? 'Select pricing rule' : 'No pricing rule')
          : 'Reverse missing',
        type: field === 'deposit_enabled' ? 'boolean' : (field === 'night_start' || field === 'night_end' ? 'time' : ''),
      }));
    }

    function overrideSummary(row) {
      if (!row) return 'No route-level override';
      const mode = String(row.mode || '—').trim();
      const amount = Number(row.amount || 0);
      const currency = normalizeCurrency(row.currency) || '—';
      const children = row.include_children ? 'children included' : 'children excluded';
      const status = row.enabled === false ? 'inactive' : 'active';
      return `${mode} · ${amount} ${currency} · ${children} · ${status}`;
    }

    function routeIdentityCard(route, label) {
      if (!route) {
        return `
          <article class="transport-pair-pricing-modal__route-card transport-pair-pricing-modal__route-card--missing">
            <span>${escapeHtml(label)}</span>
            <strong>Reverse route missing</strong>
          </article>
        `;
      }
      const status = route?.is_active === false ? 'INACTIVE' : 'ACTIVE';
      return `
        <article class="transport-pair-pricing-modal__route-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(routeDirection(route))}</strong>
          <code>${escapeHtml(normalizeId(route.id))}</code>
          <div>
            <span class="transport-pair-pricing-modal__status transport-pair-pricing-modal__status--${status.toLowerCase()}">${status}</span>
            <span>${escapeHtml(normalizeCurrency(route.currency) || 'No currency')}</span>
          </div>
        </article>
      `;
    }

    function validationErrorsForField(field) {
      return (state.draft?.validation?.errors || []).filter((entry) => entry?.field === field);
    }

    function editorInput(config) {
      const field = config.field;
      const inputId = SHARED_FIELD_INPUT_IDS[field];
      const value = state.draft?.shared?.[field];
      const mixed = state.draft?.mixed?.[field]?.isMixed === true;
      const errors = validationErrorsForField(field);
      const describedBy = `${inputId}State${errors.length ? ` ${inputId}Error` : ''}`;
      const step = config.step ? ` step="${escapeHtml(config.step)}"` : '';
      const min = config.min !== undefined ? ` min="${escapeHtml(config.min)}"` : '';
      const placeholder = mixed ? 'Mixed — enter one shared value' : (config.placeholder || '');
      const type = config.type || 'number';
      const current = state.draft?.mixed?.[field] || {};
      const stateText = mixed
        ? `Mixed values: A→B ${formatFieldValue(current.outbound, config.formatType)}; B→A ${formatFieldValue(current.reverse, config.formatType)}. Enter one shared value before Review.`
        : 'One shared value will apply to every selected direction.';
      return `
        <label class="transport-pair-pricing-modal__editor-field ${errors.length ? 'has-error' : ''}" for="${escapeHtml(inputId)}">
          <span>${escapeHtml(config.label)}</span>
          <input
            id="${escapeHtml(inputId)}"
            class="form-control"
            type="${escapeHtml(type)}"
            value="${escapeHtml(value ?? '')}"
            placeholder="${escapeHtml(placeholder)}"
            data-transport-pair-draft-field="${escapeHtml(field)}"
            aria-describedby="${escapeHtml(describedBy)}"
            ${errors.length ? 'aria-invalid="true"' : ''}
            ${config.disabled ? 'disabled' : ''}
            ${step}${min}
          />
          <small id="${escapeHtml(inputId)}State" class="transport-pair-pricing-modal__field-state ${mixed ? 'is-mixed' : ''}">${escapeHtml(stateText)}</small>
          ${errors.length ? `<small id="${escapeHtml(inputId)}Error" class="transport-pair-pricing-modal__field-error">${escapeHtml(errors[0].message)}</small>` : ''}
        </label>
      `;
    }

    function editorSelect(config) {
      const field = config.field;
      const inputId = SHARED_FIELD_INPUT_IDS[field];
      const value = String(state.draft?.shared?.[field] ?? '');
      const mixed = state.draft?.mixed?.[field]?.isMixed === true;
      const errors = validationErrorsForField(field);
      return `
        <label class="transport-pair-pricing-modal__editor-field ${errors.length ? 'has-error' : ''}" for="${escapeHtml(inputId)}">
          <span>${escapeHtml(config.label)}</span>
          <select
            id="${escapeHtml(inputId)}"
            class="form-control"
            data-transport-pair-draft-field="${escapeHtml(field)}"
            ${errors.length ? 'aria-invalid="true"' : ''}
            ${config.disabled ? 'disabled' : ''}
          >
            <option value="">${mixed ? 'Mixed — choose one value' : 'Select value'}</option>
            ${config.options.map((option) => `
              <option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>
            `).join('')}
          </select>
          <small class="transport-pair-pricing-modal__field-state ${mixed ? 'is-mixed' : ''}">${mixed ? 'Mixed values. Choose one shared value before Review.' : 'One shared value will apply to every selected pricing rule.'}</small>
          ${errors.length ? `<small class="transport-pair-pricing-modal__field-error">${escapeHtml(errors[0].message)}</small>` : ''}
        </label>
      `;
    }

    function renderValidationMessages() {
      const errors = state.draft?.validation?.errors || [];
      const warnings = state.draft?.validation?.warnings || [];
      const review = state.draft?.review || {};
      const outdated = Boolean(review.plan && review.isCurrent !== true);
      return `
        <div
          class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning"
          id="transportPairPricingReviewOutdated"
          role="status"
          aria-live="polite"
          ${outdated ? '' : 'hidden'}
        >Review is outdated. Review the changes again.</div>
        <div
          class="transport-pair-pricing-modal__validation transport-pair-pricing-modal__validation--error"
          id="transportPairPricingValidationErrors"
          role="alert"
          aria-live="assertive"
          ${errors.length ? '' : 'hidden'}
        >
          <strong>Review is blocked by ${errors.length} validation error${errors.length === 1 ? '' : 's'}.</strong>
          <ul>${errors.map((entry) => `<li>${escapeHtml(entry.message)}</li>`).join('')}</ul>
        </div>
        <div
          class="transport-pair-pricing-modal__validation"
          id="transportPairPricingValidationWarnings"
          aria-live="polite"
          ${warnings.length ? '' : 'hidden'}
        >
          <strong>${warnings.length} safety notice${warnings.length === 1 ? '' : 's'}.</strong>
          <ul>${warnings.map((entry) => `<li>${escapeHtml(entry.message)}</li>`).join('')}</ul>
        </div>
      `;
    }

    function renderScopeEditor() {
      const both = Boolean(state.draft?.scope?.updateReverse && state.reverse);
      return `
        <fieldset class="transport-pair-pricing-modal__scope" id="transportPairPricingScope">
          <legend>Update scope</legend>
          <label>
            <input id="transportPairPricingScopeBoth" type="radio" name="transportPairPricingScope" value="both" data-transport-pair-scope ${both ? 'checked' : ''} ${state.reverse ? '' : 'disabled'} />
            <span>Update both directions</span>
          </label>
          <label>
            <input id="transportPairPricingScopeOutbound" type="radio" name="transportPairPricingScope" value="outbound" data-transport-pair-scope ${both ? '' : 'checked'} />
            <span>Update A→B only</span>
          </label>
          <p>${state.reverse
    ? 'The simple editor applies one shared set of values to the selected scope.'
    : 'Reverse route missing. Only A→B can be included; no reverse route will be created.'}</p>
        </fieldset>
      `;
    }

    function renderEditScreen() {
      const outboundRules = rulesForRoute(state.outbound);
      const reverseRules = rulesForRoute(state.reverse);
      const outboundOverride = overrideForRoute(state.outbound);
      const reverseOverride = overrideForRoute(state.reverse);
      const currencyConflict = hasCurrencyConflict(state.outbound, state.reverse);
      const depositDefault = state.depositDefault;
      const defaultMode = String(depositDefault?.mode || '').trim().toLowerCase();
      const baseFloor = depositDefault?.enabled !== false && defaultMode === 'flat'
        ? Math.max(0, Number(depositDefault?.amount || 0))
        : 0;
      const defaultCurrency = normalizeCurrency(depositDefault?.currency || state.outbound.currency) || 'EUR';
      const multiRuleDeposit = outboundRules.length > 1 || reverseRules.length > 1;
      const depositAccess = draftCore.getTransportPairDepositAccess(state.draft);
      const directions = state.draft?.scope?.updateReverse ? ['outbound', 'reverse'] : ['outbound'];
      const selectedRuleDirections = directions.filter((direction) => (
        direction === 'reverse' ? state.draft?.snapshot?.reverseRule : state.draft?.snapshot?.outboundRule
      ));
      const missingRuleDirections = directions.filter((direction) => !selectedRuleDirections.includes(direction));
      const pricingDisabled = selectedRuleDirections.length === 0;
      const depositEnabled = state.draft?.shared?.depositEnabled === true;

      const depositRows = pricingRows(PRICING_DEPOSIT_FIELDS);
      depositRows.push(comparisonRow({
        field: 'route_level_override',
        label: 'Route-level override',
        leftValue: overrideSummary(outboundOverride),
        rightValue: overrideSummary(reverseOverride),
        leftAvailable: Boolean(state.outbound),
        rightAvailable: Boolean(state.reverse),
        leftMissingLabel: 'Outbound unavailable',
        rightMissingLabel: 'Reverse missing',
      }));

      return `
        <div class="transport-pair-pricing-modal__screen-tabs" aria-label="Pricing modal step">
          <span aria-current="step">1. Edit</span>
          <span>2. Review</span>
        </div>
        <div class="transport-pair-pricing-modal__notices">
          ${!state.reverse ? `
            <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingReverseWarning">
              <strong>Reverse route missing.</strong>
              <span>No reverse route will be created from this draft.</span>
            </div>
          ` : ''}
          ${state.outbound?.is_active === false || state.reverse?.is_active === false ? `
            <div class="transport-pair-pricing-modal__notice">One or more routes are inactive. Route status will remain unchanged.</div>
          ` : ''}
          ${currencyConflict ? `
            <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingCurrencyWarning">
              <strong>Currency conflict.</strong>
              <span>Outbound uses ${escapeHtml(normalizeCurrency(state.outbound.currency))}; reverse uses ${escapeHtml(normalizeCurrency(state.reverse.currency))}. Enter one shared currency before Review.</span>
            </div>
          ` : ''}
        </div>

        <div class="transport-pair-pricing-modal__routes">
          ${routeIdentityCard(state.outbound, 'Outbound A → B')}
          ${routeIdentityCard(state.reverse, 'Reverse B → A')}
        </div>
        <div class="transport-pair-pricing-modal__rules">
          ${renderRuleSelector('outbound', state.outbound)}
          ${renderRuleSelector('reverse', state.reverse)}
        </div>

        ${renderScopeEditor()}
        ${renderValidationMessages()}

        <details class="transport-pair-pricing-modal__snapshot" open>
          <summary>Fresh snapshot comparison</summary>
          ${comparisonSection('Base price', routeRows(ROUTE_PRICE_FIELDS))}
          ${comparisonSection('Passengers and luggage', routeRows(ROUTE_CAPACITY_FIELDS))}
          ${comparisonSection('Selected rule surcharges', pricingRows(PRICING_FEE_FIELDS))}
          ${comparisonSection('Night and deposit', depositRows)}
        </details>

        <form id="transportPairPricingEditForm" class="transport-pair-pricing-modal__editor" novalidate>
          <section class="transport-pair-pricing-modal__editor-section" aria-labelledby="transportPairPricingBasePriceHeading">
            <header><h3 id="transportPairPricingBasePriceHeading">1. Base price</h3><span>Shared fields</span></header>
            <div class="transport-pair-pricing-modal__editor-grid">
              ${editorInput({ field: 'dayPrice', label: 'Day price', step: '0.01', min: '0', formatType: 'number' })}
              ${editorInput({ field: 'nightPrice', label: 'Night price', step: '0.01', min: '0', formatType: 'number' })}
              ${editorInput({ field: 'currency', label: 'Currency', type: 'text', placeholder: 'EUR', formatType: 'currency' })}
            </div>
          </section>

          <section class="transport-pair-pricing-modal__editor-section" aria-labelledby="transportPairPricingCapacityHeading">
            <header><h3 id="transportPairPricingCapacityHeading">2. Passengers and luggage</h3><span>Shared fields</span></header>
            <div class="transport-pair-pricing-modal__editor-grid">
              ${editorInput({ field: 'includedPassengers', label: 'Included passengers', step: '1', min: '1', formatType: 'number' })}
              ${editorInput({ field: 'includedBags', label: 'Included small backpacks', step: '1', min: '0', formatType: 'number' })}
              ${editorInput({ field: 'includedLargeBags', label: 'Included large bags', step: '1', min: '0', formatType: 'number' })}
              ${editorInput({ field: 'maxPassengers', label: 'Max passengers', step: '1', min: '1', formatType: 'number' })}
              ${editorInput({ field: 'maxBags', label: 'Max total luggage', step: '1', min: '0', formatType: 'number' })}
            </div>
          </section>

          <fieldset class="transport-pair-pricing-modal__editor-section" ${pricingDisabled ? 'disabled' : ''}>
            <legend>3. Extras</legend>
            ${missingRuleDirections.length ? `
              <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingMissingRuleNotice">
                ${escapeHtml(missingRuleDirections.map((direction) => direction === 'reverse' ? 'B→A' : 'A→B').join(', '))}: No pricing rule selected. Advanced pricing fields cannot be updated in the simple editor.
              </div>
            ` : ''}
            <div class="transport-pair-pricing-modal__editor-grid">
              ${editorInput({ field: 'extraPassengerFee', label: 'Extra passenger fee', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'extraBagFee', label: 'Extra small backpack fee', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'oversizeBagFee', label: 'Extra large bag fee', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'childSeatFee', label: 'Child seat fee', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'boosterSeatFee', label: 'Booster seat fee', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'waitingIncludedMinutes', label: 'Waiting included minutes', step: '1', min: '0', formatType: 'number', disabled: pricingDisabled })}
              ${editorInput({ field: 'waitingFeePerHour', label: 'Waiting fee per hour', step: '0.01', min: '0', formatType: 'number', disabled: pricingDisabled })}
            </div>
          </fieldset>

          <fieldset class="transport-pair-pricing-modal__editor-section" ${pricingDisabled ? 'disabled' : ''}>
            <legend>4. Night window</legend>
            <div class="transport-pair-pricing-modal__editor-grid">
              ${editorInput({ field: 'nightStart', label: 'Night start', type: 'time', formatType: 'time', disabled: pricingDisabled })}
              ${editorInput({ field: 'nightEnd', label: 'Night end', type: 'time', formatType: 'time', disabled: pricingDisabled })}
            </div>
            <p>Validity dates, priority and active status remain exactly as loaded.</p>
          </fieldset>

          <fieldset class="transport-pair-pricing-modal__editor-section" id="transportPairPricingDepositSection" ${depositAccess.editable ? '' : 'disabled'}>
            <legend>5. Deposit</legend>
            ${!depositAccess.editable ? `
              <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingDepositBlockedReason">
                <strong>Deposit editing is read-only.</strong>
                <span>${escapeHtml(depositAccess.reasons.join(' '))}</span>
              </div>
            ` : ''}
            ${multiRuleDeposit ? `
              <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingMultiRuleDepositWarning">
                Deposit editing will remain unavailable in the simple modal because this route has multiple pricing rules.
              </div>
            ` : ''}
            <div class="transport-pair-pricing-modal__editor-grid">
              <label class="transport-pair-pricing-modal__editor-field transport-pair-pricing-modal__editor-field--checkbox" for="${SHARED_FIELD_INPUT_IDS.depositEnabled}">
                <span>Deposit enabled</span>
                <input id="${SHARED_FIELD_INPUT_IDS.depositEnabled}" type="checkbox" data-transport-pair-draft-field="depositEnabled" ${depositEnabled ? 'checked' : ''} ${depositAccess.editable ? '' : 'disabled'} />
                <small class="transport-pair-pricing-modal__field-state">Mixed state is shown by an indeterminate checkbox until a conscious choice is made.</small>
              </label>
              ${editorSelect({
    field: 'depositMode',
    label: 'Deposit mode',
    disabled: !depositAccess.editable || !depositEnabled,
    options: [
      { value: 'percent_total', label: 'Percent of total' },
      { value: 'per_person', label: 'Per person' },
      { value: 'fixed_amount', label: 'Fixed amount' },
    ],
  })}
              ${editorInput({ field: 'depositValue', label: 'Deposit value', step: '0.01', min: '0', formatType: 'number', disabled: !depositAccess.editable || !depositEnabled })}
            </div>
            <p><strong>include_children:</strong> ${depositDefault ? (depositDefault.include_children ? 'true' : 'false') : 'Unavailable'} — fresh global default, read-only.</p>
          </fieldset>
        </form>

        <section class="transport-pair-pricing-modal__global-deposit">
          <header><h3>Global transport deposit information</h3></header>
          <dl>
            <div><dt>Base floor</dt><dd>${escapeHtml(String(baseFloor))} ${escapeHtml(defaultCurrency)}</dd></div>
            <div><dt>Global mode</dt><dd>${escapeHtml(defaultMode || 'No global rule')}</dd></div>
            <div><dt>include_children</dt><dd>${depositDefault ? (depositDefault.include_children ? 'true' : 'false') : 'No global rule'}</dd></div>
          </dl>
          <p>Read-only global information. Planned global changes: 0.</p>
        </section>
      `;
    }

    function reviewValue(value, type = '') {
      if (value === null || value === undefined || value === '') return '—';
      if (type === 'boolean') return value ? 'Enabled' : 'Disabled';
      if (type === 'time') return String(value).slice(0, 5);
      if (type === 'currency') return normalizeCurrency(value);
      return String(value);
    }

    function reviewRows(step, fields) {
      return fields.map((field) => {
        const changed = (step.changes || []).some((change) => change.field === field.column);
        return `
          <div class="transport-pair-pricing-modal__review-row" data-review-field="${escapeHtml(field.column)}" data-changed="${changed ? 'true' : 'false'}">
            <span>${escapeHtml(field.label)}</span>
            <span>${escapeHtml(reviewValue(step.before?.[field.column], field.type))}</span>
            <span aria-hidden="true">→</span>
            <span>${escapeHtml(reviewValue(step.after?.[field.column], field.type))}</span>
          </div>
        `;
      }).join('');
    }

    function reviewStepHeading(step, label) {
      return `
        <header>
          <div><h3>${escapeHtml(label)}</h3><code>${escapeHtml(step.entityId || step.resourceId || 'No record ID')}</code></div>
          <span class="transport-pair-pricing-modal__operation transport-pair-pricing-modal__operation--${escapeHtml(step.action)}">${escapeHtml(String(step.action || '').toUpperCase())}</span>
        </header>
      `;
    }

    function renderRouteReview(step) {
      const label = step.key.endsWith('reverse') ? 'B→A route' : 'A→B route';
      return `
        <article class="transport-pair-pricing-modal__review-entity" data-review-step="${escapeHtml(step.key)}">
          ${reviewStepHeading(step, label)}
          <h4>Base prices</h4>
          ${reviewRows(step, [
    { column: 'day_price', label: 'Day price' },
    { column: 'night_price', label: 'Night price' },
    { column: 'currency', label: 'Currency', type: 'currency' },
  ])}
          <h4>Capacity</h4>
          ${reviewRows(step, [
    { column: 'included_passengers', label: 'Included passengers' },
    { column: 'included_bags', label: 'Included small backpacks' },
    { column: 'included_large_bags', label: 'Included large bags' },
    { column: 'max_passengers', label: 'Max passengers' },
    { column: 'max_bags', label: 'Max total luggage' },
  ])}
          <p>Snapshot updated_at: <code>${escapeHtml(step.expectedUpdatedAt || 'Unavailable')}</code></p>
        </article>
      `;
    }

    function renderPricingReview(step) {
      const label = step.key.endsWith('reverse') ? 'B→A pricing rule' : 'A→B pricing rule';
      if (step.action === 'blocked') {
        return `
          <article class="transport-pair-pricing-modal__review-entity" data-review-step="${escapeHtml(step.key)}">
            ${reviewStepHeading(step, label)}
            <p>${escapeHtml(step.reason || 'Pricing update blocked.')}</p>
          </article>
        `;
      }
      return `
        <article class="transport-pair-pricing-modal__review-entity" data-review-step="${escapeHtml(step.key)}">
          ${reviewStepHeading(step, label)}
          ${reviewRows(step, [
    { column: 'extra_passenger_fee', label: 'Extra passenger fee' },
    { column: 'extra_bag_fee', label: 'Extra small backpack fee' },
    { column: 'oversize_bag_fee', label: 'Extra large bag fee' },
    { column: 'child_seat_fee', label: 'Child seat fee' },
    { column: 'booster_seat_fee', label: 'Booster seat fee' },
    { column: 'waiting_included_minutes', label: 'Waiting included minutes' },
    { column: 'waiting_fee_per_hour', label: 'Waiting fee per hour' },
    { column: 'waiting_fee_per_minute', label: 'Waiting fee per minute (derived)' },
    { column: 'night_start', label: 'Night start', type: 'time' },
    { column: 'night_end', label: 'Night end', type: 'time' },
    { column: 'deposit_enabled', label: 'Deposit enabled', type: 'boolean' },
    { column: 'deposit_mode', label: 'Deposit mode' },
    { column: 'deposit_value', label: 'Deposit value' },
  ])}
          <p>Snapshot updated_at: <code>${escapeHtml(step.expectedUpdatedAt || 'Unavailable')}</code> · rule count: ${escapeHtml(step.ruleCount)}</p>
        </article>
      `;
    }

    function renderDepositReview(step) {
      const label = step.key.endsWith('reverse') ? 'B→A deposit override' : 'A→B deposit override';
      return `
        <article class="transport-pair-pricing-modal__review-entity" data-review-step="${escapeHtml(step.key)}">
          ${reviewStepHeading(step, label)}
          ${step.action === 'blocked' ? `<p>${escapeHtml(step.reason || 'Deposit operation blocked.')}</p>` : reviewRows(step, [
    { column: 'mode', label: 'Mode' },
    { column: 'amount', label: 'Amount' },
    { column: 'currency', label: 'Currency', type: 'currency' },
    { column: 'include_children', label: 'Include children', type: 'boolean' },
    { column: 'enabled', label: 'Enabled', type: 'boolean' },
  ])}
          <p>Resource route ID: <code>${escapeHtml(step.resourceId || 'Unavailable')}</code> · snapshot updated_at: <code>${escapeHtml(step.expectedUpdatedAt || 'Unavailable')}</code></p>
        </article>
      `;
    }

    function renderReviewScreen() {
      const plan = state.draft?.review?.plan;
      if (!plan) return '<p>Review plan unavailable. Return to Edit and review the draft again.</p>';
      const isCurrent = draftCore.isTransportPairPricingReviewCurrent(state.draft, plan.fingerprint);
      const routeSteps = plan.steps.filter((step) => step.type === 'transport_route');
      const pricingSteps = plan.steps.filter((step) => step.type === 'pricing_rule');
      const depositSteps = plan.steps.filter((step) => step.type === 'deposit_override');
      return `
        <div class="transport-pair-pricing-modal__screen-tabs" aria-label="Pricing modal step">
          <span>1. Edit</span>
          <span aria-current="step">2. Review</span>
        </div>
        <section class="transport-pair-pricing-modal__review" aria-labelledby="transportPairPricingReviewTitle">
          <header class="transport-pair-pricing-modal__review-heading">
            <div>
              <span>Stage 2D · reviewed exact-ID operations</span>
              <h2 id="transportPairPricingReviewTitle" tabindex="-1">Review changes</h2>
              <p>Plan <code>${escapeHtml(plan.id)}</code> · fingerprint <code>${escapeHtml(plan.fingerprint)}</code></p>
            </div>
          </header>
          ${!isCurrent ? `
            <div class="transport-pair-pricing-modal__notice transport-pair-pricing-modal__notice--warning" id="transportPairPricingReviewOutdated" role="alert">
              Review is outdated. Review the changes again.
            </div>
          ` : ''}
          <section class="transport-pair-pricing-modal__review-scope">
            <h3>Scope</h3>
            <p>${routeSteps.length === 2 ? 'A→B and B→A' : 'A→B only'}</p>
            <ul>${routeSteps.map((step) => `<li><code>${escapeHtml(step.entityId)}</code></li>`).join('')}</ul>
          </section>
          <section class="transport-pair-pricing-modal__review-safety" id="transportPairPricingReviewSafety">
            <h3>Safety</h3>
            <strong>Global changes: ${escapeHtml(plan.globalChanges)}</strong>
            <ul>
              <li>No bookings will be modified</li>
              <li>No public transport code will be modified</li>
              <li>No reverse route will be created</li>
              <li>No pricing rule will be selected automatically during future save</li>
            </ul>
          </section>
          ${plan.steps.some((step) => !['unchanged', 'blocked'].includes(step.action)) ? '' : `
            <div class="transport-pair-pricing-modal__notice" id="transportPairPricingNoChanges">
              No changed records to save. Save remains disabled.
            </div>
          `}
          <section><h3>Routes</h3>${routeSteps.map(renderRouteReview).join('')}</section>
          <section><h3>Pricing rules</h3>${pricingSteps.map(renderPricingReview).join('')}</section>
          <section><h3>Deposit overrides</h3>${depositSteps.map(renderDepositReview).join('')}</section>
          <section class="transport-pair-pricing-modal__review-summary">
            <h3>Summary</h3>
            <dl>
              <div><dt>Route updates</dt><dd>${escapeHtml(plan.summary.routeUpdates)}</dd></div>
              <div><dt>Pricing updates</dt><dd>${escapeHtml(plan.summary.pricingUpdates)}</dd></div>
              <div><dt>Deposit INSERT</dt><dd>${escapeHtml(plan.summary.depositInserts)}</dd></div>
              <div><dt>Deposit UPDATE</dt><dd>${escapeHtml(plan.summary.depositUpdates)}</dd></div>
              <div><dt>Deposit DELETE</dt><dd>${escapeHtml(plan.summary.depositDeletes)}</dd></div>
              <div><dt>Global changes</dt><dd>${escapeHtml(plan.summary.globalChanges)}</dd></div>
            </dl>
          </section>
          <details class="transport-pair-pricing-modal__technical-plan">
            <summary>Technical plan — exact steps and IDs</summary>
            <ol>${plan.steps.map((step) => `
              <li>
                <code>${escapeHtml(step.key)}</code> · ${escapeHtml(step.type)} · ${escapeHtml(String(step.action).toUpperCase())}
                · entity <code>${escapeHtml(step.entityId || 'new record')}</code>
                · route <code>${escapeHtml(step.routeId || step.resourceId || step.entityId || 'none')}</code>
                · expected_updated_at <code>${escapeHtml(step.expectedUpdatedAt || 'none')}</code>
              </li>
            `).join('')}</ol>
          </details>
        </section>
      `;
    }

    function reviewMutationCounts() {
      const plan = state.draft?.review?.plan || null;
      return {
        routes: Number(plan?.summary?.routeUpdates || 0),
        pricing: Number(plan?.summary?.pricingUpdates || 0),
        deposits: Number(plan?.summary?.depositInserts || 0)
          + Number(plan?.summary?.depositUpdates || 0)
          + Number(plan?.summary?.depositDeletes || 0),
      };
    }

    function reviewHasChanges() {
      const counts = reviewMutationCounts();
      return counts.routes + counts.pricing + counts.deposits > 0;
    }

    function saveStepDirection(step) {
      return String(step?.key || '').endsWith('reverse') ? 'reverse' : 'outbound';
    }

    function renderExecutionStep(step) {
      const status = String(step.status || 'pending');
      const visualStatus = step.reconciled === true ? 'reconciled' : status;
      const exactId = step.result?.id || step.entityId || step.payload?.resource_id || 'new override';
      const changes = Array.isArray(step.changes) ? step.changes : [];
      return `
        <li
          tabindex="-1"
          data-transport-pair-save-step="${escapeHtml(step.key)}"
          data-step-status="${escapeHtml(status)}"
          data-step-reconciled="${step.reconciled === true ? 'true' : 'false'}"
        >
          <span class="transport-pair-pricing-modal__operation transport-pair-pricing-modal__operation--${escapeHtml(visualStatus)}">${escapeHtml(visualStatus.toUpperCase())}</span>
          <div>
            <strong>${escapeHtml(step.type)} · ${escapeHtml(saveStepDirection(step))}</strong>
            <code>${escapeHtml(exactId)}</code>
            <span>${escapeHtml(step.action)} · attempts ${escapeHtml(Number(step.attempts || 0))}</span>
            ${step.error?.message ? `<p>${escapeHtml(step.error.message)}</p>` : ''}
            ${changes.length ? `<ul>${changes.map((change) => `
              <li>${escapeHtml(change.field)}: ${escapeHtml(reviewValue(change.before))} → ${escapeHtml(reviewValue(change.after))}</li>
            `).join('')}</ul>` : '<span>UNCHANGED</span>'}
          </div>
        </li>
      `;
    }

    function renderExecutionStepGroup(label, steps) {
      if (!steps.length) return '';
      return `
        <section class="transport-pair-pricing-modal__execution-group" aria-label="${escapeHtml(label)}">
          <h3>${escapeHtml(label)}</h3>
          <ol class="transport-pair-pricing-modal__execution-steps">${steps.map(renderExecutionStep).join('')}</ol>
        </section>
      `;
    }

    function renderExecutionSteps(plan, options = {}) {
      const steps = Array.isArray(plan?.steps) ? plan.steps : [];
      if (!steps.length) return '<p>No executable changes were produced.</p>';
      if (options.grouped === true) {
        return [
          renderExecutionStepGroup('Succeeded', steps.filter((step) => step.status === 'success' && step.reconciled !== true)),
          renderExecutionStepGroup('Reconciled', steps.filter((step) => step.status === 'success' && step.reconciled === true)),
          renderExecutionStepGroup('Failed', steps.filter((step) => step.status === 'error')),
          renderExecutionStepGroup('Skipped', steps.filter((step) => step.status === 'skipped')),
        ].join('');
      }
      return `<ol class="transport-pair-pricing-modal__execution-steps">${steps.map(renderExecutionStep).join('')}</ol>`;
    }

    function renderStaleDifferences() {
      const differences = state.preflight?.differences || state.saveError?.details || [];
      if (!differences.length) return '';
      return `
        <details class="transport-pair-pricing-modal__technical-plan">
          <summary>Technical stale-state differences</summary>
          <ul>${differences.map((difference) => `
            <li>
              <code>${escapeHtml(difference.code || 'stale')}</code>
              · ${escapeHtml(difference.direction || 'global')}
              · ${escapeHtml(difference.field || 'record')}
              · ${escapeHtml(reviewValue(difference.before))} → ${escapeHtml(reviewValue(difference.after))}
            </li>
          `).join('')}</ul>
        </details>
      `;
    }

    function renderSaveOutcomeScreen() {
      const stale = state.saveOutcome === 'stale';
      const staleAfterPartial = state.saveOutcome === 'stale_after_partial';
      const partial = state.saveOutcome === 'partial';
      const failed = state.saveOutcome === 'error';
      const retrying = ['retry_precheck', 'retry_running'].includes(state.saveOutcome);
      let heading = 'Saving Transport pair pricing';
      let message = 'Running the fresh preflight before the first mutation.';
      let alertClass = '';
      if (staleAfterPartial) {
        heading = 'Data changed after the partial save';
        message = 'Data changed after the partial save. Refresh before continuing.';
        alertClass = ' transport-pair-pricing-modal__notice--warning';
      } else if (stale) {
        heading = 'Data changed since Review';
        message = 'Data changed since Review. Refresh and review the changes again.';
        alertClass = ' transport-pair-pricing-modal__notice--warning';
      } else if (partial) {
        heading = 'Partial success';
        message = 'Some changes were saved. Retry will only attempt the failed steps.';
        alertClass = ' transport-pair-pricing-modal__notice--warning';
      } else if (failed) {
        heading = 'Save failed';
        message = state.saveError?.message || 'The operation did not finish. No automatic rollback was attempted.';
        alertClass = ' transport-pair-pricing-modal__notice--warning';
      } else if (state.saveOutcome === 'retry_precheck') {
        heading = 'Checking partial save before Retry';
        message = 'Running a fresh exact-ID retry precheck. No mutation has started.';
      } else if (state.saveOutcome === 'retry_running') {
        heading = 'Retrying failed steps';
        message = 'Successful steps remain untouched. Only failed or dependency-skipped steps are running.';
      } else if (state.saveOutcome === 'running') {
        message = 'Fresh preflight passed. Exact-ID updates are running sequentially.';
      }
      return `
        <section class="transport-pair-pricing-modal__save-outcome" aria-labelledby="transportPairPricingSaveOutcomeTitle">
          <header>
            <span>Stage 2E · controlled exact-ID save and recovery</span>
            <h2 id="transportPairPricingSaveOutcomeTitle" tabindex="-1">${escapeHtml(heading)}</h2>
          </header>
          <div
            class="transport-pair-pricing-modal__notice${alertClass}"
            id="transportPairPricingSaveOutcomeAlert"
            role="${stale || staleAfterPartial || partial || failed ? 'alert' : 'status'}"
            aria-live="${stale || staleAfterPartial || partial || failed ? 'assertive' : 'off'}"
            tabindex="-1"
          >${escapeHtml(message)}</div>
          ${retrying || state.saveOutcome === 'running' ? `
            <p class="transport-pair-pricing-modal__execution-announcement" role="status" aria-live="polite" aria-atomic="true">
              ${escapeHtml(state.executionAnnouncement || message)}
            </p>
          ` : ''}
          ${stale || staleAfterPartial ? renderStaleDifferences() : ''}
          ${partial || failed ? `
            <p><strong>No automatic rollback was performed.</strong></p>
          ` : ''}
          ${partial ? `
            <div class="transport-pair-pricing-modal__review-safety">
              <strong>Successful steps will not be repeated.</strong>
              <ul>
                <li>Global changes: 0</li>
                <li>Bookings changed: 0</li>
                <li>No emails or notifications were sent</li>
              </ul>
            </div>
          ` : ''}
          ${stale && !state.savePlan ? '' : renderExecutionSteps(state.savePlan, { grouped: partial || staleAfterPartial })}
        </section>
      `;
    }

    function renderReceiptScreen() {
      const plan = state.savePlan;
      const receipt = state.receipt || {};
      return `
        <section class="transport-pair-pricing-modal__receipt" aria-labelledby="transportPairPricingReceiptTitle">
          <header>
            <span>Stage 2E · verified success${(plan?.steps || []).some((step) => step.reconciled) ? ' after recovery' : ''}</span>
            <h2 id="transportPairPricingReceiptTitle" tabindex="-1">Transport pair pricing saved</h2>
            <p>Completed ${escapeHtml(formatDateTime(receipt.finishedAt))}</p>
          </header>
          <div class="transport-pair-pricing-modal__review-safety">
            <strong>Global changes: 0</strong>
            <ul>
              <li>Bookings affected: 0</li>
              <li>No emails or notifications were sent</li>
              <li>Fresh database verification passed</li>
            </ul>
          </div>
          ${renderExecutionSteps(plan)}
          <section>
            <h3>Saved records and exact changes</h3>
            ${(plan?.steps || []).map((step) => `
              <article class="transport-pair-pricing-modal__review-entity">
                ${reviewStepHeading(step, step.key)}
                <p>Exact ID: <code>${escapeHtml(step.result?.id || step.entityId || step.payload?.resource_id || 'Unavailable')}</code></p>
                ${(step.changes || []).length ? `
                  <ul>${step.changes.map((change) => `
                    <li>${escapeHtml(change.field)}: ${escapeHtml(reviewValue(change.before))} → ${escapeHtml(reviewValue(change.after))}</li>
                  `).join('')}</ul>
                ` : '<p>UNCHANGED</p>'}
              </article>
            `).join('')}
          </section>
        </section>
      `;
    }

    function syncFooter() {
      const reviewing = state.view === 'review';
      const editing = state.view === 'edit';
      const outcome = state.view === 'save_outcome';
      const receipt = state.view === 'receipt';
      const stale = state.saveOutcome === 'stale';
      const staleAfterPartial = state.saveOutcome === 'stale_after_partial';
      const routeWizard = byId('transportPairPricingOpenRouteWizard');
      const refreshButton = byId('transportPairPricingModalRefresh');
      const advanced = byId('transportPairPricingOpenAdvanced');
      const reviewButton = byId('transportPairPricingReviewChanges');
      const backButton = byId('transportPairPricingBackToEdit');
      const saveButton = byId('transportPairPricingSaveChanges');
      const retryButton = byId('transportPairPricingRetryFailed');
      const editAgainButton = byId('transportPairPricingReceiptEditAgain');
      const receiptCloseButton = byId('transportPairPricingReceiptClose');
      const closeButton = byId('transportPairPricingModalClose');
      if (routeWizard) {
        routeWizard.hidden = !editing || Boolean(state.reverse);
        setControlDisabled(routeWizard, state.isExecuting);
      }
      if (refreshButton) {
        refreshButton.hidden = receipt || (outcome && !['stale', 'stale_after_partial', 'partial', 'error'].includes(state.saveOutcome));
        setControlDisabled(refreshButton, state.isExecuting);
        refreshButton.textContent = stale || outcome ? 'Refresh data' : 'Refresh';
      }
      if (advanced) {
        advanced.hidden = reviewing || outcome;
        setControlDisabled(advanced, state.isExecuting);
        const direction = state.advancedDirection === 'reverse' && state.reverse ? 'B → A' : 'A → B';
        advanced.textContent = `Open Advanced Pricing (${direction})`;
      }
      if (reviewButton) {
        reviewButton.hidden = !editing;
        setControlDisabled(reviewButton, !editing || !state.draft || state.isExecuting || stale || staleAfterPartial);
      }
      if (backButton) {
        backButton.hidden = !(reviewing || stale);
        setControlDisabled(backButton, state.isExecuting);
      }
      if (saveButton) {
        saveButton.hidden = !reviewing;
        const plan = state.draft?.review?.plan;
        const current = draftCore.isTransportPairPricingReviewCurrent(state.draft, plan?.fingerprint);
        setControlDisabled(saveButton, !reviewing
          || state.isExecuting
          || state.saveOutcome === 'stale'
          || !current
          || !reviewHasChanges()
          || Boolean(state.draft?.validation?.errors?.length)
          || !saveCore
          || !saveRepository);
        saveButton.textContent = 'Save changes';
      }
      if (retryButton) {
        const reviewPlan = state.draft?.review?.plan || null;
        const available = outcome
          && state.saveOutcome === 'partial'
          && !state.isExecuting
          && draftCore.isTransportPairPricingRetryAvailable?.(state.savePlan, state.draft, reviewPlan);
        retryButton.hidden = !available;
        setControlDisabled(retryButton, !available || state.isExecuting);
      }
      if (editAgainButton) {
        editAgainButton.hidden = !receipt;
        setControlDisabled(editAgainButton, state.isExecuting);
      }
      if (receiptCloseButton) {
        receiptCloseButton.hidden = !receipt && !(outcome && !state.isExecuting);
        setControlDisabled(receiptCloseButton, state.isExecuting);
      }
      setControlDisabled(closeButton, state.isExecuting);
    }

    function renderContent() {
      const content = byId('transportPairPricingModalContent');
      if (!content || !state.outbound || !state.draft || !draftCore) return;
      const originId = state.outbound.origin_location_id;
      const destinationId = state.outbound.destination_location_id;
      const title = byId('transportPairPricingModalTitle');
      if (title) title.textContent = `${locationDisplay(originId)} ↔ ${locationDisplay(destinationId)}`;
      const status = byId('transportPairPricingModalStatus');
      if (status) {
        status.textContent = state.view === 'receipt'
          ? 'Exact-ID save completed and verified with a fresh read.'
          : (state.view === 'save_outcome'
            ? 'Controlled Stage 2E save and recovery status.'
            : `Fresh snapshot loaded ${formatDateTime(state.fetchedAt)}.`);
      }

      if (state.view === 'review') content.innerHTML = renderReviewScreen();
      else if (state.view === 'save_outcome') content.innerHTML = renderSaveOutcomeScreen();
      else if (state.view === 'receipt') content.innerHTML = renderReceiptScreen();
      else content.innerHTML = renderEditScreen();
      content.hidden = false;
      syncFooter();
      if (state.view === 'edit') {
        const depositCheckbox = byId(SHARED_FIELD_INPUT_IDS.depositEnabled);
        if (depositCheckbox) depositCheckbox.indeterminate = state.draft.shared.depositEnabled === null;
      }
    }

    function setLoading() {
      state.loading = true;
      state.error = null;
      const modal = byId('transportPairPricingModal');
      const loading = byId('transportPairPricingModalLoading');
      const error = byId('transportPairPricingModalError');
      const content = byId('transportPairPricingModalContent');
      const advanced = byId('transportPairPricingOpenAdvanced');
      const refreshButton = byId('transportPairPricingModalRefresh');
      const reviewButton = byId('transportPairPricingReviewChanges');
      const backButton = byId('transportPairPricingBackToEdit');
      const saveButton = byId('transportPairPricingSaveChanges');
      const retryButton = byId('transportPairPricingRetryFailed');
      const editAgainButton = byId('transportPairPricingReceiptEditAgain');
      const receiptCloseButton = byId('transportPairPricingReceiptClose');
      if (modal) modal.setAttribute('aria-busy', 'true');
      if (loading) loading.hidden = false;
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (content) {
        content.hidden = true;
        content.innerHTML = '';
      }
      setControlDisabled(advanced, true);
      setControlDisabled(refreshButton, true);
      setControlDisabled(reviewButton, true);
      if (backButton) backButton.hidden = true;
      if (saveButton) {
        saveButton.hidden = true;
        setControlDisabled(saveButton, true);
      }
      if (retryButton) retryButton.hidden = true;
      if (editAgainButton) editAgainButton.hidden = true;
      if (receiptCloseButton) receiptCloseButton.hidden = true;
    }

    function showError(errorValue) {
      const errorMessage = errorValue && typeof errorValue === 'object' && errorValue.message
        ? String(errorValue.message)
        : String(errorValue || 'Failed to read transport pricing data');
      const error = errorValue instanceof Error ? errorValue : new Error(errorMessage);
      state.loading = false;
      state.error = {
        code: String(errorValue?.code || error.code || ''),
        message: String(error.message || errorMessage),
      };
      const modal = byId('transportPairPricingModal');
      const loading = byId('transportPairPricingModalLoading');
      const errorElement = byId('transportPairPricingModalError');
      const content = byId('transportPairPricingModalContent');
      const refreshButton = byId('transportPairPricingModalRefresh');
      if (modal) modal.setAttribute('aria-busy', 'false');
      if (loading) loading.hidden = true;
      if (content) content.hidden = true;
      if (errorElement) {
        errorElement.hidden = false;
        errorElement.textContent = state.error.message;
      }
      setControlDisabled(refreshButton, false);
    }

    async function readFreshPairContext(config = {}) {
      const outboundId = normalizeId(config.outboundRouteId || state.routeId);
      if (!outboundId) throw new Error('Outbound route ID is required');
      const outbound = await repository.getRouteById(outboundId);
      if (!outbound) {
        const error = new Error(`Outbound route not found: ${outboundId}`);
        error.code = 'transport_pair_outbound_missing';
        throw error;
      }

      const expectedReverseId = normalizeId(config.reverseRouteId);
      const reverseLookupRoute = await repository.findReverseRoute(
        outbound.origin_location_id,
        outbound.destination_location_id,
      );
      let reverse = reverseLookupRoute;
      if (Object.prototype.hasOwnProperty.call(config, 'reverseRouteId')) {
        reverse = expectedReverseId ? await repository.getRouteById(expectedReverseId) : reverseLookupRoute;
      }
      const routeIds = Array.from(new Set([
        normalizeId(outbound.id),
        normalizeId(reverse?.id),
        normalizeId(reverseLookupRoute?.id),
      ].filter(Boolean)));
      const [pricingRules, depositOverrides, depositDefault] = await Promise.all([
        repository.listPricingRulesByRouteIds(routeIds),
        repository.listDepositOverridesByRouteIds(routeIds),
        repository.getTransportDepositDefault(),
      ]);
      return {
        loadedAt: new Date().toISOString(),
        outboundRoute: outbound,
        reverseRoute: reverse,
        reverseLookupRoute,
        pricingRules,
        depositOverrides,
        serviceDepositDefault: depositDefault,
      };
    }

    async function refresh() {
      if (!state.isOpen || state.isExecuting || !repository || !draftCore) return false;
      const routeId = normalizeId(state.routeId);
      if (!routeId) return false;
      const generation = ++readGeneration;
      setLoading();

      try {
        const context = await readFreshPairContext({ outboundRouteId: routeId });
        const outbound = context.outboundRoute;
        const reverse = context.reverseRoute;
        const pricingRules = context.pricingRules;
        const depositOverrides = context.depositOverrides;
        const depositDefault = context.serviceDepositDefault;
        if (!state.isOpen || generation !== readGeneration) return false;

        const outboundRules = sortPricingRules(pricingRules.filter((rule) => normalizeId(rule?.route_id) === normalizeId(outbound.id)));
        const reverseRules = sortPricingRules(pricingRules.filter((rule) => normalizeId(rule?.route_id) === normalizeId(reverse?.id)));
        const selectedRuleIds = {
          outbound: selectInitialPricingRuleId(outboundRules),
          reverse: selectInitialPricingRuleId(reverseRules),
        };
        const fetchedAt = context.loadedAt;
        const draft = draftCore.createTransportPairPricingDraft({
          loadedAt: fetchedAt,
          outboundRoute: outbound,
          reverseRoute: reverse,
          pricingRules,
          depositOverrides,
          serviceDepositDefault: depositDefault,
          selectedRuleIds,
        });
        state = {
          ...state,
          loading: false,
          outbound: clone(outbound),
          reverse: clone(reverse),
          pricingRules: clone(pricingRules),
          depositOverrides: clone(depositOverrides),
          depositDefault: clone(depositDefault),
          selectedRuleIds: {
            outbound: normalizeId(draft.selectedRules.outboundRuleId),
            reverse: normalizeId(draft.selectedRules.reverseRuleId),
          },
          advancedDirection: state.advancedDirection === 'reverse' && reverse ? 'reverse' : 'outbound',
          fetchedAt,
          error: null,
          view: 'edit',
          draft,
          confirmationOpen: false,
          recoveryDialogOpen: false,
          recoveryDialogMode: null,
          isExecuting: false,
          preflight: null,
          retryPrecheck: null,
          savePlan: null,
          saveOutcome: null,
          receipt: null,
          saveError: null,
          executionAnnouncement: '',
        };

        const modal = byId('transportPairPricingModal');
        const loading = byId('transportPairPricingModalLoading');
        const errorElement = byId('transportPairPricingModalError');
        const refreshButton = byId('transportPairPricingModalRefresh');
        if (modal) modal.setAttribute('aria-busy', 'false');
        if (loading) loading.hidden = true;
        if (errorElement) errorElement.hidden = true;
        setControlDisabled(refreshButton, false);
        renderContent();
        return true;
      } catch (error) {
        if (!state.isOpen || generation !== readGeneration) return false;
        showError(error);
        return false;
      }
    }

    function hasSavedSteps(plan = state.savePlan) {
      return (plan?.steps || []).some((step) => step.status === 'success');
    }

    function needsPartialRecoveryConfirmation() {
      return state.view === 'save_outcome'
        && hasSavedSteps()
        && ['partial', 'stale_after_partial'].includes(state.saveOutcome);
    }

    function closeRecoveryDialog(options = {}) {
      const dialog = byId('transportPairPricingRecoveryDialog');
      if (dialog) dialog.hidden = true;
      const mode = state.recoveryDialogMode;
      state.recoveryDialogOpen = false;
      state.recoveryDialogMode = null;
      if (options.restoreFocus !== false) {
        focusAfterRender(mode === 'refresh'
          ? 'transportPairPricingModalRefresh'
          : 'transportPairPricingReceiptClose');
      }
    }

    function openRecoveryDialog(mode) {
      if (state.isExecuting || !needsPartialRecoveryConfirmation()) return false;
      const dialog = byId('transportPairPricingRecoveryDialog');
      const title = byId('transportPairPricingRecoveryTitle');
      const message = byId('transportPairPricingRecoveryMessage');
      const confirm = byId('transportPairPricingRecoveryConfirm');
      if (!dialog || !title || !message || !confirm) return false;
      state.recoveryDialogOpen = true;
      state.recoveryDialogMode = mode === 'refresh' ? 'refresh' : 'close';
      if (state.recoveryDialogMode === 'refresh') {
        title.textContent = 'Refresh after partial save';
        message.textContent = 'Refreshing will discard the unsaved part of this plan. Saved changes will remain.';
        confirm.textContent = 'Refresh data';
      } else {
        title.textContent = 'Some changes were already saved.';
        message.textContent = 'Closing will keep the successful database changes and discard this recovery session.';
        confirm.textContent = 'Close';
      }
      dialog.hidden = false;
      focusAfterRender('transportPairPricingRecoveryTitle');
      return true;
    }

    function abandonPartialPlan(reason) {
      if (!state.savePlan || !hasSavedSteps()) return null;
      const abandonedAt = new Date().toISOString();
      const abandoned = draftCore.abandonTransportPairPricingSavePlan?.(state.savePlan, {
        abandonedAt,
        reason,
      }) || { ...clone(state.savePlan), status: 'abandoned' };
      state.recoveryHistory = [
        ...(Array.isArray(state.recoveryHistory) ? state.recoveryHistory : []),
        {
          abandonedAt,
          reason,
          plan: clone(abandoned),
          succeededStepKeys: (abandoned.steps || [])
            .filter((step) => step.status === 'success')
            .map((step) => step.key),
          receipt: {
            finishedAt: abandoned.execution?.finishedAt || abandonedAt,
            records: (abandoned.steps || [])
              .filter((step) => step.status === 'success')
              .map((step) => ({
                key: step.key,
                type: step.type,
                direction: saveStepDirection(step),
                id: step.result?.id || step.entityId || null,
                reconciled: step.reconciled === true,
              })),
          },
        },
      ];
      return abandoned;
    }

    function requestRefresh() {
      if (!state.isOpen || state.isExecuting) return false;
      if (needsPartialRecoveryConfirmation()) return openRecoveryDialog('refresh');
      return refresh();
    }

    function confirmRecoveryAction() {
      if (!state.recoveryDialogOpen || state.isExecuting) return false;
      const mode = state.recoveryDialogMode;
      if (mode === 'refresh') {
        abandonPartialPlan('manual_refresh');
        closeRecoveryDialog({ restoreFocus: false });
        void refresh();
        return true;
      }
      closeRecoveryDialog({ restoreFocus: false });
      return closeImmediately();
    }

    function closeImmediately() {
      if (!state.isOpen) return false;
      if (state.isExecuting) return false;
      if (state.confirmationOpen) {
        closeSaveConfirmation();
        return true;
      }
      if (state.recoveryDialogOpen) {
        closeRecoveryDialog();
        return true;
      }
      readGeneration += 1;
      const modal = byId('transportPairPricingModal');
      if (modal) modal.hidden = true;
      const saveDialog = byId('transportPairPricingSaveConfirmDialog');
      const recoveryDialog = byId('transportPairPricingRecoveryDialog');
      if (saveDialog) saveDialog.hidden = true;
      if (recoveryDialog) recoveryDialog.hidden = true;
      documentRef?.body?.classList?.remove('transport-pair-pricing-modal-open');
      state = {
        ...state,
        isOpen: false,
        loading: false,
        routeId: '',
        outbound: null,
        reverse: null,
        pricingRules: [],
        depositOverrides: [],
        depositDefault: null,
        draft: null,
        confirmationOpen: false,
        recoveryDialogOpen: false,
        recoveryDialogMode: null,
        recoveryHistory: [],
        isExecuting: false,
        preflight: null,
        retryPrecheck: null,
        savePlan: null,
        saveOutcome: null,
        receipt: null,
        saveError: null,
        executionAnnouncement: '',
      };
      const focusTarget = returnFocus;
      returnFocus = null;
      root.requestAnimationFrame?.(() => focusTarget?.focus?.());
      if (!root.requestAnimationFrame) focusTarget?.focus?.();
      return true;
    }

    function requestClose() {
      if (!state.isOpen || state.isExecuting) return false;
      if (state.confirmationOpen) {
        closeSaveConfirmation();
        return true;
      }
      if (state.recoveryDialogOpen) {
        closeRecoveryDialog();
        return true;
      }
      if (needsPartialRecoveryConfirmation()) return openRecoveryDialog('close');
      return closeImmediately();
    }

    function focusAfterRender(elementId) {
      const focus = () => byId(elementId)?.focus?.();
      root.requestAnimationFrame?.(focus);
      if (!root.requestAnimationFrame) focus();
    }

    function clearDraftValidation() {
      if (!state.draft) return;
      state.draft.validation = { errors: [], warnings: [] };
      const errors = byId('transportPairPricingValidationErrors');
      const warnings = byId('transportPairPricingValidationWarnings');
      if (errors) errors.hidden = true;
      if (warnings) warnings.hidden = true;
    }

    function invalidateReview() {
      if (!state.draft) return;
      state.draft.review.isCurrent = false;
      const outdated = byId('transportPairPricingReviewOutdated');
      if (outdated && state.draft.review.plan) outdated.hidden = false;
    }

    function selectDraftRule(direction, ruleIdRaw) {
      if (!state.draft || (direction !== 'outbound' && direction !== 'reverse')) return;
      const route = direction === 'reverse' ? state.reverse : state.outbound;
      const routeId = normalizeId(route?.id);
      const ruleId = normalizeId(ruleIdRaw);
      const rule = state.pricingRules.find((row) => (
        normalizeId(row?.id) === ruleId
          && normalizeId(row?.route_id) === routeId
      )) || null;
      state.selectedRuleIds[direction] = rule ? ruleId : '';
      state.advancedDirection = direction;
      if (direction === 'reverse') {
        state.draft.selectedRules.reverseRuleId = rule ? ruleId : null;
        state.draft.snapshot.reverseRule = clone(rule);
      } else {
        state.draft.selectedRules.outboundRuleId = rule ? ruleId : null;
        state.draft.snapshot.outboundRule = clone(rule);
      }
      state.draft = draftCore.hydrateTransportPairSharedValues(state.draft, {
        sections: ['pricing', 'deposit'],
      });
      state.view = 'edit';
      renderContent();
      focusAfterRender(direction === 'reverse'
        ? 'transportPairPricingReverseRule'
        : 'transportPairPricingOutboundRule');
    }

    function selectDraftScope(value) {
      if (!state.draft) return;
      state.draft.scope.updateOutbound = true;
      state.draft.scope.updateReverse = value === 'both' && Boolean(state.reverse);
      state.draft = draftCore.hydrateTransportPairSharedValues(state.draft);
      state.view = 'edit';
      renderContent();
      focusAfterRender(state.draft.scope.updateReverse
        ? 'transportPairPricingScopeBoth'
        : 'transportPairPricingScopeOutbound');
    }

    function updateDraftField(target) {
      if (!state.draft) return;
      const field = String(target.getAttribute('data-transport-pair-draft-field') || '').trim();
      if (!Object.prototype.hasOwnProperty.call(SHARED_FIELD_COLUMNS, field)) return;
      let value = target.type === 'checkbox' ? Boolean(target.checked) : target.value;
      if (field === 'currency') {
        value = normalizeCurrency(value);
        target.value = value;
      }
      state.draft.shared[field] = value;
      if (state.draft.mixed?.[field]) state.draft.mixed[field].isMixed = false;
      clearDraftValidation();
      invalidateReview();
      target.removeAttribute?.('aria-invalid');
      target.closest?.('.transport-pair-pricing-modal__editor-field')?.classList?.remove('has-error');
      if (field === 'depositEnabled') {
        renderContent();
        focusAfterRender(SHARED_FIELD_INPUT_IDS.depositEnabled);
      }
    }

    function handleContentChange(event) {
      const target = event?.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('[data-transport-pair-rule-selector]')) {
        selectDraftRule(
          String(target.getAttribute('data-transport-pair-rule-selector') || '').trim(),
          target.value,
        );
        return;
      }
      if (target.matches('[data-transport-pair-scope]')) {
        selectDraftScope(String(target.value || '').trim());
        return;
      }
      if (target.matches('[data-transport-pair-draft-field]')) updateDraftField(target);
    }

    function handleContentInput(event) {
      const target = event?.target;
      if (!target || typeof target.matches !== 'function') return;
      if (target.matches('[data-transport-pair-draft-field]') && target.type !== 'checkbox') {
        updateDraftField(target);
      }
    }

    function validationFocusId(field) {
      if (field === 'scope') return 'transportPairPricingScopeOutbound';
      if (field === 'outboundRuleId') return 'transportPairPricingOutboundRule';
      if (field === 'reverseRuleId') return 'transportPairPricingReverseRule';
      return SHARED_FIELD_INPUT_IDS[field] || 'transportPairPricingValidationErrors';
    }

    function reviewChanges() {
      if (!state.draft || !draftCore) return;
      const validation = draftCore.validateTransportPairPricingDraft(state.draft);
      state.draft.validation = clone(validation);
      if (validation.errors.length) {
        state.view = 'edit';
        renderContent();
        focusAfterRender(validationFocusId(validation.errors[0].field));
        return;
      }

      try {
        const plan = draftCore.buildTransportPairPricingReviewPlan(state.draft, {
          now: new Date().toISOString(),
        });
        state.draft.review = {
          isCurrent: true,
          fingerprint: plan.fingerprint,
          plan: clone(plan),
        };
        state.preflight = null;
        state.savePlan = null;
        state.saveOutcome = null;
        state.saveError = null;
        state.receipt = null;
        state.view = 'review';
        renderContent();
        focusAfterRender('transportPairPricingReviewTitle');
      } catch (error) {
        const errorValidation = error?.validation || {
          errors: [{
            code: String(error?.code || 'transport_pair_review_failed'),
            field: 'scope',
            message: String(error?.message || 'Review plan could not be built.'),
            section: 'review',
          }],
          warnings: [],
        };
        state.draft.validation = clone(errorValidation);
        state.view = 'edit';
        renderContent();
        focusAfterRender(validationFocusId(errorValidation.errors?.[0]?.field));
      }
    }

    function backToEdit() {
      if (!state.draft) return;
      state.view = 'edit';
      renderContent();
      focusAfterRender(state.saveOutcome === 'stale'
        ? 'transportPairPricingModalRefresh'
        : 'transportPairPricingReviewChanges');
    }

    function serializeSaveError(error, fallback = 'Transport pair save failed.') {
      return {
        code: String(error?.code || 'transport_pair_save_failed'),
        message: String(error?.message || fallback),
        details: clone(error?.details || null),
      };
    }

    function closeSaveConfirmation(options = {}) {
      const dialog = byId('transportPairPricingSaveConfirmDialog');
      if (dialog) dialog.hidden = true;
      state.confirmationOpen = false;
      if (options.restoreFocus !== false) focusAfterRender('transportPairPricingSaveChanges');
    }

    function openSaveConfirmation() {
      if (state.isExecuting || state.view !== 'review' || !state.draft) return false;
      const plan = state.draft.review?.plan;
      if (!plan || !draftCore.isTransportPairPricingReviewCurrent(state.draft, plan.fingerprint)) return false;
      if (!reviewHasChanges() || state.draft.validation?.errors?.length) return false;
      const counts = reviewMutationCounts();
      const summary = byId('transportPairPricingSaveConfirmSummary');
      const countList = byId('transportPairPricingSaveConfirmCounts');
      if (summary) {
        summary.textContent = `Save these changes to ${counts.routes} routes and ${counts.pricing} pricing rules?`;
      }
      if (countList) {
        countList.innerHTML = `
          <div><dt>Route updates</dt><dd>${escapeHtml(counts.routes)}</dd></div>
          <div><dt>Pricing updates</dt><dd>${escapeHtml(counts.pricing)}</dd></div>
          <div><dt>Deposit operations</dt><dd>${escapeHtml(counts.deposits)}</dd></div>
        `;
      }
      const dialog = byId('transportPairPricingSaveConfirmDialog');
      if (!dialog) return false;
      state.confirmationOpen = true;
      dialog.hidden = false;
      focusAfterRender('transportPairPricingSaveConfirmTitle');
      return true;
    }

    function planHasSuccess(plan) {
      return (plan?.steps || []).some((step) => step.status === 'success');
    }

    function planHasRetryableSteps(plan) {
      return (plan?.steps || []).some((step) => (
        step.status === 'error' || (step.status === 'skipped' && step.skipReason === 'dependency')
      ));
    }

    function firstPlanError(plan) {
      return (plan?.steps || []).find((step) => step.status === 'error')?.error || null;
    }

    function isStaleSaveError(error) {
      return [
        'transport_pair_stale_conflict',
        'transport_pair_outbound_missing',
        'transport_pair_route_read_ambiguous',
        'transport_pair_reverse_read_ambiguous',
        'transport_pair_deposit_default_read_ambiguous',
      ].includes(String(error?.code || ''));
    }

    function focusFirstFailedStep() {
      const focus = () => documentRef?.querySelector?.(
        '[data-transport-pair-save-step][data-step-status="error"], [data-transport-pair-save-step][data-step-status="skipped"]',
      )?.focus?.();
      root.requestAnimationFrame?.(focus);
      if (!root.requestAnimationFrame) focus();
    }

    function applyFailedExecutionOutcome(result, options = {}) {
      const partial = planHasSuccess(result);
      const planError = firstPlanError(result);
      const stale = isStaleSaveError(planError);
      const staleAfterPartial = partial && stale;
      state.saveOutcome = staleAfterPartial ? 'stale_after_partial' : (partial ? 'partial' : (stale ? 'stale' : 'error'));
      if (stale || staleAfterPartial) {
        const details = [{
          code: String(planError?.code || 'transport_pair_stale_conflict'),
          direction: null,
          field: 'optimistic_concurrency',
          before: options.retry === true ? 'retry precheck' : 'reviewed snapshot',
          after: 'conflict',
        }];
        state.saveError = {
          code: staleAfterPartial ? 'transport_pair_stale_after_partial' : 'transport_pair_stale_conflict',
          message: staleAfterPartial
            ? 'Data changed after the partial save. Refresh before continuing.'
            : 'Data changed since Review. Refresh and review the changes again.',
          details,
        };
        state.preflight = { ok: false, stale: true, differences: clone(details) };
      } else {
        state.saveError = serializeSaveError(planError, partial
          ? 'Some changes were saved. Retry will only attempt the failed steps.'
          : 'The save did not finish.');
      }
      state.executionAnnouncement = state.saveError?.message || '';
      return state.saveOutcome;
    }

    async function completeSuccessfulExecution(result, reviewPlan) {
      state.savePlan = clone(result);
      try {
        await options.onSaved?.(clone(result));
      } catch (refreshError) {
        result.adminRefreshError = serializeSaveError(refreshError, 'Transport Admin state refresh failed.');
      }
      const verificationContext = await readFreshPairContext({
        outboundRouteId: reviewPlan.preflight?.outboundRouteId,
        reverseRouteId: reviewPlan.preflight?.reverseRouteId,
      });
      const verification = draftCore.verifyTransportPairPricingSaveResult(result, verificationContext);
      if (!verification.ok) {
        state.saveOutcome = 'partial';
        state.saveError = {
          code: 'transport_pair_post_save_verification_failed',
          message: 'Some changes were saved, but fresh verification did not match the plan.',
          details: clone(verification.differences),
        };
        state.executionAnnouncement = state.saveError.message;
        return result;
      }

      state.saveOutcome = 'success';
      state.saveError = null;
      state.receipt = {
        finishedAt: result.execution?.finishedAt || new Date().toISOString(),
        verification: clone(verification),
        freshContext: clone(verificationContext),
      };
      state.view = 'receipt';
      state.executionAnnouncement = 'All exact-ID steps completed and fresh verification passed.';
      return result;
    }

    async function executeConfirmedSave() {
      if (executionPromise) return executionPromise;
      if (state.isExecuting || state.view !== 'review' || !state.draft) return null;
      const reviewPlan = state.draft.review?.plan;
      if (!reviewPlan || !draftCore.isTransportPairPricingReviewCurrent(state.draft, reviewPlan.fingerprint)) return null;

      state.isExecuting = true;
      state.confirmationOpen = false;
      state.preflight = null;
      state.retryPrecheck = null;
      state.savePlan = null;
      state.saveOutcome = 'preflight';
      state.saveError = null;
      state.receipt = null;
      state.executionAnnouncement = 'Running fresh preflight before the first mutation.';
      state.view = 'save_outcome';
      closeSaveConfirmation({ restoreFocus: false });
      renderContent();
      focusAfterRender('transportPairPricingSaveOutcomeTitle');

      executionPromise = (async () => {
        try {
          const freshContext = await readFreshPairContext({
            outboundRouteId: reviewPlan.preflight?.outboundRouteId,
            reverseRouteId: reviewPlan.preflight?.reverseRouteId,
          });
          const preflight = draftCore.preflightTransportPairPricingReview(
            state.draft,
            reviewPlan,
            freshContext,
          );
          state.preflight = clone(preflight);
          if (!preflight.ok) {
            state.saveOutcome = 'stale';
            state.saveError = {
              code: 'transport_pair_stale_conflict',
              message: 'Data changed since Review. Refresh and review the changes again.',
              details: clone(preflight.differences),
            };
            renderContent();
            focusAfterRender('transportPairPricingSaveOutcomeAlert');
            return null;
          }

          state.savePlan = draftCore.buildTransportPairPricingSavePlan(reviewPlan, freshContext, {
            draft: state.draft,
            builders: saveCore,
            now: new Date().toISOString(),
          });
          if (!state.savePlan.steps.length) {
            throw Object.assign(new Error('There are no changed records to save.'), {
              code: 'transport_pair_save_plan_empty',
            });
          }
          state.saveOutcome = 'running';
          renderContent();

          const result = await saveCore.executeTransportSavePlan(
            clone(state.savePlan),
            saveRepository,
            {
              onProgress: (nextPlan, step) => {
                state.savePlan = clone(nextPlan);
                state.saveOutcome = 'running';
                state.executionAnnouncement = step
                  ? `${step.key}: ${step.status}.`
                  : 'Exact-ID save started.';
                renderContent();
              },
            },
          );
          state.savePlan = clone(result);

          if (result.status !== 'success') {
            applyFailedExecutionOutcome(result);
            renderContent();
            focusAfterRender('transportPairPricingSaveOutcomeAlert');
            return result;
          }
          await completeSuccessfulExecution(result, reviewPlan);
          renderContent();
          if (state.view === 'receipt') focusAfterRender('transportPairPricingReceiptTitle');
          else focusAfterRender('transportPairPricingSaveOutcomeAlert');
          return result;
        } catch (error) {
          const serialized = serializeSaveError(error);
          const partial = planHasSuccess(state.savePlan);
          if (state.savePlan?.steps) {
            const errorStep = state.savePlan.steps.find((step) => step.status === 'error');
            if (errorStep && !errorStep.error) errorStep.error = clone(serialized);
            applyFailedExecutionOutcome(state.savePlan);
          } else {
            const stale = isStaleSaveError(serialized);
            state.saveOutcome = stale ? 'stale' : (partial ? 'partial' : 'error');
            state.saveError = stale
              ? { ...serialized, code: 'transport_pair_stale_conflict', message: 'Data changed since Review. Refresh and review the changes again.' }
              : serialized;
          }
          renderContent();
          focusAfterRender('transportPairPricingSaveOutcomeAlert');
          return state.savePlan;
        } finally {
          state.isExecuting = false;
          renderContent();
          if (state.view === 'receipt') {
            focusAfterRender('transportPairPricingReceiptTitle');
          } else if (['stale', 'stale_after_partial', 'partial', 'error'].includes(state.saveOutcome)) {
            focusAfterRender('transportPairPricingSaveOutcomeAlert');
          }
        }
      })();

      try {
        return await executionPromise;
      } finally {
        executionPromise = null;
      }
    }

    async function retryFailedSteps() {
      if (executionPromise) return executionPromise;
      const reviewPlan = state.draft?.review?.plan || null;
      if (
        state.isExecuting
        || state.view !== 'save_outcome'
        || state.saveOutcome !== 'partial'
        || !draftCore.isTransportPairPricingRetryAvailable?.(state.savePlan, state.draft, reviewPlan)
      ) return null;

      state.isExecuting = true;
      state.saveOutcome = 'retry_precheck';
      state.saveError = null;
      state.preflight = null;
      state.retryPrecheck = null;
      state.executionAnnouncement = 'Running a fresh exact-ID retry precheck.';
      renderContent();
      focusAfterRender('transportPairPricingSaveOutcomeTitle');

      executionPromise = (async () => {
        try {
          const freshContext = await readFreshPairContext({
            outboundRouteId: reviewPlan.preflight?.outboundRouteId,
            reverseRouteId: reviewPlan.preflight?.reverseRouteId,
          });
          const precheck = draftCore.precheckTransportPairPricingRetry(
            state.savePlan,
            state.draft,
            reviewPlan,
            freshContext,
          );
          state.retryPrecheck = clone({ ...precheck, plan: undefined });
          state.savePlan = clone(precheck.plan || state.savePlan);
          if (!precheck.ok) {
            state.saveOutcome = 'stale_after_partial';
            state.saveError = {
              code: 'transport_pair_stale_after_partial',
              message: 'Data changed after the partial save. Refresh before continuing.',
              details: clone(precheck.differences),
            };
            state.preflight = { ok: false, stale: true, differences: clone(precheck.differences) };
            state.executionAnnouncement = state.saveError.message;
            renderContent();
            focusAfterRender('transportPairPricingSaveOutcomeAlert');
            return state.savePlan;
          }

          if (!planHasRetryableSteps(state.savePlan)) {
            state.savePlan.status = 'success';
            await completeSuccessfulExecution(state.savePlan, reviewPlan);
            renderContent();
            focusAfterRender(state.view === 'receipt'
              ? 'transportPairPricingReceiptTitle'
              : 'transportPairPricingSaveOutcomeAlert');
            return state.savePlan;
          }

          state.saveOutcome = 'retry_running';
          state.executionAnnouncement = 'Retry started for failed and dependency-skipped steps only.';
          renderContent();
          const result = await saveCore.executeTransportSavePlan(
            clone(state.savePlan),
            saveRepository,
            {
              retry: true,
              onProgress: (nextPlan, step) => {
                state.savePlan = clone(nextPlan);
                state.saveOutcome = 'retry_running';
                state.executionAnnouncement = step
                  ? `${step.key}: ${step.status}.`
                  : 'Retry execution started.';
                renderContent();
              },
            },
          );
          state.savePlan = clone(result);
          if (result.status !== 'success') {
            applyFailedExecutionOutcome(result, { retry: true });
            renderContent();
            if (state.saveOutcome === 'partial') focusFirstFailedStep();
            else focusAfterRender('transportPairPricingSaveOutcomeAlert');
            return result;
          }

          await completeSuccessfulExecution(result, reviewPlan);
          renderContent();
          focusAfterRender(state.view === 'receipt'
            ? 'transportPairPricingReceiptTitle'
            : 'transportPairPricingSaveOutcomeAlert');
          return result;
        } catch (error) {
          const serialized = serializeSaveError(error, 'Retry failed.');
          const stale = isStaleSaveError(serialized);
          state.saveOutcome = stale ? 'stale_after_partial' : 'partial';
          state.saveError = stale
            ? {
              ...serialized,
              code: 'transport_pair_stale_after_partial',
              message: 'Data changed after the partial save. Refresh before continuing.',
            }
            : serialized;
          state.executionAnnouncement = state.saveError.message;
          if (stale) state.preflight = { ok: false, stale: true, differences: clone(serialized.details || []) };
          renderContent();
          if (stale) focusAfterRender('transportPairPricingSaveOutcomeAlert');
          else focusFirstFailedStep();
          return state.savePlan;
        } finally {
          state.isExecuting = false;
          renderContent();
          if (state.view === 'receipt') focusAfterRender('transportPairPricingReceiptTitle');
          else if (state.saveOutcome === 'partial') focusFirstFailedStep();
          else focusAfterRender('transportPairPricingSaveOutcomeAlert');
        }
      })();

      try {
        return await executionPromise;
      } finally {
        executionPromise = null;
      }
    }

    function editAgain() {
      if (state.isExecuting) return;
      void refresh();
    }

    function trapDialogFocus(dialog, event) {
      const focusable = [...(dialog?.querySelectorAll?.(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => element.offsetParent !== null);
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

    function handleKeydown(event) {
      if (!state.isOpen) return;
      if (state.recoveryDialogOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeRecoveryDialog();
          return;
        }
        if (event.key === 'Tab') trapDialogFocus(byId('transportPairPricingRecoveryDialog'), event);
        return;
      }
      if (state.confirmationOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSaveConfirmation();
          return;
        }
        if (event.key !== 'Tab') return;
        trapDialogFocus(byId('transportPairPricingSaveConfirmDialog'), event);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!state.isExecuting) requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const modal = byId('transportPairPricingModal');
      const focusable = [...(modal?.querySelectorAll?.(
        'button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => element.offsetParent !== null);
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

    function openAdvanced() {
      if (!state.outbound) return;
      const direction = state.advancedDirection === 'reverse' && state.reverse ? 'reverse' : 'outbound';
      const route = direction === 'reverse' ? state.reverse : state.outbound;
      const ruleId = normalizeId(state.selectedRuleIds[direction]);
      const context = {
        direction,
        routeId: normalizeId(route?.id),
        ruleId,
      };
      closeImmediately();
      options.onOpenAdvanced?.(context);
    }

    function openRouteWizard() {
      if (!state.outbound || state.reverse) return;
      const context = {
        originLocationId: normalizeId(state.outbound.origin_location_id),
        destinationLocationId: normalizeId(state.outbound.destination_location_id),
      };
      closeImmediately();
      options.onOpenRouteWizard?.(context);
    }

    async function open(routeIdRaw, openOptions = {}) {
      if (!initialized) initialize();
      const routeId = normalizeId(routeIdRaw);
      const modal = byId('transportPairPricingModal');
      if (!routeId || !modal || !repository || !draftCore) return false;
      returnFocus = openOptions.returnFocus || documentRef?.activeElement || null;
      state = {
        isOpen: true,
        loading: false,
        routeId,
        outbound: null,
        reverse: null,
        pricingRules: [],
        depositOverrides: [],
        depositDefault: null,
        selectedRuleIds: { outbound: '', reverse: '' },
        advancedDirection: 'outbound',
        fetchedAt: '',
        error: null,
        view: 'edit',
        draft: null,
        confirmationOpen: false,
        recoveryDialogOpen: false,
        recoveryDialogMode: null,
        recoveryHistory: [],
        isExecuting: false,
        preflight: null,
        retryPrecheck: null,
        savePlan: null,
        saveOutcome: null,
        receipt: null,
        saveError: null,
        executionAnnouncement: '',
      };
      const title = byId('transportPairPricingModalTitle');
      const status = byId('transportPairPricingModalStatus');
      if (title) title.textContent = 'Transport pair pricing';
      if (status) status.textContent = `Reading route ${routeId}.`;
      modal.hidden = false;
      documentRef?.body?.classList?.add('transport-pair-pricing-modal-open');
      root.requestAnimationFrame?.(() => byId('transportPairPricingModalClose')?.focus?.());
      if (!root.requestAnimationFrame) byId('transportPairPricingModalClose')?.focus?.();
      await refresh();
      return true;
    }

    function initialize() {
      if (initialized) return api;
      byId('transportPairPricingModalClose')?.addEventListener?.('click', requestClose);
      byId('transportPairPricingModalRefresh')?.addEventListener?.('click', () => void requestRefresh());
      byId('transportPairPricingOpenAdvanced')?.addEventListener?.('click', openAdvanced);
      byId('transportPairPricingOpenRouteWizard')?.addEventListener?.('click', openRouteWizard);
      byId('transportPairPricingReviewChanges')?.addEventListener?.('click', reviewChanges);
      byId('transportPairPricingBackToEdit')?.addEventListener?.('click', backToEdit);
      byId('transportPairPricingSaveChanges')?.addEventListener?.('click', openSaveConfirmation);
      byId('transportPairPricingRetryFailed')?.addEventListener?.('click', () => void retryFailedSteps());
      byId('transportPairPricingSaveConfirmCancel')?.addEventListener?.('click', () => closeSaveConfirmation());
      byId('transportPairPricingSaveConfirmAccept')?.addEventListener?.('click', () => void executeConfirmedSave());
      byId('transportPairPricingReceiptEditAgain')?.addEventListener?.('click', editAgain);
      byId('transportPairPricingReceiptClose')?.addEventListener?.('click', requestClose);
      byId('transportPairPricingRecoveryStay')?.addEventListener?.('click', () => closeRecoveryDialog());
      byId('transportPairPricingRecoveryConfirm')?.addEventListener?.('click', confirmRecoveryAction);
      byId('transportPairPricingModalContent')?.addEventListener?.('change', handleContentChange);
      byId('transportPairPricingModalContent')?.addEventListener?.('input', handleContentInput);
      byId('transportPairPricingModal')?.querySelector?.('[data-transport-pair-pricing-close]')
        ?.addEventListener?.('click', requestClose);
      documentRef?.addEventListener?.('keydown', handleKeydown);
      initialized = true;
      return api;
    }

    function getState() {
      return clone(state);
    }

    const api = Object.freeze({ close: requestClose, getState, initialize, open, refresh: requestRefresh });
    return api;
  }

  const api = Object.freeze({
    comparePairValues,
    create,
    createReadRepository,
    findReverseRouteInRows,
    hasCurrencyConflict,
    selectInitialPricingRuleId,
    initialize(options = {}) {
      if (!singleton) singleton = create(options);
      singleton.initialize();
      return singleton;
    },
    open(routeId, options = {}) {
      return singleton?.open?.(routeId, options) || Promise.resolve(false);
    },
    close() {
      return singleton?.close?.() || false;
    },
    getState() {
      return singleton?.getState?.() || null;
    },
  });

  Object.defineProperty(root, 'TransportPairPricingModal', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
