// Cloudflare Pages Function: Permanently erase user and related data
// POST { action: 'preview' | 'execute', confirm_text?: 'DELETE', expected_email?: string }

import { createSupabaseClients, requireAdmin } from '../../../../_utils/supabaseAdmin';
import {
  normalizeEmail as normalizeEmailShared,
  collectDeleteImpact as collectDeleteImpactShared,
  executeHardDelete as executeHardDeleteShared,
  HARD_DELETE_FLOW_VERSION,
} from '../../../../_utils/hardDeleteUser';

const JSON_HEADERS = { 'content-type': 'application/json' };
const DELETE_API_VERSION = '2026-02-17-e5f7a0e-2';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingTableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('relation') && msg.includes('does not exist');
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function isStorageNotFound(error) {
  const message = String(error?.message || '').toLowerCase();
  const errorText = String(error?.error || '').toLowerCase();
  const statusText = String(error?.statusText || '').toLowerCase();
  const status = Number(error?.statusCode || error?.status || 0);
  if (status === 404) return true;
  const combined = `${message} ${errorText} ${statusText}`;
  return combined.includes('bucket not found') || combined.includes('no such bucket');
}

function formatErrorMessage(error) {
  const pickText = (...values) => values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';

  const direct = pickText(
    error?.message,
    error?.error,
    error?.error_description,
    error?.details,
    error?.hint,
    error?.code,
    error?.statusText,
  );
  if (direct) return direct;

  const status = Number(error?.statusCode || error?.status || 0);
  if (status > 0) return `Server error (status ${status})`;

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return `Unexpected server error payload: ${serialized}`;
    }
  } catch (_) {}

  const fallback = String(error ?? '').trim();
  if (fallback && fallback !== '[object Object]') return fallback;
  return 'Unexpected server error (empty error payload)';
}

function describeErrorPayload(error) {
  const pickText = (...values) => values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || '';

  const direct = pickText(
    error?.message,
    error?.error,
    error?.error_description,
    error?.details,
    error?.hint,
    error?.code,
    error?.statusText,
  );
  if (direct) return direct;

  const status = Number(error?.statusCode || error?.status || 0);
  if (status > 0) return `status ${status}`;

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}' && serialized !== 'null') {
      return serialized;
    }
  } catch (_) {}

  const fallback = String(error ?? '').trim();
  if (fallback && fallback !== '[object Object]') return fallback;
  return '';
}

async function safeCountByEq(client, table, column, value) {
  if (value == null || value === '') return 0;
  try {
    const { count, error } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, value);
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
      throw error;
    }
    return Number(count || 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
    throw error;
  }
}

async function safeCountByIlike(client, table, column, value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return 0;
  try {
    const { count, error } = await client
      .from(table)
      .select('id', { count: 'exact', head: true })
      .ilike(column, normalized);
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return null;
      throw error;
    }
    return Number(count || 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) return null;
    throw error;
  }
}

async function countByAnyEmailColumn(client, table, columns, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return 0;

  const uniqueColumns = [...new Set((columns || []).map((col) => String(col || '').trim()).filter(Boolean))];
  if (!uniqueColumns.length) return 0;

  if (uniqueColumns.length > 1) {
    try {
      const orFilter = uniqueColumns.map((column) => `${column}.ilike.${normalized}`).join(',');
      const { count, error } = await client
        .from(table)
        .select('id', { count: 'exact', head: true })
        .or(orFilter);
      if (!error) {
        return Number(count || 0);
      }
      if (!isMissingTableError(error) && !isMissingColumnError(error)) {
        throw error;
      }
    } catch (error) {
      if (!isMissingTableError(error) && !isMissingColumnError(error)) {
        throw error;
      }
    }
  }

  let total = 0;
  let matchedAny = false;
  for (const column of uniqueColumns) {
    const count = await safeCountByIlike(client, table, column, normalized);
    if (count === null) continue;
    matchedAny = true;
    total += Number(count || 0);
  }
  return matchedAny ? total : 0;
}

async function safeDeleteByEq(client, table, column, value) {
  if (value == null || value === '') return 0;
  try {
    const { count, error } = await client
      .from(table)
      .delete({ count: 'exact' })
      .eq(column, value);
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
      throw error;
    }
    return Number(count || 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
    throw error;
  }
}

async function safeDeleteByIlike(client, table, column, value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return 0;
  try {
    const { count, error } = await client
      .from(table)
      .delete({ count: 'exact' })
      .ilike(column, normalized);
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return null;
      throw error;
    }
    return Number(count || 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) return null;
    throw error;
  }
}

async function deleteByEmailColumns(client, table, columns, email) {
  let total = 0;
  for (const column of columns) {
    const deleted = await safeDeleteByIlike(client, table, column, email);
    if (deleted === null) continue;
    total += deleted;
  }
  return total;
}

