(function registerTransportAdminCore(root) {
  'use strict';

  const ROUTE_DEFAULTS = Object.freeze({
    dayPrice: 0,
    nightPrice: 0,
    currency: 'EUR',
    includedPassengers: 2,
    includedBags: 2,
    includedLargeBags: 0,
    maxPassengers: 8,
    maxBags: 8,
    roundTripMultiplier: 2,
    sortOrder: 0,
    isActive: true,
  });

  const PRICING_DEFAULTS = Object.freeze({
    nightStart: '22:00',
    nightEnd: '06:00',
    depositMode: 'percent_total',
  });

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function normalizeNumericInput(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    return value;
  }

  function numberFromDraft(value, fallback = 0) {
    const normalized = normalizeNumericInput(value);
    if (normalized === null) return Number(fallback);
    return Number(normalized);
  }

  function normalizeTripMode(value) {
    return String(value || '').trim().toLowerCase() === 'round_trip' ? 'round_trip' : 'one_way';
  }

  function normalizeCurrency(value) {
    return String(value || ROUTE_DEFAULTS.currency).trim().toUpperCase() || ROUTE_DEFAULTS.currency;
  }

  function composeRouteDraft(draft) {
    const source = draft && typeof draft === 'object' ? draft : {};
    if (!source.route || typeof source.route !== 'object') return source;

    const legacy = source.legacy && typeof source.legacy === 'object' ? source.legacy : {};
    const composed = {
      ...source.route,
      ...(source.price && typeof source.price === 'object' ? source.price : {}),
      ...(source.capacity && typeof source.capacity === 'object' ? source.capacity : {}),
    };

    if (!hasOwn(composed, 'tripMode') && hasOwn(legacy, 'allowsRoundTrip')) {
      composed.tripMode = legacy.allowsRoundTrip ? 'round_trip' : 'one_way';
    }
    if (!hasOwn(composed, 'roundTripMultiplier') && hasOwn(legacy, 'roundTripMultiplier')) {
      composed.roundTripMultiplier = legacy.roundTripMultiplier;
    }

    return composed;
  }

  function normalizeRouteDraft(draft) {
    const source = composeRouteDraft(draft);
    const tripMode = normalizeTripMode(
      hasOwn(source, 'tripMode')
        ? source.tripMode
        : (source.allowsRoundTrip === true ? 'round_trip' : 'one_way'),
    );

    return {
      originLocationId: String(source.originLocationId || source.origin_location_id || '').trim(),
      destinationLocationId: String(source.destinationLocationId || source.destination_location_id || '').trim(),
      dayPrice: numberFromDraft(source.dayPrice ?? source.day_price, ROUTE_DEFAULTS.dayPrice),
      nightPrice: numberFromDraft(source.nightPrice ?? source.night_price, ROUTE_DEFAULTS.nightPrice),
      currency: normalizeCurrency(source.currency),
      includedPassengers: numberFromDraft(
        source.includedPassengers ?? source.included_passengers,
        ROUTE_DEFAULTS.includedPassengers,
      ),
      includedBags: numberFromDraft(source.includedBags ?? source.included_bags, ROUTE_DEFAULTS.includedBags),
      includedLargeBags: numberFromDraft(
        source.includedLargeBags ?? source.included_large_bags,
        ROUTE_DEFAULTS.includedLargeBags,
      ),
      maxPassengers: numberFromDraft(source.maxPassengers ?? source.max_passengers, ROUTE_DEFAULTS.maxPassengers),
      maxBags: numberFromDraft(source.maxBags ?? source.max_bags, ROUTE_DEFAULTS.maxBags),
      tripMode,
      roundTripMultiplier: numberFromDraft(
        source.roundTripMultiplier ?? source.round_trip_multiplier,
        ROUTE_DEFAULTS.roundTripMultiplier,
      ),
      sortOrder: numberFromDraft(source.sortOrder ?? source.sort_order, ROUTE_DEFAULTS.sortOrder),
      isActive: hasOwn(source, 'isActive')
        ? Boolean(source.isActive)
        : (hasOwn(source, 'is_active') ? Boolean(source.is_active) : ROUTE_DEFAULTS.isActive),
    };
  }

  function buildTransportRoutePayload(draft) {
    const route = normalizeRouteDraft(draft);
    const allowsRoundTrip = route.tripMode === 'round_trip';
    const roundTripMultiplier = allowsRoundTrip ? route.roundTripMultiplier : ROUTE_DEFAULTS.roundTripMultiplier;

    return {
      origin_location_id: route.originLocationId,
      destination_location_id: route.destinationLocationId,
      day_price: route.dayPrice,
      night_price: route.nightPrice,
      currency: route.currency,
      included_passengers: Number.isFinite(route.includedPassengers)
        ? route.includedPassengers
        : ROUTE_DEFAULTS.includedPassengers,
      included_bags: Number.isFinite(route.includedBags) ? route.includedBags : ROUTE_DEFAULTS.includedBags,
      included_large_bags: Number.isFinite(route.includedLargeBags)
        ? route.includedLargeBags
        : ROUTE_DEFAULTS.includedLargeBags,
      max_passengers: Number.isFinite(route.maxPassengers) ? route.maxPassengers : ROUTE_DEFAULTS.maxPassengers,
      max_bags: Number.isFinite(route.maxBags) ? route.maxBags : ROUTE_DEFAULTS.maxBags,
      allows_round_trip: allowsRoundTrip,
      round_trip_multiplier: Number.isFinite(roundTripMultiplier)
        ? roundTripMultiplier
        : ROUTE_DEFAULTS.roundTripMultiplier,
      sort_order: Number.isFinite(route.sortOrder) ? route.sortOrder : ROUTE_DEFAULTS.sortOrder,
      is_active: route.isActive,
    };
  }

  function normalizePricingDraft(draft) {
    const source = draft && typeof draft === 'object' ? draft : {};
    const deposit = source.deposit && typeof source.deposit === 'object' ? source.deposit : {};

    return {
      routeId: String(source.routeId || source.route_id || '').trim(),
      extraPassengerFee: Number(source.extraPassengerFee ?? source.extra_passenger_fee ?? 0),
      extraBagFee: Number(source.extraBagFee ?? source.extra_bag_fee ?? 0),
      oversizeBagFee: Number(source.oversizeBagFee ?? source.oversize_bag_fee ?? 0),
      childSeatFee: Number(source.childSeatFee ?? source.child_seat_fee ?? 0),
      boosterSeatFee: Number(source.boosterSeatFee ?? source.booster_seat_fee ?? 0),
      waitingIncludedMinutes: Number(source.waitingIncludedMinutes ?? source.waiting_included_minutes ?? 0),
      waitingFeePerHour: Number(source.waitingFeePerHour ?? source.waiting_fee_per_hour ?? 0),
      nightStart: String(source.nightStart || source.night_start || PRICING_DEFAULTS.nightStart).slice(0, 5),
      nightEnd: String(source.nightEnd || source.night_end || PRICING_DEFAULTS.nightEnd).slice(0, 5),
      validFrom: String(source.validFrom ?? source.valid_from ?? '').trim() || null,
      validTo: String(source.validTo ?? source.valid_to ?? '').trim() || null,
      priority: Number(source.priority ?? 0),
      isActive: hasOwn(source, 'isActive')
        ? Boolean(source.isActive)
        : (hasOwn(source, 'is_active') ? Boolean(source.is_active) : true),
      depositEnabled: hasOwn(source, 'depositEnabled')
        ? Boolean(source.depositEnabled)
        : Boolean(deposit.enabled ?? source.deposit_enabled),
      depositMode: String(
        source.depositMode || deposit.mode || source.deposit_mode || PRICING_DEFAULTS.depositMode,
      ).trim().toLowerCase(),
      depositValue: Number(source.depositValue ?? deposit.value ?? source.deposit_value ?? 0),
    };
  }

  function buildTransportPricingRulePayload(draft, options = {}) {
    const pricing = normalizePricingDraft(draft);
    const baseFloorRaw = Number(options.depositBaseFloor ?? draft?.depositBaseFloor ?? draft?.deposit_base_floor ?? 0);
    const depositBaseFloor = Number.isFinite(baseFloorRaw) ? Math.max(0, baseFloorRaw) : 0;
    const waitingFeePerMinute = Number.isFinite(pricing.waitingFeePerHour) && pricing.waitingFeePerHour >= 0
      ? Math.round((pricing.waitingFeePerHour / 60) * 10000) / 10000
      : 0;

    return {
      route_id: pricing.routeId,
      extra_passenger_fee: pricing.extraPassengerFee,
      extra_bag_fee: pricing.extraBagFee,
      oversize_bag_fee: pricing.oversizeBagFee,
      child_seat_fee: pricing.childSeatFee,
      booster_seat_fee: pricing.boosterSeatFee,
      waiting_included_minutes: pricing.waitingIncludedMinutes,
      waiting_fee_per_hour: pricing.waitingFeePerHour,
      waiting_fee_per_minute: waitingFeePerMinute,
      deposit_enabled: pricing.depositEnabled,
      deposit_mode: pricing.depositMode,
      deposit_value: pricing.depositEnabled ? pricing.depositValue : 0,
      deposit_base_floor: depositBaseFloor,
      night_start: pricing.nightStart,
      night_end: pricing.nightEnd,
      valid_from: pricing.validFrom,
      valid_to: pricing.validTo,
      priority: pricing.priority,
      is_active: pricing.isActive,
    };
  }

  function mapDepositModeToServiceMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'fixed_amount') return 'flat';
    if (normalized === 'per_person') return 'per_person';
    return 'percent_total';
  }

  function buildTransportDepositOverridePayload(options = {}) {
    const routeId = String(options.routeId || options.resource_id || '').trim();
    const enabled = Boolean(options.depositEnabled ?? options.enabled);
    const amount = Number(options.depositValue ?? options.amount ?? 0);
    if (!routeId || !enabled || !(amount > 0)) return null;

    return {
      resource_type: 'transport',
      resource_id: routeId,
      mode: mapDepositModeToServiceMode(options.depositMode ?? options.mode),
      amount,
      currency: normalizeCurrency(options.currency || options.routeCurrency || options.defaultCurrency),
      include_children: Boolean(options.includeChildren ?? options.include_children),
      enabled: true,
    };
  }

  function buildReverseRoutePayload(routePayload, options = {}) {
    const payload = routePayload && typeof routePayload === 'object' ? routePayload : {};
    const reverse = {
      ...payload,
      origin_location_id: String(payload.destination_location_id || '').trim(),
      destination_location_id: String(payload.origin_location_id || '').trim(),
    };

    if (hasOwn(options, 'dayPrice') || hasOwn(options, 'day_price')) {
      reverse.day_price = numberFromDraft(options.dayPrice ?? options.day_price, reverse.day_price);
    }
    if (hasOwn(options, 'nightPrice') || hasOwn(options, 'night_price')) {
      reverse.night_price = numberFromDraft(options.nightPrice ?? options.night_price, reverse.night_price);
    }

    return reverse;
  }

  function validationIssue(code, field, message, step) {
    return { code, field, message, step };
  }

  function findLocation(context, id) {
    const key = String(id || '').trim();
    if (!key) return null;
    if (context?.locationById instanceof Map) return context.locationById.get(key) || null;
    if (context?.locationById && typeof context.locationById === 'object') return context.locationById[key] || null;
    if (Array.isArray(context?.locations)) {
      return context.locations.find((row) => String(row?.id || '').trim() === key) || null;
    }
    return null;
  }

  function hasLocationCatalog(context) {
    return context?.locationById instanceof Map
      || Boolean(context?.locationById && typeof context.locationById === 'object')
      || Array.isArray(context?.locations);
  }

  function hasRouteSection(draft) {
    if (draft?.route && typeof draft.route === 'object') return true;
    const source = draft && typeof draft === 'object' ? draft : {};
    return [
      'originLocationId',
      'destinationLocationId',
      'origin_location_id',
      'destination_location_id',
      'dayPrice',
      'day_price',
    ].some((key) => hasOwn(source, key));
  }

  function validateTransportRouteDraft(draft, context = {}, options = {}) {
    const source = draft && typeof draft === 'object' ? draft : {};
    const profile = options.profile === 'wizard' ? 'wizard' : 'legacy';
    const errors = [];
    const warnings = [];
    const routePresent = hasRouteSection(source);
    const pricingPresent = Boolean(source.pricing && typeof source.pricing === 'object');
    const route = routePresent ? normalizeRouteDraft(source) : null;
    const pricing = pricingPresent ? normalizePricingDraft(source.pricing) : null;

    if (route) {
      if (!route.originLocationId || !route.destinationLocationId) {
        errors.push(validationIssue(
          'route_endpoints_required',
          'route',
          'Origin and destination are required',
          'route',
        ));
      } else if (route.originLocationId === route.destinationLocationId) {
        errors.push(validationIssue(
          'route_endpoints_equal',
          'destinationLocationId',
          'Origin and destination cannot be the same',
          'route',
        ));
      }

      if (!(route.dayPrice >= 0) || !(route.nightPrice >= 0)) {
        errors.push(validationIssue(
          'route_prices_nonnegative',
          'price',
          'Day and night prices must be >= 0',
          'price',
        ));
      } else if (profile === 'wizard' && (!(route.dayPrice > 0) || !(route.nightPrice > 0))) {
        errors.push(validationIssue(
          'route_prices_positive',
          'price',
          'Day and night prices must be greater than 0',
          'price',
        ));
      }

      if (!Number.isFinite(route.includedPassengers) || route.includedPassengers < 1) {
        errors.push(validationIssue(
          'included_passengers_invalid',
          'includedPassengers',
          'Included passengers must be at least 1',
          'capacity',
        ));
      }
      if (!Number.isFinite(route.includedBags) || route.includedBags < 0) {
        errors.push(validationIssue(
          'included_bags_invalid',
          'includedBags',
          'Included small backpacks must be >= 0',
          'capacity',
        ));
      }
      if (!Number.isFinite(route.includedLargeBags) || route.includedLargeBags < 0) {
        errors.push(validationIssue(
          'included_large_bags_invalid',
          'includedLargeBags',
          'Included large bags (15kg+) must be >= 0',
          'capacity',
        ));
      }
      if (!Number.isFinite(route.maxPassengers) || route.maxPassengers < route.includedPassengers) {
        errors.push(validationIssue(
          'max_passengers_invalid',
          'maxPassengers',
          'Max passengers must be greater than or equal to included passengers',
          'capacity',
        ));
      }
      if (!Number.isFinite(route.maxBags) || route.maxBags < (route.includedBags + route.includedLargeBags)) {
        errors.push(validationIssue(
          'max_bags_invalid',
          'maxBags',
          'Max total luggage must be greater than or equal to included backpacks + included large bags',
          'capacity',
        ));
      }
      if (
        route.tripMode === 'round_trip'
        && (!Number.isFinite(route.roundTripMultiplier)
          || route.roundTripMultiplier < 1
          || route.roundTripMultiplier > 5)
      ) {
        errors.push(validationIssue(
          'round_trip_multiplier_invalid',
          'roundTripMultiplier',
          'Round-trip multiplier must be between 1 and 5',
          'direction',
        ));
      }

      if (profile === 'wizard' && route.originLocationId && route.destinationLocationId && hasLocationCatalog(context)) {
        const origin = findLocation(context, route.originLocationId);
        const destination = findLocation(context, route.destinationLocationId);
        if (!origin) {
          errors.push(validationIssue('origin_location_missing', 'originLocationId', 'Origin location is unavailable', 'route'));
        } else if (origin.is_active === false) {
          errors.push(validationIssue('origin_location_inactive', 'originLocationId', 'Origin location must be active', 'route'));
        }
        if (!destination) {
          errors.push(validationIssue(
            'destination_location_missing',
            'destinationLocationId',
            'Destination location is unavailable',
            'route',
          ));
        } else if (destination.is_active === false) {
          errors.push(validationIssue(
            'destination_location_inactive',
            'destinationLocationId',
            'Destination location must be active',
            'route',
          ));
        }
      }
    }

    if (pricing) {
      if (!pricing.routeId) {
        errors.push(validationIssue('pricing_route_required', 'routeId', 'Route is required', 'pricing'));
      }

      const numericChecks = [
        ['extra_passenger_fee_invalid', 'extraPassengerFee', 'Extra passenger fee', pricing.extraPassengerFee],
        ['extra_bag_fee_invalid', 'extraBagFee', 'Extra small backpack fee', pricing.extraBagFee],
        ['oversize_bag_fee_invalid', 'oversizeBagFee', 'Extra large bag (15kg+) fee', pricing.oversizeBagFee],
        ['child_seat_fee_invalid', 'childSeatFee', 'Child seat fee', pricing.childSeatFee],
        ['booster_seat_fee_invalid', 'boosterSeatFee', 'Booster seat fee', pricing.boosterSeatFee],
        ['waiting_included_invalid', 'waitingIncludedMinutes', 'Waiting included minutes', pricing.waitingIncludedMinutes],
        ['waiting_hourly_invalid', 'waitingFeePerHour', 'Waiting fee per hour', pricing.waitingFeePerHour],
        ['deposit_value_invalid', 'depositValue', 'Deposit value', pricing.depositValue],
        ['pricing_priority_invalid', 'priority', 'Priority', pricing.priority],
      ];
      numericChecks.forEach(([code, field, label, value]) => {
        if (!Number.isFinite(Number(value)) || Number(value) < 0) {
          errors.push(validationIssue(code, field, `${label} must be >= 0`, 'pricing'));
        }
      });

      if (!['fixed_amount', 'percent_total', 'per_person'].includes(pricing.depositMode)) {
        errors.push(validationIssue('deposit_mode_invalid', 'depositMode', 'Deposit mode is invalid', 'pricing'));
      }
      if (pricing.depositEnabled && !(pricing.depositValue > 0)) {
        errors.push(validationIssue(
          'deposit_enabled_value_invalid',
          'depositValue',
          'Deposit value must be greater than 0 when deposit is enabled',
          'pricing',
        ));
      }
      if (pricing.depositEnabled && pricing.depositMode === 'percent_total' && pricing.depositValue > 100) {
        errors.push(validationIssue('deposit_percent_invalid', 'depositValue', 'Deposit percent must be <= 100', 'pricing'));
      }
      if (pricing.validFrom && pricing.validTo && pricing.validTo < pricing.validFrom) {
        errors.push(validationIssue(
          'pricing_validity_invalid',
          'validTo',
          'Valid to date must be equal or later than valid from',
          'pricing',
        ));
      }
    }

    const existing = {
      outbound: context?.existingOutbound || null,
      reverse: context?.existingReverse || null,
    };
    if (existing.outbound) {
      warnings.push(validationIssue('outbound_route_exists', 'route', 'Outbound route already exists', 'route'));
    }
    if (existing.reverse) {
      warnings.push(validationIssue('reverse_route_exists', 'direction', 'Reverse route already exists', 'direction'));
    }

    const normalizedDraft = { ...source };
    if (route) normalizedDraft.route = route;
    if (pricing) normalizedDraft.pricing = pricing;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedDraft,
      existing,
    };
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function createSaveStep({ key, type, action, payload, dependsOn = [], existingId = null, payloadRefs = {} }) {
    return {
      key,
      type,
      action,
      payload,
      payloadRefs,
      dependsOn,
      existingId,
      fingerprint: stableSerialize({ type, action, payload, existingId }),
      status: 'pending',
      attempts: 0,
      reconciled: false,
      skipReason: null,
      resolvedPayload: null,
      result: null,
      error: null,
    };
  }

  function buildTransportSavePlan(draft, context = {}, options = {}) {
    const source = draft && typeof draft === 'object' ? draft : {};
    const routePayload = buildTransportRoutePayload(composeRouteDraft(source));
    const direction = source.direction && typeof source.direction === 'object' ? source.direction : {};
    const price = source.price && typeof source.price === 'object' ? source.price : {};
    const pricing = source.pricing && typeof source.pricing === 'object' ? source.pricing : {};
    const existingOutbound = context.existingOutbound || null;
    const existingReverse = context.existingReverse || null;
    const steps = [];

    const outboundAction = existingOutbound ? 'update' : 'insert';
    steps.push(createSaveStep({
      key: 'route_outbound',
      type: 'transport_route',
      action: outboundAction,
      payload: routePayload,
      existingId: existingOutbound?.id || null,
    }));

    const bidirectional = direction.mode === 'bidirectional';
    let reverseAction = null;
    if (bidirectional) {
      reverseAction = existingReverse
        ? (direction.existingReverseAction === 'update' ? 'update' : 'reuse')
        : 'insert';
      const reverseOptions = direction.reverseSettings === 'separate_prices'
        ? { dayPrice: price.reverseDayPrice, nightPrice: price.reverseNightPrice }
        : {};
      steps.push(createSaveStep({
        key: 'route_reverse',
        type: 'transport_route',
        action: reverseAction,
        payload: reverseAction === 'reuse' ? null : buildReverseRoutePayload(routePayload, reverseOptions),
        dependsOn: ['route_outbound'],
        existingId: existingReverse?.id || null,
      }));
    }

    const pricingEnabled = pricing.enabled === true;
    if (pricingEnabled) {
      const outboundPricingPayload = buildTransportPricingRulePayload(
        { ...pricing, routeId: '$route_outbound.id' },
        { depositBaseFloor: context.depositBaseFloor },
      );
      steps.push(createSaveStep({
        key: 'pricing_outbound',
        type: 'pricing_rule',
        action: 'insert',
        payload: outboundPricingPayload,
        payloadRefs: { route_id: 'route_outbound.result.id' },
        dependsOn: ['route_outbound'],
      }));

      if (bidirectional && reverseAction !== 'reuse' && pricing.applyToReverse !== false) {
        const reversePricingPayload = buildTransportPricingRulePayload(
          { ...pricing, routeId: '$route_reverse.id' },
          { depositBaseFloor: context.depositBaseFloor },
        );
        steps.push(createSaveStep({
          key: 'pricing_reverse',
          type: 'pricing_rule',
          action: 'insert',
          payload: reversePricingPayload,
          payloadRefs: { route_id: 'route_reverse.result.id' },
          dependsOn: ['route_reverse'],
        }));
      }

      const depositDraft = pricing.deposit && typeof pricing.deposit === 'object' ? pricing.deposit : {};
      if (depositDraft.enabled === true) {
        const commonDeposit = {
          depositEnabled: true,
          depositMode: depositDraft.mode,
          depositValue: depositDraft.value,
          currency: routePayload.currency,
          includeChildren: Boolean(context.serviceDepositDefaults?.includeChildren),
        };
        const outboundOverride = buildTransportDepositOverridePayload({
          ...commonDeposit,
          routeId: '$route_outbound.id',
        });
        if (outboundOverride) {
          steps.push(createSaveStep({
            key: 'deposit_outbound',
            type: 'deposit_override',
            action: 'upsert',
            payload: outboundOverride,
            payloadRefs: { resource_id: 'route_outbound.result.id' },
            dependsOn: ['pricing_outbound'],
          }));
        }

        if (bidirectional && reverseAction !== 'reuse' && pricing.applyToReverse !== false) {
          const reverseOverride = buildTransportDepositOverridePayload({
            ...commonDeposit,
            routeId: '$route_reverse.id',
          });
          if (reverseOverride) {
            steps.push(createSaveStep({
              key: 'deposit_reverse',
              type: 'deposit_override',
              action: 'upsert',
              payload: reverseOverride,
              payloadRefs: { resource_id: 'route_reverse.result.id' },
              dependsOn: ['pricing_reverse'],
            }));
          }
        }
      }
    }

    const summary = {
      routeCreates: steps.filter((step) => step.type === 'transport_route' && step.action === 'insert').length,
      routeUpdates: steps.filter((step) => step.type === 'transport_route' && step.action === 'update').length,
      routeReuses: steps.filter((step) => step.type === 'transport_route' && step.action === 'reuse').length,
      pricingCreates: steps.filter((step) => step.type === 'pricing_rule' && step.action === 'insert').length,
      depositUpserts: steps.filter((step) => step.type === 'deposit_override' && step.action === 'upsert').length,
      globalChanges: 0,
    };

    return {
      id: String(options.runId || ''),
      createdAt: String(options.createdAt || ''),
      status: 'pending',
      attempts: 0,
      steps,
      results: {},
      summary,
      execution: null,
    };
  }

  function cloneSerializable(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function executionError(error, fallbackCode = 'transport_save_failed') {
    const source = error && typeof error === 'object' ? error : {};
    return {
      name: String(source.name || 'Error'),
      code: String(source.code || fallbackCode),
      message: String(source.message || error || 'Transport save failed'),
      details: source.details == null ? null : String(source.details),
      hint: source.hint == null ? null : String(source.hint),
    };
  }

  function dependencyOrder(steps) {
    const rows = Array.isArray(steps) ? steps : [];
    const byKey = new Map();
    rows.forEach((step) => {
      const key = String(step?.key || '').trim();
      if (!key) throw Object.assign(new Error('Save-plan step key is required'), { code: 'save_plan_step_key_missing' });
      if (byKey.has(key)) {
        throw Object.assign(new Error(`Duplicate save-plan step: ${key}`), { code: 'save_plan_step_duplicate' });
      }
      byKey.set(key, step);
    });

    rows.forEach((step) => {
      (step.dependsOn || []).forEach((dependencyKey) => {
        if (!byKey.has(String(dependencyKey))) {
          throw Object.assign(
            new Error(`Unknown dependency ${dependencyKey} for ${step.key}`),
            { code: 'save_plan_dependency_missing' },
          );
        }
      });
    });

    const ordered = [];
    const visiting = new Set();
    const visited = new Set();
    function visit(step) {
      if (visited.has(step.key)) return;
      if (visiting.has(step.key)) {
        throw Object.assign(new Error(`Circular save-plan dependency at ${step.key}`), {
          code: 'save_plan_dependency_cycle',
        });
      }
      visiting.add(step.key);
      (step.dependsOn || []).forEach((dependencyKey) => visit(byKey.get(String(dependencyKey))));
      visiting.delete(step.key);
      visited.add(step.key);
      ordered.push(step);
    }
    rows.forEach(visit);
    return ordered;
  }

  function valueAtPath(value, path) {
    return String(path || '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
  }

  function setValueAtPath(value, path, nextValue) {
    const keys = String(path || '').split('.').filter(Boolean);
    if (!keys.length) return;
    let target = value;
    keys.slice(0, -1).forEach((key) => {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = nextValue;
  }

  function resolveStepPayload(step, stepByKey) {
    const payload = step?.payload == null ? null : cloneSerializable(step.payload);
    if (payload == null) return null;
    Object.entries(step.payloadRefs || {}).forEach(([payloadPath, referencePath]) => {
      const parts = String(referencePath || '').split('.').filter(Boolean);
      const referencedStep = stepByKey.get(parts.shift());
      const referencedValue = valueAtPath(referencedStep, parts.join('.'));
      if (referencedValue === null || referencedValue === undefined || referencedValue === '') {
        throw Object.assign(
          new Error(`Unable to resolve ${payloadPath} from ${referencePath}`),
          { code: 'save_plan_payload_reference_missing' },
        );
      }
      setValueAtPath(payload, payloadPath, referencedValue);
    });
    return payload;
  }

  function normalizeRepositoryResult(response, step) {
    if (response?.error) throw response.error;
    const data = response?.data ?? response?.result ?? response ?? null;
    const row = Array.isArray(data) ? (data[0] || null) : data;
    const id = String(response?.id ?? row?.id ?? step.existingId ?? '').trim();
    if (step.action !== 'delete' && !id) {
      throw Object.assign(new Error(`Save step ${step.key} did not return an ID`), {
        code: 'save_plan_result_id_missing',
      });
    }
    return {
      id,
      data: row && typeof row === 'object' ? cloneSerializable(row) : row,
      reconciled: Boolean(response?.reconciled),
      reused: Boolean(response?.reused || step.action === 'reuse'),
    };
  }

  function isDependencyRetryStep(step) {
    return step?.status === 'skipped' && step?.skipReason === 'dependency';
  }

  function shouldExecuteStep(step, retry) {
    if (!retry) return step.status === 'pending';
    return step.status === 'error' || isDependencyRetryStep(step);
  }

  function summarizeExecution(plan, cancelled) {
    const statuses = plan.steps.reduce((result, step) => {
      result[step.status] = (result[step.status] || 0) + 1;
      return result;
    }, {});
    if (cancelled) return 'cancelled';
    if ((statuses.error || 0) > 0) return (statuses.success || 0) > 0 ? 'partial' : 'error';
    if ((statuses.skipped || 0) > 0) return (statuses.success || 0) > 0 ? 'partial' : 'error';
    return 'success';
  }

  async function executeTransportSavePlan(plan, repository, options = {}) {
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.steps)) {
      throw Object.assign(new Error('A valid transport save plan is required'), { code: 'save_plan_invalid' });
    }
    if (!repository || typeof repository !== 'object') {
      throw Object.assign(new Error('A transport repository is required'), { code: 'save_repository_missing' });
    }

    const retry = options.retry === true;
    const working = cloneSerializable(plan);
    if (!working.results || typeof working.results !== 'object') working.results = {};
    if (working.status === 'success') return working;

    const ordered = dependencyOrder(working.steps);
    const stepByKey = new Map(working.steps.map((step) => [String(step.key), step]));
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const startMs = Number(now());
    const startedAt = new Date(Number.isFinite(startMs) ? startMs : Date.now()).toISOString();
    const firstStartedAt = working.execution?.startedAt || startedAt;
    const firstStartedMs = Date.parse(firstStartedAt);
    working.createdAt = working.createdAt || startedAt;
    working.status = 'running';
    working.attempts = Number(working.attempts || 0) + 1;
    working.execution = {
      ...(working.execution || {}),
      startedAt: firstStartedAt,
      lastStartedAt: startedAt,
      finishedAt: null,
      durationMs: Number(working.execution?.durationMs || 0),
      runs: Number(working.execution?.runs || 0) + 1,
    };

    if (retry) {
      working.steps.forEach((step) => {
        if (!shouldExecuteStep(step, true)) return;
        step.status = 'pending';
        step.error = null;
        step.skipReason = null;
        step.reconciled = false;
        step.resolvedPayload = null;
        step.result = null;
        delete working.results[step.key];
      });
    }

    async function notify(step = null) {
      if (typeof options.onProgress !== 'function') return;
      try {
        await options.onProgress(cloneSerializable(working), step ? cloneSerializable(step) : null);
      } catch (_error) {
      }
    }

    await notify();
    let cancelled = Boolean(options.signal?.aborted);

    for (const step of ordered) {
      if (!shouldExecuteStep(step, false)) continue;
      if (cancelled || options.signal?.aborted) {
        step.status = 'skipped';
        step.skipReason = 'cancelled';
        step.error = executionError(options.signal?.reason || new Error('Save cancelled'), 'save_plan_cancelled');
        cancelled = true;
        await notify(step);
        continue;
      }

      const dependencies = (step.dependsOn || []).map((key) => stepByKey.get(String(key)));
      if (dependencies.some((dependency) => dependency?.status !== 'success')) {
        step.status = 'skipped';
        step.skipReason = 'dependency';
        step.error = executionError(
          new Error(`Skipped because a dependency did not succeed: ${step.dependsOn.join(', ')}`),
          'save_plan_dependency_failed',
        );
        await notify(step);
        continue;
      }

      step.status = 'running';
      step.skipReason = null;
      step.error = null;
      step.attempts = Number(step.attempts || 0) + 1;
      try {
        step.resolvedPayload = resolveStepPayload(step, stepByKey);
        await notify(step);
        const operation = repository[step.action];
        if (typeof operation !== 'function') {
          throw Object.assign(new Error(`Repository does not support ${step.action}`), {
            code: 'save_repository_action_missing',
          });
        }
        const response = await operation.call(repository, {
          type: step.type,
          payload: step.resolvedPayload,
          id: step.existingId,
          fingerprint: stableSerialize(step.resolvedPayload),
          planId: working.id,
          stepKey: step.key,
          createdAt: working.createdAt,
          signal: options.signal || null,
        });
        const result = normalizeRepositoryResult(response, step);
        step.result = result;
        step.reconciled = result.reconciled;
        step.status = 'success';
        working.results[step.key] = result;
      } catch (error) {
        if (options.signal?.aborted || error?.name === 'AbortError') {
          step.status = 'skipped';
          step.skipReason = 'cancelled';
          step.error = executionError(error, 'save_plan_cancelled');
          cancelled = true;
        } else {
          step.status = 'error';
          step.error = executionError(error);
        }
      }
      await notify(step);
    }

    const endMs = Number(now());
    const safeEndMs = Number.isFinite(endMs) ? endMs : Date.now();
    working.status = summarizeExecution(working, cancelled);
    working.execution.finishedAt = new Date(safeEndMs).toISOString();
    working.execution.durationMs = Math.max(
      0,
      safeEndMs - (Number.isFinite(firstStartedMs) ? firstStartedMs : startMs),
    );
    working.execution.succeeded = working.steps.filter((step) => step.status === 'success').length;
    working.execution.failed = working.steps.filter((step) => step.status === 'error').length;
    working.execution.skipped = working.steps.filter((step) => step.status === 'skipped').length;
    working.execution.retryable = working.steps.filter((step) => (
      step.status === 'error' || isDependencyRetryStep(step)
    )).map((step) => step.key);
    await notify();
    return working;
  }

  const api = Object.freeze({
    buildTransportRoutePayload,
    buildTransportPricingRulePayload,
    buildTransportDepositOverridePayload,
    buildReverseRoutePayload,
    validateTransportRouteDraft,
    buildTransportSavePlan,
    executeTransportSavePlan,
  });

  Object.defineProperty(root, 'TransportAdminCore', {
    value: api,
    configurable: true,
    enumerable: false,
    writable: false,
  });
})(globalThis);
