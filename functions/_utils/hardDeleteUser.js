// Shared helpers for hard-deleting user data across API routes.

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export const HARD_DELETE_FLOW_VERSION = '2026-02-17-compact-subreq-1';

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

function isMissingTableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const combined = `${msg} ${details} ${hint}`;

  if (code === '42p01' || code === 'pgrst205') return true;
  if (combined.includes('relation') && combined.includes('does not exist')) return true;
  return combined.includes('could not find')
    && combined.includes('table')
    && combined.includes('schema cache');
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const combined = `${msg} ${details} ${hint}`;

  if (code === '42703' || code === 'pgrst204') return true;
  if (combined.includes('column') && combined.includes('does not exist')) return true;
  return combined.includes('could not find')
    && combined.includes('column')
    && combined.includes('schema cache');
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
    console.warn('[hard-delete] storage cleanup failed (continuing):', { bucket, prefix, error });
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

function buildStepError(step, error) {
  const detail = describeErrorPayload(error);
  const wrapped = new Error(
    detail
      ? `Hard delete failed at ${step}: ${detail}`
      : `Hard delete failed at ${step}`,
  );
  wrapped.cause = error;
  return wrapped;
}

async function runDeleteStep(step, operation) {
  try {
    return await operation();
  } catch (error) {
    throw buildStepError(step, error);
  }
}

async function deleteAuthUserDirect(adminClient, userId) {
  // Fallback path when auth.admin.deleteUser returns opaque/empty payloads.
  const { error } = await adminClient
    .schema('auth')
    .from('users')
    .delete()
    .eq('id', userId);
  if (error) throw error;
  return true;
}

