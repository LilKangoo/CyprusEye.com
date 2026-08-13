(function attachHotelsV2WorkspaceCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2WorkspaceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2WorkspaceCore() {
  'use strict';

  const LANGUAGES = Object.freeze(['pl', 'en', 'he']);
  const ROOM_STATUSES = Object.freeze(['draft', 'active', 'disabled']);
  const UNIT_STATUSES = Object.freeze(['active', 'maintenance', 'disabled']);
  const INVENTORY_MODES = Object.freeze(['pooled', 'unitized']);
  const BOOKING_MODES = Object.freeze(['request_confirmation', 'instant_booking', 'external_redirect']);
  const CHILDREN_POLICIES = Object.freeze(['allowed', 'not_allowed', 'minimum_age']);
  const ROOM_CHILDREN_POLICY_OVERRIDES = Object.freeze(['allowed', 'not_allowed', 'minimum_age']);
  const CHILD_AGE_MIN = 0;
  const CHILD_AGE_MAX = 17;
  const SEVEN_ARCHES_PROPERTY_ID = '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  const SEVEN_ARCHES_SHADOW_IDS = Object.freeze({
    upper_room_type: 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
    ground_room_type: '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
    rate_plan: '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
    upper_room_rate: '7e420964-9cbf-4f1b-abd3-09840af5240f',
    ground_room_rate: '3320590d-632d-423f-80d0-fd021cba7293',
    pricing_schedule: 'b0a3104f-7b31-5265-a59f-c2d166f11a23',
    property_party_preview: '443065c0-984a-5de3-a22a-d03042c41107',
  });
  const SEVEN_ARCHES_SOURCE_CONTRACT = 'seven_arches_two_apartments_v1';
  const SEVEN_ARCHES_ROOM_DEFINITIONS = Object.freeze([
    Object.freeze({
      id: SEVEN_ARCHES_SHADOW_IDS.upper_room_type,
      source_key: 'upper_floor_apartment',
      code: 'upper-floor-apartment',
      name_i18n: Object.freeze({
        pl: 'Apartament na piętrze',
        en: 'Upper Floor Apartment',
        he: 'דירה בקומה העליונה',
      }),
      description_i18n: Object.freeze({
        pl: 'Apartament na piętrze z tarasem i balkonem.',
        en: 'Upper-floor apartment with a terrace and balcony.',
        he: 'דירה בקומה העליונה עם טרסה ומרפסת.',
      }),
      amenities: Object.freeze(['air_conditioning', 'balcony', 'terrace']),
      sort_order: 100,
    }),
    Object.freeze({
      id: SEVEN_ARCHES_SHADOW_IDS.ground_room_type,
      source_key: 'ground_floor_apartment',
      code: 'ground-floor-apartment',
      name_i18n: Object.freeze({
        pl: 'Apartament na parterze',
        en: 'Ground Floor Apartment',
        he: 'דירה בקומת הקרקע',
      }),
      description_i18n: Object.freeze({
        pl: 'Apartament na parterze z tarasem, bez balkonu.',
        en: 'Ground-floor apartment with a terrace and no balcony.',
        he: 'דירה בקומת הקרקע עם טרסה וללא מרפסת.',
      }),
      amenities: Object.freeze(['air_conditioning', 'terrace']),
      sort_order: 200,
    }),
  ]);
  const BED_TYPES = Object.freeze([
    'double',
    'single',
    'sofa',
    'bunk',
    'king',
    'queen',
    'other',
  ]);
  const PENALTY_MODES = Object.freeze(['none', 'flat', 'percent']);

  const BED_LABELS = Object.freeze({
    double: 'Double bed',
    single: 'Single bed',
    sofa: 'Sofa bed',
    bunk: 'Bunk bed',
    king: 'King bed',
    queen: 'Queen bed',
    other: 'Other',
  });

  const CALENDAR_PRECEDENCE = Object.freeze([
    Object.freeze({ rank: 1, key: 'safety_closure', label: 'Safety closure' }),
    Object.freeze({ rank: 2, key: 'exact_date_admin_override', label: 'Exact-date Admin override' }),
    Object.freeze({ rank: 3, key: 'highest_priority_range_rule', label: 'Highest-priority seasonal or range rule' }),
    Object.freeze({ rank: 4, key: 'matching_weekday_rule', label: 'Matching weekday rule' }),
    Object.freeze({ rank: 5, key: 'room_rate_base', label: 'Room-rate base rate' }),
  ]);

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asText(value) {
    return String(value == null ? '' : value).trim();
  }

  function asNullableText(value) {
    const text = asText(value);
    return text || null;
  }

  function asInteger(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function asNumber(value, fallback = null) {
    if (value === '' || value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeUuid(value) {
    const text = asText(value).toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text)
      ? text
      : '';
  }

  function newUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    throw new Error('Secure UUID generation is unavailable in this browser.');
  }

  function normalizeI18n(value, options = {}) {
    const source = asObject(value);
    const fallback = asText(options.fallback);
    const result = {};
    LANGUAGES.forEach((language) => {
      const candidate = asText(source[language]);
      if (candidate) result[language] = candidate;
    });
    if (!result.en && fallback) result.en = fallback;
    return result;
  }

  function i18nText(value, language = 'en', fallback = '') {
    if (typeof value === 'string') return asText(value) || fallback;
    const source = normalizeI18n(value);
    const normalizedLanguage = asText(language).toLowerCase();
    return source[normalizedLanguage] || source.en || source.pl || source.he || fallback;
  }

  function normalizeGallery(value) {
    return asArray(value)
      .map((entry) => asText(typeof entry === 'string' ? entry : entry?.url))
      .filter(Boolean)
      .filter((entry, index, rows) => rows.indexOf(entry) === index);
  }

  function normalizeAmenities(value) {
    return asArray(value)
      .map(asText)
      .filter(Boolean)
      .filter((entry, index, rows) => rows.indexOf(entry) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  function normalizeBedConfiguration(value) {
    return asArray(value).map((raw) => {
      const source = asObject(raw);
      const bedType = BED_TYPES.includes(asText(source.type)) ? asText(source.type) : 'other';
      const quantity = asInteger(source.quantity, 0);
      const label = bedType === 'other' ? normalizeI18n(source.label) : {};
      return { type: bedType, quantity, ...(Object.keys(label).length ? { label } : {}) };
    }).filter((entry) => entry.quantity > 0);
  }

  function formatBedConfiguration(value) {
    const beds = normalizeBedConfiguration(value);
    if (!beds.length) return 'Not specified';
    return beds.map((bed) => `${bed.quantity} × ${i18nText(bed.label, 'en', BED_LABELS[bed.type] || 'Bed')}`).join(' · ');
  }

  function normalizeCancellationPolicy(value) {
    const source = asObject(value);
    const type = ['flexible', 'custom', 'non_refundable', 'requires_review'].includes(asText(source.type))
      ? asText(source.type)
      : 'flexible';
    if (type === 'non_refundable') return { type: 'non_refundable' };
    if (type === 'flexible') return { type: 'flexible' };
    if (type === 'requires_review') {
      const summary = normalizeI18n(source.summary_i18n);
      return {
        type: 'requires_review',
        reason: asText(source.reason),
        ...(Object.keys(summary).length ? { summary_i18n: summary } : {}),
      };
    }

    const deadlineHours = asInteger(source.deadline_hours, 0);
    const legacyPenalty = asObject(source.penalty);
    const requestedMode = asText(source.penalty_mode || legacyPenalty.mode);
    const penaltyMode = PENALTY_MODES.includes(requestedMode) && requestedMode !== 'first_night' ? requestedMode : 'none';
    const penaltyValue = asNumber(source.penalty_value ?? legacyPenalty.value, null);
    const normalized = {
      type: 'custom',
      deadline_hours: Math.max(0, deadlineHours),
      penalty_mode: penaltyMode,
    };
    if (['flat', 'percent'].includes(penaltyMode) && penaltyValue != null) {
      normalized.penalty_value = penaltyValue;
    }
    const summary = normalizeI18n(source.summary_i18n);
    if (Object.keys(summary).length) normalized.summary_i18n = summary;
    return normalized;
  }

  function normalizeChildrenPolicy(policy, minimumAge, options = {}) {
    const allowInherit = options.allowInherit === true;
    const normalizedPolicy = asText(policy).toLowerCase();
    if (allowInherit && !normalizedPolicy) {
      if (minimumAge != null && minimumAge !== '') {
        throw new Error('A child age cannot be stored while the Room Type uses the property policy.');
      }
      return { policy: null, minimum_age: null };
    }
    if (!CHILDREN_POLICIES.includes(normalizedPolicy)) {
      throw new Error('Choose a valid children policy.');
    }
    if (normalizedPolicy !== 'minimum_age') {
      if (minimumAge != null && minimumAge !== '') {
        throw new Error('Minimum child age is available only with Allowed from age.');
      }
      return { policy: normalizedPolicy, minimum_age: null };
    }
    if (minimumAge == null || minimumAge === '') {
      throw new Error(`Minimum child age must be a whole number from ${CHILD_AGE_MIN} to ${CHILD_AGE_MAX}.`);
    }
    const age = Number(minimumAge);
    if (!Number.isInteger(age) || age < CHILD_AGE_MIN || age > CHILD_AGE_MAX) {
      throw new Error(`Minimum child age must be a whole number from ${CHILD_AGE_MIN} to ${CHILD_AGE_MAX}.`);
    }
    return { policy: normalizedPolicy, minimum_age: age };
  }

  function resolveChildrenPolicy(property, roomType = null) {
    const override = asText(roomType?.children_policy_override);
    if (override) {
      const roomPolicy = normalizeChildrenPolicy(override, roomType?.minimum_child_age_override, { allowInherit: true });
      return { ...roomPolicy, source: 'room_type' };
    }
    if (!asText(property?.children_policy)) throw new Error('Property children policy has not been reviewed.');
    const propertyPolicy = normalizeChildrenPolicy(property.children_policy, property.minimum_child_age);
    return { ...propertyPolicy, source: 'property' };
  }

  function childrenPolicyLabel(policy, minimumAge) {
    const normalized = normalizeChildrenPolicy(policy, minimumAge);
    if (normalized.policy === 'not_allowed') return 'Adults only / No children';
    if (normalized.policy === 'minimum_age') return `Children allowed from age ${normalized.minimum_age}`;
    return 'Children allowed';
  }

  function sevenArchesShadowPreparation(workspace) {
    const normalized = normalizeWorkspace(workspace);
    if (normalized.property.id !== SEVEN_ARCHES_PROPERTY_ID) {
      return { eligible: false, blocker: 'This reviewed preparation is available only for the exact 7 Arches property.' };
    }
    if (normalized.property.architecture_version !== 'legacy') {
      return { eligible: false, blocker: '7 Arches is no longer a legacy property. Stop and review its architecture state.' };
    }
    const expectedIds = new Set([
      SEVEN_ARCHES_SHADOW_IDS.upper_room_type,
      SEVEN_ARCHES_SHADOW_IDS.ground_room_type,
    ]);
    const unexpectedRooms = normalized.room_types.filter((room) => !expectedIds.has(room.id));
    if (unexpectedRooms.length) {
      return {
        eligible: false,
        blocker: 'Unexpected normalized Room Types already exist. Review them before preparing the confirmed two-apartment package.',
        unexpected_room_ids: unexpectedRooms.map((room) => room.id),
      };
    }
    const gallery = normalizeGallery(normalized.property.photos);
    const catalogCodes = new Set(normalized.amenities_catalog.map((entry) => asText(entry.code)));
    const requiredAmenities = ['air_conditioning', 'balcony', 'terrace'];
    const missingAmenities = requiredAmenities.filter((code) => !catalogCodes.has(code));
    if (missingAmenities.length) {
      return {
        eligible: false,
        blocker: `Required amenity catalogue entries are missing: ${missingAmenities.join(', ')}.`,
        missing_amenities: missingAmenities,
      };
    }
    const rooms = SEVEN_ARCHES_ROOM_DEFINITIONS.map((definition) => {
      const existing = normalized.room_types.find((room) => room.id === definition.id);
      return normalizeRoomType({
        ...(existing || {}),
        id: definition.id,
        hotel_id: SEVEN_ARCHES_PROPERTY_ID,
        code: definition.code,
        name_i18n: existing?.name_i18n || definition.name_i18n,
        description_i18n: definition.description_i18n,
        gallery: existing?.gallery || [],
        capacity_adults: null,
        capacity_children: null,
        max_occupancy: 4,
        children_policy_override: null,
        minimum_child_age_override: null,
        bed_configuration: [],
        bathrooms: null,
        size_sqm: null,
        amenities: definition.amenities,
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        // This is the normalized configuration status, not public eligibility.
        // Existing reviewed Room Types may legitimately be active while the
        // legacy property and disabled V2 capabilities keep them public-inert.
        status: existing?.status || 'draft',
        sort_order: definition.sort_order,
        version: existing?.version || 1,
        created_at: existing?.created_at || null,
        updated_at: existing?.updated_at || null,
      });
    });
    return {
      eligible: true,
      hotel_id: SEVEN_ARCHES_PROPERTY_ID,
      source_contract: SEVEN_ARCHES_SOURCE_CONTRACT,
      property_policy: { children_policy: 'minimum_age', minimum_child_age: 10 },
      property_gallery: gallery,
      rooms,
      pricing: {
        status: 'BLOCKED_PENDING_CANCELLATION_REVIEW',
        shared_rate_plan_label: 'Standard',
        source_rule_count: 63,
        legacy_public_unchanged: true,
      },
      public_change: false,
    };
  }

  function sevenArchesExpectedOriginalRoom(room) {
    if (!room) return null;
    return {
      hotel_id: room.hotel_id,
      source_key: room.legacy_source_key,
      code: room.code,
      name_i18n: clone(room.name_i18n),
      description_i18n: clone(room.description_i18n),
      gallery: clone(room.gallery),
      amenities: normalizeAmenities(room.amenities),
      max_occupancy: room.max_occupancy,
      capacity_adults: room.capacity_adults,
      capacity_children: room.capacity_children,
      inventory_mode: room.inventory_mode,
      base_inventory_count: room.base_inventory_count,
      sort_order: room.sort_order,
    };
  }

  function sevenArchesShadowReconciliation(originalWorkspace, freshWorkspace, options = {}) {
    const original = normalizeWorkspace(originalWorkspace);
    const fresh = normalizeWorkspace(freshWorkspace);
    const preparation = sevenArchesShadowPreparation(fresh);
    const blockers = preparation.eligible ? [] : [preparation.blocker || 'The two-apartment preparation is no longer eligible.'];
    const changes = [];
    const conflicts = [];
    const safeRebases = [];
    const normalizedOptions = Array.isArray(options) ? { roomReviews: options } : asObject(options);
    const roomReviews = asArray(normalizedOptions.roomReviews || normalizedOptions.room_reviews);
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    const addChange = (scope, field, before, after) => {
      if (!same(before, after)) changes.push({ scope, field, before: clone(before), after: clone(after) });
    };
    const classify = ({ scope, entityId, field, label, originalValue, currentValue, targetValue }) => {
      const detail = {
        scope,
        entity_id: entityId || null,
        field,
        label,
        original: clone(originalValue),
        current: clone(currentValue),
        target: clone(targetValue),
      };
      if (same(currentValue, targetValue)) {
        if (!same(originalValue, currentValue)) {
          safeRebases.push({ ...detail, reason: 'current_equals_target' });
        }
        return;
      }
      if (same(currentValue, originalValue)) {
        safeRebases.push({ ...detail, reason: 'current_equals_original' });
        return;
      }
      conflicts.push(detail);
    };
    const propertyBusinessValues = (workspaceValue) => ({
      architecture_version: workspaceValue.property.architecture_version,
      children_policy: workspaceValue.property.children_policy,
      minimum_child_age: workspaceValue.property.minimum_child_age,
      property_gallery: normalizeGallery(workspaceValue.property.photos),
      legacy_pricing_fingerprint: asText(workspaceValue.legacy_shadow_preview?.legacy_pricing_fingerprint) || null,
    });
    const originalProperty = propertyBusinessValues(original);
    const freshProperty = propertyBusinessValues(fresh);
    Object.keys(originalProperty).forEach((field) => {
      addChange('Property', field, originalProperty[field], freshProperty[field]);
    });

    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'children_policy',
      label: 'Children policy',
      originalValue: originalProperty.children_policy,
      currentValue: freshProperty.children_policy,
      targetValue: 'minimum_age',
    });
    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'minimum_child_age',
      label: 'Minimum child age',
      originalValue: originalProperty.minimum_child_age,
      currentValue: freshProperty.minimum_child_age,
      targetValue: 10,
    });
    classify({
      scope: 'Property',
      entityId: SEVEN_ARCHES_PROPERTY_ID,
      field: 'legacy_pricing_fingerprint',
      label: 'Legacy pricing fingerprint',
      originalValue: originalProperty.legacy_pricing_fingerprint,
      currentValue: freshProperty.legacy_pricing_fingerprint,
      targetValue: originalProperty.legacy_pricing_fingerprint,
    });

    const roomBusinessValues = (room) => room ? {
      name_i18n: clone(room.name_i18n),
      gallery: clone(room.gallery),
      status: room.status,
      code: room.code,
      legacy_source_key: room.legacy_source_key,
      max_occupancy: room.max_occupancy,
      capacity_adults: room.capacity_adults,
      capacity_children: room.capacity_children,
      inventory_mode: room.inventory_mode,
      base_inventory_count: room.base_inventory_count,
      amenities: [...room.amenities].sort(),
      bed_configuration: clone(room.bed_configuration),
      bathrooms: room.bathrooms,
      size_sqm: room.size_sqm,
      sort_order: room.sort_order,
    } : null;

    SEVEN_ARCHES_ROOM_DEFINITIONS.forEach((definition) => {
      const originalRoom = original.room_types.find((room) => room.id === definition.id) || null;
      const freshRoom = fresh.room_types.find((room) => room.id === definition.id) || null;
      const label = i18nText(definition.name_i18n, 'en', definition.code);
      const originalBusiness = roomBusinessValues(originalRoom);
      const freshBusiness = roomBusinessValues(freshRoom);
      if (!same(originalBusiness, freshBusiness)) {
        const fields = new Set([
          ...Object.keys(originalBusiness || {}),
          ...Object.keys(freshBusiness || {}),
        ]);
        fields.forEach((field) => addChange(label, field, originalBusiness?.[field], freshBusiness?.[field]));
      }
      if (!freshRoom) {
        if (originalRoom) {
          conflicts.push({
            scope: label,
            entity_id: definition.id,
            field: 'room_type',
            label: 'Room Type existence',
            original: sevenArchesExpectedOriginalRoom(originalRoom),
            current: null,
            target: { id: definition.id, source_key: definition.source_key, code: definition.code },
          });
        }
        return;
      }

      const identityFields = [
        ['hotel_id', 'Property identity', SEVEN_ARCHES_PROPERTY_ID],
        ['legacy_source_key', 'Source identity', definition.source_key],
        ['code', 'Room code', definition.code],
      ];
      identityFields.forEach(([field, fieldLabel, targetValue]) => {
        // The original H2B.1 RPC deliberately accepts an unset legacy source
        // key for an already-known deterministic Room Type ID. A conflicting
        // non-null key remains an identity failure and is never three-way
        // merged into another source relationship.
        if (field === 'legacy_source_key' && freshRoom[field] == null) return;
        if (same(freshRoom[field], targetValue)) return;
        conflicts.push({
          scope: label,
          entity_id: definition.id,
          field,
          label: fieldLabel,
          original: clone(originalRoom?.[field]),
          current: clone(freshRoom[field]),
          target: clone(targetValue),
          identity_conflict: true,
        });
      });

      const review = roomReviews.find((entry) => normalizeUuid(entry?.id) === definition.id);
      const targetRoom = {
        name_i18n: normalizeI18n(review?.name_i18n || freshRoom.name_i18n || definition.name_i18n),
        description_i18n: normalizeI18n(definition.description_i18n),
        gallery: normalizeGallery(review?.gallery == null ? freshRoom.gallery : review.gallery),
        amenities: normalizeAmenities(definition.amenities),
        max_occupancy: 4,
        capacity_adults: null,
        capacity_children: null,
        inventory_mode: 'pooled',
        base_inventory_count: 1,
        sort_order: definition.sort_order,
      };
      const mergeFields = [
        ['name_i18n', 'Room name'],
        ['description_i18n', 'Room description'],
        ['gallery', 'Room gallery'],
        ['amenities', 'confirmed amenities'],
        ['max_occupancy', 'Capacity contract (maximum occupancy)'],
        ['capacity_adults', 'Capacity contract (adults)'],
        ['capacity_children', 'Capacity contract (children)'],
        ['inventory_mode', 'Inventory mode'],
        ['base_inventory_count', 'Inventory count'],
        ['sort_order', 'Display order'],
      ];
      mergeFields.forEach(([field, fieldLabel]) => {
        classify({
          scope: label,
          entityId: definition.id,
          field,
          label: fieldLabel,
          originalValue: originalRoom?.[field],
          currentValue: freshRoom[field],
          targetValue: targetRoom[field],
        });
      });
    });

    conflicts.forEach((conflict) => {
      blockers.push(`${conflict.scope} has a reviewed ${conflict.label.toLowerCase()} conflict: current and requested values both differ from the original review.`);
    });

    return {
      eligible: preparation.eligible && blockers.length === 0 && conflicts.length === 0,
      blocker: blockers[0] || null,
      blockers,
      changes,
      conflicts,
      safe_rebases: safeRebases,
    };
  }

  function buildSevenArchesShadowPlan(workspace, roomReviews, options = {}) {
    const preparation = sevenArchesShadowPreparation(workspace);
    if (!preparation.eligible) throw new Error(preparation.blocker);
    const normalizedWorkspace = normalizeWorkspace(workspace);
    const reviews = asArray(roomReviews);
    if (reviews.length !== 2) throw new Error('Exactly two reviewed 7 Arches apartments are required.');
    const propertyGallery = new Set(preparation.property_gallery);
    const rooms = preparation.rooms.map((room) => {
      const reviewed = reviews.find((entry) => normalizeUuid(entry.id) === room.id);
      if (!reviewed) throw new Error(`Missing reviewed apartment ${room.code}.`);
      const name = normalizeI18n(reviewed.name_i18n);
      if (LANGUAGES.some((language) => !asText(name[language]))) {
        throw new Error(`${i18nText(room.name_i18n, 'en', room.code)} needs PL, EN and HE names.`);
      }
      const selectedPhotos = normalizeGallery(reviewed.gallery);
      if (!selectedPhotos.length) throw new Error(`${i18nText(name, 'en', room.code)} needs at least one reviewed room photo.`);
      if (selectedPhotos.some((url) => !propertyGallery.has(url))) {
        throw new Error('Room photos must be selected from the current 7 Arches property gallery.');
      }
      const existing = normalizedWorkspace.room_types.find((candidate) => candidate.id === room.id);
      return {
        id: room.id,
        expected_version: existing ? existing.version : 0,
        ...(existing ? { expected_original: sevenArchesExpectedOriginalRoom(existing) } : {}),
        source_key: SEVEN_ARCHES_ROOM_DEFINITIONS.find((definition) => definition.id === room.id).source_key,
        code: room.code,
        name_i18n: name,
        description_i18n: clone(room.description_i18n),
        gallery: selectedPhotos,
        amenities: clone(room.amenities),
        max_occupancy: 4,
        sort_order: room.sort_order,
      };
    });
    const currentVersion = (rows, id) => Math.max(0, asInteger(asArray(rows).find((row) => normalizeUuid(row?.id) === id)?.version, 0));
    const legacyFingerprint = asText(normalizedWorkspace.legacy_shadow_preview?.legacy_pricing_fingerprint);
    if (!legacyFingerprint) throw new Error('The server did not return the reviewed legacy pricing fingerprint. Refresh after deploying the H2B.1 SQL foundation.');
    return {
      hotel_id: SEVEN_ARCHES_PROPERTY_ID,
      expected_property_updated_at: normalizedWorkspace.property.updated_at || null,
      expected_property_policy: {
        children_policy: normalizedWorkspace.property.children_policy || null,
        minimum_child_age: normalizedWorkspace.property.minimum_child_age == null
          ? null
          : normalizedWorkspace.property.minimum_child_age,
      },
      expected_legacy_pricing_fingerprint: legacyFingerprint,
      expected_versions: {
        upper_room: currentVersion(normalizedWorkspace.room_types, SEVEN_ARCHES_SHADOW_IDS.upper_room_type),
        ground_room: currentVersion(normalizedWorkspace.room_types, SEVEN_ARCHES_SHADOW_IDS.ground_room_type),
        pricing_schedule: currentVersion(normalizedWorkspace.pricing_schedules, SEVEN_ARCHES_SHADOW_IDS.pricing_schedule),
        property_party_preview: currentVersion(normalizedWorkspace.pricing_schedules, SEVEN_ARCHES_SHADOW_IDS.property_party_preview),
        rate_plan: currentVersion(normalizedWorkspace.rate_plans, SEVEN_ARCHES_SHADOW_IDS.rate_plan),
        upper_room_rate: currentVersion(normalizedWorkspace.room_rates, SEVEN_ARCHES_SHADOW_IDS.upper_room_rate),
        ground_room_rate: currentVersion(normalizedWorkspace.room_rates, SEVEN_ARCHES_SHADOW_IDS.ground_room_rate),
      },
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      source_contract: SEVEN_ARCHES_SOURCE_CONTRACT,
      property_policy: clone(preparation.property_policy),
      rooms,
      prepare_pricing_preview: true,
    };
  }

  function cancellationPolicyLabel(value) {
    const policy = normalizeCancellationPolicy(value);
    if (policy.type === 'non_refundable') return 'Non-refundable';
    if (policy.type === 'flexible') return 'Flexible';
    if (policy.type === 'requires_review') {
      return i18nText(policy.summary_i18n, 'en', 'Cancellation terms require review');
    }
    const deadline = `${policy.deadline_hours}h deadline`;
    if (policy.penalty_mode === 'percent') return `Custom · ${deadline} · ${policy.penalty_value || 0}%`;
    if (policy.penalty_mode === 'flat') return `Custom · ${deadline} · fixed ${policy.penalty_value || 0}`;
    return `Custom · ${deadline}`;
  }

  function normalizeRoomType(value) {
    const source = asObject(value);
    const capacityAdults = source.capacity_adults == null ? null : asInteger(source.capacity_adults, 0);
    const capacityChildren = source.capacity_children == null ? null : asInteger(source.capacity_children, 0);
    const inferredTotal = capacityAdults == null || capacityChildren == null ? null : capacityAdults + capacityChildren;
    const explicitTotal = source.max_occupancy == null ? null : asInteger(source.max_occupancy, 0);
    const roomChildrenPolicy = asText(source.children_policy_override);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      legacy_source_key: asNullableText(source.legacy_source_key)?.toLowerCase() || null,
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: normalizeI18n(source.description_i18n),
      gallery: normalizeGallery(source.gallery),
      capacity_adults: capacityAdults,
      capacity_children: capacityChildren,
      max_occupancy: explicitTotal,
      effective_max_occupancy: explicitTotal == null ? inferredTotal : explicitTotal,
      children_policy_override: ROOM_CHILDREN_POLICY_OVERRIDES.includes(roomChildrenPolicy) ? roomChildrenPolicy : null,
      minimum_child_age_override: roomChildrenPolicy === 'minimum_age'
        ? asInteger(source.minimum_child_age_override, -1)
        : null,
      bed_configuration: normalizeBedConfiguration(source.bed_configuration),
      bathrooms: asNumber(source.bathrooms, null),
      size_sqm: asNumber(source.size_sqm, null),
      amenities: normalizeAmenities(source.amenities),
      inventory_mode: INVENTORY_MODES.includes(asText(source.inventory_mode)) ? asText(source.inventory_mode) : 'pooled',
      base_inventory_count: asInteger(source.base_inventory_count, 0),
      status: ROOM_STATUSES.includes(asText(source.status)) ? asText(source.status) : 'draft',
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeUnit(value) {
    const source = asObject(value);
    return {
      id: normalizeUuid(source.id),
      room_type_id: normalizeUuid(source.room_type_id),
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      status: UNIT_STATUSES.includes(asText(source.status)) ? asText(source.status) : 'active',
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeRatePlan(value) {
    const source = asObject(value);
    const bookingOverride = asNullableText(source.booking_mode_override);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      code: asText(source.code).toLowerCase(),
      name_i18n: normalizeI18n(source.name_i18n),
      description_i18n: normalizeI18n(source.description_i18n),
      meal_plan_code: asNullableText(source.meal_plan_code)?.toLowerCase() || null,
      cancellation_policy: normalizeCancellationPolicy(source.cancellation_policy),
      booking_mode_override: BOOKING_MODES.includes(bookingOverride) ? bookingOverride : null,
      is_active: source.is_active === true,
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function normalizeRoomRate(value) {
    const source = asObject(value);
    return {
      id: normalizeUuid(source.id),
      hotel_id: normalizeUuid(source.hotel_id),
      room_type_id: normalizeUuid(source.room_type_id),
      rate_plan_id: normalizeUuid(source.rate_plan_id),
      pricing_schedule_id: normalizeUuid(source.pricing_schedule_id) || null,
      base_nightly_rate: asNumber(source.base_nightly_rate, null),
      currency: (asText(source.currency) || 'EUR').toUpperCase(),
      external_redirect_url: asNullableText(source.external_redirect_url),
      is_active: source.is_active === true,
      sort_order: Math.max(0, asInteger(source.sort_order, 1000)),
      version: Math.max(1, asInteger(source.version, 1)),
      created_at: source.created_at || null,
      updated_at: source.updated_at || null,
    };
  }

  function sharedScheduleCalendarDisplayState(product, stayDate, exactOverride = null, dailyInventory = null, options = {}) {
    const rate = asObject(product);
    const roomRateId = normalizeUuid(rate.id);
    const roomTypeId = normalizeUuid(rate.room_type_id);
    const scheduleId = normalizeUuid(rate.pricing_schedule_id);
    const date = asText(stayDate);
    if (!scheduleId) return null;
    if (!roomRateId || !roomTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Shared schedule Calendar state requires exact Room Type, Room Rate and stay-date identifiers.');
    }

    const asOfValue = options.asOf || new Date().toISOString();
    const asOf = Date.parse(asOfValue);
    const isCurrent = (row, { allowInactive = false } = {}) => {
      const source = asObject(row);
      if (!Object.keys(source).length) return false;
      if (!allowInactive && source.is_active === false) return false;
      if (!source.expires_at) return true;
      const expiry = Date.parse(source.expires_at);
      return Number.isFinite(asOf) && Number.isFinite(expiry) && expiry > asOf;
    };
    const overrideSource = asObject(exactOverride);
    const inventorySource = asObject(dailyInventory);
    const overrideMatches = normalizeUuid(overrideSource.room_rate_id) === roomRateId
      && asText(overrideSource.stay_date) === date
      && isCurrent(overrideSource);
    const inventoryMatches = normalizeUuid(inventorySource.room_type_id) === roomTypeId
      && asText(inventorySource.stay_date) === date
      && isCurrent(inventorySource, { allowInactive: true });
    const override = overrideMatches ? overrideSource : null;
    const inventory = inventoryMatches ? inventorySource : null;
    const modeValue = (row, field) => {
      const mode = row && ['set', 'clear'].includes(asText(row[`${field}_mode`]))
        ? asText(row[`${field}_mode`])
        : null;
      return {
        mode,
        value: mode === 'set' ? row[field] : null,
      };
    };
    const nightlyRate = modeValue(override, 'nightly_rate');
    const minimumStay = modeValue(override, 'minimum_stay');
    const maximumStay = modeValue(override, 'maximum_stay');
    const rateClosed = modeValue(override, 'closed');
    const closedToArrival = modeValue(override, 'closed_to_arrival');
    const closedToDeparture = modeValue(override, 'closed_to_departure');
    const sellableUnits = modeValue(inventory, 'sellable_units');
    const inventoryClosed = modeValue(inventory, 'closed');
    const baseInventory = Math.max(0, asInteger(rate.base_inventory_count, 0));

    return {
      kind: 'shared_schedule_shadow',
      authoritative: false,
      requestable: false,
      blocker: 'shared_room_pricing_schedule_requires_h3_resolution',
      room_rate_id: roomRateId,
      room_type_id: roomTypeId,
      pricing_schedule_id: scheduleId,
      stay_date: date,
      exact_override_id: override ? normalizeUuid(override.id) || null : null,
      exact_override_version: override ? Math.max(1, asInteger(override.version, 1)) : null,
      inventory_version: inventory ? Math.max(1, asInteger(inventory.version, 1)) : null,
      nightly_rate: nightlyRate,
      minimum_stay: minimumStay,
      maximum_stay: maximumStay,
      closed: rateClosed,
      closed_to_arrival: closedToArrival,
      closed_to_departure: closedToDeparture,
      sellable_units: sellableUnits,
      inventory_closed: inventoryClosed,
      configured_inventory: sellableUnits.mode === 'set'
        ? Math.max(0, asInteger(sellableUnits.value, 0))
        : baseInventory,
      inventory_source: sellableUnits.mode === 'set' ? 'exact_room_date' : 'room_base',
      explicitly_closed: (inventoryClosed.mode === 'set' && inventoryClosed.value === true)
        || (rateClosed.mode === 'set' && rateClosed.value === true),
    };
  }

  function normalizeWorkspace(value) {
    const source = asObject(value);
    const property = asObject(source.property);
    const ownerPartner = asObject(source.owner_partner);
    return {
      property: {
        ...clone(property),
        id: normalizeUuid(property.id),
        architecture_version: asText(property.architecture_version) || 'legacy',
        booking_mode: asText(property.booking_mode) || 'request_confirmation',
        timezone: asText(property.timezone) || 'Europe/Nicosia',
        currency: (asText(property.currency) || 'EUR').toUpperCase(),
        children_policy: CHILDREN_POLICIES.includes(asText(property.children_policy))
          ? asText(property.children_policy)
          : null,
        minimum_child_age: asText(property.children_policy) === 'minimum_age'
          ? asInteger(property.minimum_child_age, -1)
          : null,
        title: normalizeI18n(property.title_i18n || property.title),
        title_i18n: normalizeI18n(property.title_i18n || property.title),
        description: normalizeI18n(property.description_i18n || property.description),
        description_i18n: normalizeI18n(property.description_i18n || property.description),
        amenities: normalizeAmenities(property.amenities),
        photos: normalizeGallery(property.photos),
        owner_partner: Object.keys(ownerPartner).length ? clone(ownerPartner) : clone(property.owner_partner || {}),
      },
      room_types: asArray(source.room_types).map(normalizeRoomType),
      units: asArray(source.units).map(normalizeUnit),
      rate_plans: asArray(source.rate_plans).map(normalizeRatePlan),
      room_rates: asArray(source.room_rates).map(normalizeRoomRate),
      pricing_schedules: asArray(source.pricing_schedules).map((entry) => clone(entry)),
      pricing_schedule_tiers: asArray(source.pricing_schedule_tiers).map((entry) => clone(entry)),
      legacy_shadow_preview: clone(source.legacy_shadow_preview || {}),
      amenities_catalog: asArray(source.amenities_catalog || source.amenities_catalogue).map((entry) => clone(entry)),
      partners: asArray(source.partners).map((entry) => clone(entry)),
      operational_partners: asArray(source.operational_partners).map((entry) => clone(entry)),
      payment_due: clone(source.payment_due || source.payment_due_at_booking || {}),
      counts: clone(source.counts || { upcoming_bookings: source.upcoming_booking_count || 0 }),
      flags: clone(source.flags || source.feature_flags || {}),
      activity: asArray(source.activity || source.recent_activity).map((entry) => clone(entry)),
      readiness: clone(source.readiness || {}),
    };
  }

  function totalConfiguredInventory(workspace) {
    const normalized = normalizeWorkspace(workspace);
    return normalized.room_types.reduce((total, room) => {
      if (room.status === 'disabled') return total;
      if (room.inventory_mode === 'unitized') {
        return total + normalized.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length;
      }
      return total + Math.max(0, room.base_inventory_count);
    }, 0);
  }

  function deriveWorkspaceReadiness(workspace) {
    const normalized = normalizeWorkspace(workspace);
    const property = normalized.property;
    const activeRooms = normalized.room_types.filter((room) => room.status === 'active');
    const activePlans = normalized.rate_plans.filter((plan) => plan.is_active);
    const activeRates = normalized.room_rates.filter((rate) => rate.is_active);
    const hasConfiguration = normalized.room_types.length > 0 || normalized.rate_plans.length > 0 || normalized.room_rates.length > 0;
    const blockers = [];
    const warnings = [];

    if (!i18nText(property.title, 'en')) blockers.push('Property name is missing.');
    if (!asText(property.city)) blockers.push('City is missing.');
    if (!asText(property.timezone)) blockers.push('Timezone is missing.');
    if (!/^[A-Z]{3}$/.test(asText(property.currency))) blockers.push('Currency must be a three-letter code.');
    if (!BOOKING_MODES.includes(asText(property.booking_mode))) blockers.push('Booking mode is invalid.');
    if (!activeRooms.length) blockers.push('Add at least one active Room Type.');
    if (activeRooms.some((room) => !Number.isInteger(room.effective_max_occupancy) || room.effective_max_occupancy < 1)) {
      blockers.push('Every active Room Type needs valid guest capacity.');
    }
    if (activeRooms.length && !asText(property.children_policy)
        && !activeRooms.every((room) => asText(room.children_policy_override))) {
      blockers.push('Review the property children policy or configure every active Room Type override.');
    }
    activeRooms.forEach((room) => {
      try {
        resolveChildrenPolicy(property, room);
      } catch (_error) {
        blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} has an invalid children policy.`);
      }
    });
    activeRooms.forEach((room) => {
      if (room.inventory_mode === 'pooled' && room.base_inventory_count < 1) {
        blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} needs pooled inventory.`);
      }
      if (room.inventory_mode === 'unitized') {
        const activeUnitCount = normalized.units.filter((unit) => unit.room_type_id === room.id && unit.status === 'active').length;
        if (activeUnitCount < 1) blockers.push(`${i18nText(room.name_i18n, 'en', room.code)} needs at least one active physical unit.`);
      }
    });
    if (!activePlans.length) blockers.push('Add at least one active Rate Plan.');
    if (activePlans.some((plan) => plan.cancellation_policy?.type === 'requires_review')) {
      blockers.push('Confirm cancellation terms before activating the Rate Plan.');
    }
    if (activeRates.some((rate) => rate.pricing_schedule_id)) {
      blockers.push('Shared pricing schedules require the H3 allocation review before activation.');
    }
    const sellableRates = activeRates.filter((rate) => Number.isFinite(rate.base_nightly_rate) && rate.base_nightly_rate > 0);
    if (!sellableRates.length) blockers.push('Create at least one active Room + Rate Plan product with a positive base rate.');
    sellableRates.forEach((rate) => {
      const room = activeRooms.find((candidate) => candidate.id === rate.room_type_id);
      const plan = activePlans.find((candidate) => candidate.id === rate.rate_plan_id);
      if (!room || !plan) blockers.push('An active room-rate product references an inactive Room Type or Rate Plan.');
      if (rate.hotel_id && rate.hotel_id !== property.id) blockers.push('A room-rate product belongs to another property.');
    });

    const embeddedOwner = asObject(property.owner_partner);
    const ownerPartner = Object.keys(embeddedOwner).length
      ? embeddedOwner
      : asObject(normalized.partners.find((entry) => entry.id === property.owner_partner_id));
    const validOwner = Boolean(
      normalizeUuid(property.owner_partner_id)
      && ownerPartner.status === 'active'
      && ownerPartner.can_manage_hotels === true
    );
    const validOperationalPartner = normalized.operational_partners.some((entry) => (
      entry.is_active === true
      && entry.status === 'active'
      && entry.can_manage_hotels === true
    ));
    if (!validOwner && !validOperationalPartner) blockers.push('Assign an active Hotel partner before Calendar readiness.');
    if (!normalizeUuid(property.owner_partner_id) && validOperationalPartner) {
      warnings.push('Commercial owner is not assigned; an operational Hotel partner currently satisfies readiness.');
    } else if (normalizeUuid(property.owner_partner_id) && !validOwner && validOperationalPartner) {
      warnings.push('Commercial owner is not eligible; an operational Hotel partner currently satisfies readiness.');
    }

    let preparationState = 'DRAFT';
    if (hasConfiguration && blockers.length) preparationState = 'BLOCKED';
    if (hasConfiguration && !blockers.length) preparationState = 'READY_FOR_CALENDAR';
    const publicState = property.architecture_version === 'legacy' ? 'LEGACY' : preparationState;

    return {
      state: publicState,
      label: publicState === 'READY_FOR_CALENDAR' ? 'READY FOR CALENDAR' : publicState,
      preparation_state: preparationState,
      preparation_label: preparationState === 'READY_FOR_CALENDAR' ? 'READY FOR CALENDAR' : preparationState,
      blockers: Array.from(new Set(blockers)),
      warnings: Array.from(new Set(warnings)),
      has_configuration: hasConfiguration,
      room_type_count: normalized.room_types.length,
      active_room_type_count: activeRooms.length,
      active_rate_plan_count: activePlans.length,
      active_room_rate_count: activeRates.length,
      total_inventory: totalConfiguredInventory(normalized),
      ready_for_calendar: hasConfiguration && blockers.length === 0,
      public_live: false,
    };
  }

  function migrationPreview(workspace) {
    const normalized = normalizeWorkspace(workspace);
    const property = normalized.property;
    const legacyRooms = asArray(property.room_types);
    const rules = asArray(asObject(property.pricing_tiers).rules);
    const propertyPhotos = normalizeGallery(property.photos);
    const propertyAmenities = normalizeAmenities(property.amenities);
    const guestCounts = Array.from(new Set(rules
      .map((rule) => asInteger(rule?.persons, 0))
      .filter((value) => value > 0))).sort((a, b) => a - b);
    const stayThresholds = Array.from(new Set(rules
      .map((rule) => asInteger(rule?.min_nights, 0))
      .filter((value) => value > 0))).sort((a, b) => a - b);
    const isSevenArchesMatrix = (
      property.id === '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      || asText(property.slug) === '7-ukow'
    ) && rules.length === 63
      && guestCounts.join(',') === '2,3,4,5,6,7,8'
      && stayThresholds.join(',') === '2,3,4,5,6,7,8,9,10';
    const requiresOccupancyLosModel = guestCounts.length > 1 || stayThresholds.length > 1;
    const hasPropertyLevelAccommodation = (
      property.architecture_version === 'legacy'
      && legacyRooms.length === 0
      && rules.length > 0
    );
    const liveProductCount = legacyRooms.length || (hasPropertyLevelAccommodation ? 1 : 0);
    const suggestions = legacyRooms.map((legacyRoom, index) => ({
      source_index: index,
      proposed_code: asText(legacyRoom.id || legacyRoom.code || `legacy-room-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
      proposed_name: normalizeI18n(legacyRoom.name || legacyRoom.title, { fallback: `Legacy room ${index + 1}` }),
      status: 'not_migrated',
    }));
    const fieldClassifications = hasPropertyLevelAccommodation ? [
      {
        field: 'Property relationship',
        target_field: 'hotel_id',
        classification: 'SAFE_TO_COPY',
        source_summary: property.id,
        note: 'The shadow Room Type belongs to this exact property.',
      },
      {
        field: 'Normalized configuration status',
        target_field: 'status',
        classification: 'SAFE_TO_COPY',
        source_summary: 'Independent from public eligibility',
        note: 'A new shadow starts as draft; an existing reviewed active status is preserved. Both remain public-inert while the property is legacy and V2 capabilities are off.',
      },
      {
        field: 'Currency',
        target_field: 'future Room Rate currency',
        classification: 'SAFE_TO_COPY',
        source_summary: property.currency,
        note: 'Currency may be carried into the separately reviewed pricing product; no Room Rate is created now.',
      },
      {
        field: 'Room name and description',
        target_field: 'name_i18n / description_i18n',
        classification: 'REQUIRES_REVIEW',
        source_summary: i18nText(property.title, 'en', property.slug || property.id),
        note: 'Current text describes the property and must not be assumed to be the physical room name or room-only description.',
      },
      {
        field: 'Guest capacity',
        target_field: 'capacity_adults / capacity_children',
        classification: 'REQUIRES_REVIEW',
        source_summary: Number(property.max_persons) > 0
          ? `Legacy booking maximum: ${Number(property.max_persons)} guests`
          : 'No legacy booking maximum',
        note: 'A property-level booking maximum may span more than one accommodation and is not copied as Room Type capacity.',
      },
      {
        field: 'Property gallery',
        target_field: 'gallery',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${propertyPhotos.length} property photo${propertyPhotos.length === 1 ? '' : 's'}`,
        note: 'Every photo remains property media. Admin may explicitly select only photos confirmed for this Room Type.',
      },
      {
        field: 'Property amenities',
        target_field: 'amenities',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${propertyAmenities.length} property amenit${propertyAmenities.length === 1 ? 'y' : 'ies'}`,
        note: 'Property amenities are shown as context but are not copied into the room automatically.',
      },
      {
        field: 'Legacy pricing matrix',
        target_field: 'future Room Rate / pricing rules',
        classification: 'REQUIRES_REVIEW',
        source_summary: `${rules.length} legacy pricing rule${rules.length === 1 ? '' : 's'}`,
        note: 'Safe to preview, but pricing conversion is a separate reviewed step with a zero-mismatch oracle.',
      },
      {
        field: 'Physical inventory',
        target_field: 'inventory_mode / base_inventory_count',
        classification: 'UNKNOWN',
        source_summary: 'Not represented structurally in the legacy product',
        note: 'Admin or partner must confirm the inventory model and exact count.',
      },
      {
        field: 'Beds, bathrooms and size',
        target_field: 'bed_configuration / bathrooms / size_sqm',
        classification: 'UNKNOWN',
        source_summary: 'No unambiguous structured room data',
        note: 'Do not infer these values from marketing text or photographs.',
      },
    ] : [];
    return {
      property_id: property.id,
      property_name: i18nText(property.title, 'en', property.slug || property.id),
      architecture_version: property.architecture_version,
      legacy_room_count: legacyRooms.length,
      legacy_live_product_count: liveProductCount,
      legacy_pricing_rule_count: rules.length,
      property_gallery_count: propertyPhotos.length,
      pricing_preview: {
        pricing_model: asText(property.pricing_model),
        rule_count: rules.length,
        guest_counts: guestCounts,
        stay_thresholds: stayThresholds,
        requires_occupancy_los_model: requiresOccupancyLosModel,
        h1_rate_rules_compatible: !requiresOccupancyLosModel,
        oracle: isSevenArchesMatrix
          ? 'HOTEL_7_ARCHES_ROOM1_PRICE_MISMATCH'
          : 'HOTEL_LEGACY_SHADOW_PRICE_MISMATCH',
        conversion_status: requiresOccupancyLosModel ? 'BLOCKED_PENDING_H2B_MODEL' : 'REVIEW_REQUIRED',
      },
      legacy_product: hasPropertyLevelAccommodation ? {
        kind: 'property_level_accommodation',
        label: 'Legacy property-level accommodation',
        status: 'AWAITING_ADMIN_CONFIRMATION',
        pricing_rule_count: rules.length,
        property_gallery_count: propertyPhotos.length,
        max_persons: Number(property.max_persons) > 0 ? Number(property.max_persons) : null,
        field_classifications: fieldClassifications,
      } : null,
      suggestions,
      needs_manual_room_mapping: legacyRooms.length === 0,
      can_prepare_existing_accommodation: hasPropertyLevelAccommodation && normalized.room_types.length === 0,
      status: 'NOT_MIGRATED',
      messages: legacyRooms.length
        ? ['Review every suggested Room Type before a future migration.']
        : hasPropertyLevelAccommodation
          ? ['One live property-level accommodation product exists. It is not a normalized Room Type and requires Admin confirmation before shadow preparation.']
          : ['No structured legacy room rows or property-level pricing product are available. Create Room Types manually in shadow mode.'],
    };
  }

  function buildLegacyShadowRoomSeed(workspace, exactId) {
    const normalized = normalizeWorkspace(workspace);
    const preview = migrationPreview(normalized);
    const id = normalizeUuid(exactId);
    if (!preview.can_prepare_existing_accommodation || !preview.legacy_product) {
      throw new Error('This property does not have an eligible property-level legacy product to prepare.');
    }
    if (!id) throw new Error('An exact Room Type UUID is required for shadow preparation.');
    return normalizeRoomType({
      id,
      hotel_id: normalized.property.id,
      code: '',
      name_i18n: {},
      description_i18n: {},
      gallery: [],
      capacity_adults: 0,
      capacity_children: 0,
      bed_configuration: [],
      bathrooms: null,
      size_sqm: null,
      amenities: [],
      inventory_mode: 'pooled',
      base_inventory_count: 0,
      status: 'draft',
      sort_order: 1000,
      version: 1,
    });
  }

  function validateCode(code, label = 'Code') {
    const value = asText(code).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) throw new Error(`${label} must use lowercase letters, numbers, hyphens or underscores.`);
    return value;
  }

  function validateRoomType(value, workspace, options = {}) {
    const room = normalizeRoomType(value);
    room.id = room.id || newUuid();
    room.hotel_id = room.hotel_id || normalizeUuid(workspace?.property?.id);
    room.code = validateCode(room.code, 'Room code');
    if (!i18nText(room.name_i18n, 'en')) throw new Error('Room name in English is required.');
    if (!Number.isInteger(room.effective_max_occupancy) || room.effective_max_occupancy < 1 || room.effective_max_occupancy > 50) {
      throw new Error('Maximum total occupancy must be a whole number from 1 to 50.');
    }
    if (room.max_occupancy == null) {
      if (!Number.isInteger(room.capacity_adults) || room.capacity_adults < 1) throw new Error('Adults capacity must be at least 1.');
      if (!Number.isInteger(room.capacity_children) || room.capacity_children < 0) throw new Error('Children capacity cannot be negative.');
    } else if (room.capacity_adults != null || room.capacity_children != null) {
      throw new Error('Adult and child capacities must stay unset when maximum total occupancy is used without a confirmed split.');
    }
    normalizeChildrenPolicy(room.children_policy_override, room.minimum_child_age_override, { allowInherit: true });
    if (room.base_inventory_count < 0) throw new Error('Base inventory cannot be negative.');
    const duplicate = normalizeWorkspace(workspace).room_types.find((candidate) => (
      candidate.id !== room.id && candidate.code.toLowerCase() === room.code.toLowerCase()
    ));
    if (duplicate) throw new Error('Room code already exists in this property.');

    const original = normalizeWorkspace(workspace).room_types.find((candidate) => candidate.id === room.id);
    if (original && original.inventory_mode !== room.inventory_mode) {
      const hasUnits = normalizeWorkspace(workspace).units.some((unit) => unit.room_type_id === room.id);
      const dailyInventoryCount = asInteger(workspace?.counts?.daily_inventory_by_room?.[room.id], 0);
      if (hasUnits || dailyInventoryCount > 0 || options.hasBookings === true) {
        throw new Error('Inventory mode cannot be changed after units, inventory or bookings exist.');
      }
    }
    return room;
  }

  function validateUnit(value, workspace) {
    const unit = normalizeUnit(value);
    unit.id = unit.id || newUuid();
    unit.room_type_id = unit.room_type_id || normalizeUuid(value?.room_type_id);
    unit.code = validateCode(unit.code, 'Unit code');
    const normalized = normalizeWorkspace(workspace);
    const room = normalized.room_types.find((candidate) => candidate.id === unit.room_type_id);
    if (!room) throw new Error('Unit Room Type does not exist in this property.');
    if (room.inventory_mode !== 'unitized') throw new Error('Physical units are available only for unitized Room Types.');
    if (normalized.units.some((candidate) => candidate.id !== unit.id && candidate.room_type_id === unit.room_type_id && candidate.code === unit.code)) {
      throw new Error('Unit code already exists for this Room Type.');
    }
    return unit;
  }

  function validateRatePlan(value, workspace) {
    const plan = normalizeRatePlan(value);
    plan.id = plan.id || newUuid();
    plan.hotel_id = plan.hotel_id || normalizeUuid(workspace?.property?.id);
    plan.code = validateCode(plan.code, 'Rate Plan code');
    if (!i18nText(plan.name_i18n, 'en')) throw new Error('Rate Plan name in English is required.');
    if (plan.cancellation_policy.type === 'requires_review') {
      if (!asText(plan.cancellation_policy.reason) || asText(plan.cancellation_policy.reason).length > 160) {
        throw new Error('The unresolved cancellation-policy reason is missing or invalid.');
      }
      if (plan.is_active) throw new Error('Confirm cancellation terms before activating this Rate Plan.');
    }
    if (normalizeWorkspace(workspace).rate_plans.some((candidate) => candidate.id !== plan.id && candidate.code === plan.code)) {
      throw new Error('Rate Plan code already exists in this property.');
    }
    return plan;
  }

  function validateRoomRate(value, workspace) {
    const rate = normalizeRoomRate(value);
    rate.id = rate.id || newUuid();
    rate.hotel_id = rate.hotel_id || normalizeUuid(workspace?.property?.id);
    const normalized = normalizeWorkspace(workspace);
    const room = normalized.room_types.find((candidate) => candidate.id === rate.room_type_id);
    const plan = normalized.rate_plans.find((candidate) => candidate.id === rate.rate_plan_id);
    if (!room || !plan) throw new Error('Choose a Room Type and Rate Plan from this property.');
    if (room.hotel_id !== normalized.property.id || plan.hotel_id !== normalized.property.id || rate.hotel_id !== normalized.property.id) {
      throw new Error('Cross-property room-rate combinations are not allowed.');
    }
    if (!Number.isFinite(rate.base_nightly_rate) || rate.base_nightly_rate < 0) throw new Error('Base nightly rate must be zero or greater.');
    if (rate.is_active && rate.base_nightly_rate <= 0) throw new Error('An active Room + Rate Plan product needs a positive base nightly rate.');
    if (!/^[A-Z]{3}$/.test(rate.currency)) throw new Error('Currency must be a three-letter code.');
    if (normalized.room_rates.some((candidate) => (
      candidate.id !== rate.id && candidate.room_type_id === rate.room_type_id && candidate.rate_plan_id === rate.rate_plan_id
    ))) throw new Error('This Room Type and Rate Plan are already connected.');
    return rate;
  }

  function operationForEntity(entity, nextValue, previousValue = null, operationType = null) {
    const next = clone(nextValue);
    const before = previousValue ? clone(previousValue) : null;
    const id = normalizeUuid(next?.id || before?.id);
    if (!id) throw new Error('Every workspace operation requires an exact UUID.');
    const payloadFields = {
      property: [
        'title_i18n', 'description_i18n', 'city', 'address_line', 'district', 'postal_code',
        'country', 'latitude', 'longitude', 'google_maps_url', 'google_place_id', 'amenities',
        'check_in_from', 'check_out_until', 'timezone', 'currency', 'booking_mode',
        'owner_partner_id', 'cover_image_url', 'photos', 'sort_order',
      ],
      room_type: [
        'source_id', 'code', 'name_i18n', 'description_i18n', 'gallery', 'capacity_adults',
        'capacity_children', 'max_occupancy',
        'children_policy_override', 'minimum_child_age_override',
        'bed_configuration', 'bathrooms', 'size_sqm', 'amenities',
        'inventory_mode', 'base_inventory_count', 'status', 'sort_order',
      ],
      unit: ['room_type_id', 'code', 'name_i18n', 'status'],
      rate_plan: [
        'code', 'name_i18n', 'description_i18n', 'meal_plan_code', 'cancellation_policy',
        'booking_mode_override', 'is_active', 'sort_order',
      ],
      room_rate: ['room_type_id', 'rate_plan_id', 'base_nightly_rate', 'currency', 'is_active', 'sort_order'],
    };
    if (!payloadFields[entity]) throw new Error(`Unsupported workspace entity: ${entity}.`);
    const action = operationType || (before ? 'update' : 'create');
    const payload = action === 'disable'
      ? {}
      : Object.fromEntries(payloadFields[entity].filter((field) => Object.prototype.hasOwnProperty.call(next || {}, field)).map((field) => [field, clone(next[field])]));
    if (action === 'update') {
      // Parent relationships are immutable after creation.
      if (entity === 'unit') delete payload.room_type_id;
      if (entity === 'room_rate') {
        delete payload.room_type_id;
        delete payload.rate_plan_id;
      }
    }
    return {
      type: action,
      entity,
      id,
      expected_version: entity === 'property' ? null : (before ? Math.max(1, asInteger(before.version, 1)) : null),
      payload,
    };
  }

  function buildWorkspacePlan(workspace, operations, options = {}) {
    const normalized = normalizeWorkspace(workspace);
    if (!normalized.property.id) throw new Error('Property workspace is missing an exact ID.');
    const rows = asArray(operations).map((operation) => clone(operation));
    if (!rows.length) throw new Error('There are no reviewed changes to save.');
    return {
      hotel_id: normalized.property.id,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operations: rows,
    };
  }

  function buildRoomTypePlan(workspace, operation, options = {}) {
    const normalized = normalizeWorkspace(workspace);
    const reviewedOperation = clone(operation);
    if (!normalized.property.id || reviewedOperation?.entity !== 'room_type'
        || !normalizeUuid(reviewedOperation?.id)
        || !['create', 'update', 'disable', 'duplicate'].includes(asText(reviewedOperation?.type))) {
      throw new Error('A reviewed exact Room Type operation is required.');
    }
    const expectedVersion = reviewedOperation.type === 'create'
      ? 0
      : asInteger(reviewedOperation.expected_version, -1);
    if (expectedVersion < 0 || (reviewedOperation.type !== 'create' && expectedVersion < 1)) {
      throw new Error('The reviewed Room Type operation is missing its optimistic version.');
    }
    return {
      hotel_id: normalized.property.id,
      expected_property_updated_at: options.expectedPropertyUpdatedAt || normalized.property.updated_at || null,
      reviewed_at: options.reviewedAt || new Date().toISOString(),
      operation: {
        type: reviewedOperation.type,
        id: normalizeUuid(reviewedOperation.id),
        expected_version: expectedVersion,
        payload: clone(reviewedOperation.payload || {}),
      },
    };
  }

  function flattenReview(value, prefix = '') {
    const source = value == null ? null : value;
    if (source == null || typeof source !== 'object') return [{ field: prefix || 'value', value: source }];
    const entries = [];
    Object.keys(source).sort().forEach((key) => {
      if (['created_at', 'updated_at', 'version'].includes(key)) return;
      const path = prefix ? `${prefix}.${key}` : key;
      const item = source[key];
      if (item && typeof item === 'object') entries.push({ field: path, value: clone(item) });
      else entries.push({ field: path, value: item });
    });
    return entries;
  }

  function buildReviewRows(entity, before, after) {
    const beforeMap = new Map(flattenReview(before).map((entry) => [entry.field, entry.value]));
    const afterMap = new Map(flattenReview(after).map((entry) => [entry.field, entry.value]));
    const fields = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort();
    return fields.filter((field) => JSON.stringify(beforeMap.get(field)) !== JSON.stringify(afterMap.get(field))).map((field) => ({
      entity,
      entity_id: normalizeUuid(after?.id || before?.id),
      field,
      before: clone(beforeMap.get(field)),
      after: clone(afterMap.get(field)),
    }));
  }

  function buildDuplicateRoom(room, workspace) {
    const original = normalizeRoomType(room);
    const normalized = normalizeWorkspace(workspace);
    let suffix = 1;
    let code = `${original.code}-copy`;
    while (normalized.room_types.some((candidate) => candidate.code === code)) {
      suffix += 1;
      code = `${original.code}-copy-${suffix}`;
    }
    return {
      ...clone(original),
      id: newUuid(),
      code,
      name_i18n: Object.fromEntries(Object.entries(original.name_i18n).map(([language, label]) => [language, `${label} copy`])),
      status: 'draft',
      version: 1,
      created_at: null,
      updated_at: null,
    };
  }

  function priceFrom(workspace) {
    const prices = normalizeWorkspace(workspace).room_rates
      .filter((rate) => rate.is_active && Number.isFinite(rate.base_nightly_rate) && rate.base_nightly_rate >= 0)
      .map((rate) => rate.base_nightly_rate);
    return prices.length ? Math.min(...prices) : null;
  }

  return Object.freeze({
    LANGUAGES,
    ROOM_STATUSES,
    UNIT_STATUSES,
    INVENTORY_MODES,
    BOOKING_MODES,
    CHILDREN_POLICIES,
    ROOM_CHILDREN_POLICY_OVERRIDES,
    CHILD_AGE_MIN,
    CHILD_AGE_MAX,
    SEVEN_ARCHES_PROPERTY_ID,
    SEVEN_ARCHES_SHADOW_IDS,
    SEVEN_ARCHES_SOURCE_CONTRACT,
    SEVEN_ARCHES_ROOM_DEFINITIONS,
    BED_TYPES,
    BED_LABELS,
    PENALTY_MODES,
    CALENDAR_PRECEDENCE,
    clone,
    asArray,
    asObject,
    asText,
    asNullableText,
    asInteger,
    asNumber,
    normalizeUuid,
    newUuid,
    normalizeI18n,
    i18nText,
    normalizeGallery,
    normalizeAmenities,
    normalizeBedConfiguration,
    formatBedConfiguration,
    normalizeCancellationPolicy,
    cancellationPolicyLabel,
    normalizeChildrenPolicy,
    resolveChildrenPolicy,
    childrenPolicyLabel,
    sevenArchesShadowPreparation,
    sevenArchesShadowReconciliation,
    buildSevenArchesShadowPlan,
    normalizeRoomType,
    normalizeUnit,
    normalizeRatePlan,
    normalizeRoomRate,
    sharedScheduleCalendarDisplayState,
    normalizeWorkspace,
    totalConfiguredInventory,
    deriveWorkspaceReadiness,
    migrationPreview,
    buildLegacyShadowRoomSeed,
    validateCode,
    validateRoomType,
    validateUnit,
    validateRatePlan,
    validateRoomRate,
    operationForEntity,
    buildWorkspacePlan,
    buildRoomTypePlan,
    buildReviewRows,
    buildDuplicateRoom,
    priceFrom,
  });
});
