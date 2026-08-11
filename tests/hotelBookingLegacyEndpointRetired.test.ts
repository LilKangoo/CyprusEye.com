import fs from 'node:fs';
import path from 'node:path';

const endpointPath = path.join(process.cwd(), 'functions/hotel/booking/index.js');
const endpointSource = fs.readFileSync(endpointPath, 'utf8');

function loadEndpointForTest() {
  const executableSource = endpointSource.replace('export async function onRequest', 'async function onRequest');
  const factory = new Function(`${executableSource}\nreturn { onRequest };`);
  return factory() as {
    onRequest: (context: { request: { method: string; json?: () => Promise<unknown> } }) => Promise<Response>;
  };
}

describe('retired legacy Hotel booking endpoint', () => {
  test('contains no service-role database write path', () => {
    expect(endpointSource).not.toContain('createSupabaseClients');
    expect(endpointSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(endpointSource).not.toContain("from('hotel_bookings')");
    expect(endpointSource).not.toMatch(/\.insert\s*\(/);
    expect(endpointSource).not.toContain('request.json()');
    expect(endpointSource).not.toContain('body.status');
    expect(endpointSource).not.toContain('body.total_price');
    expect(endpointSource).not.toContain('body.base_price');
    expect(endpointSource).not.toContain('body.final_price');
  });

  test('fails closed without reading arbitrary booking status or financial values', async () => {
    const { onRequest } = loadEndpointForTest();
    const request = {
      method: 'POST',
      json: jest.fn(async () => {
        throw new Error('retired endpoint must not parse the request body');
      }),
    };

    const response = await onRequest({ request });
    const payload = await response.json();

    expect(request.json).not.toHaveBeenCalled();
    expect(response.status).toBe(410);
    expect(payload).toEqual({
      ok: false,
      error: 'hotel_booking_endpoint_retired',
      message: 'This legacy Hotel booking endpoint is no longer available.',
    });
  });

  test('keeps CORS preflight inert and rejects unsupported methods', async () => {
    const { onRequest } = loadEndpointForTest();

    const preflight = await onRequest({ request: { method: 'OPTIONS' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');

    const getResponse = await onRequest({ request: { method: 'GET' } });
    expect(getResponse.status).toBe(405);
    await expect(getResponse.json()).resolves.toEqual({
      ok: false,
      error: 'method_not_allowed',
      message: 'Method not allowed. Use POST.',
    });
  });
});
