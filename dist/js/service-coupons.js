import { supabase } from './supabaseClient.js';

function normalizeTextArray(values) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean),
  ));
}

function normalizeQuoteRow(row) {
  if (!row || typeof row !== 'object') return null;
  const isValid = Boolean(row.is_valid);
  const baseTotal = Number(row.base_total || 0);
  const discountAmount = Number(row.discount_amount || 0);
  const finalTotal = Number(row.final_total || 0);
  return {
    isValid,
    message: String(row.message || (isValid ? 'Coupon applied' : 'Coupon invalid')),
    couponId: row.coupon_id ? String(row.coupon_id) : null,
    couponCode: String(row.coupon_code || '').trim().toUpperCase(),
    discountType: String(row.discount_type || '').trim().toLowerCase(),
    discountValue: Number(row.discount_value || 0),
    baseTotal: Number.isFinite(baseTotal) ? baseTotal : 0,
    discountAmount: Number.isFinite(discountAmount) ? Math.max(discountAmount, 0) : 0,
    finalTotal: Number.isFinite(finalTotal) ? Math.max(finalTotal, 0) : 0,
    currency: String(row.currency || 'EUR').trim().toUpperCase() || 'EUR',
    partnerId: row.partner_id ? String(row.partner_id) : null,
    partnerCommissionBpsOverride: row.partner_commission_bps_override == null
      ? null
      : Number(row.partner_commission_bps_override),
  };
}

export async function quoteServiceCoupon(params = {}) {
  const serviceType = String(params.serviceType || '').trim().toLowerCase();
  const couponCode = String(params.couponCode || '').trim().toUpperCase();
  const baseTotal = Number(params.baseTotal || 0);
  const serviceAt = params.serviceAt ? new Date(params.serviceAt) : null;
  const serviceAtIso = serviceAt && Number.isFinite(serviceAt.getTime()) ? serviceAt.toISOString() : null;
  const resourceId = String(params.resourceId || '').trim() || null;
  const categoryKeys = normalizeTextArray(params.categoryKeys);
  const userId = String(params.userId || '').trim() || null;
  const userEmail = String(params.userEmail || '').trim().toLowerCase() || null;

  if (!serviceType) {
    return { ok: false, message: 'Missing service type', result: null };
  }
  if (!couponCode) {
    return { ok: false, message: 'Enter a coupon code', result: null };
  }
  if (!Number.isFinite(baseTotal) || baseTotal <= 0) {
    return { ok: false, message: 'Complete booking details first', result: null };
  }

  const payload = {
    p_service_type: serviceType,
    p_coupon_code: couponCode,
    p_base_total: Number(baseTotal.toFixed(2)),
    p_service_at: serviceAtIso,
    p_resource_id: resourceId,
    p_category_keys: categoryKeys,
    p_user_id: userId,
    p_user_email: userEmail,
  };

  const payloadVariants = [
    payload,
    { ...payload, p_user_id: null },
    { ...payload, p_user_id: null, p_user_email: null },
    { ...payload, p_category_keys: [] },
  ];

  let lastError = null;
  for (const variant of payloadVariants) {
    const { data, error } = await supabase.rpc('service_coupon_quote', variant);
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      const result = normalizeQuoteRow(row);
      if (!result) {
        return { ok: false, message: 'Coupon validation returned empty response', result: null };
      }
      if (!result.isValid) {
        return { ok: false, message: result.message || 'Coupon is not valid for selected details', result };
      }
      return { ok: true, message: result.message || 'Coupon applied', result };
    }

    lastError = error;
    const errCode = String(error?.code || '').trim();
    const errMsg = String(error?.message || '').toLowerCase();
    const canRetry = errCode === 'PGRST202'
      || errCode === '42883'
      || errMsg.includes('schema cache')
      || errMsg.includes('could not find the function')
      || errMsg.includes('function public.service_coupon_quote');
    if (!canRetry) break;
  }

  const errMessage = String(lastError?.message || 'Coupon validation failed');
  return { ok: false, message: errMessage, result: null };
}

if (typeof window !== 'undefined') {
  window.CE_SERVICE_COUPONS = {
    quoteServiceCoupon,
  };
}

