import { createSupabaseClients, requireAdmin } from '../../_utils/supabaseAdmin.js';

export async function onRequest(context) {
  const { request, env } = context;
  try {
    await requireAdmin(request, env);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const { adminClient } = createSupabaseClients(env);

  if (method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const status = url.searchParams.get('status') || '';
    let query = adminClient.from('trips').select('*').order('updated_at', { ascending: false }).limit(50);
    if (status) query = query.eq('status', status);
    if (q) query = query.or(`slug.ilike.%${q}%,start_city.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return jsonError(error.message);
    return jsonOK(data);
  }

  if (method === 'POST') {
    const body = await safeJson(request);
    const now = new Date().toISOString();
    const payload = {
      slug: body?.slug || `trip-${Date.now()}`,
      title: body?.title || { pl: body?.title_pl || '' },
      description: body?.description || { pl: body?.description_pl || '' },
      start_city: body?.start_city || 'Larnaca',
      categories: body?.categories || [],
      pricing_model: body?.pricing_model || 'per_person',
      price_base: body?.price_base ?? null,
      price_per_person: body?.price_per_person ?? null,
      price_extra_person: body?.price_extra_person ?? null,
      included_people: body?.included_people ?? null,
      min_people: body?.min_people ?? null,
      max_people: body?.max_people ?? null,
      min_hours: body?.min_hours ?? null,
      display_mode: body?.display_mode || 'auto',
      display_label: body?.display_label ?? null,
      cover_image_url: body?.cover_image_url ?? null,
      status: 'draft',
      created_at: now,
      updated_at: now
    };
    const { data, error } = await adminClient.from('trips').insert(payload).select('*').single();
    if (error) return jsonError(error.message);
    return jsonOK(data, 201);
  }

  return new Response('Method Not Allowed', { status: 405 });
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
