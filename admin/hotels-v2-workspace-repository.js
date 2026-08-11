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
  });

  function getClient() {
    const client = typeof window !== 'undefined' && typeof window.getSupabase === 'function'
      ? window.getSupabase()
      : (typeof window !== 'undefined' ? window.sb || window.__SB__ : null);
    if (!client) throw new Error('Database connection is not available.');
    return client;
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
    normalized.isStale = code === '40001' || /stale|version|concurrent|changed after review/i.test(message);
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
    uploadRoomGallery,
  });
});
