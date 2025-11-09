import { createSupabaseClients } from '../_utils/supabaseAdmin.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
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
      total_price: Number(body.total_price || 0),
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
