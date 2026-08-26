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
    applyPropertyControl: 'hotel_v2_admin_apply_property_control_plan',
    applyRoomControl: 'hotel_v2_admin_apply_room_control_plan',
    applyOperationalAssignment: 'hotel_v2_admin_apply_operational_assignment_plan',
    contentControl: 'hotel_v2_admin_get_content_control',
    prepareLegacyShadowRooms: 'hotel_v2_admin_prepare_legacy_shadow_rooms',
    h3Configuration: 'hotel_v2_admin_get_h3_1_configuration',
    applyH3Configuration: 'hotel_v2_admin_apply_h3_1_configuration',
    legacyPricingPromotionPreview: 'hotel_v2_admin_get_legacy_pricing_promotion_preview',
    applyLegacyPricingPromotion: 'hotel_v2_admin_apply_legacy_pricing_promotion',
    partnerHotelPermissions: 'hotel_v2_admin_get_partner_hotel_permissions',
    applyPartnerHotelPermissions: 'hotel_v2_admin_apply_partner_hotel_permissions',
    pricingControl: 'hotel_v2_admin_get_pricing_control',
    applyPricingControl: 'hotel_v2_admin_apply_pricing_control_plan',
    previewPricingQuote: 'hotel_v2_admin_preview_pricing_quote',
    availabilityControl: 'hotel_v2_admin_get_availability_control',
    previewAvailabilityPlan: 'hotel_v2_admin_preview_availability_plan',
    applyAvailabilityControl: 'hotel_v2_admin_apply_availability_control_plan',
    previewAvailabilityStay: 'hotel_v2_admin_preview_stay',
    externalCalendarControl: 'hotel_v2_admin_get_external_calendar_control',
    previewExternalCalendarPlan: 'hotel_v2_admin_preview_external_calendar_plan',
    applyExternalCalendarPlan: 'hotel_v2_admin_apply_external_calendar_plan',
    partnerPropertyProposals: 'hotel_v2_admin_get_partner_property_proposals',
    previewPartnerPropertyProposalPlan: 'hotel_v2_admin_preview_partner_property_proposal_plan',
    applyPartnerPropertyProposalPlan: 'hotel_v2_admin_apply_partner_property_proposal_plan',
    sevenArchesPricingActivation: 'hotel_v2_admin_get_seven_arches_pricing_activation',
    previewSevenArchesPricingActivation: 'hotel_v2_admin_preview_seven_arches_pricing_activation',
    applySevenArchesPricingActivation: 'hotel_v2_admin_apply_seven_arches_pricing_activation',
  });

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const reviewedAvailabilityPlans = new Map();
  const reviewedExternalCalendarPlans = new Map();
  const reviewedPartnerPropertyProposalPlans = new Map();
  const reviewedSevenArchesPricingActivationPlans = new Map();

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  async function sha256Hex(value) {
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('Secure external-calendar URL fingerprint validation is unavailable.');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function getClient() {
    const client = typeof window !== 'undefined' && typeof window.getSupabase === 'function'
      ? window.getSupabase()
      : (typeof window !== 'undefined' ? window.sb || window.__SB__ : null);
    if (!client) throw new Error('Database connection is not available.');
    return client;
  }

  function reviewedShadowUserMessage(message) {
    const key = String(message || '').trim().toLowerCase();
    if (/hotels_v2_admin_d_(?:stale_availability_snapshot|stale_hold|stale_daily_inventory|stale_unit_calendar_block|stale_operational_override|stale_rate_rule_operational_restriction|stale_booking_allocation|booking_stale|concurrent_availability_conflict|review_required|expiry_elapsed_since_review|reviewed_operation_state_changed)/.test(key)) {
      return 'Availability changed after Review. Reload the exact range and explicitly review fresh values; nothing was retried.';
    }
    if (/hotels_v2_admin_d_(?:idempotency_conflict|correlation_conflict)/.test(key)) {
      return 'This availability request identifier was already used for different reviewed values. Reload and prepare a new Review.';
    }
    if (/hotels_v2_admin_d_(?:insufficient_availability|capacity_below_commitments|unit_blocked|unit_already_committed)/.test(key)) {
      return 'The reviewed availability would conflict with committed bookings or active holds. Inspect the server blockers; nothing was changed.';
    }
    if (/hotels_v2_admin_d_booking_mapping_required/.test(key)) {
      return 'An exact booking allocation must be reviewed before this inventory change can be saved.';
    }
    if (/hotels_v2_admin_d_[a-z0-9_]*scope[a-z0-9_]*locked/.test(key)) {
      return 'This shared pricing scope still has reviewed availability restrictions. Clear those availability fields in Calendar first, then prepare a fresh separate pricing Review.';
    }
    if (/hotels_v2_admin_d_(?:pricing_smuggling_denied|public_activation_guard)/.test(key)) {
      return 'Availability may not change prices, public activation, architecture, payments, commission or Partner assignment.';
    }
    if (/hotels_v2_admin_d_(?:hold_not_found|foreign|invalid)/.test(key)) {
      return 'The reviewed availability target is invalid, missing or outside this exact property. Reload the authoritative range.';
    }
    if (/hotels_v2_admin_c_(?:stale|version|children_fingerprint|link_fingerprint|snapshot|[a-z0-9_]*original_mismatch)/.test(key)) {
      return 'Pricing changed after Review. Fresh exact values must be loaded and explicitly reviewed before a separate Save; nothing was retried.';
    }
    if (/hotels_v2_admin_c_(?:idempotency_conflict|correlation_conflict)/.test(key)) {
      return 'This pricing request identifier was already used for different reviewed values. Refresh and prepare a new Review.';
    }
    if (/hotels_v2_admin_c_(?:h3_1p|immutable|protected)/.test(key)) {
      return 'This pricing object belongs to the accepted legacy-parity contract and cannot be changed through ADMIN-C.';
    }
    if (/hotels_v2_admin_c_(?:cross_property|relationship|foreign|room_rate_missing|schedule_relink)/.test(key)) {
      return 'The reviewed pricing relationships no longer match this exact property. Refresh and inspect the Room Type, Rate Plan and pricing source links.';
    }
    if (/hotels_v2_admin_c_(?:active|activation|readiness|not_ready|external_redirect)/.test(key)) {
      return 'The requested active pricing state is not ready. Review the server readiness blockers and required external redirect before activating.';
    }
    if (/hotels_v2_admin_c_technical_limit_exceeded/.test(key)) {
      return 'This pricing snapshot or reviewed plan exceeds the supported technical capacity. Narrow or archive the configuration, then prepare a new explicit Review; nothing was retried.';
    }
    if (/hotels_v2_admin_c_(?:invalid|unsupported|duplicate|overlap|requires)/.test(key)) {
      return 'The reviewed pricing values are invalid or incomplete. Inspect the structured fields and server readiness blockers; no pricing change was saved.';
    }
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
    if (/hotels_v2_seven_arches_property_proposal_(?:stale|review_expired|review_consumed)/.test(key)) {
      return 'This Partner property proposal or canonical Hotel changed after Review. Reload both exact states and prepare a fresh explicit Review; nothing was retried.';
    }
    if (/hotels_v2_seven_arches_property_proposal_(?:correlation_conflict|plan_invalid)/.test(key)) {
      return 'This Partner proposal Save identifier or reviewed plan is no longer valid. Reload the exact pending proposal; nothing was retried.';
    }
    if (/hotels_v2_seven_arches_property_proposal_(?:not_found|empty|review_request_invalid)/.test(key)) {
      return 'The exact pending Partner property proposal is missing or invalid. Reload the Admin workspace before reviewing it.';
    }
    if (/hotels_v2_seven_arches_pricing_activation_(?:stale_snapshot|review_mismatch|review_consumed|review_expired)/.test(key)) {
      return 'The exact 7 Arches pricing graph changed after Review. Reload the activation snapshot and explicitly review fresh values; nothing was retried.';
    }
    if (/hotels_v2_seven_arches_pricing_activation_(?:idempotency_conflict|correlation_conflict)/.test(key)) {
      return 'This activation Save identifier was already used for different reviewed values. Reload and prepare a new explicit Review.';
    }
    if (/hotels_v2_seven_arches_pricing_activation_(?:foundation_drift|state_invalid|postcondition_failed|delta_scope_mismatch)/.test(key)) {
      return '7 Arches pricing activation failed its protected server safety contract. No client retry is allowed; inspect the exact foundation and protected fingerprints.';
    }
    if (/hotels_v2_seven_arches_pricing_activation_(?:invalid_draft|invalid_plan)/.test(key)) {
      return 'The activation values or reviewed plan are incomplete or invalid. Enter exact PL/EN/HE content and two positive reviewed base rates.';
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
    normalized.diagnosticReason = /^(?:hotels_v2_admin_[cd]|hotels_v2_h2b(?:1|2)|hotels_v2_h3(?:_1|_2a|_pricing_promotion)|hotels_v2_seven_arches_(?:property_proposal|pricing_activation))_[a-z0-9_]+$/i.test(message)
      ? message
      : null;
    // H2B.1 uses PostgREST's explicit HTTP-conflict SQLSTATE for reviewed
    // optimistic-concurrency failures. Keep 40001 recognition for the older
    // H2A/H2B RPCs until their contracts are migrated independently.
    normalized.isStale = code === 'PT409'
      || code === '40001'
      || /stale|version|original_mismatch|concurrent|changed after review/i.test(message);
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

  async function getPartnerPropertyProposals(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id || id !== Core.SEVEN_ARCHES_PROPERTY_ID) throw new Error('Partner property proposals are available only for the exact reviewed 7 Arches Hotel.');
    return Core.validatePartnerPropertyProposalsControl(await runRpc(RPC.partnerPropertyProposals, {
      p_hotel_id: id,
    }, 'Load pending Partner property proposals'), id);
  }

  async function previewPartnerPropertyProposalPlan(requestValue, controlValue) {
    const request = Core.validatePartnerPropertyProposalReviewRequest(requestValue, controlValue);
    const preview = Core.validatePartnerPropertyProposalPreview(await runRpc(RPC.previewPartnerPropertyProposalPlan, {
      p_request: request,
    }, 'Review Partner property proposal'), request, controlValue);
    reviewedPartnerPropertyProposalPlans.set(preview.reviewed_plan.plan_fingerprint, {
      bytes: stableJson(preview.reviewed_plan),
      plan: preview.reviewed_plan,
    });
    return preview;
  }

  async function applyPartnerPropertyProposalPlan(planValue, correlationId) {
    const fingerprint = String(planValue?.plan_fingerprint || '');
    const cached = reviewedPartnerPropertyProposalPlans.get(fingerprint);
    if (!cached || cached.bytes !== stableJson(planValue)) {
      throw new Error('Partner property proposal Save requires the exact server-reviewed plan from the current explicit Review.');
    }
    reviewedPartnerPropertyProposalPlans.delete(fingerprint);
    const plan = cached.plan;
    const correlation = correlationId == null ? Core.newUuid() : Core.normalizeUuid(correlationId);
    if (!correlation || correlation !== correlationId) {
      throw new Error('7 Arches activation correlation ID must be an exact lowercase canonical UUID.');
    }
    let receipt;
    try {
      receipt = await runRpc(RPC.applyPartnerPropertyProposalPlan, {
        p_reviewed_plan: plan,
        p_correlation_id: correlation,
      }, 'Save reviewed Partner property proposal');
    } catch (error) {
      throw error;
    }
    let validated;
    try {
      validated = Core.validatePartnerPropertyProposalApplyResult(receipt, plan, correlation);
    } catch (cause) {
      const error = new Error('The Partner proposal Save returned a response that could not be validated after the RPC completed. Refresh current state; the mutation will not be retried.');
      error.saveSucceeded = true; error.isAmbiguousOutcome = true; error.isDefinitiveFailure = false;
      error.userMessage = error.message; error.cause = cause;
      throw error;
    }
    try {
      const [workspace, contentControl, proposals] = await Promise.all([
        getWorkspace(plan.hotel_id), getContentControl(plan.hotel_id), getPartnerPropertyProposals(plan.hotel_id),
      ]);
      return { ...validated, workspace, content_control: contentControl, proposals };
    } catch (cause) {
      const error = new Error('The Partner proposal Save receipt was validated, but the canonical Admin state could not be refreshed. Refresh current state; the mutation will not be retried.');
      error.saveSucceeded = true; error.isAmbiguousOutcome = true; error.isDefinitiveFailure = false;
      error.userMessage = error.message; error.cause = cause;
      throw error;
    }
  }

  async function getSevenArchesPricingActivation() {
    return Core.validateSevenArchesPricingActivationSnapshot(await runRpc(
      RPC.sevenArchesPricingActivation, {}, 'Load exact 7 Arches pricing activation',
    ));
  }

  async function previewSevenArchesPricingActivation(draftValue, snapshotValue) {
    const draft = Core.validateSevenArchesPricingActivationDraft(draftValue, snapshotValue);
    const preview = Core.validateSevenArchesPricingActivationPreview(await runRpc(
      RPC.previewSevenArchesPricingActivation, { p_draft: draft },
      'Review exact 7 Arches pricing activation',
    ), draft, snapshotValue);
    if (preview.changed) {
      reviewedSevenArchesPricingActivationPlans.set(preview.reviewed_plan.plan_fingerprint, {
        bytes: stableJson(preview.reviewed_plan), plan: preview.reviewed_plan,
        draft, snapshot: Core.clone(snapshotValue),
      });
    }
    return preview;
  }

  async function applySevenArchesPricingActivation(planValue, correlationId, idempotencyKey) {
    const fingerprint = String(planValue?.plan_fingerprint || '');
    const cached = reviewedSevenArchesPricingActivationPlans.get(fingerprint);
    if (!cached || cached.bytes !== stableJson(planValue)) {
      throw new Error('7 Arches pricing activation Save requires the exact server-reviewed plan from the current explicit Review.');
    }
    const plan = cached.plan;
    const correlation = correlationId == null ? Core.newUuid() : Core.normalizeUuid(correlationId);
    if (!correlation || correlation !== correlationId) {
      throw new Error('7 Arches activation correlation ID must be an exact lowercase canonical UUID.');
    }
    const idempotency = idempotencyKey == null ? Core.newUuid() : idempotencyKey;
    if (typeof idempotency !== 'string' || idempotency !== idempotency.trim()
        || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(idempotency)) {
      throw new Error('7 Arches activation idempotency key must be an exact reviewed string.');
    }
    reviewedSevenArchesPricingActivationPlans.delete(fingerprint);
    let receipt;
    try {
      receipt = await runRpc(RPC.applySevenArchesPricingActivation, {
        p_reviewed_plan: plan, p_correlation_id: correlation, p_idempotency_key: idempotency,
      }, 'Save exact 7 Arches pricing activation');
    } catch (error) { throw error; }
    let validated;
    try {
      validated = Core.validateSevenArchesPricingActivationApplyResult(
        receipt, plan, correlation, idempotency,
      );
    } catch (cause) {
      const error = new Error('The activation RPC completed but its receipt could not be validated. Refresh current state; the reviewed mutation will not be retried.');
      error.saveSucceeded = true; error.isAmbiguousOutcome = true; error.isDefinitiveFailure = false;
      error.userMessage = error.message; error.cause = cause;
      throw error;
    }
    try {
      const [activation, workspace, pricingControl] = await Promise.all([
        getSevenArchesPricingActivation(), getWorkspace(plan.hotel_id), getPricingControl(plan.hotel_id),
      ]);
      const payload = plan.operation.payload;
      if (activation.status !== 'active'
          || stableJson(activation.rate_plan.name_i18n) !== stableJson(payload.rate_plan_name_i18n)
          || stableJson(activation.rate_plan.description_i18n) !== stableJson(payload.rate_plan_description_i18n)
          || stableJson(activation.shared_schedule.name_i18n) !== stableJson(payload.schedule_name_i18n)
          || activation.room_rates[0].base_nightly_rate !== payload.upper_base_nightly_rate
          || activation.room_rates[1].base_nightly_rate !== payload.ground_base_nightly_rate) {
        throw new Error('Refreshed activation state does not match the exact reviewed target.');
      }
      return { ...validated, activation, workspace, pricing_control: pricingControl };
    } catch (cause) {
      const error = new Error('The activation receipt was validated, but exact current pricing could not be refreshed. Refresh current state; the mutation will not be retried.');
      error.saveSucceeded = true; error.isAmbiguousOutcome = true; error.isDefinitiveFailure = false;
      error.userMessage = error.message; error.cause = cause;
      throw error;
    }
  }

  function normalizeContentControl(payloadValue, hotelId) {
    const id = Core.normalizeUuid(hotelId);
    const payload = Core.asObject(payloadValue);
    const profile = Core.asObject(payload.operational_profile);
    const envelopeKeys = [
      'architecture_version', 'assignment_snapshot', 'commercial_owner', 'contract_version',
      'feature_flags', 'hotel_id', 'operational_profile', 'property_updated_at',
    ];
    const profileKeys = [
      'check_in_instructions_i18n', 'check_out_instructions_i18n', 'exists',
      'guest_instructions_i18n', 'internal_operational_notes', 'maximum_stay_nights',
      'updated_at', 'version',
    ];
    const profileVersion = Number(profile.version);
    const profileExists = profile.exists === true;
    const maximumStay = profile.maximum_stay_nights == null ? null : Number(profile.maximum_stay_nights);
    const architectureVersion = String(payload.architecture_version || '').trim();
    const featureFlags = Core.asObject(payload.feature_flags);
    const commercialOwner = payload.commercial_owner == null ? null : Core.asObject(payload.commercial_owner);
    const ownerKeys = ['can_manage_hotels', 'name', 'partner_id', 'status'];
    const requiredOffFlags = [
      'hotel_external_sync_enabled', 'hotel_instant_booking_enabled',
      'hotel_rooms_v2_enabled', 'hotel_stripe_connect_enabled',
    ];
    const i18nFields = ['guest_instructions_i18n', 'check_in_instructions_i18n', 'check_out_instructions_i18n'];
    if (JSON.stringify(Object.keys(payload).sort()) !== JSON.stringify(envelopeKeys)
        || JSON.stringify(Object.keys(profile).sort()) !== JSON.stringify(profileKeys)
        || payload.contract_version !== 'hotels_v2_admin_b_content_control_v1'
        || Core.normalizeUuid(payload.hotel_id) !== id
        || !String(payload.property_updated_at || '').trim()
        || !['legacy', 'rooms_v2'].includes(architectureVersion)
        || JSON.stringify(Object.keys(featureFlags).sort()) !== JSON.stringify(requiredOffFlags)
        || requiredOffFlags.some((key) => featureFlags[key] !== false)
        || (commercialOwner != null && (
          JSON.stringify(Object.keys(commercialOwner).sort()) !== JSON.stringify(ownerKeys)
          || !Core.normalizeUuid(commercialOwner.partner_id)
          || typeof commercialOwner.name !== 'string'
          || typeof commercialOwner.status !== 'string'
          || typeof commercialOwner.can_manage_hotels !== 'boolean'
        ))
        || !payload.operational_profile || !payload.assignment_snapshot
        || typeof profile.exists !== 'boolean'
        || !Number.isInteger(profileVersion) || profileVersion < 0
        || (profileExists ? profileVersion < 1 : profileVersion !== 0)
        || (profileExists ? !String(profile.updated_at || '').trim() : profile.updated_at != null)
        || (maximumStay != null && (!Number.isInteger(maximumStay) || maximumStay < 1 || maximumStay > 365))
        || i18nFields.some((field) => !profile[field] || Array.isArray(profile[field]) || typeof profile[field] !== 'object'
          || Object.keys(profile[field]).some((key) => !Core.LANGUAGES.includes(key))
          || Object.values(profile[field]).some((value) => typeof value !== 'string' || value.length > 8000))
        || (profile.internal_operational_notes != null
          && (typeof profile.internal_operational_notes !== 'string' || profile.internal_operational_notes.length > 5000))) {
      throw new Error('Admin content control returned an unsupported or cross-property snapshot.');
    }
    const assignmentSnapshot = Core.validatePartnerHotelPermissions(payload.assignment_snapshot, id);
    if (assignmentSnapshot.property.architecture_version !== architectureVersion
        || assignmentSnapshot.property.updated_at !== String(payload.property_updated_at)
        || requiredOffFlags.some((key) => assignmentSnapshot.feature_flags[key] !== featureFlags[key])) {
      throw new Error('Admin content control returned inconsistent architecture, flags or property snapshot values.');
    }
    return {
      ...Core.clone(payload),
      architecture_version: architectureVersion,
      feature_flags: Core.clone(featureFlags),
      commercial_owner: commercialOwner ? {
        ...Core.clone(commercialOwner),
        partner_id: Core.normalizeUuid(commercialOwner.partner_id),
      } : null,
      operational_profile: {
        ...Core.clone(profile),
        exists: profileExists,
        version: profileVersion,
        maximum_stay_nights: maximumStay,
        guest_instructions_i18n: Core.normalizeI18n(profile.guest_instructions_i18n),
        check_in_instructions_i18n: Core.normalizeI18n(profile.check_in_instructions_i18n),
        check_out_instructions_i18n: Core.normalizeI18n(profile.check_out_instructions_i18n),
        internal_operational_notes: Core.asNullableText(profile.internal_operational_notes),
      },
      assignment_snapshot: assignmentSnapshot,
    };
  }

  async function getContentControl(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    return normalizeContentControl(await runRpc(RPC.contentControl, {
      p_hotel_id: id,
    }, 'Load Admin property content control'), id);
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
    const reviewedPayload = Core.asObject(Core.clone(payload || {}));
    const requiredText = ['slug', 'city', 'country', 'timezone', 'currency'];
    if (requiredText.some((field) => !String(reviewedPayload[field] || '').trim())
        || !Core.i18nText(reviewedPayload.title_i18n, 'en')
        || !/^[A-Z]{3}$/.test(String(reviewedPayload.currency || '').trim().toUpperCase())) {
      throw new Error('A reviewed slug, English name, city, country, timezone and ISO currency are required. No location value is inferred.');
    }
    try { new Intl.DateTimeFormat('en', { timeZone: String(reviewedPayload.timezone).trim() }).format(); }
    catch (_error) { throw new Error('A valid reviewed IANA timezone is required.'); }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.createProperty, {
      p_id: propertyId,
      p_payload: reviewedPayload,
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

  async function getAvailabilityControl(hotelId, startDate, endDate) {
    const id = Core.normalizeUuid(hotelId);
    const from = String(startDate || '').trim();
    const to = String(endDate || '').trim();
    if (!id || !Core.isExactIsoDate(from) || !Core.isExactIsoDate(to) || to < from) {
      throw new Error('A valid exact property and availability range are required.');
    }
    const data = await runRpc(RPC.availabilityControl, {
      p_hotel_id: id,
      p_from: from,
      p_to: to,
    }, 'Load Admin availability control');
    const control = Core.normalizeAvailabilityControl(data);
    if (control.hotel_id !== id || control.from !== from || control.to !== to) {
      throw new Error('Availability control returned a different exact property or range.');
    }
    return control;
  }

  async function previewAvailabilityPlan(draft) {
    const reviewedDraft = Core.validateAvailabilityDraft(Core.clone(draft));
    const data = await runRpc(RPC.previewAvailabilityPlan, {
      p_draft: reviewedDraft,
    }, 'Preview reviewed availability changes');
    const preview = Core.validateAvailabilityPlanPreview(data, reviewedDraft);
    if (preview.hotel_id !== reviewedDraft.hotel_id) {
      throw new Error('Availability preview returned a different exact property.');
    }
    reviewedAvailabilityPlans.clear();
    reviewedAvailabilityPlans.set(preview.plan_fingerprint, JSON.stringify(preview.reviewed_plan));
    return preview;
  }

  async function applyAvailabilityControlPlan(plan, correlationId, idempotencyKey) {
    const reviewedPlan = Core.validateAvailabilityPlan(Core.clone(plan));
    const correlation = Core.normalizeUuid(correlationId);
    const idempotency = typeof idempotencyKey === 'string' ? idempotencyKey : '';
    const cachedPlan = reviewedAvailabilityPlans.get(reviewedPlan.plan_fingerprint);
    if (!correlation || correlation !== correlationId
        || idempotency !== idempotency.trim()
        || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,119}$/.test(idempotency)) {
      throw new Error('Availability Save requires the exact reviewed correlation and idempotency identifiers.');
    }
    if (!cachedPlan || cachedPlan !== JSON.stringify(reviewedPlan)) {
      throw new Error('Availability Save requires the exact server-reviewed plan from the current explicit Review.');
    }
    reviewedAvailabilityPlans.delete(reviewedPlan.plan_fingerprint);
    const data = await runRpc(RPC.applyAvailabilityControl, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
      p_idempotency_key: idempotency,
    }, 'Save reviewed Admin availability changes');
    return Core.validateAvailabilityApplyResult(data, reviewedPlan, correlation, idempotency);
  }

  async function previewAvailabilityStay(request) {
    const reviewedRequest = Core.validateAvailabilityStayRequest(Core.clone(request));
    const data = await runRpc(RPC.previewAvailabilityStay, {
      p_request: reviewedRequest,
    }, 'Preview authoritative available stay');
    return Core.validateAvailabilityStayPreview(data, reviewedRequest);
  }

  async function getExternalCalendarControl(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id || id !== hotelId) throw new Error('A canonical exact property ID is required.');
    const data = await runRpc(RPC.externalCalendarControl, { p_hotel_id: id }, 'Load external calendars');
    return Core.normalizeExternalCalendarControl(data, { actorType: 'admin', hotelId: id });
  }

  async function previewExternalCalendarPlan(draft, control) {
    const reviewedDraft = Core.validateExternalCalendarDraft(Core.clone(draft), control);
    const secretUrl = reviewedDraft.intent.entity === 'ical_secret'
      && ['set', 'rotate'].includes(reviewedDraft.intent.action)
      ? reviewedDraft.intent.payload.ical_url : null;
    const data = await runRpc(RPC.previewExternalCalendarPlan, {
      p_draft: reviewedDraft,
    }, 'Review external calendar change');
    const preview = Core.validateExternalCalendarPreview(data, reviewedDraft, control);
    reviewedExternalCalendarPlans.clear();
    if (preview.reviewed_plan) {
      if (secretUrl) {
        const fingerprint = await sha256Hex(secretUrl);
        if (preview.reviewed_plan.operations[0].payload.url_fingerprint !== fingerprint) {
          throw new Error('The server-reviewed calendar URL fingerprint differs from the exact transient URL.');
        }
      }
      reviewedExternalCalendarPlans.set(preview.reviewed_plan.plan_fingerprint, {
        bytes: stableJson(preview.reviewed_plan),
        plan: preview.reviewed_plan,
        secretUrl,
      });
    }
    return preview;
  }

  async function applyExternalCalendarPlan(planValue, correlationId, idempotencyKey, icalUrl = null) {
    const plan = Core.clone(planValue);
    const correlation = Core.normalizeUuid(correlationId);
    const idempotency = Core.normalizeUuid(idempotencyKey);
    const cache = reviewedExternalCalendarPlans.get(plan?.plan_fingerprint);
    if (!correlation || correlation !== correlationId || !idempotency || idempotency !== idempotencyKey
        || !cache || cache.plan !== planValue || cache.bytes !== stableJson(plan)) {
      throw new Error('External calendar Save requires the exact unchanged server-reviewed plan and exact request IDs.');
    }
    const secretOperation = plan.operations?.[0]?.entity === 'ical_secret';
    const secretWrite = secretOperation && ['set', 'rotate'].includes(plan.operations[0].action);
    if ((secretWrite && (typeof icalUrl !== 'string' || icalUrl !== cache.secretUrl))
        || (!secretWrite && icalUrl !== null)) {
      throw new Error('External calendar Save transient URL does not match the explicit server Review.');
    }
    if (secretWrite && await sha256Hex(icalUrl) !== plan.operations[0].payload.url_fingerprint) {
      throw new Error('External calendar Save URL fingerprint changed after Review.');
    }
    reviewedExternalCalendarPlans.delete(plan.plan_fingerprint);
    const data = await runRpc(RPC.applyExternalCalendarPlan, {
      p_reviewed_plan: plan,
      p_correlation_id: correlation,
      p_idempotency_key: idempotency,
      p_ical_url: secretWrite ? icalUrl : null,
    }, 'Save reviewed external calendar change');
    return Core.validateExternalCalendarApplyResult(data, {
      plan, correlationId: correlation, idempotencyKey: idempotency,
    });
  }

  function clearExternalCalendarReviewedPlan() {
    reviewedExternalCalendarPlans.clear();
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

  async function applyPropertyControlPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    if (!id || reviewedPlan?.contract_version !== 'hotels_v2_admin_b_property_control_v1'
        || !reviewedPlan?.expected_property_updated_at || !reviewedPlan?.reviewed_at
        || !Number.isInteger(Number(reviewedPlan?.expected_operational_profile_version))
        || Number(reviewedPlan.expected_operational_profile_version) < 0
        || !reviewedPlan?.expected_original || typeof reviewedPlan.expected_original !== 'object'
        || !reviewedPlan?.payload || typeof reviewedPlan.payload !== 'object'
        || !Object.keys(reviewedPlan.payload).length
        || JSON.stringify(Object.keys(reviewedPlan.expected_original).sort())
          !== JSON.stringify(Object.keys(reviewedPlan.payload).sort())) {
      throw new Error('A reviewed exact-property Admin control plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyPropertyControl, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed property control changes');
    const payload = Core.asObject(data);
    if (payload.contract_version !== 'hotels_v2_admin_b_property_control_v1'
        || Core.normalizeUuid(payload.hotel_id) !== id) {
      throw new Error('Saved property control returned an unsupported or cross-property result.');
    }
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Saved property control returned a different property ID.');
    const contentControl = normalizeContentControl(payload.content_control, id);
    return {
      ...payload,
      correlation_id: payload.correlation_id || correlation,
      workspace,
      content_control: contentControl,
    };
  }

  async function applyRoomControlPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const roomId = Core.normalizeUuid(reviewedPlan?.operation?.id);
    if (!id || reviewedPlan?.contract_version !== 'hotels_v2_admin_b_room_control_v1'
        || !roomId || !['create', 'update', 'disable', 'duplicate'].includes(Core.asText(reviewedPlan?.operation?.type))
        || !reviewedPlan.operation.expected_original || typeof reviewedPlan.operation.expected_original !== 'object'
        || !reviewedPlan.operation.payload || typeof reviewedPlan.operation.payload !== 'object') {
      throw new Error('A reviewed exact Room Type Admin control plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const data = await runRpc(RPC.applyRoomControl, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed Room Type control changes');
    const payload = Core.asObject(data);
    if (payload.contract_version !== 'hotels_v2_admin_b_room_control_v1'
        || Core.normalizeUuid(payload.hotel_id) !== id
        || Core.normalizeUuid(payload.room_type_id) !== roomId) {
      throw new Error('Saved Room Type control returned an unsupported or cross-property result.');
    }
    const workspace = Core.normalizeWorkspace(payload.workspace || payload);
    if (workspace.property.id !== id) throw new Error('Saved Room Type control returned a different property ID.');
    return { ...payload, correlation_id: payload.correlation_id || correlation, workspace };
  }

  async function applyOperationalAssignmentPlan(plan, correlationId) {
    const reviewedPlan = Core.clone(plan);
    const id = Core.normalizeUuid(reviewedPlan?.hotel_id);
    const operation = Core.asObject(reviewedPlan?.operation);
    const assignmentId = Core.normalizeUuid(operation.assignment_id);
    const partnerId = Core.normalizeUuid(operation.partner_id);
    if (!id || reviewedPlan?.contract_version !== 'hotels_v2_admin_b_operational_assignment_v1'
        || !reviewedPlan?.reviewed_at || !String(reviewedPlan?.snapshot_token || '').trim()
        || !String(reviewedPlan?.expected_assignment_fingerprint || '').trim()
        || !assignmentId || !partnerId || !['assign', 'remove'].includes(Core.asText(operation.type))
        || !Number.isInteger(Number(operation.expected_staff_scope_count))
        || Number(operation.expected_staff_scope_count) < 0
        || !Array.isArray(operation.expected_staff_scope_ids)
        || operation.expected_staff_scope_ids.some((scopeId) => !Core.normalizeUuid(scopeId))
        || new Set(operation.expected_staff_scope_ids).size !== operation.expected_staff_scope_ids.length
        || JSON.stringify([...operation.expected_staff_scope_ids].sort()) !== JSON.stringify(operation.expected_staff_scope_ids)
        || operation.expected_staff_scope_ids.length !== Number(operation.expected_staff_scope_count)
        || typeof operation.expected_permission_exists !== 'boolean') {
      throw new Error('A reviewed exact operational-assignment plan is required.');
    }
    const correlation = Core.normalizeUuid(correlationId) || Core.newUuid();
    const payload = Core.asObject(await runRpc(RPC.applyOperationalAssignment, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
    }, 'Save reviewed Hotel operational assignment'));
    if (payload.contract_version !== 'hotels_v2_admin_b_operational_assignment_v1'
        || Core.normalizeUuid(payload.hotel_id) !== id
        || Core.normalizeUuid(payload.assignment_id) !== assignmentId
        || Core.normalizeUuid(payload.partner_id) !== partnerId
        || Core.asText(payload.operation) !== Core.asText(operation.type)) {
      throw new Error('Operational-assignment save returned an unsupported or cross-property result.');
    }
    const contentControl = normalizeContentControl(payload.content_control, id);
    return {
      ...payload,
      correlation_id: payload.correlation_id || correlation,
      content_control: contentControl,
    };
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
    const safeSlug = Core.asText(propertySlug).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
    const exactRoomId = Core.normalizeUuid(roomId);
    if (!safeSlug || !exactRoomId) throw new Error('Property slug and exact Room Type ID are required for upload.');
    if (typeof optimizedUploader !== 'function') {
      throw new Error('The optimized exact Room Type media uploader is unavailable. No raw Storage upload was attempted.');
    }
    return optimizedUploader(safeSlug, exactRoomId, files);
  }

  async function getPricingControl(hotelId) {
    const id = Core.normalizeUuid(hotelId);
    if (!id) throw new Error('A valid property ID is required.');
    return Core.validatePricingControl(await runRpc(RPC.pricingControl, {
      p_hotel_id: id,
    }, 'Load Admin pricing control'), id);
  }

  async function applyPricingControlPlan(plan, correlationId, idempotencyKey) {
    const reviewedPlan = Core.validatePricingControlPlan(plan);
    const correlation = correlationId === undefined || correlationId === null
      ? Core.newUuid()
      : Core.normalizeUuid(correlationId);
    if (!correlation) throw new Error('Pricing correlation ID must be an exact UUID; an invalid supplied ID is never replaced.');
    const idempotency = idempotencyKey === undefined || idempotencyKey === null
      ? Core.newUuid()
      : idempotencyKey;
    if (typeof idempotency !== 'string'
        || idempotency !== idempotency.trim()
        || idempotency.length < 8 || idempotency.length > 120
        || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(idempotency)) {
      throw new Error('Pricing idempotency key must be an exact reviewed string; an invalid supplied key is never replaced.');
    }
    const data = Core.asObject(await runRpc(RPC.applyPricingControl, {
      p_plan: reviewedPlan,
      p_correlation_id: correlation,
      p_idempotency_key: idempotency,
    }, 'Save reviewed pricing changes'));
    const exactResponseKeys = [
      'contract_version', 'hotel_id', 'correlation_id', 'idempotency_key',
      'replayed', 'changed', 'activity', 'pricing_control',
    ];
    if (JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(exactResponseKeys.sort())
        || data.contract_version !== Core.PRICING_CONTROL_CONTRACT
        || Core.normalizeUuid(data.hotel_id) !== reviewedPlan.hotel_id
        || Core.normalizeUuid(data.correlation_id) !== correlation
        || typeof data.idempotency_key !== 'string'
        || data.idempotency_key !== idempotency
        || typeof data.changed !== 'boolean'
        || typeof data.replayed !== 'boolean'
        || !Array.isArray(data.activity)
        || data.activity.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
      throw new Error('Saved pricing control returned a different exact request identity.');
    }
    const activityKeys = [
      'id', 'entity_type', 'entity_id', 'action', 'correlation_id', 'actor_type',
      'actor_id', 'source', 'created_at', 'before_state', 'after_state',
    ];
    const exactActivityEntity = {
      rate_plan: 'rate_plan',
      room_rate: 'room_rate',
      pricing_schedule: 'pricing_schedule',
      room_rate_tier_set: 'occupancy_tier',
      rate_rule: 'rate_rule',
      exact_date_price: 'calendar_override',
      allocation_rule: 'allocation_rule',
      property_pricing_default: 'property_pricing_default',
    };
    const expectedActivityAction = (operation) => (
      operation.entity === 'pricing_schedule' && operation.action === 'clone'
        ? 'duplicate'
        : operation.action
    );
    const operationForActivity = (activity) => reviewedPlan.operations.find((operation) => (
      exactActivityEntity[operation.entity] === activity.entity_type
      && operation.id === Core.normalizeUuid(activity.entity_id)
      && expectedActivityAction(operation) === activity.action
    ));
    const validJsonState = (value) => value === null
      || (typeof value === 'object' && !Array.isArray(value));
    if (data.activity.some((activity) => (
      JSON.stringify(Object.keys(Core.asObject(activity)).sort()) !== JSON.stringify([...activityKeys].sort())
      || !Core.normalizeUuid(activity.id)
      || !Core.normalizeUuid(activity.entity_id)
      || Core.normalizeUuid(activity.correlation_id) !== correlation
      || activity.actor_type !== 'admin'
      || !Core.normalizeUuid(activity.actor_id)
      || activity.source !== 'hotels_v2_admin_c_pricing_control'
      || typeof activity.created_at !== 'string' || !Number.isFinite(Date.parse(activity.created_at))
      || !validJsonState(activity.before_state) || !validJsonState(activity.after_state)
      || !operationForActivity(activity)
    )) || (data.changed === false && data.activity.length > 0)
      || (data.changed === true && data.activity.length === 0)) {
      throw new Error('Saved pricing control returned invalid or unrelated activity receipts.');
    }
    const pricingControl = Core.validatePricingControl(data.pricing_control, reviewedPlan.hotel_id);
    const receiptActivityProbe = Core.clone(data.pricing_control);
    receiptActivityProbe.recent_activity = Core.clone(data.activity);
    Core.validatePricingControl(receiptActivityProbe, reviewedPlan.hotel_id);
    if (data.replayed !== true && data.activity.some((activity) => !pricingControl.recent_activity.some((recent) => (
      JSON.stringify(recent) === JSON.stringify(activity)
    )))) {
      throw new Error('Saved pricing activity was not present in the exact sanitized pricing snapshot.');
    }
    const collectionFor = (entity) => ({
      rate_plan: pricingControl.rate_plans,
      room_rate: pricingControl.room_rates,
      pricing_schedule: pricingControl.pricing_schedules,
      room_rate_tier_set: pricingControl.room_rates,
      rate_rule: pricingControl.rate_rules,
      exact_date_price: pricingControl.exact_date_prices,
      allocation_rule: pricingControl.allocation_rules,
      property_pricing_default: pricingControl.property_pricing_default
        ? [pricingControl.property_pricing_default] : [],
    }[entity] || []);
    const exactDateDeletionConfirmed = (operation) => operation.entity === 'exact_date_price'
      && operation.action === 'disable'
      && data.activity.some((activity) => activity.entity_type === 'calendar_override'
        && Core.normalizeUuid(activity.entity_id) === operation.id
        && activity.action === 'disable' && activity.after_state === null);
    if (reviewedPlan.operations.some((operation) => !collectionFor(operation.entity)
      .some((entry) => Core.normalizeUuid(entry.id) === operation.id)
      && !exactDateDeletionConfirmed(operation))) {
      throw new Error('Saved pricing control did not return every exact reviewed mutation target.');
    }
    const withoutVersions = (value) => JSON.parse(JSON.stringify(value, (key, nested) => (
      key === 'version' ? undefined : nested
    )));
    for (const operation of reviewedPlan.operations) {
      const saved = collectionFor(operation.entity)
        .find((entry) => Core.normalizeUuid(entry.id) === operation.id) || null;
      if (operation.action === 'disable') {
        const disabled = operation.entity === 'exact_date_price'
          ? (!saved || saved.pricing_configured === false)
          : operation.entity === 'rate_rule'
            ? saved?.is_active === false
            : saved?.lifecycle_status === 'disabled';
        if (!disabled) throw new Error('Saved pricing control did not confirm the reviewed disable state.');
        continue;
      }
      if (operation.action === 'clone') {
        const savedState = Core.pricingBusinessState('pricing_schedule', saved, {
          id: operation.id, hotelId: reviewedPlan.hotel_id,
        });
        const savedSource = pricingControl.pricing_schedules
          .find((entry) => entry.id === Core.normalizeUuid(operation.payload.source_schedule_id));
        const pairedRelink = reviewedPlan.operations.find((candidate) => candidate.entity === 'room_rate'
          && candidate.action === 'update'
          && Core.normalizeUuid(candidate.payload.pricing_schedule_id) === operation.id);
        const expectedLinkedIds = pairedRelink ? [pairedRelink.id] : [];
        const expectedTiers = operation.payload.tiers.map((tier) => ({ ...Core.clone(tier) }));
        if (!savedSource
            || savedState.code !== operation.payload.code
            || JSON.stringify(savedState.name_i18n) !== JSON.stringify(operation.payload.name_i18n)
            || savedState.sharing_mode !== operation.payload.sharing_mode
            || savedState.lifecycle_status !== 'draft'
            || savedState.application_scope !== savedSource.application_scope
            || savedState.currency !== savedSource.currency
            || savedState.maximum_party_size !== savedSource.maximum_party_size
            || savedState.minimum_billable_occupancy !== savedSource.minimum_billable_occupancy
            || JSON.stringify([...saved.linked_room_rate_ids].sort()) !== JSON.stringify(expectedLinkedIds.sort())
            || JSON.stringify(withoutVersions(savedState.tiers)) !== JSON.stringify(withoutVersions(expectedTiers))) {
          throw new Error('Saved pricing control did not confirm the exact reviewed schedule clone.');
        }
        continue;
      }
      const savedState = Core.pricingBusinessState(operation.entity,
        operation.entity === 'room_rate_tier_set'
          ? { ...saved, tiers: saved.independent_tiers }
          : saved,
        { id: operation.id, hotelId: reviewedPlan.hotel_id, create: operation.action === 'create' });
      if (JSON.stringify(withoutVersions(savedState)) !== JSON.stringify(withoutVersions(operation.payload))) {
        throw new Error('Saved pricing control did not confirm every exact reviewed business value.');
      }
    }
    let currentPricingControl = pricingControl;
    if (data.replayed === true) {
      try {
        currentPricingControl = await getPricingControl(reviewedPlan.hotel_id);
      } catch (cause) {
        const refreshError = new Error('The stored pricing save receipt was validated, but the current pricing state could not be refreshed. Check current state; the mutation will not be retried.');
        refreshError.isAmbiguousOutcome = true;
        refreshError.isDefinitiveFailure = false;
        refreshError.userMessage = refreshError.message;
        refreshError.cause = cause;
        throw refreshError;
      }
    }
    return {
      contract_version: data.contract_version,
      hotel_id: reviewedPlan.hotel_id,
      correlation_id: correlation,
      idempotency_key: idempotency,
      changed: data.changed,
      replayed: data.replayed,
      activity: data.activity,
      pricing_control: currentPricingControl,
    };
  }

  async function previewPricingQuote(request) {
    const reviewedRequest = Core.validatePricingPreviewRequest(request);
    return Core.validatePricingPreview(await runRpc(RPC.previewPricingQuote, {
      p_request: reviewedRequest,
    }, 'Preview server pricing'), reviewedRequest);
  }

  return Object.freeze({
    RPC,
    getClient,
    listProperties,
    getWorkspace,
    getPartnerPropertyProposals,
    previewPartnerPropertyProposalPlan,
    applyPartnerPropertyProposalPlan,
    getSevenArchesPricingActivation,
    previewSevenArchesPricingActivation,
    applySevenArchesPricingActivation,
    getContentControl,
    applyWorkspacePlan,
    createPropertyDraft,
    getCalendar,
    applyCalendarPlan,
    getAvailabilityControl,
    previewAvailabilityPlan,
    applyAvailabilityControlPlan,
    previewAvailabilityStay,
    getExternalCalendarControl,
    previewExternalCalendarPlan,
    applyExternalCalendarPlan,
    clearExternalCalendarReviewedPlan,
    resolveRate,
    applyGuestPolicyPlan,
    applyRoomTypePlan,
    applyPropertyControlPlan,
    applyRoomControlPlan,
    applyOperationalAssignmentPlan,
    prepareLegacyShadowRooms,
    getH3Configuration,
    applyH3ConfigurationPlan,
    getLegacyPricingPromotionPreview,
    applyLegacyPricingPromotion,
    getPartnerHotelPermissions,
    applyPartnerHotelPermissionsPlan,
    uploadRoomGallery,
    getPricingControl,
    applyPricingControlPlan,
    previewPricingQuote,
  });
});
