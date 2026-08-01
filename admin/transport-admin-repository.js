(function registerTransportAdminRepository(root) {
  'use strict';

  const DEFAULT_TABLES = Object.freeze({
    transport_route: 'transport_routes',
    pricing_rule: 'transport_pricing_rules',
    deposit_override: 'service_deposit_overrides',
  });

  const RECENT_MATCH_MS = 15 * 60 * 1000;

  function abortError(signal) {
    const error = new Error(String(signal?.reason?.message || signal?.reason || 'Operation cancelled'));
    error.name = 'AbortError';
    error.code = 'operation_cancelled';
    return error;
  }

  function assertNotAborted(signal) {
    if (signal?.aborted) throw abortError(signal);
  }

  function applySignal(query, signal) {
    if (signal && query && typeof query.abortSignal === 'function') return query.abortSignal(signal);
    return query;
  }

  function rowFromResult(result) {
    if (Array.isArray(result?.data)) return result.data[0] || null;
    return result?.data && typeof result.data === 'object' ? result.data : null;
  }

  function rowsFromResult(result) {
    if (Array.isArray(result?.data)) return result.data;
    return result?.data && typeof result.data === 'object' ? [result.data] : [];
  }

  function staleConflict(message, details = null) {
    const error = new Error(message || 'Transport record changed since Review');
    error.code = 'transport_pair_stale_conflict';
    error.details = details;
    return error;
  }

  function comparableValue(actual, expected) {
    if (expected === null || expected === undefined) return actual === null || actual === undefined || actual === '' ? null : actual;
    if (typeof expected === 'number') return Number(actual);
    if (typeof expected === 'boolean') return Boolean(actual);
    const value = String(actual ?? '');
    if (/^\d{2}:\d{2}$/.test(String(expected)) && /^\d{2}:\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
    return value;
  }

  function valuesEqual(actual, expected) {
    return comparableValue(actual, expected) === comparableValue(expected, expected);
  }

  function payloadMatches(row, payload) {
    if (!row || !payload || typeof payload !== 'object') return false;
    return Object.entries(payload).every(([key, value]) => valuesEqual(row[key], value));
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function normalizedRowFingerprint(row, payload) {
    const projection = {};
    Object.entries(payload || {}).forEach(([key, expected]) => {
      projection[key] = comparableValue(row?.[key], expected);
    });
    return stableSerialize(projection);
  }

  function isRecent(row, createdAt) {
    const rowTime = Date.parse(String(row?.created_at || ''));
    const planTime = Date.parse(String(createdAt || ''));
    if (!Number.isFinite(rowTime) || !Number.isFinite(planTime)) return true;
    return rowTime >= planTime - RECENT_MATCH_MS;
  }

  function isAmbiguousWriteError(error) {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || error || '').toLowerCase();
    return code === '23505'
      || error?.name === 'TimeoutError'
      || error?.name === 'NetworkError'
      || /timeout|timed out|network|fetch|connection|socket|gateway|econn|ambiguous/.test(message);
  }

  function create(options = {}) {
    const runMutation = options.runMutation;
    if (typeof runMutation !== 'function') throw new Error('runMutation dependency is required');
    const tables = { ...DEFAULT_TABLES, ...(options.tables || {}) };

    function tableFor(type) {
      const table = tables[String(type || '')];
      if (!table) {
        const error = new Error(`Unsupported transport repository type: ${type}`);
        error.code = 'transport_repository_type_invalid';
        throw error;
      }
      return table;
    }

    async function run(operation) {
      const result = await runMutation(operation, { silentAuthNotice: true });
      if (result?.error) throw result.error;
      return result || { data: null, error: null };
    }

    async function selectRows(type, configure, signal) {
      assertNotAborted(signal);
      const result = await run((db) => {
        let query = db.from(tableFor(type)).select('*');
        query = configure(query);
        return applySignal(query, signal);
      });
      assertNotAborted(signal);
      return Array.isArray(result.data) ? result.data : (result.data ? [result.data] : []);
    }

    async function findById(request) {
      const id = String(request.id || '').trim();
      if (!id) return null;
      const rows = await selectRows(request.type, (query) => query.eq('id', id).limit(1), request.signal);
      return rows[0] || null;
    }

    async function findMatchingRecord(request, options = {}) {
      const payload = request.payload || {};
      let rows = [];
      if (request.type === 'transport_route') {
        rows = await selectRows(request.type, (query) => query
          .eq('origin_location_id', payload.origin_location_id)
          .eq('destination_location_id', payload.destination_location_id)
          .limit(10), request.signal);
      } else if (request.type === 'pricing_rule') {
        rows = await selectRows(request.type, (query) => query
          .eq('route_id', payload.route_id)
          .order('created_at', { ascending: false })
          .limit(50), request.signal);
      } else if (request.type === 'deposit_override') {
        rows = await selectRows(request.type, (query) => query
          .eq('resource_type', payload.resource_type)
          .eq('resource_id', payload.resource_id)
          .limit(10), request.signal);
      } else if (request.id) {
        const row = await findById(request);
        rows = row ? [row] : [];
      }

      const expectedFingerprint = String(request.fingerprint || stableSerialize(payload));
      return rows.find((row) => (
        payloadMatches(row, payload)
          && normalizedRowFingerprint(row, payload) === expectedFingerprint
          && (request.type !== 'pricing_rule' || options.allowAnyAge || isRecent(row, request.createdAt))
      )) || null;
    }

    async function reconcileAfterError(request, error, options = {}) {
      if (!isAmbiguousWriteError(error)) return null;
      try {
        const row = request.id
          ? await findById(request)
          : await findMatchingRecord(request, { allowAnyAge: error?.code === '23505' || options.allowAnyAge });
        if (!row) return null;
        if (request.payload && !payloadMatches(row, request.payload)) return null;
        return { data: row, id: String(row.id || request.id || ''), reconciled: true };
      } catch (_reconciliationError) {
        return null;
      }
    }

    async function insert(request = {}) {
      assertNotAborted(request.signal);
      if (request.expectAbsent === true) {
        if (request.type !== 'deposit_override') {
          throw new Error('expectAbsent is supported only for deposit overrides');
        }
        const existingRows = await selectRows(request.type, (query) => query
          .eq('resource_type', request.payload?.resource_type)
          .eq('resource_id', request.payload?.resource_id)
          .limit(2), request.signal);
        if (existingRows.length) {
          throw staleConflict('Deposit override appeared after Review.', {
            type: request.type,
            resourceId: request.payload?.resource_id || null,
          });
        }
      }
      const existing = await findMatchingRecord(request);
      if (existing) {
        return { data: existing, id: String(existing.id || ''), reconciled: true };
      }

      try {
        const result = await run((db) => {
          let query = db.from(tableFor(request.type)).insert(request.payload).select('*');
          query = applySignal(query, request.signal);
          return typeof query.single === 'function' ? query.single() : query;
        });
        const row = rowFromResult(result);
        return { data: row, id: String(row?.id || '') };
      } catch (error) {
        if (request.expectAbsent === true && String(error?.code || '') === '23505') {
          throw staleConflict('Deposit override appeared while the save was starting.', {
            type: request.type,
            resourceId: request.payload?.resource_id || null,
          });
        }
        const reconciled = await reconcileAfterError(request, error);
        if (reconciled) return reconciled;
        throw error;
      }
    }

    async function update(request = {}) {
      assertNotAborted(request.signal);
      const id = String(request.id || '').trim();
      if (!id) throw new Error('Update requires an existing record ID');
      const expectedUpdatedAt = String(request.expectedUpdatedAt || '').trim();
      try {
        const result = await run((db) => {
          let query = db.from(tableFor(request.type)).update(request.payload).eq('id', id);
          if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
          query = query.select('*');
          query = applySignal(query, request.signal);
          return expectedUpdatedAt || typeof query.single !== 'function' ? query : query.single();
        });
        if (expectedUpdatedAt) {
          const rows = rowsFromResult(result);
          if (!rows.length) {
            throw staleConflict('Record changed since Review or no longer exists.', {
              type: request.type,
              id,
              expectedUpdatedAt,
            });
          }
          if (rows.length !== 1) {
            const error = new Error(`Exact update returned ${rows.length} rows for ${request.type}:${id}`);
            error.code = 'transport_pair_exact_update_count_invalid';
            throw error;
          }
          return { data: rows[0], id: String(rows[0]?.id || id) };
        }
        const row = rowFromResult(result);
        return { data: row, id: String(row?.id || id) };
      } catch (error) {
        if (expectedUpdatedAt || error?.code === 'transport_pair_stale_conflict') throw error;
        const reconciled = await reconcileAfterError({ ...request, id }, error);
        if (reconciled) return reconciled;
        throw error;
      }
    }

    async function upsert(request = {}) {
      assertNotAborted(request.signal);
      const existing = await findMatchingRecord(request, { allowAnyAge: true });
      if (existing) {
        return { data: existing, id: String(existing.id || ''), reconciled: true };
      }
      const conflict = request.type === 'deposit_override' ? 'resource_type,resource_id' : 'id';
      try {
        await run((db) => applySignal(
          db.from(tableFor(request.type)).upsert(request.payload, { onConflict: conflict }),
          request.signal,
        ));
        const row = await findMatchingRecord({ ...request, signal: null }, { allowAnyAge: true });
        if (!row) throw new Error(`Upserted ${request.type} could not be resolved`);
        return { data: row, id: String(row.id || '') };
      } catch (error) {
        const reconciled = await reconcileAfterError(request, error, { allowAnyAge: true });
        if (reconciled) return reconciled;
        throw error;
      }
    }

    async function remove(request = {}) {
      assertNotAborted(request.signal);
      const id = String(request.id || '').trim();
      if (!id) throw new Error('Delete requires an existing record ID');
      const expectedUpdatedAt = String(request.expectedUpdatedAt || '').trim();
      try {
        const result = await run((db) => {
          let query = db.from(tableFor(request.type)).delete().eq('id', id);
          if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
          if (expectedUpdatedAt) query = query.select('id, updated_at');
          return applySignal(query, request.signal);
        });
        if (expectedUpdatedAt) {
          const rows = rowsFromResult(result);
          if (!rows.length) {
            throw staleConflict('Deposit override changed since Review or no longer exists.', {
              type: request.type,
              id,
              expectedUpdatedAt,
            });
          }
          if (rows.length !== 1) {
            const error = new Error(`Exact delete returned ${rows.length} rows for ${request.type}:${id}`);
            error.code = 'transport_pair_exact_delete_count_invalid';
            throw error;
          }
        }
        return { data: { id }, id };
      } catch (error) {
        if (expectedUpdatedAt || error?.code === 'transport_pair_stale_conflict') throw error;
        if (isAmbiguousWriteError(error)) {
          try {
            const row = await findById({ ...request, id });
            if (!row) return { data: { id }, id, reconciled: true };
          } catch (_reconciliationError) {
          }
        }
        throw error;
      }
    }

    async function reuse(request = {}) {
      assertNotAborted(request.signal);
      const id = String(request.id || '').trim();
      if (!id) throw new Error('Reuse requires an existing record ID');
      return { data: { id }, id, reused: true };
    }

    return Object.freeze({
      delete: remove,
      insert,
      reuse,
      update,
      upsert,
    });
  }

  const api = Object.freeze({ create });

  Object.defineProperty(root, 'TransportAdminRepository', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