export async function executeHardDelete(client, adminClient, userId, email) {
  const deleted = {
    storage_avatars: 0,
    storage_poi_photos: 0,
    shop_orders_email: 0,
    service_deposit_requests: 0,
    car_bookings: 0,
    trip_bookings: 0,
    hotel_bookings: 0,
    shop_orders_user: 0,
    shop_addresses: 0,
    recommendation_views: 0,
    recommendation_clicks: 0,
    poi_comments: 0,
    poi_comment_likes: 0,
    poi_ratings: 0,
    user_poi_visits: 0,
    completed_tasks: 0,
    user_saved_catalog_items: 0,
    user_plans: 0,
    admin_push_subscriptions: 0,
    partner_push_subscriptions: 0,
    referrals_as_referrer: 0,
    referrals_as_referred: 0,
    affiliate_events_as_referrer: 0,
    affiliate_events_as_referred: 0,
    affiliate_referrer_overrides: 0,
    partner_users: 0,
    admin_activity_target: 0,
    admin_activity_actor: 0,
    profiles_referred_by: 0,
    auth_user_deleted_via_fallback: 0,
  };
  const nullified = {
    car_bookings_confirmed_by: 0,
    shop_group_members_assigned_by: 0,
    shop_order_history_changed_by: 0,
    shop_refunds_processed_by: 0,
    shop_reviews_moderated_by: 0,
    shop_review_reports_reviewed_by: 0,
    shop_price_history_changed_by: 0,
    recommendations_created_by: 0,
    recommendations_updated_by: 0,
    shop_order_fulfillments_accepted_by: 0,
    shop_order_fulfillments_rejected_by: 0,
    partner_service_fulfillments_accepted_by: 0,
    partner_service_fulfillments_rejected_by: 0,
    partner_audit_log_actor_user_id: 0,
    partner_thread_messages_author_user_id: 0,
    partner_availability_blocks_created_by: 0,
    affiliate_cashout_requests_requested_by: 0,
    affiliate_payouts_created_by: 0,
    affiliate_payouts_paid_by: 0,
    affiliate_adjustments_created_by: 0,
    partner_payout_details_updated_by: 0,
    shop_product_views_user_id: 0,
    xp_config_updated_by: 0,
  };

  // Keep the recommendation FKs clear to avoid auth delete failures.
  nullified.recommendations_created_by = await runDeleteStep('nullify recommendations.created_by', () =>
    safeNullifyByEq(client, 'recommendations', 'created_by', 'created_by', userId),
  );
  nullified.recommendations_updated_by = await runDeleteStep('nullify recommendations.updated_by', () =>
    safeNullifyByEq(client, 'recommendations', 'updated_by', 'updated_by', userId),
  );
  deleted.recommendation_views = await runDeleteStep('delete recommendation_views by user_id', () =>
    safeDeleteByEq(client, 'recommendation_views', 'user_id', userId),
  );
  deleted.recommendation_clicks = await runDeleteStep('delete recommendation_clicks by user_id', () =>
    safeDeleteByEq(client, 'recommendation_clicks', 'user_id', userId),
  );

  deleted.storage_avatars = await runDeleteStep('storage cleanup avatars', () =>
    safeDeleteStoragePrefixRecursive(adminClient, 'avatars', userId),
  );
  deleted.storage_poi_photos = await runDeleteStep('storage cleanup poi-photos', () =>
    safeDeleteStoragePrefixRecursive(adminClient, 'poi-photos', userId),
  );

  if (email) {
    deleted.shop_orders_email = await runDeleteStep('delete shop_orders by customer_email', () =>
      deleteByEmailColumns(client, 'shop_orders', ['customer_email'], email),
    );
    deleted.service_deposit_requests = await runDeleteStep('delete service_deposit_requests by customer_email', () =>
      deleteByEmailColumns(client, 'service_deposit_requests', ['customer_email'], email),
    );
    deleted.car_bookings = await runDeleteStep('delete car_bookings by email/customer_email', () =>
      deleteByEmailColumns(client, 'car_bookings', ['email', 'customer_email'], email),
    );
    deleted.trip_bookings = await runDeleteStep('delete trip_bookings by customer_email', () =>
      deleteByEmailColumns(client, 'trip_bookings', ['customer_email'], email),
    );
    deleted.hotel_bookings = await runDeleteStep('delete hotel_bookings by customer_email', () =>
      deleteByEmailColumns(client, 'hotel_bookings', ['customer_email'], email),
    );
  }

  // Keep direct user-linked commerce rows deterministic even when email is missing.
  deleted.shop_orders_user = await runDeleteStep('delete shop_orders by user_id', () =>
    safeDeleteByEq(client, 'shop_orders', 'user_id', userId),
  );
  deleted.shop_addresses = await runDeleteStep('delete shop_addresses by user_id', () =>
    safeDeleteByEq(client, 'shop_addresses', 'user_id', userId),
  );

  deleted.profiles_referred_by = await runDeleteStep('nullify profiles.referred_by', () =>
    safeNullifyByEq(client, 'profiles', 'referred_by', 'referred_by', userId),
  );

  const { error: authDeleteError } = await runDeleteStep('auth.admin.deleteUser request', async () =>
    adminClient.auth.admin.deleteUser(userId),
  );
  if (authDeleteError) {
    try {
      await runDeleteStep('auth.users direct delete fallback', async () =>
        deleteAuthUserDirect(adminClient, userId),
      );
      deleted.auth_user_deleted_via_fallback = 1;
    } catch (fallbackError) {
      const primary = describeErrorPayload(authDeleteError) || 'empty';
      const secondary = describeErrorPayload(fallbackError) || 'empty';
      throw new Error(
        `Hard delete failed at auth user removal: admin.deleteUser=${primary}; direct auth.users delete=${secondary}`,
      );
    }
  }

  const deletedRecords = Object.values(deleted).reduce((sum, value) => sum + Number(value || 0), 0);
  const nullifiedRecords = Object.values(nullified).reduce((sum, value) => sum + Number(value || 0), 0);
  return { deleted, nullified, deleted_records: deletedRecords, nullified_records: nullifiedRecords };
}
