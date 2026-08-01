(function registerTransportPairPricingCore(root) {
  'use strict';

  const ROUTE_FIELDS = Object.freeze([
    Object.freeze({ shared: 'dayPrice', column: 'day_price', type: 'number' }),
    Object.freeze({ shared: 'nightPrice', column: 'night_price', type: 'number' }),
    Object.freeze({ shared: 'currency', column: 'currency', type: 'currency' }),
    Object.freeze({ shared: 'includedPassengers', column: 'included_passengers', type: 'integer' }),
    Object.freeze({ shared: 'includedBags', column: 'included_bags', type: 'integer' }),
    Object.freeze({ shared: 'includedLargeBags', column: 'included_large_bags', type: 'integer' }),
    Object.freeze({ shared: 'maxPassengers', column: 'max_passengers', type: 'integer' }),
    Object.freeze({ shared: 'maxBags', column: 'max_bags', type: 'integer' }),
  ]);

  const PRICING_FIELDS = Object.freeze([
    Object.freeze({ shared: 'extraPassengerFee', column: 'extra_passenger_fee', type: 'number' }),
    Object.freeze({ shared: 'extraBagFee', column: 'extra_bag_fee', type: 'number' }),
    Object.freeze({ shared: 'oversizeBagFee', column: 'oversize_bag_fee', type: 'number' }),
    Object.freeze({ shared: 'childSeatFee', column: 'child_seat_fee', type: 'number' }),
    Object.freeze({ shared: 'boosterSeatFee', column: 'booster_seat_fee', type: 'number' }),
    Object.freeze({ shared: 'waitingIncludedMinutes', column: 'waiting_included_minutes', type: 'integer' }),
    Object.freeze({ shared: 'waitingFeePerHour', column: 'waiting_fee_per_hour', type: 'number' }),
    Object.freeze({ shared: 'nightStart', column: 'night_start', type: 'time' }),
    Object.freeze({ shared: 'nightEnd', column: 'night_end', type: 'time' }),
  ]);

  const DEPOSIT_RULE_FIELDS = Object.freeze([
    Object.freeze({ shared: 'depositEnabled', column: 'deposit_enabled', type: 'boolean' }),
    Object.freeze({ shared: 'depositMode', column: 'deposit_mode', type: 'text' }),
    Object.freeze({ shared: 'depositValue', column: 'deposit_value', type: 'number' }),
  ]);

  const DERIVED_PRICING_FIELDS = Object.freeze([
    Object.freeze({ shared: null, column: 'waiting_fee_per_minute', type: 'number' }),
  ]);

  const PRICING_PRESERVED_FIELDS = Object.freeze([
    'route_id',
    'valid_from',
    'valid_to',
    'priority',
    'is_active',
    'deposit_base_floor',
  ]);

  const SERVICE_DEPOSIT_DEFAULT_FIELDS = Object.freeze([
    Object.freeze({ column: 'id', type: 'text' }),
    Object.freeze({ column: 'resource_type', type: 'text' }),
    Object.freeze({ column: 'mode', type: 'text' }),
    Object.freeze({ column: 'amount', type: 'number' }),
    Object.freeze({ column: 'currency', type: 'currency' }),
    Object.freeze({ column: 'include_children', type: 'boolean' }),
    Object.freeze({ column: 'enabled', type: 'boolean' }),
    Object.freeze({ column: 'updated_at', type: 'text' }),
  ]);

  const DEPOSIT_OVERRIDE_FIELDS = Object.freeze([
    Object.freeze({ column: 'resource_type', type: 'text' }),
    Object.freeze({ column: 'resource_id', type: 'text' }),
    Object.freeze({ column: 'mode', type: 'text' }),
    Object.freeze({ column: 'amount', type: 'number' }),
    Object.freeze({ column: 'currency', type: 'currency' }),
    Object.freeze({ column: 'include_children', type: 'boolean' }),
    Object.freeze({ column: 'enabled', type: 'boolean' }),
  ]);

  const ALLOWED_DEPOSIT_MODES = Object.freeze([
    'percent_total',
    'per_person',
    'fixed_amount',
  ]);

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

  function normalizeTime(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
    if (!match) return text;
    return `${match[1]}:${match[2]}`;
  }

  function finiteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeValue(value, type) {
    if (value === null || value === undefined || value === '') return null;
    if (type === 'number' || type === 'integer') return finiteNumber(value);
    if (type === 'currency') return normalizeCurrency(value);
    if (type === 'time') return normalizeTime(value);
    if (type === 'boolean') return Boolean(value);
    return String(value).trim();
  }

  function valuesEqual(left, right, type) {
    return normalizeValue(left, type) === normalizeValue(right, type);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }

  function stableSerialize(value) {
    return JSON.stringify(stableValue(value));
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function rulesForRoute(context, routeId) {
    const id = normalizeId(routeId);
    return (Array.isArray(context?.pricingRules) ? context.pricingRules : [])
      .filter((rule) => normalizeId(rule?.route_id) === id);
  }

  function overridesForRoute(context, routeId) {
    const id = normalizeId(routeId);
    return (Array.isArray(context?.depositOverrides) ? context.depositOverrides : [])
      .filter((row) => (
        String(row?.resource_type || '').trim() === 'transport'
          && normalizeId(row?.resource_id) === id
      ));
  }

  function initialRuleId(rules, requestedId) {
    const requested = normalizeId(requestedId);
    if (requested && rules.some((rule) => normalizeId(rule?.id) === requested)) return requested;
    if (rules.length === 1 && rules[0]?.is_active === true) return normalizeId(rules[0]?.id);
    return '';
  }

  function findRule(rules, ruleId, routeId) {
    const id = normalizeId(ruleId);
    const expectedRouteId = normalizeId(routeId);
    if (!id || !expectedRouteId) return null;
    return rules.find((rule) => (
      normalizeId(rule?.id) === id
        && normalizeId(rule?.route_id) === expectedRouteId
    )) || null;
  }

  function findOverride(context, routeId) {
    const rows = overridesForRoute(context, routeId);
    return rows.length === 1 ? rows[0] : null;
  }

  function createTransportPairPricingDraft(context = {}) {
    const outboundRoute = clone(context.outboundRoute || context.outbound || null);
    const reverseRoute = clone(context.reverseRoute || context.reverse || null);
    const outboundRouteId = normalizeId(outboundRoute?.id);
    const reverseRouteId = normalizeId(reverseRoute?.id);
    const outboundRules = rulesForRoute(context, outboundRouteId);
    const reverseRules = rulesForRoute(context, reverseRouteId);
    const requestedOutboundRuleId = context.selectedRules?.outboundRuleId
      ?? context.selectedRuleIds?.outbound
      ?? context.outboundRuleId;
    const requestedReverseRuleId = context.selectedRules?.reverseRuleId
      ?? context.selectedRuleIds?.reverse
      ?? context.reverseRuleId;
    const outboundRuleId = initialRuleId(outboundRules, requestedOutboundRuleId);
    const reverseRuleId = initialRuleId(reverseRules, requestedReverseRuleId);
    const loadedAt = String(context.loadedAt || '');

    const draft = {
      version: 1,
      outboundRouteId: outboundRouteId || null,
      reverseRouteId: reverseRouteId || null,
      selectedRules: {
        outboundRuleId: outboundRuleId || null,
        reverseRuleId: reverseRuleId || null,
      },
      scope: {
        updateOutbound: true,
        updateReverse: Boolean(reverseRouteId),
      },
      shared: {
        dayPrice: null,
        nightPrice: null,
        currency: null,
        includedPassengers: null,
        includedBags: null,
        includedLargeBags: null,
        maxPassengers: null,
        maxBags: null,
        extraPassengerFee: null,
        extraBagFee: null,
        oversizeBagFee: null,
        childSeatFee: null,
        boosterSeatFee: null,
        waitingIncludedMinutes: null,
        waitingFeePerHour: null,
        nightStart: null,
        nightEnd: null,
        depositEnabled: null,
        depositMode: null,
        depositValue: null,
      },
      mixed: {},
      snapshot: {
        loadedAt,
        outboundRoute,
        reverseRoute,
        outboundRule: clone(findRule(outboundRules, outboundRuleId, outboundRouteId)),
        reverseRule: clone(findRule(reverseRules, reverseRuleId, reverseRouteId)),
        outboundOverride: clone(findOverride(context, outboundRouteId)),
        reverseOverride: clone(findOverride(context, reverseRouteId)),
        serviceDepositDefault: clone(context.serviceDepositDefault ?? context.depositDefault ?? null),
        ruleCounts: {
          outbound: outboundRules.length,
          reverse: reverseRules.length,
        },
        overrideCounts: {
          outbound: overridesForRoute(context, outboundRouteId).length,
          reverse: overridesForRoute(context, reverseRouteId).length,
        },
        reverseRelation: {
          outboundOriginLocationId: normalizeId(outboundRoute?.origin_location_id),
          outboundDestinationLocationId: normalizeId(outboundRoute?.destination_location_id),
          reverseOriginLocationId: normalizeId(reverseRoute?.origin_location_id),
          reverseDestinationLocationId: normalizeId(reverseRoute?.destination_location_id),
        },
      },
      validation: {
        errors: [],
        warnings: [],
      },
      review: {
        isCurrent: false,
        fingerprint: null,
        plan: null,
      },
    };

    return hydrateTransportPairSharedValues(draft);
  }

  function directionsInScope(draft) {
    const directions = [];
    if (draft?.scope?.updateOutbound) directions.push('outbound');
    if (draft?.scope?.updateReverse && draft?.snapshot?.reverseRoute) directions.push('reverse');
    return directions;
  }

  function routeForDirection(draft, direction) {
    return direction === 'reverse'
      ? draft?.snapshot?.reverseRoute || null
      : draft?.snapshot?.outboundRoute || null;
  }

  function ruleForDirection(draft, direction) {
    return direction === 'reverse'
      ? draft?.snapshot?.reverseRule || null
      : draft?.snapshot?.outboundRule || null;
  }

  function overrideForDirection(draft, direction) {
    return direction === 'reverse'
      ? draft?.snapshot?.reverseOverride || null
      : draft?.snapshot?.outboundOverride || null;
  }

  function selectedRuleIdForDirection(draft, direction) {
    return normalizeId(direction === 'reverse'
      ? draft?.selectedRules?.reverseRuleId
      : draft?.selectedRules?.outboundRuleId);
  }

  function setCommonField(next, descriptor, records, group) {
    const values = records.map((record) => normalizeValue(record?.[descriptor.column], descriptor.type));
    const first = values[0] ?? null;
    const different = values.length > 1 && values.some((value) => value !== first);
    next.shared[descriptor.shared] = different ? null : first;
    next.mixed[descriptor.shared] = {
      isMixed: different,
      group,
      outbound: records[0] ? normalizeValue(records[0]?.[descriptor.column], descriptor.type) : null,
      reverse: records[1] ? normalizeValue(records[1]?.[descriptor.column], descriptor.type) : null,
    };
  }

  function hydrateTransportPairSharedValues(draft, options = {}) {
    const next = clone(draft);
    if (!next?.shared || !next?.snapshot) return next;
    next.mixed = next.mixed && typeof next.mixed === 'object' ? next.mixed : {};
    const sections = Array.isArray(options.sections) && options.sections.length
      ? new Set(options.sections)
      : new Set(['route', 'pricing', 'deposit']);
    const directions = directionsInScope(next);

    if (sections.has('route')) {
      const routes = directions.map((direction) => routeForDirection(next, direction)).filter(Boolean);
      ROUTE_FIELDS.forEach((descriptor) => setCommonField(next, descriptor, routes, 'route'));
    }

    const selectedRules = directions
      .map((direction) => ruleForDirection(next, direction))
      .filter(Boolean);
    if (sections.has('pricing')) {
      PRICING_FIELDS.forEach((descriptor) => setCommonField(next, descriptor, selectedRules, 'pricing'));
    }
    if (sections.has('deposit')) {
      DEPOSIT_RULE_FIELDS.forEach((descriptor) => setCommonField(next, descriptor, selectedRules, 'deposit'));
    }

    next.validation = { errors: [], warnings: [] };
    next.review = {
      ...next.review,
      isCurrent: false,
    };
    return next;
  }

  function validationIssue(code, field, message, section, direction = null) {
    return { code, field, message, section, direction };
  }

  function hasAtMostTwoDecimals(value) {
    if (value === null || value === undefined || value === '') return false;
    const text = String(value).trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return false;
    const decimals = text.includes('.') ? text.split('.')[1].length : 0;
    return decimals <= 2;
  }

  function isValidTime(value) {
    const normalized = normalizeTime(value);
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    return Number(match[1]) >= 0
      && Number(match[1]) <= 23
      && Number(match[2]) >= 0
      && Number(match[2]) <= 59;
  }

  function getTransportPairDepositAccess(draft) {
    const directions = directionsInScope(draft);
    const reasons = [];
    if (!draft?.snapshot?.serviceDepositDefault) {
      reasons.push('The global transport deposit default is unavailable.');
    }
    directions.forEach((direction) => {
      const ruleCount = Number(draft?.snapshot?.ruleCounts?.[direction] || 0);
      const overrideCount = Number(draft?.snapshot?.overrideCounts?.[direction] || 0);
      const ruleId = selectedRuleIdForDirection(draft, direction);
      const rule = ruleForDirection(draft, direction);
      if (ruleCount > 1) {
        reasons.push(`${direction === 'reverse' ? 'B→A' : 'A→B'} has multiple pricing rules.`);
      }
      if (!ruleId || !rule || normalizeId(rule.id) !== ruleId) {
        reasons.push(`${direction === 'reverse' ? 'B→A' : 'A→B'} has no exact pricing rule selected.`);
      }
      if (overrideCount > 1) {
        reasons.push(`${direction === 'reverse' ? 'B→A' : 'A→B'} has multiple deposit overrides.`);
      }
    });
    return {
      editable: directions.length > 0 && reasons.length === 0,
      reasons,
      directions,
    };
  }

  function validateTransportPairPricingDraft(draft) {
    const errors = [];
    const warnings = [];
    const directions = directionsInScope(draft);
    const reverse = draft?.snapshot?.reverseRoute || null;

    if (!draft?.scope?.updateOutbound) {
      errors.push(validationIssue(
        'outbound_scope_required',
        'scope',
        'A→B must remain in scope in the simple editor.',
        'scope',
      ));
    }
    if (draft?.scope?.updateReverse && !reverse) {
      errors.push(validationIssue(
        'reverse_scope_missing',
        'scope',
        'Update both directions is unavailable because the reverse route does not exist.',
        'scope',
      ));
    }
    if (!directions.length) {
      errors.push(validationIssue('scope_empty', 'scope', 'Select at least one route.', 'scope'));
    }

    const dayPrice = finiteNumber(draft?.shared?.dayPrice);
    const nightPrice = finiteNumber(draft?.shared?.nightPrice);
    if (!(dayPrice > 0) || !hasAtMostTwoDecimals(draft?.shared?.dayPrice)) {
      errors.push(validationIssue(
        'day_price_invalid',
        'dayPrice',
        'Day price must be a finite number greater than 0 with at most two decimal places.',
        'base_price',
      ));
    }
    if (!(nightPrice > 0) || !hasAtMostTwoDecimals(draft?.shared?.nightPrice)) {
      errors.push(validationIssue(
        'night_price_invalid',
        'nightPrice',
        'Night price must be a finite number greater than 0 with at most two decimal places.',
        'base_price',
      ));
    }
    const currency = normalizeCurrency(draft?.shared?.currency);
    if (!currency) {
      errors.push(validationIssue('currency_required', 'currency', 'Currency is required.', 'base_price'));
    } else if (!/^[A-Z]{3}$/.test(currency)) {
      warnings.push(validationIssue(
        'currency_format_recommended',
        'currency',
        'A three-letter uppercase currency code is recommended.',
        'base_price',
      ));
    }

    const includedPassengers = finiteNumber(draft?.shared?.includedPassengers);
    const includedBags = finiteNumber(draft?.shared?.includedBags);
    const includedLargeBags = finiteNumber(draft?.shared?.includedLargeBags);
    const maxPassengers = finiteNumber(draft?.shared?.maxPassengers);
    const maxBags = finiteNumber(draft?.shared?.maxBags);
    const integerChecks = [
      ['includedPassengers', includedPassengers, 1, 'Included passengers must be an integer of at least 1.'],
      ['includedBags', includedBags, 0, 'Included small backpacks must be an integer of at least 0.'],
      ['includedLargeBags', includedLargeBags, 0, 'Included large bags must be an integer of at least 0.'],
      ['maxPassengers', maxPassengers, 1, 'Max passengers must be an integer of at least 1.'],
      ['maxBags', maxBags, 0, 'Max total luggage must be an integer of at least 0.'],
    ];
    integerChecks.forEach(([field, value, minimum, message]) => {
      if (!Number.isInteger(value) || value < minimum) {
        errors.push(validationIssue(`${field}_invalid`, field, message, 'capacity'));
      }
    });
    if (Number.isInteger(maxPassengers) && Number.isInteger(includedPassengers) && maxPassengers < includedPassengers) {
      errors.push(validationIssue(
        'max_passengers_below_included',
        'maxPassengers',
        'Max passengers must be greater than or equal to included passengers.',
        'capacity',
      ));
    }
    if (
      Number.isInteger(maxBags)
      && Number.isInteger(includedBags)
      && Number.isInteger(includedLargeBags)
      && maxBags < includedBags + includedLargeBags
    ) {
      errors.push(validationIssue(
        'max_bags_below_included',
        'maxBags',
        'Max total luggage must cover included small backpacks plus included large bags.',
        'capacity',
      ));
    }

    const selectedDirections = directions.filter((direction) => {
      const selectedId = selectedRuleIdForDirection(draft, direction);
      const rule = ruleForDirection(draft, direction);
      if (!selectedId || !rule) return false;
      return normalizeId(rule.id) === selectedId
        && normalizeId(rule.route_id) === normalizeId(routeForDirection(draft, direction)?.id);
    });

    directions.forEach((direction) => {
      const selectedId = selectedRuleIdForDirection(draft, direction);
      const rule = ruleForDirection(draft, direction);
      const label = direction === 'reverse' ? 'B→A' : 'A→B';
      if (selectedId && !rule) {
        errors.push(validationIssue(
          'selected_rule_snapshot_mismatch',
          direction === 'reverse' ? 'reverseRuleId' : 'outboundRuleId',
          `${label} selected pricing rule is not present in the fresh snapshot.`,
          'pricing',
          direction,
        ));
      }
      if (!selectedId) {
        warnings.push(validationIssue(
          'pricing_rule_not_selected',
          direction === 'reverse' ? 'reverseRuleId' : 'outboundRuleId',
          `${label}: No pricing rule selected. Advanced pricing fields cannot be updated in the simple editor.`,
          'pricing',
          direction,
        ));
      }
    });

    if (selectedDirections.length) {
      [
        ['extraPassengerFee', 'Extra passenger fee'],
        ['extraBagFee', 'Extra small backpack fee'],
        ['oversizeBagFee', 'Extra large bag fee'],
        ['childSeatFee', 'Child seat fee'],
        ['boosterSeatFee', 'Booster seat fee'],
      ].forEach(([field, label]) => {
        const value = finiteNumber(draft?.shared?.[field]);
        if (value === null || value < 0) {
          errors.push(validationIssue(
            `${field}_invalid`,
            field,
            `${label} must be a finite number greater than or equal to 0.`,
            'extras',
          ));
        }
      });

      const waitingIncluded = finiteNumber(draft?.shared?.waitingIncludedMinutes);
      if (!Number.isInteger(waitingIncluded) || waitingIncluded < 0) {
        errors.push(validationIssue(
          'waiting_included_invalid',
          'waitingIncludedMinutes',
          'Waiting included minutes must be an integer greater than or equal to 0.',
          'extras',
        ));
      }
      const waitingPerHour = finiteNumber(draft?.shared?.waitingFeePerHour);
      if (
        waitingPerHour === null
        || waitingPerHour < 0
        || !hasAtMostTwoDecimals(draft?.shared?.waitingFeePerHour)
      ) {
        errors.push(validationIssue(
          'waiting_fee_invalid',
          'waitingFeePerHour',
          'Waiting fee per hour must be at least 0 with at most two decimal places.',
          'extras',
        ));
      }
      if (!isValidTime(draft?.shared?.nightStart)) {
        errors.push(validationIssue(
          'night_start_invalid',
          'nightStart',
          'Night start must use a valid HH:MM time.',
          'night_window',
        ));
      }
      if (!isValidTime(draft?.shared?.nightEnd)) {
        errors.push(validationIssue(
          'night_end_invalid',
          'nightEnd',
          'Night end must use a valid HH:MM time.',
          'night_window',
        ));
      }
      if (
        isValidTime(draft?.shared?.nightStart)
        && isValidTime(draft?.shared?.nightEnd)
        && normalizeTime(draft.shared.nightStart) === normalizeTime(draft.shared.nightEnd)
      ) {
        errors.push(validationIssue(
          'night_window_equal',
          'nightEnd',
          'Night start and night end cannot be identical.',
          'night_window',
        ));
      }
    }

    const depositAccess = getTransportPairDepositAccess(draft);
    if (!depositAccess.editable) {
      depositAccess.reasons.forEach((reason) => warnings.push(validationIssue(
        'deposit_editing_blocked',
        'depositEnabled',
        reason,
        'deposit',
      )));
    } else {
      if (draft?.shared?.depositEnabled !== true && draft?.shared?.depositEnabled !== false) {
        errors.push(validationIssue(
          'deposit_enabled_required',
          'depositEnabled',
          'Choose whether the shared deposit is enabled.',
          'deposit',
        ));
      }
      if (draft?.shared?.depositEnabled === true) {
        const mode = String(draft?.shared?.depositMode || '').trim().toLowerCase();
        const value = finiteNumber(draft?.shared?.depositValue);
        if (!ALLOWED_DEPOSIT_MODES.includes(mode)) {
          errors.push(validationIssue(
            'deposit_mode_invalid',
            'depositMode',
            'Choose a supported deposit mode.',
            'deposit',
          ));
        }
        if (!(value > 0) || !hasAtMostTwoDecimals(draft?.shared?.depositValue)) {
          errors.push(validationIssue(
            'deposit_value_invalid',
            'depositValue',
            'Enabled deposit value must be greater than 0 with at most two decimal places.',
            'deposit',
          ));
        } else if (mode === 'percent_total' && value > 100) {
          errors.push(validationIssue(
            'deposit_percent_above_100',
            'depositValue',
            'Percent deposit cannot exceed 100.',
            'deposit',
          ));
        }
      }
    }

    return { errors, warnings, depositAccess };
  }

  function fieldChange(config) {
    const before = normalizeValue(config.before, config.type);
    const after = normalizeValue(config.after, config.type);
    if (before === after) return null;
    return {
      entityType: config.entityType,
      entityId: config.entityId || null,
      direction: config.direction,
      field: config.field,
      before,
      after,
    };
  }

  function changesForFields(beforeRecord, afterRecord, fields, meta) {
    return fields.map((descriptor) => fieldChange({
      ...meta,
      field: descriptor.column,
      type: descriptor.type,
      before: beforeRecord?.[descriptor.column],
      after: afterRecord?.[descriptor.column],
    })).filter(Boolean);
  }

  function buildRouteAfter(route, draft) {
    const after = clone(route);
    ROUTE_FIELDS.forEach((descriptor) => {
      after[descriptor.column] = normalizeValue(draft.shared[descriptor.shared], descriptor.type);
    });
    return after;
  }

  function buildPricingAfter(rule, draft, depositEditable) {
    const after = clone(rule);
    PRICING_FIELDS.forEach((descriptor) => {
      after[descriptor.column] = normalizeValue(draft.shared[descriptor.shared], descriptor.type);
    });
    const waitingFeePerHour = finiteNumber(draft.shared.waitingFeePerHour);
    after.waiting_fee_per_minute = waitingFeePerHour === null
      ? normalizeValue(rule?.waiting_fee_per_minute, 'number')
      : Math.round((waitingFeePerHour / 60) * 10000) / 10000;
    if (depositEditable) {
      const enabled = draft.shared.depositEnabled === true;
      after.deposit_enabled = enabled;
      after.deposit_value = enabled ? finiteNumber(draft.shared.depositValue) : 0;
      if (enabled) after.deposit_mode = String(draft.shared.depositMode || '').trim().toLowerCase();
    }
    return after;
  }

  function mapDepositModeToServiceMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'fixed_amount') return 'flat';
    if (normalized === 'per_person') return 'per_person';
    return 'percent_total';
  }

  function buildDesiredOverride(draft, route) {
    return {
      resource_type: 'transport',
      resource_id: normalizeId(route?.id),
      mode: mapDepositModeToServiceMode(draft.shared.depositMode),
      amount: finiteNumber(draft.shared.depositValue),
      currency: normalizeCurrency(draft.shared.currency),
      include_children: Boolean(draft.snapshot.serviceDepositDefault?.include_children),
      enabled: true,
    };
  }

  function buildEntityPlans(draft) {
    const directions = directionsInScope(draft);
    const depositAccess = getTransportPairDepositAccess(draft);
    const steps = [];

    directions.forEach((direction) => {
      const route = routeForDirection(draft, direction);
      const routeId = normalizeId(route?.id);
      const routeAfter = buildRouteAfter(route, draft);
      const routeChanges = changesForFields(route, routeAfter, ROUTE_FIELDS, {
        entityType: 'route',
        entityId: routeId,
        direction,
      });
      steps.push({
        key: `route_${direction}`,
        type: 'transport_route',
        action: routeChanges.length ? 'update' : 'unchanged',
        entityId: routeId,
        expectedUpdatedAt: route?.updated_at || null,
        before: clone(route),
        after: routeAfter,
        changes: routeChanges,
      });

      const rule = ruleForDirection(draft, direction);
      const selectedRuleId = selectedRuleIdForDirection(draft, direction);
      const ruleCount = Number(draft?.snapshot?.ruleCounts?.[direction] || 0);
      if (rule && selectedRuleId && normalizeId(rule.id) === selectedRuleId) {
        const pricingAfter = buildPricingAfter(rule, draft, depositAccess.editable);
        const pricingDescriptors = depositAccess.editable
          ? [...PRICING_FIELDS, ...DERIVED_PRICING_FIELDS, ...DEPOSIT_RULE_FIELDS]
          : [...PRICING_FIELDS, ...DERIVED_PRICING_FIELDS];
        const pricingChanges = changesForFields(rule, pricingAfter, pricingDescriptors, {
          entityType: 'pricing_rule',
          entityId: selectedRuleId,
          direction,
        });
        steps.push({
          key: `pricing_${direction}`,
          type: 'pricing_rule',
          action: pricingChanges.length ? 'update' : 'unchanged',
          entityId: selectedRuleId,
          routeId,
          expectedUpdatedAt: rule?.updated_at || null,
          ruleCount,
          before: clone(rule),
          after: pricingAfter,
          changes: pricingChanges,
        });
      } else {
        steps.push({
          key: `pricing_${direction}`,
          type: 'pricing_rule',
          action: 'blocked',
          entityId: selectedRuleId || null,
          routeId,
          expectedUpdatedAt: null,
          ruleCount,
          reason: 'No pricing rule selected. Advanced pricing fields cannot be updated in the simple editor.',
          before: null,
          after: null,
          changes: [],
        });
      }

      const override = overrideForDirection(draft, direction);
      const overrideId = normalizeId(override?.id) || null;
      if (!depositAccess.editable) {
        steps.push({
          key: `deposit_${direction}`,
          type: 'deposit_override',
          action: 'blocked',
          entityId: overrideId,
          resourceId: routeId,
          expectedUpdatedAt: override?.updated_at || null,
          reason: depositAccess.reasons.join(' '),
          before: clone(override),
          after: clone(override),
          changes: [],
        });
        return;
      }

      if (draft.shared.depositEnabled === true) {
        const desired = buildDesiredOverride(draft, route);
        const after = override ? { ...clone(override), ...desired } : desired;
        const changes = changesForFields(override, after, DEPOSIT_OVERRIDE_FIELDS, {
          entityType: 'deposit_override',
          entityId: overrideId,
          direction,
        });
        steps.push({
          key: `deposit_${direction}`,
          type: 'deposit_override',
          action: override ? (changes.length ? 'update' : 'unchanged') : 'insert',
          entityId: overrideId,
          resourceId: routeId,
          expectedUpdatedAt: override?.updated_at || null,
          before: clone(override),
          after,
          changes,
        });
        return;
      }

      if (override) {
        const changes = DEPOSIT_OVERRIDE_FIELDS.map((descriptor) => fieldChange({
          entityType: 'deposit_override',
          entityId: overrideId,
          direction,
          field: descriptor.column,
          type: descriptor.type,
          before: override?.[descriptor.column],
          after: null,
        })).filter(Boolean);
        steps.push({
          key: `deposit_${direction}`,
          type: 'deposit_override',
          action: 'delete',
          entityId: overrideId,
          resourceId: routeId,
          expectedUpdatedAt: override?.updated_at || null,
          before: clone(override),
          after: null,
          changes,
        });
      } else {
        steps.push({
          key: `deposit_${direction}`,
          type: 'deposit_override',
          action: 'unchanged',
          entityId: null,
          resourceId: routeId,
          expectedUpdatedAt: null,
          before: null,
          after: null,
          changes: [],
        });
      }
    });

    return steps;
  }

  function reviewError(code, message, validation = null) {
    const error = new Error(message);
    error.code = code;
    error.validation = validation;
    return error;
  }

  function assertReviewable(draft) {
    const validation = validateTransportPairPricingDraft(draft);
    if (validation.errors.length) {
      throw reviewError('transport_pair_review_validation_failed', 'Draft validation failed.', validation);
    }
    const routeIds = directionsInScope(draft)
      .map((direction) => normalizeId(routeForDirection(draft, direction)?.id))
      .filter(Boolean);
    if (new Set(routeIds).size > 2) {
      throw reviewError('transport_pair_route_scope_exceeded', 'Review cannot contain more than two route IDs.');
    }
    if (draft?.scope?.updateReverse) {
      const relation = draft?.snapshot?.reverseRelation || {};
      const exactReverse = normalizeId(relation.reverseOriginLocationId) === normalizeId(relation.outboundDestinationLocationId)
        && normalizeId(relation.reverseDestinationLocationId) === normalizeId(relation.outboundOriginLocationId);
      if (!exactReverse) {
        throw reviewError('transport_pair_reverse_relation_changed', 'Reverse route relation is not the exact A↔B pair.');
      }
    }
    return validation;
  }

  function fingerprintTransportPairPricingDraft(draft) {
    const projection = {
      version: draft?.version,
      outboundRouteId: draft?.outboundRouteId,
      reverseRouteId: draft?.reverseRouteId,
      selectedRules: draft?.selectedRules,
      scope: draft?.scope,
      shared: draft?.shared,
      snapshot: draft?.snapshot,
    };
    return `transport-pair-v1-${hashText(stableSerialize(projection))}`;
  }

  function buildTransportPairPricingDiff(draft) {
    assertReviewable(draft);
    return buildEntityPlans(draft).flatMap((step) => clone(step.changes || []));
  }

  function buildTransportPairPricingReviewPlan(draft, context = {}) {
    const validation = assertReviewable(draft);
    const fingerprint = fingerprintTransportPairPricingDraft(draft);
    const steps = buildEntityPlans(draft);
    const routeIds = steps
      .filter((step) => step.type === 'transport_route')
      .map((step) => normalizeId(step.entityId))
      .filter(Boolean);
    if (new Set(routeIds).size > 2) {
      throw reviewError('transport_pair_route_scope_exceeded', 'Review cannot contain more than two route IDs.');
    }

    const count = (type, action) => steps.filter((step) => step.type === type && step.action === action).length;
    const globalChanges = 0;
    if (globalChanges !== 0) {
      throw reviewError('transport_pair_global_change_detected', 'Global changes must remain zero.');
    }
    const createdAt = String(context.now || draft?.snapshot?.loadedAt || '');
    const plan = {
      id: `transport-pair-review-${fingerprint.slice(-8)}`,
      createdAt,
      fingerprint,
      globalChanges,
      steps,
      summary: {
        routeUpdates: count('transport_route', 'update'),
        pricingUpdates: count('pricing_rule', 'update'),
        depositInserts: count('deposit_override', 'insert'),
        depositUpdates: count('deposit_override', 'update'),
        depositDeletes: count('deposit_override', 'delete'),
        unchangedEntities: steps.filter((step) => step.action === 'unchanged').length,
        globalChanges,
      },
      preflight: {
        snapshotLoadedAt: draft?.snapshot?.loadedAt || null,
        fingerprint,
        outboundRouteId: normalizeId(draft?.snapshot?.outboundRoute?.id) || null,
        reverseRouteId: normalizeId(draft?.snapshot?.reverseRoute?.id) || null,
        routes: {
          outbound: clone(draft?.snapshot?.outboundRoute || null),
          reverse: clone(draft?.snapshot?.reverseRoute || null),
        },
        reverseRelation: clone(draft?.snapshot?.reverseRelation || null),
        serviceDepositDefaultUpdatedAt: draft?.snapshot?.serviceDepositDefault?.updated_at || null,
        serviceDepositDefault: clone(draft?.snapshot?.serviceDepositDefault || null),
        directions: directionsInScope(draft).reduce((result, direction) => {
          const route = routeForDirection(draft, direction);
          const rule = ruleForDirection(draft, direction);
          const override = overrideForDirection(draft, direction);
          result[direction] = {
            routeId: normalizeId(route?.id) || null,
            routeUpdatedAt: route?.updated_at || null,
            selectedRuleId: selectedRuleIdForDirection(draft, direction) || null,
            selectedRuleUpdatedAt: rule?.updated_at || null,
            ruleCount: Number(draft?.snapshot?.ruleCounts?.[direction] || 0),
            overrideId: normalizeId(override?.id) || null,
            overrideUpdatedAt: override?.updated_at || null,
            overrideCount: Number(draft?.snapshot?.overrideCounts?.[direction] || 0),
          };
          return result;
        }, {}),
      },
      validationWarnings: clone(validation.warnings),
    };
    return plan;
  }

  function isTransportPairPricingReviewCurrent(draft, fingerprint) {
    const expected = String(fingerprint || draft?.review?.fingerprint || '').trim();
    if (!expected || draft?.review?.isCurrent !== true) return false;
    return draft?.review?.fingerprint === expected
      && draft?.review?.plan?.fingerprint === expected
      && fingerprintTransportPairPricingDraft(draft) === expected;
  }

  function savePlanError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
  }

  function reviewStepByKey(reviewPlan, key) {
    return (Array.isArray(reviewPlan?.steps) ? reviewPlan.steps : [])
      .find((step) => String(step?.key || '') === key) || null;
  }

  function freshRouteForDirection(freshContext, direction) {
    return direction === 'reverse'
      ? freshContext?.reverseRoute || null
      : freshContext?.outboundRoute || null;
  }

  function addPreflightDifference(differences, config) {
    const type = config.type || 'text';
    const before = normalizeValue(config.before, type);
    const after = normalizeValue(config.after, type);
    if (before === after) return;
    differences.push({
      code: config.code,
      entityType: config.entityType || 'context',
      entityId: config.entityId || null,
      direction: config.direction || null,
      field: config.field,
      before,
      after,
    });
  }

  function comparePreflightRecord(differences, config) {
    const expected = config.expected || null;
    const fresh = config.fresh || null;
    if (Boolean(expected) !== Boolean(fresh)) {
      differences.push({
        code: config.presenceCode,
        entityType: config.entityType,
        entityId: normalizeId(expected?.id || fresh?.id) || null,
        direction: config.direction || null,
        field: 'record_presence',
        before: expected ? 'present' : 'missing',
        after: fresh ? 'present' : 'missing',
      });
      return;
    }
    if (!expected || !fresh) return;
    config.fields.forEach((descriptor) => addPreflightDifference(differences, {
      code: descriptor.code || config.changedCode,
      entityType: config.entityType,
      entityId: normalizeId(expected.id || fresh.id) || null,
      direction: config.direction || null,
      field: descriptor.column,
      before: expected[descriptor.column],
      after: fresh[descriptor.column],
      type: descriptor.type,
    }));
  }

  function preflightTransportPairPricingReview(draft, reviewPlan, freshContext = {}) {
    const differences = [];
    const expectedFingerprint = String(reviewPlan?.fingerprint || '').trim();
    const actualFingerprint = fingerprintTransportPairPricingDraft(draft);
    if (!expectedFingerprint || expectedFingerprint !== actualFingerprint) {
      differences.push({
        code: 'draft_fingerprint_changed',
        entityType: 'draft',
        entityId: null,
        direction: null,
        field: 'fingerprint',
        before: expectedFingerprint || null,
        after: actualFingerprint,
      });
    }
    if (draft?.review?.isCurrent !== true || draft?.review?.plan?.fingerprint !== expectedFingerprint) {
      differences.push({
        code: 'review_not_current',
        entityType: 'draft',
        entityId: null,
        direction: null,
        field: 'review.isCurrent',
        before: true,
        after: Boolean(draft?.review?.isCurrent),
      });
    }
    if (Number(reviewPlan?.globalChanges) !== 0 || Number(reviewPlan?.summary?.globalChanges) !== 0) {
      differences.push({
        code: 'global_changes_not_zero',
        entityType: 'global',
        entityId: null,
        direction: null,
        field: 'globalChanges',
        before: 0,
        after: Number(reviewPlan?.globalChanges || reviewPlan?.summary?.globalChanges || 0),
      });
    }

    const routeFields = [
      { column: 'id', type: 'text', code: 'route_id_changed' },
      { column: 'origin_location_id', type: 'text', code: 'route_endpoints_changed' },
      { column: 'destination_location_id', type: 'text', code: 'route_endpoints_changed' },
      { column: 'updated_at', type: 'text', code: 'route_updated_at_changed' },
    ];
    ['outbound', 'reverse'].forEach((direction) => comparePreflightRecord(differences, {
      expected: reviewPlan?.preflight?.routes?.[direction] || null,
      fresh: freshRouteForDirection(freshContext, direction),
      fields: routeFields,
      entityType: 'route',
      direction,
      presenceCode: direction === 'reverse' ? 'reverse_route_presence_changed' : 'outbound_route_missing',
      changedCode: 'route_changed',
    }));

    const outbound = freshContext?.outboundRoute || null;
    const reverse = freshContext?.reverseRoute || null;
    const reverseLookup = Object.prototype.hasOwnProperty.call(freshContext || {}, 'reverseLookupRoute')
      ? freshContext.reverseLookupRoute
      : reverse;
    const expectedReverseId = normalizeId(reviewPlan?.preflight?.reverseRouteId);
    if (expectedReverseId && normalizeId(reverseLookup?.id) !== expectedReverseId) {
      differences.push({
        code: 'reverse_lookup_changed',
        entityType: 'route',
        entityId: expectedReverseId,
        direction: 'reverse',
        field: 'reverse_route_id',
        before: expectedReverseId,
        after: normalizeId(reverseLookup?.id) || null,
      });
    }
    if (reverse && outbound) {
      addPreflightDifference(differences, {
        code: 'reverse_relation_changed',
        entityType: 'route',
        entityId: normalizeId(reverse.id),
        direction: 'reverse',
        field: 'origin_location_id',
        before: outbound.destination_location_id,
        after: reverse.origin_location_id,
      });
      addPreflightDifference(differences, {
        code: 'reverse_relation_changed',
        entityType: 'route',
        entityId: normalizeId(reverse.id),
        direction: 'reverse',
        field: 'destination_location_id',
        before: outbound.origin_location_id,
        after: reverse.destination_location_id,
      });
    }

    const expectedDirections = reviewPlan?.preflight?.directions || {};
    Object.keys(expectedDirections).forEach((direction) => {
      const expected = expectedDirections[direction] || {};
      const freshRoute = freshRouteForDirection(freshContext, direction);
      const routeId = normalizeId(freshRoute?.id);
      const freshRules = rulesForRoute(freshContext, routeId);
      addPreflightDifference(differences, {
        code: 'pricing_rule_count_changed',
        entityType: 'pricing_rule',
        entityId: routeId,
        direction,
        field: 'rule_count',
        before: Number(expected.ruleCount || 0),
        after: freshRules.length,
        type: 'integer',
      });

      const expectedRuleId = normalizeId(expected.selectedRuleId);
      const exactRuleAnywhere = expectedRuleId
        ? (Array.isArray(freshContext?.pricingRules) ? freshContext.pricingRules : [])
          .find((rule) => normalizeId(rule?.id) === expectedRuleId) || null
        : null;
      const freshRule = expectedRuleId
        ? freshRules.find((rule) => normalizeId(rule?.id) === expectedRuleId) || null
        : null;
      if (expectedRuleId && !freshRule) {
        if (exactRuleAnywhere) {
          differences.push({
            code: 'pricing_rule_ownership_changed',
            entityType: 'pricing_rule',
            entityId: expectedRuleId,
            direction,
            field: 'route_id',
            before: expected.routeId,
            after: exactRuleAnywhere.route_id,
          });
        } else {
          differences.push({
            code: 'selected_pricing_rule_missing',
            entityType: 'pricing_rule',
            entityId: expectedRuleId,
            direction,
            field: 'id',
            before: expectedRuleId,
            after: null,
          });
        }
      } else if (freshRule) {
        addPreflightDifference(differences, {
          code: 'pricing_rule_ownership_changed',
          entityType: 'pricing_rule',
          entityId: expectedRuleId,
          direction,
          field: 'route_id',
          before: expected.routeId,
          after: freshRule.route_id,
        });
        addPreflightDifference(differences, {
          code: 'pricing_rule_updated_at_changed',
          entityType: 'pricing_rule',
          entityId: expectedRuleId,
          direction,
          field: 'updated_at',
          before: expected.selectedRuleUpdatedAt,
          after: freshRule.updated_at,
        });
      }

      const freshOverrides = overridesForRoute(freshContext, routeId);
      addPreflightDifference(differences, {
        code: 'deposit_override_count_changed',
        entityType: 'deposit_override',
        entityId: routeId,
        direction,
        field: 'override_count',
        before: Number(expected.overrideCount || 0),
        after: freshOverrides.length,
        type: 'integer',
      });
      const expectedOverrideId = normalizeId(expected.overrideId);
      const freshOverride = expectedOverrideId
        ? freshOverrides.find((row) => normalizeId(row?.id) === expectedOverrideId) || null
        : null;
      if (expectedOverrideId && !freshOverride) {
        differences.push({
          code: 'deposit_override_missing',
          entityType: 'deposit_override',
          entityId: expectedOverrideId,
          direction,
          field: 'id',
          before: expectedOverrideId,
          after: null,
        });
      } else if (freshOverride) {
        addPreflightDifference(differences, {
          code: 'deposit_override_updated_at_changed',
          entityType: 'deposit_override',
          entityId: expectedOverrideId,
          direction,
          field: 'updated_at',
          before: expected.overrideUpdatedAt,
          after: freshOverride.updated_at,
        });
      }
    });

    comparePreflightRecord(differences, {
      expected: reviewPlan?.preflight?.serviceDepositDefault || null,
      fresh: freshContext?.serviceDepositDefault || null,
      fields: SERVICE_DEPOSIT_DEFAULT_FIELDS,
      entityType: 'service_deposit_default',
      direction: null,
      presenceCode: 'global_deposit_default_presence_changed',
      changedCode: 'global_deposit_default_changed',
    });

    return {
      ok: differences.length === 0,
      stale: differences.length > 0,
      differences,
      fingerprint: actualFingerprint,
      checkedAt: String(freshContext?.loadedAt || ''),
    };
  }

  function assertAllowedChanges(step, allowedFields, code) {
    const allowed = new Set(allowedFields);
    const invalid = (Array.isArray(step?.changes) ? step.changes : [])
      .filter((change) => !allowed.has(String(change?.field || '')));
    if (invalid.length) {
      throw savePlanError(code, `Save step ${step?.key || 'unknown'} contains fields outside the approved diff.`, invalid);
    }
  }

  function assertPreservedPricingFields(step) {
    PRICING_PRESERVED_FIELDS.forEach((field) => {
      if (!valuesEqual(step?.before?.[field], step?.after?.[field], field === 'priority' ? 'number' : 'text')) {
        throw savePlanError(
          'transport_pair_pricing_preserved_field_changed',
          `Pricing field ${field} must remain unchanged.`,
          { stepKey: step?.key, field },
        );
      }
    });
  }

  function recordForSaveStep(freshContext, step) {
    const direction = String(step?.key || '').endsWith('reverse') ? 'reverse' : 'outbound';
    const route = freshRouteForDirection(freshContext, direction);
    if (step.type === 'transport_route') return route;
    if (step.type === 'pricing_rule') {
      return rulesForRoute(freshContext, normalizeId(route?.id))
        .find((rule) => normalizeId(rule?.id) === normalizeId(step.entityId)) || null;
    }
    if (step.type === 'deposit_override') {
      return overridesForRoute(freshContext, normalizeId(route?.id))
        .find((row) => normalizeId(row?.id) === normalizeId(step.entityId)) || null;
    }
    return null;
  }

  function createPairSaveStep(config) {
    if (['update', 'delete'].includes(config.action) && !String(config.expectedUpdatedAt || '').trim()) {
      throw savePlanError(
        'transport_pair_expected_updated_at_missing',
        `Optimistic concurrency timestamp is missing for ${config.key}.`,
      );
    }
    return {
      key: config.key,
      type: config.type,
      action: config.action,
      entityId: config.entityId || null,
      existingId: config.entityId || null,
      expectedUpdatedAt: config.expectedUpdatedAt || null,
      expectAbsent: config.expectAbsent === true,
      payload: clone(config.payload),
      changes: clone(config.changes || []),
      before: clone(config.before || null),
      after: clone(config.after || null),
      dependsOn: [],
      payloadRefs: {},
      status: 'pending',
      attempts: 0,
      reconciled: false,
      skipReason: null,
      resolvedPayload: null,
      result: null,
      error: null,
    };
  }

  function pickPayloadFields(payload, fields) {
    return Array.from(new Set(fields)).reduce((result, field) => {
      if (Object.prototype.hasOwnProperty.call(payload || {}, field)) result[field] = payload[field];
      return result;
    }, {});
  }

  function serviceModeToPricingMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'flat') return 'fixed_amount';
    if (normalized === 'per_person') return 'per_person';
    return 'percent_total';
  }

  function buildTransportPairPricingSavePlan(reviewPlan, freshContext = {}, options = {}) {
    const draft = options.draft || null;
    const builders = options.builders || {};
    const preflight = preflightTransportPairPricingReview(draft, reviewPlan, freshContext);
    if (!preflight.ok) {
      throw savePlanError(
        'transport_pair_stale_conflict',
        'Data changed since Review. Refresh and review the changes again.',
        preflight.differences,
      );
    }
    if (Number(reviewPlan?.globalChanges) !== 0) {
      throw savePlanError('transport_pair_global_change_detected', 'Global changes must remain zero.');
    }
    const routeReviewSteps = (reviewPlan.steps || []).filter((step) => step.type === 'transport_route');
    const routeIds = routeReviewSteps.map((step) => normalizeId(step.entityId)).filter(Boolean);
    if (new Set(routeIds).size > 2) {
      throw savePlanError('transport_pair_route_scope_exceeded', 'Pair save plan cannot contain more than two route IDs.');
    }
    if (
      typeof builders.buildTransportRoutePayload !== 'function'
      || typeof builders.buildTransportPricingRulePayload !== 'function'
      || typeof builders.buildTransportDepositOverridePayload !== 'function'
    ) {
      throw savePlanError('transport_pair_builders_missing', 'Existing Transport Admin payload builders are required.');
    }

    const steps = [];
    const orderedKeys = [
      'route_outbound',
      'route_reverse',
      'pricing_outbound',
      'pricing_reverse',
      'deposit_outbound',
      'deposit_reverse',
    ];
    orderedKeys.forEach((key) => {
      const reviewStep = reviewStepByKey(reviewPlan, key);
      if (!reviewStep || ['unchanged', 'blocked'].includes(reviewStep.action)) return;
      const direction = key.endsWith('reverse') ? 'reverse' : 'outbound';
      const route = freshRouteForDirection(freshContext, direction);
      const routeId = normalizeId(route?.id);
      const freshRecord = recordForSaveStep(freshContext, reviewStep);
      const directionPreflight = reviewPlan?.preflight?.directions?.[direction] || {};

      if (!routeId) {
        throw savePlanError('transport_pair_route_exact_id_missing', `Exact ${direction} route is unavailable.`);
      }
      if (reviewStep.type === 'transport_route' && normalizeId(reviewStep.entityId) !== routeId) {
        throw savePlanError(
          'transport_pair_route_exact_id_mismatch',
          `Reviewed ${direction} route ID does not match the fresh exact route ID.`,
          { reviewedId: reviewStep.entityId, freshId: routeId },
        );
      }
      if (
        reviewStep.type === 'pricing_rule'
        && normalizeId(reviewStep.entityId) !== normalizeId(directionPreflight.selectedRuleId)
      ) {
        throw savePlanError(
          'transport_pair_pricing_exact_id_mismatch',
          `Reviewed ${direction} pricing rule ID does not match the consciously selected rule ID.`,
          { reviewedId: reviewStep.entityId, selectedId: directionPreflight.selectedRuleId },
        );
      }
      if (reviewStep.type === 'deposit_override') {
        const reviewedOverrideId = normalizeId(reviewStep.entityId);
        const expectedOverrideId = normalizeId(directionPreflight.overrideId);
        const idsMatch = reviewStep.action === 'insert'
          ? !reviewedOverrideId && !expectedOverrideId
          : reviewedOverrideId === expectedOverrideId;
        if (!idsMatch) {
          throw savePlanError(
            'transport_pair_deposit_exact_id_mismatch',
            `Reviewed ${direction} deposit override ID does not match the snapshot.`,
            { reviewedId: reviewedOverrideId || null, expectedId: expectedOverrideId || null },
          );
        }
      }
      if (
        ['update', 'delete'].includes(reviewStep.action)
        && freshRecord
        && String(reviewStep.expectedUpdatedAt || '') !== String(freshRecord.updated_at || '')
      ) {
        throw savePlanError(
          'transport_pair_expected_updated_at_mismatch',
          `Reviewed optimistic timestamp does not match the fresh ${direction} record.`,
          {
            entityId: reviewStep.entityId,
            reviewedUpdatedAt: reviewStep.expectedUpdatedAt || null,
            freshUpdatedAt: freshRecord.updated_at || null,
          },
        );
      }

      if (reviewStep.type === 'transport_route') {
        if (reviewStep.action !== 'update' || !freshRecord) {
          throw savePlanError('transport_pair_route_insert_forbidden', 'Stage 2D can update existing routes only.');
        }
        const approvedFields = ROUTE_FIELDS.map((descriptor) => descriptor.column);
        assertAllowedChanges(reviewStep, approvedFields, 'transport_pair_route_payload_field_forbidden');
        const draftRecord = { ...clone(freshRecord) };
        reviewStep.changes.forEach((change) => { draftRecord[change.field] = change.after; });
        const built = builders.buildTransportRoutePayload(draftRecord);
        const payload = pickPayloadFields(built, reviewStep.changes.map((change) => change.field));
        steps.push(createPairSaveStep({
          key,
          type: 'transport_route',
          action: 'update',
          entityId: normalizeId(reviewStep.entityId),
          expectedUpdatedAt: reviewStep.expectedUpdatedAt,
          payload,
          changes: reviewStep.changes,
          before: freshRecord,
          after: { ...clone(freshRecord), ...payload },
        }));
        return;
      }

      if (reviewStep.type === 'pricing_rule') {
        if (reviewStep.action !== 'update' || !freshRecord) {
          throw savePlanError('transport_pair_pricing_insert_forbidden', 'Stage 2D can update an exact pricing rule only.');
        }
        if (normalizeId(freshRecord.route_id) !== routeId) {
          throw savePlanError('transport_pair_pricing_rule_ownership_changed', 'Pricing rule no longer belongs to the exact route.');
        }
        const approvedFields = [
          ...PRICING_FIELDS.map((descriptor) => descriptor.column),
          ...DERIVED_PRICING_FIELDS.map((descriptor) => descriptor.column),
          ...DEPOSIT_RULE_FIELDS.map((descriptor) => descriptor.column),
        ];
        assertAllowedChanges(reviewStep, approvedFields, 'transport_pair_pricing_payload_field_forbidden');
        assertPreservedPricingFields(reviewStep);
        const draftRecord = { ...clone(freshRecord) };
        reviewStep.changes.forEach((change) => { draftRecord[change.field] = change.after; });
        const built = builders.buildTransportPricingRulePayload(draftRecord, {
          depositBaseFloor: freshRecord.deposit_base_floor,
        });
        const payloadFields = reviewStep.changes.map((change) => change.field);
        if (payloadFields.includes('waiting_fee_per_hour')) payloadFields.push('waiting_fee_per_minute');
        const payload = pickPayloadFields(built, payloadFields);
        const derivedChanges = payloadFields.includes('waiting_fee_per_minute')
          && !(reviewStep.changes || []).some((change) => change.field === 'waiting_fee_per_minute')
          && !valuesEqual(freshRecord.waiting_fee_per_minute, payload.waiting_fee_per_minute, 'number')
          ? [fieldChange({
            entityType: 'pricing_rule',
            entityId: normalizeId(reviewStep.entityId),
            direction,
            field: 'waiting_fee_per_minute',
            type: 'number',
            before: freshRecord.waiting_fee_per_minute,
            after: payload.waiting_fee_per_minute,
          })].filter(Boolean)
          : [];
        steps.push(createPairSaveStep({
          key,
          type: 'pricing_rule',
          action: 'update',
          entityId: normalizeId(reviewStep.entityId),
          expectedUpdatedAt: reviewStep.expectedUpdatedAt,
          payload,
          changes: [...reviewStep.changes, ...derivedChanges],
          before: freshRecord,
          after: { ...clone(freshRecord), ...payload },
        }));
        return;
      }

      if (reviewStep.type === 'deposit_override') {
        if (!['insert', 'update', 'delete'].includes(reviewStep.action)) {
          throw savePlanError('transport_pair_deposit_action_forbidden', 'Unsupported deposit override operation.');
        }
        const approvedFields = DEPOSIT_OVERRIDE_FIELDS.map((descriptor) => descriptor.column);
        assertAllowedChanges(reviewStep, approvedFields, 'transport_pair_deposit_payload_field_forbidden');
        let payload = null;
        if (reviewStep.action !== 'delete') {
          const expected = reviewStep.after || {};
          payload = builders.buildTransportDepositOverridePayload({
            routeId,
            depositEnabled: true,
            depositMode: serviceModeToPricingMode(expected.mode),
            depositValue: expected.amount,
            currency: route?.currency,
            includeChildren: Boolean(freshContext?.serviceDepositDefault?.include_children),
          });
          if (!payload) throw savePlanError('transport_pair_deposit_payload_invalid', 'Deposit override payload is invalid.');
          if (reviewStep.action === 'update') {
            payload = pickPayloadFields(payload, reviewStep.changes.map((change) => change.field));
          }
        }
        if (reviewStep.action !== 'insert' && !freshRecord) {
          throw savePlanError('transport_pair_deposit_exact_id_missing', 'Exact deposit override no longer exists.');
        }
        steps.push(createPairSaveStep({
          key,
          type: 'deposit_override',
          action: reviewStep.action,
          entityId: reviewStep.action === 'insert' ? null : normalizeId(reviewStep.entityId),
          expectedUpdatedAt: reviewStep.action === 'insert' ? null : reviewStep.expectedUpdatedAt,
          expectAbsent: reviewStep.action === 'insert',
          payload,
          changes: reviewStep.changes,
          before: freshRecord,
          after: reviewStep.action === 'delete' ? null : { ...(freshRecord ? clone(freshRecord) : {}), ...payload },
        }));
      }
    });

    const byKey = new Map(steps.map((step) => [step.key, step]));
    ['outbound', 'reverse'].forEach((direction) => {
      const routeStep = byKey.get(`route_${direction}`);
      const pricingStep = byKey.get(`pricing_${direction}`);
      const depositStep = byKey.get(`deposit_${direction}`);
      if (pricingStep && routeStep) pricingStep.dependsOn.push(routeStep.key);
      if (depositStep) {
        if (pricingStep) depositStep.dependsOn.push(pricingStep.key);
        else if (routeStep) depositStep.dependsOn.push(routeStep.key);
      }
    });

    const globalChanges = 0;
    if (globalChanges !== 0) {
      throw savePlanError('transport_pair_global_change_detected', 'Global changes must remain zero.');
    }
    const fingerprint = String(reviewPlan.fingerprint || '');
    return {
      id: String(options.planId || `transport-pair-save-${fingerprint.slice(-8)}`),
      createdAt: String(options.now || freshContext.loadedAt || ''),
      fingerprint,
      globalChanges,
      status: 'pending',
      attempts: 0,
      steps,
      results: {},
      summary: {
        routeUpdates: steps.filter((step) => step.type === 'transport_route').length,
        pricingUpdates: steps.filter((step) => step.type === 'pricing_rule').length,
        depositInserts: steps.filter((step) => step.type === 'deposit_override' && step.action === 'insert').length,
        depositUpdates: steps.filter((step) => step.type === 'deposit_override' && step.action === 'update').length,
        depositDeletes: steps.filter((step) => step.type === 'deposit_override' && step.action === 'delete').length,
        globalChanges,
      },
      preflight: clone(preflight),
      execution: null,
    };
  }

  function saveStepDirection(step) {
    return String(step?.key || '').endsWith('reverse') ? 'reverse' : 'outbound';
  }

  function valueTypeForField(field, expected) {
    const descriptor = [
      ...ROUTE_FIELDS,
      ...PRICING_FIELDS,
      ...DEPOSIT_RULE_FIELDS,
      ...DERIVED_PRICING_FIELDS,
      ...DEPOSIT_OVERRIDE_FIELDS,
      ...SERVICE_DEPOSIT_DEFAULT_FIELDS,
    ].find((entry) => entry.column === field);
    if (descriptor?.type) return descriptor.type;
    if (typeof expected === 'number') return 'number';
    if (typeof expected === 'boolean') return 'boolean';
    return 'text';
  }

  function recordMatchesProjection(record, projection) {
    if (!record || !projection || typeof projection !== 'object') return false;
    return Object.entries(projection).every(([field, expected]) => (
      valuesEqual(record[field], expected, valueTypeForField(field, expected))
    ));
  }

  function retryRecordForStep(freshContext, step) {
    const direction = saveStepDirection(step);
    const route = freshRouteForDirection(freshContext, direction);
    if (step.type === 'transport_route') {
      return normalizeId(route?.id) === normalizeId(step.entityId) ? route : null;
    }
    if (step.type === 'pricing_rule') {
      return (Array.isArray(freshContext?.pricingRules) ? freshContext.pricingRules : [])
        .find((rule) => normalizeId(rule?.id) === normalizeId(step.entityId)) || null;
    }
    if (step.type === 'deposit_override') {
      const exactId = normalizeId(step.result?.id || step.entityId);
      if (!exactId) return null;
      return (Array.isArray(freshContext?.depositOverrides) ? freshContext.depositOverrides : [])
        .find((row) => normalizeId(row?.id) === exactId) || null;
    }
    return null;
  }

  function retryDifference(config = {}) {
    return {
      code: String(config.code || 'retry_stale_state'),
      stepKey: config.stepKey || null,
      entityType: config.entityType || 'context',
      entityId: config.entityId || null,
      direction: config.direction || null,
      field: config.field || 'record',
      before: clone(config.before ?? null),
      after: clone(config.after ?? null),
    };
  }

  function addRetryDifference(differences, config) {
    differences.push(retryDifference(config));
  }

  function archiveRetryError(step) {
    if (!step?.error) return;
    const history = Array.isArray(step.previousErrors) ? step.previousErrors : [];
    step.previousErrors = [...history, clone(step.error)];
  }

  function markStepReconciled(step, record, checkedAt) {
    archiveRetryError(step);
    const id = normalizeId(record?.id || step.result?.id || step.entityId || step.before?.id);
    step.status = 'success';
    step.reconciled = true;
    step.reconciledAt = String(checkedAt || '');
    step.skipReason = null;
    step.error = null;
    step.result = {
      id,
      data: record ? clone(record) : { id },
      reconciled: true,
      reused: false,
    };
    return step;
  }

  function routeIdForRetryDirection(reviewPlan, direction) {
    return normalizeId(reviewPlan?.preflight?.directions?.[direction]?.routeId
      || reviewPlan?.preflight?.routes?.[direction]?.id);
  }

  function expectedRecordForUnchangedContext(reviewPlan, direction, entityType) {
    if (entityType === 'transport_route') return reviewPlan?.preflight?.routes?.[direction] || null;
    const expected = reviewPlan?.preflight?.directions?.[direction] || {};
    if (entityType === 'pricing_rule') {
      const ruleId = normalizeId(expected.selectedRuleId);
      if (!ruleId) return null;
      const reviewStep = reviewStepByKey(reviewPlan, `pricing_${direction}`);
      return reviewStep?.before || null;
    }
    if (entityType === 'deposit_override') {
      const overrideId = normalizeId(expected.overrideId);
      if (!overrideId) return null;
      const reviewStep = reviewStepByKey(reviewPlan, `deposit_${direction}`);
      return reviewStep?.before || null;
    }
    return null;
  }

  function assertFreshRecordStillBefore(step, record, differences) {
    const direction = saveStepDirection(step);
    if (!record) {
      addRetryDifference(differences, {
        code: 'retry_record_missing',
        stepKey: step.key,
        entityType: step.type,
        entityId: step.entityId,
        direction,
        field: 'record_presence',
        before: 'present',
        after: 'missing',
      });
      return false;
    }
    if (!recordMatchesProjection(record, step.before || {})) {
      addRetryDifference(differences, {
        code: 'retry_failed_step_state_changed',
        stepKey: step.key,
        entityType: step.type,
        entityId: step.entityId,
        direction,
        field: 'record',
        before: step.before,
        after: record,
      });
      return false;
    }
    return true;
  }

  function verifySuccessfulRetryStep(step, freshContext, differences) {
    const direction = saveStepDirection(step);
    const route = freshRouteForDirection(freshContext, direction);
    const current = retryRecordForStep(freshContext, step);
    if (step.type === 'deposit_override' && step.action === 'delete') {
      const routeOverrides = overridesForRoute(freshContext, normalizeId(route?.id));
      if (current || routeOverrides.length) {
        addRetryDifference(differences, {
          code: 'successful_deposit_delete_changed',
          stepKey: step.key,
          entityType: step.type,
          entityId: step.entityId,
          direction,
          field: 'record_presence',
          before: 'deleted',
          after: routeOverrides.map((row) => normalizeId(row?.id)),
        });
      }
      return;
    }
    const expected = step.result?.data && typeof step.result.data === 'object'
      ? step.result.data
      : step.after;
    if (!current || !recordMatchesProjection(current, expected || {})) {
      addRetryDifference(differences, {
        code: 'successful_step_changed',
        stepKey: step.key,
        entityType: step.type,
        entityId: step.result?.id || step.entityId,
        direction,
        field: 'saved_result',
        before: expected,
        after: current,
      });
    }
  }

  function reconcileFailedRetryStep(step, freshContext, differences, checkedAt) {
    const direction = saveStepDirection(step);
    const route = freshRouteForDirection(freshContext, direction);
    const routeId = normalizeId(route?.id);
    const current = retryRecordForStep(freshContext, step);
    if (step.type === 'transport_route') {
      if (current && recordMatchesProjection(current, step.payload || {})) {
        markStepReconciled(step, current, checkedAt);
        return true;
      }
      return assertFreshRecordStillBefore(step, current, differences);
    }
    if (step.type === 'pricing_rule') {
      if (current && normalizeId(current.route_id) !== routeId) {
        addRetryDifference(differences, {
          code: 'retry_pricing_rule_ownership_changed',
          stepKey: step.key,
          entityType: step.type,
          entityId: step.entityId,
          direction,
          field: 'route_id',
          before: routeId,
          after: current.route_id,
        });
        return false;
      }
      if (current && recordMatchesProjection(current, step.payload || {})) {
        const preserved = PRICING_PRESERVED_FIELDS.reduce((result, field) => {
          result[field] = step.before?.[field];
          return result;
        }, {});
        if (!recordMatchesProjection(current, preserved)) {
          addRetryDifference(differences, {
            code: 'retry_pricing_preserved_fields_changed',
            stepKey: step.key,
            entityType: step.type,
            entityId: step.entityId,
            direction,
            field: 'validity_priority_active',
            before: preserved,
            after: current,
          });
          return false;
        }
        markStepReconciled(step, current, checkedAt);
        return true;
      }
      return assertFreshRecordStillBefore(step, current, differences);
    }
    if (step.type !== 'deposit_override') return false;
    const routeOverrides = overridesForRoute(freshContext, routeId);
    if (step.action === 'insert') {
      if (!routeOverrides.length) return true;
      if (routeOverrides.length === 1 && recordMatchesProjection(routeOverrides[0], step.payload || {})) {
        markStepReconciled(step, routeOverrides[0], checkedAt);
        return true;
      }
      addRetryDifference(differences, {
        code: 'retry_deposit_insert_conflict',
        stepKey: step.key,
        entityType: step.type,
        entityId: routeOverrides[0]?.id || null,
        direction,
        field: 'resource_id',
        before: 'absent',
        after: routeOverrides,
      });
      return false;
    }
    if (step.action === 'update') {
      if (current && recordMatchesProjection(current, step.payload || {})) {
        markStepReconciled(step, current, checkedAt);
        return true;
      }
      return assertFreshRecordStillBefore(step, current, differences);
    }
    if (step.action === 'delete') {
      if (!current) {
        if (normalizeId(step.before?.id) !== normalizeId(step.entityId)) {
          addRetryDifference(differences, {
            code: 'retry_deposit_delete_identity_missing',
            stepKey: step.key,
            entityType: step.type,
            entityId: step.entityId,
            direction,
            field: 'id',
            before: step.entityId,
            after: null,
          });
          return false;
        }
        if (routeOverrides.length) {
          addRetryDifference(differences, {
            code: 'retry_deposit_delete_conflict',
            stepKey: step.key,
            entityType: step.type,
            entityId: routeOverrides[0]?.id || null,
            direction,
            field: 'replacement_override',
            before: null,
            after: routeOverrides,
          });
          return false;
        }
        markStepReconciled(step, { id: step.entityId }, checkedAt);
        return true;
      }
      return assertFreshRecordStillBefore(step, current, differences);
    }
    return false;
  }

  function precheckTransportPairPricingRetry(savePlan, draft, reviewPlan, freshContext = {}) {
    const plan = clone(savePlan || null);
    const differences = [];
    const checkedAt = String(freshContext?.loadedAt || '');
    if (!plan || !Array.isArray(plan.steps)) {
      addRetryDifference(differences, {
        code: 'retry_plan_missing',
        entityType: 'plan',
        field: 'steps',
        before: 'preserved plan',
        after: null,
      });
      return { ok: false, stale: true, staleAfterPartial: false, differences, plan: null };
    }
    const hadSuccess = plan.steps.some((step) => step.status === 'success');
    const expectedFingerprint = String(plan.fingerprint || reviewPlan?.fingerprint || '');
    const currentFingerprint = fingerprintTransportPairPricingDraft(draft);
    if (
      !expectedFingerprint
      || expectedFingerprint !== String(reviewPlan?.fingerprint || '')
      || expectedFingerprint !== currentFingerprint
      || draft?.review?.isCurrent !== true
    ) {
      addRetryDifference(differences, {
        code: 'retry_draft_fingerprint_changed',
        entityType: 'draft',
        field: 'fingerprint',
        before: expectedFingerprint || null,
        after: currentFingerprint,
      });
    }
    if (Number(plan.globalChanges) !== 0 || Number(reviewPlan?.globalChanges) !== 0) {
      addRetryDifference(differences, {
        code: 'retry_global_changes_not_zero',
        entityType: 'global',
        field: 'globalChanges',
        before: 0,
        after: Number(plan.globalChanges || reviewPlan?.globalChanges || 0),
      });
    }

    const plannedRouteIds = plan.steps
      .filter((step) => step.type === 'transport_route')
      .map((step) => normalizeId(step.entityId))
      .filter(Boolean);
    if (new Set(plannedRouteIds).size > 2) {
      addRetryDifference(differences, {
        code: 'retry_route_scope_exceeded',
        entityType: 'route',
        field: 'route_ids',
        before: 'maximum 2',
        after: plannedRouteIds,
      });
    }

    const outbound = freshContext?.outboundRoute || null;
    const reverse = freshContext?.reverseRoute || null;
    const reverseLookup = Object.prototype.hasOwnProperty.call(freshContext || {}, 'reverseLookupRoute')
      ? freshContext.reverseLookupRoute
      : reverse;
    ['outbound', 'reverse'].forEach((direction) => {
      const expectedRouteId = routeIdForRetryDirection(reviewPlan, direction);
      const freshRoute = freshRouteForDirection(freshContext, direction);
      if (expectedRouteId !== normalizeId(freshRoute?.id)) {
        addRetryDifference(differences, {
          code: direction === 'reverse' ? 'retry_reverse_route_changed' : 'retry_outbound_route_changed',
          entityType: 'transport_route',
          entityId: expectedRouteId || null,
          direction,
          field: 'id',
          before: expectedRouteId || null,
          after: normalizeId(freshRoute?.id) || null,
        });
      }
    });
    const expectedReverseId = routeIdForRetryDirection(reviewPlan, 'reverse');
    if (expectedReverseId !== normalizeId(reverseLookup?.id)) {
      addRetryDifference(differences, {
        code: 'retry_reverse_lookup_changed',
        entityType: 'transport_route',
        entityId: expectedReverseId || null,
        direction: 'reverse',
        field: 'reverse_route_id',
        before: expectedReverseId || null,
        after: normalizeId(reverseLookup?.id) || null,
      });
    }
    if (outbound && reverse && (
      normalizeId(reverse.origin_location_id) !== normalizeId(outbound.destination_location_id)
      || normalizeId(reverse.destination_location_id) !== normalizeId(outbound.origin_location_id)
    )) {
      addRetryDifference(differences, {
        code: 'retry_reverse_relation_changed',
        entityType: 'transport_route',
        entityId: normalizeId(reverse.id),
        direction: 'reverse',
        field: 'origin_destination',
        before: [outbound.destination_location_id, outbound.origin_location_id],
        after: [reverse.origin_location_id, reverse.destination_location_id],
      });
    }

    comparePreflightRecord(differences, {
      expected: reviewPlan?.preflight?.serviceDepositDefault || null,
      fresh: freshContext?.serviceDepositDefault || null,
      fields: SERVICE_DEPOSIT_DEFAULT_FIELDS.map((descriptor) => ({
        ...descriptor,
        code: 'retry_global_deposit_default_changed',
      })),
      entityType: 'service_deposit_default',
      direction: null,
      presenceCode: 'retry_global_deposit_default_changed',
      changedCode: 'retry_global_deposit_default_changed',
    });

    ['outbound', 'reverse'].forEach((direction) => {
      const expected = reviewPlan?.preflight?.directions?.[direction] || null;
      if (!expected) return;
      const route = freshRouteForDirection(freshContext, direction);
      const routeId = normalizeId(route?.id);
      const freshRules = rulesForRoute(freshContext, routeId);
      if (Number(expected.ruleCount || 0) !== freshRules.length) {
        addRetryDifference(differences, {
          code: 'retry_pricing_rule_count_changed',
          entityType: 'pricing_rule',
          entityId: routeId,
          direction,
          field: 'rule_count',
          before: Number(expected.ruleCount || 0),
          after: freshRules.length,
        });
      }
      const selectedRuleId = normalizeId(expected.selectedRuleId);
      if (selectedRuleId) {
        const exact = (Array.isArray(freshContext?.pricingRules) ? freshContext.pricingRules : [])
          .find((rule) => normalizeId(rule?.id) === selectedRuleId) || null;
        if (!exact || normalizeId(exact.route_id) !== routeId) {
          addRetryDifference(differences, {
            code: 'retry_pricing_rule_ownership_changed',
            entityType: 'pricing_rule',
            entityId: selectedRuleId,
            direction,
            field: 'route_id',
            before: routeId,
            after: exact?.route_id || null,
          });
        }
      }
    });

    if (!differences.length) {
      plan.steps.forEach((step) => {
        if (step.status === 'success') {
          verifySuccessfulRetryStep(step, freshContext, differences);
          return;
        }
        const retryable = step.status === 'error'
          || (step.status === 'skipped' && step.skipReason === 'dependency');
        if (!retryable) return;
        const wasError = step.status === 'error';
        if (wasError) {
          reconcileFailedRetryStep(step, freshContext, differences, checkedAt);
        } else if (step.type === 'deposit_override' && step.action === 'insert') {
          const direction = saveStepDirection(step);
          const route = freshRouteForDirection(freshContext, direction);
          const rows = overridesForRoute(freshContext, normalizeId(route?.id));
          if (rows.length) {
            addRetryDifference(differences, {
              code: 'retry_dependency_skipped_deposit_appeared',
              stepKey: step.key,
              entityType: step.type,
              entityId: rows[0]?.id || null,
              direction,
              field: 'resource_id',
              before: 'absent',
              after: rows,
            });
          }
        } else {
          assertFreshRecordStillBefore(step, retryRecordForStep(freshContext, step), differences);
        }
      });
    }

    if (!differences.length) {
      ['outbound', 'reverse'].forEach((direction) => {
        const routeStep = plan.steps.find((step) => step.key === `route_${direction}`);
        const pricingStep = plan.steps.find((step) => step.key === `pricing_${direction}`);
        const depositStep = plan.steps.find((step) => step.key === `deposit_${direction}`);
        const route = freshRouteForDirection(freshContext, direction);
        const expectedDirection = reviewPlan?.preflight?.directions?.[direction] || {};
        if (!routeStep) {
          const expected = expectedRecordForUnchangedContext(reviewPlan, direction, 'transport_route');
          if (expected && !recordMatchesProjection(route, expected)) {
            addRetryDifference(differences, {
              code: 'retry_unchanged_route_changed', entityType: 'transport_route', entityId: route?.id,
              direction, field: 'record', before: expected, after: route,
            });
          }
        }
        if (!pricingStep && normalizeId(expectedDirection.selectedRuleId)) {
          const current = rulesForRoute(freshContext, normalizeId(route?.id))
            .find((rule) => normalizeId(rule?.id) === normalizeId(expectedDirection.selectedRuleId)) || null;
          if (!current || String(current.updated_at || '') !== String(expectedDirection.selectedRuleUpdatedAt || '')) {
            addRetryDifference(differences, {
              code: 'retry_unchanged_pricing_rule_changed', entityType: 'pricing_rule',
              entityId: expectedDirection.selectedRuleId, direction, field: 'updated_at',
              before: expectedDirection.selectedRuleUpdatedAt || null, after: current?.updated_at || null,
            });
          }
        }
        const currentOverrides = overridesForRoute(freshContext, normalizeId(route?.id));
        if (!depositStep) {
          const expectedId = normalizeId(expectedDirection.overrideId);
          const current = expectedId
            ? currentOverrides.find((row) => normalizeId(row?.id) === expectedId) || null
            : null;
          if (
            currentOverrides.length !== Number(expectedDirection.overrideCount || 0)
            || (expectedId && (!current || String(current.updated_at || '') !== String(expectedDirection.overrideUpdatedAt || '')))
          ) {
            addRetryDifference(differences, {
              code: 'retry_unchanged_deposit_override_changed', entityType: 'deposit_override',
              entityId: expectedId || null, direction, field: 'override_state',
              before: { count: Number(expectedDirection.overrideCount || 0), id: expectedId || null, updatedAt: expectedDirection.overrideUpdatedAt || null },
              after: currentOverrides,
            });
          }
        }
      });
    }

    const stale = differences.length > 0;
    const retryableKeys = plan.steps.filter((step) => (
      step.status === 'error' || (step.status === 'skipped' && step.skipReason === 'dependency')
    )).map((step) => step.key);
    const reconciledKeys = plan.steps.filter((step) => step.status === 'success' && step.reconciled === true)
      .map((step) => step.key);
    if (!plan.results || typeof plan.results !== 'object') plan.results = {};
    plan.steps.forEach((step) => {
      if (step.status === 'success' && step.result) plan.results[step.key] = clone(step.result);
    });
    if (stale) {
      plan.status = hadSuccess ? 'stale_after_partial' : 'stale';
      plan.retryPrecheck = { ok: false, checkedAt, differences: clone(differences) };
    } else {
      plan.steps.forEach((step) => {
        const retryable = step.status === 'error'
          || (step.status === 'skipped' && step.skipReason === 'dependency');
        if (!retryable) return;
        archiveRetryError(step);
        const current = retryRecordForStep(freshContext, step);
        if (['update', 'delete'].includes(step.action) && current?.updated_at) {
          step.expectedUpdatedAt = String(current.updated_at);
        }
      });
      if (!retryableKeys.length) plan.status = 'success';
      plan.retryPrecheck = {
        ok: true,
        checkedAt,
        retryableKeys: clone(retryableKeys),
        reconciledKeys: clone(reconciledKeys),
      };
    }
    return {
      ok: !stale,
      stale,
      staleAfterPartial: stale && hadSuccess,
      differences,
      plan,
      retryableKeys,
      reconciledKeys,
      checkedAt,
    };
  }

  function abandonTransportPairPricingSavePlan(savePlan, options = {}) {
    const plan = clone(savePlan || null);
    if (!plan || typeof plan !== 'object') return null;
    plan.status = 'abandoned';
    plan.execution = {
      ...(plan.execution || {}),
      abandonedAt: String(options.abandonedAt || ''),
      abandonedReason: String(options.reason || 'manual_refresh'),
      retryable: [],
    };
    return plan;
  }

  function isTransportPairPricingRetryAvailable(savePlan, draft, reviewPlan) {
    if (!savePlan || !draft || !reviewPlan) return false;
    if (['success', 'stale', 'stale_after_partial', 'abandoned'].includes(String(savePlan.status || ''))) return false;
    if (Number(savePlan.globalChanges) !== 0 || !isTransportPairPricingReviewCurrent(draft, reviewPlan.fingerprint)) return false;
    const hasSuccess = (savePlan.steps || []).some((step) => step.status === 'success');
    const hasRetryable = (savePlan.steps || []).some((step) => (
      step.status === 'error' || (step.status === 'skipped' && step.skipReason === 'dependency')
    ));
    return hasSuccess && hasRetryable && Boolean(draft.snapshot);
  }

  function verifyTransportPairPricingSaveResult(savePlan, freshContext = {}) {
    const differences = [];
    (Array.isArray(savePlan?.steps) ? savePlan.steps : []).forEach((step) => {
      if (step.status !== 'success') return;
      const direction = String(step.key || '').endsWith('reverse') ? 'reverse' : 'outbound';
      const route = freshRouteForDirection(freshContext, direction);
      let record = null;
      if (step.type === 'transport_route') record = route;
      if (step.type === 'pricing_rule') {
        record = rulesForRoute(freshContext, normalizeId(route?.id))
          .find((row) => normalizeId(row?.id) === normalizeId(step.entityId)) || null;
      }
      if (step.type === 'deposit_override') {
        const resultId = normalizeId(step.result?.id || step.entityId);
        record = overridesForRoute(freshContext, normalizeId(route?.id))
          .find((row) => normalizeId(row?.id) === resultId) || null;
      }
      if (step.action === 'delete') {
        const routeOverrides = step.type === 'deposit_override'
          ? overridesForRoute(freshContext, normalizeId(route?.id))
          : [];
        if (record || routeOverrides.length) {
          differences.push({
            code: 'deleted_record_still_present',
            stepKey: step.key,
            entityId: step.entityId,
            conflictingIds: routeOverrides.map((row) => normalizeId(row?.id)),
          });
        }
        return;
      }
      if (!record) {
        differences.push({ code: 'saved_record_missing', stepKey: step.key, entityId: step.result?.id || step.entityId });
        return;
      }
      Object.entries(step.payload || {}).forEach(([field, expected]) => {
        if (!valuesEqual(record[field], expected, typeof expected === 'number' ? 'number' : (typeof expected === 'boolean' ? 'boolean' : 'text'))) {
          differences.push({
            code: 'saved_value_mismatch',
            stepKey: step.key,
            entityId: normalizeId(record.id),
            field,
            before: expected,
            after: record[field],
          });
        }
      });
    });
    return { ok: differences.length === 0, differences };
  }

  const api = Object.freeze({
    ALLOWED_DEPOSIT_MODES,
    DEPOSIT_RULE_FIELDS,
    PRICING_FIELDS,
    ROUTE_FIELDS,
    buildTransportPairPricingDiff,
    buildTransportPairPricingReviewPlan,
    buildTransportPairPricingSavePlan,
    abandonTransportPairPricingSavePlan,
    createTransportPairPricingDraft,
    fingerprintTransportPairPricingDraft,
    getTransportPairDepositAccess,
    hydrateTransportPairSharedValues,
    isTransportPairPricingReviewCurrent,
    isTransportPairPricingRetryAvailable,
    preflightTransportPairPricingReview,
    precheckTransportPairPricingRetry,
    validateTransportPairPricingDraft,
    verifyTransportPairPricingSaveResult,
  });

  Object.defineProperty(root, 'TransportPairPricingCore', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
