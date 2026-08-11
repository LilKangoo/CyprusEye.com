const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

export async function onRequest(context) {
  const { request } = context;
  
  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  
  // Preserve a clear method contract while keeping this legacy endpoint inert.
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed', message: 'Method not allowed. Use POST.' }, 405);
  }

  // This unauthenticated service-role write path is intentionally retired.
  // Current Hotel pages submit through their existing RLS-protected PostgREST
  // flow; this route must never parse or trust booking status/financial input.
  return json({
    ok: false,
    error: 'hotel_booking_endpoint_retired',
    message: 'This legacy Hotel booking endpoint is no longer available.',
  }, 410);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}