async function safeNullifyByEq(client, table, targetColumn, matchColumn, value) {
  if (value == null || value === '') return 0;
  try {
    const { count, error } = await client
      .from(table)
      .update({ [targetColumn]: null }, { count: 'exact' })
      .eq(matchColumn, value);
    if (error) {
      if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
      throw error;
    }
    return Number(count || 0);
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) return 0;
    throw error;
  }
}

async function listAllEntries(bucketApi, path) {
  const entries = [];
  let offset = 0;
  while (true) {
    const { data, error } = await bucketApi.list(path, { limit: 100, offset });
    if (error) {
      if (isStorageNotFound(error)) return [];
      throw error;
    }
    const rows = Array.isArray(data) ? data : [];
    entries.push(...rows);
    if (rows.length < 100) break;
    offset += rows.length;
  }
  return entries;
}

async function deleteStoragePrefixRecursive(adminClient, bucket, prefix) {
  let removed = 0;
  const bucketApi = adminClient.storage.from(bucket);

  const walk = async (path) => {
    const entries = await listAllEntries(bucketApi, path);
    if (!entries.length) return;

    const files = [];
    const folders = [];
    entries.forEach((entry) => {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry && entry.id) files.push(fullPath);
      else folders.push(fullPath);
    });

    if (files.length) {
      const { error } = await bucketApi.remove(files);
      if (!error) {
        removed += files.length;
      } else if (!isStorageNotFound(error)) {
        throw error;
      }
    }

    for (const folder of folders) {
      await walk(folder);
    }
  };

  await walk(prefix);
  return removed;
}

async function safeDeleteStoragePrefixRecursive(adminClient, bucket, prefix) {
  try {
    return await deleteStoragePrefixRecursive(adminClient, bucket, prefix);
  } catch (error) {
    if (isStorageNotFound(error)) return 0;
    console.warn('[admin-delete] storage cleanup failed (continuing):', { bucket, prefix, error });
    return 0;
  }
}

export async function collectDeleteImpact(client, userId, email) {
  const counts = {};
  counts.profiles = await safeCountByEq(client, 'profiles', 'id', userId);
  counts.poi_comments = await safeCountByEq(client, 'poi_comments', 'user_id', userId);
  counts.poi_comment_likes = await safeCountByEq(client, 'poi_comment_likes', 'user_id', userId);
  counts.poi_ratings = await safeCountByEq(client, 'poi_ratings', 'user_id', userId);
  counts.user_poi_visits = await safeCountByEq(client, 'user_poi_visits', 'user_id', userId);
  counts.completed_tasks = await safeCountByEq(client, 'completed_tasks', 'user_id', userId);
  counts.shop_addresses = await safeCountByEq(client, 'shop_addresses', 'user_id', userId);
  counts.shop_orders_user = await safeCountByEq(client, 'shop_orders', 'user_id', userId);
  counts.partner_users = await safeCountByEq(client, 'partner_users', 'user_id', userId);
  counts.recommendation_views = await safeCountByEq(client, 'recommendation_views', 'user_id', userId);
  counts.recommendation_clicks = await safeCountByEq(client, 'recommendation_clicks', 'user_id', userId);
  counts.recommendations_created_by = await safeCountByEq(client, 'recommendations', 'created_by', userId);
  counts.recommendations_updated_by = await safeCountByEq(client, 'recommendations', 'updated_by', userId);
  counts.user_saved_catalog_items = await safeCountByEq(client, 'user_saved_catalog_items', 'user_id', userId);
  counts.user_plans = await safeCountByEq(client, 'user_plans', 'user_id', userId);
  counts.admin_push_subscriptions = await safeCountByEq(client, 'admin_push_subscriptions', 'user_id', userId);
  counts.partner_push_subscriptions = await safeCountByEq(client, 'partner_push_subscriptions', 'user_id', userId);
  counts.referrals_as_referrer = await safeCountByEq(client, 'referrals', 'referrer_id', userId);
  counts.referrals_as_referred = await safeCountByEq(client, 'referrals', 'referred_id', userId);
  counts.affiliate_events_as_referrer = await safeCountByEq(client, 'affiliate_commission_events', 'referrer_user_id', userId);
  counts.affiliate_events_as_referred = await safeCountByEq(client, 'affiliate_commission_events', 'referred_user_id', userId);
  counts.admin_activity_target = await safeCountByEq(client, 'admin_activity_log', 'target_user_id', userId);
  counts.admin_activity_actor = await safeCountByEq(client, 'admin_activity_log', 'actor_id', userId);

  if (email) {
    counts.shop_orders_email = await countByAnyEmailColumn(client, 'shop_orders', ['customer_email'], email);
    counts.car_bookings = await countByAnyEmailColumn(client, 'car_bookings', ['email', 'customer_email'], email);
    counts.trip_bookings = await countByAnyEmailColumn(client, 'trip_bookings', ['customer_email'], email);
    counts.hotel_bookings = await countByAnyEmailColumn(client, 'hotel_bookings', ['customer_email'], email);
    counts.service_deposit_requests = await countByAnyEmailColumn(client, 'service_deposit_requests', ['customer_email'], email);
  } else {
    counts.shop_orders_email = 0;
    counts.car_bookings = 0;
    counts.trip_bookings = 0;
    counts.hotel_bookings = 0;
    counts.service_deposit_requests = 0;
  }

  const totalRecords = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  return { counts, total_records: totalRecords };
}

