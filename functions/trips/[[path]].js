import { createSupabaseClients } from '../_utils/supabaseAdmin.js';
import { calcPriceTotal } from '../_utils/price.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const { publicClient, adminClient } = createSupabaseClients(env, request.headers.get('Authorization') || undefined);

  const segments = (params.path || '').split('/').filter(Boolean);
  if (segments.length === 1 && request.method === 'GET') {
    const slug = segments[0];
    const { data, error } = await publicClient
      .from('trips')
      .select('id,slug,title,description,start_city,categories,display_mode,display_label,pricing_model,price_base,price_per_person,price_extra_person,included_people,min_hours,cover_image_url')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (error) return jsonError('Nie znaleziono wycieczki', 404);
    return jsonOK(data);
  }

  if (segments.length === 2 && segments[1] === 'book' && request.method === 'POST') {
    const slug = segments[0];
    const { data: trip, error: tripErr } = await publicClient
      .from('trips')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (tripErr || !trip) return jsonError('Nie znaleziono wycieczki', 404);

    const body = await safeJson(request);
    // Server-side pricing
    const { total, breakdown } = calcPriceTotal(trip, body);

    const insertPayload = {
      trip_id: trip.id,
      customer_name: body?.name || '',
      customer_email: body?.email || '',
      customer_phone: body?.phone || null,
      start_date: body?.start_date || null,
      party_adults: Number(body?.adults ?? 1) || 1,
      party_children: Number(body?.children ?? 0) || 0,
      hours: body?.hours ?? null,
      days: body?.days ?? null,
      price_currency: 'EUR',
      price_base: Number(trip.price_base ?? trip.price_per_person ?? 0) || 0,
      price_addons: Number(body?.addons ?? 0) || 0,
      price_total: total,
      status: 'new',
      notes: null
    };

    // Use adminClient to ensure insert regardless of anon
    const { data: booking, error } = await adminClient
      .from('trip_bookings')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) return jsonError('Nie udało się złożyć rezerwacji');

    return jsonOK({ message: 'Rezerwacja przyjęta', price_total: total, breakdown, booking_id: booking.id }, 201);
  }

  return new Response('Not Found', { status: 404 });
}

function jsonOK(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
async function safeJson(req) {
  try { return await req.json(); } catch { return {}; }
}
