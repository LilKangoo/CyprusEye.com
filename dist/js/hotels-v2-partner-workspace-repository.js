(function attachHotelsV2PartnerWorkspaceRepository(root, factory) {
  const api = factory(root.HotelsV2PartnerWorkspaceCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HotelsV2PartnerWorkspaceRepository = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createHotelsV2PartnerWorkspaceRepository(Core) {
  'use strict';

  if (!Core) throw new Error('HotelsV2PartnerWorkspaceCore is required.');

  const RPC = Object.freeze({
    workspace: 'hotel_v2_partner_get_workspace',
    previewContent: 'hotel_v2_partner_preview_content_plan',
    applyContent: 'hotel_v2_partner_apply_content_plan',
    previewPricing: 'hotel_v2_partner_preview_pricing_plan',
    applyPricing: 'hotel_v2_partner_apply_pricing_plan',
    previewSevenArchesPricingProposal: 'hotel_v2_partner_preview_seven_arches_pricing_proposal',
    submitSevenArchesPricingProposal: 'hotel_v2_partner_submit_seven_arches_pricing_proposal',
    sevenArchesPricingControl: 'hotel_v2_partner_get_seven_arches_reviewed_pricing',
    previewCommercialStay: 'hotel_v2_partner_preview_commercial_stay',
    previewAvailability: 'hotel_v2_partner_preview_availability_plan',
    applyAvailability: 'hotel_v2_partner_apply_availability_plan',
    externalCalendarControl: 'hotel_v2_partner_get_external_calendar_control',
    previewExternalCalendar: 'hotel_v2_partner_preview_external_calendar_plan',
    applyExternalCalendar: 'hotel_v2_partner_apply_external_calendar_plan',
  });

  const reviewedPlans = new Map();
  const workspaceRanges = new Map();
  const currentWorkspaces = new Map();
  const reviewedExternalCalendarPlans = new Map();
  const reviewedSevenArchesPricingPlans = new Map();

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
      : (typeof window !== 'undefined' ? (window.sb || window.__SB__) : null);
    if (!client || typeof client.rpc !== 'function') throw new Error('Partner Hotel database connection is not available.');
    return client;
  }

  function exactUuid(value, label) {
    return Core.requireCanonicalUuid(value, label);
  }

  function exactDate(value, label) {
    return Core.requireIsoDate(value, label);
  }

  function planKey(domain, plan) {
    return `${domain}:${plan.partner_id}:${plan.hotel_id}:${plan.plan_fingerprint}`;
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function errorText(error) {
    return [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(' ').trim();
  }

  function toPartnerError(error, domain) {
    const raw = errorText(error) || 'Partner Hotel request failed.';
    const key = raw.toLowerCase();
    const wrapped = new Error(raw);
    wrapped.code = String(error?.code || 'PARTNER_HOTEL_ERROR');
    wrapped.domain = domain;
    wrapped.isStale = /(?:stale|snapshot|version|review_expired|permission_changed|assignment_changed)/.test(key);
    wrapped.isAmbiguousOutcome = /(?:timeout|network|fetch|connection|gateway|econn|abort)/.test(key)
      && !/(?:invalid|denied|forbidden|unauthorized|stale|conflict)/.test(key);
    wrapped.isDefinitiveFailure = !wrapped.isAmbiguousOutcome;
    if (wrapped.isStale) {
      wrapped.userMessage = 'The exact Partner Hotel state changed after Review. Reload it and prepare a fresh explicit Review; nothing was retried.';
    } else if (/(?:permission|assignment|forbidden|unauthorized|denied)/.test(key)) {
      wrapped.userMessage = 'This exact Hotel assignment no longer permits that action. No change was saved.';
    } else if (/(?:commission|payment|deposit|owner|partner_assignment|public_activation|architecture|smuggl)/.test(key)) {
      wrapped.userMessage = 'The request contained protected commercial or public fields. No change was saved.';
    } else if (wrapped.isAmbiguousOutcome) {
      wrapped.userMessage = 'The Save result is not yet known. Nothing was retried. Reload the exact workspace and inspect activity before deciding again.';
    } else {
      wrapped.userMessage = raw;
    }
    return wrapped;
  }

  async function call(name, payload, domain) {
    // Deliberately one request only. Mutations are never automatically retried.
    const { data, error } = await getClient().rpc(name, payload);
    if (error) throw toPartnerError(error, domain);
    return Array.isArray(data) && data.length === 1 ? data[0] : data;
  }

  async function getWorkspace(partnerId, hotelId, from, to) {
    const expectedPartnerId = exactUuid(partnerId, 'partner_id');
    const expectedHotelId = exactUuid(hotelId, 'hotel_id');
    const start = exactDate(from, 'from');
    const end = exactDate(to, 'to');
    const value = await call(RPC.workspace, {
      p_partner_id: expectedPartnerId,
      p_hotel_id: expectedHotelId,
      p_from: start,
      p_to: end,
    }, 'workspace');
    const workspace = Core.validateWorkspace(value, { partnerId: expectedPartnerId, hotelId: expectedHotelId, from: start, to: end });
    const workspaceKey = `${expectedPartnerId}:${expectedHotelId}`;
    workspaceRanges.set(workspaceKey, { from: start, to: end });
    currentWorkspaces.set(workspaceKey, workspace);
    return workspace;
  }

  async function preview(domain, draft) {
    const names = {
      content: RPC.previewContent,
      pricing: RPC.previewPricing,
      availability: RPC.previewAvailability,
    };
    if (!names[domain]) throw new Error('Unsupported Partner Hotel review domain.');
    const cleanDraft = Core.validateDraft(domain, draft);
    const current = currentWorkspaces.get(`${cleanDraft.partner_id}:${cleanDraft.hotel_id}`);
    if (!current) throw new Error('Load the exact Partner Hotel workspace before Review.');
    const value = await call(names[domain], { p_draft: cleanDraft }, domain);
    const result = Core.validatePlanPreview(domain, value, cleanDraft, current);
    const plan = result.reviewed_plan;
    if (result.changed) {
      if (!current || plan.assignment_id !== current.assignment.id
          || plan.permission_version !== current.assignment.permission_version
          || plan.access_snapshot_token !== current.assignment.access_snapshot_token) {
        throw new Error('Server Review is not bound to the exact loaded Partner assignment and permission version.');
      }
      const key = planKey(domain, plan);
      reviewedPlans.set(key, { bytes: stable(plan), plan });
    }
    return result;
  }

  async function apply(domain, reviewedPlan, correlationId, idempotencyKey) {
    const names = {
      content: RPC.applyContent,
      pricing: RPC.applyPricing,
      availability: RPC.applyAvailability,
    };
    if (!names[domain]) throw new Error('Unsupported Partner Hotel Save domain.');
    const plan = Core.validateReviewedPlan(domain, reviewedPlan);
    const correlation = exactUuid(correlationId, 'correlation_id');
    const idempotency = exactUuid(idempotencyKey, 'idempotency_key');
    const key = planKey(domain, plan);
    const cached = reviewedPlans.get(key);
    if (!cached || cached.plan !== reviewedPlan || cached.bytes !== stable(reviewedPlan)) {
      throw new Error('Only the exact unchanged server-reviewed Partner Hotel plan can be saved. Run Review again.');
    }
    let value;
    try {
      value = await call(names[domain], {
        p_reviewed_plan: plan,
        p_correlation_id: correlation,
        p_idempotency_key: idempotency,
      }, domain);
    } finally {
      reviewedPlans.delete(key);
    }
    let receipt;
    try {
      receipt = Core.validateApplyResult(domain, value, { plan, correlationId: correlation, idempotencyKey: idempotency });
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      wrapped.saveSucceeded = true;
      wrapped.isAmbiguousOutcome = false;
      wrapped.userMessage = 'Save returned success, but its exact receipt could not be verified. Nothing was retried. Reload the workspace and inspect activity.';
      throw wrapped;
    }
    const range = workspaceRanges.get(`${plan.partner_id}:${plan.hotel_id}`);
    if (!range) {
      const error = new Error('Save completed, but the exact workspace refresh range is unavailable. Reload before another action; nothing was retried.');
      error.saveSucceeded = true;
      error.isAmbiguousOutcome = false;
      error.userMessage = error.message;
      throw error;
    }
    try {
      const workspace = await getWorkspace(plan.partner_id, plan.hotel_id, range.from, range.to);
      if (workspace.assignment.id !== plan.assignment_id
          || workspace.assignment.permission_version !== plan.permission_version
          || workspace.assignment.access_snapshot_token !== plan.access_snapshot_token) {
        throw new Error('The exact Partner permission changed during Save refresh.');
      }
      return Object.freeze({ ...receipt, workspace });
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      wrapped.saveSucceeded = true;
      wrapped.isAmbiguousOutcome = false;
      wrapped.userMessage = 'Save completed, but the refreshed exact workspace could not be verified. Nothing was retried. Reload before another action.';
      throw wrapped;
    }
  }

  async function previewCommercialStay(request) {
    const clean = Core.validateCommercialStayRequest(request);
    const value = await call(RPC.previewCommercialStay, { p_request: clean }, 'commercial_stay');
    return Core.validateCommercialStayPreview(value, clean);
  }

  async function previewSevenArchesPricingProposal(draft) {
    const current = currentWorkspaces.get(`${draft?.partner_id}:${draft?.hotel_id}`);
    const cleanDraft = Core.validateSevenArchesReviewedPricingDraft(draft, current);
    const value = await call(RPC.previewSevenArchesPricingProposal, { p_draft: cleanDraft }, 'seven_arches_pricing');
    const preview = Core.validateSevenArchesReviewedPricingPreview(value, cleanDraft, current);
    const plan = preview.reviewed_plan;
    reviewedSevenArchesPricingPlans.clear();
    reviewedSevenArchesPricingPlans.set(plan.plan_fingerprint, {
      bytes: stable(plan),
      plan,
    });
    return preview;
  }

  async function getSevenArchesPricingControl(partnerId, hotelId) {
    const expectedPartnerId = exactUuid(partnerId, 'partner_id');
    const expectedHotelId = exactUuid(hotelId, 'hotel_id');
    const current = currentWorkspaces.get(`${expectedPartnerId}:${expectedHotelId}`);
    if (!current) throw new Error('Load the exact Partner Hotel workspace before reviewed pricing control.');
    const value = await call(RPC.sevenArchesPricingControl, {
      p_partner_id: expectedPartnerId,
      p_hotel_id: expectedHotelId,
    }, 'seven_arches_pricing');
    return Core.validateSevenArchesReviewedPricingControl(value, current);
  }

  async function submitSevenArchesPricingProposal(planValue, correlationId, idempotencyKey) {
    const correlation = exactUuid(correlationId, 'correlation_id');
    const idempotency = exactUuid(idempotencyKey, 'idempotency_key');
    const cache = reviewedSevenArchesPricingPlans.get(planValue?.plan_fingerprint);
    if (!cache || cache.plan !== planValue || cache.bytes !== stable(planValue)) {
      throw new Error('Only the exact unchanged server-reviewed 7 Arches pricing proposal can be submitted. Run Preview again.');
    }
    let value;
    try {
      value = await call(RPC.submitSevenArchesPricingProposal, {
        p_reviewed_plan: planValue,
        p_correlation_id: correlation,
        p_idempotency_key: idempotency,
      }, 'seven_arches_pricing');
    } finally {
      reviewedSevenArchesPricingPlans.delete(planValue.plan_fingerprint);
    }
    try {
      return Core.validateSevenArchesReviewedPricingSubmit(value, {
        plan: planValue,
        correlationId: correlation,
        idempotencyKey: idempotency,
      });
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      wrapped.saveSucceeded = true;
      wrapped.isAmbiguousOutcome = false;
      wrapped.userMessage = 'Proposal submission returned success, but its exact pending-review receipt could not be verified. Nothing was retried.';
      throw wrapped;
    }
  }

  async function getExternalCalendarControl(partnerId, hotelId) {
    const expectedPartnerId = exactUuid(partnerId, 'partner_id');
    const expectedHotelId = exactUuid(hotelId, 'hotel_id');
    const workspace = currentWorkspaces.get(`${expectedPartnerId}:${expectedHotelId}`);
    if (!workspace || workspace.assignment.capabilities.manage_availability !== true) {
      throw new Error('Load the exact Partner Hotel assignment with manage_availability before external calendars.');
    }
    const value = await call(RPC.externalCalendarControl, {
      p_partner_id: expectedPartnerId,
      p_hotel_id: expectedHotelId,
    }, 'external_calendar');
    return Core.normalizeExternalCalendarControl(value, {
      partnerId: expectedPartnerId,
      hotelId: expectedHotelId,
      assignmentId: workspace.assignment.id,
      permissionVersion: workspace.assignment.permission_version,
      accessSnapshotToken: workspace.assignment.access_snapshot_token,
    });
  }

  async function previewExternalCalendarPlan(draft, control) {
    const cleanDraft = Core.buildExternalCalendarDraft(control, draft.intent);
    if (stable(cleanDraft) !== stable(draft)) {
      throw new Error('External calendar Review requires the exact loaded access and snapshot tokens.');
    }
    const secretUrl = cleanDraft.intent.entity === 'ical_secret'
      && ['set', 'rotate'].includes(cleanDraft.intent.action)
      ? cleanDraft.intent.payload.ical_url : null;
    const value = await call(RPC.previewExternalCalendar, { p_draft: cleanDraft }, 'external_calendar');
    const preview = Core.validateExternalCalendarPreview(value, cleanDraft, control);
    reviewedExternalCalendarPlans.clear();
    if (preview.reviewed_plan) {
      if (secretUrl && await sha256Hex(secretUrl) !== preview.reviewed_plan.operations[0].payload.url_fingerprint) {
        throw new Error('The server-reviewed calendar URL fingerprint differs from the exact transient URL.');
      }
      reviewedExternalCalendarPlans.set(preview.reviewed_plan.plan_fingerprint, {
        bytes: stable(preview.reviewed_plan),
        plan: preview.reviewed_plan,
        secretUrl,
      });
    }
    return preview;
  }

  async function applyExternalCalendarPlan(planValue, correlationId, idempotencyKey, icalUrl = null) {
    const plan = planValue;
    const correlation = exactUuid(correlationId, 'correlation_id');
    const idempotency = exactUuid(idempotencyKey, 'idempotency_key');
    const cache = reviewedExternalCalendarPlans.get(plan?.plan_fingerprint);
    if (!cache || cache.plan !== planValue || cache.bytes !== stable(plan)) {
      throw new Error('Only the exact unchanged server-reviewed external-calendar plan can be saved. Run Review again.');
    }
    const secretOperation = plan.operations?.[0]?.entity === 'ical_secret';
    const secretWrite = secretOperation && ['set', 'rotate'].includes(plan.operations[0].action);
    if ((secretWrite && (typeof icalUrl !== 'string' || icalUrl !== cache.secretUrl))
        || (!secretWrite && icalUrl !== null)
        || (secretWrite && await sha256Hex(icalUrl) !== plan.operations[0].payload.url_fingerprint)) {
      throw new Error('The transient calendar URL changed after Review. Run Review again.');
    }
    reviewedExternalCalendarPlans.delete(plan.plan_fingerprint);
    const value = await call(RPC.applyExternalCalendar, {
      p_reviewed_plan: plan,
      p_correlation_id: correlation,
      p_idempotency_key: idempotency,
      p_ical_url: secretWrite ? icalUrl : null,
    }, 'external_calendar');
    return Core.validateExternalCalendarApplyResult(value, {
      plan, correlationId: correlation, idempotencyKey: idempotency,
    });
  }

  function clearReviewedPlans() {
    reviewedPlans.clear();
    reviewedExternalCalendarPlans.clear();
    reviewedSevenArchesPricingPlans.clear();
  }

  return Object.freeze({
    RPC,
    getWorkspace,
    previewContentPlan: (draft) => preview('content', draft),
    applyContentPlan: (plan, correlationId, idempotencyKey) => apply('content', plan, correlationId, idempotencyKey),
    previewPricingPlan: (draft) => preview('pricing', draft),
    applyPricingPlan: (plan, correlationId, idempotencyKey) => apply('pricing', plan, correlationId, idempotencyKey),
    previewSevenArchesPricingProposal,
    submitSevenArchesPricingProposal,
    getSevenArchesPricingControl,
    previewCommercialStay,
    previewAvailabilityPlan: (draft) => preview('availability', draft),
    applyAvailabilityPlan: (plan, correlationId, idempotencyKey) => apply('availability', plan, correlationId, idempotencyKey),
    getExternalCalendarControl,
    previewExternalCalendarPlan,
    applyExternalCalendarPlan,
    clearReviewedPlans,
  });
});
