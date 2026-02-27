import { createSupabaseClients } from '../../_utils/supabaseAdmin.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export async function onRequest(context) {
  const { request, env } = context;
  
  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  
  // Only allow POST
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
  }
  
  try {
    // Check env vars
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase env vars');
      return json({ ok: false, error: 'Server configuration error. Missing environment variables.' }, 500);
    }
    
    const { adminClient } = createSupabaseClients(env);
    const body = await request.json();

    const required = ['hotel_id','hotel_slug','customer_name','customer_email','arrival_date','departure_date','nights','total_price'];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return json({ ok: false, error: `Missing field: ${k}` }, 400);
      }
    }

    const payload = {
      hotel_id: body.hotel_id,
      hotel_slug: body.hotel_slug,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone || null,
      arrival_date: body.arrival_date,
      departure_date: body.departure_date,
      num_adults: Number(body.num_adults || body.adults || 0),
      num_children: Number(body.num_children || body.children || 0),
      nights: Number(body.nights || 1),
      notes: body.notes || null,
      base_price: body.base_price == null ? null : Number(body.base_price || 0),
      final_price: body.final_price == null ? null : Number(body.final_price || 0),
      total_price: Number(body.total_price || 0),
      coupon_id: body.coupon_id || null,
      coupon_code: body.coupon_code || null,
      coupon_discount_amount: body.coupon_discount_amount == null ? 0 : Number(body.coupon_discount_amount || 0),
      coupon_partner_id: body.coupon_partner_id || null,
      coupon_partner_commission_bps: body.coupon_partner_commission_bps == null ? null : Number(body.coupon_partner_commission_bps),
      status: body.status || 'pending'
    };

    const { data, error } = await adminClient
      .from('hotel_bookings')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({ ok: true, data }, 200);
  } catch (e) {
    return json({ ok: false, error: e.message || 'Unexpected error' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
