import { createSupabaseClients, requireAdmin } from '../../_utils/supabaseAdmin.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  try {
    await requireAdmin(request, env);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { adminClient } = createSupabaseClients(env);
  const segments = (params.path || '').split('/').filter(Boolean);

  if (segments.length === 1) {
    const id = segments[0];
    if (request.method === 'GET') {
      const { data, error } = await adminClient.from('trips').select('*').eq('id', id).single();
      if (error) return jsonError(error.message);
      return jsonOK(data);
    }
    if (request.method === 'PUT') {
      const body = await safeJson(request);
      body.updated_at = new Date().toISOString();
      const { data, error } = await adminClient.from('trips').update(body).eq('id', id).select('*').single();
      if (error) return jsonError(error.message);
      return jsonOK(data);
    }
  }

  if (segments.length === 2 && segments[1] === 'publish' && request.method === 'POST') {
    const id = segments[0];
    const { data, error } = await adminClient
      .from('trips')
      .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) return jsonError(error.message);
    return jsonOK(data);
  }

  if (segments.length === 2 && segments[1] === 'bookings' && request.method === 'GET') {
    const id = segments[0];
    const { data, error } = await adminClient
      .from('trip_bookings')
      .select('*')
      .eq('trip_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return jsonError(error.message);
    return jsonOK(data);
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
