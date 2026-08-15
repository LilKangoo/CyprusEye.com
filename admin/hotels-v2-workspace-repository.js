(function attachHotelsV2WorkspaceRepository(root, factory) {
  const api = factory(root.HotelsV2WorkspaceCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2WorkspaceRepository = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2WorkspaceRepository(Core) {
  'use strict';

  if (!Core) throw new Error('HotelsV2WorkspaceCore is required.');

  const RPC = Object.freeze({
    list: 'hotel_v2_admin_get_property_list',
    workspace: 'hotel_v2_admin_get_property_workspace',
    apply: 'hotel_v2_admin_apply_workspace_plan',
    createProperty: 'hotel_v2_admin_create_property_draft',
    calendar: 'hotel_v2_admin_get_calendar',
    applyCalendar: 'hotel_v2_admin_apply_calendar_plan',
    resolveRate: 'hotel_v2_admin_resolve_rate',
    applyGuestPolicy: 'hotel_v2_admin_apply_guest_policy_plan',
    applyRoomType: 'hotel_v2_admin_apply_room_type_plan',
    prepareLegacyShadowRooms: 'hotel_v2_admin_prepare_legacy_shadow_rooms',
    h3Configuration: 'hotel_v2_admin_get_h3_1_configuration',
    applyH3Configuration: 'hotel_v2_admin_apply_h3_1_configuration',
    legacyPricingPromotionPreview: 'hotel_v2_admin_get_legacy_pricing_promotion_preview',
    applyLegacyPricingPromotion: 'hotel_v2_admin_apply_legacy_pricing_promotion',
    partnerHotelPermissions: 'hotel_v2_admin_get_partner_hotel_permissions',
    applyPartnerHotelPermissions: 'hotel_v2_admin_apply_partner_hotel_permissions',
  });

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function getClient() {
    const client = typeof window !== 'undefined' && typeof window.getSupabase === 'function'
      ? window.getSupabase()
      : (typeof window !== 'undefined' ? window.sb || window.__SB__ : null);
    if (!client) throw new Error('Database connection is not available.');
    return client;
  }

  function reviewedShadowUserMessage(message) {
    const key = String(message || '').trim().toLowerCase();
    if (/hotels_v2_h3_pricing_promotion_stale_review/.test(key)) {
      return 'The legacy source, shadow pricing schedule or reviewed allocation changed after Review. Fresh exact values are required before an explicit second Save.';
    }
    if (/hotels_v2_h3_pricing_promotion_already_reviewed/.test(key)) {
      return 'This exact shadow pricing schedule has already been reviewed. Refresh the workspace to see its current state.';
    }
    if (/hotels_v2_h3_pricing_promotion_(?:pricing_occupancy_ack|required_ack)/.test(key)) {
      return 'Explicitly acknowledge the reviewed physical-allocation and pricing-occupancy mapping before saving.';
    }
    if (/hotels_v2_h3_1_(?:stale|version|children_fingerprint|property_changed)/.test(key)) {
      return 'This booking configuration changed after Review. Fresh exact values are required before you can review and save it again.';
    }
    if (/hotels_v2_h3_1_(?:invalid|relationship|cross_property|external_source)/.test(key)) {
      return 'The reviewed booking configuration no longer matches this exact property. Refresh the workspace and inspect the highlighted setup fields.';
    }
    if (/hotels_v2_h3_2a_stale_partner_permissions/.test(key)) {
      return 'This exact partner permission changed after Review. Fresh values are required before an explicit second Save.';
    }
    if (/hotels_v2_h3_2a_mutating_assignment_conflict/.test(key)) {
      return 'Another exact Hotel assignment already holds mutation access. Disable it in a separate reviewed save before transferring access.';
    }
    if (/hotels_v2_h3_2a_idempotency_key_reused/.test(key)) {
      return 'This reviewed Partner & Access request identifier was already used for different values. Refresh and prepare a new Review.';
    }
    if (/guest_policy_already_reviewed/.test(key)) {
      return 'This property already has a different reviewed children policy. Refresh the workspace and explicitly review the current policy and age before making a separate guest-policy change.';
    }
    if (/property.*policy.*(?:snapshot|stale|changed)|stale.*property.*policy/.test(key)) {
      return 'The property children-policy snapshot changed after Review. Refresh the workspace and review the current policy and minimum age again.';
    }
    if (/shadow_(?:property_policy|policy_preservation)_mismatch/.test(key)) {
      return 'Room/photo preparation cannot replace the separately reviewed property children policy. Refresh the workspace, review the current property policy, then prepare the apartments again.';
    }
    if (/room_photo_not_in_property_gallery|foreign.*gallery|invalid.*gallery/.test(key)) {
      return 'A selected room photo is not in the current 7 Arches property gallery. Refresh the workspace and select the room photos again.';
    }
    if (/invalid_shadow_room/.test(key)) {
      return 'A reviewed apartment name, photo selection, capacity or exact identity is invalid. Reopen the preparation and review both apartments again.';
    }
    if (/shadow_rooms_exact_set_required|missing.*shadow.*room|shadow.*room.*missing/.test(key)) {
      return 'The reviewed package no longer contains exactly the two expected 7 Arches apartments. Refresh and reopen the two-apartment preparation.';
    }
    if (/shadow_room_identity_conflict/.test(key)) {
      return 'An expected 7 Arches Room Type is missing or its deterministic identity conflicts with another row. Refresh and inspect the exact Room Types before retrying.';
    }
    if (/shadow_room_three_way_conflict/.test(key)) {
      return 'A reviewed room value changed in two different ways. Current data must be refreshed so you can compare the original, current and requested values; nothing was saved.';
    }
    if (/stale_shadow_room/.test(key)) {
      return 'This room was updated after this review was prepared. Current data must be refreshed and reviewed again; no partial save was kept.';
    }
    if (/room_expected_version_mismatch|stale_pricing_schedule|stale_property_party_preview|stale_rate_plan|stale_(?:upper|ground)_room_rate|relationship.*mismatch/.test(key)) {
      return 'A shadow Room Type or one of its pricing relationships changed after Review. Refresh and review the current configuration; no partial save was kept.';
    }
    if (/unknown_room_amenity|confirmed_room_amenity_mismatch/.test(key)) {
      return 'The confirmed terrace/balcony amenity mapping no longer matches the current Hotel amenity catalogue. Refresh and review the room configuration.';
    }
    return null;
  }

  function asRpcPayload(data) {
    if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object') return data[0];
    return data;
  }

  function repositoryError(error, action) {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || error?.details || 'Unknown database error').trim();
    const normalized = new Error(`${action}: ${message}`);
    normalized.code = code;
    normalized.details = error?.details || null;
    normalized.hint = error?.hint || null;
    normalized.userMessage = reviewedShadowUserMessage(message);
    normalized.diagnosticReason = /^(?:hotels_v2_h2b(?:1|2)|hotels_v2_h3(?:_1|_2a|_pricing_promotion))_[a-z0-9_]+$/i.test(message)
      ? message
      : null;
    // H2B.1 uses PostgREST's explicit HTTP-conflict SQLSTATE for reviewed
    // optimistic-concurrency failures. Keep 40001 recognition for the older
    // H2A/H2B RPCs until their contracts are migrated independently.
    normalized.isStale = code === 'PT409'
      || code === '40001'
      || /stale|version|concurrent|changed after review/i.test(message);
    normalized.isFoundationMissing = code === '42883' || /hotel_v2_admin_|schema cache|could not find the function/i.test(message);
    // A structured PostgreSQL/PostgREST rejection is returned only after the
    // request transaction has failed. Network/transport failures are
    // deliberately classified as ambiguous because the transaction may have
    // committed before its response was lost. Callers must not delete uploaded
    // media or retry a reviewed plan blindly when the outcome is ambiguous.
    normalized.isDefinitiveFailure = normalized.isStale
      || /^[0-9A-Z]{5}$/.test(code)
      || /^PGRST[0-9A-Z]+$/i.test(code);
    normalized.isAmbiguousOutcome = !normalized.isDefinitiveFailure;
    return normalized;
  }

  async function runRpc(name, payload, action, options = {}) {
    const client = getClient();
    let response;
    try {
      response = await client.rpc(name, payload || {});
    } catch (error) {
      throw repositoryError(error, action);
    }
    const { data, error } = response || {};
    if (error) throw repositoryError(error, action);
    return options.preserveArray ? data : asRpcPayload(data);
  }

  async function listProperties() {
    const data = await runRpc(RPC.list, {}, 'Load property directory', { preserveArray: true });
    const rows = Array.isArray(data) ? data : Core.asArray(data?.properties);
    return rows.map((row) => ({ ...Core.clone(row), id: Core.normalizeUuid(row?.id) })).filter((row) => row.id);
  }

  async function getWorkspace(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    const data = await runRpc(RPC.workspace, { p_hotel_id: id }, 'Load Property Workspace');
    const workspace = Core.normalizeWorkspace(data);
    if (workspace.property.id !== id) throw new Error('Property Workspace returned a different property ID.');
    return workspace;
  }

  async function applyWorkspacePlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    if (!id || !Array.isArray(reviewedPlan?.operations) || !reviewedPlan.operations.length) {
      throw new Error('A reviewed exact-property save plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.apply, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed Property Workspace changes');
    const payload = Core.asObject(data);
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Saved Property Workspace returned a different property ID.');
    return { ...payload, correlation_id: payload.correlation_id || correlation, workspace };
  }

  async function createPropertyDraft(id, payload, correlationId) {
    const propertyId = Core.normalizeUuid(id) || Core.newUuid();
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.createProperty, {
      p_id: propertyId,
      p_payload: Core.clone(payload || {}),
      p_correlation_id: correlation,
    }, 'Create Rooms V2 property draft');
    const response = Core.asObject(data);
    const workspace = Core.normalizeWorkspace(response.workspace || response);
    if (workspace.property.id !== propertyId) throw new Error('Created property returned a different exact ID.');
    return { ...response, correlation_id: response.correlation_id || correlation, workspace };
  }

  function normalizeCalendarPayload(value) {
    const payload = Core.asObject(value);
    const property = Core.asObject(payload.property);
    const range = Core.asObject(payload.range);
    const result = {
      hotel_id: Core.normalizeUuid(payload.hotel_id || payload.property_id || property.id),
      start_date: String(payload.start_date || payload.from_date || range.from || '').trim(),
      end_date: String(payload.end_date || payload.to_date || range.to || '').trim(),
      property: Core.clone(property),
      range: Core.clone(range),
      room_types: Core.asArray(payload.room_types).map(Core.clone),
      room_rates: Core.asArray(payload.room_rates || payload.products).map(Core.clone),
      rate_rules: Core.asArray(payload.rate_rules).map(Core.clone),
      occupancy_tiers: Core.asArray(payload.occupancy_tiers).map(Core.clone),
      calendar_overrides: Core.asArray(payload.calendar_overrides).map(Core.clone),
      daily_inventory: Core.asArray(payload.daily_inventory || payload.inventory).map(Core.clone),
      daily_rates: Core.asArray(payload.daily_rates || payload.rates).map(Core.clone),
      effective_cells: Core.asArray(payload.effective_cells || payload.cells).map(Core.clone),
      activity: Core.asArray(payload.activity).map(Core.clone),
      snapshot_token: String(payload.snapshot_token || '').trim() || null,
    };
    return result;
  }

  async function getCalendar(hotelId, startDate, endDate) {
    const id = Core.normalizeUuid(hotelId);
    const from = String(startDate || '').trim();
    const to = String(endDate || '').trim();
    if (!id || !ISO_DATE.test(from) || !ISO_DATE.test(to) || to < from) {
      throw new Error('A valid exact property and calendar date range are required.');
    }
    const data = await runRpc(RPC.calendar, {
      p_hotel_id: id,
      p_start_date: from,
      p_end_date: to,
    }, 'Load Calendar & Rates');
    const calendar = normalizeCalendarPayload(data);
    if (calendar.hotel_id !== id) throw new Error('Calendar returned a different property ID.');
    if (calendar.start_date !== from || calendar.end_date !== to) {
      throw new Error('Calendar returned a different date range.');
    }
    return calendar;
  }

  async function applyCalendarPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const from = String(reviewedPlan?.from || '').trim();
    const to = String(reviewedPlan?.to || '').trim();
    const snapshotToken = String(reviewedPlan?.snapshot_token || '').trim();
    if (!id || !ISO_DATE.test(from) || !ISO_DATE.test(to) || to < from || !snapshotToken
        || !Array.isArray(reviewedPlan?.operations) || !reviewedPlan.operations.length) {
      throw new Error('A reviewed exact-property calendar plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyCalendar, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed Calendar & Rates changes');
    const payload = Core.asObject(data);
    const calendar = normalizeCalendarPayload(payload.calendar || payload);
    if (calendar.hotel_id && calendar.hotel_id !== id) {
      throw new Error('Saved Calendar returned a different property ID.');
    }
    return {
      ...payload,
      correlation_id: payload.correlation_id || correlation,
      calendar: calendar.hotel_id ? calendar : null,
    };
  }

  async function resolveRate(roomRateId, checkIn, checkOut, guestCount) {
    const productId = Core.normalizeUuid(roomRateId);
    const arrival = String(checkIn || '').trim();
    const departure = String(checkOut || '').trim();
    const guests = Number(guestCount);
    if (!productId || !ISO_DATE.test(arrival) || !ISO_DATE.test(departure) || departure <= arrival
        || !Number.isInteger(guests) || guests <= 0) {
      throw new Error('A valid exact rate product, stay and positive guest count are required.');
    }
    return Core.clone(await runRpc(RPC.resolveRate, {
      p_room_rate_id: productId,
      p_check_in: arrival,
      p_check_out: departure,
      p_guest_count: guests,
    }, 'Preview authoritative Hotel rate'));
  }

  async function applyGuestPolicyPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const hasPropertyPolicy = reviewedPlan?.property_policy && typeof reviewedPlan.property_policy === 'object';
    const hasRoomPolicies = Array.isArray(reviewedPlan?.room_policies) && reviewedPlan.room_policies.length > 0;
    if (!id || (!hasPropertyPolicy && !hasRoomPolicies)) {
      throw new Error('A reviewed exact-property children-policy plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyGuestPolicy, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed children policy');
    const payload = Core.asObject(data);
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Saved children policy returned a different property ID.');
    return { ...payload, correlation_id: payload.correlation_id || correlation, workspace };
  }

  async function applyRoomTypePlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const roomId = Core.normalizeUuid(reviewedPlan?.operation?.id);
    if (!id || !roomId || !['create', 'update', 'disable', 'duplicate'].includes(Core.asText(reviewedPlan?.operation?.type))) {
      throw new Error('A reviewed exact Room Type save plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyRoomType, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed Room Type');
    const payload = Core.asObject(data);
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Saved Room Type returned a different property ID.');
    return { ...payload, correlation_id: payload.correlation_id || correlation, workspace };
  }

  async function prepareLegacyShadowRooms(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const exactRoomIds = Core.asArray(reviewedPlan?.rooms).map((room) => Core.normalizeUuid(room?.id)).filter(Boolean);
    const expectedPolicy = Core.asObject(reviewedPlan?.expected_property_policy);
    const hasPolicySnapshot = Object.prototype.hasOwnProperty.call(expectedPolicy, 'children_policy')
      && Object.prototype.hasOwnProperty.call(expectedPolicy, 'minimum_child_age');
    if (!id || reviewedPlan?.source_contract !== Core.SEVEN_ARCHES_SOURCE_CONTRACT
        || exactRoomIds.length !== 2 || new Set(exactRoomIds).size !== 2 || !hasPolicySnapshot) {
      throw new Error('A reviewed exact two-apartment shadow preparation plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const diagnosticContext = {
      correlation_id: correlation,
      hotel_id: id,
      expected_property_updated_at: reviewedPlan.expected_property_updated_at || null,
      expected_property_policy: Core.clone(expectedPolicy),
      rooms: Core.asArray(reviewedPlan.rooms).map((room) => ({
        id: Core.normalizeUuid(room?.id) || null,
        expected_version: Number.isInteger(Number(room?.expected_version))
          ? Number(room.expected_version)
          : null,
      })),
      expected_versions: Core.clone(Core.asObject(reviewedPlan.expected_versions)),
    };
    let data;
    try {
      data = await runRpc(RPC.prepareLegacyShadowRooms, {
        p_plan: reviewedPlan,
        p_correlation_id: correlation,
      }, 'Prepare reviewed 7 Arches shadow apartments');
    } catch (error) {
      error.diagnosticContext = diagnosticContext;
      throw error;
    }
    const payload = Core.asObject(data);
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Prepared apartments returned a different property ID.');
    return { ...payload, correlation_id: payload.correlation_id || correlation, workspace };
  }

  async function getH3Configuration(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    const data = await runRpc(RPC.h3Configuration, { p_hotel_id: id }, 'Load H3.1 booking configuration');
    const configuration = Core.normalizeH3Configuration(data);
    if ((configuration.hotel_id || configuration.property.id) !== id) {
      throw new Error('H3.1 configuration returned a different property ID.');
    }
    return configuration;
  }

  async function applyH3ConfigurationPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const allowedEntities = [
      'property_configuration', 'pricing_schedule', 'rate_plan', 'allocation_rule',
      'payment_policy', 'commission_policy', 'calendar_source',
    ];
    if (!id || !reviewedPlan?.expected_property_updated_at
        || !Array.isArray(reviewedPlan?.operations) || !reviewedPlan.operations.length) {
      throw new Error('A reviewed exact-property H3.1 configuration plan is required.');
    }
    reviewedPlan.operations.forEach((operation) => {
      if (!Core.normalizeUuid(operation?.id)
          || !allowedEntities.includes(Core.asText(operation?.entity))
          || !['create', 'update', 'disable'].includes(Core.asText(operation?.type))
          || !Number.isInteger(Number(operation?.expected_version))
          || (operation.type === 'create' && Number(operation.expected_version) !== 0)
          || (operation.type !== 'create' && operation.entity !== 'property_configuration'
            && Number(operation.expected_version) < 1)) {
        throw new Error('Every H3.1 operation requires an exact ID, action and optimistic version.');
      }
      if ((operation.entity === 'property_configuration'
          && (operation.type !== 'update' || Number(operation.expected_version) !== 0))
          || (['pricing_schedule', 'rate_plan'].includes(operation.entity) && operation.type !== 'update')) {
        throw new Error('This H3.1 entity supports reviewed exact updates only.');
      }
      if (['allocation_rule', 'payment_policy'].includes(operation.entity)
          && operation.type !== 'create' && !Core.asText(operation.expected_children_fingerprint)) {
        throw new Error('Reviewed aggregate updates require their fresh child fingerprint.');
      }
    });
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyH3Configuration, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed H3.1 booking configuration');
    const payload = Core.asObject(data);
    const configuration = Core.normalizeH3Configuration(payload.configuration || payload.h3_1_configuration || payload);
    if ((configuration.hotel_id || configuration.property.id) !== id) {
      throw new Error('Saved H3.1 configuration returned a different property ID.');
    }
    return { ...payload, correlation_id: payload.correlation_id || correlation, configuration };
  }

  async function getLegacyPricingPromotionPreview(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    const data = await runRpc(RPC.legacyPricingPromotionPreview, {
      p_hotel_id: id,
    }, 'Load legacy-to-H3 pricing preparation');
    const preview = Core.validateLegacyPricingPromotionPreview(data);
    if (preview.hotel_id !== id) throw new Error('Pricing preparation returned a different property ID.');
    return preview;
  }

  async function applyLegacyPricingPromotion(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    if (id !== Core.SEVEN_ARCHES_PROPERTY_ID
        || reviewedPlan?.decision !== 'promote_room_schedule_to_reviewed'
        || reviewedPlan?.acknowledge_pricing_occupancy_mapping !== true
        || !Core.asText(reviewedPlan?.snapshot_token)
        || !Object.keys(Core.asObject(reviewedPlan?.expected)).length) {
      throw new Error('A reviewed exact 7 Kamares pricing-promotion plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyLegacyPricingPromotion, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed legacy-to-H3 pricing preparation');
    const payload = Core.asObject(data);
    if (payload.hotel_id && Core.normalizeUuid(payload.hotel_id) !== id) {
      throw new Error('Saved pricing preparation returned a different property ID.');
    }
    return { ...payload, correlation_id: payload.correlation_id || correlation };
  }

  async function getPartnerHotelPermissions(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    const data = await runRpc(RPC.partnerHotelPermissions, {
      p_hotel_id: id,
    }, 'Load Partner & Access permissions');
    return Core.validatePartnerHotelPermissions(data, id);
  }

  async function applyPartnerHotelPermissionsPlan(plan, correlationId, idempotencyKey) {
    const reviewedPlan = Core.clone(plan);
    const hotelId = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const assignmentId = Core.normalizeUuid(reviewedPlan?.assignment_id);
    const partnerId = Core.normalizeUuid(reviewedPlan?.partner_id);
    const capabilities = Core.asObject(reviewedPlan?.capabilities);
    const exactCapabilityKeys = Core.normalizeStringSet(Object.keys(capabilities));
    if (reviewedPlan?.contract_version !== Core.H3_2A_PARTNER_PERMISSIONS_CONTRACT
        || reviewedPlan?.decision !== 'apply_partner_hotel_permissions'
        || !hotelId || !assignmentId || !partnerId
        || !Core.asText(reviewedPlan?.reviewed_at)
        || !Core.asText(reviewedPlan?.snapshot_token)
        || !Core.asText(reviewedPlan?.expected_assignment_fingerprint)
        || !Number.isInteger(Number(reviewedPlan?.expected_permission_version))
        || Number(reviewedPlan.expected_permission_version) < 0
        || JSON.stringify(exactCapabilityKeys) !== JSON.stringify(Core.normalizeStringSet(Core.HOTEL_PARTNER_CAPABILITIES))
        || Core.HOTEL_PARTNER_CAPABILITIES.some((key) => typeof capabilities[key] !== 'boolean')) {
      throw new Error('A reviewed exact-assignment Partner & Access plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const idempotency = Core.normalizeUuid(idempotencyKey) || Core.newUuid();
    const data = await runRpc(RPC.applyPartnerHotelPermissions, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
      p_idempotency_key: idempotency,
    }, 'Save reviewed Partner & Access permissions');
    const payload = Core.asObject(data);
    if (payload.ok !== true
        || payload.contract_version !== Core.H3_2A_PARTNER_PERMISSIONS_CONTRACT
        || payload.decision !== 'apply_partner_hotel_permissions'
        || Core.normalizeUuid(payload.hotel_id) !== hotelId
        || Core.normalizeUuid(payload.assignment_id) !== assignmentId
        || Core.normalizeUuid(payload.partner_id) !== partnerId
        || Core.normalizeUuid(payload.correlation_id) !== correlation
        || Core.normalizeUuid(payload.idempotency_key) !== idempotency) {
      throw new Error('Saved Partner & Access permissions returned a different exact assignment.');
    }
    const snapshot = Core.validatePartnerHotelPermissions(payload.snapshot, hotelId);
    const savedAssignment = snapshot.assignments.find((entry) => entry.assignment_id === assignmentId);
    if (!savedAssignment
        || JSON.stringify(savedAssignment.permission.capabilities) !== JSON.stringify(Core.normalizeHotelPartnerCapabilities(capabilities))) {
      throw new Error('Saved Partner & Access permissions were not confirmed by the fresh exact-assignment snapshot.');
    }
    return {
      ...payload,
      correlation_id: correlation,
      idempotency_key: idempotency,
      snapshot,
    };
  }

  async function uploadRoomGallery(propertySlug, roomId, files) {
    const optimizedUploader = typeof window !== 'undefined' && window.HotelsV2AdminMedia?.uploadRoomGallery;
    if (typeof optimizedUploader === 'function') {
      return optimizedUploader(propertySlug, roomId, files);
    }
    const client = getClient();
    const safeSlug = Core.asText(propertySlug).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
    const exactRoomId = Core.normalizeUuid(roomId);
    if (!safeSlug || !exactRoomId) throw new Error('Property slug and exact Room Type ID are required for upload.');

    const imageFiles = Array.from(files || []).filter((file) => file?.type?.startsWith('image/'));
    const urls = [];
    for (const file of imageFiles) {
      const extension = String(file.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const path = `hotels/${safeSlug}/rooms/${exactRoomId}/${Core.newUuid()}.${extension}`;
      const { error } = await client.storage.from('poi-photos').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type,
      });
      if (error) throw repositoryError(error, 'Upload room image');
      const { data } = client.storage.from('poi-photos').getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    return urls;
  }

  return Object.freeze({
    RPC,
    getClient,
    listProperties,
    getWorkspace,
    applyWorkspacePlan,
    createPropertyDraft,
    getCalendar,
    applyCalendarPlan,
    resolveRate,
    applyGuestPolicyPlan,
    applyRoomTypePlan,
    prepareLegacyShadowRooms,
    getH3Configuration,
    applyH3ConfigurationPlan,
    getLegacyPricingPromotionPreview,
    applyLegacyPricingPromotion,
    getPartnerHotelPermissions,
    applyPartnerHotelPermissionsPlan,
    uploadRoomGallery,
  });
});
