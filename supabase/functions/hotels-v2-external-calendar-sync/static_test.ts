export {};

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("worker uses only allowlisted public RPCs and contains no direct table client", async () => {
  const index = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const expected = [
    "hotel_v2_external_calendar_worker_get_source",
    "hotel_v2_external_calendar_scheduler_enqueue",
    "hotel_v2_external_calendar_scheduler_lease",
    "hotel_v2_external_calendar_worker_begin_sync",
    "hotel_v2_external_calendar_worker_finalize_sync",
    "hotel_v2_external_calendar_worker_fail_sync",
  ];
  for (const rpc of expected) assert(index.includes(`\"${rpc}\"`), `Missing allowlisted RPC ${rpc}`);
  assert(!/\.from\s*\(/.test(index), "The worker must never query a table directly");
  assert(!/hotels_v2_private|hotel_external_calendar_(?:events|day_blocks|sync_runs|sync_jobs)/.test(index), "Private runtime relations must not be named by the worker");
  assert(!/console\./.test(index), "The worker must not log source URLs or raw provider data");
  assert(!/results[^;]{0,300}ical_url/s.test(index), "The worker response must not contain source URLs");
});

Deno.test("worker is an internal endpoint with explicit in-function authentication", async () => {
  const index = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const config = await Deno.readTextFile(new URL("./config.toml", import.meta.url));
  assert(config.trim() === "verify_jwt = false");
  assert(index.includes("x-hotels-v2-ical-sync-secret"));
  assert(index.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!index.includes("Access-Control-Allow-Origin"));
  assert(!index.includes('request.method === "OPTIONS"'));
});

Deno.test("calendar transport pins validated IPs while preserving hostname TLS verification", async () => {
  const core = await Deno.readTextFile(new URL("./core.ts", import.meta.url));
  const index = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(index.includes("Deno.connect({ hostname: target.address"), "The TCP connection must use the vetted literal address");
  assert(index.includes("Deno.startTls(tcp, { hostname: target.hostname })"), "TLS must verify the original hostname via SNI");
  assert(core.includes("Accept-Encoding: identity"), "Compressed provider bodies must not bypass the response bound");
  assert(core.includes("target = await assertSafeHttpsUrl(new URL(location, target.url).toString()"), "Every redirect must be revalidated and repinned");
  assert(!/fetchCalendar\([^)]*fetchImpl/s.test(index), "Provider traffic must not use a hostname-resolving fetch path");
});
