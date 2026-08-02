import http from 'node:http';

const host = '127.0.0.1';
const listenPort = Number(process.env.CAR_MULTICITY_SUPABASE_GATEWAY_PORT || 52999);
const postgrestPort = Number(process.env.CAR_MULTICITY_POSTGREST_PORT || 53000);

const server = http.createServer((request, response) => {
  const incomingUrl = new URL(request.url || '/', `http://${host}:${listenPort}`);
  const upstreamPath = incomingUrl.pathname.startsWith('/rest/v1')
    ? incomingUrl.pathname.slice('/rest/v1'.length) || '/'
    : incomingUrl.pathname;
  const upstream = http.request({
    host,
    port: postgrestPort,
    method: request.method,
    path: `${upstreamPath}${incomingUrl.search}`,
    headers: { ...request.headers, host: `${host}:${postgrestPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', (error) => {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: error.message }));
  });
  request.pipe(upstream);
});

server.listen(listenPort, host, () => {
  process.stdout.write(`Supabase REST prefix proxy listening on http://${host}:${listenPort}\n`);
});