export async function executeHardDelete(client, adminClient, userId, email) {
  const deleted = {};
  const nullified = {};

  nullified.car_bookings_confirmed_by = await safeNullifyByEq(client, 'car_bookings', 'confirmed_by', 'confirmed_by', userId);
  nullified.shop_group_members_assigned_by = await safeNullifyByEq(client, 'shop_customer_group_members', 'assigned_by', 'assigned_by', userId);
  nullified.shop_order_history_changed_by = await safeNullifyByEq(client, 'shop_order_history', 'changed_by', 'changed_by', userId);
  nullified.shop_refunds_processed_by = await safeNullifyByEq(client, 'shop_refunds', 'processed_by', 'processed_by', userId);
  nullified.shop_reviews_moderated_by = await safeNullifyByEq(client, 'shop_reviews', 'moderated_by', 'moderated_by', userId);
  nullified.shop_review_reports_reviewed_by = await safeNullifyByEq(client, 'shop_review_reports', 'reviewed_by', 'reviewed_by', userId);
  nullified.shop_price_history_changed_by = await safeNullifyByEq(client, 'shop_price_history', 'changed_by', 'changed_by', userId);
  nullified.recommendations_created_by = await safeNullifyByEq(client, 'recommendations', 'created_by', 'created_by', userId);
  nullified.recommendations_updated_by = await safeNullifyByEq(client, 'recommendations', 'updated_by', 'updated_by', userId);

  deleted.storage_avatars = await safeDeleteStoragePrefixRecursive(adminClient, 'avatars', userId);
  deleted.storage_poi_photos = await safeDeleteStoragePrefixRecursive(adminClient, 'poi-photos', userId);

  if (email) {
    deleted.shop_orders_email = await deleteByEmailColumns(client, 'shop_orders', ['customer_email'], email);
    deleted.service_deposit_requests = await deleteByEmailColumns(client, 'service_deposit_requests', ['customer_email'], email);
    deleted.car_bookings = await deleteByEmailColumns(client, 'car_bookings', ['email', 'customer_email'], email);
    deleted.trip_bookings = await deleteByEmailColumns(client, 'trip_bookings', ['customer_email'], email);
    deleted.hotel_bookings = await deleteByEmailColumns(client, 'hotel_bookings', ['customer_email'], email);
  } else {
    deleted.shop_orders_email = 0;
    deleted.service_deposit_requests = 0;
    deleted.car_bookings = 0;
    deleted.trip_bookings = 0;
    deleted.hotel_bookings = 0;
  }

  deleted.shop_orders_user = await safeDeleteByEq(client, 'shop_orders', 'user_id', userId);
  deleted.shop_addresses = await safeDeleteByEq(client, 'shop_addresses', 'user_id', userId);
  deleted.recommendation_views = await safeDeleteByEq(client, 'recommendation_views', 'user_id', userId);
  deleted.recommendation_clicks = await safeDeleteByEq(client, 'recommendation_clicks', 'user_id', userId);
  deleted.user_saved_catalog_items = await safeDeleteByEq(client, 'user_saved_catalog_items', 'user_id', userId);
  deleted.user_plans = await safeDeleteByEq(client, 'user_plans', 'user_id', userId);
  deleted.admin_push_subscriptions = await safeDeleteByEq(client, 'admin_push_subscriptions', 'user_id', userId);
  deleted.partner_push_subscriptions = await safeDeleteByEq(client, 'partner_push_subscriptions', 'user_id', userId);
  deleted.referrals_as_referrer = await safeDeleteByEq(client, 'referrals', 'referrer_id', userId);
  deleted.referrals_as_referred = await safeDeleteByEq(client, 'referrals', 'referred_id', userId);
  deleted.affiliate_events_as_referrer = await safeDeleteByEq(client, 'affiliate_commission_events', 'referrer_user_id', userId);
  deleted.affiliate_events_as_referred = await safeDeleteByEq(client, 'affiliate_commission_events', 'referred_user_id', userId);
  deleted.affiliate_referrer_overrides = await safeDeleteByEq(client, 'affiliate_referrer_overrides', 'referrer_user_id', userId);
  deleted.partner_users = await safeDeleteByEq(client, 'partner_users', 'user_id', userId);
  deleted.admin_activity_target = await safeDeleteByEq(client, 'admin_activity_log', 'target_user_id', userId);
  deleted.admin_activity_actor = await safeDeleteByEq(client, 'admin_activity_log', 'actor_id', userId);
  deleted.profiles_referred_by = await safeNullifyByEq(client, 'profiles', 'referred_by', 'referred_by', userId);

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    const detail = describeErrorPayload(authDeleteError);
    const wrapped = new Error(
      detail
        ? `Hard delete failed at auth.admin.deleteUser: ${detail}`
        : 'Hard delete failed at auth.admin.deleteUser',
    );
    wrapped.cause = authDeleteError;
    throw wrapped;
  }

  const deletedRecords = Object.values(deleted).reduce((sum, value) => sum + Number(value || 0), 0);
  const nullifiedRecords = Object.values(nullified).reduce((sum, value) => sum + Number(value || 0), 0);
  return { deleted, nullified, deleted_records: deletedRecords, nullified_records: nullifiedRecords };
}

