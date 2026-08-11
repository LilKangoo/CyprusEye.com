function text(value) {
  return String(value == null ? '' : value).trim();
}

function finiteInteger(value, fallback = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function fallbackOfferOrder(left, right) {
  const leftOffer = left?.offer || left || {};
  const rightOffer = right?.offer || right || {};
  const locationDifference = text(leftOffer.location).localeCompare(text(rightOffer.location));
  if (locationDifference) return locationDifference;
  const publicOrderDifference = finiteInteger(leftOffer.sort_order) - finiteInteger(rightOffer.sort_order);
  if (publicOrderDifference) return publicOrderDifference;
  const createdDifference = text(leftOffer.created_at).localeCompare(text(rightOffer.created_at));
  if (createdDifference) return createdDifference;
  return text(leftOffer.id).localeCompare(text(rightOffer.id));
}

export function indexAdminOrderRows(rows = []) {
  return new Map((Array.isArray(rows) ? rows : []).map((row) => [text(row?.offer_id), {
    offer_id: text(row?.offer_id),
    admin_sort_order: finiteInteger(row?.admin_sort_order),
    updated_at: row?.updated_at || null,
  }]));
}

export function sortFleetItemsByAdminOrder(items = [], rows = []) {
  const byOfferId = indexAdminOrderRows(rows);
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftId = text(left?.offer?.id || left?.id);
    const rightId = text(right?.offer?.id || right?.id);
    const leftOrder = byOfferId.get(leftId)?.admin_sort_order;
    const rightOrder = byOfferId.get(rightId)?.admin_sort_order;
    const leftHasOrder = Number.isSafeInteger(leftOrder);
    const rightHasOrder = Number.isSafeInteger(rightOrder);
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
    return fallbackOfferOrder(left, right);
  });
}

export function buildAdminOrderSnapshot(items = [], rows = []) {
  const byOfferId = indexAdminOrderRows(rows);
  return (Array.isArray(items) ? items : []).map((item) => {
    const offerId = text(item?.offer?.id || item?.id);
    const row = byOfferId.get(offerId);
    if (!row || !Number.isSafeInteger(row.admin_sort_order) || !row.updated_at) {
      throw new Error(`Admin display order is incomplete for exact offer ${offerId || 'unknown'}.`);
    }
    return {
      offer_id: offerId,
      admin_sort_order: row.admin_sort_order,
      updated_at: row.updated_at,
    };
  });
}

export function buildAdminOrderMove(items = [], rows = [], offerId, direction) {
  const normalizedDirection = text(direction).toLowerCase();
  if (!['up', 'down'].includes(normalizedDirection)) {
    throw new Error('Admin display order direction must be up or down.');
  }
  const snapshot = buildAdminOrderSnapshot(items, rows);
  const exactOfferId = text(offerId);
  const index = snapshot.findIndex((row) => row.offer_id === exactOfferId);
  if (index < 0) throw new Error(`Exact offer ${exactOfferId || 'unknown'} is not in the Admin Fleet order.`);
  const targetIndex = normalizedDirection === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= snapshot.length) {
    return Object.freeze({ moved: false, expectedRows: snapshot, orderedOfferIds: snapshot.map((row) => row.offer_id) });
  }
  const orderedOfferIds = snapshot.map((row) => row.offer_id);
  [orderedOfferIds[index], orderedOfferIds[targetIndex]] = [orderedOfferIds[targetIndex], orderedOfferIds[index]];
  return Object.freeze({
    moved: true,
    exactOfferId,
    targetOfferId: snapshot[targetIndex].offer_id,
    expectedRows: snapshot,
    orderedOfferIds,
  });
}

export function getAdminOrderControlState(index, total, enabled = true, busy = false) {
  const safeIndex = finiteInteger(index, -1);
  const safeTotal = finiteInteger(total, 0);
  const interactive = enabled === true && busy !== true && safeIndex >= 0 && safeIndex < safeTotal;
  return Object.freeze({
    upDisabled: !interactive || safeIndex === 0,
    downDisabled: !interactive || safeIndex === safeTotal - 1,
  });
}

export function hasCompleteAdminOrder(items = [], rows = []) {
  try {
    return buildAdminOrderSnapshot(items, rows).length === (Array.isArray(items) ? items.length : 0);
  } catch (_) {
    return false;
  }
}
