(function attachHotelV2RateResolution(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CE_HOTEL_V2_RATE_RESOLUTION = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelV2RateResolution() {
  'use strict';

  const CALENDAR_PRECEDENCE = Object.freeze([
    'safety_closure',
    'exact_date_override',
    'range_rule',
    'weekday_rule',
    'occupancy_los_tier',
    'room_rate_base',
  ]);
  const PATCH_FIELDS = Object.freeze([
    'nightly_rate',
    'minimum_stay',
    'maximum_stay',
    'closed',
    'closed_to_arrival',
    'closed_to_departure',
  ]);
  const PATCH_SET_ACTIONS = Object.freeze(new Set(['set', 'override', 'value']));
  const PATCH_FALLTHROUGH_ACTIONS = Object.freeze(new Set([
    'clear',
    'inherit',
    'remove',
    'no_change',
    'none',
    'unset',
  ]));

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asText(value) {
    return String(value == null ? '' : value).trim();
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(asObject(value), key);
  }

  function finiteNumber(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function nonNegativeInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  function booleanValue(value) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || asText(value).toLowerCase() === 'true') return true;
    if (value === 0 || value === '0' || asText(value).toLowerCase() === 'false') return false;
    return null;
  }

  function roundMoney(value) {
    const parsed = finiteNumber(value);
    if (parsed == null) return null;
    return Math.round((parsed + Number.EPSILON) * 100) / 100;
  }

  function parseIsoDate(value) {
    const text = asText(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return null;
    return { text, year, month, day, timestamp };
  }

  function formatIsoDate(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  function enumerateStayDates(checkIn, checkOut) {
    const arrival = parseIsoDate(checkIn);
    const departure = parseIsoDate(checkOut);
    if (!arrival || !departure || departure.timestamp <= arrival.timestamp) {
      return {
        ok: false,
        reason: 'invalid_stay_dates',
        check_in: arrival?.text || null,
        check_out: departure?.text || null,
        nights: 0,
        stay_dates: [],
      };
    }
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const nights = Math.round((departure.timestamp - arrival.timestamp) / millisecondsPerDay);
    const stayDates = Array.from({ length: nights }, (_entry, index) => (
      formatIsoDate(arrival.timestamp + index * millisecondsPerDay)
    ));
    return {
      ok: true,
      reason: null,
      check_in: arrival.text,
      check_out: departure.text,
      nights,
      stay_dates: stayDates,
    };
  }

  function isoWeekday(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) return null;
    const day = new Date(parsed.timestamp).getUTCDay();
    return day === 0 ? 7 : day;
  }

  function sourceReference(source, layer, index) {
    return asText(source?.id || source?.source_id || source?.code) || `${layer}:${index + 1}`;
  }

  function parseResolutionInstant(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!asText(value)) return null;
    const parsed = Date.parse(asText(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function resolveAsOf(options = {}) {
    const raw = options.as_of ?? options.asOf ?? options.now;
    const timestamp = raw == null || raw === '' ? Date.now() : parseResolutionInstant(raw);
    if (timestamp == null) {
      return { ok: false, reason: 'invalid_resolution_instant', timestamp: null, iso: null };
    }
    return {
      ok: true,
      reason: null,
      timestamp,
      iso: new Date(timestamp).toISOString(),
    };
  }

  function isExpiredSource(source, asOfTimestamp) {
    const expiresAt = asText(source?.expires_at || source?.expiresAt);
    if (!expiresAt) return false;
    const timestamp = Date.parse(expiresAt);
    return !Number.isFinite(timestamp) || timestamp <= asOfTimestamp;
  }

  function normalizeWeekdays(value) {
    const rows = asArray(value)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7);
    return Array.from(new Set(rows)).sort((left, right) => left - right);
  }

  function readPatchAction(raw, fieldNames) {
    const actionFields = fieldNames.flatMap((field) => [`${field}_action`, `${field}_mode`]);
    const actions = actionFields
      .filter((field) => hasOwn(raw, field) && asText(raw[field]))
      .map((field) => asText(raw[field]).toLowerCase());
    const unique = Array.from(new Set(actions));
    if (unique.length > 1) return { action: null, invalid: true };
    if (!unique.length) return { action: null, invalid: false };
    const action = unique[0];
    if (!PATCH_SET_ACTIONS.has(action) && !PATCH_FALLTHROUGH_ACTIONS.has(action)) {
      return { action, invalid: true };
    }
    return { action, invalid: false };
  }

  function addPatchField(result, raw, field, aliases, parser) {
    const fieldNames = [field, ...aliases];
    const actionResult = readPatchAction(raw, fieldNames);
    if (actionResult.invalid) {
      result.invalid_fields.push(field);
      return;
    }
    if (PATCH_FALLTHROUGH_ACTIONS.has(actionResult.action)) return;

    const sourceField = fieldNames.find((candidate) => hasOwn(raw, candidate));
    if (!sourceField) {
      if (PATCH_SET_ACTIONS.has(actionResult.action)) result.invalid_fields.push(field);
      return;
    }
    const rawValue = raw[sourceField];
    // SQL NULL means there is no value at this layer. An explicit CLEAR/INHERIT
    // action has the same fall-through behavior; neither erases a lower layer.
    if (rawValue == null && !PATCH_SET_ACTIONS.has(actionResult.action)) return;
    const parsed = parser(rawValue);
    if (parsed == null) {
      result.invalid_fields.push(field);
      return;
    }
    result.patch[field] = parsed;
  }

  function normalizePatch(source) {
    const raw = asObject(source);
    const result = { patch: {}, invalid_fields: [] };
    addPatchField(
      result,
      raw,
      'nightly_rate',
      ['daily_rate', 'price_per_night'],
      finiteNumber,
    );
    addPatchField(result, raw, 'minimum_stay', [], positiveInteger);
    addPatchField(result, raw, 'maximum_stay', [], positiveInteger);
    addPatchField(result, raw, 'closed', [], booleanValue);
    addPatchField(result, raw, 'closed_to_arrival', [], booleanValue);
    addPatchField(result, raw, 'closed_to_departure', [], booleanValue);
    return result;
  }

  function normalizeCalendarSource(source, layer, index) {
    const raw = asObject(source);
    const normalizedPatch = normalizePatch(raw);
    return {
      id: sourceReference(raw, layer, index),
      layer,
      priority: Number.isInteger(Number(raw.priority)) ? Number(raw.priority) : 0,
      is_active: raw.is_active !== false,
      stay_date: asText(raw.stay_date || raw.date),
      valid_from: asText(raw.valid_from || raw.start_date),
      valid_to: asText(raw.valid_to || raw.end_date),
      weekdays: normalizeWeekdays(raw.weekdays),
      patch: normalizedPatch.patch,
      invalid_patch_fields: normalizedPatch.invalid_fields,
      raw,
    };
  }

  function dateInRange(date, start, end) {
    const parsedDate = parseIsoDate(date);
    if (!parsedDate) return false;
    const parsedStart = parseIsoDate(start);
    const parsedEnd = parseIsoDate(end);
    if (start && !parsedStart) return false;
    if (end && !parsedEnd) return false;
    return (!parsedStart || parsedDate.timestamp >= parsedStart.timestamp)
      && (!parsedEnd || parsedDate.timestamp <= parsedEnd.timestamp);
  }

  function calendarSourceMatches(source, date) {
    if (!source.is_active || !parseIsoDate(date)) return false;
    if (source.stay_date) return source.stay_date === date;
    if (!dateInRange(date, source.valid_from, source.valid_to)) return false;
    if (!source.weekdays.length) return true;
    return source.weekdays.includes(isoWeekday(date));
  }

  function chooseCalendarSource(sources, date, layer, now) {
    const matching = asArray(sources)
      .filter((source) => !isExpiredSource(source, now))
      .map((source, index) => normalizeCalendarSource(source, layer, index))
      .filter((source) => calendarSourceMatches(source, date));
    if (!matching.length) return { source: null, ambiguity: null };
    const highestPriority = Math.max(...matching.map((source) => source.priority));
    const top = matching.filter((source) => source.priority === highestPriority);
    if (top.length > 1) {
      return {
        source: null,
        ambiguity: {
          code: 'equal_priority_calendar_rules',
          date,
          layer,
          priority: highestPriority,
          source_ids: top.map((source) => source.id).sort(),
        },
      };
    }
    return { source: top[0], ambiguity: null };
  }

  function matchingSafetyClosures(sources, date, now) {
    return asArray(sources)
      .filter((source) => !isExpiredSource(source, now))
      .map((source, index) => normalizeCalendarSource(source, 'safety_closure', index))
      .filter((source) => calendarSourceMatches(source, date));
  }

  function normalizeOccupancyTier(source, index) {
    const raw = asObject(source);
    const guestCount = positiveInteger(raw.guest_count ?? raw.persons ?? raw.occupancy);
    const thresholdNights = positiveInteger(
      raw.threshold_nights ?? raw.min_nights ?? raw.minimum_stay,
    );
    const nightlyRate = finiteNumber(raw.nightly_rate ?? raw.daily_rate ?? raw.price_per_night);
    return {
      id: sourceReference(raw, 'occupancy_los_tier', index),
      guest_count: guestCount,
      threshold_nights: thresholdNights,
      nightly_rate: nightlyRate,
      is_active: raw.is_active === true,
      raw,
    };
  }

  function selectOccupancyLosTier(tiers, guestCount, nights) {
    const guests = positiveInteger(guestCount);
    const stayNights = positiveInteger(nights);
    if (!guests || !stayNights) {
      return { ok: false, reason: 'invalid_occupancy_or_stay', tier: null, ambiguities: [] };
    }
    const normalized = asArray(tiers)
      .map(normalizeOccupancyTier)
      .filter((tier) => tier.is_active && tier.guest_count === guests);
    if (!normalized.length) {
      return { ok: false, reason: 'missing_occupancy_los_guest', tier: null, ambiguities: [] };
    }
    const invalid = normalized.filter((tier) => (
      !tier.threshold_nights || tier.nightly_rate == null || tier.nightly_rate < 0
    ));
    if (invalid.length) {
      return {
        ok: false,
        reason: 'invalid_occupancy_los_tier',
        tier: null,
        ambiguities: invalid.map((tier) => ({
          code: 'invalid_occupancy_los_tier',
          source_ids: [tier.id],
        })),
      };
    }
    const byThreshold = new Map();
    normalized.forEach((tier) => {
      const rows = byThreshold.get(tier.threshold_nights) || [];
      rows.push(tier);
      byThreshold.set(tier.threshold_nights, rows);
    });
    const duplicates = Array.from(byThreshold.entries())
      .filter(([_threshold, rows]) => rows.length > 1)
      .map(([threshold, rows]) => ({
        code: 'duplicate_occupancy_los_threshold',
        guest_count: guests,
        threshold_nights: threshold,
        source_ids: rows.map((tier) => tier.id).sort(),
      }));
    if (duplicates.length) {
      return {
        ok: false,
        reason: 'ambiguous_occupancy_los_tiers',
        tier: null,
        ambiguities: duplicates,
      };
    }
    const candidates = normalized
      .filter((tier) => tier.threshold_nights <= stayNights)
      .sort((left, right) => right.threshold_nights - left.threshold_nights);
    if (!candidates.length) {
      return { ok: false, reason: 'missing_occupancy_los_tier', tier: null, ambiguities: [] };
    }
    const selected = candidates[0];
    return {
      ok: true,
      reason: null,
      tier: {
        id: selected.id,
        guest_count: selected.guest_count,
        threshold_nights: selected.threshold_nights,
        nightly_rate: selected.nightly_rate,
      },
      ambiguities: [],
    };
  }

  function analyzeOccupancyLosTiers(tiers, options = {}) {
    const normalized = asArray(tiers).map(normalizeOccupancyTier).filter((tier) => tier.is_active);
    const expectedGuestCounts = asArray(options.expected_guest_counts || options.expectedGuestCounts)
      .map(positiveInteger)
      .filter(Boolean);
    const guestCounts = expectedGuestCounts.length
      ? Array.from(new Set(expectedGuestCounts)).sort((a, b) => a - b)
      : Array.from(new Set(normalized.map((tier) => tier.guest_count).filter(Boolean))).sort((a, b) => a - b);
    const duplicateThresholds = [];
    const invalidTiers = [];
    const minimumThresholdByGuest = {};
    const unsupportedGuestCounts = [];
    const oneNightGapGuestCounts = [];

    normalized.forEach((tier) => {
      if (!tier.guest_count || !tier.threshold_nights || tier.nightly_rate == null || tier.nightly_rate < 0) {
        invalidTiers.push(tier.id);
      }
    });
    guestCounts.forEach((guestCount) => {
      const rows = normalized.filter((tier) => tier.guest_count === guestCount);
      if (!rows.length) {
        unsupportedGuestCounts.push(guestCount);
        return;
      }
      const thresholds = rows.map((tier) => tier.threshold_nights).filter(Boolean);
      minimumThresholdByGuest[guestCount] = Math.min(...thresholds);
      if (minimumThresholdByGuest[guestCount] > 1) oneNightGapGuestCounts.push(guestCount);
      const grouped = new Map();
      rows.forEach((tier) => {
        const duplicates = grouped.get(tier.threshold_nights) || [];
        duplicates.push(tier.id);
        grouped.set(tier.threshold_nights, duplicates);
      });
      grouped.forEach((sourceIds, thresholdNights) => {
        if (sourceIds.length > 1) duplicateThresholds.push({
          guest_count: guestCount,
          threshold_nights: thresholdNights,
          source_ids: sourceIds.sort(),
        });
      });
    });
    return {
      active_tier_count: normalized.length,
      guest_counts: guestCounts,
      unsupported_guest_counts: unsupportedGuestCounts,
      minimum_threshold_by_guest: minimumThresholdByGuest,
      one_night_gap_guest_counts: oneNightGapGuestCounts,
      duplicate_thresholds: duplicateThresholds,
      invalid_tier_ids: invalidTiers.sort(),
      unambiguous: !unsupportedGuestCounts.length
        && !oneNightGapGuestCounts.length
        && !duplicateThresholds.length
        && !invalidTiers.length,
    };
  }

  function baseState(baseNightlyRate, baseSource) {
    return {
      values: {
        nightly_rate: baseNightlyRate,
        minimum_stay: null,
        maximum_stay: null,
        closed: false,
        closed_to_arrival: false,
        closed_to_departure: false,
      },
      provenance: {
        nightly_rate: baseSource,
        minimum_stay: { layer: 'room_rate_base', source_id: null },
        maximum_stay: { layer: 'room_rate_base', source_id: null },
        closed: { layer: 'room_rate_base', source_id: null },
        closed_to_arrival: { layer: 'room_rate_base', source_id: null },
        closed_to_departure: { layer: 'room_rate_base', source_id: null },
      },
      applied_layers: [baseSource],
    };
  }

  function applyCalendarSource(state, source) {
    if (!source) return;
    const provenance = {
      layer: source.layer,
      source_id: source.id,
      priority: source.priority,
    };
    PATCH_FIELDS.forEach((field) => {
      if (!hasOwn(source.patch, field)) return;
      state.values[field] = source.patch[field];
      state.provenance[field] = provenance;
    });
    state.applied_layers.push(provenance);
  }

  function resolveCalendarDate(options = {}) {
    const date = asText(options.date);
    if (!parseIsoDate(date)) {
      return { ok: false, date, reason: 'invalid_calendar_date', ambiguities: [] };
    }
    const asOf = resolveAsOf(options);
    if (!asOf.ok) {
      return { ok: false, date, reason: asOf.reason, ambiguities: [] };
    }
    const baseRate = finiteNumber(options.base_nightly_rate ?? options.baseNightlyRate);
    if (baseRate == null || baseRate < 0) {
      return { ok: false, date, reason: 'invalid_base_nightly_rate', ambiguities: [] };
    }
    const baseSource = asObject(options.base_source || options.baseSource);
    const state = baseState(baseRate, {
      layer: asText(baseSource.layer) || 'room_rate_base',
      source_id: asText(baseSource.source_id || baseSource.id) || null,
      ...(baseSource.threshold_nights ? { threshold_nights: baseSource.threshold_nights } : {}),
      ...(baseSource.guest_count ? { guest_count: baseSource.guest_count } : {}),
    });
    const layers = [
      ['weekday_rule', options.weekday_rules || options.weekdayRules],
      ['range_rule', options.range_rules || options.rangeRules],
      ['exact_date_override', options.exact_date_overrides || options.exactDateOverrides],
    ];
    const ambiguities = [];
    const selected = {};
    for (const [layer, sources] of layers) {
      const choice = chooseCalendarSource(sources, date, layer, asOf.timestamp);
      if (choice.ambiguity) ambiguities.push(choice.ambiguity);
      selected[layer] = choice.source;
    }
    if (ambiguities.length) {
      return {
        ok: false,
        date,
        reason: 'ambiguous_calendar_rules',
        ambiguities,
      };
    }
    const invalidPatchSources = Object.values(selected)
      .filter((source) => source && source.invalid_patch_fields.length)
      .map((source) => ({
        code: 'invalid_calendar_rule_patch',
        date,
        layer: source.layer,
        source_id: source.id,
        fields: source.invalid_patch_fields.slice().sort(),
      }));
    if (invalidPatchSources.length) {
      return {
        ok: false,
        date,
        reason: 'invalid_calendar_rule_patch',
        ambiguities: invalidPatchSources,
      };
    }
    layers.forEach(([layer]) => applyCalendarSource(state, selected[layer]));

    const closures = matchingSafetyClosures(
      options.safety_closures || options.safetyClosures,
      date,
      asOf.timestamp,
    );
    if (closures.length) {
      state.values.closed = true;
      state.provenance.closed = {
        layer: 'safety_closure',
        source_id: closures.map((closure) => closure.id).sort().join(','),
      };
      closures.forEach((closure) => state.applied_layers.push({
        layer: 'safety_closure',
        source_id: closure.id,
      }));
    }

    if (state.values.nightly_rate == null || state.values.nightly_rate < 0) {
      return {
        ok: false,
        date,
        reason: 'invalid_resolved_nightly_rate',
        ambiguities: [],
      };
    }
    if (
      state.values.minimum_stay
      && state.values.maximum_stay
      && state.values.maximum_stay < state.values.minimum_stay
    ) {
      return {
        ok: false,
        date,
        reason: 'invalid_resolved_stay_restriction',
        ambiguities: [],
      };
    }
    return {
      ok: true,
      date,
      as_of: asOf.iso,
      reason: null,
      nightly_rate: roundMoney(state.values.nightly_rate),
      nightly_rate_unrounded: state.values.nightly_rate,
      minimum_stay: state.values.minimum_stay,
      maximum_stay: state.values.maximum_stay,
      closed: Boolean(state.values.closed),
      closed_to_arrival: Boolean(state.values.closed_to_arrival),
      closed_to_departure: Boolean(state.values.closed_to_departure),
      provenance: state.provenance,
      applied_layers: state.applied_layers,
      ambiguities: [],
    };
  }

  function detectEqualPriorityAmbiguities(options = {}) {
    const asOf = resolveAsOf(options);
    if (!asOf.ok) return [{ code: asOf.reason }];
    const dates = asArray(options.dates).map(asText).filter((date) => parseIsoDate(date));
    const layers = [
      ['weekday_rule', options.weekday_rules || options.weekdayRules],
      ['range_rule', options.range_rules || options.rangeRules],
      ['exact_date_override', options.exact_date_overrides || options.exactDateOverrides],
    ];
    const ambiguities = [];
    dates.forEach((date) => {
      layers.forEach(([layer, sources]) => {
        const choice = chooseCalendarSource(sources, date, layer, asOf.timestamp);
        if (choice.ambiguity) ambiguities.push(choice.ambiguity);
      });
    });
    return ambiguities;
  }

  function normalizeCountMap(value) {
    const result = new Map();
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const source = asObject(entry);
        const date = asText(source.stay_date || source.date);
        const count = nonNegativeInteger(source.units ?? source.count ?? source.quantity);
        if (parseIsoDate(date) && count != null) result.set(date, (result.get(date) || 0) + count);
      });
      return result;
    }
    Object.entries(asObject(value)).forEach(([date, rawCount]) => {
      const count = nonNegativeInteger(rawCount);
      if (parseIsoDate(date) && count != null) result.set(date, count);
    });
    return result;
  }

  function resolveDailyInventory(options = {}) {
    const date = asText(options.date);
    if (!parseIsoDate(date)) return { ok: false, date, reason: 'invalid_inventory_date' };
    const asOf = resolveAsOf(options);
    if (!asOf.ok) return { ok: false, date, reason: asOf.reason };
    const baseInventory = nonNegativeInteger(
      options.base_inventory_count ?? options.baseInventoryCount,
    );
    if (baseInventory == null) return { ok: false, date, reason: 'invalid_base_inventory' };
    const matchingRows = asArray(options.daily_inventory || options.dailyInventory)
      .filter((entry) => !isExpiredSource(entry, asOf.timestamp))
      .filter((entry) => asText(entry?.stay_date || entry?.date) === date);
    if (matchingRows.length > 1) {
      return {
        ok: false,
        date,
        reason: 'ambiguous_daily_inventory',
        source_ids: matchingRows.map((row, index) => sourceReference(row, 'daily_inventory', index)).sort(),
      };
    }
    const row = matchingRows[0] || null;
    const sellableAction = row ? readPatchAction(asObject(row), ['sellable_units']) : { action: null, invalid: false };
    const closedAction = row ? readPatchAction(asObject(row), ['closed']) : { action: null, invalid: false };
    if (sellableAction.invalid || closedAction.invalid
        || (PATCH_SET_ACTIONS.has(sellableAction.action) && row?.sellable_units == null)
        || (PATCH_SET_ACTIONS.has(closedAction.action) && row?.closed == null)) {
      return { ok: false, date, reason: 'invalid_daily_inventory_mode' };
    }
    const rowUnits = row && !PATCH_FALLTHROUGH_ACTIONS.has(sellableAction.action)
      ? nonNegativeInteger(row.sellable_units)
      : baseInventory;
    if (row && rowUnits == null) return { ok: false, date, reason: 'invalid_daily_inventory' };
    const reserved = normalizeCountMap(options.reserved_units || options.reservedUnits).get(date) || 0;
    const held = normalizeCountMap(options.held_units || options.heldUnits).get(date) || 0;
    const closures = matchingSafetyClosures(
      options.safety_closures || options.safetyClosures,
      date,
      asOf.timestamp,
    );
    const rowClosed = row && !PATCH_FALLTHROUGH_ACTIONS.has(closedAction.action)
      ? Boolean(row.closed)
      : false;
    const closed = rowClosed || closures.length > 0;
    const sellableUnits = rowUnits == null ? 0 : rowUnits;
    const availableUnits = closed ? 0 : Math.max(0, sellableUnits - reserved - held);
    return {
      ok: true,
      date,
      as_of: asOf.iso,
      reason: null,
      sellable_units: sellableUnits,
      reserved_units: reserved,
      held_units: held,
      available_units: availableUnits,
      closed,
      provenance: {
        inventory: row ? 'daily_inventory' : 'room_type_base_inventory',
        source_id: row ? sourceReference(row, 'daily_inventory', 0) : null,
        safety_closure_ids: closures.map((closure) => closure.id).sort(),
      },
    };
  }

  function resolveStayInventory(options = {}) {
    const dates = asArray(options.dates).map(asText);
    const requestedUnits = positiveInteger(options.requested_units ?? options.requestedUnits ?? 1);
    if (!dates.length || !requestedUnits) {
      return {
        ok: false,
        requestable: false,
        reason: 'invalid_inventory_request',
        requested_units: requestedUnits || null,
        minimum_available_units: 0,
        daily: [],
      };
    }
    const asOf = resolveAsOf(options);
    if (!asOf.ok) {
      return {
        ok: false,
        requestable: false,
        reason: asOf.reason,
        requested_units: requestedUnits,
        minimum_available_units: 0,
        daily: [],
      };
    }
    const daily = dates.map((date) => resolveDailyInventory({
      ...options,
      date,
      as_of: asOf.timestamp,
    }));
    const invalid = daily.find((row) => !row.ok);
    if (invalid) {
      return {
        ok: false,
        requestable: false,
        reason: invalid.reason,
        requested_units: requestedUnits,
        minimum_available_units: 0,
        daily,
      };
    }
    const minimumAvailable = Math.min(...daily.map((row) => row.available_units));
    const requestable = daily.every((row) => !row.closed && row.available_units >= requestedUnits);
    return {
      ok: true,
      requestable,
      reason: requestable ? null : 'insufficient_or_closed_inventory',
      as_of: asOf.iso,
      requested_units: requestedUnits,
      minimum_available_units: minimumAvailable,
      daily,
    };
  }

  function resolveStayQuote(options = {}) {
    const stay = enumerateStayDates(
      options.check_in || options.checkIn,
      options.check_out || options.checkOut,
    );
    if (!stay.ok) {
      return {
        ok: false,
        requestable: false,
        reason: stay.reason,
        blocking_reasons: [stay.reason],
        stay,
      };
    }
    const asOf = resolveAsOf(options);
    if (!asOf.ok) {
      return {
        ok: false,
        requestable: false,
        reason: asOf.reason,
        blocking_reasons: [asOf.reason],
        stay,
      };
    }
    const roomRate = asObject(options.room_rate || options.roomRate);
    if (roomRate.is_active === false) {
      return {
        ok: true,
        requestable: false,
        reason: 'inactive_room_rate',
        blocking_reasons: ['inactive_room_rate'],
        stay,
      };
    }
    const guestCount = positiveInteger(options.guest_count ?? options.guestCount);
    if (!guestCount) {
      return {
        ok: false,
        requestable: false,
        reason: 'invalid_guest_count',
        blocking_reasons: ['invalid_guest_count'],
        stay,
      };
    }
    const occupancyTiers = asArray(options.occupancy_los_tiers || options.occupancyLosTiers);
    const hasActiveOccupancyTiers = occupancyTiers.some((tier) => asObject(tier).is_active === true);
    const pricingStrategy = asText(options.pricing_strategy || options.pricingStrategy)
      || (hasActiveOccupancyTiers ? 'occupancy_los' : 'base_nightly_rate');
    let selectedTier = null;
    let baseRate = finiteNumber(roomRate.base_nightly_rate);
    let baseSource = {
      layer: 'room_rate_base',
      source_id: asText(roomRate.id) || null,
    };
    if (pricingStrategy === 'occupancy_los') {
      const selection = selectOccupancyLosTier(occupancyTiers, guestCount, stay.nights);
      if (!selection.ok) {
        return {
          ok: false,
          requestable: false,
          reason: selection.reason,
          blocking_reasons: [selection.reason],
          stay,
          guest_count: guestCount,
          selected_occupancy_los_tier: null,
          ambiguities: selection.ambiguities,
        };
      }
      selectedTier = selection.tier;
      baseRate = selectedTier.nightly_rate;
      baseSource = {
        layer: 'occupancy_los_tier',
        source_id: selectedTier.id,
        guest_count: selectedTier.guest_count,
        threshold_nights: selectedTier.threshold_nights,
      };
    }
    if (baseRate == null || baseRate < 0) {
      return {
        ok: false,
        requestable: false,
        reason: 'invalid_base_nightly_rate',
        blocking_reasons: ['invalid_base_nightly_rate'],
        stay,
      };
    }

    const calendarOptions = {
      base_nightly_rate: baseRate,
      base_source: baseSource,
      exact_date_overrides: options.exact_date_overrides || options.exactDateOverrides,
      range_rules: options.range_rules || options.rangeRules,
      weekday_rules: options.weekday_rules || options.weekdayRules,
      safety_closures: options.safety_closures || options.safetyClosures,
      as_of: asOf.timestamp,
    };
    const nightly = stay.stay_dates.map((date) => resolveCalendarDate({ ...calendarOptions, date }));
    const departure = resolveCalendarDate({ ...calendarOptions, date: stay.check_out });
    const invalidResolution = nightly.find((row) => !row.ok) || (!departure.ok ? departure : null);
    if (invalidResolution) {
      return {
        ok: false,
        requestable: false,
        reason: invalidResolution.reason,
        blocking_reasons: [invalidResolution.reason],
        stay,
        guest_count: guestCount,
        selected_occupancy_los_tier: selectedTier,
        nightly_breakdown: nightly,
        departure_restrictions: departure,
        ambiguities: invalidResolution.ambiguities || [],
      };
    }

    const blockingReasons = [];
    nightly.filter((row) => row.closed).forEach((row) => {
      blockingReasons.push(`closed:${row.date}`);
    });
    const arrival = nightly[0];
    if (arrival.closed_to_arrival) blockingReasons.push('closed_to_arrival');
    if (departure.closed_to_departure) blockingReasons.push('closed_to_departure');
    if (arrival.minimum_stay && stay.nights < arrival.minimum_stay) {
      blockingReasons.push('below_minimum_stay');
    }
    if (arrival.maximum_stay && stay.nights > arrival.maximum_stay) {
      blockingReasons.push('above_maximum_stay');
    }

    const inventoryOptions = asObject(options.inventory);
    const inventory = Object.keys(inventoryOptions).length
      ? resolveStayInventory({
        ...inventoryOptions,
        dates: stay.stay_dates,
        safety_closures: options.safety_closures || options.safetyClosures,
        as_of: asOf.timestamp,
      })
      : null;
    if (inventory && !inventory.ok) blockingReasons.push(inventory.reason);
    else if (inventory && !inventory.requestable) blockingReasons.push(inventory.reason);

    const rawTotal = nightly.reduce((sum, row) => sum + row.nightly_rate_unrounded, 0);
    const total = roundMoney(rawTotal);
    return {
      ok: true,
      requestable: blockingReasons.length === 0,
      reason: blockingReasons[0] || null,
      blocking_reasons: Array.from(new Set(blockingReasons)),
      pricing_strategy: pricingStrategy,
      as_of: asOf.iso,
      currency: asText(roomRate.currency || options.currency || 'EUR').toUpperCase(),
      guest_count: guestCount,
      stay,
      selected_occupancy_los_tier: selectedTier,
      nightly_breakdown: nightly,
      departure_restrictions: departure,
      inventory,
      total,
      total_unrounded: rawTotal,
      provenance: {
        pricing_strategy: pricingStrategy,
        selected_occupancy_los_tier_id: selectedTier?.id || null,
        room_rate_id: asText(roomRate.id) || null,
      },
      ambiguities: [],
    };
  }

  return Object.freeze({
    CALENDAR_PRECEDENCE,
    roundMoney,
    parseIsoDate,
    enumerateStayDates,
    isoWeekday,
    selectOccupancyLosTier,
    analyzeOccupancyLosTiers,
    resolveCalendarDate,
    detectEqualPriorityAmbiguities,
    resolveDailyInventory,
    resolveStayInventory,
    resolveStayQuote,
  });
});