export async function onRequestPost(context) {
  let requestAction = 'unknown';
  let routeStep = 'start';

  const runRouteStep = async (step, operation) => {
    routeStep = step;
    try {
      return await operation();
    } catch (error) {
      const detail = formatErrorMessage(error);
      throw new Error(detail ? `${step} failed: ${detail}` : `${step} failed`);
    }
  };

  try {
    const { request, env, params } = context;
    const body = await request.json().catch(() => ({}));
    const userId = params.id;

    if (!userId) return json({ error: 'Missing user id' }, 400);

    const { adminId } = await runRouteStep('require_admin', () => requireAdmin(request, env));
    if (adminId === userId) {
      return json({ error: 'You cannot delete your own admin account.' }, 400);
    }

    const { adminClient } = createSupabaseClients(env, request.headers.get('Authorization'));
    const action = String(body?.action || 'preview').trim().toLowerCase();
    requestAction = action;

    const { data: authData, error: authError } = await runRouteStep('auth_get_user_by_id', () =>
      adminClient.auth.admin.getUserById(userId),
    );
    if (authError || !authData?.user) {
      return json({ error: 'Target user not found' }, 404);
    }
    const targetEmail = normalizeEmailShared(authData.user.email);

    const { data: profile } = await runRouteStep('load_target_profile', () =>
      adminClient
        .from('profiles')
        .select('id, is_admin')
        .eq('id', userId)
        .maybeSingle(),
    );

    if (profile?.is_admin) {
      const { count: otherAdmins, error: adminsError } = await runRouteStep('count_other_admins', () =>
        adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_admin', true)
          .neq('id', userId),
      );
      if (!adminsError && Number(otherAdmins || 0) === 0) {
        return json({ error: 'Cannot delete the last admin account.' }, 400);
      }
    }

    if (action === 'preview') {
      let impact;
      try {
        impact = await runRouteStep('collect_delete_impact_preview', () =>
          collectDeleteImpactShared(adminClient, userId, targetEmail),
        );
      } catch (impactError) {
        console.warn('[admin-delete] preview impact collection failed, continuing:', impactError);
        impact = { counts: {}, total_records: 0 };
      }
      return json({
        ok: true,
        action: 'preview',
        api_version: DELETE_API_VERSION,
        hard_delete_flow_version: HARD_DELETE_FLOW_VERSION,
        user_id: userId,
        email: targetEmail || null,
        ...impact,
      });
    }

    if (action !== 'execute') {
      return json({ error: 'Invalid action' }, 400);
    }

    const confirmText = String(body?.confirm_text || '').trim();
    if (confirmText !== 'DELETE') {
      return json({ error: 'Confirmation token mismatch' }, 400);
    }

    const expectedEmail = normalizeEmailShared(body?.expected_email);
    if (expectedEmail && targetEmail && expectedEmail !== targetEmail) {
      return json({ error: 'Email confirmation mismatch' }, 400);
    }

    const result = await runRouteStep('execute_hard_delete', () =>
      executeHardDeleteShared(adminClient, adminClient, userId, targetEmail),
    );
    return json({
      ok: true,
      action: 'execute',
      api_version: DELETE_API_VERSION,
      hard_delete_flow_version: HARD_DELETE_FLOW_VERSION,
      user_id: userId,
      email: targetEmail || null,
      ...result,
    });
  } catch (e) {
    const message = formatErrorMessage(e);
    console.error('[admin-delete] failed:', e);
    return json({
      error: message || 'Server error',
      api_version: DELETE_API_VERSION,
      hard_delete_flow_version: HARD_DELETE_FLOW_VERSION,
      request_action: requestAction,
      route_step: routeStep,
    }, 500);
  }
}
